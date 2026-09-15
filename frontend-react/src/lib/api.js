const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') || '';

function getToken() {
  return localStorage.getItem('authToken');
}

export function setToken(token) {
  if (token) localStorage.setItem('authToken', token);
  else localStorage.removeItem('authToken');
}

export function clearAuth() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('userName');
}

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${API_BASE ? '' : '/api'}${path}`;
  const headers = { ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
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
  getUserId: () => localStorage.getItem('userId'),
  setUserId: (id) => localStorage.setItem('userId', id),
  getUserName: () => localStorage.getItem('userName'),
  setUserName: (name) => localStorage.setItem('userName', name),
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
