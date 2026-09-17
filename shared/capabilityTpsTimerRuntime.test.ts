import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTpsTimerRuntimeStatus,
  collectPassiveTpsTimingRecords,
  isStructurallyValidPassiveCompletion,
} from "./capabilityTpsTimerRuntime";
import {
  decodeRepOperationalEvidenceV2,
  encodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
  type ActualSupportUsedV2,
  type RepOperationalEvidenceV2,
} from "./responseIntegrityEvidenceContractV2";

const operationalEvidence = ({
  repId,
  elapsedMs,
  endedAt,
  actualSupportUsed = "none",
  pressureLevel = "none",
}: {
  repId: string;
  elapsedMs: number;
  endedAt: string;
  actualSupportUsed?: ActualSupportUsedV2;
  pressureLevel?: "none" | "difficulty";
}): RepOperationalEvidenceV2 => ({
  repId,
  repNumber: 1,
  actualSupportUsed,
  timing: {
    mode: "passive_untimed",
    startedAt: new Date(Date.parse(endedAt) - elapsedMs).toISOString(),
    endedAt,
    elapsedMs,
    timingValidity: "valid",
    pressureLevel,
  },
  inheritedEvidence: [],
});

const drillRow = ({
  id,
  elapsedMs,
  endedAt,
  actualSupportUsed = "none",
  level = "clear",
  phase = "Structured Execution",
}: {
  id: string;
  elapsedMs: number;
  endedAt: string;
  actualSupportUsed?: ActualSupportUsedV2;
  level?: "weak" | "partial" | "clear";
  phase?: "Clarity" | "Structured Execution" | "Controlled Discomfort";
}) => {
  const isControlledDiscomfort = phase === "Controlled Discomfort";
  const setId = isControlledDiscomfort
    ? "controlled_discomfort.repeat_exposure"
    : phase === "Clarity"
      ? "clarity.light_apply"
      : "structured_execution.independent_execution";
  const evidence = operationalEvidence({
    repId: `${setId}.${id}`,
    elapsedMs,
    endedAt,
    actualSupportUsed,
    pressureLevel: isControlledDiscomfort ? "difficulty" : "none",
  });
  return {
    id,
    student_id: "student-1",
    tutor_id: "tutor-1",
    submitted_at: endedAt,
    drill: {
      drillType: "training",
      trainingTopic: "Algebra",
      phase,
      sets: [
        {
          setId,
          setName: isControlledDiscomfort
            ? "Repeat Exposure"
            : phase === "Clarity"
              ? "Light Apply"
              : "Independent Execution",
          constraintProfile: {
            supportLevel: "none",
            pressureLevel: isControlledDiscomfort ? "difficulty" : "none",
            variationLevel: "same_form",
            difficultyLevel: isControlledDiscomfort ? "challenging" : "normal",
          },
          observations: [
            {
              _rep_id: evidence.repId,
              _rep_number: "1",
              independence_level: level,
              repeatability_level: level,
              stepExecution_level: level,
              startBehavior_level: level,
              [REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY]: encodeRepOperationalEvidenceV2(evidence),
            },
          ],
        },
      ],
    },
  };
};

test("V2 rep operational evidence wire codec round-trips a versioned source fact", () => {
  const evidence = operationalEvidence({
    repId: "structured_execution.independent_execution.opportunity_1",
    elapsedMs: 73_000,
    endedAt: "2026-09-17T03:00:00.000Z",
  });
  const encoded = encodeRepOperationalEvidenceV2(evidence);
  assert.deepEqual(decodeRepOperationalEvidenceV2(encoded), evidence);
  assert.equal(decodeRepOperationalEvidenceV2("not-json"), null);
});

test("passive timing requires clear scored dimensions to count as a structurally valid completion", () => {
  assert.equal(isStructurallyValidPassiveCompletion({ a_level: "clear", b_level: "clear" }), true);
  assert.equal(isStructurallyValidPassiveCompletion({ a_level: "clear", b_level: "partial" }), false);
  assert.equal(isStructurallyValidPassiveCompletion({ _rep_id: "rep" }), false);
});

test("runtime retains Structured Execution and Controlled Discomfort timing but baselines only comparable Structured Execution reps", () => {
  const rows = [
    drillRow({
      id: "clarity",
      elapsedMs: 45_000,
      endedAt: "2026-09-17T05:00:00.000Z",
      phase: "Clarity",
    }),
    drillRow({
      id: "cd",
      elapsedMs: 120_000,
      endedAt: "2026-09-17T04:30:00.000Z",
      phase: "Controlled Discomfort",
    }),
    drillRow({
      id: "support-used",
      elapsedMs: 50_000,
      endedAt: "2026-09-17T04:00:00.000Z",
      actualSupportUsed: "response_control_cue",
    }),
    drillRow({ id: "r3", elapsedMs: 70_000, endedAt: "2026-09-17T03:00:00.000Z" }),
    drillRow({ id: "r2", elapsedMs: 80_000, endedAt: "2026-09-17T02:00:00.000Z" }),
    drillRow({ id: "r1", elapsedMs: 60_000, endedAt: "2026-09-17T01:00:00.000Z" }),
  ];

  const records = collectPassiveTpsTimingRecords({ rows, studentId: "student-1", topic: "Algebra" });
  assert.equal(records.length, 5);
  assert.equal(records.some((record) => record.sourcePhase === "Clarity"), false);
  assert.equal(records.some((record) => record.sourcePhase === "Controlled Discomfort"), true);

  const status = buildTpsTimerRuntimeStatus({ rows, studentId: "student-1", topic: "Algebra" });
  assert.equal(status.passiveRecordCount, 5);
  assert.equal(status.structuredExecutionRecordCount, 4);
  assert.equal(status.controlledDiscomfortRecordCount, 1);
  assert.equal(status.eligibleRecordCount, 3);
  assert.equal(status.calibrationRequired, false);
  assert.equal(status.preTpsCalibrationRequired, false);
  assert.equal(status.tpsEntryReady, true);
  assert.equal(status.contract?.baselineSourcePhase, "Structured Execution");
  assert.equal(status.contract?.baselineSeconds, 70);
  assert.equal(status.contract?.structureUnderTimerSeconds, 70);
  assert.equal(status.contract?.repeatedTimedExecutionSeconds, 70);
  assert.equal(status.contract?.fullConstraintSeconds, 60);
  assert.deepEqual(status.contract?.baselineSampleRecordIds, [
    "r3::structured_execution.independent_execution::structured_execution.independent_execution.r3",
    "r2::structured_execution.independent_execution::structured_execution.independent_execution.r2",
    "r1::structured_execution.independent_execution::structured_execution.independent_execution.r1",
  ]);
});

test("runtime holds TPS entry for pre-TPS calibration when clean Structured Execution evidence is insufficient", () => {
  const rows = [
    drillRow({ id: "r1", elapsedMs: 60_000, endedAt: "2026-09-17T01:00:00.000Z" }),
    drillRow({ id: "partial", elapsedMs: 70_000, endedAt: "2026-09-17T02:00:00.000Z", level: "partial" }),
    drillRow({
      id: "cd",
      elapsedMs: 95_000,
      endedAt: "2026-09-17T03:00:00.000Z",
      phase: "Controlled Discomfort",
    }),
  ];
  const status = buildTpsTimerRuntimeStatus({ rows, studentId: "student-1", topic: "Algebra" });
  assert.equal(status.eligibleRecordCount, 1);
  assert.equal(status.calibrationRequired, true);
  assert.equal(status.preTpsCalibrationRequired, true);
  assert.equal(status.tpsEntryReady, false);
  assert.equal(status.contract, null);
});
