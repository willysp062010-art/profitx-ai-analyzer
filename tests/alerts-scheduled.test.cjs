const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../pages/api/alerts-scheduled.js"), "utf8")
  .replace('import monitorHandler from "./alerts-monitor";', "")
  .replace("export default async function handler(", "async function handler(")
  + "\nmodule.exports={handler};";
function load(env, monitorHandler) {
 const context={module:{exports:{}},process:{env},monitorHandler};
 vm.runInNewContext(source,context);
 return context.module.exports.handler;
}
function res() {
 return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},
  status(n){this.code=n;return this;},json(data){this.data=data;return this;}};
}
test("scheduler rejects missing secrets and unauthorized requests",async()=>{
 let called=0;
 const mock=()=>{called++};
 let r=res();
 await load({},mock)({method:"GET",headers:{}},r);
 assert.equal(r.code,503);
 r=res();
 await load({CRON_SECRET:"cron",PFX_ALERTS_MONITOR_SECRET:"monitor"},mock)
 ({method:"GET",headers:{authorization:"Bearer wrong"}},r);
 assert.equal(r.code,401);
 assert.equal(called,0);
});
test("scheduler rejects non-GET methods",async()=>{
 const r=res();
 await load({CRON_SECRET:"cron",PFX_ALERTS_MONITOR_SECRET:"monitor"},()=>{})
 ({method:"POST",headers:{authorization:"Bearer cron"}},r);
 assert.equal(r.code,405);
});
test("scheduler forwards only verified requests to protected monitor",async()=>{
 let forwarded;
 const r=res();
 await load({CRON_SECRET:"cron",PFX_ALERTS_MONITOR_SECRET:"monitor"},
 async(req)=>{forwarded=req;})({method:"GET",headers:{authorization:"Bearer cron","x-pfx-monitor-secret":"untrusted"}},r);
 assert.equal(forwarded.method,"POST");
 assert.equal(forwarded.headers.authorization,"Bearer monitor");
 assert.equal(forwarded.headers["x-pfx-monitor-secret"],undefined);
});

test("Vercel schedules both radar indexing and private alert monitoring daily",()=>{
 const config=JSON.parse(fs.readFileSync(path.join(__dirname,"../vercel.json"),"utf8"));
 const crons=config.crons||[];
 assert.equal(crons.filter(c=>c.path==="/api/radar-enrich").length,1);
 assert.equal(crons.filter(c=>c.path==="/api/alerts-scheduled").length,1);
 assert.match(crons.find(c=>c.path==="/api/alerts-scheduled").schedule,/^\d{1,2} \d{1,2} \* \* \*$/);
});
test("scheduler never forwards invalid credentials",async()=>{
 let called=0;
 const handler=load({CRON_SECRET:"cron",PFX_ALERTS_MONITOR_SECRET:"monitor"},()=>{called++});
 for(const auth of [undefined,"Bearer","Bearer monitor","Bearer cron "]) {
  const r=res();
  await handler({method:"GET",headers:{authorization:auth}},r);
  assert.equal(r.code,401);
 }
 assert.equal(called,0);
});
