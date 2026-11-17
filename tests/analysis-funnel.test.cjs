const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('pages/api/analysis-usage.js','utf8').replace(/^import .*;$/gm,'').replace('export default async function','async function').replace('export const config','const config');
const id='f1ce1000-5000-4000-8000-000000000001';
function setup(data){const calls=[];const ctx={usageRequestAllowed:()=>true,usageRateAllowed:()=>true,usageEventIdValid:x=>x===id,usageRpc:async(name,body)=>{calls.push({name,body});return data;}};vm.runInNewContext(source,ctx);const res={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};return{ctx,res,calls};}
test('only server can record successful analyses; invalid and foreign events are rejected',async()=>{
 for(const kind of ['completed','visit',null]){const h=setup();await h.ctx.handler({method:'POST',body:{eventId:id,kind}},h.res);assert.equal(h.res.code,400);assert.equal(h.calls.length,0);}
 const h=setup();h.ctx.usageRequestAllowed=()=>false;await h.ctx.handler({method:'POST',body:{eventId:id,kind:'started'}},h.res);assert.equal(h.res.code,403);
});
test('only anonymous launch or error fields reach the database',async()=>{for(const kind of ['started','failed']){const h=setup();await h.ctx.handler({method:'POST',body:{eventId:id,kind,mint:'secret',wallet:'secret'}},h.res);assert.equal(h.res.code,200);assert.deepEqual(Object.keys(h.calls[0].body).sort(),['p_event_id','p_kind']);}});
test('real zero counts are preserved and private fields are never exposed',async()=>{const h=setup({since:'2026-11-17',started:0,completed:0,failed:0,private:'secret'});await h.ctx.handler({method:'GET'},h.res);assert.equal(h.res.code,200);assert.equal(h.res.body.started,0);assert.equal(h.res.body.private,undefined);});
test('missing or invalid counts are unavailable, never replaced by zero',async()=>{for(const started of [undefined,-1,'2']){const h=setup({since:'2026-11-17',started,completed:0,failed:0});await h.ctx.handler({method:'GET'},h.res);assert.equal(h.res.code,503);}});
