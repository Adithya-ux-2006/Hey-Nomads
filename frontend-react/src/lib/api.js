import { demoResponse, exitDemo, isDemo, DEMO_SELF_ID, DEMO_SELF_NAME } from './demoMode';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') || '';

function getToken() {
  return localStorage.getItem('authToken');
}

export function setToken(token) {
  // Holding a token and holding the demo flag at once would show simulated
  // rows to a signed-in person, so real auth always ends the tour.
  if (token) {
    exitDemo();
    localStorage.setItem('authToken', token);
  } else localStorage.removeItem('authToken');
}

export function clearAuth() {
  exitDemo();
  localStorage.removeItem('authToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('userName');
}

export async function apiFetch(path, options = {}) {
  // Demo Mode answers the tour's requests locally and before the token is
  // read, so a stored auth entry can never be attached to a demo session.
  // The body rides along so a canned send can keep the message it echoed.
  const canned = demoResponse(path, options);
  if (canned !== undefined) return canned;

  const url = `${API_BASE}${API_BASE ? '' : '/api'}${path}`;
  const headers = { ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // A File is not FormData, so this used to JSON.stringify the upload into the
  // literal string "{}" and the server stored a broken image URL from a 2-byte
  // body. /api/upload streams the raw body and reads the type off the header.
  const isBinary = options.body instanceof Blob;
  if (options.body && !(options.body instanceof FormData) && !isBinary) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function resolveMediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const host = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${host}${path}`;
}

export const auth = {
  // "Who am I" is demo-aware: the tour's screens ask for the signed-in id to
  // render their own column and to label the sender of a message, and the
  // session was cleared on entry, so it must answer with the tour's identity
  // rather than null. "Am I signed in" stays token-only on purpose - see
  // isAuthenticated() below.
  getUserId: () => (isDemo() ? DEMO_SELF_ID : localStorage.getItem('userId')),
  setUserId: (id) => localStorage.setItem('userId', id),
  getUserName: () => (isDemo() ? DEMO_SELF_NAME : localStorage.getItem('userName')),
  setUserName: (name) => localStorage.setItem('userName', name),
  // Deliberately not demo-aware. A tour is not a session: the private routes
  // consult isDemo() alongside this, and keeping it honest stops the navbar
  // from advertising an app the visitor has no account inside of.
  isAuthenticated: () => !!getToken(),
  async restoreSession() {
    const token = getToken();
    if (!token) return { session: null };
    try {
      const user = await apiFetch('/auth/me');
      localStorage.setItem('userId', user.id);
      localStorage.setItem('userName', user.name);
      return { session: true, user };
    } catch {
      clearAuth();
      return { session: null };
    }
  },
  async signUp({ email, password, name }) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: { email, password, name }
    });
    setToken(data.token);
    localStorage.setItem('userId', data.user.id);
    localStorage.setItem('userName', data.user.name);
    return { data, error: null };
  },
  async signIn({ email, password }) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    setToken(data.token);
    localStorage.setItem('userId', data.user.id);
    localStorage.setItem('userName', data.user.name);
    return { data, error: null };
  },
  async logout() {
    clearAuth();
  }
};
