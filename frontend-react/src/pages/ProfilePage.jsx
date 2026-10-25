import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { apiFetch, auth } from '../lib/api'
import { Card, Badge, Button, ButtonLink, SectionHeader, EmptyState, ErrorState, InlineError } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import {
  Edit, MapPin, Briefcase, Home, Calendar, Moon, Cigarette, Wine, Users, Globe, ArrowLeft, ShieldCheck
} from 'lucide-react'

const CLEANLINESS_MAP = { 1: 'Minimal', 2: 'Casual', 3: 'Moderate', 4: 'Tidy', 5: 'Spotless' }
const DIET_MAP = { veg: 'Vegetarian', eggetarian: 'Eggetarian', vegan: 'Vegan', nonveg: 'Non-veg' }
const SLEEP_MAP = { early: 'Early Bird', late: 'Night Owl', flexible: 'Flexible' }
const SMOKING_MAP = { yes: 'Smoker', no: 'Non-smoker', occasionally: 'Occasionally' }
const DRINKING_MAP = { yes: 'Drinks', no: 'Non-drinker', socially: 'Socially' }
const SOCIAL_MAP = { introvert: 'Introvert', moderate: 'Balanced', extrovert: 'Extrovert' }
const PETS_MAP = { yes: 'Has pets', no: 'No pets', okay: 'Open to pets' }

// Stored preferred_gender -> the four canonical values the feed understands.
// 'no_preference' is the legacy seed and any unknown value reads as open.
const normalizePref = v => {
  const s = String(v || '').trim().toLowerCase()
  return ['female', 'male', 'all'].includes(s) ? s : 'unspecified'
}
const PREF_OPTIONS = [
  { v: 'unspecified', l: 'Prefer not to specify' },
  { v: 'female', l: 'Women' },
  { v: 'male', l: 'Men' },
  { v: 'all', l: 'All genders' },
]
// What the choice does to the feed, stated plainly under the control so the
// filter is never a surprise: a stated preference really does hide everyone
// outside it, and Discover is where that shows up.
const PREF_SEE = {
  female: "You'll only see women's accounts in Discover and Roommates.",
  male: "You'll only see men's accounts in Discover and Roommates.",
  all: "You'll see accounts of every gender.",
  unspecified: "You'll see everyone you're compatible with.",
}

const AboutItem = ({ icon: Icon, label, value, color }) =>
  value ? (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-bg border border-surface-border">
      <Icon size={16} className={`${color} flex-shrink-0`} />
      <div>
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <p className="text-sm font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  ) : null

// A detail section that either lists what exists or says plainly that nothing
// has been added yet. Rendering the header over an empty grid made a brand-new
// profile look broken rather than unfinished.
const DetailSection = ({ title, subtitle, items, emptyText, isOwn }) => {
  const filled = items.filter(i => i.value);
  return (
    <Card className="p-6">
      <SectionHeader title={title} subtitle={subtitle} />
      {filled.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map(({ icon: Icon, label, value, color }) => (
            <AboutItem key={label} icon={Icon} label={label} value={value} color={color} />
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-surface-bg border border-surface-border flex flex-wrap items-center gap-3">
          <p className="text-sm text-text-muted flex-1 min-w-[180px]">{emptyText}.</p>
          {isOwn && (
            <ButtonLink to="/edit-profile" variant="secondary" size="sm">Complete profile</ButtonLink>
          )}
        </div>
      )}
    </Card>
  );
};

const ProfilePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUserId = auth.getUserId()
  const viewingId = id || currentUserId
  const isOwn = !id || id === currentUserId

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [safetyError, setSafetyError] = useState(null)
  const [pref, setPref] = useState('unspecified')
  const [prefSaving, setPrefSaving] = useState(false)
  const [prefError, setPrefError] = useState(null)

  useEffect(() => {
    if (!currentUserId) {
      navigate('/login', { replace: true })
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    // /profile/:userId returns every field this page renders. /auth/me returns
    // only user columns, so asking it for "my profile" produced a nearly blank
    // page: no bio, no lifestyle, no budget, no languages.
    const id = isOwn ? currentUserId : viewingId
    apiFetch(`/profile/${id}`)
      .then(data => { if (!cancelled) setProfile(data) })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [viewingId, isOwn, currentUserId, navigate])

  // The stored preference follows the profile it was loaded with, so a reload
  // (or an edit saved elsewhere) never leaves the control showing a stale
  // answer that the feed is not actually using.
  useEffect(() => {
    if (profile) setPref(normalizePref(profile.preferred_gender))
  }, [profile])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    apiFetch(`/profile/${isOwn ? currentUserId : viewingId}`)
      .then(setProfile)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [isOwn, currentUserId, viewingId])

  const savePref = async (next) => {
    // Optimistic with rollback: the select answers instantly (the interaction
    // skill's <100ms rule), and a failed save restores the previous value and
    // shows the error rather than pretending the preference changed.
    const previous = pref
    setPref(next)
    setPrefError(null)
    setPrefSaving(true)
    try {
      await apiFetch('/preferences/gender', { method: 'PUT', body: { preferredGender: next } })
    } catch (err) {
      setPref(previous)
      setPrefError(err)
    } finally {
      setPrefSaving(false)
    }
  }

  const submitBlock = async () => {
    setSubmitting(true)
    setSafetyError(null)
    try {
      await apiFetch('/block', { method: 'POST', body: { targetId: Number(id) } })
      navigate('/roommates', { replace: true })
    } catch (err) {
      setSafetyError(err)
      setShowBlockConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 space-y-6">
          <div className="skeleton h-72 rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 pt-16">
          <ErrorState what="profile" error={error} onRetry={reload} />
        </div>
      </Layout>
    )
  }

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 pt-16 text-center">
          <p className="text-text-muted mb-5">That profile no longer exists.</p>
          <ButtonLink to="/discover" variant="secondary">Back to Discover</ButtonLink>
        </div>
      </Layout>
    )
  }

  const verified = profile.verification_status === 'verified'
  const interests = profile.interests || []
  const languages = profile.languages || []

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-28">
        {!isOwn && (
          <div className="mb-4">
            {/* A real button, not <Link to={-1}>: React Router v6 treats a
                numeric `to` as a URL path, so the link went nowhere. */}
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} /> Back
            </Button>
          </div>
        )}

        <div className="space-y-6">
          <Card className="overflow-hidden">
            {/* A 96px cover (8pt grid) with no content in it used to be 128px,
                which read as a decorative void. The avatar is pulled up by half
                its own height so it sits evenly across the edge instead of
                hanging below it. */}
            <div className="relative h-24 bg-gradient-to-r from-brand-coral via-brand-teal to-brand-amber" />
            <div className="px-6 pb-6">
              {/* `fill` hands the box to the wrapper. The avatar used to render
                  as size xl (112px) inside a 96px overflow-hidden frame, so the
                  initial was cropped on every profile without an image.
                  `relative z-10` is required: the cover above is `relative`, and
                  a positioned sibling paints over a non-positioned one, which
                  left the top half of every avatar hidden behind the banner. */}
              <div className="relative z-10 w-24 h-24 rounded-2xl border-4 border-white shadow-sm overflow-hidden -mt-12 mb-4 bg-surface-muted">
                <UserAvatar
                  src={profile.profile_image}
                  name={profile.name}
                  fill
                />
              </div>

              {/* Identity and its one action share a row, so "Edit profile" is
                  anchored to the name rather than floating against the banner. */}
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-display font-bold text-text-primary break-words min-w-0">
                      {profile.name}{profile.age ? `, ${profile.age}` : ''}
                    </h1>
                    {verified && <ShieldCheck className="text-status-success flex-shrink-0" size={22} />}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-text-muted">
                    {profile.occupation && (
                      <span className="flex items-center gap-1.5"><Briefcase size={14} /> {profile.occupation}</span>
                    )}
                    {profile.city && (
                      <span className="flex items-center gap-1.5"><MapPin size={14} /> {profile.city}{profile.country ? `, ${profile.country}` : ''}</span>
                    )}
                  </div>
                </div>

                {isOwn && (
                  <ButtonLink to="/edit-profile" variant="primary" size="sm" className="flex-shrink-0">
                    <Edit size={14} /> Edit profile
                  </ButtonLink>
                )}
              </div>

              {profile.bio ? (
                <p className="text-text-secondary text-sm leading-relaxed bg-surface-bg rounded-xl p-4 border border-surface-border">
                  {profile.bio}
                </p>
              ) : isOwn ? (
                <EmptyState
                  title="No introduction added yet"
                  description="A couple of lines about who you are and what you are looking for helps people start a conversation."
                  action={<ButtonLink to="/edit-profile" variant="primary" size="sm">Add an introduction</ButtonLink>}
                />
              ) : (
                <p className="text-text-muted text-sm bg-surface-bg rounded-xl p-4 border border-surface-border">
                  No introduction added yet.
                </p>
              )}
            </div>
          </Card>

          {/* A section whose fields are all empty used to render as a bare
              header over nothing, which reads as broken rather than new. */}
          <DetailSection
            title="About"
            items={[
              { icon: Users, label: 'Age', value: profile.age },
              { icon: Briefcase, label: 'Occupation', value: profile.occupation },
              { icon: MapPin, label: 'City', value: profile.city },
              { icon: MapPin, label: 'Moving To', value: profile.moving_to },
              { icon: Globe, label: 'University', value: profile.university },
              { icon: Globe, label: 'Country', value: profile.country },
            ]}
            emptyText="No introduction added yet"
            isOwn={isOwn}
          />

          <DetailSection
            title="Lifestyle"
            subtitle="Daily habits & preferences"
            items={[
              { icon: Moon, label: 'Sleep', value: SLEEP_MAP[profile.sleep_time] || profile.sleep_time },
              { icon: Users, label: 'Cleanliness', value: CLEANLINESS_MAP[profile.cleanliness] || profile.cleanliness },
              { icon: Globe, label: 'Diet', value: DIET_MAP[profile.diet] || profile.diet },
              { icon: Cigarette, label: 'Smoking', value: SMOKING_MAP[profile.smoking] || profile.smoking },
              { icon: Wine, label: 'Drinking', value: DRINKING_MAP[profile.drinking] || profile.drinking },
              { icon: Users, label: 'Social', value: SOCIAL_MAP[profile.social_level] || profile.social_level },
              { icon: Globe, label: 'Pets', value: PETS_MAP[profile.pets] || profile.pets },
            ]}
            emptyText="Lifestyle details haven't been added yet"
            isOwn={isOwn}
          />

          <DetailSection
            title="Housing Preferences"
            items={[
              { icon: Briefcase, label: 'Budget', value: profile.budget ? `${Number(profile.budget).toLocaleString('en-IN')}/mo` : null },
              { icon: Home, label: 'Flat Type', value: profile.flat_type?.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) },
              { icon: Calendar, label: 'Move-in Date', value: profile.move_in_date },
            ]}
            emptyText="Housing preferences haven't been added yet"
            isOwn={isOwn}
          />

          {/* Discovery is your own setting: another person's preference is
              theirs to state, so this section only ever renders on your own
              profile, never on a profile you are browsing. */}
          {isOwn && (
            <Card className="p-6">
              <SectionHeader title="Discovery" subtitle="Who shows up in your feed" />
              <label htmlFor="pp-prefGender" className="text-sm font-semibold text-text-primary mb-2 block">
                I'd like to live with
              </label>
              <select
                id="pp-prefGender"
                className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral transition-all disabled:opacity-60"
                value={pref}
                onChange={e => savePref(e.target.value)}
                disabled={prefSaving}
                aria-describedby="pp-prefGender-hint"
              >
                {PREF_OPTIONS.map(o => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
              <p id="pp-prefGender-hint" aria-live="polite" className="text-xs text-text-muted mt-2">
                {PREF_SEE[pref]}
              </p>
              <div className="mt-3">
                <InlineError error={prefError} />
              </div>
            </Card>
          )}

          {interests.length > 0 && (
            <Card className="p-6">
              <SectionHeader title="Interests" />
              <div className="flex flex-wrap gap-2">
                {interests.map((interest, i) => (
                  <Badge key={i} variant="coral">{interest}</Badge>
                ))}
              </div>
            </Card>
          )}

          {languages.length > 0 && (
            <Card className="p-6">
              <SectionHeader title="Languages" />
              <div className="flex flex-wrap gap-2">
                {languages.map((lang, i) => (
                  <Badge key={lang.id || i} variant="teal">
                    <Globe size={12} className="mr-1" />
                    {lang.name || lang}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {!isOwn && (
            <div className="space-y-3 pt-2">
              <InlineError error={safetyError} />
              <div className="flex items-center justify-center gap-3">
                {/* POST /api/messages 403s unless the pair is matched, so
                    offering this to a non-match opened a chat that could not
                    send. Shortlist instead, which always works. */}
                {profile.is_match ? (
                  <ButtonLink to={`/messages/${profile.id}`} variant="secondary">
                    Message {profile.name?.split(' ')[0]}
                  </ButtonLink>
                ) : (
                  <ButtonLink to="/roommates" variant="secondary">
                    Find a match
                  </ButtonLink>
                )}
                <Button variant="ghost" onClick={() => setShowBlockConfirm(true)}>
                  Block
                </Button>
              </div>
            </div>
          )}

          {showBlockConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <div role="dialog" aria-modal="true" aria-labelledby="pblock-title" className="w-full max-w-md bg-white rounded-2xl p-5">
                <h2 id="pblock-title" className="text-lg font-bold text-text-primary mb-1">
                  Block {profile.name}?
                </h2>
                <p className="text-sm text-text-secondary mb-4">
                  You won't see each other in matches again, and any existing match is
                  ended. They are not told you blocked them.
                </p>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setShowBlockConfirm(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={submitBlock}
                    disabled={submitting}
                    className="flex-1 bg-status-error hover:opacity-90 shadow-none"
                  >
                    {submitting ? 'Blocking' : 'Block'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default ProfilePage
