import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShadowCohortReview,
  filterShadowCohortReviewMembers,
  projectShadowCohortReviewMember,
  type ShadowCohortCandidateInput,
} from "./capabilityShadowCohort";
import {
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  getRequiredCapabilityEvidenceCells,
} from "./capabilityBlueprint";
import type {
  ShadowConcordanceClassification,
  ShadowSpecialistConcordance,
} from "./capabilityShadowConcordance";

const requiredCells = getRequiredCapabilityEvidenceCells();

function comparison(
  classification: ShadowConcordanceClassification,
  options: {
    missingDeepDives?: number;
    mock?: boolean;
    trialCase?: boolean;
    trialDecision?: boolean;
    oral?: boolean;
    practicalCount?: number;
    simulation?: boolean;
  } = {},
): ShadowSpecialistConcordance {
  const missingDeepDives = options.missingDeepDives || 0;
  const deepDives = CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive, index) => {
    const missing = index < missingDeepDives;
    const cells = requiredCells.filter((cell) => cell.deepDiveKey === deepDive.key);
    return {
      deepDiveKey: deepDive.key,
      battleTestState: missing ? "missing" as const : "ready" as const,
      capabilityState: missing ? "missing" as const : "ready" as const,
      classification: missing ? "missing_comparison_evidence" as const : "agree_ready" as const,
      battleTestEvidence: missing
        ? null
        : {
            evidenceId: `battle-${deepDive.key}`,
            deepDiveKey: deepDive.key,
            historicalState: "completed" as const,
            currentHealthState: "locked" as const,
            currentStreak: 3,
            latestScore: 100,
            attemptsCount: 3,
            criticalFlag: false,
            completedAt: "2026-09-01T10:00:00Z",
            lastTestedAt: "2026-09-01T10:00:00Z",
          },
      capabilityEvidence: {
        requiredCellCodes: cells.map((cell) => cell.code),
        satisfiedCellCodes: missing ? [] : cells.map((cell) => cell.code),
        observedCellCodes: missing ? [] : cells.map((cell) => cell.code),
        criticalSignal: false,
        lineage: [],
      },
    };
  });

  const comparableDeepDives = 11 - missingDeepDives;
  const practicalCount = options.practicalCount ?? 3;
  const practicals = (["prepare", "execute", "evidence"] as const).map((proofKey, index) => ({
    proofKey,
    outcome: index < practicalCount ? "approved" as const : null,
    evidenceId: index < practicalCount ? `practical-${proofKey}` : null,
    version: index < practicalCount ? 1 : null,
    rubricVersion: index < practicalCount ? 1 : null,
    attemptNumber: index < practicalCount ? 1 : null,
    observedAt: index < practicalCount ? "2026-09-02T10:00:00Z" : null,
  }));

  return {
    authoritative: false,
    cutoverDecision: null,
    analysisKind: "descriptive_shadow_concordance",
    deepDives,
    battleTestOverallState: classification === "missing_comparison_evidence" ? "missing" : "ready",
    capabilityOverallState: classification === "missing_comparison_evidence" ? "missing" : "ready",
    overallClassification: classification,
    capabilityHumanEvidence: {
      practicals,
      oralDefense: options.oral === false
        ? { outcome: null, evidenceId: null, version: null, attemptNumber: null, observedAt: null }
        : {
            outcome: "approved",
            evidenceId: "oral-1",
            version: 2,
            attemptNumber: 1,
            observedAt: "2026-09-03T10:00:00Z",
          },
    },
    capabilitySimulationEvidence: {
      bankKey: "sandbox_foundation",
      activeBankVersion: 1,
      latestCurrentAttempt: options.simulation === false
        ? null
        : {
            evidenceId: "simulation-1",
            bankVersion: 1,
            attemptNumber: 1,
            passed: true,
            hasCriticalFail: false,
            observedAt: "2026-09-03T12:00:00Z",
          },
    },
    outcomeTarget: {
      mock: options.mock === false
        ? { decision: null, evidenceId: null, observedAt: null }
        : {
            decision: "passed",
            evidenceId: "mock-1",
            observedAt: "2026-09-04T10:00:00Z",
          },
      trial: options.trialCase === false
        ? {
            caseStatus: null,
            certificationDecision: null,
            evidenceId: null,
            observedAt: null,
          }
        : {
            caseStatus: options.trialDecision === false ? "active" : "certified",
            certificationDecision: options.trialDecision === false ? null : "certified",
            evidenceId: "trial-1",
            observedAt: "2026-09-10T10:00:00Z",
          },
    },
    summary: {
      comparableDeepDives,
      agreeingDeepDives: comparableDeepDives,
      disagreementDeepDives: 0,
      missingDeepDives,
      integrityDisagreementDeepDives: 0,
    },
  };
}

function candidate(
  tutorAssignmentId: string,
  classification: ShadowConcordanceClassification,
  options: Parameters<typeof comparison>[1] = {},
): ShadowCohortCandidateInput {
  return {
    tutorAssignmentId,
    tutorId: `tutor-${tutorAssignmentId}`,
    specialistName: `Specialist ${tutorAssignmentId}`,
    specialistEmail: `${tutorAssignmentId}@example.test`,
    podName: tutorAssignmentId === "a1" ? "Pod Alpha" : "Pod Beta",
    operationalMode: "sandbox",
    comparison: comparison(classification, options),
  };
}

test("cohort review keeps incomplete assignments in the candidate denominator", () => {
  const review = buildShadowCohortReview([
    candidate("a1", "agree_ready"),
    candidate("a2", "missing_comparison_evidence", { missingDeepDives: 4, oral: false }),
    candidate("a3", "capability_only_ready"),
  ], "2026-09-12T10:00:00Z");

  assert.equal(review.authoritative, false);
  assert.equal(review.cutoverDecision, null);
  assert.equal(review.summary.candidateAssignments, 3);
  assert.equal(review.summary.comparableAssignments, 2);
  assert.equal(review.summary.incompleteAssignments, 1);
  assert.equal(review.summary.classificationCounts.agree_ready, 1);
  assert.equal(review.summary.classificationCounts.missing_comparison_evidence, 1);
  assert.equal(review.summary.classificationCounts.capability_only_ready, 1);
  assert.equal(review.summary.strongCutoverClaimAllowed, false);
});

test("member projection exposes evidence completeness without inventing readiness", () => {
  const member = projectShadowCohortReviewMember(
    candidate("a1", "missing_comparison_evidence", {
      missingDeepDives: 2,
      practicalCount: 2,
      oral: false,
      simulation: false,
      mock: false,
      trialDecision: false,
    }),
  );

  assert.equal(member.comparable, false);
  assert.equal(member.deepDiveSummary.missing, 2);
  assert.equal(member.evidenceCompleteness.battleTestDeepDivesObserved, 9);
  assert.equal(member.evidenceCompleteness.capabilityCellsObserved, 27);
  assert.equal(member.evidenceCompleteness.capabilityCellsSatisfied, 27);
  assert.equal(member.evidenceCompleteness.practicalCurrentStateCount, 2);
  assert.equal(member.evidenceCompleteness.oralDefensePresent, false);
  assert.equal(member.evidenceCompleteness.sandboxSimulationPresent, false);
  assert.equal(member.evidenceCompleteness.sandboxMockOutcomePresent, false);
  assert.equal(member.evidenceCompleteness.trialCasePresent, true);
  assert.equal(member.evidenceCompleteness.trialDecisionPresent, false);
});

test("cohort filters are read-only and preserve denominator semantics outside the visible subset", () => {
  const review = buildShadowCohortReview([
    candidate("a1", "agree_ready"),
    candidate("a2", "missing_comparison_evidence", { missingDeepDives: 5 }),
    candidate("a3", "capability_only_ready"),
  ]);

  const comparable = filterShadowCohortReviewMembers({
    members: review.members,
    completeness: "comparable",
  });
  const incomplete = filterShadowCohortReviewMembers({
    members: review.members,
    completeness: "incomplete",
  });
  const capabilityOnly = filterShadowCohortReviewMembers({
    members: review.members,
    classification: "capability_only_ready",
  });
  const alphaSearch = filterShadowCohortReviewMembers({
    members: review.members,
    query: "pod alpha",
  });

  assert.equal(review.summary.candidateAssignments, 3);
  assert.equal(comparable.length, 2);
  assert.equal(incomplete.length, 1);
  assert.deepEqual(capabilityOnly.map((member) => member.tutorAssignmentId), ["a3"]);
  assert.deepEqual(alphaSearch.map((member) => member.tutorAssignmentId), ["a1"]);
});

test("duplicate assignment identity fails closed even when tutor identity differs", () => {
  const first = candidate("a1", "agree_ready");
  const second = {
    ...candidate("a2", "agree_ready"),
    tutorAssignmentId: "a1",
    tutorId: "different-tutor",
  };
  assert.throws(
    () => buildShadowCohortReview([first, second]),
    /duplicate tutor assignment identities/i,
  );
});

test("cohort projection rejects authoritative or cutover-bearing comparison objects", () => {
  const invalid = candidate("a1", "agree_ready");
  const comparisonObject = invalid.comparison as ShadowSpecialistConcordance & {
    authoritative: boolean;
    cutoverDecision: string | null;
  };
  comparisonObject.authoritative = true;
  comparisonObject.cutoverDecision = "cutover";
  assert.throws(
    () => projectShadowCohortReviewMember(invalid),
    /not advisory-only/i,
  );
});
