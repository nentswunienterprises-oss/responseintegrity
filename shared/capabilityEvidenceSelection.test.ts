import assert from "node:assert/strict";
import test from "node:test";
import { selectCurrentCapabilityReadinessEvidence } from "./capabilityEvidenceSelection";

const activeAssessmentVersions = [
  { assessmentKey: "clarity_mastery_v1", bankVersion: 1 },
  { assessmentKey: "clarity_retrieval_v1", bankVersion: 1 },
  { assessmentKey: "structured_execution_mastery_v1", bankVersion: 1 },
  { assessmentKey: "clarity_structured_transfer_v1", bankVersion: 1 },
];
const currentPracticalVersions = [
  { proofKey: "prepare", proofVersion: 1 },
  { proofKey: "execute", proofVersion: 1 },
  { proofKey: "evidence", proofVersion: 1 },
];

function baseInput() {
  return {
    assessments: activeAssessmentVersions.map((entry, index) => ({
      ...entry,
      attemptNumber: 1,
      passed: true,
      completedAt: `2026-09-11T10:0${index}:00Z`,
    })),
    activeAssessmentVersions,
    practicals: currentPracticalVersions.map((entry, index) => ({
      ...entry,
      attemptNumber: 1,
      outcome: "approved" as const,
      submittedAt: `2026-09-11T11:0${index}:00Z`,
      reviewedAt: `2026-09-11T12:0${index}:00Z`,
    })),
    currentPracticalVersions,
    oralDefenses: [
      {
        defenseVersion: 1,
        attemptNumber: 1,
        outcome: "approved" as const,
        completedAt: "2026-09-11T13:00:00Z",
      },
    ],
    currentOralDefenseVersion: 1,
  };
}

test("complete current-version evidence selects the whole readiness stack", () => {
  const evidence = selectCurrentCapabilityReadinessEvidence(baseInput());
  assert.deepEqual(evidence.passedAssessmentKeys, activeAssessmentVersions.map((entry) => entry.assessmentKey).sort());
  assert.deepEqual(evidence.approvedPracticalProofKeys, ["evidence", "execute", "prepare"]);
  assert.equal(evidence.oralDefenseApproved, true);
});

test("a newer failed digital attempt invalidates an older pass", () => {
  const input = baseInput();
  input.assessments.push({
    assessmentKey: "clarity_mastery_v1",
    bankVersion: 1,
    attemptNumber: 2,
    passed: false,
    completedAt: "2026-09-11T14:00:00Z",
  });
  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.equal(evidence.passedAssessmentKeys.includes("clarity_mastery_v1"), false);
});

test("rotating the active bank invalidates a pass from the retired bank version", () => {
  const input = baseInput();
  input.activeAssessmentVersions = input.activeAssessmentVersions.map((entry) =>
    entry.assessmentKey === "clarity_mastery_v1" ? { ...entry, bankVersion: 2 } : entry,
  );
  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.equal(evidence.passedAssessmentKeys.includes("clarity_mastery_v1"), false);
});

test("latest practical repeat invalidates an older approval", () => {
  const input = baseInput();
  input.practicals.push({
    proofKey: "execute",
    proofVersion: 1,
    attemptNumber: 2,
    outcome: "repeat_required",
    submittedAt: "2026-09-11T14:00:00Z",
    reviewedAt: "2026-09-11T14:30:00Z",
  });
  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.equal(evidence.approvedPracticalProofKeys.includes("execute"), false);
});

test("latest oral repeat invalidates an older oral approval", () => {
  const input = baseInput();
  input.oralDefenses.push({
    defenseVersion: 1,
    attemptNumber: 2,
    outcome: "repeat_required",
    completedAt: "2026-09-11T15:00:00Z",
  });
  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.equal(evidence.oralDefenseApproved, false);
});

test("a current-version mismatch invalidates practical and oral approvals", () => {
  const input = baseInput();
  input.currentPracticalVersions = input.currentPracticalVersions.map((entry) =>
    entry.proofKey === "prepare" ? { ...entry, proofVersion: 2 } : entry,
  );
  input.currentOralDefenseVersion = 2;
  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.equal(evidence.approvedPracticalProofKeys.includes("prepare"), false);
  assert.equal(evidence.oralDefenseApproved, false);
});
