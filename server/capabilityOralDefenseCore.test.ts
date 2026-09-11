import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCapabilityEvidenceFingerprint,
  buildCapabilityOralBriefId,
  buildCapabilityOralProbeBriefs,
  buildCapabilityOralRiskSignals,
  type CapabilityAssessmentRiskEvidence,
  type CapabilityPracticalRiskEvidence,
} from "./capabilityOralDefenseCore";

const cleanAssessment: CapabilityAssessmentRiskEvidence = {
  id: "assessment-1",
  assessmentKey: "clarity_mastery_v1",
  bankVersion: 1,
  attemptNumber: 1,
  completedAt: "2026-09-11T10:00:00Z",
  questionResults: [
    { competencyKey: "clarity.phase_purpose", deepDiveKey: "clarity", correct: true, criticalFail: false },
  ],
};

const approvedPractical: CapabilityPracticalRiskEvidence = {
  id: "practical-1",
  proofKey: "prepare",
  proofVersion: 1,
  attemptNumber: 1,
  competencyLinks: [{ deepDiveKey: "clarity", competencyKey: "clarity.phase_purpose" }],
  outcome: "approved",
  submittedAt: "2026-09-11T11:00:00Z",
  reviewedAt: "2026-09-11T12:00:00Z",
};

test("clean evidence produces only the three integrity baseline probes", () => {
  const risks = buildCapabilityOralRiskSignals([cleanAssessment], [approvedPractical]);
  assert.deepEqual(risks, []);
  const probes = buildCapabilityOralProbeBriefs(risks);
  assert.equal(probes.length, 3);
  assert.ok(probes.every((probe) => probe.source === "integrity_baseline"));
});

test("digital misses and practical repeats target the affected competencies", () => {
  const assessments: CapabilityAssessmentRiskEvidence[] = [
    {
      ...cleanAssessment,
      questionResults: [
        { competencyKey: "clarity.phase_purpose", deepDiveKey: "clarity", correct: false, criticalFail: false },
        { competencyKey: "custom.transfer_boundary", deepDiveKey: "structured_execution", correct: false, criticalFail: true },
      ],
    },
  ];
  const practicals: CapabilityPracticalRiskEvidence[] = [
    {
      ...approvedPractical,
      id: "practical-repeat",
      proofKey: "execute",
      outcome: "repeat_required",
      competencyLinks: [{ deepDiveKey: "structured_execution", competencyKey: "custom.execution_boundary" }],
    },
  ];

  const risks = buildCapabilityOralRiskSignals(assessments, practicals);
  const probes = buildCapabilityOralProbeBriefs(risks);
  assert.ok(probes.length >= 3 && probes.length <= 5);
  assert.ok(probes.some((probe) => probe.focusKey === "custom.transfer_boundary" && probe.source === "evidence_risk"));
  assert.ok(probes.some((probe) => probe.focusKey === "custom.execution_boundary" && probe.source === "evidence_risk"));
});

test("critical-boundary evidence outranks ordinary misses", () => {
  const risks = buildCapabilityOralRiskSignals([
    {
      ...cleanAssessment,
      questionResults: [
        { competencyKey: "ordinary.miss", deepDiveKey: "clarity", correct: false, criticalFail: false },
        { competencyKey: "critical.miss", deepDiveKey: "clarity", correct: false, criticalFail: true },
      ],
    },
  ], []);
  assert.equal(risks[0].focusKey, "critical.miss");
});

test("evidence fingerprint and brief identity are stable for the same state", () => {
  const assessments = [cleanAssessment];
  const practicals = [approvedPractical];
  const risks = buildCapabilityOralRiskSignals(assessments, practicals);
  const probes = buildCapabilityOralProbeBriefs(risks);
  const fingerprintA = buildCapabilityEvidenceFingerprint(assessments, practicals);
  const fingerprintB = buildCapabilityEvidenceFingerprint(assessments, practicals);
  assert.equal(fingerprintA, fingerprintB);

  const briefA = buildCapabilityOralBriefId({
    tutorAssignmentId: "assignment-1",
    defenseVersion: 1,
    attemptNumber: 1,
    evidenceFingerprint: fingerprintA,
    probes,
  });
  const briefB = buildCapabilityOralBriefId({
    tutorAssignmentId: "assignment-1",
    defenseVersion: 1,
    attemptNumber: 1,
    evidenceFingerprint: fingerprintB,
    probes,
  });
  assert.equal(briefA, briefB);
});

test("new evidence changes the fingerprint and invalidates an issued brief identity", () => {
  const originalAssessments = [cleanAssessment];
  const practicals = [approvedPractical];
  const originalRisks = buildCapabilityOralRiskSignals(originalAssessments, practicals);
  const originalProbes = buildCapabilityOralProbeBriefs(originalRisks);
  const originalFingerprint = buildCapabilityEvidenceFingerprint(originalAssessments, practicals);
  const issuedBriefId = buildCapabilityOralBriefId({
    tutorAssignmentId: "assignment-1",
    defenseVersion: 1,
    attemptNumber: 1,
    evidenceFingerprint: originalFingerprint,
    probes: originalProbes,
  });

  const changedAssessments: CapabilityAssessmentRiskEvidence[] = [
    ...originalAssessments,
    {
      id: "assessment-2",
      assessmentKey: "clarity_retrieval_v1",
      bankVersion: 1,
      attemptNumber: 1,
      completedAt: "2026-09-11T14:00:00Z",
      questionResults: [
        { competencyKey: "retrieval.boundary", deepDiveKey: "clarity", correct: false, criticalFail: false },
      ],
    },
  ];
  const changedRisks = buildCapabilityOralRiskSignals(changedAssessments, practicals);
  const changedProbes = buildCapabilityOralProbeBriefs(changedRisks);
  const changedFingerprint = buildCapabilityEvidenceFingerprint(changedAssessments, practicals);
  const currentBriefId = buildCapabilityOralBriefId({
    tutorAssignmentId: "assignment-1",
    defenseVersion: 1,
    attemptNumber: 1,
    evidenceFingerprint: changedFingerprint,
    probes: changedProbes,
  });

  assert.notEqual(changedFingerprint, originalFingerprint);
  assert.notEqual(currentBriefId, issuedBriefId);
});
