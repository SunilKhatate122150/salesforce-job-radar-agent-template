// Shared API Client Module (Vite)
export async function apiFetch(url, options = {}) {
  const { timeout, ...fetchOptions } = options || {};
  const token = localStorage.getItem('google_auth_token');
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  
  const path = (() => {
    try {
      return new URL(url, window.location.origin).pathname;
    } catch (e) {
      return String(url || '').split('?')[0];
    }
  })();
  
  const isPublicApi = window.RadarCloud?.isPublicApi
    ? window.RadarCloud.isPublicApi(url, method)
    : (path === '/api/auth/google' || path === '/api/health' || (method === 'GET' && path === '/api/code-practice/challenges'));
  
  const hasToken = token && token !== 'null' && token !== 'undefined';
  if (!hasToken && path.startsWith('/api/') && !isPublicApi) {
    return new Response(JSON.stringify({ success: false, error: 'login_required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'X-Local-Auth-State': 'login_required' }
    });
  }
  
  const headers = {
    ...fetchOptions.headers,
    'Authorization': `Bearer ${token}`
  };
  
  if (method !== 'GET' && fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let timeoutId = null;
  let controller = null;
  const timeoutMs = Number(timeout || 0);
  if (timeoutMs > 0 && !fetchOptions.signal) {
    controller = new AbortController();
    fetchOptions.signal = controller.signal;
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    return await fetch(url, { ...fetchOptions, headers });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 10000 } = options;
  const token = localStorage.getItem('google_auth_token');
  const path = (() => {
    try {
      return new URL(resource, window.location.origin).pathname;
    } catch (e) {
      return String(resource || '').split('?')[0];
    }
  })();
  
  if ((!token || token === 'null' || token === 'undefined') && path.startsWith('/api/')) {
    return new Response(JSON.stringify({ success: false, error: 'login_required', completedTasks: [] }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'X-Local-Auth-State': 'login_required' }
    });
  }
  
  const headers = {
    ...options.headers,
    'Authorization': token ? `Bearer ${token}` : ''
  };

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, headers, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// Bind to window for legacy app.js support
if (typeof window !== 'undefined') {
  window.apiFetch = apiFetch;
  window.fetchWithTimeout = fetchWithTimeout;
}
