const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../pages/api/alerts-monitor.js"),"utf8")
  .replace("export default async function handler(", "async function handler(")
  + "\nmodule.exports={handler,chooseBestPair,extractMarketData};";
function load(env={},fetchImpl=async()=>{throw Error("Unexpected external request")}) {
  const ctx={module:{exports:{}},process:{env},fetch:fetchImpl,AbortController,
    setTimeout,clearTimeout,Date,console,encodeURIComponent};
  vm.runInNewContext(source,ctx,{filename:"alerts-monitor.js"});
  return ctx.module.exports.handler;
}
function response(){return {statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},
  json(v){this.body=v;return this;}}}
async function invoke(handler,method,headers={}){const res=response();
  await handler({method,headers},res);return res;}
test("health endpoint does not falsely advertise active scheduling or emails",async()=>{
 const res=await invoke(load(),"GET");
 assert.equal(res.statusCode,200);
 assert.equal(res.body.automaticMonitoring,false);
 assert.equal(res.body.scheduled,false);
 assert.equal(res.body.emailNotifications,false);
});
test("monitor rejects missing private Supabase key",async()=>{
 const res=await invoke(load({SUPABASE_URL:"https://example.com",PFX_ALERTS_MONITOR_SECRET:"test"}),"POST",
 {authorization:"Bearer test"});
 assert.equal(res.statusCode,500);
 assert.equal(res.body.error,"SUPABASE_NOT_CONFIGURED");
});
test("monitor rejects unauthorized requests before accessing alerts",async()=>{
 const res=await invoke(load({SUPABASE_URL:"https://example.com",SUPABASE_SERVICE_ROLE_KEY:"private",PFX_ALERTS_MONITOR_SECRET:"test"}),"POST");
 assert.equal(res.statusCode,401);
});

test("base-token market wins over deeper quote-token market for price alerts",()=>{
 const ctx={module:{exports:{}},process:{env:{}},fetch:async()=>{},AbortController,
  setTimeout,clearTimeout,Date,console,encodeURIComponent};
 vm.runInNewContext(source,ctx,{filename:"alerts-monitor.js"});
 const mint="6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
 const pairs=[
  {chainId:"solana",baseToken:{address:"other"},quoteToken:{address:mint},
   liquidity:{usd:900000},priceUsd:"999"},
  {chainId:"solana",baseToken:{address:mint},quoteToken:{address:"other"},
   liquidity:{usd:10000},priceUsd:"0.5"}
 ];
 const best=ctx.module.exports.chooseBestPair(pairs,mint);
 const data=ctx.module.exports.extractMarketData(best,mint);
 assert.equal(data.priceUsd,0.5);
});
test("quote-only market does not invent a price for monitored token",()=>{
 const ctx={module:{exports:{}},process:{env:{}},fetch:async()=>{},AbortController,
  setTimeout,clearTimeout,Date,console,encodeURIComponent};
 vm.runInNewContext(source,ctx,{filename:"alerts-monitor.js"});
 const mint="6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
 const pair={chainId:"solana",baseToken:{address:"other"},quoteToken:{address:mint},
  liquidity:{usd:10000},priceUsd:"999"};
 const data=ctx.module.exports.extractMarketData(ctx.module.exports.chooseBestPair([pair],mint),mint);
 assert.equal(data.priceUsd,null);
});

test("unavailable market state does not count as a new threshold crossing",()=>{
 const ctx={module:{exports:{}},process:{env:{}},fetch:async()=>{},AbortController,
  setTimeout,clearTimeout,Date,console,encodeURIComponent};
 vm.runInNewContext(source.replace("module.exports={handler,chooseBestPair,extractMarketData};","module.exports={handler,chooseBestPair,extractMarketData,buildEvaluation};"),ctx);
 for(const previousStatus of ["no_market_data","metric_unavailable","error"]){
  const alert={metric:"priceUsd",condition:"above",targetValue:1,previousStatus};
  const result=ctx.module.exports.buildEvaluation(alert,{priceUsd:2,symbol:"TEST"},"2026-11-09T00:00:00Z");
  assert.equal(result.triggeredNow,true);
  assert.equal(result.newlyTriggered,false);
 }
});
