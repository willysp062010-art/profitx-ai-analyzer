const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../pages/api/radar-live.js"), "utf8")
  .replace("export default async function handler", "async function handler")
  .replace("export const config", "const config");
const mint = "So11111111111111111111111111111111111111112";

test("Radar checks concentration and creator history before enrichment saves finish", async () => {
  let completeEnrichment;
  const enrichment = new Promise((resolve) => { completeEnrichment = resolve; });
  const events = [];
  const handler = vm.runInNewContext(source + `
    enrichOnRead = async (rows) => {
      await enrichment;
      rows[0].name = "Wrapped SOL";
    };
    enrichMarketRows = async () => {
      await enrichment;
      return new Map([[mint, { liquidityUsd: 100 }]]);
    };
    fetchOnchainAuthorities = async () => {
      events.push("authorities");
      return new Map([[mint, { mintSupplyRaw: "100", securityChecked: true }]]);
    };
    fetchConcentration = async (rows, checks) => {
      events.push(checks.get(rows[0].mint)?.mintSupplyRaw);
      return new Map([[mint, { top1AccountPercent: 20 }]]);
    };
    fetchCreatorHistory = async () => {
      events.push("creator");
      return new Map([[mint, 2]]);
    };
    handler;
  `, {
    process: { env: { SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "test" } },
    fetch: async () => new Response(JSON.stringify([{ mint, creator_address: mint }])),
    URLSearchParams, AbortSignal, enrichment, events, mint
  });
  const res = {
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const request = handler({ method: "GET", query: {} }, res);
  try {
    await new Promise(setImmediate);
    assert.deepEqual(events, ["authorities", "creator", "100"]);
    assert.equal(res.body, undefined);
  } finally {
    completeEnrichment();
    await request;
  }
  assert.equal(res.statusCode, 200);
  const token = res.body.tokens[0];
  assert.equal(token.name, "Wrapped SOL");
  assert.equal(token.liquidityUsd, 100);
  assert.equal(token.securityChecked, true);
  assert.equal(token.top1AccountPercent, 20);
  assert.equal(token.creatorSeenTokenCount, 2);
});
