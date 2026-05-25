const runtimeNodeEnv = typeof process !== 'undefined' ? process.env.NODE_ENV : undefined;
export const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD || runtimeNodeEnv === 'production'
    ? 'https://your-backend-url.com'
    : 'http://localhost:3000')
).replace(/\/+$/, '');

export const API_BASE_URL = `${API_URL}/api`;

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
  logout: () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
  },
  isAuthenticated: () => !!localStorage.getItem('userId')
};
