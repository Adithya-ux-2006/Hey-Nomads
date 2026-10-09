import { useState } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Card, EmptyState, Spinner, CompatibilityBadge, ErrorState, InlineError } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { MessageCircle, MoreVertical, UserX } from 'lucide-react'

export default function MatchesPage() {
  // A failed fetch used to drop through to "No matches yet / Start swiping!",
  // which reported an outage as an empty account.
  const { data, setData, loading, error, retry } = useAsync(
    () => apiFetch('/matches').then(d => (Array.isArray(d) ? d : [])),
    []
  )
  const matches = data || []
  const [openMenu, setOpenMenu] = useState(null)
  const [actionError, setActionError] = useState(null)

  const handleUnmatch = async (matchId) => {
    setActionError(null)
    try {
      await apiFetch(`/matches/${matchId}`, { method: 'DELETE' })
      setData(prev => prev.filter(m => m.id !== matchId))
    } catch (err) {
      setActionError(err)
    } finally {
      setOpenMenu(null)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-brand-coral mb-6">Your Matches</h1>

        <InlineError error={actionError} />

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <ErrorState what="matches" error={error} onRetry={retry} />
        ) : matches.length === 0 ? (
          <EmptyState
            title="No matches yet"
            description="Like someone who likes you back and the conversation starts here."
          />
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
                <Card key={match.id} className="relative p-4 flex items-center gap-4">
                  <UserAvatar
                    src={match.partner_image}
                    name={match.partner_name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-text-primary truncate">
                        {match.partner_name}
                      </h3>
                      <CompatibilityBadge score={match.compatibility_score} />
                    </div>
                    <p className="text-sm text-text-muted">
                      {[match.partner_occupation, match.partner_city].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/messages/${match.partner_id}`}
                      aria-label={`Message ${match.partner_name}`}
                      className="p-2 rounded-full bg-brand-teal text-white hover:opacity-90 transition"
                    >
                      <MessageCircle size={18} />
                    </Link>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`More options for ${match.partner_name}`}
                        aria-expanded={openMenu === match.id}
                        onClick={() => setOpenMenu(openMenu === match.id ? null : match.id)}
                        className="p-2 rounded-full hover:bg-surface-card transition"
                      >
                        <MoreVertical size={18} className="text-text-muted" />
                      </button>
                      {openMenu === match.id && (
                        <div className="absolute right-0 top-full mt-1 bg-surface-card border border-surface-border rounded-lg shadow-lg z-10 min-w-[120px]">
                          <button
                            type="button"
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
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
