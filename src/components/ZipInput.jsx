import { useState } from 'react';
import { useZip } from '../context/ZipContext';
import { getRepresentatives } from '../lib/civic';

export default function ZipInput({ onRepsLoaded, compact = false }) {
  const { zip, setZip, setReps, setUserState } = useZip();
  const [inputZip, setInputZip] = useState(zip || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!inputZip.match(/^\d{5}$/)) {
      setError('Please enter a valid 5-digit zip code.');
      return;
    }
    setError(null);
    setLoading(true);
    const { reps, error: apiError, state } = await getRepresentatives(inputZip);
    setLoading(false);
    if (apiError) {
      setError(apiError);
      return;
    }
    setZip(inputZip);
    setReps(reps);
    setUserState(state);
    onRepsLoaded?.(reps, state);
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? 'flex gap-2' : 'space-y-3'}>
      <div className={compact ? 'flex gap-2 flex-1' : ''}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Enter your zip code"
          value={inputZip}
          onChange={e => setInputZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
          maxLength={5}
          className={`border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent ${compact ? 'w-36' : 'w-full'}`}
          aria-label="ZIP code"
        />
        <button
          type="submit"
          disabled={loading}
          className={`bg-orange hover:bg-orange-dark text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors disabled:opacity-60 ${compact ? '' : 'w-full'}`}
        >
          {loading ? 'Looking up...' : 'Find My Reps'}
        </button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </form>
  );
}
