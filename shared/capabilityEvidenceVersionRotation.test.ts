import assert from "node:assert/strict";
import test from "node:test";
import {
  selectCurrentCapabilityReadinessEvidence,
  type CurrentCapabilityEvidenceSelectionInput,
} from "./capabilityEvidenceSelection";

function baseInput(): CurrentCapabilityEvidenceSelectionInput {
  return {
    assessments: [],
    activeAssessmentVersions: [],
    practicals: [],
    currentPracticalVersions: [
      { proofKey: "prepare", proofVersion: 2 },
      { proofKey: "execute", proofVersion: 1 },
      { proofKey: "evidence", proofVersion: 1 },
    ],
    oralDefenses: [],
    currentOralDefenseVersion: 2,
  };
}

test("older practical version with higher attempt number cannot outrank current version attempt 1", () => {
  const input = baseInput();
  input.practicals = [
    {
      proofKey: "prepare",
      proofVersion: 1,
      attemptNumber: 4,
      outcome: "repeat_required",
      submittedAt: "2026-09-10T10:00:00Z",
      reviewedAt: "2026-09-10T11:00:00Z",
    },
    {
      proofKey: "prepare",
      proofVersion: 2,
      attemptNumber: 1,
      outcome: "approved",
      submittedAt: "2026-09-12T10:00:00Z",
      reviewedAt: "2026-09-12T11:00:00Z",
    },
  ];

  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.deepEqual(evidence.approvedPracticalProofKeys, ["prepare"]);
});

test("older approved practical cannot satisfy readiness after current version rotates without evidence", () => {
  const input = baseInput();
  input.practicals = [
    {
      proofKey: "prepare",
      proofVersion: 1,
      attemptNumber: 4,
      outcome: "approved",
      submittedAt: "2026-09-10T10:00:00Z",
      reviewedAt: "2026-09-10T11:00:00Z",
    },
  ];

  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.deepEqual(evidence.approvedPracticalProofKeys, []);
});

test("older Oral Defense V1 attempt 4 cannot outrank current V2 attempt 1", () => {
  const input = baseInput();
  input.oralDefenses = [
    {
      defenseVersion: 1,
      attemptNumber: 4,
      outcome: "repeat_required",
      completedAt: "2026-09-10T11:00:00Z",
    },
    {
      defenseVersion: 2,
      attemptNumber: 1,
      outcome: "approved",
      completedAt: "2026-09-12T11:00:00Z",
    },
  ];

  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.equal(evidence.oralDefenseApproved, true);
});

test("older Oral Defense approval cannot satisfy readiness after V2 becomes current without a V2 defense", () => {
  const input = baseInput();
  input.oralDefenses = [
    {
      defenseVersion: 1,
      attemptNumber: 4,
      outcome: "approved",
      completedAt: "2026-09-10T11:00:00Z",
    },
  ];

  const evidence = selectCurrentCapabilityReadinessEvidence(input);
  assert.equal(evidence.oralDefenseApproved, false);
});
