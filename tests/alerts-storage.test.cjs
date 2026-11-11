const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../pages/alerts.js"), "utf8");
const functions = source.slice(source.indexOf("function loadStorage("), source.indexOf("function serverRowToAlert("));
test("corrupted alert storage is not treated as an empty list or overwritten", () => {
  let writes = 0;
  const ctx = { window: { localStorage: { getItem: () => "[null]", setItem() { writes++; } } } };
  vm.runInNewContext(functions, ctx);
  assert.throws(() => ctx.loadStorage("alerts"));
  assert.equal(writes, 0);
});
test("an unsaved browser identifier is never used for apparently persistent server alerts", () => {
  const ctx = { CLIENT_ID_STORAGE_KEY: "client", window: { localStorage: { getItem() { throw Error("blocked"); } } } };
  vm.runInNewContext(functions, ctx);
  assert.equal(ctx.createClientId(), "");
});
