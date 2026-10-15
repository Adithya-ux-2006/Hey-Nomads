// Competition presentation session.
//
// Four synthetic people, built the first time the walkthrough is started
// through the product's own public endpoints - /auth/register, /onboarding and
// /profile, the exact calls a visitor makes. There is no admin surface here and
// nothing writes a fixture directly.
//
// They are addressed as `qa.present.*` on purpose: the shared classifier treats
// that prefix as a test account, so these rows are invisible to every real
// feed, can never be liked or matched by a genuine user, and cannot be read
// through the ordinary profile routes. Isolation comes from the account rules
// the product already enforces.
//
// Who those four people are lives in ./presentation-cohort.js, shared with the
// QA suite so both write the same profiles.

import { COHORT, emailFor, onboardingBody, profileBody } from './presentation-cohort';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const url = path => `${BASE}${BASE ? '' : '/api'}${path}`;

const TOKEN_KEY = 'presentationToken';
const USER_KEY = 'presentationUser';
const PASSWORD_KEY = 'presentationPassword';

async function call(path, { method = 'GET', body, token = null } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const presCall = (path, opts = {}) =>
  call(path, { ...opts, token: localStorage.getItem(TOKEN_KEY) });

const presCallWith = (token, path, opts = {}) => call(path, { ...opts, token });

export const hasSession = () => Boolean(localStorage.getItem(TOKEN_KEY));

export const sessionUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};

export function endSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

const fixturePassword = () => {
  let pw = localStorage.getItem(PASSWORD_KEY);
  if (!pw) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    pw = Array.from(bytes, b => 'abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 56]).join('');
    localStorage.setItem(PASSWORD_KEY, pw);
  }
  return pw;
};

// One pass over the cohort. Each account is registered, onboarded and given its
// profile with its own token; an account that already exists falls back to a
// sign-in with the password this browser created the first time round, so a
// half-finished setup repairs itself instead of wedging the walkthrough.
async function provision() {
  const password = fixturePassword();
  for (const account of COHORT) {
    const email = emailFor(account.role);
    let token = null;
    try {
      const reg = await call('/auth/register', {
        method: 'POST',
        body: { email, password, name: account.name },
      });
      token = reg.token;
    } catch (err) {
      // Register answers 400 for "already registered" and 429 for the per-device
      // cap; anything else is a real failure and should surface.
      const known = /already registered/i.test(err.message || '')
        || err.status === 400 || err.status === 429;
      if (!known) throw err;
      // Already on file. Reopen it with the password this browser created the
      // first time round; if that fails this account is simply skipped and the
      // readiness check below decides whether the cohort is usable.
      try {
        const login = await call('/auth/login', { method: 'POST', body: { email, password } });
        token = login.token;
      } catch {
        token = null;
      }
    }
    if (!token) continue;
    await call('/onboarding', { method: 'POST', body: onboardingBody(account), token });
    await call('/profile', { method: 'POST', body: profileBody(account), token });
  }
}

// Start (or restart) the walkthrough: make sure the cohort exists and is fully
// onboarded, then clear any likes, matches and threads from a previous run so
// every presentation begins from the same state.
export async function beginPresentation() {
  let session = await call('/presentation/session', { method: 'POST' });
  if (!session.ready) {
    await provision();
    session = await call('/presentation/session', { method: 'POST' });
    if (!session.ready) {
      throw new Error('The demonstration profiles could not be prepared. Reload and try again.');
    }
  }
  const reset = await presCallWith(session.token, '/presentation/reset', { method: 'POST' });
  localStorage.setItem(TOKEN_KEY, reset.token || session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  return session.user;
}

export const discover = () => presCall('/presentation/discover');
export const candidate = id => presCall(`/presentation/candidates/${id}`);
export const like = (targetId, action = 'like') =>
  presCall('/presentation/like', { method: 'POST', body: { targetId, action } });
export const matches = () => presCall('/presentation/matches');
export const chat = peerId => presCall(`/presentation/chat/${peerId}`);
export const send = (peerId, message) =>
  presCall('/presentation/chat', { method: 'POST', body: { peerId, message } });
