// User Profile & Roadmap Module (Vite)
import { apiFetch } from './api.js';
import { showPage } from './router.js';

export let cachedUserProfile = null;
let premiumRoadmapCache = null;
let premiumReleaseCache = null;
let premiumStaticDataCache = null;
let premiumPreviewBound = false;
let premiumPreviewTimer = null;

// User Scoped Identity Helpers
const getCurrentUserId = () => window.currentUser?.id || window.currentUser?.googleId || window.currentUser?.email || window.cachedUserProfile?.id || 'guest';
const getCurrentUserName = (fallback = 'there') => window.currentUser?.name || cachedUserProfile?.name || fallback;
const getUiMode = () => window.currentUiMode || 'modern';
const scopedStorageKey = (key) => `sfjr:${getCurrentUserId()}:${key}`;
const topicConfigName = (topicId) => window.topicConfig?.[topicId]?.name || topicId;

const readScopedJson = (key, fallback = null, legacyKey = null) => {
  if (typeof window.readScopedJson === 'function') {
    return window.readScopedJson(key, fallback, legacyKey);
  }
  try {
    const raw = localStorage.getItem(scopedStorageKey(key));
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  if (legacyKey) {
    try {
      const raw = localStorage.getItem(legacyKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
  }
  return fallback;
};

const writeScopedJson = (key, value) => {
  if (typeof window.writeScopedJson === 'function') {
    return window.writeScopedJson(key, value);
  }
  try {
    localStorage.setItem(scopedStorageKey(key), JSON.stringify(value));
  } catch (e) {}
};

// Math and text normalizers
export function clampPremiumExperience(value) {
  const num = Number(value);
  if (isNaN(num)) return 1;
  return Math.max(1, Math.min(10, num));
}

export function normalizeCsvInput(value) {
  return String(value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// Scoped Profile Functions
export function getCachedUserProfile() {
  return cachedUserProfile || window.cachedUserProfile;
}

export function setCachedUserProfile(profile) {
  cachedUserProfile = profile;
  if (typeof window !== 'undefined') {
    window.cachedUserProfile = profile;
  }
}

export function hydratePremiumSetupForm(profile = {}) {
  const hydratedProfile = mergePremiumDraftProfile(profile);
  const expEl = document.getElementById('premiumExperienceYears');
  const targetEl = document.getElementById('premiumTargetDesignation');
  const currentEl = document.getElementById('premiumCurrentDesignation');
  const skillsEl = document.getElementById('premiumSkills');
  
  const expValue = hydratedProfile.experienceYears ?? hydratedProfile.yearsOfExperience ?? 1;
  if (expEl) expEl.value = String(clampPremiumExperience(expValue));
  
  if (targetEl && (hydratedProfile.targetDesignation || hydratedProfile.targetRole)) {
    const targetValue = hydratedProfile.targetDesignation || hydratedProfile.targetRole;
    ensurePremiumTargetOption(targetEl, targetValue);
    targetEl.value = targetValue;
  }
  if (currentEl) currentEl.value = hydratedProfile.currentDesignation || hydratedProfile.currentRole || '';
  if (skillsEl) skillsEl.value = Array.isArray(hydratedProfile.skills) ? hydratedProfile.skills.join(', ') : '';
}

export function ensurePremiumTargetOption(selectEl, value) {
  const label = String(value || '').trim();
  if (!selectEl || !label) return;
  const hasOption = Array.from(selectEl.options || []).some(option => option.value === label || option.textContent.trim() === label);
  if (hasOption) return;
  const option = document.createElement('option');
  option.value = label;
  option.textContent = label;
  selectEl.appendChild(option);
}

export function readPremiumFormProfile(base = {}) {
  const expEl = document.getElementById('premiumExperienceYears');
  const targetEl = document.getElementById('premiumTargetDesignation');
  const currentEl = document.getElementById('premiumCurrentDesignation');
  const skillsEl = document.getElementById('premiumSkills');
  const targetDesignation = targetEl?.value || base.targetDesignation || base.targetRole || 'Salesforce Developer';
  const currentDesignation = currentEl?.value?.trim() || base.currentDesignation || base.currentRole || '';
  return {
    ...(base || {}),
    experienceYears: clampPremiumExperience(expEl?.value || base.experienceYears || base.yearsOfExperience || 1),
    targetDesignation,
    targetRole: targetDesignation,
    currentDesignation,
    currentRole: currentDesignation,
    skills: skillsEl ? normalizeCsvInput(skillsEl.value) : normalizeCsvInput(Array.isArray(base.skills) ? base.skills.join(', ') : ''),
    uiMode: getUiMode()
  };
}

export function getPremiumDraftStorageKey() {
  return scopedStorageKey('premium_profile_draft:v1');
}

export function readPremiumProfileDraft() {
  try {
    const raw = localStorage.getItem(getPremiumDraftStorageKey());
    if (!raw) return null;
    const draft = JSON.parse(raw);
    return draft && typeof draft === 'object' ? draft : null;
  } catch (err) {
    return null;
  }
}

export function writePremiumProfileDraft(profile) {
  const normalized = {
    experienceYears: clampPremiumExperience(profile?.experienceYears || profile?.yearsOfExperience || 1),
    targetDesignation: profile?.targetDesignation || profile?.targetRole || 'Salesforce Developer',
    targetRole: profile?.targetDesignation || profile?.targetRole || 'Salesforce Developer',
    currentDesignation: profile?.currentDesignation || profile?.currentRole || '',
    currentRole: profile?.currentDesignation || profile?.currentRole || '',
    skills: normalizeCsvInput(Array.isArray(profile?.skills) ? profile.skills.join(', ') : (profile?.skills || '')),
    uiMode: getUiMode(),
    updatedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(getPremiumDraftStorageKey(), JSON.stringify(normalized));
  } catch (err) {
    console.warn('[PREMIUM] Could not persist local dashboard draft:', err.message);
  }
  return normalized;
}

export function clearPremiumProfileDraft() {
  try {
    localStorage.removeItem(getPremiumDraftStorageKey());
  } catch (err) {}
}

export function mergePremiumDraftProfile(profile = {}) {
  const draft = readPremiumProfileDraft();
  if (!draft) return profile || {};
  const targetDesignation = draft.targetDesignation || draft.targetRole;
  const currentDesignation = draft.currentDesignation || draft.currentRole;
  return {
    ...(profile || {}),
    ...draft,
    targetDesignation,
    targetRole: targetDesignation,
    currentDesignation,
    currentRole: currentDesignation,
    skills: Array.isArray(draft.skills) ? draft.skills : normalizeCsvInput(draft.skills || '')
  };
}

export function scoreDesignationLabel(normalized, label) {
  const normalizedLabel = String(label || '').toLowerCase().trim();
  if (!normalizedLabel) return 0;
  if (normalized === normalizedLabel) return 10000 + normalizedLabel.length;
  if (normalized.includes(normalizedLabel)) return 1000 + normalizedLabel.length;
  if (normalizedLabel.includes(normalized)) return 500 + normalized.length;
  return 0;
}

export function inferStaticDesignation(rawDesignation, designationsData = {}) {
  const value = String(rawDesignation || '').trim();
  const designations = designationsData.designations || [];
  if (!value) return designations[0] || null;
  const normalized = value.toLowerCase();
  const ranked = designations.map(item => {
    const labels = [item.label, ...(item.aliases || [])].map(label => String(label || '').toLowerCase());
    return { item, score: Math.max(...labels.map(label => scoreDesignationLabel(normalized, label))) };
  }).filter(match => match.score > 0).sort((a, b) => b.score - a.score);
  return ranked[0]?.item || {
    id: normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom_designation',
    label: value,
    track: 'Custom',
    primaryTopicIds: []
  };
}

export async function loadStaticPremiumData() {
  if (premiumStaticDataCache) return premiumStaticDataCache;
  const [roadmaps, designations, releases, trailhead] = await Promise.all([
    fetch('/data/career-roadmaps.json').then(res => {
      if (!res.ok) throw new Error('career roadmaps unavailable');
      return res.json();
    }),
    fetch('/data/designation-map.json').then(res => {
      if (!res.ok) throw new Error('designation map unavailable');
      return res.json();
    }),
    fetch('/data/salesforce-releases.json').then(res => {
      if (!res.ok) throw new Error('release data unavailable');
      return res.json();
    }),
    fetch('/data/trailhead-resources.json').then(res => {
      if (!res.ok) throw new Error('Trailhead resources unavailable');
      return res.json();
    })
  ]);
  premiumStaticDataCache = { roadmaps, designations, releases, trailhead };
  window.premiumStaticDataCache = premiumStaticDataCache;
  return premiumStaticDataCache;
}

export async function buildStaticPremiumRoadmap(profile = {}) {
  const { roadmaps, designations, releases, trailhead } = await loadStaticPremiumData();
  const experienceYears = clampPremiumExperience(profile.experienceYears || profile.yearsOfExperience || 1);
  const designation = inferStaticDesignation(
    profile.targetDesignation || profile.targetRole || profile.currentDesignation || profile.currentRole,
    designations
  );
  const baseRoadmap = roadmaps.years?.[String(experienceYears)] || roadmaps.years?.['1'] || {};
  const roadmapTopicIds = new Set(baseRoadmap.topicIds || []);
  const mergedTopics = [...(baseRoadmap.topics || [])];

  for (const topicId of designation?.primaryTopicIds || []) {
    if (!roadmapTopicIds.has(topicId)) {
      mergedTopics.push({
        topicId,
        topic: topicConfigName(topicId),
        category: designation?.track || 'Designation',
        priority: 'medium',
        estimatedHours: 6,
        reason: `Added because it is important for ${designation?.label || 'the selected designation'}.`
      });
      roadmapTopicIds.add(topicId);
    }
  }

  const releaseCategories = new Set(baseRoadmap.releaseFocus || []);
  const releaseItems = (releases.items || []).filter(item => {
    const levelMatch = (item.experienceLevels || []).includes(experienceYears);
    const categoryMatch = releaseCategories.has(item.category);
    const designationMatch = (item.designations || []).some(d =>
      String(d).toLowerCase() === String(designation?.label || '').toLowerCase()
    );
    return levelMatch && (categoryMatch || designationMatch);
  });
  const topicSet = new Set(mergedTopics.map(topic => topic.topicId));
  const resources = (trailhead.resources || []).filter(resource => {
    const yearMatch = (resource.recommendedYears || []).includes(experienceYears);
    const topicMatch = (resource.topicIds || []).some(topicId => topicSet.has(topicId));
    return yearMatch && topicMatch;
  });

  return {
    success: true,
    previewMode: true,
    experienceYears,
    designation,
    roadmap: {
      ...baseRoadmap,
      topics: mergedTopics,
      topicIds: Array.from(roadmapTopicIds)
    },
    releaseFocus: {
      activeRelease: releases.activeRelease || {},
      items: releaseItems.length ? releaseItems : (releases.items || []).filter(item =>
        (item.experienceLevels || []).includes(experienceYears)
      ).slice(0, 6)
    },
    trailheadResources: resources.slice(0, 8),
    generatedAt: new Date().toISOString()
  };
}

export async function refreshPremiumRoadmapMount() {
  const mount = document.getElementById('premiumRoadmapMount');
  if (mount) mount.innerHTML = '<div class="premium-loading">Refreshing roadmap preview...</div>';
  premiumRoadmapCache = null;
  premiumReleaseCache = null;
  try {
    const currentDraft = readPremiumFormProfile(getCachedUserProfile() || {});
    writePremiumProfileDraft(currentDraft);
    setCachedUserProfile(cachedUserProfile ? { ...cachedUserProfile, ...currentDraft } : { ...currentDraft, isPreviewProfile: true });
    const data = await buildStaticPremiumRoadmap(currentDraft);
    premiumRoadmapCache = data;
    if (mount) {
      mount.innerHTML = (typeof window.renderPremiumRoadmapSection === 'function' ? window.renderPremiumRoadmapSection(data) : '') + 
                        (typeof window.renderPremiumReleaseFocusSection === 'function' ? window.renderPremiumReleaseFocusSection(data) : '');
    }
    const profilePage = document.getElementById('profile_match');
    if (profilePage && profilePage.classList.contains('active')) {
      if (typeof window.updateSidebarProfileStatus === 'function') window.updateSidebarProfileStatus(currentDraft);
      if (typeof window.updateSyncModalUI === 'function') window.updateSyncModalUI(currentDraft);
    }
  } catch (err) {
    console.warn('[PREMIUM] Preview refresh failed:', err.message);
    if (mount) mount.innerHTML = '<div class="premium-empty">Roadmap preview is unavailable right now.</div>';
  }
}

export function bindPremiumPreviewControls() {
  if (premiumPreviewBound) return;
  premiumPreviewBound = true;
  ['premiumExperienceYears', 'premiumTargetDesignation', 'premiumCurrentDesignation', 'premiumSkills'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const eventName = el.tagName === 'INPUT' ? 'input' : 'change';
    el.addEventListener(eventName, () => {
      writePremiumProfileDraft(readPremiumFormProfile(getCachedUserProfile() || {}));
      clearTimeout(premiumPreviewTimer);
      premiumPreviewTimer = setTimeout(refreshPremiumRoadmapMount, 180);
    });
  });
}

export async function savePremiumProfileSetup() {
  const triggerBtn = event?.currentTarget instanceof HTMLButtonElement ? event.currentTarget : document.querySelector('.premium-onboarding-actions .premium-primary-btn');
  const expEl = document.getElementById('premiumExperienceYears');
  const targetEl = document.getElementById('premiumTargetDesignation');
  const currentEl = document.getElementById('premiumCurrentDesignation');
  const skillsEl = document.getElementById('premiumSkills');
  const payload = {
    ...(getCachedUserProfile() || {}),
    experienceYears: clampPremiumExperience(expEl ? expEl.value : 1),
    targetDesignation: targetEl ? targetEl.value : 'Salesforce Developer',
    targetRole: targetEl ? targetEl.value : 'Salesforce Developer',
    currentDesignation: currentEl ? currentEl.value.trim() : '',
    currentRole: currentEl ? currentEl.value.trim() : '',
    skills: normalizeCsvInput(skillsEl ? skillsEl.value : ''),
    uiMode: getUiMode()
  };

  const originalText = triggerBtn ? triggerBtn.textContent : '';
  try {
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.innerHTML = '<span class="loading-spinner sm" aria-hidden="true"></span> Generating...';
    }
    const res = await apiFetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Profile save failed');
    setCachedUserProfile(payload);
    clearPremiumProfileDraft();
    premiumRoadmapCache = null;
    premiumReleaseCache = null;
    window.showToast?.('Premium roadmap generated for your experience level.', 'green');
    await window.loadUserProfile?.();
    await loadPremiumRoadmap(true);
    await window.loadReleaseCenter?.(true);
    showPage('profile_match');
  } catch (e) {
    console.error('[PREMIUM] Setup save failed:', e);
    setCachedUserProfile({ ...payload, isPreviewProfile: true });
    writePremiumProfileDraft(payload);
    premiumRoadmapCache = null;
    premiumReleaseCache = null;
    if (typeof window.renderProfileMatchPage === 'function') window.renderProfileMatchPage(getCachedUserProfile());
    await window.loadReleaseCenter?.(true).catch(() => {});
    window.showToast?.('Roadmap preview generated. Sign in with Google to save it.', 'green');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = originalText || 'Generate My Roadmap';
    }
  }
}

export function ensureProfileImportModal() {
  if (document.getElementById('profileImportModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="profileImportModal" class="premium-modal" onclick="if(event.target === this) closeProfileImport()" style="display:none;">
      <div class="premium-modal-box" role="dialog" aria-modal="true" aria-labelledby="profileImportTitle">
        <button class="premium-modal-close" onclick="closeProfileImport()" aria-label="Close">&times;</button>
        <div class="premium-eyebrow">Safe Profile Import</div>
        <h2 id="profileImportTitle">Import Profile Text</h2>
        <p class="premium-note">Paste resume, LinkedIn profile text, or Naukri profile text. Do not paste passwords, OTPs, or private account secrets.</p>
        <textarea id="profileImportText" rows="10" maxlength="5000" placeholder="Example: Salesforce Developer with 3 years of Apex, LWC, Flow, SOQL, integrations, current role, target role, certifications, project highlights, and preferred locations."></textarea>
        <div class="profile-import-feedback">
          <p id="profileImportError" class="profile-import-error" role="alert" aria-live="polite"></p>
          <span id="profileImportCount">0 / 5000 chars</span>
        </div>
        <input type="hidden" id="profileImportSource" value="manual">
        <div class="premium-modal-actions">
          <button id="profileImportSubmitBtn" class="premium-primary-btn" onclick="submitProfileImport()">Analyze & Save</button>
          <button class="premium-secondary-btn" onclick="closeProfileImport()">Cancel</button>
        </div>
      </div>
    </div>
  `);
  const textEl = document.getElementById('profileImportText');
  if (textEl) {
    textEl.addEventListener('input', () => updateProfileImportFeedback());
  }
}

export function updateProfileImportFeedback(message = '') {
  const textEl = document.getElementById('profileImportText');
  const errorEl = document.getElementById('profileImportError');
  const countEl = document.getElementById('profileImportCount');
  const length = textEl ? textEl.value.length : 0;
  if (countEl) countEl.textContent = `${length} / 5000 chars`;
  if (errorEl) errorEl.textContent = message;
}

export function openProfileImport(source = 'manual') {
  ensureProfileImportModal();
  const modal = document.getElementById('profileImportModal');
  const title = document.getElementById('profileImportTitle');
  const sourceEl = document.getElementById('profileImportSource');
  const textEl = document.getElementById('profileImportText');
  const label = source === 'linkedin' ? 'LinkedIn Profile Import' : source === 'naukri' ? 'Naukri Profile Import' : 'Manual Profile Import';
  if (title) title.textContent = label;
  if (sourceEl) sourceEl.value = source;
  if (textEl) textEl.value = '';
  updateProfileImportFeedback('');
  if (modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
  }
  setTimeout(() => textEl?.focus(), 0);
}

export function closeProfileImport() {
  const modal = document.getElementById('profileImportModal');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
}

export async function submitProfileImport() {
  const textEl = document.getElementById('profileImportText');
  const sourceEl = document.getElementById('profileImportSource');
  const profileText = textEl ? textEl.value.trim() : '';
  if (!profileText) {
    updateProfileImportFeedback('Please paste your profile or resume text before analyzing.');
    if (textEl) textEl.focus();
    return;
  }
  updateProfileImportFeedback('');
  const submitBtn = document.getElementById('profileImportSubmitBtn');
  const originalText = submitBtn ? submitBtn.textContent : '';
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner sm" aria-hidden="true"></span> Analyzing...';
    }
    const res = await apiFetch('/api/profile/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: sourceEl ? sourceEl.value : 'manual',
        text: profileText,
        targetDesignation: document.getElementById('premiumTargetDesignation')?.value || getCachedUserProfile()?.targetDesignation
      })
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || 'Import failed');
    closeProfileImport();
    premiumRoadmapCache = null;
    premiumReleaseCache = null;
    window.showToast?.('Profile import analyzed safely.', 'green');
    await window.loadUserProfile?.();
    await loadPremiumRoadmap(true);
    await window.loadReleaseCenter?.(true);
  } catch (e) {
    console.error('[PREMIUM] Import failed:', e);
    updateProfileImportFeedback('Profile import failed. Try a smaller text sample.');
    window.showToast?.('Profile import failed. Try a smaller text sample.', 'red');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText || 'Analyze & Save';
    }
  }
}

export async function loadPremiumRoadmap(force = false) {
  if (premiumRoadmapCache && !force) return premiumRoadmapCache;
  const profileForPreview = readPremiumFormProfile(getCachedUserProfile() || {});
  try {
    const res = await apiFetch('/api/roadmap?cb=' + Date.now());
    if (!res.ok) throw new Error('Roadmap API unavailable');
    premiumRoadmapCache = await res.json();
  } catch (err) {
    console.warn('[PREMIUM] Using local curated roadmap preview:', err.message);
    const mockData = await buildStaticPremiumRoadmap(profileForPreview);
    premiumRoadmapCache = mockData;
  }
  return premiumRoadmapCache;
}

// Bind to window for HTML event handlers and backward compatibility
if (typeof window !== 'undefined') {
  window.loadUserProfile = loadUserProfile;
  window.cachedUserProfile = cachedUserProfile;
  window.hydratePremiumSetupForm = hydratePremiumSetupForm;
  window.ensurePremiumTargetOption = ensurePremiumTargetOption;
  window.readPremiumFormProfile = readPremiumFormProfile;
  window.getPremiumDraftStorageKey = getPremiumDraftStorageKey;
  window.readPremiumProfileDraft = readPremiumProfileDraft;
  window.writePremiumProfileDraft = writePremiumProfileDraft;
  window.clearPremiumProfileDraft = clearPremiumProfileDraft;
  window.mergePremiumDraftProfile = mergePremiumDraftProfile;
  window.scoreDesignationLabel = scoreDesignationLabel;
  window.inferStaticDesignation = inferStaticDesignation;
  window.loadStaticPremiumData = loadStaticPremiumData;
  window.buildStaticPremiumRoadmap = buildStaticPremiumRoadmap;
  window.refreshPremiumRoadmapMount = refreshPremiumRoadmapMount;
  window.bindPremiumPreviewControls = bindPremiumPreviewControls;
  window.savePremiumProfileSetup = savePremiumProfileSetup;
  window.ensureProfileImportModal = ensureProfileImportModal;
  window.updateProfileImportFeedback = updateProfileImportFeedback;
  window.openProfileImport = openProfileImport;
  window.closeProfileImport = closeProfileImport;
  window.submitProfileImport = submitProfileImport;
  window.loadPremiumRoadmap = loadPremiumRoadmap;
  
  window.SFJR_PROFILE = {
    loadUserProfile,
    hydratePremiumSetupForm,
    readPremiumFormProfile,
    savePremiumProfileSetup,
    openProfileImport,
    submitProfileImport,
    loadPremiumRoadmap
  };
}
