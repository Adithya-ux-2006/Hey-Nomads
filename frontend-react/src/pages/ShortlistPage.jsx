import { useState } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Card, Button, Spinner, EmptyState, ErrorState, InlineError } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { Heart, X, MessageCircle, MapPin, Briefcase } from 'lucide-react'

export default function ShortlistPage() {
  const { data: shortlist, setData: setShortlist, loading, error, retry } = useAsync(
    () => apiFetch('/shortlist').then(d => (Array.isArray(d) ? d : [])),
    []
  )
  const [removeError, setRemoveError] = useState(null)

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
            action={<Link to="/roommates"><Button>Browse roommates</Button></Link>}
          />
        )}

        {!loading && !error && (shortlist || []).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {shortlist.map((user) => (
                <Card key={user.id} className="relative flex flex-col items-center p-5 text-center">
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
                      ₹{Number(user.budget).toLocaleString('en-IN')}
                    </p>
                  )}

                  <div className="flex gap-2 mt-4 w-full">
                    <Link to={`/roommates/${user.id}`} className="flex-1">
                      <Button variant="primary" className="w-full text-xs py-1.5">View profile</Button>
                    </Link>
                    <Link to={`/chat?userId=${user.id}`} className="flex-1">
                      <Button variant="secondary" className="w-full text-xs py-1.5 flex items-center justify-center gap-1">
                        <MessageCircle size={14} /> Message
                      </Button>
                    </Link>
                  </div>
                </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
