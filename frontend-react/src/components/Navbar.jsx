import { NavLink, useNavigate } from 'react-router-dom';
import { Compass, Users, MessageCircle, User, LogOut, Map, Calendar } from 'lucide-react';
import { auth } from '../lib/api';

const navItems = [
  { to: '/discover', icon: Compass, label: 'Discover' },
  { to: '/roommates', icon: Users, label: 'Roommates' },
  { to: '/communities', icon: Map, label: 'Communities' },
  { to: '/messages', icon: MessageCircle, label: 'Messages' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const handleLogout = () => {
    auth.logout();
    navigate('/login');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-surface-border z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1 safe-area-inset-bottom">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-brand-coral'
                  : 'text-text-muted hover:text-text-secondary'
              }`
            }
          >
            <Icon size={22} strokeWidth={isActive => isActive ? 2.5 : 1.8} />
            <span className="text-[10px] font-semibold tracking-wide">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-text-muted hover:text-status-error transition-colors"
        >
          <LogOut size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-semibold tracking-wide">Logout</span>
        </button>
      </div>
    </nav>
  );
}
