import { PHASES, type TopicPhase, type TopicStability } from "./topicConditioningEngine";
import {
  getDrillSchemaDefinition,
  getDrillSchemaDefinitionByVersion,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getRepPurposeId,
  resolveEvidenceSelection,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import {
  TRAINING_INHERITED_RESCUE_SIGNAL_FIELD,
  TRAINING_INTERVENTION_FIELD,
  TRAINING_PREREQUISITE_SENTINEL_FIELD,
  trainingEvidenceStatusKey,
  type TrainingEvidenceStatus,
  type TrainingInheritedRescueSignal,
  type TrainingInterventionEvent,
  type TrainingPrerequisiteSentinelResult,
} from "./trainingEvidenceCapture";
import {
  evaluateTrainingEvidence,
  resolveTrainingEvidenceAuthorityRoute,
  trainingEvidenceClassForRawBehavior,
  type TrainingEvidenceAuthorityRoute,
} from "./trainingEvidenceEvaluator";
import {
  resolveResponseEvidenceDimension,
  type ResponseEvidenceClass,
  type ResponseEvidenceDimensionState,
} from "./responseEvidenceModel";
import type { TrainingDimensionId } from "./trainingEvidenceContract";

export const SANDBOX_CAPABILITY_LAYERS = [
  "condition_integrity",
  "observation_integrity",
  "evidence_integrity",
  "authority_integrity",
  "continuity_integrity",
] as const;

export type SandboxCapabilityLayer = typeof SANDBOX_CAPABILITY_LAYERS[number];
export type SandboxTrajectoryClass = ResponseEvidenceClass;

export type SandboxCanonicalObservation = {
  optionId: string;
  evidenceStatus?: TrainingEvidenceStatus;
};

export type SandboxOutcomeDefinition = {
  key: string;
  version: number;
  phase: TopicPhase;
  setId: string;
  repNumber: number;
  studentBehavior: string;
  canonicalObservations: Record<string, SandboxCanonicalObservation>;
  canonicalPrerequisiteSentinel?: TrainingPrerequisiteSentinelResult;
  canonicalInheritedRescueSignal?: TrainingInheritedRescueSignal;
  trajectoryClass: SandboxTrajectoryClass;
  weight: number;
  allowedCanonicalPhases?: TopicPhase[];
  allowedCanonicalStabilities?: TopicStability[];
  compatiblePreviousTrajectoryClasses?: SandboxTrajectoryClass[];
  requiresAnyContinuityTags?: string[];
  excludesContinuityTags?: string[];
  emitsContinuityTags?: string[];
  clearsContinuityTags?: string[];
  challengeCapabilities?: SandboxCapabilityLayer[];
};

export type SandboxOutcomeSelectionContext = {
  canonicalPhase: TopicPhase;
  canonicalStability: TopicStability;
  prescribedPhase: TopicPhase;
  setId: string;
  repNumber: number;
  sequenceNumber: number;
  previousTrajectoryClass?: SandboxTrajectoryClass | null;
  continuityTags?: string[];
  earliestUnsupportedCapability?: SandboxCapabilityLayer | null;
  recentOutcomeKeys?: string[];
};

export type SandboxSubmittedObservation = {
  optionId: string;
  evidenceStatus?: TrainingEvidenceStatus;
};

export type SandboxCompletedTurn = {
  sequenceNumber: number;
  sessionNumber: number;
  phase: TopicPhase;
  setId: string;
  repNumber: number;
  outcome: SandboxOutcomeDefinition;
  actualInterventionEvent: TrainingInterventionEvent;
  recordedInterventionEvent: TrainingInterventionEvent;
  conditionConformed: boolean | null;
  specialistObservations: Record<string, SandboxSubmittedObservation>;
  specialistPrerequisiteSentinel?: TrainingPrerequisiteSentinelResult;
  specialistInheritedRescueSignal?: TrainingInheritedRescueSignal;
};

export type SandboxCapabilityOccurrence = {
  layer: SandboxCapabilityLayer;
  evidenceClass: ResponseEvidenceClass;
  sequenceNumber: number;
  sessionNumber: number;
  phase: TopicPhase;
  setId: string;
  repNumber: number;
  reason: string;
};

export type SandboxTurnComparison = {
  totalObservations: number;
  matchingOptions: number;
  matchingEvidenceStatuses: number;
  observationExact: boolean;
  evidenceExact: boolean;
  interventionRecordExact: boolean;
  capabilityEvidence: SandboxCapabilityOccurrence[];
};

export type SandboxSessionEvaluation = {
  canonicalRoute: TrainingEvidenceAuthorityRoute;
  specialistRoute: TrainingEvidenceAuthorityRoute;
  systemOutcomeMatched: boolean;
  canonicalNext: {
    phase: TopicPhase;
    stability: TopicStability;
  };
  specialistNext: {
    phase: TopicPhase;
    stability: TopicStability;
  };
  capabilityEvidence: SandboxCapabilityOccurrence[];
  studentStateAuthoritative: false;
  evidenceScope: "sandbox";
};

export type SandboxCapabilityReadinessPolicyStatus = "candidate" | "approved";

export type SandboxCapabilityReadinessPolicy = {
  policyVersion: number;
  status: SandboxCapabilityReadinessPolicyStatus;
  minimumValidOpportunitiesByCapability: Record<SandboxCapabilityLayer, number>;
  breadth: {
    minimumDistinctPhases: number;
    minimumDistinctSets: number;
    minimumDistinctRepPositions: number;
    minimumCompletedSessions: number;
    requireStateChange: boolean;
    requireBreakdownRecovery: boolean;
  };
  nextStage: "practicals";
};

export type SandboxExposureSummary = {
  distinctPhases: number;
  distinctSets: number;
  distinctRepPositions: number;
  completedSessions: number;
  stateChangeObserved: boolean;
  breakdownRecoveryObserved: boolean;
};

export type SandboxCapabilityLayerStatus = {
  layer: SandboxCapabilityLayer;
  state: ResponseEvidenceDimensionState;
  validOpportunityCount: number;
  supportedCount: number;
  breakdownCount: number;
  recoveredAfterBreakdown: boolean;
  minimumValidOpportunities: number;
  prerequisiteSupported: boolean;
  authoritative: boolean;
};

export type SandboxCapabilityReadinessEvaluation = {
  policyStatus: SandboxCapabilityReadinessPolicyStatus;
  layers: SandboxCapabilityLayerStatus[];
  earliestUnsupportedCapability: SandboxCapabilityLayer | null;
  capabilityEvidenceReady: boolean;
  breadthReady: boolean;
  longitudinalReady: boolean;
  evidenceReady: boolean;
  practicalsReady: boolean;
  automaticTransition: false;
  nextStage: "practicals";
  reason: string;
};

const normalizeStatus = (status?: TrainingEvidenceStatus): TrainingEvidenceStatus =>
  status === "not_observed" || status === "confounded" ? status : "observed";

const nonEmptyStrings = (values?: string[]) =>
  (values || []).map((value) => String(value || "").trim()).filter(Boolean);

const hashUnit = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0xffffffff;
};

export function projectSandboxOutcomeToCurrentTrainingContract(
  definition: SandboxOutcomeDefinition,
  sourceTrainingSchemaVersion: number,
): SandboxOutcomeDefinition {
  const currentSchema = getDrillSchemaDefinition("training", definition.phase);
  if (sourceTrainingSchemaVersion === currentSchema.schemaVersion) {
    return definition;
  }

  const sourceSchema = getDrillSchemaDefinitionByVersion(
    "training",
    definition.phase,
    sourceTrainingSchemaVersion,
  );
  if (!sourceSchema) {
    throw new Error(
      `Sandbox outcome ${definition.key} references unsupported Training schema v${sourceTrainingSchemaVersion}.`,
    );
  }

  const sourceSet = sourceSchema.sets.find(
    (candidate) => candidate.setId === definition.setId,
  );
  const currentSet = currentSchema.sets.find(
    (candidate) => candidate.setId === definition.setId,
  );
  if (!sourceSet || !currentSet) {
    throw new Error(
      `Sandbox outcome ${definition.key} cannot reconcile Training set ${definition.setId}.`,
    );
  }

  const repIndex = definition.repNumber - 1;
  const canonicalObservations = Object.fromEntries(
    Object.entries(definition.canonicalObservations).map(
      ([fieldKey, canonical]) => {
        const sourceResolved = resolveEvidenceSelection({
          mode: "training",
          phase: definition.phase,
          setId: definition.setId,
          repIndex,
          fieldKey,
          optionId: canonical.optionId,
          schemaVersion: sourceTrainingSchemaVersion,
        });
        if (!sourceResolved) {
          throw new Error(
            `Sandbox outcome ${definition.key} has an invalid historical option for ${fieldKey}.`,
          );
        }

        const rawLabel =
          sourceResolved.field.optionLabels?.[sourceResolved.optionIndex] || "";
        const evidenceClass =
          sourceResolved.evidenceClass ||
          trainingEvidenceClassForRawBehavior(
            sourceResolved.field.dimensionId as TrainingDimensionId,
            rawLabel,
          );
        if (
          !evidenceClass ||
          evidenceClass === "not_observed" ||
          evidenceClass === "confounded"
        ) {
          throw new Error(
            `Sandbox outcome ${definition.key} cannot reconcile ${fieldKey} into a decision evidence class.`,
          );
        }

        const currentField = getFieldDefinitionForRep(
          currentSet,
          repIndex,
          fieldKey,
        );
        if (!currentField) {
          throw new Error(
            `Sandbox outcome ${definition.key} is missing current field ${fieldKey}.`,
          );
        }
        const optionIndex =
          currentField.optionEvidenceClasses?.findIndex(
            (candidate) => candidate === evidenceClass,
          ) ?? -1;
        if (optionIndex < 0) {
          throw new Error(
            `Sandbox outcome ${definition.key} cannot map ${fieldKey} ${evidenceClass} into Training V${currentSchema.schemaVersion}.`,
          );
        }

        const identity = getEvidenceSelectionIdentity({
          mode: "training",
          phase: definition.phase,
          setName: currentSet.setName,
          repIndex,
          fieldKey,
          optionIndex,
        });
        if (!identity) {
          throw new Error(
            `Sandbox outcome ${definition.key} could not resolve current option identity for ${fieldKey}.`,
          );
        }

        return [
          fieldKey,
          {
            optionId: identity.optionId,
            evidenceStatus: canonical.evidenceStatus,
          },
        ];
      },
    ),
  );

  return {
    ...definition,
    canonicalObservations,
  };
}

export function validateSandboxOutcomeDefinition(definition: SandboxOutcomeDefinition) {
  if (!definition.key.trim()) throw new Error("Sandbox outcome key is required.");
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new Error("Sandbox outcome version must be a positive integer.");
  }
  if (!definition.studentBehavior.trim()) {
    throw new Error("Sandbox outcome student behaviour is required.");
  }
  if (!Number.isFinite(definition.weight) || definition.weight <= 0) {
    throw new Error("Sandbox outcome weight must be positive.");
  }
  if (!PHASES.includes(definition.phase)) {
    throw new Error("Sandbox outcome phase is invalid.");
  }

  const schema = getDrillSchemaDefinition("training", definition.phase);
  const set = schema.sets.find((candidate) => candidate.setId === definition.setId);
  if (!set || set.modelingOnly) {
    throw new Error(`Sandbox outcome set ${definition.setId} is not a scored ${definition.phase} Training set.`);
  }
  if (!Number.isInteger(definition.repNumber) || definition.repNumber < 1 || definition.repNumber > set.reps) {
    throw new Error(`Sandbox outcome rep ${definition.repNumber} is invalid for ${definition.setId}.`);
  }

  const repIndex = definition.repNumber - 1;
  for (const baseField of set.fields) {
    const field = getFieldDefinitionForRep(set, repIndex, baseField.fieldKey) || baseField;
    const canonical = definition.canonicalObservations[field.fieldKey];
    if (!canonical?.optionId) {
      throw new Error(
        `Sandbox outcome ${definition.key} is missing canonical observation ${field.fieldKey}.`,
      );
    }
    const resolved = resolveEvidenceSelection({
      mode: "training",
      phase: definition.phase,
      setId: definition.setId,
      repIndex,
      fieldKey: field.fieldKey,
      optionId: canonical.optionId,
      schemaVersion: schema.schemaVersion,
    });
    if (!resolved) {
      throw new Error(
        `Sandbox outcome ${definition.key} has an invalid option for ${field.fieldKey}.`,
      );
    }
    normalizeStatus(canonical.evidenceStatus);
  }

  const canonicalKeys = Object.keys(definition.canonicalObservations);
  const registeredKeys = set.fields.map((field) => field.fieldKey);
  for (const key of canonicalKeys) {
    if (!registeredKeys.includes(key)) {
      throw new Error(`Sandbox outcome ${definition.key} contains unknown observation ${key}.`);
    }
  }

  for (const phase of definition.allowedCanonicalPhases || []) {
    if (!PHASES.includes(phase)) throw new Error("Sandbox outcome has an invalid canonical-phase constraint.");
  }
  for (const capability of definition.challengeCapabilities || []) {
    if (!SANDBOX_CAPABILITY_LAYERS.includes(capability)) {
      throw new Error("Sandbox outcome has an invalid Specialist capability target.");
    }
  }
}

const matchesContinuity = (
  definition: SandboxOutcomeDefinition,
  context: SandboxOutcomeSelectionContext,
) => {
  if (
    definition.allowedCanonicalPhases?.length &&
    !definition.allowedCanonicalPhases.includes(context.canonicalPhase)
  ) return false;
  if (
    definition.allowedCanonicalStabilities?.length &&
    !definition.allowedCanonicalStabilities.includes(context.canonicalStability)
  ) return false;
  if (
    definition.compatiblePreviousTrajectoryClasses?.length &&
    context.previousTrajectoryClass &&
    !definition.compatiblePreviousTrajectoryClasses.includes(context.previousTrajectoryClass)
  ) return false;

  const tags = new Set(nonEmptyStrings(context.continuityTags));
  const required = nonEmptyStrings(definition.requiresAnyContinuityTags);
  if (required.length && !required.some((tag) => tags.has(tag))) return false;
  if (nonEmptyStrings(definition.excludesContinuityTags).some((tag) => tags.has(tag))) return false;
  return true;
};

export function selectSandboxOutcome(input: {
  seed: string;
  outcomes: SandboxOutcomeDefinition[];
  context: SandboxOutcomeSelectionContext;
}): SandboxOutcomeDefinition {
  const baseCandidates = input.outcomes.filter((definition) =>
    definition.phase === input.context.prescribedPhase &&
    definition.setId === input.context.setId &&
    definition.repNumber === input.context.repNumber
  );
  if (!baseCandidates.length) {
    throw new Error(
      `Sandbox Outcome Matrix has no outcomes for ${input.context.prescribedPhase} / ${input.context.setId} / rep ${input.context.repNumber}.`,
    );
  }

  const compatible = baseCandidates.filter((definition) => matchesContinuity(definition, input.context));
  if (!compatible.length) {
    throw new Error(
      `Sandbox Outcome Matrix has no state-compatible outcomes for ${input.context.prescribedPhase} / ${input.context.setId} / rep ${input.context.repNumber}.`,
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
  // Capability targeting is an eligibility preference, not a weak score bonus.
  // If a plausible non-repeated outcome can expose the earliest unsupported
  // Specialist layer, choose within that pool. Only fall back to the wider
  // plausible pool when this rep genuinely cannot expose the target.
  const candidates = targeted.length ? targeted : repetitionEligible;

  return [...candidates].sort((a, b) => {
    const scoreFor = (definition: SandboxOutcomeDefinition) =>
      hashUnit(
        [
          input.seed,
          input.context.sequenceNumber,
          input.context.prescribedPhase,
          input.context.setId,
          input.context.repNumber,
          definition.key,
          definition.version,
        ].join(":"),
      ) / Math.max(0.05, definition.weight);
    return scoreFor(a) - scoreFor(b) || a.key.localeCompare(b.key);
  })[0];
}

export function nextSandboxContinuityState(input: {
  currentTags?: string[];
  outcome: SandboxOutcomeDefinition;
}) {
  const tags = new Set(nonEmptyStrings(input.currentTags));
  for (const tag of nonEmptyStrings(input.outcome.clearsContinuityTags)) tags.delete(tag);
  for (const tag of nonEmptyStrings(input.outcome.emitsContinuityTags)) tags.add(tag);
  return {
    trajectoryClass: input.outcome.trajectoryClass,
    continuityTags: [...tags].sort(),
  };
}

export function compareSandboxTurn(turn: SandboxCompletedTurn): SandboxTurnComparison {
  validateSandboxOutcomeDefinition(turn.outcome);
  const canonical = turn.outcome.canonicalObservations;
  const fieldKeys = Object.keys(canonical);
  let matchingOptions = 0;
  let matchingEvidenceStatuses = 0;

  for (const fieldKey of fieldKeys) {
    const expected = canonical[fieldKey];
    const recorded = turn.specialistObservations[fieldKey];
    if (recorded?.optionId === expected.optionId) matchingOptions += 1;
    if (normalizeStatus(recorded?.evidenceStatus) === normalizeStatus(expected.evidenceStatus)) {
      matchingEvidenceStatuses += 1;
    }
  }

  const observationExact = matchingOptions === fieldKeys.length;
  const interventionRecordExact =
    turn.recordedInterventionEvent === turn.actualInterventionEvent;
  const prerequisiteSentinelExact =
    (turn.specialistPrerequisiteSentinel || null) ===
    (turn.outcome.canonicalPrerequisiteSentinel || null);
  const inheritedRescueSignalExact =
    (turn.specialistInheritedRescueSignal || null) ===
    (turn.outcome.canonicalInheritedRescueSignal || null);
  const evidenceExact =
    observationExact &&
    matchingEvidenceStatuses === fieldKeys.length &&
    interventionRecordExact &&
    prerequisiteSentinelExact &&
    inheritedRescueSignalExact;

  const event = (
    layer: SandboxCapabilityLayer,
    evidenceClass: ResponseEvidenceClass,
    reason: string,
  ): SandboxCapabilityOccurrence => ({
    layer,
    evidenceClass,
    sequenceNumber: turn.sequenceNumber,
    sessionNumber: turn.sessionNumber,
    phase: turn.phase,
    setId: turn.setId,
    repNumber: turn.repNumber,
    reason,
  });

  const conditionClass: ResponseEvidenceClass =
    turn.conditionConformed === null
      ? "not_observed"
      : turn.conditionConformed
        ? "supported"
        : "breakdown";

  return {
    totalObservations: fieldKeys.length,
    matchingOptions,
    matchingEvidenceStatuses,
    observationExact,
    evidenceExact,
    interventionRecordExact,
    capabilityEvidence: [
      event(
        "condition_integrity",
        conditionClass,
        turn.conditionConformed === null
          ? "The opportunity did not establish whether the prescribed condition was preserved."
          : turn.conditionConformed
            ? "The prescribed condition was preserved."
            : "The prescribed condition was materially changed.",
      ),
      event(
        "observation_integrity",
        observationExact ? "supported" : "breakdown",
        observationExact
          ? "Recorded concrete behaviour matched the simulated student behaviour."
          : "At least one concrete behaviour observation did not match what occurred.",
      ),
      event(
        "evidence_integrity",
        evidenceExact ? "supported" : "breakdown",
        evidenceExact
          ? "Observation status, intervention truth, prerequisite verification, and rescue-signal truth preserved decision eligibility."
          : "The evidence record changed, omitted, or overclaimed decision-relevant truth, including any required prerequisite or rescue evidence.",
      ),
    ],
  };
}

const evidenceRowForTurn = (
  turn: SandboxCompletedTurn,
  source: "canonical" | "specialist",
): Record<string, string> => {
  const schema = getDrillSchemaDefinition("training", turn.phase);
  const set = schema.sets.find((candidate) => candidate.setId === turn.setId);
  if (!set) throw new Error(`Unknown Sandbox Training set ${turn.setId}.`);
  const repIndex = turn.repNumber - 1;
  const row: Record<string, string> = {
    _rep_id: getRepPurposeId(set, repIndex),
    _rep_number: String(turn.repNumber),
    [TRAINING_INTERVENTION_FIELD]:
      source === "canonical" ? turn.actualInterventionEvent : turn.recordedInterventionEvent,
  };

  const observations =
    source === "canonical" ? turn.outcome.canonicalObservations : turn.specialistObservations;

  for (const baseField of set.fields) {
    const field = getFieldDefinitionForRep(set, repIndex, baseField.fieldKey) || baseField;
    const selected = observations[field.fieldKey];
    if (!selected?.optionId) {
      throw new Error(
        `Sandbox ${source} evidence is missing ${turn.setId} rep ${turn.repNumber} ${field.fieldKey}.`,
      );
    }
    const resolved = resolveEvidenceSelection({
      mode: "training",
      phase: turn.phase,
      setId: turn.setId,
      repIndex,
      fieldKey: field.fieldKey,
      optionId: selected.optionId,
      schemaVersion: schema.schemaVersion,
    });
    if (!resolved) {
      throw new Error(
        `Sandbox ${source} evidence selected an invalid option for ${field.fieldKey}.`,
      );
    }
    const rawOption = resolved.field.optionLabels?.[resolved.optionIndex];
    if (!rawOption) throw new Error("Sandbox evidence option has no registered raw label.");

    row[field.fieldKey] = rawOption;
    row[`${field.fieldKey}_option_id`] = selected.optionId;
    row[`${field.fieldKey}_dimension_id`] = resolved.field.dimensionId;
    row[`${field.fieldKey}_level`] = resolved.level;
    if (resolved.evidenceClass) {
      row[`${field.fieldKey}_evidence_class`] = resolved.evidenceClass;
    }
    row[trainingEvidenceStatusKey(field.fieldKey)] = normalizeStatus(selected.evidenceStatus);
  }

  const prerequisite =
    source === "canonical"
      ? turn.outcome.canonicalPrerequisiteSentinel
      : turn.specialistPrerequisiteSentinel;
  if (prerequisite) row[TRAINING_PREREQUISITE_SENTINEL_FIELD] = prerequisite;

  const rescue =
    source === "canonical"
      ? turn.outcome.canonicalInheritedRescueSignal
      : turn.specialistInheritedRescueSignal;
  if (rescue) row[TRAINING_INHERITED_RESCUE_SIGNAL_FIELD] = rescue;

  return row;
};

export function materializeSandboxTrainingEvidence(input: {
  phase: TopicPhase;
  turns: SandboxCompletedTurn[];
  source: "canonical" | "specialist";
}): SubmittedEvidenceSet[] {
  const schema = getDrillSchemaDefinition("training", input.phase);
  const relevant = input.turns.filter((turn) => turn.phase === input.phase);

  return schema.sets.map((set, setIndex) => {
    const observations = set.modelingOnly
      ? []
      : Array.from({ length: set.reps }, (_, repIndex) => {
          const turn = relevant.find(
            (candidate) =>
              candidate.setId === set.setId && candidate.repNumber === repIndex + 1,
          );
          if (!turn) {
            throw new Error(
              `Sandbox session is missing ${set.setId} rep ${repIndex + 1}.`,
            );
          }
          return evidenceRowForTurn(turn, input.source);
        });

    return {
      setName: set.setName,
      setId: set.setId,
      setOrder: setIndex + 1,
      drillSchemaId: schema.schemaId,
      drillSchemaVersion: schema.schemaVersion,
      drillDefinitionHash: schema.definitionHash,
      constraintProfile: { ...set.constraints },
      observations,
    };
  });
}

const routesMatch = (
  a: TrainingEvidenceAuthorityRoute,
  b: TrainingEvidenceAuthorityRoute,
) =>
  a.route === b.route &&
  a.nextPhase === b.nextPhase &&
  a.nextStability === b.nextStability &&
  a.targetPhase === b.targetPhase;

export function evaluateSandboxCompletedSession(input: {
  phase: TopicPhase;
  canonicalPreviousStability: TopicStability;
  specialistPreviousStability: TopicStability;
  turns: SandboxCompletedTurn[];
  priorCompletedSessions: number;
  priorTracksDiverged: boolean;
}): SandboxSessionEvaluation {
  const canonicalEvidence = materializeSandboxTrainingEvidence({
    phase: input.phase,
    turns: input.turns,
    source: "canonical",
  });
  const specialistEvidence = materializeSandboxTrainingEvidence({
    phase: input.phase,
    turns: input.turns,
    source: "specialist",
  });

  const canonicalEvaluation = evaluateTrainingEvidence({
    phase: input.phase,
    previousStability: input.canonicalPreviousStability,
    sets: canonicalEvidence,
  });
  const specialistEvaluation = evaluateTrainingEvidence({
    phase: input.phase,
    previousStability: input.specialistPreviousStability,
    sets: specialistEvidence,
  });

  if (canonicalEvaluation.status !== "evaluated") {
    throw new Error(`Canonical Sandbox session evidence is unavailable: ${canonicalEvaluation.reason}`);
  }
  if (specialistEvaluation.status !== "evaluated") {
    throw new Error(`Specialist Sandbox session evidence is unavailable: ${specialistEvaluation.reason}`);
  }

  const canonicalRoute = resolveTrainingEvidenceAuthorityRoute(canonicalEvaluation);
  const specialistRoute = resolveTrainingEvidenceAuthorityRoute(specialistEvaluation);
  const systemOutcomeMatched = routesMatch(canonicalRoute, specialistRoute);

  const finalTurn =
    [...input.turns].sort((a, b) => b.sequenceNumber - a.sequenceNumber)[0];
  if (!finalTurn) throw new Error("Sandbox session contains no completed turns.");

  const occurrence = (
    layer: SandboxCapabilityLayer,
    evidenceClass: ResponseEvidenceClass,
    reason: string,
  ): SandboxCapabilityOccurrence => ({
    layer,
    evidenceClass,
    sequenceNumber: finalTurn.sequenceNumber,
    sessionNumber: finalTurn.sessionNumber,
    phase: input.phase,
    setId: finalTurn.setId,
    repNumber: finalTurn.repNumber,
    reason,
  });

  const canonicalStateChanged =
    canonicalRoute.nextPhase !== input.phase ||
    canonicalRoute.nextStability !== input.canonicalPreviousStability;

  const continuityClass: ResponseEvidenceClass =
    !systemOutcomeMatched
      ? "breakdown"
      : input.priorCompletedSessions < 1 && !input.priorTracksDiverged
        ? "not_observed"
        : canonicalStateChanged || input.priorTracksDiverged
          ? "supported"
          : "near_stable";

  return {
    canonicalRoute,
    specialistRoute,
    systemOutcomeMatched,
    canonicalNext: {
      phase: canonicalRoute.nextPhase,
      stability: canonicalRoute.nextStability,
    },
    specialistNext: {
      phase: specialistRoute.nextPhase,
      stability: specialistRoute.nextStability,
    },
    capabilityEvidence: [
      occurrence(
        "authority_integrity",
        systemOutcomeMatched ? "supported" : "breakdown",
        systemOutcomeMatched
          ? "The Specialist record preserved the RI authority route and next state."
          : "The Specialist record caused RI authority to diverge from canonical student truth.",
      ),
      occurrence(
        "continuity_integrity",
        continuityClass,
        continuityClass === "supported"
          ? "RI truth remained aligned through a longitudinal state condition."
          : continuityClass === "near_stable"
            ? "RI truth remained aligned, but this session did not yet establish a meaningful longitudinal change."
            : continuityClass === "not_observed"
              ? "A prior session or state change is required before continuity can be established."
              : "The Specialist record broke longitudinal alignment with canonical student truth.",
      ),
    ],
    studentStateAuthoritative: false,
    evidenceScope: "sandbox",
  };
}

export function parseSandboxCapabilityReadinessPolicy(
  value: unknown,
): SandboxCapabilityReadinessPolicy {
  const candidate =
    (typeof value === "string" ? JSON.parse(value) : value) as
      | Partial<SandboxCapabilityReadinessPolicy>
      | null;
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Sandbox capability readiness policy must be an object.");
  }
  if (!Number.isInteger(candidate.policyVersion) || Number(candidate.policyVersion) < 1) {
    throw new Error("Sandbox capability readiness policy version must be a positive integer.");
  }
  if (candidate.status !== "candidate" && candidate.status !== "approved") {
    throw new Error("Sandbox capability readiness policy status is invalid.");
  }
  if (candidate.nextStage !== "practicals") {
    throw new Error("Sandbox capability readiness may only open Practicals.");
  }

  const minimums = candidate.minimumValidOpportunitiesByCapability as
    | Partial<Record<SandboxCapabilityLayer, number>>
    | undefined;
  if (!minimums) {
    throw new Error("Sandbox capability opportunity minimums are required.");
  }
  const normalizedMinimums = Object.fromEntries(
    SANDBOX_CAPABILITY_LAYERS.map((layer) => {
      const count = Number(minimums[layer]);
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`Sandbox capability ${layer} requires a positive evidence minimum.`);
      }
      return [layer, count];
    }),
  ) as Record<SandboxCapabilityLayer, number>;

  const breadth = candidate.breadth;
  if (!breadth) throw new Error("Sandbox breadth policy is required.");
  const integerKeys = [
    "minimumDistinctPhases",
    "minimumDistinctSets",
    "minimumDistinctRepPositions",
    "minimumCompletedSessions",
  ] as const;
  for (const key of integerKeys) {
    const count = Number(breadth[key]);
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(`Sandbox breadth ${key} must be a positive integer.`);
    }
  }
  if (breadth.minimumDistinctPhases > PHASES.length) {
    throw new Error("Sandbox breadth cannot require more RI phases than exist.");
  }

  return {
    policyVersion: Number(candidate.policyVersion),
    status: candidate.status,
    minimumValidOpportunitiesByCapability: normalizedMinimums,
    breadth: {
      minimumDistinctPhases: breadth.minimumDistinctPhases,
      minimumDistinctSets: breadth.minimumDistinctSets,
      minimumDistinctRepPositions: breadth.minimumDistinctRepPositions,
      minimumCompletedSessions: breadth.minimumCompletedSessions,
      requireStateChange: Boolean(breadth.requireStateChange),
      requireBreakdownRecovery: Boolean(breadth.requireBreakdownRecovery),
    },
    nextStage: "practicals",
  };
}

export function evaluateSandboxCapabilityReadiness(input: {
  policy: SandboxCapabilityReadinessPolicy;
  evidence: SandboxCapabilityOccurrence[];
  exposure: SandboxExposureSummary;
}): SandboxCapabilityReadinessEvaluation {
  const policy = parseSandboxCapabilityReadinessPolicy(input.policy);
  let prerequisiteSupported = true;

  const layers: SandboxCapabilityLayerStatus[] = SANDBOX_CAPABILITY_LAYERS.map((layer) => {
    const minimumValidOpportunities = policy.minimumValidOpportunitiesByCapability[layer];
    const resolution = resolveResponseEvidenceDimension({
      evidence: input.evidence.filter((occurrence) => occurrence.layer === layer),
      minimumValidOpportunities,
    });
    const authoritative = prerequisiteSupported;
    const currentPrerequisiteSupported = prerequisiteSupported;
    if (resolution.state !== "SUPPORTED") prerequisiteSupported = false;

    return {
      layer,
      state: resolution.state,
      validOpportunityCount: resolution.validOpportunityCount,
      supportedCount: resolution.supportedCount,
      breakdownCount: resolution.breakdownCount,
      recoveredAfterBreakdown: resolution.recoveredAfterBreakdown,
      minimumValidOpportunities,
      prerequisiteSupported: currentPrerequisiteSupported,
      authoritative,
    };
  });

  const earliestUnsupportedCapability =
    layers.find((layer) => layer.state !== "SUPPORTED")?.layer || null;
  const capabilityEvidenceReady = earliestUnsupportedCapability === null;

  const breadthReady =
    input.exposure.distinctPhases >= policy.breadth.minimumDistinctPhases &&
    input.exposure.distinctSets >= policy.breadth.minimumDistinctSets &&
    input.exposure.distinctRepPositions >= policy.breadth.minimumDistinctRepPositions;

  const longitudinalReady =
    input.exposure.completedSessions >= policy.breadth.minimumCompletedSessions &&
    (!policy.breadth.requireStateChange || input.exposure.stateChangeObserved) &&
    (!policy.breadth.requireBreakdownRecovery || input.exposure.breakdownRecoveryObserved);

  const evidenceReady = capabilityEvidenceReady && breadthReady && longitudinalReady;
  const practicalsReady = evidenceReady && policy.status === "approved";

  return {
    policyStatus: policy.status,
    layers,
    earliestUnsupportedCapability,
    capabilityEvidenceReady,
    breadthReady,
    longitudinalReady,
    evidenceReady,
    practicalsReady,
    automaticTransition: false,
    nextStage: "practicals",
    reason: practicalsReady
      ? "All ordered Sandbox capability layers and longitudinal exposure requirements satisfy the approved readiness policy. Practicals may be opened through explicit stage control."
      : evidenceReady
        ? "Sandbox evidence satisfies the candidate capability standard, but the readiness policy is not approved for stage progression."
        : earliestUnsupportedCapability
          ? `Sandbox must continue at the earliest unsupported Specialist capability: ${earliestUnsupportedCapability}.`
          : "Sandbox capability evidence is supported, but breadth or longitudinal trajectory evidence is still incomplete.",
  };
}
