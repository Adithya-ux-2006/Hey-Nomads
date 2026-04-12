import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, MessageSquare, User, LogOut, Heart } from 'lucide-react';
import { auth } from '../utils/api';

const Navbar = ({ activePage }) => {
  const location = useLocation();
  const active = activePage || (() => {
    if (location.pathname.startsWith('/inbox')) return 'inbox';
    if (location.pathname.startsWith('/profile')) return 'profile';
    if (location.pathname.startsWith('/shortlist')) return 'shortlist';
    if (location.pathname.startsWith('/compare')) return 'shortlist';
    if (location.pathname.startsWith('/agreement')) return 'shortlist';
    return 'discover';
  })();

  const handleLogout = () => {
    auth.logout();
    window.location.href = '/login';
  };

  const items = [
    { key: 'discover',  to: '/discover',  Icon: Home,          label: 'Discover' },
    { key: 'shortlist', to: '/shortlist', Icon: Heart,         label: 'Shortlist' },
    { key: 'inbox',     to: '/inbox',     Icon: MessageSquare, label: 'Messages' },
    { key: 'profile',   to: '/profile',   Icon: User,          label: 'Profile'  },
  ];

  return (
    <nav className="navbar">
      <div className="max-w-md mx-auto flex items-center justify-around px-4">
        {items.map(({ key, to, Icon, label }) => {
          const isActive = active === key;
          return (
            <Link
              key={key}
              to={to}
              id={`nav-${key}`}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all ${
                isActive
                  ? 'text-brand-warm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-brand-secondary' : 'bg-transparent'}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span className={`text-[10px] font-semibold ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                {label}
              </span>
            </Link>
          );
        })}

        <button
          onClick={handleLogout}
          id="nav-logout"
          className="flex flex-col items-center gap-1 py-1 px-4 rounded-2xl text-text-muted hover:text-red-400 transition-all"
        >
          <div className="p-2 rounded-xl">
            <LogOut size={20} strokeWidth={1.8} />
          </div>
          <span className="text-[10px] font-semibold opacity-0">Out</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
