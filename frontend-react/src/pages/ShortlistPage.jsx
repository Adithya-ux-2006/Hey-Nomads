import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { Card, Button, Spinner, EmptyState } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, X, MessageCircle, MapPin, Briefcase } from 'lucide-react'

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.35 } }),
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
}

export default function ShortlistPage() {
  const [shortlist, setShortlist] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/shortlist')
      .then((data) => setShortlist(Array.isArray(data) ? data : []))
      .catch(() => setShortlist([]))
      .finally(() => setLoading(false))
  }, [])

  const remove = async (targetId) => {
    try {
      await apiFetch('/shortlist', { method: 'DELETE', body: { targetId } })
      setShortlist((s) => s.filter((u) => u.id !== targetId))
    } catch {}
  }

  return (
    <Layout activePage="shortlist">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Your Shortlist</h1>

        {loading && (
          <div className="flex justify-center py-20"><Spinner /></div>
        )}

        {!loading && shortlist.length === 0 && (
          <EmptyState
            icon={<Heart size={40} />}
            title="No one shortlisted yet."
            message="Start exploring!"
            action={<Link to="/discover"><Button>Go to Discover</Button></Link>}
          />
        )}

        {!loading && shortlist.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {shortlist.map((user, i) => (
              <motion.div
                key={user.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
              >
                <Card className="relative flex flex-col items-center p-5 text-center">
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
                      <Button variant="primary" className="w-full text-xs py-1.5">View</Button>
                    </Link>
                    <Link to={`/chat?userId=${user.id}`} className="flex-1">
                      <Button variant="outline" className="w-full text-xs py-1.5 flex items-center justify-center gap-1">
                        <MessageCircle size={14} /> Message
                      </Button>
                    </Link>
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
