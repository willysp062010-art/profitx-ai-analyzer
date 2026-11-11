const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const mint = "AqxmHpJ6A9nYnXfvzMYhFB4nYwJbtkeYnG4KUSeypump";
function load(fetch) {
  const utility = fs.readFileSync(path.join(__dirname, "../utils/directory-identity.js"), "utf8").replace(/export (async )?function /g, "$1function ");
  const source = fs.readFileSync(path.join(__dirname, "../pages/api/token-directory.js"), "utf8")
    .replace(/^import .*;$/gm, "").replace("export default async function", "async function").replace("export const config", "const config");
  const ctx = { fetch, process: { env: { SUPABASE_URL: "https://database.test", SUPABASE_SERVICE_ROLE_KEY: "private-key" } }, URLSearchParams, AbortSignal };
  vm.runInNewContext(utility + "\n" + source, ctx);
  return ctx.handler;
}
async function invoke(handler, query) {
  const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
  await handler({ method: "GET", query }, res); return res;
}
test("directory preserves Unicode and quotes filter values instead of rewriting the requested name", async () => {
  let url;
  const handler = load(async input => { url = new URL(input); return new Response("[]", { headers: { "content-range": "*/0" } }); });
  const r = await invoke(handler, { q: 'Gǒu 🐸, "x"', page: "1" });
  assert.equal(r.statusCode, 200);
  const filter = url.searchParams.get("or");
  assert.ok(filter.includes('Gǒu 🐸, \\"x\\"'));
  assert.ok(filter.startsWith('(name.ilike."*'));
  assert.equal(r.body.count, 0);
  assert.equal(r.body.hasMore, false);
});
test("directory binds on-chain names to the requested mint and marks stored market values historical", async () => {
  const handler = load(async url => {
    if (String(url).includes("database.test")) return new Response(JSON.stringify([{ mint, name: "Token inconnu", symbol: "N/D", liquidity_usd: 0, detected_at: "2026-11-11T10:00:00Z" }]), { headers: { "content-range": "0-0/1" } });
    return new Response(JSON.stringify({ result: { value: [{ owner: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", data: { parsed: { type: "mint", info: { extensions: [{ extension: "tokenMetadata", state: { mint, name: "Gǒu", symbol: "GǑU" } }] } } } }] } }));
  });
  const r = await invoke(handler, { page: "1" });
  assert.equal(r.body.tokens[0].name, "Gǒu");
  assert.equal(r.body.tokens[0].identityStatus, "metadata_present");
  assert.equal(r.body.tokens[0].liquidityUsd, 0);
  assert.equal(r.body.tokens[0].marketDataStatus, "historical_unverified");
  assert.equal(JSON.stringify(r.body).includes("private-key"), false);
});
test("directory pagination keeps its snapshot and does not advertise an inaccessible page", async () => {
  let params;
  const handler = load(async url => { params = new URL(url).searchParams; return new Response("[]", { headers: { "content-range": "*/999999" } }); });
  const r = await invoke(handler, { page: "10000", snapshot: "2026-11-10T10:00:00Z" });
  assert.equal(params.get("detected_at"), "lte.2026-11-10T10:00:00.000Z");
  assert.equal(r.body.hasMore, false);
  assert.equal((await invoke(handler, { page: "10001" })).statusCode, 400);
});
test("directory leaves missing totals and metadata unknown on upstream metadata failure", async () => {
  const handler = load(async url => String(url).includes("database.test") ? new Response(JSON.stringify([{ mint }])) : new Response("{}", { status: 429 }));
  const r = await invoke(handler, { page: "1" });
  assert.equal(r.body.count, null);
  assert.equal(r.body.tokens[0].name, "Nom non récupéré");
  assert.equal(r.body.tokens[0].identityStatus, "metadata_unconfirmed");
});
