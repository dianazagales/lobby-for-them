import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '../.env'), 'utf8');
const get = key => { const m = env.match(new RegExp(`^${key}=(.+)$`, 'm')); return m ? m[1].trim() : ''; };

const supabase = createClient(get('VITE_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

const targets = [
  // Budget / Appropriations
  { state: 'NC', bill: 'S257' },
  { state: 'PA', bill: 'HB1331' },
  { state: 'UT', bill: 'HB0002' },
  { state: 'UT', bill: 'HB0008' },
  { state: 'UT', bill: 'SB0003' },
  { state: 'VA', bill: 'SB30' },
  { state: 'VA', bill: 'HB30' },
  { state: 'WI', bill: 'AB50' },
  // Vehicle / Transportation
  { state: 'UT', bill: 'HB0057' },
  { state: 'UT', bill: 'HB0228' },
  { state: 'UT', bill: 'SB0197' },
  { state: 'VA', bill: 'HB646' },
  { state: 'VA', bill: 'SB437' },
  { state: 'TX', bill: 'HB3883' },
  // Non-animal / Too indirect
  { state: 'ID', bill: 'SJM110' },
  { state: 'IL', bill: 'SB3731' },
  { state: 'MD', bill: 'HB1395' },
  { state: 'ME', bill: 'LD2237' },
  { state: 'MN', bill: 'HF1955' },
  { state: 'MN', bill: 'SF487' },
  { state: 'MO', bill: 'HB1707' },
  { state: 'MO', bill: 'HB2206' },
  { state: 'MO', bill: 'HB2099' },
  { state: 'NE', bill: 'LB957' },
  { state: 'NE', bill: 'LB37' },
  { state: 'NE', bill: 'LB759' },
  { state: 'ND', bill: 'HB1538' },
  { state: 'NY', bill: 'A09095' },
  { state: 'NY', bill: 'A03623' },
  { state: 'OH', bill: 'HB199' },
  { state: 'OK', bill: 'HB4266' },
  { state: 'OK', bill: 'HB3920' },
  { state: 'AL', bill: 'SB346' },
  { state: 'TN', bill: 'SB0698' },
  { state: 'UT', bill: 'HB0179' },
  { state: 'UT', bill: 'SB0008' },
  { state: 'VT', bill: 'S0153' },
  { state: 'VT', bill: 'S0118' },
  { state: 'WA', bill: 'HB2031' },
  { state: 'GA', bill: 'SB33' },
  { state: 'GA', bill: 'HB265' },
];

console.log(`Deactivating ${targets.length} bills...\n`);
let deactivated = 0;
let notFound = [];

for (const { state, bill } of targets) {
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
    notFound.push(`${state} ${bill}`);
  } else {
    console.log(`  ✓ ${state} ${bill}`);
    deactivated++;
  }
}

console.log('\n══════════════════════════════════════');
console.log(`✓ Deactivated: ${deactivated}/${targets.length}`);
console.log(`✗ Not found:   ${notFound.length}`);
if (notFound.length) console.log(`  Not found: ${notFound.join(', ')}`);
