const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../utils/mint-metadata-identity.js'),'utf8').replace('export function','function'),ctx);
const read=ctx.mintMetadataIdentity;const data=()=>({ok:true,mint:'selected',analysis:{metadata:{decoded:true,metadataMint:'selected',name:' PROFITX ',symbol:' PFX '}}});
test('decoded metadata for the exact mint supplies its declared identity even without a DEX',()=>{const r=read(data(),'selected');assert.equal(r.name,'PROFITX');assert.equal(r.symbol,'PFX');});
test('metadata from another mint or an incomplete decode cannot supply an identity',()=>{for(const change of [d=>d.mint='other',d=>d.analysis.metadata.metadataMint='other',d=>d.analysis.metadata.decoded=false,d=>d.ok=false]){const d=data();change(d);assert.equal(Object.keys(read(d,'selected')).length,0);}});
