import { useState } from 'react';
import { useZip } from '../context/ZipContext';
import ZipInput from './ZipInput';
import RepCard from './RepCard';
import { filterRepsForBill } from '../lib/civic';

export default function EmailComposer({ bill, legiData }) {
  const { zip } = useZip();
  const [localReps, setLocalReps] = useState(null);
  const [localState, setLocalState] = useState(null);

  function formatRepName(name) {
    if (!name) return name;
    // Convert "Last, First" → "First Last"
    if (name.includes(',')) {
      const [last, first] = name.split(',').map(s => s.trim());
      return first ? `${first} ${last}` : last;
    }
    return name;
  }

  function buildEmailBody(rep) {
    const billName = bill.custom_title || legiData?.title || `Bill #${bill.legiscan_bill_id}`;
    const userZip  = zip || '[your zip]';
    const repName  = formatRepName(rep.name);

    const source = bill.email_template || bill.email_body || '';

    // Strip any greeting or sign-off already embedded in the stored template
    let body = source
      .replace(/^Dear\s[^\n]*,\s*\n+/i, '')
      .replace(/\n+Sincerely,\n[\s\S]*$/i, '')
      .replace(/\n+A concerned constituent from[^\n]*$/i, '')
      .trimEnd();

    // Replace placeholders
    body = body
      .replace(/{{bill_name}}/g, billName)
      .replace(/{{user_zip}}/g, userZip)
      .replace(/{{rep_name}}/g, repName)
      .replace(/My name is a constituent/g, 'I am a constituent');

    return `Dear ${repName},\n\n${body}\n\nA concerned constituent from ${userZip}`;
  }

  function handleRepsLoaded(reps, state) {
    setLocalReps(reps);
    setLocalState(state);
  }

  const filteredReps = localReps ? filterRepsForBill(localReps, bill.state, localState) : null;
  const wrongState = filteredReps === null && localReps !== null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy mb-2">Contact Your Representatives</h2>
        <ZipInput onRepsLoaded={handleRepsLoaded} scope={bill.state === 'US' ? 'federal' : 'state'} />
      </div>

      {wrongState && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">This is a {bill.state} state bill.</p>
          <p>Only {bill.state} residents can directly influence this one — but you can share it with someone who lives there.</p>
        </div>
      )}

      {filteredReps && filteredReps.length > 0 && (
        <div className="space-y-4">
          {filteredReps.map((rep, i) => (
            <RepCard
              key={i}
              rep={rep}
              emailSubject={bill.email_subject}
              emailBody={buildEmailBody(rep)}
            />
          ))}
        </div>
      )}

      {filteredReps && filteredReps.length === 0 && (
        <p className="text-gray-500 text-sm">No representatives found for this zip code and bill scope.</p>
      )}
    </div>
  );
}
