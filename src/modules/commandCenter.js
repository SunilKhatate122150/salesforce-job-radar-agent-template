// CommandCenter Module (Vite)
import { apiFetch } from './api.js';

export async function syncDashboard() {
  if (typeof window.syncDashboard === 'function') {
    return await window.syncDashboard();
  }
  
  try {
    console.log('🔍 Initiating modular dashboard sync...');
    if (typeof window.updateTrackerUI === 'function') await window.updateTrackerUI().catch(e => console.error(e));
    if (typeof window.renderTimetable === 'function') await window.renderTimetable().catch(e => console.error(e));
    if (typeof window.fetchDailySummary === 'function') await window.fetchDailySummary().catch(e => console.error(e));
    if (typeof window.fetchJobs === 'function') await window.fetchJobs().catch(e => console.error(e));
    if (typeof window.renderHistory === 'function') await window.renderHistory().catch(e => console.error(e));
    if (typeof window.loadUserProfile === 'function') await window.loadUserProfile().catch(e => console.error(e));
  } catch (e) {
    console.error('[COMMAND_CENTER] Dashboard sync failed:', e);
  }
}

// Bind to window for HTML event handlers and backward compatibility
if (typeof window !== 'undefined') {
  window.syncDashboard = syncDashboard;
  window.SFJR_COMMAND_CENTER = { syncDashboard };
}
