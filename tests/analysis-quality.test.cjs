const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const qualitySource = fs.readFileSync(path.join(__dirname, "../utils/analysis-quality.js"), "utf8").replace(/export function /g, "function ");
const pageSource = fs.readFileSync(path.join(__dirname, "../pages/index.js"), "utf8");
const diagnosticSource = pageSource.slice(pageSource.indexOf("function buildProfitxDiagnostic("), pageSource.indexOf("export default function Home()"));
const ctx = { module: { exports: {} }, isNumber: n => typeof n === "number" && Number.isFinite(n) };
vm.runInNewContext(qualitySource + "\n" + diagnosticSource + "\nmodule.exports = { assessAnalysisQuality, describeStructure, canCompareScores, buildProfitxDiagnostic };", ctx);
const { assessAnalysisQuality, describeStructure, canCompareScores, buildProfitxDiagnostic } = ctx.module.exports;
const complete = { components: { liquidity: 100, distribution: 90, maturity: 80, security: 100 },
  activity: 50, volume: 40, isToken2022: false, priceStatus: "SINGLE_SOURCE", totalScore: 90 };

test("a high score with missing security and distribution stays partial", () => {
  const quality = assessAnalysisQuality({ ...complete, components: { liquidity: 100, maturity: 100 } });
  assert.equal(quality.structuralCoverage, 45);
  assert.equal(quality.status, "PARTIAL");
  assert.equal(quality.scoreStatus, "PROVISIONAL");
  assert.equal(describeStructure(100, quality).level, "Analyse partielle");
});
test("fully measured zeroes are available controls, not missing data", () => {
  const quality = assessAnalysisQuality({ ...complete, components: { liquidity: 0, distribution: 0, maturity: 0, security: 0 }, activity: 0, volume: 0, totalScore: 0 });
  assert.equal(quality.structuralCoverage, 100);
  assert.equal(quality.status, "COMPLETE");
  assert.equal(describeStructure(0, quality).level, "Structure très fragile");
});
test("complete coverage does not conceal contradictory prices", () => {
  const quality = assessAnalysisQuality({ ...complete, priceStatus: "CONFLICTING_POOL_PRICES" });
  assert.equal(quality.structuralCoverage, 100);
  assert.equal(quality.status, "CONFLICTING");
  assert.equal(describeStructure(98, quality).level, "Données contradictoires");
  assert.equal(quality.scoreStatus, "PROVISIONAL");
});
test("Token-2022 reading is not equivalent to extensions being scored", () => {
  const quality = assessAnalysisQuality({ ...complete, isToken2022: true, extensionsScored: false });
  assert.equal(quality.status, "PARTIAL");
  assert.ok(quality.issues.some(s => s.includes("Token-2022")));
  assert.equal(assessAnalysisQuality({ ...complete, isToken2022: true, extensionsScored: true }).status, "COMPLETE");
});
test("unknown token standard and missing market volume remain explicit limits", () => {
  const quality = assessAnalysisQuality({ ...complete, isToken2022: null, volume: null });
  assert.equal(quality.status, "PARTIAL");
  assert.ok(quality.issues.some(s => s.includes("Standard")));
  assert.ok(quality.issues.some(s => s.includes("Volume")));
});
test("missing total score is unavailable even if every control returned data", () => {
  const quality = assessAnalysisQuality({ ...complete, totalScore: null });
  assert.equal(quality.status, "UNAVAILABLE");
  assert.equal(quality.scoreStatus, "UNAVAILABLE");
});
test("missing quality metadata never produces a reassuring global interpretation", () => {
  assert.equal(describeStructure(100).level, "Analyse partielle");
  assert.equal(canCompareScores({}, {}), false);
});
test("comparative score highlights require complete analyses on both sides", () => {
  const good = { dataQuality: assessAnalysisQuality(complete) };
  const partial = { dataQuality: assessAnalysisQuality({ ...complete, isToken2022: null }) };
  assert.equal(canCompareScores(good, good), true);
  assert.equal(canCompareScores(good, partial), false);
});
test("page diagnostic uses the structural score and respects quality limits", () => {
  const quality = assessAnalysisQuality(complete);
  const props = { structuralScore: 98, quality, totalScore: 40, missingData: [], activityState: { label: "ACTIF" } };
  assert.equal(buildProfitxDiagnostic(props).level, "Structure très solide");
  assert.equal(buildProfitxDiagnostic({ ...props, quality: { ...quality, status: "PARTIAL", label: "Analyse partielle" } }).level, "Analyse partielle");
});
