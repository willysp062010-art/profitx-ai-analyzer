const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const compare=fs.readFileSync(path.join(__dirname,'../pages/compare.js'),'utf8');
function comparison({mismatch=false,loading=false}={}){
 const state={};let calls=0;
 const ctx={mintA:'mint-a',mintB:'mint-b',selectedA:null,selectedB:null,loading,isSolanaMint:()=>true,encodeURIComponent,AbortController,setTimeout,clearTimeout,
 setError:v=>state.error=v,setResultA:v=>state.a=v,setResultB:v=>state.b=v,setLoading:v=>state.loading=v,
 fetch:async url=>{calls++;return {ok:true,json:async()=>({ok:true,mint:mismatch?'other':decodeURIComponent(url.split('=')[1])})};}};
 vm.runInNewContext(compare.slice(compare.indexOf('  function clearComparison()'),compare.indexOf('  const hasResults =')),ctx);return {ctx,state,calls:()=>calls};
}
test('comparison rejects an analysis belonging to another token',async()=>{
 const h=comparison({mismatch:true});await h.ctx.compareTokens();assert.equal(h.state.a,null);assert.equal(h.state.b,null);assert.ok(h.state.error);assert.equal(h.state.loading,false);
});
test('comparison accepts matching results for both requested tokens',async()=>{
 const h=comparison();await h.ctx.compareTokens();assert.equal(h.state.a.mint,'mint-a');assert.equal(h.state.b.mint,'mint-b');
});
test('comparison does not launch a second request while busy',async()=>{
 const h=comparison({loading:true});await h.ctx.compareTokens();assert.equal(h.calls(),0);
});
test('editing a comparison clears both old results and their message',()=>{
 const h=comparison();h.state.a={mint:'old-a'};h.state.b={mint:'old-b'};h.state.error='old';h.ctx.clearComparison();assert.equal(h.state.a,null);assert.equal(h.state.b,null);assert.equal(h.state.error,'');
});
const analyzer=fs.readFileSync(path.join(__dirname,'../pages/index.js'),'utf8');
async function rootResponse(payload){
 const state={};const ctx={usageEventId:()=>null,window:{dispatchEvent(){}},Event:class{},loading:false,mint:'requested',isSolanaMint:()=>true,clearTimeout,tokenSearchTimer:{current:null},tokenSearchAbort:{current:null},quoteContext:{current:0},tokenSearchRequest:{current:0},
 console:{error(){}},fetch:async()=>({ok:true,text:async()=>JSON.stringify(payload)})};
 for(const key of ['SellQuoteLoading','EurQuoteLoading','TokenResults','TokenSearchLoading','WatchlistNotice','Loading','Error','Data','SellQuote','SellQuoteError','EurQuote','EurQuoteError'])ctx['set'+key]=v=>state[key]=v;
 vm.runInNewContext(analyzer.slice(analyzer.indexOf('  async function analyze()'),analyzer.indexOf('  const score =',analyzer.indexOf('  async function analyze()'))),ctx);await ctx.analyze();return state;
}
test('Analyzer never displays a successful HTTP response for another mint or a failed result',async()=>{
 for(const payload of [{ok:true,mint:'other'},{ok:false,mint:'requested'},{}]){const state=await rootResponse(payload);assert.equal(state.Data,null);assert.ok(state.Error);assert.equal(state.Loading,false);}
});
test('Analyzer displays the validated requested mint',async()=>{
 const state=await rootResponse({ok:true,mint:'requested'});assert.equal(state.Data.mint,'requested');assert.equal(state.Error,'');
});

test('comparison timeout cancels both requests without displaying partial results',async()=>{
 const h=comparison();let timeout;let cleared=false;const signals=[];
 h.ctx.setTimeout=fn=>{timeout=fn;return 123;};h.ctx.clearTimeout=id=>{assert.equal(id,123);cleared=true;};
 h.ctx.fetch=async(url,{signal})=>{signals.push(signal);return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));};
 const run=h.ctx.compareTokens();timeout();await run;
 assert.equal(signals.length,2);assert.ok(signals.every(s=>s.aborted));assert.equal(h.state.loading,false);
 assert.equal(h.state.a,null);assert.equal(h.state.b,null);assert.match(h.state.error,/délai de réponse/);assert.equal(cleared,true);
});
test('a failed comparison cancels the other request and preserves the actual error',async()=>{
 const h=comparison();let otherSignal;
 h.ctx.fetch=async(url,{signal})=>{if(url.includes('mint-a'))return {ok:false,json:async()=>({error:'Service indisponible'})};
 otherSignal=signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));};
 await h.ctx.compareTokens();assert.equal(otherSignal.aborted,true);assert.equal(h.state.error,'Service indisponible');
 assert.equal(h.state.loading,false);assert.equal(h.state.a,null);assert.equal(h.state.b,null);
});
