import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { auth, apiFetch } from '../lib/api'
import { isDemo } from '../lib/demoMode'
import { destinationFor, labelFor } from '../../api/notifications.mjs'

// In-app bell. Polls the cheap unread-count endpoint rather than holding a
// socket: the backend is serverless, so a persistent connection buys nothing
// and a 30s poll is more than fresh enough for a social product. A failed poll
// never surfaces an error — the badge simply keeps its last known value, and a
// broken notifications table (migration not yet applied) reads as "no bell"
// rather than crashing every screen that mounts the navbar.
const POLL_MS = 30000

function useUnreadCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (isDemo() || !auth.isAuthenticated()) { setCount(0); return undefined }
    let cancelled = false
    const tick = () =>
      apiFetch('/notifications/unread-count')
        .then(d => { if (!cancelled && d && typeof d.unreadCount === 'number') setCount(d.unreadCount) })
        .catch(() => { /* keep last known count; never break the navbar */ })
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])
  // Returned as a pair so the optimistic decrements below cannot drift out of
  // sync with the poll — both write to the same state.
  return [count, setCount]
}

// A small dropdown panel, not a separate page, so checking the bell never
// costs a full navigation. "Mark all read" clears the badge in one tap.
export default function NotificationBell() {
  const navigate = useNavigate()
  const [count, setCount] = useUnreadCount()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setLoading(true)
    apiFetch('/notifications?limit=30')
      .then(d => { if (!cancelled) setRows(Array.isArray(d?.notifications) ? d.notifications : []) })
      .catch(() => { if (!cancelled) setRows([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open])

  // Close on outside click / Escape so the panel never traps the user.
  useEffect(() => {
    if (!open) return undefined
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    const onClick = e => { if (!e.target.closest('[data-bell-root]')) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick) }
  }, [open])

  const openRow = row => {
    const dest = destinationFor(row.type, row.actor_id)
    if (!row.read_at) {
      apiFetch(`/notifications/${row.id}/read`, { method: 'POST' }).catch(() => {})
      setCount(c => Math.max(0, c - 1))
    }
    setOpen(false)
    if (dest) navigate(dest)
  }

  const markAll = () => {
    apiFetch('/notifications/read-all', { method: 'POST' }).catch(() => {})
    setCount(0)
    setRows(r => r.map(x => ({ ...x, read_at: x.read_at || 'cleared' })))
  }

  if (isDemo() || !auth.isAuthenticated()) return null

  return (
    <div className="fixed top-0 right-0 z-40" data-bell-root>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        className="m-2 relative p-2 rounded-full bg-white/90 backdrop-blur border border-surface-border text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
      >
        <Bell size={20} aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-brand-coral text-white text-[10px] font-bold"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-2 top-14 w-[min(22rem,calc(100vw-1rem))] max-h-[70vh] overflow-y-auto rounded-2xl bg-white border border-surface-border shadow-xl"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <h2 className="text-sm font-bold text-text-primary">Notifications</h2>
            {count > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs font-semibold text-brand-coral hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {loading ? (
            <p className="px-4 py-6 text-sm text-text-muted text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted text-center">
              Nothing yet. Likes, matches and messages will show up here.
            </p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {rows.map(row => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => openRow(row)}
                    className={`w-full text-left px-4 py-3 hover:bg-surface-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral ${
                      row.read_at ? '' : 'bg-brand-coral/5'
                    }`}
                  >
                    <p className={`text-sm ${row.read_at ? 'text-text-secondary' : 'text-text-primary font-semibold'}`}>
                      {labelFor(row.type, row.actor_name)}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
