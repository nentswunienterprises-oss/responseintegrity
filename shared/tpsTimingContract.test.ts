import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSIVE_EXECUTION_ATTEMPT_WIRE_KEY,
  PASSIVE_EXECUTION_TIMING_WIRE_KEY,
  TPS_TIMED_ATTEMPT_WIRE_KEY,
  TPS_FULL_CONSTRAINT_FACTOR,
  TPS_REPLACEMENT_CONDITION_FRESH_PREPARED_EQUIVALENT,
  TPS_TRAINING_BASELINE_SET_ID,
  buildPassiveExecutionTimingEvidence,
  decodePassiveExecutionTimingEvidence,
  decodeTpsPassiveAttemptEvidenceRef,
  decodeTpsTimedAttemptEvidenceRef,
  encodePassiveExecutionTimingEvidence,
  encodeTpsPassiveAttemptEvidenceRef,
  encodeTpsTimedAttemptEvidenceRef,
  deriveTpsBaselineSnapshot,
  deriveTpsTimerContractV1,
  getTpsPrescribedSeconds,
  isEligibleTpsBaselineRecord,
  selectCompleteDiagnosisBaseline,
  selectLatestCompleteTrainingBaselineSet,
  type TpsBaselineTimingRecord,
  type TpsPassiveAttemptSubmissionV1,
  validateTpsPassiveAttemptSubmission,
  validateTpsTimedAttemptAgainstContract,
  getTpsTrainingPressureForSet,
  type TpsTimedAttemptSubmissionV1,
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


test("TPS Training set IDs deterministically select the Timer Contract condition", () => {
  const contract = {
    version: 1 as const,
    studentId: "student-1",
    topic: "Fractions",
    baselineSource: "training_independent_execution" as const,
    baselineSourceEpochKey: "se-v1-epoch-1",
    baselineGroupId: "round-c",
    baselineRecordIds: ["a", "b", "c"] as [string, string, string],
    baselineElapsedMs: [43_000, 45_000, 44_000] as [number, number, number],
    baselineSeconds: 44,
    structureUnderTimerSeconds: 44,
    repeatedTimedExecutionSeconds: 44,
    fullConstraintSeconds: 37,
  };

  assert.equal(
    getTpsTrainingPressureForSet("time_pressure.structure_under_timer"),
    "light_timer",
  );
  assert.equal(
    getTpsTrainingPressureForSet("time_pressure.repeated_timed_execution"),
    "repeated_timer",
  );
  assert.equal(
    getTpsTrainingPressureForSet("time_pressure.full_constraint"),
    "full_constraint",
  );

  const validAttempt: TpsTimedAttemptSubmissionV1 = {
    attemptId: "attempt-1",
    setId: "time_pressure.structure_under_timer",
    setName: "Structure Under Timer",
    repNumber: 1,
    attemptNumber: 1,
    pressureLevel: "light_timer",
    prescribedSeconds: 44,
    startedAt: "2026-09-23T18:00:00.000Z",
    endedAt: "2026-09-23T18:00:40.000Z",
    elapsedMs: 40_000,
    completedBeforeExpiry: true,
    timingValidity: "valid",
    endReason: "student_finished",
    replacementForAttemptId: null,
  };

  assert.deepEqual(
    validateTpsTimedAttemptAgainstContract({ contract, attempt: validAttempt }),
    { ok: true, attempt: validAttempt },
  );

  assert.match(
    (
      validateTpsTimedAttemptAgainstContract({
        contract,
        attempt: { ...validAttempt, prescribedSeconds: 60 },
      }) as { ok: false; error: string }
    ).error,
    /requires 44s/,
  );
});

test("TPS timed lineage distinguishes clean expiry from technical failure", () => {
  const contract = {
    version: 1 as const,
    studentId: "student-1",
    topic: "Fractions",
    baselineSource: "diagnosis_independent_baseline" as const,
    baselineSourceEpochKey: "diagnosis-v1:run-1",
    baselineGroupId: "diagnosis:run-1",
    baselineRecordIds: ["a", "b", "c"] as [string, string, string],
    baselineElapsedMs: [60_000, 58_000, 62_000] as [number, number, number],
    baselineSeconds: 60,
    structureUnderTimerSeconds: 60,
    repeatedTimedExecutionSeconds: 60,
    fullConstraintSeconds: 51,
  };

  const expired: TpsTimedAttemptSubmissionV1 = {
    attemptId: "attempt-expired",
    setId: "time_pressure.full_constraint",
    setName: "Full Constraint",
    repNumber: 2,
    attemptNumber: 1,
    pressureLevel: "full_constraint",
    prescribedSeconds: 51,
    startedAt: "2026-09-23T18:00:00.000Z",
    endedAt: "2026-09-23T18:00:51.000Z",
    elapsedMs: 51_000,
    completedBeforeExpiry: false,
    timingValidity: "valid",
    endReason: "timer_expired",
    replacementForAttemptId: null,
  };
  assert.equal(
    validateTpsTimedAttemptAgainstContract({ contract, attempt: expired }).ok,
    true,
  );

  const technical: TpsTimedAttemptSubmissionV1 = {
    ...expired,
    attemptId: "attempt-technical",
    attemptNumber: 1,
    endedAt: "2026-09-23T18:00:12.000Z",
    elapsedMs: 12_000,
    timingValidity: "timing_invalid_technical",
    endReason: "technical_failure",
    replacementForAttemptId: null,
    replacementCondition: null,
  };
  assert.equal(
    validateTpsTimedAttemptAgainstContract({ contract, attempt: technical }).ok,
    true,
  );

  const replacement: TpsTimedAttemptSubmissionV1 = {
    ...expired,
    attemptId: "attempt-replacement",
    attemptNumber: 2,
    endedAt: "2026-09-23T18:00:40.000Z",
    elapsedMs: 40_000,
    completedBeforeExpiry: true,
    timingValidity: "valid",
    endReason: "student_finished",
    replacementForAttemptId: technical.attemptId,
    replacementCondition:
      TPS_REPLACEMENT_CONDITION_FRESH_PREPARED_EQUIVALENT,
  };
  assert.equal(
    validateTpsTimedAttemptAgainstContract({ contract, attempt: replacement }).ok,
    true,
  );

  const unconfirmedReplacement = {
    ...replacement,
    replacementCondition: null,
  } as TpsTimedAttemptSubmissionV1;
  assert.match(
    (
      validateTpsTimedAttemptAgainstContract({
        contract,
        attempt: unconfirmedReplacement,
      }) as { ok: false; error: string }
    ).error,
    /fresh pre-prepared equivalent reserve opportunity/i,
  );
});


test("TPS Training drill wire stores only accepted valid timed-attempt lineage", () => {
  const reference = {
    version: 1 as const,
    attemptId: "attempt-valid-2",
    contractId: "contract-1",
    setId: "time_pressure.repeated_timed_execution" as const,
    repNumber: 2,
    attemptNumber: 2,
    timingValidity: "valid" as const,
    endReason: "student_finished" as const,
  };

  const encoded = encodeTpsTimedAttemptEvidenceRef(reference);
  assert.equal(TPS_TIMED_ATTEMPT_WIRE_KEY, "_tps_timed_attempt_v1");
  assert.deepEqual(decodeTpsTimedAttemptEvidenceRef(encoded), reference);

  assert.equal(
    decodeTpsTimedAttemptEvidenceRef(JSON.stringify({
      ...reference,
      timingValidity: "timing_invalid_technical",
      endReason: "technical_failure",
    })),
    null,
  );

  assert.equal(
    decodeTpsTimedAttemptEvidenceRef(JSON.stringify({
      ...reference,
      setId: "structured_execution.independent_execution",
    })),
    null,
  );
});


test("passive baseline attempt lineage preserves technical failures and valid replacements separately", () => {
  const technical: TpsPassiveAttemptSubmissionV1 = {
    attemptId: "passive-tech-1",
    source: "training",
    sourceContextId: "scheduled-session-1",
    sourceItemId: "structured_execution.independent_execution",
    slotNumber: 2,
    attemptNumber: 1,
    startedAt: "2026-09-23T18:00:00.000Z",
    endedAt: "2026-09-23T18:00:10.000Z",
    elapsedMs: 10_000,
    timingValidity: "timing_invalid_technical",
    endReason: "technical_failure",
    replacementForAttemptId: null,
  };
  assert.equal(validateTpsPassiveAttemptSubmission(technical).ok, true);

  const replacement: TpsPassiveAttemptSubmissionV1 = {
    ...technical,
    attemptId: "passive-valid-2",
    attemptNumber: 2,
    endedAt: "2026-09-23T18:00:44.000Z",
    elapsedMs: 44_000,
    timingValidity: "valid",
    endReason: "student_finished",
    replacementForAttemptId: "passive-tech-1",
    replacementCondition:
      TPS_REPLACEMENT_CONDITION_FRESH_PREPARED_EQUIVALENT,
  };
  assert.equal(validateTpsPassiveAttemptSubmission(replacement).ok, true);

  assert.match(
    (
      validateTpsPassiveAttemptSubmission({
        ...replacement,
        replacementCondition: null,
      }) as { ok: false; error: string }
    ).error,
    /fresh pre-prepared equivalent reserve opportunity/i,
  );

  const reference = {
    version: 1 as const,
    attemptId: replacement.attemptId,
    source: replacement.source,
    sourceContextId: replacement.sourceContextId,
    sourceItemId: replacement.sourceItemId,
    slotNumber: replacement.slotNumber,
    attemptNumber: replacement.attemptNumber,
    timingValidity: "valid" as const,
    endReason: "student_finished" as const,
  };
  assert.equal(PASSIVE_EXECUTION_ATTEMPT_WIRE_KEY, "_passive_execution_attempt_v1");
  assert.deepEqual(
    decodeTpsPassiveAttemptEvidenceRef(
      encodeTpsPassiveAttemptEvidenceRef(reference),
    ),
    reference,
  );

  assert.equal(
    decodeTpsPassiveAttemptEvidenceRef(JSON.stringify({
      ...reference,
      timingValidity: "timing_invalid_technical",
      endReason: "technical_failure",
    })),
    null,
  );
});
