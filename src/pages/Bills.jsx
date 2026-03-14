import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFeaturedBills, getCachedLegiScanData, setCachedLegiScanData } from '../lib/supabase';
import { getBill } from '../lib/legiscan';
import { getRepresentatives } from '../lib/civic';
import { useZip } from '../context/ZipContext';
import BillCard from '../components/BillCard';

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [legiDataMap, setLegiDataMap] = useState({});
  const [activeFilters, setActiveFilters] = useState(new Set()); // empty = show all
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchParams] = useSearchParams();
  const { setZip, setReps, setUserState } = useZip();

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
      // Fetch LegiScan data for each bill
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
          setLegiDataMap(prev => ({ ...prev, [bill.legiscan_bill_id]: cached }));
        }
      }
    }
    load();
  }, []);

  // Auto-lookup reps and filter by state when ?zip= is in the URL
  useEffect(() => {
    const zipParam = searchParams.get('zip');
    if (!zipParam || !zipParam.match(/^\d{5}$/)) return;

    setZip(zipParam);

    // Geocode zip directly to get state for filtering — fast, no auth, independent of rep APIs
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

    // Fetch reps in background for the email composer on bill detail pages
    async function resolveReps() {
      const { reps, state } = await getRepresentatives(zipParam);
      if (reps) setReps(reps);
      if (state) setUserState(state);
    }

    resolveState();
    resolveReps();
  }, [searchParams]);

  const states = ['all', 'US', ...Array.from(new Set((bills || []).filter(b => b.state !== 'US').map(b => b.state))).sort()];

  const filtered = activeFilters.size === 0
    ? bills
    : bills.filter(b => activeFilters.has(b.state));

  function toggleFilter(s) {
    if (s === 'all') {
      setActiveFilters(new Set());
      return;
    }
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-500">
      Loading bills...
    </div>
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

      {/* Filter bar */}
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

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No bills found.</p>
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
