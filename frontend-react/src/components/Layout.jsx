import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exitDemo, isDemo, onDemoChange } from '../lib/demoMode';
import Navbar from './Navbar';

export default function Layout({ children, className = '' }) {
  const navigate = useNavigate();
  const [demo, setDemo] = useState(isDemo());
  useEffect(() => onDemoChange(setDemo), []);

  const leave = () => {
    exitDemo();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface-bg">
      {/* Visible for as long as the tour is on. Without a persistent marker
          every screen in the walkthrough reads as a real account's screen. */}
      {demo && (
        <div className="bg-brand-amber/15 border-b border-brand-amber/30 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-text-primary">Demo Mode — simulated data, nothing is saved</p>
          <button
            type="button"
            onClick={leave}
            className="text-xs font-semibold text-brand-coral underline underline-offset-2 hover:opacity-70"
          >
            Exit demo
          </button>
        </div>
      )}
      <div className={`pb-28 ${className}`}>
        {children}
      </div>
      <Navbar />
    </div>
  );
}
