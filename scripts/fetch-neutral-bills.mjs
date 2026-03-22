import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '../.env'), 'utf8');
const get = key => { const m = env.match(new RegExp(`^${key}=(.+)$`, 'm')); return m ? m[1].trim() : ''; };

const supabase = createClient(get('VITE_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

const pageSize = 1000;
let all = [];
let from = 0;
while (true) {
  const { data, error } = await supabase
    .from('featured_bills')
    .select('id, state, custom_title, why_it_matters, stance, active')
    .eq('stance', 'neutral')
    .eq('active', true)
    .order('state', { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) { console.error(error.message); break; }
  all = all.concat(data || []);
  if (!data || data.length < pageSize) break;
  from += pageSize;
}

console.log(`Total: ${all.length}`);
let out = `Total neutral+active bills: ${all.length}\n---\n`;
all.forEach((b, i) => {
  const billNum = b.custom_title.match(/\(([^)]+)\)$/)?.[1] || 'unknown';
  out += `${i+1}. [${b.state}] ${billNum}\nTITLE: ${b.custom_title}\nWHY: ${(b.why_it_matters||'').substring(0,400)}\n---\n`;
});
writeFileSync(join(__dirname, '../neutral-bills-data.txt'), out);
console.log('Written to neutral-bills-data.txt');
