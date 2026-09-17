import assert from "node:assert/strict";
import test from "node:test";
import {
  TPS_FULL_CONSTRAINT_FACTOR,
  createTechnicalInvalidTpsAttempt,
  deriveTpsTimerContractV1,
  getTpsPrescribedSeconds,
  isEligibleTpsBaselineRecord,
  isScorableTpsTimedAttempt,
  needsTpsCalibration,
  selectTpsBaselineSamples,
  type PassiveRepTimingRecord,
} from "./capabilityTpsTimerContract";

const baseRecord = (overrides: Partial<PassiveRepTimingRecord> = {}): PassiveRepTimingRecord => ({
  recordId: "rep-1",
  studentId: "student-1",
  topic: "Fractions",
  completedAt: "2026-09-17T10:00:00.000Z",
  elapsedMs: 82_000,
  pressureLevel: "none",
  variationLevel: "same_form",
  difficultyLevel: "normal",
  actualSupportUsed: "none",
  structurallyValidCompletion: true,
  timingValidity: "valid",
  source: "historical_untimed",
  ...overrides,
});

test("TPS baseline is the median of the latest three eligible untimed reps", () => {
  const records = [
    baseRecord({ recordId: "older", completedAt: "2026-09-17T08:00:00.000Z", elapsedMs: 140_000 }),
    baseRecord({ recordId: "r1", completedAt: "2026-09-17T09:00:00.000Z", elapsedMs: 84_000 }),
    baseRecord({ recordId: "r2", completedAt: "2026-09-17T10:00:00.000Z", elapsedMs: 77_000 }),
    baseRecord({ recordId: "r3", completedAt: "2026-09-17T11:00:00.000Z", elapsedMs: 82_000 }),
  ];

  const selected = selectTpsBaselineSamples({
    records,
    studentId: "student-1",
    topic: "fractions",
    source: "historical_untimed",
  });
  assert.deepEqual(selected.map((record) => record.recordId), ["r3", "r2", "r1"]);

  const contract = deriveTpsTimerContractV1({ records, studentId: "student-1", topic: "Fractions" });
  assert.ok(contract);
  assert.equal(contract.baselineSeconds, 82);
  assert.equal(contract.structureUnderTimerSeconds, 82);
  assert.equal(contract.repeatedTimedExecutionSeconds, 82);
  assert.equal(contract.fullConstraintSeconds, 70);
  assert.equal(TPS_FULL_CONSTRAINT_FACTOR, 0.85);
});

test("TPS baseline excludes reps that do not preserve the approved baseline condition", () => {
  const variants: Array<Partial<PassiveRepTimingRecord>> = [
    { pressureLevel: "difficulty" },
    { pressureLevel: "light_timer" },
    { variationLevel: "changed_form" },
    { difficultyLevel: "challenging" },
    { difficultyLevel: "recognition" },
    { actualSupportUsed: "response_control_cue" },
    { actualSupportUsed: "first_step_math_support" },
    { actualSupportUsed: "beyond_permitted_boundary" },
    { structurallyValidCompletion: false },
    { timingValidity: "timing_invalid_technical" },
    { elapsedMs: 0 },
    { completedAt: "not-a-date" },
  ];

  variants.forEach((variant, index) => {
    const record = baseRecord({ recordId: `bad-${index}`, ...variant });
    assert.equal(
      isEligibleTpsBaselineRecord(record, "student-1", "Fractions", "historical_untimed"),
      false,
      `variant ${index} should be excluded`,
    );
  });
});

test("fewer than three eligible historical reps requires calibration", () => {
  const records = [
    baseRecord({ recordId: "r1", completedAt: "2026-09-17T09:00:00.000Z" }),
    baseRecord({ recordId: "r2", completedAt: "2026-09-17T10:00:00.000Z" }),
  ];

  assert.equal(needsTpsCalibration({ records, studentId: "student-1", topic: "Fractions" }), true);
  assert.equal(deriveTpsTimerContractV1({ records, studentId: "student-1", topic: "Fractions" }), null);
});

test("three non-scored calibration reps can deterministically create the timer contract", () => {
  const records = [
    baseRecord({ recordId: "c1", source: "calibration", completedAt: "2026-09-17T09:00:00.000Z", elapsedMs: 78_000 }),
    baseRecord({ recordId: "c2", source: "calibration", completedAt: "2026-09-17T10:00:00.000Z", elapsedMs: 92_000 }),
    baseRecord({ recordId: "c3", source: "calibration", completedAt: "2026-09-17T11:00:00.000Z", elapsedMs: 83_000 }),
  ];

  const contract = deriveTpsTimerContractV1({
    records,
    studentId: "student-1",
    topic: "Fractions",
    source: "calibration",
  });
  assert.ok(contract);
  assert.equal(contract.baselineSource, "calibration");
  assert.equal(contract.baselineSeconds, 83);
  assert.equal(contract.fullConstraintSeconds, 71);
});

test("prescribed duration is determined only by the versioned timer contract", () => {
  const records = [
    baseRecord({ recordId: "r1", completedAt: "2026-09-17T09:00:00.000Z" }),
    baseRecord({ recordId: "r2", completedAt: "2026-09-17T10:00:00.000Z" }),
    baseRecord({ recordId: "r3", completedAt: "2026-09-17T11:00:00.000Z" }),
  ];
  const contract = deriveTpsTimerContractV1({ records, studentId: "student-1", topic: "Fractions" });
  assert.ok(contract);

  assert.equal(getTpsPrescribedSeconds(contract, "light_timer"), 82);
  assert.equal(getTpsPrescribedSeconds(contract, "repeated_timer"), 82);
  assert.equal(getTpsPrescribedSeconds(contract, "full_constraint"), 70);
});

test("technical timer failures remain historical but are never scorable TPS attempts", () => {
  const invalid = createTechnicalInvalidTpsAttempt({
    attemptId: "attempt-2",
    pressureLevel: "repeated_timer",
    prescribedSeconds: 82,
    baselineSeconds: 82,
    startedAt: "2026-09-17T12:00:00.000Z",
    endedAt: "2026-09-17T12:00:21.000Z",
    elapsedMs: 21_000,
  });

  assert.equal(invalid.timingValidity, "timing_invalid_technical");
  assert.equal(invalid.completedBeforeExpiry, false);
  assert.equal(isScorableTpsTimedAttempt(invalid), false);
});
