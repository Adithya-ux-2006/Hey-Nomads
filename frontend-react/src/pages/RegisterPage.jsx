import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Home, ArrowRight } from 'lucide-react';
import { apiFetch } from '../utils/api';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch('/register', { method: 'POST', body: JSON.stringify(formData) });
      navigate('/login?registered=true');
    } catch (err) {
      setError(err.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-80px] right-[-60px] w-72 h-72 rounded-full bg-brand-accent opacity-30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-60px] left-[-60px] w-56 h-56 rounded-full bg-brand-secondary opacity-40 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card w-full max-w-md p-10 relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-secondary mb-4">
            <Home className="text-brand-warm" size={26} />
          </div>
          <h1 className="text-3xl font-display font-bold text-text-primary">Create Account</h1>
          <p className="text-text-muted text-sm mt-1">Join Hey Nomads and find your roommate</p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 ml-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                id="register-name"
                type="text" name="name" className="input pl-10"
                placeholder="e.g. Priya Sharma"
                value={formData.name} onChange={handleChange} required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                id="register-email"
                type="email" name="email" className="input pl-10"
                placeholder="you@example.com"
                value={formData.email} onChange={handleChange} required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                id="register-password"
                type="password" name="password" className="input pl-10"
                placeholder="Min. 6 characters"
                value={formData.password} onChange={handleChange} required minLength={6}
              />
            </div>
          </div>

          <button
            id="register-submit"
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center mt-2 py-3.5 text-sm font-semibold"
          >
            {loading ? 'Creating account…' : <> Create Account <ArrowRight size={16} /> </>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-warm font-semibold hover:text-brand-deep transition-colors">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
