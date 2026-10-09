import assert from "node:assert/strict";
import test from "node:test";
import { getRequiredCapabilityEvidenceCells } from "./capabilityBlueprint";
import {
  CAPABILITY_MVP_ASSESSMENT_PLAN_V1,
  CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V2,
  EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
  SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
  SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
  CURRICULUM_V2_SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
  TRANSFORMATION_DEEP_DIVE_KEYS,
  TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY,
  TRANSFORMATION_TRANSFER_ASSESSMENT_KEY,
  OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
  OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
  OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
  OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2,
  getCapabilityMvpPlannedEvidenceCells,
  getCapabilityV2PlannedEvidenceCells,
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

test("the historical v1 plan remains a 60-cell proof baseline", () => {
  const cells = getCapabilityMvpPlannedEvidenceCells();
  assert.equal(cells.length, 60);
  assert.equal(cells.some((cell) => cell.includes("why_training_continues_beyond_clarity")), false);
});

test("the active v2 plan covers every one of the 63 required capability evidence cells", () => {
  assert.deepEqual(getCapabilityV2PlannedEvidenceCells(), requiredCells);
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


test("Curriculum v2 has 21 Masteries and replaces only the final post-Sandbox cumulative gates", () => {
  const mastery = CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V2.filter(
    (entry) => entry.evidenceKind === "mastery",
  );
  assert.equal(mastery.length, 21);

  const systemIntelligence = mastery.filter((entry) =>
    entry.coveredDeepDiveKeys.some((key) =>
      CURRICULUM_V2_SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS.includes(key),
    ),
  );
  assert.equal(systemIntelligence.length, 5);

  assert.equal(
    CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V2.some(
      (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
    ),
    false,
  );
  assert.equal(
    CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V2.some(
      (entry) => entry.assessmentKey === OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
    ),
    false,
  );

  const retrieval = CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V2.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
  );
  const transfer = CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V2.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2,
  );
  assert.ok(retrieval);
  assert.ok(transfer);
  assert.equal(retrieval.coveredDeepDiveKeys.length, 16);
  assert.equal(retrieval.formSize, 32);
  assert.equal(retrieval.minimumItemPoolSize, 64);
  assert.equal(retrieval.minimumDelayHours, 24);
  assert.equal(transfer.coveredDeepDiveKeys.length, 16);
  assert.equal(transfer.formSize, 32);
  assert.equal(transfer.minimumItemPoolSize, 64);
});
