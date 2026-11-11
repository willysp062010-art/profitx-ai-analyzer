const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const mint = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
async function invoke(pairs, jupiter = []) {
  const source = fs.readFileSync(path.join(__dirname, "../pages/api/token-logo.js"), "utf8").replace("export default async function", "async function");
  const ctx = { URL, AbortController, setTimeout, clearTimeout,
    fetch: async url => ({ ok: true, json: async () => String(url).includes("jup.ag") ? jupiter : { pairs } }) };
  vm.runInNewContext(source, ctx);
  const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
  await ctx.handler({ method: "GET", query: { mint } }, res); return res.body;
}
test("a quote-side DEX pair cannot supply the other token's logo", async () => {
  const body = await invoke([{ chainId: "solana", baseToken: { address: "other" }, quoteToken: { address: mint }, info: { imageUrl: "https://example.test/wrong.png" } }]);
  assert.equal(body.imageUri, null);
});
test("logo lookup prefers exact Jupiter mint and rejects non-HTTPS metadata", async () => {
  const pair = { chainId: "solana", baseToken: { address: mint }, info: { imageUrl: "https://example.test/dex.png" } };
  assert.equal((await invoke([pair], [{ id: mint, icon: "https://example.test/exact.png" }])).imageUri, "https://example.test/exact.png");
  assert.equal((await invoke([], [{ id: mint, icon: "javascript:alert(1)" }])).imageUri, null);
});
