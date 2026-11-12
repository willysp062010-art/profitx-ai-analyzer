const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../pages/api/analyze.js'),'utf8');
const ctx={clamp:v=>Math.max(0,Math.min(100,v))};vm.runInNewContext(source.slice(source.indexOf('function token2022Score('),source.indexOf('/* =========================================================\n   STRUCTURAL SCORE')),ctx);
test('unknown and unscored Token-2022 extensions never contribute a favorable score',()=>{
 for(const value of [null,{}, {isToken2022:null},{isToken2022:true,analysis:{scoringReady:false,analysisComplete:true,findings:[]}}, {isToken2022:true,analysis:{scoringReady:true,analysisComplete:false}}])assert.equal(ctx.token2022Score(value),null);
 assert.equal(ctx.token2022Score({isToken2022:false}),100);
});
test('only a completed scoring-ready extension assessment can contribute its findings',()=>{
 assert.equal(ctx.token2022Score({isToken2022:true,analysis:{scoringReady:true,analysisComplete:true,findings:[{severity:'HIGH'},{severity:'MEDIUM'}]}}),70);
});
