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

test("webhook batches writes, preserves retries and counts failed rows", async () => {
  const { default: handler } = await import("data:text/javascript," + encodeURIComponent(source));
  const oldFetch = global.fetch;
  const envNames = ["HELIUS_WEBHOOK_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const oldEnv = envNames.map(name => process.env[name]);
  process.env.HELIUS_WEBHOOK_SECRET = "test-secret";
  process.env.SUPABASE_URL = "https://database.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const events = Array.from({length: 40}, (_, i) => ({
    type: "CREATE", source: "PUMP_FUN", feePayer: "So11111111111111111111111111111111111111112",
    events: {tokenMint: {mint: "1111111111111111111111111111111" + alphabet[i] + "AB"}}
  }));
  async function run(failBatch) {
    const requests = [];
    global.fetch = async (url, options) => {
      const rows = JSON.parse(options.body);
      requests.push({url, options, rows});
      return {ok: requests.length !== failBatch, status: 503};
    };
    const res = {setHeader() {}, status(code) {this.code = code; return this;}, json(body) {this.body = body; return this;}};
    await handler({method: "POST", headers: {authorization: "test-secret"}, body: [...events, events[0]]}, res);
    assert.equal(requests.length, 3);
    assert.deepEqual(requests.map(r => r.rows.length), [15, 15, 10]);
    for (const request of requests) {
      assert.match(request.url, /on_conflict=chain_id,mint/);
      assert.equal(request.options.headers.Prefer, "resolution=ignore-duplicates,return=minimal");
    }
    return res;
  }
  try {
    const success = await run(0);
    assert.equal(success.code, 200);
    assert.equal(success.body.processed, 40);
    const failure = await run(2);
    assert.equal(failure.code, 500);
    assert.equal(failure.body.processed, 25);
    assert.equal(failure.body.failed, 15);
    const retry = await run(0);
    assert.equal(retry.code, 200);
  } finally {
    global.fetch = oldFetch;
    envNames.forEach((name, i) => {if (oldEnv[i] === undefined) delete process.env[name]; else process.env[name] = oldEnv[i];});
  }
});
