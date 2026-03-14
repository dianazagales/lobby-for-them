/**
 * Classify each active bill's stance from an animal welfare advocacy perspective.
 * Determines: "support", "oppose", or "neutral" + a one-sentence reason.
 *
 * Run: node scripts/classify-bill-stance.mjs
 *      node scripts/classify-bill-stance.mjs --dry-run
 */

import { readFileSync } from 'fs';
import Anthropic from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@anthropic-ai/sdk/index.mjs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN  = process.argv.includes('--dry-run');
const DELAY_MS = 600;

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

if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep     = ms => new Promise(r => setTimeout(r, ms));

// ── Claude classification ─────────────────────────────────────────────────────

async function classifyBill(bill) {
  const stateLabel = bill.state === 'US' ? 'federal' : `${bill.state} state`;

  const context = [
    `Bill: ${bill.bill_number || `#${bill.legiscan_bill_id}`} (${stateLabel})`,
    `Title: ${bill.custom_title}`,
    bill.why_it_matters ? `\nWhy it matters:\n${bill.why_it_matters}` : null,
    bill.email_template  ? `\nAdvocacy email body:\n${bill.email_template}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `You are classifying animal welfare legislation for "Lobby for Them", an advocacy site.

Determine whether the site should urge users to SUPPORT or OPPOSE this bill, based solely on its impact on animal welfare.

Definitions:
- "support" = bill improves protections, conditions, or rights for animals (e.g. bans cruelty, strengthens enforcement, improves living conditions)
- "oppose"  = bill weakens protections or harms animal welfare (e.g. rolls back regulations, legalizes harmful practices)
- "neutral" = impact on animal welfare is unclear, mixed, or purely procedural

${context}

Respond with a JSON object — nothing else:
{
  "stance": "support" | "oppose" | "neutral",
  "stance_reason": "<one sentence explaining the decision>"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text?.trim() || '';

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse JSON from Claude response: ${text.slice(0, 200)}`);
  }

  const stance = parsed.stance;
  if (!['support', 'oppose', 'neutral'].includes(stance)) {
    throw new Error(`Invalid stance value: "${stance}"`);
  }

  return { stance, stance_reason: parsed.stance_reason || null };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n=== Classify Bill Stance${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

const { data: bills, error } = await supabase
  .from('featured_bills')
  .select('id, legiscan_bill_id, custom_title, state, why_it_matters, email_template, stance')
  .eq('active', true)
  .is('stance', null);

if (error) {
  console.error('Failed to fetch bills:', error.message);
  console.error('If the error is "column does not exist", run this SQL in Supabase:');
  console.error('  ALTER TABLE featured_bills ADD COLUMN IF NOT EXISTS stance TEXT CHECK (stance IN (\'support\', \'oppose\', \'neutral\'));');
  console.error('  ALTER TABLE featured_bills ADD COLUMN IF NOT EXISTS stance_reason TEXT;');
  process.exit(1);
}

console.log(`Found ${bills.length} active bills without a stance.\n`);

let classified = 0, failed = 0;
const results = []; // for final report

for (let i = 0; i < bills.length; i++) {
  const bill = bills[i];
  const label = bill.custom_title?.slice(0, 70) || `Bill #${bill.legiscan_bill_id}`;
  process.stdout.write(`[${i + 1}/${bills.length}] ${label} ... `);

  let result;
  try {
    result = await classifyBill(bill);
  } catch (err) {
    console.log(`✗ Claude error: ${err.message}`);
    failed++;
    results.push({ title: label, stance: 'ERROR', reason: err.message.slice(0, 80) });
    await sleep(DELAY_MS);
    continue;
  }

  console.log(`→ ${result.stance.toUpperCase()}`);
  results.push({ title: label, stance: result.stance, reason: result.stance_reason });

  if (!DRY_RUN) {
    const { error: updateErr } = await supabase
      .from('featured_bills')
      .update({ stance: result.stance, stance_reason: result.stance_reason })
      .eq('id', bill.id);

    if (updateErr) {
      console.log(`  ✗ DB error: ${updateErr.message}`);
      failed++;
    } else {
      classified++;
    }
  } else {
    console.log(`  (dry run — not saving)`);
    classified++;
  }

  await sleep(DELAY_MS);
}

// ── Final report ──────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log('CLASSIFICATION REPORT');
console.log(`${'═'.repeat(70)}\n`);

const byStance = { support: [], oppose: [], neutral: [], ERROR: [] };
for (const r of results) {
  (byStance[r.stance] || byStance['ERROR']).push(r);
}

for (const [stance, items] of Object.entries(byStance)) {
  if (items.length === 0) continue;
  console.log(`── ${stance.toUpperCase()} (${items.length}) ${'─'.repeat(Math.max(0, 50 - stance.length - String(items.length).length - 6))}`);
  for (const r of items) {
    console.log(`  • ${r.title}`);
    if (r.reason) console.log(`    ${r.reason}`);
  }
  console.log();
}

console.log(`${'─'.repeat(70)}`);
console.log(`Classified : ${classified}`);
console.log(`Failed     : ${failed}`);
console.log(`Total      : ${bills.length}`);
console.log(`${'─'.repeat(70)}\n`);
