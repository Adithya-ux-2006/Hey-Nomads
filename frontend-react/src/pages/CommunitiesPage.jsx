import { useState } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Card, Badge, Button, Spinner, EmptyState, ErrorState, InlineError } from '../components/UI'
import { Link } from 'react-router-dom'
import { Users, MapPin, Plus, Search, Filter } from 'lucide-react'

const categories = ['city', 'interest', 'professional', 'student', 'sports']

const categoryColors = {
  city: 'teal',
  interest: 'coral',
  professional: 'amber',
  student: 'teal',
  sports: 'coral',
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

  const filtered = communities.filter(c => {
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
          <Link to="/communities/create">
            <Button size="sm"><Plus size={16} /> Create</Button>
          </Link>
        </div>

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
            description={search || activeCategory ? "Try a different search or filter." : "Be the first to create a community!"}
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
                      <Badge variant={categoryColors[community.category] || 'teal'}>{community.category}</Badge>
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

      {/* FAB */}
      <Link
        to="/communities/create"
        aria-label="Create a community"
        className="fixed bottom-6 right-6 z-50 md:hidden"
      >
        <div className="w-14 h-14 rounded-full bg-brand-coral text-white shadow-lg flex items-center justify-center">
          <Plus size={24} />
        </div>
      </Link>
    </Layout>
  );
}
