import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Users, CheckCircle2, Globe, Clock, ArrowRight, ChevronRight, ExternalLink } from 'lucide-react';
import Layout from '../components/Layout';
import { apiFetch } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Card, Button, ButtonLink, EmptyState, Badge, ErrorState, InlineError } from '../components/UI';
import UserAvatar from '../components/UserAvatar';
import { Link } from 'react-router-dom';

// The one deliberate page-level reveal. Everything below it arrives together,
// because staggered fade-ups on every card read as template, not as hierarchy.
const PageReveal = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

const costLabel = { 1: 'Budget-friendly', 2: 'Affordable', 3: 'Moderate', 4: 'Pricey', 5: 'Premium' };
const costColor = { 1: 'text-status-success', 2: 'text-status-success', 3: 'text-brand-amber', 4: 'text-brand-coral', 5: 'text-brand-coral' };

const BREAKDOWN_LABELS = {
  lifestyle: 'Lifestyle', budget: 'Budget', location: 'Location',
  movein: 'Move-in', interests: 'Interests', habits: 'Habits',
};

function ScoreRing({ score }) {
  const tone = score >= 70 ? '#22C55E' : score >= 50 ? '#F2B84B' : '#9CA3AF';
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-16 h-16 flex-shrink-0" role="img" aria-label={`${score}% compatibility`}>
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#F5F1EB" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={tone} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold leading-none text-text-primary">{score}</span>
        <span className="text-[9px] text-text-muted mt-0.5">match</span>
      </div>
    </div>
  );
}

// The bold moment for this page: the single strongest match, given real space
// and its reasoning exposed. Everything below it stays quiet by comparison.
function LeadMatch({ person }) {
  return (
    <Link
      to={`/roommates/${person.id}`}
      className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2 rounded-2xl"
    >
      <div className="border-2 border-brand-coral/25 bg-white rounded-2xl overflow-hidden transition-shadow group-hover:shadow-hover">
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-56 h-48 sm:h-auto bg-surface-muted flex items-center justify-center flex-shrink-0">
            <UserAvatar src={person.profile_image} name={person.name} size="xl" />
          </div>
          <div className="p-5 flex-1 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-text-primary truncate">{person.name}</h3>
                <p className="text-sm text-text-secondary mt-0.5 truncate">
                  {[person.occupation, person.city].filter(Boolean).join(' in ') || 'Profile not filled in yet'}
                </p>
              </div>
              <ScoreRing score={person.score} />
            </div>

            {person.bio && (
              <p className="text-sm text-text-secondary mt-3 leading-relaxed line-clamp-2">{person.bio}</p>
            )}

            <div className="flex flex-wrap gap-1.5 mt-4">
              {(person.reasons || []).map((r, i) => (
                <Badge key={i} variant="success">{r.text}</Badge>
              ))}
            </div>

            {person.breakdown && (
              <dl className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-2 mt-4 pt-4 border-t border-surface-border">
                {Object.entries(person.breakdown).map(([key, val]) => (
                  <div key={key}>
                    <dt className="text-[10px] text-text-muted">{BREAKDOWN_LABELS[key] || key}</dt>
                    <dd className="text-sm font-semibold text-text-primary">{val}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-brand-coral">
              View full profile
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function MatchRow({ person }) {
  return (
    <Link
      to={`/roommates/${person.id}`}
      className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
    >
      <div className="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
        <UserAvatar src={person.profile_image} name={person.name} size="md" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text-primary text-sm truncate">{person.name}</p>
        <p className="text-xs text-text-muted truncate">
          {[person.occupation, person.city].filter(Boolean).join(' in ') || 'Profile not filled in yet'}
        </p>
      </div>
      <span className="text-sm font-bold text-text-primary flex-shrink-0">{person.score}%</span>
      <ChevronRight size={16} className="text-text-muted flex-shrink-0" />
    </Link>
  );
}

function CommunityCard({ community }) {
  return (
    <Link to={`/communities/${community.id}`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-xl">
      <div className="h-28 rounded-xl bg-surface-muted overflow-hidden mb-3">
        {community.image ? (
          <img src={community.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users size={26} className="text-brand-teal/40" />
          </div>
        )}
      </div>
      <Badge variant="teal" className="mb-1.5">{community.category}</Badge>
      <h4 className="font-semibold text-text-primary text-sm group-hover:text-brand-teal transition-colors truncate">
        {community.name}
      </h4>
      <p className="text-xs text-text-muted mt-1 line-clamp-2">{community.description}</p>
      <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
        <span className="flex items-center gap-1"><Users size={11} />{community.member_count}</span>
        {community.city && <span className="flex items-center gap-1"><MapPin size={11} />{community.city}</span>}
      </div>
    </Link>
  );
}

function EventRow({ event }) {
  const date = new Date(event.start_time);
  const time = t => new Date(t).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  return (
    <Link
      // There is no per-event page, and the catch-all route silently redirected these
      // to /discover, so an event link looked like it worked and went nowhere
      // useful. A row run by a community belongs to that community.
      to={event.community_id ? `/communities/${event.community_id}` : '/events'}
      className="flex items-center gap-4 py-3 border-b border-surface-border last:border-0 hover:bg-surface-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral -mx-2 px-2 rounded-lg"
    >
      <div className="w-12 text-center flex-shrink-0">
        <div className="text-xs font-semibold text-brand-coral uppercase">
          {date.toLocaleDateString('en', { month: 'short' })}
        </div>
        <div className="text-xl font-bold text-text-primary leading-none">{date.getDate()}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-text-primary text-sm truncate">{event.title}</p>
        <p className="text-xs text-text-muted truncate flex items-center gap-2 mt-0.5">
          {event.location && <span className="flex items-center gap-1"><MapPin size={10} />{event.location}</span>}
          <span className="flex items-center gap-1">
            <Clock size={10} />{time(event.start_time)}{event.end_time ? ` – ${time(event.end_time)}` : ''}
          </span>
        </p>
      </div>
    </Link>
  );
}

// The row toggles, the guide link is a separate target. Nested interactive
// elements inside a <button> are invalid HTML and break keyboard use, so this
// is a flex row with a real button, not a button with a link in it.
function SettlementTask({ task, onToggle }) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        task.completed
          ? 'bg-status-success/5 border-status-success/20'
          : 'bg-white border-surface-border hover:border-brand-coral/40'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-pressed={task.completed}
        className="flex items-center gap-3 flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral rounded-lg"
      >
        <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
          task.completed ? 'bg-status-success text-white' : 'border-2 border-surface-border'
        }`}>
          {task.completed && <CheckCircle2 size={12} />}
        </span>
        <span className={`text-sm truncate ${task.completed ? 'text-text-muted line-through' : 'text-text-primary'}`}>
          {task.title}
        </span>
      </button>
      {task.url && (
        <a
          href={task.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 flex-shrink-0 text-xs font-semibold text-brand-teal hover:underline"
        >
          Guide
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

export default function DiscoverPage() {
  const { data, setData, loading, error, retry } = useAsync(() => apiFetch('/discover'), []);
  const [search, setSearch] = useState('');
  const [taskError, setTaskError] = useState(null);

  const toggleTask = async (task) => {
    const next = !task.completed;
    setTaskError(null);
    setData(prev => ({
      ...prev,
      settlement: {
        ...prev.settlement,
        tasks: prev.settlement.tasks.map(t => (t.id === task.id ? { ...t, completed: next } : t)),
        completed: prev.settlement.completed + (next ? 1 : -1),
      },
    }));
    try {
      await apiFetch(`/settlement/${task.id}/${next ? 'complete' : 'uncomplete'}`, { method: 'POST' });
    } catch (err) {
      setData(prev => ({
        ...prev,
        settlement: {
          ...prev.settlement,
          tasks: prev.settlement.tasks.map(t => (t.id === task.id ? { ...t, completed: task.completed } : t)),
          completed: prev.settlement.completed + (next ? -1 : 1),
        },
      }));
      setTaskError(err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
          <div className="skeleton h-52 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 pt-16">
          <ErrorState what="matches" error={error} onRetry={retry} />
        </div>
      </Layout>
    );
  }

  const user = data?.user || {};
  const cities = data?.cities || [];
  const settlement = data?.settlement || { tasks: [], completed: 0, total: 0 };

  const q = search.trim().toLowerCase();
  const has = (...fields) => fields.some(f => typeof f === 'string' && f.toLowerCase().includes(q));
  const roommates = (data?.roommates || []).filter(r => !q || has(r.name, r.occupation, r.city));
  const communities = (data?.communities || []).filter(c => !q || has(c.name, c.description, c.city, c.category));
  const events = (data?.events || []).filter(e => !q || has(e.title, e.location, e.city, e.community_name));
  const noResults = q && !roommates.length && !communities.length && !events.length;

  // Only ever a city the user actually said. Falling back to cities[0] put the
// first city alphabetically under "Where you're headed" for anyone who had not
// finished onboarding.
  const destinationName = user.moving_to || user.city || null;
  const cityInfo = destinationName
    ? cities.find(c => c.name === destinationName) || null
    : null;
  const [lead, ...restMatches] = roommates;
  const progress = settlement.total ? Math.round((settlement.completed / settlement.total) * 100) : 0;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-24">
        <PageReveal>

          {/* ── Header ─────────────────────────────────────────────
              No gradient wash and no ALL-CAPS eyebrow. The boldness
              budget is spent on the lead match instead. */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
                {user.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Welcome back'}
              </h1>
              <p className="text-text-secondary text-sm mt-1">
                {settlement.total > 0
                  ? `${settlement.completed} of ${settlement.total} settling-in steps done`
                  : 'Pick up where you left off'}
              </p>
            </div>
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search matches, events"
                aria-label="Search matches, communities and events"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-surface-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/25"
              />
            </div>
          </div>

          {noResults ? (
            <EmptyState
              icon={Search}
              title={`Nothing matched "${search.trim()}"`}
              description="Try a city, a name, or an interest instead."
              action={
                <Button onClick={() => setSearch('')} variant="secondary">Clear search</Button>
              }
            />
          ) : (
            <div className="space-y-10">

              {/* ── Matches: real hierarchy, not five identical cards ── */}
              <section aria-labelledby="matches-heading">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 id="matches-heading" className="text-lg font-bold text-text-primary">Your matches</h2>
                  <Link to="/roommates" className="text-sm font-semibold text-brand-coral hover:underline">
                    See all
                  </Link>
                </div>

                {roommates.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No matches yet"
                    description="Fill in your budget and lifestyle on your profile and we'll start ranking people for you."
                    action={<ButtonLink to="/edit-profile">Complete your profile</ButtonLink>}
                  />
                ) : (
                  <div className="space-y-4">
                    {lead && <LeadMatch person={lead} />}
                    {restMatches.length > 0 && (
                      <div className="divide-y divide-surface-border">
                        {restMatches.map(p => <MatchRow key={p.id} person={p} />)}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── City + Settle in: quiet two-column ──────────────── */}
              <div className="grid gap-6 lg:grid-cols-5">
                {cityInfo && (
                  <section className="lg:col-span-2" aria-labelledby="city-heading">
                    <h2 id="city-heading" className="text-lg font-bold text-text-primary mb-3">Where you're headed</h2>
                    <Card className="overflow-hidden h-full flex flex-col">
                      <div className="relative h-28 flex-shrink-0">
                        {cityInfo.image ? (
                          <img src={cityInfo.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-surface-muted flex items-center justify-center">
                            <Globe size={32} className="text-brand-teal/30" />
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <h3 className="font-bold text-text-primary flex items-center gap-1.5">
                          <MapPin size={14} className="text-brand-teal" />
                          {cityInfo.name}
                        </h3>
                        <p className="text-xs text-text-muted mt-1.5 line-clamp-3 flex-1">
                          {cityInfo.description}
                        </p>
                        <dl className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-surface-border">
                          <div>
                            <dt className="text-[10px] text-text-muted">Cost level</dt>
                            <dd className={`text-sm font-bold ${costColor[cityInfo.cost_level] || 'text-text-primary'}`}>
                              {costLabel[cityInfo.cost_level] || '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] text-text-muted">Top matches</dt>
                            <dd className="text-sm font-bold text-text-primary">{roommates.length}</dd>
                          </div>
                        </dl>
                        <Link
                          to="/settle"
                          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
                        >
                          Guide for {cityInfo.name} <ArrowRight size={14} />
                        </Link>
                      </div>
                    </Card>
                  </section>
                )}

                {!cityInfo && (
                  <section className="lg:col-span-2" aria-labelledby="city-heading">
                    <h2 id="city-heading" className="text-lg font-bold text-text-primary mb-3">Where you're headed</h2>
                    <Card className="p-5 h-full flex flex-col items-center text-center">
                      <MapPin size={28} className="text-brand-teal/40 mb-3" />
                      <p className="text-sm text-text-primary font-semibold">You have not picked a city yet</p>
                      <p className="text-xs text-text-muted mt-1.5">
                        Choose where you are moving and your checklist, guides and nearby people follow that
                        instead of a default.
                      </p>
                      <Link
                        to="/profile"
                        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-teal hover:underline"
                      >
                        Set your destination <ArrowRight size={14} />
                      </Link>
                    </Card>
                  </section>
                )}

                <section className="lg:col-span-3" aria-labelledby="settle-heading">
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 id="settle-heading" className="text-lg font-bold text-text-primary">Settle in</h2>
                    <Link to="/settle" className="text-sm font-semibold text-brand-teal hover:underline">
                      Full checklist
                    </Link>
                  </div>
                  <Card className="p-4">
                    <InlineError error={taskError} />
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-status-success rounded-full transition-[width] duration-500"
                          style={{ width: `${progress}%` }}
                          role="progressbar"
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="Settling in progress"
                        />
                      </div>
                      <span className="text-sm font-bold text-text-primary flex-shrink-0">{progress}%</span>
                    </div>
                    {settlement.tasks.length === 0 ? (
                      <p className="text-text-muted text-sm py-4 text-center">
                        Finish onboarding to get your checklist.
                      </p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {settlement.tasks.slice(0, 6).map(task => (
                          <SettlementTask key={task.id} task={task} onToggle={toggleTask} />
                        ))}
                      </div>
                    )}
                  </Card>
                </section>
              </div>

              {/* ── Events: a list, because they're time-ordered ────── */}
              {events.length > 0 && (
                <section aria-labelledby="events-heading">
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 id="events-heading" className="text-lg font-bold text-text-primary">Coming up</h2>
                    <Link to="/events" className="text-sm font-semibold text-brand-amber hover:underline">
                      All events
                    </Link>
                  </div>
                  <div className="bg-white rounded-2xl border border-surface-border px-4">
                    {events.slice(0, 4).map(e => <EventRow key={e.id} event={e} />)}
                  </div>
                </section>
              )}

              {/* ── Communities: asymmetric, not a stock 3-up grid ─── */}
              {communities.length > 0 && (
                <section aria-labelledby="communities-heading">
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 id="communities-heading" className="text-lg font-bold text-text-primary">Communities</h2>
                    <Link to="/communities" className="text-sm font-semibold text-brand-teal hover:underline">
                      All communities
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6">
                    {communities.slice(0, 4).map((c, i) => (
                      <div key={c.id} className={i === 0 ? 'col-span-2 md:col-span-2' : ''}>
                        <CommunityCard community={c} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>
          )}
        </PageReveal>
      </div>
    </Layout>
  );
}