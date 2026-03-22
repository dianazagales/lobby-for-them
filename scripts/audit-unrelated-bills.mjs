import { createClient } from '/Users/dianazagales/Documents/Claude Code/lobby-for-them/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';

// Parse .env manually
const envPath = '/Users/dianazagales/Documents/Claude Code/lobby-for-them/.env';
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  env[key] = value;
}

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_ANON_KEY = env['VITE_SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fetch ALL bills with pagination
async function fetchAllBills() {
  const allBills = [];
  const pageSize = 1000;
  let start = 0;
  let keepGoing = true;

  while (keepGoing) {
    const { data, error } = await supabase
      .from('featured_bills')
      .select('id, legiscan_bill_id, state, custom_title, why_it_matters')
      .range(start, start + pageSize - 1);

    if (error) {
      console.error('Error fetching bills:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      keepGoing = false;
    } else {
      allBills.push(...data);
      if (data.length < pageSize) {
        keepGoing = false;
      } else {
        start += pageSize;
      }
    }
  }

  return allBills;
}

// ─── PROTECTIVE PATTERNS ──────────────────────────────────────────────────────
// If why_it_matters contains any of these, the bill is probably animal-related
// and should NOT be flagged (unless it hits a hard-override flag below).
const whyAnimalPatterns = [
  /\banimals?\b/i,
  /\bpets?\b/i,
  /\bwildlife\b/i,
  /\bveterinar/i,
  /\blivestock\b/i,
  /\bfarm animals?\b/i,
  /\bhumane\b/i,
  /\bcruelty\b/i,
  /\bdog(s|fighting)?\b/i,
  /\bcat(s|fight)?\b/i,
  /\bcanine\b/i,
  /\bfeline\b/i,
  /\bequine\b/i,
  /\bhorse(s|back)?\b/i,
  /\bgreyhound\b/i,
  /\bpuppy\b/i,
  /\bpuppies\b/i,
  /\bkittens?\b/i,
  /\bpoultry\b/i,
  /\bchickens?\b/i,
  /\bpigs?\b/i,
  /\bhogs?\b/i,
  /\bcows?\b/i,
  /\bbovine\b/i,
  /\bswine\b/i,
  /\bsheep\b/i,
  /\bgoats?\b/i,
  /\bfish\b/i,
  /\baquatic\b/i,
  /\bmammals?\b/i,
  /\bbears?\b/i,
  /\bdeer\b/i,
  /\bwolf\b/i,
  /\bwolves\b/i,
  /\bbird(s|flu)?\b/i,
  /\bavian\b/i,
  /\bwaterfowl\b/i,
  /\bspecies\b/i,
  /\bhabitat\b/i,
  /\brendangered\b/i,
  /\bspay\b/i,
  /\bneuter\b/i,
  /\bshelter\b/i,
  /\bbreeder\b/i,
  /\bpuppy mill\b/i,
  /\bslaughter\b/i,
  /\bgestation crate\b/i,
  /\bbattery cage\b/i,
  /\banimal testing\b/i,
  /\banimal research\b/i,
  /\bservice animal\b/i,
  /\banimal welfare\b/i,
  /\banimal rights\b/i,
  /\banimal control\b/i,
  /\bpet store\b/i,
  /\bdog racing\b/i,
  /\bhorse racing\b/i,
  /\bgreyhound racing\b/i,
  /\bcockfight\b/i,
  /\bdog fight\b/i,
  /\bconservation\b/i,
  /\becosystem\b/i,
  /\bnatural resource\b/i,
];

// ─── HARD-OVERRIDE FLAGS ──────────────────────────────────────────────────────
// These are SO clearly unrelated that even animal-related why_it_matters
// text should not save them. Check title only.
// Returns the matched keyword string, or null.
function hardOverrideFlag(titleText) {
  const hardRules = [
    { pattern: /\bsecond amendment\b/i, reason: '"Second Amendment"' },
    { pattern: /\badult cabaret\b/i, reason: '"adult cabaret"' },
    { pattern: /\bsexually oriented business/i, reason: '"sexually oriented business"' },
    { pattern: /\bstrip club\b/i, reason: '"strip club"' },
    { pattern: /\bchild sex doll\b/i, reason: '"child sex doll"' },
    { pattern: /\bsex doll\b/i, reason: '"sex doll"' },
    { pattern: /\bvaccine passport\b/i, reason: '"vaccine passport"' },
    { pattern: /\bvaccine mandate\b/i, reason: '"vaccine mandate"' },
    { pattern: /\bWHO withdrawal\b/i, reason: '"WHO withdrawal"' },
    { pattern: /\bWorld Health Organization withdrawal\b/i, reason: '"World Health Organization withdrawal"' },
    { pattern: /\bNo Vaccine\b/i, reason: '"No Vaccine"' },
    { pattern: /\bFreedom from Mandates\b/i, reason: '"Freedom from Mandates"' },
    { pattern: /\bDefund Heroin\b/i, reason: '"Defund Heroin"' },
    { pattern: /\bheroin injection center\b/i, reason: '"heroin injection center"' },
    { pattern: /\bAid to Localities Budget\b/i, reason: '"Aid to Localities Budget"' },
    { pattern: /\bsupport of government\b/i, reason: '"support of government"' },
    { pattern: /\boperating appropriations\b/i, reason: '"operating appropriations"' },
    { pattern: /\bcapital improvements? budget\b/i, reason: '"capital improvements budget"' },
    { pattern: /\bconstitution(al)? amendment\b/i, reason: '"Constitution amendment"' },
    { pattern: /\bamend(ing)? the (state |us |united states )?constitution\b/i, reason: 'amending the Constitution' },
    { pattern: /\bprostitution\b/i, reason: '"prostitution"' },
  ];

  for (const rule of hardRules) {
    if (rule.pattern.test(titleText)) {
      return rule.reason;
    }
  }
  return null;
}

// ─── TITLE FLAG RULES ─────────────────────────────────────────────────────────
// Each entry: { pattern, reason, exceptions[] }
// If title matches pattern AND none of the exception patterns match the title,
// flag the bill (unless why_it_matters has animal content — checked separately).
const titleFlagRules = [
  // Appropriations / budget
  {
    reason: 'Appropriations/budget bill',
    patterns: [
      /\bappropriat(ion|ions|ing)\b/i,
      /\bcapital budget\b/i,
      /\bsupplement(al)? appropriat/i,
      /\boperating budget\b/i,
      /\bgeneral appropriations?\b/i,
      /\bstate budget\b/i,
      /\bfederal budget\b/i,
      /\baid to localities\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bwildlife\b/i, /\bfarm\b/i, /\blivestock\b/i],
  },
  // Firearms / guns / Second Amendment
  {
    reason: 'Firearms/gun/Second Amendment bill',
    patterns: [
      /\bfirearm(s)?\b/i,
      /\bgun(s)?\b/i,
      /\bammunition\b/i,
      /\bsecond amendment\b/i,
      /\bconcealed carry\b/i,
      /\bopen carry\b/i,
      /\bcarry a concealed\b/i,
      /\bhandgun(s)?\b/i,
      /\brifle(s)?\b/i,
      /\bshotgun(s)?\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bhunting\b/i, /\bwildlife\b/i],
  },
  // Gambling — but NOT horse/greyhound/dog racing
  {
    reason: 'Gambling/casino/lottery bill (not animal racing)',
    patterns: [
      /\bgambling\b/i,
      /\bcasino(s)?\b/i,
      /\blottery\b/i,
      /\bwagering\b/i,
      /\bsports betting\b/i,
      /\bslot machine(s)?\b/i,
    ],
    exceptions: [/\bhorse\b/i, /\bgreyhound\b/i, /\bdog racing\b/i, /\banimal\b/i, /\bracing\b/i],
  },
  // Pari-mutuel ONLY if not about animal racing
  {
    reason: 'Pari-mutuel wagering (non-animal context)',
    patterns: [/\bpari-mutuel\b/i],
    exceptions: [/\bhorse\b/i, /\bgreyhound\b/i, /\bdog racing\b/i, /\banimal\b/i],
  },
  // Human trafficking / sex trafficking
  {
    reason: 'Human trafficking / sex trafficking bill',
    patterns: [
      /\bhuman trafficking\b/i,
      /\bsex trafficking\b/i,
    ],
    exceptions: [],
  },
  // Drug trafficking, opioids, narcotics
  {
    reason: 'Drug trafficking/opioid/narcotic bill',
    patterns: [
      /\bfentanyl\b/i,
      /\bheroin\b/i,
      /\bopioid(s)?\b/i,
      /\bnarcotic(s)?\b/i,
      /\bdrug trafficking\b/i,
      /\bmethamphetamine\b/i,
      /\bcocaine\b/i,
      /\bsubstance abuse\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bveterinar\b/i, /\blivestock\b/i],
  },
  // Adult cabaret / sexually oriented businesses
  {
    reason: 'Adult cabaret/sexually oriented business bill',
    patterns: [
      /\badult cabaret\b/i,
      /\bsexually oriented\b/i,
      /\bstrip club\b/i,
      /\bprostitution\b/i,
    ],
    exceptions: [],
  },
  // Child sex / sex doll
  {
    reason: 'Child sex / sex doll bill',
    patterns: [
      /\bchild sex\b/i,
      /\bsex doll(s)?\b/i,
    ],
    exceptions: [],
  },
  // Vaccine passports / mandates (human) — but NOT animal vaccines
  {
    reason: 'Vaccine passport/mandate bill (human)',
    patterns: [
      /\bvaccine passport\b/i,
      /\bvaccine mandate\b/i,
      /\bno vaccine\b/i,
      /\bfreedom from mandates?\b/i,
      /\bimmunization mandate\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bveterinar\b/i, /\blivestock\b/i, /\bpet(s)?\b/i],
  },
  // WHO / World Health Organization withdrawal
  {
    reason: 'WHO withdrawal / international health organization bill',
    patterns: [
      /\bWHO withdrawal\b/i,
      /\bWorld Health Organization\b/i,
    ],
    exceptions: [],
  },
  // Constitution amendments (unrelated to animals)
  {
    reason: 'Constitutional amendment resolution (non-animal)',
    patterns: [
      /\bconstitution(al)?\s+amendment\b/i,
      /\bamend(ing)?\s+the\s+(state\s+|us\s+|united states\s+)?constitution\b/i,
      /\bconstitutional convention\b/i,
    ],
    exceptions: [/\banimal(s)?\b/i, /\bwildlife\b/i, /\bfarm\b/i],
  },
  // Elections / voting / ballot
  {
    reason: 'Election/voting/ballot bill',
    patterns: [
      /\belection(s)?\b/i,
      /\bvoting\b/i,
      /\bvoter(s)?\b/i,
      /\bballot(s)?\b/i,
      /\bgerrymandering\b/i,
      /\bcamp(aign)? finance\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bwildlife\b/i],
  },
  // Immigration / sanctuary
  {
    reason: 'Immigration/sanctuary bill',
    patterns: [
      /\bimmigration\b/i,
      /\bimmigrant(s)?\b/i,
      /\bsanctuary city\b/i,
      /\bsanctuary state\b/i,
      /\bdeportation\b/i,
      /\basylum seeker\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bwildlife\b/i],
  },
  // Broadband / telecommunications
  {
    reason: 'Broadband/telecommunications bill',
    patterns: [
      /\bbroadband\b/i,
      /\btelecommunication(s)?\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bwildlife\b/i],
  },
  // Motor vehicle / traffic (but NOT animal transport)
  {
    reason: 'Motor vehicle/traffic bill (not animal transport)',
    patterns: [
      /\bmotor vehicle(s)?\b/i,
      /\btraffic (law|safety|violation|code|ticket)\b/i,
      /\bdrunk driving\b/i,
      /\bdriving under the influence\b/i,
      /\bspeed limit\b/i,
      /\bseatbelt\b/i,
      /\bdriver(s)? licens/i,
    ],
    exceptions: [/\banimal\b/i, /\blivestock\b/i, /\btransport(ing)? animal/i, /\bhorse\b/i],
  },
  // Eminent domain (unless farmland)
  {
    reason: 'Eminent domain bill (not farmland)',
    patterns: [/\beminent domain\b/i],
    exceptions: [/\bfarm(land)?\b/i, /\bagricultur\b/i, /\banimal\b/i, /\blivestock\b/i],
  },
  // Racially / civil rights (human)
  {
    reason: 'Racial/civil rights bill (human)',
    patterns: [
      /\bracially\b/i,
      /\bracial (discriminat|equity|justice|bias)\b/i,
      /\bcivil rights\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bwildlife\b/i],
  },
  // Workforce / labor / wage (no farm + animal)
  {
    reason: 'Workforce/labor/wage bill (no farm-animal component)',
    patterns: [
      /\bworkforce development\b/i,
      /\blabor law\b/i,
      /\bminimum wage\b/i,
      /\bwage theft\b/i,
      /\bcollective bargaining\b/i,
      /\bworkers.{0,5}compensation\b/i,
    ],
    exceptions: [/\bfarm worker\b/i, /\banimal\b/i, /\bagricultur\b/i],
  },
  // Sex offender
  {
    reason: 'Sex offender registry/law bill',
    patterns: [
      /\bsex offender(s)?\b/i,
      /\bsexual predator\b/i,
      /\bsex offend\b/i,
    ],
    exceptions: [],
  },
  // General criminal law (specific unrelated crimes)
  {
    reason: 'Criminal law bill (unrelated to animals)',
    patterns: [
      /\bhomicide\b/i,
      /\bmurder\b/i,
      /\bmanslaughter\b/i,
      /\bburglary\b/i,
      /\bterrorism\b/i,
      /\bhate crime(s)?\b/i,
      /\bkidnapping\b/i,
    ],
    exceptions: [/\banimal\b/i],
  },
  // Human healthcare / medicine (no animal angle)
  {
    reason: 'Human healthcare/medicine bill (no animal component)',
    patterns: [
      /\bmedicaid\b/i,
      /\bmedicare\b/i,
      /\bhealth insurance\b/i,
      /\bmental health\b/i,
      /\babortion\b/i,
      /\breproductive health\b/i,
      /\bnursing home\b/i,
      /\btelemedicine\b/i,
      /\bchildbirth\b/i,
      /\bmaternity\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bveterinar\b/i, /\blivestock\b/i],
  },
  // Real estate / housing (no farm/animal angle)
  {
    reason: 'Real estate/housing/zoning bill (no farm-animal component)',
    patterns: [
      /\bzoning\b/i,
      /\beviction(s)?\b/i,
      /\bforeclosure(s)?\b/i,
      /\bmortgage(s)?\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bfarm\b/i, /\bagricultur\b/i, /\blivestock\b/i],
  },
  // General appropriations / budget titles
  {
    reason: 'General budget/appropriations bill',
    patterns: [
      /\baid to localities budget\b/i,
      /\bsupport of government\b/i,
      /\boperating appropriations?\b/i,
      /\bcapital improvements? budget\b/i,
    ],
    exceptions: [],
  },
  // Honoring resolutions (non-animal)
  {
    reason: 'Non-animal resolution/proclamation',
    patterns: [
      /\bhonoring\b/i,
      /\bcongratulating\b/i,
      /\bcommemorating\b/i,
      /\bdeclaring.{0,30}month\b/i,
      /\bexpressing.{0,30}support\b/i,
      /\bproclaiming\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bwildlife\b/i, /\bpet(s)?\b/i, /\bhumane\b/i, /\bveterinar\b/i],
  },
  // Education (no animal component)
  {
    reason: 'Education bill (no animal component)',
    patterns: [
      /\bschool district\b/i,
      /\bcharter school\b/i,
      /\bpublic school(s)?\b/i,
      /\bstudent loan(s)?\b/i,
      /\bhigher education\b/i,
    ],
    exceptions: [/\banimal\b/i, /\bwildlife\b/i],
  },
];

// ─── MAIN CHECK FUNCTION ──────────────────────────────────────────────────────
function checkBillRelevance(bill) {
  const titleText = bill.custom_title || '';
  const whyText = bill.why_it_matters || '';

  // Step 1: check if why_it_matters has clear animal welfare content
  const whyHasAnimal = whyAnimalPatterns.some(p => p.test(whyText));

  // Step 2: hard override — these keywords in the title flag regardless of why_it_matters
  const hardReason = hardOverrideFlag(titleText);
  if (hardReason) {
    return `HARD FLAG — title contains ${hardReason}`;
  }

  // Step 3: if why_it_matters clearly describes animal welfare, trust it and skip further checks
  if (whyHasAnimal) {
    return null; // Bill is animal-related per description — keep it
  }

  // Step 4: title-based flag rules
  for (const rule of titleFlagRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(titleText)) {
        // Check exceptions against title
        const exceptionHit = rule.exceptions.some(ex => ex.test(titleText));
        if (!exceptionHit) {
          return `${rule.reason} — matched: "${titleText.match(pattern)?.[0]}"`;
        }
      }
    }
  }

  // Step 5: no animal keywords in title AND no animal content in why_it_matters — flag as suspicious
  const titleHasAnimal = whyAnimalPatterns.some(p => p.test(titleText));
  if (!titleHasAnimal) {
    return 'No animal welfare keywords found in title or description';
  }

  return null; // Looks animal-related based on title
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching all bills from featured_bills table...\n');
  const bills = await fetchAllBills();
  console.log(`Total bills fetched: ${bills.length}\n`);

  const flagged = [];
  for (const bill of bills) {
    const reason = checkBillRelevance(bill);
    if (reason) {
      flagged.push({ ...bill, flagReason: reason });
    }
  }

  // Group by state alphabetical
  const byState = {};
  for (const bill of flagged) {
    const st = bill.state || 'UNKNOWN';
    if (!byState[st]) byState[st] = [];
    byState[st].push(bill);
  }

  const sortedStates = Object.keys(byState).sort();

  console.log('=== FLAGGED BILLS (possibly unrelated to animal welfare) ===\n');

  for (const state of sortedStates) {
    const stateBills = byState[state];
    for (const bill of stateBills) {
      const billNumMatch = (bill.custom_title || '').match(/\(([A-Z0-9\.\-]+)\)\s*$/);
      const billNum = billNumMatch ? billNumMatch[1] : `LegiScan ID: ${bill.legiscan_bill_id}`;
      console.log(`State: ${state}`);
      console.log(`Bill Number: ${billNum}`);
      console.log(`Title: ${bill.custom_title}`);
      console.log(`Reason flagged: ${bill.flagReason}`);
      console.log('---');
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total bills examined: ${bills.length}`);
  console.log(`Total bills flagged: ${flagged.length}`);

  // Breakdown by reason category
  const reasonCounts = {};
  for (const bill of flagged) {
    // Extract the category portion before ' — matched:'
    const category = bill.flagReason.split(' — ')[0];
    reasonCounts[category] = (reasonCounts[category] || 0) + 1;
  }
  console.log('\nBreakdown by reason:');
  const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of sortedReasons) {
    console.log(`  ${count.toString().padStart(4)}  ${reason}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
