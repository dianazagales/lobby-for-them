import { useState, useEffect } from 'react';
import { getAllBillsAdmin, createBill, updateBill, deleteBill, verifyAdminPassword, getCachedLegiScanData, setCachedLegiScanData, getContactMessages, markMessageRead, deleteMessage } from '../lib/supabase';
import { getBill, searchBills } from '../lib/legiscan';
import BillCard from '../components/BillCard';

const EMPTY_BILL = {
  legiscan_bill_id: '',
  state: 'US',
  custom_title: '',
  why_it_matters: '',
  email_subject: '',
  email_body: '',
  email_template: '',
  urgency: 'medium',
  active: true,
};

const US_STATES = ['US','AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

function StatCard({ label, value, color = 'text-navy', onClick }) {
  return (
    <button
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-xl p-5 text-left transition-shadow hover:shadow-md ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
    </button>
  );
}

function UrgencyBadge({ urgency }) {
  const styles = {
    high: 'bg-orange/10 text-orange',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${styles[urgency] || styles.medium}`}>
      {urgency}
    </span>
  );
}

function NavItem({ id, label, icon, badge, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
        active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="bg-orange text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [bills, setBills] = useState([]);
  const [messages, setMessages] = useState([]);
  const [section, setSection] = useState('dashboard');
  const [form, setForm] = useState(EMPTY_BILL);
  const [editingId, setEditingId] = useState(null);
  const [billFilter, setBillFilter] = useState('all');
  const [billSearch, setBillSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewLegiData, setPreviewLegiData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { if (authed) { loadBills(); loadMessages(); } }, [authed]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function login(e) {
    e.preventDefault();
    const ok = await verifyAdminPassword(password);
    if (ok) setAuthed(true);
    else setAuthError('Incorrect password.');
  }

  async function loadBills() {
    const { data } = await getAllBillsAdmin();
    setBills(data || []);
  }

  async function loadMessages() {
    const { data } = await getContactMessages(password);
    setMessages(data || []);
  }

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const billData = { ...form, legiscan_bill_id: parseInt(form.legiscan_bill_id) || 0 };
    const result = editingId ? await updateBill(editingId, billData, password) : await createBill(billData, password);
    if (result.error) {
      setToast({ type: 'error', text: 'Save failed: ' + result.error.message });
    } else {
      if (billData.legiscan_bill_id) {
        const fetched = await getBill(billData.legiscan_bill_id);
        if (fetched) await setCachedLegiScanData(billData.legiscan_bill_id, fetched);
      }
      setToast({ type: 'success', text: editingId ? 'Bill updated.' : 'Bill added.' });
      setForm(EMPTY_BILL);
      setEditingId(null);
      setPreview(false);
      loadBills();
      setSection('bills');
    }
    setSaving(false);
  }

  function startEdit(bill) {
    setEditingId(bill.id);
    setForm({
      legiscan_bill_id: bill.legiscan_bill_id,
      state: bill.state,
      custom_title: bill.custom_title || '',
      why_it_matters: bill.why_it_matters || '',
      email_subject: bill.email_subject || '',
      email_body: bill.email_body || '',
      email_template: bill.email_template || '',
      urgency: bill.urgency || 'medium',
      active: bill.active !== false,
    });
    setPreview(false);
    setSection('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_BILL);
    setPreview(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this bill? This cannot be undone.')) return;
    await deleteBill(id, password);
    loadBills();
    setToast({ type: 'success', text: 'Bill deleted.' });
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchBills(searchQuery);
    setSearchResults(results.slice(0, 20));
    setSearching(false);
  }

  async function handlePreview() {
    setPreview(true);
    if (form.legiscan_bill_id) {
      let cached = await getCachedLegiScanData(parseInt(form.legiscan_bill_id));
      if (!cached) cached = await getBill(parseInt(form.legiscan_bill_id));
      setPreviewLegiData(cached);
    }
  }

  // Stats
  const total       = bills.length;
  const activeCount = bills.filter(b => b.active).length;
  const hiddenCount = bills.filter(b => !b.active).length;
  const reviewCount = bills.filter(b => b.active && !b.why_it_matters).length;

  // Filtered bill list
  const visibleBills = bills.filter(b => {
    if (billFilter === 'active' && !b.active) return false;
    if (billFilter === 'hidden' &&  b.active) return false;
    if (billFilter === 'review' && (!b.active || b.why_it_matters)) return false;
    if (billSearch) {
      const q = billSearch.toLowerCase();
      return (b.custom_title || '').toLowerCase().includes(q) ||
             String(b.legiscan_bill_id).includes(q) ||
             (b.state || '').toLowerCase().includes(q);
    }
    return true;
  });

  // ── Login screen ───────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-navy rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-navy">Admin Login</h1>
            <p className="text-gray-400 text-sm mt-1">Lobby for Them</p>
          </div>
          <form onSubmit={login} className="space-y-4">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
            />
            {authError && <p className="text-red-600 text-sm">{authError}</p>}
            <button type="submit" className="w-full bg-navy text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
              Log In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Nav icon helpers ───────────────────────────────────────────────────────
  const icons = {
    dashboard: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    bills: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    add: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
    search: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    messages: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  };

  // ── Admin layout ───────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">

      {/* ── Sidebar ── */}
      <aside className="w-56 bg-navy text-white flex-shrink-0 flex flex-col sticky top-0 h-screen">
        {/* Branding */}
        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Admin</p>
          <p className="font-extrabold text-white text-base leading-tight">Lobby for Them</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          <NavItem id="dashboard" label="Dashboard"       icon={icons.dashboard} active={section === 'dashboard'} onClick={setSection} />
          <NavItem id="bills"     label="Bills"           icon={icons.bills}     active={section === 'bills'}     onClick={setSection} badge={reviewCount} />
          <NavItem id="add"       label={editingId ? 'Edit Bill' : 'Add Bill'} icon={icons.add} active={section === 'add'} onClick={setSection} />
          <NavItem id="search"    label="LegiScan Search" icon={icons.search}    active={section === 'search'}    onClick={setSection} />
          <NavItem id="messages"  label="Messages"        icon={icons.messages}  active={section === 'messages'}  onClick={() => { loadMessages(); setSection('messages'); }} badge={messages.filter(m => !m.read).length} />
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs text-white/30">{activeCount} active · {hiddenCount} hidden</p>
          </div>
          <button
            onClick={() => setAuthed(false)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 bg-gray-50 overflow-y-auto">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl transition-all ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.text}
          </div>
        )}

        {/* ── Dashboard ─────────────────────────────────────────────────── */}
        {section === 'dashboard' && (
          <div className="p-8">
            <h1 className="text-2xl font-extrabold text-navy mb-6">Dashboard</h1>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Bills"   value={total}       onClick={() => { setBillFilter('all');    setSection('bills'); }} />
              <StatCard label="Active"        value={activeCount} color="text-green-600" onClick={() => { setBillFilter('active'); setSection('bills'); }} />
              <StatCard label="Hidden"        value={hiddenCount} color="text-gray-400"  onClick={() => { setBillFilter('hidden'); setSection('bills'); }} />
              <StatCard label="Needs Review"  value={reviewCount} color={reviewCount > 0 ? 'text-amber-500' : 'text-gray-400'} onClick={() => { setBillFilter('review'); setSection('bills'); }} />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-navy">All Bills</h2>
                <button onClick={() => setSection('bills')} className="text-sm text-orange hover:underline font-medium">View all →</button>
              </div>
              <div className="divide-y divide-gray-50">
                {bills.slice(0, 10).map(bill => (
                  <div key={bill.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold flex-shrink-0 ${bill.state === 'US' ? 'bg-navy text-white' : 'bg-gray-200 text-gray-700'}`}>
                      {bill.state === 'US' ? 'FED' : bill.state}
                    </span>
                    <p className="flex-1 text-sm font-medium text-navy truncate">{bill.custom_title || `Bill ID: ${bill.legiscan_bill_id}`}</p>
                    <UrgencyBadge urgency={bill.urgency} />
                    <span className={`text-xs font-medium flex-shrink-0 ${bill.active ? 'text-green-600' : 'text-gray-400'}`}>
                      {bill.active ? '● Active' : '○ Hidden'}
                    </span>
                    <button onClick={() => startEdit(bill)} className="text-xs text-orange hover:underline font-semibold flex-shrink-0">Edit</button>
                  </div>
                ))}
                {bills.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-10">No bills yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Bills List ────────────────────────────────────────────────── */}
        {section === 'bills' && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-extrabold text-navy">Bills</h1>
              <button
                onClick={() => { cancelEdit(); setSection('add'); }}
                className="bg-navy text-white text-sm font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Bill
              </button>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { id: 'all',    label: `All (${total})` },
                  { id: 'active', label: `Active (${activeCount})` },
                  { id: 'hidden', label: `Hidden (${hiddenCount})` },
                  { id: 'review', label: `Needs Review (${reviewCount})`, warn: true },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setBillFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      billFilter === tab.id
                        ? tab.warn ? 'bg-amber-500 text-white' : 'bg-navy text-white'
                        : tab.warn && reviewCount > 0
                          ? 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search by title, state, or ID…"
                value={billSearch}
                onChange={e => setBillSearch(e.target.value)}
                className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange bg-white"
              />
            </div>

            {billFilter === 'review' && reviewCount > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                These bills have no "Why It Matters" description and won't be shown to users until one is added.
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {visibleBills.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-12">No bills found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Bill</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">State</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Urgency</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 w-32"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {visibleBills.map(bill => (
                      <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-navy truncate max-w-xs">{bill.custom_title || `Bill ID: ${bill.legiscan_bill_id}`}</p>
                          <p className="text-xs text-gray-400 mt-0.5">LegiScan ID: {bill.legiscan_bill_id}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${bill.state === 'US' ? 'bg-navy text-white' : 'bg-gray-200 text-gray-700'}`}>
                            {bill.state === 'US' ? 'Federal' : bill.state}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <UrgencyBadge urgency={bill.urgency} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${bill.active ? 'text-green-600' : 'text-gray-400'}`}>
                            {bill.active ? '● Active' : '○ Hidden'}
                          </span>
                          {bill.active && !bill.why_it_matters && (
                            <span className="ml-2 text-xs text-amber-500 font-semibold">⚑ Review</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 justify-end">
                            <button onClick={() => startEdit(bill)} className="text-xs text-navy hover:text-orange font-semibold">Edit</button>
                            <button
                              onClick={async () => { await updateBill(bill.id, { active: !bill.active }, password); loadBills(); }}
                              className={`text-xs font-semibold ${bill.active ? 'text-gray-400 hover:text-gray-600' : 'text-green-600 hover:text-green-700'}`}
                            >
                              {bill.active ? 'Hide' : 'Show'}
                            </button>
                            <button onClick={() => handleDelete(bill.id)} className="text-xs text-red-500 hover:text-red-700 font-semibold">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Add / Edit Bill ───────────────────────────────────────────── */}
        {section === 'add' && (
          <div className="p-8 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-2xl font-extrabold text-navy">{editingId ? 'Edit Bill' : 'Add New Bill'}</h1>
              {editingId && (
                <button onClick={cancelEdit} className="text-sm text-gray-400 hover:text-gray-600">✕ Cancel</button>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-5">

              {/* Bill Info */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bill Info</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      LegiScan Bill ID *
                      <button type="button" onClick={() => setSection('search')} className="ml-2 text-orange font-normal hover:underline">Find ID ↗</button>
                    </label>
                    <input
                      type="number"
                      required
                      value={form.legiscan_bill_id}
                      onChange={e => setField('legiscan_bill_id', e.target.value)}
                      placeholder="e.g. 2084377"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">State</label>
                    <select
                      value={form.state}
                      onChange={e => setField('state', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
                    >
                      {US_STATES.map(s => <option key={s} value={s}>{s === 'US' ? 'US Federal' : s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Custom Title</label>
                    <input
                      type="text"
                      value={form.custom_title}
                      onChange={e => setField('custom_title', e.target.value)}
                      placeholder="Overrides LegiScan title"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Urgency</label>
                    <select
                      value={form.urgency}
                      onChange={e => setField('urgency', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
                    >
                      <option value="high">High — Urgent</option>
                      <option value="medium">Medium — Active</option>
                      <option value="low">Low — Monitor</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => setField('active', e.target.checked)}
                    className="w-4 h-4 accent-orange"
                  />
                  <span className="text-sm text-gray-700">Active (visible to public)</span>
                </label>
              </div>

              {/* Public Content */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Public Content</h2>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Why It Matters</label>
                  <textarea
                    rows={5}
                    value={form.why_it_matters}
                    onChange={e => setField('why_it_matters', e.target.value)}
                    placeholder="3–4 sentences explaining why users should take action…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange resize-y"
                  />
                </div>
              </div>

              {/* Email Template */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Template</h2>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email Subject</label>
                  <input
                    type="text"
                    value={form.email_subject}
                    onChange={e => setField('email_subject', e.target.value)}
                    placeholder="Please Support H.R. XXXX — Bill Title"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
                  />
                </div>
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-600">Email Body</label>
                    <span className="text-xs text-gray-400 font-mono">{'{{rep_name}}  {{bill_name}}  {{user_zip}}'}</span>
                  </div>
                  <textarea
                    rows={10}
                    value={form.email_template}
                    onChange={e => setField('email_template', e.target.value)}
                    placeholder="Write the body paragraphs here — greeting and sign-off are added automatically."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange resize-y"
                  />
                  <p className="text-xs text-gray-400 mt-1">Greeting ("Dear …,") and sign-off are added automatically. Write only the body.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-navy text-white font-bold px-7 py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editingId ? 'Update Bill' : 'Add Bill'}
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  className="border border-gray-300 text-gray-700 font-semibold px-5 py-2.5 rounded-lg text-sm hover:border-navy transition-colors"
                >
                  Preview Card
                </button>
              </div>
            </form>

            {preview && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Card Preview</h3>
                <div className="max-w-sm">
                  <BillCard
                    bill={{ ...form, id: 'preview', legiscan_bill_id: parseInt(form.legiscan_bill_id) || 0 }}
                    legiData={previewLegiData}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Messages ─────────────────────────────────────────────────── */}
        {section === 'messages' && (
          <div className="p-8 max-w-3xl">
            <h1 className="text-2xl font-extrabold text-navy mb-6">Messages</h1>

            {messages.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-16">No messages yet.</p>
            ) : (
              <div className="space-y-4">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`bg-white border rounded-xl p-5 ${msg.read ? 'border-gray-200' : 'border-orange/40 shadow-sm'}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {!msg.read && (
                            <span className="text-xs bg-orange text-white font-bold px-2 py-0.5 rounded-full">New</span>
                          )}
                          <span className="font-semibold text-navy text-sm">{msg.name || 'Anonymous'}</span>
                          {msg.email && (
                            <a href={`mailto:${msg.email}`} className="text-xs text-orange hover:underline">{msg.email}</a>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          onClick={async () => { await markMessageRead(msg.id, !msg.read, password); loadMessages(); }}
                          className="text-xs text-gray-400 hover:text-navy font-medium"
                        >
                          {msg.read ? 'Mark unread' : 'Mark read'}
                        </button>
                        <button
                          onClick={async () => { if (!confirm('Delete this message?')) return; await deleteMessage(msg.id, password); loadMessages(); }}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LegiScan Search ───────────────────────────────────────────── */}
        {section === 'search' && (
          <div className="p-8 max-w-3xl">
            <h1 className="text-2xl font-extrabold text-navy mb-1">LegiScan Search</h1>
            <p className="text-gray-400 text-sm mb-6">Find bill IDs to use when adding a new bill.</p>

            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder='e.g. "animal cruelty", "puppy mill", "spay neuter"'
                autoFocus
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange bg-white"
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-orange text-white font-bold px-7 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex-shrink-0"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400">{searchResults.length} results</p>
                </div>
                <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                  {searchResults.map(result => (
                    <div key={result.bill_id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs text-gray-400">ID: {result.bill_id}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${result.state === 'US' ? 'bg-navy text-white' : 'bg-gray-200 text-gray-700'}`}>
                            {result.state}
                          </span>
                          {result.last_action_date && (
                            <span className="text-xs text-gray-400">{result.last_action_date}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-navy truncate">
                          <span className="text-orange font-bold mr-1.5">{result.bill_number}</span>
                          {result.title?.slice(0, 90)}{result.title?.length > 90 ? '…' : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setField('legiscan_bill_id', result.bill_id);
                          setField('state', result.state === 'US' ? 'US' : result.state);
                          setSection('add');
                        }}
                        className="text-xs bg-navy text-white font-bold px-3 py-1.5 rounded-lg hover:bg-orange transition-colors flex-shrink-0"
                      >
                        Use ID
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="text-gray-400 text-sm text-center py-10">No results found.</p>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
