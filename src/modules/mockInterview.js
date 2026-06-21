// Mock Interview Module (Vite)
import { apiFetch } from './api.js';
import { showToast } from './toast.js';

export async function saveInterviewSession() {
  if (typeof window.saveInterviewSession === 'function') {
    return await window.saveInterviewSession();
  }
}

export async function loadMockInterviewHistory() {
  if (typeof window.loadMockInterviewHistory === 'function') {
    return await window.loadMockInterviewHistory();
  }
}

// Bind to window for HTML event handlers and backward compatibility
if (typeof window !== 'undefined') {
  window.saveInterviewSession = saveInterviewSession;
  window.loadMockInterviewHistory = loadMockInterviewHistory;
  window.SFJR_MOCK_INTERVIEW = { saveInterviewSession, loadMockInterviewHistory };
}
