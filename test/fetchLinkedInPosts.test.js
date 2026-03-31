import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSearchQueries,
  createPostRecord,
  parseBraveSearchResults
} from "../src/jobs/fetchLinkedInPosts.js";

function withEnv(overrides, fn) {
  const original = {};
  const restore = () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  for (const [key, value] of Object.entries(overrides)) {
    original[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  const result = fn();
  if (result && typeof result.then === "function") {
    return Promise.resolve(result).finally(restore);
  }

  restore();
  return result;
}

test("buildSearchQueries expands LinkedIn post coverage with feed and remote variants", () =>
  withEnv({ LINKEDIN_POSTS_QUERIES_PER_RUN: "8" }, () => {
    const queries = buildSearchQueries([
      {
        keywords: ["Salesforce Developer", "Apex Developer"]
      }
    ]);

    assert.ok(queries.length > 1);
    assert.ok(queries.some(query => query.includes("site:linkedin.com/posts")));
    assert.ok(queries.some(query => query.includes("site:linkedin.com/feed/update")));
    assert.ok(queries.some(query => query.toLowerCase().includes("remote")));
    assert.ok(queries.some(query => query.includes("\"Apex Developer\"")));
    assert.ok(queries.some(query => query.toLowerCase().includes("\"we are hiring\"")));
  }));

test("parseBraveSearchResults extracts LinkedIn post cards from Brave HTML", () => {
  const html = `
    <div class="snippet  svelte-jmfu5f" data-pos="1" data-type="web" data-keynav="true">
      <div class="result-wrapper">
        <div class="result-content">
          <a href="https://www.linkedin.com/posts/rjain13_nagarro-hiring-salesforce-activity-6849597937698312192-FlFB" target="_self" class="l1">
            <div class="title search-snippet-title line-clamp-1" title="Rahul Jain on LinkedIn: #nagarro #hiring #salesforce #salesforcejobs | 15 comments">
              Rahul Jain on LinkedIn: #nagarro #hiring #salesforce #salesforcejobs | 15 comments
            </div>
          </a>
          <div class="generic-snippet">
            <div class="content desktop-default-regular t-primary line-clamp-dynamic">
              <span class="t-secondary">1 October 2021 -</span>
              <strong>Nagarro is hiring for multiple Salesforce technical positions</strong> in India.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const results = parseBraveSearchResults(html);
  assert.equal(results.length, 1);
  assert.match(results[0].href, /linkedin\.com\/posts\/rjain13/i);
  assert.match(results[0].title, /Rahul Jain on LinkedIn/i);
  assert.match(results[0].snippet, /Nagarro is hiring/i);
});

test("createPostRecord keeps Salesforce hiring posts with recruiter evidence", () => {
  const record = createPostRecord(
    {
      href: "https://www.linkedin.com/posts/acme_hiring-salesforce-developer-123/",
      title: "Asha Recruiter on LinkedIn: We are hiring Salesforce Developer",
      snippet: "We are hiring Salesforce Developer in Bengaluru. Share your resume at jobs@acme.com"
    },
    'site:linkedin.com/posts "Salesforce Developer" hiring "India"',
    {
      title: "Asha Recruiter on LinkedIn: We are hiring Salesforce Developer",
      description: "Salesforce Developer opening for Acme in Bengaluru, India. Apply now.",
      author: "Asha Recruiter",
      postedAt: "2026-03-31T06:00:00.000Z",
      bodyText: "We are hiring Salesforce Developer for Acme in Bengaluru. Share your resume at jobs@acme.com"
    }
  );

  assert.ok(record);
  assert.equal(record.opportunity_kind, "post");
  assert.equal(record.source_platform, "linkedin_posts");
  assert.equal(record.title, "Salesforce Developer");
  assert.equal(record.post_author, "Asha Recruiter");
  assert.equal(record.posted_at, "2026-03-31T06:00:00.000Z");
  assert.equal(record.source_evidence.contact_email, "jobs@acme.com");
});

test("createPostRecord keeps recruiter-led Salesforce posts even when hiring word is missing", () => {
  const record = createPostRecord(
    {
      href: "https://www.linkedin.com/posts/asha-recruiter_salesforce-opportunity-456/",
      title: "Asha Recruiter on LinkedIn: Salesforce LWC opening",
      snippet: "Send your resume to jobs@acme.com for the Salesforce LWC opportunity in Pune."
    },
    'site:linkedin.com/posts "LWC Developer" "share your resume" "India"',
    {
      title: "Asha Recruiter on LinkedIn: Salesforce LWC opening",
      description: "Salesforce LWC role for Acme in Pune. Send your resume to jobs@acme.com",
      author: "Asha Recruiter",
      bodyText: "Salesforce LWC role for Acme in Pune. Send your resume to jobs@acme.com."
    }
  );

  assert.ok(record);
  assert.equal(record.title, "LWC Developer");
  assert.equal(record.post_author, "Asha Recruiter");
  assert.equal(record.source_evidence.contact_email, "jobs@acme.com");
});
