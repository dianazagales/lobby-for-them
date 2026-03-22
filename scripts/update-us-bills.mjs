import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '../.env'), 'utf8');
const get = key => { const m = env.match(new RegExp(`^${key}=(.+)$`, 'm')); return m ? m[1].trim() : ''; };

const supabase = createClient(get('VITE_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

// ─── STEP 1: Set stance = 'oppose' ───────────────────────────────────────────
const opposeTargets = [
  'H.R. 65',
  'H.R. 91',
  'HB7159',
];

console.log('STEP 1 — Setting stance = oppose for 3 bills...\n');
let opposeSuccess = 0;
let opposeNotFound = [];

for (const bill of opposeTargets) {
  const { data, error } = await supabase
    .from('featured_bills')
    .update({ stance: 'oppose' })
    .eq('state', 'US')
    .ilike('custom_title', `%(${bill})`)
    .select('id, custom_title');

  if (error) {
    console.error(`  ERROR ${bill}: ${error.message}`);
  } else if (!data || data.length === 0) {
    console.log(`  NOT FOUND: ${bill}`);
    opposeNotFound.push(bill);
  } else {
    console.log(`  ✓ stance=oppose: ${bill} → ${data[0].custom_title.substring(0, 70)}`);
    opposeSuccess++;
  }
}

// ─── STEP 2: Deactivate ───────────────────────────────────────────────────────
const deactivateTargets = [
  // Constitutional / Budget / Fiscal
  'H.J.Res. 1', 'H.J.Res. 2', 'H.J.Res. 3', 'H.J.Res. 4', 'H.J.Res. 5',
  'H.J.Res. 6', 'H.J.Res. 7', 'H.J.Res. 8', 'H.J.Res. 9', 'H.J.Res. 10',
  'H.J.Res. 11', 'H.J.Res. 12',
  'H.R. 37', 'H.R. 24', 'H.R. 25', 'H.R. 33', 'H.R. 111', 'H.R. 137',
  'H.R. 113', 'H.R. 143', 'H.R. 146', 'H.R. 182', 'H.R. 82', 'H.R. 140',
  'H.R. 145', 'H.R. 147', 'H.R. 148', 'H.R. 166', 'H.R. 174', 'H.R. 189',
  'H.R. 191', 'H.R. 196', 'H.R. 208', 'H.R. 53', 'H.R. 52',
  // Elections / Voting
  'H.R. 154', 'H.Res. 11', 'H.Res. 20', 'H.R. 151', 'H.R. 155', 'H.R. 156',
  'H.R. 160', 'H.Res. 8', 'H.R. 126', 'H.R. 55', 'H.R. 58',
  // Immigration / Border
  'H.R. 30', 'H.R. 32', 'H.R. 57', 'H.R. 61', 'H.R. 76', 'H.R. 103',
  'H.R. 116', 'H.R. 163', 'H.R. 175', 'H.R. 176', 'H.R. 190', 'H.R. 205',
  // Abortion / Reproductive Rights
  'H.R. 21', 'H.R. 49', 'H.R. 73', 'H.R. 78', 'H.R. 48', 'H.R. 211',
  'HB999', 'HR938',
  // Veterans / Military Health
  'H.R. 72', 'H.R. 109', 'H.R. 136', 'H.R. 210', 'H.R. 219', 'H.R. 71',
  // Healthcare (non-animal)
  'H.R. 44', 'H.R. 81', 'H.R. 87', 'H.R. 88', 'H.R. 89', 'H.R. 90',
  'H.R. 114', 'H.R. 119', 'H.R. 120', 'H.R. 124', 'H.R. 127', 'H.R. 138',
  'H.Res. 7', 'H.Res. 10', 'HB7050',
  // Guns / Weapons
  'H.R. 60', 'H.R. 70', 'H.R. 129', 'H.R. 169', 'H.R. 221',
  // Foreign Policy
  'H.Con.Res. 2', 'H.R. 93', 'H.R. 94', 'H.Res. 9', 'H.Res. 15',
  'H.Res. 16', 'HR1130', 'HB5248', 'SB2184',
  // Drug Policy
  'H.R. 27', 'H.R. 128', 'SB3474',
  // Housing / Infrastructure / Transportation
  'H.R. 46', 'H.R. 68', 'H.R. 75', 'H.R. 115', 'H.R. 171', 'H.R. 173',
  'H.R. 206', 'H.R. 213', 'HB4669', 'HB6644', 'HB4626',
  // Labor / Employment / Business
  'H.R. 85', 'H.R. 100', 'H.R. 107', 'H.R. 110', 'H.R. 193', 'SB3865', 'HB1768',
  // Government / Regulatory / Law Enforcement
  'H.R. 31', 'H.R. 35', 'H.R. 56', 'H.R. 59', 'H.R. 67', 'H.R. 77',
  'H.R. 80', 'H.R. 95', 'H.R. 97', 'H.R. 98', 'H.R. 99', 'H.R. 101',
  'H.R. 108', 'H.R. 117', 'H.R. 118', 'H.R. 125', 'H.R. 134', 'H.R. 142',
  'H.R. 144', 'H.R. 152', 'H.R. 153', 'H.R. 157', 'H.R. 158', 'H.R. 159',
  'H.R. 162', 'H.R. 167', 'H.R. 170', 'H.R. 183', 'H.R. 185', 'H.R. 199',
  'H.R. 200', 'H.R. 201', 'H.R. 202', 'H.Res. 12', 'H.R. 66', 'H.R. 69',
  'H.R. 112',
  // Energy (non-wildlife)
  'H.R. 26', 'H.R. 92', 'H.R. 133', 'H.R. 161', 'H.R. 132',
  // Education
  'H.R. 83', 'H.R. 84', 'HB5304',
  // Commemorative / Recognition
  'H.R. 39', 'H.R. 41', 'H.R. 186', 'H.R. 212', 'H.R. 214', 'H.R. 51',
  'H.R. 40', 'HB2256', 'HB429', 'HR740', 'H.R. 139',
  // Appropriations (no animal welfare content)
  'HB4553', 'HB5166', 'HB5342', 'HB7006', 'SB3290',
  // Unknown / AI refused / generic filler
  'H.R. 45', 'H.R. 47', 'H.R. 50', 'H.R. 62', 'H.R. 63', 'H.R. 74',
  'H.R. 86', 'H.R. 106', 'H.R. 122', 'H.R. 130', 'H.R. 150', 'H.R. 164',
  'H.R. 168', 'H.R. 184', 'H.R. 194', 'H.R. 198', 'H.R. 203', 'H.R. 209',
  'H.R. 34', 'SB2296', 'SB2838', 'HB3838', 'HB7567', 'HB2372', 'HB2472',
  'H.R. 192',
  // Borderline — confirmed remove
  'H.R. 64', 'H.R. 102', 'H.R. 104', 'H.R. 105', 'H.R. 141', 'H.R. 149',
  'H.R. 177', 'H.R. 179', 'H.R. 204', 'H.R. 215', 'SB800', 'SB1507',
  'SB3994', 'HB928', 'HB971', 'HB3076', 'HB4113', 'HB4779', 'HB7662',
];

// Safety check: never deactivate the protected bills
const protected_bills = new Set(['H.R. 65', 'H.R. 91', 'HB7159', 'HB4754', 'SB1462']);
const safeTargets = deactivateTargets.filter(b => !protected_bills.has(b));

console.log(`\nSTEP 2 — Deactivating ${safeTargets.length} bills...\n`);
let deactivated = 0;
let notFound = [];

for (const bill of safeTargets) {
  const { data, error } = await supabase
    .from('featured_bills')
    .update({ active: false })
    .eq('state', 'US')
    .ilike('custom_title', `%(${bill})`)
    .select('id, custom_title');

  if (error) {
    console.error(`  ERROR ${bill}: ${error.message}`);
  } else if (!data || data.length === 0) {
    console.log(`  NOT FOUND: ${bill}`);
    notFound.push(bill);
  } else {
    console.log(`  ✓ ${bill}`);
    deactivated++;
  }
}

console.log('\n══════════════════════════════════════');
console.log('STEP 1 — Stance = oppose:');
console.log(`  ✓ Updated: ${opposeSuccess}/3`);
if (opposeNotFound.length) console.log(`  ✗ Not found: ${opposeNotFound.join(', ')}`);

console.log('\nSTEP 2 — Deactivated:');
console.log(`  ✓ Deactivated: ${deactivated}/${safeTargets.length}`);
console.log(`  ✗ Not found:   ${notFound.length}`);
if (notFound.length) console.log(`  Not found list: ${notFound.join(', ')}`);
