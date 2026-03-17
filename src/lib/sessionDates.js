/**
 * 2026 state legislative session data.
 * Source: NCSL 2026 State Legislative Session Calendar (ncsl.org)
 *
 * oddYearOnly: true  — biennial legislature, no 2026 regular session
 * convene / adjourn  — ISO date strings; adjourn is approximate (~) where
 *                      the constitution sets a day-count limit but no fixed date
 */

export const STATE_NAMES = {
  AL: 'Alabama',       AK: 'Alaska',        AZ: 'Arizona',      AR: 'Arkansas',
  CA: 'California',    CO: 'Colorado',      CT: 'Connecticut',  DE: 'Delaware',
  FL: 'Florida',       GA: 'Georgia',       HI: 'Hawaii',       ID: 'Idaho',
  IL: 'Illinois',      IN: 'Indiana',       IA: 'Iowa',         KS: 'Kansas',
  KY: 'Kentucky',      LA: 'Louisiana',     ME: 'Maine',        MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan',      MN: 'Minnesota',    MS: 'Mississippi',
  MO: 'Missouri',      MT: 'Montana',       NE: 'Nebraska',     NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey',    NM: 'New Mexico',   NY: 'New York',
  NC: 'North Carolina',ND: 'North Dakota',  OH: 'Ohio',         OK: 'Oklahoma',
  OR: 'Oregon',        PA: 'Pennsylvania',  RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota',  TN: 'Tennessee',     TX: 'Texas',        UT: 'Utah',
  VT: 'Vermont',       VA: 'Virginia',      WA: 'Washington',   WV: 'West Virginia',
  WI: 'Wisconsin',     WY: 'Wyoming',
};

// All 50 state abbreviations, alphabetical
export const ALL_STATES = Object.keys(STATE_NAMES).sort();

// 2026 session data per state
const SESSION_2026 = {
  AL: { convene: '2026-02-03', adjourn: '2026-06-01', approx: true },
  AK: { convene: '2026-01-20', adjourn: '2026-05-20', approx: true },
  AZ: { convene: '2026-01-12', adjourn: '2026-06-30', approx: true },
  AR: { convene: '2026-01-12', adjourn: '2026-04-10', approx: true },
  CA: { convene: '2026-01-05', adjourn: '2026-09-11' },
  CO: { convene: '2026-01-14', adjourn: '2026-05-06', approx: true },
  CT: { convene: '2026-02-04', adjourn: '2026-05-06' },
  DE: { convene: '2026-01-13', adjourn: '2026-06-30', approx: true },
  FL: { convene: '2026-03-03', adjourn: '2026-05-01' },
  GA: { convene: '2026-01-12', adjourn: '2026-04-02', approx: true },
  HI: { convene: '2026-01-21', adjourn: '2026-05-01', approx: true },
  ID: { convene: '2026-01-12', adjourn: '2026-04-15', approx: true },
  IL: { convene: '2026-01-14', adjourn: '2026-05-31' },
  IN: { convene: '2026-01-06', adjourn: '2026-03-14' },
  IA: { convene: '2026-01-12', adjourn: '2026-05-30', approx: true },
  KS: { convene: '2026-01-12', adjourn: '2026-05-30', approx: true },
  KY: { convene: '2026-01-06', adjourn: '2026-04-15', approx: true },
  LA: { convene: '2026-04-13', adjourn: '2026-06-11' },
  ME: { convene: '2026-01-07', adjourn: '2026-04-15', approx: true },
  MD: { convene: '2026-01-14', adjourn: '2026-04-13' },
  MA: { convene: '2026-01-07', adjourn: '2026-11-18', approx: true },
  MI: { convene: '2026-01-14', adjourn: '2026-12-17', approx: true },
  MN: { convene: '2026-02-17', adjourn: '2026-05-18', approx: true },
  MS: { convene: '2026-01-06', adjourn: '2026-04-05', approx: true },
  MO: { convene: '2026-01-07', adjourn: '2026-05-15' },
  MT: { oddYearOnly: true },
  NE: { convene: '2026-01-07', adjourn: '2026-06-05', approx: true },
  NV: { oddYearOnly: true },
  NH: { convene: '2026-01-07', adjourn: '2026-06-30', approx: true },
  NJ: { convene: '2026-01-13', adjourn: '2027-01-12', approx: true },
  NM: { convene: '2026-01-20', adjourn: '2026-02-19' },
  NY: { convene: '2026-01-07', adjourn: '2026-06-10', approx: true },
  NC: { convene: '2026-01-14', adjourn: '2026-07-31', approx: true },
  ND: { oddYearOnly: true },
  OH: { convene: '2026-01-07', adjourn: '2026-12-31', approx: true },
  OK: { convene: '2026-02-02', adjourn: '2026-05-29' },
  OR: { convene: '2026-02-02', adjourn: '2026-03-08' },
  PA: { convene: '2026-01-06', adjourn: '2026-11-30', approx: true },
  RI: { convene: '2026-01-06', adjourn: '2026-06-30', approx: true },
  SC: { convene: '2026-01-13', adjourn: '2026-06-04', approx: true },
  SD: { convene: '2026-01-13', adjourn: '2026-03-12', approx: true },
  TN: { convene: '2026-01-13', adjourn: '2026-05-30', approx: true },
  TX: { oddYearOnly: true },
  UT: { convene: '2026-01-19', adjourn: '2026-03-04' },
  VT: { convene: '2026-01-06', adjourn: '2026-05-08', approx: true },
  VA: { convene: '2026-01-14', adjourn: '2026-03-14' },
  WA: { convene: '2026-01-12', adjourn: '2026-03-12' },
  WV: { convene: '2026-02-11', adjourn: '2026-04-11' },
  WI: { convene: '2026-01-13', adjourn: '2026-12-31', approx: true },
  WY: { convene: '2026-02-09', adjourn: '2026-02-28' },
};

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

/**
 * Returns true if today falls within the state's 2026 session window.
 * Biennial states (oddYearOnly) always return false.
 */
export function isInSession(abbr) {
  const s = SESSION_2026[abbr];
  if (!s || s.oddYearOnly) return false;
  const today     = new Date();
  const convene   = new Date(s.convene + 'T12:00:00Z');
  const adjourn   = new Date(s.adjourn + 'T12:00:00Z');
  return today >= convene && today <= adjourn;
}

/**
 * Returns a human-readable session status string for the given state abbreviation.
 * Computes relative to today's date so "currently in session" stays accurate.
 */
export function getSessionStatus(abbr) {
  const s = SESSION_2026[abbr];
  const name = STATE_NAMES[abbr] || abbr;
  if (!s) return null;

  if (s.oddYearOnly) {
    return `The ${name} legislature meets in odd-numbered years only. Next regular session: January 2027.`;
  }

  const today = new Date();
  // Compare date-only (ignore time zone shifts by using noon UTC)
  const conveneDate = new Date(s.convene + 'T12:00:00Z');
  const adjournDate = new Date(s.adjourn + 'T12:00:00Z');
  const conveneStr  = fmtDate(s.convene);
  const adjournStr  = (s.approx ? '~' : '') + fmtDate(s.adjourn);

  if (today < conveneDate) {
    return `The ${name} legislature convenes ${conveneStr}.`;
  }
  if (today <= adjournDate) {
    return `The ${name} legislature is in session (${conveneStr} – ${adjournStr}).`;
  }
  return `The ${name} legislature adjourned for 2026. Next regular session: January 2027.`;
}
