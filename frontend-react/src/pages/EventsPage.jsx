import { useState } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Card, Badge, Button, Spinner, EmptyState, ErrorState, InlineError } from '../components/UI'
import { Calendar, MapPin, Clock, Users, Plus } from 'lucide-react'

const CATEGORY_COLORS = {
  social: 'coral', housing: 'coral', food: 'coral',
  professional: 'amber', culture: 'amber',
  sports: 'teal', outdoor: 'teal',
}

// Falls back through the seeded values, then anything new, so a community
// creator cannot invent a category that renders grey.
function badgeFor(category) {
  if (!category) return 'muted'
  return CATEGORY_COLORS[category] || 'muted'
}

export default function EventsPage() {
  const { data: events, setData: setEvents, loading, error, retry } = useAsync(
    () => apiFetch('/events').then(d => (Array.isArray(d) ? d : [])),
    []
  )
  const [activeCategory, setActiveCategory] = useState(null)
  const [activeCity, setActiveCity] = useState(null)
  const [rsvping, setRsvping] = useState(null)
  const [rsvpError, setRsvpError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', location: '', city: '', category: '', start: '', end: '', capacity: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.start) return
    setCreating(true)
    setCreateError(null)
    try {
      await apiFetch('/events', {
        method: 'POST',
        body: {
          title: form.title,
          location: form.location,
          city: form.city,
          category: form.category,
          // datetime-local gives "2026-09-01T18:30"; Postgres wants a space.
          start_time: form.start.replace('T', ' '),
          end_time: form.end ? form.end.replace('T', ' ') : null,
          capacity: form.capacity || null,
        },
      })
      setForm({ title: '', location: '', city: '', category: '', start: '', end: '', capacity: '' })
      setShowCreate(false)
      retry()
    } catch (err) {
      setCreateError(err)
    } finally {
      setCreating(false)
    }
  }

  // useAsync starts at null, so these run on first render before the fetch lands.
  const cities = [...new Set((events || []).map(e => e.city).filter(Boolean))]

  const field = 'w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-coral transition-all'

  const handleRsvpToggle = async (event) => {
    setRsvping(event.id)
    setRsvpError(null)
    const wasGoing = event.is_rsvped
    setEvents(prev =>
      prev.map(e =>
        e.id === event.id
          ? { ...e, is_rsvped: !wasGoing, attendee_count: e.attendee_count + (wasGoing ? -1 : 1) }
          : e
      )
    )
    try {
      if (wasGoing) {
        await apiFetch(`/events/${event.id}/rsvp`, { method: 'DELETE' })
      } else {
        await apiFetch(`/events/${event.id}/rsvp`, { method: 'POST', body: { status: 'going' } })
      }
    } catch (err) {
      setEvents(prev =>
        prev.map(e =>
          e.id === event.id
            ? { ...e, is_rsvped: wasGoing, attendee_count: e.attendee_count + (wasGoing ? 1 : -1) }
            : e
        )
      )
      setRsvpError(err)
    }
    setRsvping(null)
  }

  // Categories come from the events themselves. A hardcoded list looked right and
// filtered the page to empty on every click, because the events table has no
// category column at all.
  const categories = [...new Set((events || []).map(e => e.category).filter(Boolean))]

  const filtered = (events || []).filter(e => {
    const matchesCategory = !activeCategory || e.category === activeCategory
    const matchesCity = !activeCity || e.city === activeCity
    return matchesCategory && matchesCity
  })

  const formatTime = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-24 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Events</h1>
          <Button size="sm" onClick={() => setShowCreate(v => !v)} aria-expanded={showCreate}>
            <Plus size={16} /> Create event
          </Button>
        </div>

        {showCreate && (
          <Card className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <InlineError error={createError} />
              <div>
                <label htmlFor="ev-title" className="text-xs font-medium text-text-secondary block mb-1">What is it</label>
                <input id="ev-title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className={field} placeholder="Sunday football in the park" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ev-start" className="text-xs font-medium text-text-secondary block mb-1">Starts</label>
                  <input id="ev-start" type="datetime-local" required value={form.start}
                    onChange={e => setForm({ ...form, start: e.target.value })} className={field} />
                </div>
                <div>
                  <label htmlFor="ev-end" className="text-xs font-medium text-text-secondary block mb-1">Ends (optional)</label>
                  <input id="ev-end" type="datetime-local" value={form.end}
                    onChange={e => setForm({ ...form, end: e.target.value })} className={field} />
                </div>
                <div>
                  <label htmlFor="ev-location" className="text-xs font-medium text-text-secondary block mb-1">Where</label>
                  <input id="ev-location" value={form.location}
                    onChange={e => setForm({ ...form, location: e.target.value })} className={field} placeholder="Venue or street" />
                </div>
                <div>
                  <label htmlFor="ev-city" className="text-xs font-medium text-text-secondary block mb-1">City</label>
                  <input id="ev-city" list="event-cities" value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })} className={field} />
                  <datalist id="event-cities">
                    {cities.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="ev-category" className="text-xs font-medium text-text-secondary block mb-1">Type</label>
                  <input id="ev-category" value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })} className={field}
                    placeholder="social, sports, outdoor..." />
                </div>
                <div>
                  <label htmlFor="ev-capacity" className="text-xs font-medium text-text-secondary block mb-1">Capacity (optional)</label>
                  <input id="ev-capacity" type="number" min="1" value={form.capacity}
                    onChange={e => setForm({ ...form, capacity: e.target.value })} className={field} placeholder="20" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={creating || !form.title.trim() || !form.start}>
                  {creating ? 'Posting...' : 'Post event'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        {cities.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
        </div>
        )}

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              type="button"
              aria-pressed={activeCategory === null}
              onClick={() => setActiveCategory(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                activeCategory === null
                  ? 'bg-brand-coral text-white border-brand-coral'
                  : 'bg-white text-text-secondary border-surface-border hover:border-brand-coral/30'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                aria-pressed={activeCategory === cat}
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
          </div>
        )}

        <InlineError error={rsvpError} />

        {error ? (
          <ErrorState what="events" error={error} onRetry={retry} />
        ) : loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No events found"
            description={activeCategory || activeCity
              ? "Try a different filter."
              : "Nothing lined up yet. Post one and people in your city will see it."}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((event) => {
              const date = new Date(event.start_time)
              return (
                <Card key={event.id} className="overflow-hidden h-full flex flex-col">
                    <div className="flex">
                      <div className="flex-shrink-0 w-20 bg-gradient-to-b from-brand-coral to-brand-coral-dark text-white flex flex-col items-center justify-center py-4">
                        <span className="text-xs font-semibold uppercase">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-2xl font-bold leading-none">{date.getDate()}</span>
                        <span className="text-xs">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      </div>
                      <div className="flex-1 p-4 flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          {event.category && <Badge variant={badgeFor(event.category)}>{event.category}</Badge>}
                          {event.community_name && <span className="text-xs text-text-muted">{event.community_name}</span>}
                        </div>
                        <h3 className="font-semibold text-text-primary text-sm line-clamp-1">{event.title}</h3>
                        <div className="flex flex-col gap-1 mt-2 text-xs text-text-muted">
                          <span className="flex items-center gap-1.5"><Clock size={12} /> {formatTime(event.start_time)}{event.end_time ? ` – ${formatTime(event.end_time)}` : ''}</span>
                          <span className="flex items-center gap-1.5"><MapPin size={12} /> {event.location}{event.city ? `, ${event.city}` : ''}</span>
                          <span className="flex items-center gap-1.5"><Users size={12} /> {event.attendee_count || 0}{event.capacity ? `/${event.capacity}` : ''} attendees</span>
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
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Create an event"
        aria-expanded={showCreate}
        onClick={() => setShowCreate(v => !v)}
        className="fixed bottom-6 right-6 z-50 md:hidden w-14 h-14 rounded-full bg-brand-coral text-white shadow-lg flex items-center justify-center"
      >
        <Plus size={24} />
      </button>
    </Layout>
  );
}
