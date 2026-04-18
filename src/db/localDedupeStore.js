import {
  readSupabaseJsonState,
  usesSupabaseStateBackend,
  writeSupabaseJsonState
} from "./stateStore.js";
import { readJsonFile, writeJsonFile } from "../utils/localJsonFile.js";

const STORE_PATH = new URL("../../.cache/job-hashes.json", import.meta.url);
const STATE_KEY = "job_hashes";
const MAX_HASHES = 10000;

let memoryCache = null;
let cacheDirty = false;

function normalizeHashes(parsed) {
  if (Array.isArray(parsed)) return new Set(parsed);
  if (Array.isArray(parsed?.hashes)) return new Set(parsed.hashes);
  return new Set();
}

async function loadStore() {
  if (memoryCache) return memoryCache;

  let parsed;
  if (usesSupabaseStateBackend()) {
    parsed = await readSupabaseJsonState(STATE_KEY);
  } else {
    try {
      parsed = await readJsonFile(STORE_PATH);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.log("⚠️ Local dedupe read failed:", error.message);
      }
    }
  }
  memoryCache = normalizeHashes(parsed);
  return memoryCache;
}

export async function flushStore() {
  if (!memoryCache || !cacheDirty) return;

  let hashArray = [...memoryCache];
  if (hashArray.length > MAX_HASHES) {
    hashArray = hashArray.slice(-MAX_HASHES);
    memoryCache = new Set(hashArray);
  }

  const payload = {
    hashes: hashArray,
    updated_at: new Date().toISOString()
  };

  if (usesSupabaseStateBackend()) {
    await writeSupabaseJsonState(STATE_KEY, payload);
  } else {
    await writeJsonFile(STORE_PATH, payload);
  }
  cacheDirty = false;
}

export async function hasLocalHash(jobHash) {
  const hashes = await loadStore();
  return hashes.has(jobHash);
}

export async function saveLocalHash(jobHash) {
  const hashes = await loadStore();
  if (hashes.has(jobHash)) return false;

  hashes.add(jobHash);
  cacheDirty = true;
  return true;
}

