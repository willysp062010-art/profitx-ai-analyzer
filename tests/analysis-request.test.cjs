const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('utils/analysis-request.js','utf8').replace('export async function','async function');
function setup(fetchImpl) {
 let deadline,cleared=false,signal;
 const ctx={AbortController,Error,TypeError,fetch:async(url,options)=>{signal=options.signal;return fetchImpl(url,options);},setTimeout:fn=>{deadline=fn;return 123;},clearTimeout:id=>{assert.equal(id,123);cleared=true;}};
 vm.runInNewContext(source,ctx);
 return {ctx,expire:()=>deadline(),signal:()=>signal,cleared:()=>cleared};
}
test('deadline releases an analysis even if the request ignores abort',async()=>{
 const h=setup(()=>new Promise(()=>{}));const request=h.ctx.fetchAnalysisResponse('mint');h.expire();
 await assert.rejects(request,/délai de réponse/);assert.equal(h.signal().aborted,true);assert.equal(h.cleared(),true);
});
test('deadline also covers a stalled response body',async()=>{
 let reportBody;const bodyReady=new Promise(resolve=>{reportBody=resolve;});const h=setup(async()=>({ok:true,text:()=>{reportBody();return new Promise(()=>{});}}));
 const request=h.ctx.fetchAnalysisResponse('mint');await bodyReady;h.expire();await assert.rejects(request,/délai de réponse/);
});
test('a caller can cancel an active analysis and its deadline is cleared',async()=>{
 const h=setup(()=>new Promise(()=>{}));const controller=new AbortController();const request=h.ctx.fetchAnalysisResponse('mint',{controller});controller.abort(new Error('Cancelled'));
 await assert.rejects(request,/Cancelled/);assert.equal(h.cleared(),true);
});
test('network failure is actionable and cannot leave the deadline running',async()=>{
 const h=setup(async()=>{throw new TypeError('Failed to fetch');});await assert.rejects(h.ctx.fetchAnalysisResponse('mint'),/Vérifiez votre connexion/);assert.equal(h.cleared(),true);
});
test('the requested mint and event identifier are preserved',async()=>{
 let options;const h=setup(async(url,input)=>{assert.equal(url,'/api/analyze');options=input;return {ok:true,text:async()=>JSON.stringify({ok:true,mint:'mint',liquidity:0})};});
 const result=await h.ctx.fetchAnalysisResponse('mint',{eventId:'anonymous-id'});assert.equal(result.liquidity,0);assert.equal(options.headers['x-pfx-usage-event'],'anonymous-id');assert.equal(JSON.parse(options.body).mint,'mint');assert.equal(h.cleared(),true);
});
