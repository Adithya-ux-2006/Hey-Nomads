import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { auth } from '../lib/api';

export default function LoginPage() {
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
      const { data, error: authError } = await auth.signIn({ email, password });
      if (authError) throw new Error(authError.message || 'Invalid credentials');
      navigate('/discover', { replace: true });
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-bg font-body">
      {/* Left: Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-coral via-brand-coral-dark to-brand-teal items-center justify-center p-16">
        <div className="max-w-md text-white">
          <h1 className="text-5xl font-display font-bold leading-tight mb-6">
            Find your place.<br/>Find your people.
          </h1>
          <p className="text-white/80 text-lg leading-relaxed">
            The relocation companion for people starting a new chapter somewhere unfamiliar.
          </p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-text-primary">Welcome back</h1>
            <p className="text-text-secondary mt-1">Log in to your account</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">{error}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs font-bold tracking-wider text-text-muted uppercase mb-1.5 block">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20 transition-all"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-bold tracking-wider text-text-muted uppercase mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 pr-10 text-text-primary outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20 transition-all"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-brand-coral hover:bg-brand-coral-dark text-white font-bold py-3.5 rounded-xl transition-all shadow-coral disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <p className="text-center text-sm text-text-muted">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-coral font-semibold hover:underline">Sign up</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
