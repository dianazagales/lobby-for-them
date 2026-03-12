import { Link, NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-navy text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-xl tracking-tight hover:text-orange transition-colors">
          🐾 Lobby for Them
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <NavLink
            to="/bills"
            className={({ isActive }) =>
              isActive ? 'text-orange border-b-2 border-orange pb-0.5' : 'hover:text-orange transition-colors'
            }
          >
            Bills
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              isActive ? 'text-orange border-b-2 border-orange pb-0.5' : 'hover:text-orange transition-colors'
            }
          >
            About
          </NavLink>
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              isActive ? 'text-orange' : 'text-white/40 hover:text-white/70 transition-colors text-xs'
            }
          >
            Admin
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
