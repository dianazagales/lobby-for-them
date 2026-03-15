// DATA SOURCE: US Census Bureau CD-to-ZCTA relationship file
// Current data: 118th Congress (2023-2025)
// To update after redistricting: download the new file from:
// https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/
// Find the latest cd*_zcta*_natl.txt file, replace the URL below, and re-run.
// Redistricting happens after each decennial census (next: ~2031)

import { readFileSync } from 'fs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

// ── Env ───────────────────────────────────────────────────────────────────────

const envFile = readFileSync('/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── FIPS → state abbreviation ─────────────────────────────────────────────────

const FIPS_TO_STATE = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY','72':'PR',
};

// ── Download + parse ──────────────────────────────────────────────────────────

const URL = 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_cd11820_zcta520_natl.txt';

console.log('Downloading Census CD-to-ZCTA crosswalk...');
const res = await fetch(URL);
if (!res.ok) { console.error(`Download failed: HTTP ${res.status}`); process.exit(1); }
const raw = await res.text();
const lines = raw.trim().split('\n');
console.log(`Downloaded ${lines.length} lines`);

// Columns (pipe-delimited):
// 0  OID_CD118_20
// 1  GEOID_CD118_20   — e.g. "4401" = RI district 1
// 2  NAMELSAD_CD118_20
// ...
// 8  GEOID_ZCTA5_20   — 5-digit zip
// ...
// 15 AREALAND_PART    — land area of the zip within this district (sq meters)

// For zips that span multiple districts, keep the district with the largest overlap.
const zipBest = new Map(); // zip → { state, district, area }

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('|');
  const cdGeoid = cols[1]?.trim();   // e.g. "4401"
  const zip     = cols[8]?.trim();   // e.g. "02864"
  const area    = parseInt(cols[15]?.trim(), 10);

  if (!cdGeoid || !zip || zip.length !== 5 || isNaN(area)) continue;

  const fips     = cdGeoid.slice(0, 2);
  const distNum  = parseInt(cdGeoid.slice(2), 10);
  const state    = FIPS_TO_STATE[fips];

  if (!state || isNaN(distNum)) continue;

  const existing = zipBest.get(zip);
  if (!existing || area > existing.area) {
    zipBest.set(zip, { zip, state, district: distNum, area });
  }
}

const records = [...zipBest.values()].map(({ zip, state, district }) => ({ zip, state, district }));
console.log(`Parsed ${records.length} unique zip-to-district records`);

// ── Upsert in batches ─────────────────────────────────────────────────────────

const BATCH_SIZE = 500;
let inserted = 0;

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  const { error } = await supabase
    .from('zip_districts')
    .upsert(batch, { onConflict: 'zip' });

  if (error) {
    console.error(`Batch ${i}–${i + batch.length} failed:`, error.message);
    process.exit(1);
  }

  inserted += batch.length;
  process.stdout.write(`\rUpserted ${inserted} / ${records.length} records...`);
}

console.log(`\nDone. ${inserted} zip-to-district records loaded into Supabase.`);
