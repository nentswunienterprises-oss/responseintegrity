import type { ResponseEvidenceClass, ResponseEvidenceDimensionState } from "./responseEvidenceModel";
import { resolveResponseEvidenceDimension } from "./responseEvidenceModel";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";
import type { EvidenceConstraintProfile } from "./responseIntegrityDrillRegistry";
import type {
  TrainingEvidenceStatus,
  TrainingInterventionEvent,
} from "./trainingEvidenceCapture";

export type SandboxSpecialistCapabilityId =
  | "condition_integrity"
  | "observation_integrity"
  | "evidence_integrity"
  | "authority_integrity"
  | "continuity_integrity";

export const SANDBOX_SPECIALIST_CAPABILITY_ORDER: readonly SandboxSpecialistCapabilityId[] = [
  "condition_integrity",
  "observation_integrity",
  "evidence_integrity",
  "authority_integrity",
  "continuity_integrity",
] as const;

export type SandboxCapabilityPolicyStatus = "candidate" | "approved";

export type SandboxCapabilityPolicy = {
  policyVersion: number;
  status: SandboxCapabilityPolicyStatus;
  minimumValidOpportunities: Record<SandboxSpecialistCapabilityId, number>;
  requireAllPhasesRepresented: boolean;
  requireLongitudinalTrajectory: boolean;
  nextStage: "practicals";
};

export function parseSandboxCapabilityPolicy(value: unknown): SandboxCapabilityPolicy {
  const policy = (typeof value === "string" ? JSON.parse(value) : value) as Partial<SandboxCapabilityPolicy>;
  if (!policy || typeof policy !== "object") {
    throw new Error("Sandbox capability policy must be an object.");
  }
  if (!Number.isInteger(policy.policyVersion) || Number(policy.policyVersion) < 1) {
    throw new Error("Sandbox capability policy version must be a positive integer.");
  }
  if (policy.status !== "candidate" && policy.status !== "approved") {
    throw new Error("Sandbox capability policy status is invalid.");
  }
  if (policy.nextStage !== "practicals") {
    throw new Error("Sandbox capability policy may only open Practicals.");
  }
  if (typeof policy.requireAllPhasesRepresented !== "boolean" || typeof policy.requireLongitudinalTrajectory !== "boolean") {
    throw new Error("Sandbox capability breadth and longitudinal requirements must be explicit.");
  }
  const minimum = policy.minimumValidOpportunities as Partial<Record<SandboxSpecialistCapabilityId, number>> | undefined;
  if (!minimum) throw new Error("Sandbox capability opportunity minimums are required.");
  const normalized = Object.fromEntries(
    SANDBOX_SPECIALIST_CAPABILITY_ORDER.map((capabilityId) => {
      const count = Number(minimum[capabilityId]);
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`Sandbox capability policy requires a positive minimum for ${capabilityId}.`);
      }
      return [capabilityId, count];
    }),
  ) as Record<SandboxSpecialistCapabilityId, number>;

  return {
    policyVersion: Number(policy.policyVersion),
    status: policy.status,
    minimumValidOpportunities: normalized,
    requireAllPhasesRepresented: policy.requireAllPhasesRepresented,
    requireLongitudinalTrajectory: policy.requireLongitudinalTrajectory,
    nextStage: "practicals",
  };
}

export function sandboxInterventionPreservesCondition(
  constraints: EvidenceConstraintProfile,
  interventionEvent: TrainingInterventionEvent,
): boolean {
  if (interventionEvent === "none" || interventionEvent === "neutral_clarification") return true;
  if (interventionEvent === "full_rescue_or_teaching") return false;
  if (interventionEvent === "timer_changed") return false;
  if (constraints.supportLevel === "none") return false;
  if (constraints.supportLevel === "first_step_only") {
    return interventionEvent === "first_step_confirmation";
  }
  if (constraints.supportLevel === "minimal") {
    return interventionEvent === "first_step_confirmation" || interventionEvent === "method_or_step_prompt";
  }
  return false;
}

export type SandboxCapabilityOccurrence = {
  capabilityId: SandboxSpecialistCapabilityId;
  evidenceClass: ResponseEvidenceClass;
  phase: TopicPhase;
  setId: string;
  repNumber: number;
  trajectoryId: string;
  sessionNumber: number;
  eventId: string;
  reason: string;
};

export type SandboxCapabilityLayerEvaluation = {
  capabilityId: SandboxSpecialistCapabilityId;
  rawState: ResponseEvidenceDimensionState;
  effectiveState: ResponseEvidenceDimensionState | "BLOCKED_BY_PREREQUISITE";
  prerequisiteCapabilityId: SandboxSpecialistCapabilityId | null;
  validOpportunityCount: number;
  recoveredAfterBreakdown: boolean;
  reason: string;
};

export type SandboxCapabilityReadiness = {
  policyStatus: SandboxCapabilityPolicyStatus;
  evidenceReady: boolean;
  practicalsReady: boolean;
  automaticTransition: false;
  nextStage: "practicals";
  earliestUnsupportedCapability: SandboxSpecialistCapabilityId | null;
  phasesRepresented: TopicPhase[];
  longitudinalTrajectoryEstablished: boolean;
  layers: SandboxCapabilityLayerEvaluation[];
  reason: string;
};

export type SandboxOutcomeObservation = {
  optionId: string;
  evidenceStatus: TrainingEvidenceStatus;
};

export type SandboxOutcomeDefinition = {
  outcomeKey: string;
  outcomeVersion: number;
  phase: TopicPhase;
  setId: string;
  repNumber: number;
  studentBehavior: string;
  canonicalObservations: Record<string, SandboxOutcomeObservation>;
  canonicalInterventionEvent: TrainingInterventionEvent;
  plausiblePreviousStabilities: TopicStability[];
  capabilityExposure: SandboxSpecialistCapabilityId[];
  baseWeight: number;
};

export type SandboxOutcomeSelectionContext = {
  trajectoryId: string;
  seed: string;
  canonicalPhase: TopicPhase;
  canonicalStability: TopicStability;
  prescribedPhase: TopicPhase;
  setId: string;
  repNumber: number;
  recentOutcomeKeys: string[];
  capabilityNeeds: SandboxSpecialistCapabilityId[];
};

export type SandboxStateAuthorityOutcome = {
  route: "normal_training" | "targeted_rediagnosis";
  nextPhase: TopicPhase;
  nextStability: TopicStability;
  targetPhase: TopicPhase | null;
  reason: string;
};

export type SandboxStateTrack = {
  phase: TopicPhase;
  stability: TopicStability;
  route: "normal_training" | "targeted_rediagnosis";
  targetedRediagnosisPhase: TopicPhase | null;
};

export type SandboxEnvironmentState = {
  trajectoryId: string;
  canonicalStudent: SandboxStateTrack;
  specialistRecorded: SandboxStateTrack;
  sessionNumber: number;
  completedRepCount: number;
  divergenceActive: boolean;
};

export type SandboxRepIntegritySignals = {
  trajectoryId: string;
  phase: TopicPhase;
  setId: string;
  repNumber: number;
  sessionNumber: number;
  eventId: string;
  conditionKept: boolean | null;
  exactObservationCount: number;
  comparableObservationCount: number;
  evidenceStatusExact: boolean | null;
  interventionEventExact: boolean | null;
  systemOutcomeMatched: boolean | null;
  stateTrackAligned: boolean | null;
};

const phaseOrder: TopicPhase[] = [
  "Clarity",
  "Structured Execution",
  "Controlled Discomfort",
  "Time Pressure Stability",
];

const hashToUnitInterval = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000;
};

const unique = <T>(values: T[]) => Array.from(new Set(values));

export function validateSandboxOutcomeDefinition(outcome: SandboxOutcomeDefinition) {
  if (!outcome.outcomeKey.trim()) throw new Error("Sandbox outcome key is required.");
  if (!Number.isInteger(outcome.outcomeVersion) || outcome.outcomeVersion < 1) {
    throw new Error("Sandbox outcome version must be a positive integer.");
  }
  if (!outcome.setId.trim() || !Number.isInteger(outcome.repNumber) || outcome.repNumber < 1) {
    throw new Error("Sandbox outcome must identify a valid set and rep.");
  }
  if (!outcome.studentBehavior.trim()) {
    throw new Error("Sandbox outcome student behavior is required.");
  }
  if (!Object.keys(outcome.canonicalObservations).length) {
    throw new Error("Sandbox outcome canonical observations are required.");
  }
  if (!outcome.plausiblePreviousStabilities.length) {
    throw new Error("Sandbox outcome must declare at least one plausible previous stability.");
  }
  if (!Number.isFinite(outcome.baseWeight) || outcome.baseWeight <= 0) {
    throw new Error("Sandbox outcome base weight must be positive.");
  }
}

export function selectSandboxOutcome(
  outcomes: SandboxOutcomeDefinition[],
  context: SandboxOutcomeSelectionContext,
): SandboxOutcomeDefinition {
  const candidates = outcomes.filter((outcome) => {
    validateSandboxOutcomeDefinition(outcome);
    return (
      outcome.phase === context.prescribedPhase &&
      outcome.setId === context.setId &&
      outcome.repNumber === context.repNumber &&
      outcome.plausiblePreviousStabilities.includes(context.canonicalStability)
    );
  });

  if (!candidates.length) {
    throw new Error(
      `No plausible Sandbox outcome exists for ${context.prescribedPhase} / ${context.setId} / rep ${context.repNumber} at ${context.canonicalStability}.`,
    );
  }

  const recent = new Set(context.recentOutcomeKeys.slice(-3));
  const nonRepeated = candidates.filter((candidate) => !recent.has(candidate.outcomeKey));
  const pool = nonRepeated.length ? nonRepeated : candidates;
  const needs = new Set(context.capabilityNeeds);

  const weighted = pool.map((candidate) => {
    const needBoost = candidate.capabilityExposure.filter((capability) => needs.has(capability)).length;
    const continuityFactor = candidate.phase === context.canonicalPhase ? 1.15 : 0.85;
    return {
      candidate,
      weight: candidate.baseWeight * continuityFactor * (1 + needBoost * 0.2),
    };
  });

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const draw =
    hashToUnitInterval(
      [
        "sandbox-v1r3",
        context.seed,
        context.trajectoryId,
        context.canonicalPhase,
        context.canonicalStability,
        context.prescribedPhase,
        context.setId,
        context.repNumber,
        context.recentOutcomeKeys.join(","),
      ].join(":"),
    ) * totalWeight;

  let cursor = 0;
  for (const item of weighted) {
    cursor += item.weight;
    if (draw < cursor) return item.candidate;
  }
  return weighted[weighted.length - 1].candidate;
}

export function deriveSandboxCapabilityOccurrences(
  signals: SandboxRepIntegritySignals,
): SandboxCapabilityOccurrence[] {
  const base = {
    phase: signals.phase,
    setId: signals.setId,
    repNumber: signals.repNumber,
    trajectoryId: signals.trajectoryId,
    sessionNumber: signals.sessionNumber,
    eventId: signals.eventId,
  };

  const occurrences: SandboxCapabilityOccurrence[] = [];

  occurrences.push({
    ...base,
    capabilityId: "condition_integrity",
    evidenceClass:
      signals.conditionKept === null
        ? "not_observed"
        : signals.conditionKept
          ? "supported"
          : "breakdown",
    reason:
      signals.conditionKept === null
        ? "The rep did not expose a Specialist condition-control decision."
        : signals.conditionKept
          ? "The prescribed condition was preserved."
          : "The prescribed condition was materially changed.",
  });

  const observationClass: ResponseEvidenceClass =
    signals.comparableObservationCount <= 0
      ? "not_observed"
      : signals.exactObservationCount === signals.comparableObservationCount
        ? "supported"
        : signals.exactObservationCount === 0
          ? "breakdown"
          : "conditional";
  occurrences.push({
    ...base,
    capabilityId: "observation_integrity",
    evidenceClass: observationClass,
    reason:
      observationClass === "supported"
        ? "The concrete behavior record matched the canonical rep evidence."
        : observationClass === "breakdown"
          ? "The rep behavior was observed, but none of the comparable observations matched canonical truth."
          : observationClass === "conditional"
            ? "The rep record contained both accurate and inaccurate behavioral observations."
            : "The rep did not provide comparable behavioral observation evidence.",
  });

  const evidenceIntegrityClass: ResponseEvidenceClass =
    signals.evidenceStatusExact === null && signals.interventionEventExact === null
      ? "not_observed"
      : signals.evidenceStatusExact === false || signals.interventionEventExact === false
        ? "breakdown"
        : "supported";
  occurrences.push({
    ...base,
    capabilityId: "evidence_integrity",
    evidenceClass: evidenceIntegrityClass,
    reason:
      evidenceIntegrityClass === "supported"
        ? "Evidence eligibility and intervention truth were preserved."
        : evidenceIntegrityClass === "breakdown"
          ? "The capture changed evidence eligibility or intervention truth."
          : "Evidence-integrity handling was not exposed by this rep.",
  });

  occurrences.push({
    ...base,
    capabilityId: "authority_integrity",
    evidenceClass:
      signals.systemOutcomeMatched === null
        ? "not_observed"
        : signals.systemOutcomeMatched
          ? "supported"
          : "breakdown",
    reason:
      signals.systemOutcomeMatched === null
        ? "No completed RI authority decision was available at this point."
        : signals.systemOutcomeMatched
          ? "The Specialist record preserved the canonical RI authority outcome."
          : "The Specialist record caused RI authority to diverge from canonical truth.",
  });

  occurrences.push({
    ...base,
    capabilityId: "continuity_integrity",
    evidenceClass:
      signals.stateTrackAligned === null
        ? "not_observed"
        : signals.stateTrackAligned
          ? "supported"
          : "breakdown",
    reason:
      signals.stateTrackAligned === null
        ? "Longitudinal state continuity was not yet decision-eligible."
        : signals.stateTrackAligned
          ? "Canonical student truth and the Specialist-recorded RI state remained aligned."
          : "The Specialist-recorded state diverged from the canonical simulated student trajectory.",
  });

  return occurrences;
}

export function evaluateSandboxCapabilityReadiness(
  policy: SandboxCapabilityPolicy,
  occurrences: SandboxCapabilityOccurrence[],
): SandboxCapabilityReadiness {
  if (policy.nextStage !== "practicals") {
    throw new Error("Sandbox capability policy may only open Practicals.");
  }

  const phasesRepresented = phaseOrder.filter((phase) =>
    occurrences.some(
      (item) =>
        item.phase === phase &&
        item.evidenceClass !== "not_observed" &&
        item.evidenceClass !== "confounded",
    ),
  );
  const trajectorySessions = new Map<string, Set<number>>();
  for (const occurrence of occurrences) {
    if (
      occurrence.evidenceClass === "not_observed" ||
      occurrence.evidenceClass === "confounded"
    ) continue;
    if (!trajectorySessions.has(occurrence.trajectoryId)) {
      trajectorySessions.set(occurrence.trajectoryId, new Set());
    }
    trajectorySessions.get(occurrence.trajectoryId)!.add(occurrence.sessionNumber);
  }
  const longitudinalTrajectoryEstablished = Array.from(trajectorySessions.values()).some(
    (sessions) => sessions.size >= 2,
  );

  let prerequisiteSupported = true;
  let previousCapability: SandboxSpecialistCapabilityId | null = null;
  const layers: SandboxCapabilityLayerEvaluation[] = [];

  for (const capabilityId of SANDBOX_SPECIALIST_CAPABILITY_ORDER) {
    const evidence = occurrences.filter((item) => item.capabilityId === capabilityId);
    const minimum = policy.minimumValidOpportunities[capabilityId];
    if (!Number.isInteger(minimum) || minimum < 1) {
      throw new Error(`Sandbox capability policy requires a positive minimum for ${capabilityId}.`);
    }
    const resolution = resolveResponseEvidenceDimension({
      evidence,
      minimumValidOpportunities: minimum,
    });
    const blocked = !prerequisiteSupported;
    const effectiveState = blocked ? "BLOCKED_BY_PREREQUISITE" : resolution.state;
    const supported = !blocked && resolution.state === "SUPPORTED";
    layers.push({
      capabilityId,
      rawState: resolution.state,
      effectiveState,
      prerequisiteCapabilityId: blocked ? previousCapability : null,
      validOpportunityCount: resolution.validOpportunityCount,
      recoveredAfterBreakdown: resolution.recoveredAfterBreakdown,
      reason: blocked
        ? `This layer cannot authorize readiness while ${previousCapability} remains unsupported.`
        : supported
          ? "Repeated clean evidence supports this Specialist capability."
          : "This Specialist capability still requires clean evidence or recovery.",
    });
    prerequisiteSupported = prerequisiteSupported && supported;
    previousCapability = capabilityId;
  }

  const earliestUnsupportedCapability =
    layers.find((layer) => layer.effectiveState !== "SUPPORTED")?.capabilityId || null;
  const capabilitiesReady = earliestUnsupportedCapability === null;
  const breadthReady =
    !policy.requireAllPhasesRepresented || phasesRepresented.length === phaseOrder.length;
  const continuityReady =
    !policy.requireLongitudinalTrajectory || longitudinalTrajectoryEstablished;
  const evidenceReady = capabilitiesReady && breadthReady && continuityReady;
  const practicalsReady = evidenceReady && policy.status === "approved";

  return {
    policyStatus: policy.status,
    evidenceReady,
    practicalsReady,
    automaticTransition: false,
    nextStage: "practicals",
    earliestUnsupportedCapability,
    phasesRepresented,
    longitudinalTrajectoryEstablished,
    layers,
    reason: practicalsReady
      ? "All approved Sandbox capability and coverage evidence is supported. Practicals may be opened explicitly."
      : evidenceReady
        ? "Sandbox evidence satisfies the candidate capability standard, but the policy is not approved for progression."
        : earliestUnsupportedCapability
          ? `Sandbox continues at the earliest unsupported Specialist layer: ${earliestUnsupportedCapability}.`
          : "Sandbox still requires the approved breadth and longitudinal evidence coverage.",
  };
}

export function createSandboxEnvironmentState(input: {
  trajectoryId: string;
  phase: TopicPhase;
  stability: TopicStability;
}): SandboxEnvironmentState {
  const track: SandboxStateTrack = {
    phase: input.phase,
    stability: input.stability,
    route: "normal_training",
    targetedRediagnosisPhase: null,
  };
  return {
    trajectoryId: input.trajectoryId,
    canonicalStudent: { ...track },
    specialistRecorded: { ...track },
    sessionNumber: 1,
    completedRepCount: 0,
    divergenceActive: false,
  };
}

const trackFromAuthority = (authority: SandboxStateAuthorityOutcome): SandboxStateTrack => ({
  phase: authority.nextPhase,
  stability: authority.nextStability,
  route: authority.route,
  targetedRediagnosisPhase:
    authority.route === "targeted_rediagnosis" ? authority.targetPhase : null,
});

export function applySandboxSessionAuthority(input: {
  state: SandboxEnvironmentState;
  canonicalAuthority: SandboxStateAuthorityOutcome;
  specialistAuthority: SandboxStateAuthorityOutcome;
}): SandboxEnvironmentState {
  const canonicalStudent = trackFromAuthority(input.canonicalAuthority);
  const specialistRecorded = trackFromAuthority(input.specialistAuthority);
  const divergenceActive =
    canonicalStudent.phase !== specialistRecorded.phase ||
    canonicalStudent.stability !== specialistRecorded.stability ||
    canonicalStudent.route !== specialistRecorded.route ||
    canonicalStudent.targetedRediagnosisPhase !== specialistRecorded.targetedRediagnosisPhase;

  return {
    ...input.state,
    canonicalStudent,
    specialistRecorded,
    sessionNumber: input.state.sessionNumber + 1,
    divergenceActive,
  };
}

export function advanceSandboxRep(
  state: SandboxEnvironmentState,
  increment = 1,
): SandboxEnvironmentState {
  return {
    ...state,
    completedRepCount: state.completedRepCount + Math.max(0, increment),
  };
}

export function sandboxCapabilityNeeds(
  readiness: SandboxCapabilityReadiness,
): SandboxSpecialistCapabilityId[] {
  if (!readiness.earliestUnsupportedCapability) return [];
  const index = SANDBOX_SPECIALIST_CAPABILITY_ORDER.indexOf(
    readiness.earliestUnsupportedCapability,
  );
  return SANDBOX_SPECIALIST_CAPABILITY_ORDER.slice(0, index + 1);
}

export function uniqueSandboxOutcomeCoverage(outcomes: SandboxOutcomeDefinition[]) {
  return {
    phases: unique(outcomes.map((outcome) => outcome.phase)),
    repKeys: unique(
      outcomes.map(
        (outcome) => `${outcome.phase}::${outcome.setId}::${outcome.repNumber}`,
      ),
    ),
    outcomeKeys: unique(outcomes.map((outcome) => outcome.outcomeKey)),
  };
}
