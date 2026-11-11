const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function harness() {
  const source = fs.readFileSync(path.join(__dirname, "../pages/index.js"), "utf8");
  const start = source.indexOf("async function searchToken(query)");
  const end = source.indexOf("  async function analyze()", start);
  const state = {};
  const requests = [];
  const ctx = { tokenSearchRequest: { current: 0 }, tokenSearchAbort: { current: null }, AbortController,
    fetch: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    setTokenResults: v => state.results = v,
    setTokenSearchError: v => state.error = v,
    setTokenSearchNotice: v => state.notice = v,
    setTokenSearchLoading: v => state.loading = v,
  };
  vm.runInNewContext(source.slice(start, end) + "\nthis.search = searchToken;", ctx);
  const answer = (index, name) => requests[index].resolve({ ok: true,
    json: async () => ({ ok: true, results: [{ name }], pumpError: "refusal " + name }) });
  return { ctx, state, requests, answer };
}

test("a slow older search cannot replace the current token results or source notice", async () => {
  const h = harness();
  const old = h.ctx.search("PFX");
  const current = h.ctx.search("BONK");
  h.answer(1, "BONK"); await current;
  h.answer(0, "PFX"); await old;
  assert.equal(h.state.results[0].name, "BONK");
  assert.equal(h.state.notice, "refusal BONK");
});

test("a failed older search cannot hide the current search loading state or add an error", async () => {
  const h = harness();
  const old = h.ctx.search("PFX");
  const current = h.ctx.search("BONK");
  h.requests[0].reject(Error("old outage")); await old;
  assert.equal(h.state.error, "");
  assert.equal(h.state.loading, true);
  h.answer(1, "BONK"); await current;
  assert.equal(h.state.loading, false);
});

test("clearing the query prevents a pending response from reopening suggestions", async () => {
  const h = harness();
  const old = h.ctx.search("PFX");
  await h.ctx.search("");
  h.answer(0, "PFX"); await old;
  assert.equal(h.state.results.length, 0);
  assert.equal(h.state.notice, "");
  assert.equal(h.state.loading, false);
});
