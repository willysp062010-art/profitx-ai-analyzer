const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const dexSource = fs.readFileSync(path.join(__dirname, "../utils/dex-market.js"), "utf8").replace(/export function /g, "function ");
const source = dexSource + "\n" + fs.readFileSync(path.join(__dirname, "../pages/api/alerts-monitor.js"),"utf8")
  .replace('import { selectDexPair } from "../../utils/dex-market";', "")
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
test("health reports configured daily scheduling without claiming an execution or running the monitor",async()=>{
 const res=await invoke(load({SUPABASE_URL:"https://example.test",SUPABASE_SERVICE_ROLE_KEY:"private",PFX_ALERTS_MONITOR_SECRET:"private-monitor",CRON_SECRET:"private-cron"}),"GET");
 assert.equal(res.body.scheduled,true);
 assert.equal(res.body.monitoringMode,"daily_schedule_configured");
 assert.equal(res.body.lastExecutionVerified,false);
 assert.equal(res.body.emailNotifications,false);
 assert.equal(JSON.stringify(res.body).includes("private-monitor"),false);
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

test("persisted threshold state survives unavailable market data and rearms only after confirmed reset",()=>{
 const ctx={module:{exports:{}},process:{env:{}},fetch:async()=>{},AbortController,
  setTimeout,clearTimeout,Date,console,encodeURIComponent};
 vm.runInNewContext(source.replace("module.exports={handler,chooseBestPair,extractMarketData};","module.exports={handler,chooseBestPair,extractMarketData,buildEvaluation,buildDatabaseUpdate};"),ctx);
 const {buildEvaluation,buildDatabaseUpdate}=ctx.module.exports;
 const alert={metric:"priceUsd",condition:"above",targetValue:1,previousStatus:"no_market_data",lastConditionMet:true,previousTriggerCount:1};
 const unavailable=buildEvaluation(alert,null,"2026-11-09T01:00:00Z");
 assert.equal(unavailable.conditionObserved,false);
 assert.equal(Object.hasOwn(buildDatabaseUpdate(alert,unavailable),"last_condition_met"),false);
 const recovered=buildEvaluation(alert,{priceUsd:2},"2026-11-09T02:00:00Z");
 assert.equal(recovered.newlyTriggered,false);
 assert.equal(buildDatabaseUpdate(alert,recovered).last_condition_met,true);
 const reset=buildEvaluation(alert,{priceUsd:0.5},"2026-11-09T03:00:00Z");
 assert.equal(buildDatabaseUpdate(alert,reset).last_condition_met,false);
 const rearmed=buildEvaluation({...alert,lastConditionMet:false},{priceUsd:2},"2026-11-09T04:00:00Z");
 assert.equal(rearmed.newlyTriggered,true);
 assert.equal(buildDatabaseUpdate(alert,rearmed).trigger_count,2);
});

test("monitor processes never-checked and least recently checked alerts first", async () => {
  const env = {
    SUPABASE_URL: "https://example.com",
    SUPABASE_SERVICE_ROLE_KEY: "private",
    PFX_ALERTS_MONITOR_SECRET: "test"
  };
  const handler = load(env, async (url, options) => {
    const params = new URL(url).searchParams;
    assert.equal(options.method, "GET");
    assert.equal(params.get("enabled"), "eq.true");
    assert.equal(params.get("chain_id"), "eq.solana");
    assert.equal(params.get("order"), "last_checked_at.asc.nullsfirst,created_at.asc,id.asc");
    assert.equal(params.get("limit"), "200");
    return new Response("[]");
  });
  const res = await invoke(handler, "POST", { authorization: "Bearer test" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.summary.checked, 0);
});

test("conflicting pool prices cannot create an automatic threshold crossing",()=>{
 const ctx={module:{exports:{}},process:{env:{}},AbortController,setTimeout,clearTimeout,Date,console};
 vm.runInNewContext(source.replace("module.exports={handler,chooseBestPair,extractMarketData};","module.exports={chooseBestPair,extractMarketData,buildEvaluation};"),ctx);
 const mint="6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
 const pairs=[1000,1,1.1].map((price,i)=>({chainId:"solana",baseToken:{address:mint},
 pairAddress:`pool${i}`,liquidity:{usd:3000-i*1000},priceUsd:String(price),priceChange:{h24:900}}));
 const {chooseBestPair,extractMarketData,buildEvaluation}=ctx.module.exports;
 const market=extractMarketData(chooseBestPair(pairs,mint),mint);
 assert.equal(market.priceUsd,null); assert.equal(market.change24h,null);
 const result=buildEvaluation({metric:"priceUsd",condition:"above",targetValue:1,lastConditionMet:false},market,new Date().toISOString());
 assert.equal(result.triggeredNow,false); assert.equal(result.conditionObserved,false);
});
