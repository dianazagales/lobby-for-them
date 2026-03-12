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

  function fillTemplate(template) {
    const billName = bill.custom_title || legiData?.title || `Bill #${bill.legiscan_bill_id}`;
    return (template || '')
      .replace(/{{bill_name}}/g, billName)
      .replace(/{{user_zip}}/g, zip || '[your zip]');
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
              emailBody={fillTemplate(bill.email_body).replace(/{{rep_name}}/g, rep.name)}
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
