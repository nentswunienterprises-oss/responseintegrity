import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCurrentCapabilityEvidenceCellStates,
  selectCurrentPassingCapabilityAssessments,
  type CapabilityActiveAssessmentVersion,
  type CapabilityAssessmentEvidenceSnapshot,
} from "./capabilityEvidenceSelection";

const activeVersions: CapabilityActiveAssessmentVersion[] = [
  { assessmentKey: "session_operation_transfer_v1", bankVersion: 2 },
  { assessmentKey: "continuity_delivery_transfer_v1", bankVersion: 3 },
];

function overlapAttempts(): CapabilityAssessmentEvidenceSnapshot[] {
  return [
    {
      assessmentKey: "session_operation_transfer_v1",
      bankVersion: 2,
      attemptNumber: 1,
      passed: true,
      evidenceKind: "transfer",
      coveredDeepDiveKeys: ["logging_system", "session_flow_control"],
      completedAt: "2026-09-10T10:00:00Z",
    },
    {
      assessmentKey: "continuity_delivery_transfer_v1",
      bankVersion: 3,
      attemptNumber: 1,
      passed: true,
      evidenceKind: "transfer",
      coveredDeepDiveKeys: ["logging_system", "handover_verification"],
      completedAt: "2026-09-11T10:00:00Z",
    },
  ];
}

test("multiple current passing assessments may legitimately resolve to one transfer cell", () => {
  const passing = selectCurrentPassingCapabilityAssessments(overlapAttempts(), activeVersions);
  const cells = buildCurrentCapabilityEvidenceCellStates(passing);
  const logging = cells.find((cell) => cell.code === "deep_dive.logging_system.transfer");

  assert.ok(logging);
  assert.equal(logging.assessmentKey, "session_operation_transfer_v1");
  assert.equal(logging.bankVersion, 2);
  assert.equal(logging.satisfiedAt, "2026-09-10T10:00:00.000Z");
  assert.equal(
    cells.filter((cell) => cell.code === "deep_dive.logging_system.transfer").length,
    1,
  );
});

test("retired-bank overlap cannot outrank a current passing assessment", () => {
  const attempts = overlapAttempts();
  attempts.push({
    assessmentKey: "session_operation_transfer_v1",
    bankVersion: 1,
    attemptNumber: 99,
    passed: true,
    evidenceKind: "transfer",
    coveredDeepDiveKeys: ["logging_system"],
    completedAt: "2026-09-12T10:00:00Z",
  });

  const passing = selectCurrentPassingCapabilityAssessments(attempts, activeVersions);
  const cells = buildCurrentCapabilityEvidenceCellStates(passing);
  const logging = cells.find((cell) => cell.code === "deep_dive.logging_system.transfer");

  assert.ok(logging);
  assert.equal(logging.assessmentKey, "session_operation_transfer_v1");
  assert.equal(logging.bankVersion, 2);
  assert.equal(logging.attemptNumber, 1);
});
