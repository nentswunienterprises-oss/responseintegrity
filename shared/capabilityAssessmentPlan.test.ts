import assert from "node:assert/strict";
import test from "node:test";
import { getRequiredCapabilityEvidenceCells } from "./capabilityBlueprint";
import {
  CAPABILITY_MVP_ASSESSMENT_PLAN_V1,
  getCapabilityMvpPlannedEvidenceCells,
} from "./capabilityAssessmentPlan";

const requiredCells = getRequiredCapabilityEvidenceCells().map((cell) => cell.code).sort();

test("MVP assessment plan uses 16 digital proof events instead of 33 separate assessments", () => {
  assert.equal(CAPABILITY_MVP_ASSESSMENT_PLAN_V1.length, 16);
  assert.equal(CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((entry) => entry.evidenceKind === "mastery").length, 11);
  assert.equal(CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((entry) => entry.evidenceKind === "retrieval").length, 2);
  assert.equal(CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((entry) => entry.evidenceKind === "transfer").length, 3);
});

test("the 16 planned assessments cover every one of the 33 required capability evidence cells", () => {
  assert.deepEqual(getCapabilityMvpPlannedEvidenceCells(), requiredCells);
});

test("mastery remains one Deep Dive at a time while cumulative checks carry multiple cells", () => {
  for (const entry of CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((item) => item.evidenceKind === "mastery")) {
    assert.equal(entry.coveredDeepDiveKeys.length, 1);
    assert.equal(entry.formSize, 15);
    assert.ok(entry.minimumItemPoolSize >= entry.formSize * 2);
  }

  for (const entry of CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((item) => item.evidenceKind !== "mastery")) {
    assert.ok(entry.coveredDeepDiveKeys.length >= 4);
    assert.ok(entry.minimumDelayHours >= 24);
    assert.ok(entry.minimumItemPoolSize >= entry.formSize * 2);
  }
});

test("all assessment plan entries preserve the 96 percent deterministic threshold", () => {
  assert.ok(CAPABILITY_MVP_ASSESSMENT_PLAN_V1.every((entry) => entry.passThresholdPercent === 96));
});

test("all 11 Deep Dives appear in mastery, retrieval, and transfer plan coverage", () => {
  const kinds = ["mastery", "retrieval", "transfer"] as const;
  for (const cell of requiredCells) {
    assert.ok(getCapabilityMvpPlannedEvidenceCells().includes(cell));
  }
  for (const kind of kinds) {
    const covered = new Set(
      CAPABILITY_MVP_ASSESSMENT_PLAN_V1
        .filter((entry) => entry.evidenceKind === kind)
        .flatMap((entry) => entry.coveredDeepDiveKeys),
    );
    assert.equal(covered.size, 11, `${kind} must cover all 11 Deep Dives`);
  }
});
