import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare, Briefcase, MapPin, ArrowLeft, BadgeCheck,
  Edit3, Camera, Home, Users, Cigarette, Wine, Moon, Sun,
  IndianRupee, Utensils, Volume2, Sparkles
} from 'lucide-react';
import { apiFetch, auth, API_BASE_URL, resolveMediaUrl } from '../utils/api';
import Layout from '../components/Layout';
import UserAvatar from '../components/UserAvatar';

// ── Stat Cell ──────────────────────────────────────────────────
const StatCell = ({ icon: Icon, label, value, accent }) => (
  <div className="card-soft rounded-2xl p-4">
    <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase mb-1 ${accent ? 'text-brand-warm' : 'text-text-muted'}`}>
      {Icon && <Icon size={12} />}
      {label}
    </div>
    <div className="text-sm font-bold text-text-primary">{value || '—'}</div>
  </div>
);

// ── Trait Tag ──────────────────────────────────────────────────
const Trait = ({ label, color = 'default' }) => {
  const cls = {
    default: 'tag',
    accent: 'tag tag-accent',
    blue: 'tag tag-blue',
    red: 'bg-red-50 text-red-500 border border-red-200 rounded-full px-3 py-1 text-xs font-semibold',
  }[color];
  return <span className={cls}>{label}</span>;
};

// ── Compatibility Bar ──────────────────────────────────────────
const CompBar = ({ label, score, max = 100 }) => {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-semibold text-text-secondary">
        <span>{label}</span>
        <span className="text-brand-warm">{pct}%</span>
      </div>
      <div className="h-2 bg-surface-border rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-brand-primary to-brand-warm rounded-full"
        />
      </div>
    </div>
  );
};

// ── Profile Page ───────────────────────────────────────────────
const ProfilePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUserId = auth.getUserId();

  if (!currentUserId) {
    navigate('/login');
    return null;
  }

  const viewingId = id || currentUserId;
  const isOwn = !id || id == currentUserId;

  const [profile, setProfile]         = useState(null);
  const [myProfile, setMyProfile]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [uploading, setUploading]     = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/profile/${viewingId}`);
      setProfile(data);
      if (!isOwn) {
        const me = await apiFetch(`/profile/${currentUserId}`);
        setMyProfile(me);
      }
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, [viewingId]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('profile_image', file);
      const res = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.filePath) {
        await apiFetch('/profile', {
          method: 'POST',
          body: Object.assign(new FormData(), { userId: currentUserId })
        });
        // Simple: send PUT via FormData to persist new image
        const profileFd = new FormData();
        profileFd.append('userId', currentUserId);
        profileFd.append('profile_image', file);
        // copy existing fields
        if (profile) {
          profileFd.append('bio', profile.bio || '');
          profileFd.append('occupation', profile.occupation || '');
          profileFd.append('city', profile.city || '');
          profileFd.append('sleepTime', profile.sleep_time || 'flexible');
          profileFd.append('cleanliness', profile.cleanliness || 3);
          profileFd.append('diet', profile.diet || 'veg');
          profileFd.append('noiseTolerance', profile.noise_tolerance || 'moderate');
          profileFd.append('noiseLevel', profile.noise_level || 3);
          profileFd.append('budget', profile.budget || 15000);
          profileFd.append('taxBracket', profile.tax_bracket || 'medium');
          profileFd.append('deposit', profile.deposit || 5000);
          profileFd.append('flatType', profile.flat_type || 'shared');
          profileFd.append('occupants', profile.occupants || 1);
          profileFd.append('smoking', profile.smoking || 'no');
          profileFd.append('drinking', profile.drinking || 'no');
          profileFd.append('partying', profile.partying || 'low');
        }
        await fetch(`${API_BASE_URL}/profile`, { method: 'POST', body: profileFd });
        await loadProfile();
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  // Compatibility score from breakdown or calculate simply
  const compatScore = React.useMemo(() => {
    if (isOwn || !profile || !myProfile) return null;
    let s = 0;
    const a = myProfile, b = profile;
    if (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) s += 30;
    const mxB = Math.max(a.budget || 0, b.budget || 0);
    const dB = Math.abs((a.budget || 0) - (b.budget || 0));
    s += mxB > 0 ? Math.round(20 * (1 - dB / mxB)) : 10;
    s += 20 - Math.abs((a.cleanliness || 3) - (b.cleanliness || 3)) * 5;
    if (a.sleep_time === b.sleep_time) s += 10;
    if (a.smoking === b.smoking) s += 10;
    if (a.drinking === b.drinking) s += 10;
    if (a.diet === b.diet) s += 5;
    return Math.min(100, Math.max(0, Math.round(s)));
  }, [profile, myProfile, isOwn]);

  if (loading) return (
    <Layout activePage="profile">
      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-4 animate-pulse">
        <div className="skeleton h-56 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      </div>
    </Layout>
  );

  if (error || !profile) return (
    <Layout activePage="profile">
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <div className="card p-12 text-center">
          <p className="text-text-secondary mb-4">{error || 'Profile not found'}</p>
          <button onClick={() => navigate('/discover')} className="btn-primary">Back to Discover</button>
        </div>
      </div>
    </Layout>
  );

  const diet = profile.diet === 'veg' ? '🥗 Veg' : profile.diet === 'eggetarian' ? '🥚 Eggetarian' : profile.diet === 'vegan' ? '🌱 Vegan' : '🍗 Non-veg';
  const sleep = profile.sleep_time === 'early' ? '🌅 Early Bird' : profile.sleep_time === 'late' ? '🌙 Night Owl' : '⏰ Flexible';
  const noise = profile.noise_tolerance === 'quiet' ? '🔇 Quiet' : profile.noise_tolerance === 'moderate' ? '🔉 Moderate' : '🔊 Loud OK';

  return (
    <Layout activePage="profile">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-8">

        {/* Back button (only when viewing others) */}
        {!isOwn && (
          <button onClick={() => navigate(-1)} className="btn-ghost mb-4">
            <ArrowLeft size={16} /> Back
          </button>
        )}

        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card overflow-hidden mb-5"
        >
          {/* Cover */}
          <div className="h-36 bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-accent relative">
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.4'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")` }}
            />
          </div>

          <div className="px-6 pb-6 relative">
            {/* Avatar overlapping cover */}
            <div className="flex justify-between items-end -mt-12 mb-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-card overflow-hidden bg-surface-muted">
                  {profile.profile_image ? (
                    <img
                      src={resolveMediaUrl(profile.profile_image)}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-brand-secondary flex items-center justify-center">
                      <span className="text-3xl font-bold text-brand-warm">{profile.name?.[0]?.toUpperCase()}</span>
                    </div>
                  )}
                </div>
                {isOwn && (
                  <label className={`absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${uploading ? 'opacity-100' : ''}`}>
                    <Camera size={22} className="text-white" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {isOwn ? (
                  <button onClick={() => navigate('/edit-profile')} className="btn-primary text-sm py-2.5">
                    <Edit3 size={15} /> Edit Profile
                  </button>
                ) : (
                  <>
                    {compatScore !== null && (
                      <div className="card-soft px-4 py-2 rounded-2xl text-center">
                        <div className="text-xs text-text-muted font-semibold">Match</div>
                        <div className="text-xl font-bold font-display text-brand-warm">{compatScore}%</div>
                      </div>
                    )}
                    <Link to={`/inbox?user=${profile.id}`} className="btn-primary text-sm py-2.5">
                      <MessageSquare size={15} /> Message
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Name */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-display font-bold text-text-primary">{profile.name}</h1>
                {(profile.user_verified || profile.is_verified) && (
                  <BadgeCheck className="text-brand-accent" size={20} />
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-1.5 text-sm text-text-muted">
                {profile.occupation && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase size={14} /> {profile.occupation}
                  </span>
                )}
                {profile.city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} /> {profile.city}
                  </span>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="mt-4 text-text-secondary leading-relaxed text-sm bg-surface-muted rounded-xl p-4 border border-surface-border">
                {profile.bio}
              </p>
            )}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCell icon={IndianRupee} label="Monthly Rent" value={profile.budget ? `₹${parseInt(profile.budget).toLocaleString('en-IN')}` : null} accent />
          <StatCell icon={IndianRupee} label="Deposit"      value={profile.deposit ? `₹${parseInt(profile.deposit).toLocaleString('en-IN')}` : null} />
          <StatCell icon={Home}        label="Flat Type"     value={profile.flat_type?.toUpperCase()} />
          <StatCell icon={Users}       label="Occupants"     value={profile.occupants ? `${profile.occupants} person${profile.occupants > 1 ? 's' : ''}` : null} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Lifestyle */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-brand-warm" />
              <h2 className="font-display font-bold text-text-primary">Lifestyle</h2>
            </div>
            <div className="space-y-3">
              <CompBar label="Cleanliness" score={profile.cleanliness || 3} max={5} />
              <CompBar label="Noise Tolerance"
                score={profile.noise_tolerance === 'quiet' ? 1 : profile.noise_tolerance === 'moderate' ? 3 : 5}
                max={5}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Trait label={sleep} />
              <Trait label={diet} color="accent" />
              <Trait label={noise} />
              {profile.smoking === 'yes' && <Trait label="🚬 Smoker" color="red" />}
              {profile.drinking === 'yes' && <Trait label="🍺 Drinks" color="blue" />}
              {profile.partying && profile.partying !== 'low' && (
                <Trait label={`🎉 Partying: ${profile.partying}`} />
              )}
            </div>
          </div>

          {/* Languages */}
          <div className="card p-5">
            <h2 className="font-display font-bold text-text-primary mb-4">Languages</h2>
            {profile.languages?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.languages.map(lang => (
                  <span key={lang.id || lang.name} className="tag">{lang.name || lang}</span>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm">No languages added yet.</p>
            )}

            {/* Preferences preview */}
            {(profile.preferred_gender || profile.prefers_smoking || profile.prefers_drinking) && (
              <div className="mt-5 pt-4 border-t border-surface-border">
                <h3 className="text-xs font-semibold uppercase text-text-muted mb-3">Preferences</h3>
                <div className="space-y-1.5 text-sm text-text-secondary">
                  {profile.preferred_gender && <p>Gender: {profile.preferred_gender}</p>}
                  {profile.prefers_smoking && profile.prefers_smoking !== 'no_preference' && (
                    <p>Roommate smoking: {profile.prefers_smoking}</p>
                  )}
                  {profile.prefers_drinking && profile.prefers_drinking !== 'no_preference' && (
                    <p>Roommate drinking: {profile.prefers_drinking}</p>
                  )}
                  {profile.preferred_budget_min && profile.preferred_budget_max && (
                    <p>Budget range: ₹{parseInt(profile.preferred_budget_min).toLocaleString('en-IN')} – ₹{parseInt(profile.preferred_budget_max).toLocaleString('en-IN')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage;
