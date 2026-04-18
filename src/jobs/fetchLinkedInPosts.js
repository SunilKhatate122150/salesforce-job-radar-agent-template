const DUCKDUCKGO_HTML = "https://html.duckduckgo.com/html/";
const BRAVE_SEARCH_URL = "https://search.brave.com/search";

const DEFAULT_LOCATION =
  process.env.LINKEDIN_LOCATION || process.env.NAUKRI_LOCATION || "India";

const ROLE_PATTERNS = [
  /salesforce(?:\s+platform)?\s+developer/i,
  /salesforce\s+engineer/i,
  /salesforce\s+consultant/i,
  /apex\s+developer/i,
  /lwc\s+developer/i,
  /lightning\s+developer/i,
  /sfdc\s+developer/i,
  /salesforce\s+administrator/i,
  /salesforce\s+architect/i,
  /salesforce\s+business\s+analyst/i
];

const LOCATION_PATTERNS = [
  "Remote",
  "India",
  "Bengaluru",
  "Bangalore",
  "Hyderabad",
  "Pune",
  "Mumbai",
  "Delhi",
  "Gurugram",
  "Noida",
  "Chennai",
  "Kolkata"
];

const QUERY_ROLE_SEEDS = [
  "Salesforce Developer",
  "Apex Developer",
  "LWC Developer",
  "Salesforce Engineer"
];

const QUERY_SUFFIXES = [
  "hiring",
  "\"we are hiring\"",
  "\"job opening\"",
  "\"looking for\"",
  "\"share your resume\"",
  "\"immediate joiner\"",
  "\"talent acquisition\"",
  "\"urgently hiring\"",
  "\"urgent requirement\""
];

const QUERY_SITE_TARGETS = [
  "site:linkedin.com/posts",
  "site:linkedin.com/feed/update"
];

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " "));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function trimText(value, maxLength = 160) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function extractEmail(text) {
  const match = String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function normalizeApplyLink(link) {
  const raw = String(link || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return raw.replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function makeStablePostId(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function getPlanKeywords(plan, maxKeywords = 2) {
  const keywords = Array.isArray(plan?.keywords)
    ? plan.keywords.map(value => String(value || "").trim()).filter(Boolean)
    : [];

  if (keywords.length > 0) return keywords.slice(0, maxKeywords);
  return ["Salesforce Developer"];
}

export function buildSearchQueries(plans) {
  const maxQueries = Math.max(
    1,
    Number(process.env.LINKEDIN_POSTS_QUERIES_PER_RUN || 6)
  );
  const planKeywords = [];

  for (const plan of Array.isArray(plans) ? plans : []) {
    planKeywords.push(...getPlanKeywords(plan, 2));
  }

  const keywords = [...new Set([...planKeywords, ...QUERY_ROLE_SEEDS])];
  const locations = [DEFAULT_LOCATION, "remote", "india remote"];
  const queries = [];
  const seen = new Set();
  const keywordSitePairs = [];

  for (const keyword of keywords) {
    for (const siteTarget of QUERY_SITE_TARGETS) {
      keywordSitePairs.push({ keyword, siteTarget });
    }
  }

  let cycle = 0;
  const maxCycles = QUERY_SUFFIXES.length * locations.length;
  while (queries.length < maxQueries && cycle < maxCycles) {
    for (let pairIndex = 0; pairIndex < keywordSitePairs.length; pairIndex += 1) {
      const pair = keywordSitePairs[pairIndex];
      const suffix =
        QUERY_SUFFIXES[(pairIndex + cycle) % QUERY_SUFFIXES.length];
      const location = locations[(pairIndex + cycle) % locations.length];
      const query = `${pair.siteTarget} "${pair.keyword}" ${suffix} "${location}"`;
      if (seen.has(query)) {
        continue;
      }

      seen.add(query);
      queries.push(query);
      if (queries.length >= maxQueries) {
        break;
      }
    }

    cycle += 1;
  }

  return queries;
}

function decodeDuckDuckGoUrl(rawHref) {
  const href = decodeHtml(String(rawHref || "").trim());
  if (!href) return "";

  try {
    const normalized = href.startsWith("//")
      ? `https:${href}`
      : href.startsWith("/")
        ? `https://duckduckgo.com${href}`
        : href;
    const url = new URL(normalized);
    const nested = url.searchParams.get("uddg");
    return normalizeApplyLink(nested || normalized);
  } catch {
    return normalizeApplyLink(href);
  }
}

function parseSearchResults(html) {
  const results = [];
  const regex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>)?/gi;

  for (const match of html.matchAll(regex)) {
    const href = decodeDuckDuckGoUrl(match[1]);
    const title = stripHtml(match[2]);
    const snippet = stripHtml(match[4] || match[5] || "");
    if (!href || !title) continue;

    results.push({ href, title, snippet });
  }

  return results;
}

function isLikelyLinkedInPost(url) {
  const normalized = normalizeText(url);
  return (
    normalized.includes("linkedin.com/posts/") ||
    normalized.includes("linkedin.com/feed/update/")
  );
}

function hasHiringSignals(text) {
  const normalized = normalizeText(text);
  return (
    normalized.includes("hiring") ||
    normalized.includes("#hiring") ||
    normalized.includes("looking for") ||
    normalized.includes("job opening") ||
    normalized.includes("opening") ||
    normalized.includes("apply now") ||
    normalized.includes("vacancy") ||
    normalized.includes("share your resume") ||
    normalized.includes("send your cv") ||
    normalized.includes("send your resume") ||
    normalized.includes("talent acquisition") ||
    normalized.includes("immediate joiner")
  );
}

function hasSalesforceSignals(text) {
  const normalized = normalizeText(text);
  return (
    normalized.includes("salesforce") ||
    normalized.includes("apex") ||
    normalized.includes("lwc") ||
    normalized.includes("sfdc") ||
    normalized.includes("lightning")
  );
}

function extractPostedAt(text) {
  const raw = decodeHtml(String(text || ""));
  if (!raw) return null;

  const patterns = [
    { regex: /(\d+)\s*(?:m|min|mins|minute|minutes)\b/i, unit: "minutes" },
    { regex: /(\d+)\s*(?:h|hr|hrs|hour|hours)\b/i, unit: "hours" },
    { regex: /(\d+)\s*(?:d|day|days)\b/i, unit: "days" },
    { regex: /(\d+)\s*(?:w|week|weeks)\b/i, unit: "weeks" }
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern.regex);
    if (!match) continue;

    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) continue;

    const date = new Date();
    if (pattern.unit === "minutes") date.setMinutes(date.getMinutes() - value);
    if (pattern.unit === "hours") date.setHours(date.getHours() - value);
    if (pattern.unit === "days") date.setDate(date.getDate() - value);
    if (pattern.unit === "weeks") date.setDate(date.getDate() - (value * 7));
    return date.toISOString();
  }

  const absolutePatterns = [
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),\s*(\d{4})\b/i
  ];

  for (const pattern of absolutePatterns) {
    const match = raw.match(pattern);
    if (!match) continue;

    const monthFirst = Number.isNaN(Number(match[1]));
    const monthName = monthFirst ? match[1] : match[2];
    const day = Number(monthFirst ? match[2] : match[1]);
    const year = Number(match[3]);
    const date = new Date(`${monthName} ${day}, ${year} 00:00:00 GMT`);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function extractRole(text) {
  const raw = String(text || "");
  const matched = ROLE_PATTERNS.find(pattern => pattern.test(raw));
  if (!matched) return "";
  const result = raw.match(matched);
  return decodeHtml(result?.[0] || "");
}

function inferRoleFromSignals(text) {
  const normalized = normalizeText(text);
  if (!normalized) return "";
  if (normalized.includes("apex")) return "Apex Developer";
  if (normalized.includes("lwc") || normalized.includes("lightning web component")) {
    return "LWC Developer";
  }
  if (normalized.includes("salesforce engineer")) return "Salesforce Engineer";
  if (normalized.includes("salesforce consultant")) return "Salesforce Consultant";
  if (normalized.includes("salesforce administrator")) return "Salesforce Administrator";
  if (normalized.includes("salesforce")) return "Salesforce Developer";
  return "";
}

function extractCompany(text) {
  const raw = decodeHtml(String(text || ""));
  const match = raw.match(/\b(?:at|with|for)\s+([A-Z][A-Za-z0-9&.,\- ]{2,60})/);
  return match ? match[1].trim().replace(/\s+on LinkedIn$/i, "") : "";
}

function extractAuthor(title) {
  const raw = decodeHtml(String(title || ""));
  const match = raw.match(/^(.+?)\s+on LinkedIn/i);
  return match ? match[1].trim() : "";
}

function extractLocation(text) {
  const raw = decodeHtml(String(text || ""));
  for (const keyword of LOCATION_PATTERNS) {
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (regex.test(raw)) return keyword;
  }
  return "";
}

function extractMetaTag(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = String(html || "").match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }

  return "";
}

function extractJsonLdField(html, fieldName) {
  const matches = String(html || "").match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const tag of matches) {
    const payload = tag.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const parsed = JSON.parse(payload);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        if (candidate && typeof candidate === "object" && candidate[fieldName]) {
          if (typeof candidate[fieldName] === "string") {
            return decodeHtml(String(candidate[fieldName]));
          }
          if (typeof candidate[fieldName] === "object") {
            return decodeHtml(String(candidate[fieldName].name || candidate[fieldName].headline || ""));
          }
        }
      }
    } catch {
      continue;
    }
  }
  return "";
}

async function fetchPostDetails(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new Error(`LinkedIn post detail fetch failed with status ${response.status}`);
  }

  const html = await response.text();
  const title = extractMetaTag(html, "og:title") || extractMetaTag(html, "twitter:title");
  const description =
    extractMetaTag(html, "og:description") ||
    extractMetaTag(html, "description") ||
    extractJsonLdField(html, "description");
  const author =
    extractJsonLdField(html, "author") ||
    extractMetaTag(html, "article:author") ||
    "";
  const publishedTime =
    extractMetaTag(html, "article:published_time") ||
    extractJsonLdField(html, "datePublished") ||
    "";
  const bodyText = stripHtml(html).slice(0, 4000);

  return {
    title,
    description,
    author,
    postedAt: publishedTime || extractPostedAt(bodyText),
    bodyText
  };
}

export function createPostRecord(result, query, details = null) {
  const combinedText = [
    result.title,
    result.snippet,
    details?.title,
    details?.description,
    details?.bodyText
  ].filter(Boolean).join(" ");

  const author =
    extractAuthor(details?.title || result.title) ||
    trimText(details?.author || "", 80);
  const recruiterSignal = /\b(recruiter|talent acquisition|hiring manager|hr)\b/i.test(
    `${author} ${combinedText}`
  );
  const contactEmail = extractEmail(combinedText);
  const role =
    extractRole(combinedText) ||
    inferRoleFromSignals(combinedText) ||
    "Salesforce Hiring Post";

  if (!hasSalesforceSignals(combinedText)) {
    return null;
  }

  if (!(hasHiringSignals(combinedText) || contactEmail || recruiterSignal)) {
    return null;
  }

  const company = extractCompany(combinedText);
  const location = extractLocation(combinedText) || DEFAULT_LOCATION;
  const postedAt = details?.postedAt || extractPostedAt(`${result.title} ${result.snippet}`);

  return {
    source_platform: "linkedin_posts",
    opportunity_kind: "post",
    title: role,
    company,
    location,
    experience: "",
    description: trimText(details?.description || result.snippet || result.title, 500),
    skills: "",
    apply_link: result.href,
    post_url: result.href,
    post_author: author,
    source_job_id: `linkedin_post:${makeStablePostId(result.href)}`,
    source_evidence: {
      query,
      title: result.title,
      snippet: result.snippet,
      contact_email: contactEmail,
      detail_title: details?.title || "",
      detail_description: details?.description || ""
    },
    posted_at: postedAt || null
  };
}

async function fetchSearchPage(query, page = 0) {
  return fetchDuckDuckGoSearchPage(query, page);
}

function isDuckDuckGoBlocked(response, html) {
  return (
    response.status === 202 ||
    /anomaly\.js/i.test(String(html || "")) ||
    /botnet/i.test(String(html || "")) ||
    /verify you are human/i.test(String(html || ""))
  );
}

async function fetchDuckDuckGoSearchPage(query, page = 0) {
  const url = new URL(DUCKDUCKGO_HTML);
  url.searchParams.set("q", query);
  if (page > 0) {
    url.searchParams.set("s", String(page * 30));
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9"
    }
  });

  const html = await response.text();

  if (isDuckDuckGoBlocked(response, html)) {
    throw new Error("DuckDuckGo search blocked by anomaly protection");
  }

  if (!response.ok) {
    throw new Error(`LinkedIn posts search failed with status ${response.status}`);
  }

  return html;
}

export function parseBraveSearchResults(html) {
  const results = [];
  const regex =
    /<a href="(https:\/\/www\.linkedin\.com\/(?:posts|feed\/update)[^"]+)"[\s\S]*?<div class="title[^"]*"[^>]*(?:title="([^"]+)")?[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="content[^"]*">([\s\S]*?)<\/div>/gi;

  for (const match of String(html || "").matchAll(regex)) {
    const href = normalizeApplyLink(match[1]);
    const title = stripHtml(match[2] || match[3] || "");
    const snippet = stripHtml(match[4] || "");
    if (!href || !title) continue;
    results.push({ href, title, snippet });
  }

  return results;
}

async function fetchBraveSearchPage(query, page = 0) {
  const url = new URL(BRAVE_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("source", "web");
  if (page > 0) {
    url.searchParams.set("offset", String(page * 10));
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "accept-language": "en-IN,en;q=0.9"
    }
  });

  const html = await response.text();
  if (response.status === 429) {
    throw new Error("Brave Search rate limited the request");
  }

  if (!response.ok) {
    throw new Error(`Brave search failed with status ${response.status}`);
  }

  return html;
}

function getSearchProviders() {
  return String(
    process.env.LINKEDIN_POSTS_SEARCH_PROVIDERS || "duckduckgo,brave"
  )
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

async function fetchSearchResults(query, page, provider) {
  if (provider === "duckduckgo") {
    const html = await fetchDuckDuckGoSearchPage(query, page);
    return parseSearchResults(html).filter(result => isLikelyLinkedInPost(result.href));
  }

  if (provider === "brave") {
    const html = await fetchBraveSearchPage(query, page);
    return parseBraveSearchResults(html).filter(result => isLikelyLinkedInPost(result.href));
  }

  throw new Error(`Unknown LinkedIn post search provider: ${provider}`);
}

export async function fetchLinkedInPosts({
  plans = [],
  maxUniqueResults = 30
} = {}) {
  if (!isTruthy(process.env.ENABLE_POST_PROVIDERS || "true")) {
    console.log("INFO LinkedIn posts provider skipped: post providers disabled");
    return [];
  }

  const queries = buildSearchQueries(plans);
  const unique = new Map();
  const detailsEnabled = isTruthy(process.env.LINKEDIN_POSTS_FETCH_DETAILS || "true");
  const searchProviders = getSearchProviders();
  const blockedProviders = new Set();
  const maxPagesPerQuery = Math.max(
    1,
    Number(process.env.LINKEDIN_POSTS_PAGES_PER_QUERY || 2)
  );
  const maxDetailFetches = Math.max(
    0,
    Number(process.env.LINKEDIN_POSTS_MAX_DETAIL_FETCHES || 6)
  );
  let detailFetches = 0;

  for (const query of queries) {
    if (unique.size >= maxUniqueResults) break;

    for (let page = 0; page < maxPagesPerQuery; page += 1) {
      if (unique.size >= maxUniqueResults) break;

      try {
        let results = [];
        for (const provider of searchProviders) {
          if (blockedProviders.has(provider)) {
            continue;
          }

          try {
            results = await fetchSearchResults(query, page, provider);
            if (results.length > 0) {
              break;
            }
          } catch (error) {
            if (/blocked|rate limited/i.test(String(error?.message || ""))) {
              blockedProviders.add(provider);
            }
            console.log(
              `WARN LinkedIn posts search provider failed (${provider}, ${query}, page ${page + 1}): ${error.message}`
            );
          }
        }

        for (const result of results) {
          if (unique.size >= maxUniqueResults) break;

          let details = null;
          if (detailsEnabled && detailFetches < maxDetailFetches) {
            try {
              details = await fetchPostDetails(result.href);
              detailFetches += 1;
            } catch (error) {
              console.log(`WARN LinkedIn post detail fetch failed (${result.href}): ${error.message}`);
            }
          }

          const record = createPostRecord(result, query, details);
          if (!record) continue;
          unique.set(record.post_url, record);
        }

        if (blockedProviders.size >= searchProviders.length) {
          console.log(
            "WARN LinkedIn posts provider exhausted all search providers for this run"
          );
          break;
        }
      } catch (error) {
        console.log(`WARN LinkedIn posts query failed (${query}, page ${page + 1}): ${error.message}`);
      }
    }

    if (blockedProviders.size >= searchProviders.length) {
      break;
    }
  }

  if (unique.size === 0 && blockedProviders.size >= searchProviders.length) {
    throw new Error(
      "All LinkedIn post search providers were blocked or rate limited"
    );
  }

  const jobs = [...unique.values()];
  console.log(`OK LinkedIn posts provider collected: ${jobs.length} public hiring post(s)`);
  return jobs;
}
