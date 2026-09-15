import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search, MapPin, Home, Users, Heart, Calendar, CheckCircle2,
  ChevronRight, Building2, Globe, Clock, Sparkles
} from 'lucide-react';
import Layout from '../components/Layout';
import { apiFetch } from '../lib/api';
import { Card, SectionHeader, EmptyState, Badge } from '../components/UI';
import UserAvatar from '../components/UserAvatar';
import { Link } from 'react-router-dom';

const FadeIn = ({ children, delay = 0, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const HorizontalScroll = ({ children, className = '' }) => (
  <div className={`flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide ${className}`}>
    {children}
  </div>
);

const SkeletonCard = ({ className = '' }) => (
  <div className={`animate-pulse bg-white rounded-2xl border border-surface-border ${className}`}>
    <div className="skeleton h-40 rounded-t-2xl" />
    <div className="p-4 space-y-3">
      <div className="skeleton h-4 w-2/3 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
    </div>
  </div>
);

const JourneyStep = ({ icon: Icon, title, description, color, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
  >
    <Card interactive className="p-5 h-full">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <h3 className="font-semibold text-text-primary text-sm mb-1">{title}</h3>
      <p className="text-text-muted text-xs leading-relaxed">{description}</p>
    </Card>
  </motion.div>
);

const RoommateCard = ({ person }) => (
  <Link to={`/roommates/${person.id}`} className="snap-start flex-shrink-0 w-56">
    <Card interactive className="overflow-hidden h-full">
      <div className="relative">
        <div className="h-36 bg-surface-muted flex items-center justify-center">
          <UserAvatar src={person.profile_image} name={person.name} size="lg" />
        </div>
        <Badge variant="coral" className="absolute top-2 right-2">{person.age}</Badge>
      </div>
      <div className="p-4">
        <h4 className="font-semibold text-text-primary text-sm truncate">{person.name}</h4>
        <p className="text-text-muted text-xs mt-0.5">{person.occupation}</p>
        {person.city && (
          <div className="flex items-center gap-1 mt-2 text-text-muted">
            <MapPin size={12} />
            <span className="text-xs">{person.city}</span>
          </div>
        )}
        {person.budget && (
          <p className="text-brand-coral font-semibold text-sm mt-2">
            ₹{person.budget.toLocaleString('en-IN')}/mo
          </p>
        )}
      </div>
    </Card>
  </Link>
);

const CommunityCard = ({ community }) => (
  <Link to={`/communities/${community.id}`} className="snap-start flex-shrink-0 w-64">
    <Card interactive className="overflow-hidden h-full">
      <div className="h-32 bg-brand-teal/5 flex items-center justify-center overflow-hidden">
        {community.image ? (
          <img src={community.image} alt={community.name} className="w-full h-full object-cover" />
        ) : (
          <Users size={32} className="text-brand-teal" />
        )}
      </div>
      <div className="p-4">
        <Badge variant="teal" className="mb-2">{community.category}</Badge>
        <h4 className="font-semibold text-text-primary text-sm truncate">{community.name}</h4>
        <p className="text-text-muted text-xs mt-1 line-clamp-2">{community.description}</p>
        <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
          <span className="flex items-center gap-1"><Users size={12} />{community.member_count}</span>
          <span className="flex items-center gap-1"><MapPin size={12} />{community.city}</span>
        </div>
      </div>
    </Card>
  </Link>
);

const EventCard = ({ event }) => (
  <Link to={`/events/${event.id}`} className="block">
    <Card interactive className="p-4">
      <div className="flex gap-4">
        <div className="w-14 h-14 rounded-xl bg-brand-amber/10 flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-brand-amber font-bold text-lg leading-none">
            {new Date(event.start_time).getDate()}
          </span>
          <span className="text-brand-amber text-[10px] uppercase font-semibold">
            {new Date(event.start_time).toLocaleDateString('en', { month: 'short' })}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-text-primary text-sm truncate">{event.title}</h4>
          <p className="text-text-muted text-xs mt-0.5 flex items-center gap-1">
            <Building2 size={11} />{event.community_name}
          </p>
          <p className="text-text-muted text-xs mt-1 flex items-center gap-1">
            <MapPin size={11} />{event.location}
          </p>
          <p className="text-text-muted text-xs mt-1 flex items-center gap-1">
            <Clock size={11} />
            {new Date(event.start_time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
            {' – '}
            {new Date(event.end_time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </Card>
  </Link>
);

const SettlementTask = ({ task, onToggle }) => (
  <motion.div
    whileTap={{ scale: 0.98 }}
    onClick={() => onToggle(task.id)}
    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
      task.done
        ? 'bg-status-success/5 border-status-success/20'
        : 'bg-white border-surface-border hover:border-brand-coral/30'
    }`}
  >
    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
      task.done ? 'bg-status-success text-white' : 'border-2 border-surface-border'
    }`}>
      {task.done && <CheckCircle2 size={14} />}
    </div>
    <span className={`text-sm ${task.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
      {task.label}
    </span>
  </motion.div>
);

const costLabel = { 1: 'Budget-friendly', 2: 'Affordable', 3: 'Moderate', 4: 'Pricey', 5: 'Premium' };
const costColor = { 1: 'text-status-success', 2: 'text-status-success', 3: 'text-brand-amber', 4: 'text-brand-coral', 5: 'text-brand-coral' };

export default function DiscoverPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [taskState, setTaskState] = useState({});

  useEffect(() => {
    apiFetch('/discover')
      .then(d => {
        setData(d);
        const tasks = {};
        (d.settlement?.tasks || []).forEach(t => { tasks[t.id] = t.done; });
        setTaskState(tasks);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleTask = (id) => {
    setTaskState(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 pt-8 space-y-8">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} className="h-40" />)}
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map(i => <SkeletonCard key={i} className="w-56 h-64 flex-shrink-0" />)}
          </div>
        </div>
      </Layout>
    );
  }

  const user = data?.user || {};
  const roommates = data?.roommates || [];
  const communities = data?.communities || [];
  const events = data?.events || [];
  const cities = data?.cities || [];
  const settlement = data?.settlement || { tasks: [], completed: 0, total: 0 };

  const cityInfo = cities.find(c => c.name === user.moving_to) || cities[0];

  const journeySteps = [
    { icon: Home, title: 'Find a place', description: 'Search cities and compare living costs to find your ideal home.', color: 'bg-brand-coral' },
    { icon: Users, title: 'Find a roommate', description: 'Match with compatible people who share your vibe.', color: 'bg-brand-teal' },
    { icon: Heart, title: 'Find community', description: 'Join groups of people with shared interests in your city.', color: 'bg-brand-amber' },
    { icon: CheckCircle2, title: 'Settle in', description: 'Complete your checklist and feel at home faster.', color: 'bg-status-success' },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-24 space-y-10">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <FadeIn>
          <div className="bg-gradient-to-br from-brand-coral to-orange-400 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-white/80" />
                <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">
                  Welcome{user.name ? `, ${user.name}` : ''}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">
                Moving somewhere new?
              </h1>
              <p className="text-white/80 text-sm md:text-base mb-6 max-w-lg">
                Discover cities, find roommates, join communities, and settle into your new life — all in one place.
              </p>
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search cities, communities, events..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>
            </div>
          </div>
        </FadeIn>

        {/* ── Your Journey ──────────────────────────────────────── */}
        <FadeIn delay={0.1}>
          <SectionHeader title="Your journey" subtitle="Four steps to your new life" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {journeySteps.map((step, i) => (
              <JourneyStep key={step.title} {...step} index={i} />
            ))}
          </div>
        </FadeIn>

        {/* ── Recommended Roommates ─────────────────────────────── */}
        <FadeIn delay={0.2}>
          <SectionHeader
            title="Recommended roommates"
            subtitle={`${roommates.length} people you might click with`}
            action={
              <Link to="/roommates" className="text-brand-coral text-xs font-semibold flex items-center gap-1 hover:underline">
                View all <ChevronRight size={14} />
              </Link>
            }
          />
          {roommates.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No roommates yet"
              description="Complete your profile to get personalized roommate recommendations."
            />
          ) : (
            <HorizontalScroll className="mt-4 -mx-4 px-4">
              {roommates.map(p => (
                <RoommateCard key={p.id} person={p} />
              ))}
            </HorizontalScroll>
          )}
        </FadeIn>

        {/* ── Your City ─────────────────────────────────────────── */}
        {cityInfo && (
          <FadeIn delay={0.3}>
            <SectionHeader
              title="Your city"
              subtitle={cityInfo.name}
              action={
                <Link to={`/cities/${cityInfo.id}`} className="text-brand-teal text-xs font-semibold flex items-center gap-1 hover:underline">
                  Explore <ChevronRight size={14} />
                </Link>
              }
            />
            <Card className="overflow-hidden mt-4">
              <div className="relative h-48 md:h-56">
                {cityInfo.image ? (
                  <img src={cityInfo.image} alt={cityInfo.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-teal/10 to-brand-teal/5 flex items-center justify-center">
                    <Globe size={48} className="text-brand-teal/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin size={14} />
                    <h3 className="text-lg font-bold">{cityInfo.name}, {cityInfo.country}</h3>
                  </div>
                  <p className="text-white/70 text-xs line-clamp-2">{cityInfo.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-surface-border">
                <div className="p-4 text-center">
                  <p className={`text-sm font-bold ${costColor[cityInfo.cost_level] || 'text-text-primary'}`}>
                    {costLabel[cityInfo.cost_level] || '—'}
                  </p>
                  <p className="text-text-muted text-[11px] mt-0.5">Cost level</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-sm font-bold text-text-primary">{cityInfo.people_count || 0}</p>
                  <p className="text-text-muted text-[11px] mt-0.5">Nomads here</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-sm font-bold text-brand-teal">{roommates.length}</p>
                  <p className="text-text-muted text-[11px] mt-0.5">Matches</p>
                </div>
              </div>
            </Card>
          </FadeIn>
        )}

        {/* ── Find Your People ──────────────────────────────────── */}
        <FadeIn delay={0.35}>
          <SectionHeader
            title="Find your people"
            subtitle="Communities you might love"
            action={
              <Link to="/communities" className="text-brand-teal text-xs font-semibold flex items-center gap-1 hover:underline">
                View all <ChevronRight size={14} />
              </Link>
            }
          />
          {communities.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No communities yet"
              description="Join communities to meet people who share your interests."
            />
          ) : (
            <HorizontalScroll className="mt-4 -mx-4 px-4">
              {communities.map(c => (
                <CommunityCard key={c.id} community={c} />
              ))}
            </HorizontalScroll>
          )}
        </FadeIn>

        {/* ── Coming Up ─────────────────────────────────────────── */}
        <FadeIn delay={0.4}>
          <SectionHeader
            title="Coming up"
            subtitle="Events happening soon"
            action={
              <Link to="/events" className="text-brand-amber text-xs font-semibold flex items-center gap-1 hover:underline">
                View all <ChevronRight size={14} />
              </Link>
            }
          />
          {events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No upcoming events"
              description="Check back later or join a community to see their events."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {events.slice(0, 4).map(e => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </FadeIn>

        {/* ── Settle In ─────────────────────────────────────────── */}
        <FadeIn delay={0.45}>
          <SectionHeader
            title="Settle in"
            subtitle={`${settlement.completed} of ${settlement.total} tasks done`}
          />
          <Card className="p-5 mt-4">
            <div className="mb-4">
              <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${settlement.total ? (settlement.completed / settlement.total) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-status-success rounded-full"
                />
              </div>
            </div>
            {settlement.tasks.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-4">Complete onboarding to see your settlement checklist.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {settlement.tasks.map(task => (
                  <SettlementTask
                    key={task.id}
                    task={{ ...task, done: !!taskState[task.id] }}
                    onToggle={toggleTask}
                  />
                ))}
              </div>
            )}
          </Card>
        </FadeIn>

      </div>
    </Layout>
  );
}
