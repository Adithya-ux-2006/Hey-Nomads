import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { apiFetch, auth } from '../lib/api'
import { Card, CompatibilityBadge, Badge, Spinner, EmptyState } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, X, Bookmark, SlidersHorizontal, ChevronDown, MapPin, Briefcase, IndianRupee } from 'lucide-react'

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
                <IndianRupee size={14} /> {roommate.budget?.toLocaleString()}/mo
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
                  <Badge key={key} variant="neutral" className="text-xs">
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
          onClick={(e) => { e.stopPropagation(); setDragDir('left'); onSwipe('pass') }}
          className="w-14 h-14 rounded-full bg-surface-card border border-surface-border flex items-center justify-center text-secondary hover:text-brand-coral hover:border-brand-coral transition-colors shadow-sm"
        >
          <X size={24} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onShortlist() }}
          className={`w-14 h-14 rounded-full bg-surface-card border border-surface-border flex items-center justify-center transition-colors shadow-sm ${
            shortlisted ? 'text-brand-amber border-brand-amber' : 'text-secondary hover:text-brand-amber hover:border-brand-amber'
          }`}
        >
          <Bookmark size={24} fill={shortlisted ? 'currentColor' : 'none'} />
        </button>
        <button
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
  const [roommates, setRoommates] = useState([])
  const [loading, setLoading] = useState(true)
  const [swipedIds, setSwipedIds] = useState(new Set())
  const [shortlistedIds, setShortlistedIds] = useState(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [city, setCity] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')

  const fetchRoommates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (city) params.set('city', city)
      if (budgetMin) params.set('budget_min', budgetMin)
      if (budgetMax) params.set('budget_max', budgetMax)
      const qs = params.toString()
      const data = await apiFetch(`/api/roommates/recommended${qs ? `?${qs}` : ''}`)
      setRoommates(data)
      setSwipedIds(new Set())
    } catch (err) {
      console.error('Failed to fetch roommates', err)
    } finally {
      setLoading(false)
    }
  }, [city, budgetMin, budgetMax])

  const fetchShortlist = useCallback(async () => {
    try {
      const data = await apiFetch('/api/shortlist')
      setShortlistedIds(new Set(data.map(u => u.id)))
    } catch {}
  }, [])

  useEffect(() => {
    if (auth.token) {
      fetchRoommates()
      fetchShortlist()
    }
  }, [fetchRoommates, fetchShortlist])

  const currentRoommate = roommates.find(r => !swipedIds.has(r.id))

  const handleSwipe = async (action) => {
    if (!currentRoommate) return
    setSwipedIds(prev => new Set(prev).add(currentRoommate.id))
    try {
      await apiFetch('/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: currentRoommate.id, action }),
      })
    } catch {}
  }

  const handleShortlist = async () => {
    if (!currentRoommate) return
    const isShortlisted = shortlistedIds.has(currentRoommate.id)
    setShortlistedIds(prev => {
      const next = new Set(prev)
      if (isShortlisted) next.delete(currentRoommate.id)
      else next.add(currentRoommate.id)
      return next
    })
    if (!isShortlisted) {
      try {
        await apiFetch('/api/shortlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetId: currentRoommate.id }),
        })
      } catch {}
    }
  }

  const cities = [...new Set(roommates.map(r => r.city).filter(Boolean))]

  return (
    <Layout>
      <div className="min-h-screen bg-surface-bg">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-primary">Recommended Roommates</h1>
            <button
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
                    <label className="text-xs font-medium text-secondary block mb-1">City</label>
                    <div className="relative">
                      <select
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
                    <label className="text-xs font-medium text-secondary block mb-1">Min Budget</label>
                    <input
                      type="number"
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value)}
                      placeholder="₹0"
                      className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Max Budget</label>
                    <input
                      type="number"
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                      placeholder="₹50,000"
                      className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-primary"
                    />
                  </div>
                </div>
                <button
                  onClick={fetchRoommates}
                  className="w-full bg-brand-teal text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Apply Filters
                </button>
              </Card>
            </motion.div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : currentRoommate ? (
            <AnimatePresence mode="wait">
              <RoommateCard
                key={currentRoommate.id}
                roommate={currentRoommate}
                onSwipe={handleSwipe}
                shortlisted={shortlistedIds.has(currentRoommate.id)}
                onShortlist={handleShortlist}
              />
            </AnimatePresence>
          ) : (
            <EmptyState
              title="No more roommates"
              description="You've seen everyone. Try adjusting your filters or check back later."
              action={
                <button
                  onClick={() => { setSwipedIds(new Set()); fetchRoommates() }}
                  className="mt-4 bg-brand-coral text-white rounded-lg px-6 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Refresh
                </button>
              }
            />
          )}

          {currentRoommate && (
            <div className="text-center mt-6 text-sm text-muted">
              {roommates.filter(r => !swipedIds.has(r.id)).length} roommates remaining
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
