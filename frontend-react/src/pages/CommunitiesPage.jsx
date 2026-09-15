import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { Card, Badge, Button, Spinner, EmptyState } from '../components/UI'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, MapPin, Plus, Search, Filter } from 'lucide-react'

const categories = ['city', 'interest', 'professional', 'student', 'sports']

const categoryColors = {
  city: 'teal',
  interest: 'coral',
  professional: 'amber',
  student: 'teal',
  sports: 'coral',
}

const gradients = [
  'from-brand-coral/20 to-brand-amber/10',
  'from-brand-teal/20 to-brand-teal/5',
  'from-brand-amber/20 to-brand-coral/10',
  'from-brand-teal/10 to-brand-amber/10',
]

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(null)
  const [joining, setJoining] = useState(null)

  useEffect(() => {
    apiFetch('/communities')
      .then(setCommunities)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleJoinToggle = async (community) => {
    setJoining(community.id)
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
    } catch {}
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
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Communities</h1>
          <Link to="/communities/create">
            <Button size="sm"><Plus size={16} /> Create</Button>
          </Link>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search communities..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-surface-card border border-surface-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-coral/30"
            />
          </div>
        </motion.div>

        {/* Category chips */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No communities found"
            description={search || activeCategory ? "Try a different search or filter." : "Be the first to create a community!"}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((community, i) => (
              <motion.div
                key={community.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card interactive className="overflow-hidden h-full flex flex-col">
                  <Link to={`/communities/${community.id}`} className="block">
                    <div className={`h-32 bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center overflow-hidden`}>
                      {community.image ? (
                        <img src={community.image} alt={community.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users size={32} className="text-brand-teal/50" />
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
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <Link to="/communities/create" className="fixed bottom-6 right-6 z-50 md:hidden">
        <motion.div whileTap={{ scale: 0.9 }} className="w-14 h-14 rounded-full bg-brand-coral text-white shadow-lg flex items-center justify-center">
          <Plus size={24} />
        </motion.div>
      </Link>
    </Layout>
  )
}
