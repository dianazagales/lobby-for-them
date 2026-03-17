/**
 * Fix stale federal bills: H.R. 1477 and H.R. 2253
 *
 * These bills have fake legiscan_bill_id values (just the bill number) and
 * stale 2008 data. This script:
 * 1. Searches LegiScan for the real 119th Congress bill IDs
 * 2. If found, updates legiscan_bill_id, custom_title, why_it_matters, email_template
 * 3. If not found in LegiScan, checks Congress.gov
 * 4. If neither has it, sets active = false
 *
 * Usage: node scripts/fix-stale-federal-bills.mjs
 *        node scripts/fix-stale-federal-bills.mjs --dry-run
 */

import { readFileSync } from 'fs';
import Anthropic from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@anthropic-ai/sdk/index.mjs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_TEXT_CHARS = 4000;

// ── Load env ──────────────────────────────────────────────────────────────────

const envFile = readFileSync('/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const LEGISCAN_KEY  = env['VITE_LEGISCAN_API_KEY'];
const SUPABASE_URL  = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY  = env['VITE_SUPABASE_ANON_KEY'];
const ANTHROPIC_KEY = env['ANTHROPIC_API_KEY'];
const CONGRESS_KEY  = env['VITE_CONGRESS_API_KEY'];

if (!LEGISCAN_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing required env vars');
  process.exit(1);
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;
const sleep     = (ms) => new Promise(r => setTimeout(r, ms));

// ── Bills to fix (identified by Supabase UUID and search terms) ───────────────

const BILLS_TO_FIX = [
  {
    id:           'ff916193-4f69-4a29-873c-9f192db6ef1e',
    bill_number:  'H.R. 1477',
    search_query: 'Animal Cruelty Enforcement Act',
  },
  {
    id:           '1355d3a5-0a1f-42f0-bf8e-21d62a439716',
    bill_number:  'H.R. 2253',
    search_query: 'Puppy Protection Act',
  },
];

// ── LegiScan helpers ──────────────────────────────────────────────────────────

async function searchLegiScan(query) {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=search&state=US&query=${encodeURIComponent(query)}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return [];
    return data.searchresult?.results || [];
  } catch (err) {
    console.warn('  LegiScan search error:', err.message);
    return [];
  }
}

async function getBillDetails(billId) {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=getBill&id=${billId}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    return data.status === 'OK' ? data.bill : null;
  } catch { return null; }
}

async function getBillText(docId) {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=getBillText&id=${docId}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.text?.doc) return null;
    const raw  = Buffer.from(data.text.doc, 'base64').toString('utf8');
    const mime = data.text.mime || '';
    if (mime.includes('html')) {
      return raw
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
    if (/^[\x20-\x7E\n\r\t]+$/.test(raw.slice(0, 200))) return raw;
    return null;
  } catch { return null; }
}

// ── Congress.gov helper ────────────────────────────────────────────────────────

async function checkCongressGov(billNumber) {
  if (!CONGRESS_KEY) return null;
  const num = billNumber.replace(/\D/g, '');
  const url = `https://api.congress.gov/v3/bill/119/hr/${num}?api_key=${CONGRESS_KEY}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (!res.ok) return null;
    return data.bill || null;
  } catch { return null; }
}

// ── Claude generation ─────────────────────────────────────────────────────────

async function generateWhyItMatters(billNumber, title, billText) {
  if (!anthropic) return null;
  const context = billText
    ? `Bill text excerpt:\n${billText.slice(0, MAX_TEXT_CHARS)}`
    : '(Full text unavailable — title only)';
  const prompt = `You are an editor for "Lobby for Them", a civic action site focused on animal welfare legislation.

Write 3-4 sentences explaining why this federal bill matters for animal welfare and why someone should contact their representative. Be emotional but factual. Be specific to this bill. End with a call to action.

Bill: ${billNumber}
Title: ${title}
${context}

Write only the 3-4 sentences. No headers, no bullet points, no extra commentary.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-0',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0]?.text?.trim() || null;
  } catch (err) {
    console.warn('  Claude why_it_matters error:', err.message);
    return null;
  }
}

async function generateEmailTemplate(billNumber, title, billText) {
  if (!anthropic) return null;
  const context = billText
    ? `Bill text excerpt:\n${billText.slice(0, MAX_TEXT_CHARS)}`
    : '(Full text unavailable — title only)';
  const prompt = `You are writing a constituent email template for "Lobby for Them", a civic action site.

Write a professional, heartfelt email a constituent can send to their US Senator or Representative asking them to support this animal welfare bill.

Rules:
- Start with: Dear {{rep_name}},
- Use {{bill_name}} where the bill name should appear
- Use {{user_zip}} where the zip code should appear
- 3 short paragraphs, total ~150 words
- Emotional but respectful and factual
- End with: "Sincerely,\\nA concerned constituent from {{user_zip}}"

Bill: ${billNumber}
Title: ${title}
${context}

Write only the email text. No extra commentary.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-0',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0]?.text?.trim() || null;
  } catch (err) {
    console.warn('  Claude email_template error:', err.message);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n=== Fix Stale Federal Bills${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

for (const target of BILLS_TO_FIX) {
  console.log(`\n── ${target.bill_number} (id: ${target.id})`);

  // 1. Search LegiScan for the 119th Congress version
  console.log(`  Searching LegiScan: "${target.search_query}"...`);
  const results = await searchLegiScan(target.search_query);
  await sleep(400);

  console.log(`  Got ${results.length} results.`);

  // Filter to 2025+ and matching bill number
  const billNumClean = target.bill_number.replace(/\.\s*/g, '').replace(/\s+/g, '').toUpperCase(); // "HR1477"
  let bestResult = null;

  for (const r of results) {
    const rNum  = (r.bill_number || '').replace(/\.\s*/g, '').replace(/\s+/g, '').toUpperCase();
    const rYear = parseInt((r.last_action_date || r.last_action || '').slice(0, 4), 10);
    if (rNum === billNumClean && rYear >= 2025) {
      bestResult = r;
      break;
    }
  }

  // Fallback: any result with 2025+ date
  if (!bestResult) {
    for (const r of results) {
      const rYear = parseInt((r.last_action_date || r.last_action || '').slice(0, 4), 10);
      if (rYear >= 2025) {
        bestResult = r;
        console.log(`  No exact bill_number match — using best recent result: ${r.bill_number}`);
        break;
      }
    }
  }

  if (bestResult) {
    console.log(`  Found on LegiScan: bill_id=${bestResult.bill_id}, ${bestResult.bill_number}`);
    console.log(`  Title: ${(bestResult.title || '').slice(0, 80)}`);

    // Fetch full details
    const details = await getBillDetails(bestResult.bill_id);
    await sleep(400);

    if (!details) {
      console.warn('  Could not fetch full details — skipping.');
      continue;
    }

    // Fetch bill text
    let billText = null;
    if (details.texts?.length > 0) {
      const textEntry = details.texts.find(t => t.mime_id === 2) || details.texts[0];
      console.log(`  Fetching bill text (doc_id ${textEntry.doc_id})...`);
      billText = await getBillText(textEntry.doc_id);
      await sleep(400);
    }

    const title    = details.title || target.search_query;
    const newTitle = `${title} (${details.bill_number || target.bill_number})`;

    console.log('  Generating why_it_matters...');
    const whyItMatters = await generateWhyItMatters(details.bill_number || target.bill_number, title, billText);
    await sleep(600);

    console.log('  Generating email_template...');
    const emailTemplate = await generateEmailTemplate(details.bill_number || target.bill_number, title, billText);
    await sleep(600);

    const emailSubject = `Please Support ${details.bill_number || target.bill_number} — ${title.slice(0, 50)}`;

    const updates = {
      legiscan_bill_id: bestResult.bill_id,
      custom_title:     newTitle,
      active:           true,
      ...(whyItMatters  ? { why_it_matters:  whyItMatters  } : {}),
      ...(emailTemplate ? { email_template:  emailTemplate } : {}),
      ...(emailTemplate ? { email_subject:   emailSubject  } : {}),
    };

    console.log('\n  Updates:');
    for (const [k, v] of Object.entries(updates)) {
      const display = typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '...' : v;
      console.log(`    ${k}: ${display}`);
    }

    if (!DRY_RUN) {
      const { error } = await supabase.from('featured_bills').update(updates).eq('id', target.id);
      if (error) console.error('  ERROR:', error.message);
      else console.log('  ✓ Updated in Supabase.');
    } else {
      console.log('  [DRY RUN] Skipping write.');
    }

    continue;
  }

  // 2. Not found in LegiScan — try Congress.gov
  console.log(`  Not found in LegiScan 2025+. Checking Congress.gov (119th Congress)...`);
  const govBill = await checkCongressGov(target.bill_number);
  await sleep(400);

  if (govBill) {
    const title        = govBill.title || target.search_query;
    const actionDate   = govBill.latestAction?.actionDate || null;
    const newTitle     = `${title} (${target.bill_number})`;

    console.log(`  Found on Congress.gov: "${title.slice(0, 80)}"`);
    console.log(`  Latest action: ${actionDate}`);

    console.log('  Generating why_it_matters...');
    const whyItMatters = await generateWhyItMatters(target.bill_number, title, null);
    await sleep(600);

    console.log('  Generating email_template...');
    const emailTemplate = await generateEmailTemplate(target.bill_number, title, null);
    await sleep(600);

    const emailSubject = `Please Support ${target.bill_number} — ${title.slice(0, 50)}`;

    const updates = {
      custom_title: newTitle,
      active:       true,
      ...(whyItMatters  ? { why_it_matters:  whyItMatters  } : {}),
      ...(emailTemplate ? { email_template:  emailTemplate } : {}),
      ...(emailTemplate ? { email_subject:   emailSubject  } : {}),
    };

    console.log('\n  Updates (from Congress.gov):');
    for (const [k, v] of Object.entries(updates)) {
      const display = typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '...' : v;
      console.log(`    ${k}: ${display}`);
    }

    if (!DRY_RUN) {
      const { error } = await supabase.from('featured_bills').update(updates).eq('id', target.id);
      if (error) console.error('  ERROR:', error.message);
      else console.log('  ✓ Updated in Supabase.');
    } else {
      console.log('  [DRY RUN] Skipping write.');
    }

    continue;
  }

  // 3. Not found anywhere — deactivate
  console.log(`  NOT FOUND on LegiScan or Congress.gov.`);
  console.log(`  → Setting active = false.`);

  if (!DRY_RUN) {
    const { error } = await supabase.from('featured_bills').update({ active: false }).eq('id', target.id);
    if (error) console.error('  ERROR:', error.message);
    else console.log('  ✓ Deactivated in Supabase.');
  } else {
    console.log('  [DRY RUN] Skipping write.');
  }
}

console.log('\n=== Done ===\n');
