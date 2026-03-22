import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '../.env'), 'utf8');
const get = key => { const m = env.match(new RegExp(`^${key}=(.+)$`, 'm')); return m ? m[1].trim() : ''; };

const supabase = createClient(get('VITE_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

const targets = [
  { state: 'CO', bill_number: 'HB1168' },
  { state: 'FL', bill_number: 'H0881' },
  { state: 'IN', bill_number: 'SB0249' },
  { state: 'KS', bill_number: 'HB2028' },
  { state: 'MO', bill_number: 'SB1476' },
  { state: 'MO', bill_number: 'HB1702' },
  { state: 'MO', bill_number: 'HB2407' },
  { state: 'MO', bill_number: 'HB1883' },
  { state: 'NE', bill_number: 'LB1001' },
  { state: 'NJ', bill_number: 'A2783' },
  { state: 'NY', bill_number: 'S03003' },
  { state: 'NY', bill_number: 'S09003' },
  { state: 'NY', bill_number: 'A10003' },
  { state: 'NY', bill_number: 'A03003' },
  { state: 'OH', bill_number: 'HB96' },
  { state: 'OH', bill_number: 'HB382' },
  { state: 'OH', bill_number: 'HB507' },
  { state: 'OK', bill_number: 'SB1238' },
  { state: 'TX', bill_number: 'SJR16' },
  { state: 'US', bill_number: 'H.R. 79' },
  { state: 'US', bill_number: 'H.R. 121' },
  { state: 'US', bill_number: 'H.R. 172' },
  { state: 'US', bill_number: 'H.R. 54' },
  { state: 'US', bill_number: 'HB2162' },
  { state: 'WV', bill_number: 'SB1060' },
  { state: 'WV', bill_number: 'HB5464' },
];

let deactivated = 0;
let notFound = [];

for (const { state, bill_number } of targets) {
  const { data, error } = await supabase
    .from('featured_bills')
    .update({ active: false })
    .eq('state', state)
    .ilike('custom_title', `%(${bill_number})`)
    .select('id, custom_title, state');

  if (error) {
    console.error(`  ERROR ${state} ${bill_number}: ${error.message}`);
  } else if (!data || data.length === 0) {
    console.log(`  NOT FOUND: ${state} ${bill_number}`);
    notFound.push(`${state} ${bill_number}`);
  } else {
    console.log(`  ✓ Deactivated: ${state} ${bill_number} (id: ${data[0].id})`);
    deactivated++;
  }
}

console.log(`\nDone. ${deactivated}/${targets.length} successfully deactivated.`);
if (notFound.length) console.log(`Not found: ${notFound.join(', ')}`);
