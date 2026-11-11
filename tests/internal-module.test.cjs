const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ctx = { setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../utils/internal-module.js"), "utf8")
  .replace("export async function", "async function"), ctx);
const { runInternalModule } = ctx;

test("internal analysis modules receive only a read-only mint request and preserve zero results", async () => {
  const result = await runInternalModule(async (req, res) => {
    assert.equal(req.method, "GET");
    assert.equal(req.query.mint, "mint");
    assert.equal(Object.keys(req.headers).length, 0);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, count: 0 });
  }, "mint");
  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
});

test("a failed internal module remains unavailable and cannot return a stale success payload", async () => {
  const result = await runInternalModule(async (_, res) => res.status(503).json({ ok: true, count: 100 }), "mint");
  assert.equal(result.ok, false);
});

test("internal errors are sanitized and a module timeout does not hang the analyzer", async () => {
  for (const handler of [async () => { throw Error("private-provider-detail"); }, async () => new Promise(() => {})]) {
    const result = await runInternalModule(handler, "mint", 5);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes("private-provider-detail"), false);
  }
});
