import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSIVE_EXECUTION_TIMING_WIRE_KEY,
  TPS_FULL_CONSTRAINT_FACTOR,
  TPS_TRAINING_BASELINE_SET_ID,
  buildPassiveExecutionTimingEvidence,
  decodePassiveExecutionTimingEvidence,
  encodePassiveExecutionTimingEvidence,
  deriveTpsBaselineSnapshot,
  deriveTpsTimerContractV1,
  getTpsPrescribedSeconds,
  isEligibleTpsBaselineRecord,
  selectCompleteDiagnosisBaseline,
  selectLatestCompleteTrainingBaselineSet,
  type TpsBaselineTimingRecord,
} from "./tpsTimingContract";

const baseRecord = (
  overrides: Partial<TpsBaselineTimingRecord> = {},
): TpsBaselineTimingRecord => ({
  recordId: "record-1",
  studentId: "student-1",
  topic: "Fractions",
  source: "training",
  sourceEpochKey: "se-epoch-1",
  baselineGroupId: "session-a::independent-execution",
  baselineSlot: 1,
  attemptNumber: 1,
  sourcePhase: "Structured Execution",
  sourceSetId: TPS_TRAINING_BASELINE_SET_ID,
  completedAt: "2026-09-23T10:00:00.000Z",
  elapsedMs: 82_000,
  pressureLevel: "none",
  variationLevel: "same_form",
  difficultyLevel: "normal",
  independencePreserved: true,
  structurallyValidCompletion: true,
  timingValidity: "valid",
  ...overrides,
});

const trainingSet = ({
  groupId,
  completedHour,
  elapsedMs,
  sourceEpochKey = "se-epoch-1",
}: {
  groupId: string;
  completedHour: number;
  elapsedMs: [number, number, number];
  sourceEpochKey?: string;
}) =>
  elapsedMs.map((duration, index) =>
    baseRecord({
      recordId: `${groupId}-r${index + 1}`,
      baselineGroupId: groupId,
      baselineSlot: (index + 1) as 1 | 2 | 3,
      sourceEpochKey,
      elapsedMs: duration,
      completedAt: `2026-09-23T${String(completedHour + index).padStart(2, "0")}:00:00.000Z`,
    }),
  );

test("uses the most recent complete clean Independent Execution set in the current SE epoch", () => {
  const records = [
    ...trainingSet({
      groupId: "round-a",
      completedHour: 8,
      elapsedMs: [58_000, 55_000, 57_000],
    }),
    ...trainingSet({
      groupId: "round-b",
      completedHour: 12,
      elapsedMs: [49_000, 51_000, 48_000],
    }),
    ...trainingSet({
      groupId: "round-c",
      completedHour: 16,
      elapsedMs: [43_000, 45_000, 44_000],
    }),
  ];

  const selected = selectLatestCompleteTrainingBaselineSet({
    records,
    studentId: "student-1",
    topic: "fractions",
    sourceEpochKey: "se-epoch-1",
  });

  assert.ok(selected);
  assert.equal(selected[0].baselineGroupId, "round-c");

  const snapshot = deriveTpsBaselineSnapshot(selected);
  assert.deepEqual(snapshot.elapsedMs, [43_000, 45_000, 44_000]);
  assert.equal(snapshot.baselineSeconds, 44);

  const contract = deriveTpsTimerContractV1(snapshot);
  assert.equal(contract.baselineSource, "training_independent_execution");
  assert.equal(contract.structureUnderTimerSeconds, 44);
  assert.equal(contract.repeatedTimedExecutionSeconds, 44);
  assert.equal(contract.fullConstraintSeconds, 37);
  assert.equal(TPS_FULL_CONSTRAINT_FACTOR, 0.85);
});

test("an incomplete newer set cannot displace an older complete set and records are never cherry-picked across sets", () => {
  const complete = trainingSet({
    groupId: "complete-round",
    completedHour: 8,
    elapsedMs: [60_000, 63_000, 61_000],
  });
  const incomplete = trainingSet({
    groupId: "newer-incomplete",
    completedHour: 16,
    elapsedMs: [45_000, 46_000, 47_000],
  }).slice(0, 2);

  const selected = selectLatestCompleteTrainingBaselineSet({
    records: [...complete, ...incomplete],
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "se-epoch-1",
  });

  assert.ok(selected);
  assert.equal(selected[0].baselineGroupId, "complete-round");
  assert.deepEqual(selected.map((record) => record.recordId), [
    "complete-round-r1",
    "complete-round-r2",
    "complete-round-r3",
  ]);
});

test("Required Structure, Variation Control, other epochs, support, and contaminated timing cannot authorize the training baseline", () => {
  const invalidVariants: Array<Partial<TpsBaselineTimingRecord>> = [
    { sourceSetId: "structured_execution.required_structure" },
    {
      sourceSetId: "structured_execution.variation_control",
      variationLevel: "changed_form",
    },
    { sourceEpochKey: "se-epoch-old" },
    { pressureLevel: "difficulty" },
    { difficultyLevel: "challenging" },
    { independencePreserved: false },
    { structurallyValidCompletion: false },
    { timingValidity: "timing_invalid_technical" },
    { timingValidity: "confounded" },
    { elapsedMs: 0 },
    { completedAt: "not-a-date" },
  ];

  for (const [index, variant] of invalidVariants.entries()) {
    const record = baseRecord({
      recordId: `invalid-${index}`,
      ...variant,
    });
    const expectedEligibility = variant.sourceEpochKey === "se-epoch-old";
    assert.equal(
      isEligibleTpsBaselineRecord(record, "student-1", "Fractions"),
      expectedEligibility,
      `variant ${index}`,
    );
  }

  const wrongEpochSet = trainingSet({
    groupId: "old-round",
    completedHour: 8,
    elapsedMs: [50_000, 51_000, 52_000],
    sourceEpochKey: "se-epoch-old",
  });
  assert.equal(
    selectLatestCompleteTrainingBaselineSet({
      records: wrongEpochSet,
      studentId: "student-1",
      topic: "Fractions",
      sourceEpochKey: "se-epoch-1",
    }),
    null,
  );
});

test("a later valid replacement can repair one canonical slot without rewriting the other slots", () => {
  const records = trainingSet({
    groupId: "round-a",
    completedHour: 8,
    elapsedMs: [60_000, 62_000, 64_000],
  });
  records[1] = {
    ...records[1],
    recordId: "round-a-r2-invalid",
    timingValidity: "timing_invalid_technical",
  };
  records.push(
    baseRecord({
      recordId: "round-a-r2-replacement",
      baselineGroupId: "round-a",
      baselineSlot: 2,
      attemptNumber: 2,
      replacementForRecordId: "round-a-r2-invalid",
      completedAt: "2026-09-23T12:00:00.000Z",
      elapsedMs: 61_000,
    }),
  );

  const selected = selectLatestCompleteTrainingBaselineSet({
    records,
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "se-epoch-1",
  });

  assert.ok(selected);
  assert.deepEqual(selected.map((record) => record.recordId), [
    "round-a-r1",
    "round-a-r2-replacement",
    "round-a-r3",
  ]);
});

test("Diagnosis can supply the equivalent three-slot baseline without becoming SE Training", () => {
  const records: TpsBaselineTimingRecord[] = [1, 2, 3].map((slot) =>
    baseRecord({
      recordId: `dx-${slot}`,
      source: "diagnosis",
      sourceEpochKey: "diagnosis-epoch-1",
      baselineGroupId: "diagnosis-baseline-question-1",
      baselineSlot: slot as 1 | 2 | 3,
      sourcePhase: "diagnosis",
      sourceSetId:
        slot === 1 ? "stack.normal_independent" : "execution.repeatability",
      completedAt: `2026-09-23T1${slot}:00:00.000Z`,
      elapsedMs: [72_000, 68_000, 70_000][slot - 1],
    }),
  );

  const selected = selectCompleteDiagnosisBaseline({
    records,
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "diagnosis-epoch-1",
    baselineGroupId: "diagnosis-baseline-question-1",
  });

  assert.ok(selected);
  const snapshot = deriveTpsBaselineSnapshot(selected);
  assert.equal(snapshot.source, "diagnosis");
  assert.equal(snapshot.baselineSeconds, 70);

  const contract = deriveTpsTimerContractV1(snapshot);
  assert.equal(contract.baselineSource, "diagnosis_independent_baseline");
  assert.equal(getTpsPrescribedSeconds(contract, "light_timer"), 70);
  assert.equal(getTpsPrescribedSeconds(contract, "repeated_timer"), 70);
  assert.equal(getTpsPrescribedSeconds(contract, "full_constraint"), 60);
});

test("Diagnosis baseline remains unresolved until all three comparable timing slots exist", () => {
  const records: TpsBaselineTimingRecord[] = [1, 2].map((slot) =>
    baseRecord({
      recordId: `dx-${slot}`,
      source: "diagnosis",
      sourceEpochKey: "diagnosis-epoch-1",
      baselineGroupId: "diagnosis-baseline-question-1",
      baselineSlot: slot as 1 | 2,
      sourcePhase: "diagnosis",
      sourceSetId:
        slot === 1 ? "stack.normal_independent" : "execution.repeatability",
    }),
  );

  assert.equal(
    selectCompleteDiagnosisBaseline({
      records,
      studentId: "student-1",
      topic: "Fractions",
      sourceEpochKey: "diagnosis-epoch-1",
      baselineGroupId: "diagnosis-baseline-question-1",
    }),
    null,
  );
});


test("passive timing wire evidence is system-derived from Begin -> Student Finished boundaries", () => {
  const evidence = buildPassiveExecutionTimingEvidence({
    startedAt: "2026-09-23T16:00:00.000Z",
    endedAt: "2026-09-23T16:00:44.250Z",
  });
  assert.ok(evidence);
  assert.equal(evidence.elapsedMs, 44_250);
  assert.equal(evidence.boundary, "begin_to_student_finished");
  assert.equal(PASSIVE_EXECUTION_TIMING_WIRE_KEY, "_passive_execution_timing_v1");

  const encoded = encodePassiveExecutionTimingEvidence(evidence);
  assert.deepEqual(decodePassiveExecutionTimingEvidence(encoded), evidence);
});

test("passive timing wire rejects invalid or tampered duration evidence", () => {
  assert.equal(
    buildPassiveExecutionTimingEvidence({
      startedAt: "2026-09-23T16:00:44.000Z",
      endedAt: "2026-09-23T16:00:00.000Z",
    }),
    null,
  );

  assert.equal(
    decodePassiveExecutionTimingEvidence(JSON.stringify({
      version: 1,
      boundary: "begin_to_student_finished",
      startedAt: "2026-09-23T16:00:00.000Z",
      endedAt: "2026-09-23T16:00:44.000Z",
      elapsedMs: 1,
      timingValidity: "valid",
    })),
    null,
  );
});
