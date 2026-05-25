import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare, Briefcase, MapPin, ArrowLeft, BadgeCheck,
  Edit3, Camera, Home, Users, IndianRupee, Sparkles, Heart
} from 'lucide-react';
import { apiFetch, apiFormFetch, auth, resolveMediaUrl } from '../utils/api';
import Layout from '../components/Layout';
import {
  Button,
  Card,
  ProgressBar,
  CompatibilityBadge,
  Avatar,
  Spinner,
  EmptyState,
  AttributeChip,
  Badge,
  SectionHeader,
} from '../components/UI';
import {
  pageVariants,
  staggerContainer,
  staggerItem,
  premiumSpring,
} from '../utils/animations';

// ── Lifestyle Traits ──────────────────────────────────────────
const TraitBadge = ({ label, color = 'primary' }) => {
  const colorMap = {
    primary: 'bg-brand-secondary text-brand-deep',
    success: 'bg-status-success/20 text-green-700',
    warning: 'bg-status-warning/20 text-amber-700',
    error: 'bg-status-error/20 text-red-700',
  };
  return (
    <motion.span
      whileHover={{ scale: 1.05 }}
      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${colorMap[color]} border border-opacity-30`}
    >
      {label}
    </motion.span>
  );
};

// ── Profile Page ───────────────────────────────────────────────
const ProfilePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUserId = auth.getUserId();

  const viewingId = id || currentUserId;
  const isOwn = !id || id == currentUserId;

  const [profile, setProfile] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!currentUserId) {
      navigate('/login');
    }
  }, [currentUserId, navigate]);

  const loadProfile = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
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
  }, [currentUserId, isOwn, viewingId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('profile_image', file);
      const data = await apiFormFetch('/upload', fd, { method: 'POST' });
      if (data.filePath) {
        const profileFd = new FormData();
        profileFd.append('userId', currentUserId);
        profileFd.append('profile_image', file);
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
        await apiFormFetch('/profile', profileFd, { method: 'POST' });
        await loadProfile();
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const compatScore = React.useMemo(() => {
    if (isOwn || !profile || !myProfile) return null;
    let s = 0;
    const a = myProfile,
      b = profile;
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

  if (!currentUserId) {
    return null;
  }

  // ── Loading State ──────────────────────────────────────────────
  if (loading) {
    return (
      <Layout activePage="profile">
        <div className="max-w-4xl mx-auto px-4 pt-8 pb-24">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="skeleton h-56 rounded-2xl" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton h-20 rounded-2xl" />
              ))}
            </div>
            <div className="skeleton h-64 rounded-2xl" />
          </motion.div>
        </div>
      </Layout>
    );
  }

  // ── Error State ────────────────────────────────────────────────
  if (error || !profile) {
    return (
      <Layout activePage="profile">
        <div className="max-w-4xl mx-auto px-4 pt-8 pb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <EmptyState
              title="Profile not found"
              description={error || 'This profile may have been deleted or is no longer available.'}
              action={
                <Button onClick={() => navigate('/discover')}>
                  Back to Discover
                </Button>
              }
            />
          </motion.div>
        </div>
      </Layout>
    );
  }

  const diet =
    profile.diet === 'veg'
      ? '🥗 Veg'
      : profile.diet === 'eggetarian'
      ? '🥚 Eggetarian'
      : profile.diet === 'vegan'
      ? '🌱 Vegan'
      : '🍗 Non-veg';
  const sleep =
    profile.sleep_time === 'early'
      ? '🌅 Early Bird'
      : profile.sleep_time === 'late'
      ? '🌙 Night Owl'
      : '⏰ Flexible';
  const noise =
    profile.noise_tolerance === 'quiet'
      ? '🔇 Quiet'
      : profile.noise_tolerance === 'moderate'
      ? '🔉 Moderate'
      : '🔊 Loud OK';

  return (
    <Layout activePage="profile">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-4xl mx-auto px-4 pt-6 pb-24"
      >
        {/* Back button */}
        {!isOwn && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-6"
            >
              <ArrowLeft size={18} /> Back
            </Button>
          </motion.div>
        )}

        {/* Hero Card */}
        <motion.div
          variants={pageVariants}
          initial="initial"
          animate="animate"
          className="mb-8"
        >
          <Card interactive>
            {/* Cover Gradient */}
            <div className="h-40 bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-warm relative overflow-hidden">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.4'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
                }}
              />
            </div>

            <div className="px-6 pb-6 relative">
              {/* Avatar & Actions */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                className="flex justify-between items-end -mt-14 mb-6"
              >
                {/* Avatar with upload */}
                <motion.div
                  whileHover={isOwn ? { scale: 1.05 } : {}}
                  className="relative group"
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="w-28 h-28 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-gradient-to-br from-brand-secondary to-brand-primary flex items-center justify-center"
                  >
                    {profile.profile_image ? (
                      <img
                        src={resolveMediaUrl(profile.profile_image)}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl font-bold text-white">
                        {profile.name?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </motion.div>
                  {isOwn && (
                    <label
                      className={`absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${uploading ? 'opacity-100' : ''}`}
                    >
                      {uploading ? (
                        <Spinner size="sm" />
                      ) : (
                        <Camera size={24} className="text-white" />
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </label>
                  )}
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex gap-3"
                >
                  {isOwn ? (
                    <Button variant="primary" onClick={() => navigate('/edit-profile')}>
                      <Edit3 size={16} /> Edit
                    </Button>
                  ) : (
                    <>
                      {compatScore !== null && (
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          transition={premiumSpring}
                        >
                          <CompatibilityBadge score={compatScore} size="md" />
                        </motion.div>
                      )}
                      <Button
                        variant="primary"
                        asChild
                      >
                        <Link to={`/inbox?user=${profile.id}`}>
                          <MessageSquare size={16} /> Message
                        </Link>
                      </Button>
                    </>
                  )}
                </motion.div>
              </motion.div>

              {/* Profile Info */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <h1 className="text-3xl font-display font-bold text-text-primary">
                    {profile.name}
                  </h1>
                  {(profile.user_verified || profile.is_verified) && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <BadgeCheck className="text-status-success" size={24} />
                    </motion.div>
                  )}
                </div>

                {/* Meta Info */}
                <div className="flex flex-wrap gap-6 mb-4">
                  {profile.occupation && (
                    <AttributeChip
                      icon={Briefcase}
                      label="Occupation"
                      value={profile.occupation}
                    />
                  )}
                  {profile.city && (
                    <AttributeChip
                      icon={MapPin}
                      label="Location"
                      value={profile.city}
                    />
                  )}
                </div>

                {/* Bio */}
                {profile.bio && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-text-secondary leading-relaxed text-sm bg-surface-muted rounded-xl p-4 border border-surface-border"
                  >
                    {profile.bio}
                  </motion.p>
                )}
              </motion.div>
            </div>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { icon: IndianRupee, label: 'Monthly Rent', value: profile.budget ? `₹${parseInt(profile.budget).toLocaleString('en-IN')}` : '—', accent: true },
            { icon: IndianRupee, label: 'Deposit', value: profile.deposit ? `₹${parseInt(profile.deposit).toLocaleString('en-IN')}` : '—' },
            { icon: Home, label: 'Flat Type', value: profile.flat_type?.toUpperCase() || '—' },
            { icon: Users, label: 'Occupants', value: profile.occupants ? `${profile.occupants}` : '—' },
          ].map((stat, idx) => (
            <motion.div key={idx} variants={staggerItem}>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <stat.icon
                    className={stat.accent ? 'text-brand-primary' : 'text-text-muted'}
                    size={20}
                  />
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase">
                      {stat.label}
                    </p>
                    <p className="text-lg font-bold text-text-primary mt-1">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Lifestyle & Languages */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Lifestyle Card */}
          <motion.div variants={staggerItem}>
            <Card className="p-6">
              <SectionHeader
                title="Lifestyle"
                subtitle="Daily habits & preferences"
                animated={false}
              />

              <div className="space-y-5">
                {/* Progress Bars */}
                <div>
                  <ProgressBar
                    label="Cleanliness"
                    value={Math.round((profile.cleanliness || 3) * 20)}
                    showPercent={false}
                  />
                </div>
                <div>
                  <ProgressBar
                    label="Noise Tolerance"
                    value={
                      profile.noise_tolerance === 'quiet'
                        ? 33
                        : profile.noise_tolerance === 'moderate'
                        ? 66
                        : 100
                    }
                    showPercent={false}
                  />
                </div>

                {/* Traits */}
                <div className="pt-3">
                  <p className="text-xs font-semibold text-text-muted uppercase mb-3">Traits</p>
                  <div className="flex flex-wrap gap-2">
                    <TraitBadge label={sleep} />
                    <TraitBadge label={diet} color="primary" />
                    <TraitBadge label={noise} />
                    {profile.smoking === 'yes' && (
                      <TraitBadge label="🚬 Smoker" color="error" />
                    )}
                    {profile.drinking === 'yes' && (
                      <TraitBadge label="🍺 Drinks" color="warning" />
                    )}
                    {profile.partying && profile.partying !== 'low' && (
                      <TraitBadge
                        label={`🎉 Partying: ${profile.partying}`}
                        color="primary"
                      />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Languages Card */}
          <motion.div variants={staggerItem}>
            <Card className="p-6">
              <SectionHeader
                title="Languages & Preferences"
                subtitle="Communication & expectations"
                animated={false}
              />

              {/* Languages */}
              {profile.languages?.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-6">
                  {profile.languages.map((lang, idx) => (
                    <motion.div
                      key={lang.id || lang.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Badge variant="primary">
                        {lang.name || lang}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-sm mb-6">
                  No languages specified yet.
                </p>
              )}

              {/* Preferences */}
              {(profile.preferred_gender ||
                profile.prefers_smoking ||
                profile.prefers_drinking ||
                (profile.preferred_budget_min && profile.preferred_budget_max)) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="pt-4 border-t border-surface-border"
                >
                  <p className="text-xs font-semibold text-text-muted uppercase mb-3">
                    What They're Looking For
                  </p>
                  <div className="space-y-2 text-sm text-text-secondary">
                    {profile.preferred_gender && (
                      <p>
                        <span className="font-semibold">Gender:</span> {profile.preferred_gender}
                      </p>
                    )}
                    {profile.prefers_smoking &&
                      profile.prefers_smoking !== 'no_preference' && (
                        <p>
                          <span className="font-semibold">Smoking:</span>{' '}
                          {profile.prefers_smoking}
                        </p>
                      )}
                    {profile.prefers_drinking &&
                      profile.prefers_drinking !== 'no_preference' && (
                        <p>
                          <span className="font-semibold">Drinking:</span>{' '}
                          {profile.prefers_drinking}
                        </p>
                      )}
                    {profile.preferred_budget_min && profile.preferred_budget_max && (
                      <p>
                        <span className="font-semibold">Budget:</span> ₹
                        {parseInt(
                          profile.preferred_budget_min
                        ).toLocaleString('en-IN')}{' '}
                        – ₹
                        {parseInt(
                          profile.preferred_budget_max
                        ).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default ProfilePage;
