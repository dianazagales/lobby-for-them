import { Link } from 'react-router-dom';
import UrgencyBadge from './UrgencyBadge';

const STATE_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
  KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
  MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
  OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
  VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
  DC:'Washington D.C.',
};

// Status IDs where action is no longer possible — never show as Urgent
const TERMINAL_STATUSES = new Set([2, 3, 4, 8]); // Engrossed, Enrolled, Passed, Chaptered

export default function BillCard({ bill, legiData }) {
  const title = bill.custom_title || legiData?.title || `Bill #${bill.legiscan_bill_id}`;
  const status = legiData ? getStatusLabel(legiData.status) : null;
  const urgency = (bill.urgency === 'high' && TERMINAL_STATUSES.has(legiData?.status))
    ? 'medium'
    : bill.urgency;
  const lastAction = legiData?.history?.[legiData.history.length - 1];
  const sponsor = legiData?.sponsors?.[0];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
          <span className="relative group/state inline-flex">
            <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded cursor-default ${bill.state === 'US' ? 'bg-navy text-white' : 'bg-gray-700 text-white'}`}>
              {bill.state === 'US' ? 'FEDERAL' : bill.state}
            </span>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 rounded bg-gray-900 px-2.5 py-1.5 text-xs text-white text-center leading-snug opacity-0 group-hover/state:opacity-100 transition-opacity duration-150 z-50 shadow-lg whitespace-normal">
              {bill.state === 'US' ? 'Federal bill — applies nationwide' : (STATE_NAMES[bill.state] || bill.state)}
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </span>
          </span>
          <UrgencyBadge urgency={urgency} />
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
