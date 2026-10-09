import { useState } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Card, Badge, Button, Spinner, EmptyState, ErrorState, InlineError } from '../components/UI'
import { Link } from 'react-router-dom'
import { Users, MapPin, Plus, Search, Filter } from 'lucide-react'

const categoryColors = {
  city: 'teal',
  interest: 'coral',
  professional: 'amber',
  student: 'teal',
  sports: 'coral',
  housing: 'teal',
  social: 'coral',
  outdoor: 'teal',
  food: 'amber',
}

export default function CommunitiesPage() {
  const { data: communities, setData: setCommunities, loading, error, retry } = useAsync(
    () => apiFetch('/communities').then(d => (Array.isArray(d) ? d : [])),
    []
  )
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(null)
  const [joining, setJoining] = useState(null)
  const [joinError, setJoinError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: '', city: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  // Derived from the communities themselves. The previous hardcoded list had
  // three values no seeded community used, so those chips emptied the page.
  const categories = [...new Set((communities || []).map(c => c.category).filter(Boolean))]

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      await apiFetch('/communities', {
        method: 'POST',
        body: {
          name: form.name,
          description: form.description,
          category: form.category || null,
          city: form.city || null,
        },
      })
      setForm({ name: '', description: '', category: '', city: '' })
      setShowCreate(false)
      retry()
    } catch (err) {
      setCreateError(err)
    } finally {
      setCreating(false)
    }
  }

  const handleJoinToggle = async (community) => {
    setJoining(community.id)
    setJoinError(null)
    try {
      const endpoint = community.is_member
        ? `/communities/${community.id}/leave`
        : `/communities/${community.id}/join`
      await apiFetch(endpoint, { method: 'POST' })
      setCommunities(prev =>
        prev.map(c =>
          c.id === community.id
            ? { ...c, is_member: !c.is_member, member_count: c.member_count + (c.is_member ? -1 : 1) }
            : c
        )
      )
    } catch (err) {
      setJoinError(err)
    }
    setJoining(null)
  }

  const filtered = (communities || []).filter(c => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !activeCategory || c.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Communities</h1>
          <Button size="sm" onClick={() => setShowCreate(v => !v)} aria-expanded={showCreate}>
            <Plus size={16} /> Create
          </Button>
        </div>

        {showCreate && (
          <Card className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <InlineError error={createError} />
              <div>
                <label htmlFor="c-name" className="text-xs font-medium text-text-secondary block mb-1">Name</label>
                <input id="c-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-coral transition-all"
                  placeholder="Mumbai Food Crawl" />
              </div>
              <div>
                <label htmlFor="c-desc" className="text-xs font-medium text-text-secondary block mb-1">What is it</label>
                <textarea id="c-desc" rows={2} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-coral transition-all resize-none"
                  placeholder="Weekend food tours for people who just moved here." />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="c-category" className="text-xs font-medium text-text-secondary block mb-1">Type</label>
                  <input id="c-category" value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-coral transition-all"
                    placeholder="food, social, outdoor..." />
                </div>
                <div>
                  <label htmlFor="c-city" className="text-xs font-medium text-text-secondary block mb-1">City</label>
                  <input id="c-city" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                    className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-coral transition-all"
                    placeholder="Mumbai" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={creating || !form.name.trim()}>
                  {creating ? 'Creating...' : 'Create community'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        <InlineError error={joinError} />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search communities"
            aria-label="Search communities"
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-surface-card border border-surface-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/25"
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
              !activeCategory
                ? 'bg-brand-coral text-white border-brand-coral'
                : 'bg-white text-text-secondary border-surface-border hover:border-brand-coral/30'
            }`}
          >
            <Filter size={14} className="inline mr-1" />
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
        </div>

        {/* Content */}
        {error ? (
          <ErrorState what="communities" error={error} onRetry={retry} />
        ) : loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No communities found"
            description={search || activeCategory
              ? "Try a different search or filter."
              : "Nothing here yet. Start one and you become its first member."}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((community) => (
              <Card key={community.id} interactive className="overflow-hidden h-full flex flex-col">
                  <Link to={`/communities/${community.id}`} className="block">
                    <div className="h-32 bg-surface-muted flex items-center justify-center overflow-hidden">
                      {community.image ? (
                        <img src={community.image} alt={community.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users size={32} className="text-brand-teal/40" />
                      )}
                    </div>
                  </Link>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {community.category && (
                        <Badge variant={categoryColors[community.category] || 'muted'}>{community.category}</Badge>
                      )}
                      {community.city && (
                        <span className="flex items-center gap-1 text-text-muted text-xs">
                          <MapPin size={11} /> {community.city}
                        </span>
                      )}
                    </div>
                    <Link to={`/communities/${community.id}`}>
                      <h3 className="font-semibold text-text-primary text-sm hover:text-brand-coral transition-colors line-clamp-1">{community.name}</h3>
                    </Link>
                    <p className="text-text-muted text-xs mt-1 line-clamp-2 flex-1">{community.description}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-border">
                      <span className="flex items-center gap-1 text-text-muted text-xs">
                        <Users size={12} /> {community.member_count} members
                      </span>
                      <Button
                        size="sm"
                        variant={community.is_member ? 'ghost' : 'primary'}
                        className="!px-3 !py-1.5 !text-xs"
                        disabled={joining === community.id}
                        onClick={() => handleJoinToggle(community)}
                      >
                        {community.is_member ? 'Leave' : 'Join'}
                      </Button>
                    </div>
                  </div>
                </Card>
            ))}
          </div>
        )}
      </div>

      {/* Was a link to /communities/create, a route that does not exist. */}
      <button
        type="button"
        onClick={() => setShowCreate(true)}
        aria-label="Create a community"
        aria-expanded={showCreate}
        className="fixed bottom-6 right-6 z-50 md:hidden w-14 h-14 rounded-full bg-brand-coral text-white shadow-lg flex items-center justify-center"
      >
        <Plus size={24} />
      </button>
    </Layout>
  );
}
