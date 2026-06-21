// Study Tracker Module (Vite)
import { apiFetch, fetchWithTimeout } from './api.js';
import { showToast } from './toast.js';

let TRACKER_KEY = 'sf_prep_study_tracker_v3';
let globalStudyData = { topics: {}, sessions: [], completedTasks: [] };
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 60000;

export let currentTrackedPage = null;
export let trackingStartTime = null;
export let isPaused = false;
export let pausedElapsed = 0;
let baseSeconds = 0;
let floatingTimerInterval = null;

export function getGlobalStudyData() {
  return globalStudyData;
}

export function setGlobalStudyData(data) {
  globalStudyData = data;
}

export function getCurrentElapsed() {
  if (!currentTrackedPage) return 0;
  if (isPaused) return pausedElapsed;
  return pausedElapsed + Math.floor((Date.now() - trackingStartTime) / 1000);
}

export async function getStudyData(force = false) {
  const now = Date.now();
  if (!force && globalStudyData && (now - lastFetchTime < MIN_FETCH_INTERVAL)) {
    return globalStudyData;
  }
  
  try {
    lastFetchTime = now;
    const [historyRes, tasksRes] = await Promise.all([
      fetchWithTimeout('/api/study/history?cb=' + Date.now()),
      fetchWithTimeout('/api/study/tasks?cb=' + Date.now())
    ]);
    if (!historyRes.ok || !tasksRes.ok) {
      return globalStudyData || { topics: {}, sessions: [], completedTasks: [] };
    }
    const historyData = await historyRes.json();
    const tasksData = await tasksRes.json();
    
    globalStudyData = {
      topics: historyData.topics || {},
      sessions: historyData.sessions || [],
      completedTasks: tasksData.completedTasks || []
    };
    
    if (typeof window !== 'undefined') {
      window.globalStudyData = globalStudyData;
    }
    return globalStudyData;
  } catch (e) {
    console.error('[STUDY] Failed to fetch study data:', e);
    return globalStudyData || { topics: {}, sessions: [], completedTasks: [] };
  }
}

export async function startTracking(pageId) {
  const cfg = window.topicConfig ? window.topicConfig[pageId] : null;
  if (!cfg || cfg.noTimer) {
    var timerEl = document.getElementById('floatingTimer');
    if (timerEl) timerEl.style.display = 'none';
    return;
  }
  
  if (currentTrackedPage === pageId && !isPaused) return;
  if (currentTrackedPage && currentTrackedPage !== pageId) await stopTracking();
  
  var timerEl = document.getElementById('floatingTimer');
  if (timerEl) timerEl.style.display = 'flex';

  const localBase = parseInt((typeof window.getScopedItem === 'function' ? window.getScopedItem('timer_' + pageId, '0', 'timer_' + pageId) : localStorage.getItem('timer_' + pageId)) || '0');
  baseSeconds = localBase;
  
  getStudyData().then(data => {
    if (data.topics && data.topics[pageId]) {
      const serverSeconds = data.topics[pageId].totalSeconds;
      if (serverSeconds > baseSeconds) {
        baseSeconds = serverSeconds;
        updateFloatingTimer();
      }
    }
  });
  
  currentTrackedPage = pageId;
  trackingStartTime = Date.now();
  isPaused = false;
  pausedElapsed = 0;
  
  if (typeof window !== 'undefined') {
    window.currentTrackedPage = pageId;
    window.trackingStartTime = trackingStartTime;
    window.isPaused = isPaused;
    window.pausedElapsed = pausedElapsed;
  }

  updateFloatingTimer();
  startFloatingTimerInterval();
  
  var btn = document.getElementById('ftPlayPause');
  var iconPause = document.getElementById('ftIconPause');
  var iconPlay = document.getElementById('ftIconPlay');
  var dot = document.getElementById('ftDot');
  if (btn) { btn.className = 'ft-btn playing'; btn.title = 'Click to Pause'; }
  if (iconPause) iconPause.style.display = 'none';
  if (iconPlay) iconPlay.style.display = 'block';
  if (dot) dot.className = 'ft-dot';
  
  restoreLastQuestion(pageId);
  
  var activeEl = document.getElementById('currentlyStudying');
  var lightEl = document.getElementById('activeLight');
  if (activeEl && window.topicConfig && window.topicConfig[pageId]) activeEl.textContent = window.topicConfig[pageId].name;
  if (lightEl) lightEl.style.display = 'inline-block';
}

export function restoreLastQuestion(pageId) {
  const lastQ = typeof window.getScopedItem === 'function' ? window.getScopedItem('last_q_' + pageId, null, 'last_q_' + pageId) : localStorage.getItem('last_q_' + pageId);
  if (!lastQ) return;
  
  const page = document.getElementById(pageId);
  if (!page) return;
  
  const questions = page.querySelectorAll('.qa-q-text');
  questions.forEach(q => {
    if (q.textContent === lastQ) {
      q.parentElement.parentElement.classList.add('open');
      setTimeout(() => q.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  });
}

export async function stopTracking() {
  if (!currentTrackedPage) return;
  
  var elapsed = getCurrentElapsed();
  if (elapsed < 5) {
    currentTrackedPage = null;
    trackingStartTime = null;
    isPaused = false;
    pausedElapsed = 0;
    
    if (typeof window !== 'undefined') {
      window.currentTrackedPage = null;
      window.trackingStartTime = null;
      window.isPaused = false;
      window.pausedElapsed = 0;
    }
    return;
  }
  
  const total = baseSeconds + elapsed;
  if (typeof window.setScopedItem === 'function') {
    window.setScopedItem('timer_' + currentTrackedPage, total);
  } else {
    localStorage.setItem('timer_' + currentTrackedPage, String(total));
  }

  const now = new Date();
  const localDate = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');

  const session = {
    topic: currentTrackedPage,
    topicName: window.topicConfig && window.topicConfig[currentTrackedPage] ? window.topicConfig[currentTrackedPage].name : currentTrackedPage,
    duration: elapsed,
    startTime: new Date(trackingStartTime).toISOString(),
    endTime: now.toISOString(),
    date: localDate
  };
  
  if (typeof window.saveSession === 'function') {
    await window.saveSession(session);
  } else {
    try {
      await apiFetch('/api/study/session', {
        method: 'POST',
        body: JSON.stringify(session)
      });
    } catch (e) {
      console.error('[STUDY] Failed to save session:', e);
    }
  }
  
  if (globalStudyData) {
    globalStudyData.sessions.push(session);
    if (!globalStudyData.topics[session.topic]) {
      globalStudyData.topics[session.topic] = { totalSeconds: 0, sessions: 0, lastStudied: null };
    }
    globalStudyData.topics[session.topic].totalSeconds += session.duration;
    globalStudyData.topics[session.topic].sessions += 1;
    globalStudyData.topics[session.topic].lastStudied = session.date;
  }
  
  setTimeout(() => { if (typeof window.renderHistory === 'function') window.renderHistory(); }, 500);
  
  currentTrackedPage = null;
  trackingStartTime = null;
  isPaused = false;
  pausedElapsed = 0;
  
  if (typeof window !== 'undefined') {
    window.currentTrackedPage = null;
    window.trackingStartTime = null;
    window.isPaused = false;
    window.pausedElapsed = 0;
  }
  
  var activeEl = document.getElementById('currentlyStudying');
  var lightEl = document.getElementById('activeLight');
  var timerEl = document.getElementById('floatingTimer');
  if (activeEl) activeEl.textContent = '-';
  if (lightEl) lightEl.style.display = 'none';
  if (timerEl) timerEl.style.display = 'none';
  if (floatingTimerInterval) {
    clearInterval(floatingTimerInterval);
    floatingTimerInterval = null;
  }
}

export function togglePause() {
  if (!currentTrackedPage) return;
  
  var btn = document.getElementById('ftPlayPause');
  var dot = document.getElementById('ftDot');
  var iconPause = document.getElementById('ftIconPause');
  var iconPlay = document.getElementById('ftIconPlay');
  
  if (isPaused) {
    isPaused = false;
    trackingStartTime = Date.now();
    if (btn) { btn.className = 'ft-btn playing'; btn.title = 'Click to Pause'; }
    if (iconPause) iconPause.style.display = 'none';
    if (iconPlay) iconPlay.style.display = 'block';
    if (dot) dot.className = 'ft-dot';
    
    if (typeof window !== 'undefined') {
      window.isPaused = false;
      window.trackingStartTime = trackingStartTime;
    }
    startFloatingTimerInterval();
  } else {
    pausedElapsed += Math.floor((Date.now() - trackingStartTime) / 1000);
    isPaused = true;
    if (btn) { btn.className = 'ft-btn paused'; btn.title = 'Click to Resume'; }
    if (iconPause) iconPause.style.display = 'block';
    if (iconPlay) iconPlay.style.display = 'none';
    if (dot) dot.className = 'ft-dot paused';
    if (floatingTimerInterval) { clearInterval(floatingTimerInterval); floatingTimerInterval = null; }
    
    if (typeof window !== 'undefined') {
      window.isPaused = true;
      window.pausedElapsed = pausedElapsed;
    }
  }
}

export function updateFloatingTimer() {
  var ftTopic = document.getElementById('ftTopic');
  var ftTime = document.getElementById('ftTime');
  var ftDot = document.getElementById('ftDot');
  var ftBtn = document.getElementById('ftPlayPause');
  
  if (!currentTrackedPage) {
    if (ftTopic) ftTopic.textContent = 'No topic';
    if (ftTime) ftTime.textContent = '00:00';
    if (ftDot) ftDot.style.display = 'none';
    if (ftBtn) ftBtn.style.display = 'none';
    return;
  }
  
  if (ftDot) ftDot.style.display = 'inline-block';
  if (ftBtn) ftBtn.style.display = 'flex';
  
  var cfg = window.topicConfig ? window.topicConfig[currentTrackedPage] : null;
  if (ftTopic) ftTopic.textContent = cfg ? cfg.name : currentTrackedPage;
  
  var elapsed = getCurrentElapsed();
  var totalSeconds = baseSeconds + elapsed;
  var h = Math.floor(totalSeconds / 3600);
  var m = Math.floor((totalSeconds % 3600) / 60);
  var s = totalSeconds % 60;
  if (h > 0) {
    if (ftTime) ftTime.textContent = h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  } else {
    if (ftTime) ftTime.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }
}

export function startFloatingTimerInterval() {
  if (floatingTimerInterval) clearInterval(floatingTimerInterval);
  floatingTimerInterval = setInterval(function() {
    updateFloatingTimer();
    
    const isTrackerVisible = document.getElementById('study_tracker')?.style.display !== 'none';
    if (isTrackerVisible && typeof window.updateTrackerUI === 'function') {
      window.updateTrackerUI(true);
    }
  }, 1000);
}

export function formatTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '00s';
  var h = Math.floor(totalSeconds / 3600);
  var m = Math.floor((totalSeconds % 3600) / 60);
  var s = totalSeconds % 60;
  
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatTimeFull(totalSeconds) {
  var h = Math.floor(totalSeconds / 3600);
  var m = Math.floor((totalSeconds % 3600) / 60);
  var s = Math.floor(totalSeconds % 60);
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

export function updateCourseTargets() {
  try {
    const data = globalStudyData;
    if (!data || !data.topics) return;

    const analytics = typeof window.getStudyAnalytics === 'function' ? window.getStudyAnalytics() : {};
    const targets = analytics.calculateCourseTargets
      ? analytics.calculateCourseTargets(
        data,
        window.topicConfig || {},
        currentTrackedPage ? { topicId: currentTrackedPage, seconds: getCurrentElapsed() } : null,
        document.getElementById('studyDeadlineDays')?.value
      )
      : { remainingSec: 0, requiredDailySec: 0, progressPct: 0 };

    const progressEl = document.getElementById('courseTotalProgress');
    const dailyEl = document.getElementById('courseRequiredDaily');
    const remainEl = document.getElementById('courseRemainingTime');
    
    if (progressEl) progressEl.textContent = targets.progressPct + '%';
    if (dailyEl) dailyEl.textContent = (targets.requiredDailySec / 3600).toFixed(1) + ' hrs';
    if (remainEl) remainEl.textContent = formatTime(targets.remainingSec);
    
  } catch (e) {
    console.error('Goal update error', e);
  }
}

export async function updateTrackerUI(useCache = false) {
  if (typeof window.renderTrackerUI === 'function') {
    await window.renderTrackerUI(useCache);
  }
  updateCourseTargets();
}

// Bind to window for backward compatibility and index.html compatibility
if (typeof window !== 'undefined') {
  window.startTracking = startTracking;
  window.stopTracking = stopTracking;
  window.togglePause = togglePause;
  window.getStudyData = getStudyData;
  window.updateTrackerUI = updateTrackerUI;
  window.updateCourseTargets = updateCourseTargets;
  window.formatTime = formatTime;
  window.formatTimeFull = formatTimeFull;
  window.globalStudyData = globalStudyData;
  
  window.SFJR_STUDY_TRACKER = {
    startTracking,
    stopTracking,
    togglePause,
    getStudyData,
    updateTrackerUI,
    formatTime,
    formatTimeFull,
    updateCourseTargets
  };
}
