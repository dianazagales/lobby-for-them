import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFeaturedBills, getCachedLegiScanData, setCachedLegiScanData, deactivateBill } from '../lib/supabase';
import { getBill } from '../lib/legiscan';
import { useZip } from '../context/ZipContext';
import BillCard from '../components/BillCard';


// LegiScan status IDs where no further action is possible
const NON_ACTIONABLE_STATUSES = new Set([3, 4, 5, 6, 8, 11]); // Enrolled, Passed, Vetoed, Failed, Chaptered, Report DNP

const SORT_OPTIONS = [
  { value: 'urgent',  label: 'Most Urgent First' },
  { value: 'newest',  label: 'Most Recent Activity' },
  { value: 'oldest',  label: 'Least Recent Activity' },
  { value: 'state',   label: 'State A–Z' },
];

const URGENCY_ORDER = { high: 0, medium: 1, low: 2 };

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [legiDataMap, setLegiDataMap] = useState({});
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('urgent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchParams] = useSearchParams();
  const { setZip } = useZip();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await getFeaturedBills();
      if (error) {
        setError('Failed to load bills. Please try again.');
        setLoading(false);
        return;
      }
      setBills(data || []);
      setLoading(false);
      for (const bill of (data || [])) {
        let cached = await getCachedLegiScanData(bill.legiscan_bill_id);
        if (!cached) {
          const fetched = await getBill(bill.legiscan_bill_id);
          if (fetched) {
            await setCachedLegiScanData(bill.legiscan_bill_id, fetched);
            cached = fetched;
          }
        }
        if (cached) {
          // If LegiScan reports a non-actionable status, silently deactivate and hide
          if (NON_ACTIONABLE_STATUSES.has(cached.status)) {
            deactivateBill(bill.id);
            setBills(prev => prev.filter(b => b.id !== bill.id));
            continue;
          }
          setLegiDataMap(prev => ({ ...prev, [bill.legiscan_bill_id]: cached }));
        }
      }
    }
    load();
  }, []);

  useEffect(() => {
    const zipParam = searchParams.get('zip');
    if (!zipParam || !zipParam.match(/^\d{5}$/)) return;

    setZip(zipParam);

    async function resolveState() {
      try {
        const res = await fetch(`https://api.zippopotam.us/us/${zipParam}`);
        if (res.ok) {
          const data = await res.json();
          const state = data.places?.[0]?.['state abbreviation'];
          if (state) setActiveFilters(new Set(['US', state.toUpperCase()]));
        }
      } catch (e) {
        console.warn('Zip geocode failed:', e);
      }
    }

    resolveState();
  }, [searchParams]);

  function toggleFilter(s) {
    if (s === 'all') { setActiveFilters(new Set()); return; }
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  const states = ['all', 'US', ...Array.from(new Set((bills || []).filter(b => b.state !== 'US').map(b => b.state))).sort()];

  // Apply filters: state, topic, search — all must pass (AND between categories)
  let filtered = bills;

  if (activeFilters.size > 0) {
    filtered = filtered.filter(b => activeFilters.has(b.state));
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(b =>
      (b.custom_title || '').toLowerCase().includes(q) ||
      (b.why_it_matters || '').toLowerCase().includes(q)
    );
  }

  // Sort — applied after all filters
  filtered = [...filtered].sort((a, b) => {
    if (sort === 'urgent') {
      return (URGENCY_ORDER[a.urgency] ?? 3) - (URGENCY_ORDER[b.urgency] ?? 3);
    }
    if (sort === 'newest' || sort === 'oldest') {
      const getDate = (billId) => {
        const ld = legiDataMap[billId];
        if (!ld) return '';
        // Prefer history array (most reliable); fall back to top-level field
        const history = ld.history || [];
        const fromHistory = history.length > 0 ? history[history.length - 1].date : '';
        const topLevel = (ld.last_action_date && ld.last_action_date !== '0000-00-00')
          ? ld.last_action_date : '';
        return fromHistory || topLevel;
      };
      const da = getDate(a.legiscan_bill_id);
      const db = getDate(b.legiscan_bill_id);
      // Dates are 'YYYY-MM-DD' so lexicographic comparison is correct
      return sort === 'newest' ? db.localeCompare(da) : da.localeCompare(db);
    }
    if (sort === 'state') {
      // Federal bills always go last
      if (a.state === 'US' && b.state !== 'US') return 1;
      if (a.state !== 'US' && b.state === 'US') return -1;
      return (a.state || '').localeCompare(b.state || '');
    }
    return 0;
  });

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-500">Loading bills...</div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-center text-red-600">{error}</div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-navy mb-2">Active Bills</h1>
        <p className="text-gray-600">Animal welfare legislation that needs your voice right now.</p>
      </div>

      {/* Search bar */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search bills…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
        />
      </div>

      {/* State filter pills */}
      <div className="flex gap-2 flex-wrap mb-8">
        {states.map(s => {
          const isActive = s === 'all' ? activeFilters.size === 0 : activeFilters.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                isActive
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-navy'
              }`}
            >
              {s === 'all' ? 'All Bills' : s === 'US' ? 'Federal' : s}
            </button>
          );
        })}
      </div>

      {/* Sort — floated right, above the third column */}
      <div className="flex justify-end mb-3">
        <div className="relative">
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg pl-4 pr-10 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent bg-white cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
            ▾
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No bills match your filters.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(bill => (
            <BillCard
              key={bill.id}
              bill={bill}
              legiData={legiDataMap[bill.legiscan_bill_id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
