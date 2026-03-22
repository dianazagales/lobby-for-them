import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '../.env'), 'utf8');
const get = k => { const m = env.match(new RegExp(`^${k}=(.+)$`, 'm')); return m ? m[1].trim() : ''; };
const supabase = createClient(get('VITE_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

// ── NON-ANIMAL PAIRS: deactivate both bills ───────────────────────────────────
const nonAnimal = [
  // AZ — noncitizen terminology
  { state: 'AZ', bill: 'SB1030' }, { state: 'AZ', bill: 'HB2474' },
  // CA — budget acts
  { state: 'CA', bill: 'AB1563' }, { state: 'CA', bill: 'SB879' },
  { state: 'CA', bill: 'SB102'  }, { state: 'CA', bill: 'AB101'  },
  // FL — domestic violence injunctions
  { state: 'FL', bill: 'S0682'  }, { state: 'FL', bill: 'H0277'  },
  // IL — child care, mental health 911
  { state: 'IL', bill: 'SB3907' }, { state: 'IL', bill: 'HB5373' },
  { state: 'IL', bill: 'HB5468' }, { state: 'IL', bill: 'SB3798' },
  // KS — death penalty, supplemental appropriations
  { state: 'KS', bill: 'SB245'  }, { state: 'KS', bill: 'HB2272' },
  { state: 'KS', bill: 'SB337'  }, { state: 'KS', bill: 'HB2455' },
  { state: 'KS', bill: 'SB68'   }, { state: 'KS', bill: 'HB2082' },
  // MA — racing simulcasting
  { state: 'MA', bill: 'S234'   },
  // MN — retirement system
  { state: 'MN', bill: 'HF3269' }, { state: 'MN', bill: 'SF3464' },
  // NJ — substance use disorder, scalp cooling, driver's licenses, DV court, DV counseling
  { state: 'NJ', bill: 'S2492'  }, { state: 'NJ', bill: 'A626'   },
  { state: 'NJ', bill: 'A2483'  }, { state: 'NJ', bill: 'S494'   },
  { state: 'NJ', bill: 'S3960'  }, { state: 'NJ', bill: 'A4468'  },
  { state: 'NJ', bill: 'S2964'  }, { state: 'NJ', bill: 'A2316'  },
  { state: 'NJ', bill: 'S1651'  }, { state: 'NJ', bill: 'A3352'  }, { state: 'NJ', bill: 'A3388' },
  // NY — drug checking, boilers, building materials, Livable NY, farm laborer bargaining, fire code, child custody
  { state: 'NY', bill: 'A00808' }, { state: 'NY', bill: 'S00056' },
  { state: 'NY', bill: 'S03476' }, { state: 'NY', bill: 'A06489' },
  { state: 'NY', bill: 'A06566' }, { state: 'NY', bill: 'S07648' },
  { state: 'NY', bill: 'S03821' }, { state: 'NY', bill: 'A01262' },
  { state: 'NY', bill: 'A06938' }, { state: 'NY', bill: 'S03129' },
  { state: 'NY', bill: 'A05289' }, { state: 'NY', bill: 'S04534' },
  { state: 'NY', bill: 'S05998' }, { state: 'NY', bill: 'A06194' },
  // OH — license plate, firearm suppressors
  { state: 'OH', bill: 'SB302'  }, { state: 'OH', bill: 'HB731'  },
  { state: 'OH', bill: 'SB214'  }, { state: 'OH', bill: 'HB331'  },
  // RI — sports wagering, vehicle manufacturers, fair housing
  { state: 'RI', bill: 'H8186'  }, { state: 'RI', bill: 'S3118'  },
  { state: 'RI', bill: 'H8217'  }, { state: 'RI', bill: 'S3048'  },
  { state: 'RI', bill: 'S2778'  }, { state: 'RI', bill: 'H7479'  },
  { state: 'RI', bill: 'S2592'  }, { state: 'RI', bill: 'H8105'  },
  // TN — state appropriations
  { state: 'TN', bill: 'SB2690' }, { state: 'TN', bill: 'HB2631' },
  // US — abortion, assault weapons, human rights, Medicare, housing, prescriptions, OTC drugs
  { state: 'US', bill: 'HB4611' }, { state: 'US', bill: 'SB2377' },
  { state: 'US', bill: 'HB3115' }, { state: 'US', bill: 'SB1531' },
  { state: 'US', bill: 'SB3426' }, { state: 'US', bill: 'HB6056' },
  { state: 'US', bill: 'HB3069' }, { state: 'US', bill: 'SB1506' },
  { state: 'US', bill: 'SB2651' }, { state: 'US', bill: 'HB6337' },
  { state: 'US', bill: 'SB1818' }, { state: 'US', bill: 'HB3546' },
  { state: 'US', bill: 'SB2292' }, { state: 'US', bill: 'HB4273' },
  // VA — hospital patient rights, town charter
  { state: 'VA', bill: 'HB1304' }, { state: 'VA', bill: 'SB580'  },
  { state: 'VA', bill: 'SB127'  }, { state: 'VA', bill: 'HB1050' },
  // WA — gift cards, taxes, critical infrastructure, judicial sentencing
  { state: 'WA', bill: 'SB5644' }, { state: 'WA', bill: 'HB1744' },
  { state: 'WA', bill: 'SB6113' }, { state: 'WA', bill: 'HB2257' },
  { state: 'WA', bill: 'SB6190' }, { state: 'WA', bill: 'HB2629' },
  { state: 'WA', bill: 'HB1125' }, { state: 'WA', bill: 'SB5269' },
];

// ── COMPANION PAIRS: deactivate the duplicate (keep the recommended one) ──────
const companions = [
  // AK
  { state: 'AK', bill: 'SB108'  },
  // AL
  { state: 'AL', bill: 'HB534'  },
  // FL — domestic animals
  { state: 'FL', bill: 'H1521'  },
  // HI — spay/neuter 3-way (keep SB1023 high urgency), statutory revision, meat donation, right to farm, aquarium, wildlife
  { state: 'HI', bill: 'SB2710' },
  { state: 'HI', bill: 'SB566'  },
  { state: 'HI', bill: 'HB547'  },
  { state: 'HI', bill: 'SB394'  },
  { state: 'HI', bill: 'HB2467' },
  { state: 'HI', bill: 'HB1334' },
  { state: 'HI', bill: 'HB193'  },
  { state: 'HI', bill: 'SB2535' },
  { state: 'HI', bill: 'HB49'   },
  // IA — commercial animal establishments, animal treatment
  { state: 'IA', bill: 'HF2674' },
  { state: 'IA', bill: 'HF2298' },
  { state: 'IA', bill: 'HF474'  },
  { state: 'IA', bill: 'HF488'  },
  // IL — traveling animal acts, dog dealer, plastic bags, drug detection dog, wildlife traps, landowner permit, RESTORES group
  { state: 'IL', bill: 'SB2747' },
  { state: 'IL', bill: 'HB4778' },
  { state: 'IL', bill: 'HB1146' },
  { state: 'IL', bill: 'SB2417' },
  { state: 'IL', bill: 'SB3152' },
  { state: 'IL', bill: 'HB5439' },
  { state: 'IL', bill: 'HB4228' },
  { state: 'IL', bill: 'SB2384' },
  { state: 'IL', bill: 'HB1028' },
  // KS — migratory waterfowl
  { state: 'KS', bill: 'SB213'  },
  // MA — dangerous dogs, hot box detectors, internet gaming, cosmetics testing (2 versions)
  { state: 'MA', bill: 'H2342'  },
  { state: 'MA', bill: 'S2340'  },
  { state: 'MA', bill: 'H332'   },
  { state: 'MA', bill: 'S263'   },
  { state: 'MA', bill: 'S2744'  },
  // MD — code revision, research facilities, vet board, drinking water, TNR cats, ag equipment, racehorse slaughter, research adoption
  { state: 'MD', bill: 'SB364'  },
  { state: 'MD', bill: 'HB666'  },
  { state: 'MD', bill: 'HB452'  },
  { state: 'MD', bill: 'HB204'  },
  { state: 'MD', bill: 'SB750'  },
  { state: 'MD', bill: 'SB849'  },
  { state: 'MD', bill: 'HB228'  },
  { state: 'MD', bill: 'HB665'  },
  // MI
  { state: 'MI', bill: 'HB5360' },
  // MO
  { state: 'MO', bill: 'HB2292' },
  // NJ — pet shop ban, animal advocate, fish & game council, spay/neuter fund, cruelty registry, awareness day,
  //       animal abuser registry, hate crime animals, paper bags, grocery bags, Chiara's Law, safe haven,
  //       declawing, foie gras, demolition/pest, foreign ag land, DEP lands, hunting licenses (3-way),
  //       trapping, constitutional amendment, traveling acts, animal testing adoption, pesticide, animal abuser registry 2
  { state: 'NJ', bill: 'S434'   },
  { state: 'NJ', bill: 'S405'   },
  { state: 'NJ', bill: 'S471'   },
  { state: 'NJ', bill: 'S384'   },
  { state: 'NJ', bill: 'S599'   },
  { state: 'NJ', bill: 'SJR129' },
  { state: 'NJ', bill: 'S51'    },
  { state: 'NJ', bill: 'A3644'  },
  { state: 'NJ', bill: 'A1534'  },
  { state: 'NJ', bill: 'S1476'  },
  { state: 'NJ', bill: 'A2034'  },
  { state: 'NJ', bill: 'S2408'  },
  { state: 'NJ', bill: 'A4156'  },
  { state: 'NJ', bill: 'S2648'  },
  { state: 'NJ', bill: 'S3028'  },
  { state: 'NJ', bill: 'S1702'  },
  { state: 'NJ', bill: 'S1683'  },
  { state: 'NJ', bill: 'A2787'  },
  { state: 'NJ', bill: 'S1522'  },
  { state: 'NJ', bill: 'S1609'  },
  { state: 'NJ', bill: 'SCR37'  },
  { state: 'NJ', bill: 'S457'   },
  { state: 'NJ', bill: 'A300'   },
  { state: 'NJ', bill: 'S733'   },
  // NY — animal welfare, cruelty enforcement, felony cruelty, civil remedy, transport standards, orders of protection,
  //       animal abuser registry, Bella's Law, spay/neuter tax credit, spay/neuter fund, tethering,
  //       bottle caps (S08600 only — keep A09354), leg-gripping traps, amphibians/reptiles, wild animal def,
  //       fines for cruelty, traveling acts, primates, research funding, penalties, cruelty penalties,
  //       fighting penalties, death penalty animals, crossbow wildlife, Nassau deer, Huntington deer,
  //       shell egg farms, animal fighting establishments, companion animal drugs, rodent traps,
  //       purchase food contracts, cruelty endangering
  { state: 'NY', bill: 'A06602' },
  { state: 'NY', bill: 'A08091' },
  { state: 'NY', bill: 'A01391' },
  { state: 'NY', bill: 'A09150' },
  { state: 'NY', bill: 'A02555' },
  { state: 'NY', bill: 'A08555' },
  { state: 'NY', bill: 'A05815' },
  { state: 'NY', bill: 'A10119' },
  { state: 'NY', bill: 'S01753' },
  { state: 'NY', bill: 'A00138' },
  { state: 'NY', bill: 'A03184' },
  { state: 'NY', bill: 'A00165' },
  { state: 'NY', bill: 'S08600' }, // keep A09354 (bottle caps/wildlife)
  { state: 'NY', bill: 'A00667' },
  { state: 'NY', bill: 'S08693' },
  { state: 'NY', bill: 'A01804' },
  { state: 'NY', bill: 'A03026' },
  { state: 'NY', bill: 'A05850' },
  { state: 'NY', bill: 'A01835' },
  { state: 'NY', bill: 'S03457' },
  { state: 'NY', bill: 'A00546' },
  { state: 'NY', bill: 'A03880' },
  { state: 'NY', bill: 'A00730' },
  { state: 'NY', bill: 'S05414' },
  { state: 'NY', bill: 'S00218' },
  { state: 'NY', bill: 'A03370' },
  { state: 'NY', bill: 'A07146' },
  { state: 'NY', bill: 'A00652' },
  { state: 'NY', bill: 'A02421' },
  { state: 'NY', bill: 'S00833' },
  { state: 'NY', bill: 'S03046' },
  // PA — dairy zones, pet shop kennels
  { state: 'PA', bill: 'HB177'  },
  { state: 'PA', bill: 'HB1816' },
  // RI — animal control officers, dog licensing, cruelty penalties, force-feeding
  { state: 'RI', bill: 'S2151'  },
  { state: 'RI', bill: 'H7220'  },
  { state: 'RI', bill: 'S2397'  },
  { state: 'RI', bill: 'S2353'  },
  // SD — product ingredients
  { state: 'SD', bill: 'HB1057' },
  // TN — code amendments, appropriations
  { state: 'TN', bill: 'SB1794' },
  { state: 'TN', bill: 'HB1631' },
  { state: 'TN', bill: 'HB0680' },
  // TX — dangerous dog (2 House versions), cruelty penalty
  { state: 'TX', bill: 'HB2806' },
  { state: 'TX', bill: 'HB1346' },
  { state: 'TX', bill: 'HB1795' },
  // US — Better CARE, FIGHT Act, Agriculture Resilience, SAFE Act equines, Strengthening Local Processing,
  //       Captive Primate Safety, Wild Olympics, Northern Rockies, FDA Modernization 3.0, SAFE Sunscreen
  { state: 'US', bill: 'HB3112' },
  { state: 'US', bill: 'SB1454' },
  { state: 'US', bill: 'HB3077' },
  { state: 'US', bill: 'SB775'  },
  { state: 'US', bill: 'SB1509' },
  { state: 'US', bill: 'HB3199' },
  { state: 'US', bill: 'HB3369' },
  { state: 'US', bill: 'HB2420' },
  { state: 'US', bill: 'HB2821' },
  { state: 'US', bill: 'SB2491' },
  // VA — wildlife separation, cruelty to dogs/cats
  { state: 'VA', bill: 'SB344'  },
  { state: 'VA', bill: 'HB730'  },
  // WA — water quality, vet relationships, fish & wildlife flexibility
  { state: 'WA', bill: 'SB6088' },
  { state: 'WA', bill: 'SB6072' },
  { state: 'WA', bill: 'SB5354' },
  // WI — animal testing adoption
  { state: 'WI', bill: 'SB414'  },
  // WV — dog racing
  { state: 'WV', bill: 'HB5418' },
];

// Deduplicate in case any bill appears in both lists
const all = [...nonAnimal, ...companions];
const seen = new Set();
const unique = all.filter(({ state, bill }) => {
  const key = `${state}:${bill}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`Total bills to deactivate: ${unique.length}`);
console.log(`  Non-animal pairs: ${nonAnimal.length} entries (${new Set(nonAnimal.map(b=>`${b.state}:${b.bill}`)).size} unique)`);
console.log(`  Companion duplicates: ${companions.length} entries (${new Set(companions.map(b=>`${b.state}:${b.bill}`)).size} unique)`);
console.log(`  Combined unique: ${unique.length}\n`);

let success = 0, notFound = 0, errors = 0;

for (const { state, bill } of unique) {
  const { data, error } = await supabase
    .from('featured_bills')
    .update({ active: false })
    .eq('state', state)
    .ilike('custom_title', `%(${bill})`)
    .select('id, custom_title');

  if (error) {
    console.error(`  ERROR ${state} ${bill}: ${error.message}`);
    errors++;
  } else if (!data || data.length === 0) {
    console.log(`  NOT FOUND: ${state} ${bill}`);
    notFound++;
  } else {
    console.log(`  ✓ ${state} ${bill}`);
    success++;
  }
}

console.log(`\n══════════════════════════════════════`);
console.log(`Done.`);
console.log(`  ✓ Deactivated: ${success}`);
console.log(`  ✗ Not found:   ${notFound}`);
console.log(`  ! Errors:      ${errors}`);
console.log(`  Total:         ${unique.length}`);
