/**
 * One-time cleanup: check all active bills against LegiScan and deactivate
 * any whose status is no longer actionable (Passed, Signed, Failed, Vetoed, etc.)
 *
 * Run: node scripts/deactivate-closed-bills.mjs
 */

import { readFileSync } from 'fs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

const envFile = readFileSync('/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const SUPABASE_URL     = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY     = env['VITE_SUPABASE_ANON_KEY'];
const LEGISCAN_API_KEY = env['VITE_LEGISCAN_API_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Status IDs from LegiScan where no legislative action is possible
const NON_ACTIONABLE = new Set([3, 4, 5, 6, 8, 11]);
const STATUS_LABELS = {
  1: 'Introduced', 2: 'Engrossed', 3: 'Enrolled', 4: 'Passed',
  5: 'Vetoed', 6: 'Failed/Dead', 7: 'Override', 8: 'Chaptered',
  9: 'Refer', 10: 'Report Pass', 11: 'Report DNP', 12: 'Draft',
};

async function fetchLegiScan(billId) {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_API_KEY}&op=getBill&id=${billId}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json.status === 'OK' ? json.bill : null;
  } catch {
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const { data: bills, error } = await supabase
    .from('featured_bills')
    .select('id, legiscan_bill_id, custom_title, state, active')
    .eq('active', true);

  if (error) { console.error('Failed to fetch bills:', error); process.exit(1); }
  console.log(`Checking ${bills.length} active bills against LegiScan...\n`);

  let deactivated = 0;
  let kept = 0;
  let skipped = 0;

  for (const bill of bills) {
    const data = await fetchLegiScan(bill.legiscan_bill_id);

    if (!data) {
      console.log(`  [SKIP] ${bill.custom_title || bill.legiscan_bill_id} — LegiScan returned nothing`);
      skipped++;
      await sleep(1000);
      continue;
    }

    const statusLabel = STATUS_LABELS[data.status] || `unknown (${data.status})`;

    // Also update the cache with fresh data
    await supabase.from('legiscan_cache').upsert({
      bill_id: bill.legiscan_bill_id,
      data,
      cached_at: new Date().toISOString(),
    });

    if (NON_ACTIONABLE.has(data.status)) {
      await supabase.from('featured_bills').update({ active: false }).eq('id', bill.id);
      console.log(`  [DEACTIVATED] ${bill.custom_title || bill.legiscan_bill_id} — ${statusLabel}`);
      deactivated++;
    } else {
      console.log(`  [OK] ${bill.custom_title || bill.legiscan_bill_id} — ${statusLabel}`);
      kept++;
    }

    // Stay under LegiScan rate limits (30 req/min)
    await sleep(2000);
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Deactivated : ${deactivated}`);
  console.log(`Still active: ${kept}`);
  console.log(`Skipped     : ${skipped}`);
  console.log(`─────────────────────────────────`);
}

run();
