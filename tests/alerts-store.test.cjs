const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../pages/api/alerts-store.js"), "utf8")
  .replace("export default async function handler(", "async function handler(")
  + "\nmodule.exports = { handler };";
const MINT = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
const alert = { id: "test-alert", chainId: "solana", tokenAddress: MINT,
  metric: "priceUsd", condition: "above", targetValue: 1 };
function load(fetchImpl) {
  const context = { module: { exports: {} }, fetch: fetchImpl,
    process: { env: { SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-key" } }, console, Date, Number,
    String, JSON, encodeURIComponent };
  vm.runInNewContext(source, context, { filename: "alerts-store.js" });
  return context.module.exports.handler;
}
function response() {
  return { statusCode: 200, status(n) { this.statusCode = n; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {} };
}
function mockFetch(calls) {
  return async (url, opts) => {
    calls.push({ url, method: opts.method, body: opts.body && JSON.parse(opts.body) });
    return { ok: true, status: 200, text: async () => JSON.stringify(
      opts.method === "DELETE" ? null : [{ alert_id: "test-alert" }]) };
  };
}
async function invoke(handler, method, body, query) {
  const res = response();
  await handler({ method, body, query: query || {} }, res);
  return res;
}
test("POST rejects invalid Solana mint without persistence call", async () => {
  const calls = []; const handler = load(mockFetch(calls));
  const res = await invoke(handler, "POST", { clientId: "test", alert: { ...alert, tokenAddress: "bad" } });
  assert.equal(res.statusCode, 400); assert.equal(calls.length, 0);
});
test("POST rejects empty threshold rather than treating it as zero", async () => {
  const calls = []; const handler = load(mockFetch(calls));
  const res = await invoke(handler, "POST", { clientId: "test", alert: { ...alert, targetValue: "" } });
  assert.equal(res.statusCode, 400); assert.equal(calls.length, 0);
});
test("POST rejects unsupported metric", async () => {
  const calls = []; const handler = load(mockFetch(calls));
  const res = await invoke(handler, "POST", { clientId: "test", alert: { ...alert, metric: "unknown" } });
  assert.equal(res.statusCode, 400); assert.equal(calls.length, 0);
});
test("POST persists a valid alert", async () => {
  const calls = []; const handler = load(mockFetch(calls));
  const res = await invoke(handler, "POST", { clientId: "test", alert });
  assert.equal(res.statusCode, 200); assert.equal(calls.length, 1);
  assert.equal(calls[0].body.token_address, MINT);
});
test("GET retrieves alerts scoped to client", async () => {
  const calls = []; const handler = load(mockFetch(calls));
  const res = await invoke(handler, "GET", null, { clientId: "test" });
  assert.equal(res.statusCode, 200); assert.equal(res.body.count, 1);
  assert.match(calls[0].url, /client_id=eq.test/);
});
test("PATCH requires boolean enabled", async () => {
  const calls = []; const handler = load(mockFetch(calls));
  const res = await invoke(handler, "PATCH", { clientId: "test", alertId: "test-alert", enabled: "false" });
  assert.equal(res.statusCode, 400); assert.equal(calls.length, 0);
});
test("PATCH updates a stored alert", async () => {
  const calls = []; const handler = load(mockFetch(calls));
  const res = await invoke(handler, "PATCH", { clientId: "test", alertId: "test-alert", enabled: false });
  assert.equal(res.statusCode, 200); assert.equal(calls[0].body.enabled, false);
});
test("DELETE removes a stored alert", async () => {
  const calls = []; const handler = load(mockFetch(calls));
  const res = await invoke(handler, "DELETE", { clientId: "test", alertId: "test-alert" });
  assert.equal(res.statusCode, 200); assert.equal(calls[0].method, "DELETE");
});
