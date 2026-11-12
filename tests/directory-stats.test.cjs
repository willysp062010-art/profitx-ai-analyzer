const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../pages/api/directory-stats.js'),'utf8').replace('export default async function','async function');
async function run(ranges, method='GET') {
  const calls=[];
  const ctx={URLSearchParams,AbortSignal,process:{env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret'}},fetch:async(url,opts)=>{calls.push({url,opts});const range=ranges.shift();if(range instanceof Error)throw range;return {ok:true,headers:{get:()=>range}};}};
  vm.runInNewContext(source,ctx);
  const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.data=data;return this;}};
  await ctx.handler({method},res);return {res,calls};
}
test('directory statistics count all observed tokens and rolling 24h independently of search',async()=>{
 const {res,calls}=await run(['*/124286','*/123']);assert.equal(res.code,200);assert.equal(res.data.total,124286);assert.equal(res.data.detected24h,123);assert.equal(calls.length,2);
 for(const call of calls){assert.equal(call.opts.method,'HEAD');const url=new URL(call.url);assert.equal(url.searchParams.get('chain_id'),'eq.solana');assert.equal(url.searchParams.has('or'),false);assert.equal(url.searchParams.get('detected_at'),'lte.'+res.data.updatedAt);}
 assert.match(new URL(calls[1].url).searchParams.get('and'),/detected_at.gte/);assert.equal(res.data.coverage,'partial');
});
test('real empty directory remains zero',async()=>{const {res}=await run(['*/0','*/0']);assert.equal(res.code,200);assert.equal(res.data.total,0);});
test('missing, invalid, inconsistent counts and network failure cannot become fake zeros',async()=>{
 for(const ranges of [[null,'*/0'],['*/*','*/0'],['*/1','*/2'],[new Error('network'),'*/0']]){const {res}=await run(ranges);assert.equal(res.code,503);assert.equal(res.data.total,undefined);assert.equal(res.headers['Cache-Control'],'no-store');}
});
test('statistics reject writes without database calls',async()=>{const {res,calls}=await run([],'POST');assert.equal(res.code,405);assert.equal(calls.length,0);});
