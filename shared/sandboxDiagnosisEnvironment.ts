import {
  DIAGNOSIS_PROBES,
  createEvidenceCompleteDiagnosisState,
  evaluateEvidenceCompleteDiagnosis,
  isDiagnosisBaselineTimingOpportunity,
  isDiagnosisTimedProbe,
  recordEvidenceCompleteDiagnosisProbe,
  type DiagnosisBehaviorClass,
  type DiagnosisDimensionId,
  type DiagnosisProbeId,
  type DiagnosisProbeResult,
  type DiagnosisSupportEvent,
  type EvidenceCompleteDiagnosisDecision,
  type EvidenceCompleteDiagnosisState,
} from "./evidenceCompleteDiagnosis";
import {
  getDiagnosisObservationOption,
} from "./diagnosisObservationMatrix";
import {
  buildPassiveExecutionTimingEvidence,
  buildTimedExecutionEvidence,
} from "./tpsTimingContract";
import type { TopicPhase } from "./topicConditioningEngine";
import type {
  SandboxCapabilityLayer,
  SandboxCapabilityOccurrence,
} from "./sandboxEnvironment";

export const SANDBOX_DIAGNOSIS_SUPPORT_EVENTS: Array<{
  id: DiagnosisSupportEvent;
  label: string;
  detail: string;
}> = [
  {
    id: "none",
    label: "No support",
    detail: "Presented the probe and observed without supplying mathematical content.",
  },
  {
    id: "neutral_clarification",
    label: "Neutral clarification",
    detail: "Clarified wording without supplying a method, step, or answer.",
  },
  {
    id: "first_step_confirmation",
    label: "First-step confirmation",
    detail: "Confirmed or supplied the opening step. The probe becomes contaminated for diagnosis authority.",
  },
  {
    id: "teaching",
    label: "Teaching / rescue",
    detail: "Taught, corrected, or rescued the response. The probe becomes contaminated for diagnosis authority.",
  },
];

export type SandboxDiagnosisCanonicalObservation = {
  dimensionId: DiagnosisDimensionId;
  behaviorId: string;
};

export type SandboxDiagnosisOutcomeDefinition = {
  key: string;
  version: number;
  probeId: DiagnosisProbeId;
  studentBehavior: string;
  canonicalObservations: SandboxDiagnosisCanonicalObservation[];
  trajectoryClass: DiagnosisBehaviorClass;
  weight: number;
  simulatedElapsedSeconds: number;
  challengeCapabilities?: SandboxCapabilityLayer[];
  allowedStartingPhases?: TopicPhase[];
};

export type SandboxDiagnosisOutcomeSelectionContext = {
  startingPhase: TopicPhase;
  probeId: DiagnosisProbeId;
  sequenceNumber: number;
  earliestUnsupportedCapability?: SandboxCapabilityLayer | null;
  recentOutcomeKeys?: string[];
};

export type SandboxDiagnosisSubmittedProbe = {
  probeId: DiagnosisProbeId;
  observations: SandboxDiagnosisCanonicalObservation[];
  supportEvent: DiagnosisSupportEvent;
};

export type SandboxDiagnosisProbeComparison = {
  totalObservations: number;
  matchingObservations: number;
  observationExact: boolean;
  conditionConformed: boolean;
  capabilityEvidence: SandboxCapabilityOccurrence[];
};

export type SandboxDiagnosisDecisionComparison = {
  canonicalDecision: EvidenceCompleteDiagnosisDecision;
  specialistDecision: EvidenceCompleteDiagnosisDecision;
  authorityAligned: boolean;
  placementAligned: boolean;
  capabilityEvidence: SandboxCapabilityOccurrence[];
};

const hashUnit = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0xffffffff;
};

export function validateSandboxDiagnosisOutcomeDefinition(
  definition: SandboxDiagnosisOutcomeDefinition,
) {
  if (!definition.key.trim()) throw new Error("Sandbox diagnosis outcome key is required.");
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new Error("Sandbox diagnosis outcome version must be a positive integer.");
  }
  if (!(definition.probeId in DIAGNOSIS_PROBES)) {
    throw new Error("Sandbox diagnosis outcome probe is invalid.");
  }
  if (!definition.studentBehavior.trim()) {
    throw new Error("Sandbox diagnosis student behaviour is required.");
  }
  if (!Number.isFinite(definition.weight) || definition.weight <= 0) {
    throw new Error("Sandbox diagnosis outcome weight must be positive.");
  }
  if (!Number.isFinite(definition.simulatedElapsedSeconds) || definition.simulatedElapsedSeconds <= 0) {
    throw new Error("Sandbox diagnosis outcome elapsed seconds must be positive.");
  }

  const probe = DIAGNOSIS_PROBES[definition.probeId];
  const expected = new Set(probe.dimensions);
  const seen = new Set<DiagnosisDimensionId>();
  for (const observation of definition.canonicalObservations) {
    if (!expected.has(observation.dimensionId)) {
      throw new Error(
        `Sandbox diagnosis outcome ${definition.key} cannot observe ${observation.dimensionId}.`,
      );
    }
    if (seen.has(observation.dimensionId)) {
      throw new Error(
        `Sandbox diagnosis outcome ${definition.key} duplicates ${observation.dimensionId}.`,
      );
    }
    seen.add(observation.dimensionId);
    if (!getDiagnosisObservationOption(observation.dimensionId, observation.behaviorId)) {
      throw new Error(
        `Sandbox diagnosis outcome ${definition.key} has an invalid behavior for ${observation.dimensionId}.`,
      );
    }
  }
  for (const dimensionId of probe.dimensions) {
    if (!seen.has(dimensionId)) {
      throw new Error(
        `Sandbox diagnosis outcome ${definition.key} is missing ${dimensionId}.`,
      );
    }
  }
}

export function selectSandboxDiagnosisOutcome(input: {
  seed: string;
  outcomes: SandboxDiagnosisOutcomeDefinition[];
  context: SandboxDiagnosisOutcomeSelectionContext;
}) {
  const compatible = input.outcomes.filter((definition) => {
    validateSandboxDiagnosisOutcomeDefinition(definition);
    return (
      definition.probeId === input.context.probeId &&
      (!definition.allowedStartingPhases?.length ||
        definition.allowedStartingPhases.includes(input.context.startingPhase))
    );
  });
  if (!compatible.length) {
    throw new Error(
      `Sandbox diagnosis matrix has no plausible outcomes for ${input.context.probeId}.`,
    );
  }

  const recent = new Set(input.context.recentOutcomeKeys || []);
  const nonRepeated = compatible.filter((definition) => !recent.has(definition.key));
  const repetitionEligible = nonRepeated.length ? nonRepeated : compatible;
  const target = input.context.earliestUnsupportedCapability || null;
  const targeted = target
    ? repetitionEligible.filter((definition) =>
        definition.challengeCapabilities?.includes(target)
      )
    : [];
  const candidates = targeted.length ? targeted : repetitionEligible;

  return [...candidates].sort((a, b) => {
    const score = (definition: SandboxDiagnosisOutcomeDefinition) =>
      hashUnit(
        [
          input.seed,
          input.context.sequenceNumber,
          input.context.startingPhase,
          input.context.probeId,
          definition.key,
          definition.version,
        ].join(":"),
      ) / Math.max(0.05, definition.weight);
    return score(a) - score(b) || a.key.localeCompare(b.key);
  })[0];
}

export function sandboxDiagnosisSupportPreservesCondition(
  supportEvent: DiagnosisSupportEvent,
) {
  return supportEvent === "none" || supportEvent === "neutral_clarification";
}

export function compareSandboxDiagnosisProbe(input: {
  sequenceNumber: number;
  sessionNumber: number;
  phase: TopicPhase;
  outcome: SandboxDiagnosisOutcomeDefinition;
  submitted: SandboxDiagnosisSubmittedProbe;
}): SandboxDiagnosisProbeComparison {
  validateSandboxDiagnosisOutcomeDefinition(input.outcome);
  if (input.submitted.probeId !== input.outcome.probeId) {
    throw new Error("Sandbox diagnosis submission does not match the prescribed probe.");
  }

  const canonical = new Map(
    input.outcome.canonicalObservations.map((observation) => [
      observation.dimensionId,
      observation.behaviorId,
    ]),
  );
  const submitted = new Map(
    input.submitted.observations.map((observation) => [
      observation.dimensionId,
      observation.behaviorId,
    ]),
  );
  let matchingObservations = 0;
  for (const [dimensionId, behaviorId] of canonical) {
    if (submitted.get(dimensionId) === behaviorId) matchingObservations += 1;
  }
  const totalObservations = canonical.size;
  const observationExact =
    submitted.size === canonical.size && matchingObservations === totalObservations;
  const conditionConformed = sandboxDiagnosisSupportPreservesCondition(
    input.submitted.supportEvent,
  );

  const occurrence = (
    layer: SandboxCapabilityLayer,
    evidenceClass: SandboxCapabilityOccurrence["evidenceClass"],
    reason: string,
  ): SandboxCapabilityOccurrence => ({
    layer,
    evidenceClass,
    sequenceNumber: input.sequenceNumber,
    sessionNumber: input.sessionNumber,
    phase: input.phase,
    setId: input.outcome.probeId,
    repNumber: 1,
    reason,
  });

  return {
    totalObservations,
    matchingObservations,
    observationExact,
    conditionConformed,
    capabilityEvidence: [
      occurrence(
        "condition_integrity",
        conditionConformed ? "supported" : "breakdown",
        conditionConformed
          ? "The targeted diagnosis probe condition was preserved."
          : "The targeted diagnosis probe was contaminated by mathematical support.",
      ),
      occurrence(
        "observation_integrity",
        observationExact ? "supported" : "breakdown",
        observationExact
          ? "The Specialist recorded the concrete diagnosis behavior that occurred."
          : "At least one diagnosis behavior observation differed from canonical simulated truth.",
      ),
      occurrence(
        "evidence_integrity",
        observationExact ? "supported" : "breakdown",
        observationExact
          ? "The diagnosis behavior record preserved the evidence class carried by the observed behavior."
          : "The diagnosis record changed decision-relevant evidence truth.",
      ),
    ],
  };
}

function syntheticTimingWindow(sequenceNumber: number, elapsedSeconds: number) {
  const baseMs = Date.UTC(2030, 0, 1, 9, 0, 0) + sequenceNumber * 120_000;
  const startedAt = new Date(baseMs).toISOString();
  const endedAt = new Date(baseMs + Math.max(1, Math.round(elapsedSeconds * 1000))).toISOString();
  return { startedAt, endedAt };
}

export function buildSandboxDiagnosisProbeResult(input: {
  outcome: SandboxDiagnosisOutcomeDefinition;
  observations: SandboxDiagnosisCanonicalObservation[];
  supportEvent: DiagnosisSupportEvent;
  sequenceNumber: number;
  timingBaselineSeconds: number | null;
}): DiagnosisProbeResult {
  const result: DiagnosisProbeResult = {
    probeId: input.outcome.probeId,
    observations: input.observations,
    supportEvent: input.supportEvent,
  };

  if (isDiagnosisBaselineTimingOpportunity(input.outcome.probeId)) {
    const window = syntheticTimingWindow(
      input.sequenceNumber,
      input.outcome.simulatedElapsedSeconds,
    );
    const passiveTiming = buildPassiveExecutionTimingEvidence(window);
    if (!passiveTiming) throw new Error("Sandbox diagnosis passive timing could not be built.");
    result.passiveTiming = passiveTiming;
  }

  if (isDiagnosisTimedProbe(input.outcome.probeId)) {
    if (!input.timingBaselineSeconds || input.timingBaselineSeconds <= 0) {
      throw new Error("Sandbox diagnosis timed probe requires timing authority.");
    }
    const elapsed = Math.max(
      1,
      Math.min(
        input.outcome.simulatedElapsedSeconds,
        input.timingBaselineSeconds * 1.35,
      ),
    );
    const window = syntheticTimingWindow(input.sequenceNumber, elapsed);
    const timedTiming = buildTimedExecutionEvidence({
      ...window,
      prescribedSeconds: input.timingBaselineSeconds,
    });
    if (!timedTiming) throw new Error("Sandbox diagnosis timed evidence could not be built.");
    result.timedTiming = timedTiming;
  }

  return result;
}

export function rebuildSandboxDiagnosisState(input: {
  startingPhase: TopicPhase;
  history: DiagnosisProbeResult[];
  inheritedTimingBaselineSeconds?: number | null;
}): EvidenceCompleteDiagnosisState {
  let state = createEvidenceCompleteDiagnosisState(
    input.startingPhase,
    input.inheritedTimingBaselineSeconds || null,
  );
  for (const result of input.history) {
    state = recordEvidenceCompleteDiagnosisProbe(state, result);
  }
  return state;
}

const diagnosisDecisionsAlign = (
  canonical: EvidenceCompleteDiagnosisDecision,
  specialist: EvidenceCompleteDiagnosisDecision,
) =>
  canonical.complete === specialist.complete &&
  canonical.nextProbeId === specialist.nextProbeId &&
  canonical.placementPhase === specialist.placementPhase &&
  canonical.stability === specialist.stability;

export function compareSandboxDiagnosisDecisions(input: {
  canonicalState: EvidenceCompleteDiagnosisState;
  specialistState: EvidenceCompleteDiagnosisState;
  sequenceNumber: number;
  sessionNumber: number;
  phase: TopicPhase;
  probeId: DiagnosisProbeId;
}): SandboxDiagnosisDecisionComparison {
  const canonicalDecision = evaluateEvidenceCompleteDiagnosis(input.canonicalState);
  const specialistDecision = evaluateEvidenceCompleteDiagnosis(input.specialistState);
  const authorityAligned = diagnosisDecisionsAlign(canonicalDecision, specialistDecision);
  const placementAligned =
    canonicalDecision.complete &&
    specialistDecision.complete &&
    canonicalDecision.placementPhase === specialistDecision.placementPhase &&
    canonicalDecision.stability === specialistDecision.stability;

  const occurrence = (
    layer: SandboxCapabilityLayer,
    evidenceClass: SandboxCapabilityOccurrence["evidenceClass"],
    reason: string,
  ): SandboxCapabilityOccurrence => ({
    layer,
    evidenceClass,
    sequenceNumber: input.sequenceNumber,
    sessionNumber: input.sessionNumber,
    phase: input.phase,
    setId: input.probeId,
    repNumber: 1,
    reason,
  });

  const continuityEvidence =
    canonicalDecision.complete
      ? placementAligned
        ? "supported"
        : "breakdown"
      : authorityAligned
        ? "near_stable"
        : "breakdown";

  return {
    canonicalDecision,
    specialistDecision,
    authorityAligned,
    placementAligned,
    capabilityEvidence: [
      occurrence(
        "authority_integrity",
        authorityAligned ? "supported" : "breakdown",
        authorityAligned
          ? "The Specialist diagnosis record preserved the canonical RI diagnosis authority."
          : "The Specialist diagnosis record caused the RI diagnosis route or placement to diverge.",
      ),
      occurrence(
        "continuity_integrity",
        continuityEvidence,
        continuityEvidence === "supported"
          ? "Targeted re-diagnosis restored aligned RI placement truth."
          : continuityEvidence === "near_stable"
            ? "Diagnosis remains aligned but has not yet resolved the longitudinal placement."
            : "Targeted re-diagnosis did not preserve canonical longitudinal RI truth.",
      ),
    ],
  };
}
