import { useState, useEffect } from 'react';
import { getAllBillsAdmin, createBill, updateBill, deleteBill, verifyAdminPassword, getCachedLegiScanData, setCachedLegiScanData } from '../lib/supabase';
import { getBill, searchBills } from '../lib/legiscan';
import BillCard from '../components/BillCard';

const EMPTY_BILL = {
  legiscan_bill_id: '',
  state: 'US',
  custom_title: '',
  why_it_matters: '',
  email_subject: '',
  email_body: '',
  urgency: 'medium',
  active: true,
};

const US_STATES = ['US','AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [bills, setBills] = useState([]);
  const [form, setForm] = useState(EMPTY_BILL);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewLegiData, setPreviewLegiData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [billsTab, setBillsTab] = useState('all'); // 'all' | 'review'

  useEffect(() => {
    if (authed) loadBills();
  }, [authed]);

  async function login(e) {
    e.preventDefault();
    const ok = await verifyAdminPassword(password);
    if (ok) {
      setAuthed(true);
    } else {
      setAuthError('Incorrect password.');
    }
  }

  async function loadBills() {
    const { data } = await getAllBillsAdmin();
    setBills(data || []);
  }

  function handleFormChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const billData = { ...form, legiscan_bill_id: parseInt(form.legiscan_bill_id) };
    let result;
    if (editingId) {
      result = await updateBill(editingId, billData);
    } else {
      result = await createBill(billData);
    }
    if (result.error) {
      setMessage({ type: 'error', text: 'Save failed: ' + result.error.message });
    } else {
      // Cache LegiScan data immediately
      if (billData.legiscan_bill_id) {
        const fetched = await getBill(billData.legiscan_bill_id);
        if (fetched) await setCachedLegiScanData(billData.legiscan_bill_id, fetched);
      }
      setMessage({ type: 'success', text: editingId ? 'Bill updated.' : 'Bill added.' });
      setForm(EMPTY_BILL);
      setEditingId(null);
      loadBills();
    }
    setSaving(false);
  }

  function handleEdit(bill) {
    setEditingId(bill.id);
    setForm({
      legiscan_bill_id: bill.legiscan_bill_id,
      state: bill.state,
      custom_title: bill.custom_title || '',
      why_it_matters: bill.why_it_matters || '',
      email_subject: bill.email_subject || '',
      email_body: bill.email_body || '',
      urgency: bill.urgency || 'medium',
      active: bill.active !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!confirm('Delete this bill?')) return;
    await deleteBill(id);
    loadBills();
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchBills(searchQuery);
    setSearchResults(results.slice(0, 15));
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

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20">
        <h1 className="text-2xl font-bold text-navy mb-6 text-center">Admin Login</h1>
        <form onSubmit={login} className="space-y-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange"
          />
          {authError && <p className="text-red-600 text-sm">{authError}</p>}
          <button type="submit" className="w-full bg-navy text-white font-bold py-2 rounded-lg hover:bg-navy-dark transition-colors">
            Log In
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Admin — Bills Management</h1>
        <button onClick={() => setAuthed(false)} className="text-sm text-gray-500 hover:text-navy">Log out</button>
      </div>

      {/* Bill form */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-navy mb-5">{editingId ? 'Edit Bill' : 'Add New Bill'}</h2>
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                LegiScan Bill ID *
                <a href="https://legiscan.com" target="_blank" rel="noopener noreferrer" className="ml-2 text-orange font-normal">Find IDs at legiscan.com ↗</a>
              </label>
              <input
                type="number"
                required
                value={form.legiscan_bill_id}
                onChange={e => handleFormChange('legiscan_bill_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
                placeholder="e.g. 1477"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">State</label>
              <select
                value={form.state}
                onChange={e => handleFormChange('state', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
              >
                {US_STATES.map(s => (
                  <option key={s} value={s}>{s === 'US' ? 'US Federal' : s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Custom Title (optional — overrides LegiScan title)</label>
            <input
              type="text"
              value={form.custom_title}
              onChange={e => handleFormChange('custom_title', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
              placeholder="e.g. Animal Cruelty Enforcement Act of 2025 (H.R. 1477)"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Why It Matters</label>
            <textarea
              rows={4}
              value={form.why_it_matters}
              onChange={e => handleFormChange('why_it_matters', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
              placeholder="Explain why this bill matters to the public..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email Subject</label>
              <input
                type="text"
                value={form.email_subject}
                onChange={e => handleFormChange('email_subject', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
                placeholder="Please Support H.R. XXXX — Bill Title"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Urgency</label>
              <select
                value={form.urgency}
                onChange={e => handleFormChange('urgency', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
              >
                <option value="high">High — Urgent</option>
                <option value="medium">Medium — Active</option>
                <option value="low">Low — Monitor</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Email Body
              <span className="ml-2 text-gray-400 font-normal">{'Placeholders: {{rep_name}}, {{bill_name}}, {{user_zip}}'}</span>
            </label>
            <textarea
              rows={10}
              value={form.email_body}
              onChange={e => handleFormChange('email_body', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange"
              placeholder="Dear {{rep_name}},..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={form.active}
              onChange={e => handleFormChange('active', e.target.checked)}
              className="w-4 h-4 accent-orange"
            />
            <label htmlFor="active" className="text-sm text-gray-700">Active (visible to public)</label>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button type="submit" disabled={saving} className="bg-navy text-white font-bold px-6 py-2 rounded-lg text-sm hover:bg-navy-dark transition-colors disabled:opacity-60">
              {saving ? 'Saving...' : editingId ? 'Update Bill' : 'Add Bill'}
            </button>
            <button type="button" onClick={handlePreview} className="border border-gray-300 text-gray-700 font-semibold px-6 py-2 rounded-lg text-sm hover:border-navy transition-colors">
              Preview
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_BILL); }} className="text-gray-500 text-sm hover:text-navy">
                Cancel edit
              </button>
            )}
          </div>
        </form>

        {/* Preview */}
        {preview && (
          <div className="mt-6 border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Preview</h3>
            <div className="max-w-sm">
              <BillCard
                bill={{ ...form, id: 'preview', legiscan_bill_id: parseInt(form.legiscan_bill_id) || 0 }}
                legiData={previewLegiData}
              />
            </div>
          </div>
        )}
      </section>

      {/* LegiScan search helper */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-navy mb-4">LegiScan Search Helper</h2>
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder='Search: "animal cruelty", "puppy mill"...'
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
          />
          <button type="submit" disabled={searching} className="bg-orange text-white font-semibold px-5 py-2 rounded-lg text-sm hover:bg-orange-dark transition-colors disabled:opacity-60">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {searchResults.map(result => (
              <div key={result.bill_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="font-mono text-xs text-gray-400 mr-2">ID: {result.bill_id}</span>
                  <span className="font-medium text-navy">{result.bill_number} — {result.title?.slice(0, 80)}{result.title?.length > 80 ? '...' : ''}</span>
                  <span className="ml-2 text-xs text-gray-400">{result.state}</span>
                </div>
                <button
                  onClick={() => {
                    handleFormChange('legiscan_bill_id', result.bill_id);
                    handleFormChange('state', result.state === 'US' ? 'US' : result.state);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-orange hover:underline text-xs font-semibold ml-3 flex-shrink-0"
                >
                  Use this ID
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bills list */}
      <section>
        {(() => {
          const needsReview = bills.filter(b => !b.why_it_matters);
          const visibleBills = billsTab === 'review' ? needsReview : bills;
          return (
            <>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-navy">Bills</h2>
                <div className="flex gap-1">
                  <button
                    onClick={() => setBillsTab('all')}
                    className={`px-3 py-1 rounded-full text-sm font-semibold border transition-colors ${billsTab === 'all' ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-300 hover:border-navy'}`}
                  >
                    All ({bills.length})
                  </button>
                  <button
                    onClick={() => setBillsTab('review')}
                    className={`px-3 py-1 rounded-full text-sm font-semibold border transition-colors ${billsTab === 'review' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-300 hover:border-amber-500 hover:text-amber-600'} ${needsReview.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}
                  >
                    Needs Review ({needsReview.length})
                  </button>
                </div>
              </div>

              {billsTab === 'review' && needsReview.length > 0 && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  These bills were flagged by the migration script because their animal welfare relevance couldn't be verified. They have no public description. Edit each one to write a description and re-activate, or delete/deactivate if they don't belong.
                </div>
              )}

              <div className="space-y-3">
                {visibleBills.map(bill => {
                  const flagged = !bill.why_it_matters;
                  return (
                    <div key={bill.id} className={`bg-white border rounded-xl p-4 flex items-start justify-between gap-4 ${flagged ? 'border-amber-300' : 'border-gray-200'}`}>
                      <div className="min-w-0">
                        <div className="flex gap-2 flex-wrap mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${bill.state === 'US' ? 'bg-navy text-white' : 'bg-gray-600 text-white'}`}>{bill.state === 'US' ? 'FEDERAL' : bill.state}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${bill.urgency === 'high' ? 'bg-orange text-white' : bill.urgency === 'medium' ? 'bg-blue-500 text-white' : 'bg-gray-400 text-white'}`}>{bill.urgency}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${bill.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{bill.active ? 'Active' : 'Hidden'}</span>
                          {flagged && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">⚑ Needs Review</span>}
                        </div>
                        <p className="font-semibold text-navy text-sm truncate">{bill.custom_title || `Bill ID: ${bill.legiscan_bill_id}`}</p>
                        <p className="text-xs text-gray-400 mt-0.5">LegiScan ID: {bill.legiscan_bill_id}</p>
                        {flagged && bill.active && (
                          <p className="text-xs text-amber-600 mt-1">No description — not visible to users until why_it_matters is filled in or bill is hidden.</p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0 items-start">
                        <button onClick={() => handleEdit(bill)} className="text-sm text-navy hover:underline font-medium">Edit</button>
                        {bill.active && (
                          <button
                            onClick={async () => { await updateBill(bill.id, { active: false }); loadBills(); }}
                            className="text-sm text-gray-500 hover:underline font-medium"
                          >
                            Hide
                          </button>
                        )}
                        {!bill.active && (
                          <button
                            onClick={async () => { await updateBill(bill.id, { active: true }); loadBills(); }}
                            className="text-sm text-green-600 hover:underline font-medium"
                          >
                            Show
                          </button>
                        )}
                        <button onClick={() => handleDelete(bill.id)} className="text-sm text-red-600 hover:underline font-medium">Delete</button>
                      </div>
                    </div>
                  );
                })}
                {visibleBills.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-8">
                    {billsTab === 'review' ? 'No bills need review.' : 'No bills yet.'}
                  </p>
                )}
              </div>
            </>
          );
        })()}
      </section>
    </div>
  );
}
