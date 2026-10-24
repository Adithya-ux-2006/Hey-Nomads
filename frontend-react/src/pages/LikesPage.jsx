import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import {
  Card, EmptyState, Spinner, ErrorState, Button, Badge, CompatibilityBadge,
} from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Heart, MessageCircle, Check, X } from 'lucide-react'

// Three tabs, one screen. Counts are the lengths of the very lists each tab
// renders — there is no separate summary endpoint that could disagree with
// them, and nothing here is ever seeded: rows come from /likes/sent,
// /likes/received and /matches, or from the labelled demo transport in a tour.
const TABS = [
  { id: 'sent', label: 'Sent' },
  { id: 'received', label: 'Received' },
  { id: 'matches', label: 'Matches' },
]

// When the Matches tab was last opened. Not sensitive — a view timestamp in
// this browser only — so no schema change is needed to mark a match as new.
const LAST_SEEN_KEY = 'likes_matches_last_seen'

const rowMeta = row => [row.occupation, row.city].filter(Boolean).join(', ')

// /api/matches answers with partner_* fields (the same rows the Matches page
// renders); /likes/sent answers with user_id/name. Both land in one row shape
// here so the Matches tab can reuse the exact same list component.
const asLikeRow = m => ({
  user_id: m.partner_id ?? m.user_id,
  name: m.partner_name ?? m.name,
  profile_image: m.partner_image ?? m.profile_image,
  city: m.partner_city ?? m.city,
  occupation: m.partner_occupation ?? m.occupation,
  liked_at: m.updated_at ?? m.liked_at,
  matched: true,
})

function LikeRow({ row, matched, isNew = false, pending = false, onAccept, onDismiss }) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <UserAvatar src={row.profile_image} name={row.name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-text-primary truncate">{row.name}</h3>
          {typeof row.score === 'number' && <CompatibilityBadge score={row.score} size="sm" />}
          {matched && <Badge variant="teal">Matched</Badge>}
          {!matched && row.matched === undefined && <Badge variant="muted">New like</Badge>}
          {!matched && row.matched === false && <Badge variant="muted">Sent</Badge>}
          {isNew && <Badge variant="coral">New</Badge>}
        </div>
        <p className="text-sm text-text-muted truncate">{rowMeta(row)}</p>
      </div>
      {matched ? (
        <Link
          to={`/messages/${row.user_id}`}
          aria-label={`Message ${row.name}`}
          className="p-3 rounded-full bg-brand-teal text-white hover:opacity-90 transition min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
        >
          <MessageCircle size={18} />
        </Link>
      ) : (
        <>
          <span className="hidden sm:inline text-xs text-text-muted whitespace-nowrap">
            {row.matched === undefined ? 'Liked you' : 'Waiting for a reply'}
          </span>
          {onAccept && onDismiss && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onDismiss(row.user_id)}
                disabled={pending}
                aria-label={`Dismiss ${row.name}`}
                className="p-3 rounded-full border border-surface-border bg-white text-text-secondary hover:border-brand-coral/40 hover:text-brand-coral transition disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
              >
                <X size={18} />
              </button>
              <button
                type="button"
                onClick={() => onAccept(row.user_id)}
                disabled={pending}
                aria-label={`Accept like from ${row.name}`}
                className="p-3 rounded-full bg-brand-teal text-white hover:opacity-90 transition disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
              >
                <Check size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export default function LikesPage() {
  const [tab, setTab] = useState('sent')

  const sentQ = useAsync(() => apiFetch('/likes/sent').then(d => (Array.isArray(d) ? d : [])), [])
  const receivedQ = useAsync(() => apiFetch('/likes/received').then(d => (Array.isArray(d) ? d : [])), [])
  const matchesQ = useAsync(() => apiFetch('/matches').then(d => (Array.isArray(d) ? d : [])), [])

  // Capture the previous last-seen once at mount; the overwrite effect below
  // runs later, so rows still compare against the value the user has not seen.
  const lastSeenRef = useRef('')
  useEffect(() => {
    lastSeenRef.current = localStorage.getItem(LAST_SEEN_KEY) || ''
  }, [])
  useEffect(() => {
    if (matchesQ.data) {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
    }
  }, [matchesQ.data])

  const isNewMatch = m => {
    if (!m.updated_at) return false
    if (!lastSeenRef.current) return true
    return new Date(m.updated_at) > new Date(lastSeenRef.current)
  }

  const counts = {
    sent: sentQ.data?.length || 0,
    received: receivedQ.data?.length || 0,
    matches: matchesQ.data?.length || 0,
  }

  // Answering an incoming like is a swipe against oneself, the same endpoint
  // the discovery screen uses: 'like' makes it mutual (a real match), 'pass'
  // records the decision so the row leaves Received on both demo and real data.
  const [pendingIds, setPendingIds] = useState(new Set())
  const [actionError, setActionError] = useState(null)

  const answerLike = action => async targetId => {
    setActionError(null)
    setPendingIds(prev => { const next = new Set(prev); next.add(targetId); return next })
    try {
      await apiFetch('/swipe', { method: 'POST', body: { targetId: Number(targetId), action } })
    } catch (err) {
      setActionError(err)
    } finally {
      setPendingIds(prev => { const next = new Set(prev); next.delete(targetId); return next })
      sentQ.retry(); receivedQ.retry(); matchesQ.retry()
    }
  }
  const acceptLike = answerLike('like')
  const dismissLike = answerLike('pass')

  const panel = (id, query, empty) => {
    const rows = query.data || []
    if (query.loading) {
      return (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )
    }
    if (query.error) {
      return <ErrorState what={id === 'matches' ? 'matches' : 'likes'} error={query.error} onRetry={query.retry} />
    }
    if (!rows.length) return empty
    return (
      <div className="space-y-4">
        {rows.map(raw => {
          const row = id === 'matches' ? asLikeRow(raw) : raw
          return (
            <LikeRow
              key={row.user_id}
              row={row}
              matched={id === 'matches' ? true : !!row.matched}
              isNew={id === 'matches' && isNewMatch(raw)}
              pending={pendingIds.has(row.user_id)}
              onAccept={id === 'received' ? acceptLike : undefined}
              onDismiss={id === 'received' ? dismissLike : undefined}
            />
          )
        })}
      </div>
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Likes</h1>

        {/* Tabs are the navigation; the count badge never carries meaning by
            colour alone — it is a number next to the tab's own word. */}
        <div role="tablist" aria-label="Likes and matches" className="flex flex-wrap gap-2 mb-6">
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`likes-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`likes-panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2 ${
                  active
                    ? 'bg-brand-coral text-white shadow-card'
                    : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/30'
                }`}
              >
                {t.label}
                {counts[t.id] > 0 && (
                  <span
                    className={`ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-brand-coral/10 text-brand-coral'
                    }`}
                  >
                    {counts[t.id]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {actionError && (
          <p role="alert" className="-mt-2 mb-4 text-sm text-brand-coral">
            Could not save that. {actionError.message} Adjusted lists are shown.
          </p>
        )}

        <div role="tabpanel" id="likes-panel-sent" aria-labelledby="likes-tab-sent" hidden={tab !== 'sent'}>
          {panel('sent', sentQ, (
            <EmptyState
              icon={Heart}
              title="No likes sent yet"
              description="Browse roommates and like the people you would live with."
              action={<Link to="/roommates"><Button>Find roommates</Button></Link>}
            />
          ))}
        </div>

        <div role="tabpanel" id="likes-panel-received" aria-labelledby="likes-tab-received" hidden={tab !== 'received'}>
          {panel('received', receivedQ, (
            <EmptyState
              icon={Heart}
              title="No incoming likes yet"
              description="When someone likes you, they will show up here."
              action={<Link to="/roommates"><Button>Find roommates</Button></Link>}
            />
          ))}
        </div>

        <div role="tabpanel" id="likes-panel-matches" aria-labelledby="likes-tab-matches" hidden={tab !== 'matches'}>
          {panel('matches', matchesQ, (
            <EmptyState
              icon={Heart}
              title="No matches yet"
              description="Like someone who likes you back and the conversation starts here."
              action={<Link to="/roommates"><Button>Find roommates</Button></Link>}
            />
          ))}
        </div>
      </div>
    </Layout>
  )
}
