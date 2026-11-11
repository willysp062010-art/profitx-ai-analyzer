const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../pages/watchlist.js'),'utf8');
const actions=source.slice(source.indexOf('  function removeToken('),source.indexOf('  async function copyAddress('));
const utils=fs.readFileSync(path.join(__dirname,'../utils/watchlist.js'),'utf8').replace(/export /g,'');
const mint='6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump';
const token={id:'solana:'+mint,chainId:'solana',tokenAddress:mint,name:'PROFITX',addedAt:'2026-11-11T00:00:00Z'};
function setup(fail=false){
 let items=[token];const state={};
 const ctx={removed:null,window:{localStorage:{}},readWatchlist:()=>items,
 commitItems:next=>{if(fail)return false;items=next;return true;},
 setRemoved:v=>ctx.removed=v,setNotice:v=>state.notice=v,setError:v=>state.error=v};
 vm.runInNewContext(utils+'\n'+actions,ctx);ctx.readWatchlist=()=>items;
 return {ctx,state,get:()=>items,set:v=>items=v};
}
test('removal can be undone without losing tokens added in the meantime',()=>{
 const s=setup();s.ctx.removeToken(token.id);assert.equal(s.get().length,0);
 const added={...token,id:'other',tokenAddress:'So11111111111111111111111111111111111111112'};s.set([added]);s.ctx.undoRemoval();
 assert.equal(s.get().length,2);assert.ok(s.get().some(t=>t.tokenAddress===added.tokenAddress));assert.equal(s.get().find(t=>t.tokenAddress===mint).name,'PROFITX');assert.equal(s.ctx.removed,null);
});
test('failed removal never offers a restoration for a token that was not removed',()=>{
 const s=setup(true);s.ctx.removeToken(token.id);assert.equal(s.get().length,1);assert.equal(s.ctx.removed,null);assert.equal(s.state.notice,'');
});
test('undo does not duplicate a token already restored elsewhere',()=>{
 const s=setup();s.ctx.removeToken(token.id);s.set([token]);s.ctx.undoRemoval();assert.equal(s.get().length,1);
});
const identifyAction=source.slice(source.indexOf('  async function identifyToken('),source.indexOf('  function undoRemoval('));
function identifySetup(results){
 let items=[token];const state={};let finish;
 const context={identifying:'',storageReady:true,window:{localStorage:{}},AbortController,setTimeout,clearTimeout,encodeURIComponent,
 setIdentifying:v=>state.identifying=v,setError:v=>state.error=v,setNotice:v=>state.notice=v,
 readWatchlist:()=>items,commitItems:next=>{items=next;return true;},
 fetch:()=>new Promise(resolve=>finish=()=>resolve({ok:true,json:async()=>({ok:true,results})}))};
 vm.runInNewContext(identifyAction,context);return {context,state,get:()=>items,set:v=>items=v,finish:()=>finish()};
}
test('identity lookup cannot assign the name of another mint',async()=>{
 const s=identifySetup([{mint:'So11111111111111111111111111111111111111112',name:'Wrong token'}]);
 const pending=s.context.identifyToken(token);s.finish();await pending;assert.equal(s.get()[0].name,'PROFITX');assert.match(s.state.notice,/Aucun nom/);
});
test('identity lookup preserves entries added while the request is pending',async()=>{
 const s=identifySetup([{mint,name:'Recovered',symbol:'PFX'}]);const pending=s.context.identifyToken(token);
 const other={...token,id:'other',tokenAddress:'So11111111111111111111111111111111111111112'};s.set([token,other]);s.finish();await pending;
 assert.equal(s.get().length,2);assert.equal(s.get()[0].name,'Recovered');assert.equal(s.get()[1].tokenAddress,other.tokenAddress);assert.equal(s.state.identifying,'');
});
test('identity lookup never recreates an entry removed while loading',async()=>{
 const s=identifySetup([{mint,name:'Recovered'}]);const pending=s.context.identifyToken(token);s.set([]);s.finish();await pending;
 assert.equal(s.get().length,0);assert.match(s.state.notice,/retiré entre-temps/);
});
