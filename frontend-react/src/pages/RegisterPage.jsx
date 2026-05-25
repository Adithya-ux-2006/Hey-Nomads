import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Input, Spinner } from '../components/UI';
import { User, Mail, Lock, Home, ArrowRight, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { auth } from '../utils/api';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: signUpData, error: supabaseError } = await auth.signUp({
        email: formData.email,
        password: formData.password,
        name: formData.name,
      });

      if (supabaseError) {
        throw new Error(supabaseError.message || 'Supabase signup failed');
      }

      const supabaseUser = signUpData?.user;
      if (!supabaseUser?.id || !supabaseUser?.email) {
        throw new Error('Supabase signup succeeded but user payload was missing');
      }

      auth.setUserId(supabaseUser.id);
      auth.setUserName(formData.name);
      const hasSession = !!signUpData?.session;
      if (hasSession) {
        localStorage.setItem('supabaseSession', 'true');
      }
      setSuccess(true);
      
      setTimeout(() => {
        navigate(hasSession ? '/edit-profile' : '/login');
      }, 1200);
    } catch (err) {
      setError(err.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden bg-white">
      {/* Left: Hero Image - Cinematic gradient */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-brand-warm via-brand-primary to-orange-600 overflow-hidden items-center justify-center"
      >
        {/* Animated gradient overlay */}
        <motion.div
          animate={{ 
            rotate: [0, 5, 0],
            scale: [1, 1.05, 1]
          }}
          transition={{ repeat: Infinity, duration: 8 }}
          className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
        />
        
        {/* Warm light rays */}
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%),
                            radial-gradient(circle at 80% 80%, rgba(255,165,0,0.1) 0%, transparent 50%)`
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center text-white px-8">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-lg border border-white/30 mb-6">
              <Home size={40} className="text-white" />
            </div>
            <h2 className="text-5xl font-display font-bold mb-3">Hey Nomads</h2>
            <p className="text-xl text-white/90 font-light">Find your perfect roommate</p>
            <p className="text-white/70 text-sm mt-4 max-w-xs mx-auto">
              Connect with compatible roommates based on lifestyle, budget, and living habits
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Right: Register Form */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-12"
      >
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold text-text-primary mb-2">Create account</h1>
            <p className="text-text-muted">Join Hey Nomads today</p>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-300 rounded-xl text-red-700 text-sm font-medium"
            >
              {error}
            </motion.div>
          )}

          {/* Success State */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <motion.div
                animate={{ scale: [0.8, 1.1, 1], rotate: [0, 10, 0] }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CheckCircle className="text-status-success" size={48} />
              </motion.div>
              <p className="mt-4 text-lg font-semibold text-text-primary">Account Created!</p>
              <p className="text-text-muted text-sm mt-2">Redirecting to profile setup...</p>
            </motion.div>
          )}

          {/* Form */}
          {!success && (
            <motion.form
              onSubmit={handleRegister}
              className="space-y-5"
            >
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">Full name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    type="text"
                    name="name"
                    className="input pl-10"
                    placeholder="e.g. Priya Sharma"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    type="email"
                    name="email"
                    className="input pl-10"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    type={showPass ? 'text' : 'password'}
                    name="password"
                    className="input pl-10 pr-10"
                    placeholder="Min. 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </motion.button>
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center mt-6 py-3.5 text-sm font-semibold"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight size={18} />
                  </>
                )}
              </motion.button>
            </motion.form>
          )}

          {/* Sign In Link */}
          {!success && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 text-center text-sm text-text-muted"
            >
              Already have an account?{' '}
              <Link to="/login" className="text-brand-primary font-semibold hover:text-brand-warm transition-colors">
                Sign in
              </Link>
            </motion.p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
