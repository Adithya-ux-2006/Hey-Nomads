import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { auth } from '../lib/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await auth.signUp({ email, password, name });
      if (authError) throw new Error(authError.message);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-bg px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary">Join Hey Nomads</h1>
          <p className="text-text-secondary mt-1">Start your relocation journey</p>
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="text-xs font-bold tracking-wider text-text-muted uppercase mb-1.5 block">Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20 transition-all"
              placeholder="Your name" />
          </div>
          <div>
            <label className="text-xs font-bold tracking-wider text-text-muted uppercase mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20 transition-all"
              placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-xs font-bold tracking-wider text-text-muted uppercase mb-1.5 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20 transition-all"
              placeholder="Min 6 characters" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-brand-coral hover:bg-brand-coral-dark text-white font-bold py-3.5 rounded-xl transition-all shadow-coral disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted">
          Already have an account? <Link to="/login" className="text-brand-coral font-semibold hover:underline">Log in</Link>
        </p>
      </motion.div>
    </div>
  );
}
