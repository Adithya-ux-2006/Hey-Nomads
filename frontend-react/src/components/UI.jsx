import React from 'react';
import { motion } from 'framer-motion';

// ── BUTTON COMPONENTS ──────────────────────────────────────────
export const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '', 
  whileHover = {}, 
  whileTap = {}, 
  ...props 
}) => {
  const baseClasses = 'font-semibold inline-flex items-center justify-center gap-2 transition-all';
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };
  const variantClasses = {
    primary: 'bg-brand-primary text-white rounded-full shadow-primary hover:shadow-hover hover:scale-105 active:scale-95',
    secondary: 'border-2 border-surface-border bg-white text-text-primary rounded-full hover:bg-surface-muted hover:border-brand-primary',
    ghost: 'bg-transparent text-text-secondary border border-surface-border rounded-full hover:bg-surface-muted',
    accent: 'bg-brand-accent text-white rounded-full shadow-soft hover:shadow-hover',
  };

  return (
    <motion.button
      whileHover={whileHover}
      whileTap={whileTap}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};

// ── CARD COMPONENTS ───────────────────────────────────────────
export const Card = ({ children, className = '', gradient = false, interactive = false }) => {
  const baseClasses = 'rounded-2xl border backdrop-blur-lg transition-all';
  const defaultClasses = gradient
    ? 'bg-gradient-to-br from-white/80 to-white/40 border-white/20 shadow-lg'
    : 'bg-white border-surface-border shadow-card';

  return (
    <motion.div
      whileHover={interactive ? { y: -4, boxShadow: 'var(--shadow-hover)' } : {}}
      className={`${baseClasses} ${defaultClasses} ${className}`}
    >
      {children}
    </motion.div>
  );
};

export const GlassPanel = ({ children, className = '' }) => (
  <div className={`rounded-2xl bg-white/30 backdrop-blur-xl border border-white/20 shadow-lg ${className}`}>
    {children}
  </div>
);

// ── INPUT COMPONENTS ──────────────────────────────────────────
export const Input = ({ 
  label, 
  error, 
  icon: Icon, 
  className = '', 
  ...props 
}) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">{label}</label>}
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />}
        <input
          className={`input ${Icon ? 'pl-10' : ''} ${error ? 'border-red-400' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>}
    </div>
  );
};

// ── BADGE COMPONENTS ──────────────────────────────────────────
export const Badge = ({ children, variant = 'primary', className = '' }) => {
  const variants = {
    primary: 'bg-brand-secondary text-brand-deep',
    success: 'bg-status-success/20 text-green-700 border border-status-success',
    warning: 'bg-status-warning/20 text-amber-700 border border-status-warning',
    error: 'bg-status-error/20 text-red-700 border border-status-error',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// ── COMPATIBILITY SCORE BADGE ─────────────────────────────────
export const CompatibilityBadge = ({ score, size = 'md' }) => {
  const getColor = (score) => {
    if (score >= 85) return 'from-green-400 to-emerald-500';
    if (score >= 70) return 'from-blue-400 to-cyan-500';
    if (score >= 55) return 'from-yellow-400 to-orange-500';
    return 'from-orange-400 to-red-500';
  };

  const sizes = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-16 h-16 text-base',
    lg: 'w-20 h-20 text-lg',
  };

  return (
    <div className={`flex items-center justify-center rounded-full bg-gradient-to-br ${getColor(score)} shadow-lg ${sizes[size]}`}>
      <div className="flex flex-col items-center justify-center bg-white rounded-full w-11/12 h-11/12">
        <span className="font-bold text-text-primary">{score}%</span>
        <span className="text-xs font-semibold text-text-muted">Match</span>
      </div>
    </div>
  );
};

// ── MODAL/DIALOG ───────────────────────────────────────────────
export const Modal = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 ${className}`}
      >
        {title && <h2 className="text-2xl font-bold text-text-primary mb-4">{title}</h2>}
        {children}
      </motion.div>
    </motion.div>
  );
};

// ── CHAT BUBBLE ────────────────────────────────────────────────
export const ChatBubble = ({ message, isSender = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isSender ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div className={`max-w-xs px-4 py-2 rounded-2xl ${
        isSender 
          ? 'bg-brand-primary text-white rounded-br-none' 
          : 'bg-surface-muted text-text-primary rounded-bl-none'
      }`}>
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
    </motion.div>
  );
};

// ── PROGRESS BAR ───────────────────────────────────────────────
export const ProgressBar = ({ value, label, showPercent = true }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-text-secondary">{label}</span>
        {showPercent && <span className="text-xs font-bold text-brand-primary">{value}%</span>}
      </div>
      <div className="w-full h-2 rounded-full bg-surface-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-warm"
        />
      </div>
    </div>
  );
};

// ── ATTRIBUTE CHIP ────────────────────────────────────────────
export const AttributeChip = ({ label, value, icon: Icon, highlight = false }) => {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
      highlight 
        ? 'bg-brand-secondary/50 border-brand-primary text-brand-deep' 
        : 'bg-surface-muted border-surface-border text-text-secondary'
    }`}>
      {Icon && <Icon size={16} />}
      <div className="flex flex-col">
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-xs text-text-muted">{value}</span>
      </div>
    </div>
  );
};

// ── AVATAR ────────────────────────────────────────────────────
export const Avatar = ({ 
  src, 
  name, 
  size = 'md', 
  status = null 
}) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
    xl: 'w-24 h-24 text-2xl',
  };

  const initials = name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <div className="relative">
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-brand-primary to-brand-warm flex items-center justify-center text-white font-bold overflow-hidden`}>
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      {status && (
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
          status === 'online' ? 'bg-green-400' : 'bg-gray-400'
        }`} />
      )}
    </div>
  );
};

// ── LOADING SPINNER ────────────────────────────────────────────
export const Spinner = ({ size = 'md' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, easing: 'linear' }}
      className={`${sizes[size]} border-2 border-surface-border border-t-brand-primary rounded-full`}
    />
  );
};

// ── FLOATING ACTION BUTTON ────────────────────────────────────
export const FAB = ({ 
  icon, 
  onClick, 
  label = '', 
  position = 'bottom-right' 
}) => {
  const Icon = icon;
  const posClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`fixed ${posClasses[position]} z-40 w-14 h-14 rounded-full bg-gradient-to-br from-brand-primary to-brand-warm text-white shadow-lg flex items-center justify-center hover:shadow-hover transition-shadow`}
      title={label}
    >
      {Icon && <Icon size={24} />}
    </motion.button>
  );
};

// ── SECTION HEADER ────────────────────────────────────────────
export const SectionHeader = ({ 
  title, 
  subtitle, 
  action, 
  animated = true 
}) => {
  const Content = () => (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
        {subtitle && <p className="text-text-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {action && action}
    </div>
  );

  if (animated) {
    return (
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Content />
      </motion.div>
    );
  }
  return <Content />;
};

// ── STAT CARD ──────────────────────────────────────────────────
export const StatCard = ({ 
  label, 
  value, 
  icon: Icon, 
  trend = null, 
  className = '' 
}) => {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-muted text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
          {trend && (
            <p className={`text-xs font-semibold mt-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        {Icon && <Icon className="text-brand-primary opacity-30" size={24} />}
      </div>
    </Card>
  );
};

// ── EMPTY STATE ────────────────────────────────────────────────
export const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  action 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-surface-muted">
          <Icon className="text-brand-primary" size={32} />
        </div>
      )}
      <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-text-muted text-sm max-w-xs mb-6">{description}</p>
      {action && action}
    </motion.div>
  );
};

export default {
  Button,
  Card,
  GlassPanel,
  Input,
  Badge,
  CompatibilityBadge,
  Modal,
  ChatBubble,
  ProgressBar,
  AttributeChip,
  Avatar,
  Spinner,
  FAB,
  SectionHeader,
  StatCard,
  EmptyState,
};
