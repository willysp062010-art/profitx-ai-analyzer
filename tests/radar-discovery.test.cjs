const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function load(fetchMock) {
  const source = fs.readFileSync(path.join(__dirname, "../pages/api/radar-discovery.js"), "utf8")
    .replace("export default async function handler", "async function handler") + "\nthis.handler = handler;";
  const context = {
    fetch: fetchMock, AbortController, setTimeout, clearTimeout,
    console: { error() {} }, Date
  };
  vm.runInNewContext(source, context);
  return context.handler;
}
function response() {
  return {
    statusCode: 200, body: null,
    setHeader() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}
test("Radar discovery filters invalid and duplicate mints without inventing risk data", async () => {
  const mint = "So11111111111111111111111111111111111111112";
  const handler = load(async () => ({ ok: true, json: async () => [
    { mint, name: "Example", symbol: "EX", created_timestamp: 1700000000000 },
    { mint, name: "Duplicate", symbol: "DUP" },
    { mint: "invalid", name: "Invalid" },
    { mint: "11111111111111111111111111111111", is_banned: true }
  ] }));
  const res = response();
  await handler({ method: "GET" }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.tokens[0].mint, mint);
  assert.equal(res.body.tokens[0].liquidityUsd, null);
  assert.equal(res.body.tokens[0].riskScore, null);
  assert.equal(res.body.tokens[0].verificationStatus, "UNVERIFIED");
});
test("Radar discovery hides upstream errors", async () => {
  const handler = load(async () => { throw new Error("private upstream credential"); });
  const res = response();
  await handler({ method: "GET" }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.stringify(res.body).includes("credential"), false);
});
