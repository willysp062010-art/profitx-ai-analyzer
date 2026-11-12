const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../pages/api/security.js"), "utf8")
  .replace("export default async function handler(", "async function handler(")
  + "\nmodule.exports = { handler, decodeClassicMint };";

const MINT = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
const OWNER = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
function mintBytes() {
  const b = Buffer.alloc(82);
  b[45] = 1;
  return b;
}
function load(fetchImpl, env = {}) {
  const context = {
    module: { exports: {} },
    Buffer, Uint8Array, BigInt, AbortController, setTimeout, clearTimeout,
    fetch: fetchImpl,
    process: { env }
  };
  vm.runInNewContext(source, context, { filename: "security.js" });
  return context.module.exports;
}
function response() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.statusCode = n; return this; },
    json(v) { this.body = v; return this; }
  };
}
function rpc(account, supply, status = 200) {
  return async (_url, options) => {
    const { method } = JSON.parse(options.body);
    if (status !== 200) return { ok: false, status };
    return {
      ok: true,
      json: async () => ({ result: method === "getAccountInfo"
        ? { value: account }
        : { value: supply } })
    };
  };
}
const account = () => ({ owner: OWNER, data: [mintBytes().toString("base64"), "base64"] });
const supply = { amount: "100", decimals: 0, uiAmountString: "100" };

test("valid mint preserves verified revoked authorities", async () => {
  const { handler } = load(rpc(account(), supply));
  const res = response();
  await handler({ method: "GET", query: { mint: MINT } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.security.mintAuthorityRevoked, true);
  assert.equal(res.body.security.freezeAuthorityRevoked, true);
});

test("invalid address is rejected before RPC", async () => {
  const { handler } = load(async () => { throw Error("unexpected fetch"); });
  const res = response();
  await handler({ method: "GET", query: { mint: "bad" } }, res);
  assert.equal(res.statusCode, 400);
});

test("invalid mint authority flag is never reported as revoked", async () => {
  const bad = mintBytes(); bad[0] = 2;
  const { handler } = load(rpc({ owner: OWNER, data: [bad.toString("base64"), "base64"] }, supply));
  const res = response();
  await handler({ method: "GET", query: { mint: MINT } }, res);
  assert.equal(res.statusCode, 422);
});

test("malformed base64 is rejected", async () => {
  const { handler } = load(rpc({ owner: OWNER, data: ["!!bad!!", "base64"] }, supply));
  const res = response();
  await handler({ method: "GET", query: { mint: MINT } }, res);
  assert.equal(res.statusCode, 422);
});

test("RPC 429 returns retryable 503, not a safety result", async () => {
  const { handler } = load(rpc(null, null, 429));
  const res = response();
  await handler({ method: "GET", query: { mint: MINT } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.retryable, true);
});

test("RPC 500 returns retryable 503", async () => {
  const { handler } = load(rpc(null, null, 500));
  const res = response();
  await handler({ method: "GET", query: { mint: MINT } }, res);
  assert.equal(res.statusCode, 503);
});

test("supply RPC outage preserves verified mint data", async () => {
  const { handler } = load(async (_url, options) => {
    const { method } = JSON.parse(options.body);
    if (method === "getTokenSupply") return { ok: false, status: 429 };
    return { ok: true, json: async () => ({ result: { value: account() } }) };
  });
  const res = response();
  await handler({ method: "GET", query: { mint: MINT } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.security.mintAuthorityRevoked, true);
  assert.ok(res.body.security.warnings.includes("TOKEN_SUPPLY_RPC_UNAVAILABLE"));
});

test("Helius RPC is selected when configured", async () => {
  let usedUrl = "";
  const mock = rpc(account(), supply);
  const { handler } = load(async (url, options) => {
    usedUrl = url;
    return mock(url, options);
  }, { HELIUS_API_KEY: "test-key" });
  const res = response();
  await handler({ method: "GET", query: { mint: MINT } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(usedUrl, "https://mainnet.helius-rpc.com/?api-key=test-key");
});

test("explicit SOLANA_RPC_URL takes precedence over Helius", async () => {
  let usedUrl = "";
  const mock = rpc(account(), supply);
  const { handler } = load(async (url, options) => {
    usedUrl = url;
    return mock(url, options);
  }, { SOLANA_RPC_URL: "https://rpc.example.test", HELIUS_API_KEY: "test-key" });
  const res = response();
  await handler({ method: "GET", query: { mint: MINT } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(usedUrl, "https://rpc.example.test");
});

test('token accounts and uninitialized accounts cannot receive a mint safety score',async()=>{
 const padded=Buffer.alloc(165);mintBytes().copy(padded);
 const extendedAccount=Buffer.alloc(170);mintBytes().copy(extendedAccount);extendedAccount[165]=2;
 const uninitialized=mintBytes();uninitialized[45]=0;
 for(const [owner,bytes] of [['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',padded],[OWNER,padded],[OWNER,extendedAccount],[OWNER,uninitialized]]) {
  const {handler}=load(rpc({owner,data:[bytes.toString('base64'),'base64']},supply));const res=response();await handler({method:'GET',query:{mint:MINT}},res);assert.equal(res.statusCode,422);assert.equal(res.body.security,undefined);
 }
});
test('extended Token-2022 mint retains its base authority checks when account type is Mint',async()=>{
 const bytes=Buffer.alloc(170);mintBytes().copy(bytes);bytes[165]=1;
 const {handler}=load(rpc({owner:OWNER,data:[bytes.toString('base64'),'base64']},supply));const res=response();await handler({method:'GET',query:{mint:MINT}},res);assert.equal(res.statusCode,200);assert.equal(res.body.security.mintAuthorityRevoked,true);
});
