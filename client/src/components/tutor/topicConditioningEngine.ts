// Returns nextAction and transitionStatus for a topic's state
export function interpretTopicState(
  phase: PhaseLabel,
  stability: StabilityLabel,
  trend?: TopicTrend
): { nextAction: string; transitionStatus: string } {
  const nextAction = nextActionFor(phase, stability);
  let transitionStatus = "";
  if (stability === "High Maintenance") {
    const idx = phaseIndex(phase);
    if (idx === PHASES.length - 1) {
      transitionStatus = "Maintain and transfer to new topics";
    } else {
      transitionStatus = `Advance to ${PHASES[idx + 1]}`;
    }
  } else if (stability === "High") {
    transitionStatus = "Run High Maintenance check before advancing";
  } else if (stability === "Low") {
    if (phaseIndex(phase) === 0) {
      transitionStatus = "Hold at Clarity - reinforce foundations";
    } else {
      transitionStatus = `Reinforce ${PHASES[phaseIndex(phase) - 1]} - stability too low to advance`;
    }
  } else {
    transitionStatus = "Hold current phase - build stability before advancing";
  }
  return { nextAction, transitionStatus };
}
export const PHASES = [
  "Clarity",
  "Structured Execution",
  "Controlled Discomfort",
  "Time Pressure Stability",
] as const;

export type PhaseLabel = (typeof PHASES)[number];
export type StabilityLabel = "Low" | "Medium" | "High" | "High Maintenance";
export type TopicTrend = "Improving" | "Holding" | "Regressing" | "Stable";

export type NextActionData = {
  primaryAction: string;
  nextActions: string[];
  rules: string[];
  advanceTo?: PhaseLabel;
};

export const NEXT_ACTION_ENGINE: Record<PhaseLabel, Record<StabilityLabel, NextActionData>> = {
  Clarity: {
    Low: {
      primaryAction: "Run Clarity drill",
      nextActions: [
        "Reinforce Vocabulary, Method & Reason (3 Layer Lens)",
        "Reinforce Method (step sequence)",
        "Reinforce Reason (why it works)",
        "Re-model same concept",
        "Immediate Apply after each model",
      ],
      rules: ["No Boss Battles", "No time pressure", "No skipping layers"],
    },
    Medium: {
      primaryAction: "Run Clarity drill",
      nextActions: [
        "Continue 3-Layer Lens",
        "Run Clarity drill",
        "Start light execution checks (can they repeat without help?)",
      ],
      rules: ["No Boss Battles as primary", "No time pressure", "Reduce explanation, increase execution"],
    },
    High: {
      primaryAction: "Run Clarity High Maintenance drill",
      nextActions: [
        "Run High Maintenance check in Clarity",
        "Reduce modeling",
        "Increase independent attempts",
        "Validate consistency across full set volume",
      ],
      rules: ["Do NOT phase advance yet", "Prove repeatable stability first"],
    },
    "High Maintenance": {
      primaryAction: "Run Structured Execution drill",
      nextActions: [
        "Transition to Structured Execution",
        "Reduce modeling",
        "Increase independent attempts",
      ],
      rules: ["Do NOT stay in teaching mode", "Move forward"],
      advanceTo: "Structured Execution",
    },
  },
  "Structured Execution": {
    Low: {
      primaryAction: "Run Structured Execution drill",
      nextActions: [
        "Run independent execution reps with step-order correction",
        "Enforce step-by-step execution",
        "Correct every skipped step",
        "Force student to start every problem",
      ],
      rules: ["No time pressure", "No Boss Battles until Controlled Discomfort", "No over-explaining"],
    },
    Medium: {
      primaryAction: "Run Structured Execution drill",
      nextActions: [
        "Run Structured Execution drill",
        "Reduce modeling",
        "Strengthen consistency across multiple problems",
        "Prepare Controlled Discomfort readiness check",
      ],
      rules: ["Do not rush to time pressure", "Do not introduce Boss Battles before phase advance", "Still reinforce structure every time"],
    },
    High: {
      primaryAction: "Run Structured Execution High Maintenance drill",
      nextActions: [
        "Run High Maintenance check in Structured Execution",
        "Run Structured Execution drill",
        "Confirm repeatable execution stability",
      ],
      rules: ["Do NOT phase advance yet", "Prove repeatable stability first"],
    },
    "High Maintenance": {
      primaryAction: "Run Controlled Discomfort drill",
      nextActions: [
        "Transition to Controlled Discomfort",
        "Introduce Boss Battles consistently",
        "Focus on response under uncertainty",
      ],
      rules: ["Do NOT keep repeating basic problems", "Move forward"],
      advanceTo: "Controlled Discomfort",
    },
  },
  "Controlled Discomfort": {
    Low: {
      primaryAction: "Run Controlled Discomfort drill",
      nextActions: [
        "Introduce Boss Battles carefully",
        "Enforce 10-15 second pause",
        "Guide only to first step",
        "Reinforce \"start despite uncertainty\"",
      ],
      rules: ["No rescuing", "No full explanations mid-struggle", "No time pressure yet"],
    },
    Medium: {
      primaryAction: "Run Controlled Discomfort drill",
      nextActions: [
        "Run Controlled Discomfort drill",
        "Reduce hesitation time",
        "Push independent starts",
        "Reinforce calm execution",
      ],
      rules: ["Do not remove difficulty", "Do not over-guide"],
    },
    High: {
      primaryAction: "Run Controlled Discomfort High Maintenance drill",
      nextActions: [
        "Run High Maintenance check in Controlled Discomfort",
        "Increase difficulty consistency",
        "Confirm composed starts under uncertainty",
      ],
      rules: ["Do NOT phase advance yet", "Prove repeatable stability first"],
    },
    "High Maintenance": {
      primaryAction: "Run Time Pressure Stability drill",
      nextActions: [
        "Transition to Time Pressure Stability",
        "Introduce timed Boss Battles",
        "Maintain structure under constraint",
      ],
      rules: ["Do NOT stay in comfort zone", "Move forward"],
      advanceTo: "Time Pressure Stability",
    },
  },
  "Time Pressure Stability": {
    Low: {
      primaryAction: "Run Time Pressure Stability drill",
      nextActions: [
        "Run Time Pressure Stability drill",
        "Reinforce \"process over speed\"",
        "Debrief after every attempt",
        "Re-anchor structure",
      ],
      rules: ["Do not push speed", "Do not increase time pressure aggressively"],
    },
    Medium: {
      primaryAction: "Run Time Pressure Stability drill",
      nextActions: [
        "Run Time Pressure Stability drill",
        "Reduce breakdown frequency",
        "Strengthen full execution within time",
      ],
      rules: ["Do not sacrifice structure for speed", "Maintain method discipline"],
    },
    High: {
      primaryAction: "Run Time Pressure Stability High Maintenance drill",
      nextActions: [
        "Run High Maintenance check under time pressure",
        "Confirm structure under timed variation",
        "Sustain consistency across multiple sets",
      ],
      rules: ["Do NOT declare transfer yet", "Confirm sustained stability first"],
    },
    "High Maintenance": {
      primaryAction: "Run Time Pressure Stability maintenance drill",
      nextActions: [
        "Run Time Pressure Stability maintenance drill",
        "Introduce new variations of topic",
        "Prepare for transfer to new topics",
      ],
      rules: ["Do not over-train same pattern", "Begin cross-topic conditioning"],
    },
  },
};

export function phaseIndex(phase: PhaseLabel): number {
  return PHASES.indexOf(phase);
}

export function getNextActionData(phase: PhaseLabel, stability: StabilityLabel): NextActionData {
  return NEXT_ACTION_ENGINE[phase][stability];
}

export function nextActionFor(phase: PhaseLabel, stability: StabilityLabel): string {
  return NEXT_ACTION_ENGINE[phase][stability].primaryAction;
}

function trendByStability(stability: StabilityLabel): TopicTrend {
  if (stability === "High" || stability === "High Maintenance") return "Stable";
  if (stability === "Medium") return "Improving";
  return "Holding";
}

export function trendFromHistory(
  history: StabilityLabel[],
  phaseHistory?: PhaseLabel[],
): TopicTrend {
  if (history.length < 2) return trendByStability(history[history.length - 1] || "Low");

  const lastIndex = history.length - 1;
  const latestPhase = phaseHistory?.[lastIndex];
  const previousPhase = phaseHistory?.[lastIndex - 1];

  // Do not mark cross-phase entry as regression on first observation in a new phase.
  if (latestPhase && previousPhase && latestPhase !== previousPhase) {
    return trendByStability(history[lastIndex] || "Low");
  }

  const score = (s: StabilityLabel) =>
    s === "Low" ? 1 : s === "Medium" ? 2 : s === "High" ? 3 : 4;
  const prev = score(history[lastIndex - 1]);
  const curr = score(history[lastIndex]);
  if (curr > prev) return "Improving";
  if (curr < prev) return "Regressing";
  return curr >= 3 ? "Stable" : "Holding";
}

export function topicPriorityScore(row: Pick<{ stability: StabilityLabel; trend: TopicTrend }, "stability" | "trend">): number {
  const stabilityScore =
    row.stability === "Low"
      ? 3
      : row.stability === "Medium"
      ? 2
      : row.stability === "High"
      ? 1
      : 0;
  const trendScore = row.trend === "Regressing" ? 3 : row.trend === "Holding" ? 2 : row.trend === "Improving" ? 1 : 0;
  return stabilityScore + trendScore;
}

export function getPriorityReason(stability: StabilityLabel, trend: TopicTrend): string {
  if (trend === "Regressing") return `${stability} stability and regressing trend`;
  if (stability === "Low") return "Low stability needs reinforcement before progression";
  if (stability === "Medium") return "Medium stability still needs consistency";
  if (stability === "High Maintenance") return "High Maintenance checkpoint reached; progression ready when performance holds";
  return "High stability with stable trend";
}

export function getRecommendationConfidence(logCount: number): "Low" | "Medium" | "High" {
  if (logCount >= 5) return "High";
  if (logCount >= 2) return "Medium";
  return "Low";
}

export function nextMoveRecommendation(phase: PhaseLabel, stability: StabilityLabel): string {
  const idx = phaseIndex(phase);
  if (stability === "High Maintenance") {
    if (idx === PHASES.length - 1) return "Maintain and transfer to new topics";
    return `Advance to ${PHASES[idx + 1]}`;
  }
  if (stability === "High") {
    return "Run High Maintenance check before advancing";
  }
  if (stability === "Low") {
    if (idx === 0) return "Hold at Clarity - reinforce foundations";
    return `Reinforce ${PHASES[idx - 1]} - stability too low to advance`;
  }
  return "Hold current phase - build stability before advancing";
}
