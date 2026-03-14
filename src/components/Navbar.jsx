import { Link, NavLink } from 'react-router-dom';

function CapitolLogo() {
  const cols = [12, 28, 44, 60, 76];

  return (
    <svg viewBox="0 0 100 78" width="30" height="24" xmlns="http://www.w3.org/2000/svg" fill="white" style={{ display: 'block', paddingBottom: '3px' }}>
      {/* Pediment triangle */}
      <polygon points="6,26 50,4 94,26" />

      {/* Upper entablature — two bands with a gap between */}
      <rect x="6" y="26" width="88" height="5" rx="2" />
      <rect x="8" y="33" width="84" height="3" rx="1" />

      {/* 5 columns */}
      {cols.map((x, i) => (
        <g key={i}>
          <rect x={x}     y="36" width="12" height="5" rx="2" />
          <rect x={x + 2} y="41" width="8"  height="21" />
          <rect x={x}     y="62" width="12" height="5" rx="2" />
        </g>
      ))}

      {/* Lower steps — two bands */}
      <rect x="6" y="68" width="88" height="4" rx="2" />
      <rect x="2" y="73" width="96" height="5" rx="2" />
    </svg>
  );
}

const navLinkClass = ({ isActive }) =>
  `text-sm font-medium transition-colors ${
    isActive ? 'text-orange border-b-2 border-orange pb-0.5' : 'hover:text-orange'
  }`;

export default function Navbar() {
  return (
    <nav className="bg-navy text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <CapitolLogo />
          <span className="font-bold text-xl tracking-tight">Lobby for Them</span>
        </Link>
        <div className="flex items-center gap-6">
          <NavLink to="/bills" className={navLinkClass}>Bills</NavLink>
          <NavLink to="/about" className={navLinkClass}>About</NavLink>
          <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>
        </div>
      </div>
    </nav>
  );
}
