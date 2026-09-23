import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSIVE_EXECUTION_TIMING_WIRE_KEY,
  TPS_TRAINING_BASELINE_SET_ID,
  buildPassiveExecutionTimingEvidence,
  encodePassiveExecutionTimingEvidence,
} from "./tpsTimingContract";
import {
  collectTrainingTpsBaselineTimingRecords,
  deriveTrainingTpsTimerContract,
} from "./tpsTimingRuntime";
import { TRAINING_INTERVENTION_FIELD } from "./trainingEvidenceCapture";

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

const trainingRow = ({
  id,
  hour,
  seconds,
}: {
  id: string;
  hour: number;
  seconds: [number, number, number];
}) => ({
  id,
  student_id: "student-1",
  submitted_at: `2026-09-23T${String(hour).padStart(2, "0")}:30:00.000Z`,
  drill: {
    drillType: "training",
    trainingTopic: "Fractions",
    phase: "Structured Execution",
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
    sourceEpochKey: "se-epoch-1",
  });

  assert.equal(records.length, 9);
  assert.equal(new Set(records.map((record) => record.baselineGroupId)).size, 3);

  const contract = deriveTrainingTpsTimerContract({
    rows,
    studentId: "student-1",
    topic: "fractions",
    sourceEpochKey: "se-epoch-1",
  });

  assert.ok(contract);
  assert.equal(contract.baselineGroupId, `round-c::${TPS_TRAINING_BASELINE_SET_ID}`);
  assert.deepEqual(contract.baselineElapsedMs, [43_000, 45_000, 44_000]);
  assert.equal(contract.baselineSeconds, 44);
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
    sourceEpochKey: "se-epoch-1",
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
      sourceEpochKey: "se-epoch-1",
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
    sourceEpochKey: "se-epoch-1",
  });

  assert.equal(records.length, 3);
  assert.ok(records.every((record) => record.sourceSetId === TPS_TRAINING_BASELINE_SET_ID));
});
