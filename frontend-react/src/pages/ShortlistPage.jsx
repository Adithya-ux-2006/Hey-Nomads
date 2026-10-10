import { useState } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Card, ButtonLink, Spinner, EmptyState, ErrorState, InlineError } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { Heart, X, MessageCircle, MapPin, Briefcase, GitCompare } from 'lucide-react'

export default function ShortlistPage() {
  const { data: shortlist, setData: setShortlist, loading, error, retry } = useAsync(
    () => apiFetch('/shortlist').then(d => (Array.isArray(d) ? d : [])),
    []
  )
  const [removeError, setRemoveError] = useState(null)
  // Compare renders exactly two people, so cap the selection at two rather
  // than letting the user pick a number the page can't show.
  const [selected, setSelected] = useState([])

  const toggleSelected = (id) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const remove = async (targetId) => {
    const snapshot = shortlist
    setRemoveError(null)
    setShortlist(s => s.filter(u => u.id !== targetId))
    try {
      await apiFetch('/shortlist', { method: 'DELETE', body: { targetId } })
    } catch (err) {
      setShortlist(snapshot)
      setRemoveError(err)
    }
  }

  return (
    <Layout activePage="shortlist">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Your Shortlist</h1>

        {loading && (
          <div className="flex justify-center py-20"><Spinner /></div>
        )}

        {error && <ErrorState what="shortlist" error={error} onRetry={retry} />}

        <InlineError error={removeError} />

        {!loading && !error && (shortlist || []).length === 0 && (
          <EmptyState
            icon={Heart}
            title="No one shortlisted yet"
            description="Tap the bookmark on anyone you like while browsing matches and they'll show up here."
            action={<ButtonLink to="/roommates">Browse roommates</ButtonLink>}
          />
        )}

        {!loading && !error && (shortlist || []).length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-surface-muted">
              <p className="text-sm text-text-secondary">
                {selected.length === 0
                  ? 'Pick two people to compare them side by side'
                  : `${selected.length} of 2 selected`}
              </p>
              {selected.length === 2 ? (
                <Link
                  to={`/compare?u1=${selected[0]}&u2=${selected[1]}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal bg-brand-teal text-white hover:bg-brand-teal-dark"
                >
                  <GitCompare size={15} aria-hidden="true" />
                  Compare
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-surface-border text-text-muted cursor-not-allowed"
                >
                  <GitCompare size={15} aria-hidden="true" />
                  Compare
                </button>
              )}
            </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {shortlist.map((user) => (
                <Card
                  key={user.id}
                  className={`relative flex flex-col items-center p-5 text-center transition-colors ${
                    selected.includes(user.id) ? 'border-brand-teal ring-1 ring-brand-teal' : ''
                  }`}
                >
                  <label className="absolute top-3 left-3 flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(user.id)}
                      onChange={() => toggleSelected(user.id)}
                      aria-label={`Select ${user.name} to compare`}
                      className="w-4 h-4 rounded border-surface-border text-brand-teal focus:ring-brand-teal cursor-pointer"
                    />
                  </label>
                  <button
                    onClick={() => remove(user.id)}
                    className="absolute top-3 right-3 p-1 rounded-full text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                    aria-label="Remove from shortlist"
                  >
                    <X size={16} />
                  </button>

                  <UserAvatar src={user.profile_image} name={user.name} size={64} />

                  <h3 className="mt-3 font-semibold text-text-primary">
                    {user.name}{user.age ? `, ${user.age}` : ''}
                  </h3>

                  {user.occupation && (
                    <p className="text-xs text-text-muted flex items-center gap-1 mt-1">
                      <Briefcase size={12} /> {user.occupation}
                    </p>
                  )}

                  {user.city && (
                    <p className="text-xs text-text-muted flex items-center gap-1 mt-1">
                      <MapPin size={12} /> {user.city}
                    </p>
                  )}

                  {user.budget && (
                    <p className="text-sm font-medium text-brand-teal mt-2">
                      {Number(user.budget).toLocaleString('en-IN')} / month
                    </p>
                  )}

                  {/* POST /api/messages refuses any pair that is not matched, so
                      a Message button here sent people to a chat that could
                      never accept input. Show it only where the server will
                      actually let them write. */}
                  <div className="flex gap-2 mt-4 w-full">
                    <ButtonLink to={`/roommates/${user.id}`} variant="primary"
                      className={`text-xs py-1.5 ${user.is_match ? 'flex-1 w-full' : 'w-full'}`}>
                      View profile
                    </ButtonLink>
                    {user.is_match && (
                      <ButtonLink to={`/messages/${user.id}`} variant="secondary"
                        className="flex-1 w-full text-xs py-1.5 flex items-center justify-center gap-1">
                        <MessageCircle size={14} /> Message
                      </ButtonLink>
                    )}
                  </div>
                  {!user.is_match && (
                    <p className="text-xs text-text-muted text-center mt-2">
                      Message once you match
                    </p>
                  )}
                </Card>
            ))}
          </div>
          </>
        )}
      </div>
    </Layout>
  );
}
