import { useState } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Card, Spinner, EmptyState, ErrorState } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { MessageCircle, Search } from 'lucide-react'

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function truncate(str, len = 50) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

export default function MessagesPage() {
  // useAsync rather than a bare .then: a failed fetch previously fell through
  // to the empty state, so an outage was reported as "no conversations yet".
  const { data, loading, error, retry } = useAsync(
    () => apiFetch('/conversations').then(d => (Array.isArray(d) ? d : [])),
    []
  )
  const conversations = data || []
  const [search, setSearch] = useState('')

  const filtered = conversations.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.partner_name?.toLowerCase().includes(q) ||
      c.last_message?.toLowerCase().includes(q) ||
      c.partner_city?.toLowerCase().includes(q)
    )
  })

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand-coral mb-4">Messages</h1>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              size={18}
            />
            <input
              type="search"
              aria-label="Search conversations"
              placeholder="Search conversations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-border bg-surface-card text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-coral/30 focus:border-brand-coral transition-all"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <ErrorState what="conversations" error={error} onRetry={retry} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No conversations yet"
            description="Match with someone to start chatting!"
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((convo) => {
              const unread = convo.unread_count > 0
              return (
                  <Link key={convo.conversation_id} to={`/messages/${convo.partner_id}`}>
                    <Card
                      interactive
                      className={`p-4 flex items-center gap-3 ${
                        unread ? 'bg-brand-coral/5 border-brand-coral/20' : ''
                      }`}
                    >
                      <UserAvatar
                        src={convo.partner_image}
                        name={convo.partner_name}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-sm truncate ${
                              unread ? 'font-bold text-text-primary' : 'font-medium text-text-primary'
                            }`}
                          >
                            {convo.partner_name}
                          </span>
                          <span className="text-xs text-text-muted flex-shrink-0">
                            {relativeTime(convo.last_message_time)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p
                            className={`text-xs truncate ${
                              unread ? 'font-semibold text-text-primary' : 'text-text-muted'
                            }`}
                          >
                            {convo.last_message_from_me && 'You: '}
                            {truncate(convo.last_message)}
                          </p>
                          {unread && (
                            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-brand-coral text-white text-[10px] font-bold">
                              {convo.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
