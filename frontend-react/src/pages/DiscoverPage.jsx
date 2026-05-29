import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X, BadgeCheck, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch, auth } from '../utils/api';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import MatchCard from '../components/MatchCard';
import { SectionHeader, EmptyState, Spinner } from '../components/UI';
import { staggerContainer, staggerItem } from '../utils/animations';

// ── Skeleton Card ───────────────────────────────────────────────
const SkeletonCard = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="card overflow-hidden animate-pulse"
  >
    <div className="skeleton h-52 rounded-none" />
    <div className="p-5 space-y-3">
      <div className="skeleton h-5 w-2/3 rounded-lg" />
      <div className="skeleton h-3 w-1/2 rounded-lg" />
      <div className="grid grid-cols-2 gap-2">
        <div className="skeleton h-12 rounded-xl" />
        <div className="skeleton h-12 rounded-xl" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-8 flex-1 rounded-full" />
        <div className="skeleton h-8 flex-1 rounded-full" />
      </div>
    </div>
  </motion.div>
);

// ── Filter Badge ───────────────────────────────────────────────
const FilterBadge = ({ label, emoji, active, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
      active
        ? 'bg-brand-primary border-brand-primary text-white shadow-lg'
        : 'border-surface-border text-text-muted hover:border-brand-primary bg-white'
    }`}
  >
    {emoji} {label}
  </motion.button>
);

// ── Filter Panel ───────────────────────────────────────────────
const FilterPanel = ({ filters, setFilters, onClose }) => {
  const update = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="card p-6 mb-6 relative border-brand-primary/20 bg-gradient-to-br from-white via-white to-surface-muted"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display font-bold text-text-primary text-lg">Advanced Filters</h3>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          onClick={onClose}
          className="btn-ghost p-2"
        >
          <X size={18} />
        </motion.button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Budget Range */}
        <motion.div variants={staggerItem}>
          <label className="block text-xs font-semibold text-text-secondary mb-3">
            Budget: ₹{(filters.budgetMin || 0).toLocaleString('en-IN')} – ₹{(filters.budgetMax || 500000).toLocaleString('en-IN')}
          </label>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-text-muted">Min</span>
              <input
                type="range"
                min="0"
                max="500000"
                step="1000"
                value={filters.budgetMin || 0}
                onChange={e => update('budgetMin', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <span className="text-xs text-text-muted">Max</span>
              <input
                type="range"
                min="0"
                max="500000"
                step="1000"
                value={filters.budgetMax || 500000}
                onChange={e => update('budgetMax', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </motion.div>

        {/* Smoking */}
        <motion.div variants={staggerItem}>
          <label className="block text-xs font-semibold text-text-secondary mb-3">Smoking</label>
          <div className="flex gap-2">
            {['any', 'no', 'yes'].map(v => (
              <FilterBadge
                key={v}
                label={v === 'any' ? 'Any' : v === 'no' ? 'No' : 'Yes'}
                emoji={v === 'any' ? '🚬' : v === 'no' ? '🚭' : '🚬'}
                active={filters.smoking === v}
                onClick={() => update('smoking', v)}
              />
            ))}
          </div>
        </motion.div>

        {/* Drinking */}
        <motion.div variants={staggerItem}>
          <label className="block text-xs font-semibold text-text-secondary mb-3">Drinking</label>
          <div className="flex gap-2">
            {['any', 'no', 'yes'].map(v => (
              <FilterBadge
                key={v}
                label={v === 'any' ? 'Any' : v === 'no' ? 'No' : 'Yes'}
                emoji={v === 'any' ? '🍸' : v === 'no' ? '🧃' : '🍺'}
                active={filters.drinking === v}
                onClick={() => update('drinking', v)}
              />
            ))}
          </div>
        </motion.div>

        {/* Cleanliness */}
        <motion.div variants={staggerItem}>
          <label className="block text-xs font-semibold text-text-secondary mb-3">
            Min Cleanliness: {filters.cleanlinessMin || 1}/5
          </label>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={filters.cleanlinessMin || 1}
            onChange={e => update('cleanlinessMin', parseInt(e.target.value))}
          />
        </motion.div>

        {/* Sleep Schedule */}
        <motion.div variants={staggerItem}>
          <label className="block text-xs font-semibold text-text-secondary mb-3">Sleep Schedule</label>
          <div className="flex gap-2 flex-wrap">
            {['any', 'early', 'late', 'flexible'].map(v => (
              <FilterBadge
                key={v}
                label={v === 'any' ? 'Any' : v === 'early' ? 'Early' : v === 'late' ? 'Late' : 'Flex'}
                emoji={v === 'any' ? '⏰' : v === 'early' ? '🌅' : v === 'late' ? '🌙' : '⏰'}
                active={filters.sleepTime === v}
                onClick={() => update('sleepTime', v)}
              />
            ))}
          </div>
        </motion.div>

        {/* Verified only */}
        <motion.div variants={staggerItem}>
          <label className="block text-xs font-semibold text-text-secondary mb-3">Verified Only</label>
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => update('verifiedOnly', !filters.verifiedOnly)}
            className={`w-full py-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
              filters.verifiedOnly
                ? 'bg-brand-accent/20 border-brand-accent text-green-700'
                : 'border-surface-border text-text-muted hover:border-brand-accent bg-white'
            }`}
          >
            <BadgeCheck size={14} />
            {filters.verifiedOnly ? 'Verified Only' : 'Show All'}
          </motion.button>
        </motion.div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        onClick={() =>
          setFilters({
            budgetMin: 0,
            budgetMax: 500000,
            smoking: 'any',
            drinking: 'any',
            cleanlinessMin: 1,
            sleepTime: 'any',
            verifiedOnly: false,
          })
        }
        className="btn-ghost mt-6 text-xs"
      >
        Reset Filters
      </motion.button>
    </motion.div>
  );
};

// ── Discover Page ──────────────────────────────────────────────
const DiscoverPage = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Best Match');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    budgetMin: 0,
    budgetMax: 500000,
    smoking: 'any',
    drinking: 'any',
    cleanlinessMin: 1,
    sleepTime: 'any',
    verifiedOnly: false,
  });

  useEffect(() => {
    const userId = auth.getUserId();
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        console.log('Attempting Supabase RPC get_matches for userId', userId, 'city', searchQuery);
        const { data, error } = await supabase.rpc('get_matches', { user_id: userId, city: searchQuery });
        if (error) {
          console.error('Supabase RPC error:', error);
          throw new Error(error.message || 'Supabase RPC failed');
        }
        console.log('Supabase RPC succeeded, retrieved', data?.length ?? 0, 'matches');
        setMatches(Array.isArray(data) ? data : []);
      } catch (rpcErr) {
        console.warn('Supabase RPC failed, falling back to legacy API. Error:', rpcErr);
        }
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      load();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, navigate]);

  const filtered = React.useMemo(() => {
    let res = [...matches];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.bio?.toLowerCase().includes(q) ||
        m.city?.toLowerCase().includes(q) ||
        m.occupation?.toLowerCase().includes(q) ||
        m.languages?.some(l => l.toLowerCase().includes(q))
      );
    }

    res = res.filter(m => {
      const b = m.budget || 0;
      return b >= (filters.budgetMin || 0) && b <= (filters.budgetMax || 500000);
    });

    if (filters.smoking !== 'any') res = res.filter(m => m.smoking === filters.smoking);
    if (filters.drinking !== 'any') res = res.filter(m => m.drinking === filters.drinking);
    if (filters.cleanlinessMin > 1) res = res.filter(m => (m.cleanliness || 0) >= filters.cleanlinessMin);
    if (filters.sleepTime !== 'any') res = res.filter(m => m.sleep_time === filters.sleepTime);
    if (filters.verifiedOnly) res = res.filter(m => m.is_verified);

    switch (sortBy) {
      case 'Budget ↑':
        res.sort((a, b) => (a.budget || 0) - (b.budget || 0));
        break;
      case 'Budget ↓':
        res.sort((a, b) => (b.budget || 0) - (a.budget || 0));
        break;
      case 'Cleanliness':
        res.sort((a, b) => (b.cleanliness || 0) - (a.cleanliness || 0));
        break;
      default:
        res.sort((a, b) => b.score - a.score);
    }

    return res;
  }, [matches, searchQuery, filters, sortBy]);

  const topMatch = filtered[0];
  const restMatches = filtered.slice(1);

  const activeFiltersCount = [
    filters.smoking !== 'any',
    filters.drinking !== 'any',
    filters.cleanlinessMin > 1,
    filters.sleepTime !== 'any',
    filters.verifiedOnly,
    filters.budgetMin > 0,
    filters.budgetMax < 100000,
  ].filter(Boolean).length;

  return (
    <Layout activePage="discover">
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-24">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-3">
            <motion.div
              animate={{ rotate: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Sparkles size={16} className="text-brand-warm" />
            </motion.div>
            <span className="text-xs font-semibold text-brand-warm uppercase tracking-wide">
              Smart Roommate Matching
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text-primary leading-tight mb-2">
            Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-warm">
              Dream Roomie
            </span>
          </h1>
          <p className="text-text-muted text-sm md:text-base">
            {loading ? 'Loading matches…' : `${filtered.length} match${filtered.length !== 1 ? 'es' : ''} found`}
          </p>
        </motion.div>

        {/* Search + Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-3 mb-4"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <motion.input
              whileFocus={{ scale: 1.02 }}
              id="discover-search"
              type="text"
              placeholder="Search name, city, occupation…"
              className="input pl-11"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {/* Sort */}
            <select
              id="discover-sort"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="input text-sm py-2.5 px-4 cursor-pointer border-surface-border bg-white hover:border-brand-primary transition-colors"
            >
              {['Best Match', 'Budget ↑', 'Budget ↓', 'Cleanliness'].map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Filter Toggle */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              id="discover-filters-toggle"
              onClick={() => setShowFilters(v => !v)}
              className={`btn-secondary py-2.5 px-4 text-sm relative transition-all ${
                showFilters ? 'border-brand-primary bg-brand-secondary/20' : ''
              }`}
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeFiltersCount > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-warm text-white text-[10px] font-bold flex items-center justify-center shadow-lg"
                >
                  {activeFiltersCount}
                </motion.span>
              )}
              <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </motion.button>
          </div>
        </motion.div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div variants={staggerContainer} initial="initial" animate="animate">
              <FilterPanel filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8"
          >
            {[1, 2, 3, 4, 5, 6].map(i => (
              <motion.div key={i} variants={staggerItem}>
                <SkeletonCard />
              </motion.div>
            ))}
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8"
          >
            <EmptyState
              title="Oops! Something went wrong"
              description={error}
              action={
                error === 'User profile not found' ? (
                  <a href="/edit-profile" className="btn-primary">
                    Complete Your Profile
                  </a>
                ) : (
                  <button onClick={() => window.location.reload()} className="btn-primary">
                    Try Again
                  </button>
                )
              }
            />
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8">
            <EmptyState
              icon={Search}
              title="No matches found"
              description="Try adjusting your search or filters to discover more roommates."
              action={
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSearchQuery('');
                    setFilters({
                      budgetMin: 0,
                      budgetMax: 500000,
                      smoking: 'any',
                      drinking: 'any',
                      cleanlinessMin: 1,
                      sleepTime: 'any',
                      verifiedOnly: false,
                    });
                  }}
                  className="btn-primary"
                >
                  Clear All Filters
                </motion.button>
              }
            />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 mt-8">
            {/* Top match featured */}
            {topMatch && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-surface-border" />
                  <motion.span
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-xs font-semibold text-brand-warm uppercase tracking-widest px-3 bg-brand-secondary/30 py-1 rounded-full"
                  >
                    ⭐ Top Recommendation
                  </motion.span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-surface-border" />
                </div>
                <MatchCard match={topMatch} index={0} featured={true} />
              </motion.section>
            )}

            {/* Rest */}
            {restMatches.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="font-display font-bold text-text-primary text-xl mb-6">More Matches</h2>
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                >
                  {restMatches.map((m, i) => (
                    <motion.div key={m.id} variants={staggerItem}>
                      <MatchCard match={m} index={i + 1} />
                    </motion.div>
                  ))}
                </motion.div>
              </motion.section>
            )}
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default DiscoverPage;
