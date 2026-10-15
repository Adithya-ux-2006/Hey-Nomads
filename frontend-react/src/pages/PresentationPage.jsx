import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Heart, MapPin, MessageCircle,
  RotateCcw, Users,
} from 'lucide-react';
import {
  Badge, Button, Card, CompatibilityBadge, EmptyState, ErrorState,
  InlineError, Spinner,
} from '../components/UI';
import UserAvatar from '../components/UserAvatar';
import {
  beginPresentation, candidate, chat as loadThread, discover, endSession,
  like as sendLike, matches as loadMatches, send, sessionUser,
} from '../lib/presentation';

// The guided walkthrough the competition judges see. It runs on four synthetic
// profiles the page builds through the product's own registration, onboarding
// and profile endpoints - there is no seeding surface behind it - and on the
// same scorer, match rules and conversation rows a real pair produces.
//
// It is a presentation, not a second product: one column, the product's own
// components and tokens, no developer controls and nothing that reveals how the
// demo is wired.

const PHASES = [
  { key: 'intro', label: 'Intro' },
  { key: 'discover', label: 'Discover' },
  { key: 'match', label: 'Match' },
  { key: 'chat', label: 'Messages' },
];

const phaseOfStep = {
  intro: 'intro',
  discover: 'discover',
  profile: 'discover',
  match: 'match',
  matches: 'chat',
  chat: 'chat',
};

const WALKTHROUGH = [
  { title: 'Discover', body: 'Candidates ranked by the live compatibility engine, with the reasons scored.' },
  { title: 'Profile', body: 'Open one, read the breakdown, and decide with the full picture in front of you.' },
  { title: 'Mutual match', body: 'A like is answered back on the spot, so the match lands the way it would in life.' },
  { title: 'First message', body: 'The thread opens with an opener already in it, ready for a real conversation.' },
];

// The fixture stores the DB enums verbatim; judges read prose, not constraints.
const LABELS = {
  sleep_time: { early: 'Early bird', late: 'Night owl', flexible: 'Flexible' },
  noise_tolerance: { quiet: 'Quiet', moderate: 'Moderate', loud: 'Loud' },
  diet: { veg: 'Vegetarian', nonveg: 'Non-veg', eggetarian: 'Eggetarian', vegan: 'Vegan' },
  work_schedule: { regular: 'Regular hours', remote: 'Remote', flexible: 'Flexible shifts', night: 'Night shifts' },
};
const label = (field, value) => (value ? LABELS[field][value] || value : null);

const lifestyleOf = p => [
  ['Budget', p.budget ? `£${Number(p.budget).toLocaleString()} / month` : null],
  ['Move-in', p.move_in_date ? new Date(p.move_in_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null],
  ['Cleanliness', p.cleanliness ? `${p.cleanliness} of 5` : null],
  ['Sleeps', label('sleep_time', p.sleep_time)],
  ['Noise', label('noise_tolerance', p.noise_tolerance)],
  ['Diet', label('diet', p.diet)],
  ['Smoking', p.smoking === 'no' ? 'Non-smoker' : p.smoking === 'yes' ? 'Smoker' : null],
  ['Drinking', p.drinking === 'no' ? 'Does not drink' : p.drinking === 'yes' ? 'Drinks' : null],
  ['Work', label('work_schedule', p.work_schedule)],
  ['Pets', p.pets === 'no' ? 'No pets' : p.pets === 'okay' ? 'Open to pets' : p.pets === 'yes' ? 'Has pets' : null],
].filter(([, v]) => v);

function Header({ step, visited, onJump, onRestart, started, onExit }) {
  const activeIndex = PHASES.findIndex(p => p.key === phaseOfStep[step]);
  const active = PHASES[Math.max(0, activeIndex)];

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-surface-border">
      <div className="max-w-4xl mx-auto px-5 h-16 flex items-center gap-4">
        <span className="font-display font-bold text-text-primary whitespace-nowrap">
          Hey Nomads
        </span>
        <Badge variant="teal" className="hidden md:inline-flex whitespace-nowrap">
          Live walkthrough
        </Badge>

        {/* The full rail only has room once the viewport does; below that the
            current step still has to be readable, so it collapses to a count. */}
        <nav aria-label="Walkthrough progress" className="ml-auto hidden lg:flex items-center gap-1">
          {PHASES.map((p, i) => {
            const done = visited[p.key];
            const current = i === activeIndex;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => done && onJump(p.key)}
                disabled={!done}
                aria-current={current ? 'step' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                  ${current ? 'bg-brand-teal text-white' : done ? 'text-text-secondary hover:bg-surface-muted' : 'text-text-light cursor-default'}`}
              >
                <span aria-hidden="true">{i + 1}</span>
                {p.label}
              </button>
            );
          })}
        </nav>
        <span className="ml-auto lg:hidden text-xs font-semibold text-text-muted whitespace-nowrap">
          {activeIndex + 1} of {PHASES.length} · {active.label}
        </span>

        <div className="flex items-center gap-2 flex-shrink-0">
          {started && (
            <Button variant="ghost" size="sm" onClick={onRestart} aria-label="Restart the walkthrough">
              <RotateCcw size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Restart</span>
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onExit}>Exit</Button>
        </div>
      </div>
    </header>
  );
}

function Intro({ onStart, busy, error }) {
  return (
    <div className="pt-6 pb-4">
      <Badge variant="coral">Product walkthrough</Badge>
      <h1 className="mt-4 text-3xl sm:text-4xl font-display font-bold text-text-primary leading-tight">
        Find a flatmate you can actually live with.
      </h1>
      <p className="mt-4 text-base sm:text-lg text-text-secondary leading-relaxed">
        A guided run through Hey Nomads: a ranked feed, a live compatibility score with its
        reasoning shown, a mutual match, and a first message. The same matching engine scores
        this walkthrough as it scores every real account.
      </p>

      <ol className="mt-8 space-y-3">
        {WALKTHROUGH.map((s, i) => (
          <li key={s.title}>
            <Card className="p-4">
              <div className="flex items-start gap-4">
                <span className="w-9 h-9 flex-shrink-0 rounded-full bg-brand-teal text-white flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-text-primary">{s.title}</h2>
                  <p className="text-sm text-text-secondary mt-1">{s.body}</p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-3">
        <InlineError error={error} />
        <Button size="lg" onClick={onStart} disabled={busy} className="w-full sm:w-auto sm:self-start">
          {busy ? (
            <><Spinner size="sm" /> Preparing the walkthrough…</>
          ) : (
            <>Start the walkthrough <ArrowRight size={17} aria-hidden="true" /></>
          )}
        </Button>
      </div>

      <p className="mt-6 text-xs text-text-muted leading-relaxed">
        Four synthetic profiles, built through normal sign-up. Real matching, real threads —
        nothing here is written to a real account, and nothing from the product’s own
        sign-in or registration changes.
      </p>
    </div>
  );
}

function DiscoverStep({ people, busy, error, onOpen, onRetry, onRestart }) {
  if (busy && people.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <Spinner size="lg" />
        <p className="text-sm text-text-muted">Scoring candidates…</p>
      </div>
    );
  }
  if (error && people.length === 0) {
    return <ErrorState what="candidates" error={error} onRetry={onRetry} />;
  }
  if (people.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="You have met everyone"
        description="That is the whole cohort. Restart the walkthrough to run it again from the top."
        action={<Button onClick={onRestart}><RotateCcw size={15} aria-hidden="true" /> Restart</Button>}
      />
    );
  }

  return (
    <div className="pt-2 pb-4">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Discover</h1>
          <p className="text-sm text-text-secondary mt-1">
            Ranked by how well they fit your budget, city and habits.
          </p>
        </div>
        <span className="text-xs font-semibold text-text-muted tabular-nums">
          {people.length} remaining
        </span>
      </div>

      <InlineError error={error} onRetry={onRetry} />

      <ul className="space-y-3">
        {people.map(p => (
          <li key={p.id}>
            <Card interactive className="p-4">
              <div className="flex items-start gap-4">
                <UserAvatar src={p.profile_image} name={p.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-text-primary truncate">
                        {p.name}{p.age ? <span className="text-text-muted font-normal">, {p.age}</span> : null}
                      </h2>
                      <p className="text-sm text-text-secondary truncate">
                        {[p.occupation, p.city].filter(Boolean).join(' in ') || 'Profile not filled in yet'}
                      </p>
                    </div>
                    <CompatibilityBadge score={p.score} size="md" />
                  </div>

                  {p.bio && <p className="text-sm text-text-secondary mt-2 line-clamp-2">{p.bio}</p>}

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(p.reasons || []).slice(0, 3).map((r, i) => (
                      <Badge key={i} variant="success">{r.text}</Badge>
                    ))}
                    {(p.reasons || []).length === 0 && (
                      <Badge variant="muted">A few things still differ</Badge>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 -ml-2"
                    onClick={() => onOpen(p)}
                    aria-label={`View ${p.name}'s profile`}
                  >
                    View profile <ArrowRight size={15} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfileStep({ person, busy, error, onBack, onLike, onPass, liked }) {
  if (error && !person) return <ErrorState what="profile" error={error} onRetry={onBack} />;
  if (!person) {
    return (
      <div className="flex justify-center py-24"><Spinner size="lg" /></div>
    );
  }

  // Six reasons make the case; the rest are a wall of identical green pills that
  // flatten the hierarchy rather than strengthen the argument.
  const reasons = person.reasons || [];
  const shown = reasons.slice(0, 6);
  const hidden = reasons.length - shown.length;

  return (
    <div className="pt-2 pb-4">
      <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={onBack}>
        <ArrowLeft size={15} aria-hidden="true" /> Discover
      </Button>

      <div className="flex items-start gap-4">
        <UserAvatar src={person.profile_image} name={person.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-text-primary">
                {person.name}{person.age ? <span className="text-text-muted font-normal">, {person.age}</span> : null}
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                {[person.occupation, person.city].filter(Boolean).join(' in ') || 'Profile not filled in yet'}
              </p>
              {person.moving_to && (
                <p className="flex items-center gap-1.5 text-sm text-text-muted mt-1">
                  <MapPin size={14} aria-hidden="true" /> Moving to {person.moving_to}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              <CompatibilityBadge score={person.score} size="md" />
            </div>
          </div>
        </div>
      </div>

      {person.bio && <p className="mt-5 text-sm text-text-secondary leading-relaxed">{person.bio}</p>}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-text-primary">Why you match</h2>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {shown.map((r, i) => (
            <Badge key={i} variant={r.type === 'negative' ? 'muted' : 'success'}>{r.text}</Badge>
          ))}
          {hidden > 0 && <Badge variant="muted">+{hidden} more</Badge>}
          {reasons.length === 0 && (
            <Badge variant="muted">Nothing lines up yet — this one is a long shot.</Badge>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-text-primary">The details</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mt-2">
          {lifestyleOf(person).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">{label}</dt>
              <dd className="text-sm font-semibold text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {(person.interests || []).length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-text-primary">Interests</h2>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {person.interests.map(i => <Badge key={i} variant="muted" className="capitalize">{i}</Badge>)}
          </div>
        </section>
      )}

      <InlineError error={error} />

      <div className="mt-8 flex flex-wrap gap-3">
        {liked ? (
          <Button disabled><CheckCircle2 size={17} aria-hidden="true" /> Liked</Button>
        ) : (
          <>
            <Button size="lg" onClick={onLike} disabled={busy} aria-label={`Like ${person.name}`}>
              <Heart size={17} aria-hidden="true" /> Like
            </Button>
            <Button variant="secondary" size="lg" onClick={onPass} disabled={busy}>Pass</Button>
          </>
        )}
      </div>
    </div>
  );
}

function MatchStep({ outcome, busy, onSeeMatches, onKeepBrowsing }) {
  // This is the moment the whole walkthrough builds to. Left at the top of an
  // empty page it reads as a loading state, so it holds the screen.
  return (
    <div className="min-h-[72vh] flex flex-col items-center justify-center text-center py-10">
      <div className="w-20 h-20 rounded-full bg-brand-teal/10 flex items-center justify-center">
        <CheckCircle2 size={40} className="text-brand-teal" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-2xl sm:text-3xl font-display font-bold text-text-primary">
        You matched with {outcome?.name || 'your candidate'}
      </h1>
      <p className="mt-2 text-sm text-text-secondary max-w-md">
        {outcome?.score != null
          ? `${outcome.score}% compatible. The score came from the same engine that ranks every feed.`
          : 'They liked you back, and the conversation is open.'}
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Button size="lg" onClick={onSeeMatches} disabled={busy}>
          See your matches <ArrowRight size={17} aria-hidden="true" />
        </Button>
        <Button variant="secondary" size="lg" onClick={onKeepBrowsing} disabled={busy}>
          Keep browsing
        </Button>
      </div>
    </div>
  );
}

function MatchesStep({ rows, busy, error, onOpen, onBack, onRetry }) {
  if (busy && rows.length === 0) {
    return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  }
  if (error && rows.length === 0) return <ErrorState what="matches" error={error} onRetry={onRetry} />;

  return (
    <div className="pt-2 pb-4">
      <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={onBack}>
        <ArrowLeft size={15} aria-hidden="true" /> Discover
      </Button>
      <h1 className="text-2xl font-display font-bold text-text-primary">Matches</h1>
      <p className="text-sm text-text-secondary mt-1 mb-5">
        People who liked you back. Open one to start talking.
      </p>

      <InlineError error={error} onRetry={onRetry} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No matches yet"
          description="Like a few candidates in Discover and the ones who like you back land here."
          action={<Button onClick={onBack}>Back to Discover</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map(m => (
            <li key={m.id}>
              <Card interactive className="p-3">
                <div className="flex items-center gap-4">
                  <UserAvatar src={m.partner_image} name={m.partner_name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary truncate">{m.partner_name}</p>
                    <p className="text-xs text-text-muted truncate">
                      {[m.partner_occupation, m.partner_city].filter(Boolean).join(' in ')}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-text-primary tabular-nums">
                    {m.compatibility_score}%
                  </span>
                  <Button
                    size="sm"
                    onClick={() => onOpen(m)}
                    aria-label={`Message ${m.partner_name}`}
                  >
                    <MessageCircle size={15} aria-hidden="true" /> Message
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatStep({ peer, messages, busy, error, draft, onDraft, onSend, onBack, onRetry }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (error && !peer) return <ErrorState what="messages" error={error} onRetry={onBack} />;

  return (
    // 4rem sticky header + 0.5rem top pad + 4rem main bottom pad.
    <div className="pt-2 pb-4 flex flex-col h-[calc(100dvh-8.5rem)]">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> Matches
        </Button>
        <UserAvatar src={peer?.image} name={peer?.name || ''} size="sm" />
        <div className="min-w-0">
          <p className="font-semibold text-text-primary truncate">{peer?.name || 'Conversation'}</p>
          <p className="text-xs text-text-muted truncate">
            {[peer?.occupation, peer?.city].filter(Boolean).join(' in ')}
          </p>
        </div>
      </div>

      <InlineError error={error} onRetry={onRetry} />

      {/* Anchored to the bottom like every conversation people actually use:
          a two-message thread pinned under the header reads as a layout bug. */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex min-h-full flex-col justify-end space-y-2 py-2">
          {busy && messages.length === 0 && (
            <div className="flex justify-center py-10"><Spinner /></div>
          )}
          {!busy && messages.length === 0 && (
            <p className="text-sm text-text-muted text-center py-10">No messages yet.</p>
          )}
          {messages.map(m => {
            const mine = peer?.meId != null && Number(m.sender_id) === Number(peer.meId);
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                    mine ? 'bg-brand-coral text-white rounded-br-md' : 'bg-white border border-surface-border text-text-primary rounded-bl-md'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={e => { e.preventDefault(); onSend(); }}
      >
        <label htmlFor="pres-draft" className="sr-only">Message</label>
        <input
          id="pres-draft"
          value={draft}
          onChange={e => onDraft(e.target.value)}
          placeholder={`Message ${peer?.name || ''}`.trim()}
          maxLength={2000}
          className="flex-1 min-w-0 px-4 py-3 rounded-full bg-white border border-surface-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg"
        />
        <Button type="submit" disabled={busy || !draft.trim()} aria-label="Send message">
          Send
        </Button>
      </form>
    </div>
  );
}

export default function PresentationPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState('intro');
  const [visited, setVisited] = useState({ intro: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [me, setMe] = useState(() => sessionUser());

  const [people, setPeople] = useState([]);
  const [person, setPerson] = useState(null);
  const [liked, setLiked] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [rows, setRows] = useState([]);
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');

  const mark = phase => setVisited(v => ({ ...v, [phase]: true }));
  const jump = phase => {
    const target = { intro: 'intro', discover: 'discover', match: 'match', chat: 'matches' }[phase];
    if (target) { setStep(target); setError(null); }
  };

  // Every call funnels through here so an expired or rejected presentation
  // token never strands the presenter on a broken screen.
  const run = async fn => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        endSession();
        setMe(null);
        setVisited({ intro: true });
        setStep('intro');
        setError(new Error('That session ended. Start the walkthrough again.'));
      } else {
        setError(err);
      }
      return null;
    } finally {
      setBusy(false);
    }
  };

  const loadFeed = async () => {
    const cards = await run(discover);
    if (cards) setPeople(cards);
    return cards;
  };

  const start = async () => {
    const user = await run(beginPresentation);
    if (!user) return;
    setMe(user);
    setPeople([]);
    setPerson(null);
    setLiked(false);
    setOutcome(null);
    setRows([]);
    setPeer(null);
    setMessages([]);
    mark('discover');
    setStep('discover');
    await loadFeed();
  };

  const restart = async () => {
    setVisited({ intro: true });
    setStep('intro');
    await start();
  };

  const openProfile = async p => {
    setPerson(null);
    setLiked(false);
    mark('discover');
    setStep('profile');
    const detail = await run(() => candidate(p.id));
    if (detail) { setPerson(detail); setLiked(Boolean(detail.my_action === 'like' || detail.is_match)); }
  };

  const decide = async action => {
    if (!person) return;
    const res = await run(() => sendLike(person.id, action));
    if (!res) return;
    if (action === 'pass') {
      setPerson(null);
      setStep('discover');
      await loadFeed();
      return;
    }
    setLiked(true);
    setOutcome({ name: person.name, score: person.score, matched: Boolean(res.matchCreated) });
    mark('match');
    setStep('match');
  };

  const openMatches = async () => {
    mark('chat');
    setStep('matches');
    const list = await run(loadMatches);
    if (list) setRows(list);
  };

  const openChat = async m => {
    setPeer({
      id: m.partner_id, name: m.partner_name, image: m.partner_image,
      city: m.partner_city, occupation: m.partner_occupation, meId: me?.id,
    });
    setMessages([]);
    setDraft('');
    setStep('chat');
    const list = await run(() => loadThread(m.partner_id));
    if (list) setMessages(list);
  };

  const sendDraft = async () => {
    const text = draft.trim();
    if (!text || !peer) return;
    setDraft('');
    const created = await run(() => send(peer.id, text));
    if (!created) return;
    setMessages(m => [...m, {
      id: created.id, sender_id: me?.id, content: created.content, created_at: created.created_at,
    }]);
  };

  const reloadChat = async () => {
    if (!peer) return;
    const list = await run(() => loadThread(peer.id));
    if (list) setMessages(list);
  };

  return (
    <div className="min-h-screen bg-surface-bg">
      <Header
        step={step}
        visited={visited}
        onJump={jump}
        onRestart={restart}
        started={step !== 'intro'}
        onExit={() => navigate('/')}
      />

      <main className="max-w-3xl mx-auto px-5 pb-16">
        <div aria-live="polite" className="sr-only">{step}</div>

        {step === 'intro' && (
          <Intro onStart={start} busy={busy} error={error} />
        )}

        {step === 'discover' && (
          <DiscoverStep
            people={people}
            busy={busy}
            error={error}
            onOpen={openProfile}
            onRetry={loadFeed}
            onRestart={restart}
          />
        )}

        {step === 'profile' && (
          <ProfileStep
            person={person}
            busy={busy}
            error={error}
            liked={liked}
            onBack={async () => { setPerson(null); setStep('discover'); await loadFeed(); }}
            onLike={() => decide('like')}
            onPass={() => decide('pass')}
          />
        )}

        {step === 'match' && (
          <MatchStep
            outcome={outcome}
            busy={busy}
            onSeeMatches={openMatches}
            onKeepBrowsing={async () => { setStep('discover'); await loadFeed(); }}
          />
        )}

        {step === 'matches' && (
          <MatchesStep
            rows={rows}
            busy={busy}
            error={error}
            onOpen={openChat}
            onBack={async () => { setStep('discover'); await loadFeed(); }}
            onRetry={openMatches}
          />
        )}

        {step === 'chat' && (
          <ChatStep
            peer={peer}
            messages={messages}
            busy={busy}
            error={error}
            draft={draft}
            onDraft={setDraft}
            onSend={sendDraft}
            onBack={() => setStep('matches')}
            onRetry={reloadChat}
          />
        )}
      </main>
    </div>
  );
}
