import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSIVE_EXECUTION_ATTEMPT_WIRE_KEY,
  PASSIVE_EXECUTION_TIMING_WIRE_KEY,
  TPS_TRAINING_BASELINE_SET_ID,
  buildPassiveExecutionTimingEvidence,
  encodePassiveExecutionTimingEvidence,
  encodeTpsPassiveAttemptEvidenceRef,
} from "./tpsTimingContract";
import {
  collectDiagnosisTpsBaselineTimingRecords,
  collectTrainingTpsBaselineTimingRecords,
  deriveDiagnosisTpsTimerContract,
  deriveStructuredExecutionEpochKeyForTraining,
  deriveTrainingTpsTimerContract,
  validateTrainingPassiveTimingSubmission,
} from "./tpsTimingRuntime";
import { TRAINING_INTERVENTION_FIELD } from "./trainingEvidenceCapture";
import {
  createEvidenceCompleteDiagnosisState,
  recordEvidenceCompleteDiagnosisProbe,
} from "./evidenceCompleteDiagnosis";

const timing = (seconds: number, hour: number) => {
  const startedAt = `2026-09-23T${String(hour).padStart(2, "0")}:00:00.000Z`;
  const endedAt = new Date(Date.parse(startedAt) + seconds * 1000).toISOString();
  const evidence = buildPassiveExecutionTimingEvidence({ startedAt, endedAt });
  assert.ok(evidence);
  return encodePassiveExecutionTimingEvidence(evidence);
};

const supportedRep = (slot: number, seconds: number, hour: number) => ({
  _rep_number: String(slot),
  [TRAINING_INTERVENTION_FIELD]: "none",
  startBehavior_evidence_class: "supported",
  stepExecution_evidence_class: "supported",
  repeatability_evidence_class: "supported",
  independence_evidence_class: "supported",
  [PASSIVE_EXECUTION_TIMING_WIRE_KEY]: timing(seconds, hour),
});

const liveSupportedRep = (slot: number, seconds: number, hour: number) => ({
  _rep_number: String(slot),
  [TRAINING_INTERVENTION_FIELD]: "none",
  startBehavior: "immediate",
  startBehavior_evidence_status: "observed",
  stepExecution: "no correction needed",
  stepExecution_evidence_status: "observed",
  repeatability: "stable",
  repeatability_evidence_status: "observed",
  independence: "independent",
  independence_evidence_status: "observed",
  [PASSIVE_EXECUTION_TIMING_WIRE_KEY]: timing(seconds, hour),
});

const trainingRow = ({
  id,
  hour,
  seconds,
}: {
  id: string;
  hour: number;
  seconds: [number, number, number];
}): any => ({
  id,
  student_id: "student-1",
  submitted_at: `2026-09-23T${String(hour).padStart(2, "0")}:30:00.000Z`,
  drill: {
    drillType: "training",
    trainingTopic: "Fractions",
    phase: "Structured Execution",
    tpsTimingAuthority: {
      sourceEpochKey: "se-v1-epoch-1",
      source: "training_independent_execution",
    },
    sets: [
      {
        setId: "structured_execution.required_structure",
        observations: [],
      },
      {
        setId: TPS_TRAINING_BASELINE_SET_ID,
        observations: [
          supportedRep(1, seconds[0], hour),
          supportedRep(2, seconds[1], hour + 1),
          supportedRep(3, seconds[2], hour + 2),
        ],
      },
      {
        setId: "structured_execution.variation_control",
        observations: [],
      },
    ],
  },
});

test("stored Training drill timing reconstructs complete Independent Execution baseline sets", () => {
  const rows = [
    trainingRow({ id: "round-a", hour: 8, seconds: [58, 55, 57] }),
    trainingRow({ id: "round-b", hour: 12, seconds: [49, 51, 48] }),
    trainingRow({ id: "round-c", hour: 16, seconds: [43, 45, 44] }),
  ];

  const records = collectTrainingTpsBaselineTimingRecords({
    rows,
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "se-v1-epoch-1",
  });

  assert.equal(records.length, 9);
  assert.equal(new Set(records.map((record) => record.baselineGroupId)).size, 3);

  const contract = deriveTrainingTpsTimerContract({
    rows,
    studentId: "student-1",
    topic: "fractions",
    sourceEpochKey: "se-v1-epoch-1",
  });

  assert.ok(contract);
  assert.equal(contract.baselineGroupId, `round-c::${TPS_TRAINING_BASELINE_SET_ID}`);
  assert.deepEqual(contract.baselineElapsedMs, [43_000, 45_000, 44_000]);
  assert.equal(contract.baselineSeconds, 44);
});

test("live Training payload freezes a Timer Contract from raw evidence-native observations", () => {
  const row = trainingRow({
    id: "live-round",
    hour: 8,
    seconds: [52, 50, 51],
  });
  row.drill.sets[1].observations = [
    liveSupportedRep(1, 52, 8),
    liveSupportedRep(2, 50, 9),
    liveSupportedRep(3, 51, 10),
  ];

  const records = collectTrainingTpsBaselineTimingRecords({
    rows: [row],
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "se-v1-epoch-1",
  });

  assert.equal(records.length, 3);
  assert.ok(records.every((record) => record.structurallyValidCompletion));

  const contract = deriveTrainingTpsTimerContract({
    rows: [row],
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "se-v1-epoch-1",
  });

  assert.ok(contract);
  assert.deepEqual(contract.baselineElapsedMs, [52_000, 50_000, 51_000]);
  assert.equal(contract.baselineSeconds, 51);
});

test("live Training payload cannot freeze a baseline when evidence is explicitly confounded", () => {
  const row = trainingRow({
    id: "live-confounded",
    hour: 8,
    seconds: [52, 50, 51],
  });
  row.drill.sets[1].observations = [
    liveSupportedRep(1, 52, 8),
    liveSupportedRep(2, 50, 9),
    liveSupportedRep(3, 51, 10),
  ];
  row.drill.sets[1].observations[1].independence_evidence_status = "confounded";

  const records = collectTrainingTpsBaselineTimingRecords({
    rows: [row],
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "se-v1-epoch-1",
  });

  assert.equal(records[1].structurallyValidCompletion, false);
  assert.equal(
    deriveTrainingTpsTimerContract({
      rows: [row],
      studentId: "student-1",
      topic: "Fractions",
      sourceEpochKey: "se-v1-epoch-1",
    }),
    null,
  );
});

test("contaminated or non-supported Independent Execution timing cannot become baseline authority", () => {
  const row = trainingRow({
    id: "round-a",
    hour: 8,
    seconds: [60, 61, 62],
  });
  row.drill.sets[1].observations[1][TRAINING_INTERVENTION_FIELD] =
    "method_or_step_prompt";
  row.drill.sets[1].observations[2].independence_evidence_class = "conditional";

  const records = collectTrainingTpsBaselineTimingRecords({
    rows: [row],
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "se-v1-epoch-1",
  });

  assert.equal(records.length, 3);
  assert.equal(records[0].independencePreserved, true);
  assert.equal(records[1].independencePreserved, false);
  assert.equal(records[2].structurallyValidCompletion, false);

  assert.equal(
    deriveTrainingTpsTimerContract({
      rows: [row],
      studentId: "student-1",
      topic: "Fractions",
      sourceEpochKey: "se-v1-epoch-1",
    }),
    null,
  );
});

test("Required Structure and Variation Control wire timing are ignored even if present", () => {
  const row = trainingRow({
    id: "round-a",
    hour: 8,
    seconds: [60, 61, 62],
  });
  row.drill.sets[0].observations = [supportedRep(1, 10, 6)];
  row.drill.sets[2].observations = [supportedRep(1, 12, 7)];

  const records = collectTrainingTpsBaselineTimingRecords({
    rows: [row],
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "se-v1-epoch-1",
  });

  assert.equal(records.length, 3);
  assert.ok(records.every((record) => record.sourceSetId === TPS_TRAINING_BASELINE_SET_ID));
});


test("Structured Execution epoch remains stable across repeated SE rounds and increments only on re-entry", () => {
  assert.equal(
    deriveStructuredExecutionEpochKeyForTraining({
      history: [],
      observedPhase: "Structured Execution",
    }),
    "se-v1-epoch-1",
  );

  assert.equal(
    deriveStructuredExecutionEpochKeyForTraining({
      history: [
        { date: "2026-09-20T08:00:00.000Z", phase: "Structured Execution" },
        { date: "2026-09-21T08:00:00.000Z", phase: "Structured Execution" },
      ],
      observedPhase: "Structured Execution",
    }),
    "se-v1-epoch-1",
  );

  assert.equal(
    deriveStructuredExecutionEpochKeyForTraining({
      history: [
        { date: "2026-09-18T08:00:00.000Z", phase: "Structured Execution" },
        { date: "2026-09-19T08:00:00.000Z", phase: "Controlled Discomfort" },
        { date: "2026-09-22T08:00:00.000Z", phase: "Structured Execution" },
      ],
      observedPhase: "Structured Execution",
    }),
    "se-v1-epoch-2",
  );

  assert.equal(
    deriveStructuredExecutionEpochKeyForTraining({
      history: [
        { date: "2026-09-18T08:00:00.000Z", phase: "Structured Execution" },
        { date: "2026-09-19T08:00:00.000Z", phase: "Controlled Discomfort" },
      ],
      observedPhase: "Structured Execution",
    }),
    "se-v1-epoch-2",
  );

  assert.equal(
    deriveStructuredExecutionEpochKeyForTraining({
      history: [],
      observedPhase: "Controlled Discomfort",
    }),
    null,
  );
});

test("server timing validator requires all three IE boundaries and rejects passive timing outside IE", () => {
  const validRow = trainingRow({
    id: "round-a",
    hour: 8,
    seconds: [60, 61, 62],
  });
  assert.equal(
    validateTrainingPassiveTimingSubmission({
      observedPhase: "Structured Execution",
      sets: validRow.drill.sets,
    }),
    null,
  );

  const missingRep = trainingRow({
    id: "round-b",
    hour: 8,
    seconds: [60, 61, 62],
  });
  delete missingRep.drill.sets[1].observations[1][PASSIVE_EXECUTION_TIMING_WIRE_KEY];
  assert.match(
    validateTrainingPassiveTimingSubmission({
      observedPhase: "Structured Execution",
      sets: missingRep.drill.sets,
    }) || "",
    /Rep 2 is missing valid/,
  );

  const wrongSet = trainingRow({
    id: "round-c",
    hour: 8,
    seconds: [60, 61, 62],
  });
  wrongSet.drill.sets[0].observations = [supportedRep(1, 30, 6)];
  assert.match(
    validateTrainingPassiveTimingSubmission({
      observedPhase: "Structured Execution",
      sets: wrongSet.drill.sets,
    }) || "",
    /only Independent Execution is eligible/,
  );

  assert.match(
    validateTrainingPassiveTimingSubmission({
      observedPhase: "Controlled Discomfort",
      sets: wrongSet.drill.sets,
    }) || "",
    /only valid inside Structured Execution/,
  );
});

test("runtime ignores otherwise valid SE timing from a different conditioning epoch", () => {
  const old = trainingRow({
    id: "old-round",
    hour: 8,
    seconds: [90, 91, 92],
  });
  old.drill.tpsTimingAuthority.sourceEpochKey = "se-v1-epoch-1";

  const current = trainingRow({
    id: "current-round",
    hour: 14,
    seconds: [50, 51, 52],
  });
  current.drill.tpsTimingAuthority.sourceEpochKey = "se-v1-epoch-2";

  const contract = deriveTrainingTpsTimerContract({
    rows: [old, current],
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "se-v1-epoch-2",
  });

  assert.ok(contract);
  assert.equal(contract.baselineGroupId, `current-round::${TPS_TRAINING_BASELINE_SET_ID}`);
  assert.equal(contract.baselineSeconds, 51);
});


test("diagnosis baseline timing derives the same V1 Timer Contract without pretending Training occurred", () => {
  const diagnosisTiming = (seconds: number) => {
    const startedAt = "2026-09-23T18:00:00.000Z";
    const endedAt = new Date(Date.parse(startedAt) + seconds * 1000).toISOString();
    const evidence = buildPassiveExecutionTimingEvidence({ startedAt, endedAt });
    assert.ok(evidence);
    return evidence;
  };

  const clarity = [
    { dimensionId: "clarity.vocabulary" as const, behaviorId: "accurate_recognition" },
    { dimensionId: "clarity.method" as const, behaviorId: "correct_method_cleanly" },
    { dimensionId: "clarity.reason" as const, behaviorId: "clear_reason" },
    { dimensionId: "clarity.immediate_apply" as const, behaviorId: "engages_cleanly" },
  ];
  const executionImmediate = [
    { dimensionId: "execution.start" as const, behaviorId: "valid_independent_start" },
    { dimensionId: "execution.step_discipline" as const, behaviorId: "structure_maintained" },
    { dimensionId: "execution.independence" as const, behaviorId: "independent_throughout" },
  ];
  const executionFull = [
    ...executionImmediate,
    { dimensionId: "execution.repeatability" as const, behaviorId: "repeat_clean" },
  ];

  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");
  state = recordEvidenceCompleteDiagnosisProbe(state, {
    probeId: "stack.normal_independent",
    supportEvent: "none",
    observations: [...clarity, ...executionImmediate],
    passiveTiming: diagnosisTiming(58),
  });
  state = recordEvidenceCompleteDiagnosisProbe(state, {
    probeId: "execution.repeatability",
    supportEvent: "none",
    observations: executionFull,
    passiveTiming: diagnosisTiming(60),
  });
  state = recordEvidenceCompleteDiagnosisProbe(state, {
    probeId: "execution.repeatability",
    supportEvent: "none",
    observations: executionFull,
    passiveTiming: diagnosisTiming(62),
  });

  const records = collectDiagnosisTpsBaselineTimingRecords({
    state,
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "diagnosis-v1-run-1",
    baselineGroupId: "diagnosis-run-1",
  });

  assert.equal(records.length, 3);
  assert.ok(records.every((record) => record.source === "diagnosis"));
  assert.ok(records.every((record) => record.sourcePhase === "diagnosis"));

  const contract = deriveDiagnosisTpsTimerContract({
    state,
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "diagnosis-v1-run-1",
    baselineGroupId: "diagnosis-run-1",
  });

  assert.ok(contract);
  assert.equal(contract.baselineSource, "diagnosis_independent_baseline");
  assert.deepEqual(contract.baselineElapsedMs, [58_000, 60_000, 62_000]);
  assert.equal(contract.baselineSeconds, 60);
  assert.equal(contract.structureUnderTimerSeconds, 60);
  assert.equal(contract.repeatedTimedExecutionSeconds, 60);
  assert.equal(contract.fullConstraintSeconds, 51);
});


test("Timer Contract baseline record IDs follow durable passive-attempt lineage when present", () => {
  const row = trainingRow({
    id: "round-lineage",
    hour: 10,
    seconds: [44, 45, 46],
  });

  row.drill.sets[1].observations.forEach((rep: any, index: number) => {
    const slot = index + 1;
    rep[PASSIVE_EXECUTION_ATTEMPT_WIRE_KEY] =
      encodeTpsPassiveAttemptEvidenceRef({
        version: 1,
        attemptId: `passive-attempt-${slot}`,
        source: "training",
        sourceContextId: "scheduled-session-1",
        sourceItemId: TPS_TRAINING_BASELINE_SET_ID,
        slotNumber: slot,
        attemptNumber: 1,
        timingValidity: "valid",
        endReason: "student_finished",
      });
  });

  const contract = deriveTrainingTpsTimerContract({
    rows: [row],
    studentId: "student-1",
    topic: "Fractions",
    sourceEpochKey: "se-v1-epoch-1",
  });

  assert.ok(contract);
  assert.deepEqual(contract.baselineRecordIds, [
    "passive-attempt-1",
    "passive-attempt-2",
    "passive-attempt-3",
  ]);
});
