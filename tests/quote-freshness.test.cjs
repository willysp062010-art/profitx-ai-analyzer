const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../utils/quote-freshness.js'),'utf8').replace(/export function/g,'function'),ctx);
const now=Date.parse('2026-11-12T10:00:00Z');
test('quote age distinguishes current, old and invalid or future readings',()=>{assert.equal(ctx.quoteAge('2026-11-12T09:59:50Z',now),10);assert.equal(ctx.quoteAge('2026-11-12T09:58:00Z',now),120);for(const d of [null,'bad','2026-11-12T11:00:00Z'])assert.equal(ctx.quoteAge(d,now),null);});
test('FX reference accepts real dated rates including weekends',()=>{const fx=ctx.checkedFxReference({rates:{USD:1.1},date:'2026-11-06'},now);assert.equal(fx.rate,1.1);});
test('missing, invalid, stale or future FX dates and nonnumeric rates fail closed',()=>{for(const date of [null,'bad','2026-02-30','2026-11-13','2026-11-04'])assert.throws(()=>ctx.checkedFxReference({rates:{USD:1.1},date},now));for(const USD of [true,false,[],null,'',Infinity])assert.throws(()=>ctx.checkedFxReference({rates:{USD},date:'2026-11-12'},now));});
