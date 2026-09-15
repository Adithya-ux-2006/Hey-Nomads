import { motion } from 'framer-motion';

export const Button = ({ variant = 'primary', size = 'md', children, className = '', ...props }) => {
  const base = 'font-semibold inline-flex items-center justify-center gap-2 transition-all rounded-full';
  const sizes = { sm: 'px-4 py-2 text-sm', md: 'px-6 py-3 text-base', lg: 'px-8 py-4 text-lg' };
  const variants = {
    primary: 'bg-brand-coral text-white shadow-coral hover:bg-brand-coral-dark hover:shadow-hover active:scale-95',
    secondary: 'border-2 border-surface-border bg-white text-text-primary hover:bg-surface-muted hover:border-brand-coral',
    ghost: 'bg-transparent text-text-secondary border border-surface-border hover:bg-surface-muted',
    teal: 'bg-brand-teal text-white shadow-teal hover:bg-brand-teal-dark',
    amber: 'bg-brand-amber text-text-primary hover:bg-brand-amber-light',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', interactive = false }) => (
  <motion.div
    whileHover={interactive ? { y: -2, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' } : {}}
    className={`bg-white rounded-2xl border border-surface-border shadow-card transition-all ${className}`}
  >
    {children}
  </motion.div>
);

export const Badge = ({ children, variant = 'coral', className = '' }) => {
  const v = {
    coral: 'bg-brand-coral/10 text-brand-coral border border-brand-coral/20',
    teal: 'bg-brand-teal/10 text-brand-teal border border-brand-teal/20',
    amber: 'bg-brand-amber/10 text-amber-700 border border-brand-amber/20',
    success: 'bg-status-success/10 text-status-success border border-status-success/20',
    muted: 'bg-surface-muted text-text-secondary border border-surface-border',
  };
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${v[variant] || v.coral} ${className}`}>{children}</span>;
};

export const CompatibilityBadge = ({ score, size = 'md' }) => {
  const color = score >= 80 ? 'from-emerald-400 to-teal-500' : score >= 60 ? 'from-brand-amber to-orange-400' : 'from-orange-400 to-red-400';
  const sizes = { sm: 'w-12 h-12 text-xs', md: 'w-16 h-16 text-sm', lg: 'w-20 h-20 text-base' };
  return (
    <div className={`flex items-center justify-center rounded-full bg-gradient-to-br ${color} shadow-lg ${sizes[size]}`}>
      <div className="flex flex-col items-center justify-center bg-white rounded-full w-11/12 h-11/12">
        <span className="font-bold text-text-primary leading-none">{score}%</span>
        <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">Match</span>
      </div>
    </div>
  );
};

export const Spinner = ({ size = 'md' }) => {
  const s = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return <div className={`${s[size]} border-2 border-surface-border border-t-brand-coral rounded-full animate-spin`} />;
};

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
    {Icon && <div className="mb-4 p-4 rounded-full bg-surface-muted"><Icon className="text-brand-coral" size={32} /></div>}
    <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
    <p className="text-text-muted text-sm max-w-xs mb-6">{description}</p>
    {action}
  </div>
);

export const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      {subtitle && <p className="text-text-muted text-sm mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const Skeleton = ({ className = '' }) => (
  <div className={`skeleton ${className}`} />
);
