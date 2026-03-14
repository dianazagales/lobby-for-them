import { readFileSync } from 'fs';
import Anthropic from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@anthropic-ai/sdk/index.mjs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

// Parse .env manually
const envFile = readFileSync('/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    env[key] = value;
  }
}

const LEGISCAN_KEY    = env['VITE_LEGISCAN_API_KEY'];
const SUPABASE_URL    = env['VITE_SUPABASE_URL'];
const SUPABASE_ANON_KEY = env['VITE_SUPABASE_ANON_KEY'];
const ANTHROPIC_KEY   = env['ANTHROPIC_API_KEY'];

console.log('Environment loaded.');
console.log('Supabase URL:', SUPABASE_URL);
console.log('LegiScan key present:', !!LEGISCAN_KEY);
console.log('Anthropic key present:', !!ANTHROPIC_KEY);

const supabase  = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

// Status codes to SKIP (dead/passed/enacted)
const SKIP_STATUSES = new Set([5, 6, 8, 11]);

// Urgency mapping
function getUrgency(status) {
  if ([2, 3, 4, 7, 10].includes(status)) return 'high';
  if ([1, 9, 12].includes(status)) return 'medium';
  return 'medium'; // default
}

// Truncate title at word boundary
function truncateTitle(title, max = 80) {
  if (title.length <= max) return title;
  const truncated = title.slice(0, max);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

// Generate why_it_matters via Claude (falls back to template if API key missing)
async function generateWhyItMatters(bill) {
  if (!anthropic) return generateWhyItMattersFallback(bill);

  const stateLabel = (bill.state === 'US') ? 'federal' : `${bill.state} state`;
  const prompt = `You are writing content for a civic action website called "Lobby for Them" that helps everyday people contact their representatives about animal welfare legislation.

Write 3-4 sentences explaining why this specific bill matters for animal welfare and why someone should take action. Be emotional but factual. Be specific to this bill — do not use generic language. Focus on the real impact on animals. End with a call to action.

Bill: ${bill.bill_number} (${stateLabel})
Title: ${bill.title}

Write only the 3-4 sentences. No headers, no bullet points, no extra commentary.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-0',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0]?.text?.trim() || generateWhyItMattersFallback(bill);
  } catch (err) {
    console.log(`    Claude error for ${bill.bill_number}: ${err.message} — using fallback`);
    return generateWhyItMattersFallback(bill);
  }
}

// Fallback template (used when no Anthropic key is configured)
function generateWhyItMattersFallback(bill) {
  const title = bill.title || '';
  const state = bill.state || '';
  const billNum = bill.bill_number || '';
  const stateLabel = state === 'US' ? 'federal' : `${state} state`;
  const titleLower = title.toLowerCase();

  if (titleLower.includes('puppy mill') || titleLower.includes('puppy farms')) {
    return `Puppy mills are large-scale commercial breeding operations that prioritize profit over the health and welfare of dogs. ${billNum} (${stateLabel}) targets these facilities by establishing stronger protections and oversight. Without action, thousands of dogs continue to live in cramped, unsanitary conditions with little veterinary care. Your voice can help end this cycle of suffering.`;
  } else if (titleLower.includes('backyard breed') || titleLower.includes('irresponsible breed')) {
    return `Backyard breeders often operate without proper oversight, leading to dogs that suffer from genetic diseases, poor living conditions, and inadequate care. ${billNum} (${stateLabel}) addresses these gaps by introducing standards that protect breeding dogs and their puppies. Holding breeders accountable saves lives and reduces the number of sick animals entering shelters. This bill is a critical step toward humane breeding practices.`;
  } else if (titleLower.includes('commercial breed') || titleLower.includes('dog breed')) {
    return `Commercial dog breeding operations can expose animals to inhumane conditions when there is insufficient regulation and oversight. ${billNum} (${stateLabel}) seeks to establish meaningful standards that protect breeding dogs from neglect and abuse. Stronger laws mean healthier dogs, more informed consumers, and reduced burden on animal shelters. Supporting this bill sends a clear message that animals are not commodities.`;
  } else {
    return `Dogs in commercial breeding operations often lack basic protections, leading to preventable suffering on a massive scale. ${billNum} (${stateLabel}) addresses critical gaps in animal welfare law that allow irresponsible breeders to operate unchecked. Passing this legislation would create real accountability and meaningful protections for breeding dogs and their puppies. Your support could make the difference between suffering and safety for thousands of animals.`;
  }
}

// Generate email subject
function generateEmailSubject(bill) {
  const title = bill.title || '';
  const shortTitle = truncateTitle(title, 50);
  return `Please Support ${bill.bill_number} — ${shortTitle}`;
}

// Generate email body
function generateEmailBody(bill) {
  const state = bill.state || '';
  const stateLabel = state === 'US' ? 'federal' : `${state} state`;
  const billNum = bill.bill_number || '';
  const titleLower = (bill.title || '').toLowerCase();

  let specificAsk = '';
  if (titleLower.includes('puppy mill')) {
    specificAsk = 'Puppy mills cause immeasurable suffering to thousands of dogs, keeping them in overcrowded, unsanitary conditions for their entire lives simply to generate profit.';
  } else if (titleLower.includes('backyard breed')) {
    specificAsk = 'Backyard breeders often operate without oversight, producing dogs with serious health problems and selling them to unsuspecting families while parent dogs suffer in poor conditions.';
  } else if (titleLower.includes('commercial breed') || titleLower.includes('dog breed')) {
    specificAsk = 'Commercial breeding operations without proper regulation expose animals to conditions that no living creature should endure, from overcrowding to lack of medical care.';
  } else {
    specificAsk = 'Dogs in unregulated breeding operations across our state and country suffer needlessly every day due to gaps in our current laws.';
  }

  return `Dear {{rep_name}},

My name is a constituent from zip code {{user_zip}}, and I am writing to urge your support for {{bill_name}}. ${specificAsk}

This ${stateLabel} bill would establish meaningful protections for breeding dogs and hold irresponsible operators accountable — something our current laws fail to do adequately. As someone who cares deeply about the welfare of animals in our community, I believe this legislation is both necessary and long overdue.

I respectfully ask that you co-sponsor and vote in favor of ${billNum}. The dogs who cannot speak for themselves are counting on legislators like you to be their voice. Thank you for your time and your commitment to making our state a more humane place for all living beings.

Sincerely,
A concerned constituent from {{user_zip}}`;
}

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Staleness helpers ──────────────────────────────────────────────────────

const ONE_YEAR_AGO = new Date();
ONE_YEAR_AGO.setFullYear(ONE_YEAR_AGO.getFullYear() - 1);
const ONE_YEAR_AGO_STR = ONE_YEAR_AGO.toISOString().slice(0, 10); // 'YYYY-MM-DD'

function getLastActionDate(bill) {
  const history = bill.history || [];
  if (history.length > 0) return history[history.length - 1].date;
  if (bill.last_action_date && bill.last_action_date !== '0000-00-00') return bill.last_action_date;
  return null;
}

function isStale(bill) {
  const date = getLastActionDate(bill);
  if (!date) return true;
  return date < ONE_YEAR_AGO_STR;
}

// Search LegiScan for a newer version of the same bill (reintroduced in a newer session)
async function findNewerVersion(bill) {
  // Use the first 5 significant words of the title as a search query
  const keywords = (bill.title || '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5)
    .join(' ');

  if (!keywords) return null;

  const state = bill.state && bill.state !== 'US' ? `&state=${bill.state}` : '&state=ALL';
  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=getSearch&query=${encodeURIComponent(keywords)}${state}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== 'OK' || !json.searchresult) return null;

    const candidates = Object.values(json.searchresult)
      .filter(r => r.bill_id && r.bill_id !== bill.bill_id && !SKIP_STATUSES.has(r.status));

    if (candidates.length === 0) return null;

    // Pick the highest bill_id (most recently introduced) among candidates
    candidates.sort((a, b) => b.bill_id - a.bill_id);
    const best = candidates[0];

    // Fetch full details to confirm it has recent activity
    await sleep(1000);
    const detailUrl = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=getBill&id=${best.bill_id}`;
    const detailRes = await fetch(detailUrl);
    const detailJson = await detailRes.json();
    if (detailJson.status !== 'OK' || !detailJson.bill) return null;

    const fresh = detailJson.bill;
    const freshDate = getLastActionDate(fresh);
    if (!freshDate || freshDate < ONE_YEAR_AGO_STR) return null; // still stale

    return fresh;
  } catch {
    return null;
  }
}

// Step 1: Search LegiScan
const SEARCH_TERMS = ['puppy mill', 'backyard breeding', 'commercial breeder', 'dog breeder'];
const allBillIds = new Map(); // bill_id -> basic info

console.log('\n=== STEP 1: Searching LegiScan ===');

for (const term of SEARCH_TERMS) {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=getSearch&query=${encodeURIComponent(term)}&state=ALL`;
  console.log(`\nSearching for: "${term}"...`);

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK') {
      console.log(`  Search failed: ${JSON.stringify(data)}`);
      continue;
    }

    const results = data.searchresult || {};
    let count = 0;

    for (const [key, value] of Object.entries(results)) {
      if (key === 'summary') continue;
      if (typeof value !== 'object' || !value.bill_id) continue;

      if (!allBillIds.has(value.bill_id)) {
        allBillIds.set(value.bill_id, value);
        count++;
      }
    }

    console.log(`  Found ${count} new unique bills (total unique so far: ${allBillIds.size})`);
  } catch (err) {
    console.log(`  Error searching for "${term}": ${err.message}`);
  }

  await sleep(300);
}

console.log(`\nTotal unique bills found across all searches: ${allBillIds.size}`);

// Step 2: Filter to active bills only
console.log('\n=== STEP 2: Filtering to active bills ===');

const activeBillIds = [];
for (const [billId, info] of allBillIds.entries()) {
  const status = info.status;
  if (!SKIP_STATUSES.has(status)) {
    activeBillIds.push(billId);
  }
}

console.log(`Active bills (status not in skip list): ${activeBillIds.length}`);
console.log(`Skipped (dead/enacted): ${allBillIds.size - activeBillIds.length}`);

// Step 3: Fetch full bill details
console.log('\n=== STEP 3: Fetching full bill details ===');

const fullBills = [];

for (let i = 0; i < activeBillIds.length; i++) {
  const billId = activeBillIds[i];
  console.log(`  [${i + 1}/${activeBillIds.length}] Fetching bill ID ${billId}...`);

  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=getBill&id=${billId}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.bill) {
      console.log(`    Failed: ${JSON.stringify(data).slice(0, 100)}`);
      continue;
    }

    let bill = data.bill;
    console.log(`    Got: ${bill.bill_number} (${bill.state}) — status ${bill.status} — ${bill.title?.slice(0, 60)}`);

    // ── Staleness check ────────────────────────────────────────────────────
    if (isStale(bill)) {
      const lastDate = getLastActionDate(bill) || 'no date';
      console.log(`    ⚠ Stale (last action: ${lastDate}) — searching for newer version...`);

      const newer = await findNewerVersion(bill);
      await sleep(500);

      if (newer) {
        console.log(`    ✓ Updated to newer version: ${newer.bill_number} (ID ${newer.bill_id}) — last action: ${getLastActionDate(newer)}`);
        bill = newer;
      } else {
        console.log(`    ✗ No current version found — will be marked inactive (stale - hidden from site)`);
        bill._forceInactive = true;
      }
    } else {
      console.log(`    ✓ Current — no changes needed (last action: ${getLastActionDate(bill)})`);
    }
    // ──────────────────────────────────────────────────────────────────────

    fullBills.push(bill);
  } catch (err) {
    console.log(`    Error: ${err.message}`);
  }

  await sleep(300);
}

console.log(`\nSuccessfully fetched details for ${fullBills.length} active bills`);

// Step 4: Insert into Supabase
console.log('\n=== STEP 4: Inserting into Supabase ===');

// First, get existing legiscan_bill_ids from the DB
const { data: existingRows, error: fetchError } = await supabase
  .from('featured_bills')
  .select('legiscan_bill_id');

if (fetchError) {
  console.log('Error fetching existing bills from Supabase:', fetchError.message);
}

const existingIds = new Set((existingRows || []).map(r => r.legiscan_bill_id));
console.log(`Bills already in DB: ${existingIds.size}`);

let skippedCount = 0;
let insertedCount = 0;
const insertedBills = [];

for (const bill of fullBills) {
  const billId = bill.bill_id;

  if (existingIds.has(billId)) {
    console.log(`  Skipping ${bill.bill_number} (already in DB)`);
    skippedCount++;
    continue;
  }

  // Determine state
  let state = bill.state || 'US';
  if (state === 'US') state = 'US';

  // Build custom title
  const customTitle = `${truncateTitle(bill.title || '', 80)} (${bill.bill_number})`;

  const isActive = !bill._forceInactive && !SKIP_STATUSES.has(bill.status);

  const record = {
    legiscan_bill_id: billId,
    state: state,
    custom_title: customTitle,
    why_it_matters: await generateWhyItMatters(bill),
    email_subject: generateEmailSubject(bill),
    email_body: generateEmailBody(bill),
    urgency: getUrgency(bill.status),
    active: isActive,
  };

  const activeLabel = isActive ? 'active' : 'inactive (stale)';
  console.log(`  Inserting: ${bill.bill_number} (${state}) — urgency: ${record.urgency} — ${activeLabel}`);

  const { error: insertError } = await supabase
    .from('featured_bills')
    .insert(record);

  if (insertError) {
    console.log(`    Insert error: ${insertError.message}`);
  } else {
    insertedCount++;
    insertedBills.push(bill);
    console.log(`    Inserted successfully.`);
  }
}

// Step 5: Summary
console.log('\n=== STEP 5: SUMMARY ===');
console.log(`Total unique bills found across searches: ${allBillIds.size}`);
console.log(`Active bills (not dead/enacted):          ${activeBillIds.length}`);
console.log(`Already in DB (skipped):                  ${skippedCount}`);
console.log(`Newly inserted:                           ${insertedCount}`);

if (insertedBills.length > 0) {
  console.log('\nNewly inserted bills:');
  for (const bill of insertedBills) {
    const urgency = getUrgency(bill.status);
    const statusLabel = {
      1: 'Introduced', 2: 'Engrossed', 3: 'Enrolled', 4: 'Passed',
      7: 'Override', 9: 'Refer', 10: 'Report Pass', 12: 'Draft'
    }[bill.status] || `Status ${bill.status}`;
    console.log(`  - ${bill.bill_number} (${bill.state}) | ${statusLabel} | urgency: ${urgency}`);
    console.log(`    ${bill.title?.slice(0, 80)}`);
  }
} else {
  console.log('\nNo new bills were inserted.');
}

console.log('\nDone!');
