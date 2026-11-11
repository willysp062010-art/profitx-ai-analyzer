const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const quality = fs.readFileSync(path.join(__dirname, "../utils/analysis-quality.js"), "utf8").replace(/export function /g, "function ");
const source = fs.readFileSync(path.join(__dirname, "../pages/api/intelligence.js"), "utf8")
  .replace(/^import .*;$/gm, "").replace("export default async function handler(", "async function handler(");
const ctx = { console };
vm.runInNewContext(quality + "\n" + source, ctx);
function analysis() {
  return { ok: true, token: { name: "Test" }, score: { total: 95, structural: 95, market: 95,
    components: { liquidity: 95, distribution: 95, security: 95, maturity: 95, activity: 95, volume: 95 } },
    modules: { security: { securityScore: 95 }, token2022: { isToken2022: false } },
    observed: { volume24hUsd: 1000, transactions24h: 20, buys24h: 10, sells24h: 10 } };
}

test("Intelligence keeps Token-2022 limits despite high numeric scores", () => {
  const a = analysis(); a.modules.token2022 = { isToken2022: true, scoringReady: false };
  const r = ctx.buildIntelligence(a);
  assert.equal(r.dataQuality.status, "PARTIAL");
  assert.equal(r.dataQuality.scoreStatus, "PROVISIONAL");
  assert.match(r.intelligence.summary, /indicatif/);
  assert.doesNotMatch(r.intelligence.summary, /structure globalement solide/);
  assert.match(r.intelligence.conclusion, /ne suffit pas/);
  assert.ok(r.dataQuality.issues.some(s => s.includes("Token-2022")));
});
test("upstream restrictions survive and cannot downgrade detected price contradictions", () => {
  const a = analysis(); a.dataQuality = { status: "PARTIAL", issues: ["Limite de la source"] };
  a.market = { priceStatus: "CONFLICTING_POOL_PRICES" };
  const r = ctx.buildIntelligence(a);
  assert.equal(r.dataQuality.status, "CONFLICTING");
  assert.ok(r.dataQuality.issues.includes("Limite de la source"));
  assert.match(r.intelligence.conclusion, /contredisent/);
});
test("missing components and unavailable scores remain absent rather than zero", () => {
  const a = analysis(); delete a.score.components.distribution; delete a.score.total;
  const r = ctx.buildIntelligence(a);
  assert.equal(r.scores.distribution, null);
  assert.equal(r.scores.global, null);
  assert.equal(r.dataQuality.status, "UNAVAILABLE");
  assert.equal(r.dataQuality.structuralCoverage, 70);
});
test("partial zero observations cannot invent positive activity", () => {
  const a = analysis(); a.observed = { volume24hUsd: 0 };
  const r = ctx.buildIntelligence(a);
  assert.equal(r.intelligence.economicState, "UNKNOWN");
  assert.doesNotMatch(r.intelligence.economicReading, /L'activité existe|confirment une activité/);
});
test("four measured zeroes remain zero and describe only the observed market scope", () => {
  const a = analysis(); a.observed = { volume24hUsd: 0, transactions24h: 0, buys24h: 0, sells24h: 0 };
  const r = ctx.buildIntelligence(a);
  assert.equal(r.intelligence.economicState, "INACTIVE");
  assert.match(r.intelligence.economicReading, /0 transaction/);
  assert.match(r.intelligence.economicReading, /ne couvrent pas nécessairement tous les marchés/);
});
test("booleans, arrays, whitespace and negative activity are not observations", () => {
  for (const value of [false, true, [], " ", -1]) {
    const a = analysis(); a.observed = { volume24hUsd: value, transactions24h: value, buys24h: value, sells24h: value };
    assert.equal(ctx.buildIntelligence(a).intelligence.economicState, "UNKNOWN");
  }
});
test("complete controls retain calculated scores without changing observed values", () => {
  const r = ctx.buildIntelligence(analysis());
  assert.equal(r.dataQuality.status, "COMPLETE");
  assert.equal(r.dataQuality.scoreStatus, "CALCULATED");
  assert.equal(r.scores.global, 95);
  assert.equal(r.intelligence.economicState, "ACTIVE");
});
