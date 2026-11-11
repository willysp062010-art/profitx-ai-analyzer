const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const PFX="6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
const SOL="So11111111111111111111111111111111111111112";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
function load(file,fetch){
 const util=["quote-validation","watchlist"].map(name=>fs.readFileSync(path.join(__dirname,`../utils/${name}.js`),"utf8").replace(/export (function|const) /g,"$1 ")).join("\n");
 const api=fs.readFileSync(path.join(__dirname,`../pages/api/${file}.js`),"utf8").replace(/^import .*;$/gm,"").replace("export default async function handler(","async function handler(");
 const ctx={module:{exports:{}},process:{env:{JUPITER_API_KEY:"test-private-key"}},fetch,URL,AbortController,setTimeout,clearTimeout,Date};
 vm.runInNewContext(util+"\n"+api+"\nmodule.exports={handler,checkedQuote};",ctx);
 return ctx.module.exports;
}
async function call(handler,query){const res={setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};await handler({method:"GET",query},res);return res;}
function quoted(url,out="100"){const u=new URL(url);return {ok:true,status:200,json:async()=>({inputMint:u.searchParams.get("inputMint"),outputMint:u.searchParams.get("outputMint"),inAmount:u.searchParams.get("amount"),outAmount:out})};}
test("sell quote validates the exact requested pair and amount without requesting a transaction",async()=>{
 let calls=0;
 const {handler}=load("sell-quote",async(url,options)=>{
 calls++;assert.equal(new URL(url).pathname,"/swap/v2/order");assert.equal(new URL(url).searchParams.has("taker"),false);assert.equal(options.method,undefined);return quoted(url);
 });
 const res=await call(handler,{mint:PFX,amount:"123"});
 assert.equal(calls,1);assert.equal(res.body.status,"ROUTE_QUOTED");assert.equal(res.body.executableNow,null);assert.equal(res.body.outputMint,SOL);assert.equal(res.body.inputAmountRaw,"123");
 assert.equal(JSON.stringify(res.body).includes("test-private-key"),false);
});
test("sell quote rejects mismatched identity, wrong amounts and zero outputs",async()=>{
 for(const change of [{inputMint:USDC},{outputMint:USDC},{inAmount:"999"},{outAmount:"0"},{outAmount:"18446744073709551616"}]){
 const {handler}=load("sell-quote",async url=>{const r=quoted(url);const q=await r.json();return {...r,json:async()=>({...q,...change})};});
 const res=await call(handler,{mint:PFX,amount:"123"});assert.equal(res.body.status,"QUOTE_UNAVAILABLE");assert.equal(res.body.executableNow,null);
 }
});
test("invalid decoded mint is rejected before contacting a quote provider",async()=>{
 const {handler}=load("sell-quote",async()=>{throw Error("unexpected fetch");});
 assert.equal((await call(handler,{mint:"1".repeat(44),amount:"123"})).statusCode,400);
});
test("EUR estimate validates both independent quote legs",async()=>{
 for(const mismatch of [false,true]){
 let calls=0;
 const {handler}=load("sell-eur",async url=>{
 calls++;if(calls===1)return {ok:true,json:async()=>({rates:{USD:1.1},date:"2026-11-11"})};
 const r=quoted(url,calls===2?"500":"10000000");
 if(calls===3&&mismatch){const q=await r.json();return {...r,json:async()=>({...q,outputMint:SOL})};}return r;
 });
 const res=await call(handler,{mint:PFX,eur:"10"});assert.equal(calls,3);assert.equal(res.body.status,mismatch?"QUOTE_UNAVAILABLE":"ROUTE_QUOTED");
 }
});
