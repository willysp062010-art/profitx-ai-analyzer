const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../pages/api/search-token.js"), "utf8")
  .replace("export default async function handler(req, res)", "async function handler(req, res)");

function loadHandler(fetch) {
  const context = {
    fetch, AbortController, setTimeout, clearTimeout, URL,
    console: { error() {}, warn() {} },
  };
  vm.runInNewContext(source + "\nthis.handler = handler;", context);
  return context.handler;
}

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("search API does not expose upstream error messages on total outage", async () => {
  const secret = "private-provider-error-token-123";
  const handler = loadHandler(async () => { throw Error(secret); });
  const res = response();
  await handler({ method: "GET", query: { q: "BONK" } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.ok, false);
  assert.doesNotMatch(JSON.stringify(res.body), /private-provider-error-token-123/);
  assert.equal(res.body.dexError, "DexScreener temporairement indisponible.");
  assert.equal(res.body.pumpError, "Pump.fun temporairement indisponible.");
});

test("search API hides upstream errors even with an official token fallback", async () => {
  const handler = loadHandler(async () => { throw Error("sensitive-upstream-detail"); });
  const res = response();
  await handler({ method: "GET", query: { q: "PFX" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.doesNotMatch(JSON.stringify(res.body), /sensitive-upstream-detail/);
  assert.equal(res.body.results[0].verificationStatus, "OFFICIAL_PROJECT_MINT");
});
