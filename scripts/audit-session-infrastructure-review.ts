import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generateDeterministicCapabilityForm } from "../server/capabilityFormGeneration";
import { buildCapabilityCriticalBoundaryRequirements } from "../shared/capabilityCriticalCoverage";
import { SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS } from "../shared/capabilityAssessmentPlan";

// Supply a private package outside the repository. Run the bank importer in
// validation-only mode first. This audit prints counts and hashes, never items.
const file = process.argv[2];
assert.ok(file, "Usage: node --import tsx scripts/audit-session-infrastructure-review.ts /private/package.json");
const { assessments } = JSON.parse(fs.readFileSync(file, "utf8"));
assert.equal(assessments.length, 6);
assert.deepEqual(assessments.map((bank: any) => bank.assessmentDeepDiveKey).sort(), [...SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS].sort());
for (const bank of assessments) {
  assert.equal(bank.items.length, 45);
  assert.equal(bank.formSize, 15);
  assert.equal(bank.passThresholdPercent, 100);
  for (const item of bank.items) {
    if (item.kind === "sequence") continue;
    const good = item.options.filter((o: any) => item.correctOptionKeys.includes(o.key)).map((o: any) => o.label.length);
    const bad = item.options.filter((o: any) => !item.correctOptionKeys.includes(o.key)).map((o: any) => o.label.length);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const ratio = mean(good) / mean(bad);
    assert.ok(ratio >= 0.8 && ratio <= 1.25, `${bank.assessmentKey}/${item.key}: answer length imbalance`);
    assert.ok(Math.max(...good, ...bad) / Math.min(...good, ...bad) <= 1.7, `${bank.assessmentKey}/${item.key}: outlier option length`);
    assert.ok(Math.min(...good) <= Math.max(...bad) && Math.max(...good) >= Math.min(...bad), `${bank.assessmentKey}/${item.key}: accepted answers separated by length`);
  }
  const config = { ...bank, reviewMode: true, criticalBoundaryRequirements: buildCapabilityCriticalBoundaryRequirements(bank.assessmentKey) };
  const seen = new Set<string>();
  for (let seed = 0; seed < 1000; seed++) {
    const form = generateDeterministicCapabilityForm(config, bank.items, `session-infrastructure-review:${seed}`);
    assert.equal(form.itemKeys.length, 15);
    assert.equal(new Set(form.itemKeys).size, 15);
    form.itemKeys.forEach(key => seen.add(key));
  }
  assert.equal(seen.size, 45, `${bank.assessmentKey}: unreachable items`);
  const sha256 = createHash("sha256").update(JSON.stringify(bank)).digest("hex");
  console.log(`${bank.assessmentKey} v${bank.bankVersion}: 45 items, 1000 valid forms, 45 reachable; package SHA256 ${sha256}`);
}
