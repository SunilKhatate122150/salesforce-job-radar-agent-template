import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSearchQueries,
  createPostRecord
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
  }));

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
