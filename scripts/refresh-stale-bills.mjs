/**
 * Finds bills with stale/bad LegiScan data and refreshes them.
 * "Stale" = last action date before 2020 OR older than 1 year from today.
 *
 * Run: node scripts/refresh-stale-bills.mjs
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

const NON_ACTIONABLE = new Set([3, 4, 5, 6, 8, 11]);
const STATUS_LABELS = {
  0: 'N/A', 1: 'Introduced', 2: 'Engrossed', 3: 'Enrolled', 4: 'Passed',
  5: 'Vetoed', 6: 'Failed/Dead', 7: 'Override', 8: 'Chaptered',
  9: 'Refer', 10: 'Report Pass', 11: 'Report DNP', 12: 'Draft',
};

const ONE_YEAR_AGO = new Date();
ONE_YEAR_AGO.setFullYear(ONE_YEAR_AGO.getFullYear() - 1);
const ONE_YEAR_AGO_STR = ONE_YEAR_AGO.toISOString().slice(0, 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getLastActionDate(legiData) {
  const history = legiData?.history || [];
  if (history.length > 0) return history[history.length - 1].date;
  if (legiData?.last_action_date && legiData.last_action_date !== '0000-00-00') {
    return legiData.last_action_date;
  }
  return null;
}

function isStale(dateStr) {
  if (!dateStr) return true;
  return dateStr < '2020-01-01' || dateStr < ONE_YEAR_AGO_STR;
}

async function fetchFromLegiScan(billId) {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_API_KEY}&op=getBill&id=${billId}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json.status === 'OK' ? json.bill : null;
  } catch { return null; }
}

async function searchLegiScan(query, state) {
  const stateParam = state && state !== 'US' ? `&state=${state}` : '&state=ALL';
  const url = `https://api.legiscan.com/?key=${LEGISCAN_API_KEY}&op=getSearch&query=${encodeURIComponent(query)}${stateParam}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === 'OK' && json.searchresult) {
      return Object.values(json.searchresult).filter(r => r.bill_id);
    }
  } catch {}
  return [];
}

async function run() {
  // ── 1. Load all active bills ──────────────────────────────────────────────
  const { data: bills, error } = await supabase
    .from('featured_bills')
    .select('id, legiscan_bill_id, custom_title, state, urgency');

  if (error) { console.error('Fetch error:', error); process.exit(1); }

  // ── 2. Load their cached LegiScan data and find stale ones ────────────────
  const stale = [];

  for (const bill of bills) {
    const { data: cache } = await supabase
      .from('legiscan_cache')
      .select('data')
      .eq('bill_id', bill.legiscan_bill_id)
      .single();

    const lastActionDate = cache?.data ? getLastActionDate(cache.data) : null;

    if (isStale(lastActionDate)) {
      stale.push({ bill, currentDate: lastActionDate, cacheData: cache?.data });
    }
  }

  // ── 3. Print affected bills ───────────────────────────────────────────────
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`STALE BILLS (last action before ${ONE_YEAR_AGO_STR} or before 2020)`);
  console.log(`${'─'.repeat(70)}`);

  if (stale.length === 0) {
    console.log('No stale bills found.');
    return;
  }

  for (const { bill, currentDate } of stale) {
    const label = currentDate || 'NO DATE';
    console.log(`  [${bill.state}] ${bill.custom_title || `Bill #${bill.legiscan_bill_id}`}`);
    console.log(`         LegiScan ID: ${bill.legiscan_bill_id}  |  Current date in DB: ${label}`);
  }
  console.log(`\nTotal: ${stale.length} bills need refresh\n`);

  // ── 4. Refresh each stale bill from LegiScan ──────────────────────────────
  console.log(`${'─'.repeat(70)}`);
  console.log('REFRESHING FROM LEGISCAN');
  console.log(`${'─'.repeat(70)}\n`);

  const results = { updated: [], deactivated: [], notFound: [] };

  // Special case: Goldie's Act — search for the newest version by name
  const goldiesAct = stale.find(({ bill }) =>
    bill.legiscan_bill_id === 349 ||
    (bill.custom_title || '').toLowerCase().includes("goldie")
  );

  for (const { bill } of stale) {
    const isGoldies = bill === goldiesAct?.bill;
    let freshData = null;

    if (isGoldies) {
      console.log(`  [SPECIAL] Searching for latest Goldie's Act...`);
      const searchResults = await searchLegiScan("Goldie's Act", 'US');
      await sleep(1500);

      if (searchResults.length > 0) {
        // Pick the most recent result (highest bill_id = most recently introduced)
        searchResults.sort((a, b) => b.bill_id - a.bill_id);
        const best = searchResults[0];
        console.log(`    Found: ${best.bill_number} (ID ${best.bill_id}, ${best.session?.session_name || ''})`);
        freshData = await fetchFromLegiScan(best.bill_id);

        // If it's a new bill ID, update the Supabase record's legiscan_bill_id
        if (freshData && best.bill_id !== bill.legiscan_bill_id) {
          await supabase.from('featured_bills')
            .update({ legiscan_bill_id: best.bill_id })
            .eq('id', bill.id);
          console.log(`    Updated legiscan_bill_id: ${bill.legiscan_bill_id} → ${best.bill_id}`);
          // Cache under new ID
          await supabase.from('legiscan_cache').upsert({
            bill_id: best.bill_id,
            data: freshData,
            cached_at: new Date().toISOString(),
          });
        }
      }
    } else {
      freshData = await fetchFromLegiScan(bill.legiscan_bill_id);
    }

    await sleep(2000);

    if (!freshData) {
      console.log(`  [NOT FOUND] ${bill.custom_title || `Bill #${bill.legiscan_bill_id}`} (${bill.state})`);
      results.notFound.push(bill);
      continue;
    }

    // Update cache
    await supabase.from('legiscan_cache').upsert({
      bill_id: bill.legiscan_bill_id,
      data: freshData,
      cached_at: new Date().toISOString(),
    });

    const newDate = getLastActionDate(freshData);
    const newStatus = STATUS_LABELS[freshData.status] || `unknown (${freshData.status})`;
    const isActionable = !NON_ACTIONABLE.has(freshData.status);

    if (!isActionable) {
      await supabase.from('featured_bills').update({ active: false }).eq('id', bill.id);
      console.log(`  [DEACTIVATED] ${bill.custom_title || `Bill #${bill.legiscan_bill_id}`}`);
      console.log(`               Status: ${newStatus}  |  Last action: ${newDate}`);
      results.deactivated.push(bill);
    } else {
      console.log(`  [UPDATED] ${bill.custom_title || `Bill #${bill.legiscan_bill_id}`}`);
      console.log(`            Status: ${newStatus}  |  Last action: ${newDate}`);
      results.updated.push(bill);
    }
  }

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(70)}`);
  console.log('SUMMARY');
  console.log(`${'─'.repeat(70)}`);
  console.log(`  Updated (still active) : ${results.updated.length}`);
  console.log(`  Deactivated            : ${results.deactivated.length}`);
  console.log(`  Not found on LegiScan  : ${results.notFound.length}`);
  if (results.notFound.length > 0) {
    for (const b of results.notFound) {
      console.log(`    - [${b.state}] ${b.custom_title || `Bill #${b.legiscan_bill_id}`}`);
    }
  }
  console.log(`${'─'.repeat(70)}\n`);
}

run();
