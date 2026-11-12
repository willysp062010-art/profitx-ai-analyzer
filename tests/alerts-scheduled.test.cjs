const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../pages/api/alerts-scheduled.js"), "utf8")
  .replace('import monitorHandler from "./alerts-monitor";', "")
  .replace("export default async function handler(", "async function handler(")
  + "\nmodule.exports={handler,recordRun};";
function load(env, monitorHandler, log = () => {}) {
 const context={module:{exports:{}},process:{env},monitorHandler,console:{info:log,warn:log},AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(source,context);
 return context.module.exports.handler;
}
function res() {
 return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},
  status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}};
}
test("scheduler rejects missing secrets and unauthorized requests",async()=>{
 let called=0;
 const mock=()=>{called++};
 let r=res();
 await load({},mock)({method:"GET",headers:{}},r);
 assert.equal(r.statusCode,503);
 r=res();
 await load({CRON_SECRET:"cron",PFX_ALERTS_MONITOR_SECRET:"monitor"},mock)
 ({method:"GET",headers:{authorization:"Bearer wrong"}},r);
 assert.equal(r.statusCode,401);
 assert.equal(called,0);
});
test("scheduler rejects non-GET methods",async()=>{
 const r=res();
 await load({CRON_SECRET:"cron",PFX_ALERTS_MONITOR_SECRET:"monitor"},()=>{})
 ({method:"POST",headers:{authorization:"Bearer cron"}},r);
 assert.equal(r.statusCode,405);
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
  assert.equal(r.statusCode,401);
 }
 assert.equal(called,0);
});


test("scheduler logs the monitor result only for authenticated calls", async () => {
  const logs = [];
  const handler = load(
    { CRON_SECRET: "cron", PFX_ALERTS_MONITOR_SECRET: "monitor" },
    async (_req, response) => response.status(503).json({ ok: false }),
    (...args) => logs.push(args)
  );
  await handler({ method: "GET", headers: {} }, res());
  assert.equal(logs.length, 0);
  const response = res();
  const result = await handler({ method: "GET", headers: { authorization: "Bearer cron" } }, response);
  assert.equal(result, response);
  assert.equal(response.statusCode, 503);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], "PFX alerts cron completed");
  assert.equal(logs[0][1].status, 503);
  assert.ok(logs[0][1].durationMs >= 0);
});

test("scheduler logs aggregate counts without client identifiers or per-rule data",async()=>{
 const logs=[]; const r=res(); const json=r.json;
 const handler=load({CRON_SECRET:"cron",PFX_ALERTS_MONITOR_SECRET:"monitor"},
 async(_req,response)=>response.json({ok:true,summary:{checked:3,triggered:1,errors:0,unavailable:2,clientId:"private"},results:[{clientId:"private"}]}),
 (...args)=>logs.push(args));
 await handler({method:"GET",headers:{authorization:"Bearer cron"}},r);
 assert.equal(logs[0][1].summary.checked,3);
 assert.equal(logs[0][1].summary.errors,0);
 assert.doesNotMatch(JSON.stringify(logs),/private|clientId/);
 assert.equal(r.json,json);
});

test('scheduler persists aggregate evidence before sending the response',async()=>{
 const order=[];let row;
 const context={module:{exports:{}},process:{env:{CRON_SECRET:'cron',PFX_ALERTS_MONITOR_SECRET:'monitor',SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'server-only'}},
 AbortController,setTimeout,clearTimeout,console:{info(){},warn(){}},
 fetch:async(url,options)=>{order.push('persist');row=JSON.parse(options.body);assert.equal(url,'https://db.example/rest/v1/pfx_alert_cron_runs');return {ok:true};},
 monitorHandler:async(req,r)=>r.status(200).json({ok:true,summary:{checked:0,errors:0,clientId:'private'},results:[{mint:'private'}]})};
 vm.runInNewContext(source,context);const r=res();r.json=function(data){order.push('response');this.data=data;return this;};
 await context.module.exports.handler({method:'GET',headers:{authorization:'Bearer cron'}},r);
 assert.deepEqual(order,['persist','response']);assert.equal(row.outcome,'completed');assert.equal(row.summary.checked,0);
 assert.doesNotMatch(JSON.stringify(row),/private|server-only|clientId|mint/);
});
test('failed evidence storage preserves the monitor response and reports the gap',async()=>{
 let warned=0;const context={module:{exports:{}},process:{env:{CRON_SECRET:'cron',PFX_ALERTS_MONITOR_SECRET:'monitor',SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'server-only'}},
 AbortController,setTimeout,clearTimeout,console:{info(){},warn(){warned++;}},fetch:async()=>({ok:false}),
 monitorHandler:async(req,r)=>r.status(503).json({ok:false})};
 vm.runInNewContext(source,context);const r=res();await context.module.exports.handler({method:'GET',headers:{authorization:'Bearer cron'}},r);
 assert.equal(r.statusCode,503);assert.equal(r.data.ok,false);assert.equal(warned,1);
});
