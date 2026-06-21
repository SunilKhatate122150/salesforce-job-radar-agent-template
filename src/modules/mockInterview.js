// Mock Interview Module (Vite)
import { apiFetch } from './api.js';
import { showToast } from './toast.js';

const originalSaveInterviewSession = (typeof window !== 'undefined' && window.saveInterviewSession !== saveInterviewSession) ? window.saveInterviewSession : null;
const originalLoadMockInterviewHistory = (typeof window !== 'undefined' && window.loadMockInterviewHistory !== loadMockInterviewHistory) ? window.loadMockInterviewHistory : null;

export async function saveInterviewSession() {
  if (typeof originalSaveInterviewSession === 'function') {
    return await originalSaveInterviewSession();
  }
}

export async function loadMockInterviewHistory() {
  if (typeof originalLoadMockInterviewHistory === 'function') {
    return await originalLoadMockInterviewHistory();
  }
}

// Bind to window for HTML event handlers and backward compatibility
if (typeof window !== 'undefined') {
  window.saveInterviewSession = saveInterviewSession;
  window.loadMockInterviewHistory = loadMockInterviewHistory;
  window.SFJR_MOCK_INTERVIEW = { saveInterviewSession, loadMockInterviewHistory };
}
