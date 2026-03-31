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

function buildAshbyLocation(record) {
  const primary = normalize(record?.location);
  if (primary) return primary;

  const postal = record?.address?.postalAddress || {};
  const parts = [
    normalize(postal?.addressLocality),
    normalize(postal?.addressRegion),
    normalize(postal?.addressCountry)
  ].filter(Boolean);
  return parts.join(", ");
}

function buildAshbyJob(record, board) {
  return {
    title: normalize(record?.title),
    company: normalize(board?.company || board?.board_key),
    location: buildAshbyLocation(record),
    experience: "",
    description: normalize(record?.descriptionPlain) || normalizeHtmlToText(record?.descriptionHtml),
    skills: "",
    apply_link: normalize(record?.applyUrl || record?.jobUrl),
    source_job_id: `ashby:${board.board_key}:${normalize(record?.jobUrl || record?.applyUrl || record?.title)}`,
    source_platform: "ashby",
    source_quality_tier: "ats",
    ats_provider: "ashby",
    ats_board_key: normalize(board?.board_key),
    source_urls: [
      normalize(record?.applyUrl),
      normalize(record?.jobUrl),
      normalize(board?.careers_url)
    ].filter(Boolean),
    source_evidence: {
      provider: "ashby",
      board_key: normalize(board?.board_key),
      board_company: normalize(board?.company),
      workplaceType: normalize(record?.workplaceType),
      team: normalize(record?.team),
      department: normalize(record?.department),
      employmentType: normalize(record?.employmentType)
    },
    posted_at: normalize(record?.publishedAt) || null
  };
}

export async function fetchAshbyJobs({
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

    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardKey)}`;
    try {
      const response = await fetch(url, {
        headers: {
          "accept": "application/json",
          "user-agent": "Mozilla/5.0 (compatible; SalesforceJobRadar/1.0)"
        }
      });

      if (!response.ok) {
        throw new Error(`Ashby board ${boardKey} returned status ${response.status}`);
      }

      const payload = await response.json();
      const boardJobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
      successfulBoards += 1;

      coverage.push({
        provider: "ashby",
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
        jobs.push(buildAshbyJob(record, board));
      }
    } catch (error) {
      errorCount += 1;
      lastError = error;
      coverage.push({
        provider: "ashby",
        board_key: boardKey,
        company: normalize(board?.company),
        raw_count: 0,
        salesforce_count: 0,
        error: normalize(error?.message)
      });
    }
  }

  if (successfulBoards === 0 && errorCount > 0) {
    throw new Error(lastError?.message || "Ashby fetch failed");
  }

  return {
    jobs,
    coverage
  };
}
