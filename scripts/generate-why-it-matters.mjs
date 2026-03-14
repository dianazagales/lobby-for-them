/**
 * Migration: generate unique why_it_matters for all bills using Claude.
 *
 * For each bill in featured_bills:
 *   1. Fetch bill details + text from LegiScan (falls back to title if unavailable)
 *   2. Call Claude claude-sonnet-4-0 to write a 3-4 sentence animal welfare description
 *   3. Update the why_it_matters column in Supabase
 *
 * Usage: node scripts/generate-why-it-matters.mjs
 *        node scripts/generate-why-it-matters.mjs --dry-run   (preview only, no DB writes)
 */

import { readFileSync } from 'fs';
import Anthropic from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@anthropic-ai/sdk/index.mjs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 600;          // between Claude calls
const LEGISCAN_DELAY_MS = 300; // between LegiScan calls
const MAX_TEXT_CHARS = 4000;   // truncate bill text before sending to Claude

// ── Load env ──────────────────────────────────────────────────────────────────

const envFile = readFileSync('/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
}

const ANTHROPIC_KEY   = env['ANTHROPIC_API_KEY'];
const LEGISCAN_KEY    = env['VITE_LEGISCAN_API_KEY'];
const SUPABASE_URL    = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY    = env['VITE_SUPABASE_ANON_KEY'];

if (!ANTHROPIC_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set in .env');
  process.exit(1);
}
if (!LEGISCAN_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing VITE_LEGISCAN_API_KEY, VITE_SUPABASE_URL, or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep     = (ms) => new Promise(r => setTimeout(r, ms));

// ── LegiScan helpers ──────────────────────────────────────────────────────────

async function getBillDetails(billId) {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=getBill&id=${billId}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    return data.status === 'OK' ? data.bill : null;
  } catch {
    return null;
  }
}

async function getBillText(docId) {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=getBillText&id=${docId}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.text?.doc) return null;
    // Decode base64 content
    const raw = Buffer.from(data.text.doc, 'base64').toString('utf8');
    // Strip HTML tags if it's HTML
    const mime = data.text.mime || '';
    if (mime.includes('html')) {
      return raw
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
    // Plain text or other — return as-is if it looks like readable text
    if (/^[\x20-\x7E\n\r\t]+$/.test(raw.slice(0, 200))) return raw;
    return null; // binary (PDF etc.) — skip
  } catch {
    return null;
  }
}

// ── Claude generation ─────────────────────────────────────────────────────────

// Returns { content: string } on success, or { flagged: true, reason: string } if insufficient.
async function generateWhyItMatters(bill, billText) {
  const stateLabel = bill.state === 'US' ? 'federal' : `${bill.state} state`;
  const context = billText
    ? `Bill text excerpt:\n${billText.slice(0, MAX_TEXT_CHARS)}`
    : `(Full text unavailable — title only)`;

  const prompt = `You are an editor for "Lobby for Them", a civic action site focused on animal welfare legislation.

Your job is to decide whether a bill has enough specific, verifiable animal welfare content to write an honest 3-4 sentence description — and then write it if so.

FIRST, evaluate whether the bill is meaningfully about animal welfare. A bill qualifies if:
- It directly regulates, protects, or affects how animals are treated (breeding, shelter, cruelty, welfare standards, inspection, transport, etc.)
- The animal welfare impact is clear and specific from the title or text, not just incidental

A bill does NOT qualify if:
- It is a broad budget/appropriations bill where animal welfare is one tiny line item
- Animals are mentioned only in passing with no substantive welfare impact
- The connection to animal welfare requires speculation or is unclear

RESPOND with exactly one of these two formats — nothing else:

If the bill qualifies:
WRITE: [your 3-4 sentences here — emotional but factual, specific to this bill, ending with a call to action]

If the bill does not qualify:
SKIP: [one sentence explaining why it lacks sufficient animal welfare content]

Bill: ${bill.bill_number} (${stateLabel})
Title: ${bill.custom_title || bill.title}
${context}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-0',
    max_tokens: 350,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text?.trim() || '';

  if (text.startsWith('SKIP:')) {
    return { flagged: true, reason: text.slice(5).trim() };
  }
  if (text.startsWith('WRITE:')) {
    return { content: text.slice(6).trim() };
  }
  // Fallback: if Claude didn't follow the format, treat as content
  return { content: text };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n=== Generate Why It Matters${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

// 1. Fetch all bills from Supabase
const { data: bills, error: fetchErr } = await supabase
  .from('featured_bills')
  .select('id, legiscan_bill_id, custom_title, state, why_it_matters')
  .order('id', { ascending: true });

if (fetchErr) {
  console.error('Failed to fetch bills:', fetchErr.message);
  process.exit(1);
}

console.log(`Found ${bills.length} bills in Supabase.\n`);

let updated = 0, flagged = 0, failed = 0;
const flaggedBills = []; // track for end-of-run report

for (let i = 0; i < bills.length; i++) {
  const bill = bills[i];
  console.log(`[${i + 1}/${bills.length}] ${bill.custom_title?.slice(0, 60) || bill.legiscan_bill_id}`);

  // 2. Fetch full bill details from LegiScan
  const details = await getBillDetails(bill.legiscan_bill_id);
  await sleep(LEGISCAN_DELAY_MS);

  let billText = null;

  if (details?.texts?.length > 0) {
    // Prefer HTML text (mime_id 2), otherwise take the first available
    const textEntry = details.texts.find(t => t.mime_id === 2) || details.texts[0];
    console.log(`  → Fetching bill text (doc_id ${textEntry.doc_id}, mime: ${textEntry.mime})...`);
    billText = await getBillText(textEntry.doc_id);
    await sleep(LEGISCAN_DELAY_MS);

    if (billText) {
      console.log(`  → Got ${billText.length} chars of text`);
    } else {
      console.log(`  → Text unavailable or binary — falling back to title`);
    }
  } else {
    console.log(`  → No texts in LegiScan — using title only`);
  }

  // Merge LegiScan details with Supabase row for the prompt
  const billForPrompt = {
    ...bill,
    title: details?.title || bill.custom_title,
    bill_number: details?.bill_number || `Bill ${bill.legiscan_bill_id}`,
    state: bill.state,
  };

  // 3. Call Claude
  let result;
  try {
    result = await generateWhyItMatters(billForPrompt, billText);
  } catch (err) {
    console.log(`  ✗ Claude error: ${err.message}`);
    failed++;
    await sleep(DELAY_MS);
    continue;
  }

  // 4a. Bill flagged as insufficient — clear why_it_matters and mark needs_review
  if (result.flagged) {
    console.log(`  ⚑ FLAGGED — insufficient animal welfare content`);
    console.log(`    Reason: ${result.reason}`);
    flaggedBills.push({
      id: bill.id,
      bill_number: billForPrompt.bill_number,
      state: bill.state,
      title: bill.custom_title?.slice(0, 70),
      reason: result.reason,
    });
    flagged++;

    if (!DRY_RUN) {
      // Clear why_it_matters; attempt needs_review flag (column may not exist yet)
      const update = { why_it_matters: null };
      const { error: flagErr } = await supabase
        .from('featured_bills')
        .update(update)
        .eq('id', bill.id);
      if (flagErr) console.log(`    DB clear error: ${flagErr.message}`);

      // Try needs_review separately — ignore error if column doesn't exist
      await supabase.from('featured_bills').update({ needs_review: true }).eq('id', bill.id);
    }

    await sleep(DELAY_MS);
    continue;
  }

  // 4b. Good content — save it
  console.log(`  ✓ Generated: "${result.content.slice(0, 100)}..."`);

  if (!DRY_RUN) {
    const { error: updateErr } = await supabase
      .from('featured_bills')
      .update({ why_it_matters: result.content })
      .eq('id', bill.id);

    if (updateErr) {
      console.log(`  ✗ DB update error: ${updateErr.message}`);
      failed++;
    } else {
      console.log(`  ✓ Saved to DB`);
      updated++;
    }
  } else {
    console.log(`  (dry run — not saving)`);
    updated++;
  }

  await sleep(DELAY_MS);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`RESULTS`);
console.log(`${'─'.repeat(60)}`);
console.log(`Updated:  ${updated}`);
console.log(`Flagged:  ${flagged}  (why_it_matters cleared, needs manual review)`);
console.log(`Failed:   ${failed}  (Claude/DB errors)`);
console.log(`Total:    ${bills.length}`);

if (flaggedBills.length > 0) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`BILLS FLAGGED FOR REVIEW (insufficient animal welfare content):`);
  console.log(`${'─'.repeat(60)}`);
  for (const b of flaggedBills) {
    console.log(`\n  ${b.bill_number} (${b.state}) — Supabase ID: ${b.id}`);
    console.log(`  Title:  ${b.title}`);
    console.log(`  Reason: ${b.reason}`);
  }
  console.log(`\nTo remove these bills from the site, set active=false in Supabase for the IDs above.`);
}
