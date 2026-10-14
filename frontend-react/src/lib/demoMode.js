// Demo Mode is a guided tour of the real screens, not a second product.
//
// The real Feed / Matches / Messages components are rendered unchanged; this
// module answers their API calls with canned rows while the flag is on, so the
// visitor walks the actual interface instead of a copy of it.
//
// Three rules the fixtures must keep:
//   1. No token, no localStorage. Demo Mode opens signed out and can never be
//      handed a previous visitor's session by an orphaned auth entry.
//   2. No writes. Every like, unmatch and send below is answered locally, so a
//      demo interaction cannot create a row another user later believes a
//      person wrote.
//   3. No fall-through. Every screen the tour can reach has to be answered
//      here. One uncovered path sends a real request with no session behind it
//      and drops the visitor out of the tour onto the sign-in form.
import { demoProfiles } from './demoProfiles';

// session-scoped, not localStorage: a refresh should not strand the visitor on
// the login screen, but the flag must not outlive the tab either. It is not an
// auth token and grants nothing - it only decides who answers the API calls.
const FLAG = 'hey_nomads_demo';

// The tour's own identity. Numeric because the screens compare ids with
// Number(), and deliberately outside the fixture and seeded ranges so it can
// never collide with a row the API might otherwise return.
export const DEMO_SELF_ID = 9999;
export const DEMO_SELF_NAME = 'You';

let active = typeof window !== 'undefined' && sessionStorage.getItem(FLAG) === '1';
const listeners = new Set();

export const isDemo = () => active;

function emit() {
  listeners.forEach(fn => fn(active));
}

export function enterDemo() {
  // Demo Mode opens signed out. Drop any stored session first, by key rather
  // than through clearAuth(), because clearAuth() ends the tour it is starting.
  // Without this a signed-in visitor keeps their real token and account id and
  // the screens below would render a real person's profile.
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
  }
  const wasActive = active;
  active = true;
  if (!wasActive) {
    sessionStorage.setItem(FLAG, '1');
    emit();
  }
  // Resolves once the samples have loaded, so the tour can navigate only when
  // the Feed has something to render.
  return loadRealSamples();
}

export function exitDemo() {
  if (!active) return;
  active = false;
  sessionStorage.removeItem(FLAG);
  emit();
}

export function onDemoChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const scored = p => ({
  ...p,
  profile_image: null,
  score: 84,
  // The card reads reason chips as { type, text }, the same shape the scorer
  // emits. Plain strings would render as empty pills.
  reasons: [
    { type: 'positive', text: `Both looking in ${p.city}` },
    { type: 'positive', text: 'Similar monthly budget' },
    { type: 'neutral', text: 'Same move-in window' },
  ],
});

export const demoFeed = demoProfiles.map(scored);

let loading = null;

// The seeded @heynomads.app accounts carry ordinary-looking names, which is
// what a demo should show. They are already excluded from every real feed by
// account classification, and the page is marked as demo for as long as it is
// open. The bundled fixtures are the fallback when the API is unreachable.
function loadRealSamples() {
  if (loading) return loading;
  loading = fetch('/api/demo/profiles')
    .then(r => (r.ok ? r.json() : []))
    .then(rows => {
      if (Array.isArray(rows) && rows.length) {
        demoFeed.splice(0, demoFeed.length, ...rows.map(scored));
      }
      return undefined;
    })
    .catch(() => undefined);
  return loading;
}

// Derived on each request so the matches and conversation lists follow
// whichever profiles actually loaded, not a snapshot taken at import time.
const demoMatches = () => demoFeed.slice(0, 2).map((p, i) => ({
  id: 500 + i,
  user_a_id: DEMO_SELF_ID,
  user_b_id: p.id,
  compatibility_score: p.score,
  status: 'matched',
  partner_id: p.id,
  partner_name: p.name,
  partner_image: p.profile_image,
  partner_city: p.city,
  partner_occupation: p.occupation,
  partner_bio: p.bio,
}));

const demoConversations = () => demoMatches().map((m, i) => ({
  conversation_id: 700 + i,
  partner_id: m.partner_id,
  partner_name: m.partner_name,
  partner_image: m.partner_image,
  partner_city: m.partner_city,
  last_message: i === 0 ? "Hi! Saw we're both looking in the same area." : 'Sounds good - want to view it this weekend?',
  last_message_from_me: i !== 0,
  last_message_time: new Date(Date.now() - (i + 1) * 36e5).toISOString(),
  unread_count: i === 0 ? 1 : 0,
}));

// Messages the visitor sends during the tour. Kept in memory so the chat's
// three-second poll does not erase a message it just rendered.
const sent = [];

const threadFor = partnerId => {
  const partner = demoFeed.find(p => String(p.id) === String(partnerId));
  const mine = sent
    .filter(m => String(m.to) === String(partnerId))
    .map((m, i) => ({
      id: 900000 + i,
      sender_id: DEMO_SELF_ID,
      content: m.text,
      read_at: null,
      created_at: m.at,
      sender_name: DEMO_SELF_NAME,
    }));
  const theirs = partner
    ? [{
        id: 1,
        sender_id: partner.id,
        content: "Hi! Saw we're both looking in the same area.",
        read_at: null,
        created_at: new Date(Date.now() - 72e5).toISOString(),
        sender_name: partner.name,
      }]
    : [];
  return [...theirs, ...mine].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
};

// The detail screen renders a sparse object safely - every field it reads is
// guarded with `||` - so one shared shape answers both a feed card tap and the
// partner column of a chat.
const detailFor = id => {
  const found = demoFeed.find(p => String(p.id) === String(id)) || demoFeed[0];
  return {
    ...found,
    score: found?.score ?? 84,
    breakdown: { lifestyle: 22, budget: 16, location: 18, movein: 12, interests: 8, habits: 9 },
    reasons: found?.reasons ?? [],
    interests: ['Music', 'Trekking', 'Cooking'],
    languages: ['English', 'Hindi'],
    is_match: demoMatches().some(m => String(m.partner_id) === String(id)),
  };
};

// Returns a canned body when demo mode owns the request, or undefined to let
// apiFetch handle it normally. Undefined - not null - so a legitimate null
// response still falls through.
export function demoResponse(path, options = {}) {
  if (!active) return undefined;
  const p = path.split('?')[0];

  if (p.startsWith('/roommates/recommended')) return demoFeed;
  if (p.startsWith('/shortlist')) return [];
  if (p.startsWith('/swipe')) return { ok: true, matchCreated: true };
  if (p === '/messages') {
    try {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      if (body?.message) sent.push({ to: body.receiver_id, text: body.message, at: new Date().toISOString() });
    } catch { /* nothing to record */ }
    return { ok: true };
  }
  if (p.startsWith('/matches/')) return { ok: true };
  if (p.startsWith('/matches')) return demoMatches();
  if (p.startsWith('/conversations/')) {
    if (p.endsWith('/read')) return { ok: true };
    return threadFor(p.slice('/conversations/'.length));
  }
  if (p.startsWith('/conversations')) return demoConversations();
  if (p.startsWith('/roommates/')) return detailFor(p.slice('/roommates/'.length));
  if (p.startsWith('/profile/')) return detailFor(p.slice('/profile/'.length));
  return undefined;
}
