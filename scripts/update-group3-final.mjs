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
  { state: 'FL', bill: 'H0559' },
  { state: 'CA', bill: 'AB2344' },
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
  { state: 'MA', bill: 'H3719' },
  { state: 'WA', bill: 'HB2668' },
  { state: 'CO', bill: 'SJM001' },
  { state: 'MO', bill: 'HB3189' },
  { state: 'MO', bill: 'HB1814' },
  { state: 'MN', bill: 'SF2082' },
  { state: 'MN', bill: 'SF626' },
  { state: 'MN', bill: 'SF2443' },
  { state: 'MN', bill: 'SF3054' },
  { state: 'WA', bill: 'SB5566' },
  { state: 'CA', bill: 'AB2442' },
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
