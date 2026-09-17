import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { CAPABILITY_MVP_ASSESSMENT_PLAN_V1 } from "./capabilityAssessmentPlan";
import { CAPABILITY_DEEP_DIVE_BLUEPRINTS } from "./capabilityBlueprint";
import { buildCapabilityCriticalBoundaryRequirements } from "./capabilityCriticalCoverage";

const bankCoverageSource = fs.readFileSync(
  new URL("./capabilityBankCoverage.ts", import.meta.url),
  "utf8",
);

test("all 11 mastery plan entries require every canonical critical boundary", () => {
  const masteryEntries = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((entry) => entry.evidenceKind === "mastery");
  assert.equal(masteryEntries.length, 11);

  for (const entry of masteryEntries) {
    assert.equal(entry.coveredDeepDiveKeys.length, 1);
    assert.equal(entry.criticalCoverageMode, "all_boundaries");
    const deepDive = CAPABILITY_DEEP_DIVE_BLUEPRINTS.find(
      (candidate) => candidate.key === entry.coveredDeepDiveKeys[0],
    );
    assert.ok(deepDive);
    const requirements = buildCapabilityCriticalBoundaryRequirements(entry.assessmentKey);
    assert.equal(requirements.length, 1);
    assert.equal(requirements[0].minimumDistinctBoundaries, deepDive.criticalBoundaries.length);
    assert.deepEqual(
      [...requirements[0].boundaryKeys].sort(),
      deepDive.criticalBoundaries.map((boundary) => boundary.key).sort(),
    );
  }
});

test("release-grade mastery validation requires every declared Deep Dive competency", () => {
  assert.match(bankCoverageSource, /if \(assessment\.evidenceKind === "mastery"\)/);
  assert.match(bankCoverageSource, /const missingCompetencies = assessmentDeepDive\.competencyKeys\.filter/);
  assert.match(bankCoverageSource, /Mastery assessment .* omits declared/);
});

test("release-grade private pools reject any omitted canonical critical boundary", () => {
  assert.match(bankCoverageSource, /const missingBoundaries = deepDive\.criticalBoundaries/);
  assert.match(bankCoverageSource, /private pool omits canonical/);
  assert.match(bankCoverageSource, /validateCriticalBoundaryTags\(assessment\)/);
});
