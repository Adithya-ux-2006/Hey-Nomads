import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import DiscoverPage from './pages/DiscoverPage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import InboxPage from './pages/InboxPage';
import RegisterPage from './pages/RegisterPage';
import ShortlistPage from './pages/ShortlistPage';
import ComparePage from './pages/ComparePage';
import AgreementEditor from './pages/AgreementEditor';
import { apiFetch, auth } from './utils/api';
import { Home, Eye, EyeOff } from 'lucide-react';

// ── Private Route ──────────────────────────────────────────────
const PrivateRoute = ({ children }) => {
  const userId = auth.getUserId();
  if (!userId) return <Navigate to="/login" replace />;
  return children;
};

// ── Login Page ─────────────────────────────────────────────────
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (!data.user?.id) throw new Error('Invalid server response');
      auth.setUserId(data.user.id);
      auth.setUserName(data.user.name);
      window.location.href = '/discover';
    } catch (err) {
      setError(err.message || 'Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Warm blobs */}
      <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full bg-brand-secondary opacity-40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-60px] right-[-60px] w-56 h-56 rounded-full bg-brand-accent opacity-30 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card w-full max-w-md p-10 relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-secondary mb-4">
            <Home className="text-brand-warm" size={26} />
          </div>
          <h1 className="text-3xl font-display font-bold text-text-primary">Hey Nomads</h1>
          <p className="text-text-muted text-sm mt-1">Find your perfect roommate</p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 ml-1">Email address</label>
            <input
              id="login-email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 ml-1">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                className="input pr-12"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                onClick={() => setShowPass(v => !v)}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center mt-2 py-3.5 text-sm font-semibold"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          New here?{' '}
          <Link to="/register" className="text-brand-warm font-semibold hover:text-brand-deep transition-colors">
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

// ── App ────────────────────────────────────────────────────────
function App() {
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
