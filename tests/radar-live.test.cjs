const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../pages/api/radar-live.js"), "utf8")
  .replace("export default async function handler", "async function handler")
  .replace("export const config", "const config");
const mint = "So11111111111111111111111111111111111111112";

function identityHelpers() {
  return vm.runInNewContext(source + "\n({mintMetadata, resolveTokenIdentity, fetchMarketPairs});", {
    process: { env: {} }, URLSearchParams, AbortSignal, console,
  });
}

test("Radar reads Token-2022 identity from metadata tied to the requested mint", () => {
  const { mintMetadata } = identityHelpers();
  const info = { extensions: [{ extension: "tokenMetadata", state: { mint, name: "Gǒu", symbol: "GǑU" } }] };
  const result = mintMetadata(info, mint, "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
  assert.equal(result.name, "Gǒu");
  assert.equal(result.symbol, "GǑU");
  assert.equal(mintMetadata(info, "different-mint", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb").name, null);
  assert.equal(mintMetadata(info, mint, "wrong-owner").name, undefined);
});

test("Radar replaces missing indexed names using the existing Solana or matching DEX result", () => {
  const { resolveTokenIdentity } = identityHelpers();
  const chain = resolveTokenIdentity({ name: "Token inconnu", symbol: "N/D" }, { name: "Gǒu", symbol: "GǑU" });
  assert.equal(chain.name, "Gǒu");
  assert.equal(chain.nameSource, "solana_mint_metadata");
  const dex = resolveTokenIdentity({}, {}, { name: "Known market token", symbol: "KMT" });
  assert.equal(dex.name, "Known market token");
  assert.equal(dex.nameSource, "dexscreener_pair");
  assert.equal(resolveTokenIdentity({ name: "Indexed name" }, { name: "Other name" }).name, "Indexed name");
});

test("missing identity remains explicitly unavailable without inventing a name or symbol", () => {
  const { resolveTokenIdentity } = identityHelpers();
  const result = resolveTokenIdentity({ name: " ", symbol: "N/D" });
  assert.equal(result.name, "Nom non récupéré");
  assert.equal(result.nameStatus, "missing");
  assert.equal(result.nameSource, null);
  assert.equal(result.symbol, "N/D");
});

test("DEX metadata for a different base token cannot identify a quote-side mint", async () => {
  const helpers = vm.runInNewContext(source + "\n({fetchMarketPairs});", {
    process: { env: {} }, AbortSignal, console,
    fetch: async () => new Response(JSON.stringify([{ chainId: "solana", baseToken: { address: "another-mint", name: "Wrong token" }, quoteToken: { address: mint } }])),
  });
  const result = await helpers.fetchMarketPairs([{ mint }]);
  assert.equal(result.byMint.has(mint), false);
});

test("Radar checks concentration and creator history in parallel with metadata lookups", async () => {
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

async function paginatedRadar(size) {
 const calls=[];
 const handler=vm.runInNewContext(source+"\nhandler;",{
  process:{env:{SUPABASE_URL:"https://db.test",SUPABASE_SERVICE_ROLE_KEY:"private"}},
  URLSearchParams,AbortSignal,console,
  fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(
   Array.from({length:size},(_,id)=>({id,mint,name:"Known",symbol:"KN"}))));}
 });
 const res={setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
 await handler({method:"GET",query:{}},res);return {res,calls};
}
test("Radar lookahead paginates without full-index counts or database writes",async()=>{
 for(const [size,more] of [[0,false],[99,false],[100,false],[101,true]]) {
  const {res,calls}=await paginatedRadar(size);
  assert.equal(res.statusCode,200);assert.equal(res.body.count,Math.min(size,100));
  assert.equal(res.body.hasMore,more);assert.equal(res.body.totalIndexed,null);
  const databaseCalls=calls.filter(call=>call.url.startsWith("https://db.test"));
  assert.equal(databaseCalls.length,1);
  assert.equal(new URL(databaseCalls[0].url).searchParams.get("limit"),"101");
  assert.equal(databaseCalls[0].options.headers.Prefer,undefined);
  assert.ok(databaseCalls.every(call=>!call.options.method||call.options.method==="GET"));
 }
});
test("optional provider signals inherit the shared deadline",()=>{
 const {boundedSignal}=vm.runInNewContext(source+"\n({boundedSignal});",{AbortSignal});
 const controller=new AbortController();const signal=boundedSignal(5000,controller.signal);
 assert.equal(signal.aborted,false);controller.abort();assert.equal(signal.aborted,true);
});

test("transient DAS metadata is attributed to Helius instead of claiming database persistence",()=>{
 const {resolveTokenIdentity}=identityHelpers();
 const result=resolveTokenIdentity({name:null,liveMetadata:{name:"Read-only identity",symbol:"READ"}});
 assert.equal(result.name,"Read-only identity");assert.equal(result.nameSource,"helius_das");
});

test("pagination retains database microseconds in its snapshot boundary",async()=>{
 const snapshot="2026-11-16T12:34:56.123456+00:00";
 let query;
 const handler=vm.runInNewContext(source+"\nhandler;",{
  process:{env:{SUPABASE_URL:"https://db.test",SUPABASE_SERVICE_ROLE_KEY:"private"}},
  URLSearchParams,AbortSignal,console,fetch:async url=>{
   query=new URL(url).searchParams;return new Response("[]");
  }
 });
 const res={setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
 await handler({method:"GET",query:{page:"1",snapshot}},res);
 assert.equal(res.statusCode,200);assert.equal(query.get("detected_at"),"lte."+snapshot);
 assert.equal(res.body.snapshot,snapshot);assert.equal(query.get("offset"),"100");
});
