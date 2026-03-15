import { supabase } from './supabase.js';

const CONGRESS_API_KEY = import.meta.env.VITE_CONGRESS_API_KEY;
const OPENSTATES_API_KEY = import.meta.env.VITE_OPENSTATES_API_KEY;

// ── Geocode zip → state + lat/lng via Zippopotam.us (free, no key) ───────────

async function geocodeZip(zip) {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!res.ok) throw new Error(`Could not geocode zip code ${zip}`);
  const data = await res.json();
  const place = data.places?.[0];
  if (!place) throw new Error(`No location found for zip code ${zip}`);
  return {
    lat: parseFloat(place.latitude),
    lng: parseFloat(place.longitude),
    state: place['state abbreviation'],
  };
}

// ── Look up congressional district for a zip code via Supabase ───────────────
// Data comes from the US Census Bureau ZCTA crosswalk (118th Congress).
// Returns district number (integer) or null if zip not found.

async function getCongressionalDistrict(zip) {
  if (!supabase) return null;
  try {
    // Debug: check both zero-padded and stripped versions
    const zipStripped = String(parseInt(zip, 10));
    const zipPadded   = zip.padStart(5, '0');

    const [resA, resB] = await Promise.all([
      supabase.from('zip_districts').select('zip, district').eq('zip', zipPadded).limit(5),
      supabase.from('zip_districts').select('zip, district').eq('zip', zipStripped).limit(5),
    ]);
    console.log('[civic] zip_districts query — padded', zipPadded, ':', resA.data, resA.error?.message);
    console.log('[civic] zip_districts query — stripped', zipStripped, ':', resB.data, resB.error?.message);

    const rows = resA.data?.length ? resA.data : resB.data;
    if (!rows?.length) {
      console.warn('[civic] no district found for zip', zip);
      return null;
    }
    console.log('[civic] congressional district for zip', zip, ':', rows[0].district);
    return rows[0].district;
  } catch (err) {
    console.warn('[civic] zip_districts lookup error:', err);
    return null;
  }
}

// ── Federal reps via Congress.gov /member/{stateCode} ─────────────────────────
// Returns both senators + the correct house rep for the zip's district.
// Falls back to all house reps if district lookup fails.

async function getFederalReps(stateCode, zip) {
  if (!CONGRESS_API_KEY) throw new Error('VITE_CONGRESS_API_KEY is not configured');

  const [membersRes, district] = await Promise.all([
    fetch(`https://api.congress.gov/v3/member/${stateCode}?currentMember=true&limit=50&api_key=${CONGRESS_API_KEY}`),
    getCongressionalDistrict(zip),
  ]);

  const text = await membersRes.text();
  console.log('[civic] Congress.gov raw response:', text);
  const data = JSON.parse(text);

  if (!membersRes.ok) throw new Error(data.error?.message || `Congress API error ${membersRes.status}`);

  const members = data.members || [];
  const senators = [];
  const houseReps = [];

  for (const m of members) {
    const chamber = m.terms?.item?.at(-1)?.chamber || m.chamber || '';
    const isSenate = chamber === 'Senate' || chamber === 'Senate of the United States';
    const memberDistrict = m.district ? parseInt(m.district, 10) : null;
    const office = isSenate
      ? `U.S. Senator (${stateCode})`
      : `U.S. Representative (${stateCode}${m.district ? `-${m.district}` : ''})`;

    const rep = {
      name: m.name,
      office,
      party: m.partyName || 'Unknown',
      email: null,
      website: m.url || null,
      phone: null,
      photo: m.depiction?.imageUrl || null,
      division: null,
      level: 'country',
      state: stateCode,
      district: memberDistrict,
    };

    if (isSenate) {
      senators.push(rep);
    } else {
      houseReps.push(rep);
    }
  }

  // Narrow to the constituent's house rep; fall back to all if lookup failed
  const matchedHouseReps = district !== null
    ? (houseReps.filter(r => r.district === district).length > 0
        ? houseReps.filter(r => r.district === district)
        : houseReps)
    : houseReps;

  return [...senators, ...matchedHouseReps];
}

// ── State reps via Open States ────────────────────────────────────────────────

async function getStateReps(lat, lng) {
  if (!OPENSTATES_API_KEY) return [];
  const url = `https://v3.openstates.org/people.geo?lat=${lat}&lng=${lng}&apikey=${OPENSTATES_API_KEY}`;
  console.log('[civic] getStateReps URL:', url);
  const res = await fetch(url);
  const data = await res.json();
  console.log('[civic] Open States raw response:', JSON.stringify(data, null, 2));
  console.log('[civic] Open States result count:', data.results?.length);
  (data.results || []).forEach((p, i) => {
    console.log(`[civic]   [${i}] name: ${p.name}, role: ${p.current_role?.title}, chamber: ${p.current_role?.org_classification}, jurisdiction: ${p.jurisdiction?.name}`);
  });
  if (!res.ok) { console.warn('[civic] Open States error:', data); return []; }
  return (data.results || []).filter(p => p.jurisdiction?.classification === 'state').map(p => ({
    name: p.name,
    office: p.current_role?.title || 'State Legislator',
    party: p.party || 'Unknown',
    email: p.email || null,
    website: p.links?.[0]?.url || null,
    phone: null,
    photo: p.image || null,
    division: null,
    level: 'administrativeArea1',
    state: p.jurisdiction?.name || null,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────
// scope: 'federal' → Congress.gov only (senators + house reps)
//        'state'   → Open States only (state legislators)
// The two sources are never mixed.

export async function getRepresentatives(zip, scope = 'federal') {
  console.log('[civic] getRepresentatives called — zip:', zip, 'scope:', scope);
  try {
    const geocodeResult = await geocodeZip(zip).catch(() => null);
    if (!geocodeResult) {
      return { error: 'Could not look up that zip code. Please check and try again.', reps: null };
    }

    const { lat, lng, state: userState } = geocodeResult;

    if (scope === 'federal') {
      const reps = await getFederalReps(userState, zip).catch(err => {
        console.warn('[civic] Federal lookup failed:', err);
        return null;
      });
      if (!reps) return { error: 'Could not reach the Congress.gov API. Please try again.', reps: null };
      return { error: null, reps, state: userState };
    }

    // scope === 'state'
    const reps = await getStateReps(lat, lng).catch(err => {
      console.warn('[civic] State lookup failed:', err);
      return [];
    });
    return { error: null, reps, state: userState };

  } catch (err) {
    console.error('[civic] getRepresentatives error:', err);
    return { error: 'Failed to look up representatives. Please check your zip code and try again.', reps: null };
  }
}

// ── Filter reps by bill scope (called by EmailComposer) ──────────────────────

export function filterRepsForBill(reps, billState, userState) {
  if (billState === 'US') {
    return reps;
  }
  if (userState && userState.toUpperCase() === billState.toUpperCase()) {
    return reps;
  }
  return null; // signals "wrong state" to EmailComposer
}
