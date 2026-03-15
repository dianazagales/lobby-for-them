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

// ── Congressional district lookup via Supabase ────────────────────────────────
// Data: US Census Bureau ZCTA crosswalk (118th Congress).
// Returns district number (integer) or null if zip not found.

async function getCongressionalDistrict(zip) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('zip_districts')
      .select('district')
      .eq('zip', zip.padStart(5, '0'))
      .limit(1);
    return data?.[0]?.district ?? null;
  } catch {
    return null;
  }
}

// ── Federal reps via Congress.gov /member/{stateCode} ─────────────────────────
// Returns 2 senators + the house rep for the zip's congressional district.
// Falls back to all house reps for the state if district lookup fails.

async function getFederalReps(stateCode, zip) {
  if (!CONGRESS_API_KEY) throw new Error('VITE_CONGRESS_API_KEY is not configured');

  const [membersRes, district] = await Promise.all([
    fetch(`https://api.congress.gov/v3/member/${stateCode}?currentMember=true&limit=50&api_key=${CONGRESS_API_KEY}`),
    getCongressionalDistrict(zip),
  ]);

  const data = await membersRes.json();
  if (!membersRes.ok) throw new Error(data.error?.message || `Congress API error ${membersRes.status}`);

  const senators = [];
  const houseReps = [];

  for (const m of data.members || []) {
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
      level: 'country',
      state: stateCode,
      district: memberDistrict,
    };

    if (isSenate) senators.push(rep);
    else houseReps.push(rep);
  }

  const matched = district !== null ? houseReps.filter(r => r.district === district) : [];
  return [...senators, ...(matched.length > 0 ? matched : houseReps)];
}

// ── State reps via Open States ────────────────────────────────────────────────
// IMPORTANT: filter to jurisdiction.classification === 'state'.
// Open States returns federal reps too — without this filter they leak into results.

async function getStateReps(lat, lng) {
  if (!OPENSTATES_API_KEY) return [];
  const res = await fetch(`https://v3.openstates.org/people.geo?lat=${lat}&lng=${lng}&apikey=${OPENSTATES_API_KEY}`);
  const data = await res.json();
  if (!res.ok) { console.warn('[civic] Open States error:', data); return []; }
  return (data.results || [])
    .filter(p => p.jurisdiction?.classification === 'state')
    .map(p => ({
      name: p.name,
      office: p.current_role?.title || 'State Legislator',
      party: p.party || 'Unknown',
      email: p.email || null,
      website: p.links?.[0]?.url || null,
      phone: null,
      photo: p.image || null,
      level: 'administrativeArea1',
      state: p.jurisdiction?.name || null,
    }));
}

// ── Public API ────────────────────────────────────────────────────────────────
// scope: 'federal' → Congress.gov only (2 senators + 1 house rep)
//        'state'   → Open States only (state legislators)
// The two sources are never mixed.

export async function getRepresentatives(zip, scope = 'federal') {
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
// Since getRepresentatives is already scoped, this only needs to guard the
// wrong-state case for state bills.

export function filterRepsForBill(reps, billState, userState) {
  if (billState === 'US') return reps;
  if (userState && userState.toUpperCase() === billState.toUpperCase()) return reps;
  return null; // signals "wrong state" to EmailComposer
}
