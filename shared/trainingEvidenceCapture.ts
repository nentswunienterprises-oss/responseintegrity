import type { TopicPhase } from "./topicConditioningEngine";
import type { TrainingDimensionId } from "./trainingEvidenceContract";

export type TrainingEvidenceStatus = "observed" | "not_observed" | "confounded";

export type TrainingInterventionEvent =
  | "none"
  | "neutral_clarification"
  | "first_step_confirmation"
  | "method_or_step_prompt"
  | "full_rescue_or_teaching"
  | "timer_changed";

export const TRAINING_INTERVENTION_FIELD = "_training_intervention_event";

export type TrainingPrerequisiteSentinelResult =
  | "held"
  | "contradicted"
  | "not_observed"
  | "confounded";

export const TRAINING_PREREQUISITE_SENTINEL_FIELD =
  "_training_prerequisite_sentinel";

export type TrainingInheritedRescueSignal =
  | "none"
  | "isolated"
  | "repeated"
  | "not_observed"
  | "confounded";

export const TRAINING_INHERITED_RESCUE_SIGNAL_FIELD =
  "_training_inherited_rescue_signal";

export const TRAINING_INHERITED_RESCUE_SIGNAL_OPTIONS: Array<{
  id: TrainingInheritedRescueSignal;
  label: string;
  detail: string;
}> = [
  {
    id: "none",
    label: "No rescue-seeking",
    detail: "The student worked without asking for reassurance, the next step, or help.",
  },
  {
    id: "isolated",
    label: "One brief rescue request",
    detail: "The student made one brief request for reassurance or help but did not repeatedly seek rescue.",
  },
  {
    id: "repeated",
    label: "Repeated rescue-seeking",
    detail: "The student repeatedly asked for correctness confirmation, the next step, or help during the timed rep.",
  },
  {
    id: "not_observed",
    label: "Could not observe rescue-seeking",
    detail: "The opportunity did not make rescue-seeking meaningfully observable.",
  },
  {
    id: "confounded",
    label: "Rescue signal was confounded",
    detail: "Interruption, task mismatch, or another condition prevented clean interpretation of rescue-seeking.",
  },
];

export const readTrainingInheritedRescueSignal = (
  rep: Record<string, string>,
): TrainingInheritedRescueSignal | null => {
  const raw = String(rep?.[TRAINING_INHERITED_RESCUE_SIGNAL_FIELD] || "").trim();
  return TRAINING_INHERITED_RESCUE_SIGNAL_OPTIONS.some((option) => option.id === raw)
    ? raw as TrainingInheritedRescueSignal
    : null;
};

export type TrainingPrerequisiteSentinelDefinition = {
  trainingPhase: Exclude<TopicPhase, "Clarity">;
  targetPhase: TopicPhase;
  evidenceQuestion: string;
  specialistInstruction: string;
  heldLabel: string;
  contradictedLabel: string;
};

export const TRAINING_PREREQUISITE_SENTINELS: Partial<
  Record<TopicPhase, TrainingPrerequisiteSentinelDefinition>
> = {
  "Structured Execution": {
    trainingPhase: "Structured Execution",
    targetPhase: "Clarity",
    evidenceQuestion:
      "Does Clarity still hold independently, or is the execution breakdown actually sitting below Structured Execution?",
    specialistInstruction:
      "Before another solve, use one comparable normal problem and ask the student to identify the method and why it applies. Do not teach, cue the method, or supply a step.",
    heldLabel: "Identifies the method and why it applies without help",
    contradictedLabel: "Cannot identify the method or why it applies without help",
  },
  "Controlled Discomfort": {
    trainingPhase: "Controlled Discomfort",
    targetPhase: "Structured Execution",
    evidenceQuestion:
      "Does independent execution return when difficulty is stripped away?",
    specialistInstruction:
      "Strip the difficulty. Give one comparable normal problem with no timer, rescue, or method prompt. Observe whether the known method executes independently.",
    heldLabel: "Executes the known method independently once difficulty is removed",
    contradictedLabel: "Execution still breaks after difficulty is removed",
  },
  "Time Pressure Stability": {
    trainingPhase: "Time Pressure Stability",
    targetPhase: "Structured Execution",
    evidenceQuestion:
      "Does structure return when the timer is removed, or has an earlier execution prerequisite become untrustworthy?",
    specialistInstruction:
      "Remove the timer. Give one comparable untimed problem with no coaching or rescue. Observe whether structure and independent execution return.",
    heldLabel: "Structure returns and the method executes independently without the timer",
    contradictedLabel: "Structure still breaks with the timer removed",
  },
};

export const getTrainingPrerequisiteSentinelDefinition = (
  phase: TopicPhase,
): TrainingPrerequisiteSentinelDefinition | null =>
  TRAINING_PREREQUISITE_SENTINELS[phase] || null;

export const readTrainingPrerequisiteSentinel = (
  rep: Record<string, string>,
): TrainingPrerequisiteSentinelResult | null => {
  const raw = String(rep?.[TRAINING_PREREQUISITE_SENTINEL_FIELD] || "").trim();
  return raw === "held" ||
    raw === "contradicted" ||
    raw === "not_observed" ||
    raw === "confounded"
    ? raw
    : null;
};

export const TRAINING_INTERVENTION_OPTIONS: Array<{
  id: TrainingInterventionEvent;
  label: string;
  detail: string;
}> = [
  {
    id: "none",
    label: "No intervention",
    detail: "The Specialist only presented the task and observed.",
  },
  {
    id: "neutral_clarification",
    label: "Neutral clarification",
    detail: "Wording was clarified without supplying mathematical content, a method, or a step.",
  },
  {
    id: "first_step_confirmation",
    label: "First-step confirmation",
    detail: "The Specialist confirmed or supplied the opening step. Independence-sensitive evidence may become confounded.",
  },
  {
    id: "method_or_step_prompt",
    label: "Method / step prompt",
    detail: "The Specialist prompted the method or a later execution step. The system restricts which dimensions may use this evidence.",
  },
  {
    id: "full_rescue_or_teaching",
    label: "Teaching / full rescue",
    detail: "The Specialist taught, corrected, or carried the response. Current-phase capability evidence becomes confounded.",
  },
  {
    id: "timer_changed",
    label: "Timer changed",
    detail: "The timer was paused, relaxed, restarted, or materially changed during the opportunity.",
  },
];

export const trainingEvidenceStatusKey = (fieldKey: string) =>
  fieldKey + "_evidence_status";

export const readTrainingEvidenceStatus = (
  rep: Record<string, string>,
  fieldKey: string,
): TrainingEvidenceStatus => {
  const raw = String(rep?.[trainingEvidenceStatusKey(fieldKey)] || "observed").trim();
  if (raw === "not_observed" || raw === "confounded") return raw;
  return "observed";
};

export const readTrainingInterventionEvent = (
  rep: Record<string, string>,
): TrainingInterventionEvent => {
  const raw = String(rep?.[TRAINING_INTERVENTION_FIELD] || "none").trim() as TrainingInterventionEvent;
  return TRAINING_INTERVENTION_OPTIONS.some((option) => option.id === raw)
    ? raw
    : "none";
};

const startsWithAny = (dimensionId: TrainingDimensionId, prefixes: string[]) =>
  prefixes.some((prefix) => dimensionId.startsWith(prefix));

export function interventionConfoundsTrainingDimension({
  phase,
  dimensionId,
  interventionEvent,
}: {
  phase: TopicPhase;
  dimensionId: TrainingDimensionId;
  interventionEvent: TrainingInterventionEvent;
}): boolean {
  if (interventionEvent === "none" || interventionEvent === "neutral_clarification") {
    return false;
  }

  if (interventionEvent === "full_rescue_or_teaching") {
    return true;
  }

  if (interventionEvent === "timer_changed") {
    return phase === "Time Pressure Stability" || dimensionId.startsWith("time.");
  }

  if (interventionEvent === "first_step_confirmation") {
    return (
      dimensionId === "clarity.method" ||
      dimensionId === "clarity.immediate_apply" ||
      dimensionId === "execution.start" ||
      dimensionId === "execution.repeatability" ||
      dimensionId === "execution.independence" ||
      dimensionId === "difficulty.first_step_control" ||
      dimensionId === "time.start"
    );
  }

  if (interventionEvent === "method_or_step_prompt") {
    if (phase === "Clarity") {
      return startsWithAny(dimensionId, ["clarity.method", "clarity.reason", "clarity.immediate_apply"]);
    }
    if (phase === "Structured Execution") {
      return startsWithAny(dimensionId, [
        "execution.start",
        "execution.step_discipline",
        "execution.repeatability",
        "execution.independence",
      ]);
    }
    if (phase === "Controlled Discomfort") {
      return startsWithAny(dimensionId, [
        "difficulty.first_step_control",
        "difficulty.tolerance",
        "difficulty.rescue_dependence",
      ]);
    }
    return startsWithAny(dimensionId, [
      "time.start",
      "time.structure",
      "time.pace",
      "time.completion_integrity",
    ]);
  }

  return false;
}

export function resolveTrainingEvidenceEligibility({
  phase,
  dimensionId,
  explicitStatus,
  interventionEvent,
}: {
  phase: TopicPhase;
  dimensionId: TrainingDimensionId;
  explicitStatus: TrainingEvidenceStatus;
  interventionEvent: TrainingInterventionEvent;
}): {
  status: TrainingEvidenceStatus;
  reason: string | null;
} {
  if (explicitStatus === "not_observed") {
    return {
      status: "not_observed",
      reason: "The Specialist recorded that this behavior was not meaningfully observable in the opportunity.",
    };
  }

  if (explicitStatus === "confounded") {
    return {
      status: "confounded",
      reason: "The Specialist explicitly recorded that this observation cannot be interpreted cleanly.",
    };
  }

  if (
    interventionConfoundsTrainingDimension({
      phase,
      dimensionId,
      interventionEvent,
    })
  ) {
    return {
      status: "confounded",
      reason: "The recorded intervention (" + interventionEvent + ") supplied or materially changed this dimension.",
    };
  }

  return { status: "observed", reason: null };
}
