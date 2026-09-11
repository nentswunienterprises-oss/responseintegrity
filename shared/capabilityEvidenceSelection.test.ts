import assert from "node:assert/strict";
import test from "node:test";
import {
  selectCurrentCapabilityReadinessEvidence,
  type CurrentCapabilityEvidenceSelectionInput,
} from "./capabilityEvidenceSelection";

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

function baseInput(): CurrentCapabilityEvidenceSelectionInput {
  return {
    assessments: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 1,
        attemptNumber: 1,
        passed: true,
        evidenceKind: "mastery",
        coveredDeepDiveKeys: ["clarity"],
        completedAt: "2026-09-11T10:00:00Z",
      },
      {
        assessmentKey: "clarity_retrieval_v1",
        bankVersion: 1,
        attemptNumber: 1,
        passed: true,
        evidenceKind: "retrieval",
        coveredDeepDiveKeys: ["clarity"],
        completedAt: "2026-09-11T10:01:00Z",
      },
      {
        assessmentKey: "structured_execution_mastery_v1",
        bankVersion: 1,
        attemptNumber: 1,
        passed: true,
        evidenceKind: "mastery",
        coveredDeepDiveKeys: ["structured_execution"],
        completedAt: "2026-09-11T10:02:00Z",
      },
      {
        assessmentKey: "clarity_structured_transfer_v1",
        bankVersion: 1,
        attemptNumber: 1,
        passed: true,
        evidenceKind: "transfer",
        coveredDeepDiveKeys: ["clarity", "structured_execution"],
        completedAt: "2026-09-11T10:03:00Z",
      },
    ],
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

test("complete current-version foundation evidence selects the legacy keys and five blueprint cells", () => {
  const evidence = selectCurrentCapabilityReadinessEvidence(baseInput());
  assert.deepEqual(evidence.passedAssessmentKeys, activeAssessmentVersions.map((entry) => entry.assessmentKey).sort());
  assert.deepEqual(evidence.satisfiedEvidenceCells, [
    "deep_dive.clarity.mastery",
    "deep_dive.clarity.retrieval",
    "deep_dive.clarity.transfer",
    "deep_dive.structured_execution.mastery",
    "deep_dive.structured_execution.transfer",
  ]);
  assert.deepEqual(evidence.approvedPracticalProofKeys, ["evidence", "execute", "prepare"]);
  assert.equal(evidence.oralDefenseApproved, true);
});

test("a newer failed digital attempt invalidates both its assessment key and evidence cell", () => {
  const input = baseInput();
  input.assessments.push({
    assessmentKey: "clarity_mastery_v1",
    bankVersion: 1,
    attemptNumber: 2,
    passed: false,
    evidenceKind: "mastery",
    coveredDeepDiveKeys: ["clarity"],
    completedAt: "2026-09-11T14:00:00Z",
  });
  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.equal(evidence.passedAssessmentKeys.includes("clarity_mastery_v1"), false);
  assert.equal(evidence.satisfiedEvidenceCells.includes("deep_dive.clarity.mastery"), false);
});

test("rotating the active bank invalidates the retired bank pass and evidence cell", () => {
  const input = baseInput();
  input.activeAssessmentVersions = input.activeAssessmentVersions.map((entry) =>
    entry.assessmentKey === "clarity_mastery_v1" ? { ...entry, bankVersion: 2 } : entry,
  );
  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.equal(evidence.passedAssessmentKeys.includes("clarity_mastery_v1"), false);
  assert.equal(evidence.satisfiedEvidenceCells.includes("deep_dive.clarity.mastery"), false);
});

test("one passing mixed transfer assessment can satisfy multiple Deep Dive transfer cells", () => {
  const evidence = selectCurrentCapabilityReadinessEvidence(baseInput());
  assert.ok(evidence.satisfiedEvidenceCells.includes("deep_dive.clarity.transfer"));
  assert.ok(evidence.satisfiedEvidenceCells.includes("deep_dive.structured_execution.transfer"));
});

test("unknown Deep Dive coverage cannot manufacture a readiness evidence cell", () => {
  const input = baseInput();
  input.assessments.push({
    assessmentKey: "unknown_transfer_v1",
    bankVersion: 1,
    attemptNumber: 1,
    passed: true,
    evidenceKind: "transfer",
    coveredDeepDiveKeys: ["not_a_real_deep_dive"],
    completedAt: "2026-09-11T14:00:00Z",
  });
  input.activeAssessmentVersions.push({ assessmentKey: "unknown_transfer_v1", bankVersion: 1 });
  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.equal(evidence.satisfiedEvidenceCells.some((cell) => cell.includes("not_a_real_deep_dive")), false);
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
