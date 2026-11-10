const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../pages/api/radar-72h.js"), "utf8")
  .replace("export default async function handler", "async function handler");
const now = Date.parse("2026-11-10T08:00:00.000Z");

async function request(contentRange, verifyQuery = () => {}) {
  const handler = vm.runInNewContext(source + "\nhandler;", {
    process: { env: { SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "test-key" } },
    Date: class extends Date {
      static now() { return now; }
    },
    URLSearchParams,
    AbortSignal,
    console: { error() {} },
    fetch: async (url, options) => {
      verifyQuery(new URL(url), options);
      return {
        ok: true,
        headers: { get: () => contentRange }
      };
    }
  });
  const res = {
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await handler({ method: "GET" }, res);
  return res;
}

test("Radar counts Solana detections within both bounds of the reported 72-hour window", async () => {
  const since = "2026-11-07T08:00:00.000Z";
  const until = "2026-11-10T08:00:00.000Z";
  const res = await request("0-0/37", (url, options) => {
    assert.equal(url.pathname, "/rest/v1/pfx_radar_tokens");
    assert.equal(url.searchParams.get("chain_id"), "eq.solana");
    assert.equal(url.searchParams.get("and"), `(detected_at.gte.${since},detected_at.lte.${until})`);
    assert.equal(options.headers.Prefer, "count=exact");
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 37);
  assert.equal(res.body.metric, "detected_in_last_72h");
  assert.equal(res.body.since, since);
  assert.equal(res.body.until, until);
});

test("Radar returns zero when the upstream count is explicitly zero", async () => {
  const res = await request("*/0");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 0);
});

test("Radar reports an unavailable count for missing or malformed totals", async () => {
  for (const range of [null, "*/", "0-0/*", "0-0/-1", "0-0/1/2", "0-0/9007199254740992"]) {
    const res = await request(range);
    assert.equal(res.statusCode, 502, String(range));
    assert.equal(res.body.ok, false);
    assert.equal(res.body.count, undefined);
  }
});
