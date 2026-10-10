import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Scale, AlertTriangle, FileText, Calendar, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { apiFetch } from '../lib/api';
import Layout from '../components/Layout';
import { Button, ButtonLink, Card, Spinner, EmptyState } from '../components/UI';
import UserAvatar from '../components/UserAvatar';


// Animation presets used on this page, previously a shared 299-line module
// of which only these five were ever imported.
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};
const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
const slideInLeft = { initial: { x: -100, opacity: 0 }, animate: { x: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } } };
const slideInRight = { initial: { x: 100, opacity: 0 }, animate: { x: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } } };

const MetricsBar = ({ label, val1, val2, name1 = 'User 1', name2 = 'User 2', max = 5, icon: Icon }) => {
  const safeVal1 = Number(val1) || 0;
  const safeVal2 = Number(val2) || 0;
  const isMatch = safeVal1 === safeVal2;

  return (
    <motion.div variants={staggerItem} className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-brand-coral" />}
          <span className="text-sm font-semibold text-text-primary">{label}</span>
        </div>
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className={`px-2 py-1 rounded-full text-xs font-bold ${
            isMatch
              ? 'bg-status-success/20 text-green-700'
              : 'bg-status-warning/20 text-amber-700'
          }`}
        >
          {isMatch ? '✓ Balanced' : '! Mismatch'}
        </motion.div>
      </div>

      <div className="relative h-3 bg-surface-border rounded-full overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(safeVal1 / max) * 100}%` }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="h-full bg-gradient-to-r from-brand-coral to-brand-amber"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(safeVal2 / max) * 100}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="h-full bg-brand-teal"
        />
      </div>

      <div className="flex justify-between text-xs text-text-muted font-medium">
        <span>
          {name1}: <span className="font-bold text-text-primary">{safeVal1}/{max}</span>
        </span>
        <span>
          {name2}: <span className="font-bold text-text-primary">{safeVal2}/{max}</span>
        </span>
      </div>
    </motion.div>
  );
};

const mapSleepToScore = (sleepTime) => {
  if (sleepTime === 'early') return 1;
  if (sleepTime === 'late') return 5;
  return 3;
};

const formatMonthDay = (dateStr) => {
  if (!dateStr) return 'Not specified';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'Not specified';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ComparePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const u1Id = searchParams.get('u1');
  const u2Id = searchParams.get('u2');

  const [userA, setUserA] = useState(null);
  const [userB, setUserB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!u1Id || !u2Id) {
        setError('Select two profiles to compare.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const [profileA, profileB] = await Promise.all([
          apiFetch(`/profile/${u1Id}`),
          apiFetch(`/profile/${u2Id}`),
        ]);

        if (!cancelled) {
          setUserA(profileA);
          setUserB(profileB);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load profiles for comparison.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [u1Id, u2Id]);

  const timeline = useMemo(() => {
    const dateA = userA?.move_in_date ? new Date(userA.move_in_date) : null;
    const dateB = userB?.move_in_date ? new Date(userB.move_in_date) : null;

    if (!dateA || !dateB || Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) {
      return {
        diffDays: null,
        status: 'Dates not specified',
        message: 'Add move-in dates to compare timeline alignment.',
        variant: 'warning',
        icon: AlertTriangle,
      };
    }

    const diffDays = Math.round(Math.abs(dateA - dateB) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) {
      return {
        diffDays,
        status: 'Excellent match',
        message: 'Move-in dates align very closely.',
        variant: 'success',
        icon: TrendingUp,
      };
    }
    if (diffDays <= 30) {
      return {
        diffDays,
        status: 'Moderate overlap',
        message: 'The timeline gap is workable with some flexibility.',
        variant: 'warning',
        icon: Zap,
      };
    }
    return {
      diffDays,
      status: 'Poor alignment',
      message: 'The move-in gap is wide and may require coordination.',
      variant: 'error',
      icon: TrendingDown,
    };
  }, [userA, userB]);

  // Overall fit from the same inputs the bars show. The previous copy claimed
  // "both profiles look compatible" whatever the numbers actually were.
  const overallScore = useMemo(() => {
    if (!userA || !userB) return 0;
    let total = 0;
    let counted = 0;
    const add = (a, b, max) => {
      // Normalised to 0-100. Contributing raw 0-5 here against a 0-100 budget
      // term made two identical profiles average to 53%.
      total += 100 * (1 - Math.abs((parseInt(a, 10) || 0) - (parseInt(b, 10) || 0)) / max);
      counted++;
    };
    add(userA.cleanliness, userB.cleanliness, 5);
    if (userA.noise_level && userB.noise_level) add(userA.noise_level, userB.noise_level, 5);
    if (userA.occupants && userB.occupants) add(userA.occupants, userB.occupants, 6);
    const bA = parseInt(userA.budget, 10) || 0;
    const bB = parseInt(userB.budget, 10) || 0;
    const maxBudget = Math.max(bA, bB);
    if (maxBudget > 0) {
      total += 100 * (1 - Math.abs(bA - bB) / maxBudget);
      counted++;
    }
    return counted ? Math.round(total / counted) : 0;
  }, [userA, userB]);

  // ── Loading State ──────────────────────────────────────────────
  if (loading) {
    return (
      <Layout activePage="shortlist">
        <div className="max-w-5xl mx-auto px-4 pt-12 pb-24 flex flex-col items-center justify-center min-h-screen">
          <Spinner size="lg" />
          <p className="mt-4 text-text-muted">Loading comparison...</p>
        </div>
      </Layout>
    );
  }

  // ── Error State ────────────────────────────────────────────────
  if (error || !userA || !userB) {
    return (
      <Layout activePage="shortlist">
        <div className="max-w-5xl mx-auto px-4 pt-12 pb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <EmptyState
              icon={AlertTriangle}
              title="Comparison unavailable"
              description={error || 'One or both profiles could not be loaded.'}
              action={
                <Button onClick={() => navigate('/shortlist')}>
                  <ArrowLeft size={16} /> Back to Shortlist
                </Button>
              }
            />
          </motion.div>
        </div>
      </Layout>
    );
  }

  const TimelineIcon = timeline.icon;

  return (
    <Layout activePage="shortlist">
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="max-w-5xl mx-auto px-4 pt-6 pb-24"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> Back
          </Button>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <Scale size={20} className="text-brand-coral" />
            </motion.div>
            <h1 className="font-display font-bold text-2xl text-text-primary">
              Compare Profiles
            </h1>
          </div>
          <div className="w-20" />
        </motion.div>

        {/* User Cards Header */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 gap-4 mb-10"
        >
          {[
            { profile: userA, variant: 'left' },
            { profile: userB, variant: 'right' },
          ].map(({ profile, variant }, idx) => (
            <motion.div
              key={profile?.id}
              variants={variant === 'left' ? slideInLeft : slideInRight}
            >
              <Card className="p-6 text-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: idx * 0.1, type: 'spring', stiffness: 200 }}
                  className="w-24 h-24 rounded-2xl mx-auto mb-4 overflow-hidden border-2 border-brand-coral shadow-lg"
                >
                  {/* The shared avatar initials, not a placeholder image service. Sending
                      real user names to a third-party host for a grey square
                      with text on it was the wrong trade. */}
                  <UserAvatar
                    src={profile?.profile_image}
                    name={profile?.name}
                    size="xl"
                  />
                </motion.div>
                <h2 className="font-display font-bold text-lg text-text-primary">
                  {profile?.name || 'Unknown'}
                </h2>
                {profile?.occupation && (
                  <p className="text-xs text-text-muted uppercase font-semibold mt-1">
                    {profile.occupation}
                  </p>
                )}
                {profile?.city && <p className="text-xs text-text-muted mt-2">{profile.city}</p>}
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Comparison Metrics */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-8"
        >
          {/* Lifestyle Alignment */}
          <motion.div variants={staggerItem}>
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-8">
                <Zap size={20} className="text-brand-coral" />
                <h3 className="font-display font-bold text-lg text-text-primary">
                  Lifestyle Alignment
                </h3>
              </div>

              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-8"
              >
                <MetricsBar
                  label="Cleanliness"
                  val1={userA?.cleanliness}
                  val2={userB?.cleanliness}
                  name1={userA?.name || 'User A'}
                  name2={userB?.name || 'User B'}
                  max={5}
                />
                <MetricsBar
                  label="Noise Level"
                  val1={userA?.noise_level}
                  val2={userB?.noise_level}
                  name1={userA?.name || 'User A'}
                  name2={userB?.name || 'User B'}
                  max={5}
                />
                <MetricsBar
                  label="Sleep Schedule"
                  val1={mapSleepToScore(userA?.sleep_time)}
                  val2={mapSleepToScore(userB?.sleep_time)}
                  name1={userA?.name || 'User A'}
                  name2={userB?.name || 'User B'}
                  max={5}
                />
              </motion.div>
            </Card>
          </motion.div>

          {/* Move-in & Decision */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Timeline */}
            <motion.div variants={staggerItem}>
              <Card className={`p-8 border-2 ${
                timeline.variant === 'success'
                  ? 'border-status-success/30 bg-status-success/5'
                  : timeline.variant === 'warning'
                  ? 'border-status-warning/30 bg-status-warning/5'
                  : 'border-status-error/30 bg-status-error/5'
              }`}>
                <div className="flex items-center gap-3 mb-6">
                  <Calendar size={20} className="text-brand-coral" />
                  <h4 className="font-display font-bold text-text-primary">
                    Move-in Compatibility
                  </h4>
                </div>

                <div className="space-y-4 mb-6">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-3 rounded-lg bg-white/50"
                  >
                    <p className="text-xs font-semibold text-text-secondary">
                      {userA?.name || 'User A'}
                    </p>
                    <p className="text-sm text-text-primary font-bold mt-1">
                      {formatMonthDay(userA?.move_in_date)}
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-3 rounded-lg bg-white/50"
                  >
                    <p className="text-xs font-semibold text-text-secondary">
                      {userB?.name || 'User B'}
                    </p>
                    <p className="text-sm text-text-primary font-bold mt-1">
                      {formatMonthDay(userB?.move_in_date)}
                    </p>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className={`p-3 rounded-lg ${
                    timeline.variant === 'success'
                      ? 'bg-status-success/20 border border-status-success'
                      : timeline.variant === 'warning'
                      ? 'bg-status-warning/20 border border-status-warning'
                      : 'bg-status-error/20 border border-status-error'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TimelineIcon size={16} className="text-text-primary" />
                    <p className="text-sm font-bold text-text-primary">
                      {timeline.status}
                    </p>
                  </div>
                  {timeline.diffDays !== null && (
                    <p className="text-xs text-text-secondary">
                      {timeline.diffDays} day difference
                    </p>
                  )}
                  <p className="text-xs text-text-muted mt-2 italic">
                    {timeline.message}
                  </p>
                </motion.div>
              </Card>
            </motion.div>

            {/* Next Steps */}
            <motion.div variants={staggerItem}>
              <Card className="p-8 bg-gradient-to-br from-brand-teal/10 to-brand-coral/5 border border-brand-coral/20">
                <div className="flex items-center gap-3 mb-6">
                  <FileText size={20} className="text-brand-coral" />
                  <h4 className="font-display font-bold text-text-primary">
                    Next Steps
                  </h4>
                </div>

                <p className="text-sm text-text-secondary leading-relaxed mb-6">
                  {overallScore >= 70
                    ? `You two score ${overallScore}% overall. If you both want to go ahead, drafting a shared agreement is the next step.`
                    : `You two score ${overallScore}% overall — worth talking first. You can still draft an agreement now if you would rather have it in writing.`}
                </p>

                {/* Compare is read-only. Agreements are their own feature under
                    /agreements, so this card points there instead of offering a
                    second, competing way to start one. */}
                <div className="flex flex-col items-center">
                  <ButtonLink to="/agreements" variant="primary" className="w-full">
                    <FileText size={16} /> Go to Agreements
                  </ButtonLink>
                  <p className="text-xs text-text-muted text-center mt-4">
                    Draft shared terms with a roommate once you have matched.
                  </p>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default ComparePage;
