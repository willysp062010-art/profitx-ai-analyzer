const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
for (const name of ["activity", "holders", "token2022"]) {
  for (const explicit of [false, true]) test(`${name} honors ${explicit ? "explicit RPC" : "Helius"} and returns retryable sanitized outage`, async () => {
    let fetched;
    const source = fs.readFileSync(path.join(__dirname, `../pages/api/${name}.js`), "utf8").replace("export default async function handler(", "async function handler(");
    const ctx = { process: { env: { HELIUS_API_KEY: "private-test-key", ...(explicit ? { SOLANA_RPC_URL: "https://rpc.example.test" } : {}) } }, Buffer, AbortController, setTimeout, clearTimeout,
      fetch: async url => { fetched = String(url); return new Response("{}", { status: 429 }); } };
    vm.runInNewContext(source, ctx);
    const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
    await ctx.handler({ method: "GET", query: { mint: "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump" } }, res);
    assert.equal(fetched, explicit ? "https://rpc.example.test" : "https://mainnet.helius-rpc.com/?api-key=private-test-key");
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.retryable, true);
    assert.equal(JSON.stringify(res.body).includes("private-test-key"), false);
  });
}
