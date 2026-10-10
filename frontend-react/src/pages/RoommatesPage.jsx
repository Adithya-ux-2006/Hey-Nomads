import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Card, Badge, CompatibilityBadge, Spinner, EmptyState, ErrorState, InlineError, Button } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { SlidersHorizontal, ChevronDown, MapPin, Briefcase, Heart, X, Bookmark } from 'lucide-react'

const BREAKDOWN_LABELS = {
  lifestyle: 'Lifestyle',
  budget: 'Budget',
  location: 'Location',
  movein: 'Move-in',
  interests: 'Interests',
  habits: 'Habits',
}

const DemoModeLink = () => (
  <Link
    to="/demo"
    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-amber text-white text-sm font-semibold hover:opacity-90 transition-opacity"
  >
    Try Demo Mode
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
            // The real pool is genuinely empty right now. Say so and point at
            // Demo Mode rather than quietly loosening the feed to fill it.
            <EmptyState
              title={hasFilters ? 'No matches in your filters' : 'No roommates to show you yet'}
              description={hasFilters
                ? 'Try widening the city or budget range.'
                : 'Recommendations only include real accounts, and there are none available right now. You can still try the whole flow with clearly labelled sample profiles.'}
              action={<DemoModeLink />}
            />
          ) : (
            <>
              {/* A new account has nobody who liked it first, so it cannot match
                  anything. Demo Mode shows the flow without pretending the
                  samples are real people. */}
              <div className="mb-4 p-3 rounded-xl bg-surface-card border border-surface-border flex flex-wrap items-center gap-3">
                <span className="text-sm text-text-secondary flex-1 min-w-[200px]">
                  New here? A match needs a mutual like, so nobody appears until someone likes you first.
                </span>
                <Link
                  to="/demo"
                  className="px-3 py-2 rounded-lg bg-brand-amber text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Try Demo Mode
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {visible.map(roommate => (
                <Card key={roommate.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
                  <Link to={`/roommates/${roommate.id}`}>
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
                  </Link>

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
                          <Badge variant={r.type === 'positive' ? 'success' : r.type === 'warning' ? 'warning' : 'neutral'} key={i}>
                            {r.text}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {roommate.breakdown && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(roommate.breakdown).map(([key, val]) => (
                          <Badge variant="muted" key={key} className="text-xs">
                            {BREAKDOWN_LABELS[key] || key}: {val}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Without these the grid is read-only: crossing a roommate
                      has no action attached to it, so the list never shrinks. */}
                  <div className="flex items-center justify-center gap-4 p-3 border-t border-surface-border">
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

          {visible.length === 0 && (
            <EmptyState
              title="You've seen everyone"
              description="Try widening your filters, or check back when more people join your city."
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
        </div>
      </div>
    </Layout>
  )
}