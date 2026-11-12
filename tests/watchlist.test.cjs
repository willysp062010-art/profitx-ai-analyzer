const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ctx = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../utils/watchlist.js"), "utf8").replace(/export (const|function) /g, "$1 ") + "\nmodule.exports={isSolanaMint,readWatchlist,writeWatchlist,mergeWatchlist,parseWatchlistImport,makeWatchlistBackup,watchlistIdentityLabel};", ctx);
const { isSolanaMint, readWatchlist, writeWatchlist, mergeWatchlist, parseWatchlistImport, makeWatchlistBackup } = ctx.module.exports;
const PFX = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
test("mint validation checks decoded length, not just alphabet and text length", () => {
  assert.equal(isSolanaMint(PFX), true); assert.equal(isSolanaMint(BONK), true);
  assert.equal(isSolanaMint("1".repeat(44)), false); assert.equal(isSolanaMint("bad"), false);
});
test("backup round trip preserves mint identities and excludes unrelated credentials", () => {
  const list = mergeWatchlist([], [{ mint: PFX, name: "PROFITX", clientId: "do-not-export" }]);
  const restored = parseWatchlistImport(JSON.stringify({ version: 1, items: list }));
  assert.equal(restored[0].tokenAddress, PFX); assert.equal(restored[0].name, "PROFITX");
  assert.equal(Object.hasOwn(restored[0], "clientId"), false);
});
test("import merges without duplicates or overwriting an existing token", () => {
  const existing = [{ id: `solana:${PFX}`, chainId: "solana", tokenAddress: PFX, name: "Existing" }];
  const merged = mergeWatchlist(existing, [{ mint: PFX, name: "Replacement" }, { mint: BONK }, { mint: BONK }]);
  assert.equal(merged.length, 2); assert.equal(merged[1].name, "Existing"); assert.equal(existing.length, 1);
});
test("one invalid imported entry rejects the entire batch without mutating existing entries", () => {
  const existing = mergeWatchlist([], [{ mint: PFX }]);
  assert.throws(() => mergeWatchlist(existing, [{ mint: BONK }, { mint: "1".repeat(44) }]));
  assert.equal(existing.length, 1); assert.equal(existing[0].tokenAddress, PFX);
});
test("unsupported chains and backup versions are rejected", () => {
  assert.throws(() => parseWatchlistImport(JSON.stringify({ version: 2, items: [] })));
  assert.throws(() => mergeWatchlist([], [{ mint: PFX, chainId: "ethereum" }]));
});
test("corrupted storage is not silently converted to an empty saved list", () => {
  const storage = { getItem: () => '{broken', setItem() { throw Error("must not write"); } };
  assert.throws(() => readWatchlist(storage));
  assert.throws(() => readWatchlist({ getItem: () => '[null]' }));
});
test("storage failures are propagated so the UI cannot claim persistence succeeded", () => {
  assert.throws(() => writeWatchlist({ setItem() { throw Error("quota"); } }, []), /quota/);
});

test("export allowlists fields even for older stored entries", () => {
 const backup = makeWatchlistBackup([{chainId:"solana", tokenAddress:PFX, client_id:"private", secret:"private"}]);
 assert.equal(backup.version,1);
 assert.equal(backup.items[0].tokenAddress,PFX);
 assert.equal(JSON.stringify(backup).includes("private"),false);
});

test("token labels keep exact official mint attribution and distinguish symbols",()=>{
 const label=ctx.module.exports.watchlistIdentityLabel;
 assert.equal(label({chainId:"solana",tokenAddress:PFX}),"PROFITX (PFX)");
 assert.equal(label({chainId:"solana",tokenAddress:BONK,name:"Bonk",symbol:"$BONK"}),"Bonk · $BONK");
 assert.equal(label({chainId:"solana",tokenAddress:BONK}),"Identité non récupérée");
 assert.equal(label({chainId:"ethereum",tokenAddress:PFX}),"Identité non récupérée");
 assert.equal(label({name:"Other PFX",symbol:"PFX",tokenAddress:BONK,chainId:"solana"}),"Other PFX · $PFX");
});

test("legacy missing or colliding identifiers are recovered from exact mint identities without a write",()=>{
 const original=[{chainId:"solana",tokenAddress:PFX,name:"Saved name"},{chainId:"solana",tokenAddress:BONK,id:"same-old-id"}];let writes=0;
 const result=readWatchlist({getItem:()=>JSON.stringify(original),setItem:()=>writes++});
 assert.equal(result[0].id,`solana:${PFX}`);assert.equal(result[1].id,`solana:${BONK}`);
 assert.equal(result[0].name,"Saved name");assert.equal(writes,0);assert.equal(original[0].id,undefined);
});
test("invalid, duplicate or unsupported saved entries are reported without replacing storage",()=>{
 let writes=0;
 const valid={chainId:"solana",tokenAddress:PFX};
 for(const rows of [[{...valid,tokenAddress:"bad"}],[valid,valid],[{...valid,chainId:"ethereum"}],Array(1001).fill(valid)]){
  assert.throws(()=>readWatchlist({getItem:()=>JSON.stringify(rows),setItem:()=>writes++}));
 }
 assert.equal(writes,0);
});
