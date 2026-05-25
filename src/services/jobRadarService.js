import {
  filterDashboardFreshness,
  getDashboardFreshnessDays,
  mergeArrayValues,
  mergeDashboardJobs,
  normalizeDashboardJob,
  parseMaybeArray
} from '../jobs/dashboardJobs.js';
import { buildJobsDegradedPayload } from '../api/radarContract.js';

export function normalizeBoardStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'new') return 'todo';
  if (normalized === 'shortlisted' || normalized === 'follow_up') return 'todo';
  if (normalized === 'ignored') return 'rejected';
  if (['todo', 'applied', 'interview', 'offer', 'rejected'].includes(normalized)) return normalized;
  return 'todo';
}

export function encodeStatusKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function jobStatusCandidates(job = {}) {
  return [job.job_hash, job.jobHash, job.id, job._id]
    .map(value => value === undefined || value === null ? '' : String(value))
    .filter(Boolean);
}

export function findJobStatusOverride(overrides = {}, job = {}) {
  for (const candidate of jobStatusCandidates(job)) {
    const encoded = encodeStatusKey(candidate);
    if (encoded && overrides[encoded]) return overrides[encoded];
    if (overrides[candidate]) return overrides[candidate];
  }
  return null;
}

export function applyJobStatusOverrides(jobs = [], overrides = {}) {
  return jobs.map(job => {
    const override = findJobStatusOverride(overrides, job);
    if (!override) return job;
    const status = normalizeBoardStatus(override.status);
    return {
      ...job,
      status,
      board_status: status,
      statusUpdatedAt: override.updatedAt || override.statusUpdatedAt || job.statusUpdatedAt,
      appliedAt: override.appliedAt || job.appliedAt
    };
  });
}

export function buildJobStatusUpdate({ routeId = '', payload = {}, now = new Date() } = {}) {
  const decodedRouteId = String(routeId || '');
  const rawKey = payload.job_hash || payload.jobHash || payload.jobId || decodedRouteId;
  const normalizedKey = String(rawKey || '').trim();
  if (!normalizedKey) {
    return { ok: false, error: 'Missing job identifier' };
  }

  const status = normalizeBoardStatus(payload.status);
  const updatedAt = payload.updatedAt || now.toISOString();
  const appliedAt = status === 'applied'
    ? (payload.appliedAt || updatedAt)
    : (payload.appliedAt || '');
  const statusKey = encodeStatusKey(normalizedKey);

  return {
    ok: true,
    routeId: decodedRouteId,
    rawKey: normalizedKey,
    status,
    updatedAt,
    appliedAt,
    statusKey,
    statusPayload: {
      status,
      updatedAt,
      appliedAt,
      rawKey: normalizedKey,
      jobId: decodedRouteId
    }
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isUnsafeObjectKey(value) {
  return ['__proto__', 'prototype', 'constructor'].includes(String(value || ''));
}

export function normalizeJobStatusOverrideMap(overrides = {}) {
  if (!isPlainObject(overrides)) return {};
  const normalized = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!key || isUnsafeObjectKey(key) || !isPlainObject(value)) continue;
    const status = normalizeBoardStatus(value.status);
    const updatedAt = value.updatedAt || value.statusUpdatedAt || '';
    const appliedAt = status === 'applied' ? (value.appliedAt || updatedAt) : (value.appliedAt || '');
    normalized[key] = {
      ...value,
      status,
      updatedAt,
      appliedAt
    };
  }
  return normalized;
}

function extractStateStatuses(payload = {}) {
  if (!isPlainObject(payload)) return {};
  if (isPlainObject(payload.statuses)) return payload.statuses;
  const { updatedAt, source, generatedAt, success, error, ...possibleStatuses } = payload;
  return possibleStatuses;
}

export function mergeJobStatusOverrides(statePayload = {}, mongoStatuses = {}) {
  return {
    ...normalizeJobStatusOverrideMap(extractStateStatuses(statePayload)),
    ...normalizeJobStatusOverrideMap(mongoStatuses)
  };
}

export function buildJobStatusStatePayload({
  existingPayload = {},
  statusKey = '',
  statusPayload = {},
  source = 'job-radar-api'
} = {}) {
  const safeKey = String(statusKey || '').trim();
  if (!safeKey || isUnsafeObjectKey(safeKey)) {
    return { ok: false, error: 'Missing job status key' };
  }
  const statuses = normalizeJobStatusOverrideMap(extractStateStatuses(existingPayload));
  statuses[safeKey] = normalizeJobStatusOverrideMap({ [safeKey]: statusPayload })[safeKey] || statusPayload;
  return {
    ok: true,
    payload: {
      statuses,
      updatedAt: statuses[safeKey]?.updatedAt || new Date().toISOString(),
      source
    }
  };
}

export async function loadJobStatusOverrides({
  userId,
  readState,
  readMongoStatuses,
  onWarn = () => {}
} = {}) {
  if (!userId) return {};

  let statePayload = {};
  if (typeof readState === 'function') {
    try {
      statePayload = await readState(userId);
    } catch (err) {
      onWarn('Supabase status read', err);
    }
  }

  let mongoStatuses = {};
  if (typeof readMongoStatuses === 'function') {
    try {
      mongoStatuses = await readMongoStatuses(userId);
    } catch (err) {
      onWarn('Mongo status read', err);
    }
  }

  return mergeJobStatusOverrides(statePayload, mongoStatuses);
}

export async function saveJobStatusOverrideRecord({
  userId,
  statusKey,
  statusPayload,
  writeMongoStatus,
  readState,
  writeState,
  source = 'job-radar-api',
  onWarn = () => {}
} = {}) {
  let wroteMongo = false;
  let wroteState = false;

  if (userId && typeof writeMongoStatus === 'function') {
    try {
      wroteMongo = Boolean(await writeMongoStatus({ userId, statusKey, statusPayload }));
    } catch (err) {
      onWarn('Mongo status write', err);
    }
  }

  if (userId && typeof writeState === 'function') {
    try {
      const existingPayload = typeof readState === 'function' ? await readState(userId) : {};
      const statePayload = buildJobStatusStatePayload({
        existingPayload,
        statusKey,
        statusPayload,
        source
      });
      if (statePayload.ok) {
        wroteState = Boolean(await writeState({ userId, payload: statePayload.payload }));
      }
    } catch (err) {
      onWarn('Supabase status write', err);
    }
  }

  return {
    stored: wroteMongo || wroteState,
    mongo: wroteMongo,
    supabase: wroteState,
    wroteMongo,
    wroteState
  };
}

function normalizeSourceJobs(records = [], sourceLabel = '') {
  return records.map(job => sourceLabel ? normalizeDashboardJob(job, sourceLabel) : job);
}

export function mergeJobRadarSources({
  mongoJobs = [],
  tursoJobs = [],
  trackerJobs = [],
  alertJobs = [],
  includeTurso = true
} = {}) {
  return mergeDashboardJobs(
    normalizeSourceJobs(mongoJobs, 'Legacy (Mongo)'),
    includeTurso ? normalizeSourceJobs(tursoJobs, 'Primary (Turso)') : [],
    trackerJobs,
    alertJobs
  );
}

export function buildJobRadarRecords({
  mongoJobs = [],
  tursoJobs = [],
  trackerJobs = [],
  alertJobs = [],
  statusOverrides = {},
  includeTurso = true,
  limit = 180
} = {}) {
  const mergedJobs = mergeJobRadarSources({
    mongoJobs,
    tursoJobs,
    trackerJobs,
    alertJobs,
    includeTurso
  });
  return filterDashboardFreshness(
    applyJobStatusOverrides(mergedJobs, statusOverrides)
  ).slice(0, limit);
}

export function buildJobSourceCounts({
  mongoJobs = [],
  tursoJobs = [],
  trackerJobs = [],
  alertJobs = [],
  includeTurso = true
} = {}) {
  return {
    supabaseAlerts: alertJobs.length,
    applicationTracker: trackerJobs.length,
    ...(includeTurso ? { turso: tursoJobs.length } : {}),
    mongo: mongoJobs.length
  };
}

function buildStorageCapacity({
  mongoConnected = false,
  mongoCount = 0,
  records = [],
  degraded = {},
  storageMode = 'capacity'
} = {}) {
  if (storageMode === 'local') {
    if (mongoConnected) return 'Hot + Archive Reads Active';
    return records.length ? 'Archive Reads Active' : 'Cloud sources unavailable';
  }

  const capacityUsed = Math.min(Math.round((Number(mongoCount || 0) / 1500) * 100), 100);
  if (mongoConnected) return `${100 - capacityUsed}% Free`;
  return degraded.liveSources?.length ? 'Archive Reads Active' : 'MongoDB Offline';
}

export function buildJobRadarPayload({
  mongoJobs = [],
  tursoJobs = [],
  trackerJobs = [],
  alertJobs = [],
  statusOverrides = {},
  env = process.env,
  mongoConnected = false,
  mongoCount = mongoJobs.length,
  includeTurso = true,
  storageMode = 'capacity',
  source = '',
  includeOfflineError = false,
  limit = 180
} = {}) {
  const sourceCounts = buildJobSourceCounts({
    mongoJobs,
    tursoJobs,
    trackerJobs,
    alertJobs,
    includeTurso
  });
  const records = buildJobRadarRecords({
    mongoJobs,
    tursoJobs,
    trackerJobs,
    alertJobs,
    statusOverrides,
    includeTurso,
    limit
  });
  const degraded = buildJobsDegradedPayload({
    env,
    mongoConnected,
    sourceCounts
  });
  const payload = {
    records,
    dbStatus: Boolean(mongoConnected),
    count: records.length,
    freshnessDays: getDashboardFreshnessDays(),
    sourceCounts,
    degraded,
    storageCapacity: buildStorageCapacity({
      mongoConnected,
      mongoCount,
      records,
      degraded,
      storageMode
    })
  };

  if (source) payload.source = source;
  if (includeOfflineError && !mongoConnected && !records.length) {
    payload.error = env.MONGODB_URI ? 'mongodb_connection_failed' : 'missing_mongodb_uri';
  }
  return payload;
}

function sortEntries(map = {}, limit = 10) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ _id: key, count }));
}

export function buildJobAnalyticsPayload(jobs = [], { limit = 10 } = {}) {
  const matchedMap = {};
  const missingMap = {};
  const companyMap = {};

  jobs.forEach(job => {
    const matched = mergeArrayValues(job.skills, job.matched_skills);
    const missing = parseMaybeArray(job.missing_skills);
    const company = String(job.company || job.canonical_company || 'Unknown').trim();

    matched.forEach(skill => {
      if (skill) matchedMap[skill] = (matchedMap[skill] || 0) + 1;
    });
    missing.forEach(skill => {
      if (skill) missingMap[skill] = (missingMap[skill] || 0) + 1;
    });
    if (company) companyMap[company] = (companyMap[company] || 0) + 1;
  });

  const topMatched = sortEntries(matchedMap, limit);
  const topMissing = sortEntries(missingMap, limit);
  const topCompanies = sortEntries(companyMap, limit);

  return {
    totalJobs: jobs.length,
    topMatched,
    topMissing,
    topCompanies,
    matched_skills: topMatched,
    missing_skills: topMissing,
    top_companies: topCompanies,
    matchedSkills: topMatched,
    missingSkills: topMissing,
    jobs
  };
}

export function buildJobListPayload({
  mongoJobs = [],
  tursoJobs = [],
  trackerJobs = [],
  alertJobs = [],
  statusOverrides = {},
  includeTurso = true,
  limit = Number.POSITIVE_INFINITY
} = {}) {
  return {
    success: true,
    jobs: buildJobRadarRecords({
      mongoJobs,
      tursoJobs,
      trackerJobs,
      alertJobs,
      statusOverrides,
      includeTurso,
      limit
    })
  };
}
