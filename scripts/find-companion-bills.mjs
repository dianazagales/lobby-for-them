/**
 * find-companion-bills.mjs
 * Scans the featured_bills table for companion bill pairs
 * (same legislation introduced in both House and Senate chambers).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

function loadEnv(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    env[key] = val;
  }
  return env;
}

const env = loadEnv(envPath);
const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_ANON_KEY = env['VITE_SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// Bill number parsing
// ---------------------------------------------------------------------------

// Regex to extract the bill token from the end of custom_title, e.g. "(NJ A2317)"
const TITLE_SUFFIX_RE = /\(([^)]+)\)$/;

// Chamber classification
// House prefixes: H, A, HB, AB, HF, HJR, AJR, ACR, HCR, HR, AR
// Senate prefixes: S, SF, SB, SJR, SCR, SR
const HOUSE_RE = /^(HB|AB|HF|HJR|AJR|HCR|ACR|HR|AR|H|A)\d/i;
const SENATE_RE = /^(SB|SF|SJR|SCR|SR|S)\d/i;

function parseBillNumber(custom_title) {
  const match = custom_title && custom_title.match(TITLE_SUFFIX_RE);
  if (!match) return null;
  // The capture group is like "NJ A2317" — we want just the bill number part
  const parts = match[1].trim().split(/\s+/);
  // Last token is the bill number
  return parts[parts.length - 1];
}

function getBaseTitle(custom_title) {
  // Strip the trailing (STATE BILLNUM) suffix
  return custom_title ? custom_title.replace(TITLE_SUFFIX_RE, '').trim() : '';
}

function chamberOf(billNum) {
  if (!billNum) return null;
  if (HOUSE_RE.test(billNum)) return 'house';
  if (SENATE_RE.test(billNum)) return 'senate';
  return null;
}

// ---------------------------------------------------------------------------
// Similarity helpers
// ---------------------------------------------------------------------------

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\b(the|a|an|and|or|to|of|for|in|on|at|by|with|from|as|be|it|its|is|are|that|which|this|an)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesAreSimilar(titleA, titleB) {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);

  // Exact match after normalization
  if (normA === normB) return true;

  // One contains the other (handles minor preamble differences)
  if (normA.length > 20 && normB.length > 20) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }

  return false;
}

function whyItMattersSimilar(a, b) {
  if (!a || !b) return false;
  // Compare first 100 chars (normalized)
  const snipA = normalizeTitle(a.slice(0, 100));
  const snipB = normalizeTitle(b.slice(0, 100));
  return snipA === snipB;
}

// ---------------------------------------------------------------------------
// Urgency ranking (higher = better / more advanced)
// ---------------------------------------------------------------------------
const URGENCY_RANK = { high: 3, medium: 2, low: 1 };

function preferredBill(a, b) {
  // a and b are bill objects with billNum, urgency, created_at, chamber
  const rankA = URGENCY_RANK[a.urgency] ?? 0;
  const rankB = URGENCY_RANK[b.urgency] ?? 0;
  if (rankA !== rankB) return rankA > rankB ? a : b;

  // Same urgency — prefer more recently created
  const dateA = new Date(a.created_at).getTime();
  const dateB = new Date(b.created_at).getTime();
  if (dateA !== dateB) return dateA > dateB ? a : b;

  // Still tied — prefer House bill
  if (a.chamber === 'house' && b.chamber !== 'house') return a;
  if (b.chamber === 'house' && a.chamber !== 'house') return b;

  return a; // arbitrary tiebreak
}

// ---------------------------------------------------------------------------
// Fetch all active bills (paginated)
// ---------------------------------------------------------------------------

async function fetchAllActiveBills() {
  const PAGE_SIZE = 1000;
  let allBills = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('featured_bills')
      .select('id, legiscan_bill_id, state, custom_title, why_it_matters, urgency, active, created_at')
      .eq('active', true)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Supabase error:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allBills = allBills.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allBills;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching all active bills from Supabase...\n');
  const rawBills = await fetchAllActiveBills();
  console.log(`Total active bills fetched: ${rawBills.length}\n`);

  // Enrich each bill with parsed fields
  const bills = rawBills.map(bill => {
    const billNum = parseBillNumber(bill.custom_title);
    const baseTitle = getBaseTitle(bill.custom_title);
    const chamber = chamberOf(billNum);
    return { ...bill, billNum, baseTitle, chamber };
  });

  // Group by state
  const byState = {};
  for (const bill of bills) {
    const st = bill.state || 'UNKNOWN';
    if (!byState[st]) byState[st] = [];
    byState[st].push(bill);
  }

  const pairs = [];
  const sortedStates = Object.keys(byState).sort();

  for (const state of sortedStates) {
    const stateBills = byState[state];
    if (stateBills.length < 2) continue;

    // Compare every pair within this state
    for (let i = 0; i < stateBills.length; i++) {
      for (let j = i + 1; j < stateBills.length; j++) {
        const a = stateBills[i];
        const b = stateBills[j];

        // Skip if either bill number couldn't be parsed
        if (!a.billNum || !b.billNum) continue;

        // Must be different chambers
        if (!a.chamber || !b.chamber) continue;
        if (a.chamber === b.chamber) continue;

        // Check title similarity OR why_it_matters similarity
        const titleMatch = titlesAreSimilar(a.baseTitle, b.baseTitle);
        const whyMatch = whyItMattersSimilar(a.why_it_matters, b.why_it_matters);

        if (!titleMatch && !whyMatch) continue;

        // Additional guard: base titles should not be trivially short / generic
        const shortA = normalizeTitle(a.baseTitle).length < 15;
        const shortB = normalizeTitle(b.baseTitle).length < 15;
        if (shortA || shortB) continue;

        // We have a companion pair
        const keep = preferredBill(
          { ...a, chamber: a.chamber },
          { ...b, chamber: b.chamber }
        );
        const deactivate = keep.id === a.id ? b : a;

        pairs.push({ state, a, b, keep, deactivate, titleMatch, whyMatch });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------

  if (pairs.length === 0) {
    console.log('No companion bill pairs found.');
    return;
  }

  // Group output by state
  const pairsByState = {};
  for (const pair of pairs) {
    if (!pairsByState[pair.state]) pairsByState[pair.state] = [];
    pairsByState[pair.state].push(pair);
  }

  for (const state of Object.keys(pairsByState).sort()) {
    console.log(`State: ${state}`);
    console.log('─'.repeat(70));

    for (const pair of pairsByState[state]) {
      const { a, b, keep, deactivate, titleMatch, whyMatch } = pair;
      const matchReason = titleMatch && whyMatch
        ? 'title + why_it_matters match'
        : titleMatch
          ? 'title match'
          : 'why_it_matters match';

      console.log(`Match type: ${matchReason}`);
      console.log(
        `Bill A: ${a.billNum} — ${a.baseTitle} — Last action date: N/A — Status: ${a.urgency}`
      );
      console.log(
        `Bill B: ${b.billNum} — ${b.baseTitle} — Last action date: N/A — Status: ${b.urgency}`
      );
      console.log(`Recommended to keep:       ${keep.billNum}`);
      console.log(`Recommended to deactivate: ${deactivate.billNum}`);
      console.log();
    }
  }

  console.log('='.repeat(70));
  console.log(`Total companion pairs found: ${pairs.length}`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
