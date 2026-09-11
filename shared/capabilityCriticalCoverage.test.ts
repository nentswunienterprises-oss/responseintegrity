import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_MVP_ASSESSMENT_PLAN_V1 } from "./capabilityAssessmentPlan";
import { getCapabilityDeepDiveBlueprint } from "./capabilityBlueprint";
import { buildCapabilityCriticalBoundaryRequirements } from "./capabilityCriticalCoverage";

for (const assessment of CAPABILITY_MVP_ASSESSMENT_PLAN_V1) {
  test(`${assessment.assessmentKey} derives the planned critical-boundary quota`, () => {
    const requirements = buildCapabilityCriticalBoundaryRequirements(assessment.assessmentKey);
    assert.equal(requirements.length, assessment.coveredDeepDiveKeys.length);

    for (const requirement of requirements) {
      const blueprint = getCapabilityDeepDiveBlueprint(requirement.deepDiveKey);
      assert.ok(blueprint);
      assert.deepEqual(requirement.boundaryKeys, blueprint.criticalBoundaries.map((boundary) => boundary.key));
      assert.equal(
        requirement.minimumDistinctBoundaries,
        assessment.criticalCoverageMode === "all_boundaries"
          ? blueprint.criticalBoundaries.length
          : 1,
      );
    }
  });
}

test("all mastery checks require every critical boundary in their Deep Dive", () => {
  const mastery = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((entry) => entry.evidenceKind === "mastery");
  assert.equal(mastery.length, 11);
  assert.ok(mastery.every((entry) => entry.criticalCoverageMode === "all_boundaries"));
});

test("all cumulative retrieval and transfer checks require one critical boundary per covered Deep Dive", () => {
  const cumulative = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((entry) => entry.evidenceKind !== "mastery");
  assert.equal(cumulative.length, 5);
  assert.ok(cumulative.every((entry) => entry.criticalCoverageMode === "one_per_deep_dive"));
});
