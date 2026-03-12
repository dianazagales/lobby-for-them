export default function UrgencyBadge({ urgency }) {
  const config = {
    high: { label: 'Urgent', className: 'bg-orange text-white' },
    medium: { label: 'Active', className: 'bg-blue-600 text-white' },
    low: { label: 'Monitor', className: 'bg-gray-400 text-white' },
  };
  const { label, className } = config[urgency] || config.medium;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}
