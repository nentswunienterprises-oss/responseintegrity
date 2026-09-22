import {
  getDrillSchemaDefinition,
  getFieldDefinitionForRep,
  validateAndNormalizeSemanticEvidenceSet,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import type { ObservationLevel } from "./observationScoring";
import {
  resolveResponseEvidenceDimension,
  responseEvidenceClassFromObservationLevel,
  type ResponseEvidenceClass,
  type ResponseEvidenceDimensionState,
} from "./responseEvidenceModel";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";

export type HandoverEvidenceOccurrence = {
  setId: string;
  setName: string;
  repNumber: number;
  dimensionId: string;
  fieldKey: string;
  rawOption: string;
  normalizedLevel: ObservationLevel;
  evidenceClass: ResponseEvidenceClass;
};

export type HandoverDimensionDecision = {
  dimensionId: string;
  state: ResponseEvidenceDimensionState;
  validOpportunityCount: number;
  supportedCount: number;
  nearStableCount: number;
  conditionalCount: number;
  breakdownCount: number;
  recoveredAfterBreakdown: boolean;
  evidence: HandoverEvidenceOccurrence[];
};

export type HandoverEvidenceEvaluation =
  | {
      status: "evaluated";
      authority: "evidence_native";
      phase: TopicPhase;
      previousStability: TopicStability;
      verificationOutcome: "hold" | "stability_adjust" | "targeted_re_diagnosis_required";
      confidence: "low" | "normal" | "strong";
      resultingPhase: TopicPhase;
      resultingStability: TopicStability;
      reDiagnosisRequired: boolean;
      reason: string;
      dimensions: HandoverDimensionDecision[];
    }
  | {
      status: "unavailable";
      authority: "evidence_native";
      phase: TopicPhase;
      previousStability: TopicStability;
      reason: string;
    };

const reduceHandoverStability = (stability: TopicStability): TopicStability => {
  if (stability === "High Maintenance") return "High";
  if (stability === "High") return "Medium";
  if (stability === "Medium") return "Low";
  return "Low";
};

export const evaluateHandoverVerificationEvidence = ({
  phase,
  previousStability,
  set,
}: {
  phase: TopicPhase;
  previousStability: TopicStability;
  set: SubmittedEvidenceSet;
}): HandoverEvidenceEvaluation => {
  const schema = getDrillSchemaDefinition("verification", phase);
  const definition = schema.sets[0];

  const validation = validateAndNormalizeSemanticEvidenceSet({
    mode: "verification",
    phase,
    setIndex: 0,
    submittedSet: set,
  });
  if (!validation.ok) {
    return {
      status: "unavailable",
      authority: "evidence_native",
      phase,
      previousStability,
      reason: validation.error,
    };
  }

  const occurrences: HandoverEvidenceOccurrence[] = [];
  validation.normalizedSet.observations.forEach((rep, repIndex) => {
    definition.fields.forEach((baseField) => {
      const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey) || baseField;
      const rawOption = String(rep[field.fieldKey] || "").trim();
      const normalizedLevel = String(rep[field.fieldKey + "_level"] || "").trim() as ObservationLevel;
      if (!rawOption || !["weak", "partial", "clear"].includes(normalizedLevel)) return;
      occurrences.push({
        setId: definition.setId,
        setName: definition.setName,
        repNumber: repIndex + 1,
        dimensionId: field.dimensionId,
        fieldKey: field.fieldKey,
        rawOption,
        normalizedLevel,
        evidenceClass: responseEvidenceClassFromObservationLevel(normalizedLevel),
      });
    });
  });

  const dimensions = definition.fields.map((field) => {
    const resolution = resolveResponseEvidenceDimension({
      evidence: occurrences.filter((item) => item.dimensionId === field.dimensionId),
      minimumValidOpportunities: 2,
    });
    return {
      dimensionId: field.dimensionId,
      state: resolution.state,
      validOpportunityCount: resolution.validOpportunityCount,
      supportedCount: resolution.supportedCount,
      nearStableCount: resolution.nearStableCount,
      conditionalCount: resolution.conditionalCount,
      breakdownCount: resolution.breakdownCount,
      recoveredAfterBreakdown: resolution.recoveredAfterBreakdown,
      evidence: resolution.evidence,
    };
  });

  if (dimensions.some((dimension) => dimension.state === "UNRESOLVED")) {
    return {
      status: "evaluated",
      authority: "evidence_native",
      phase,
      previousStability,
      verificationOutcome: "targeted_re_diagnosis_required",
      confidence: "low",
      resultingPhase: phase,
      resultingStability: previousStability,
      reDiagnosisRequired: true,
      reason:
        "Continuity evidence was incomplete for at least one inherited phase dimension, so the inherited state cannot be trusted without targeted re-diagnosis.",
      dimensions,
    };
  }

  if (dimensions.some((dimension) => dimension.state === "BREAKDOWN")) {
    return {
      status: "evaluated",
      authority: "evidence_native",
      phase,
      previousStability,
      verificationOutcome: "targeted_re_diagnosis_required",
      confidence: "low",
      resultingPhase: phase,
      resultingStability: previousStability,
      reDiagnosisRequired: true,
      reason:
        "A phase-defining inherited capability broke under the continuity condition, so Handover cannot safely preserve or manually lower the inherited placement.",
      dimensions,
    };
  }

  if (dimensions.some((dimension) => dimension.state === "CONDITIONAL")) {
    return {
      status: "evaluated",
      authority: "evidence_native",
      phase,
      previousStability,
      verificationOutcome: "stability_adjust",
      confidence: "normal",
      resultingPhase: phase,
      resultingStability: reduceHandoverStability(previousStability),
      reDiagnosisRequired: false,
      reason:
        "The inherited phase still has usable evidence, but at least one dimension is conditional rather than independently supported.",
      dimensions,
    };
  }

  const allSupported = dimensions.every((dimension) => dimension.state === "SUPPORTED");
  return {
    status: "evaluated",
    authority: "evidence_native",
    phase,
    previousStability,
    verificationOutcome: "hold",
    confidence: allSupported ? "strong" : "normal",
    resultingPhase: phase,
    resultingStability: previousStability,
    reDiagnosisRequired: false,
    reason: allSupported
      ? "All inherited phase dimensions were repeatedly supported under the continuity condition."
      : "The inherited phase remained supported without evidence requiring reclassification.",
    dimensions,
  };
};
