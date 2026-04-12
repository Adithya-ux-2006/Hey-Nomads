export const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : null);

if (!API_BASE_URL) {
  throw new Error('Missing VITE_API_URL in production. Set this variable to your backend base URL.');
}

const API_HOST = (() => {
  try {
    return typeof window !== 'undefined'
      ? new URL(API_BASE_URL, window.location.origin).origin
      : 'http://localhost:3000';
  } catch {
    return 'http://localhost:3000';
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
  
  const defaultOptions = {
    headers: {},
  };

  if (options.body && !(options.body instanceof FormData)) {
    defaultOptions.headers['Content-Type'] = 'application/json';
    if (typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    }
  };

  const response = await fetch(url, finalOptions);
  
  if (!response.ok) {
    const errorData = await parseJsonResponse(response).catch(err => ({ error: err.message }));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }
  
  return parseJsonResponse(response);
}

/**
 * Authentication utilities
 */
export const auth = {
  getUserId: () => localStorage.getItem('userId'),
  setUserId: (id) => localStorage.setItem('userId', id),
  getUserName: () => localStorage.getItem('userName'),
  setUserName: (name) => localStorage.setItem('userName', name),
  logout: () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
  },
  isAuthenticated: () => !!localStorage.getItem('userId')
};
