import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, X, BadgeCheck, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch, auth } from '../utils/api';
import Layout from '../components/Layout';
import MatchCard from '../components/MatchCard';

// ── Skeleton Card ───────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="card overflow-hidden animate-pulse">
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
  </div>
);

// ── Filter Panel ───────────────────────────────────────────────
const FilterPanel = ({ filters, setFilters, onClose }) => {
  const update = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="card p-6 mb-6 relative"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display font-bold text-text-primary">Advanced Filters</h3>
        <button onClick={onClose} className="btn-ghost p-2">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Budget Range */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-2">
            Budget Range: ₹{(filters.budgetMin || 0).toLocaleString('en-IN')} – ₹{(filters.budgetMax || 500000).toLocaleString('en-IN')}
          </label>
          <div className="space-y-2">
            <input
              type="range" min="0" max="500000" step="1000"
              value={filters.budgetMin || 0}
              onChange={e => update('budgetMin', parseInt(e.target.value))}
            />
            <input
              type="range" min="0" max="500000" step="1000"
              value={filters.budgetMax || 500000}
              onChange={e => update('budgetMax', parseInt(e.target.value))}
            />
          </div>
        </div>

        {/* Smoking */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-2">Smoking</label>
          <div className="flex gap-2">
            {['any', 'no', 'yes'].map(v => (
              <button
                key={v}
                onClick={() => update('smoking', v)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                  filters.smoking === v
                    ? 'bg-brand-primary border-brand-primary text-text-primary'
                    : 'border-surface-border text-text-muted hover:border-brand-primary'
                }`}
              >
                {v === 'any' ? '🚬 Any' : v === 'no' ? '🚭 No' : '🚬 Yes'}
              </button>
            ))}
          </div>
        </div>

        {/* Drinking */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-2">Drinking</label>
          <div className="flex gap-2">
            {['any', 'no', 'yes'].map(v => (
              <button
                key={v}
                onClick={() => update('drinking', v)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                  filters.drinking === v
                    ? 'bg-brand-primary border-brand-primary text-text-primary'
                    : 'border-surface-border text-text-muted hover:border-brand-primary'
                }`}
              >
                {v === 'any' ? '🍸 Any' : v === 'no' ? '🧃 No' : '🍺 Yes'}
              </button>
            ))}
          </div>
        </div>

        {/* Cleanliness */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-2">
            Min Cleanliness: {filters.cleanlinessMin || 1}/5
          </label>
          <input
            type="range" min="1" max="5" step="1"
            value={filters.cleanlinessMin || 1}
            onChange={e => update('cleanlinessMin', parseInt(e.target.value))}
          />
        </div>

        {/* Sleep Schedule */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-2">Sleep Schedule</label>
          <div className="flex gap-2">
            {['any', 'early', 'late', 'flexible'].map(v => (
              <button
                key={v}
                onClick={() => update('sleepTime', v)}
                className={`flex-1 py-2 rounded-xl text-[10px] font-semibold border transition-all ${
                  filters.sleepTime === v
                    ? 'bg-brand-primary border-brand-primary text-text-primary'
                    : 'border-surface-border text-text-muted hover:border-brand-primary'
                }`}
              >
                {v === 'any' ? 'Any' : v === 'early' ? '🌅 Early' : v === 'late' ? '🌙 Late' : '⏰ Flex'}
              </button>
            ))}
          </div>
        </div>

        {/* Verified only */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-2">Verified Only</label>
          <button
            onClick={() => update('verifiedOnly', !filters.verifiedOnly)}
            className={`w-full py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
              filters.verifiedOnly
                ? 'bg-brand-accent/20 border-brand-accent text-green-700'
                : 'border-surface-border text-text-muted hover:border-brand-accent'
            }`}
          >
            <BadgeCheck size={14} />
            {filters.verifiedOnly ? 'Verified Only ✓' : 'Show All'}
          </button>
        </div>
      </div>

      <button
        onClick={() => setFilters({ budgetMin: 0, budgetMax: 500000, smoking: 'any', drinking: 'any', cleanlinessMin: 1, sleepTime: 'any', verifiedOnly: false })}
        className="btn-ghost mt-4 text-xs"
      >
        Reset Filters
      </button>
    </motion.div>
  );
};

// ── Discover Page ──────────────────────────────────────────────
const DiscoverPage = () => {
  const [matches, setMatches]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [searchQuery, setSearchQuery]       = useState('');
  const [sortBy, setSortBy]                 = useState('Best Match');
  const [showFilters, setShowFilters]       = useState(false);
  const [filters, setFilters] = useState({
    budgetMin: 0, budgetMax: 500000,
    smoking: 'any', drinking: 'any',
    cleanlinessMin: 1, sleepTime: 'any',
    verifiedOnly: false,
  });

  useEffect(() => {
    const userId = auth.getUserId();
    if (!userId) { window.location.href = '/login'; return; }

    const load = async () => {
      try {
        setLoading(true);
        // Pass searchQuery to the backend as the 'city' parameter
        const url = `/matches/${userId}${searchQuery ? `?city=${encodeURIComponent(searchQuery)}` : ''}`;
        const data = await apiFetch(url);
        setMatches(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load matches');
      } finally {
        setLoading(false);
      }
    };

    // Debounce the search request by 300ms to avoid hammering the server
    const timeoutId = setTimeout(() => {
      load();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const filtered = React.useMemo(() => {
    let res = [...matches];

    // Text search
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

    // Budget filter
    res = res.filter(m => {
      const b = m.budget || 0;
      return b >= (filters.budgetMin || 0) && b <= (filters.budgetMax || 500000);
    });

    // Smoking / Drinking
    if (filters.smoking !== 'any') res = res.filter(m => m.smoking === filters.smoking);
    if (filters.drinking !== 'any') res = res.filter(m => m.drinking === filters.drinking);

    // Cleanliness
    if (filters.cleanlinessMin > 1) res = res.filter(m => (m.cleanliness || 0) >= filters.cleanlinessMin);

    // Sleep schedule
    if (filters.sleepTime !== 'any') res = res.filter(m => m.sleep_time === filters.sleepTime);

    // Verified
    if (filters.verifiedOnly) res = res.filter(m => m.is_verified);

    // Sort
    switch (sortBy) {
      case 'Budget ↑': res.sort((a, b) => (a.budget || 0) - (b.budget || 0)); break;
      case 'Budget ↓': res.sort((a, b) => (b.budget || 0) - (a.budget || 0)); break;
      case 'Cleanliness': res.sort((a, b) => (b.cleanliness || 0) - (a.cleanliness || 0)); break;
      default: res.sort((a, b) => b.score - a.score);
    }

    return res;
  }, [matches, searchQuery, filters, sortBy]);

  const topMatch   = filtered[0];
  const restMatches = filtered.slice(1);

  const activeFiltersCount = [
    filters.smoking !== 'any', filters.drinking !== 'any',
    filters.cleanlinessMin > 1, filters.sleepTime !== 'any',
    filters.verifiedOnly, filters.budgetMin > 0, filters.budgetMax < 100000,
  ].filter(Boolean).length;

  return (
    <Layout activePage="discover">
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-6">

        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-brand-warm" />
            <span className="text-xs font-semibold text-brand-warm uppercase tracking-wide">
              Smart Roommate Matching
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text-primary leading-tight mb-1">
            Find Your <span className="text-brand-warm">Dream Roomie</span>
          </h1>
          <p className="text-text-muted text-sm">
            {loading ? 'Loading matches…' : `${filtered.length} match${filtered.length !== 1 ? 'es' : ''} found`}
          </p>
        </motion.div>

        {/* Search + Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
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
              className="input text-sm py-2.5 px-4 cursor-pointer"
            >
              {['Best Match', 'Budget ↑', 'Budget ↓', 'Cleanliness'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Filter Toggle */}
            <button
              id="discover-filters-toggle"
              onClick={() => setShowFilters(v => !v)}
              className={`btn-secondary py-2.5 px-4 text-sm relative ${showFilters ? 'border-brand-primary bg-brand-secondary/20' : ''}`}
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-warm text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <FilterPanel filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)} />
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
            {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="card p-12 text-center mt-4">
            <p className="text-text-secondary mb-4">{error}</p>
            {error === 'User profile not found' && (
              <>
                <p className="text-text-muted text-sm mb-6">Complete your profile to start matching!</p>
                <a href="/edit-profile" className="btn-primary">Complete Profile</a>
              </>
            )}
            {error !== 'User profile not found' && (
              <button onClick={() => window.location.reload()} className="btn-primary">Retry</button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center mt-4">
            <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={28} className="text-brand-warm" />
            </div>
            <h2 className="text-xl font-display font-bold text-text-primary mb-2">No matches found</h2>
            <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
              Try adjusting your search or filters to discover more roommates.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setFilters({ budgetMin: 0, budgetMax: 100000, smoking: 'any', drinking: 'any', cleanlinessMin: 1, sleepTime: 'any', verifiedOnly: false }); }}
              className="btn-primary"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="space-y-8 mt-4">
            {/* Top match featured */}
            {topMatch && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-surface-border" />
                  <span className="text-xs font-semibold text-brand-warm uppercase tracking-widest px-2">⭐ Top Recommendation</span>
                  <div className="h-px flex-1 bg-surface-border" />
                </div>
                <MatchCard match={topMatch} index={0} featured={true} />
              </section>
            )}

            {/* Rest */}
            {restMatches.length > 0 && (
              <section>
                <h2 className="font-display font-bold text-text-primary text-lg mb-4">
                  More Matches
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {restMatches.map((m, i) => (
                    <MatchCard key={m.id} match={m} index={i + 1} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DiscoverPage;
