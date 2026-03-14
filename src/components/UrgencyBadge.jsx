const TOOLTIPS = {
  high:   'Vote or deadline approaching — act now',
  medium: 'Moving through the legislature',
  low:    'Early stage — worth watching',
};

export default function UrgencyBadge({ urgency }) {
  const config = {
    high:   { label: 'Urgent',  className: 'bg-orange text-white' },
    medium: { label: 'Active',  className: 'bg-blue-600 text-white' },
    low:    { label: 'Monitor', className: 'bg-gray-400 text-white' },
  };
  const { label, className } = config[urgency] || config.medium;
  const tooltip = TOOLTIPS[urgency] || TOOLTIPS.medium;

  return (
    <span className="relative group inline-flex">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide cursor-default ${className}`}>
        {label}
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 rounded bg-gray-900 px-2.5 py-1.5 text-xs text-white text-center leading-snug opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg whitespace-normal">
        {tooltip}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
