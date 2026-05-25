import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import DiscoverPage from './pages/DiscoverPage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import InboxPage from './pages/InboxPage';
import RegisterPage from './pages/RegisterPage';
import ShortlistPage from './pages/ShortlistPage';
import ComparePage from './pages/ComparePage';
import AgreementEditor from './pages/AgreementEditor';
import { auth } from './utils/api';
import { supabase } from './lib/supabase';
import { Home, Eye, EyeOff, ShieldCheck, Calendar, Sparkles } from 'lucide-react';
import heroImg from './assets/hero.png';

// ── Private Route ──────────────────────────────────────────────
const PrivateRoute = ({ children }) => {
  const isAuthenticated = auth.isAuthenticated();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// ── Login Page ─────────────────────────────────────────────────
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data: signInData, error: supabaseError } = await auth.signIn({ email, password });
      if (supabaseError) {
        throw new Error(supabaseError.message || 'Invalid email or password');
      }

      const supabaseUser = signInData?.user;
      if (!supabaseUser?.id || !supabaseUser?.email) {
        throw new Error('Supabase login succeeded but user payload was missing');
      }

      auth.setUserId(supabaseUser.id);
      auth.setUserName(supabaseUser.user_metadata?.name || email.split('@')[0]);
      localStorage.setItem('supabaseSession', 'true');
      navigate('/discover', { replace: true });
    } catch (err) {
      setError(err.message || 'Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-body overflow-hidden">
      {/* Left Pane: Hero Image with warm tint overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 relative bg-cover bg-center items-center"
        style={{ backgroundImage: `url(${heroImg})` }}
      >
        {/* Monochromatic warm orange/red tint overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#FF3A44]/90 via-[#FF5A5F]/85 to-[#FF8C6B]/75 mix-blend-multiply" />
        <div className="absolute inset-0 bg-black/10" />

        {/* Text and horizontal icons overlay */}
        <div className="relative z-10 w-full px-16 flex flex-col justify-between h-full py-16 text-white">
          <div className="my-auto max-w-lg space-y-6">
            <h2 className="text-5xl font-display font-bold leading-tight tracking-tight">
              Find your perfect roommate.
            </h2>
            <p className="text-base text-white/90 leading-relaxed font-light">
              Hey Nomads makes roommate searching effortless. We connect roommate seekers in Mumbai, Delhi, and Bangalore based on lifestyle, budget, and daily routines, ensuring a harmonious living experience in your new city.
            </p>

            {/* Horizontal icons */}
            <div className="flex items-center gap-10 pt-6">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all duration-300">
                  <ShieldCheck size={24} className="text-white" />
                </div>
                <span className="text-[13px] font-semibold text-white/90">Verified</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all duration-300">
                  <Calendar size={24} className="text-white" />
                </div>
                <span className="text-[13px] font-semibold text-white/90">Schedule</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all duration-300">
                  <Sparkles size={24} className="text-white" />
                </div>
                <span className="text-[13px] font-semibold text-white/90">Matches</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Right Pane: Login Form */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-16 bg-white"
      >
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-display font-bold text-[#1E293B] mb-2 tracking-tight">
              Welcome back
            </h1>
            <div className="flex justify-between items-baseline text-sm">
              <span className="text-[#64748B] font-medium">Log in to your account</span>
              <Link to="/register" className="text-[#FF5A5F] hover:text-[#E84E53] font-semibold transition-colors">
                Sign up as tenant
              </Link>
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium"
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email */}
            <div className="flex flex-col">
              <label className="text-[11px] font-bold tracking-wider text-[#94A3B8] uppercase mb-1.5">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                className="w-full bg-transparent border-b-2 border-[#E2E8F0] focus:border-[#FF5A5F] outline-none py-2 px-0 text-[#1E293B] placeholder-[#94A3B8] transition-colors font-medium"
                placeholder="write@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col">
              <div className="flex justify-between items-baseline">
                <label className="text-[11px] font-bold tracking-wider text-[#94A3B8] uppercase mb-1.5">
                  Password
                </label>
                <Link to="#" className="text-xs font-semibold text-[#FF5A5F] hover:text-[#E84E53] transition-colors">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="w-full bg-transparent border-b-2 border-[#E2E8F0] focus:border-[#FF5A5F] outline-none py-2 pr-10 pl-0 text-[#1E293B] placeholder-[#94A3B8] transition-colors font-medium"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                  onClick={() => setShowPass(v => !v)}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF5A5F] hover:bg-[#E84E53] text-white font-bold py-3.5 px-4 rounded-xl text-[13px] tracking-wider uppercase transition-colors shadow-lg shadow-[#FF5A5F]/20 flex items-center justify-center disabled:opacity-55 disabled:cursor-not-allowed mt-4"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  LOGGING IN…
                </span>
              ) : (
                'LOG IN'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]"></div>
            </div>
            <span className="relative px-3 bg-white text-xs font-semibold tracking-wider text-[#94A3B8] uppercase">
              Or continue with
            </span>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              className="flex items-center justify-center gap-2 border border-[#E2E8F0] hover:bg-slate-50 text-[#1E293B] font-bold py-3 px-4 rounded-xl text-sm transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Google
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 border border-[#E2E8F0] hover:bg-slate-50 text-[#1E293B] font-bold py-3 px-4 rounded-xl text-sm transition-colors"
            >
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.58 2.95-1.39z" />
              </svg>
              Apple
            </button>
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] font-medium text-[#94A3B8] text-center leading-relaxed max-w-xs mx-auto">
            By signing in, you agree to our{' '}
            <Link to="#" className="hover:text-[#FF5A5F] underline transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="#" className="hover:text-[#FF5A5F] underline transition-colors">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// ── App ────────────────────────────────────────────────────────
function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { session } = await auth.restoreSession();
      if (!session) {
        auth.clearLocal();
      }
      if (isMounted) {
        setAuthReady(true);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        auth.clearLocal();
      } else {
        localStorage.setItem('supabaseSession', 'true');
        localStorage.setItem('supabaseUserId', session.user.id);
        localStorage.setItem('supabaseEmail', session.user.email || '');
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-600">
        Restoring session...
      </div>
    );
  }

  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/discover" element={<PrivateRoute><DiscoverPage /></PrivateRoute>} />
          <Route path="/profile/:id" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/edit-profile" element={<PrivateRoute><EditProfilePage /></PrivateRoute>} />
          <Route path="/inbox" element={<PrivateRoute><InboxPage /></PrivateRoute>} />
          <Route path="/shortlist" element={<PrivateRoute><ShortlistPage /></PrivateRoute>} />
          <Route path="/compare" element={<PrivateRoute><ComparePage /></PrivateRoute>} />
          <Route path="/agreement/:targetId" element={<PrivateRoute><AgreementEditor /></PrivateRoute>} />
          <Route path="/" element={<Navigate to="/discover" replace />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}

export default App;
