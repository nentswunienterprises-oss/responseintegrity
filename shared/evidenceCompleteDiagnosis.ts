import { PHASES, type TopicPhase, type TopicStability } from "./topicConditioningEngine";
import {
  DIAGNOSIS_OBSERVATION_MATRIX,
  behaviorClassToDiagnosisStability,
  getDiagnosisObservationOption,
  type DiagnosisBehaviorClass,
  type DiagnosisDimensionId,
} from "./diagnosisObservationMatrix";

export type {
  DiagnosisBehaviorClass,
  DiagnosisDimensionId,
  DiagnosisObservationOption,
  DiagnosisObservationDimensionDefinition,
} from "./diagnosisObservationMatrix";

export type DiagnosisEvidenceStatus = "supported" | "unsupported" | "unresolved" | "confounded";
export type DiagnosisSupportEvent =
  | "none"
  | "neutral_clarification"
  | "first_step_confirmation"
  | "teaching";
export type DiagnosisProbeId =
  | "stack.timed_challenge"
  | "stack.challenge_no_timer"
  | "stack.normal_independent"
  | "clarity.recognition"
  | "execution.repeatability"
  | "difficulty.recovery"
  | "time.consistency";

export type DiagnosisProbeDefinition = {
  id: DiagnosisProbeId;
  label: string;
  primaryPhase: TopicPhase;
  evidenceQuestion: string;
  specialistInstruction: string;
  dimensions: DiagnosisDimensionId[];
  constraints: {
    supportLevel: "none" | "neutral_clarification_only";
    pressureLevel: "none" | "difficulty" | "timed_difficulty" | "timed";
    difficultyLevel: "recognition" | "normal" | "challenging";
    variationLevel: "same_form" | "changed_form";
  };
  maxCleanAttempts: number;
  opportunityPurposes: string[];
};

export type DiagnosisProbeObservation = {
  dimensionId: DiagnosisDimensionId;
  behaviorId: string;
};

export type DiagnosisProbeResult = {
  probeId: DiagnosisProbeId;
  observations: DiagnosisProbeObservation[];
  supportEvent?: DiagnosisSupportEvent;
};

export type DiagnosisEvidenceEvent = DiagnosisProbeObservation & {
  probeId: DiagnosisProbeId;
  supportEvent: DiagnosisSupportEvent;
  contaminated: boolean;
  behaviorClass: DiagnosisBehaviorClass;
  behaviorLabel: string;
};

export type DiagnosisDimensionState = {
  dimensionId: DiagnosisDimensionId;
  phase: TopicPhase;
  requiredSupportedObservations: number;
  supportedCount: number;
  breakdownCount: number;
  conditionalCount: number;
  nearStableCount: number;
  notObservedCount: number;
  confoundedCount: number;
  contaminatedObservationCount: number;
  status: DiagnosisEvidenceStatus;
  conflict: boolean;
  behaviorHistory: Array<{
    behaviorId: string;
    behaviorLabel: string;
    behaviorClass: DiagnosisBehaviorClass;
    contaminated: boolean;
  }>;
};

export type DiagnosisPhaseState = {
  phase: TopicPhase;
  status: DiagnosisEvidenceStatus;
  dimensions: DiagnosisDimensionState[];
  supportedDimensions: DiagnosisDimensionId[];
  unsupportedDimensions: DiagnosisDimensionId[];
  unresolvedDimensions: DiagnosisDimensionId[];
  confoundedDimensions: DiagnosisDimensionId[];
};

export type DiagnosisPlacementEvidence = {
  dimensionId: DiagnosisDimensionId;
  dimensionLabel: string;
  behaviorId: string;
  behaviorLabel: string;
  behaviorClass: DiagnosisBehaviorClass;
};

export type EvidenceCompleteDiagnosisState = {
  recommendedStartingPhase: TopicPhase | null;
  evidence: DiagnosisEvidenceEvent[];
  probeHistory: DiagnosisProbeResult[];
};

export type EvidenceCompleteDiagnosisDecision = {
  complete: boolean;
  placementPhase: TopicPhase | null;
  stability: Exclude<TopicStability, "High Maintenance"> | null;
  confidence: "insufficient" | "sufficient" | "strong";
  nextProbeId: DiagnosisProbeId | null;
  reason: string;
  phaseStates: DiagnosisPhaseState[];
  placementEvidence: DiagnosisPlacementEvidence[];
  cleanProbeCount: number;
  contaminatedProbeCount: number;
  decisionAuthority: "behavioral_evidence";
};

const IDS = Object.keys(DIAGNOSIS_OBSERVATION_MATRIX) as DiagnosisDimensionId[];
const BY_PHASE = Object.fromEntries(
  PHASES.map((phase) => [
    phase,
    IDS.filter((id) => DIAGNOSIS_OBSERVATION_MATRIX[id].phase === phase),
  ]),
) as Record<TopicPhase, DiagnosisDimensionId[]>;

const without = (ids: DiagnosisDimensionId[], excluded: DiagnosisDimensionId[]) =>
  ids.filter((id) => !excluded.includes(id));

const through = (phase: TopicPhase) =>
  PHASES.slice(0, PHASES.indexOf(phase) + 1).flatMap((p) => BY_PHASE[p]);

const probe = (
  id: DiagnosisProbeId,
  label: string,
  primaryPhase: TopicPhase,
  evidenceQuestion: string,
  specialistInstruction: string,
  dimensions: DiagnosisDimensionId[],
  pressureLevel: DiagnosisProbeDefinition["constraints"]["pressureLevel"],
  difficultyLevel: DiagnosisProbeDefinition["constraints"]["difficultyLevel"],
  opportunityPurposes: string[],
  variationLevel: "same_form" | "changed_form" = "changed_form",
  maxCleanAttempts = 2,
): DiagnosisProbeDefinition => ({
  id,
  label,
  primaryPhase,
  evidenceQuestion,
  specialistInstruction,
  dimensions,
  constraints: {
    supportLevel: "neutral_clarification_only",
    pressureLevel,
    difficultyLevel,
    variationLevel,
  },
  maxCleanAttempts,
  opportunityPurposes,
});

const EXECUTION_IMMEDIATE = without(BY_PHASE["Structured Execution"], [
  "execution.repeatability",
]);

export const DIAGNOSIS_PROBES: Record<DiagnosisProbeId, DiagnosisProbeDefinition> = {
  "stack.timed_challenge": probe(
    "stack.timed_challenge",
    "Timed Challenge Probe",
    "Time Pressure Stability",
    "Where does the response stack first become unstable when difficulty and time are both present?",
    "Give one curriculum-appropriate challenging problem under a controlled timer. Do not teach, cue steps, rescue, or correct. Record only what you actually observe.",
    [
      ...BY_PHASE.Clarity,
      ...EXECUTION_IMMEDIATE,
      ...BY_PHASE["Controlled Discomfort"],
      ...BY_PHASE["Time Pressure Stability"],
    ],
    "timed_difficulty",
    "challenging",
    [
      "Cold composite exposure across the response stack.",
      "Confirmation only if composite timed evidence remains unresolved.",
    ],
    "same_form",
  ),
  "stack.challenge_no_timer": probe(
    "stack.challenge_no_timer",
    "Untimed Challenge Probe",
    "Controlled Discomfort",
    "Does difficulty destabilize the response when time pressure is removed?",
    "Give a comparable challenging problem without a timer. Do not teach or rescue. Record only the response behaviors that actually occur.",
    [
      ...BY_PHASE.Clarity,
      ...EXECUTION_IMMEDIATE,
      ...BY_PHASE["Controlled Discomfort"],
    ],
    "difficulty",
    "challenging",
    [
      "Constraint-stripping exposure after removing time.",
      "Confirmation only if composite difficulty evidence remains unresolved.",
    ],
  ),
  "stack.normal_independent": probe(
    "stack.normal_independent",
    "Independent Normal Probe",
    "Structured Execution",
    "Can the student execute a known method independently when difficulty and time pressure are removed?",
    "Give a normal familiar-form problem without a timer. Do not model or prompt the method. Record only what happens.",
    [...BY_PHASE.Clarity, ...EXECUTION_IMMEDIATE],
    "none",
    "normal",
    [
      "Independent baseline with difficulty and time removed.",
      "Confirmation only if immediate execution evidence remains unresolved.",
    ],
  ),
  "clarity.recognition": probe(
    "clarity.recognition",
    "Clarity Recognition Probe",
    "Clarity",
    "Can the student identify the problem, method, and reason before training begins?",
    "Present a clean topic example. Ask what they see, which method they would use, and why. Do not explain or supply the answer.",
    BY_PHASE.Clarity,
    "none",
    "recognition",
    [
      "Cold recognition without teaching.",
      "Confirmation only if clarity evidence is incomplete or conflicting.",
    ],
    "same_form",
  ),
  "execution.repeatability": probe(
    "execution.repeatability",
    "Execution Repeatability Probe",
    "Structured Execution",
    "Does independent execution repeat without the system teaching it?",
    "Give another comparable normal problem. No method prompts. Compare the execution with the earlier independent opportunity and record what actually repeated.",
    BY_PHASE["Structured Execution"],
    "none",
    "normal",
    [
      "Repeatability confirmation against the earlier execution opportunity.",
      "Conflict resolution only.",
    ],
    "changed_form",
  ),
  "difficulty.recovery": probe(
    "difficulty.recovery",
    "Difficulty Recovery Probe",
    "Controlled Discomfort",
    "Does controlled engagement hold or recover on another difficult opportunity without rescue?",
    "Give another challenging problem without a timer. Do not rescue. This opportunity exists only to resolve tolerance, recovery, or rescue dependence.",
    BY_PHASE["Controlled Discomfort"],
    "difficulty",
    "challenging",
    [
      "Recovery and tolerance confirmation against the first difficult opportunity.",
      "Conflict resolution only.",
    ],
  ),
  "time.consistency": probe(
    "time.consistency",
    "Timed Consistency Probe",
    "Time Pressure Stability",
    "Do structure, pace, and completion hold on another independent timed opportunity?",
    "Give another comparable timed problem. No coaching. Record whether the timed response pattern holds, drifts, or breaks.",
    BY_PHASE["Time Pressure Stability"],
    "timed",
    "normal",
    [
      "Timed consistency confirmation against the first timed opportunity.",
      "Conflict resolution only.",
    ],
  ),
};

const contaminated = (event: DiagnosisSupportEvent) =>
  event === "first_step_confirmation" || event === "teaching";

export const createEvidenceCompleteDiagnosisState = (
  recommendedStartingPhase: TopicPhase | null,
): EvidenceCompleteDiagnosisState => ({
  recommendedStartingPhase,
  evidence: [],
  probeHistory: [],
});

export function recordEvidenceCompleteDiagnosisProbe(
  state: EvidenceCompleteDiagnosisState,
  result: DiagnosisProbeResult,
): EvidenceCompleteDiagnosisState {
  const definition = DIAGNOSIS_PROBES[result.probeId];
  if (!definition) throw new Error(`Unknown diagnosis probe: ${result.probeId}`);

  const supportEvent = result.supportEvent || "none";
  const allowed = new Set(definition.dimensions);
  const seen = new Set<DiagnosisDimensionId>();

  const events = result.observations.map((observation) => {
    if (!allowed.has(observation.dimensionId)) {
      throw new Error(`${result.probeId} cannot record ${observation.dimensionId}`);
    }
    if (seen.has(observation.dimensionId)) {
      throw new Error(
        `${result.probeId} recorded ${observation.dimensionId} more than once in one opportunity`,
      );
    }
    seen.add(observation.dimensionId);

    const behavior = getDiagnosisObservationOption(
      observation.dimensionId,
      observation.behaviorId,
    );
    if (!behavior) {
      throw new Error(
        `Unknown behavior ${observation.behaviorId} for ${observation.dimensionId}`,
      );
    }

    return {
      ...observation,
      probeId: result.probeId,
      supportEvent,
      contaminated: contaminated(supportEvent),
      behaviorClass: behavior.behaviorClass,
      behaviorLabel: behavior.label,
    } satisfies DiagnosisEvidenceEvent;
  });

  return {
    ...state,
    probeHistory: [...state.probeHistory, { ...result, supportEvent }],
    evidence: [...state.evidence, ...events],
  };
}

function dimensionState(
  dimensionId: DiagnosisDimensionId,
  evidence: DiagnosisEvidenceEvent[],
): DiagnosisDimensionState {
  const definition = DIAGNOSIS_OBSERVATION_MATRIX[dimensionId];
  const all = evidence.filter((event) => event.dimensionId === dimensionId);
  const clean = all.filter((event) => !event.contaminated);

  const supportedCount = clean.filter((event) => event.behaviorClass === "supported").length;
  const breakdownCount = clean.filter((event) => event.behaviorClass === "breakdown").length;
  const conditionalCount = clean.filter((event) => event.behaviorClass === "conditional").length;
  const nearStableCount = clean.filter((event) => event.behaviorClass === "near_stable").length;
  const notObservedCount = clean.filter((event) => event.behaviorClass === "not_observed").length;
  const dimensionConfoundedCount = clean.filter((event) => event.behaviorClass === "confounded").length;
  const contaminatedObservationCount = all.length - clean.length;
  const unsupportedCount = breakdownCount + conditionalCount + nearStableCount;
  const conflict = supportedCount > 0 && unsupportedCount > 0;

  let status: DiagnosisEvidenceStatus = "unresolved";
  if (conflict) {
    status = "unresolved";
  } else if (unsupportedCount > 0) {
    status = "unsupported";
  } else if (supportedCount >= definition.requiredSupportedObservations) {
    status = "supported";
  } else if (
    dimensionConfoundedCount > 0 ||
    (contaminatedObservationCount > 0 && supportedCount < definition.requiredSupportedObservations)
  ) {
    status = "confounded";
  }

  return {
    dimensionId,
    phase: definition.phase,
    requiredSupportedObservations: definition.requiredSupportedObservations,
    supportedCount,
    breakdownCount,
    conditionalCount,
    nearStableCount,
    notObservedCount,
    confoundedCount: dimensionConfoundedCount,
    contaminatedObservationCount,
    status,
    conflict,
    behaviorHistory: all.map((event) => ({
      behaviorId: event.behaviorId,
      behaviorLabel: event.behaviorLabel,
      behaviorClass: event.behaviorClass,
      contaminated: event.contaminated,
    })),
  };
}

function phaseState(
  phase: TopicPhase,
  evidence: DiagnosisEvidenceEvent[],
): DiagnosisPhaseState {
  const dimensions = BY_PHASE[phase].map((id) => dimensionState(id, evidence));
  let status: DiagnosisEvidenceStatus = "unresolved";

  if (dimensions.some((item) => item.status === "unsupported")) {
    status = "unsupported";
  } else if (dimensions.every((item) => item.status === "supported")) {
    status = "supported";
  } else if (dimensions.some((item) => item.status === "unresolved")) {
    status = "unresolved";
  } else if (dimensions.some((item) => item.status === "confounded")) {
    status = "confounded";
  }

  return {
    phase,
    status,
    dimensions,
    supportedDimensions: dimensions
      .filter((item) => item.status === "supported")
      .map((item) => item.dimensionId),
    unsupportedDimensions: dimensions
      .filter((item) => item.status === "unsupported")
      .map((item) => item.dimensionId),
    unresolvedDimensions: dimensions
      .filter((item) => item.status === "unresolved")
      .map((item) => item.dimensionId),
    confoundedDimensions: dimensions
      .filter((item) => item.status === "confounded")
      .map((item) => item.dimensionId),
  };
}

function initialProbe(phase: TopicPhase | null): DiagnosisProbeId {
  if (!phase) return "stack.normal_independent";
  if (phase === "Time Pressure Stability") return "stack.timed_challenge";
  if (phase === "Controlled Discomfort") return "stack.challenge_no_timer";
  if (phase === "Structured Execution") return "stack.normal_independent";
  return "clarity.recognition";
}

const dim = (state: DiagnosisPhaseState, id: DiagnosisDimensionId) =>
  state.dimensions.find((item) => item.dimensionId === id);

function resolutionProbe(
  phase: TopicPhase,
  state: DiagnosisPhaseState,
): DiagnosisProbeId {
  if (phase === "Clarity") return "clarity.recognition";

  if (phase === "Structured Execution") {
    const immediate = [
      dim(state, "execution.start"),
      dim(state, "execution.step_discipline"),
      dim(state, "execution.independence"),
    ];
    if (immediate.some((item) => !item || item.status !== "supported")) {
      const hasAnyImmediateEvidence = immediate.some(
        (item) => item && item.behaviorHistory.length > 0,
      );
      return hasAnyImmediateEvidence ? "execution.repeatability" : "stack.normal_independent";
    }
    return "execution.repeatability";
  }

  if (phase === "Controlled Discomfort") {
    const direct = [
      dim(state, "difficulty.initial_response"),
      dim(state, "difficulty.first_step_control"),
      dim(state, "difficulty.rescue_dependence"),
    ];
    if (direct.some((item) => !item || item.behaviorHistory.length === 0)) {
      return "stack.challenge_no_timer";
    }
    return "difficulty.recovery";
  }

  const direct = [
    dim(state, "time.start"),
    dim(state, "time.pace"),
  ];
  if (direct.some((item) => !item || item.behaviorHistory.length === 0)) {
    return "stack.timed_challenge";
  }
  return "time.consistency";
}

function safeNextProbe(
  state: EvidenceCompleteDiagnosisState,
  proposed: DiagnosisProbeId,
): DiagnosisProbeId | null {
  const used = state.probeHistory.filter(
    (item) => item.probeId === proposed && !contaminated(item.supportEvent || "none"),
  ).length;
  return used < DIAGNOSIS_PROBES[proposed].maxCleanAttempts ? proposed : null;
}

export function getDiagnosisProbeOpportunityPurpose(
  probeId: DiagnosisProbeId,
  opportunityNumber: number,
): string {
  const purposes = DIAGNOSIS_PROBES[probeId].opportunityPurposes;
  return purposes[Math.max(0, Math.min(purposes.length - 1, opportunityNumber - 1))];
}

function placementEvidenceForPhase(
  phase: TopicPhase,
  evidence: DiagnosisEvidenceEvent[],
): DiagnosisPlacementEvidence[] {
  return evidence
    .filter(
      (event) =>
        !event.contaminated &&
        DIAGNOSIS_OBSERVATION_MATRIX[event.dimensionId].phase === phase &&
        (event.behaviorClass === "breakdown" ||
          event.behaviorClass === "conditional" ||
          event.behaviorClass === "near_stable"),
    )
    .map((event) => ({
      dimensionId: event.dimensionId,
      dimensionLabel: DIAGNOSIS_OBSERVATION_MATRIX[event.dimensionId].label,
      behaviorId: event.behaviorId,
      behaviorLabel: event.behaviorLabel,
      behaviorClass: event.behaviorClass,
    }));
}

function derivePlacementStability(
  placementEvidence: DiagnosisPlacementEvidence[],
): Exclude<TopicStability, "High Maintenance"> {
  if (placementEvidence.some((item) => item.behaviorClass === "breakdown")) return "Low";
  if (placementEvidence.some((item) => item.behaviorClass === "conditional")) return "Medium";
  return "High";
}

function unsupportedReason(
  phase: TopicPhase,
  placementEvidence: DiagnosisPlacementEvidence[],
  phaseStates: DiagnosisPhaseState[],
) {
  const placementIndex = PHASES.indexOf(phase);
  const earlierSupportedPhases = phaseStates
    .slice(0, placementIndex)
    .filter((state) => state.status === "supported")
    .map((state) => state.phase);
  const earlierText = earlierSupportedPhases.length
    ? ` Earlier layers cleanly supported: ${earlierSupportedPhases.join(", ")}.`
    : "";
  const labels = Array.from(new Set(placementEvidence.map((item) => item.dimensionLabel)));
  const evidenceText = labels.length ? ` Decisive evidence: ${labels.join(", ")}.` : "";
  return `${phase} is the first response layer with direct clean behavioral evidence that does not meet the support contract.${earlierText}${evidenceText} Training should begin here.`;
}

export function evaluateEvidenceCompleteDiagnosis(
  state: EvidenceCompleteDiagnosisState,
): EvidenceCompleteDiagnosisDecision {
  const phaseStates = PHASES.map((phase) => phaseState(phase, state.evidence));
  const cleanProbeCount = state.probeHistory.filter(
    (item) => !contaminated(item.supportEvent || "none"),
  ).length;
  const contaminatedProbeCount = state.probeHistory.length - cleanProbeCount;
  const base = {
    phaseStates,
    cleanProbeCount,
    contaminatedProbeCount,
    decisionAuthority: "behavioral_evidence" as const,
  };

  if (!state.probeHistory.length) {
    return {
      ...base,
      complete: false,
      placementPhase: null,
      stability: null,
      confidence: "insufficient",
      nextProbeId: initialProbe(state.recommendedStartingPhase),
      reason: state.recommendedStartingPhase
        ? `Begin with the system-selected ${state.recommendedStartingPhase} probe. The starting signal routes the first question only; behavioral evidence decides placement.`
        : "No starting signal is available. Begin with a neutral independent baseline that can observe Clarity and Structured Execution without adding difficulty or time.",
      placementEvidence: [],
    };
  }

  for (let index = 0; index < PHASES.length; index += 1) {
    const phase = PHASES[index];
    const current = phaseStates[index];
    const earlier = phaseStates.slice(0, index);
    const firstEarlierNotSupported = earlier.find((item) => item.status !== "supported");

    if (firstEarlierNotSupported) {
      const nextProbeId = safeNextProbe(
        state,
        resolutionProbe(firstEarlierNotSupported.phase, firstEarlierNotSupported),
      );
      return {
        ...base,
        complete: false,
        placementPhase: null,
        stability: null,
        confidence: "insufficient",
        nextProbeId,
        reason: nextProbeId
          ? `${phase} cannot be interpreted yet because ${firstEarlierNotSupported.phase} is not cleanly supported. The system is stripping constraints or requesting the smallest confirmation needed to resolve that earlier layer.`
          : `${firstEarlierNotSupported.phase} remains unresolved after the permitted clean probes. Do not guess a placement; block for evidence review.`,
        placementEvidence: [],
      };
    }

    if (current.status === "unsupported") {
      const placementEvidence = placementEvidenceForPhase(phase, state.evidence);
      return {
        ...base,
        complete: true,
        placementPhase: phase,
        stability: derivePlacementStability(placementEvidence),
        confidence:
          cleanProbeCount > 1 && !contaminatedProbeCount ? "strong" : "sufficient",
        nextProbeId: null,
        reason: unsupportedReason(phase, placementEvidence, phaseStates),
        placementEvidence,
      };
    }

    if (current.status === "unresolved" || current.status === "confounded") {
      const nextProbeId = safeNextProbe(state, resolutionProbe(phase, current));
      return {
        ...base,
        complete: false,
        placementPhase: null,
        stability: null,
        confidence: "insufficient",
        nextProbeId,
        reason: nextProbeId
          ? `${phase} is still ${current.status}. The next probe exists only to answer the remaining behavioral evidence question.`
          : `${phase} remains ${current.status} after the permitted clean probes. Do not convert missing or contaminated evidence into a score; block for evidence review.`,
        placementEvidence: [],
      };
    }
  }

  const finalState = phaseStates[phaseStates.length - 1];
  const finalEvidence = state.evidence
    .filter(
      (event) =>
        !event.contaminated &&
        DIAGNOSIS_OBSERVATION_MATRIX[event.dimensionId].phase ===
          "Time Pressure Stability" &&
        event.behaviorClass === "supported",
    )
    .slice(-4)
    .map((event) => ({
      dimensionId: event.dimensionId,
      dimensionLabel: DIAGNOSIS_OBSERVATION_MATRIX[event.dimensionId].label,
      behaviorId: event.behaviorId,
      behaviorLabel: event.behaviorLabel,
      behaviorClass: event.behaviorClass,
    }));

  return {
    ...base,
    complete: true,
    placementPhase: "Time Pressure Stability",
    stability: "High",
    confidence: contaminatedProbeCount ? "sufficient" : "strong",
    nextProbeId: null,
    reason:
      "All four response layers are supported, including the required repeated timed evidence. Diagnosis therefore places at Time Pressure Stability - High. High Maintenance remains training-earned.",
    placementEvidence: finalEvidence,
  };
}

export function getEvidenceCompleteDiagnosisNextProbe(
  state: EvidenceCompleteDiagnosisState,
): DiagnosisProbeDefinition | null {
  const decision = evaluateEvidenceCompleteDiagnosis(state);
  return decision.nextProbeId ? DIAGNOSIS_PROBES[decision.nextProbeId] : null;
}
