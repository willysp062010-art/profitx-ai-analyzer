const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"); const vm = require("node:vm"); const path = require("node:path");
const ctx = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../utils/alert-results.js"),"utf8").replace(/export function /g,"function ")+"\nmodule.exports={alertResultFromRow,latestAlertResult,isOldAlertResult,mergeAlertRecords};",ctx);
const {alertResultFromRow,latestAlertResult,isOldAlertResult,mergeAlertRecords}=ctx.module.exports;
const time="2026-11-11T04:15:00Z";
test("persisted automatic zero value is restored with the original timestamp",()=>{
 const r=alertResultFromRow({alert_id:"rule",status:"watching",current_value:0,last_checked_at:time,token_symbol:"PFX"});
 assert.equal(r.currentValue,0); assert.equal(r.checkedAt,"2026-11-11T04:15:00.000Z"); assert.equal(r.source,"server");
});
test("a rule without a valid check timestamp is not presented as evaluated",()=>{
 assert.equal(alertResultFromRow({alert_id:"rule",status:"triggered"}),null);
 assert.equal(alertResultFromRow({alert_id:"rule",status:"watching",last_checked_at:"invalid"}),null);
});
test("failed or unavailable checks cannot show a leftover stored market value",()=>{
 for(const status of ["error","metric_unavailable","no_market_data"])
 assert.equal(alertResultFromRow({alert_id:"rule",status,current_value:999,last_checked_at:time}).currentValue,null);
});
test("the newer server result replaces an older manual result and vice versa",()=>{
 const old={checkedAt:time},recent={checkedAt:"2026-11-11T12:00:00Z"};
 assert.equal(latestAlertResult(old,recent),recent);assert.equal(latestAlertResult(recent,old),recent);
});
test("results older than the daily cycle tolerance are explicitly stale",()=>{
 assert.equal(isOldAlertResult({checkedAt:time},Date.parse("2026-11-11T12:00:00Z")),false);
 assert.equal(isOldAlertResult({checkedAt:time},Date.parse("2026-11-13T12:00:00Z")),true);
});
test("server settings win while local-only rules and matching manual history survive reload",()=>{
 const a={id:"a",chainId:"solana",tokenAddress:"mint",metric:"priceUsd",condition:"above",targetValue:1,lastManualEvaluation:{checkedAt:time}};
 const merged=mergeAlertRecords([a,{id:"local"}],[{...a,enabled:false,lastManualEvaluation:undefined}]);
 assert.equal(merged.length,2);assert.equal(merged.find(r=>r.id==="a").enabled,false);
 assert.equal(merged.find(r=>r.id==="a").lastManualEvaluation.checkedAt,time);
 const changed=mergeAlertRecords([a],[{...a,targetValue:2,lastManualEvaluation:undefined}]);
 assert.equal(changed[0].lastManualEvaluation,undefined);
});
