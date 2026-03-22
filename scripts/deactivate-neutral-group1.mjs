import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '../.env'), 'utf8');
const get = key => { const m = env.match(new RegExp(`^${key}=(.+)$`, 'm')); return m ? m[1].trim() : ''; };

const supabase = createClient(get('VITE_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

const targets = [
  // Alabama
  { state: 'AL', bill: 'HB257' },
  { state: 'AL', bill: 'SB203' },
  // Arizona
  { state: 'AZ', bill: 'HB2529' },
  { state: 'AZ', bill: 'SB1084' },
  { state: 'AZ', bill: 'SB1515' },
  // California
  { state: 'CA', bill: 'AB1126' },
  { state: 'CA', bill: 'AB1999' },
  { state: 'CA', bill: 'AB2249' },
  { state: 'CA', bill: 'AB2302' },
  { state: 'CA', bill: 'SB898' },
  { state: 'CA', bill: 'AB2478' },
  { state: 'CA', bill: 'SB667' },
  { state: 'CA', bill: 'SB1341' },
  // Connecticut
  { state: 'CT', bill: 'SB00193' },
  { state: 'CT', bill: 'SB00412' },
  { state: 'CT', bill: 'SB00278' },
  // Delaware
  { state: 'DE', bill: 'SB30' },
  // Florida
  { state: 'FL', bill: 'S1450' },
  { state: 'FL', bill: 'S0156' },
  { state: 'FL', bill: 'S1092' },
  // Georgia
  { state: 'GA', bill: 'HB1409' },
  { state: 'GA', bill: 'HB1275' },
  // Hawaii
  { state: 'HI', bill: 'SB3225' },
  { state: 'HI', bill: 'HB1438' },
  { state: 'HI', bill: 'HB222' },
  // Illinois
  { state: 'IL', bill: 'HB3959' },
  { state: 'IL', bill: 'HB1404' },
  { state: 'IL', bill: 'HB3424' },
  { state: 'IL', bill: 'SB1358' },
  { state: 'IL', bill: 'HB5693' },
  { state: 'IL', bill: 'HB1045' },
  { state: 'IL', bill: 'SB4160' },
  { state: 'IL', bill: 'HB3958' },
  { state: 'IL', bill: 'HB5452' },
  { state: 'IL', bill: 'SB2614' },
  { state: 'IL', bill: 'SB3137' },
  { state: 'IL', bill: 'SB2613' },
  { state: 'IL', bill: 'HB5181' },
  // Kansas
  { state: 'KS', bill: 'HB2434' },
  { state: 'KS', bill: 'SB315' },
  { state: 'KS', bill: 'SB260' },
  { state: 'KS', bill: 'HB2290' },
  // Kentucky
  { state: 'KY', bill: 'HB540' },
  { state: 'KY', bill: 'HB162' },
  { state: 'KY', bill: 'SB291' },
  { state: 'KY', bill: 'HB896' },
  { state: 'KY', bill: 'HB684' },
  // Massachusetts
  { state: 'MA', bill: 'H3177' },
  { state: 'MA', bill: 'S298' },
  { state: 'MA', bill: 'S235' },
  { state: 'MA', bill: 'H4601' },
  { state: 'MA', bill: 'S2525' },
  { state: 'MA', bill: 'H4000' },
  { state: 'MA', bill: 'H4001' },
  // Maryland
  { state: 'MD', bill: 'HB555' },
  { state: 'MD', bill: 'HB209' },
  // Maine
  { state: 'ME', bill: 'LD1416' },
  // Michigan
  { state: 'MI', bill: 'SB0304' },
  // Minnesota
  { state: 'MN', bill: 'HF4382' },
  { state: 'MN', bill: 'SF2438' },
  { state: 'MN', bill: 'SF2706' },
  { state: 'MN', bill: 'HF2037' },
  { state: 'MN', bill: 'HF2187' },
  { state: 'MN', bill: 'SF4399' },
  { state: 'MN', bill: 'HF2434' },
  { state: 'MN', bill: 'HF4354' },
  { state: 'MN', bill: 'SF2902' },
  { state: 'MN', bill: 'SF4324' },
  { state: 'MN', bill: 'SF4403' },
  { state: 'MN', bill: 'HF4199' },
  { state: 'MN', bill: 'SF626' },   // Actually human services (from Group 3 note)
  { state: 'MN', bill: 'SF2443' },  // Actually human services (from Group 3 note)
  { state: 'MN', bill: 'SF3054' },  // Actually human services (from Group 3 note)
  // Missouri
  { state: 'MO', bill: 'HB1853' },
  { state: 'MO', bill: 'HB2902' },
  { state: 'MO', bill: 'SB1534' },
  { state: 'MO', bill: 'HB2572' },
  { state: 'MO', bill: 'HB3286' },
  { state: 'MO', bill: 'SB1214' },
  { state: 'MO', bill: 'SB1560' },
  { state: 'MO', bill: 'HB2273' },
  { state: 'MO', bill: 'SB893' },
  { state: 'MO', bill: 'HB3063' },
  { state: 'MO', bill: 'HB2641' },
  // Mississippi
  { state: 'MS', bill: 'HB4060' },
  // North Carolina
  { state: 'NC', bill: 'S220' },
  // North Dakota
  { state: 'ND', bill: 'HB1541' },
  // Nebraska
  { state: 'NE', bill: 'LB1169' },
  { state: 'NE', bill: 'LB316' },
  { state: 'NE', bill: 'LB322' },
  { state: 'NE', bill: 'LB535' },
  // New Hampshire
  { state: 'NH', bill: 'SB410' },
  // New Jersey
  { state: 'NJ', bill: 'S2790' },
  { state: 'NJ', bill: 'A4158' },
  { state: 'NJ', bill: 'A2609' },
  { state: 'NJ', bill: 'A1538' },
  { state: 'NJ', bill: 'A4514' },
  { state: 'NJ', bill: 'A612' },
  // New Mexico
  { state: 'NM', bill: 'SB221' },
  // New York
  { state: 'NY', bill: 'S08499' },
  // Ohio
  { state: 'OH', bill: 'HB88' },
  { state: 'OH', bill: 'SB197' },
  { state: 'OH', bill: 'SB230' },
  { state: 'OH', bill: 'HB348' },
  { state: 'OH', bill: 'SB282' },
  { state: 'OH', bill: 'HB495' },
  { state: 'OH', bill: 'HB198' },
  { state: 'OH', bill: 'HB760' },
  { state: 'OH', bill: 'SB346' },
  { state: 'OH', bill: 'SB85' },
  // Ohio specialty license plates
  { state: 'OH', bill: 'HB618' },
  { state: 'OH', bill: 'SB228' },
  { state: 'OH', bill: 'HB381' },
  { state: 'OH', bill: 'SB339' },
  { state: 'OH', bill: 'HB378' },
  { state: 'OH', bill: 'HB555' },
  { state: 'OH', bill: 'SB221' },
  { state: 'OH', bill: 'HB419' },
  { state: 'OH', bill: 'SB189' },
  { state: 'OH', bill: 'SB212' },
  { state: 'OH', bill: 'HB310' },
  { state: 'OH', bill: 'HB403' },
  // Oklahoma
  { state: 'OK', bill: 'SB604' },
  { state: 'OK', bill: 'HB4227' },
  { state: 'OK', bill: 'HB2028' },
  { state: 'OK', bill: 'SB2184' },
  { state: 'OK', bill: 'HB1406' },
  { state: 'OK', bill: 'SB1877' },
  { state: 'OK', bill: 'SB529' },
  { state: 'OK', bill: 'SB1400' },
  { state: 'OK', bill: 'HB3982' },
  { state: 'OK', bill: 'HB3258' },
  { state: 'OK', bill: 'SB91' },
  { state: 'OK', bill: 'SB2011' },
  { state: 'OK', bill: 'HB4104' },
  { state: 'OK', bill: 'HB3055' },
  { state: 'OK', bill: 'HB3661' },
  { state: 'OK', bill: 'HB1864' },
  // Pennsylvania
  { state: 'PA', bill: 'HB561' },
  { state: 'PA', bill: 'HB1933' },
  // Rhode Island
  { state: 'RI', bill: 'H7966' },
  // South Carolina
  { state: 'SC', bill: 'H4189' },
  { state: 'SC', bill: 'H5044' },
  { state: 'SC', bill: 'H4381' },
  { state: 'SC', bill: 'H3046' },
  // South Dakota
  { state: 'SD', bill: 'HB1257' },
  { state: 'SD', bill: 'HB1139' },
  // Tennessee
  { state: 'TN', bill: 'HB1545' },
  // Texas
  { state: 'TX', bill: 'SB2375' },
  { state: 'TX', bill: 'HB443' },
  { state: 'TX', bill: 'HB1552' },
  { state: 'TX', bill: 'HB4811' },
  { state: 'TX', bill: 'SB988' },
  { state: 'TX', bill: 'HB2385' },
  { state: 'TX', bill: 'HB3962' },
  // Federal
  { state: 'US', bill: 'HB2934' },
  { state: 'US', bill: 'H.R. 195' },
  // Utah
  { state: 'UT', bill: 'HB0301' },
  { state: 'UT', bill: 'HB0114' },
  { state: 'UT', bill: 'SB0162' },
  { state: 'UT', bill: 'HB0381' },
  { state: 'UT', bill: 'HB0454' },
  { state: 'UT', bill: 'HB0575' },
  { state: 'UT', bill: 'HB0221' },
  // Virginia
  { state: 'VA', bill: 'HB629' },
  { state: 'VA', bill: 'HB563' },
  { state: 'VA', bill: 'SB362' },
  // Washington
  { state: 'WA', bill: 'SB6362' },
  { state: 'WA', bill: 'HB1360' },
  { state: 'WA', bill: 'HB1452' },
  { state: 'WA', bill: 'HB1407' },
  { state: 'WA', bill: 'HB2310' },
  { state: 'WA', bill: 'HB2403' },
  { state: 'WA', bill: 'HB2489' },
  { state: 'WA', bill: 'HB1180' },
  { state: 'WA', bill: 'HB1954' },
  { state: 'WA', bill: 'SB5227' },
  { state: 'WA', bill: 'SB6070' },
  { state: 'WA', bill: 'HB2502' },
  // West Virginia
  { state: 'WV', bill: 'HB4184' },
  { state: 'WV', bill: 'HB5114' },
  { state: 'WV', bill: 'HB4555' },
  { state: 'WV', bill: 'HB4527' },
  { state: 'WV', bill: 'HB4180' },
  { state: 'WV', bill: 'SB970' },
  { state: 'WV', bill: 'HB4349' },
  { state: 'WV', bill: 'HB4089' },
];

console.log(`Deactivating ${targets.length} GROUP 1 bills...\n`);
let deactivated = 0;
let notFound = [];

for (const { state, bill } of targets) {
  const { data, error } = await supabase
    .from('featured_bills')
    .update({ active: false })
    .eq('state', state)
    .ilike('custom_title', `%(${bill})`)
    .select('id, custom_title');

  if (error) {
    console.error(`  ERROR ${state} ${bill}: ${error.message}`);
  } else if (!data || data.length === 0) {
    console.log(`  NOT FOUND: ${state} ${bill}`);
    notFound.push(`${state} ${bill}`);
  } else {
    console.log(`  ✓ ${state} ${bill}`);
    deactivated++;
  }
}

console.log('\n══════════════════════════════════════');
console.log(`✓ Deactivated: ${deactivated}/${targets.length}`);
console.log(`✗ Not found:   ${notFound.length}`);
if (notFound.length) console.log(`  Not found: ${notFound.join(', ')}`);
