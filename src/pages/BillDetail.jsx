import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBillById, getCachedLegiScanData, setCachedLegiScanData } from '../lib/supabase';
import { getBill, formatBillStatus } from '../lib/legiscan';
import UrgencyBadge from '../components/UrgencyBadge';
import EmailComposer from '../components/EmailComposer';

export default function BillDetail() {
  const { id } = useParams();
  const [bill, setBill] = useState(null);
  const [legiData, setLegiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await getBillById(id);
      if (error || !data) {
        setError('Bill not found.');
        setLoading(false);
        return;
      }
      setBill(data);
      // Load LegiScan data
      let cached = await getCachedLegiScanData(data.legiscan_bill_id);
      if (!cached) {
        const fetched = await getBill(data.legiscan_bill_id);
        if (fetched) {
          await setCachedLegiScanData(data.legiscan_bill_id, fetched);
          cached = fetched;
        }
      }
      setLegiData(cached);
      setLoading(false);
    }
    load();
  }, [id]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  function shareTwitter() {
    const title = bill?.custom_title || `Bill #${bill?.legiscan_bill_id}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Help animals — contact your reps about: ${title}`)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  }

  function shareFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    alert('Link copied!');
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>
  );
  if (error || !bill) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center text-red-600">{error || 'Bill not found.'}</div>
  );

  const title = bill.custom_title || legiData?.title || `Bill #${bill.legiscan_bill_id}`;
  const sponsor = legiData?.sponsors?.[0];
  const lastAction = legiData?.history?.[legiData.history.length - 1];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link to="/bills" className="text-orange hover:underline text-sm font-medium block mb-6">
        ← Back to all bills
      </Link>

      {/* Bill header */}
      <div className="mb-8">
        <div className="flex gap-2 flex-wrap mb-3">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${bill.state === 'US' ? 'bg-navy text-white' : 'bg-gray-700 text-white'}`}>
            {bill.state === 'US' ? 'FEDERAL' : bill.state}
          </span>
          <UrgencyBadge urgency={bill.urgency} />
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-navy leading-tight mb-4">{title}</h1>

        {legiData && (
          <div className="bg-warm-white rounded-xl p-5 space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <span className="font-semibold text-gray-700">Status: </span>
                <span className="text-gray-600">{formatBillStatus(legiData.status)}</span>
              </div>
              {sponsor && (
                <div>
                  <span className="font-semibold text-gray-700">Sponsor: </span>
                  <span className="text-gray-600">{sponsor.name}</span>
                </div>
              )}
              {lastAction && (
                <div>
                  <span className="font-semibold text-gray-700">Last Action: </span>
                  <span className="text-gray-600">{lastAction.action} ({new Date(lastAction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</span>
                </div>
              )}
            </div>
            {legiData.url && (
              <a href={legiData.url} target="_blank" rel="noopener noreferrer" className="text-orange hover:underline text-xs font-medium">
                Read full bill text ↗
              </a>
            )}
          </div>
        )}
      </div>

      {/* Why it matters */}
      <div className="mb-10">
        <h2 className="text-xl font-bold text-navy mb-3">Why This Matters</h2>
        <p className="text-gray-700 leading-relaxed whitespace-pre-line">{bill.why_it_matters}</p>
      </div>

      {/* Email composer */}
      <div className="mb-10">
        <EmailComposer bill={bill} legiData={legiData} />
      </div>

      {/* Share */}
      <div className="border-t border-gray-200 pt-8">
        <h3 className="font-semibold text-navy mb-4">Share This Bill</h3>
        <div className="flex gap-3 flex-wrap">
          <button onClick={shareTwitter} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors">
            Share on X
          </button>
          <button onClick={shareFacebook} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
            Share on Facebook
          </button>
          <button onClick={copyLink} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:border-navy transition-colors">
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}
