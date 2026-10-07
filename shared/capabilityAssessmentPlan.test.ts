import assert from "node:assert/strict";
import test from "node:test";
import { getRequiredCapabilityEvidenceCells } from "./capabilityBlueprint";
import {
  CAPABILITY_MVP_ASSESSMENT_PLAN_V1,
  EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
  SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
  SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
  TRANSFORMATION_DEEP_DIVE_KEYS,
  TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY,
  TRANSFORMATION_TRANSFER_ASSESSMENT_KEY,
  OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
  OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
  getCapabilityMvpPlannedEvidenceCells,
} from "./capabilityAssessmentPlan";

const requiredCells = getRequiredCapabilityEvidenceCells().map((cell) => cell.code).sort();

test("assessment plan uses 27 digital proof events for the 20 Deep Dive architecture", () => {
  assert.equal(CAPABILITY_MVP_ASSESSMENT_PLAN_V1.length, 27);
  assert.equal(
    CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((entry) => entry.evidenceKind === "mastery").length,
    20,
  );
  assert.equal(
    CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((entry) => entry.evidenceKind === "retrieval").length,
    3,
  );
  assert.equal(
    CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((entry) => entry.evidenceKind === "transfer").length,
    4,
  );
});

test("the planned assessments cover every one of the 60 required capability evidence cells", () => {
  assert.deepEqual(getCapabilityMvpPlannedEvidenceCells(), requiredCells);
});

test("Mastery remains one Deep Dive at a time", () => {
  for (const entry of CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((item) => item.evidenceKind === "mastery")) {
    assert.equal(entry.coveredDeepDiveKeys.length, 1);
    assert.equal(entry.formSize, 15);
    assert.equal(entry.minimumItemPoolSize, 45);
    assert.equal(entry.passThresholdPercent, 100);
  }
});

test("legacy cumulative Retrieval and Transfer remain scoped while final OS gates close the remaining Deep Dives", () => {
  const cumulative = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter(
    (entry) => entry.evidenceKind !== "mastery",
  );
  assert.equal(cumulative.length, 7);
  assert.ok(cumulative.every((entry) => entry.minimumItemPoolSize >= entry.formSize));
  assert.ok(cumulative.every((entry) => entry.passThresholdPercent === 96));

  const legacy = cumulative.filter(
    (entry) =>
      entry.assessmentKey !== OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY &&
      entry.assessmentKey !== OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
  );
  assert.equal(legacy.length, 5);
  const legacyCovered = new Set(legacy.flatMap((entry) => entry.coveredDeepDiveKeys));
  const legacyExpected = new Set([
    ...TRANSFORMATION_DEEP_DIVE_KEYS,
    ...SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
  ]);
  assert.deepEqual([...legacyCovered].sort(), [...legacyExpected].sort());

  const osGates = cumulative.filter(
    (entry) =>
      entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY ||
      entry.assessmentKey === OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
  );
  assert.equal(osGates.length, 2);
  const postSandbox = [
    ...EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
    ...SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
    ...SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
  ].sort();
  assert.ok(osGates.every((entry) =>
    JSON.stringify([...entry.coveredDeepDiveKeys].sort()) === JSON.stringify(postSandbox)
  ));
});

test("Transformation Retrieval and Transfer keep their existing timing and form contracts", () => {
  const retrieval = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.find(
    (entry) => entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY,
  );
  const transfer = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.find(
    (entry) => entry.assessmentKey === TRANSFORMATION_TRANSFER_ASSESSMENT_KEY,
  );
  assert.ok(retrieval);
  assert.ok(transfer);
  assert.equal(retrieval.formSize, 25);
  assert.equal(retrieval.minimumDelayHours, 24);
  assert.equal(transfer.formSize, 25);
  assert.equal(transfer.minimumDelayHours, 0);
});

test("all 20 Deep Dives have a Mastery gate", () => {
  const mastered = new Set(
    CAPABILITY_MVP_ASSESSMENT_PLAN_V1
      .filter((entry) => entry.evidenceKind === "mastery")
      .flatMap((entry) => entry.coveredDeepDiveKeys),
  );
  assert.equal(mastered.size, 20);
  assert.deepEqual(
    [...mastered].sort(),
    [
      ...TRANSFORMATION_DEEP_DIVE_KEYS,
      ...EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
      ...SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
      ...SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
    ].sort(),
  );
});
