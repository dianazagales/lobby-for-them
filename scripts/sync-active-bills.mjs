/**
 * sync-active-bills.mjs
 *
 * Syncs featured_bills in Supabase with currently active animal welfare
 * legislation from LegiScan (all 50 states) and Congress.gov (federal).
 *
 * WHEN TO RUN:
 *   - At the start of a new legislative session (January/February each year)
 *   - Monthly to catch newly introduced bills and deactivate passed/failed ones
 *   - Any time you want to ensure the DB reflects current bill statuses
 *
 * Usage:
 *   node scripts/sync-active-bills.mjs
 *   node scripts/sync-active-bills.mjs --dry-run
 *
 * Requires in .env:
 *   VITE_LEGISCAN_API_KEY, VITE_CONGRESS_API_KEY,
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { readFileSync } from 'fs';
import Anthropic from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@anthropic-ai/sdk/index.mjs';
import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN      = process.argv.includes('--dry-run');
const DELAY_MS     = 200;   // between LegiScan API calls
const MAX_TEXT     = 4000;  // chars of bill text sent to Claude

// LegiScan status codes
const KEEP_STATUSES    = new Set([0, 1, 2, 3]);   // pre-filed, introduced, engrossed, enrolled
const DISCARD_STATUSES = new Set([4, 5, 6]);       // passed/signed, vetoed, failed

// Congress.gov status text patterns
const CONGRESS_KEEP_PATTERNS    = ['referred to', 'introduced', 'committee', 'hearing', 'markup', 'reported', 'passed house', 'passed senate', 'ordered to be reported'];
const CONGRESS_DISCARD_PATTERNS = ['became public law', 'vetoed', 'failed', 'withdrawn', 'not agreed to', 'indefinitely postponed'];

// ── Load env ──────────────────────────────────────────────────────────────────

const envFile = readFileSync('/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const LEGISCAN_KEY   = env['VITE_LEGISCAN_API_KEY'];
const CONGRESS_KEY   = env['VITE_CONGRESS_API_KEY'];
const SUPABASE_URL   = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY   = env['SUPABASE_SERVICE_ROLE_KEY'];
const ANTHROPIC_KEY  = env['ANTHROPIC_API_KEY'];

if (!LEGISCAN_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing VITE_LEGISCAN_API_KEY, VITE_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;
const sleep     = ms => new Promise(r => setTimeout(r, ms));

// ── Keyword groups ────────────────────────────────────────────────────────────

const KEYWORD_GROUPS = [
  // Group A — Core
  'animal welfare', 'animal cruelty', 'animal protection', 'animal abuse',
  'animal neglect', 'cruelty to animals', 'humane treatment',
  // Group B — Companion animals
  'puppy mill', 'commercial breeder', 'pet store', 'animal shelter',
  'spay neuter', 'tethering', 'dog chaining', 'dangerous dog',
  'animal hoarding', 'declawing', 'hot car', 'trap neuter return',
  // Group C — Farm animals
  'factory farming', 'gestation crate', 'battery cage', 'cage-free',
  'humane slaughter', 'livestock welfare', 'farm animal', 'foie gras',
  'ag-gag', 'downed animal',
  // Group D — Wildlife & exotics
  'trophy hunting', 'wildlife trafficking', 'fur ban', 'trapping',
  'captive wildlife', 'exotic animal', 'roadside zoo', 'big cat',
  // Group E — Fighting, entertainment & testing
  'dog fighting', 'cockfighting', 'circus animal', 'greyhound racing',
  'animal testing', 'cosmetic testing', 'laboratory animal',
  // Group F — Legal protections
  'animal cruelty felony', 'animal abuser registry',
  'pets in protection orders', 'courtroom animal advocate',
];

const FEDERAL_EXTRA = [
  "PACT Act", "Goldie's Act", "Big Cat Safety Act",
  "Safeguard American Food Exports", "Preventing Animal Cruelty and Torture",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function urgencyFromStatus(status) {
  if (status === 3) return 'high';   // enrolled — passed both chambers
  if (status === 2) return 'high';   // engrossed — passed one chamber
  if (status === 1) return 'medium'; // introduced
  return 'low';                      // pre-filed / unknown
}

function truncate(str, max) {
  if (!str || str.length <= max) return str || '';
  const cut = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

function formatCongressBillNumber(type, number) {
  const MAP = { HR: 'H.R.', S: 'S.', HJRES: 'H.J.Res.', SJRES: 'S.J.Res.',
                HCONRES: 'H.Con.Res.', SCONRES: 'S.Con.Res.', HRES: 'H.Res.', SRES: 'S.Res.' };
  return `${MAP[type] || type} ${number}`;
}

// ── LegiScan API helpers ──────────────────────────────────────────────────────

async function legiScanGet(op, params = '') {
  const url = `https://api.legiscan.com/?key=${LEGISCAN_KEY}&op=${op}${params}`;
  const res  = await fetch(url);
  return res.json();
}

async function getActiveSessions() {
  const data = await legiScanGet('getSessionList');
  await sleep(DELAY_MS);

  if (data.status !== 'OK' || !data.sessions) {
    console.error('ERROR: Could not fetch session list from LegiScan');
    process.exit(1);
  }

  const activeSessions = new Map(); // session_id → { state, session_id }
  const skippedStates  = new Set();

  for (const s of data.sessions) {
    if (s.sine_die === 0 && s.prior === 0) {
      activeSessions.set(s.session_id, { state: s.state, session_id: s.session_id });
    } else if (s.sine_die === 1 || s.prior === 1) {
      skippedStates.add(s.state);
    }
  }

  // States that appear only in inactive sessions
  for (const s of activeSessions.values()) skippedStates.delete(s.state);

  for (const state of [...skippedStates].sort()) {
    if (state !== 'US') console.log(`  Skipping ${state} — no active session`);
  }

  return { activeSessions, skippedStates };
}

async function searchLegiScan(query) {
  const data = await legiScanGet('getSearch', `&query=${encodeURIComponent(query)}&state=ALL&year=2&type=B`);
  await sleep(DELAY_MS);

  if (data.status !== 'OK' || !data.searchresult) return [];

  const results = [];
  for (const [key, val] of Object.entries(data.searchresult)) {
    if (key === 'summary' || typeof val !== 'object' || !val.bill_id) continue;
    results.push(val);
  }
  return results;
}

async function getBillDetails(billId) {
  const data = await legiScanGet('getBill', `&id=${billId}`);
  await sleep(DELAY_MS);
  return data.status === 'OK' ? data.bill : null;
}

async function getBillText(docId) {
  const data = await legiScanGet('getBillText', `&id=${docId}`);
  await sleep(DELAY_MS);
  if (data.status !== 'OK' || !data.text?.doc) return null;
  try {
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
  } catch { /* ignore */ }
  return null;
}

// ── Congress.gov API helpers ──────────────────────────────────────────────────

async function searchCongressGov(query) {
  if (!CONGRESS_KEY) return [];
  try {
    const url  = `https://api.congress.gov/v3/bill/119?query=${encodeURIComponent(query)}&limit=250&api_key=${CONGRESS_KEY}&format=json`;
    const res  = await fetch(url);
    const data = await res.json();
    await sleep(DELAY_MS);
    return data.bills || [];
  } catch (err) {
    console.warn(`  Congress.gov search error for "${query}": ${err.message}`);
    return [];
  }
}

function congressBillIsActive(bill) {
  const text = (bill.latestAction?.text || '').toLowerCase();
  if (CONGRESS_DISCARD_PATTERNS.some(p => text.includes(p))) return false;
  if (CONGRESS_KEEP_PATTERNS.some(p => text.includes(p))) return true;
  return false; // uncertain — skip
}

function urgencyFromCongressAction(bill) {
  const text = (bill.latestAction?.text || '').toLowerCase();
  if (text.includes('passed house') || text.includes('passed senate') ||
      text.includes('ordered to be reported') || text.includes('reported')) return 'high';
  if (text.includes('markup') || text.includes('hearing')) return 'medium';
  return 'medium';
}

// ── Claude generation ─────────────────────────────────────────────────────────

async function generateWhyItMatters(billNumber, title, state, billText) {
  if (!anthropic) return null;
  const stateLabel = state === 'US' ? 'federal' : `${state} state`;
  const context = billText
    ? `Bill text excerpt:\n${billText.slice(0, MAX_TEXT)}`
    : '(Full text unavailable — title only)';

  const prompt = `You are an editor for "Lobby for Them", a civic action site focused on animal welfare legislation.

Write 3-4 sentences explaining why this bill matters for animal welfare and why someone should take action. Be emotional but factual. Be specific to this bill — do not use generic language. End with a call to action.

Bill: ${billNumber} (${stateLabel})
Title: ${title}
${context}

Write only the 3-4 sentences. No headers, no bullet points, no extra commentary.`;

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-0',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.content[0]?.text?.trim() || null;
  } catch (err) {
    console.warn(`  Claude why_it_matters error: ${err.message}`);
    return null;
  }
}

async function generateEmailTemplate(billNumber, title, state, billText) {
  if (!anthropic) return null;
  const stateLabel = state === 'US' ? 'federal' : `${state} state`;
  const isState    = state !== 'US';
  const context = billText
    ? `Bill text excerpt:\n${billText.slice(0, MAX_TEXT)}`
    : '(Full text unavailable — title only)';

  const prompt = `You are writing a constituent email template for "Lobby for Them", a civic action site focused on animal welfare.

Write a professional, heartfelt email a constituent can send to their ${isState ? `${state} state` : 'US'} representative asking them to support this bill.

Rules:
- Do NOT include a greeting line — start immediately with the first body paragraph
- Do NOT include a sign-off — end after the final paragraph
- Use {{bill_name}} where the bill name should appear
- Use {{user_zip}} where the zip code should appear
- Use {{rep_name}} where the representative's name should appear
- 3 short paragraphs, total ~150 words
- Emotional but respectful and factual

Bill: ${billNumber} (${stateLabel})
Title: ${title}
${context}

Write only the body paragraphs. No greeting, no sign-off, no extra commentary.`;

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-0',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.content[0]?.text?.trim() || null;
  } catch (err) {
    console.warn(`  Claude email_template error: ${err.message}`);
    return null;
  }
}

async function generateStance(billNumber, title, whyItMatters) {
  if (!anthropic) return { stance: null, stance_reason: null };

  const prompt = `You are classifying animal welfare legislation for "Lobby for Them", an advocacy site.

Determine whether the site should urge users to SUPPORT or OPPOSE this bill.
- "support" = bill improves protections or conditions for animals
- "oppose"  = bill weakens protections or harms animal welfare
- "neutral" = impact is unclear or purely procedural

Bill: ${billNumber}
Title: ${title}
${whyItMatters ? `Why it matters:\n${whyItMatters}` : ''}

Respond with a JSON object — nothing else:
{"stance": "support" | "oppose" | "neutral", "stance_reason": "<one sentence>"}`;

  try {
    const res    = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const text    = res.content[0]?.text?.trim() || '';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed  = JSON.parse(cleaned);
    if (!['support', 'oppose', 'neutral'].includes(parsed.stance)) throw new Error('Invalid stance');
    return { stance: parsed.stance, stance_reason: parsed.stance_reason || null };
  } catch (err) {
    console.warn(`  Claude stance error: ${err.message}`);
    return { stance: null, stance_reason: null };
  }
}

// ── Summary counters ──────────────────────────────────────────────────────────

const stats = {
  sessionsChecked:    0,
  statesSkipped:      0,
  billsFoundRaw:      0,
  billsAfterDedup:    0,
  newAdded:           0,
  existingUpdated:    0,
  deactivated:        0,
  errors:             [],
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(70)}`);
console.log(`  sync-active-bills.mjs${DRY_RUN ? '  [DRY RUN]' : ''}`);
console.log(`${'═'.repeat(70)}\n`);

// ── STEP 1: Active sessions ───────────────────────────────────────────────────

console.log('── STEP 1: Fetching active LegiScan sessions\n');

const { activeSessions, skippedStates } = await getActiveSessions();
stats.sessionsChecked = activeSessions.size;
stats.statesSkipped   = skippedStates.size;

console.log(`\n  Active sessions: ${activeSessions.size}`);
console.log(`  States skipped:  ${skippedStates.size}\n`);

// ── STEP 2: Search LegiScan ───────────────────────────────────────────────────

console.log('── STEP 2: Searching LegiScan (all keyword groups)\n');

const rawBillMap = new Map(); // bill_id → basic result

for (const keyword of KEYWORD_GROUPS) {
  process.stdout.write(`  "${keyword}" ... `);
  try {
    const results = await searchLegiScan(keyword);
    let added = 0;
    for (const r of results) {
      if (!rawBillMap.has(r.bill_id)) { rawBillMap.set(r.bill_id, r); added++; }
    }
    console.log(`${results.length} results, ${added} new (total: ${rawBillMap.size})`);
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
    stats.errors.push(`LegiScan search "${keyword}": ${err.message}`);
  }
}

stats.billsFoundRaw = rawBillMap.size;
console.log(`\n  Total unique bill IDs from LegiScan: ${rawBillMap.size}\n`);

// ── STEP 3: Fetch full bill details + filter ──────────────────────────────────

console.log('── STEP 3: Fetching full bill details + filtering\n');

const activeLegiBills = []; // full bill objects that pass all filters
let   fetchCount = 0;

for (const [billId] of rawBillMap) {
  fetchCount++;
  if (fetchCount % 50 === 0) console.log(`  ... ${fetchCount}/${rawBillMap.size}`);

  let bill;
  try {
    bill = await getBillDetails(billId);
  } catch (err) {
    stats.errors.push(`getBill(${billId}): ${err.message}`);
    continue;
  }

  if (!bill) continue;

  // Filter: status must be in KEEP set
  if (!KEEP_STATUSES.has(bill.status)) continue;

  // Filter: session must be active (not sine_die)
  if (!activeSessions.has(bill.session_id)) continue;

  activeLegiBills.push(bill);
}

stats.billsAfterDedup = activeLegiBills.length;
console.log(`\n  Bills passing status + session filter: ${activeLegiBills.length}\n`);

// ── STEP 4: Search Congress.gov ───────────────────────────────────────────────

console.log('── STEP 4: Searching Congress.gov (119th Congress)\n');

const congressBillMap = new Map(); // `${type}-${number}` → bill object

if (!CONGRESS_KEY) {
  console.log('  VITE_CONGRESS_API_KEY not set — skipping Congress.gov search\n');
} else {
  const allCongressKeywords = [...KEYWORD_GROUPS, ...FEDERAL_EXTRA];

  for (const keyword of allCongressKeywords) {
    try {
      const bills = await searchCongressGov(keyword);
      for (const b of bills) {
        if (!b.type || !b.number) continue;
        const key = `${b.type}-${b.number}`;
        if (!congressBillMap.has(key)) congressBillMap.set(key, b);
      }
    } catch (err) {
      stats.errors.push(`Congress.gov search "${keyword}": ${err.message}`);
    }
  }

  // Filter to active bills
  let beforeFilter = congressBillMap.size;
  for (const [key, b] of congressBillMap) {
    if (!congressBillIsActive(b)) congressBillMap.delete(key);
  }

  console.log(`  Federal bills found: ${beforeFilter}, active after filter: ${congressBillMap.size}\n`);
}

// ── STEP 5: Fetch existing Supabase bills ─────────────────────────────────────

console.log('── STEP 5: Syncing with Supabase\n');

const { data: existingBills, error: fetchErr } = await supabase
  .from('featured_bills')
  .select('*');

if (fetchErr) {
  console.error('ERROR fetching existing bills:', fetchErr.message);
  process.exit(1);
}

// Index existing by legiscan_bill_id and by bill-number key for federal
const existingByLegiId = new Map(); // legiscan_bill_id → row
const existingFederal  = new Map(); // formatted bill number (e.g. "H.R. 1477") → row

for (const row of existingBills) {
  if (row.legiscan_bill_id && row.legiscan_bill_id !== 0) {
    existingByLegiId.set(row.legiscan_bill_id, row);
  }
  if (row.state === 'US' && row.custom_title) {
    // Extract bill number from custom_title "(H.R. 1477)" pattern
    const match = row.custom_title.match(/\(([A-Z][\w.\s]+\d+)\)\s*$/);
    if (match) existingFederal.set(match[1].trim(), row);
  }
}

console.log(`  Existing bills in DB: ${existingBills.length}`);
console.log(`  Indexed by LegiScan ID: ${existingByLegiId.size}`);

// Track which DB bills were "seen" in this sync (to determine what to deactivate)
const seenLegiIds    = new Set();
const seenFederalNums = new Set();

// ── STEP 5a: Sync LegiScan bills ─────────────────────────────────────────────

console.log('\n  Syncing LegiScan state/federal bills...\n');

for (const bill of activeLegiBills) {
  const billId    = bill.bill_id;
  const state     = bill.state || 'US';
  const billNum   = bill.bill_number;
  const title     = bill.title || '';
  const existing  = existingByLegiId.get(billId);

  seenLegiIds.add(billId);

  const lastAction     = bill.history?.[bill.history.length - 1]?.action || bill.last_action || '';
  const lastActionDate = bill.history?.[bill.history.length - 1]?.date   || bill.last_action_date || null;

  if (existing) {
    // UPDATE: only overwrite status fields, not AI-generated content
    const updates = {
      urgency:          urgencyFromStatus(bill.status),
      active:           true,
    };

    if (!DRY_RUN) {
      const { error } = await supabase.from('featured_bills').update(updates).eq('id', existing.id);
      if (error) {
        stats.errors.push(`Update ${billNum}: ${error.message}`);
        console.log(`  ✗ Update failed: ${billNum} — ${error.message}`);
      } else {
        stats.existingUpdated++;
      }
    } else {
      stats.existingUpdated++;
    }

  } else {
    // NEW BILL — fetch text, generate AI fields, insert
    console.log(`  + New bill: ${state} ${billNum} — ${truncate(title, 60)}`);

    let billText = null;
    if (bill.texts?.length > 0) {
      const textEntry = bill.texts.find(t => t.mime_id === 2) || bill.texts[0];
      try { billText = await getBillText(textEntry.doc_id); } catch { /* ignore */ }
    }

    const customTitle = `${truncate(title, 80)} (${billNum})`;

    let whyItMatters   = null;
    let emailTemplate  = null;
    let stance         = null;
    let stanceReason   = null;

    if (anthropic) {
      whyItMatters  = await generateWhyItMatters(billNum, title, state, billText);
      emailTemplate = await generateEmailTemplate(billNum, title, state, billText);
      const s       = await generateStance(billNum, customTitle, whyItMatters);
      stance        = s.stance;
      stanceReason  = s.stance_reason;
    }

    const record = {
      legiscan_bill_id: billId,
      state,
      custom_title:     customTitle,
      why_it_matters:   whyItMatters,
      email_subject:    `Please Support ${billNum} — ${truncate(title, 50)}`,
      email_template:   emailTemplate,
      urgency:          urgencyFromStatus(bill.status),
      active:           true,
      stance,
      stance_reason:    stanceReason,
    };

    if (!DRY_RUN) {
      const { error } = await supabase.from('featured_bills').insert(record);
      if (error) {
        stats.errors.push(`Insert ${billNum}: ${error.message}`);
        console.log(`    ✗ Insert failed: ${error.message}`);
      } else {
        stats.newAdded++;
        console.log(`    ✓ Added — stance: ${stance || 'unset'}`);
      }
    } else {
      stats.newAdded++;
      console.log(`    [DRY RUN] Would insert — stance: ${stance || 'unset'}`);
    }
  }
}

// ── STEP 5b: Sync Congress.gov federal bills ──────────────────────────────────

if (congressBillMap.size > 0) {
  console.log('\n  Syncing Congress.gov federal bills...\n');

  for (const [key, b] of congressBillMap) {
    const billNum    = formatCongressBillNumber(b.type, b.number);
    const title      = b.title || '';
    const existing   = existingFederal.get(billNum) || existingByLegiId.get(0); // fallback check
    const matchedRow = existingFederal.get(billNum);

    seenFederalNums.add(billNum);

    if (matchedRow) {
      // UPDATE existing federal bill
      const updates = { active: true, urgency: urgencyFromCongressAction(b) };

      if (!DRY_RUN) {
        const { error } = await supabase.from('featured_bills').update(updates).eq('id', matchedRow.id);
        if (error) {
          stats.errors.push(`Update federal ${billNum}: ${error.message}`);
        } else {
          stats.existingUpdated++;
        }
      } else {
        stats.existingUpdated++;
      }
    } else {
      // NEW federal bill
      console.log(`  + New federal bill: ${billNum} — ${truncate(title, 60)}`);

      const customTitle = `${truncate(title, 80)} (${billNum})`;

      let whyItMatters  = null;
      let emailTemplate = null;
      let stance        = null;
      let stanceReason  = null;

      if (anthropic) {
        whyItMatters  = await generateWhyItMatters(billNum, title, 'US', null);
        emailTemplate = await generateEmailTemplate(billNum, title, 'US', null);
        const s       = await generateStance(billNum, customTitle, whyItMatters);
        stance        = s.stance;
        stanceReason  = s.stance_reason;
      }

      const record = {
        legiscan_bill_id: 0,
        state:            'US',
        custom_title:     customTitle,
        why_it_matters:   whyItMatters,
        email_subject:    `Please Support ${billNum} — ${truncate(title, 50)}`,
        email_template:   emailTemplate,
        urgency:          urgencyFromCongressAction(b),
        active:           true,
        stance,
        stance_reason:    stanceReason,
      };

      if (!DRY_RUN) {
        const { error } = await supabase.from('featured_bills').insert(record);
        if (error) {
          stats.errors.push(`Insert federal ${billNum}: ${error.message}`);
          console.log(`    ✗ Insert failed: ${error.message}`);
        } else {
          stats.newAdded++;
          console.log(`    ✓ Added — stance: ${stance || 'unset'}`);
        }
      } else {
        stats.newAdded++;
        console.log(`    [DRY RUN] Would insert — stance: ${stance || 'unset'}`);
      }
    }
  }
}

// ── STEP 6: Deactivate stale bills ───────────────────────────────────────────

console.log('\n── STEP 6: Deactivating stale bills\n');

for (const row of existingBills) {
  if (!row.active) continue; // already inactive — skip

  const legiId = row.legiscan_bill_id;

  // LegiScan-tracked bills (valid ID, not 0)
  if (legiId && legiId !== 0) {
    if (seenLegiIds.has(legiId)) continue; // still active — skip

    // Determine why it's being deactivated
    let reason = 'not returned by sync';

    // Check if the session is now sine_die
    const inactiveSession = !activeSessions.has(row.session_id);
    if (inactiveSession) reason = 'session ended';

    // Check if status is passed/vetoed/failed
    if (DISCARD_STATUSES.has(row.status)) reason = `status: ${['', '', '', '', 'passed/signed', 'vetoed', 'failed'][row.status] || row.status}`;

    const label = row.custom_title || `Bill #${legiId}`;
    console.log(`  Deactivating: ${label.slice(0, 70)} (${reason})`);

    if (!DRY_RUN) {
      const { error } = await supabase.from('featured_bills').update({ active: false }).eq('id', row.id);
      if (error) {
        stats.errors.push(`Deactivate ${legiId}: ${error.message}`);
        console.log(`    ✗ ${error.message}`);
      } else {
        stats.deactivated++;
      }
    } else {
      stats.deactivated++;
      console.log(`    [DRY RUN] Would deactivate`);
    }
  }

  // Congress.gov-only bills (legiscan_bill_id = 0)
  if (legiId === 0 && row.state === 'US' && row.custom_title) {
    const match = row.custom_title.match(/\(([A-Z][\w.\s]+\d+)\)\s*$/);
    if (!match) continue;
    const billNum = match[1].trim();
    if (seenFederalNums.has(billNum)) continue; // still active

    console.log(`  Deactivating federal: ${row.custom_title?.slice(0, 70)} (not in Congress.gov sync)`);

    if (!DRY_RUN) {
      const { error } = await supabase.from('featured_bills').update({ active: false }).eq('id', row.id);
      if (error) {
        stats.errors.push(`Deactivate federal ${billNum}: ${error.message}`);
      } else {
        stats.deactivated++;
      }
    } else {
      stats.deactivated++;
      console.log(`    [DRY RUN] Would deactivate`);
    }
  }
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log('  SYNC SUMMARY');
console.log(`${'═'.repeat(70)}`);
console.log(`  Sessions checked:                ${stats.sessionsChecked}`);
console.log(`  States skipped (no session):     ${stats.statesSkipped}`);
console.log(`  Bills found in LegiScan (raw):   ${stats.billsFoundRaw}`);
console.log(`  Bills after status+session filter: ${stats.billsAfterDedup}`);
console.log(`  New bills added:                 ${stats.newAdded}`);
console.log(`  Existing bills updated:          ${stats.existingUpdated}`);
console.log(`  Bills deactivated:               ${stats.deactivated}`);
console.log(`  Errors:                          ${stats.errors.length}`);

if (stats.errors.length > 0) {
  console.log('\n  Error details:');
  for (const e of stats.errors) console.log(`    • ${e}`);
}

if (DRY_RUN) console.log('\n  [DRY RUN] — no changes were written to Supabase');

console.log(`\n${'═'.repeat(70)}\n`);
