// Demo Mode is a guided tour of the real screens, not a second product.
//
// The real Feed / Matches / Messages components are rendered unchanged; this
// module answers their API calls with canned rows while the flag is on, so the
// visitor walks the actual interface instead of a copy of it.
//
// Persistence: demo state lives in sessionStorage (separate keys, prefixed
// hey_nomads_demo_) so accept/dismiss/match/message survive navigation and
// refresh within the tab, but never touch authenticated production storage.
import { demoProfiles } from './demoProfiles.js';
import { scoreCompatibility, DEFAULT_MATCH_WEIGHTS } from '../../api/matching.mjs';

export const DEMO_SELF_ID = 9999;
export const DEMO_SELF_NAME = 'You';

const FLAG = 'hey_nomads_demo';
const K_RECEIVED = 'hey_nomads_demo_received';
const K_SENT = 'hey_nomads_demo_sent';
const K_MATCHES = 'hey_nomads_demo_matches';
const K_DISMISSED = 'hey_nomads_demo_dismissed';
const K_MESSAGES = 'hey_nomads_demo_messages';
const K_INIT = 'hey_nomads_demo_initialized';

const DEMO_SELF = {
  id: DEMO_SELF_ID, name: DEMO_SELF_NAME, age: 27, city: 'Mumbai', occupation: 'Product Designer',
  budget: 25000, bio: 'Looking for a calm, tidy flatmate.', is_demo: true,
  interests: ['Music', 'Coffee', 'Travel'], languages: ['English', 'Hindi'],
  cleanliness: 4, sleep_time: 'early', diet: 'veg', smoking: 'no', drinking: 'no',
  social_level: 'moderate', noise_tolerance: 'low', flat_type: 'shared', pets: 'no',
  work_schedule: '9-5', move_in_date: '2026-11-15', neighbourhood: 'Bandra', preferred_neighbourhood: 'Bandra',
  moving_to: 'Mumbai', country: 'India', onboarding_complete: true,
};

const COST_BY_CITY = new Map([
  ['mumbai', 4], ['bangalore', 3], ['delhi', 4], ['pune', 2], ['hyderabad', 3],
]);

function ss() { return (typeof sessionStorage !== 'undefined') ? sessionStorage : null; }
function ls() { return (typeof localStorage !== 'undefined') ? localStorage : null; }

let active = (typeof window !== 'undefined') && ss()?.getItem(FLAG) === '1';
const listeners = new Set();
function emit() { listeners.forEach(fn => fn(active)); }

// ---------- scoring ----------
function scoreOne(p) {
  const ctx = {
    me: DEMO_SELF,
    meLangs: DEMO_SELF.languages,
    themById: new Map([[p.id, { ...p, onboarding_complete: true }]]),
    langsById: new Map([[p.id, p.languages || []]]),
    costByCity: COST_BY_CITY,
  };
  const { score, breakdown, reasons } = scoreCompatibility(ctx, p.id, DEFAULT_MATCH_WEIGHTS);
  return {
    ...p,
    profile_image: p.profile_image ?? null,
    score,
    breakdown,
    reasons: (reasons && reasons.length) ? reasons : [{ type: 'neutral', text: 'Potential match' }],
  };
}

export const demoFeed = demoProfiles.map(scoreOne);

// ---------- state ----------
let receivedIds = [];
let sentIds = [];
let matchIds = [];
let dismissedIds = [];
let messagesByPartner = {};

function parseJson(raw, fallback) {
  if (raw == null) return fallback;
  try { const v = JSON.parse(raw); return (v == null) ? fallback : v; }
  catch { return fallback; }
}

function loadState() {
  const s = ss();
  if (!s) return;
  receivedIds = parseJson(s.getItem(K_RECEIVED), null);
  sentIds = parseJson(s.getItem(K_SENT), null);
  matchIds = parseJson(s.getItem(K_MATCHES), null);
  dismissedIds = parseJson(s.getItem(K_DISMISSED), null);
  messagesByPartner = parseJson(s.getItem(K_MESSAGES), {});
  if (!Array.isArray(receivedIds) || !Array.isArray(sentIds) || !Array.isArray(matchIds) || !Array.isArray(dismissedIds)) {
    // invalid/outdated -> reseed
    seedState();
  }
}

function persistState() {
  const s = ss();
  if (!s) return;
  s.setItem(K_RECEIVED, JSON.stringify(receivedIds));
  s.setItem(K_SENT, JSON.stringify(sentIds));
  s.setItem(K_MATCHES, JSON.stringify(matchIds));
  s.setItem(K_DISMISSED, JSON.stringify(dismissedIds));
  s.setItem(K_MESSAGES, JSON.stringify(messagesByPartner));
  s.setItem(K_INIT, '1');
}

function seedState() {
  const feedIds = demoFeed.map(p => p.id);
  sentIds = feedIds.slice(0, 2);
  receivedIds = feedIds.slice(2, 7);
  matchIds = [...sentIds];
  dismissedIds = [];
  messagesByPartner = {};
  const firstMatch = matchIds[0];
  if (firstMatch != null) {
    messagesByPartner[firstMatch] = [
      { text: "Hi! Saw we're both looking in the same area.", at: new Date(Date.now() - 72e5).toISOString(), fromMe: false },
    ];
  }
}

function ensureState() {
  const s = ss();
  const hasState = s && s.getItem(K_INIT) === '1';
  if (!hasState) seedState();
  else loadState();
  if (!Array.isArray(receivedIds)) receivedIds = [];
  if (!Array.isArray(sentIds)) sentIds = [];
  if (!Array.isArray(matchIds)) matchIds = [];
  if (!Array.isArray(dismissedIds)) dismissedIds = [];
  if (!messagesByPartner || typeof messagesByPartner !== 'object') messagesByPartner = {};
  // idempotency: remove any dismissed/accepted from received; dedupe matches
  receivedIds = receivedIds.filter(id => !dismissedIds.includes(id) && !matchIds.includes(id));
  matchIds = [...new Set(matchIds)];
}

function profileById(id) { return demoFeed.find(p => String(p.id) === String(id)); }

function likeRow(p, likedAt, matched) {
  return {
    user_id: p.id, name: p.name, profile_image: p.profile_image,
    city: p.city, occupation: p.occupation, liked_at: likedAt,
    ...(matched ? { matched: true } : {}),
  };
}

const stamp = (i) => new Date(Date.now() - (i + 2) * 36e5).toISOString();

export function enterDemo() {
  const l = ls();
  if (l) { l.removeItem('authToken'); l.removeItem('userId'); l.removeItem('userName'); }
  const wasActive = active;
  active = true;
  if (typeof ss() !== 'undefined' && ss()) ss().setItem(FLAG, '1');
  if (!wasActive) emit();
  ensureState();
  persistState();
  // keep network fetch (graceful fallback) but do not override scored feed
  loadRealSamples();
  return Promise.resolve();
}

export function exitDemo() {
  if (!active) return;
  active = false;
  const s = ss();
  if (s) s.removeItem(FLAG);
  emit();
}

export function onDemoChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const isDemo = () => active;

let loading = null;
function loadRealSamples() {
  if (loading) return loading;
  loading = fetch('/api/demo/profiles')
    .then(r => (r.ok ? r.json() : []))
    .then(() => undefined)
    .catch(() => undefined);
  return loading;
}

// ---------- interactions ----------
export function acceptLike(profileId) {
  const id = Number(profileId);
  receivedIds = receivedIds.filter(x => Number(x) !== id);
  if (!matchIds.includes(id)) matchIds.push(id);
  dismissedIds = dismissedIds.filter(x => Number(x) !== id);
  persistState();
  return getState();
}

export function dismissLike(profileId) {
  const id = Number(profileId);
  receivedIds = receivedIds.filter(x => Number(x) !== id);
  if (!dismissedIds.includes(id)) dismissedIds.push(id);
  persistState();
  return getState();
}

export function likeProfile(profileId) {
  const id = Number(profileId);
  if (!sentIds.includes(id)) sentIds.push(id);
  let matchCreated = false;
  if (receivedIds.includes(id)) {
    receivedIds = receivedIds.filter(x => Number(x) !== id);
    if (!matchIds.includes(id)) { matchIds.push(id); matchCreated = true; }
  }
  if (!matchIds.includes(id) && receivedIds.includes(id) === false && sentIds.includes(id)) {
    // auto-match only if reciprocal like existed; already handled above
  }
  persistState();
  return { ok: true, matchCreated };
}

// ---------- derived ----------
function getState() {
  return { receivedIds: [...receivedIds], sentIds: [...sentIds], matchIds: [...matchIds], dismissedIds: [...dismissedIds] };
}

const demoMatches = () => matchIds.map((id, i) => {
  const p = profileById(id);
  if (!p) return null;
  return {
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
    breakdown: p.breakdown,
    reasons: p.reasons,
  };
}).filter(Boolean);

const demoConversations = () => demoMatches().map((m, i) => {
  const msgs = messagesByPartner[m.partner_id] || [];
  const last = msgs.length ? msgs[msgs.length - 1] : null;
  return {
    conversation_id: 700 + i,
    partner_id: m.partner_id,
    partner_name: m.partner_name,
    partner_image: m.partner_image,
    partner_city: m.partner_city,
    last_message: last ? last.text : (i === 0 ? "Hi! Saw we're both looking in the same area." : 'Sounds good - want to view it this weekend?'),
    last_message_from_me: last ? last.fromMe : (i !== 0),
    last_message_time: last ? last.at : new Date(Date.now() - (i + 1) * 36e5).toISOString(),
    unread_count: (i === 0 && !last) ? 1 : 0,
  };
});

function threadFor(partnerId) {
  const pid = Number(partnerId);
  const partner = profileById(pid);
  const mine = (messagesByPartner[pid] || [])
    .filter(m => m.fromMe)
    .map((m, i) => ({
      id: 900000 + i,
      sender_id: DEMO_SELF_ID,
      content: m.text,
      read_at: null,
      created_at: m.at,
      sender_name: DEMO_SELF_NAME,
    }));
  const theirs = (messagesByPartner[pid] || [])
    .filter(m => !m.fromMe)
    .map((m, i) => ({
      id: 900001 + i,
      sender_id: pid,
      content: m.text,
      read_at: null,
      created_at: m.at,
      sender_name: partner ? partner.name : 'Partner',
    }));
  // seed a partner message if none
  if (theirs.length === 0 && partner) {
    theirs.push({
      id: 1,
      sender_id: pid,
      content: "Hi! Saw we're both looking in the same area.",
      read_at: null,
      created_at: new Date(Date.now() - 72e5).toISOString(),
      sender_name: partner.name,
    });
  }
  return [...theirs, ...mine].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function detailFor(id) {
  const found = profileById(id) || demoFeed[0];
  return {
    ...found,
    score: found?.score ?? 0,
    breakdown: found?.breakdown ?? {},
    reasons: found?.reasons ?? [],
    interests: found?.interests ?? [],
    languages: found?.languages ?? ['English', 'Hindi'],
    is_match: matchIds.map(Number).includes(Number(id)),
  };
}

function demoLikes() {
  const stampFn = stamp;
  const received = receivedIds.map((id, i) => {
    const p = profileById(id);
    if (!p) return null;
    return likeRow(p, stampFn(i), false);
  }).filter(Boolean);
  const sent = sentIds.map((id, i) => {
    const p = profileById(id);
    if (!p) return null;
    const matched = matchIds.map(Number).includes(Number(id));
    return likeRow(p, stampFn(i), matched);
  }).filter(Boolean);
  return { sent, received };
}

export function demoResponse(path, options = {}) {
  if (!active) return undefined;
  const p = path.split('?')[0];

  if (p.startsWith('/roommates/recommended')) return demoFeed;
  if (p.startsWith('/shortlist')) return [];
  if (p.startsWith('/swipe')) {
    try {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      const tid = body?.targetId ?? body?.swiped_id;
      const action = body?.action || 'like';
      if (tid != null && action === 'like') {
        const r = likeProfile(tid);
        return { ok: true, matchCreated: r.matchCreated };
      }
      if (tid != null) return { ok: true };
    } catch { /* nothing */ }
    return { ok: true, matchCreated: false };
  }
  if (p.startsWith('/likes/sent')) return demoLikes().sent;
  if (p.startsWith('/likes/received')) return demoLikes().received;
  if (p === '/messages') {
    try {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      if (body?.message) {
        const rid = Number(body.receiver_id);
        if (!messagesByPartner[rid]) messagesByPartner[rid] = [];
        messagesByPartner[rid].push({ text: body.message, at: new Date().toISOString(), fromMe: true });
        persistState();
      }
    } catch { /* nothing to record */ }
    return { ok: true };
  }
  if (p.startsWith('/matches/')) {
    // DELETE /matches/:id (unmatch) - best effort
    if (options.method && String(options.method).toUpperCase() === 'DELETE') {
      const id = Number(p.slice('/matches/'.length));
      matchIds = matchIds.filter(x => Number(x) !== id);
      persistState();
    }
    return { ok: true };
  }
  if (p.startsWith('/matches')) return demoMatches();
  if (p.startsWith('/conversations/')) {
    if (p.endsWith('/read')) return { ok: true };
    const id = p.slice('/conversations/'.length);
    return threadFor(id);
  }
  if (p.startsWith('/conversations')) return demoConversations();
  if (p.startsWith('/roommates/')) return detailFor(p.slice('/roommates/'.length));
  if (p.startsWith('/profile/')) return detailFor(p.slice('/profile/'.length));
  return undefined;
}
