import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function getFeaturedBills() {
  if (!supabase) return { data: getMockBills(), error: null };
  const { data, error } = await supabase
    .from('featured_bills')
    .select('*')
    .eq('active', true)
    .order('urgency', { ascending: true });
  return { data: data || [], error };
}

export async function getBillById(id) {
  if (!supabase) {
    const mock = getMockBills().find(b => b.id === id);
    return { data: mock, error: null };
  }
  const { data, error } = await supabase
    .from('featured_bills')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function getCachedLegiScanData(billId) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('legiscan_cache')
      .select('data, cached_at')
      .eq('bill_id', billId)
      .single();
    if (!data) return null;
    const cachedAt = new Date(data.cached_at);
    const now = new Date();
    const hoursDiff = (now - cachedAt) / (1000 * 60 * 60);
    if (hoursDiff > 24) return null;
    return data.data;
  } catch {
    return null;
  }
}

export async function setCachedLegiScanData(billId, billData) {
  if (!supabase) return;
  try {
    await supabase.from('legiscan_cache').upsert({
      bill_id: billId,
      data: billData,
      cached_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Cache write error:', err);
  }
}

export async function getAllBillsAdmin() {
  if (!supabase) return { data: getMockBills(), error: null };
  const { data, error } = await supabase
    .from('featured_bills')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function createBill(bill) {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') };
  return supabase.from('featured_bills').insert([bill]).select().single();
}

export async function updateBill(id, updates) {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') };
  return supabase.from('featured_bills').update(updates).eq('id', id).select().single();
}

export async function deleteBill(id) {
  if (!supabase) return { error: new Error('Supabase not configured') };
  return supabase.from('featured_bills').delete().eq('id', id);
}

export async function verifyAdminPassword(password) {
  if (!supabase) return password === import.meta.env.VITE_ADMIN_PASSWORD;
  const { data } = await supabase
    .from('admin_settings')
    .select('password_hash')
    .single();
  return data && data.password_hash === password;
}

// Mock data for when Supabase is not configured
function getMockBills() {
  return [
    {
      id: 'mock-1',
      legiscan_bill_id: 1477,
      state: 'US',
      custom_title: 'Animal Cruelty Enforcement Act of 2025 (H.R. 1477)',
      why_it_matters: "This bill strengthens federal penalties for animal cruelty and ensures that the FBI's National Incident-Based Reporting System fully tracks animal abuse crimes. Right now, animal cruelty cases are often underreported and underprosecuted.",
      email_subject: 'Please Support H.R. 1477 — Animal Cruelty Enforcement Act',
      email_body: 'Dear {{rep_name}},\n\nI am writing from {{user_zip}} to urge your support for {{bill_name}}.\n\nThank you,\nA constituent from {{user_zip}}',
      urgency: 'high',
      active: true,
    },
    {
      id: 'mock-2',
      legiscan_bill_id: 2253,
      state: 'US',
      custom_title: 'Puppy Protection Act of 2025 (H.R. 2253)',
      why_it_matters: 'Puppy mills are large-scale commercial breeding operations where dogs are kept in cramped, filthy conditions and bred repeatedly with no regard for their health or wellbeing.',
      email_subject: 'Please Support H.R. 2253 — Puppy Protection Act',
      email_body: 'Dear {{rep_name}},\n\nI am writing from {{user_zip}} to urge your support for {{bill_name}}.\n\nThank you,\nA constituent from {{user_zip}}',
      urgency: 'high',
      active: true,
    },
    {
      id: 'mock-3',
      legiscan_bill_id: 349,
      state: 'US',
      custom_title: "Goldie's Act (H.R. 349)",
      why_it_matters: "Named after a golden retriever who was seized from a USDA-licensed dealer in terrible condition, Goldie's Act would require USDA inspectors to report animal welfare violations to local law enforcement.",
      email_subject: "Please Support H.R. 349 — Goldie's Act",
      email_body: 'Dear {{rep_name}},\n\nI am writing from {{user_zip}} to urge your support for {{bill_name}}.\n\nThank you,\nA constituent from {{user_zip}}',
      urgency: 'medium',
      active: true,
    },
  ];
}
