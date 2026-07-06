// Release Center Module (Vite)
import { apiFetch } from './api.js';
import { loadStaticPremiumData, buildStaticPremiumRoadmap, readPremiumFormProfile } from './profile.js';

let premiumReleaseCache = null;

export async function loadReleaseCenter(force = false) {
  if (premiumReleaseCache && !force) return premiumReleaseCache;
  try {
    const res = await apiFetch('/api/releases/current?cb=' + Date.now());
    if (!res.ok) throw new Error('Release API unavailable');
    premiumReleaseCache = await res.json();
  } catch (err) {
    console.warn('[RELEASES] Using local curated release preview:', err.message);
    const cachedProfile = window.cachedUserProfile || {};
    const [{ releases }, intelligence] = await Promise.all([
      loadStaticPremiumData(),
      buildStaticPremiumRoadmap(readPremiumFormProfile(cachedProfile))
    ]);
    premiumReleaseCache = {
      success: true,
      previewMode: true,
      activeRelease: releases.activeRelease || {},
      items: releases.items || [],
      personalizedItems: intelligence.releaseFocus?.items || [],
      experienceYears: intelligence.experienceYears,
      designation: intelligence.designation
    };
  }
  if (typeof window.renderReleaseCenterPage === 'function') {
    window.renderReleaseCenterPage(premiumReleaseCache);
  }
  if (typeof window.renderRecentTopicsPanel === 'function') {
    window.renderRecentTopicsPanel();
  }
  return premiumReleaseCache;
}

// Bind to window for HTML event handlers and backward compatibility
if (typeof window !== 'undefined') {
  window.loadReleaseCenter = loadReleaseCenter;
  window.SFJR_RELEASE_CENTER = { loadReleaseCenter };
}
