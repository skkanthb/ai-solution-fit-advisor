// Run: node tests/engine.test.js
// Checks that the rules reproduce every curated recommendation and that safety invariants hold.
const assert = require("assert");
const path = require("path");
const engine = require("../src/engine.js");
const load = (f) => require(path.join(__dirname, "..", "data", f));
const data = { patterns: load("patterns.json"), registry: load("registry.json") };
const useCases = load("use-cases.json");
const questions = load("questions.json");

let failures = 0, count = 0;
function check(name, fn) {
  count++;
  try { fn(); } catch (e) { failures++; console.error("FAIL " + name + "\n  " + e.message); }
}

const valid = Object.fromEntries(questions.map((q) => [q.id, q.options.map((o) => o.v)]));
const patternIds = new Set(data.patterns.map((p) => p.id));

for (const uc of useCases) {
  for (const t of uc.tasks) {
    const id = `${uc.id}/${t.id}`;
    check(`${id} profile complete`, () => {
      for (const k of Object.keys(valid)) assert.ok(valid[k].includes(t.profile[k]), `${k}=${t.profile[k]} is not a valid answer`);
    });
    check(`${id} expected pattern exists`, () => assert.ok(patternIds.has(t.expected), t.expected));
    const r = engine.assess(t.profile, data);
    check(`${id} engine matches curated pattern`, () =>
      assert.strictEqual(r.pattern.id, t.expected, `engine chose ${r.pattern.id} via ${r.rule.id}, curated ${t.expected}`));
    check(`${id} irreversible writes never above level 2 for non-deterministic patterns`, () => {
      if (t.profile.writes === "irreversible" && r.pattern.id !== "RULES") assert.ok(r.autonomy.level <= 2, `level ${r.autonomy.level}`);
    });
    check(`${id} LLM with high error cost never above level 3`, () => {
      if (r.pattern.usesLLM && t.profile.errorCost === "high") assert.ok(r.autonomy.level <= 3);
    });
    check(`${id} has candidates and eval plan`, () => {
      if (r.pattern.id !== "HUMAN") assert.ok(r.candidates.items.length > 0);
      assert.ok(r.evalPlan.metrics.length > 0);
    });
  }
}

check("fully explicit structured logic always yields rules", () => {
  for (const task of ["predict", "classify", "decide", "match", "anomaly"]) {
    const r = engine.classify({ task, modality: "structured", logic: "full", labels: "yes", writes: "none" });
    assert.strictEqual(r.pattern, "RULES", task);
  }
});
check("every rule points at a known pattern", () => {
  for (const r of engine.rulebook()) assert.ok(patternIds.has(r.pattern), r.id);
});

console.log(`${count - failures}/${count} checks passed`);
process.exit(failures ? 1 : 0);
