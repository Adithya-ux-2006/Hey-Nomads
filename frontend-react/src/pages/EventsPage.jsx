import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { Card, Badge, Button, Spinner, EmptyState } from '../components/UI'
import { motion } from 'framer-motion'
import { Calendar, MapPin, Clock, Users, Plus } from 'lucide-react'

const categories = ['social', 'professional', 'sports', 'culture', 'outdoor']

const categoryColors = {
  social: 'coral',
  professional: 'amber',
  sports: 'teal',
  culture: 'amber',
  outdoor: 'teal',
}

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(null)
  const [activeCity, setActiveCity] = useState(null)
  const [rsvping, setRsvping] = useState(null)

  useEffect(() => {
    apiFetch('/events')
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const cities = [...new Set(events.map(e => e.city).filter(Boolean))]

  const handleRsvpToggle = async (event) => {
    setRsvping(event.id)
    try {
      if (event.is_rsvped) {
        await apiFetch(`/events/${event.id}/rsvp`, { method: 'DELETE' })
      } else {
        await apiFetch(`/events/${event.id}/rsvp`, { method: 'POST', body: { status: 'going' } })
      }
      setEvents(prev =>
        prev.map(e =>
          e.id === event.id
            ? { ...e, is_rsvped: !e.is_rsvped, attendee_count: e.attendee_count + (e.is_rsvped ? -1 : 1) }
            : e
        )
      )
    } catch {}
    setRsvping(null)
  }

  const filtered = events.filter(e => {
    const matchesCategory = !activeCategory || e.category === activeCategory
    const matchesCity = !activeCity || e.city === activeCity
    return matchesCategory && matchesCity
  })

  const formatTime = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-24 space-y-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Events</h1>
          <Button size="sm"><Plus size={16} /> Create Event</Button>
        </motion.div>

        {cities.length > 1 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveCity(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                !activeCity
                  ? 'bg-brand-teal text-white border-brand-teal'
                  : 'bg-white text-text-secondary border-surface-border hover:border-brand-teal/30'
              }`}
            >
              All Cities
            </button>
            {cities.map(city => (
              <button
                key={city}
                onClick={() => setActiveCity(activeCity === city ? null : city)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  activeCity === city
                    ? 'bg-brand-teal text-white border-brand-teal'
                    : 'bg-white text-text-secondary border-surface-border hover:border-brand-teal/30'
                }`}
              >
                {city}
              </button>
            ))}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
              !activeCategory
                ? 'bg-brand-coral text-white border-brand-coral'
                : 'bg-white text-text-secondary border-surface-border hover:border-brand-coral/30'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all capitalize ${
                activeCategory === cat
                  ? 'bg-brand-coral text-white border-brand-coral'
                  : 'bg-white text-text-secondary border-surface-border hover:border-brand-coral/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No events found"
            description={activeCategory || activeCity ? "Try a different filter." : "Be the first to create an event!"}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((event, i) => {
              const date = new Date(event.start_time)
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="overflow-hidden h-full flex flex-col">
                    <div className="flex">
                      <div className="flex-shrink-0 w-20 bg-gradient-to-b from-brand-coral to-brand-coral-dark text-white flex flex-col items-center justify-center py-4">
                        <span className="text-xs font-semibold uppercase">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-2xl font-bold leading-none">{date.getDate()}</span>
                        <span className="text-xs">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      </div>
                      <div className="flex-1 p-4 flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          {event.category && <Badge variant={categoryColors[event.category] || 'coral'}>{event.category}</Badge>}
                          {event.community_name && <span className="text-xs text-text-muted">{event.community_name}</span>}
                        </div>
                        <h3 className="font-semibold text-text-primary text-sm line-clamp-1">{event.title}</h3>
                        <div className="flex flex-col gap-1 mt-2 text-xs text-text-muted">
                          <span className="flex items-center gap-1.5"><Clock size={12} /> {formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
                          <span className="flex items-center gap-1.5"><MapPin size={12} /> {event.location}{event.city ? `, ${event.city}` : ''}</span>
                          <span className="flex items-center gap-1.5"><Users size={12} /> {event.attendee_count}/{event.capacity} attendees</span>
                        </div>
                        <div className="mt-auto pt-3">
                          <Button
                            size="sm"
                            variant={event.is_rsvped ? 'ghost' : 'primary'}
                            className="!px-3 !py-1.5 !text-xs w-full"
                            disabled={rsvping === event.id}
                            onClick={() => handleRsvpToggle(event)}
                          >
                            {event.is_rsvped ? 'Going ✓' : 'RSVP'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <button className="fixed bottom-6 right-6 z-50 md:hidden w-14 h-14 rounded-full bg-brand-coral text-white shadow-lg flex items-center justify-center">
        <Plus size={24} />
      </button>
    </Layout>
  )
}
