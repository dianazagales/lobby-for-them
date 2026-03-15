import { useState } from 'react';

export default function RepCard({ rep, emailSubject, emailBody }) {
  const [body, setBody] = useState(emailBody || '');
  const [copied, setCopied] = useState(false);

  const mailtoLink = rep.email
    ? `mailto:${rep.email}?subject=${encodeURIComponent(emailSubject || '')}&body=${encodeURIComponent(body)}`
    : null;

  async function copyToClipboard() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const partyColor = rep.party?.includes('Republican') ? 'text-red-600' : rep.party?.includes('Democrat') ? 'text-blue-600' : 'text-gray-500';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        {rep.photo && (
          <img src={rep.photo} alt={rep.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
        )}
        <div>
          <p className="font-bold text-navy">{rep.name}</p>
          <p className="text-sm text-gray-600">{rep.office}</p>
          <p className={`text-xs font-medium ${partyColor}`}>{rep.party}</p>
          {rep.phone && <p className="text-xs text-gray-400 mt-0.5">{rep.phone}</p>}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
          Email (editable)
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-orange resize-y font-mono"
        />
      </div>
      <div className="flex gap-3 flex-wrap">
        {mailtoLink && (
          <a
            href={mailtoLink}
            className="bg-orange hover:bg-orange-dark text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Open in Email ↗
          </a>
        )}
        <button
          onClick={copyToClipboard}
          className="border border-gray-300 hover:border-navy text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {copied ? '✓ Copied!' : 'Copy to Clipboard'}
        </button>
        {!mailtoLink && rep.website && (
          <a href={rep.website} target="_blank" rel="noopener noreferrer" className="border border-gray-300 hover:border-navy text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
            Contact via website ↗
          </a>
        )}
      </div>
    </div>
  );
}
