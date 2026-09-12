import {
  type ShadowConcordanceClassification,
  type ShadowSpecialistConcordance,
  summarizeShadowConcordanceCohort,
} from "./capabilityShadowConcordance";

export type ShadowCohortCompletenessFilter = "all" | "comparable" | "incomplete";
export type ShadowCohortClassificationFilter = ShadowConcordanceClassification | "all";

export interface ShadowCohortCandidateInput {
  tutorAssignmentId: string;
  tutorId: string;
  specialistName: string;
  specialistEmail: string | null;
  podName: string | null;
  operationalMode: string | null;
  comparison: ShadowSpecialistConcordance;
}

export interface ShadowCohortReviewMember {
  tutorAssignmentId: string;
  tutorId: string;
  specialistName: string;
  specialistEmail: string | null;
  podName: string | null;
  operationalMode: string | null;
  overallClassification: ShadowConcordanceClassification;
  battleTestOverallState: ShadowSpecialistConcordance["battleTestOverallState"];
  capabilityOverallState: ShadowSpecialistConcordance["capabilityOverallState"];
  comparable: boolean;
  deepDiveSummary: {
    comparable: number;
    agreeing: number;
    disagreements: number;
    missing: number;
    integrityDisagreements: number;
  };
  evidenceCompleteness: {
    battleTestDeepDivesObserved: number;
    capabilityCellsObserved: number;
    capabilityCellsSatisfied: number;
    practicalCurrentStateCount: number;
    oralDefensePresent: boolean;
    sandboxSimulationPresent: boolean;
    sandboxMockOutcomePresent: boolean;
    trialCasePresent: boolean;
    trialDecisionPresent: boolean;
  };
}

export interface ShadowCohortReview {
  authoritative: false;
  cutoverDecision: null;
  analysisKind: "descriptive_shadow_cohort_review";
  generatedAt: string;
  summary: {
    candidateAssignments: number;
    comparableAssignments: number;
    incompleteAssignments: number;
    overallAgreementRate: number | null;
    classificationCounts: Record<ShadowConcordanceClassification, number>;
    mockOutcomeObservedCount: number;
    trialOutcomeObservedCount: number;
    statisticalAnalysisPlanDefined: false;
    equivalenceEstablished: false;
    superiorityEstablished: false;
    predictiveValidityEstablished: false;
    strongCutoverClaimAllowed: false;
  };
  members: ShadowCohortReviewMember[];
}

function requireIdentity(value: string, label: string) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function uniqueCount(values: string[]) {
  return new Set(values).size;
}

export function projectShadowCohortReviewMember(
  input: ShadowCohortCandidateInput,
): ShadowCohortReviewMember {
  const tutorAssignmentId = requireIdentity(input.tutorAssignmentId, "tutorAssignmentId");
  const tutorId = requireIdentity(input.tutorId, "tutorId");
  const specialistName = requireIdentity(input.specialistName, "specialistName");
  const comparison = input.comparison;

  if (comparison.authoritative !== false || comparison.cutoverDecision !== null) {
    throw new Error(`Shadow cohort member ${tutorAssignmentId} is not advisory-only.`);
  }

  const battleObserved = comparison.deepDives.filter(
    (deepDive) => deepDive.battleTestEvidence !== null,
  ).length;
  const observedCellCodes = comparison.deepDives.flatMap(
    (deepDive) => deepDive.capabilityEvidence.observedCellCodes,
  );
  const satisfiedCellCodes = comparison.deepDives.flatMap(
    (deepDive) => deepDive.capabilityEvidence.satisfiedCellCodes,
  );
  const practicalCurrentStateCount = comparison.capabilityHumanEvidence.practicals.filter(
    (proof) => proof.outcome !== null,
  ).length;

  return {
    tutorAssignmentId,
    tutorId,
    specialistName,
    specialistEmail: input.specialistEmail ? String(input.specialistEmail).trim() || null : null,
    podName: input.podName ? String(input.podName).trim() || null : null,
    operationalMode: input.operationalMode ? String(input.operationalMode).trim() || null : null,
    overallClassification: comparison.overallClassification,
    battleTestOverallState: comparison.battleTestOverallState,
    capabilityOverallState: comparison.capabilityOverallState,
    comparable: comparison.overallClassification !== "missing_comparison_evidence",
    deepDiveSummary: {
      comparable: comparison.summary.comparableDeepDives,
      agreeing: comparison.summary.agreeingDeepDives,
      disagreements: comparison.summary.disagreementDeepDives,
      missing: comparison.summary.missingDeepDives,
      integrityDisagreements: comparison.summary.integrityDisagreementDeepDives,
    },
    evidenceCompleteness: {
      battleTestDeepDivesObserved: battleObserved,
      capabilityCellsObserved: uniqueCount(observedCellCodes),
      capabilityCellsSatisfied: uniqueCount(satisfiedCellCodes),
      practicalCurrentStateCount,
      oralDefensePresent: comparison.capabilityHumanEvidence.oralDefense.outcome !== null,
      sandboxSimulationPresent:
        comparison.capabilitySimulationEvidence.latestCurrentAttempt !== null,
      sandboxMockOutcomePresent: comparison.outcomeTarget.mock.decision !== null,
      trialCasePresent: comparison.outcomeTarget.trial.caseStatus !== null,
      trialDecisionPresent:
        comparison.outcomeTarget.trial.certificationDecision !== null,
    },
  };
}

export function buildShadowCohortReview(
  candidates: ShadowCohortCandidateInput[],
  generatedAt = new Date().toISOString(),
): ShadowCohortReview {
  const assignmentIds = candidates.map((candidate) =>
    requireIdentity(candidate.tutorAssignmentId, "tutorAssignmentId"),
  );
  if (uniqueCount(assignmentIds) !== assignmentIds.length) {
    throw new Error("Shadow cohort contains duplicate tutor assignment identities.");
  }

  const members = candidates.map(projectShadowCohortReviewMember);
  const descriptive = summarizeShadowConcordanceCohort(
    candidates.map((candidate) => ({
      // Sprint 18 aggregation requires a unique identity. Concordance is an
      // assignment-level comparison, so assignment ID is the correct cohort key.
      tutorId: candidate.tutorAssignmentId,
      comparison: candidate.comparison,
    })),
  );

  return {
    authoritative: false,
    cutoverDecision: null,
    analysisKind: "descriptive_shadow_cohort_review",
    generatedAt,
    summary: {
      candidateAssignments: members.length,
      comparableAssignments: descriptive.comparableSampleSize,
      incompleteAssignments: descriptive.missingComparisonSampleSize,
      overallAgreementRate: descriptive.overallAgreementRate,
      classificationCounts: descriptive.classificationCounts,
      mockOutcomeObservedCount: descriptive.mockOutcomeObservedCount,
      trialOutcomeObservedCount: descriptive.trialOutcomeObservedCount,
      statisticalAnalysisPlanDefined: false,
      equivalenceEstablished: false,
      superiorityEstablished: false,
      predictiveValidityEstablished: false,
      strongCutoverClaimAllowed: false,
    },
    members,
  };
}

export function filterShadowCohortReviewMembers(input: {
  members: ShadowCohortReviewMember[];
  completeness?: ShadowCohortCompletenessFilter;
  classification?: ShadowCohortClassificationFilter;
  query?: string;
}) {
  const completeness = input.completeness || "all";
  const classification = input.classification || "all";
  const query = String(input.query || "").trim().toLowerCase();

  return input.members.filter((member) => {
    if (completeness === "comparable" && !member.comparable) return false;
    if (completeness === "incomplete" && member.comparable) return false;
    if (classification !== "all" && member.overallClassification !== classification) return false;
    if (query) {
      const haystack = [
        member.specialistName,
        member.specialistEmail || "",
        member.podName || "",
        member.tutorAssignmentId,
        member.tutorId,
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}
