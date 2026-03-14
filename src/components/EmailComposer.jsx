import { useState } from 'react';
import { useZip } from '../context/ZipContext';
import ZipInput from './ZipInput';
import RepCard from './RepCard';
import { filterRepsForBill } from '../lib/civic';

export default function EmailComposer({ bill, legiData }) {
  const { reps, userState } = useZip();
  const [localReps, setLocalReps] = useState(reps);
  const [localState, setLocalState] = useState(userState);
  const { zip } = useZip();

  function buildEmailBody(rep) {
    const billName = bill.custom_title || legiData?.title || `Bill #${bill.legiscan_bill_id}`;
    const userZip  = zip || '[your zip]';

    if (bill.email_template) {
      // New format: body-only template — add greeting and sign-off dynamically
      const body = bill.email_template
        .replace(/{{bill_name}}/g, billName)
        .replace(/{{user_zip}}/g, userZip);
      return `Dear ${rep.name},\n\n${body}\n\nA concerned constituent from ${userZip}`;
    }

    // Legacy fallback: email_body contains the full template with placeholders
    return (bill.email_body || '')
      .replace(/{{bill_name}}/g, billName)
      .replace(/{{user_zip}}/g, userZip)
      .replace(/{{rep_name}}/g, rep.name)
      .replace(/My name is a constituent/g, 'I am a constituent');
  }

  function handleRepsLoaded(newReps, state) {
    setLocalReps(newReps);
    setLocalState(state);
  }

  const filteredReps = localReps ? filterRepsForBill(localReps, bill.state, localState) : null;
  const wrongState = filteredReps === null && localReps !== null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy mb-2">Contact Your Representatives</h2>
        <ZipInput onRepsLoaded={handleRepsLoaded} />
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
