/**
 * Refresh Goldie's Act in Supabase with current LegiScan data
 * and regenerate its why_it_matters description via Claude.
 *
 * Run: node scripts/update-goldies-act.mjs
 */

import { readFileSync } from 'fs';
import Anthropic from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@anthropic-ai/sdk/index.mjs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

// ── Env ───────────────────────────────────────────────────────────────────────

const envFile = readFileSync('/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const ANTHROPIC_KEY = env['ANTHROPIC_API_KEY'];
const LEGISCAN_KEY  = env['VITE_LEGISCAN_API_KEY'];
const SUPABASE_URL  = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY  = env['VITE_SUPABASE_ANON_KEY'];

if (!ANTHROPIC_KEY || !LEGISCAN_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required env vars. Check .env file.');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep     = (ms) => new Promise(r => setTimeout(r, ms));

const MAX_TEXT_CHARS = 4000;

// ── LegiScan helpers (same pattern as generate-why-it-matters.mjs) ────────────

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

// ── Claude generation (same prompt as generate-why-it-matters.mjs) ────────────

async function generateWhyItMatters(bill, billText, extraContext = '') {
  const stateLabel = bill.state === 'US' ? 'federal' : `${bill.state} state`;
  const contextParts = [];
  if (billText) contextParts.push(`Bill text excerpt:\n${billText.slice(0, MAX_TEXT_CHARS)}`);
  if (extraContext) contextParts.push(extraContext);
  if (!contextParts.length) contextParts.push('(Full text unavailable — use title and any additional context above)');
  const context = contextParts.join('\n\n');

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
Full title: ${bill.title || bill.custom_title}
Display title: ${bill.custom_title}
${context}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-0',
    max_tokens: 350,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text?.trim() || '';
  if (text.startsWith('SKIP:'))  return { flagged: true, reason: text.slice(5).trim() };
  if (text.startsWith('WRITE:')) return { content: text.slice(6).trim() };
  return { content: text };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("\n=== Updating Goldie's Act ===\n");

// 1. Find the record in Supabase (may have been re-IDed to 1916977 by refresh script)
const { data: rows, error: fetchErr } = await supabase
  .from('featured_bills')
  .select('*')
  .ilike('custom_title', "%goldie%");

if (fetchErr || !rows?.length) {
  console.error("Could not find Goldie's Act in Supabase:", fetchErr?.message || 'no rows');
  process.exit(1);
}

const record = rows[0];
console.log(`Found in Supabase: "${record.custom_title}"`);
console.log(`  Supabase ID       : ${record.id}`);
console.log(`  LegiScan bill ID  : ${record.legiscan_bill_id}`);
console.log(`  Current active    : ${record.active}`);
console.log(`  Current urgency   : ${record.urgency}`);

// 2. Fetch fresh bill details from LegiScan
console.log(`\nFetching LegiScan data for bill ID ${record.legiscan_bill_id}...`);
const legiData = await getBillDetails(record.legiscan_bill_id);

if (!legiData) {
  console.error('LegiScan returned no data. Aborting.');
  process.exit(1);
}

const history     = legiData.history || [];
const lastEntry   = history[history.length - 1] || {};
const lastDate    = lastEntry.date || legiData.last_action_date || 'unknown';
const lastAction  = lastEntry.action || legiData.last_action || 'unknown';
const sponsor     = legiData.sponsors?.[0];
const statusLabel = {
  1: 'Introduced', 2: 'Engrossed', 3: 'Enrolled', 4: 'Passed',
  5: 'Vetoed', 6: 'Failed/Dead', 8: 'Chaptered', 12: 'Draft',
}[legiData.status] || `Status ${legiData.status}`;

console.log(`\nLegiScan data:`);
console.log(`  Bill number  : ${legiData.bill_number}`);
console.log(`  State        : ${legiData.state}`);
console.log(`  Status       : ${statusLabel} (${legiData.status})`);
console.log(`  Last action  : ${lastAction}`);
console.log(`  Last date    : ${lastDate}`);
console.log(`  Sponsor      : ${sponsor ? sponsor.name : 'none'}`);

// 3. Fetch bill text for richer Claude prompt
let billText = null;
if (legiData.texts?.length > 0) {
  const textEntry = legiData.texts.find(t => t.mime_id === 2) || legiData.texts[0];
  console.log(`\nFetching bill text (doc_id ${textEntry.doc_id})...`);
  await sleep(300);
  billText = await getBillText(textEntry.doc_id);
  console.log(billText ? `  Got ${billText.length} chars` : '  Text unavailable — using title only');
} else {
  console.log('\nNo bill text available — using title only');
}

// 4. Generate why_it_matters via Claude
console.log('\nGenerating why_it_matters with Claude...');
await sleep(300);

const billForPrompt = {
  ...record,
  title: legiData.title || record.custom_title,
  bill_number: legiData.bill_number || `Bill ${record.legiscan_bill_id}`,
  state: legiData.state || record.state,
};

// Build extra context from available LegiScan fields when bill text is unavailable
const extraParts = [];
if (legiData.title && legiData.title !== record.custom_title) {
  extraParts.push(`LegiScan full title: ${legiData.title}`);
}
if (lastAction && lastAction !== 'unknown') {
  extraParts.push(`Most recent legislative action: ${lastAction} (${lastDate})`);
}
if (legiData.committee?.committee_name) {
  extraParts.push(`Referred to committee: ${legiData.committee.committee_name}`);
}
if (sponsor) {
  extraParts.push(`Sponsor: ${sponsor.name}`);
}

// Goldie's Act is a well-documented federal bill — provide public background
// so Claude can write an accurate description despite the short title.
extraParts.push(`Background: Goldie's Act is named after a golden retriever seized from a USDA-licensed ` +
  `dealer in terrible condition. The bill requires USDA inspectors to immediately report animal welfare ` +
  `violations they witness at licensed facilities to local law enforcement. Under current law, inspectors ` +
  `can document violations but have no obligation to notify police, allowing abusers to continue operating. ` +
  `The bill was introduced by Rep. Nicole Malliotakis and referred to the Subcommittee on Livestock, Dairy, and Poultry.`);

const extraContext = extraParts.length ? extraParts.join('\n') : '';

const result = await generateWhyItMatters(billForPrompt, billText, extraContext);

if (result.flagged) {
  console.error(`\nClaude flagged this bill as insufficient: ${result.reason}`);
  console.error('Aborting — review the bill manually before updating.');
  process.exit(1);
}

console.log(`\nGenerated description:\n  "${result.content}"`);

// 5. Build the Supabase update
const NON_ACTIONABLE = new Set([3, 4, 5, 6, 8, 11]);
const isActionable   = !NON_ACTIONABLE.has(legiData.status);

const updates = {
  why_it_matters: result.content,
  active:         isActionable,
  // needs_review and is_active columns (ignore error if columns don't exist)
};

// Update the bill's legiscan_bill_id if we're on the correct current ID
// (the refresh script may have already done this, but be safe)
if (legiData.bill_id && legiData.bill_id !== record.legiscan_bill_id) {
  updates.legiscan_bill_id = legiData.bill_id;
  console.log(`\nNote: updating legiscan_bill_id ${record.legiscan_bill_id} → ${legiData.bill_id}`);
}

console.log('\nWriting to Supabase...');
const { error: updateErr } = await supabase
  .from('featured_bills')
  .update(updates)
  .eq('id', record.id);

if (updateErr) {
  console.error('Supabase update failed:', updateErr.message);
  process.exit(1);
}

// Set needs_review = false and is_active = true (ignore if columns absent)
await supabase.from('featured_bills').update({ needs_review: false }).eq('id', record.id);
await supabase.from('featured_bills').update({ is_active: true }).eq('id', record.id);

// Also refresh the LegiScan cache
await supabase.from('legiscan_cache').upsert({
  bill_id:   record.legiscan_bill_id,
  data:      legiData,
  cached_at: new Date().toISOString(),
});

console.log('\n✓ Supabase updated successfully');
console.log(`  active         : ${isActionable}`);
console.log(`  needs_review   : false`);
console.log(`  why_it_matters : updated`);
console.log(`  legiscan cache : refreshed`);
console.log('\nDone!\n');
