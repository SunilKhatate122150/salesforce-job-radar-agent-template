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

function buildLeverLocation(record) {
  const categories = record?.categories && typeof record.categories === "object"
    ? record.categories
    : {};
  const allLocations = Array.isArray(categories?.allLocations)
    ? categories.allLocations.map(item => normalize(item?.location || item)).filter(Boolean)
    : [];
  return normalize(categories.location || allLocations[0]);
}

function buildLeverDescription(record) {
  return normalizeHtmlToText(
    record?.descriptionPlain ||
    record?.description ||
    record?.descriptionBodyPlain ||
    record?.openingPlain ||
    ""
  );
}

function buildLeverJob(record, board) {
  return {
    title: normalize(record?.text || record?.title),
    company: normalize(board?.company || board?.board_key),
    location: buildLeverLocation(record),
    experience: "",
    description: buildLeverDescription(record),
    skills: "",
    apply_link: normalize(record?.applyUrl || record?.hostedUrl),
    source_job_id: `lever:${board.board_key}:${record?.id}`,
    source_platform: "lever",
    source_quality_tier: "ats",
    ats_provider: "lever",
    ats_board_key: normalize(board?.board_key),
    source_urls: [
      normalize(record?.applyUrl),
      normalize(record?.hostedUrl),
      normalize(board?.careers_url)
    ].filter(Boolean),
    source_evidence: {
      provider: "lever",
      board_key: normalize(board?.board_key),
      board_company: normalize(board?.company),
      team: normalize(record?.categories?.team),
      department: normalize(record?.categories?.department),
      workplaceType: normalize(record?.workplaceType)
    },
    posted_at: normalize(record?.createdAt || record?.updatedAt || record?.hostedUrlDate) || null
  };
}

export async function fetchLeverJobs({
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

    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(boardKey)}?mode=json`;
    try {
      const response = await fetch(url, {
        headers: {
          "accept": "application/json",
          "user-agent": "Mozilla/5.0 (compatible; SalesforceJobRadar/1.0)"
        }
      });

      if (!response.ok) {
        throw new Error(`Lever board ${boardKey} returned status ${response.status}`);
      }

      const payload = await response.json();
      const boardJobs = Array.isArray(payload) ? payload : [];
      successfulBoards += 1;

      coverage.push({
        provider: "lever",
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
        jobs.push(buildLeverJob(record, board));
      }
    } catch (error) {
      errorCount += 1;
      lastError = error;
      coverage.push({
        provider: "lever",
        board_key: boardKey,
        company: normalize(board?.company),
        raw_count: 0,
        salesforce_count: 0,
        error: normalize(error?.message)
      });
    }
  }

  if (successfulBoards === 0 && errorCount > 0) {
    throw new Error(lastError?.message || "Lever fetch failed");
  }

  return {
    jobs,
    coverage
  };
}
