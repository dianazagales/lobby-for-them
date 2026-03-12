const CONGRESS_API_KEY = import.meta.env.VITE_CONGRESS_API_KEY || 'DEMO_KEY';
const OPENSTATES_API_KEY = import.meta.env.VITE_OPENSTATES_API_KEY;

// ── Federal reps via Congress.gov ─────────────────────────────────────────────

async function getFederalReps(zip) {
  const url = `https://api.congress.gov/v3/member?zipCode=${encodeURIComponent(zip)}&api_key=${CONGRESS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || `Congress API error ${res.status}`);
  }

  return (data.members || []).map(m => ({
    name: `${m.name}`,
    office: formatCongressTitle(m),
    party: m.partyName || 'Unknown',
    email: null,
    website: m.url || null,
    phone: null,
    photo: m.depiction?.imageUrl || null,
    division: null,
    level: 'country',
    state: m.state || null,
  }));
}

function formatCongressTitle(member) {
  const chamber = member.terms?.item?.at(-1)?.chamber || member.chamber || '';
  if (chamber === 'Senate' || chamber === 'Senate of the United States') return `U.S. Senator (${member.state || ''})`;
  if (chamber === 'House of Representatives') return `U.S. Representative (${member.district ? `${member.state}-${member.district}` : member.state || ''})`;
  return chamber || 'U.S. Congress Member';
}

// ── Geocode zip → lat/lng via Zippopotam.us (free, no key) ───────────────────

async function geocodeZip(zip) {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!res.ok) throw new Error(`Could not geocode zip code ${zip}`);
  const data = await res.json();
  const place = data.places?.[0];
  if (!place) throw new Error(`No location found for zip code ${zip}`);
  return {
    lat: parseFloat(place.latitude),
    lng: parseFloat(place.longitude),
    state: data['state abbreviation'],
  };
}

// ── State reps via Open States ────────────────────────────────────────────────

async function getStateReps(lat, lng) {
  if (!OPENSTATES_API_KEY) return [];

  const url = `https://v3.openstates.org/people.geo?lat=${lat}&lng=${lng}&apikey=${OPENSTATES_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    console.warn('Open States API error:', data);
    return [];
  }

  return (data.results || []).map(p => ({
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

export async function getRepresentatives(zip) {
  try {
    // Always fetch federal reps; geocode + state reps in parallel
    const geocodePromise = geocodeZip(zip);
    const federalPromise = getFederalReps(zip);

    const [geocodeResult, federalReps] = await Promise.all([
      geocodePromise.catch(err => { console.warn('Geocode failed:', err); return null; }),
      federalPromise.catch(err => { console.warn('Congress API failed:', err); return null; }),
    ]);

    if (federalReps === null && geocodeResult === null) {
      return { error: 'Could not look up representatives. Please check your zip code and try again.', reps: null };
    }

    let stateReps = [];
    let userState = geocodeResult?.state || null;

    if (geocodeResult) {
      stateReps = await getStateReps(geocodeResult.lat, geocodeResult.lng).catch(err => {
        console.warn('Open States API failed:', err);
        return [];
      });
    }

    const reps = [...(federalReps || []), ...stateReps];
    return { error: null, reps, state: userState };
  } catch (err) {
    console.error('getRepresentatives error:', err);
    return { error: 'Failed to look up representatives. Please check your zip code and try again.', reps: null };
  }
}

// ── Filter reps by bill scope (called by EmailComposer) ──────────────────────

export function filterRepsForBill(reps, billState, userState) {
  if (billState === 'US') {
    return reps.filter(r => r.level === 'country');
  } else {
    if (userState && userState.toUpperCase() === billState.toUpperCase()) {
      return reps.filter(r => r.level === 'administrativeArea1');
    }
    return null; // signals "wrong state"
  }
}
