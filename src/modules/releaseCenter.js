// Release Center Module (Vite)
import { apiFetch } from './api.js';

let premiumReleaseCache = null;

// Capture the existing window.loadReleaseCenter before we overwrite it
const originalLoadReleaseCenter = (typeof window !== 'undefined' && window.loadReleaseCenter !== loadReleaseCenter) ? window.loadReleaseCenter : null;

export async function loadReleaseCenter(force = false) {
  if (typeof originalLoadReleaseCenter === 'function') {
    return await originalLoadReleaseCenter(force);
  }
  
  if (premiumReleaseCache && !force) return premiumReleaseCache;
  try {
    const res = await apiFetch('/api/releases/current?cb=' + Date.now());
    if (!res.ok) throw new Error('Release API unavailable');
    premiumReleaseCache = await res.json();
  } catch (err) {
    console.warn('[RELEASES] Curated release fallback:', err.message);
  }
  
  if (premiumReleaseCache && typeof window.renderReleaseCenterPage === 'function') {
    window.renderReleaseCenterPage(premiumReleaseCache);
  }
  return premiumReleaseCache;
}

// Bind to window for HTML event handlers and backward compatibility
if (typeof window !== 'undefined') {
  window.loadReleaseCenter = loadReleaseCenter;
  window.SFJR_RELEASE_CENTER = { loadReleaseCenter };
}
