/**
 * Generate pre-written advocacy email body paragraphs for all active bills
 * that don't yet have an email_template.
 *
 * The greeting ("Dear [Rep],") and sign-off are added dynamically in the UI —
 * this script writes only the persuasive body paragraphs.
 *
 * Run: node scripts/generate-email-templates.mjs
 *      node scripts/generate-email-templates.mjs --dry-run
 */

import { readFileSync } from 'fs';
import Anthropic from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@anthropic-ai/sdk/index.mjs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN   = process.argv.includes('--dry-run');
const DELAY_MS  = 800; // between Claude calls

// ── Env ───────────────────────────────────────────────────────────────────────

const envFile = readFileSync('/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const ANTHROPIC_KEY = env['ANTHROPIC_API_KEY'];
const SUPABASE_URL  = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY  = env['VITE_SUPABASE_ANON_KEY'];
const LEGISCAN_KEY  = env['VITE_LEGISCAN_API_KEY'];

if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep     = ms => new Promise(r => setTimeout(r, ms));

const STATUS_LABELS = {
  1: 'Introduced', 2: 'Engrossed', 3: 'Enrolled', 4: 'Passed',
  5: 'Vetoed', 6: 'Failed/Dead', 8: 'Chaptered', 12: 'Draft',
};

// ── LegiScan helper ───────────────────────────────────────────────────────────

async function getCachedLegiData(billId) {
  const { data } = await supabase
    .from('legiscan_cache')
    .select('data')
    .eq('bill_id', billId)
    .single();
  return data?.data || null;
}

// ── Claude generation ─────────────────────────────────────────────────────────

async function generateEmailTemplate(bill, legiData) {
  const stateLabel  = bill.state === 'US' ? 'federal' : `${bill.state} state`;
  const billNumber  = legiData?.bill_number || `Bill #${bill.legiscan_bill_id}`;
  const status      = STATUS_LABELS[legiData?.status] || 'Active';
  const sponsor     = legiData?.sponsors?.[0]?.name || null;
  const history     = legiData?.history || [];
  const lastEntry   = history[history.length - 1];
  const lastAction  = lastEntry ? `${lastEntry.action} (${lastEntry.date})` : null;

  const context = [
    `Bill: ${billNumber} (${stateLabel})`,
    `Title: ${bill.custom_title}`,
    `Status: ${status}`,
    sponsor     ? `Sponsor: ${sponsor}` : null,
    lastAction  ? `Last action: ${lastAction}` : null,
    bill.why_it_matters ? `\nWhy it matters:\n${bill.why_it_matters}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `You are writing constituent advocacy emails for "Lobby for Them", a site that helps everyday people contact their representatives about animal welfare legislation.

Write 2–3 short, heartfelt body paragraphs of a constituent email urging support for this bill. Rules:
- Do NOT include a greeting or sign-off — only the body paragraphs
- Be specific to what this bill actually covers — no generic filler
- Speak as a constituent who cares about animals, not as an organization
- Keep it concise: ~80–120 words total
- End with a clear ask (e.g. "Please co-sponsor and vote yes on ${billNumber}.")
- Use {{bill_name}} where you reference the bill title, and {{user_zip}} where you reference the constituent's location

${context}

Write only the body paragraphs. Nothing else.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-0',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0]?.text?.trim() || null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n=== Generate Email Templates${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

const { data: bills, error } = await supabase
  .from('featured_bills')
  .select('id, legiscan_bill_id, custom_title, state, why_it_matters, email_template')
  .eq('active', true)
  .is('email_template', null);

if (error) {
  console.error('Failed to fetch bills:', error.message);
  console.error('If the error is "column does not exist", run this SQL in your Supabase dashboard:');
  console.error('  ALTER TABLE featured_bills ADD COLUMN IF NOT EXISTS email_template text;');
  process.exit(1);
}

console.log(`Found ${bills.length} active bills without an email_template.\n`);

let generated = 0, failed = 0;

for (let i = 0; i < bills.length; i++) {
  const bill = bills[i];
  console.log(`[${i + 1}/${bills.length}] ${bill.custom_title?.slice(0, 70) || bill.legiscan_bill_id}`);

  const legiData = await getCachedLegiData(bill.legiscan_bill_id);
  if (!legiData) console.log('  (no LegiScan cache — generating from title only)');

  let template;
  try {
    template = await generateEmailTemplate(bill, legiData);
  } catch (err) {
    console.log(`  ✗ Claude error: ${err.message}`);
    failed++;
    await sleep(DELAY_MS);
    continue;
  }

  if (!template) {
    console.log('  ✗ Claude returned empty response');
    failed++;
    await sleep(DELAY_MS);
    continue;
  }

  console.log(`  ✓ "${template.slice(0, 100)}..."`);

  if (!DRY_RUN) {
    const { error: updateErr } = await supabase
      .from('featured_bills')
      .update({ email_template: template })
      .eq('id', bill.id);

    if (updateErr) {
      console.log(`  ✗ DB error: ${updateErr.message}`);
      failed++;
    } else {
      console.log('  ✓ Saved');
      generated++;
    }
  } else {
    console.log('  (dry run — not saving)');
    generated++;
  }

  await sleep(DELAY_MS);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Generated : ${generated}`);
console.log(`Failed    : ${failed}`);
console.log(`Total     : ${bills.length}`);
console.log(`${'─'.repeat(50)}\n`);
