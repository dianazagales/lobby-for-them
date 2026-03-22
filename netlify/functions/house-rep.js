// Proxy for Google Civic Information API — avoids CORS and keeps the key server-side.
// Usage: /.netlify/functions/house-rep?zip=02864

export async function handler(event) {
  console.log('[house-rep] invoked, zip:', event.queryStringParameters?.zip);
  console.log('[house-rep] GOOGLE_CIVIC_API_KEY set:', !!process.env.GOOGLE_CIVIC_API_KEY);
  const zip = event.queryStringParameters?.zip;

  if (!zip || !/^\d{5}$/.test(zip)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid or missing zip parameter' }),
    };
  }

  const apiKey = process.env.GOOGLE_CIVIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GOOGLE_CIVIC_API_KEY is not configured' }),
    };
  }

  try {
    const url = `https://www.googleapis.com/civicinfo/v2/representatives?address=${encodeURIComponent(zip)}&levels=country&roles=legislatorLowerBody&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: data.error?.message || `Civic API error ${res.status}` }),
      };
    }

    // offices[].officialIndices maps each office to its officials
    // roles=legislatorLowerBody so all returned offices are House seats
    const offices = data.offices || [];
    const officials = data.officials || [];

    const results = [];
    for (const office of offices) {
      // Extract state + district from divisionId, e.g. "ocd-division/country:us/state:ri/cd:2"
      const stateMatch = office.divisionId?.match(/state:([a-z]+)/);
      const districtMatch = office.divisionId?.match(/cd:(\d+)/);
      const state = stateMatch ? stateMatch[1].toUpperCase() : null;
      const district = districtMatch ? districtMatch[1] : null;

      for (const idx of (office.officialIndices || [])) {
        const official = officials[idx];
        if (!official) continue;
        results.push({
          name: official.name,
          party: official.party || 'Unknown',
          state,
          district,
          website: official.urls?.[0] || null,
          photo: official.photoUrl || null,
          phone: official.phones?.[0] || null,
        });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    };
  } catch (err) {
    console.error('[house-rep] Unhandled error:', err);
    console.error('[house-rep] Stack:', err.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
