import { PHASES, type TopicPhase, type TopicStability } from "./topicConditioningEngine";

export type DiagnosisObservationLevel = "weak" | "partial" | "clear";
export type DiagnosisEvidenceStatus = "supported" | "unsupported" | "unresolved" | "confounded";
export type DiagnosisSupportEvent = "none" | "neutral_clarification" | "first_step_confirmation" | "teaching";
export type DiagnosisDimensionId =
  | "clarity.vocabulary" | "clarity.method" | "clarity.reason" | "clarity.immediate_apply"
  | "execution.start" | "execution.step_discipline" | "execution.repeatability" | "execution.independence"
  | "difficulty.initial_response" | "difficulty.first_step_control" | "difficulty.tolerance" | "difficulty.rescue_dependence"
  | "time.start" | "time.structure" | "time.pace" | "time.completion_integrity";
export type DiagnosisProbeId =
  | "stack.timed_challenge" | "stack.challenge_no_timer" | "stack.normal_independent"
  | "clarity.recognition" | "execution.repeatability" | "difficulty.recovery" | "time.consistency";

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
export type DiagnosisProbeObservation = { dimensionId: DiagnosisDimensionId; level: DiagnosisObservationLevel };
export type DiagnosisProbeResult = { probeId: DiagnosisProbeId; observations: DiagnosisProbeObservation[]; supportEvent?: DiagnosisSupportEvent };
export type DiagnosisEvidenceEvent = DiagnosisProbeObservation & { probeId: DiagnosisProbeId; supportEvent: DiagnosisSupportEvent; contaminated: boolean };
export type DiagnosisDimensionState = {
  dimensionId: DiagnosisDimensionId;
  phase: TopicPhase;
  weight: number;
  requiredClearObservationsForSupport: number;
  validObservationCount: number;
  contaminatedObservationCount: number;
  weakCount: number;
  partialCount: number;
  clearCount: number;
  status: DiagnosisEvidenceStatus;
};
export type DiagnosisPhaseState = {
  phase: TopicPhase;
  status: DiagnosisEvidenceStatus;
  score: number | null;
  observedWeight: number;
  totalWeight: number;
  observedCoverage: number;
  supportCoverage: number;
  dimensions: DiagnosisDimensionState[];
};
export type EvidenceCompleteDiagnosisState = { recommendedStartingPhase: TopicPhase; evidence: DiagnosisEvidenceEvent[]; probeHistory: DiagnosisProbeResult[] };
export type EvidenceCompleteDiagnosisDecision = {
  complete: boolean;
  placementPhase: TopicPhase | null;
  stability: Exclude<TopicStability, "High Maintenance"> | null;
  confidence: "insufficient" | "sufficient" | "strong";
  nextProbeId: DiagnosisProbeId | null;
  reason: string;
  phaseStates: DiagnosisPhaseState[];
  cleanProbeCount: number;
  contaminatedProbeCount: number;
};

type DimensionDefinition = { phase: TopicPhase; weight: number; requiredClearObservationsForSupport: number };
const d = (phase: TopicPhase, weight: number, repeat = false): DimensionDefinition => ({
  phase, weight, requiredClearObservationsForSupport: repeat ? 2 : 1,
});
export const DIAGNOSIS_DIMENSIONS: Record<DiagnosisDimensionId, DimensionDefinition> = {
  "clarity.vocabulary": d("Clarity", 30), "clarity.method": d("Clarity", 30),
  "clarity.reason": d("Clarity", 20), "clarity.immediate_apply": d("Clarity", 20),
  "execution.start": d("Structured Execution", 25), "execution.step_discipline": d("Structured Execution", 30),
  "execution.repeatability": d("Structured Execution", 25, true), "execution.independence": d("Structured Execution", 20),
  "difficulty.initial_response": d("Controlled Discomfort", 30), "difficulty.first_step_control": d("Controlled Discomfort", 25),
  "difficulty.tolerance": d("Controlled Discomfort", 25, true), "difficulty.rescue_dependence": d("Controlled Discomfort", 20),
  "time.start": d("Time Pressure Stability", 20), "time.structure": d("Time Pressure Stability", 35, true),
  "time.pace": d("Time Pressure Stability", 20), "time.completion_integrity": d("Time Pressure Stability", 25, true),
};
const IDS = Object.keys(DIAGNOSIS_DIMENSIONS) as DiagnosisDimensionId[];
const BY_PHASE = Object.fromEntries(PHASES.map((phase) => [phase, IDS.filter((id) => DIAGNOSIS_DIMENSIONS[id].phase === phase)])) as Record<TopicPhase, DiagnosisDimensionId[]>;
const through = (phase: TopicPhase) => PHASES.slice(0, PHASES.indexOf(phase) + 1).flatMap((p) => BY_PHASE[p]);
const probe = (
  id: DiagnosisProbeId, label: string, primaryPhase: TopicPhase, evidenceQuestion: string,
  specialistInstruction: string, dimensions: DiagnosisDimensionId[],
  pressureLevel: DiagnosisProbeDefinition["constraints"]["pressureLevel"],
  difficultyLevel: DiagnosisProbeDefinition["constraints"]["difficultyLevel"],
  opportunityPurposes: string[], variationLevel: "same_form" | "changed_form" = "changed_form",
): DiagnosisProbeDefinition => ({
  id, label, primaryPhase, evidenceQuestion, specialistInstruction, dimensions,
  constraints: { supportLevel: "neutral_clarification_only", pressureLevel, difficultyLevel, variationLevel },
  maxCleanAttempts: 2, opportunityPurposes,
});

export const DIAGNOSIS_PROBES: Record<DiagnosisProbeId, DiagnosisProbeDefinition> = {
  "stack.timed_challenge": probe(
    "stack.timed_challenge", "Timed Challenge Probe", "Time Pressure Stability",
    "Where does the response stack first become unstable when difficulty and time are both present?",
    "Give one curriculum-appropriate challenging problem under a controlled timer. Do not teach, cue steps, rescue, or correct. Record the response across all four layers.",
    through("Time Pressure Stability"), "timed_difficulty", "challenging",
    ["Cold composite exposure across the full response stack.", "Confirmation only if composite timed evidence remains unresolved."], "same_form",
  ),
  "stack.challenge_no_timer": probe(
    "stack.challenge_no_timer", "Untimed Challenge Probe", "Controlled Discomfort",
    "Does difficulty destabilize the response when time pressure is removed?",
    "Give a comparable challenging problem without a timer. Do not teach or rescue. Record clarity, execution, and response to difficulty.",
    through("Controlled Discomfort"), "difficulty", "challenging",
    ["Constraint-stripping exposure after removing time.", "Confirmation only if composite difficulty evidence remains unresolved."],
  ),
  "stack.normal_independent": probe(
    "stack.normal_independent", "Independent Normal Probe", "Structured Execution",
    "Can the student execute a known method independently when difficulty pressure is removed?",
    "Give a normal familiar-form problem without a timer. Do not model or prompt the method. Record clarity and independent execution.",
    through("Structured Execution"), "none", "normal",
    ["Independent baseline with difficulty and time removed.", "Confirmation only if immediate execution evidence remains unresolved."],
  ),
  "clarity.recognition": probe(
    "clarity.recognition", "Clarity Recognition Probe", "Clarity",
    "Can the student identify the problem, method, and reason before training begins?",
    "Present a clean topic example. Ask what they see, the method they would use, and why. Do not explain or supply the answer.",
    BY_PHASE.Clarity, "none", "recognition",
    ["Cold recognition without teaching.", "Confirmation only if clarity evidence is incomplete or conflicting."], "same_form",
  ),
  "execution.repeatability": probe(
    "execution.repeatability", "Execution Repeatability Probe", "Structured Execution",
    "Does independent execution repeat without the system teaching it?",
    "Give another comparable normal problem. No method prompts. This opportunity exists only to resolve repeatability or independence evidence.",
    BY_PHASE["Structured Execution"], "none", "normal",
    ["Repeatability confirmation against the first execution opportunity.", "Conflict resolution only."],
  ),
  "difficulty.recovery": probe(
    "difficulty.recovery", "Difficulty Recovery Probe", "Controlled Discomfort",
    "Does controlled engagement hold or recover on another difficult opportunity without rescue?",
    "Give another challenging problem without a timer. Do not rescue. This opportunity exists only to resolve tolerance, recovery, or rescue dependence.",
    BY_PHASE["Controlled Discomfort"], "difficulty", "challenging",
    ["Recovery/tolerance confirmation against the first difficult opportunity.", "Conflict resolution only."],
  ),
  "time.consistency": probe(
    "time.consistency", "Timed Consistency Probe", "Time Pressure Stability",
    "Do structure and completion hold on another independent timed opportunity?",
    "Give another comparable timed problem. No coaching. This opportunity exists only to resolve timed structure and completion consistency.",
    BY_PHASE["Time Pressure Stability"], "timed", "normal",
    ["Timed consistency confirmation against the first timed opportunity.", "Conflict resolution only."],
  ),
};

const scoreLevel = (level: DiagnosisObservationLevel) => level === "clear" ? 1 : level === "partial" ? 0.6 : 0;
const contaminated = (event: DiagnosisSupportEvent) => event === "first_step_confirmation" || event === "teaching";

export const createEvidenceCompleteDiagnosisState = (recommendedStartingPhase: TopicPhase): EvidenceCompleteDiagnosisState => ({
  recommendedStartingPhase, evidence: [], probeHistory: [],
});

export function recordEvidenceCompleteDiagnosisProbe(state: EvidenceCompleteDiagnosisState, result: DiagnosisProbeResult): EvidenceCompleteDiagnosisState {
  const definition = DIAGNOSIS_PROBES[result.probeId];
  if (!definition) throw new Error(`Unknown diagnosis probe: ${result.probeId}`);
  const supportEvent = result.supportEvent || "none";
  const allowed = new Set(definition.dimensions);
  const seen = new Set<DiagnosisDimensionId>();
  for (const observation of result.observations) {
    if (!allowed.has(observation.dimensionId)) throw new Error(`${result.probeId} cannot record ${observation.dimensionId}`);
    if (seen.has(observation.dimensionId)) throw new Error(`${result.probeId} recorded ${observation.dimensionId} more than once in one opportunity`);
    seen.add(observation.dimensionId);
  }
  return {
    ...state,
    probeHistory: [...state.probeHistory, { ...result, supportEvent }],
    evidence: [...state.evidence, ...result.observations.map((observation) => ({
      ...observation, probeId: result.probeId, supportEvent, contaminated: contaminated(supportEvent),
    }))],
  };
}

function dimensionState(dimensionId: DiagnosisDimensionId, evidence: DiagnosisEvidenceEvent[]): DiagnosisDimensionState {
  const definition = DIAGNOSIS_DIMENSIONS[dimensionId];
  const all = evidence.filter((event) => event.dimensionId === dimensionId);
  const valid = all.filter((event) => !event.contaminated);
  const weakCount = valid.filter((event) => event.level === "weak").length;
  const partialCount = valid.filter((event) => event.level === "partial").length;
  const clearCount = valid.filter((event) => event.level === "clear").length;
  let status: DiagnosisEvidenceStatus = "unresolved";
  if (!valid.length && all.length) status = "confounded";
  else if (weakCount || partialCount) status = "unsupported";
  else if (clearCount >= definition.requiredClearObservationsForSupport) status = "supported";
  return {
    dimensionId, phase: definition.phase, weight: definition.weight,
    requiredClearObservationsForSupport: definition.requiredClearObservationsForSupport,
    validObservationCount: valid.length, contaminatedObservationCount: all.length - valid.length,
    weakCount, partialCount, clearCount, status,
  };
}

function phaseState(phase: TopicPhase, evidence: DiagnosisEvidenceEvent[]): DiagnosisPhaseState {
  const dimensions = BY_PHASE[phase].map((id) => dimensionState(id, evidence));
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0);
  const observed = dimensions.filter((item) => item.validObservationCount > 0);
  const observedWeight = observed.reduce((sum, item) => sum + item.weight, 0);
  const numerator = dimensions.reduce((sum, item) => {
    const valid = evidence.filter((event) => event.dimensionId === item.dimensionId && !event.contaminated);
    if (!valid.length) return sum;
    return sum + (valid.reduce((inner, event) => inner + scoreLevel(event.level), 0) / valid.length) * item.weight;
  }, 0);
  const supportedWeight = dimensions.filter((item) => item.status === "supported").reduce((sum, item) => sum + item.weight, 0);
  let status: DiagnosisEvidenceStatus = "unresolved";
  if (dimensions.some((item) => item.status === "unsupported")) status = "unsupported";
  else if (dimensions.every((item) => item.status === "supported")) status = "supported";
  else if (dimensions.some((item) => item.status === "confounded")) status = "confounded";
  return {
    phase, status, score: observedWeight ? Math.round((numerator / observedWeight) * 100) : null,
    observedWeight, totalWeight,
    observedCoverage: totalWeight ? Math.round((observedWeight / totalWeight) * 100) : 0,
    supportCoverage: totalWeight ? Math.round((supportedWeight / totalWeight) * 100) : 0,
    dimensions,
  };
}

const stabilityFromScore = (score: number | null): Exclude<TopicStability, "High Maintenance"> =>
  score === null || score <= 44 ? "Low" : score <= 79 ? "Medium" : "High";
const initialProbe = (phase: TopicPhase): DiagnosisProbeId =>
  phase === "Time Pressure Stability" ? "stack.timed_challenge" :
  phase === "Controlled Discomfort" ? "stack.challenge_no_timer" :
  phase === "Structured Execution" ? "stack.normal_independent" : "clarity.recognition";

function resolutionProbe(phase: TopicPhase, state: DiagnosisPhaseState): DiagnosisProbeId {
  if (phase === "Clarity") return "clarity.recognition";
  if (phase === "Structured Execution") {
    if (!state.observedWeight) return "stack.normal_independent";
    return state.dimensions.find((item) => item.dimensionId === "execution.repeatability")?.status === "unresolved"
      ? "execution.repeatability" : "stack.normal_independent";
  }
  if (phase === "Controlled Discomfort") {
    if (!state.observedWeight) return "stack.challenge_no_timer";
    return state.dimensions.find((item) => item.dimensionId === "difficulty.tolerance")?.status === "unresolved"
      ? "difficulty.recovery" : "stack.challenge_no_timer";
  }
  if (!state.observedWeight) return "stack.timed_challenge";
  const structure = state.dimensions.find((item) => item.dimensionId === "time.structure")?.status;
  const completion = state.dimensions.find((item) => item.dimensionId === "time.completion_integrity")?.status;
  return structure === "unresolved" || completion === "unresolved" ? "time.consistency" : "stack.timed_challenge";
}

function safeNextProbe(state: EvidenceCompleteDiagnosisState, proposed: DiagnosisProbeId): DiagnosisProbeId | null {
  const used = state.probeHistory.filter((item) => item.probeId === proposed && !contaminated(item.supportEvent || "none")).length;
  return used < DIAGNOSIS_PROBES[proposed].maxCleanAttempts ? proposed : null;
}

export function getDiagnosisProbeOpportunityPurpose(probeId: DiagnosisProbeId, opportunityNumber: number): string {
  const purposes = DIAGNOSIS_PROBES[probeId].opportunityPurposes;
  return purposes[Math.max(0, Math.min(purposes.length - 1, opportunityNumber - 1))];
}

export function evaluateEvidenceCompleteDiagnosis(state: EvidenceCompleteDiagnosisState): EvidenceCompleteDiagnosisDecision {
  const phaseStates = PHASES.map((phase) => phaseState(phase, state.evidence));
  const cleanProbeCount = state.probeHistory.filter((item) => !contaminated(item.supportEvent || "none")).length;
  const contaminatedProbeCount = state.probeHistory.length - cleanProbeCount;
  const base = { phaseStates, cleanProbeCount, contaminatedProbeCount };
  if (!state.probeHistory.length) return {
    ...base, complete: false, placementPhase: null, stability: null, confidence: "insufficient",
    nextProbeId: initialProbe(state.recommendedStartingPhase),
    reason: `Begin with the system-selected ${state.recommendedStartingPhase} probe.`,
  };

  for (let index = 0; index < PHASES.length; index += 1) {
    const phase = PHASES[index];
    const current = phaseStates[index];
    const earlier = phaseStates.slice(0, index);
    const firstEarlierNotSupported = earlier.find((item) => item.status !== "supported");
    if (firstEarlierNotSupported) {
      const nextProbeId = safeNextProbe(state, resolutionProbe(firstEarlierNotSupported.phase, firstEarlierNotSupported));
      return {
        ...base, complete: false, placementPhase: null, stability: null, confidence: "insufficient", nextProbeId,
        reason: `${phase} cannot be interpreted yet because ${firstEarlierNotSupported.phase} is not cleanly supported. Strip the higher constraint and resolve the earlier layer first.`,
      };
    }
    if (current.status === "unsupported") return {
      ...base, complete: true, placementPhase: phase, stability: stabilityFromScore(current.score),
      confidence: cleanProbeCount > 1 && !contaminatedProbeCount ? "strong" : "sufficient", nextProbeId: null,
      reason: `${phase} is the first layer with direct clean evidence that does not clear the support requirement. Training should begin here.`,
    };
    if (current.status === "unresolved" || current.status === "confounded") {
      const nextProbeId = safeNextProbe(state, resolutionProbe(phase, current));
      return {
        ...base, complete: false, placementPhase: null, stability: null, confidence: "insufficient", nextProbeId,
        reason: nextProbeId
          ? `${phase} is still unresolved. The next probe exists only to answer the remaining evidence question.`
          : `${phase} remains unresolved after the permitted clean probes. Do not guess a placement; block for evidence review.`,
      };
    }
  }

  const final = phaseStates[phaseStates.length - 1];
  return {
    ...base, complete: true, placementPhase: "Time Pressure Stability", stability: stabilityFromScore(final.score),
    confidence: contaminatedProbeCount ? "sufficient" : "strong", nextProbeId: null,
    reason: "All four response layers are cleanly supported, including repeated timed structure and completion evidence.",
  };
}

export function getEvidenceCompleteDiagnosisNextProbe(state: EvidenceCompleteDiagnosisState): DiagnosisProbeDefinition | null {
  const decision = evaluateEvidenceCompleteDiagnosis(state);
  return decision.nextProbeId ? DIAGNOSIS_PROBES[decision.nextProbeId] : null;
}
