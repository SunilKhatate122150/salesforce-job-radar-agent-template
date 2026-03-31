import test from "node:test";
import assert from "node:assert/strict";

import { fetchGreenhouseJobs } from "../src/jobs/fetchGreenhouse.js";
import { fetchLeverJobs } from "../src/jobs/fetchLever.js";
import { fetchAshbyJobs } from "../src/jobs/fetchAshby.js";

function installFetchMock(routes) {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const key = String(url);
    if (!Object.prototype.hasOwnProperty.call(routes, key)) {
      throw new Error(`Unexpected URL: ${key}`);
    }

    const route = routes[key];
    return {
      ok: route.ok !== false,
      status: route.status || 200,
      async json() {
        return route.body;
      }
    };
  };

  return () => {
    global.fetch = originalFetch;
  };
}

test("fetchGreenhouseJobs normalizes board jobs", async () => {
  const restore = installFetchMock({
    "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true": {
      body: {
        jobs: [
          {
            id: 101,
            title: "Salesforce Developer",
            absolute_url: "https://boards.greenhouse.io/acme/jobs/101",
            updated_at: "2026-03-31T08:00:00.000Z",
            location: { name: "Bengaluru, India" },
            content: "<p>Apex, LWC, integrations</p>"
          }
        ]
      }
    }
  });

  try {
    const result = await fetchGreenhouseJobs({
      boards: [{ provider: "greenhouse", board_key: "acme", company: "Acme" }]
    });

    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].source_platform, "greenhouse");
    assert.equal(result.jobs[0].ats_provider, "greenhouse");
    assert.match(result.jobs[0].description, /Apex, LWC, integrations/i);
    assert.equal(result.coverage[0].board_key, "acme");
  } finally {
    restore();
  }
});

test("fetchLeverJobs normalizes board jobs", async () => {
  const restore = installFetchMock({
    "https://api.lever.co/v0/postings/beta?mode=json": {
      body: [
        {
          id: "abc",
          text: "Salesforce Engineer",
          applyUrl: "https://jobs.lever.co/beta/abc/apply",
          hostedUrl: "https://jobs.lever.co/beta/abc",
          createdAt: 1711872000000,
          categories: {
            location: "Remote - India",
            team: "Engineering"
          },
          descriptionPlain: "Salesforce platform engineering role"
        }
      ]
    }
  });

  try {
    const result = await fetchLeverJobs({
      boards: [{ provider: "lever", board_key: "beta", company: "Beta" }]
    });

    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].source_platform, "lever");
    assert.equal(result.jobs[0].ats_board_key, "beta");
    assert.equal(result.jobs[0].location, "Remote - India");
    assert.match(result.jobs[0].description, /platform engineering/i);
  } finally {
    restore();
  }
});

test("fetchAshbyJobs normalizes board jobs", async () => {
  const restore = installFetchMock({
    "https://api.ashbyhq.com/posting-api/job-board/gamma": {
      body: {
        jobs: [
          {
            title: "Salesforce Consultant",
            applyUrl: "https://jobs.ashbyhq.com/gamma/apply/123",
            jobUrl: "https://jobs.ashbyhq.com/gamma/123",
            publishedAt: "2026-03-30T09:15:00.000Z",
            location: "India Remote",
            team: "Consulting",
            department: "Technology",
            descriptionPlain: "Looking for Salesforce Consultant with CPQ experience"
          }
        ]
      }
    }
  });

  try {
    const result = await fetchAshbyJobs({
      boards: [{ provider: "ashby", board_key: "gamma", company: "Gamma" }]
    });

    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].source_platform, "ashby");
    assert.equal(result.jobs[0].ats_provider, "ashby");
    assert.equal(result.jobs[0].location, "India Remote");
    assert.match(result.jobs[0].description, /CPQ/i);
  } finally {
    restore();
  }
});
