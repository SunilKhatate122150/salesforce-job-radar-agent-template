import { isSupabaseEnabled, supabase } from "../db/supabase.js";

const ATS_REGISTRY_TABLE = String(process.env.ATS_REGISTRY_TABLE || "ats_board_registry").trim();
const JOB_ALERTS_TABLE = String(process.env.ATS_REGISTRY_SOURCE_TABLE || "job_alerts").trim();

function normalize(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeText(value) {
  return normalize(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(normalizeText(value));
}

function normalizeUrl(value) {
  const raw = normalize(value);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    url.hash = "";
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return raw.replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function normalizeGeoScope(value) {
  const scope = normalizeText(value);
  if (["india", "remote", "india_remote", "global"].includes(scope)) {
    return scope;
  }
  return "india_remote";
}

function normalizeProvider(value) {
  const provider = normalizeText(value);
  if (["greenhouse", "lever", "ashby"].includes(provider)) {
    return provider;
  }
  return "";
}

function normalizeBoardMode(value, fallback = "shadow") {
  const mode = normalizeText(value || fallback);
  if (mode === "live") return "live";
  if (["off", "disabled", "none"].includes(mode)) return "disabled";
  return "shadow";
}

function parseBoardUrl(value) {
  const url = normalizeUrl(value);
  if (!url) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = normalizeText(parsed.hostname);
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (host.includes("greenhouse.io")) {
    const boardsIndex = segments.findIndex(segment => normalizeText(segment) === "boards");
    const boardKey =
      boardsIndex >= 0
        ? normalize(segments[boardsIndex + 1])
        : normalize(segments[0]);
    if (!boardKey) return null;
    return {
      provider: "greenhouse",
      board_key: boardKey,
      careers_url: `https://boards.greenhouse.io/${boardKey}`
    };
  }

  if (host === "jobs.lever.co" || host.endsWith(".lever.co")) {
    const boardKey = normalize(segments[0]);
    if (!boardKey) return null;
    return {
      provider: "lever",
      board_key: boardKey,
      careers_url: `https://jobs.lever.co/${boardKey}`
    };
  }

  if (host === "jobs.ashbyhq.com" || host.endsWith(".ashbyhq.com")) {
    const boardKey = normalize(segments[0]);
    if (!boardKey) return null;
    return {
      provider: "ashby",
      board_key: boardKey,
      careers_url: `https://jobs.ashbyhq.com/${boardKey}`
    };
  }

  return null;
}

function getRegistryMode() {
  const mode = normalizeText(process.env.ATS_PROVIDER_MODE || "shadow");
  if (["off", "disabled", "none"].includes(mode)) return "off";
  if (mode === "live") return "live";
  return "shadow";
}

export function isAtsEnabled() {
  return getRegistryMode() !== "off" && isTruthy(process.env.ENABLE_ATS_PROVIDERS || "true");
}

export function getAtsProviderMode() {
  return getRegistryMode();
}

export function getEnabledAtsProviders() {
  if (!isAtsEnabled()) {
    return [];
  }

  return String(process.env.ATS_FETCH_PROVIDERS || "greenhouse,lever,ashby")
    .split(",")
    .map(value => normalizeProvider(value))
    .filter(Boolean);
}

function normalizeRegistryEntry(entry, source = "registry") {
  const provider = normalizeProvider(entry?.provider);
  const boardKey = normalize(entry?.board_key || entry?.board_slug || entry?.board_token);
  if (!provider || !boardKey) {
    return null;
  }

  const defaultBoardMode = getRegistryMode() === "live" ? "live" : "shadow";

  return {
    provider,
    board_key: boardKey,
    company: normalize(entry?.company || entry?.company_name || boardKey),
    careers_url: normalizeUrl(entry?.careers_url),
    geo_scope: normalizeGeoScope(entry?.geo_scope),
    priority: toNumber(entry?.priority, 50),
    active: entry?.active === undefined ? true : Boolean(entry.active),
    mode: normalizeBoardMode(entry?.mode, defaultBoardMode),
    source,
    metadata: entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : {}
  };
}

async function loadRegistryTableRows() {
  if (!isSupabaseEnabled()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from(ATS_REGISTRY_TABLE)
      .select("*")
      .eq("active", true)
      .order("priority", { ascending: false });

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.log(`⚠️ ATS registry table unavailable: ${error.message}`);
    return [];
  }
}

async function loadDerivedRowsFromJobAlerts() {
  if (!isSupabaseEnabled() || !isTruthy(process.env.ATS_DERIVE_FROM_JOB_ALERTS || "true")) {
    return [];
  }

  const limit = Math.max(20, toNumber(process.env.ATS_DERIVE_LIMIT, 180));

  try {
    const { data, error } = await supabase
      .from(JOB_ALERTS_TABLE)
      .select("company,apply_link,canonical_apply_url,last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.log(`⚠️ ATS registry derivation skipped: ${error.message}`);
    return [];
  }
}

function deriveEntriesFromRows(rows) {
  const derived = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const parsed =
      parseBoardUrl(row?.canonical_apply_url) ||
      parseBoardUrl(row?.apply_link);
    if (!parsed) {
      continue;
    }

    derived.push({
      provider: parsed.provider,
      board_key: parsed.board_key,
      company: normalize(row?.company || parsed.board_key),
      careers_url: parsed.careers_url,
      geo_scope: "india_remote",
      priority: 60,
      active: true,
      mode: "shadow",
      metadata: {
        derived_from: "job_alerts",
        last_seen_at: normalize(row?.last_seen_at)
      }
    });
  }

  return derived;
}

function mergeRegistryEntries(entries) {
  const merged = new Map();

  for (const entry of entries) {
    const normalized = normalizeRegistryEntry(entry, entry?.source || "registry");
    if (!normalized || !normalized.active || normalized.mode === "disabled") {
      continue;
    }

    const key = `${normalized.provider}:${normalized.board_key}`;
    const existing = merged.get(key);
    if (!existing || normalized.priority > existing.priority) {
      merged.set(key, normalized);
    }
  }

  return [...merged.values()].sort((left, right) =>
    right.priority - left.priority ||
    left.company.localeCompare(right.company) ||
    left.board_key.localeCompare(right.board_key)
  );
}

export async function loadAtsBoardRegistry() {
  if (!isAtsEnabled()) {
    return [];
  }

  const configuredProviders = new Set(getEnabledAtsProviders());
  const envRegistry = (() => {
    const raw = normalize(process.env.ATS_BOARD_REGISTRY_JSON);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.log(`⚠️ ATS_BOARD_REGISTRY_JSON ignored: ${error.message}`);
      return [];
    }
  })();

  const registryRows = await loadRegistryTableRows();
  const derivedRows =
    registryRows.length > 0
      ? []
      : deriveEntriesFromRows(await loadDerivedRowsFromJobAlerts());

  return mergeRegistryEntries([...envRegistry, ...registryRows, ...derivedRows]).filter(entry =>
    configuredProviders.has(entry.provider)
  );
}

export function groupAtsBoardsByProvider(entries) {
  const groups = new Map();

  for (const entry of Array.isArray(entries) ? entries : []) {
    const provider = normalizeProvider(entry?.provider);
    if (!provider) continue;
    if (!groups.has(provider)) {
      groups.set(provider, []);
    }
    groups.get(provider).push(entry);
  }

  return groups;
}

export function buildAtsCoverageSummary(coverageEntries) {
  const entries = Array.isArray(coverageEntries) ? coverageEntries : [];
  const providers = {};
  let totalBoards = 0;
  let totalLiveBoards = 0;
  let totalShadowBoards = 0;
  let totalRaw = 0;
  let totalSalesforce = 0;

  for (const entry of entries) {
    const provider = normalizeProvider(entry?.provider);
    if (!provider) continue;
    if (!providers[provider]) {
      providers[provider] = {
        board_count: 0,
        live_board_count: 0,
        shadow_board_count: 0,
        raw_count: 0,
        salesforce_count: 0,
        boards: []
      };
    }

    providers[provider].board_count += 1;
    if (normalizeBoardMode(entry?.mode) === "live") {
      providers[provider].live_board_count += 1;
      totalLiveBoards += 1;
    } else {
      providers[provider].shadow_board_count += 1;
      totalShadowBoards += 1;
    }
    providers[provider].raw_count += toNumber(entry?.raw_count);
    providers[provider].salesforce_count += toNumber(entry?.salesforce_count);
    providers[provider].boards.push({
      board_key: normalize(entry?.board_key),
      company: normalize(entry?.company),
      mode: normalizeBoardMode(entry?.mode),
      raw_count: toNumber(entry?.raw_count),
      salesforce_count: toNumber(entry?.salesforce_count),
      error: normalize(entry?.error)
    });

    totalBoards += 1;
    totalRaw += toNumber(entry?.raw_count);
    totalSalesforce += toNumber(entry?.salesforce_count);
  }

  return {
    mode: getAtsProviderMode(),
    total_board_count: totalBoards,
    live_board_count: totalLiveBoards,
    shadow_board_count: totalShadowBoards,
    raw_count: totalRaw,
    salesforce_count: totalSalesforce,
    providers
  };
}

export function getAtsProviderBoardLimit() {
  return Math.max(1, toNumber(process.env.ATS_MAX_BOARDS_PER_PROVIDER, 6));
}
