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
  { to: '/agreements', label: 'Agreements' },
  { to: '/living-dna', label: 'Living DNA' },
  { to: '/events', label: 'Events' },
  { to: '/settle', label: 'Checklist' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const handleLogout = () => {
    auth.logout();
    navigate('/login');
  };

  // The signed-out visitor can only reach the landing and demo pages, so the
  // private links and the Log out control would do nothing but point them at a
  // sign-in form. Re-evaluated on every route change, which is when login and
  // logout also navigate.
  if (!auth.isAuthenticated()) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-surface-border z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <NavLink
            to="/login"
            className="px-5 py-2.5 rounded-xl bg-brand-coral text-white text-sm font-bold hover:bg-brand-coral-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
          >
            Log in
          </NavLink>
          <NavLink
            to="/register"
            className="px-5 py-2.5 rounded-xl border border-surface-border text-text-secondary text-sm font-bold hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
          >
            Create account
          </NavLink>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-surface-border z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto px-2">
        <div className="flex items-center justify-around py-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 px-1 sm:px-3 py-2 rounded-xl transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
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
          made the shortlist in particular impossible to get back to.
          Seven links cannot fit a 360px phone in one line -- "Log out" sat past
          the right edge and was unreachable -- so this row wraps instead of
          clipping. Nothing is hidden behind a swipe. */}
        <div className="flex flex-wrap items-center justify-center gap-x-1 pb-1.5">
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