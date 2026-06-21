// Job Routes (Vite)
import fetch from 'node-fetch';
import { JobRecord } from '../models/models.js';
import { TursoDB } from '../db/turso_driver.js';
import { readSupabaseJobAlertRows, readSupabaseTrackerJobs } from '../jobs/dashboardJobs.js';
import {
  buildJobAnalyticsPayload,
  buildJobListPayload,
  buildJobRadarPayload,
  buildJobRadarRecords,
  buildJobStatusUpdate
} from '../services/jobRadarService.js';
import {
  safeTursoRead,
  safeMongoRead,
  getJobStatusOverrides,
  mongoJobQuery,
  isMongoConnected,
  checkAndArchiveOverflow,
  saveJobStatusOverride,
  readBody
} from './routeHelpers.js';

export async function handleJobs(req, res, userId) {
  const [tursoJobs, mongoJobs, trackerJobs, alertJobs] = await Promise.all([
    safeTursoRead('jobs', () => TursoDB.getJobs(userId, 160), []),
    safeMongoRead(
      'jobs',
      () => JobRecord.find(mongoJobQuery(userId)).sort({ updatedAt: -1, createdAt: -1 }).limit(220).lean(),
      []
    ),
    readSupabaseTrackerJobs(),
    readSupabaseJobAlertRows(180)
  ]);
  const statusOverrides = await getJobStatusOverrides(userId);
  const mongoCount = await safeMongoRead('jobs count', () => JobRecord.countDocuments({ userId }), 0);
  const payload = buildJobRadarPayload({
    mongoJobs,
    tursoJobs,
    trackerJobs,
    alertJobs,
    statusOverrides,
    env: process.env,
    mongoConnected: isMongoConnected(),
    mongoCount,
    includeTurso: true,
    storageMode: 'capacity'
  });

  console.log(`[JOBS] Unified Fetch -> Supabase alerts: ${alertJobs.length}, Tracker: ${trackerJobs.length}, Turso: ${tursoJobs.length}, Mongo: ${mongoJobs.length}, Total: ${payload.count}`);

  checkAndArchiveOverflow(userId);
  return res.status(200).json(payload);
}

export async function handleJobsScan(req, res, userId) {
  let result;
  try {
    result = await triggerCloudJobScan(userId);
  } catch (scanErr) {
    console.error('[SCAN] Cloud trigger failed; falling back to cached mode:', scanErr.message);
    result = {
      queued: false,
      mode: 'cached',
      message: 'Cloud scan trigger failed; showing latest cached jobs while the agent configuration is checked.'
    };
  }
  return res.status(200).json({
    success: true,
    ...result
  });
}

async function triggerCloudJobScan(userId) {
  const repo = process.env.GITHUB_REPOSITORY || process.env.JOB_RADAR_GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.JOB_RADAR_GITHUB_TOKEN;
  const workflow = process.env.GITHUB_WORKFLOW_FILE || 'salesforce-job-radar-agent.yml';
  const ref = process.env.GITHUB_REF_NAME || process.env.GITHUB_BRANCH || 'main';

  if (!repo || !token) {
    return {
      queued: false,
      mode: 'cached',
      message: 'Cloud scan credentials are not configured; showing latest cached MongoDB/Turso jobs.'
    };
  }

  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'salesforce-job-radar-agent'
    },
    body: JSON.stringify({ ref })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GitHub dispatch failed (${response.status}): ${text.slice(0, 180)}`);
  }

  return {
    queued: true,
    mode: 'github-actions',
    message: 'Cloud job radar workflow queued successfully.'
  };
}

export async function handleJobsAnalytics(req, res, userId) {
  const [tursoJobs, mongoJobs, trackerJobs, alertJobs, statusOverrides] = await Promise.all([
    safeTursoRead('jobs/analytics', () => TursoDB.getJobAnalytics(userId), []),
    safeMongoRead('jobs/analytics', () => JobRecord.find(mongoJobQuery(userId)).lean(), []),
    readSupabaseTrackerJobs(),
    readSupabaseJobAlertRows(180),
    getJobStatusOverrides(userId)
  ]);
  const combined = buildJobRadarRecords({
    tursoJobs,
    mongoJobs,
    trackerJobs,
    alertJobs,
    statusOverrides,
    includeTurso: true,
    limit: 220
  });
  console.log(`[ANALYTICS] Hybrid Merging ${combined.length} records for ${userId}`);
  return res.status(200).json(buildJobAnalyticsPayload(combined));
}

export async function handleJobsList(req, res, userId) {
  const [mongoJobs, tursoJobs, trackerJobs, alertJobs] = await Promise.all([
    safeMongoRead(
      'jobs/list',
      () => JobRecord.find(mongoJobQuery(userId)).sort({ date_added: -1, createdAt: -1 }).limit(220).lean(),
      []
    ),
    safeTursoRead('jobs/list', () => TursoDB.getJobAnalytics(userId), []),
    readSupabaseTrackerJobs(),
    readSupabaseJobAlertRows(180)
  ]);
  return res.status(200).json(buildJobListPayload({
    mongoJobs,
    tursoJobs,
    trackerJobs,
    alertJobs,
    statusOverrides: await getJobStatusOverrides(userId),
    includeTurso: true
  }));
}

export async function handleJobStatusUpdate(req, res, userId, routeId) {
  const payload = readBody(req);
  const update = buildJobStatusUpdate({ routeId, payload });
  if (!update.ok) return res.status(400).json({ success: false, error: update.error });

  const storage = await saveJobStatusOverride(userId, update.statusKey, update.statusPayload);
  if (!storage.stored) {
    return res.status(503).json({
      success: false,
      error: 'Job status sync is temporarily unavailable. Configure MongoDB or Supabase state storage for cloud status updates.'
    });
  }

  return res.status(200).json({
    success: true,
    status: update.status,
    updatedAt: update.updatedAt,
    appliedAt: update.appliedAt,
    key: update.statusKey,
    storage
  });
}
