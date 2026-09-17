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
}: {
  repId: string;
  elapsedMs: number;
  endedAt: string;
  actualSupportUsed?: ActualSupportUsedV2;
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
    pressureLevel: "none",
  },
  inheritedEvidence: [],
});

const drillRow = ({
  id,
  elapsedMs,
  endedAt,
  actualSupportUsed = "none",
  level = "clear",
}: {
  id: string;
  elapsedMs: number;
  endedAt: string;
  actualSupportUsed?: ActualSupportUsedV2;
  level?: "weak" | "partial" | "clear";
}) => {
  const evidence = operationalEvidence({
    repId: `structured_execution.independent_execution.${id}`,
    elapsedMs,
    endedAt,
    actualSupportUsed,
  });
  return {
    id,
    student_id: "student-1",
    tutor_id: "tutor-1",
    submitted_at: endedAt,
    drill: {
      drillType: "training",
      trainingTopic: "Algebra",
      sets: [
        {
          setId: "structured_execution.independent_execution",
          setName: "Independent Execution",
          constraintProfile: {
            supportLevel: "none",
            pressureLevel: "none",
            variationLevel: "same_form",
            difficultyLevel: "normal",
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

test("runtime status derives the TPS contract from the latest three eligible passive untimed reps", () => {
  const rows = [
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
  assert.equal(records.length, 4);

  const status = buildTpsTimerRuntimeStatus({ rows, studentId: "student-1", topic: "Algebra" });
  assert.equal(status.passiveRecordCount, 4);
  assert.equal(status.eligibleRecordCount, 3);
  assert.equal(status.calibrationRequired, false);
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

test("runtime status stays in calibration-required state when clean passive evidence is insufficient", () => {
  const rows = [
    drillRow({ id: "r1", elapsedMs: 60_000, endedAt: "2026-09-17T01:00:00.000Z" }),
    drillRow({ id: "partial", elapsedMs: 70_000, endedAt: "2026-09-17T02:00:00.000Z", level: "partial" }),
  ];
  const status = buildTpsTimerRuntimeStatus({ rows, studentId: "student-1", topic: "Algebra" });
  assert.equal(status.eligibleRecordCount, 1);
  assert.equal(status.calibrationRequired, true);
  assert.equal(status.contract, null);
});
