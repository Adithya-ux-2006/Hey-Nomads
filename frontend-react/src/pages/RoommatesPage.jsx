import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { isDemo } from '../lib/demoMode'
import { useAsync } from '../lib/useAsync'
import { Card, Badge, CompatibilityBadge, Spinner, EmptyState, ErrorState, InlineError, Button } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { SlidersHorizontal, ChevronDown, MapPin, Briefcase, Heart, X, Bookmark } from 'lucide-react'

// Enough reasons to explain a match without turning the card into a column of
// chips that pushes the pass/shortlist/like row off the screen. The full list
// is still on the detail page.
const MAX_CARD_REASONS = 4;

const DemoModeLink = () => (
  <Link
    to="/demo"
    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-amber text-white text-sm font-semibold hover:opacity-90 transition-opacity"
  >
    Take the walkthrough
  </Link>
)

export default function RoommatesPage() {
  const [swipedIds, setSwipedIds] = useState(new Set())
  const [shortlistedIds, setShortlistedIds] = useState(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [city, setCity] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [actionError, setActionError] = useState(null)
  // The API answers { ok, matchCreated }. Discarding it made a successful like
  // look identical to a broken one, so the outcome is surfaced instead.
  const [feedback, setFeedback] = useState(null)

  const params = new URLSearchParams()
  if (city) params.set('city', city)
  if (budgetMin) params.set('budget_min', budgetMin)
  if (budgetMax) params.set('budget_max', budgetMax)
  const qs = params.toString()

  const {
    data: roommates, loading, error, retry,
  } = useAsync(() => apiFetch(`/roommates/recommended${qs ? `?${qs}` : ''}`), [qs])

  const { data: initialShortlist, error: shortlistError } = useAsync(
    () => apiFetch('/shortlist').then(d => d.map(u => u.id)),
    []
  )

  useEffect(() => {
    if (Array.isArray(initialShortlist)) setShortlistedIds(new Set(initialShortlist))
  }, [initialShortlist])

  const list = Array.isArray(roommates) ? roommates : []
  const visible = list.filter(r => !swipedIds.has(r.id))
  // Swipe and shortlist failures are reverted optimistically, so both surface
  // here rather than leaving the button state silently wrong.
  const bannerError = actionError || shortlistError

const handleSwipe = async (targetId, action, name) => {
    if (!targetId) return
    setActionError(null)
    setFeedback(null)
    setSwipedIds(prev => new Set(prev).add(targetId))
    try {
      // Pass the object. apiFetch owns JSON encoding; stringifying here made it
      // encode twice, so /api/swipe received a JSON *string*, targetId was
      // undefined, and every like returned 400.
      const res = await apiFetch('/swipe', {
        method: 'POST',
        body: { targetId: Number(targetId), action },
      })
      if (action === 'like') {
        setFeedback(res?.matchCreated
          ? { kind: 'match', id: targetId, name }
          : { kind: 'like', name })
      }
    } catch (err) {
      setSwipedIds(prev => { const next = new Set(prev); next.delete(targetId); return next; })
      setActionError(err)
    }
  }

  const handleShortlist = async (targetId) => {
    if (!targetId) return
    setActionError(null)
    const isShortlisted = shortlistedIds.has(targetId)
    const addToShortlist = () => setShortlistedIds(prev => {
      const next = new Set(prev)
      next.add(targetId)
      return next
    })
    const removeFromShortlist = () => setShortlistedIds(prev => {
      const next = new Set(prev)
      next.delete(targetId)
      return next
    })
    if (isShortlisted) {
      removeFromShortlist()
    } else {
      addToShortlist()
    }
    try {
      await apiFetch('/shortlist', {
        method: isShortlisted ? 'DELETE' : 'POST',
        body: { targetId },
      })
    } catch (err) {
      if (isShortlisted) {
        addToShortlist()
      } else {
        removeFromShortlist()
      }
      setActionError(err)
    }
  }

  const cities = [...new Set(list.map(r => r.city).filter(Boolean))]
  const hasFilters = !!(city || budgetMin || budgetMax)

  return (
    <Layout>
      <div className="min-h-screen bg-surface-bg">
        <div className="max-w-4xl mx-auto px-4 py-6">
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
            <Card className="p-4 mb-6 space-y-3">
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
          )}

          <InlineError error={bannerError} />

          {/* A match and a plain like are different outcomes and used to look
              identical: the card just disappeared. Message and Agreement only
              appear on a real match, because the server refuses both otherwise. */}
          {feedback && (
            <div
              role="status"
              className={`mb-4 p-4 rounded-xl border text-sm flex flex-wrap items-center gap-3 ${
                feedback.kind === 'match'
                  ? 'bg-status-success/10 border-status-success/30 text-status-success'
                  : 'bg-surface-card border-surface-border text-text-secondary'
              }`}
            >
              {feedback.kind === 'match' ? (
                <>
                  <span className="font-semibold">You matched with {feedback.name}</span>
                  <span className="text-text-muted">Start a conversation and agree the details.</span>
                  <span className="ml-auto flex gap-2">
                    <Link
                      to={`/messages/${feedback.id}`}
                      className="px-3 py-1.5 rounded-lg bg-brand-teal text-white font-semibold text-xs hover:opacity-90"
                    >
                      Message
                    </Link>
                    <Link
                      to={`/agreement/${feedback.id}`}
                      className="px-3 py-1.5 rounded-lg border border-surface-border text-text-primary font-semibold text-xs hover:border-brand-coral"
                    >
                      Agreement
                    </Link>
                  </span>
                </>
              ) : (
                <span>Liked {feedback.name}. You'll get a message option here once they like you back.</span>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <ErrorState what="matches" error={error} onRetry={retry} />
          ) : visible.length === 0 ? (
            // One empty state, inside the loading/error chain. A second block
            // sat outside that chain and rendered on `visible.length === 0`
            // alone, so "You've seen everyone" appeared while the request was
            // still loading, sat next to the error state when one arrived, and
            // stacked on top of this one for a genuinely empty feed.
            <EmptyState
              title={hasFilters ? 'No matches in your filters' : 'No roommates to show you yet'}
              description={hasFilters
                ? 'Try widening the city or budget range, or start over.'
                : 'Recommendations only include real accounts, and there are none available right now. You can still try the whole flow with clearly labelled sample profiles.'}
              action={
                <div className="flex flex-wrap gap-3 justify-center">
                  {hasFilters && (
                    <Button variant="secondary" onClick={() => { setCity(''); setBudgetMin(''); setBudgetMax(''); setSwipedIds(new Set()); }}>
                      Clear filters
                    </Button>
                  )}
                  <Button onClick={retry}>Load more matches</Button>
                  <DemoModeLink />
                </div>
              }
            />
          ) : (
            <>
              {/* Explains the one rule that actually governs matching. The old
                  copy claimed nobody appears until they like you first, which
                  is not how the feed is filtered and read as nonsense above a
                  populated grid. The promo is dropped while the visitor is
                  already inside the demo. */}
              <div className="mb-4 p-3 rounded-xl bg-surface-card border border-surface-border flex flex-wrap items-center gap-3">
                <span className="text-sm text-text-secondary flex-1 min-w-[200px]">
                  New here? A match needs a mutual like — tap the heart and you'll match once
                  they like you back.
                </span>
                {!isDemo() && (
                  <Link
                    to="/demo"
                    className="px-3 py-2 rounded-lg bg-brand-amber text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Take the walkthrough
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map(roommate => (
                <Card key={roommate.id} className="overflow-hidden group hover:shadow-hover">
                  <Link
                    to={`/roommates/${roommate.id}`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-inset rounded-card"
                  >
                    <div className="relative h-72 sm:h-80 bg-surface-bg overflow-hidden">
                      <UserAvatar
                        src={roommate.profile_image}
                        name={roommate.name}
                        fill
                        className="transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.02]"
                      />
                      <div className="absolute top-3 right-3">
                        <CompatibilityBadge score={roommate.score} />
                      </div>
                    </div>
                  </Link>

                  <div className="p-4 space-y-3">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-lg font-semibold text-text-primary truncate">{roommate.name}</h3>
                      {roommate.age && <span className="text-sm text-text-muted tabular-nums shrink-0">{roommate.age}</span>}
                    </div>

                    {/* Metadata reads as separate facts rather than one run-on
                        line. Items are dropped entirely when absent instead of
                        rendering a stray icon beside nothing. */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
                      {roommate.occupation && (
                        <span className="flex items-center gap-1.5">
                          <Briefcase size={14} className="shrink-0 text-text-muted" aria-hidden="true" /> {roommate.occupation}
                        </span>
                      )}
                      {roommate.city && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} className="shrink-0 text-text-muted" aria-hidden="true" /> {roommate.city}
                        </span>
                      )}
                      {roommate.budget != null && (
                        <span className="flex items-center gap-1.5 tabular-nums">
                          {roommate.budget.toLocaleString()}<span className="text-text-muted">/mo</span>
                        </span>
                      )}
                    </div>

                    {roommate.bio && (
                      <p className="text-sm leading-relaxed text-text-secondary line-clamp-2">{roommate.bio}</p>
                    )}

                    {/* The plain-language reasons are the explanation a person
                        actually reads. The raw breakdown (Location: 0,
                        Interests: 0) is diagnostic output: the sub-scores are
                        ceiling-relative and a zero is not something a user can
                        interpret, so it was removed from the card rather than
                        dressed up. The breakdown itself is unchanged on the
                        API and still shown on the detail page. */}
                    {roommate.reasons?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {roommate.reasons.slice(0, MAX_CARD_REASONS).map((r, i) => (
                          <Badge variant={r.type === 'positive' ? 'success' : r.type === 'warning' ? 'amber' : 'muted'} key={i}>
                            {r.text}
                          </Badge>
                        ))}
                        {roommate.reasons.length > MAX_CARD_REASONS && (
                          <span className="text-xs text-text-muted self-center">
                            +{roommate.reasons.length - MAX_CARD_REASONS} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Without these the grid is read-only: crossing a roommate
                      has no action attached to it, so the list never shrinks.
                      data-tour is the walkthrough's anchor; nothing else reads it. */}
                  <div data-tour="feed-card" className="flex items-center justify-center gap-4 p-3 border-t border-surface-border">
                    <button
                      type="button"
                      aria-label={`Pass on ${roommate.name}`}
                      onClick={() => handleSwipe(roommate.id, 'pass', roommate.name)}
                      className="w-12 h-12 rounded-full bg-surface-card border border-surface-border flex items-center justify-center text-secondary hover:text-brand-coral hover:border-brand-coral transition-colors"
                    >
                      <X size={20} />
                    </button>
                    <button
                      type="button"
                      aria-pressed={shortlistedIds.has(roommate.id)}
                      aria-label={shortlistedIds.has(roommate.id) ? `Remove ${roommate.name} from shortlist` : `Shortlist ${roommate.name}`}
                      onClick={() => handleShortlist(roommate.id)}
                      className={`w-12 h-12 rounded-full bg-surface-card border border-surface-border flex items-center justify-center transition-colors ${
                        shortlistedIds.has(roommate.id)
                          ? 'text-brand-amber border-brand-amber'
                          : 'text-secondary hover:text-brand-amber hover:border-brand-amber'
                      }`}
                    >
                      <Bookmark size={20} fill={shortlistedIds.has(roommate.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      data-roommate-id={roommate.id}
                      aria-label={`Like ${roommate.name}`}
                      onClick={() => handleSwipe(roommate.id, 'like', roommate.name)}
                      className="w-12 h-12 rounded-full bg-surface-card border border-surface-border flex items-center justify-center text-secondary hover:text-brand-teal hover:border-brand-teal transition-colors"
                    >
                      <Heart size={20} />
                    </button>
                  </div>
                </Card>
              ))}
              </div>
            </>
          )}

          {visible.length > 0 && (
            <div className="text-center mt-6 text-sm text-muted">
              {visible.length} roommates remaining
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}