import { NavLink, useNavigate } from 'react-router-dom';
import { Compass, Users, MessageCircle, User, Map } from 'lucide-react';
import { auth } from '../lib/api';

const navItems = [
  { to: '/discover', icon: Compass, label: 'Discover' },
  { to: '/roommates', icon: Users, label: 'Roommates' },
  { to: '/communities', icon: Map, label: 'Communities' },
  { to: '/messages', icon: MessageCircle, label: 'Messages' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const secondaryItems = [
  { to: '/matches', label: 'Matches' },
  { to: '/shortlist', label: 'Shortlist' },
  { to: '/events', label: 'Events' },
  { to: '/settle', label: 'Checklist' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const handleLogout = () => {
    auth.logout();
    navigate('/login');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-surface-border z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto px-2">
        <div className="flex items-center justify-around py-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
              // Children-as-function gives us isActive in scope, so the icon weight
              // can reflect state instead of being handed a function to strokeWidth.
              children={({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    className={isActive ? 'text-brand-coral' : 'text-text-muted'}
                    aria-hidden="true"
                  />
                  <span className={`text-xs font-semibold ${isActive ? 'text-brand-coral' : 'text-text-muted'}`}>
                    {label}
                  </span>
                </>
              )}
            />
          ))}
        </div>

        {/* Secondary row. Matches, shortlist, events and the settling-in checklist
          were only reachable from detail pages and fallback branches, which
          made the shortlist in particular impossible to get back to. */}
        <div className="flex items-center justify-around pb-1.5">
          {secondaryItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                  isActive ? 'text-brand-coral' : 'text-text-muted hover:text-text-secondary'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-semibold px-2 py-1 rounded-lg text-text-muted hover:text-status-error transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}