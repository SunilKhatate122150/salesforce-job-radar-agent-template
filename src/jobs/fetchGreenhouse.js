function normalize(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeHtmlToText(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGreenhouseJob(record, board) {
  return {
    title: normalize(record?.title),
    company: normalize(board?.company || board?.board_key),
    location: normalize(record?.location?.name),
    experience: "",
    description: normalizeHtmlToText(record?.content),
    skills: "",
    apply_link: normalize(record?.absolute_url),
    source_job_id: `greenhouse:${board.board_key}:${record?.id}`,
    source_platform: "greenhouse",
    source_quality_tier: "ats",
    ats_provider: "greenhouse",
    ats_board_key: normalize(board?.board_key),
    source_urls: [normalize(record?.absolute_url), normalize(board?.careers_url)].filter(Boolean),
    source_evidence: {
      provider: "greenhouse",
      board_key: normalize(board?.board_key),
      board_company: normalize(board?.company),
      updated_at: normalize(record?.updated_at),
      metadata: record?.metadata && typeof record.metadata === "object" ? record.metadata : {}
    },
    posted_at: normalize(record?.updated_at || record?.created_at) || null
  };
}

export async function fetchGreenhouseJobs({
  boards = [],
  maxUniqueResults = 100
} = {}) {
  const jobs = [];
  const coverage = [];
  let successfulBoards = 0;
  let errorCount = 0;
  let lastError = null;

  for (const board of boards) {
    if (jobs.length >= maxUniqueResults) {
      break;
    }

    const boardKey = normalize(board?.board_key);
    if (!boardKey) {
      continue;
    }

    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardKey)}/jobs?content=true`;
    try {
      const response = await fetch(url, {
        headers: {
          "accept": "application/json",
          "user-agent": "Mozilla/5.0 (compatible; SalesforceJobRadar/1.0)"
        }
      });

      if (!response.ok) {
        throw new Error(`Greenhouse board ${boardKey} returned status ${response.status}`);
      }

      const payload = await response.json();
      const boardJobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
      successfulBoards += 1;

      coverage.push({
        provider: "greenhouse",
        board_key: boardKey,
        company: normalize(board?.company),
        raw_count: boardJobs.length,
        salesforce_count: 0,
        error: ""
      });

      for (const record of boardJobs) {
        if (jobs.length >= maxUniqueResults) {
          break;
        }
        jobs.push(buildGreenhouseJob(record, board));
      }
    } catch (error) {
      errorCount += 1;
      lastError = error;
      coverage.push({
        provider: "greenhouse",
        board_key: boardKey,
        company: normalize(board?.company),
        raw_count: 0,
        salesforce_count: 0,
        error: normalize(error?.message)
      });
    }
  }

  if (successfulBoards === 0 && errorCount > 0) {
    throw new Error(lastError?.message || "Greenhouse fetch failed");
  }

  return {
    jobs,
    coverage
  };
}
