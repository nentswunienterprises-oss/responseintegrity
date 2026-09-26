import {
  FINAL_PHASE,
  PHASES,
  type TopicPhase,
  type TopicStability,
} from "./topicConditioningEngine";

export type TrainingObservedStability = Exclude<TopicStability, "High Maintenance">;

export type TrainingDimensionId =
  | "clarity.vocabulary"
  | "clarity.method"
  | "clarity.reason"
  | "clarity.immediate_apply"
  | "execution.start"
  | "execution.step_discipline"
  | "execution.repeatability"
  | "execution.independence"
  | "difficulty.initial_response"
  | "difficulty.first_step_control"
  | "difficulty.tolerance"
  | "difficulty.rescue_dependence"
  | "time.start"
  | "time.structure"
  | "time.pace"
  | "time.completion_integrity";

export type TrainingDimensionState =
  | "BREAKDOWN"
  | "CONDITIONAL"
  | "NEAR_STABLE"
  | "SUPPORTED"
  | "UNRESOLVED";

export type TrainingEvidenceClass =
  | "breakdown"
  | "conditional"
  | "near_stable"
  | "supported"
  | "not_observed"
  | "confounded";

export type TrainingPhaseEvidenceContract = {
  phase: TopicPhase;
  dimensions: readonly TrainingDimensionId[];
  minimumValidOpportunitiesForHigh: Readonly<Record<TrainingDimensionId, number>>;
  requiredTrainingSetIds: readonly string[];
  highMaintenanceEntrySetIds: readonly string[];
  exitConfirmationSetIds: readonly string[];
  progressionTarget: TopicPhase | null;
  notes: readonly string[];
};

const opportunities = (
  dimensions: readonly TrainingDimensionId[],
  count: number,
): Readonly<Record<TrainingDimensionId, number>> =>
  Object.fromEntries(dimensions.map((dimensionId) => [dimensionId, count])) as Readonly<
    Record<TrainingDimensionId, number>
  >;

const clarityDimensions = [
  "clarity.vocabulary",
  "clarity.method",
  "clarity.reason",
  "clarity.immediate_apply",
] as const satisfies readonly TrainingDimensionId[];

const executionDimensions = [
  "execution.start",
  "execution.step_discipline",
  "execution.repeatability",
  "execution.independence",
] as const satisfies readonly TrainingDimensionId[];

const discomfortDimensions = [
  "difficulty.initial_response",
  "difficulty.first_step_control",
  "difficulty.tolerance",
  "difficulty.rescue_dependence",
] as const satisfies readonly TrainingDimensionId[];

const timeDimensions = [
  "time.start",
  "time.structure",
  "time.pace",
  "time.completion_integrity",
] as const satisfies readonly TrainingDimensionId[];

export const TRAINING_PHASE_EVIDENCE_CONTRACT: Record<TopicPhase, TrainingPhaseEvidenceContract> = {
  Clarity: {
    phase: "Clarity",
    dimensions: clarityDimensions,
    minimumValidOpportunitiesForHigh: opportunities(clarityDimensions, 2),
    requiredTrainingSetIds: ["clarity.identification", "clarity.light_apply"],
    highMaintenanceEntrySetIds: ["clarity.identification", "clarity.light_apply"],
    exitConfirmationSetIds: ["clarity.light_apply"],
    progressionTarget: "Structured Execution",
    notes: [
      "Modeling is teaching-only and cannot satisfy independent evidence requirements.",
      "Identification is recognition-only: Vocabulary, Method, and Reason are observable there; Immediate Apply is not.",
      "Immediate Apply is decision-eligible only in Light Apply, where active solving actually occurs.",
      "Vocabulary and Method must each include valid Light Apply evidence before High is claimable.",
      "High Maintenance entry requires all four dimensions to resolve SUPPORTED.",
      "Exit confirmation must occur in a later submitted session and cannot use modeling evidence.",
    ],
  },
  "Structured Execution": {
    phase: "Structured Execution",
    dimensions: executionDimensions,
    minimumValidOpportunitiesForHigh: opportunities(executionDimensions, 2),
    requiredTrainingSetIds: [
      "structured_execution.required_structure",
      "structured_execution.independent_execution",
      "structured_execution.variation_control",
    ],
    highMaintenanceEntrySetIds: [
      "structured_execution.independent_execution",
      "structured_execution.variation_control",
    ],
    exitConfirmationSetIds: ["structured_execution.variation_control"],
    progressionTarget: "Controlled Discomfort",
    notes: [
      "Independent Execution must contain valid no-help evidence.",
      "Variation Control must contain valid changed-form evidence.",
      "High Maintenance entry requires all four dimensions to resolve SUPPORTED.",
      "Exit confirmation requires at least two valid changed-form reps without opening rescue.",
    ],
  },
  "Controlled Discomfort": {
    phase: "Controlled Discomfort",
    dimensions: discomfortDimensions,
    minimumValidOpportunitiesForHigh: opportunities(discomfortDimensions, 2),
    requiredTrainingSetIds: [
      "controlled_discomfort.controlled_entry",
      "controlled_discomfort.no_rescue",
      "controlled_discomfort.repeat_exposure",
    ],
    highMaintenanceEntrySetIds: [
      "controlled_discomfort.no_rescue",
      "controlled_discomfort.repeat_exposure",
    ],
    exitConfirmationSetIds: ["controlled_discomfort.repeat_exposure"],
    progressionTarget: "Time Pressure Stability",
    notes: [
      "The session must contain a genuine difficult or stuck moment before rescue dependence can be interpreted.",
      "First-step assistance makes independent First-Step Control ineligible for that opportunity.",
      "High Maintenance entry requires all four dimensions to resolve SUPPORTED.",
      "Exit confirmation requires repeated difficult opportunities with supported tolerance and low rescue dependence.",
    ],
  },
  "Time Pressure Stability": {
    phase: "Time Pressure Stability",
    dimensions: timeDimensions,
    minimumValidOpportunitiesForHigh: opportunities(timeDimensions, 2),
    requiredTrainingSetIds: [
      "time_pressure.structure_under_timer",
      "time_pressure.repeated_timed_execution",
      "time_pressure.full_constraint",
    ],
    highMaintenanceEntrySetIds: [
      "time_pressure.repeated_timed_execution",
      "time_pressure.full_constraint",
    ],
    exitConfirmationSetIds: ["time_pressure.full_constraint"],
    progressionTarget: null,
    notes: [
      "All decision-eligible evidence must be gathered under a real timer.",
      "Timer relaxation or material support confounds the affected timed dimension.",
      "High Maintenance entry requires all four dimensions to resolve SUPPORTED.",
      "Final confirmation keeps the topic in Time Pressure Stability / High Maintenance and enters maintenance-transfer mode.",
    ],
  },
};

export const TRAINING_STABILITY_MEANINGS: Record<TopicStability, string> = {
  Low: "A phase-defining behavior is breaking under valid training exposure.",
  Medium: "The capability exists but is conditional, incomplete, support-dependent, or not yet sufficiently evidenced.",
  High: "The phase-defining capability is substantially present under the current training conditions.",
  "High Maintenance": "High has repeated in a later qualifying session and the topic is awaiting exit confirmation.",
};

export type TrainingEvidenceTransitionReason =
  | "remain"
  | "stability advance"
  | "stability regress"
  | "high maintenance entry"
  | "phase progress"
  | "final maintenance hold";

export type TrainingEvidenceTransitionInput = {
  previousPhase: TopicPhase;
  previousStability: TopicStability;
  observedStability: TrainingObservedStability;
  highMaintenanceEntryQualified: boolean;
  exitQualified: boolean;
};

export type TrainingEvidenceTransitionResult = {
  nextPhase: TopicPhase;
  nextStability: TopicStability;
  transitionReason: TrainingEvidenceTransitionReason;
};

const nextPhaseFor = (phase: TopicPhase): TopicPhase => {
  const index = PHASES.indexOf(phase);
  return index >= 0 && index < PHASES.length - 1 ? PHASES[index + 1] : phase;
};

/**
 * Evidence-native persistent-state transition contract.
 *
 * Important:
 * - observedStability is derived from behavioral evidence, never from a numeric score.
 * - a single session can establish High but cannot jump directly to High Maintenance.
 * - High Maintenance requires a later qualifying session while already High.
 * - phase progression requires a later qualifying session while already High Maintenance.
 */
export const transitionTrainingStateFromEvidence = ({
  previousPhase,
  previousStability,
  observedStability,
  highMaintenanceEntryQualified,
  exitQualified,
}: TrainingEvidenceTransitionInput): TrainingEvidenceTransitionResult => {
  if (previousStability === "Low") {
    if (observedStability === "Low") {
      return { nextPhase: previousPhase, nextStability: "Low", transitionReason: "remain" };
    }
    return {
      nextPhase: previousPhase,
      nextStability: observedStability,
      transitionReason: "stability advance",
    };
  }

  if (previousStability === "Medium") {
    if (observedStability === "Low") {
      return {
        nextPhase: previousPhase,
        nextStability: "Low",
        transitionReason: "stability regress",
      };
    }
    if (observedStability === "Medium") {
      return { nextPhase: previousPhase, nextStability: "Medium", transitionReason: "remain" };
    }
    return {
      nextPhase: previousPhase,
      nextStability: "High",
      transitionReason: "stability advance",
    };
  }

  if (previousStability === "High") {
    if (observedStability !== "High") {
      return {
        nextPhase: previousPhase,
        nextStability: "Medium",
        transitionReason: "stability regress",
      };
    }
    if (!highMaintenanceEntryQualified) {
      return { nextPhase: previousPhase, nextStability: "High", transitionReason: "remain" };
    }
    return {
      nextPhase: previousPhase,
      nextStability: "High Maintenance",
      transitionReason: "high maintenance entry",
    };
  }

  if (observedStability !== "High") {
    return {
      nextPhase: previousPhase,
      nextStability: "High",
      transitionReason: "stability regress",
    };
  }

  if (!exitQualified) {
    return {
      nextPhase: previousPhase,
      nextStability: "High Maintenance",
      transitionReason: "remain",
    };
  }

  if (previousPhase === FINAL_PHASE) {
    return {
      nextPhase: previousPhase,
      nextStability: "High Maintenance",
      transitionReason: "final maintenance hold",
    };
  }

  return {
    nextPhase: nextPhaseFor(previousPhase),
    nextStability: "Low",
    transitionReason: "phase progress",
  };
};

export const isTrainingEvidenceDecisionEligible = (evidenceClass: TrainingEvidenceClass) =>
  evidenceClass !== "not_observed" && evidenceClass !== "confounded";

export const canDimensionSupportHigh = (state: TrainingDimensionState) =>
  state === "SUPPORTED" || state === "NEAR_STABLE";

export const canDimensionSupportHighMaintenanceEntry = (state: TrainingDimensionState) =>
  state === "SUPPORTED";

export const canDimensionSupportExit = (state: TrainingDimensionState) =>
  state === "SUPPORTED";
