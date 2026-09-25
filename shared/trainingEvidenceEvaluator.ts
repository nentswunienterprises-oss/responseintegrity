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
  type TrainingEvidenceTransitionReason,
  type TrainingObservedStability,
} from "./trainingEvidenceContract";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";
import {
  getTrainingObservationDefinitionV2,
  TRAINING_DECISION_EVIDENCE_CLASSES,
} from "./trainingObservationContractV2";
import { resolveResponseEvidenceDimension } from "./responseEvidenceModel";
import {
  getTrainingPrerequisiteSentinelDefinition,
  readTrainingEvidenceStatus,
  readTrainingInheritedRescueSignal,
  readTrainingInterventionEvent,
  readTrainingPrerequisiteSentinel,
  resolveTrainingEvidenceEligibility,
  type TrainingEvidenceStatus,
  type TrainingInheritedRescueSignal,
  type TrainingInterventionEvent,
  type TrainingPrerequisiteSentinelResult,
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
  recoveredAfterBreakdown: boolean;
  recoverySupportedRequirement: number;
  evidence: TrainingEvidenceOccurrence[];
};

export type TrainingPrerequisiteSentinelOccurrence = {
  setId: string;
  setName: string;
  setOrder: number;
  repNumber: number;
  targetPhase: TopicPhase;
  triggerDimensions: TrainingDimensionId[];
  result: TrainingPrerequisiteSentinelResult | "missing";
  source: "stripped_constraint_sentinel" | "inherited_rescue_signal";
};

export type TrainingInheritedRescueSignalOccurrence = {
  setId: string;
  setName: string;
  setOrder: number;
  repNumber: number;
  signal: TrainingInheritedRescueSignal;
};

export type TrainingPrerequisiteContradiction = {
  status: "not_applicable" | "not_triggered" | "cleared" | "confirmed" | "unresolved";
  targetPhase: TopicPhase | null;
  reason: string;
  evidence: TrainingPrerequisiteSentinelOccurrence[];
};

export type TrainingEvidenceAuthorityRoute = {
  route: "normal_training" | "targeted_rediagnosis";
  nextPhase: TopicPhase;
  nextStability: TopicStability;
  transitionReason: TrainingEvidenceTransitionReason | "targeted re-diagnosis required";
  targetPhase: TopicPhase | null;
  reason: string;
};

export type TrainingEvidenceEvaluation =
  | {
      status: "evaluated";
      authority: "evidence_native";
      phase: TopicPhase;
      previousStability: TopicStability;
      observedStability: TrainingObservedStability;
      dimensions: TrainingDimensionDecision[];
      highMaintenanceEntryQualified: boolean;
      exitQualified: boolean;
      predictedTransition: ReturnType<typeof transitionTrainingStateFromEvidence>;
      ineligibleEvidenceCount: number;
      interventionEvents: TrainingInterventionEvent[];
      inheritedRescueSignals: TrainingInheritedRescueSignalOccurrence[];
      prerequisiteContradiction: TrainingPrerequisiteContradiction;
    }
  | {
      status: "unavailable";
      authority: "evidence_native";
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
    missing: "breakdown",
    resists: "breakdown",
    breaks: "breakdown",
    lost: "breakdown",
    "out of order": "conditional",
    accepts: "conditional",
    inconsistent: "conditional",
    partial: "conditional",
    "mostly accurate": "near_stable",
    adjusts: "near_stable",
    accurate: "supported",
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
  const normalized = normalizeRaw(rawOption);
  const canonical = getTrainingObservationDefinitionV2(dimensionId)?.options.find(
    (option) => normalizeRaw(option.label) === normalized,
  );
  if (canonical) return canonical.behaviorClass;
  return RAW_BEHAVIOR_CLASS[dimensionId]?.[normalized] || null;
};

const TRAINING_DIMENSION_BY_FIELD_KEY: Record<string, TrainingDimensionId> = {
  vocabulary: "clarity.vocabulary",
  method: "clarity.method",
  reason: "clarity.reason",
  immediateApply: "clarity.immediate_apply",
  startBehavior: "execution.start",
  stepExecution: "execution.step_discipline",
  repeatability: "execution.repeatability",
  independence: "execution.independence",
  initialResponse: "difficulty.initial_response",
  firstStepControl: "difficulty.first_step_control",
  discomfortTolerance: "difficulty.tolerance",
  rescueDependence: "difficulty.rescue_dependence",
  startUnderTime: "time.start",
  structureUnderTime: "time.structure",
  paceControl: "time.pace",
  completionIntegrity: "time.completion_integrity",
};

export const trainingDimensionForFieldKey = (
  fieldKey: string,
): TrainingDimensionId | null =>
  TRAINING_DIMENSION_BY_FIELD_KEY[String(fieldKey || "").trim()] || null;

export const trainingRawObservationRequiresPrerequisiteSentinel = ({
  phase,
  fieldKey,
  rawOption,
  explicitStatus = "observed",
  interventionEvent = "none",
}: {
  phase: TopicPhase;
  fieldKey: string;
  rawOption: string;
  explicitStatus?: TrainingEvidenceStatus;
  interventionEvent?: TrainingInterventionEvent;
}): boolean => {
  if (!getTrainingPrerequisiteSentinelDefinition(phase)) return false;
  const dimensionId = trainingDimensionForFieldKey(fieldKey);
  if (!dimensionId) return false;
  const eligibility = resolveTrainingEvidenceEligibility({
    phase,
    dimensionId,
    explicitStatus,
    interventionEvent,
  });
  if (eligibility.status !== "observed") return false;
  return trainingEvidenceClassForRawBehavior(dimensionId, rawOption) === "breakdown";
};

const resolveDimension = (
  dimensionId: TrainingDimensionId,
  evidence: TrainingEvidenceOccurrence[],
  minimumValidOpportunities: number,
): TrainingDimensionDecision => {
  const resolution = resolveResponseEvidenceDimension({
    evidence,
    minimumValidOpportunities,
  });
  return {
    dimensionId,
    state: resolution.state as TrainingDimensionState,
    validOpportunityCount: resolution.validOpportunityCount,
    supportedCount: resolution.supportedCount,
    nearStableCount: resolution.nearStableCount,
    conditionalCount: resolution.conditionalCount,
    breakdownCount: resolution.breakdownCount,
    recoveredAfterBreakdown: resolution.recoveredAfterBreakdown,
    recoverySupportedRequirement: resolution.recoverySupportedRequirement,
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

export const evaluateTrainingEvidence = ({
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
        authority: "evidence_native",
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
        authority: "evidence_native",
        phase,
        previousStability,
        reason: validation.error,
      };
    }

    normalizedSets.push(validation.normalizedSet);
  }

  const occurrences: TrainingEvidenceOccurrence[] = [];
  const prerequisiteSentinelEvidence: TrainingPrerequisiteSentinelOccurrence[] = [];
  const inheritedRescueSignals: TrainingInheritedRescueSignalOccurrence[] = [];
  const prerequisiteSentinelDefinition = getTrainingPrerequisiteSentinelDefinition(phase);

  normalizedSets.forEach((submittedSet, setIndex) => {
    const definition = schema.sets[setIndex];
    if (definition.modelingOnly) return;

    submittedSet.observations.forEach((rep, repIndex) => {
      const repOccurrences: TrainingEvidenceOccurrence[] = [];
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
        const submittedEvidenceClass = String(
          rep[`${field.fieldKey}_evidence_class`] || "",
        ).trim() as TrainingEvidenceClass;
        const explicitDecisionClass =
          (TRAINING_DECISION_EVIDENCE_CLASSES as readonly string[]).includes(
            submittedEvidenceClass,
          )
            ? submittedEvidenceClass
            : null;
        const rawEvidenceClass =
          explicitDecisionClass ||
          trainingEvidenceClassForRawBehavior(dimensionId, rawOption);
        const evidenceClass: TrainingEvidenceClass =
          eligibility.status === "not_observed"
            ? "not_observed"
            : eligibility.status === "confounded"
              ? "confounded"
              : rawEvidenceClass || "confounded";

        const occurrence: TrainingEvidenceOccurrence = {
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
            (rawEvidenceClass ? null : "The raw training behavior is not mapped into the evidence-native shadow contract."),
          evidenceClass,
        };
        occurrences.push(occurrence);
        repOccurrences.push(occurrence);
      });

      const triggerDimensions = repOccurrences
        .filter((item) => item.evidenceClass === "breakdown")
        .map((item) => item.dimensionId);
      if (prerequisiteSentinelDefinition && triggerDimensions.length > 0) {
        prerequisiteSentinelEvidence.push({
          setId: definition.setId,
          setName: definition.setName,
          setOrder: setIndex + 1,
          repNumber: repIndex + 1,
          targetPhase: prerequisiteSentinelDefinition.targetPhase,
          triggerDimensions,
          result: readTrainingPrerequisiteSentinel(rep) || "missing",
          source: "stripped_constraint_sentinel",
        });
      }

      if (phase === "Time Pressure Stability") {
        const inheritedRescueSignal = readTrainingInheritedRescueSignal(rep);
        if (inheritedRescueSignal) {
          inheritedRescueSignals.push({
            setId: definition.setId,
            setName: definition.setName,
            setOrder: setIndex + 1,
            repNumber: repIndex + 1,
            signal: inheritedRescueSignal,
          });
        }
        if (inheritedRescueSignal === "repeated") {
          prerequisiteSentinelEvidence.push({
            setId: definition.setId,
            setName: definition.setName,
            setOrder: setIndex + 1,
            repNumber: repIndex + 1,
            targetPhase: "Controlled Discomfort",
            triggerDimensions: ["difficulty.rescue_dependence"],
            result: "contradicted",
            source: "inherited_rescue_signal",
          });
        }
      }
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

  const phaseOrder = (target: TopicPhase) =>
    ["Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability"].indexOf(target);
  const earliestTargetPhase = (items: TrainingPrerequisiteSentinelOccurrence[]) =>
    items
      .map((item) => item.targetPhase)
      .sort((a, b) => phaseOrder(a) - phaseOrder(b))[0] || prerequisiteSentinelDefinition?.targetPhase || null;

  let prerequisiteContradiction: TrainingPrerequisiteContradiction;
  if (!prerequisiteSentinelDefinition) {
    prerequisiteContradiction = {
      status: "not_applicable",
      targetPhase: null,
      reason: "Clarity has no earlier response-layer prerequisite to re-diagnose.",
      evidence: [],
    };
  } else if (prerequisiteSentinelEvidence.length === 0) {
    prerequisiteContradiction = {
      status: "not_triggered",
      targetPhase: prerequisiteSentinelDefinition.targetPhase,
      reason: "No clean current-phase breakdown or inherited rescue signal required earlier-layer verification.",
      evidence: [],
    };
  } else if (prerequisiteSentinelEvidence.some((item) => item.result === "contradicted")) {
    const contradicted = prerequisiteSentinelEvidence.filter((item) => item.result === "contradicted");
    const hasInheritedRescueContradiction = contradicted.some(
      (item) => item.source === "inherited_rescue_signal",
    );
    prerequisiteContradiction = {
      status: "confirmed",
      targetPhase: earliestTargetPhase(contradicted),
      reason: hasInheritedRescueContradiction
        ? "Repeated rescue-seeking under a timed no-support condition makes inherited rescue independence untrustworthy. Ordinary Training must stop after the current session and targeted re-diagnosis must re-establish the earlier layer."
        : "A clean current-phase breakdown remained present after the active constraint was stripped. The earlier prerequisite can no longer be trusted from prior state alone.",
      evidence: prerequisiteSentinelEvidence,
    };
  } else if (prerequisiteSentinelEvidence.some((item) =>
    item.result === "missing" || item.result === "not_observed" || item.result === "confounded")) {
    const unresolved = prerequisiteSentinelEvidence.filter(
      (item) => item.result === "missing" || item.result === "not_observed" || item.result === "confounded",
    );
    prerequisiteContradiction = {
      status: "unresolved",
      targetPhase: earliestTargetPhase(unresolved),
      reason: "A clean current-phase breakdown required a prerequisite sentinel, but the stripped-constraint check was not cleanly established. Ordinary training cannot continue on an untrusted prerequisite.",
      evidence: prerequisiteSentinelEvidence,
    };
  } else {
    prerequisiteContradiction = {
      status: "cleared",
      targetPhase: earliestTargetPhase(prerequisiteSentinelEvidence),
      reason: "The stripped-constraint prerequisite sentinel held, so the breakdown remains attributable to the current training phase.",
      evidence: prerequisiteSentinelEvidence,
    };
  }

  return {
    status: "evaluated",
    authority: "evidence_native",
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
    inheritedRescueSignals,
    prerequisiteContradiction,
  };
};

export const resolveTrainingEvidenceAuthorityRoute = (
  evaluation: Extract<TrainingEvidenceEvaluation, { status: "evaluated" }>,
): TrainingEvidenceAuthorityRoute => {
  const prerequisite = evaluation.prerequisiteContradiction;
  if (prerequisite.status === "confirmed" || prerequisite.status === "unresolved") {
    return {
      route: "targeted_rediagnosis",
      nextPhase: evaluation.phase,
      nextStability: evaluation.previousStability,
      transitionReason: "targeted re-diagnosis required",
      targetPhase: prerequisite.targetPhase,
      reason: prerequisite.reason,
    };
  }
  return {
    route: "normal_training",
    nextPhase: evaluation.predictedTransition.nextPhase,
    nextStability: evaluation.predictedTransition.nextStability,
    transitionReason: evaluation.predictedTransition.transitionReason,
    targetPhase: null,
    reason: prerequisite.status === "cleared"
      ? prerequisite.reason
      : "No prerequisite contradiction blocks the evidence-native training transition.",
  };
};

/** Backward-compatible name for historical comparison callers. */
export const evaluateTrainingEvidenceShadow = evaluateTrainingEvidence;



export type TrainingEvidenceShadowComparison = {
  authority: "shadow_only";
  available: boolean;
  diverged: boolean | null;
  stateDiverged: boolean | null;
  reasonDiverged: boolean | null;
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
      stateDiverged: null,
      reasonDiverged: null,
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
  const stateDiverged =
    legacy.nextPhase !== evidence.nextPhase ||
    legacy.nextStability !== evidence.nextStability;
  const reasonDiverged = legacy.transitionReason !== evidence.transitionReason;
  const diverged = stateDiverged;

  return {
    authority: "shadow_only",
    available: true,
    diverged,
    stateDiverged,
    reasonDiverged,
    legacy,
    evidence,
    reason: stateDiverged
      ? "The legacy score transition and evidence-native shadow state transition disagree."
      : reasonDiverged
        ? "The legacy and evidence-native engines reached the same state transition but used different transition-reason labels."
        : "The legacy score transition and evidence-native shadow transition agree.",
  };
};
