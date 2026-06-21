// Shared API Router Helpers (Vite)
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { UserProfile, JobRecord, StudySession } from '../models/models.js';
import { TursoDB } from '../db/turso_driver.js';
import { isSupabaseEnabled, supabase } from '../db/supabase.js';
import { getRadarStatusStateKey } from '../api/radarContract.js';
import { loadJobStatusOverrides, saveJobStatusOverrideRecord } from '../services/jobRadarService.js';
import { buildHybridProfile } from '../services/profileService.js';
import { parseJsonBody } from '../api/requestSanitizer.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const dataCache = new Map();

let cachedDbPromise = null;
let dbConnectionAttempted = false;

export async function connectDB() {
  if (cachedDbPromise) return cachedDbPromise;
  if (!process.env.MONGODB_URI) {
    if (!dbConnectionAttempted) console.warn('[DB] MONGODB_URI missing; MongoDB routes will use fallback data only.');
    dbConnectionAttempted = true;
    return null;
  }
  cachedDbPromise = (async () => {
    try {
      dbConnectionAttempted = true;
      const db = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      console.log('[DB] MongoDB Connected');
      return db;
    } catch (err) {
      console.error('[DB] MongoDB Connection Failed (Skipping):', err.message);
      cachedDbPromise = null;
      return null;
    }
  })();
  return cachedDbPromise;
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

export function readBody(req) {
  return parseJsonBody(req.body);
}

export async function safeTursoRead(label, operation, fallback) {
  try {
    return await operation();
  } catch (err) {
    console.warn(`[Turso] ${label} unavailable; continuing with MongoDB only:`, err.message);
    return fallback;
  }
}

export async function safeMongoRead(label, operation, fallback) {
  if (!isMongoConnected()) return fallback;
  try {
    return await operation();
  } catch (err) {
    console.warn(`[Mongo] ${label} unavailable; continuing with fallback data:`, err.message);
    return fallback;
  }
}

export async function safeMongoWrite(label, operation) {
  if (!isMongoConnected()) {
    console.warn(`[Mongo] ${label} skipped; MongoDB is not connected.`);
    return false;
  }
  try {
    await operation();
    return true;
  } catch (err) {
    console.warn(`[Mongo] ${label} write unavailable; continuing with fallback storage:`, err.message);
    return false;
  }
}

export async function safeTursoWrite(label, operation) {
  try {
    await operation();
    return true;
  } catch (err) {
    console.warn(`[Turso] ${label} write unavailable; continuing with other storage:`, err.message);
    return false;
  }
}

export async function loadHybridProfile(userId, label = 'profile') {
  const [tursoProfile, mongoProfile] = await Promise.all([
    safeTursoRead(`${label} turso profile`, () => TursoDB.getProfile(userId), null),
    safeMongoRead(`${label} mongo profile`, () => UserProfile.findOne({ userId }).lean(), null)
  ]);

  const hybrid = buildHybridProfile({ tursoProfile, mongoProfile });
  return { ...hybrid, tursoProfile, mongoProfile };
}

export function mongoJobQuery(userId) {
  return { $or: [{ userId }, { userId: 'system' }] };
}

export function getCodePracticeCatalog() {
  return readDataJson('code-practice-challenges.json', { challenges: [] });
}

export function readDataJson(fileName, fallback = {}) {
  if (dataCache.has(fileName)) return dataCache.get(fileName);
  try {
    const fullPath = path.join(DATA_DIR, fileName);
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    dataCache.set(fileName, parsed);
    return parsed;
  } catch (err) {
    console.warn(`[DATA] Failed to read ${fileName}:`, err.message);
    return fallback;
  }
}

export function getStateTableName() {
  return String(process.env.STATE_BACKEND_TABLE || 'agent_state').trim() || 'agent_state';
}

export async function readJobStatusState(userId) {
  if (!isSupabaseEnabled()) return null;
  const { data, error } = await supabase
    .from(getStateTableName())
    .select('payload')
    .eq('state_key', getRadarStatusStateKey(userId))
    .maybeSingle();
  if (error) throw error;
  return data?.payload || null;
}

export async function writeJobStatusState(userId, payload) {
  if (!isSupabaseEnabled()) return false;
  const { error } = await supabase
    .from(getStateTableName())
    .upsert(
      {
        state_key: getRadarStatusStateKey(userId),
        payload,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'state_key' }
    );
  if (error) throw error;
  return true;
}

export async function getJobStatusOverrides(userId) {
  return loadJobStatusOverrides({
    userId,
    readState: () => readJobStatusState(userId),
    readMongoStatuses: async () => {
      if (mongoose.connection.readyState !== 1) return {};
      const profile = await UserProfile.findOne({ userId }).select('jobRadarStatuses').lean();
      return profile?.jobRadarStatuses || {};
    },
    onWarn: (label, err) => console.warn(`[STATUS] ${label} skipped:`, err.message)
  });
}

export async function saveJobStatusOverride(userId, statusKey, statusPayload) {
  return saveJobStatusOverrideRecord({
    userId,
    statusKey,
    statusPayload,
    source: 'vercel-api',
    writeMongoStatus: async () => {
      if (mongoose.connection.readyState !== 1) return false;
      await UserProfile.findOneAndUpdate(
        { userId },
        {
          $set: {
            userId,
            [`jobRadarStatuses.${statusKey}`]: statusPayload
          }
        },
        { upsert: true, new: true }
      );
      return true;
    },
    readState: () => readJobStatusState(userId),
    writeState: ({ payload }) => writeJobStatusState(userId, payload),
    onWarn: (label, err) => console.warn(`[STATUS] ${label} skipped:`, err.message)
  });
}

export async function checkAndArchiveOverflow(userId) {
  if (!isMongoConnected()) return;
  try {
    // Archiving jobs
    const MAX_MONGO_JOBS = 1500;
    const jobCount = await JobRecord.countDocuments({ userId });
    if (jobCount > MAX_MONGO_JOBS) {
      console.log(`[Vacuum] Jobs limit reached (${jobCount}/1500). Archiving 500...`);
      const toMove = await JobRecord.find({ userId, status: 'ignored' }).sort({ createdAt: 1 }).limit(500).lean();
      if (toMove.length > 0) {
        for (const job of toMove) {
          await safeTursoRead('archive job', () => TursoDB.saveJob(userId, job), null);
        }
        await JobRecord.deleteMany({ _id: { $in: toMove.map(j => j._id) } });
      }
    }

    // Archiving study sessions
    const MAX_MONGO_SESSIONS = 500;
    const sessionCount = await StudySession.countDocuments({ userId });
    if (sessionCount > MAX_MONGO_SESSIONS) {
      console.log(`[Vacuum] Sessions limit reached (${sessionCount}/500). Archiving 200...`);
      const sessionsToMove = await StudySession.find({ userId }).sort({ startTime: 1 }).limit(200).lean();
      if (sessionsToMove.length > 0) {
        for (const s of sessionsToMove) {
          await safeTursoRead('archive study session', () => TursoDB.saveStudySession(userId, s), null);
        }
        await StudySession.deleteMany({ _id: { $in: sessionsToMove.map(s => s._id) } });
      }
    }
  } catch (e) {
    console.error('[Vacuum] Error during automatic archival:', e.message);
  }
}
