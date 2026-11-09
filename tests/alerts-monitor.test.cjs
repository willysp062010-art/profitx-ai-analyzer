const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../pages/api/alerts-monitor.js"),"utf8")
  .replace("export default async function handler(", "async function handler(")
  + "\nmodule.exports={handler};";
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
