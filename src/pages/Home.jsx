import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getFeaturedBills } from '../lib/supabase';
import UrgencyBadge from '../components/UrgencyBadge';

export default function Home() {
  const [topBills, setTopBills] = useState([]);
  const [zip, setZip] = useState('');
  const [zipError, setZipError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadTopBills() {
      const { data } = await getFeaturedBills();
      const urgent = (data || [])
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3);
        })
        .slice(0, 9);
      setTopBills(urgent);
    }
    loadTopBills();
  }, []);

  function handleZipSubmit(e) {
    e.preventDefault();
    if (!zip.match(/^\d{5}$/)) {
      setZipError('Please enter a valid 5-digit zip code.');
      return;
    }
    navigate(`/bills?zip=${zip}`);
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-navy text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
            Animals Can't Lobby.<br />
            <span className="text-orange">You Can.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-xl mx-auto">
            Find active animal welfare bills and contact your representatives in seconds.
          </p>

          {/* Zip CTA */}
          <form onSubmit={handleZipSubmit} className="flex flex-col items-center gap-3">
            <div className="flex w-full max-w-md shadow-xl rounded-xl overflow-hidden">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter your zip code"
                value={zip}
                onChange={e => {
                  setZipError(null);
                  setZip(e.target.value.replace(/\D/g, '').slice(0, 5));
                }}
                maxLength={5}
                className="flex-1 px-5 py-4 text-lg text-gray-900 placeholder-gray-400 focus:outline-none"
                aria-label="ZIP code"
              />
              <button
                type="submit"
                className="bg-orange hover:bg-orange-dark text-white font-bold text-lg px-7 py-4 transition-colors whitespace-nowrap"
              >
                Find My Bills →
              </button>
            </div>
            {zipError && <p className="text-orange text-sm font-medium">{zipError}</p>}
            <Link to="/bills" className="text-white/70 hover:text-white text-sm underline underline-offset-2 transition-colors">
              See all bills →
            </Link>
          </form>
        </div>
      </section>

      {/* Urgency strip */}
      {topBills.length > 0 && (
        <section className="py-12 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-bold text-navy mb-6">Most Urgent Bills Right Now</h2>
            <div className="grid md:grid-cols-3 gap-5">
              {topBills.map(bill => (
                <Link
                  key={bill.id}
                  to={`/bills/${bill.id}`}
                  className="group block bg-warm-white border border-gray-100 hover:border-orange rounded-xl p-5 transition-colors"
                >
                  <div className="flex gap-2 mb-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${bill.state === 'US' ? 'bg-navy text-white' : 'bg-gray-700 text-white'}`}>
                      {bill.state === 'US' ? 'FEDERAL' : bill.state}
                    </span>
                    <UrgencyBadge urgency={bill.urgency} />
                  </div>
                  <h3 className="font-bold text-navy text-sm group-hover:text-orange transition-colors leading-snug">
                    {bill.custom_title || `Bill #${bill.legiscan_bill_id}`}
                  </h3>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{bill.why_it_matters}</p>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/bills" className="text-orange font-semibold hover:underline text-sm">
                See all active bills →
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
