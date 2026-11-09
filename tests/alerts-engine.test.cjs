const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../pages/api/alerts.js"), "utf8")
  .replace("export default async function handler(", "async function handler(")
  + "\nmodule.exports = { handler };";
const MINT = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
const base = { id: "alert", chainId: "solana", tokenAddress: MINT,
  metric: "priceUsd", condition: "above", targetValue: 1 };
function load(fetchImpl) {
  const ctx = { module: { exports: {} }, fetch: fetchImpl, AbortController,
    setTimeout, clearTimeout, Date, console };
  vm.runInNewContext(source, ctx, { filename: "alerts.js" });
  return ctx.module.exports.handler;
}
function response() {
  return { headers: {}, statusCode: 200, setHeader(k,v) {this.headers[k]=v;},
    status(n) {this.statusCode=n; return this;},
    json(v) {this.body=v; return this;} };
}
async function call(handler, alerts, method="POST") {
  const res=response(); await handler({method,body:{alerts}},res);return res;
}
test("GET accurately reports manual-only monitoring", async () => {
  const res=await call(load(async()=>{throw Error("fetch unexpected")}),[], "GET");
  assert.equal(res.statusCode,200);
  assert.equal(res.body.automaticMonitoring,false);
});
test("malformed address is rejected before DexScreener", async () => {
  const res=await call(load(async()=>{throw Error("fetch unexpected")}),[{...base,tokenAddress:"bad"}]);
  assert.equal(res.statusCode,400);
});
test("boolean target is rejected before DexScreener", async () => {
  const res=await call(load(async()=>{throw Error("fetch unexpected")}),[{...base,targetValue:false}]);
  assert.equal(res.statusCode,400);
});
test("negative price threshold is rejected", async () => {
  const res=await call(load(async()=>{throw Error("fetch unexpected")}),[{...base,targetValue:-1}]);
  assert.equal(res.statusCode,400);
});
test("missing market data is unavailable, not a triggered alert", async () => {
  const handler=load(async()=>({ok:true,json:async()=>[]}));
  const res=await call(handler,[base]);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.summary.unavailable,1);
  assert.equal(res.body.summary.triggered,0);
});
test("verified market threshold is evaluated", async () => {
  const handler=load(async()=>({ok:true,json:async()=>[{
    chainId:"solana",baseToken:{address:MINT},liquidity:{usd:1000},
    priceUsd:"2",priceChange:{h24:10},volume:{h24:50},pairAddress:"pair"
  }]}));
  const res=await call(handler,[base]);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.summary.triggered,1);
});
