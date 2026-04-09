/**
 * classify-dog-bills.mjs
 *
 * Classifies active bills as dog-related or not, using Claude.
 * "Dog-related" includes bills that directly affect dogs AND broader
 * animal welfare bills that protect dogs (cruelty laws, pet shop bans,
 * shelter standards, etc.).
 *
 * Default: dry run (prints report only).
 * With --apply: deactivates non-dog bills.
 *
 * Usage:
 *   node scripts/classify-dog-bills.mjs            # dry run
 *   node scripts/classify-dog-bills.mjs --apply     # deactivate non-dog bills
 *
 * Requires in .env: ANTHROPIC_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs';
import Anthropic from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@anthropic-ai/sdk/index.mjs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

// ── Config ────────────────────────────────────────────────────────────────────

const APPLY    = process.argv.includes('--apply');
const DELAY_MS = 600;
const MAX_RETRIES = 3;

// --skip=N to resume from bill N (1-indexed, matches the [N/total] output)
const skipArg = process.argv.find(a => a.startsWith('--skip='));
const SKIP    = skipArg ? parseInt(skipArg.split('=')[1], 10) - 1 : 0;

// ── Env ───────────────────────────────────────────────────────────────────────

const envFile = readFileSync('/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const ANTHROPIC_KEY = env['ANTHROPIC_API_KEY'];
const SUPABASE_URL  = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep     = ms => new Promise(r => setTimeout(r, ms));

// ── Claude classification ─────────────────────────────────────────────────────

async function classifyBill(bill) {
  const stateLabel = bill.state === 'US' ? 'federal' : `${bill.state} state`;

  const context = [
    `Bill: ${bill.custom_title} (${stateLabel})`,
    bill.why_it_matters ? `\nWhy it matters:\n${bill.why_it_matters}` : null,
    bill.email_template ? `\nAdvocacy email body:\n${bill.email_template}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `You are classifying animal welfare legislation to determine if it is relevant to a dog-focused advocacy site.

"Dog-related" means the bill DIRECTLY affects dogs or companion animals that include dogs. The connection must be concrete and specific — not hypothetical or several steps removed.

CLASSIFY AS DOG-RELATED (true):
- Bills explicitly about dogs (puppy mills, dog fighting, breed-specific legislation, tethering, chaining, dangerous dog laws, greyhound racing)
- General animal cruelty / abuse / neglect laws that cover companion animals (these protect dogs)
- Pet store / pet shop / retail pet sales bans (these affect dog sales)
- Animal shelter standards, funding, or reform (these affect dogs in shelters)
- Spay/neuter programs (these affect dogs)
- Service animal / emotional support animal protections (primarily about dogs)
- Animal abuser registries (these protect dogs among others)
- Hot car / vehicle animal safety laws (these primarily affect dogs)
- Pets in protection orders / domestic violence (these affect dogs and cats)
- Animal hoarding laws (these affect dogs)
- Courtroom animal advocate programs (these often involve dog/cat cases)
- Trap/snare bans that protect pets from accidental injury
- Lab animal testing bills that specifically mention dogs or require adoption of dogs after testing
- Veterinary practice bills that directly affect pet care access
- General companion animal welfare bills

CLASSIFY AS NOT DOG-RELATED (false):
- Farm animal bills (gestation crates, battery cages, humane slaughter, livestock welfare, foie gras, ag-gag) UNLESS they also cover companion animals
- Wildlife bills (trophy hunting, fur bans, trapping licenses, exotic animals, captive wildlife, wolves, deer, fish, turkey)
- Marine animal bills
- Horse racing / equine-only bills (but greyhound/dog racing IS dog-related)
- Lab animal testing bills that do NOT specifically mention dogs
- Cockfighting-only bills (if dog fighting is also addressed, then it IS dog-related)
- Circus / entertainment animal bills focused on elephants, big cats, or marine mammals
- Generic appropriations or budget bills unless they are specifically for animal shelters or companion animal programs
- Bills about riots, terrorism, protests, weapons, or free speech — even if they COULD theoretically affect animal advocacy. The connection is too indirect.
- Hunting/fishing license or fee bills that don't involve dogs
- Pari-mutuel wagering or racing tax bills UNLESS they specifically involve dog/greyhound racing
- Trapping license fee or season bills (these are about wildlife trapping, not pet safety)
- Declawing bans (cats only, not dogs)

${context}

Respond with a JSON object — nothing else:
{
  "dog_related": true | false,
  "reason": "<one sentence explaining why>"
}`;

  let response;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });
      break;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const wait = DELAY_MS * attempt * 2;
      console.log(`\n  ⟳ API error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${wait}ms: ${err.message}`);
      await sleep(wait);
    }
  }

  const text = response.content[0]?.text?.trim() || '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse JSON from Claude response: ${text.slice(0, 200)}`);
  }

  if (typeof parsed.dog_related !== 'boolean') {
    throw new Error(`Invalid dog_related value: "${parsed.dog_related}"`);
  }

  return { dog_related: parsed.dog_related, reason: parsed.reason || null };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log(`  classify-dog-bills.mjs${APPLY ? '  [APPLY MODE — will deactivate non-dog bills]' : '  [DRY RUN — report only]'}`);
console.log(`${'═'.repeat(70)}\n`);

// Fetch all active bills
const { data: bills, error } = await supabase
  .from('featured_bills')
  .select('id, legiscan_bill_id, custom_title, state, why_it_matters, email_template')
  .eq('active', true);

if (error) {
  console.error('Failed to fetch bills:', error.message);
  process.exit(1);
}

console.log(`Found ${bills.length} active bills to classify.`);
if (SKIP > 0) console.log(`Skipping first ${SKIP} bills (--skip=${SKIP + 1}).`);
console.log();

if (bills.length === 0) {
  console.log('Nothing to classify. Exiting.\n');
  process.exit(0);
}

let dogCount = 0, notDogCount = 0, failedCount = 0, skippedCount = 0;
const results = [];

for (let i = 0; i < bills.length; i++) {
  if (i < SKIP) {
    skippedCount++;
    continue;
  }
  const bill = bills[i];
  const label = bill.custom_title?.slice(0, 70) || `Bill #${bill.legiscan_bill_id}`;
  process.stdout.write(`[${i + 1}/${bills.length}] ${label} ... `);

  let result;
  try {
    result = await classifyBill(bill);
  } catch (err) {
    console.log(`✗ Error: ${err.message}`);
    failedCount++;
    results.push({ id: bill.id, title: label, dog_related: null, reason: `ERROR: ${err.message.slice(0, 80)}` });
    await sleep(DELAY_MS);
    continue;
  }

  const emoji = result.dog_related ? '🐕' : '✗';
  console.log(`${emoji} ${result.dog_related ? 'DOG-RELATED' : 'NOT dog-related'}`);
  results.push({ id: bill.id, title: label, dog_related: result.dog_related, reason: result.reason });

  if (result.dog_related) {
    dogCount++;
  } else {
    notDogCount++;

    if (APPLY) {
      const { error: updateErr } = await supabase
        .from('featured_bills')
        .update({ active: false })
        .eq('id', bill.id);

      if (updateErr) {
        console.log(`  ✗ DB error deactivating: ${updateErr.message}`);
      } else {
        console.log(`  → Deactivated`);
      }
    }
  }

  await sleep(DELAY_MS);
}

// ── Report ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log('CLASSIFICATION REPORT');
console.log(`${'═'.repeat(70)}\n`);

const dogBills    = results.filter(r => r.dog_related === true);
const notDogBills = results.filter(r => r.dog_related === false);
const errorBills  = results.filter(r => r.dog_related === null);

if (dogBills.length > 0) {
  console.log(`── 🐕 DOG-RELATED (${dogBills.length}) — keeping active ${'─'.repeat(30)}`);
  for (const r of dogBills) {
    console.log(`  • ${r.title}`);
    if (r.reason) console.log(`    ${r.reason}`);
  }
  console.log();
}

if (notDogBills.length > 0) {
  console.log(`── ✗ NOT DOG-RELATED (${notDogBills.length}) — ${APPLY ? 'DEACTIVATED' : 'would deactivate'} ${'─'.repeat(20)}`);
  for (const r of notDogBills) {
    console.log(`  • ${r.title}`);
    if (r.reason) console.log(`    ${r.reason}`);
  }
  console.log();
}

if (errorBills.length > 0) {
  console.log(`── ⚠ ERRORS (${errorBills.length}) — not touched ${'─'.repeat(35)}`);
  for (const r of errorBills) {
    console.log(`  • ${r.title}`);
    if (r.reason) console.log(`    ${r.reason}`);
  }
  console.log();
}

console.log(`${'─'.repeat(70)}`);
console.log(`Dog-related  : ${dogCount}`);
console.log(`Not dog      : ${notDogCount}${APPLY ? ' (deactivated)' : ' (would deactivate with --apply)'}`);
console.log(`Errors       : ${failedCount}`);
if (skippedCount > 0) console.log(`Skipped      : ${skippedCount}`);
console.log(`Total        : ${bills.length}`);
console.log(`${'─'.repeat(70)}`);

if (!APPLY && notDogCount > 0) {
  console.log(`\nRun with --apply to deactivate the ${notDogCount} non-dog bill(s).\n`);
} else if (APPLY) {
  console.log(`\nDone. ${notDogCount} bill(s) deactivated.\n`);
} else {
  console.log(`\nAll active bills are dog-related. Nothing to deactivate.\n`);
}
