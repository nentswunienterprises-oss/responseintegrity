import type { ObservationLevel } from "./observationScoring";
import type { TopicPhase } from "./topicConditioningEngine";
import type { TrainingDimensionId } from "./trainingEvidenceContract";
import type { TrainingDecisionEvidenceClass } from "./trainingObservationContractV2";

export type TrainingObservationAuthorityRole =
  | "capability"
  | "cross_rep"
  | "condition_check";

export type TrainingObservationConditionRequirement =
  | "always"
  | "stated_plan_before_solving"
  | "prior_comparable_opportunity"
  | "meaningful_difficulty"
  | "meaningful_stuck_point"
  | "no_help"
  | "changed_form"
  | "real_timer"
  | "full_timer_constraint";

export type TrainingObservationAuthorityEntryV4 = {
  fieldKey: string;
  dimensionId: string;
  role: TrainingObservationAuthorityRole;
  decisionEligible: boolean;
  conditionRequirement: TrainingObservationConditionRequirement;
};

export type TrainingSetObservationAuthorityV4 = {
  phase: TopicPhase;
  setId: string;
  reps: Record<number, readonly TrainingObservationAuthorityEntryV4[]>;
};

const capability = (
  fieldKey: string,
  dimensionId: TrainingDimensionId,
  conditionRequirement: TrainingObservationConditionRequirement = "always",
): TrainingObservationAuthorityEntryV4 => ({
  fieldKey,
  dimensionId,
  role: "capability",
  decisionEligible: true,
  conditionRequirement,
});

const crossRep = (
  fieldKey: string,
  dimensionId: TrainingDimensionId,
): TrainingObservationAuthorityEntryV4 => ({
  fieldKey,
  dimensionId,
  role: "cross_rep",
  decisionEligible: true,
  conditionRequirement: "prior_comparable_opportunity",
});

const conditionCheck = (
  fieldKey: string,
  dimensionId: string,
  conditionRequirement: TrainingObservationConditionRequirement,
): TrainingObservationAuthorityEntryV4 => ({
  fieldKey,
  dimensionId,
  role: "condition_check",
  decisionEligible: false,
  conditionRequirement,
});

const three = (
  rep1: readonly TrainingObservationAuthorityEntryV4[],
  rep2: readonly TrainingObservationAuthorityEntryV4[] = rep1,
  rep3: readonly TrainingObservationAuthorityEntryV4[] = rep2,
) => ({ 1: rep1, 2: rep2, 3: rep3 });

const clarityIdentification = [
  capability("vocabulary", "clarity.vocabulary"),
  capability("method", "clarity.method"),
  capability("reason", "clarity.reason"),
] as const;

const clarityLightApply = [
  capability("vocabulary", "clarity.vocabulary"),
  capability("method", "clarity.method"),
  capability("reason", "clarity.reason"),
  capability("immediateApply", "clarity.immediate_apply"),
] as const;

const requiredStructureBase = [
  capability("startBehavior", "execution.start"),
  conditionCheck(
    "stepPlanAccuracy",
    "condition.required_structure.step_plan_accuracy",
    "stated_plan_before_solving",
  ),
  capability("stepExecution", "execution.step_discipline"),
  capability("independence", "execution.independence"),
] as const;

const independentExecutionBase = [
  capability("startBehavior", "execution.start", "no_help"),
  capability("stepExecution", "execution.step_discipline", "no_help"),
  capability("independence", "execution.independence", "no_help"),
] as const;

const variationControlBase = [
  capability("startBehavior", "execution.start", "changed_form"),
  capability("stepExecution", "execution.step_discipline", "changed_form"),
  capability("independence", "execution.independence", "changed_form"),
] as const;

const controlledDiscomfortBase = [
  capability(
    "initialResponse",
    "difficulty.initial_response",
    "meaningful_difficulty",
  ),
  capability(
    "firstStepControl",
    "difficulty.first_step_control",
    "meaningful_difficulty",
  ),
  capability(
    "discomfortTolerance",
    "difficulty.tolerance",
    "meaningful_difficulty",
  ),
  capability(
    "rescueDependence",
    "difficulty.rescue_dependence",
    "meaningful_stuck_point",
  ),
] as const;

const timePressureBase = [
  capability("startUnderTime", "time.start", "real_timer"),
  capability("structureUnderTime", "time.structure", "real_timer"),
  capability("paceControl", "time.pace", "real_timer"),
  capability(
    "completionIntegrity",
    "time.completion_integrity",
    "real_timer",
  ),
] as const;

export const TRAINING_REP_OBSERVATION_AUTHORITY_V4: Record<
  string,
  TrainingSetObservationAuthorityV4
> = {
  "clarity.identification": {
    phase: "Clarity",
    setId: "clarity.identification",
    reps: three(clarityIdentification),
  },
  "clarity.light_apply": {
    phase: "Clarity",
    setId: "clarity.light_apply",
    reps: three(clarityLightApply),
  },
  "structured_execution.required_structure": {
    phase: "Structured Execution",
    setId: "structured_execution.required_structure",
    reps: three(
      requiredStructureBase,
      [
        ...requiredStructureBase,
        crossRep("repeatability", "execution.repeatability"),
      ],
      [
        ...requiredStructureBase,
        crossRep("repeatability", "execution.repeatability"),
      ],
    ),
  },
  "structured_execution.independent_execution": {
    phase: "Structured Execution",
    setId: "structured_execution.independent_execution",
    reps: three(
      independentExecutionBase,
      [
        ...independentExecutionBase,
        crossRep("repeatability", "execution.repeatability"),
      ],
      [
        ...independentExecutionBase,
        crossRep("repeatability", "execution.repeatability"),
      ],
    ),
  },
  "structured_execution.variation_control": {
    phase: "Structured Execution",
    setId: "structured_execution.variation_control",
    reps: three(
      variationControlBase,
      [
        ...variationControlBase,
        crossRep("repeatability", "execution.repeatability"),
      ],
      [
        ...variationControlBase,
        crossRep("repeatability", "execution.repeatability"),
      ],
    ),
  },
  "controlled_discomfort.controlled_entry": {
    phase: "Controlled Discomfort",
    setId: "controlled_discomfort.controlled_entry",
    reps: three(controlledDiscomfortBase),
  },
  "controlled_discomfort.no_rescue": {
    phase: "Controlled Discomfort",
    setId: "controlled_discomfort.no_rescue",
    reps: three(controlledDiscomfortBase),
  },
  "controlled_discomfort.repeat_exposure": {
    phase: "Controlled Discomfort",
    setId: "controlled_discomfort.repeat_exposure",
    reps: three(controlledDiscomfortBase),
  },
  "time_pressure.structure_under_timer": {
    phase: "Time Pressure Stability",
    setId: "time_pressure.structure_under_timer",
    reps: three(timePressureBase),
  },
  "time_pressure.repeated_timed_execution": {
    phase: "Time Pressure Stability",
    setId: "time_pressure.repeated_timed_execution",
    reps: three(timePressureBase),
  },
  "time_pressure.full_constraint": {
    phase: "Time Pressure Stability",
    setId: "time_pressure.full_constraint",
    reps: three(
      timePressureBase.map((entry) => ({
        ...entry,
        conditionRequirement:
          "full_timer_constraint" as TrainingObservationConditionRequirement,
      })),
    ),
  },
};

export const getTrainingRepObservationAuthorityV4 = (
  setId: string,
  repNumber: number,
): readonly TrainingObservationAuthorityEntryV4[] =>
  TRAINING_REP_OBSERVATION_AUTHORITY_V4[setId]?.reps[repNumber] || [];

export const getTrainingRepFieldKeysV4 = (
  setId: string,
  repNumber: number,
): string[] =>
  getTrainingRepObservationAuthorityV4(setId, repNumber).map(
    (entry) => entry.fieldKey,
  );

export const isTrainingDecisionFieldV4 = (
  setId: string,
  repNumber: number,
  fieldKey: string,
): boolean =>
  Boolean(
    getTrainingRepObservationAuthorityV4(setId, repNumber).find(
      (entry) => entry.fieldKey === fieldKey && entry.decisionEligible,
    ),
  );

export const TRAINING_CONDITION_OBSERVATION_DEFINITIONS_V4 = {
  "condition.required_structure.step_plan_accuracy": {
    fieldKey: "stepPlanAccuracy",
    label: "Step plan accuracy",
    observationQuestion:
      "Before solving, how accurately did the student state the required step plan?",
    options: [
      {
        label: "Could not state a usable step plan",
        detail:
          "The student could not produce a coherent sequence of steps before solving.",
        evidenceClass: "breakdown" as TrainingDecisionEvidenceClass,
        level: "weak" as ObservationLevel,
      },
      {
        label: "Stated a plan with major order or content errors",
        detail:
          "A plan was stated, but important steps were missing, misplaced, or materially incorrect.",
        evidenceClass: "conditional" as TrainingDecisionEvidenceClass,
        level: "partial" as ObservationLevel,
      },
      {
        label: "Stated a mostly correct plan with a small gap or ordering issue",
        detail:
          "The required structure was substantially present before solving, with one minor defect.",
        evidenceClass: "near_stable" as TrainingDecisionEvidenceClass,
        level: "clear" as ObservationLevel,
      },
      {
        label: "Stated the required steps accurately and in order",
        detail:
          "The student produced the full required step sequence before solving without it being supplied.",
        evidenceClass: "supported" as TrainingDecisionEvidenceClass,
        level: "clear" as ObservationLevel,
      },
    ],
  },
} as const;

export type TrainingConditionObservationDimensionId =
  keyof typeof TRAINING_CONDITION_OBSERVATION_DEFINITIONS_V4;
