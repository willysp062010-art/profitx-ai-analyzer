const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../pages/index.js"), "utf8");
for (const kind of ["sell", "eur"]) test(`${kind} quote from an earlier analyzed token cannot populate a new token's result`, async () => {
  const state = {};
  let complete;
  const start = source.indexOf(kind === "sell" ? "  async function testSellQuote()" : "  async function testEurQuote(eur)");
  const end = source.indexOf(kind === "sell" ? "  useEffect(() => {" : "  function tokenAmountToRaw(", start);
  const ctx = { data: { mint: "old-token", data: { decimals: 6 } }, quoteContext: { current: 0 }, sellQuoteAmount: "1", sellQuoteLoading: false, eurQuoteLoading: false,
    tokenAmountToRaw: () => "1000000", fetch: () => new Promise(resolve => { complete = resolve; }),
    setSellQuote: value => state.result = value, setEurQuote: value => state.result = value,
    setSellQuoteError: value => state.error = value, setEurQuoteError: value => state.error = value,
    setSellQuoteLoading() {}, setEurQuoteLoading() {} };
  vm.runInNewContext(source.slice(start, end), ctx);
  const pending = kind === "sell" ? ctx.testSellQuote() : ctx.testEurQuote(10);
  ctx.quoteContext.current++;
  complete({ ok: true, json: async () => ({ ok: true, status: "ROUTE_QUOTED", outputAmountRaw: "100" }) });
  await pending;
  assert.equal(state.result, null);
  assert.equal(state.error, "");
});
