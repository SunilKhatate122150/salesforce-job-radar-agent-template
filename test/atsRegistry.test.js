import test from "node:test";
import assert from "node:assert/strict";

import {
  getAtsProviderMode,
  groupAtsBoardsByProvider,
  loadAtsBoardRegistry
} from "../src/jobs/atsRegistry.js";

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

test("loadAtsBoardRegistry accepts env registry JSON and dedupes by provider/board", () =>
  withEnv(
    {
      ENABLE_ATS_PROVIDERS: "true",
      ATS_PROVIDER_MODE: "shadow",
      ATS_FETCH_PROVIDERS: "greenhouse,lever",
      ATS_BOARD_REGISTRY_JSON: JSON.stringify([
        {
          provider: "greenhouse",
          board_key: "acme",
          company: "Acme",
          careers_url: "https://boards.greenhouse.io/acme",
          priority: 55,
          active: true
        },
        {
          provider: "greenhouse",
          board_key: "acme",
          company: "Acme override",
          careers_url: "https://boards.greenhouse.io/acme",
          priority: 90,
          active: true
        },
        {
          provider: "lever",
          board_key: "beta",
          company: "Beta",
          careers_url: "https://jobs.lever.co/beta",
          priority: 40,
          active: true
        },
        {
          provider: "ashby",
          board_key: "ignored",
          company: "Ignored",
          active: true
        }
      ])
    },
    async () => {
      const registry = await loadAtsBoardRegistry();

      assert.equal(getAtsProviderMode(), "shadow");
      assert.equal(registry.length, 2);
      assert.deepEqual(
        registry.map(entry => `${entry.provider}:${entry.board_key}`),
        ["greenhouse:acme", "lever:beta"]
      );
      assert.equal(registry[0].company, "Acme override");

      const grouped = groupAtsBoardsByProvider(registry);
      assert.equal(grouped.get("greenhouse").length, 1);
      assert.equal(grouped.get("lever").length, 1);
      assert.equal(grouped.has("ashby"), false);
    }
  ));

test("loadAtsBoardRegistry returns empty list when ATS mode is off", () =>
  withEnv(
    {
      ENABLE_ATS_PROVIDERS: "true",
      ATS_PROVIDER_MODE: "off",
      ATS_BOARD_REGISTRY_JSON: JSON.stringify([
        { provider: "greenhouse", board_key: "acme", company: "Acme" }
      ])
    },
    async () => {
      const registry = await loadAtsBoardRegistry();
      assert.deepEqual(registry, []);
    }
  ));
