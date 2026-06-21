// Dashboard Routes (Vite)
import { JobRecord, StudySession } from '../models/models.js';
import { TursoDB } from '../db/turso_driver.js';
import { readSupabaseTrackerJobs, readSupabaseJobAlertRows } from '../jobs/dashboardJobs.js';
import { readReleaseCenterPayload } from '../releases/releaseCenter.js';
import { buildDashboardSummary } from '../services/dashboardSummary.js';
import { buildStudySummaryHistory, getDailySummary, mergeStudyHistory } from '../services/studyService.js';
import { buildJobRadarRecords } from '../services/jobRadarService.js';
import {
  loadHybridProfile,
  safeTursoRead,
  safeMongoRead,
  getJobStatusOverrides,
  mongoJobQuery,
  readDataJson
} from './routeHelpers.js';

export async function handleDashboardSummary(req, res, userId) {
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'dashboard/summary');
  const profile = loadedProfile || { userId };
  const [tursoJobs, mongoJobs, trackerJobs, alertJobs, statusOverrides, studySessions, fallbackReleases] = await Promise.all([
    safeTursoRead('dashboard/summary jobs', () => TursoDB.getJobs(userId, 160), []),
    safeMongoRead('dashboard/summary jobs', () => JobRecord.find(mongoJobQuery(userId)).sort({ updatedAt: -1, createdAt: -1 }).limit(220).lean(), []),
    readSupabaseTrackerJobs(),
    readSupabaseJobAlertRows(180),
    getJobStatusOverrides(userId),
    safeMongoRead('dashboard/summary study', () => StudySession.find({ userId }).sort({ startTime: -1 }).limit(120).lean(), []),
    Promise.resolve(readDataJson('salesforce-releases.json', { activeRelease: {}, items: [] }))
  ]);
  const allReleases = await readReleaseCenterPayload(fallbackReleases);
  const summary = buildDashboardSummary({
    profile,
    jobs: buildJobRadarRecords({
      tursoJobs,
      mongoJobs,
      trackerJobs,
      alertJobs,
      statusOverrides,
      includeTurso: true,
      limit: 220
    }),
    studySessions,
    releases: allReleases,
    activityLog: []
  });
  return res.status(200).json(summary);
}

export async function handleSummary(req, res, userId, path) {
  const tursoSessions = await safeTursoRead('summary/history', () => TursoDB.getFullHistory(userId), []);
  const mongoSessions = await safeMongoRead(
    'summary/history',
    () => StudySession.find({ userId }).sort({ startTime: -1 }).limit(1000).lean(),
    []
  );
  const allSessions = mergeStudyHistory(tursoSessions, mongoSessions, 1000);
  
  const [mongoJobs, tursoJobs, trackerJobs, alertJobs, statusOverrides] = await Promise.all([
    safeMongoRead(
      'summary/jobs mongo',
      () => JobRecord.find(mongoJobQuery(userId)).sort({ createdAt: -1 }).limit(1000).lean(),
      []
    ),
    safeTursoRead('summary/jobs turso', () => TursoDB.getJobAnalytics(userId), []),
    readSupabaseTrackerJobs(),
    readSupabaseJobAlertRows(180),
    getJobStatusOverrides(userId)
  ]);
  const allJobs = buildJobRadarRecords({
    mongoJobs,
    tursoJobs,
    trackerJobs,
    alertJobs,
    statusOverrides,
    includeTurso: true,
    limit: 1000
  });
  
  console.log(`[SUMMARY] Hybrid Analyzing ${allSessions.length} sessions and ${allJobs.length} jobs`);
  
  const historyObj = buildStudySummaryHistory(allSessions, allJobs);
  const todayStr = new Date().toISOString().split('T')[0];
  if (path === 'summary/daily') return res.status(200).json(getDailySummary(historyObj, todayStr));
  return res.status(200).json(historyObj);
}
