const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../pages/api/radar-enrich.js'), 'utf8')
  .replace('import crypto from "node:crypto";', '')
  .replace('export default async function handler', 'async function handler');
function load(fetch, env = {}) {
  return vm.runInNewContext(source + '\n({handler,getPendingTokens});', {
    crypto: require('node:crypto'), process:{env}, fetch, URLSearchParams, AbortSignal, console
  });
}
const mint = n => 'A'.repeat(31) + '123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[n];
const rows = (start,status) => Array.from({length:20},(_,i)=>({id:start+i,mint:mint(start+i),
 analysis_status:status,name:null,symbol:null,metadata:{}}));
function candidateFetch(url) {
  const q=new URL(url).searchParams;
  return new Response(JSON.stringify(q.get('analysis_status')==='eq.metadata_missing' ? rows(20,'metadata_missing') :
    q.get('order').startsWith('detected_at.asc') ? rows(0,'pending') : rows(10,'pending')));
}
test('background radar batch shares a bounded budget between old, recent and retry candidates',async()=>{
 const {getPendingTokens}=load(async url=>candidateFetch(url));
 const tokens=await getPendingTokens('https://db.test','key',Date.now(),15);
 assert.equal(tokens.length,15);assert.equal(new Set(tokens.map(t=>t.id)).size,15);
 assert.equal(tokens.slice(0,6).every(t=>t.id<6),true);
 assert.equal(tokens.slice(6,12).every(t=>t.id>=10&&t.id<16),true);
 assert.equal(tokens.slice(12).every(t=>t.analysis_status==='metadata_missing'),true);
});
test('dedicated radar job requires authentication and cannot authorize public GET requests',async()=>{
 let calls=0;
 const {handler}=load(async()=>{calls++;throw Error('unexpected');},{SUPABASE_URL:'https://db.test',
 SUPABASE_SERVICE_ROLE_KEY:'key',HELIUS_API_KEY:'helius',RADAR_ENRICH_JOB_SECRET:'job'});
 for(const [method,authorization] of [['POST',undefined],['POST','Bearer wrong'],['GET','Bearer job']]) {
  const res={setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
  await handler({method,headers:{authorization}},res);assert.equal(res.statusCode,401);
 }
 assert.equal(calls,0);
});
test('authenticated five-minute backfill checks and persists at most fifteen assets',async()=>{
 let assets=0,writes=0;
 const {handler}=load(async(url,options={})=>{
  if(url.startsWith('https://mainnet.helius-rpc.com/')) {
   const ids=JSON.parse(options.body).params.ids;assets=ids.length;
   return new Response(JSON.stringify({result:ids.map(id=>({id,content:{metadata:{name:'Test',symbol:'T'}}}))}));
  }
  if(options.method==='PATCH'){writes++;return new Response(null,{status:204});}
  return candidateFetch(url);
 },{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'key',HELIUS_API_KEY:'helius',RADAR_ENRICH_JOB_SECRET:'job'});
 const res={setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
 await handler({method:'POST',headers:{authorization:'Bearer job'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.checked,15);assert.equal(assets,15);assert.equal(writes,15);
});
