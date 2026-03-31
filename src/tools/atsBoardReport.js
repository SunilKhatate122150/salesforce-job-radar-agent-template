import "dotenv/config";
import { isSupabaseEnabled, supabase } from "../db/supabase.js";

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

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    timeZone: process.env.TZ || "Asia/Calcutta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function parseArgs(argv) {
  const options = {
    limit: 12,
    source: "",
    provider: "",
    json: false
  };

  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      options.limit = Math.max(1, Math.min(100, toNumber(arg.split("=")[1], 12)));
      continue;
    }
    if (arg.startsWith("--source=")) {
      options.source = normalize(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--provider=")) {
      options.provider = normalizeText(arg.split("=")[1]);
    }
  }

  return options;
}

function getRunHistoryTable() {
  return normalize(process.env.RUN_HISTORY_TABLE, "agent_run_history");
}

function getAtsCoverage(details) {
  if (!details || typeof details !== "object") {
    return {};
  }

  return details.atsCoverage || details?.providerCoverage?.ats_coverage || {};
}

function createBoardAggregate(provider, board) {
  return {
    provider,
    board_key: normalize(board?.board_key),
    company: normalize(board?.company || board?.board_key),
    mode: normalizeText(board?.mode || "shadow") || "shadow",
    runs_seen: 0,
    raw_total: 0,
    salesforce_total: 0,
    nonzero_salesforce_runs: 0,
    zero_salesforce_runs: 0,
    error_runs: 0,
    last_seen_at: "",
    last_error: "",
    latest_raw_count: 0,
    latest_salesforce_count: 0
  };
}

function buildRecommendation(board) {
  if (board.error_runs >= 2) {
    return "investigate";
  }

  if (board.mode === "live") {
    if (board.salesforce_total === 0 && board.runs_seen >= 3) {
      return "review_live";
    }
    return "keep_live";
  }

  if (board.salesforce_total >= 2 && board.nonzero_salesforce_runs >= 2) {
    return "review_for_live";
  }

  if (board.salesforce_total >= 1 && board.runs_seen <= 2) {
    return "watch_closely";
  }

  if (board.raw_total > 0 && board.salesforce_total === 0 && board.runs_seen >= 3) {
    return "keep_shadow";
  }

  return "observe";
}

function rankBoards(left, right) {
  return (
    toNumber(right.salesforce_total) - toNumber(left.salesforce_total) ||
    toNumber(right.nonzero_salesforce_runs) - toNumber(left.nonzero_salesforce_runs) ||
    toNumber(right.raw_total) - toNumber(left.raw_total) ||
    normalize(left.provider).localeCompare(normalize(right.provider)) ||
    normalize(left.company).localeCompare(normalize(right.company)) ||
    normalize(left.board_key).localeCompare(normalize(right.board_key))
  );
}

function buildReport(rows, options) {
  const boards = new Map();
  const providerSummary = new Map();
  let processedRuns = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const atsCoverage = getAtsCoverage(row?.details);
    const providers = atsCoverage?.providers && typeof atsCoverage.providers === "object"
      ? atsCoverage.providers
      : {};
    processedRuns += 1;

    for (const [provider, providerData] of Object.entries(providers)) {
      if (options.provider && provider !== options.provider) {
        continue;
      }

      if (!providerSummary.has(provider)) {
        providerSummary.set(provider, {
          provider,
          runs_seen: 0,
          board_mentions: 0,
          raw_total: 0,
          salesforce_total: 0,
          live_board_mentions: 0,
          shadow_board_mentions: 0
        });
      }

      const summary = providerSummary.get(provider);
      summary.runs_seen += 1;
      summary.raw_total += toNumber(providerData?.raw_count);
      summary.salesforce_total += toNumber(providerData?.salesforce_count);
      summary.live_board_mentions += toNumber(providerData?.live_board_count);
      summary.shadow_board_mentions += toNumber(providerData?.shadow_board_count);

      const providerBoards = Array.isArray(providerData?.boards) ? providerData.boards : [];
      for (const board of providerBoards) {
        const key = `${provider}:${normalize(board?.board_key)}`;
        if (!boards.has(key)) {
          boards.set(key, createBoardAggregate(provider, board));
        }

        const aggregate = boards.get(key);
        aggregate.mode = normalizeText(board?.mode || aggregate.mode || "shadow") || "shadow";
        aggregate.runs_seen += 1;
        aggregate.raw_total += toNumber(board?.raw_count);
        aggregate.salesforce_total += toNumber(board?.salesforce_count);
        aggregate.latest_raw_count = toNumber(board?.raw_count);
        aggregate.latest_salesforce_count = toNumber(board?.salesforce_count);
        aggregate.last_seen_at = row?.started_at || aggregate.last_seen_at;
        aggregate.company = normalize(board?.company || aggregate.company || aggregate.board_key);

        if (toNumber(board?.salesforce_count) > 0) {
          aggregate.nonzero_salesforce_runs += 1;
        } else {
          aggregate.zero_salesforce_runs += 1;
        }

        if (normalize(board?.error)) {
          aggregate.error_runs += 1;
          aggregate.last_error = normalize(board?.error);
        }

        summary.board_mentions += 1;
      }
    }
  }

  const boardRows = [...boards.values()]
    .map(board => ({
      ...board,
      recommendation: buildRecommendation(board)
    }))
    .sort(rankBoards);

  const providerRows = [...providerSummary.values()].sort((left, right) =>
    toNumber(right.salesforce_total) - toNumber(left.salesforce_total) ||
    toNumber(right.raw_total) - toNumber(left.raw_total) ||
    normalize(left.provider).localeCompare(normalize(right.provider))
  );

  return {
    options,
    aggregate: {
      processed_runs: processedRuns,
      provider_count: providerRows.length,
      board_count: boardRows.length,
      promotion_review_candidates: boardRows.filter(board => board.recommendation === "review_for_live").length,
      live_boards: boardRows.filter(board => board.mode === "live").length,
      shadow_boards: boardRows.filter(board => board.mode !== "live").length
    },
    providers: providerRows,
    boards: boardRows
  };
}

function printTextReport(report) {
  console.log("Job Radar ATS board report");
  console.log(
    `- scope: ${report.options.source || "all sources"} | recent runs: ${report.aggregate.processed_runs}`
  );
  console.log(
    `- providers: ${report.aggregate.provider_count} | boards: ${report.aggregate.board_count} | live: ${report.aggregate.live_boards} | shadow: ${report.aggregate.shadow_boards}`
  );
  console.log(
    `- promotion review candidates: ${report.aggregate.promotion_review_candidates}`
  );

  console.log("\nProviders");
  for (const provider of report.providers) {
    console.log(
      `- ${provider.provider} | raw ${provider.raw_total} | salesforce ${provider.salesforce_total} | live mentions ${provider.live_board_mentions} | shadow mentions ${provider.shadow_board_mentions}`
    );
  }

  console.log("\nBoards");
  if (report.boards.length === 0) {
    console.log("- No ATS board coverage found in the selected runs.");
    return;
  }

  for (const board of report.boards) {
    console.log(
      `- ${board.provider}/${board.board_key} | ${board.company} | mode ${board.mode} | SF ${board.salesforce_total}/${board.raw_total} | nonzero runs ${board.nonzero_salesforce_runs}/${board.runs_seen} | ${board.recommendation}`
    );
    console.log(
      `  latest: ${formatDateTime(board.last_seen_at)} | latest raw ${board.latest_raw_count} | latest SF ${board.latest_salesforce_count}`
    );
    if (board.last_error) {
      console.log(`  last error: ${board.last_error}`);
    }
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));

  if (!isSupabaseEnabled()) {
    console.log(
      "ATS board report needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY in the environment."
    );
    process.exitCode = 1;
    return;
  }

  let query = supabase
    .from(getRunHistoryTable())
    .select("source,started_at,details")
    .order("started_at", { ascending: false })
    .limit(options.limit);

  if (options.source) {
    query = query.eq("source", options.source);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const report = buildReport(data || [], options);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printTextReport(report);
}

run().catch(error => {
  console.log("ATS board report failed:", error.message);
  process.exitCode = 1;
});
