import { Link } from 'react-router-dom';
import UrgencyBadge from './UrgencyBadge';

export default function BillCard({ bill, legiData }) {
  const title = bill.custom_title || legiData?.title || `Bill #${bill.legiscan_bill_id}`;
  const status = legiData ? getStatusLabel(legiData.status) : null;
  const lastAction = legiData?.history?.[legiData.history.length - 1];
  const sponsor = legiData?.sponsors?.[0];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${bill.state === 'US' ? 'bg-navy text-white' : 'bg-gray-700 text-white'}`}>
            {bill.state === 'US' ? 'FEDERAL' : bill.state}
          </span>
          <UrgencyBadge urgency={bill.urgency} />
        </div>
      </div>

      <h3 className="font-bold text-navy text-base leading-snug">{title}</h3>

      {status && (
        <p className="text-xs text-gray-500">
          <span className="font-medium">Status:</span> {status}
          {lastAction && <span className="ml-2">· {formatDate(lastAction.date)}</span>}
        </p>
      )}

      {sponsor && (
        <p className="text-xs text-gray-500">
          <span className="font-medium">Sponsor:</span> {sponsor.name}
        </p>
      )}

      <p className="text-sm text-gray-600 line-clamp-3">{bill.why_it_matters}</p>

      <Link
        to={`/bills/${bill.id}`}
        className="mt-auto inline-block bg-orange hover:bg-orange-dark text-white text-sm font-semibold px-4 py-2 rounded-lg text-center transition-colors"
      >
        Take Action →
      </Link>
    </div>
  );
}

function getStatusLabel(statusId) {
  const statuses = {
    1: 'Introduced',
    2: 'Engrossed',
    3: 'Enrolled',
    4: 'Passed',
    5: 'Vetoed',
    6: 'Failed/Dead',
  };
  return statuses[statusId] || 'In Progress';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
