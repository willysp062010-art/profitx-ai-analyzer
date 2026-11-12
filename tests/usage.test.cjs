const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {createHash}=require('node:crypto');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8').replace(/^import .*;$/gm,'').replace(/export (async function|function|const)/g,'$1').replace('export default async function','async function');
const eventId='f1ce1000-5000-4000-8000-000000000001';
function setup(fetchImpl,env={}){
 const calls=[];const ctx={createHash,AbortSignal,process:{env:{VERCEL_ENV:'production',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-key',...env}},fetch:fetchImpl|| (async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return{ok:true,json:async()=>true};})};vm.runInNewContext(read('utils/usage-server.js')+'\n'+read('pages/api/usage.js'),ctx);return{ctx,calls};
}
const request={method:'POST',headers:{origin:'https://profitx-ai-analyzer.vercel.app',host:'profitx-ai-analyzer.vercel.app','user-agent':'Mozilla/5.0','x-pfx-usage-event':eventId},body:{kind:'visit',eventId}};
function response(){return{statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
test('preview, foreign origins and known bots cannot change public counters',async()=>{
 for(const headers of [{...request.headers,origin:'https://foreign.example'},{...request.headers,host:'preview.vercel.app'},{...request.headers,'user-agent':'Crawlerbot'}]){const h=setup();const res=response();await h.ctx.handler({...request,headers},res);assert.equal(res.statusCode,403);assert.equal(h.calls.length,0);}
 const h=setup(null,{VERCEL_ENV:'preview'});assert.equal(h.ctx.usageRequestAllowed(request),false);
});
test('visit recording accepts only a valid event UUID and visit type',async()=>{
 for(const body of [{kind:'analysis',eventId},{kind:'visit',eventId:'bad'}]){const h=setup();const res=response();await h.ctx.handler({...request,body},res);assert.equal(res.statusCode,400);assert.equal(h.calls.length,0);}
 const h=setup();const res=response();await h.ctx.handler(request,res);assert.equal(res.statusCode,200);assert.equal(h.calls[0].body.p_kind,'visit');assert.deepEqual(Object.keys(h.calls[0].body).sort(),['p_event_id','p_kind']);
});
test('automatic GET analyses and requests without an event cannot inflate analysis counts',async()=>{
 const h=setup();await h.ctx.recordAnalysisUsage({...request,method:'GET'});await h.ctx.recordAnalysisUsage({...request,headers:{...request.headers,'x-pfx-usage-event':undefined}});assert.equal(h.calls.length,0);
});
test('manual analyses use the analysis event and measurement outages never throw',async()=>{
 const h=setup();await h.ctx.recordAnalysisUsage(request);assert.equal(h.calls[0].body.p_kind,'analysis');
 const failing=setup(async()=>{throw Error('network');});await assert.doesNotReject(()=>failing.ctx.recordAnalysisUsage(request));
});
test('summary returns only aggregate fields and preserves real zeros',async()=>{
 const data={since:'2026-11-12T00:00:00Z',visits:0,analyses:0,todayVisits:0,todayAnalyses:0,private:'never-return'};
 const h=setup(async()=>({ok:true,json:async()=>data}));const res=response();await h.ctx.handler({method:'GET'},res);assert.equal(res.statusCode,200);assert.equal(res.body.visits,0);assert.equal(Object.hasOwn(res.body,'private'),false);
});
test('unavailable or malformed summaries produce an error, never invented zero counts',async()=>{
 for(const visits of [-1,'4',null]){const h=setup(async()=>({ok:true,json:async()=>({since:'2026-11-12',visits,analyses:0,todayVisits:0,todayAnalyses:0})}));const res=response();await h.ctx.handler({method:'GET'},res);assert.equal(res.statusCode,503);assert.equal(res.body.visits,undefined);}
});
test('counter write rate is bounded within the current process',()=>{
 const h=setup();for(let i=0;i<60;i++)assert.equal(h.ctx.usageRateAllowed(request),true);assert.equal(h.ctx.usageRateAllowed(request),false);
});
test('client uses a fresh per-event identifier without persistent storage and supports test exclusion',()=>{
 const ctx={window:{location:{hostname:'profitx-ai-analyzer.vercel.app',search:'?usage=off'},crypto:{randomUUID:()=>eventId}},navigator:{userAgent:'Mozilla'},URLSearchParams};vm.runInNewContext(read('utils/usage-client.js'),ctx);assert.equal(ctx.usageEventId(),null);ctx.window.location.search='';assert.equal(ctx.usageEventId(),eventId);ctx.window.location.hostname='preview.vercel.app';assert.equal(ctx.usageEventId(),null);
});
