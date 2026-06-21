// Job Radar Board Module (Vite)
import { apiFetch } from './api.js';
import { showToast } from './toast.js';

export async function fetchJobs() {
  if (typeof window.fetchJobsList === 'function') {
    return await window.fetchJobsList();
  }
  
  try {
    const response = await apiFetch('/api/jobs');
    if (!response.ok) throw new Error('Failed to fetch jobs');
    const data = await response.json();
    return data.records || [];
  } catch (e) {
    console.error('[RADAR] Error fetching jobs:', e);
    showToast('Failed to load jobs.', 'red');
    return [];
  }
}

export async function updateJobStatus(jobId, newStatus) {
  if (typeof window.moveTo === 'function') {
    return await window.moveTo(jobId, newStatus);
  }
  
  try {
    const response = await apiFetch(`/api/jobs/${encodeURIComponent(jobId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    return response.ok;
  } catch (e) {
    console.error('[RADAR] Error updating status:', e);
    return false;
  }
}

export function renderJobsList(jobs) {
  if (typeof window.renderBoard === 'function') {
    window.renderBoard();
  }
}

export function sortBoardJobs(a, b) {
  const dateA = new Date(a.updatedAt || a.dateApplied || 0);
  const dateB = new Date(b.updatedAt || b.dateApplied || 0);
  return dateB - dateA;
}

export async function clearAndSyncJobs() {
  if (typeof window.clearJobRadarCache === 'function') {
    return await window.clearJobRadarCache();
  }
}

// Bind to window for HTML event handlers and backward compatibility
if (typeof window !== 'undefined') {
  window.fetchJobs = fetchJobs;
  window.updateJobStatus = updateJobStatus;
  window.renderJobsList = renderJobsList;
  window.clearAndSyncJobs = clearAndSyncJobs;
  
  window.SFJR_JOB_RADAR = {
    fetchJobs,
    updateJobStatus,
    renderJobsList,
    sortBoardJobs,
    clearAndSyncJobs
  };
}
