const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../pages/intelligence.js'),'utf8');
const action = source.slice(source.indexOf('  async function runIntelligence()'), source.indexOf('  const token ='));
function setup({mint='selected-mint',loading=false,responseMint='selected-mint'}={}) {
 const calls=[];const state={};
 const context={mint,loading,isSolanaMint:v=>v==='selected-mint',encodeURIComponent,AbortController,setTimeout,clearTimeout,
  setLoading:v=>state.loading=v,setError:v=>state.error=v,setAnalyzer:v=>state.analyzer=v,setResult:v=>state.result=v,
  fetch:async(url)=>{calls.push(url);return {ok:true,json:async()=>calls.length===1?{ok:true,mint:responseMint}:{ok:true,intelligence:{}}};}};
 vm.runInNewContext(action,context);return {context,calls,state};
}
test('Intelligence rejects an invalid mint before calling either API',async()=>{
 const {context,calls,state}=setup({mint:'BONK'});await context.runIntelligence();
 assert.equal(calls.length,0);assert.match(state.error,/adresse mint Solana/);
});
test('Intelligence ignores repeat submissions while a run is in progress',async()=>{
 const {context,calls}=setup({loading:true});await context.runIntelligence();assert.equal(calls.length,0);
});
test('Intelligence does not interpret an analysis belonging to another mint',async()=>{
 const {context,calls,state}=setup({responseMint:'other-mint'});await context.runIntelligence();
 assert.equal(calls.length,1);assert.equal(state.analyzer,null);assert.equal(state.result,null);assert.ok(state.error);assert.equal(state.loading,false);
});
test('Intelligence forwards a matching analysis to its interpretation endpoint',async()=>{
 const {context,calls,state}=setup();await context.runIntelligence();
 assert.equal(calls.length,2);assert.equal(calls[1],'/api/intelligence');assert.equal(state.result.ok,true);assert.equal(state.loading,false);
});

test('Intelligence aborts a stalled request and releases the loading state',async()=>{
 const {context,state}=setup(); let cancel; let cleared=false; let signal;
 context.setTimeout=fn=>{cancel=fn;return 42;};
 context.clearTimeout=id=>{assert.equal(id,42);cleared=true;};
 context.fetch=async(url,options)=>{signal=options.signal;return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('aborted')));});};
 const run=context.runIntelligence(); cancel(); await run;
 assert.equal(signal.aborted,true);assert.equal(state.loading,false);
 assert.match(state.error,/délai de réponse/);assert.equal(state.result,null);assert.equal(cleared,true);
});
