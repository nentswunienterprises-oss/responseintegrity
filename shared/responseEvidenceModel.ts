import type { ObservationLevel } from "./observationScoring";

export type ResponseEvidenceClass =
  | "breakdown"
  | "conditional"
  | "near_stable"
  | "supported"
  | "not_observed"
  | "confounded";

export type ResponseEvidenceDimensionState =
  | "BREAKDOWN"
  | "CONDITIONAL"
  | "NEAR_STABLE"
  | "SUPPORTED"
  | "UNRESOLVED";

export type ResponseEvidenceOccurrence = {
  evidenceClass: ResponseEvidenceClass;
};

export type ResponseEvidenceDimensionResolution<T extends ResponseEvidenceOccurrence> = {
  state: ResponseEvidenceDimensionState;
  validOpportunityCount: number;
  supportedCount: number;
  nearStableCount: number;
  conditionalCount: number;
  breakdownCount: number;
  trailingSupportedCount: number;
  recoverySupportedRequirement: number;
  recoveredAfterBreakdown: boolean;
  evidence: T[];
};

export const responseEvidenceClassFromObservationLevel = (
  level: ObservationLevel,
): ResponseEvidenceClass => {
  if (level === "weak") return "breakdown";
  if (level === "clear") return "supported";
  return "conditional";
};

export const resolveResponseEvidenceDimension = <T extends ResponseEvidenceOccurrence>({
  evidence,
  minimumValidOpportunities,
}: {
  evidence: T[];
  minimumValidOpportunities: number;
}): ResponseEvidenceDimensionResolution<T> => {
  const decisionEvidence = evidence.filter(
    (item) => item.evidenceClass !== "not_observed" && item.evidenceClass !== "confounded",
  );
  const supportedCount = decisionEvidence.filter((item) => item.evidenceClass === "supported").length;
  const nearStableCount = decisionEvidence.filter((item) => item.evidenceClass === "near_stable").length;
  const conditionalCount = decisionEvidence.filter((item) => item.evidenceClass === "conditional").length;
  const breakdownCount = decisionEvidence.filter((item) => item.evidenceClass === "breakdown").length;
  const last = decisionEvidence[decisionEvidence.length - 1];

  let trailingSupportedCount = 0;
  for (let index = decisionEvidence.length - 1; index >= 0; index -= 1) {
    if (decisionEvidence[index].evidenceClass !== "supported") break;
    trailingSupportedCount += 1;
  }

  // A real breakdown may recover, but never from one isolated good opportunity.
  // Recovery requires the normal support minimum plus one additional clean,
  // comparable supported observation after any earlier breakdown.
  const recoverySupportedRequirement =
    minimumValidOpportunities + (breakdownCount > 0 ? 1 : 0);

  let state: ResponseEvidenceDimensionState = "UNRESOLVED";
  if (decisionEvidence.length < minimumValidOpportunities) {
    state = "UNRESOLVED";
  } else if (trailingSupportedCount >= recoverySupportedRequirement) {
    state = "SUPPORTED";
  } else if (last?.evidenceClass === "breakdown" || breakdownCount >= 2) {
    state = "BREAKDOWN";
  } else if (
    breakdownCount === 0 &&
    conditionalCount === 0 &&
    decisionEvidence.every(
      (item) => item.evidenceClass === "supported" || item.evidenceClass === "near_stable",
    )
  ) {
    state = "NEAR_STABLE";
  } else {
    state = "CONDITIONAL";
  }

  return {
    state,
    validOpportunityCount: decisionEvidence.length,
    supportedCount,
    nearStableCount,
    conditionalCount,
    breakdownCount,
    trailingSupportedCount,
    recoverySupportedRequirement,
    recoveredAfterBreakdown: breakdownCount > 0 && state === "SUPPORTED",
    evidence,
  };
};
