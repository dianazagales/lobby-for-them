/**
 * One-off: add Alaska HB 258 (Statewide Spay & Neuter Program) to featured_bills.
 *
 * Usage: node scripts/add-single-bill.mjs
 */

import { readFileSync } from 'fs';
import Anthropic from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@anthropic-ai/sdk/index.mjs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

// ── Load env (same pattern as seed-puppy-bills.mjs) ──────────────────────────

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

const LEGISCAN_KEY        = env['VITE_LEGISCAN_API_KEY'];
const SUPABASE_URL        = env['VITE_SUPABASE_URL'];
const SUPABASE_SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const ANTHROPIC_KEY       = env['ANTHROPIC_API_KEY'];

console.log('Environment loaded.');
console.log('Supabase URL:', SUPABASE_URL);
console.log('LegiScan key present:', !!LEGISCAN_KEY);
console.log('Anthropic key present:', !!ANTHROPIC_KEY);

const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;
const sleep     = (ms) => new Promise(r => setTimeout(r, ms));

// ── Target bill ───────────────────────────────────────────────────────────────

const BILL_ID = 2084377; // AK HB258 — confirmed via LegiScan master list

// ── Urgency mapping (same as seed-puppy-bills.mjs) ────────────────────────────

function getUrgency(status) {
  if ([2, 3, 4, 7, 10].includes(status)) return 'high';
  if ([1, 9, 12].includes(status)) return 'medium';
  return 'medium';
}

// ── LegiScan helpers ──────────────────────────────────────────────────────────

async function getBillDetails(billId) {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=getBill&id=${billId}`;
  const res  = await fetch(url);
  const data = await res.json();
  return data.status === 'OK' ? data.bill : null;
}

async function getBillText(docId) {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=getBillText&id=${docId}`;
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
}

// ── Claude generation ─────────────────────────────────────────────────────────

async function generateWhyItMatters(bill, billText) {
  if (!anthropic) return `Alaska HB 258 would establish a statewide spay and neuter assistance fund to help low-income households afford these essential procedures. Uncontrolled animal populations lead to overcrowded shelters, euthanasia, and suffering for feral animals. Contact your representatives and urge them to support this program.`;

  const context = billText
    ? `Bill text excerpt:\n${billText.slice(0, 4000)}`
    : '(Full text unavailable — title only)';

  const prompt = `You are writing content for a civic action website called "Lobby for Them" that helps everyday people contact their representatives about animal welfare legislation.

Write 3-4 sentences explaining why this specific Alaska bill matters for animal welfare and why someone should take action. Be emotional but factual. Be specific to spay/neuter programs, feral animal management, and access for low-income households — do NOT use language about puppy mills or commercial breeders. Focus on the real impact on animals and communities. End with a call to action.

Bill: ${bill.bill_number} (Alaska state)
Title: ${bill.title}
${context}

Write only the 3-4 sentences. No headers, no bullet points, no extra commentary.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-0',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0]?.text?.trim() || null;
  } catch (err) {
    console.log(`  Claude error: ${err.message}`);
    return null;
  }
}

async function generateEmailTemplate(bill, billText) {
  if (!anthropic) return null;

  const context = billText
    ? `Bill text excerpt:\n${billText.slice(0, 4000)}`
    : '(Full text unavailable — title only)';

  const prompt = `You are writing a constituent email template for "Lobby for Them", a civic action site focused on animal welfare.

Write a professional, heartfelt email a constituent can send to their Alaska state representative or senator asking them to support this bill.

Rules:
- Start with: Dear {{rep_name}},
- Use {{bill_name}} where the bill name should appear
- Use {{user_zip}} where the zip code should appear
- Focus on spay/neuter access for low-income households, reducing shelter overpopulation, and humane feral animal management through trap-neuter-release
- Do NOT mention puppy mills or commercial breeders
- 3 short paragraphs, total ~150 words
- End with: "Sincerely,\\nA concerned constituent from {{user_zip}}"

Bill: ${bill.bill_number} (Alaska)
Title: ${bill.title}
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
    console.log(`  Claude error: ${err.message}`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\n=== Add Alaska HB 258 (Spay & Neuter Program) ===\n');

// 1. Check if already in Supabase
const { data: existing } = await supabase
  .from('featured_bills')
  .select('id, custom_title')
  .eq('legiscan_bill_id', BILL_ID)
  .limit(1);

if (existing && existing.length > 0) {
  console.log('Bill already exists in featured_bills:', existing[0].custom_title);
  console.log('Skipping insert.');
  process.exit(0);
}

// 2. Fetch full bill details from LegiScan
console.log(`Fetching bill details (LegiScan ID: ${BILL_ID})...`);
const bill = await getBillDetails(BILL_ID);
await sleep(400);

if (!bill) {
  console.error('Could not fetch bill from LegiScan. Aborting.');
  process.exit(1);
}

console.log(`  Bill: ${bill.bill_number} — ${bill.title}`);
console.log(`  Status: ${bill.status} | State: ${bill.state}`);
const history = bill.history || [];
const lastAction = history[history.length - 1];
console.log(`  Last action: ${lastAction?.date} — ${lastAction?.action?.slice(0, 80)}`);

// 3. Fetch bill text
let billText = null;
if (bill.texts?.length > 0) {
  const textEntry = bill.texts.find(t => t.mime_id === 2) || bill.texts[0];
  console.log(`  Fetching bill text (doc_id ${textEntry.doc_id})...`);
  billText = await getBillText(textEntry.doc_id);
  await sleep(400);
  console.log(`  Text fetched: ${billText ? billText.length + ' chars' : 'unavailable'}`);
}

// 4. Generate why_it_matters
console.log('\nGenerating why_it_matters via Claude...');
const whyItMatters = await generateWhyItMatters(bill, billText);
await sleep(600);
console.log('  →', whyItMatters?.slice(0, 120));

// 5. Generate email_template
console.log('\nGenerating email_template via Claude...');
const emailTemplate = await generateEmailTemplate(bill, billText);
await sleep(600);
console.log('  →', emailTemplate?.slice(0, 120));

// 6. Build the record
const customTitle = `${bill.title} (${bill.bill_number})`;
const emailSubject = `Please Support ${bill.bill_number} — ${bill.title.slice(0, 50)}`;
const urgency = getUrgency(bill.status);

const record = {
  legiscan_bill_id: BILL_ID,
  state:            'AK',
  custom_title:     customTitle,
  why_it_matters:   whyItMatters || `Alaska HB 258 would create a statewide spay and neuter assistance fund, helping low-income households afford essential procedures and allowing municipalities to manage feral animal populations through trap-neuter-release. Overpopulation is one of the leading causes of animal shelter overcrowding and preventable euthanasia. Contact your Alaska legislators today and urge them to support this life-saving program.`,
  email_subject:    emailSubject,
  email_body:       null,
  email_template:   emailTemplate,
  urgency,
  active:           true,
  stance:           'support',
  stance_reason:    'HB 258 reduces animal suffering and shelter overcrowding by making spay/neuter accessible to low-income households and enabling humane feral population management.',
};

// 7. Insert into Supabase
console.log('\nInserting into featured_bills...');
console.log('  custom_title:', record.custom_title);
console.log('  state:', record.state);
console.log('  urgency:', record.urgency);
console.log('  legiscan_bill_id:', record.legiscan_bill_id);

const { data: inserted, error: insertErr } = await supabase
  .from('featured_bills')
  .insert([record])
  .select('id, custom_title, state, urgency')
  .single();

if (insertErr) {
  console.error('\nInsert failed:', insertErr.message);
  process.exit(1);
}

console.log('\n✓ Inserted successfully!');
console.log('  id:', inserted.id);
console.log('  custom_title:', inserted.custom_title);
console.log('  state:', inserted.state);
console.log('  urgency:', inserted.urgency);
