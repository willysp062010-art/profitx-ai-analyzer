const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const source = fs.readFileSync(new URL("../utils/radar-detection-delay.js", `file://${__filename}`), "utf8");

test("counts only chronological timestamps and preserves zero durations", async () => {
  const { summarizeDetectionDelay } = await import("data:text/javascript," + encodeURIComponent(source));
  const row = (created, detected) => ({onchainCreationTime: created, detectedAt: new Date(detected).toISOString()});
  assert.deepEqual(summarizeDetectionDelay([
    row(5000, 6000), row(5000, 5000), row(null, 5000), row(6000, 5000), row(5000, 8000)
  ], 7000), {total: 5, measured: 2, median: 500, p90: 1000});
  assert.deepEqual(summarizeDetectionDelay([], 7000), {total: 0, measured: 0, median: null, p90: null});
});
