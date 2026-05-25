import { supabase } from '../lib/supabase';

const runtimeNodeEnv = typeof process !== 'undefined' ? process.env.NODE_ENV : undefined;
export const API_URL = (
  import.meta.env.VITE_API_URL || ''
).replace(/\/+$/, '');

export const API_BASE_URL = API_URL ? `${API_URL}/api` : '/api';

const API_HOST = (() => {
  try {
    return typeof window !== 'undefined'
      ? new URL(API_BASE_URL, window.location.origin).origin
      : 'https://invalid.local';
  } catch {
    return typeof window !== 'undefined' ? window.location.origin : 'https://invalid.local';
  }
})();

export function resolveMediaUrl(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : `${API_HOST}${path}`;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(
      `Expected JSON response from ${response.url}, got ${contentType || 'text/html'}. Response body: ${text.slice(0, 200)}`
    );
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON response from ${response.url}: ${text.slice(0, 200)}`);
  }
}

/**
 * Enhanced fetch wrapper for Hey Nomads
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const nextOptions = { ...options };
  const defaultOptions = {
    credentials: 'include',
    headers: {},
  };

  if (nextOptions.body && !(nextOptions.body instanceof FormData)) {
    defaultOptions.headers['Content-Type'] = 'application/json';
    if (typeof nextOptions.body === 'object') {
      nextOptions.body = JSON.stringify(nextOptions.body);
    }
  }

  const finalOptions = {
    ...defaultOptions,
    ...nextOptions,
    headers: {
      ...defaultOptions.headers,
      ...(nextOptions.headers || {})
    }
  };

  const response = await fetch(url, finalOptions);
  
  if (!response.ok) {
    const errorData = await parseJsonResponse(response).catch(err => ({ error: err.message }));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }
  
  return parseJsonResponse(response);
}

export async function apiFormFetch(endpoint, formData, options = {}) {
  return apiFetch(endpoint, {
    ...options,
    body: formData,
  });
}

/**
 * Authentication utilities
 */
export const auth = {
  getUserId: () => localStorage.getItem('userId'),
  setUserId: (id) => localStorage.setItem('userId', id),
  getUserName: () => localStorage.getItem('userName'),
  setUserName: (name) => localStorage.setItem('userName', name),
  getSupabaseUserId: () => localStorage.getItem('supabaseUserId'),
  hasSupabaseSession: () => localStorage.getItem('supabaseSession') === 'true',
  async restoreSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      this.clearLocal();
      return { session: null, error };
    }

    const session = data?.session || null;
    if (session?.user?.id) {
      localStorage.setItem('userId', session.user.id);
      localStorage.setItem('userName', session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User');
      localStorage.setItem('supabaseSession', 'true');
      localStorage.setItem('supabaseUserId', session.user.id);
      localStorage.setItem('supabaseEmail', session.user.email || '');
    } else {
      localStorage.removeItem('supabaseSession');
      localStorage.removeItem('supabaseUserId');
      localStorage.removeItem('supabaseEmail');
    }

    return { session, error: null };
  },
  async signUp({ email, password, name }) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });
  },
  async signIn({ email, password }) {
    return supabase.auth.signInWithPassword({ email, password });
  },
  clearLocal: () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('supabaseSession');
    localStorage.removeItem('supabaseUserId');
    localStorage.removeItem('supabaseEmail');
  },
  logout: () => {
    auth.clearLocal();
    return supabase.auth.signOut();
  },
  isAuthenticated: () => localStorage.getItem('supabaseSession') === 'true' && !!localStorage.getItem('supabaseUserId')
};
