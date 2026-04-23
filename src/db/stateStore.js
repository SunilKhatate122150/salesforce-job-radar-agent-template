import { isSupabaseEnabled, supabase } from "./supabase.js";

function normalize(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function trimText(value, maxLength = 220) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function getStateBackend() {
  const explicit = normalize(
    process.env.STATE_BACKEND ||
      process.env.AGENT_STATE_BACKEND,
    ""
  ).toLowerCase();

  if (["local", "supabase", "mongodb"].includes(explicit)) {
    return explicit;
  }

  // Auto-detect MongoDB
  if (process.env.MONGODB_URI) {
    return "mongodb";
  }

  const runtimeTarget = normalize(
    process.env.AGENT_RUNTIME_TARGET,
    ""
  ).toLowerCase();
  if (runtimeTarget === "supabase_edge" || isTruthy(process.env.SUPABASE_CLOUD_MODE)) {
    return "supabase";
  }

  return "local";
}

export function usesMongoStateBackend() {
  return getStateBackend() === "mongodb";
}

export function usesSupabaseStateBackend() {
  return getStateBackend() === "supabase";
}

function isSupabaseStateRequired() {
  const explicit = normalize(process.env.STATE_BACKEND_REQUIRED, "");
  if (explicit) {
    return isTruthy(explicit);
  }

  return usesSupabaseStateBackend();
}

function getStateTableName() {
  return normalize(process.env.STATE_BACKEND_TABLE, "agent_state");
}

function ensureSupabaseStateReady(action, stateKey) {
  if (isSupabaseEnabled()) {
    return;
  }

  const reason =
    `Supabase state ${action} unavailable for ${stateKey}: ` +
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY missing";

  if (isSupabaseStateRequired()) {
    throw new Error(reason);
  }

  console.log(`⚠️ ${reason}`);
}

function handleStateError(action, stateKey, error) {
  const message = trimText(error?.message || error);
  const text = `Supabase state ${action} failed for ${stateKey}: ${message}`;

  if (isSupabaseStateRequired()) {
    throw new Error(text);
  }

  console.log(`⚠️ ${text}`);
}

export async function readSupabaseJsonState(stateKey) {
  if (usesMongoStateBackend()) {
     return readMongoJsonState(stateKey);
  }
  ensureSupabaseStateReady("read", stateKey);
  if (!isSupabaseEnabled()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from(getStateTableName())
      .select("payload")
      .eq("state_key", stateKey)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.payload ?? null;
  } catch (error) {
    handleStateError("read", stateKey, error);
    return null;
  }
}

export async function writeSupabaseJsonState(stateKey, payload) {
  if (usesMongoStateBackend()) {
     return writeMongoJsonState(stateKey, payload);
  }
  ensureSupabaseStateReady("write", stateKey);
  if (!isSupabaseEnabled()) {
    return false;
  }

  try {
    const { error } = await supabase
      .from(getStateTableName())
      .upsert(
        {
          state_key: stateKey,
          payload,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "state_key"
        }
      );

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    handleStateError("write", stateKey, error);
    return false;
  }
}

// ========================================
// MONGODB STATE BACKEND (Phase 2-5)
// ========================================
import mongoose from 'mongoose';
import { JobRecord } from '../models/models.js';

async function readMongoJsonState(stateKey) {
  try {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI);
    // For application tracker, we return the records array
    if (stateKey === 'application_tracker') {
       const records = await JobRecord.find({}).sort({ createdAt: -1 }).lean();
       return { records };
    }
    return null;
  } catch (e) {
    console.error('❌ MongoDB State Read Error:', e);
    return null;
  }
}

async function writeMongoJsonState(stateKey, payload) {
  try {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI);
    if (stateKey === 'application_tracker' && payload.records) {
       for (const rec of payload.records) {
         await JobRecord.findOneAndUpdate(
           { job_hash: rec.job_hash },
           { ...rec, userId: rec.userId || 'system' },
           { upsert: true }
         );
       }
       return true;
    }
    return false;
  } catch (e) {
    console.error('❌ MongoDB State Write Error:', e);
    return false;
  }
}
