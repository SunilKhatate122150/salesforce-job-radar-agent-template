// Client entry point for Vite bundling
import './radar-cloud.js';
import './components.js';
import './data/navigation.js';
import './data/salesforceContent.js';
import './data/studyAnalytics.js';
import './data/careerIntelligence.js';
import '../app.js?v=20260525-menu-fix';
import './ui-shell.js';
import '../code-practice.js';

// Application Feature Modules
import './modules/api.js';
import './modules/toast.js';
import './modules/auth.js';
import './modules/router.js';
import './modules/navigation.js';
import './modules/studyTracker.js';
import './modules/jobRadar.js';
import './modules/profile.js';
import './modules/theme.js';
import './modules/releaseCenter.js';
import './modules/commandCenter.js';
import './modules/mockInterview.js';

// Phase 2 Modules
import { checkAndUpdateStreak, loadStreak, saveStreak } from './modules/streak.js';
import { renderSkillHeatmap, calculateSkillScores } from './modules/skillHeatmap.js';
import { renderWeeklyReport, generateWeeklyReport } from './modules/weeklyReport.js';
import { initNotificationCenter, addNotification } from './modules/notificationCenter.js';
import { initKeyboardShortcuts, toggleShortcutsModal } from './modules/shortcuts.js';
import { exportHistoryCsv, exportJobsCsv } from './modules/dataExport.js';
import { renderJobTimeline } from './modules/jobTimeline.js';
import { initQuickNotes, toggleQuickNotes } from './modules/quickNotes.js';

Object.assign(window, {
  checkAndUpdateStreak,
  loadStreak,
  saveStreak,
  renderSkillHeatmap,
  calculateSkillScores,
  renderWeeklyReport,
  generateWeeklyReport,
  initNotificationCenter,
  addNotification,
  initKeyboardShortcuts,
  toggleShortcutsModal,
  exportHistoryCsv,
  exportJobsCsv,
  renderJobTimeline,
  initQuickNotes,
  toggleQuickNotes
});
