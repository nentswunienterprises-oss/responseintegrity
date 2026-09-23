import type { TopicPhase, TopicStability } from "./topicConditioningEngine";

export const TPS_TIMER_BASELINE_INCOMPLETE = "TPS_TIMER_BASELINE_INCOMPLETE" as const;

export type TpsTrainingReadinessDecision =
  | {
      action: "allow";
      issueCode: null;
      shouldFreezeTrainingContract: boolean;
      requiresTargetedRediagnosis: false;
      targetedRediagnosisStartPhase: null;
    }
  | {
      action: "hold_structured_execution";
      issueCode: typeof TPS_TIMER_BASELINE_INCOMPLETE;
      shouldFreezeTrainingContract: false;
      requiresTargetedRediagnosis: false;
      targetedRediagnosisStartPhase: null;
      resultingPhase: "Structured Execution";
      resultingStability: "High Maintenance";
      reason: string;
    }
  | {
      action: "targeted_rediagnosis";
      issueCode: typeof TPS_TIMER_BASELINE_INCOMPLETE;
      shouldFreezeTrainingContract: false;
      requiresTargetedRediagnosis: true;
      targetedRediagnosisStartPhase: "Structured Execution";
      resultingPhase: TopicPhase;
      resultingStability: TopicStability;
      reason: string;
    };

export const resolveTpsTrainingReadiness = ({
  observedPhase,
  previousStability,
  proposedPhase,
  proposedStability,
  transitionReason,
  hasTimerContract,
  canFreezeTrainingBaseline,
}: {
  observedPhase: TopicPhase;
  previousStability: TopicStability;
  proposedPhase: TopicPhase;
  proposedStability: TopicStability;
  transitionReason: string;
  hasTimerContract: boolean;
  canFreezeTrainingBaseline: boolean;
}): TpsTrainingReadinessDecision => {
  const progressingFromStructuredExecution =
    observedPhase === "Structured Execution" &&
    proposedPhase === "Controlled Discomfort" &&
    transitionReason === "phase progress";

  if (progressingFromStructuredExecution) {
    if (canFreezeTrainingBaseline) {
      return {
        action: "allow",
        issueCode: null,
        shouldFreezeTrainingContract: true,
        requiresTargetedRediagnosis: false,
        targetedRediagnosisStartPhase: null,
      };
    }

    return {
      action: "hold_structured_execution",
      issueCode: TPS_TIMER_BASELINE_INCOMPLETE,
      shouldFreezeTrainingContract: false,
      requiresTargetedRediagnosis: false,
      targetedRediagnosisStartPhase: null,
      resultingPhase: "Structured Execution",
      resultingStability: "High Maintenance",
      reason:
        "Structured Execution evidence is strong enough to approach progression, but the current SE epoch does not yet contain a complete clean Independent Execution timing set. Keep the topic in Structured Execution until a legitimate clean set exists; do not create side calibration reps.",
    };
  }

  const progressingIntoTps =
    observedPhase === "Controlled Discomfort" &&
    proposedPhase === "Time Pressure Stability" &&
    transitionReason === "phase progress";

  if (progressingIntoTps && !hasTimerContract) {
    return {
      action: "targeted_rediagnosis",
      issueCode: TPS_TIMER_BASELINE_INCOMPLETE,
      shouldFreezeTrainingContract: false,
      requiresTargetedRediagnosis: true,
      targetedRediagnosisStartPhase: "Structured Execution",
      resultingPhase: "Controlled Discomfort",
      resultingStability: "High Maintenance",
      reason:
        "Controlled Discomfort is ready to progress, but TPS cannot begin without individualized timing authority. Preserve the current phase truth and route targeted evidence-native re-diagnosis to establish the missing no-pressure baseline.",
    };
  }

  if (observedPhase === "Time Pressure Stability" && !hasTimerContract) {
    return {
      action: "targeted_rediagnosis",
      issueCode: TPS_TIMER_BASELINE_INCOMPLETE,
      shouldFreezeTrainingContract: false,
      requiresTargetedRediagnosis: true,
      targetedRediagnosisStartPhase: "Structured Execution",
      resultingPhase: "Time Pressure Stability",
      resultingStability: previousStability,
      reason:
        "This topic is already in Time Pressure Stability but has no valid individualized Timer Contract. Do not accept ordinary TPS Training evidence; preserve the current state and route targeted evidence-native re-diagnosis.",
    };
  }

  return {
    action: "allow",
    issueCode: null,
    shouldFreezeTrainingContract: false,
    requiresTargetedRediagnosis: false,
    targetedRediagnosisStartPhase: null,
  };
};
