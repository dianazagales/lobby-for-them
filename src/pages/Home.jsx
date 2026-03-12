import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getFeaturedBills } from '../lib/supabase';
import UrgencyBadge from '../components/UrgencyBadge';

export default function Home() {
  const [topBills, setTopBills] = useState([]);

  useEffect(() => {
    async function loadTopBills() {
      const { data } = await getFeaturedBills();
      const urgent = (data || [])
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3);
        })
        .slice(0, 3);
      setTopBills(urgent);
    }
    loadTopBills();
  }, []);

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
          <Link
            to="/bills"
            className="inline-block bg-orange hover:bg-orange-dark text-white font-bold text-lg px-8 py-4 rounded-xl transition-colors shadow-lg"
          >
            See Active Bills →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-warm-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-navy text-center mb-10">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Browse Active Bills', desc: 'See the animal welfare legislation that needs your voice right now.' },
              { step: '2', title: 'Enter Your Zip Code', desc: 'We find your exact federal and state representatives.' },
              { step: '3', title: 'Send Your Email', desc: 'Use our pre-written email template — customize it, then send in one click.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-orange text-white rounded-full font-extrabold text-xl flex items-center justify-center mx-auto mb-4">
                  {step}
                </div>
                <h3 className="font-bold text-navy text-lg mb-2">{title}</h3>
                <p className="text-gray-600 text-sm">{desc}</p>
              </div>
            ))}
          </div>
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
