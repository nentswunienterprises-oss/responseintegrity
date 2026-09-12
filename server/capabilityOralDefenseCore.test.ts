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

test("clean evidence produces only three anchored integrity baseline probes", () => {
  const risks = buildCapabilityOralRiskSignals([cleanAssessment], [approvedPractical]);
  assert.deepEqual(risks, []);
  const probes = buildCapabilityOralProbeBriefs(risks);
  assert.equal(probes.length, 3);
  assert.ok(probes.every((probe) => probe.source === "integrity_baseline"));
  assert.ok(probes.every((probe) => probe.rubric.criticalOnFail));
  assert.ok(probes.every((probe) => probe.rubric.criticalitySource === "integrity_baseline"));
  assert.ok(probes.every((probe) => probe.rubric.criticalBoundaryLinks.length > 0));
});

test("digital misses and practical repeats target canonical affected competencies", () => {
  const assessments: CapabilityAssessmentRiskEvidence[] = [
    {
      ...cleanAssessment,
      questionResults: [
        { competencyKey: "clarity.phase_purpose", deepDiveKey: "clarity", correct: false, criticalFail: false },
        { competencyKey: "structured_execution.variation_control", deepDiveKey: "structured_execution", correct: false, criticalFail: true },
      ],
    },
  ];
  const practicals: CapabilityPracticalRiskEvidence[] = [
    {
      ...approvedPractical,
      id: "practical-repeat",
      proofKey: "execute",
      outcome: "repeat_required",
      competencyLinks: [{ deepDiveKey: "controlled_discomfort", competencyKey: "controlled_discomfort.accessible_difficulty" }],
    },
  ];

  const risks = buildCapabilityOralRiskSignals(assessments, practicals);
  const probes = buildCapabilityOralProbeBriefs(risks);
  assert.ok(probes.length >= 3 && probes.length <= 5);
  const criticalTarget = probes.find((probe) => probe.focusKey === "structured_execution.variation_control");
  const repeatTarget = probes.find((probe) => probe.focusKey === "controlled_discomfort.accessible_difficulty");
  assert.ok(criticalTarget);
  assert.ok(repeatTarget);
  assert.equal(criticalTarget.source, "evidence_risk");
  assert.equal(criticalTarget.rubric.criticalOnFail, true);
  assert.equal(criticalTarget.rubric.criticalitySource, "historical_critical_signal");
  assert.equal(repeatTarget.rubric.criticalOnFail, false);
  assert.equal(repeatTarget.rubric.criticalitySource, "ordinary_capability");
});

test("critical-boundary evidence outranks ordinary misses", () => {
  const risks = buildCapabilityOralRiskSignals([
    {
      ...cleanAssessment,
      questionResults: [
        { competencyKey: "clarity.vmr_sequence", deepDiveKey: "clarity", correct: false, criticalFail: false },
        { competencyKey: "structured_execution.variation_control", deepDiveKey: "structured_execution", correct: false, criticalFail: true },
      ],
    },
  ], []);
  assert.equal(risks[0].focusKey, "structured_execution.variation_control");
});

test("evidence fingerprint and rubric-bound brief identity are stable for the same state", () => {
  const assessments = [cleanAssessment];
  const practicals = [approvedPractical];
  const risks = buildCapabilityOralRiskSignals(assessments, practicals);
  const probes = buildCapabilityOralProbeBriefs(risks);
  const fingerprintA = buildCapabilityEvidenceFingerprint(assessments, practicals);
  const fingerprintB = buildCapabilityEvidenceFingerprint(assessments, practicals);
  assert.equal(fingerprintA, fingerprintB);

  const briefA = buildCapabilityOralBriefId({
    tutorAssignmentId: "assignment-1",
    defenseVersion: 2,
    attemptNumber: 1,
    evidenceFingerprint: fingerprintA,
    probes,
  });
  const briefB = buildCapabilityOralBriefId({
    tutorAssignmentId: "assignment-1",
    defenseVersion: 2,
    attemptNumber: 1,
    evidenceFingerprint: fingerprintB,
    probes,
  });
  assert.equal(briefA, briefB);

  const changedRubricProbes = probes.map((probe, index) => index === 0
    ? {
        ...probe,
        rubric: {
          ...probe.rubric,
          clearAnchor: `${probe.rubric.clearAnchor} Updated standard.`,
        },
      }
    : probe);
  const changedRubricBrief = buildCapabilityOralBriefId({
    tutorAssignmentId: "assignment-1",
    defenseVersion: 2,
    attemptNumber: 1,
    evidenceFingerprint: fingerprintA,
    probes: changedRubricProbes,
  });
  assert.notEqual(changedRubricBrief, briefA);
});

test("new evidence changes fingerprint and invalidates an issued brief identity", () => {
  const originalAssessments = [cleanAssessment];
  const practicals = [approvedPractical];
  const originalRisks = buildCapabilityOralRiskSignals(originalAssessments, practicals);
  const originalProbes = buildCapabilityOralProbeBriefs(originalRisks);
  const originalFingerprint = buildCapabilityEvidenceFingerprint(originalAssessments, practicals);
  const issuedBriefId = buildCapabilityOralBriefId({
    tutorAssignmentId: "assignment-1",
    defenseVersion: 2,
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
        { competencyKey: "clarity.vmr_sequence", deepDiveKey: "clarity", correct: false, criticalFail: false },
      ],
    },
  ];
  const changedRisks = buildCapabilityOralRiskSignals(changedAssessments, practicals);
  const changedProbes = buildCapabilityOralProbeBriefs(changedRisks);
  const changedFingerprint = buildCapabilityEvidenceFingerprint(changedAssessments, practicals);
  const currentBriefId = buildCapabilityOralBriefId({
    tutorAssignmentId: "assignment-1",
    defenseVersion: 2,
    attemptNumber: 1,
    evidenceFingerprint: changedFingerprint,
    probes: changedProbes,
  });

  assert.notEqual(changedFingerprint, originalFingerprint);
  assert.notEqual(currentBriefId, issuedBriefId);
});
