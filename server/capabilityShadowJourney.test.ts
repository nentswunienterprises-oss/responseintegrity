import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_ASSESSMENT_FIXTURES } from "@shared/capabilityAssessmentBank";
import { evaluateCapabilityAssessment, type CapabilityAssessmentDefinition } from "@shared/capabilityEngine";
import { CAPABILITY_PRACTICAL_PROOFS } from "@shared/capabilityPracticalEvidence";
import { evaluateCapabilityReadiness, FOUNDATION_CAPABILITY_SHADOW_GATE_V1 } from "@shared/capabilityReadiness";
import { evaluateOralDefenseProbes, ORAL_DEFENSE_VERSION } from "@shared/capabilityOralDefense";
import { selectCurrentCapabilityReadinessEvidence } from "@shared/capabilityEvidenceSelection";
import { canCapabilityReviewerAccessAssignment } from "@shared/capabilityReviewerScope";
import {
  buildCapabilityEvidenceFingerprint,
  buildCapabilityOralBriefId,
  buildCapabilityOralProbeBriefs,
  buildCapabilityOralRiskSignals,
  type CapabilityAssessmentRiskEvidence,
  type CapabilityPracticalRiskEvidence,
} from "./capabilityOralDefenseCore";
import { projectCapabilityAssessmentForSpecialist } from "./capabilityPublicProjection";

const assignmentId = "shadow-assignment-1";
const tutorId = "shadow-specialist-1";
const assignedTdId = "shadow-td-1";

function correctResponses(definition: CapabilityAssessmentDefinition) {
  return definition.questions.map((question) => ({
    questionKey: question.key,
    selectedOptionKeys: [...question.correctOptionKeys],
  }));
}

function oneWrongResponse(definition: CapabilityAssessmentDefinition) {
  const responses = correctResponses(definition);
  const question = definition.questions[0];
  const wrong = question.options.find((option) => !question.correctOptionKeys.includes(option.key));
  assert.ok(wrong);
  responses[0] = { questionKey: question.key, selectedOptionKeys: [wrong.key] };
  return responses;
}

function assessmentRiskRecord(input: {
  id: string;
  definition: CapabilityAssessmentDefinition;
  attemptNumber: number;
  result: ReturnType<typeof evaluateCapabilityAssessment>;
  completedAt: string;
}): CapabilityAssessmentRiskEvidence {
  return {
    id: input.id,
    assessmentKey: input.definition.key,
    bankVersion: 1,
    attemptNumber: input.attemptNumber,
    completedAt: input.completedAt,
    questionResults: input.result.questionResults.map((question) => ({
      competencyKey: question.competencyKey,
      deepDiveKey: question.deepDiveKey,
      correct: question.correct,
      criticalFail: question.criticalFail,
    })),
  };
}

function readinessFor(input: {
  assessments: Array<{
    assessmentKey: string;
    bankVersion: number;
    attemptNumber: number;
    passed: boolean;
    completedAt: string;
  }>;
  practicals: CapabilityPracticalRiskEvidence[];
  oralDefenses: Array<{
    defenseVersion: number;
    attemptNumber: number;
    outcome: "approved" | "repeat_required" | "integrity_review";
    completedAt: string;
  }>;
  activeAssessmentVersions?: Array<{ assessmentKey: string; bankVersion: number }>;
}) {
  const selected = selectCurrentCapabilityReadinessEvidence({
    assessments: input.assessments,
    activeAssessmentVersions:
      input.activeAssessmentVersions ||
      CAPABILITY_ASSESSMENT_FIXTURES.map((definition) => ({ assessmentKey: definition.key, bankVersion: 1 })),
    practicals: input.practicals,
    currentPracticalVersions: CAPABILITY_PRACTICAL_PROOFS.map((proof) => ({
      proofKey: proof.key,
      proofVersion: proof.version,
    })),
    oralDefenses: input.oralDefenses,
    currentOralDefenseVersion: ORAL_DEFENSE_VERSION,
  });
  return evaluateCapabilityReadiness(FOUNDATION_CAPABILITY_SHADOW_GATE_V1, selected);
}

test("seeded Specialist shadow journey reaches READY only after the complete evidence stack", () => {
  const authoritativeState = {
    battleTestProgression: "authoritative",
    sandboxMockGate: "not_changed",
    trialState: "not_opened",
    certificationStatus: "not_changed",
    operationalMode: "training",
  };
  const authoritativeSnapshot = JSON.stringify(authoritativeState);

  const empty = readinessFor({ assessments: [], practicals: [], oralDefenses: [] });
  assert.equal(empty.status, "NOT_READY");
  assert.equal(empty.missingRequirementCodes.length, 8);
  assert.equal(empty.authoritative, false);

  const clarity = CAPABILITY_ASSESSMENT_FIXTURES.find((definition) => definition.key === "clarity_mastery_v1");
  assert.ok(clarity);
  const historicalClarityFailure = evaluateCapabilityAssessment(clarity, oneWrongResponse(clarity));
  assert.equal(historicalClarityFailure.passed, false);

  const assessmentRiskHistory: CapabilityAssessmentRiskEvidence[] = [
    assessmentRiskRecord({
      id: "clarity-failed-1",
      definition: clarity,
      attemptNumber: 1,
      result: historicalClarityFailure,
      completedAt: "2026-09-11T08:00:00Z",
    }),
  ];
  const assessmentReadinessHistory = [
    {
      assessmentKey: clarity.key,
      bankVersion: 1,
      attemptNumber: 1,
      passed: historicalClarityFailure.passed,
      completedAt: "2026-09-11T08:00:00Z",
    },
  ];

  CAPABILITY_ASSESSMENT_FIXTURES.forEach((definition, index) => {
    const result = evaluateCapabilityAssessment(definition, correctResponses(definition));
    assert.equal(result.passed, true, `${definition.key} should pass in the seeded proof`);
    const attemptNumber = definition.key === clarity.key ? 2 : 1;
    const completedAt = `2026-09-11T0${9 + index}:00:00Z`;
    assessmentRiskHistory.push(
      assessmentRiskRecord({
        id: `${definition.key}-${attemptNumber}`,
        definition,
        attemptNumber,
        result,
        completedAt,
      }),
    );
    assessmentReadinessHistory.push({
      assessmentKey: definition.key,
      bankVersion: 1,
      attemptNumber,
      passed: result.passed,
      completedAt,
    });

    const publicForm = projectCapabilityAssessmentForSpecialist({
      definition,
      formId: `shadow-form-${index + 1}`,
      bankVersion: 1,
      attemptNumber,
      maxAttempts: 3,
    });
    const publicJson = JSON.stringify(publicForm);
    assert.doesNotMatch(publicJson, /correctOptionKeys|criticalFailOptionKeys|explanation|competencyKey/);
  });

  const afterDigital = readinessFor({
    assessments: assessmentReadinessHistory,
    practicals: [],
    oralDefenses: [],
  });
  assert.equal(afterDigital.status, "NOT_READY");
  assert.deepEqual(afterDigital.missingRequirementCodes, [
    "practical.prepare.approved",
    "practical.execute.approved",
    "practical.evidence.approved",
    "oral_defense.approved",
  ]);

  const practicals: CapabilityPracticalRiskEvidence[] = CAPABILITY_PRACTICAL_PROOFS.map((proof, index) => ({
    id: `practical-${proof.key}-1`,
    proofKey: proof.key,
    proofVersion: proof.version,
    attemptNumber: 1,
    competencyLinks: proof.competencyLinks,
    outcome: "approved" as const,
    submittedAt: `2026-09-11T1${3 + index}:00:00Z`,
    reviewedAt: `2026-09-11T1${3 + index}:30:00Z`,
  }));

  const beforeOral = readinessFor({
    assessments: assessmentReadinessHistory,
    practicals,
    oralDefenses: [],
  });
  assert.equal(beforeOral.status, "NOT_READY");
  assert.deepEqual(beforeOral.missingRequirementCodes, ["oral_defense.approved"]);

  const risks = buildCapabilityOralRiskSignals(assessmentRiskHistory, practicals);
  assert.ok(risks.some((risk) => risk.focusKey === clarity.questions[0].competencyKey));
  const probes = buildCapabilityOralProbeBriefs(risks);
  assert.ok(probes.length >= 3 && probes.length <= 5);
  assert.ok(probes.some((probe) => probe.focusKey === clarity.questions[0].competencyKey && probe.source === "evidence_risk"));

  const fingerprint = buildCapabilityEvidenceFingerprint(assessmentRiskHistory, practicals);
  const briefId = buildCapabilityOralBriefId({
    tutorAssignmentId: assignmentId,
    defenseVersion: ORAL_DEFENSE_VERSION,
    attemptNumber: 1,
    evidenceFingerprint: fingerprint,
    probes,
  });
  assert.equal(briefId.length, 24);

  const oralResult = evaluateOralDefenseProbes(
    probes.map((probe, index) => ({
      focusKey: probe.focusKey,
      deepDiveKey: probe.deepDiveKey,
      scenarioSummary: `Fictional sandbox scenario ${index + 1} tested the issued operating boundary under a new condition.`,
      observedResponseSummary: `The Specialist reasoned aloud on probe ${index + 1}, preserved the required boundary, and stated the action and escalation limit clearly.`,
      judgment: "clear" as const,
      integrityConcern: false,
    })),
  );
  assert.equal(oralResult.outcome, "approved");

  const finalReadiness = readinessFor({
    assessments: assessmentReadinessHistory,
    practicals,
    oralDefenses: [
      {
        defenseVersion: ORAL_DEFENSE_VERSION,
        attemptNumber: 1,
        outcome: oralResult.outcome,
        completedAt: "2026-09-11T17:00:00Z",
      },
    ],
  });
  assert.equal(finalReadiness.status, "READY");
  assert.deepEqual(finalReadiness.missingRequirementCodes, []);
  assert.equal(finalReadiness.authoritative, false);

  assert.equal(canCapabilityReviewerAccessAssignment({ reviewerId: assignedTdId, reviewerRole: "td", assignmentTdId: assignedTdId }), true);
  assert.equal(canCapabilityReviewerAccessAssignment({ reviewerId: "other-td", reviewerRole: "td", assignmentTdId: assignedTdId }), false);

  assert.equal(JSON.stringify(authoritativeState), authoritativeSnapshot);
});

test("latest failure, bank rotation, practical repeat, and stale brief each break proof independently", () => {
  const digital = CAPABILITY_ASSESSMENT_FIXTURES.map((definition, index) => ({
    assessmentKey: definition.key,
    bankVersion: 1,
    attemptNumber: 1,
    passed: true,
    completedAt: `2026-09-11T10:0${index}:00Z`,
  }));
  const practicals: CapabilityPracticalRiskEvidence[] = CAPABILITY_PRACTICAL_PROOFS.map((proof, index) => ({
    id: `practical-${proof.key}-1`,
    proofKey: proof.key,
    proofVersion: proof.version,
    attemptNumber: 1,
    competencyLinks: proof.competencyLinks,
    outcome: "approved" as const,
    submittedAt: `2026-09-11T11:0${index}:00Z`,
    reviewedAt: `2026-09-11T12:0${index}:00Z`,
  }));
  const oral = [{ defenseVersion: ORAL_DEFENSE_VERSION, attemptNumber: 1, outcome: "approved" as const, completedAt: "2026-09-11T13:00:00Z" }];
  assert.equal(readinessFor({ assessments: digital, practicals, oralDefenses: oral }).status, "READY");

  const withLatestFailure = [
    ...digital,
    {
      assessmentKey: "clarity_mastery_v1",
      bankVersion: 1,
      attemptNumber: 2,
      passed: false,
      completedAt: "2026-09-11T14:00:00Z",
    },
  ];
  assert.ok(readinessFor({ assessments: withLatestFailure, practicals, oralDefenses: oral }).missingRequirementCodes.includes("assessment.clarity.mastery"));

  const rotatedVersions = CAPABILITY_ASSESSMENT_FIXTURES.map((definition) => ({
    assessmentKey: definition.key,
    bankVersion: definition.key === "clarity_mastery_v1" ? 2 : 1,
  }));
  assert.ok(readinessFor({ assessments: digital, practicals, oralDefenses: oral, activeAssessmentVersions: rotatedVersions }).missingRequirementCodes.includes("assessment.clarity.mastery"));

  const withPracticalRepeat: CapabilityPracticalRiskEvidence[] = [
    ...practicals,
    {
      ...practicals.find((practical) => practical.proofKey === "execute")!,
      id: "practical-execute-2",
      attemptNumber: 2,
      outcome: "repeat_required",
      submittedAt: "2026-09-11T14:00:00Z",
      reviewedAt: "2026-09-11T14:30:00Z",
    },
  ];
  assert.ok(readinessFor({ assessments: digital, practicals: withPracticalRepeat, oralDefenses: oral }).missingRequirementCodes.includes("practical.execute.approved"));

  const riskAssessments: CapabilityAssessmentRiskEvidence[] = CAPABILITY_ASSESSMENT_FIXTURES.map((definition, index) => {
    const result = evaluateCapabilityAssessment(definition, correctResponses(definition));
    return assessmentRiskRecord({ id: `risk-${index}`, definition, attemptNumber: 1, result, completedAt: `2026-09-11T10:0${index}:00Z` });
  });
  const probesBefore = buildCapabilityOralProbeBriefs(buildCapabilityOralRiskSignals(riskAssessments, practicals));
  const fingerprintBefore = buildCapabilityEvidenceFingerprint(riskAssessments, practicals);
  const briefBefore = buildCapabilityOralBriefId({ tutorAssignmentId: assignmentId, defenseVersion: ORAL_DEFENSE_VERSION, attemptNumber: 1, evidenceFingerprint: fingerprintBefore, probes: probesBefore });

  const changedPracticalHistory: CapabilityPracticalRiskEvidence[] = [...practicals, withPracticalRepeat[withPracticalRepeat.length - 1]];
  const probesAfter = buildCapabilityOralProbeBriefs(buildCapabilityOralRiskSignals(riskAssessments, changedPracticalHistory));
  const fingerprintAfter = buildCapabilityEvidenceFingerprint(riskAssessments, changedPracticalHistory);
  const briefAfter = buildCapabilityOralBriefId({ tutorAssignmentId: assignmentId, defenseVersion: ORAL_DEFENSE_VERSION, attemptNumber: 1, evidenceFingerprint: fingerprintAfter, probes: probesAfter });
  assert.notEqual(fingerprintAfter, fingerprintBefore);
  assert.notEqual(briefAfter, briefBefore);

  void tutorId;
});
