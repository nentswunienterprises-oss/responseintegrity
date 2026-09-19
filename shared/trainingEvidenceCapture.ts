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
        "execution.independence",
      ]);
    }
    if (phase === "Controlled Discomfort") {
      return startsWithAny(dimensionId, [
        "difficulty.first_step_control",
        "difficulty.rescue_dependence",
      ]);
    }
    return startsWithAny(dimensionId, [
      "time.start",
      "time.structure",
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
