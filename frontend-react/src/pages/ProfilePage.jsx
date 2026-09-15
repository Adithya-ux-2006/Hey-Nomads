import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { apiFetch, auth } from '../lib/api'
import { Card, Badge, Button, Spinner, SectionHeader } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import {
  Edit, MapPin, Briefcase, Home, Calendar, Shield,
  Moon, Cigarette, Wine, Users, Globe, ArrowLeft, ShieldCheck
} from 'lucide-react'

const CLEANLINESS_MAP = { 1: 'Minimal', 2: 'Casual', 3: 'Moderate', 4: 'Tidy', 5: 'Spotless' }
const DIET_MAP = { veg: 'Vegetarian', eggetarian: 'Eggetarian', vegan: 'Vegan', non_veg: 'Non-veg' }
const SLEEP_MAP = { early: 'Early Bird', late: 'Night Owl', flexible: 'Flexible' }
const SMOKING_MAP = { yes: 'Smoker', no: 'Non-smoker', occasionally: 'Occasionally' }
const DRINKING_MAP = { yes: 'Drinks', no: 'Non-drinker', socially: 'Socially' }
const SOCIAL_MAP = { introvert: 'Introvert', ambivert: 'Ambivert', extrovert: 'Extrovert' }

const AboutItem = ({ icon: Icon, label, value, color }) =>
  value ? (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-bg border border-surface-border">
      <Icon size={16} className={`${color} flex-shrink-0`} />
      <div>
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  ) : null

const ProfilePage = () => {
  const { id } = useParams()
  const currentUserId = auth.getUserId()
  const viewingId = id || currentUserId
  const isOwn = !id || id === currentUserId

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false

    const loadProfile = async () => {
      try {
        setLoading(true)
        setError(null)
        if (isOwn) {
          const me = await apiFetch('/auth/me')
          if (!cancelled) setProfile(me)
        } else {
          const data = await apiFetch(`/profile/${viewingId}`)
          if (!cancelled) setProfile(data)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProfile()
    return () => { cancelled = true }
  }, [viewingId, isOwn, currentUserId])

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

  if (error || !profile) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 text-center py-24">
          <p className="text-text-muted mb-4">{error || 'Profile not found'}</p>
          <Button variant="secondary" asChild>
            <Link to="/discover">Back to Discover</Link>
          </Button>
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
            <Button variant="ghost" size="sm" asChild>
              <Link to={-1}><ArrowLeft size={16} /> Back</Link>
            </Button>
          </div>
        )}

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="relative h-32 bg-gradient-to-r from-brand-coral via-brand-teal to-brand-amber" />
            <div className="px-6 pb-6">
              <div className="flex justify-between items-end -mt-14 mb-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-surface-muted">
                    <UserAvatar
                      src={profile.profile_image}
                      name={profile.name}
                      size="xl"
                      className="w-full h-full"
                    />
                  </div>
                </div>
                {isOwn && (
                  <Button variant="primary" asChild>
                    <Link to="/edit-profile"><Edit size={16} /> Edit</Link>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <h1 className="text-3xl font-display font-bold text-text-primary">
                  {profile.name}{profile.age ? `, ${profile.age}` : ''}
                </h1>
                {verified && <ShieldCheck className="text-status-success flex-shrink-0" size={22} />}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-text-muted mb-4">
                {profile.occupation && (
                  <span className="flex items-center gap-1.5"><Briefcase size={14} /> {profile.occupation}</span>
                )}
                {profile.city && (
                  <span className="flex items-center gap-1.5"><MapPin size={14} /> {profile.city}{profile.country ? `, ${profile.country}` : ''}</span>
                )}
              </div>

              {profile.bio && (
                <p className="text-text-secondary text-sm leading-relaxed bg-surface-bg rounded-xl p-4 border border-surface-border">
                  {profile.bio}
                </p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeader title="About" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <AboutItem icon={Users} label="Age" value={profile.age} color="text-brand-coral" />
              <AboutItem icon={Briefcase} label="Occupation" value={profile.occupation} color="text-brand-teal" />
              <AboutItem icon={MapPin} label="City" value={profile.city} color="text-brand-coral" />
              <AboutItem icon={MapPin} label="Moving To" value={profile.moving_to} color="text-brand-amber" />
              <AboutItem icon={Globe} label="University" value={profile.university} color="text-brand-teal" />
              <AboutItem icon={Globe} label="Country" value={profile.country} color="text-brand-coral" />
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeader title="Lifestyle" subtitle="Daily habits & preferences" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <AboutItem icon={Moon} label="Sleep" value={SLEEP_MAP[profile.sleep_time] || profile.sleep_time} color="text-brand-teal" />
              <AboutItem icon={Users} label="Cleanliness" value={CLEANLINESS_MAP[profile.cleanliness] || profile.cleanliness} color="text-brand-coral" />
              <AboutItem icon={Globe} label="Diet" value={DIET_MAP[profile.diet] || profile.diet} color="text-brand-amber" />
              <AboutItem icon={Cigarette} label="Smoking" value={SMOKING_MAP[profile.smoking] || profile.smoking} color="text-brand-coral" />
              <AboutItem icon={Wine} label="Drinking" value={DRINKING_MAP[profile.drinking] || profile.drinking} color="text-brand-teal" />
              <AboutItem icon={Users} label="Social" value={SOCIAL_MAP[profile.social_level] || profile.social_level} color="text-brand-amber" />
              {profile.pets && (
                <AboutItem icon={Globe} label="Pets" value={profile.pets} color="text-brand-teal" />
              )}
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeader title="Housing Preferences" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <AboutItem icon={Briefcase} label="Budget" value={profile.budget ? `\u20B9${Number(profile.budget).toLocaleString('en-IN')}/mo` : null} color="text-brand-coral" />
              <AboutItem icon={Home} label="Flat Type" value={profile.flat_type?.replace(/_/g, ' ')} color="text-brand-teal" />
              <AboutItem icon={Calendar} label="Move-in Date" value={profile.move_in_date} color="text-brand-amber" />
            </div>
          </Card>

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
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="secondary" asChild>
                <Link to={`/inbox?user=${profile.id}`}>
                  Message
                </Link>
              </Button>
              <Button variant="ghost">
                Block
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default ProfilePage
