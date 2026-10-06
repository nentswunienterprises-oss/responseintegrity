import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generateDeterministicCapabilityForm } from "../server/capabilityFormGeneration";
import { buildCapabilityCriticalBoundaryRequirements } from "../shared/capabilityCriticalCoverage";
import { SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS, CAPABILITY_MVP_ASSESSMENT_PLAN_V1 } from "../shared/capabilityAssessmentPlan";

// Private authoring packages stay outside Git. Validate with the importer first.
// Output contains aggregate assurance only, never questions or accepted keys.
const file = process.argv[2];
assert.ok(file, "Usage: node --import tsx scripts/audit-session-infrastructure-cumulative.ts /private/package.json");
const { assessments } = JSON.parse(fs.readFileSync(file, "utf8"));
assert.deepEqual(assessments.map((bank: any) => bank.assessmentKey).sort(), [...SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS].sort());
const allPrompts = new Set<string>();
for (const bank of assessments) {
  const planned = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.find(entry => entry.assessmentKey === bank.assessmentKey)!;
  assert.ok(bank.items.length >= planned.minimumItemPoolSize);
  assert.equal(bank.formSize, planned.formSize);
  assert.equal(bank.passThresholdPercent, planned.passThresholdPercent);
  const requirements = buildCapabilityCriticalBoundaryRequirements(bank.assessmentKey);
  const config = { ...bank, reviewMode: true, criticalBoundaryRequirements: requirements };
  for (const item of bank.items) {
    const prompt = item.prompt.trim().toLowerCase();
    assert.ok(!allPrompts.has(prompt), `${bank.assessmentKey}: repeated cumulative question`);
    allPrompts.add(prompt);
    if (item.kind === "sequence") continue;
    const good = item.options.filter((option: any) => item.correctOptionKeys.includes(option.key)).map((option: any) => option.label.length);
    const bad = item.options.filter((option: any) => !item.correctOptionKeys.includes(option.key)).map((option: any) => option.label.length);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const ratio = mean(good) / mean(bad);
    assert.ok(ratio >= 0.8 && ratio <= 1.25, `${bank.assessmentKey}/${item.key}: answer length imbalance`);
    assert.ok(Math.max(...good, ...bad) / Math.min(...good, ...bad) <= 1.7, `${bank.assessmentKey}/${item.key}: outlier option length`);
    assert.ok(Math.min(...good) <= Math.max(...bad) && Math.max(...good) >= Math.min(...bad), `${bank.assessmentKey}/${item.key}: accepted answers separated by length`);
  }
  const seen = new Set<string>();
  const byKey = new Map(bank.items.map((item: any) => [item.key, item]));
  for (let seed = 0; seed < 1000; seed++) {
    const form = generateDeterministicCapabilityForm(config, bank.items, `session-cumulative:${seed}`);
    assert.equal(form.itemKeys.length, planned.formSize);
    assert.equal(new Set(form.itemKeys).size, planned.formSize);
    const chosen: any[] = form.itemKeys.map(key => byKey.get(key));
    assert.deepEqual([...new Set(chosen.map(item => item.deepDiveKey))].sort(), [...planned.coveredDeepDiveKeys].sort());
    for (const deepDiveKey of planned.coveredDeepDiveKeys) {
      assert.ok(chosen.some(item => item.deepDiveKey === deepDiveKey && item.criticalBoundaryKeys.length > 0), `${bank.assessmentKey}: form omits a module boundary`);
    }
    form.itemKeys.forEach(key => seen.add(key));
  }
  assert.equal(seen.size, bank.items.length, `${bank.assessmentKey}: unreachable items`);
  const sha256 = createHash("sha256").update(JSON.stringify(bank)).digest("hex");
  console.log(`${bank.assessmentKey} v${bank.bankVersion}: ${bank.items.length} items; 1000 valid forms; all items reachable; SHA256 ${sha256}`);
}
