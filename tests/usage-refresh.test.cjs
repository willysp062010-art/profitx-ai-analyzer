const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../components/AnalyzerUsage.js'),'utf8');
function setup(){const requests=[];const state={};const ctx={active:true,revision:{current:0},controller:{signal:{}},fetch:()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),setStats:v=>state.stats=v,setError:v=>state.error=v};vm.runInNewContext(source.slice(source.indexOf('    async function refresh()'),source.indexOf('    if(!visit.current)')),ctx);return{ctx,requests,state};}
test('a slow previous refresh cannot decrease newer public counters',async()=>{
 const h=setup();const old=h.ctx.refresh();const latest=h.ctx.refresh();h.requests[1].resolve({ok:true,json:async()=>({ok:true,visits:2})});await latest;h.requests[0].resolve({ok:true,json:async()=>({ok:true,visits:1})});await old;assert.equal(h.state.stats.visits,2);
});
test('an older network failure cannot hide a successful latest refresh',async()=>{
 const h=setup();const old=h.ctx.refresh();const latest=h.ctx.refresh();h.requests[1].resolve({ok:true,json:async()=>({ok:true,visits:2})});await latest;h.requests[0].reject(Error('old outage'));await old;assert.equal(h.state.error,false);
});
