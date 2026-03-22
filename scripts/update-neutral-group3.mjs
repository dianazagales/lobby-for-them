import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '../.env'), 'utf8');
const get = key => { const m = env.match(new RegExp(`^${key}=(.+)$`, 'm')); return m ? m[1].trim() : ''; };

const supabase = createClient(get('VITE_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

// ─── STEP 1: Set stance = 'support' ──────────────────────────────────────────
const supportTargets = [
  { state: 'KY', bill: 'SB300' },
  { state: 'KY', bill: 'HB637' },
  { state: 'NM', bill: 'HB315' },
  { state: 'MN', bill: 'HF1704' },
];

console.log('STEP 1 — Setting stance = support...\n');
let supportSuccess = 0;
let supportNotFound = [];

for (const { state, bill } of supportTargets) {
  const { data, error } = await supabase
    .from('featured_bills')
    .update({ stance: 'support' })
    .eq('state', state)
    .ilike('custom_title', `%(${bill})`)
    .select('id, custom_title');

  if (error) {
    console.error(`  ERROR ${state} ${bill}: ${error.message}`);
  } else if (!data || data.length === 0) {
    console.log(`  NOT FOUND: ${state} ${bill}`);
    supportNotFound.push(`${state} ${bill}`);
  } else {
    console.log(`  ✓ stance=support: ${state} ${bill} → ${data[0].custom_title.substring(0, 70)}`);
    supportSuccess++;
  }
}

// ─── STEP 2: Deactivate ───────────────────────────────────────────────────────
const deactivateTargets = [
  { state: 'KY', bill: 'HB506' },
  { state: 'MO', bill: 'HB1929' },
  { state: 'TN', bill: 'HB1902' },
  { state: 'TX', bill: 'SB2844' },
  { state: 'UT', bill: 'HB0331' },
  { state: 'MO', bill: 'HB2206' },
  { state: 'OK', bill: 'SB2117' },
  { state: 'MA', bill: 'S634' },
  { state: 'MN', bill: 'SF2458' },
  { state: 'MN', bill: 'SF553' },
  { state: 'NC', bill: 'S401' },
  { state: 'NC', bill: 'S639' },
  { state: 'OR', bill: 'HB4130' },
  { state: 'VT', bill: 'H0632' },
  { state: 'WV', bill: 'HB4925' },
  { state: 'UT', bill: 'HB0369' },
  { state: 'TN', bill: 'SB1860' },
  { state: 'ID', bill: 'H0653' },
  { state: 'OK', bill: 'HB3239' },
];

console.log(`\nSTEP 2 — Deactivating ${deactivateTargets.length} bills...\n`);
let deactivated = 0;
let deactivateNotFound = [];

for (const { state, bill } of deactivateTargets) {
  const { data, error } = await supabase
    .from('featured_bills')
    .update({ active: false })
    .eq('state', state)
    .ilike('custom_title', `%(${bill})`)
    .select('id, custom_title');

  if (error) {
    console.error(`  ERROR ${state} ${bill}: ${error.message}`);
  } else if (!data || data.length === 0) {
    console.log(`  NOT FOUND: ${state} ${bill}`);
    deactivateNotFound.push(`${state} ${bill}`);
  } else {
    console.log(`  ✓ ${state} ${bill}`);
    deactivated++;
  }
}

console.log('\n══════════════════════════════════════');
console.log('STEP 1 — stance=support:');
console.log(`  ✓ Updated: ${supportSuccess}/${supportTargets.length}`);
if (supportNotFound.length) console.log(`  ✗ Not found: ${supportNotFound.join(', ')}`);

console.log('\nSTEP 2 — Deactivated:');
console.log(`  ✓ Deactivated: ${deactivated}/${deactivateTargets.length}`);
if (deactivateNotFound.length) console.log(`  ✗ Not found: ${deactivateNotFound.join(', ')}`);
