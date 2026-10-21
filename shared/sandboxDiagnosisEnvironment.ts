import { hasSandboxDevelopmentPlan, sandboxDevelopmentLessons, sandboxProfileDifficultyPhase, sandboxDevelopmentDraw } from "./sandboxDevelopmentPlan";
import { resolveSandboxBehaviorProfile } from "./sandboxBehaviorProfiles";
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
  DIAGNOSIS_OBSERVATION_MATRIX,
} from "./diagnosisObservationMatrix";
import {
  buildPassiveExecutionTimingEvidence,
  buildTimedExecutionEvidence,
} from "./tpsTimingContract";
import { sandboxBehaviorProfileMultiplier } from "./sandboxBehaviorProfiles";
import { renderSandboxDiagnosisExceptionNarrativeV2 } from "./sandboxDiagnosisExceptionNarrativesV2";
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
  /** V1 preserves issued diagnostic outcomes; V2 uses the student's profile. */
  behaviorModelVersion?: 1 | 2;
  continuityTags?: string[];
  developmentTopicKey?: string;
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
  /** Trajectory-level identity, independent of per-probe Handover/Diagnosis salt. */
  profileSeed?: string;
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

  // Diagnosis and Handover use the same V2 doctrine as Training:
  // "not observed" is a factual evidence status entered when an observation
  // genuinely cannot be established; it is NOT a fictional student scenario.
  // Keep legacy V1 cases available only to historical V1 trajectories.
  //
  // A visibly consulted worked example is the one authored V2 confound.
  // Its deterministic 2% eligibility window is an upper bound on when that
  // event may compete with ordinary cases, not a quota or real-world rate.
  const v2ConfoundEligibilityWindow =
    input.context.behaviorModelVersion === 2 &&
    hashUnit([
      "sandbox-v2-rare-diagnosis-integrity-v1",
      input.seed,
      input.context.startingPhase,
      input.context.probeId,
      input.context.sequenceNumber,
    ].join(":")) < 0.02;
  const eligible = input.context.behaviorModelVersion === 2
    ? compatible.filter((definition) => {
        if (
          /\.pattern_7$/.test(definition.key) ||
          definition.trajectoryClass === "not_observed"
        ) return false;
        if (
          (/\.pattern_8$/.test(definition.key) ||
            definition.trajectoryClass === "confounded") &&
          !v2ConfoundEligibilityWindow
        ) return false;
        return true;
      })
    : compatible;
  if (!eligible.length) {
    throw new Error("Sandbox diagnosis has no observable, eligible V2 outcomes; preserve evidence and do not fabricate one.");
  }
  if (hasSandboxDevelopmentPlan(input.context.continuityTags)) {
    if (input.context.behaviorModelVersion !== 2 || !input.profileSeed || !input.context.developmentTopicKey) {
      throw new Error("Sandbox development Diagnosis requires versioned, owned topic context.");
    }
    const phase = DIAGNOSIS_PROBES[input.context.probeId].primaryPhase;
    const lessons = sandboxDevelopmentLessons(input.context.continuityTags!, input.context.developmentTopicKey, phase);
    const weak = sandboxProfileDifficultyPhase(resolveSandboxBehaviorProfile(input.profileSeed)) === phase;
    const desired = weak && lessons === 0 && input.context.probeId !== "stack.normal_independent" ? "conditional" : "supported";
    const scenes = eligible.filter(item => item.trajectoryClass === desired);
    if (!scenes.length) throw new Error(`Sandbox development Diagnosis has no compatible ${desired} response; preserve evidence for scenario repair.`);
    const score = (item: SandboxDiagnosisOutcomeDefinition) => -Math.log(sandboxDevelopmentDraw([
      "sandbox-development-diagnosis-v1", input.seed, input.context.sequenceNumber,
      input.context.probeId, item.key, item.version,
    ].join(":"))) / Math.max(0.05, item.weight);
    const chosen = [...scenes].sort((a,b) => score(a)-score(b) || a.key.localeCompare(b.key))[0];
    // New-plan authoring only. Cross-layer probes must preserve demonstrated
    // prerequisite strengths while exposing the profile's difficulty. The
    // native projector describes every authored dimension before submission;
    // the resulting canonical observations are persisted with the issued turn.
    // This never reinterprets a historical response or assigns a placement.
    return {
      ...chosen,
      studentBehavior: "The student responds to the prescribed probe under its stated conditions.",
      canonicalObservations: chosen.canonicalObservations.map(observation => {
        const dimension = DIAGNOSIS_OBSERVATION_MATRIX[observation.dimensionId];
        const difficulty = dimension.phase === sandboxProfileDifficultyPhase(resolveSandboxBehaviorProfile(input.profileSeed!));
        const dimensionLessons = sandboxDevelopmentLessons(input.context.continuityTags!, input.context.developmentTopicKey!, dimension.phase);
        const behaviorClass = difficulty && dimensionLessons === 0 && input.context.probeId !== "stack.normal_independent" ? "conditional" : "supported";
        const option = dimension.options.find(item => item.behaviorClass === behaviorClass);
        if (!option) throw new Error("Sandbox development Diagnosis lacks an authored dimension response.");
        return { ...observation, behaviorId: option.id };
      }),
    };
  }

  const recent = new Set(input.context.recentOutcomeKeys || []);
  const nonRepeated = eligible.filter((definition) => !recent.has(definition.key));
  const repetitionEligible = nonRepeated.length ? nonRepeated : eligible;
  const target = input.context.earliestUnsupportedCapability || null;
  const targeted = target
    ? repetitionEligible.filter((definition) =>
        definition.challengeCapabilities?.includes(target)
      )
    : [];
  const candidates = targeted.length ? targeted : repetitionEligible;

  const chosen = [...candidates].sort((a, b) => {
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
      ) / Math.max(0.05, definition.weight *
        (input.context.behaviorModelVersion === 2
          ? sandboxBehaviorProfileMultiplier({
              seed: input.profileSeed || input.seed.split(":")[0],
              // Diagnose what this probe observes, not the entry phase.
              phase: DIAGNOSIS_PROBES[input.context.probeId].primaryPhase,
              trajectoryClass: definition.trajectoryClass,
            })
          : 1));
    return score(a) - score(b) || a.key.localeCompare(b.key);
  })[0];

  if (input.context.behaviorModelVersion !== 2) return chosen;
  const studentBehavior = renderSandboxDiagnosisExceptionNarrativeV2(chosen.key);
  if (!studentBehavior) return chosen;
  if (chosen.trajectoryClass !== "not_observed" && chosen.trajectoryClass !== "confounded") {
    throw new Error("A V2 integrity scenario cannot replace an ordinary diagnostic outcome.");
  }

  // A worked model that guides the method also contaminates adjacent
  // independence/repeatability judgments. An on-screen method cue removed
  // before timing starts does not contaminate later timed execution.
  const contaminatedDimensions =
    chosen.key === "execution.repeatability.pattern_8"
      ? ["execution.repeatability", "execution.independence"]
      : chosen.key === "time.consistency.pattern_8"
        ? ["time.completion_integrity"]
        : [];
  const canonicalObservations = chosen.canonicalObservations.map((observation) =>
    contaminatedDimensions.includes(observation.dimensionId)
      ? { ...observation, behaviorId: "confounded" }
      : observation,
  );

  return { ...chosen, studentBehavior, canonicalObservations };
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
  sessionStartProbeIndex?: number;
  inheritedTimingBaselineSeconds?: number | null;
}): EvidenceCompleteDiagnosisState {
  let state = createEvidenceCompleteDiagnosisState(
    input.startingPhase,
    input.inheritedTimingBaselineSeconds || null,
  );
  state.sessionStartProbeIndex = input.sessionStartProbeIndex || 0;
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
