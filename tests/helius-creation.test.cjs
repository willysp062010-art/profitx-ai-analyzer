const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const source = fs.readFileSync(new URL("../pages/api/helius-webhook.js", `file://${__filename}`), "utf8");
test("creation proof requires a successful mint initialization in an SPL program", async () => {
  const { verifiedMints } = await import("data:text/javascript," + encodeURIComponent(source));
  const mint = "So11111111111111111111111111111111111111112";
  const init = {programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", parsed: {type: "initializeMint2", info: {mint}}};
  const transfer = {...init, parsed: {...init.parsed, type: "transfer"}};
  const result = {meta: {err: null, innerInstructions: [{instructions: [init, init, transfer]}]}, transaction: {message: {instructions: [{...init, programId: "11111111111111111111111111111111"}]}}};
  assert.deepEqual(verifiedMints(result), [mint]);
  assert.deepEqual(verifiedMints({...result, meta: {...result.meta, err: {InstructionError: [1, "failed"]}}}), []);
  assert.deepEqual(verifiedMints({...result, meta: {err: null, innerInstructions: [{instructions: [transfer]}]}}), []);
});
