import {
  getDrillSchemaDefinition,
  getFieldDefinitionForRep,
  validateAndNormalizeSemanticEvidenceSet,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import {
  TRAINING_PHASE_EVIDENCE_CONTRACT,
  canDimensionSupportHigh,
  transitionTrainingStateFromEvidence,
  type TrainingDimensionId,
  type TrainingDimensionState,
  type TrainingEvidenceClass,
  type TrainingObservedStability,
} from "./trainingEvidenceContract";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";
import {
  readTrainingEvidenceStatus,
  readTrainingInterventionEvent,
  resolveTrainingEvidenceEligibility,
  type TrainingEvidenceStatus,
  type TrainingInterventionEvent,
} from "./trainingEvidenceCapture";

export type TrainingEvidenceOccurrence = {
  setId: string;
  setName: string;
  setOrder: number;
  repNumber: number;
  dimensionId: TrainingDimensionId;
  rawOption: string;
  explicitEvidenceStatus: TrainingEvidenceStatus;
  interventionEvent: TrainingInterventionEvent;
  eligibilityReason: string | null;
  evidenceClass: TrainingEvidenceClass;
};

export type TrainingDimensionDecision = {
  dimensionId: TrainingDimensionId;
  state: TrainingDimensionState;
  validOpportunityCount: number;
  supportedCount: number;
  nearStableCount: number;
  conditionalCount: number;
  breakdownCount: number;
  evidence: TrainingEvidenceOccurrence[];
};

export type TrainingEvidenceEvaluation =
  | {
      status: "evaluated";
      authority: "shadow_only";
      phase: TopicPhase;
      previousStability: TopicStability;
      observedStability: TrainingObservedStability;
      dimensions: TrainingDimensionDecision[];
      highMaintenanceEntryQualified: boolean;
      exitQualified: boolean;
      predictedTransition: ReturnType<typeof transitionTrainingStateFromEvidence>;
      ineligibleEvidenceCount: number;
      interventionEvents: TrainingInterventionEvent[];
      prerequisiteContradiction: {
        status: "not_evaluable_with_current_training_capture";
        reason: string;
      };
    }
  | {
      status: "unavailable";
      authority: "shadow_only";
      phase: TopicPhase;
      previousStability: TopicStability;
      reason: string;
    };

const normalizeRaw = (value: string) => String(value || "").trim().toLowerCase();

const RAW_BEHAVIOR_CLASS: Record<TrainingDimensionId, Record<string, TrainingEvidenceClass>> = {
  "clarity.vocabulary": {
    wrong: "breakdown",
    incorrect: "breakdown",
    partial: "conditional",
    hesitant: "near_stable",
    correct: "supported",
  },
  "clarity.method": {
    missing: "breakdown",
    skips: "breakdown",
    partial: "conditional",
    inconsistent: "conditional",
    clear: "supported",
    structured: "supported",
  },
  "clarity.reason": {
    none: "breakdown",
    absent: "breakdown",
    weak: "conditional",
    clear: "supported",
    present: "supported",
  },
  "clarity.immediate_apply": {
    "avoids answering": "breakdown",
    delayed: "conditional",
    "unsure but tries": "near_stable",
    hesitant: "near_stable",
    confident: "supported",
    immediate: "supported",
  },
  "execution.start": {
    delayed: "conditional",
    hesitant: "near_stable",
    immediate: "supported",
  },
  "execution.step_discipline": {
    skips: "breakdown",
    guesses: "breakdown",
    "cannot adapt": "breakdown",
    partial: "conditional",
    "partial correction": "conditional",
    "structured correction": "near_stable",
    full: "supported",
    "no correction needed": "supported",
    adapts: "supported",
  },
  "execution.repeatability": {
    resists: "breakdown",
    breaks: "breakdown",
    lost: "breakdown",
    accepts: "conditional",
    inconsistent: "conditional",
    partial: "conditional",
    adjusts: "near_stable",
    "already structured correctly": "supported",
    stable: "supported",
  },
  "execution.independence": {
    "needs help": "breakdown",
    fails: "breakdown",
    "light support": "conditional",
    partial: "conditional",
    independent: "supported",
    complete: "supported",
  },
  "difficulty.initial_response": {
    freeze: "breakdown",
    collapses: "breakdown",
    partial: "conditional",
    hesitant: "near_stable",
    recovers: "near_stable",
    controlled: "supported",
    "no recovery needed": "supported",
  },
  "difficulty.first_step_control": {
    wrong: "breakdown",
    none: "breakdown",
    partial: "conditional",
    prompted: "conditional",
    correct: "supported",
    independent: "supported",
  },
  "difficulty.tolerance": {
    breaks: "breakdown",
    unstable: "conditional",
    inconsistent: "conditional",
    stable: "supported",
  },
  "difficulty.rescue_dependence": {
    frequent: "breakdown",
    dependent: "breakdown",
    occasional: "conditional",
    partial: "conditional",
    none: "supported",
    independent: "supported",
  },
  "time.start": {
    panic: "breakdown",
    hesitant: "near_stable",
    controlled: "supported",
  },
  "time.structure": {
    lost: "breakdown",
    collapses: "breakdown",
    partial: "conditional",
    unstable: "conditional",
    maintained: "supported",
    stable: "supported",
  },
  "time.pace": {
    rushed: "conditional",
    uneven: "near_stable",
    controlled: "supported",
  },
  "time.completion_integrity": {
    fails: "breakdown",
    breaks: "breakdown",
    partial: "conditional",
    inconsistent: "conditional",
    complete: "supported",
    stable: "supported",
  },
};

export const trainingEvidenceClassForRawBehavior = (
  dimensionId: TrainingDimensionId,
  rawOption: string,
): TrainingEvidenceClass | null => {
  return RAW_BEHAVIOR_CLASS[dimensionId]?.[normalizeRaw(rawOption)] || null;
};

const resolveDimension = (
  dimensionId: TrainingDimensionId,
  evidence: TrainingEvidenceOccurrence[],
  minimumValidOpportunities: number,
): TrainingDimensionDecision => {
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

  // Earlier instability can be repaired by later clean comparable evidence.
  // A prior breakdown requires one extra clean confirmation beyond the normal
  // dimension minimum; conditional/near-stable behavior requires the normal
  // minimum. This keeps recovery authoritative without letting one clean rep
  // erase a genuine break.
  const recoverySupportedRequirement =
    minimumValidOpportunities + (breakdownCount > 0 ? 1 : 0);

  let state: TrainingDimensionState = "UNRESOLVED";

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
    dimensionId,
    state,
    validOpportunityCount: decisionEvidence.length,
    supportedCount,
    nearStableCount,
    conditionalCount,
    breakdownCount,
    evidence,
  };
};

const supportedInSet = (
  decision: TrainingDimensionDecision,
  setId: string,
) => decision.evidence.filter(
  (item) => item.setId === setId && item.evidenceClass === "supported",
).length;

const setsRepresented = (
  occurrences: TrainingEvidenceOccurrence[],
  setIds: readonly string[],
) => setIds.every((setId) => occurrences.some((item) => item.setId === setId));

const allDimensionsHaveSupportInSets = (
  decisions: TrainingDimensionDecision[],
  setIds: readonly string[],
  minimumPerSet: number,
) => decisions.every((decision) =>
  setIds.every((setId) => supportedInSet(decision, setId) >= minimumPerSet),
);

export const evaluateTrainingEvidenceShadow = ({
  phase,
  previousStability,
  sets,
}: {
  phase: TopicPhase;
  previousStability: TopicStability;
  sets: SubmittedEvidenceSet[];
}): TrainingEvidenceEvaluation => {
  const schema = getDrillSchemaDefinition("training", phase);
  const normalizedSets: SubmittedEvidenceSet[] = [];

  for (let setIndex = 0; setIndex < schema.sets.length; setIndex += 1) {
    const definition = schema.sets[setIndex];
    const submittedSet = sets[setIndex];
    if (!submittedSet) {
      return {
        status: "unavailable",
        authority: "shadow_only",
        phase,
        previousStability,
        reason: `Missing training set ${definition.setId}`,
      };
    }

    const validation = validateAndNormalizeSemanticEvidenceSet({
      mode: "training",
      phase,
      setIndex,
      submittedSet,
    });
    if ("error" in validation) {
      return {
        status: "unavailable",
        authority: "shadow_only",
        phase,
        previousStability,
        reason: validation.error,
      };
    }

    normalizedSets.push(validation.normalizedSet);
  }

  const occurrences: TrainingEvidenceOccurrence[] = [];

  normalizedSets.forEach((submittedSet, setIndex) => {
    const definition = schema.sets[setIndex];
    if (definition.modelingOnly) return;

    submittedSet.observations.forEach((rep, repIndex) => {
      definition.fields.forEach((baseField) => {
        const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey) || baseField;
        const dimensionId = field.dimensionId as TrainingDimensionId;
        const rawOption = String(rep[field.fieldKey] || "").trim();
        const explicitEvidenceStatus = readTrainingEvidenceStatus(rep, field.fieldKey);
        const interventionEvent = readTrainingInterventionEvent(rep);
        const eligibility = resolveTrainingEvidenceEligibility({
          phase,
          dimensionId,
          explicitStatus: explicitEvidenceStatus,
          interventionEvent,
        });
        const rawEvidenceClass = trainingEvidenceClassForRawBehavior(dimensionId, rawOption);
        const evidenceClass: TrainingEvidenceClass =
          eligibility.status === "not_observed"
            ? "not_observed"
            : eligibility.status === "confounded"
              ? "confounded"
              : rawEvidenceClass || "confounded";

        occurrences.push({
          setId: definition.setId,
          setName: definition.setName,
          setOrder: setIndex + 1,
          repNumber: repIndex + 1,
          dimensionId,
          rawOption,
          explicitEvidenceStatus,
          interventionEvent,
          eligibilityReason:
            eligibility.reason ||
            (rawEvidenceClass
              ? null
              : "The raw training behavior is not mapped into the evidence-native shadow contract."),
          evidenceClass,
        });
      });
    });
  });

  const contract = TRAINING_PHASE_EVIDENCE_CONTRACT[phase];
  const decisions = contract.dimensions.map((dimensionId) =>
    resolveDimension(
      dimensionId,
      occurrences.filter((item) => item.dimensionId === dimensionId),
      contract.minimumValidOpportunitiesForHigh[dimensionId],
    ),
  );

  const hasBreakdown = decisions.some((decision) => decision.state === "BREAKDOWN");
  const highCoverage =
    setsRepresented(occurrences, contract.requiredTrainingSetIds) &&
    decisions.every((decision) => canDimensionSupportHigh(decision.state));

  const observedStability: TrainingObservedStability =
    hasBreakdown ? "Low" : highCoverage ? "High" : "Medium";

  const highMaintenanceEntryQualified =
    observedStability === "High" &&
    decisions.every((decision) => decision.state === "SUPPORTED") &&
    allDimensionsHaveSupportInSets(decisions, contract.highMaintenanceEntrySetIds, 1);

  const exitQualified =
    observedStability === "High" &&
    decisions.every((decision) => decision.state === "SUPPORTED") &&
    allDimensionsHaveSupportInSets(decisions, contract.exitConfirmationSetIds, 2);

  return {
    status: "evaluated",
    authority: "shadow_only",
    phase,
    previousStability,
    observedStability,
    dimensions: decisions,
    highMaintenanceEntryQualified,
    exitQualified,
    predictedTransition: transitionTrainingStateFromEvidence({
      previousPhase: phase,
      previousStability,
      observedStability,
      highMaintenanceEntryQualified,
      exitQualified,
    }),
    ineligibleEvidenceCount: occurrences.filter(
      (item) => item.evidenceClass === "not_observed" || item.evidenceClass === "confounded",
    ).length,
    interventionEvents: Array.from(
      new Set(
        occurrences
          .map((item) => item.interventionEvent)
          .filter((event) => event !== "none"),
      ),
    ),
    prerequisiteContradiction: {
      status: "not_evaluable_with_current_training_capture",
      reason:
        "Current same-phase training fields cannot reliably distinguish an earlier-layer prerequisite loss from a current-layer breakdown. Targeted cross-layer sentinels must be added before automatic re-diagnosis routing is authorized.",
    },
  };
};


export type TrainingEvidenceShadowComparison = {
  authority: "shadow_only";
  available: boolean;
  diverged: boolean | null;
  legacy: {
    score: number;
    nextPhase: TopicPhase;
    nextStability: TopicStability;
    transitionReason: string;
  };
  evidence: null | {
    observedStability: TrainingObservedStability;
    nextPhase: TopicPhase;
    nextStability: TopicStability;
    transitionReason: string;
    highMaintenanceEntryQualified: boolean;
    exitQualified: boolean;
    ineligibleEvidenceCount: number;
  };
  reason: string;
};

export const compareTrainingEvidenceShadowToLegacy = ({
  sessionScore,
  legacyTransition,
  evidenceShadow,
}: {
  sessionScore: number;
  legacyTransition: {
    nextPhase: TopicPhase;
    nextStability: TopicStability;
    transitionReason: string;
  };
  evidenceShadow: TrainingEvidenceEvaluation;
}): TrainingEvidenceShadowComparison => {
  const legacy = {
    score: sessionScore,
    nextPhase: legacyTransition.nextPhase,
    nextStability: legacyTransition.nextStability,
    transitionReason: legacyTransition.transitionReason,
  };

  if (evidenceShadow.status !== "evaluated") {
    return {
      authority: "shadow_only",
      available: false,
      diverged: null,
      legacy,
      evidence: null,
      reason: evidenceShadow.reason,
    };
  }

  const evidence = {
    observedStability: evidenceShadow.observedStability,
    nextPhase: evidenceShadow.predictedTransition.nextPhase,
    nextStability: evidenceShadow.predictedTransition.nextStability,
    transitionReason: evidenceShadow.predictedTransition.transitionReason,
    highMaintenanceEntryQualified: evidenceShadow.highMaintenanceEntryQualified,
    exitQualified: evidenceShadow.exitQualified,
    ineligibleEvidenceCount: evidenceShadow.ineligibleEvidenceCount,
  };
  const diverged =
    legacy.nextPhase !== evidence.nextPhase ||
    legacy.nextStability !== evidence.nextStability ||
    legacy.transitionReason !== evidence.transitionReason;

  return {
    authority: "shadow_only",
    available: true,
    diverged,
    legacy,
    evidence,
    reason: diverged
      ? "The legacy score transition and evidence-native shadow transition disagree."
      : "The legacy score transition and evidence-native shadow transition agree.",
  };
};
