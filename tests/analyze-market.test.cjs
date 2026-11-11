const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const qualitySource = fs.readFileSync(path.join(__dirname, "../utils/analysis-quality.js"), "utf8")
  .replace(/export function /g, "function ");
const dexSource = fs.readFileSync(path.join(__dirname, "../utils/dex-market.js"), "utf8").replace(/export function /g, "function ");
const internalSource = fs.readFileSync(path.join(__dirname, "../utils/internal-module.js"), "utf8").replace("export async function", "async function");
const source = internalSource + "\n" + dexSource + "\n" + qualitySource + "\n" + fs.readFileSync(path.join(__dirname, "../pages/api/analyze.js"), "utf8")
  .replace(/^import .*;$/gm, "")
  .replace('import { selectDexPair } from "../../utils/dex-market";', "")
  .replace("export default async function handler(", "async function handler(")
  + "\nmodule.exports = { selectDexPair, dexMetrics, dexData, handler };";
function load(fetchImpl = async () => { throw Error("Unexpected network request"); }) {
  const ctx = { module: { exports: {} }, process: { env: {} }, fetch: fetchImpl,
    AbortController, setTimeout, clearTimeout, console, Buffer };
  for (const name of ["activity", "holders", "security", "token2022"]) {
    const moduleCtx = { ...ctx, module: { exports: {} } };
    const moduleSource = fs.readFileSync(path.join(__dirname, `../pages/api/${name}.js`), "utf8")
      .replace("export default async function handler(", "async function handler(");
    vm.runInNewContext(moduleSource + "\nmodule.exports = handler;", moduleCtx);
    ctx[name + "Handler"] = moduleCtx.module.exports;
  }
  vm.runInNewContext(source, ctx);
  return ctx.module.exports;
}
const MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
function pair(id, price, liquidity = 1000, overrides = {}) {
  return { chainId: "solana", pairAddress: id, baseToken: { address: MINT, name: "Bonk" },
    quoteToken: { address: "other" }, priceUsd: String(price), priceNative: "123",
    marketCap: 100, fdv: 500, liquidity: { usd: liquidity }, volume: { h24: 0 },
    txns: { h24: { buys: 7, sells: 2 } }, ...overrides };
}
test("analyzer prefers token-priced Solana market over a deeper quote-side pair", () => {
  const { selectDexPair } = load();
  const quote = pair("quote", 999, 1e7, { baseToken: { address: "other" }, quoteToken: { address: MINT } });
  const base = pair("base", 0.00001);
  assert.equal(selectDexPair([quote, base], MINT).pair.pairAddress, "base");
});
test("same text address on another chain is not a Solana market", () => {
  const { selectDexPair } = load();
  assert.equal(selectDexPair([pair("wrong", 1, 1e9, { chainId: "ethereum" })], MINT).pair, null);
});
test("quote-side pool preserves pair volume but never invents quote price or capitalization", () => {
  const { dexMetrics } = load();
  const result = dexMetrics(pair("quote", 999, 1000, {
    baseToken: { address: "other" }, quoteToken: { address: MINT }
  }), MINT, { uiAmount: 87994300251105 });
  assert.equal(result.priceUsd, null);
  assert.equal(result.marketCapUsd, null);
  assert.equal(result.volume24hUsd, 0);
  assert.equal(result.buys24h, 2);
  assert.equal(result.sells24h, 7);
  assert.equal(result.transactions24h, 9);
});
test("a thousandfold pool-price outlier is withheld without fabricating a replacement", () => {
  const { selectDexPair, dexMetrics } = load();
  const selection = selectDexPair([pair("outlier", 0.014, 2e6), pair("a", 0.000014), pair("b", 0.0000141)], MINT);
  assert.equal(selection.priceStatus, "CONFLICTING_POOL_PRICES");
  assert.equal(selection.pair.pairAddress, "outlier");
  const result = dexMetrics(selection.pair, MINT, {}, selection.priceStatus);
  assert.equal(result.priceUsd, null);
  assert.equal(result.marketCapUsd, null);
  assert.equal(result.liquidityUsd, 2e6);
});
test("duplicate or unfunded pools cannot create false price consensus", () => {
  const { selectDexPair } = load();
  const selection = selectDexPair([pair("outlier", 0.014, 2e6), pair("same", 0.000014),
    pair("same", 0.000014), pair("unfunded", 0.000014, 0)], MINT);
  assert.equal(selection.comparedPricePools, 2);
  assert.equal(selection.priceStatus, "SINGLE_SOURCE");
});
test("one observed price is preserved and FDV is not silently relabeled market cap", () => {
  const { dexMetrics } = load();
  const result = dexMetrics(pair("only", 0.000014, 1000, { marketCap: null }), MINT, {});
  assert.equal(result.priceUsd, 0.000014);
  assert.equal(result.marketCapUsd, null);
});
test("missing buy/sell counts remain unknown, not zero", () => {
  const { dexMetrics } = load();
  const result = dexMetrics(pair("only", 1, 1000, { txns: { h24: { buys: null, sells: 0 } } }), MINT, {});
  assert.equal(result.buys24h, null);
  assert.equal(result.sells24h, 0);
  assert.equal(result.transactions24h, null);
});

test("full analyzer response withholds conflicting prices across all public aliases", async () => {
  const pairs = [pair("outlier", 0.014, 2e6), pair("a", 0.000014), pair("b", 0.0000141)];
  const { handler } = load(async url => {
    if (url.includes("dexscreener.com")) return new Response(JSON.stringify({ pairs }));
    if (url.includes("pump.fun")) return new Response("", { status: 403 });
    return new Response(JSON.stringify({ result: { value: { amount: "100000000", decimals: 5, uiAmountString: "1000" } } }));
  });
  const res = { statusCode: 0, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: "GET", query: { mint: MINT }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  for (const alias of [res.body.observed, res.body.data, res.body.pair]) {
    assert.equal(alias.priceUsd, null);
    assert.equal(alias.marketCapUsd, null);
  }
  assert.equal(res.body.market.priceStatus, "CONFLICTING_POOL_PRICES");
  assert.equal(res.body.dataQuality.status, "CONFLICTING");
  assert.equal(res.body.dataQuality.scoreStatus, "UNAVAILABLE");
  assert.equal(res.body.diagnostic.analysisStatus, "CONFLICTING");
  assert.equal(res.body.market.volumeSource, "selected_pair");
  assert.equal(res.body.market.transactionsSource, "selected_pair");
  assert.ok(res.body.diagnostic.warnings.some(w => w.includes("Prix divergents")));
});
