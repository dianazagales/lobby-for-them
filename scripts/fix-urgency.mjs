import { readFileSync } from 'fs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

const envFile = readFileSync('/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

// Status IDs where action is no longer possible
const TERMINAL_STATUSES = new Set([2, 3, 4, 8]); // Engrossed, Enrolled, Passed, Chaptered

async function run() {
  // Fetch all high-urgency bills
  const { data: bills, error } = await supabase
    .from('featured_bills')
    .select('id, legiscan_bill_id, custom_title, urgency')
    .eq('urgency', 'high');

  if (error) { console.error('Failed to fetch bills:', error); process.exit(1); }
  console.log(`Found ${bills.length} high-urgency bills to check.`);

  const toDowngrade = [];

  for (const bill of bills) {
    const { data: cache } = await supabase
      .from('legiscan_cache')
      .select('data')
      .eq('bill_id', bill.legiscan_bill_id)
      .single();

    if (!cache?.data) {
      console.log(`  [SKIP] ${bill.custom_title || bill.legiscan_bill_id} — no cache`);
      continue;
    }

    const statusId = cache.data.status;
    if (TERMINAL_STATUSES.has(statusId)) {
      console.log(`  [DOWNGRADE] ${bill.custom_title || bill.legiscan_bill_id} (status ${statusId})`);
      toDowngrade.push(bill.id);
    } else {
      console.log(`  [OK] ${bill.custom_title || bill.legiscan_bill_id} (status ${statusId})`);
    }
  }

  if (toDowngrade.length === 0) {
    console.log('\nNo bills needed updating.');
    return;
  }

  const { error: updateError } = await supabase
    .from('featured_bills')
    .update({ urgency: 'medium' })
    .in('id', toDowngrade);

  if (updateError) {
    console.error('Update failed:', updateError);
    process.exit(1);
  }

  console.log(`\nDone — set ${toDowngrade.length} bill(s) from high → medium urgency.`);
}

run();
