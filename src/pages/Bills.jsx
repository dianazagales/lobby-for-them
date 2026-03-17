import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFeaturedBills, getCachedLegiScanData, setCachedLegiScanData, deactivateBill } from '../lib/supabase';
import { getBill } from '../lib/legiscan';
import { useZip } from '../context/ZipContext';
import BillCard from '../components/BillCard';
import { ALL_STATES, STATE_NAMES, getSessionStatus, isInSession } from '../lib/sessionDates';


// LegiScan status IDs where no further action is possible
const NON_ACTIONABLE_STATUSES = new Set([3, 4, 5, 6, 8, 11]); // Enrolled, Passed, Vetoed, Failed, Chaptered, Report DNP

const URGENCY_ORDER = { high: 0, medium: 1, low: 2 };

function CalendarIcon() {
  return (
    <svg className="w-3 h-3 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function EmptyStateRow({ abbr }) {
  const name = STATE_NAMES[abbr] || abbr;
  const sessionInfo = getSessionStatus(abbr);
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <span className="text-sm text-gray-500">
        <span className="font-medium">{name}</span> — no active bills tracked right now.
      </span>
      {sessionInfo && (
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <CalendarIcon />
          {sessionInfo}
        </span>
      )}
    </div>
  );
}

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [legiDataMap, setLegiDataMap] = useState({});
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [search, setSearch] = useState('');
  const [showAllStates, setShowAllStates] = useState(false);
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

  // Set of state codes that have at least one active bill in the DB
  const statesWithBills = new Set(bills.map(b => b.state));

  // Full pill list: All, Federal, then states filtered by has-bills or show-all toggle
  // Always include states the user already has selected so pills don't vanish on toggle
  const visibleStates = showAllStates
    ? ALL_STATES
    : ALL_STATES.filter(s => statesWithBills.has(s) || activeFilters.has(s));
  const statesList = ['all', 'US', ...visibleStates];

  // Apply filters
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

  // Sort by urgency (hardcoded: most urgent first)
  filtered = [...filtered].sort((a, b) =>
    (URGENCY_ORDER[a.urgency] ?? 3) - (URGENCY_ORDER[b.urgency] ?? 3)
  );

  // Selected state filters that have zero bills in the DB (not search-narrowed — DB-level)
  const emptySelectedStates = activeFilters.size > 0
    ? [...activeFilters].filter(s => s !== 'US' && !statesWithBills.has(s)).sort()
    : [];

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-500">Loading bills...</div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-center text-red-600">{error}</div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-navy mb-3">Active Bills</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Include states without bills</span>
          <button
            role="switch"
            aria-checked={showAllStates}
            onClick={() => setShowAllStates(v => !v)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              showAllStates ? 'bg-orange' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
              showAllStates ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </button>
        </div>
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

      {/* State filter pills — dim pills for states with no bills */}
      <div className="flex gap-2 flex-wrap mb-8">
        {statesList.map(s => {
          const isActive  = s === 'all' ? activeFilters.size === 0 : activeFilters.has(s);
          const hasBills  = s === 'all' || s === 'US' || statesWithBills.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                isActive
                  ? 'bg-navy text-white border-navy'
                  : hasBills
                    ? 'bg-white text-gray-600 border-gray-300 hover:border-navy'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-navy'
              }`}
            >
              {s === 'all' ? 'All Bills' : s === 'US' ? 'Federal' : s}
            </button>
          );
        })}
      </div>

      {/* Bill grid */}
      {filtered.length > 0 && (
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

      {/* No bills match search/filters (only when no empty-state cards to show) */}
      {filtered.length === 0 && emptySelectedStates.length === 0 && (
        <p className="text-gray-500 text-center py-12">No bills match your filters.</p>
      )}

      {/* Session info for selected states with no tracked bills */}
      {emptySelectedStates.length > 0 && (
        <div className={`text-center ${filtered.length > 0 ? 'mt-10 pt-6 border-t border-gray-100' : 'py-8'}`}>
          <div className="inline-block text-left divide-y divide-gray-100">
            {emptySelectedStates.map(abbr => (
              <EmptyStateRow key={abbr} abbr={abbr} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
