import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Layout from '../components/Layout'
import { apiFetch, resolveMediaUrl, auth } from '../lib/api'
import { Card, CompatibilityBadge, Badge, Button, Spinner, SectionHeader, InlineError } from '../components/UI'
import {
  ArrowLeft, BadgeCheck, Heart, ThumbsDown, Star, MessageSquare,
  Moon, Coffee, Cigarette, Wine, Users, Calendar, MapPin,
  Home, IndianRupee, Globe, Briefcase, CheckCircle2, Flag, UserX
} from 'lucide-react'
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
}

const BREAKDOWN_LABELS = {
  lifestyle: { label: 'Lifestyle', color: 'bg-brand-teal' },
  budget: { label: 'Budget', color: 'bg-brand-coral' },
  location: { label: 'Location', color: 'bg-brand-amber' },
  movein: { label: 'Move-in', color: 'bg-violet-400' },
  interests: { label: 'Interests', color: 'bg-emerald-400' },
  habits: { label: 'Habits', color: 'bg-sky-400' },
}

const LIFESTYLE_ITEMS = [
  { key: 'sleep_time', label: 'Sleep', icon: Moon, map: { early: 'Early Bird', late: 'Night Owl', flexible: 'Flexible' } },
  { key: 'cleanliness', label: 'Cleanliness', icon: Coffee, render: (v) => `${v || 3}/5` },
  { key: 'diet', label: 'Diet', icon: Coffee, map: { veg: 'Veg', eggetarian: 'Eggetarian', vegan: 'Vegan', non_veg: 'Non-veg' } },
  { key: 'smoking', label: 'Smoking', icon: Cigarette, map: { yes: 'Smoker', no: 'Non-smoker', occasionally: 'Occasionally' } },
  { key: 'drinking', label: 'Drinking', icon: Wine, map: { yes: 'Drinks', no: 'Non-drinker', socially: 'Socially' } },
  { key: 'social_level', label: 'Social', icon: Users, map: { introvert: 'Introvert', ambivert: 'Ambivert', extrovert: 'Extrovert' } },
]

const Skeleton = ({ className = '' }) => <div className={`skeleton ${className}`} />

const RoommateDetailPage = () => {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [reportReason, setReportReason] = useState('Harassment or abuse')
  const [reportDetail, setReportDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [safetyError, setSafetyError] = useState(null)

  const submitReport = async () => {
    setSubmitting(true)
    setSafetyError(null)
    try {
      await apiFetch('/report', {
        method: 'POST',
        body: {
          reported_user_id: Number(userId),
          type: 'user',
          reason: reportReason,
          description: reportDetail,
        },
      })
      setShowReport(false)
      setReportDetail('')
      navigate('/roommates', { replace: true })
    } catch (err) {
      setSafetyError(err)
      setShowReport(false)
    } finally {
      setSubmitting(false)
    }
  }

  const submitBlock = async () => {
    setSubmitting(true)
    setSafetyError(null)
    try {
      await apiFetch('/block', { method: 'POST', body: { targetId: Number(userId) } })
      navigate('/roommates', { replace: true })
    } catch (err) {
      setSafetyError(err)
      setShowBlockConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login', { replace: true })
      return
    }
    const load = async () => {
      try {
        setLoading(true)
        const data = await apiFetch(`/roommates/${userId}`)
        setProfile(data)
      } catch (err) {
        setError(err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId, navigate])

  const handleSwipe = async (action) => {
    try {
      setActionLoading(action)
      await apiFetch('/swipe', { method: 'POST', body: { targetId: Number(userId), action } })
      if (action === 'pass') navigate(-1)
    } catch (err) {
      console.error('Swipe failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleShortlist = async () => {
    try {
      setActionLoading('shortlist')
      await apiFetch('/shortlist', { method: 'POST', body: { targetId: Number(userId) } })
    } catch (err) {
      console.error('Shortlist failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-28 space-y-6">
          <Skeleton className="h-10 w-20 rounded-xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </Layout>
    )
  }

  if (error || !profile) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-28 text-center py-24">
          <p className="text-text-muted mb-4">{error || 'Profile not found'}</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Go Back
          </Button>
        </div>
      </Layout>
    )
  }

  const score = profile.score || 0
  const breakdown = profile.breakdown || {}
  const reasons = profile.reasons || []
  const interests = profile.interests || []
  const languages = profile.languages || []
  const isMatched = profile.is_match || false

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-3xl mx-auto px-4 pt-4 pb-28"
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4"
        >
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </Button>
        </motion.div>

        <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-6">
          <Card className="overflow-hidden">
            <div className="relative h-72 sm:h-80 bg-gradient-to-br from-brand-coral via-brand-teal to-brand-amber">
              {profile.profile_image ? (
                <img
                  src={resolveMediaUrl(profile.profile_image)}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-7xl font-bold text-white/80">
                    {profile.name?.[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 right-4">
                <CompatibilityBadge score={score} size="lg" />
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-display font-bold text-text-primary">
                  {profile.name}{profile.age ? `, ${profile.age}` : ''}
                </h1>
                {profile.verification_status === 'verified' && (
                  <BadgeCheck className="text-status-success flex-shrink-0" size={20} />
                )}
              </div>
              {profile.occupation && (
                <div className="flex items-center gap-1.5 text-text-muted text-sm mb-3">
                  <Briefcase size={14} />
                  <span>{profile.occupation}</span>
                </div>
              )}
              {profile.city && (
                <div className="flex items-center gap-1.5 text-text-muted text-sm">
                  <MapPin size={14} />
                  <span>{profile.city}{profile.country ? `, ${profile.country}` : ''}</span>
                </div>
              )}
            </div>
          </Card>

          {Object.keys(breakdown).length > 0 && (
            <Card className="p-6">
              <SectionHeader title="Compatibility Breakdown" subtitle={`${score}% overall match`} />
              <div className="space-y-3">
                {Object.entries(breakdown).map(([key, val]) => {
                  const meta = BREAKDOWN_LABELS[key] || { label: key, color: 'bg-gray-400' }
                  const max = key === 'lifestyle' ? 25 : key === 'budget' ? 20 : key === 'location' ? 20 : key === 'movein' ? 15 : key === 'interests' ? 10 : 10
                  const pct = Math.round((val / max) * 100)
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-text-secondary">{meta.label}</span>
                        <span className="text-text-muted">{val}/{max}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={`h-full rounded-full ${meta.color}`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {reasons.length > 0 && (
            <Card className="p-6">
              <SectionHeader title="Why You Match" subtitle="What makes you compatible" />
              <div className="flex flex-wrap gap-2">
                {reasons.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Badge variant={r.type === 'positive' ? 'success' : r.type === 'warning' ? 'amber' : 'muted'}>
                      <CheckCircle2 size={12} className="mr-1" />
                      {r.text}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}

          {profile.bio && (
            <Card className="p-6">
              <SectionHeader title="About" />
              <p className="text-text-secondary text-sm leading-relaxed">{profile.bio}</p>
            </Card>
          )}

          <Card className="p-6">
            <SectionHeader title="Lifestyle" subtitle="Daily habits & preferences" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LIFESTYLE_ITEMS.map(({ key, label, icon: Icon, map: valMap, render }) => {
                const raw = profile[key]
                let display = raw
                if (render) display = render(raw)
                else if (valMap && valMap[raw]) display = valMap[raw]
                else if (raw) display = String(raw).replace(/_/g, ' ')
                if (!display) return null
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-muted border border-surface-border"
                  >
                    <Icon size={16} className="text-brand-coral flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-text-muted">{label}</p>
                      <p className="text-sm font-semibold text-text-primary capitalize">{display}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeader title="Housing Preferences" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {profile.budget && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-muted border border-surface-border">
                  <IndianRupee size={16} className="text-brand-coral flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-text-muted">Budget</p>
                    <p className="text-sm font-semibold text-text-primary">{'\u20B9'}{Number(profile.budget).toLocaleString('en-IN')}/mo</p>
                  </div>
                </div>
              )}
              {profile.flat_type && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-muted border border-surface-border">
                  <Home size={16} className="text-brand-teal flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-text-muted">Flat Type</p>
                    <p className="text-sm font-semibold text-text-primary capitalize">{profile.flat_type.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              )}
              {profile.move_in_date && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-muted border border-surface-border">
                  <Calendar size={16} className="text-brand-amber flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-text-muted">Move-in</p>
                    <p className="text-sm font-semibold text-text-primary">{profile.move_in_date}</p>
                  </div>
                </div>
              )}
              {profile.occupants && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-muted border border-surface-border">
                  <Users size={16} className="text-violet-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-text-muted">Occupants</p>
                    <p className="text-sm font-semibold text-text-primary">{profile.occupants}</p>
                  </div>
                </div>
              )}
              {profile.neighbourhood && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-muted border border-surface-border">
                  <MapPin size={16} className="text-emerald-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-text-muted">Neighbourhood</p>
                    <p className="text-sm font-semibold text-text-primary">{profile.neighbourhood}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {interests.length > 0 && (
            <Card className="p-6">
              <SectionHeader title="Interests" />
              <div className="flex flex-wrap gap-2">
                {interests.map((interest, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-brand-coral/10 text-brand-coral border border-brand-coral/20"
                  >
                    {interest}
                  </motion.span>
                ))}
              </div>
            </Card>
          )}

          {languages.length > 0 && (
            <Card className="p-6">
              <SectionHeader title="Languages" />
              <div className="flex flex-wrap gap-2">
                {languages.map((lang, i) => (
                  <motion.div
                    key={lang.id || i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Badge variant="teal">
                      <Globe size={12} className="mr-1" />
                      {lang.name || lang}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}
        </motion.div>

        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 25 }}
          className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-surface-border p-4 z-50"
        >
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSwipe('pass')}
              disabled={!!actionLoading}
              className="flex-1 max-w-[140px] flex items-center justify-center gap-2 py-3 rounded-full border-2 border-surface-border bg-white text-text-secondary font-semibold text-sm hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'pass' ? <Spinner size="sm" /> : <><ThumbsDown size={18} /> Pass</>}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShortlist}
              disabled={!!actionLoading}
              className="flex-1 max-w-[140px] flex items-center justify-center gap-2 py-3 rounded-full border-2 border-brand-amber bg-brand-amber/10 text-amber-700 font-semibold text-sm hover:bg-brand-amber/20 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'shortlist' ? <Spinner size="sm" /> : <><Star size={18} /> Shortlist</>}
            </motion.button>

            {isMatched ? (
              <Link to={`/messages/${userId}`} className="flex-1 max-w-[140px]">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-brand-teal text-white font-semibold text-sm shadow-teal hover:bg-brand-teal-dark transition-colors"
                >
                  <MessageSquare size={18} /> Message
                </motion.button>
              </Link>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSwipe('like')}
                disabled={!!actionLoading}
                className="flex-1 max-w-[140px] flex items-center justify-center gap-2 py-3 rounded-full bg-brand-coral text-white font-semibold text-sm shadow-coral hover:bg-brand-coral-dark transition-colors disabled:opacity-50"
              >
                {actionLoading === 'like' ? <Spinner size="sm" /> : <><Heart size={18} /> Like</>}
              </motion.button>
            )}
          </div>

          {/* Drafting an agreement is only meaningful once you have matched. */}
          {isMatched && (
            <div className="mt-4 pt-4 border-t border-surface-border flex justify-center">
              <Link
                to={`/agreement/${userId}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
              >
                Draft a roommate agreement
              </Link>
            </div>
          )}
        </motion.div>

        {/* Report and Block. Both are one-way and irreversible for Block, so
            Block asks first rather than firing on a single click. */}
        <div className="mt-6 pt-4 border-t border-surface-border flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-text-muted rounded"
          >
            <Flag size={14} /> Report this profile
          </button>
          <button
            type="button"
            onClick={() => setShowBlockConfirm(true)}
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-status-error focus:outline-none focus-visible:ring-2 focus-visible:ring-status-error rounded"
          >
            <UserX size={14} /> Block
          </button>
        </div>
        <InlineError error={safetyError} />

        {showReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-title"
              className="w-full max-w-md bg-white rounded-2xl p-5"
            >
              <h2 id="report-title" className="text-lg font-bold text-text-primary mb-1">Report this profile</h2>
              <p className="text-sm text-text-secondary mb-4">
                A moderator reviews every report. Tell us what is wrong.
              </p>
              <label htmlFor="report-reason" className="text-sm font-medium text-text-primary block mb-1.5">
                Reason
              </label>
              <select
                id="report-reason"
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm mb-3 focus:outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/25"
              >
                <option>Harassment or abuse</option>
                <option>Spam or scam</option>
                <option>Fake profile or photos</option>
                <option>Discrimination</option>
                <option>Something else</option>
              </select>
              <label htmlFor="report-detail" className="text-sm font-medium text-text-primary block mb-1.5">
                What happened <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <textarea
                id="report-detail"
                rows={3}
                value={reportDetail}
                onChange={e => setReportDetail(e.target.value)}
                className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm mb-4 focus:outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/25"
              />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowReport(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={submitReport} disabled={submitting} className="flex-1">
                  {submitting ? 'Sending' : 'Send report'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showBlockConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="block-title"
              className="w-full max-w-md bg-white rounded-2xl p-5"
            >
              <h2 id="block-title" className="text-lg font-bold text-text-primary mb-1">Block {profile.name}?</h2>
              <p className="text-sm text-text-secondary mb-4">
                You will not see each other in matches again, and any existing match is
                ended. They are not told you blocked them.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowBlockConfirm(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={submitBlock} disabled={submitting} className="flex-1 bg-status-error hover:opacity-90 shadow-none">
                  {submitting ? 'Blocking' : 'Block'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </Layout>
  )
}

export default RoommateDetailPage
