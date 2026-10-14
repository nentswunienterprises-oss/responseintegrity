import { FINAL_PHASE, PHASES, type TopicPhase, type TopicStability } from "./topicConditioningEngine";
import {
  type TrainingObservedStability,
  type TrainingEvidenceTransitionReason,
} from "./trainingEvidenceContract";

export type CapabilityStability = "Low" | "Medium" | "High";
export type ProgressionAuthority = "building" | "exit_confirmation_eligible" | "transfer_maintenance";
export type CapabilityProgressionState = {
  phase: TopicPhase;
  stability: CapabilityStability;
  progression: ProgressionAuthority;
};

export function fromLegacyTopicState(
  phase: TopicPhase,
  stability: TopicStability,
): CapabilityProgressionState {
  return {
    phase,
    stability: stability === "High Maintenance" ? "High" : stability,
    progression: stability === "High Maintenance" ? "exit_confirmation_eligible" : "building",
  };
}

export function normalizeCapabilityProgressionState(input: {
  phase: TopicPhase;
  stability: TopicStability | CapabilityStability;
  progression?: ProgressionAuthority | null;
}): CapabilityProgressionState {
  const legacy = fromLegacyTopicState(input.phase, input.stability);
  if (input.stability === "High Maintenance" && input.progression === "building") {
    throw new Error("Legacy checkpoint cannot lose its earned confirmation eligibility");
  }
  const progression = input.progression ?? legacy.progression;
  if (progression !== "building" && legacy.stability !== "High") {
    throw new Error("Progression authority requires High stability");
  }
  if (progression === "transfer_maintenance" && input.phase !== FINAL_PHASE) {
    throw new Error("Transfer maintenance is available only in Time Pressure Stability");
  }
  return { phase: input.phase, stability: legacy.stability, progression };
}

/** Evidence-native progression, preserving the three distinct qualifying sessions. */
export function transitionCapabilityProgression(input: {
  previous: CapabilityProgressionState;
  observedStability: TrainingObservedStability;
  repeatabilityQualified: boolean;
  exitQualified: boolean;
}): {
  next: CapabilityProgressionState;
  transitionReason: TrainingEvidenceTransitionReason;
} {
  const { previous, observedStability, repeatabilityQualified, exitQualified } = input;
  const { phase, stability, progression } = normalizeCapabilityProgressionState(previous);
  const withState = (next: CapabilityProgressionState, transitionReason: TrainingEvidenceTransitionReason) =>
    ({ next, transitionReason });

  if (stability === "Low") {
    if (observedStability === "Low") return withState({ phase, stability: "Low", progression: "building" }, "remain");
    return withState({ phase, stability: observedStability, progression: "building" }, "stability advance");
  }
  if (stability === "Medium") {
    if (observedStability === "Medium") return withState({ phase, stability: "Medium", progression: "building" }, "remain");
    return withState({ phase, stability: observedStability, progression: "building" },
      observedStability === "Low" ? "stability regress" : "stability advance");
  }
  if (observedStability !== "High") {
    return withState({
      phase,
      stability: progression === "building" ? "Medium" : "High",
      progression: "building",
    }, "stability regress");
  }
  if (progression === "building") {
    return repeatabilityQualified
      ? withState({ phase, stability: "High", progression: "exit_confirmation_eligible" }, "high maintenance entry")
      : withState({ phase, stability: "High", progression: "building" }, "remain");
  }
  if (progression === "transfer_maintenance") {
    return withState(previous, "final maintenance hold");
  }
  if (!exitQualified) {
    return withState(previous, "remain");
  }
  if (phase === FINAL_PHASE) {
    return withState({ phase, stability: "High", progression: "transfer_maintenance" }, "final maintenance hold");
  }
  const index = PHASES.indexOf(phase);
  return withState({ phase: PHASES[index + 1], stability: "Low", progression: "building" }, "phase progress");
}

/** Interop only: historical API consumers may still read a compound stability. */
export function toLegacyTopicStability(state: CapabilityProgressionState): TopicStability {
  return state.stability === "High" && state.progression !== "building"
    ? "High Maintenance"
    : state.stability;
}
