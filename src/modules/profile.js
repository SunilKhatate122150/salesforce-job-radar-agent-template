// User Profile & Roadmap Module (Vite)
import { apiFetch } from './api.js';

export let cachedUserProfile = null;

const originalLoadUserProfile = (typeof window !== 'undefined' && window.loadUserProfile !== loadUserProfile) ? window.loadUserProfile : null;
const originalUpdateProfileStrengthMeter = (typeof window !== 'undefined' && window.updateProfileStrengthMeter !== updateProfileStrengthMeter) ? window.updateProfileStrengthMeter : null;
const originalBuildStaticPremiumRoadmap = (typeof window !== 'undefined' && window.buildStaticPremiumRoadmap !== buildStaticPremiumRoadmap) ? window.buildStaticPremiumRoadmap : null;


export function getCachedUserProfile() {
  return cachedUserProfile;
}

export function setCachedUserProfile(profile) {
  cachedUserProfile = profile;
  if (typeof window !== 'undefined') {
    window.cachedUserProfile = profile;
  }
}

export async function loadUserProfile() {
  if (typeof originalLoadUserProfile === 'function') {
    return await originalLoadUserProfile();
  }
  
  try {
    const res = await apiFetch('/api/profile/data?cb=' + Date.now());
    if (!res.ok) {
      console.log('❌ [Profile] Cloud fetch failed (Status: ' + res.status + '). User might be logged out.');
      return;
    }
    const data = await res.json();
    console.log('[Profile] Cloud Data Received:', data);
    
    if (data.exists && data.profile) {
      const resolvedUiMode = localStorage.getItem('sf_premium_ui_mode') || 'modern';
      cachedUserProfile = { ...data.profile, uiMode: resolvedUiMode };
      setCachedUserProfile(cachedUserProfile);
      
      if (typeof window.applyUiMode === 'function') window.applyUiMode(resolvedUiMode);
      if (typeof window.hydratePremiumSetupForm === 'function') window.hydratePremiumSetupForm(cachedUserProfile);
      if (typeof window.renderProfileMatchPage === 'function') window.renderProfileMatchPage(cachedUserProfile);
      if (typeof window.updateSidebarProfileStatus === 'function') window.updateSidebarProfileStatus(cachedUserProfile);
      if (typeof window.updateSyncModalUI === 'function') window.updateSyncModalUI(cachedUserProfile);
      
      return cachedUserProfile;
    }
  } catch (e) {
    console.error('[PROFILE] Error loading profile:', e);
  }
}

export function updateProfileStrengthMeter() {
  if (typeof originalUpdateProfileStrengthMeter === 'function') {
    return originalUpdateProfileStrengthMeter();
  }
}

export function buildStaticPremiumRoadmap(profile) {
  if (typeof originalBuildStaticPremiumRoadmap === 'function') {
    return originalBuildStaticPremiumRoadmap(profile);
  }
}

// Bind to window for HTML event handlers and backward compatibility
if (typeof window !== 'undefined') {
  window.loadUserProfile = loadUserProfile;
  window.updateProfileStrengthMeter = updateProfileStrengthMeter;
  window.buildStaticPremiumRoadmap = buildStaticPremiumRoadmap;
  window.cachedUserProfile = cachedUserProfile;
  
  window.SFJR_PROFILE = {
    loadUserProfile,
    updateProfileStrengthMeter,
    buildStaticPremiumRoadmap,
    getCachedUserProfile,
    setCachedUserProfile
  };
}
