import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Check, CircleSlash, Scale, FileText, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { apiFetch } from '../lib/api';
import Layout from '../components/Layout';
import { Card, Button, Spinner, ErrorState, InlineError, SectionHeader } from '../components/UI';

// Design notes, because these choices are deliberate:
// - Utility surface. Restrained, near-invisible motion; nothing ambient.
// - Every state is designed: loading, empty with a path forward, error with
//   recovery, disabled with a reason, and success only after the server
//   confirms it. Nothing reports "saved" optimistically.
// - Option rows are 44pt-tall and real buttons, so the whole set is keyboard
//   operable and has a visible focus ring.
// - Scroll stays plain. This is a form, and scroll-driven choreography would
//   fight the task rather than help it.
// - One accent does the pointing (coral). Teal is functional/success only.

function ProgressBar({ answered, total }) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="space-y-2" role="group" aria-label={`${answered} of ${total} answered`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-text-primary">
          {answered} of {total} answered
        </span>
        <span className="text-sm tabular-nums text-text-secondary">{pct}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label="Living DNA completion"
      >
        <div
          className="h-full rounded-full bg-brand-coral transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function OptionRow({ option, selected, isBoundary, onSelect, onToggleBoundary }) {
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => onSelect(option)}
        aria-pressed={selected}
        className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-card border px-4 py-3 text-left text-sm transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-coral ${
          selected
            ? 'border-brand-coral bg-brand-coral/5 text-text-primary'
            : 'border-surface-border bg-surface-card text-text-secondary hover:border-brand-coral/40 hover:bg-surface-bg'
        }`}
      >
        <span>{option}</span>
        {selected && <Check size={16} className="shrink-0 text-brand-coral" aria-hidden="true" />}
      </button>
      {selected && (
        <button
          type="button"
          onClick={() => onToggleBoundary(!isBoundary)}
          aria-pressed={isBoundary}
          className={`flex min-h-[44px] items-center gap-2 self-start rounded-pill border px-3 text-xs transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-coral ${
            isBoundary
              ? 'border-brand-teal bg-brand-teal/10 text-brand-teal-dark'
              : 'border-surface-border text-text-muted hover:border-brand-teal/50'
          }`}
          title="A boundary is a hard line you need them to know about"
        >
          <Lock size={12} aria-hidden="true" />
          {isBoundary ? 'Non-negotiable' : 'Mark as non-negotiable'}
        </button>
      )}
    </div>
  );
}

export default function LivingDnaPage() {
  const [params] = useSearchParams();
  const partnerId = params.get('with');

  const [questions, setQuestions] = useState(null);
  const [mine, setMine] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [tab, setTab] = useState(partnerId ? 'compare' : 'answers');
  const [cursor, setCursor] = useState(0);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [qs, me] = await Promise.all([
        apiFetch('/living-dna/questions'),
        apiFetch('/living-dna/me'),
      ]);
      setQuestions(Array.isArray(qs) ? qs : []);
      setMine(me);
    } catch (err) {
      setLoadError(err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const answers = useMemo(() => {
    const m = new Map();
    for (const a of mine?.answers || []) m.set(a.question_id, a);
    return m;
  }, [mine]);

  const current = questions && questions.length ? questions[Math.min(cursor, questions.length - 1)] : null;

  const pick = async (option) => {
    if (!current) return;
    const prev = answers.get(current.id);
    const isBoundary = prev ? prev.is_boundary : false;
    // Optimistic only for the single row the user just tapped; the saved banner
    // still waits for the server.
    answers.set(current.id, { question_id: current.id, option, is_boundary: isBoundary });
    setMine((m) => ({ ...m, answers: [...answers.values()] }));
    await persist([{ question_id: current.id, option, is_boundary: isBoundary }]);
  };

  const toggleBoundary = async (isBoundary) => {
    if (!current) return;
    const prev = answers.get(current.id);
    if (!prev) return;
    answers.set(current.id, { ...prev, is_boundary: isBoundary });
    setMine((m) => ({ ...m, answers: [...answers.values()] }));
    await persist([{ question_id: current.id, option: prev.option, is_boundary: isBoundary }]);
  };

  const persist = async (payload) => {
    setSaving(true);
    setSaveError(null);
    try {
      const r = await apiFetch('/living-dna/answers', { method: 'PUT', body: { answers: payload } });
      // Trust the server's count, not the optimistic one.
      setMine((m) => ({ ...m, answered: r.answered, total: r.total, complete: r.complete }));
      setSavedAt(new Date());
    } catch (err) {
      setSaveError(err);
      await load(); // resync: never leave the UI claiming a state the server rejected
    } finally {
      setSaving(false);
    }
  };

  const setSharing = async (patch) => {
    setSaveError(null);
    const next = { ...mine.sharing, ...patch };
    setMine((m) => ({ ...m, sharing: next }));
    try {
      await apiFetch('/living-dna/sharing', { method: 'PUT', body: next });
    } catch (err) {
      setSaveError(err);
      await load();
    }
  };

  if (loadError) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-6">
          <ErrorState what="Living DNA" error={loadError} onRetry={load} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
        <SectionHeader
          title="Living DNA"
          subtitle="How you actually live, so you can compare it honestly before moving in."
        />

        <nav className="mb-6 flex gap-1 rounded-pill bg-surface-muted p-1" aria-label="Living DNA sections">
          {[['answers', 'Your answers'], ['privacy', 'Privacy'], ...(partnerId ? [['compare', 'Compare'], ['constitution', 'Constitution']] : [])].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`min-h-[44px] flex-1 rounded-pill px-3 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-coral ${
                tab === id ? 'bg-surface-card text-text-primary shadow-card' : 'text-text-secondary hover:text-text-primary'
              }`}
            >{label}</button>
          ))}
        </nav>

        {tab === 'answers' && (
          !questions ? <Spinner size="lg" /> : questions.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-text-secondary">No questions have been published yet.</p>
            </Card>
          ) : (
            <div className="space-y-5">
              <Card className="p-5">
                <ProgressBar answered={mine?.answered || 0} total={questions.length} />
                <p className="mt-3 text-xs text-text-muted">
                  Answers save as you go. Leave and come back whenever — nothing is lost.
                </p>
              </Card>

              <InlineError error={saveError} />

              <Card className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {current.category}
                </p>
                <h2 className="mt-1.5 text-lg font-semibold leading-snug text-text-primary">
                  {current.prompt}
                </h2>
                <div className="mt-4 space-y-2">
                  {current.options.map(o => (
                    <OptionRow
                      key={o}
                      option={o}
                      selected={answers.get(current.id)?.option === o}
                      isBoundary={Boolean(answers.get(current.id)?.is_boundary)}
                      onSelect={pick}
                      onToggleBoundary={toggleBoundary}
                    />
                  ))}
                </div>
              </Card>

              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost" size="md" disabled={cursor === 0}
                  onClick={() => setCursor(c => Math.max(0, c - 1))}
                >
                  <ChevronLeft size={16} aria-hidden="true" /> Back
                </Button>
                <span className="text-xs text-text-muted" aria-live="polite">
                  {saving ? 'Saving…' : savedAt ? 'Saved' : null}
                </span>
                <Button
                  size="md" disabled={cursor >= questions.length - 1}
                  onClick={() => setCursor(c => Math.min(questions.length - 1, c + 1))}
                >
                  Next <ChevronRight size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
          )
        )}

        {tab === 'privacy' && mine && (
          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-teal" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-text-primary">Nothing is shared until you say so</h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                    Your answers stay private by default. Turning these on only makes them visible to a
                    roommate you have matched with — never to anyone browsing.
                  </p>
                </div>
              </div>
            </Card>

            {[
              { key: 'share_preferences', title: 'Share my everyday preferences',
                body: 'Things like cleaning habits, guests, quiet hours, shared costs.' },
              { key: 'share_boundaries', title: 'Share my non-negotiables',
                body: 'The answers you marked as hard lines. These are the most personal, so they are controlled separately.' },
            ].map(({ key, title, body }) => (
              <Card key={key} className="p-5">
                <label className="flex cursor-pointer items-start justify-between gap-4">
                  <span className="min-h-[44px]">
                    <span className="block font-medium text-text-primary">{title}</span>
                    <span className="mt-1 block text-sm text-text-secondary">{body}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(mine.sharing[key])}
                    onChange={e => setSharing({ [key]: e.target.checked })}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-surface-border text-brand-coral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-coral"
                  />
                </label>
              </Card>
            ))}

            <p className="text-xs leading-relaxed text-text-muted">
              Sharing preferences does <em>not</em> reveal your non-negotiables. Someone can see that you
              rotate the bins without ever seeing the one thing you said you cannot compromise on.
            </p>
          </div>
        )}

        {tab === 'compare' && partnerId && <ComparePanel partnerId={partnerId} onRetry={load} />}
        {tab === 'constitution' && partnerId && <ConstitutionPanel partnerId={partnerId} />}
      </div>
    </Layout>
  );
}

function ComparePanel({ partnerId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    apiFetch(`/living-dna/compare/${partnerId}`)
      .then(d => live && setData(d))
      .catch(e => live && setError(e));
    return () => { live = false; };
  }, [partnerId]);

  if (error) {
    const msg = error?.message || 'This comparison is not available.';
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <CircleSlash size={20} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-text-primary">Nothing to compare yet</h2>
            <p className="mt-1 text-sm text-text-secondary">{msg}</p>
            <p className="mt-2 text-xs text-text-muted">
              A comparison only opens once you have both matched and both chosen to share.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  if (!data) return <Spinner size="lg" />;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Scale size={20} className="mt-0.5 shrink-0 text-brand-coral" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-text-primary">
              {data.aligned} aligned · {data.different} worth discussing
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{data.note}</p>
          </div>
        </div>
      </Card>

      {data.pairs.filter(p => p.status === 'aligned' || p.status === 'different').map(p => (
        <Card key={p.slug} className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{p.category}</p>
          <h3 className="mt-1 text-sm font-medium text-text-primary">{p.prompt}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className={`rounded-card border p-3 ${p.status === 'aligned' ? 'border-brand-teal/40 bg-brand-teal/5' : 'border-surface-border bg-surface-bg'}`}>
              <p className="text-xs text-text-muted">You</p>
              <p className="mt-0.5 text-sm text-text-primary">{p.my_option}</p>
            </div>
            <div className={`rounded-card border p-3 ${p.status === 'aligned' ? 'border-brand-teal/40 bg-brand-teal/5' : 'border-brand-coral/40 bg-brand-coral/5'}`}>
              <p className="text-xs text-text-muted">Them</p>
              <p className="mt-0.5 text-sm text-text-primary">{p.their_option}</p>
            </div>
          </div>
        </Card>
      ))}

      {data.pairs.some(p => p.status === 'not_answered_by_them') && (
        <p className="text-xs text-text-muted">
          Some questions are missing because they have not answered them yet. That is different from a
          disagreement.
        </p>
      )}
    </div>
  );
}

const RULE_CATEGORIES = ['Rent & expenses', 'Cleaning & chores', 'Guests & quiet hours',
  'Food & shared supplies', 'Privacy & belongings', 'Conflict resolution'];

function ConstitutionPanel({ partnerId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [category, setCategory] = useState(RULE_CATEGORIES[0]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch(`/living-dna/constitution/${partnerId}`).then(setData).catch(setError);
  }, [partnerId]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setBusy(true); setActionError(null);
    try { await fn(); load(); } catch (e) { setActionError(e); } finally { setBusy(false); }
  };

  if (error) {
    return (
      <Card className="p-6">
        <h2 className="font-semibold text-text-primary">Not available</h2>
        <p className="mt-1 text-sm text-text-secondary">{error?.message}</p>
      </Card>
    );
  }
  if (!data) return <Spinner size="lg" />;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <FileText size={20} className="mt-0.5 shrink-0 text-brand-coral" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-text-primary">
              {data.mutuallyAccepted ? 'Agreed by both of you' : data.iHaveAccepted || data.theyHaveAccepted ? 'Waiting on the other person' : 'Proposed'}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {data.rules.length === 0
                ? 'No rules yet. Add the first one below.'
                : `${data.agreedRules} of ${data.rules.length} rules settled.`}
            </p>
            <ul className="mt-3 space-y-1 text-xs">
              <li className={data.iHaveAccepted ? 'text-brand-teal-dark' : 'text-text-muted'}>
                {data.iHaveAccepted ? '✓' : '○'} You have accepted
              </li>
              <li className={data.theyHaveAccepted ? 'text-brand-teal-dark' : 'text-text-muted'}>
                {data.theyHaveAccepted ? '✓' : '○'} They have accepted
              </li>
            </ul>
          </div>
        </div>
      </Card>

      <InlineError error={actionError} />

      {data.rules.map(r => (
        <Card key={r.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-text-muted">{r.category} · {r.author_name}</p>
              <p className="mt-1 text-sm text-text-primary">{r.rule_text}</p>
            </div>
            <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs ${
              r.status === 'agreed' ? 'bg-brand-teal/10 text-brand-teal-dark'
                : r.status === 'declined' ? 'bg-brand-coral/10 text-brand-coral-dark' : 'bg-surface-muted text-text-secondary'
            }`}>{r.status}</span>
          </div>
        </Card>
      ))}

      {data.rules.length > 0 && (
        <Button variant="secondary" size="md" disabled={busy} onClick={() => act(() =>
          apiFetch(`/living-dna/constitution/${partnerId}/accept`, { method: 'POST' }))}
        >
          {data.iHaveAccepted ? 'Re-accept current version' : 'Accept these rules'}
        </Button>
      )}

      <Card className="space-y-3 p-5">
        <h3 className="font-semibold text-text-primary">Propose a rule</h3>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-text-muted">Category</span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="min-h-[44px] w-full rounded-card border border-surface-border bg-surface-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-coral"
          >
            {RULE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-text-muted">The rule</span>
          <textarea
            value={text} onChange={e => setText(e.target.value)} rows={3}
            className="w-full rounded-card border border-surface-border bg-surface-card px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-coral"
            placeholder="We take turns with the bins"
          />
        </label>
        <Button size="md" disabled={busy || !text.trim()} onClick={() => act(async () => {
          await apiFetch(`/living-dna/constitution/${partnerId}/rules`, {
            method: 'POST', body: { category, rule_text: text },
          });
          setText('');
        })}>Propose</Button>
        <p className="text-xs text-text-muted">
          Adding a rule reopens the whole document — both of you have to accept again.
        </p>
      </Card>
    </div>
  );
}
