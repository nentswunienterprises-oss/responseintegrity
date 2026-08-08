import { normalizeObservationLevelValue } from "./observationScoring";

export const PHASES = [
  "Clarity",
  "Structured Execution",
  "Controlled Discomfort",
  "Time Pressure Stability",
] as const;

export type TopicPhase = (typeof PHASES)[number];
export type TopicStability = "Low" | "Medium" | "High" | "High Maintenance";

export type NextActionData = {
  primaryAction: string;
  rules: string[];
  nextActions?: string[];
  advanceTo?: TopicPhase;
};

export const STABILITY_THRESHOLDS = {
  low: { remainMax: 49, mediumMax: 79, highMin: 80 },
  medium: { regressMax: 44, remainMax: 79, highMin: 80 },
  high: { regressMax: 49, remainMax: 84, highMaintenanceMin: 85 },
  highMaintenance: { regressMax: 59, remainMax: 84, phaseProgressMin: 85 },
} as const;

export type TransitionResult = {
  next_phase: TopicPhase;
  next_stability: TopicStability;
  transition_reason: string;
};

export type TransitionReason =
  | "remain"
  | "stability advance"
  | "stability regress"
  | "phase progress";

export const FINAL_PHASE: TopicPhase = "Time Pressure Stability";

/**
 * Locked Transition Engine - Response Integrity Drift Correction Spec
 * Inputs: previous_phase, previous_stability, drill_total_out_of_100
 * Outputs: next_phase, next_stability, transition_reason
 */
export const computeTransition = (
  previous_phase: TopicPhase,
  previous_stability: TopicStability,
  drill_total_out_of_100: number
): TransitionResult => {
  const score = Math.max(0, Math.min(100, drill_total_out_of_100));

  let next_phase = previous_phase;
  let next_stability = previous_stability;
  let transition_reason = "remain";

  // Transition rules from spec
  if (previous_stability === "Low") {
    if (score <= 49) {
      next_stability = "Low";
      transition_reason = "remain";
    } else if (score <= 79) {
      next_stability = "Medium";
      transition_reason = "stability advance";
    } else {
      next_stability = "High";
      transition_reason = "stability advance";
    }
  } else if (previous_stability === "Medium") {
    if (score <= 44) {
      next_stability = "Low";
      transition_reason = "stability regress";
    } else if (score <= 79) {
      next_stability = "Medium";
      transition_reason = "remain";
    } else {
      next_stability = "High";
      transition_reason = "stability advance";
    }
  } else if (previous_stability === "High") {
    if (score <= 49) {
      next_stability = "Medium";
      transition_reason = "stability regress";
    } else if (score <= 84) {
      next_stability = "High";
      transition_reason = "remain";
    } else {
      next_stability = "High Maintenance";
      transition_reason = "stability advance";
    }
  } else if (previous_stability === "High Maintenance") {
    if (score <= 59) {
      next_stability = "High";
      transition_reason = "stability regress";
    } else if (score <= 84) {
      next_stability = "High Maintenance";
      transition_reason = "remain";
    } else {
      // Final-phase topics do not reset to Low on a strong maintenance check.
      // They stay in maintenance because there is no further in-sequence phase to enter.
      if (previous_phase === FINAL_PHASE) {
        next_phase = previous_phase;
        next_stability = "High Maintenance";
        transition_reason = "remain";
      } else {
        next_phase = getNextPhase(previous_phase);
        next_stability = "Low";
        transition_reason = "phase progress";
      }
    }
  }

  return {
    next_phase,
    next_stability,
    transition_reason,
  };
};

/**
 * Get the next phase in sequence, or return current phase if at end
 */
const getNextPhase = (currentPhase: TopicPhase): TopicPhase => {
  const phaseIndex = PHASES.indexOf(currentPhase);
  if (phaseIndex < PHASES.length - 1) {
    return PHASES[phaseIndex + 1];
  }
  return currentPhase; // Stay at final phase
};

/**
 * Observation to Language Mapping - Response Integrity Drift Correction Spec
 * Maps raw observation signals to deterministic behavior language
 */
export type ObservationSignal = {
  key: string;
  value: string;
};

type ObservationBehaviorRule = {
  label: string;
  aliases: string[];
  weak?: string;
  clear?: string;
};

const OBSERVATION_BEHAVIOR_RULES: ObservationBehaviorRule[] = [
  {
    label: "clarity",
    aliases: ["vocabulary", "reason", "immediate_apply", "immediateapply"],
    weak: "clarity breakdown",
    clear: "clearer concept recall",
  },
  {
    label: "method",
    aliases: ["method", "step", "execution", "repeatability"],
    weak: "inconsistent step execution",
    clear: "more reliable step execution",
  },
  {
    label: "independence",
    aliases: ["independence", "dependence", "support", "rescue"],
    weak: "early dependence",
    clear: "more independent execution",
  },
  {
    label: "start",
    aliases: ["start", "initial"],
    weak: "delayed starts",
    clear: "earlier independent starts",
  },
  {
    label: "difficulty",
    aliases: ["boss", "discomfort", "pressure", "first_step"],
    weak: "hesitation under pressure",
    clear: "better control under difficulty",
  },
  {
    label: "structure",
    aliases: ["structure", "completion", "integrity"],
    weak: "structure breakdown",
    clear: "stronger structure retention",
  },
  {
    label: "pace",
    aliases: ["pace", "time", "speed"],
    weak: "pace loss",
    clear: "more controlled pace",
  },
];

/**
 * Map observation signals to behavior language
 * INPUT: Array of observation signals from drill
 * OUTPUT: Mapped behavior language strings
 */
export const mapObservationsToBehavior = (observations: ObservationSignal[]): string[] => {
  const behaviors = new Set<string>();

  observations.forEach((obs) => {
    const key = String(obs.key || "").toLowerCase();
    const value = String(obs.value || "").toLowerCase();
    const level = normalizeObservationLevelValue(value);

    OBSERVATION_BEHAVIOR_RULES.forEach((rule) => {
      const matches = rule.aliases.some((alias) => key.includes(alias));
      if (!matches) return;

      if (level === "weak" && rule.weak) {
        behaviors.add(rule.weak);
      } else if (level === "clear" && rule.clear) {
        behaviors.add(rule.clear);
      }
    });
  });

  return behaviors.size > 0 ? Array.from(behaviors) : ["no mapped observation signal detected"];
};

export type ParentDashboardCopy = {
  status: string;
  meaning: string;
  focus: string;
};

/**
 * Exact phase-specific parent dashboard copy.
 * This matches the parent dashboard state matrix rather than the older generic translator.
 */
export const PARENT_DASHBOARD_COPY_BY_STATE: Record<TopicPhase, Record<TopicStability, ParentDashboardCopy>> = {
  Clarity: {
    Low: {
      status: "Your child is still building a clear understanding of this topic.",
      meaning: "They are not yet fully comfortable with the terms, steps, or logic involved.",
      focus: "We are rebuilding the foundation so they can clearly recognize and understand the problem.",
    },
    Medium: {
      status: "Your child is beginning to understand this topic more clearly.",
      meaning: "They can follow explanations, but still need reinforcement to apply it independently.",
      focus: "We are increasing practice and helping them apply the method more consistently.",
    },
    High: {
      status: "Your child now understands this topic clearly.",
      meaning: "They can recognize the problem and explain the steps with confidence.",
      focus: "We are moving into independent problem-solving to build execution.",
    },
    "High Maintenance": {
      status: "Your child has sustained strong clarity in this topic.",
      meaning: "They have held high performance consistently and are ready for progression decisions.",
      focus: "We are now transitioning into Structured Execution training.",
    },
  },
  "Structured Execution": {
    Low: {
      status: "Your child is learning to apply the steps correctly.",
      meaning: "They understand the topic but struggle to follow the method consistently on their own.",
      focus: "We are reinforcing a clear step-by-step approach so they can start and complete problems reliably.",
    },
    Medium: {
      status: "Your child is becoming more consistent in solving problems.",
      meaning: "They can follow the method in many cases, but still show occasional inconsistency.",
      focus: "We are increasing independent practice to strengthen consistency.",
    },
    High: {
      status: "Your child can now solve problems consistently in this topic.",
      meaning: "They are able to follow the correct steps independently with minimal support.",
      focus: "We are verifying sustained high execution through repeated, constrained practice before introducing more challenging questions to strengthen their response under difficulty.",
    },
    "High Maintenance": {
      status: "Your child has sustained strong execution consistency in this topic.",
      meaning: "They have held high execution quality across sessions and are ready for progression decisions.",
      focus: "We are now transitioning into Controlled Discomfort training.",
    },
  },
  "Controlled Discomfort": {
    Low: {
      status: "Your child is starting to face more challenging problems in this topic.",
      meaning: "They can solve basic problems, but struggle when questions become less familiar.",
      focus: "We are helping them stay calm and start correctly even when the problem feels difficult.",
    },
    Medium: {
      status: "Your child is improving in handling difficult questions.",
      meaning: "They can work through unfamiliar problems, but still show hesitation at times.",
      focus: "We are increasing exposure to harder questions to build confidence under difficulty.",
    },
    High: {
      status: "Your child is handling difficult problems well.",
      meaning: "They are able to stay structured and solve unfamiliar questions with stability.",
      focus: "We are preparing them to perform under time pressure.",
    },
    "High Maintenance": {
      status: "Your child has sustained strong performance under challenge in this topic.",
      meaning: "They have held high stability in difficult work and are ready for progression decisions.",
      focus: "We are now transitioning into Time Pressure Stability training.",
    },
  },
  "Time Pressure Stability": {
    Low: {
      status: "Your child is learning to stay structured under time pressure.",
      meaning: "They can solve problems, but may lose structure when working against the clock.",
      focus: "We are helping them maintain their method while working within time limits.",
    },
    Medium: {
      status: "Your child is becoming more stable under time pressure.",
      meaning: "They are improving their ability to complete problems within time while staying structured.",
      focus: "We are increasing timed practice to strengthen consistency.",
    },
    High: {
      status: "Your child is performing consistently under time pressure.",
      meaning: "They can solve problems accurately and maintain structure even under time constraints.",
      focus: "We are maintaining performance and preparing them to transfer this skill to new topics.",
    },
    "High Maintenance": {
      status: "Your child has sustained top stability under time pressure.",
      meaning: "They consistently maintain structure and accuracy under timed conditions.",
      focus: "We are maintaining performance and expanding transfer across related topics.",
    },
  },
};

export const getParentDashboardCopyByState = (
  phase: TopicPhase,
  stability: TopicStability
): ParentDashboardCopy => PARENT_DASHBOARD_COPY_BY_STATE[phase][stability];

/**
 * Translate transition reason for parent UI
 * Never expose internal transition language
 */
export const translateTransitionForParent = (transitionReason: string): string => {
  switch (transitionReason) {
    case "stability advance":
      return "showing improved consistency";
    case "stability regress":
      return "working through some challenges";
    case "phase progress":
      return "ready to advance to the next level";
    case "remain":
      return "continuing to build at this level";
    default:
      return "making steady progress";
  }
};

export const NEXT_ACTION_ENGINE: Record<TopicPhase, Record<TopicStability, NextActionData>> = {
  Clarity: {
    Low: {
      primaryAction: "Run Clarity drill",
      rules: ["No Boss Battles", "No time pressure", "No skipping layers"],
      nextActions: [
        "Reinforce Vocabulary, Method & Reason (3 Layer Lens)",
        "Reinforce Method (step sequence)",
        "Reinforce Reason (why it works)",
        "Re-model same concept",
        "Immediate Apply after each model",
      ],
    },
    Medium: {
      primaryAction: "Run Clarity drill",
      rules: ["No Boss Battles as primary", "No time pressure", "Reduce explanation, increase execution"],
      nextActions: [
        "Continue 3-Layer Lens",
        "Run Clarity drill",
        "Start light execution checks (can they repeat without help?)",
      ],
    },
    High: {
      primaryAction: "Run Clarity High Maintenance drill",
      rules: ["Do NOT phase advance yet", "Prove repeatable stability first"],
      nextActions: [
        "Run High Maintenance check in Clarity",
        "Reduce modeling",
        "Increase independent attempts",
        "Validate consistency across full set volume",
      ],
    },
    "High Maintenance": {
      primaryAction: "Run Structured Execution drill",
      rules: ["Do NOT stay in teaching mode", "Move forward"],
      nextActions: [
        "Transition to Structured Execution",
        "Reduce modeling",
        "Increase independent attempts",
      ],
      advanceTo: "Structured Execution",
    },
  },
  "Structured Execution": {
    Low: {
      primaryAction: "Run Structured Execution drill",
      rules: ["No time pressure", "Boss Battles only if student can start", "No over-explaining"],
      nextActions: [
        "Run strict Model -> Apply -> Guide loops",
        "Enforce step-by-step execution",
        "Correct every skipped step",
        "Require student to start every problem",
      ],
    },
    Medium: {
      primaryAction: "Run Structured Execution drill",
      rules: ["Do not rush to time pressure", "Still reinforce structure every time"],
      nextActions: [
        "Run Structured Execution drill",
        "Reduce modeling",
        "Strengthen consistency across multiple problems",
        "Introduce light Boss Battles",
      ],
    },
    High: {
      primaryAction: "Run Structured Execution High Maintenance drill",
      rules: ["Do NOT phase advance yet", "Prove repeatable stability first"],
      nextActions: [
        "Run High Maintenance check in Structured Execution",
        "Run Structured Execution drill",
        "Confirm repeatable execution stability",
      ],
    },
    "High Maintenance": {
      primaryAction: "Run Controlled Discomfort drill",
      rules: ["Do NOT keep repeating basic problems", "Move forward"],
      nextActions: [
        "Transition to Controlled Discomfort",
        "Introduce Boss Battles consistently",
        "Focus on response under uncertainty",
      ],
      advanceTo: "Controlled Discomfort",
    },
  },
  "Controlled Discomfort": {
    Low: {
      primaryAction: "Run Controlled Discomfort drill",
      rules: ["No rescuing", "No full explanations mid-struggle", "No time pressure yet"],
      nextActions: [
        "Introduce Boss Battles carefully",
        "Enforce 10-15 second pause",
        "Guide only to first step",
        "Reinforce start despite uncertainty",
      ],
    },
    Medium: {
      primaryAction: "Run Controlled Discomfort drill",
      rules: ["Do not remove difficulty", "Do not over-guide"],
      nextActions: [
        "Run Controlled Discomfort drill",
        "Reduce hesitation time",
        "Push independent starts",
        "Reinforce calm execution",
      ],
    },
    High: {
      primaryAction: "Run Controlled Discomfort High Maintenance drill",
      rules: ["Do NOT phase advance yet", "Prove repeatable stability first"],
      nextActions: [
        "Run High Maintenance check in Controlled Discomfort",
        "Increase difficulty consistency",
        "Confirm composed starts under uncertainty",
      ],
    },
    "High Maintenance": {
      primaryAction: "Run Time Pressure Stability drill",
      rules: ["Do NOT stay in comfort zone", "Move forward"],
      nextActions: [
        "Transition to Time Pressure Stability",
        "Introduce timed Boss Battles",
        "Maintain structure under constraint",
      ],
      advanceTo: "Time Pressure Stability",
    },
  },
  "Time Pressure Stability": {
    Low: {
      primaryAction: "Run Time Pressure Stability drill",
      rules: ["Do not push speed", "Do not increase time pressure aggressively"],
      nextActions: [
        "Run Time Pressure Stability drill",
        "Reinforce process over speed",
        "Debrief after every attempt",
        "Re-anchor structure",
      ],
    },
    Medium: {
      primaryAction: "Run Time Pressure Stability drill",
      rules: ["Do not sacrifice structure for speed", "Maintain method discipline"],
      nextActions: [
        "Run Time Pressure Stability drill",
        "Reduce breakdown frequency",
        "Strengthen full execution within time",
      ],
    },
    High: {
      primaryAction: "Run Time Pressure Stability High Maintenance drill",
      rules: ["Do NOT declare transfer yet", "Confirm sustained stability first"],
      nextActions: [
        "Run High Maintenance check under time pressure",
        "Confirm structure under timed variation",
        "Sustain consistency across multiple sets",
      ],
    },
    "High Maintenance": {
      primaryAction: "Run Time Pressure Stability maintenance drill",
      rules: ["Do not over-train same pattern", "Begin cross-topic conditioning"],
      nextActions: [
        "Run Time Pressure Stability maintenance drill",
        "Introduce new variations of topic",
        "Prepare for transfer to new topics",
      ],
    },
  },
};

export const normalizePhase = (value: unknown): TopicPhase => {
  return tryParsePhase(value) || "Clarity";
};

export const tryParsePhase = (value: unknown): TopicPhase | null => {
  const v = String(value || "").toLowerCase();
  if (v.includes("clarity")) return "Clarity";
  if (v.includes("structured")) return "Structured Execution";
  if (v.includes("discomfort")) return "Controlled Discomfort";
  if (v.includes("time") || v.includes("pressure")) return "Time Pressure Stability";
  return null;
};

export const normalizeStability = (value: unknown): TopicStability => {
  const v = String(value || "").toLowerCase();
  if (v.includes("high maintenance")) return "High Maintenance";
  if (v.includes("high")) return "High";
  if (v.includes("medium")) return "Medium";
  return "Low";
};

export const stabilityToScore = (stability: TopicStability) =>
  stability === "Low" ? 1 : stability === "Medium" ? 2 : stability === "High" ? 3 : 4;
