// Auth & Session Module (Vite)
import { showToast } from './toast.js';

let currentUser = null;
let GSI_TOKEN = localStorage.getItem('google_auth_token') || null;
let cachedUserProfile = null;
let clientStateLoadedFor = null;

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
}

export function getGsiToken() {
  return GSI_TOKEN;
}

export function getCurrentUserId() {
  return currentUser?.googleId || null;
}

export function getCurrentUserName() {
  return currentUser?.name || null;
}

export async function checkAuth() {
  const token = localStorage.getItem('google_auth_token');
  if (!token) return false;
  
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      GSI_TOKEN = token;
      return true;
    }
  } catch (e) {
    console.error('CheckAuth Error:', e);
  }
  return false;
}

export function handleCredentialResponse(response) {
  processGAuth(response);
}

export async function processGAuth(response) {
  const token = response.credential;
  const currentUiMode = localStorage.getItem('sf_premium_ui_mode') || 'modern';
  const loginMode = window.getLoginUiModeIntent?.() || currentUiMode || 'modern';
  
  sessionStorage.setItem('sf_login_ui_mode_intent', loginMode);
  if (typeof window.applyUiMode === 'function') {
    window.applyUiMode(loginMode);
  }
  localStorage.setItem('google_auth_token', token);
  GSI_TOKEN = token;
  
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      
      if (typeof window.loadUserScopedClientState === 'function') {
        window.loadUserScopedClientState();
      }
      const overlay = document.getElementById('loginOverlay');
      if (overlay) overlay.style.display = 'none';
      const syncStatus = document.getElementById('syncStatus');
      if (syncStatus) syncStatus.style.display = 'flex';
      const syncStatusPreLogin = document.getElementById('syncStatusPreLogin');
      if (syncStatusPreLogin) syncStatusPreLogin.style.display = 'none';
      
      if (typeof window.renderUserProfile === 'function') {
        window.renderUserProfile(currentUser);
      }
      if (typeof window.syncDashboard === 'function') {
        window.syncDashboard();
      }
      if (typeof window.showPage === 'function') {
        window.showPage(loginMode === 'classic' ? 'schedule' : 'profile_match');
      }
    } else {
      showToast('Authentication failed: ' + (data.error || 'Check Google Client ID'), true);
    }
  } catch (e) {
    if (e.message && e.message.includes('BLOCKED_BY_CLIENT')) return;
    console.error('Auth Error:', e);
    showToast('Login Service Unavailable', true);
  }
}

export function generateInitialsAvatar(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 120, 120);
  gradient.addColorStop(0, '#3b82f6');
  gradient.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(60, 60, 60, 0, Math.PI * 2);
  ctx.fill();
  
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2 
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 60, 62);
  
  return canvas.toDataURL('image/png');
}

export function toggleFloatingDropdown(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('floatDropdownMenu');
  if (!menu) return;
  const isVisible = menu.style.display === 'flex';
  menu.style.display = isVisible ? 'none' : 'flex';
  menu.setAttribute('aria-hidden', String(isVisible));
  if (!isVisible) requestAnimationFrame(() => syncFloatingDropdownViewport(menu));
}

export function syncFloatingDropdownViewport(menu = document.getElementById('floatDropdownMenu')) {
  if (!menu || menu.style.display !== 'flex') return;
  menu.style.removeProperty('left');
  menu.style.removeProperty('width');
  const margin = 12;
  const rect = menu.getBoundingClientRect();
  if (rect.left < margin) {
    menu.style.left = `${margin}px`;
    menu.style.right = 'auto';
    menu.style.width = `${Math.max(180, window.innerWidth - margin * 2)}px`;
  } else {
    menu.style.right = `${margin}px`;
  }
}

export function signOut() {
  try {
    const email = currentUser?.email;
    if (email && window.google?.accounts?.id?.revoke) {
      window.google.accounts.id.revoke(email, () => {});
    }
  } catch (e) {
    console.warn('[AUTH] Google revoke skipped:', e.message);
  }
  localStorage.removeItem('google_auth_token');
  sessionStorage.removeItem('sf_login_ui_mode_intent');
  currentUser = null;
  cachedUserProfile = null;
  GSI_TOKEN = null;
  clientStateLoadedFor = null;

  const container = document.getElementById('floatingProfileContainer');
  if (container) container.style.display = 'none';
  const sidebarWrap = document.getElementById('userProfile');
  if (sidebarWrap) sidebarWrap.style.display = 'none';

  location.reload();
}

// Bind to window for HTML event handlers and backward compatibility
if (typeof window !== 'undefined') {
  window.handleCredentialResponse = handleCredentialResponse;
  window.processGAuth = processGAuth;
  window.signOut = signOut;
  window.toggleFloatingDropdown = toggleFloatingDropdown;
  window.syncFloatingDropdownViewport = syncFloatingDropdownViewport;
  window.checkAuth = checkAuth;
  window.getCurrentUserId = getCurrentUserId;
  window.getCurrentUserName = getCurrentUserName;
  
  // Close dropdown when clicking outside
  window.addEventListener('click', () => {
    const menu = document.getElementById('floatDropdownMenu');
    if (menu) {
      menu.style.display = 'none';
      menu.setAttribute('aria-hidden', 'true');
    }
  });

  window.SFJR_AUTH = {
    checkAuth,
    signOut,
    getCurrentUserId,
    getCurrentUserName,
    getCurrentUser,
    setCurrentUser,
    getGsiToken,
    generateInitialsAvatar
  };
}
