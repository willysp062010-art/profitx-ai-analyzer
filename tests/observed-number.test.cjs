const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const helper=fs.readFileSync(path.join(__dirname,'../utils/observed-number.js'),'utf8').replace('export function','function');
const ctx={};vm.runInNewContext(helper,ctx);
test('malformed market values cannot become measured zero or one',()=>{
 for(const value of [null,undefined,true,false,[],[1],{},'', '  ',Infinity,NaN,-1,'-2'])assert.equal(ctx.nonNegativeObservation(value),null);
});
test('actual numeric zero and nonnegative decimal measurements are retained',()=>{
 for(const [value,expected] of [[0,0],['0',0],[0.09,0.09],[' 35.12 ',35.12]])assert.equal(ctx.nonNegativeObservation(value),expected);
});
const api=fs.readFileSync(path.join(__dirname,'../pages/api/pfx-raydium-pool.js'),'utf8').replace(/^import .*;$/gm,'').replace('export default async function','async function');
const PFX='6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump';const SOL='So11111111111111111111111111111111111111112';
async function invoke(pool){
 const c={AbortSignal,console:{error(){}},fetch:async()=>({ok:true,json:async()=>({success:true,data:[pool]})})};vm.runInNewContext(helper+'\nconst value=nonNegativeObservation;\n'+api,c);
 const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
 await c.handler({method:'GET'},res);return res;
}
const pool={id:'8xezT7zFCg3adVTyME72qiA42upJdy8SATFyhZJcX9jb',mintA:{address:SOL},mintB:{address:PFX},tvl:true,mintAmountA:[],mintAmountB:'  ',day:{volume:0}};
test('pool API keeps unavailable reserves null while retaining real zero volume',async()=>{
 const r=await invoke(pool);assert.equal(r.statusCode,200);assert.equal(r.body.tvlUsd,null);assert.equal(r.body.solReserve,null);assert.equal(r.body.pfxReserve,null);assert.equal(r.body.volume24hUsd,0);
});
test('a mismatched pool mint cannot supply official PFX measurements',async()=>{
 const r=await invoke({...pool,mintB:{address:SOL}});assert.equal(r.statusCode,502);assert.equal(r.body.ok,false);
});
