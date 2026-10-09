import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Card, CompatibilityBadge, Badge, Spinner, EmptyState, ErrorState, InlineError, Button } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, X, Bookmark, SlidersHorizontal, ChevronDown, MapPin, Briefcase } from 'lucide-react'

const BREAKDOWN_LABELS = {
  lifestyle: 'Lifestyle',
  budget: 'Budget',
  location: 'Location',
  movein: 'Move-in',
  interests: 'Interests',
  habits: 'Habits',
}

function RoommateCard({ roommate, onSwipe, shortlisted, onShortlist }) {
  const [dragDir, setDragDir] = useState(null)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: dragDir === 'left' ? -300 : dragDir === 'right' ? 300 : 0, rotate: dragDir === 'left' ? -15 : dragDir === 'right' ? 15 : 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto"
    >
      <Link to={`/roommates/${roommate.id}`}>
        <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
          <div className="relative h-72 sm:h-80 bg-surface-bg">
            <UserAvatar
              src={roommate.profile_image}
              name={roommate.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3">
              <CompatibilityBadge score={roommate.score} />
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-primary">{roommate.name}, {roommate.age}</h3>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-secondary">
              <span className="flex items-center gap-1">
                <Briefcase size={14} /> {roommate.occupation}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={14} /> {roommate.city}
              </span>
              <span className="flex items-center gap-1">
                {roommate.budget?.toLocaleString()}/mo
              </span>
            </div>

            {roommate.bio && (
              <p className="text-sm text-muted line-clamp-2">{roommate.bio}</p>
            )}

            {roommate.reasons?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {roommate.reasons.map((r, i) => (
                  <Badge key={i} variant={r.type === 'positive' ? 'success' : r.type === 'warning' ? 'warning' : 'neutral'}>
                    {r.text}
                  </Badge>
                ))}
              </div>
            )}

            {roommate.breakdown && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(roommate.breakdown).map(([key, val]) => (
                  <Badge key={key} variant="muted" className="text-xs">
                    {BREAKDOWN_LABELS[key] || key}: {val}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      </Link>

      <div className="flex justify-center gap-4 mt-4">
        <button
          type="button"
          aria-label={`Pass on ${roommate.name}`}
          onClick={(e) => { e.stopPropagation(); setDragDir('left'); onSwipe('pass') }}
          className="w-14 h-14 rounded-full bg-surface-card border border-surface-border flex items-center justify-center text-secondary hover:text-brand-coral hover:border-brand-coral transition-colors shadow-sm"
        >
          <X size={24} />
        </button>
        <button
          type="button"
          aria-label={shortlisted ? `Remove ${roommate.name} from shortlist` : `Shortlist ${roommate.name}`}
          aria-pressed={shortlisted}
          onClick={(e) => { e.stopPropagation(); onShortlist() }}
          className={`w-14 h-14 rounded-full bg-surface-card border border-surface-border flex items-center justify-center transition-colors shadow-sm ${
            shortlisted ? 'text-brand-amber border-brand-amber' : 'text-secondary hover:text-brand-amber hover:border-brand-amber'
          }`}
        >
          <Bookmark size={24} fill={shortlisted ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          aria-label={`Like ${roommate.name}`}
          onClick={(e) => { e.stopPropagation(); setDragDir('right'); onSwipe('like') }}
          className="w-14 h-14 rounded-full bg-surface-card border border-surface-border flex items-center justify-center text-secondary hover:text-brand-teal hover:border-brand-teal transition-colors shadow-sm"
        >
          <Heart size={24} />
        </button>
      </div>
    </motion.div>
  )
}

export default function RoommatesPage() {
  const [swipedIds, setSwipedIds] = useState(new Set());
  const [shortlistedIds, setShortlistedIds] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [city, setCity] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [actionError, setActionError] = useState(null);

  const params = new URLSearchParams();
  if (city) params.set('city', city);
  if (budgetMin) params.set('budget_min', budgetMin);
  if (budgetMax) params.set('budget_max', budgetMax);
  const qs = params.toString();

  const {
    data: roommates, loading, error, retry,
  } = useAsync(() => apiFetch(`/roommates/recommended${qs ? `?${qs}` : ''}`), [qs]);

  const { data: initialShortlist, error: shortlistError } = useAsync(
    () => apiFetch('/shortlist').then(d => d.map(u => u.id)),
    []
  );

  useEffect(() => {
    if (Array.isArray(initialShortlist)) setShortlistedIds(new Set(initialShortlist));
  }, [initialShortlist]);

  const list = Array.isArray(roommates) ? roommates : [];
  const currentRoommate = list.find(r => !swipedIds.has(r.id));

  const handleSwipe = async (action) => {
    if (!currentRoommate) return;
    setActionError(null);
    setSwipedIds(prev => new Set(prev).add(currentRoommate.id));
    try {
      await apiFetch('/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: currentRoommate.id, action }),
      });
    } catch (err) {
      setSwipedIds(prev => { const next = new Set(prev); next.delete(currentRoommate.id); return next; });
      setActionError(err);
    }
  };

  const handleShortlist = async () => {
    if (!currentRoommate) return;
    setActionError(null);
    const isShortlisted = shortlistedIds.has(currentRoommate.id);
    setShortlistedIds(prev => {
      const next = new Set(prev);
      if (isShortlisted) next.delete(currentRoommate.id); else next.add(currentRoommate.id);
      return next;
    });
    try {
      await apiFetch('/shortlist', {
        method: isShortlisted ? 'DELETE' : 'POST',
        body: { targetId: currentRoommate.id },
      });
    } catch (err) {
      setShortlistedIds(prev => {
        const next = new Set(prev);
        if (isShortlisted) next.add(currentRoommate.id); else next.delete(currentRoommate.id);
        return next;
      });
      setActionError(err);
    }
  };

  const cities = [...new Set(list.map(r => r.city).filter(Boolean))];

  return (
    <Layout>
      <div className="min-h-screen bg-surface-bg">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-primary">Recommended Roommates</h1>
            <button
              type="button"
              aria-label="Filters"
              aria-expanded={showFilters}
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 rounded-lg border border-surface-border bg-surface-card text-secondary hover:text-primary transition-colors"
            >
              <SlidersHorizontal size={20} />
            </button>
          </div>

          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 overflow-hidden"
            >
              <Card className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="f-city" className="text-xs font-medium text-secondary block mb-1">City</label>
                    <div className="relative">
                      <select
                        id="f-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full appearance-none bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-primary pr-8"
                      >
                        <option value="">All cities</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="f-budget-min" className="text-xs font-medium text-secondary block mb-1">Min budget</label>
                    <input
                      id="f-budget-min"
                      type="number"
                      min={0}
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value)}
                      placeholder="No minimum"
                      className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="f-budget-max" className="text-xs font-medium text-secondary block mb-1">Max budget</label>
                    <input
                      id="f-budget-max"
                      type="number"
                      min={0}
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                      placeholder="No maximum"
                      className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-primary"
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <ErrorState what="matches" error={error} onRetry={retry} />
          ) : currentRoommate ? (
            <>
              <InlineError error={actionError} />
              <AnimatePresence mode="wait">
                <RoommateCard
                  key={currentRoommate.id}
                  roommate={currentRoommate}
                  onSwipe={handleSwipe}
                  shortlisted={shortlistedIds.has(currentRoommate.id)}
                  onShortlist={handleShortlist}
                />
              </AnimatePresence>
            </>
          ) : list.length === 0 ? (
            // Distinguish "nothing matched your filters" from "you have been
            // through everyone". A brand-new account was told it had already
            // seen every person in the app.
            <EmptyState
              title="No matches in your filters"
              description="Widen the city or budget, or check back when more people join."
            />
          ) : (
            <EmptyState
              title="You've seen everyone"
              description={shortlistError ? 'We could not load your bookmarks, so they may be out of date.' : 'Try widening your filters, or check back when more people join your city.'}
              action={
                <div className="flex gap-3">
                  <Button onClick={retry}>Load more matches</Button>
                  <Button variant="secondary" onClick={() => { setCity(''); setBudgetMin(''); setBudgetMax(''); setSwipedIds(new Set()); }}>
                    Clear filters and start over
                  </Button>
                </div>
              }
            />
          )}

          {currentRoommate && (
            <div className="text-center mt-6 text-sm text-muted">
              {list.filter(r => !swipedIds.has(r.id)).length} roommates remaining
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
