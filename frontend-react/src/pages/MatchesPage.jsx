import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { Card, CompatibilityBadge, Badge, Spinner, EmptyState } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageCircle, MoreVertical, UserX } from 'lucide-react'

export default function MatchesPage() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState(null)

  useEffect(() => {
    apiFetch('/api/matches')
      .then(setMatches)
      .finally(() => setLoading(false))
  }, [])

  const handleUnmatch = async (matchId) => {
    await apiFetch(`/api/matches/${matchId}`, { method: 'DELETE' })
    setMatches(prev => prev.filter(m => m.id !== matchId))
    setOpenMenu(null)
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-brand-coral mb-6">Your Matches</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : matches.length === 0 ? (
          <EmptyState
            title="No matches yet"
            description="Start swiping!"
          />
        ) : (
          <div className="space-y-4">
            {matches.map((match, i) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="relative p-4 flex items-center gap-4">
                  <UserAvatar
                    src={match.partner_image}
                    name={match.partner_name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-surface-bg truncate">
                        {match.partner_name}
                      </h3>
                      <CompatibilityBadge score={match.compatibility_score} />
                    </div>
                    <p className="text-sm text-surface-border">
                      {match.partner_occupation} · {match.partner_city}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/messages/${match.partner_id}`}
                      className="p-2 rounded-full bg-brand-teal text-white hover:opacity-90 transition"
                    >
                      <MessageCircle size={18} />
                    </Link>
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === match.id ? null : match.id)}
                        className="p-2 rounded-full hover:bg-surface-card transition"
                      >
                        <MoreVertical size={18} className="text-surface-border" />
                      </button>
                      {openMenu === match.id && (
                        <div className="absolute right-0 top-full mt-1 bg-surface-card border border-surface-border rounded-lg shadow-lg z-10 min-w-[120px]">
                          <button
                            onClick={() => handleUnmatch(match.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-surface-bg rounded-lg"
                          >
                            <UserX size={16} />
                            Unmatch
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
