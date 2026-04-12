import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Briefcase, MessageSquare, ExternalLink, BadgeCheck, Sparkles, Check, Info, AlertTriangle, ChevronDown, ChevronUp,
         Moon, Sun, Utensils, Cigarette, Wine, Users, Home, IndianRupee, Heart, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import UserAvatar from './UserAvatar';
import { apiFetch, auth, resolveMediaUrl } from '../utils/api';

// ── Trait Tag ──────────────────────────────────────────────────
const TraitTag = ({ icon: Icon, label, variant = 'default' }) => {
  const cls = {
    default: 'tag',
    accent:  'tag tag-accent',
    blue:    'tag tag-blue',
    red:     'bg-red-50 text-red-500 border border-red-200 rounded-full px-3 py-1 text-xs font-semibold inline-flex items-center gap-1',
  }[variant];
  return (
    <span className={cls}>
      {Icon && <Icon size={11} />}
      {label}
    </span>
  );
};

// ── Match Score Ring ───────────────────────────────────────────
const ScoreRing = ({ score }) => {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * score) / 100;
  const color = score >= 75 ? '#A8D5BA' : score >= 50 ? '#FFB7A5' : '#FFD89B';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} stroke="#FFE4D6" strokeWidth="4" fill="none" />
        <circle
          cx="28" cy="28" r={r}
          stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-text-primary font-display leading-none">{score}%</span>
      </div>
    </div>
  );
};

// ── Match Card ─────────────────────────────────────────────────
const MatchCard = ({ match, index = 0, featured = false }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [isShortlisted, setIsShortlisted] = React.useState(match.is_shortlisted);
  const userId = auth.getUserId();
  const traits = [];

  const toggleShortlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[Frontend] userId before API call:', userId);
    try {
      if (isShortlisted) {
        const response = await apiFetch('/shortlist', { method: 'DELETE', body: { userId, targetId: match.id } });
        console.log('[Frontend] DELETE response data:', response);
      } else {
        const response = await apiFetch('/shortlist', { method: 'POST', body: { userId, targetId: match.id } });
        console.log('[Frontend] POST response data:', response);
      }
      setIsShortlisted(!isShortlisted);
    } catch (err) {
      console.error('Shortlist error:', err);
      alert('Shortlist error: ' + err.message);
    }
  };

  if (match.sleep_time) {
    traits.push({
      icon: match.sleep_time === 'early' ? Sun : Moon,
      label: match.sleep_time === 'early' ? 'Early bird' : match.sleep_time === 'late' ? 'Night owl' : 'Flexible',
      variant: 'default',
    });
  }
  if (match.diet) {
    const dietLabel = match.diet === 'veg' ? '🥗 Veg' : match.diet === 'eggetarian' ? '🥚 Eggetarian' : match.diet === 'vegan' ? '🌱 Vegan' : '🍗 Non-veg';
    traits.push({ icon: Utensils, label: dietLabel, variant: 'accent' });
  }
  if (match.smoking === 'yes') {
    traits.push({ icon: Cigarette, label: 'Smoker', variant: 'red' });
  }
  if (match.drinking === 'yes') {
    traits.push({ icon: Wine, label: 'Drinks', variant: 'blue' });
  }

  return (
    <motion.div
      layoutId={`match-card-${match.id}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, type: 'spring', stiffness: 320, damping: 28 }}
      className={`card group hover:-translate-y-1 transition-all duration-300 overflow-hidden ${
        featured ? 'flex flex-col md:flex-row' : 'flex flex-col'
      }`}
    >
      {/* Image */}
      <div className={`relative bg-surface-muted ${featured ? 'md:w-64 h-52 md:h-auto flex-shrink-0' : 'h-52'}`}>
        <UserAvatar
          src={match.profile_image}
          name={match.name}
          size="xl"
          className={`absolute inset-0 w-full h-full rounded-none object-cover ${!match.profile_image ? 'rounded-none' : ''}`}
        />
        {match.profile_image && (
          <img
            src={resolveMediaUrl(match.profile_image)}
            alt={match.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}
        {/* Gradient overlay - Moved up to not block clicks */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

        {/* Score ring overlay */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-2xl p-1.5 shadow-card z-10">
          <ScoreRing score={match.score} />
        </div>
        {/* Verified badge */}
        {match.is_verified && (
          <div className="absolute top-3 right-3 bg-brand-accent/90 text-white p-1.5 rounded-full shadow-sm z-10">
            <BadgeCheck size={16} />
          </div>
        )}
        {/* Shortlist Heart */}
        <button
          onClick={toggleShortlist}
          className={`absolute bottom-3 right-3 p-2 rounded-full backdrop-blur-md transition-all shadow-sm z-10 ${
            isShortlisted ? 'bg-red-500 text-white' : 'bg-white/80 text-text-muted hover:text-red-500 hover:bg-white'
          }`}
        >
          <Heart size={18} fill={isShortlisted ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {/* Name + Location */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-bold text-xl text-text-primary leading-tight">{match.name}</h3>
            {/* Legacy Archetype Tag - Hidden for cleaner look or could be kept if desired */}
            {/* {match.archetype && (
              <span className="px-2.5 py-1 rounded-lg bg-brand-secondary/30 text-brand-warm text-[10px] font-bold uppercase tracking-wider border border-brand-primary/20">
                {match.archetype}
              </span>
            )} */}
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-text-muted">
            {match.city && (
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-brand-warm" />
                {match.city}
              </span>
            )}
            {match.occupation && (
              <span className="flex items-center gap-1">
                <Briefcase size={12} className="text-text-light" />
                {match.occupation}
              </span>
            )}
            {match.moveInDate && (
              <span className={`flex items-center gap-1 font-bold ${
                match.moveInStatus === 'Perfect' ? 'text-green-600' : 
                match.moveInStatus === 'Flexible' ? 'text-brand-warm' : 'text-text-muted'
              }`}>
                <Calendar size={12} />
                Timeline: {match.moveInStatus}
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        {match.bio && (
          <p className="text-sm text-text-secondary leading-relaxed line-clamp-2 mb-3 px-1 italic border-l-2 border-brand-primary/20">
            "{match.bio}"
          </p>
        )}

        {/* Rent / Deposit / Flat / Occupants row */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="card-soft rounded-xl px-3 py-2">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-text-muted uppercase mb-0.5">
              <IndianRupee size={10} /> Rent
            </div>
            <span className="text-sm font-bold text-text-primary">
              ₹{(match.budget || 0).toLocaleString('en-IN')}/mo
            </span>
          </div>
          {match.deposit && (
            <div className="card-soft rounded-xl px-3 py-2">
              <div className="text-[10px] font-semibold text-text-muted uppercase mb-0.5">Deposit</div>
              <span className="text-sm font-bold text-text-primary">
                ₹{(match.deposit || 0).toLocaleString('en-IN')}
              </span>
            </div>
          )}
          {match.flat_type && (
            <div className="card-soft rounded-xl px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-text-muted uppercase mb-0.5">
                <Home size={10} /> Flat
              </div>
              <span className="text-sm font-bold text-text-primary uppercase">{match.flat_type}</span>
            </div>
          )}
          {match.occupants && (
            <div className="card-soft rounded-xl px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-text-muted uppercase mb-0.5">
                <Users size={10} /> Occupants
              </div>
              <span className="text-sm font-bold text-text-primary">{match.occupants}</span>
            </div>
          )}
        </div>

        {/* Trait Tags */}
        {traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {traits.map((t, i) => (
              <TraitTag key={i} icon={t.icon} label={t.label} variant={t.variant} />
            ))}
            {match.cleanliness && (
              <TraitTag
                label={`Cleanliness ${match.cleanliness}/5`}
                variant={match.cleanliness >= 4 ? 'accent' : 'default'}
              />
            )}
          </div>
        )}

        {/* Fit Analysis Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full py-3 px-4 mb-4 rounded-xl bg-surface-muted/50 border border-surface-border hover:border-brand-primary/30 transition-all text-xs font-bold text-text-secondary group"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-brand-warm" />
            View Roommate Fit Analysis
          </div>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* fitAnalysis Expanded Section */}
        <motion.div
          initial={false}
          animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
          className="overflow-hidden"
        >
          <div className="pb-4 space-y-4">
            {/* Summary */}
            <div className="p-3 rounded-xl bg-brand-secondary/10 border border-brand-primary/10">
              <p className="text-xs text-text-primary leading-relaxed">
                <span className="text-brand-warm font-bold italic">Analysis:</span> {match.summary}
              </p>
            </div>

            {/* Risk Analysis (New for Decision Support) */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              match.riskLevel === 'High' ? 'bg-red-50 border-red-100 text-red-700' :
              match.riskLevel === 'Moderate' ? 'bg-orange-50 border-orange-100 text-orange-700' :
              'bg-blue-50 border-blue-100 text-blue-700'
            }`}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} />
                <span className="text-xs font-bold uppercase tracking-wide">Conflict Risk: {match.riskLevel}</span>
              </div>
              <div className="text-[10px] font-medium opacity-80">Based on habits</div>
            </div>

            {/* Detailed Category Scores */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Practical', val: match.fitCategories?.practical, icon: Home },
                { label: 'Lifestyle', val: match.fitCategories?.lifestyle, icon: Utensils },
                { label: 'Comfort', val: match.fitCategories?.comfort, icon: Sun },
              ].map(cat => (
                <div key={cat.label} className="text-center p-2 rounded-lg bg-surface-muted/30 border border-surface-border">
                  <cat.icon size={12} className="mx-auto mb-1 text-text-light" />
                  <div className="text-[10px] font-bold text-text-muted uppercase mb-1">{cat.label}</div>
                  <div className="text-xs font-bold text-text-primary">{cat.val || 50}%</div>
                </div>
              ))}
            </div>

            {/* Move-in Detail */}
            {match.moveInDate && (
              <div className="p-2.5 rounded-xl bg-surface-muted/20 border border-surface-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-text-light" />
                  <span className="text-[10px] font-bold text-text-muted uppercase">Expected Move-in</span>
                </div>
                <span className="text-[11px] font-bold text-text-primary">
                  {new Date(match.moveInDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', day: 'numeric' })}
                </span>
              </div>
            )}

            {/* Critical Conflicts */}
            {match.conflicts && match.conflicts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-500">
                  <AlertTriangle size={12} /> Key Concerns
                </div>
                {match.conflicts.map((c, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-red-50/50 border border-red-100 flex gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-1 h-1 rounded-full bg-red-400 mt-1" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-red-800 uppercase">{c.label}</div>
                      <p className="text-[10px] text-red-700 leading-tight mt-0.5">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
        <div className="flex gap-2 mt-auto pt-3 border-t border-surface-border">
          <Link
            to={`/inbox?user=${match.id}`}
            id={`chat-${match.id}`}
            className="btn-secondary flex-1 justify-center py-2.5 text-sm"
          >
            <MessageSquare size={15} /> Chat
          </Link>
          <Link
            to={`/profile/${match.id}`}
            id={`view-profile-${match.id}`}
            className="btn-primary flex-1 justify-center py-2.5 text-sm"
          >
            View Profile <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default MatchCard;
