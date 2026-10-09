import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
      const { error: authError } = await auth.signUp({ email, password, name });
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
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary">Join Hey Nomads</h1>
          <p className="text-text-secondary mt-1">Start your relocation journey</p>
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label htmlFor="reg-name" className="text-sm font-semibold text-text-primary mb-1.5 block">Full Name</label>
            <input id="reg-name" type="text" value={name} onChange={e => setName(e.target.value)} required maxLength={100}
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20 transition-all"
              placeholder="Your name" />
          </div>
          <div>
            <label htmlFor="reg-email" className="text-sm font-semibold text-text-primary mb-1.5 block">Email</label>
            <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20 transition-all"
              placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="reg-password" className="text-sm font-semibold text-text-primary mb-1.5 block">Password</label>
            {/* 8, not 6: the API rejects anything shorter, so the form used to pass
                validation and then fail on submit. bcrypt also truncates past
                72 bytes, so the upper bound matters. */}
            <input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              required minLength={8} maxLength={72}
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20 transition-all"
              placeholder="8 to 72 characters" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-brand-coral hover:bg-brand-coral-dark text-white font-bold py-3.5 rounded-xl transition-all shadow-coral disabled:opacity-50">
            {loading ? 'Creating your account' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted">
          Already have an account? <Link to="/login" className="text-brand-coral font-semibold hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
