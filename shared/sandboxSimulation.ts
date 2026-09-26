import type { TopicPhase, TopicStability } from "./topicConditioningEngine";
import {
  getDrillSchemaDefinition,
  getDrillSchemaDefinitionByVersion,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getFieldDefinitionsForRep,
  getRepPurposeId,
  resolveEvidenceSelection,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import {
  TRAINING_INTERVENTION_FIELD,
  trainingEvidenceStatusKey,
  type TrainingEvidenceStatus,
} from "./trainingEvidenceCapture";
import {
  evaluateTrainingEvidence,
  resolveTrainingEvidenceAuthorityRoute,
  trainingEvidenceClassForRawBehavior,
} from "./trainingEvidenceEvaluator";
import type { TrainingDimensionId } from "./trainingEvidenceContract";

export type SandboxObservationStatus = TrainingEvidenceStatus;

export type SandboxCanonicalFieldObservation = {
  optionId: string;
  evidenceStatus?: SandboxObservationStatus;
};

export type SandboxScenarioRep = {
  repNumber: number;
  studentBehavior: string;
  observations: Record<string, SandboxCanonicalFieldObservation>;
};

export type SandboxScenarioSet = {
  setId: string;
  reps: SandboxScenarioRep[];
};

export type SandboxScenarioDefinition = {
  key: string;
  version: number;
  title: string;
  description: string;
  phase: TopicPhase;
  previousStability: TopicStability;
  passThresholdPercent: number;
  sets: SandboxScenarioSet[];
};

export type SandboxSubmittedFieldObservation = {
  optionId: string;
  evidenceStatus?: SandboxObservationStatus;
};

export type SandboxSubmittedRep = {
  repNumber: number;
  observations: Record<string, SandboxSubmittedFieldObservation>;
};

export type SandboxSubmittedSet = {
  setId: string;
  reps: SandboxSubmittedRep[];
};

export type SandboxSimulationSubmission = {
  sets: SandboxSubmittedSet[];
};

export type SandboxPublicField = {
  fieldKey: string;
  dimensionId: string;
  options: Array<{ optionId: string; label: string }>;
};

export type SandboxPublicRep = {
  repNumber: number;
  studentBehavior: string;
  fields: SandboxPublicField[];
};

export type SandboxPublicSet = {
  setId: string;
  setName: string;
  purpose: string;
  constraints: Record<string, unknown>;
  reps: SandboxPublicRep[];
};

export type SandboxPublicScenario = {
  key: string;
  version: number;
  title: string;
  description: string;
  phase: TopicPhase;
  previousStability: TopicStability;
  passThresholdPercent: number;
  sets: SandboxPublicSet[];
};

export type SandboxSimulationEvaluation = {
  scenarioKey: string;
  scenarioVersion: number;
  phase: TopicPhase;
  previousStability: TopicStability;
  totalObservations: number;
  matchingObservations: number;
  observationFidelityPercent: number;
  systemOutcomeMatched: boolean;
  passed: boolean;
  specialistOutcome: {
    route: string;
    nextPhase: TopicPhase;
    nextStability: TopicStability;
    targetPhase: TopicPhase | null;
  };
  canonicalOutcome: {
    route: string;
    nextPhase: TopicPhase;
    nextStability: TopicStability;
    targetPhase: TopicPhase | null;
  };
  studentStateAuthoritative: false;
  evidenceScope: "sandbox";
};

const normalizeStatus = (value?: SandboxObservationStatus): SandboxObservationStatus =>
  value === "not_observed" || value === "confounded" ? value : "observed";

const observationKey = (setId: string, repNumber: number, fieldKey: string) =>
  setId + "::" + repNumber + "::" + fieldKey;

export function projectSandboxScenarioToCurrentTrainingContract(
  definition: SandboxScenarioDefinition,
  sourceTrainingSchemaVersion: number,
): SandboxScenarioDefinition {
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
      `Sandbox scenario ${definition.key} references unsupported Training schema v${sourceTrainingSchemaVersion}.`,
    );
  }

  return {
    ...definition,
    sets: definition.sets.map((scenarioSet) => {
      const sourceSet = sourceSchema.sets.find(
        (candidate) => candidate.setId === scenarioSet.setId,
      );
      const currentSet = currentSchema.sets.find(
        (candidate) => candidate.setId === scenarioSet.setId,
      );
      if (!sourceSet || !currentSet) {
        throw new Error(
          `Sandbox scenario ${definition.key} cannot reconcile Training set ${scenarioSet.setId}.`,
        );
      }

      return {
        ...scenarioSet,
        reps: scenarioSet.reps.map((rep, repIndex) => {
          const currentFields = getFieldDefinitionsForRep(
            currentSet,
            repIndex,
          );
          return {
            ...rep,
            observations: Object.fromEntries(
              currentFields.map((currentField) => {
                const fieldKey = currentField.fieldKey;
                let sourceObservation = rep.observations[fieldKey];

                // Sandbox Observation Foundation V1-V3 overloaded the
                // Required Structure repeatability slot with the student's
                // stated-plan quality. V4 restores those as separate
                // authorities. Reuse that retained semantic class for the
                // condition-only step-plan check, while rep 1 no longer mints
                // execution.repeatability.
                if (
                  currentField.dimensionId ===
                  "condition.required_structure.step_plan_accuracy"
                ) {
                  sourceObservation = rep.observations.repeatability;
                }

                if (!sourceObservation?.optionId) {
                  throw new Error(
                    `Sandbox scenario ${definition.key} is missing historical observation ${fieldKey} required by current Training.`,
                  );
                }

                const sourceFieldKey =
                  currentField.dimensionId ===
                  "condition.required_structure.step_plan_accuracy"
                    ? "repeatability"
                    : fieldKey;
                const sourceResolved = resolveEvidenceSelection({
                  mode: "training",
                  phase: definition.phase,
                  setId: scenarioSet.setId,
                  repIndex,
                  fieldKey: sourceFieldKey,
                  optionId: sourceObservation.optionId,
                  schemaVersion: sourceTrainingSchemaVersion,
                });
                if (!sourceResolved) {
                  throw new Error(
                    `Sandbox scenario ${definition.key} has an invalid historical option for ${sourceFieldKey}.`,
                  );
                }

                const rawLabel =
                  sourceResolved.field.optionLabels?.[
                    sourceResolved.optionIndex
                  ] || "";
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
                    `Sandbox scenario ${definition.key} cannot reconcile ${fieldKey} into a decision evidence class.`,
                  );
                }

                const optionIndex =
                  currentField.optionEvidenceClasses?.findIndex(
                    (candidate) => candidate === evidenceClass,
                  ) ?? -1;
                if (optionIndex < 0) {
                  throw new Error(
                    `Sandbox scenario ${definition.key} cannot map ${fieldKey} ${evidenceClass} into Training V${currentSchema.schemaVersion}.`,
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
                    `Sandbox scenario ${definition.key} could not resolve current option identity for ${fieldKey}.`,
                  );
                }

                return [
                  fieldKey,
                  {
                    optionId: identity.optionId,
                    evidenceStatus: sourceObservation.evidenceStatus,
                  },
                ];
              }),
            ),
          };
        }),
      };
    }),
  };
}

export function validateSandboxScenarioDefinition(definition: SandboxScenarioDefinition) {
  if (!definition.key.trim()) throw new Error("Sandbox scenario key is required.");
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new Error("Sandbox scenario version must be a positive integer.");
  }
  if (!definition.title.trim() || !definition.description.trim()) {
    throw new Error("Sandbox scenario title and description are required.");
  }
  if (definition.passThresholdPercent <= 0 || definition.passThresholdPercent > 100) {
    throw new Error("Sandbox scenario pass threshold must be between 0 and 100.");
  }

  const schema = getDrillSchemaDefinition("training", definition.phase);
  const scoredSets = schema.sets.filter((set) => !set.modelingOnly);
  if (definition.sets.length !== scoredSets.length) {
    throw new Error(
      `Sandbox scenario ${definition.key} must cover every scored ${definition.phase} training set.`,
    );
  }

  for (const [scoredIndex, registeredSet] of scoredSets.entries()) {
    const scenarioSet = definition.sets[scoredIndex];
    if (scenarioSet?.setId !== registeredSet.setId) {
      throw new Error(
        `Sandbox scenario ${definition.key} set ${scoredIndex + 1} must be ${registeredSet.setId}.`,
      );
    }
    if (scenarioSet.reps.length !== registeredSet.reps) {
      throw new Error(
        `Sandbox scenario ${definition.key} set ${registeredSet.setId} must contain ${registeredSet.reps} reps.`,
      );
    }

    scenarioSet.reps.forEach((rep, repIndex) => {
      if (rep.repNumber !== repIndex + 1 || !rep.studentBehavior.trim()) {
        throw new Error(
          `Sandbox scenario ${definition.key} has an invalid rep in ${registeredSet.setId}.`,
        );
      }

      getFieldDefinitionsForRep(registeredSet, repIndex).forEach((field) => {
        const canonical = rep.observations[field.fieldKey];
        if (!canonical?.optionId) {
          throw new Error(
            `Sandbox scenario ${definition.key} is missing ${registeredSet.setId} rep ${rep.repNumber} ${field.fieldKey}.`,
          );
        }
        const resolved = resolveEvidenceSelection({
          mode: "training",
          phase: definition.phase,
          setId: registeredSet.setId,
          repIndex,
          fieldKey: field.fieldKey,
          optionId: canonical.optionId,
          schemaVersion: schema.schemaVersion,
        });
        if (!resolved) {
          throw new Error(
            `Sandbox scenario ${definition.key} has an invalid canonical option for ${field.fieldKey}.`,
          );
        }
        normalizeStatus(canonical.evidenceStatus);
      });
    });
  }
}

export function projectSandboxScenarioForSpecialist(
  definition: SandboxScenarioDefinition,
): SandboxPublicScenario {
  validateSandboxScenarioDefinition(definition);
  const schema = getDrillSchemaDefinition("training", definition.phase);

  return {
    key: definition.key,
    version: definition.version,
    title: definition.title,
    description: definition.description,
    phase: definition.phase,
    previousStability: definition.previousStability,
    passThresholdPercent: definition.passThresholdPercent,
    sets: definition.sets.map((scenarioSet) => {
      const registeredSet = schema.sets.find((candidate) => candidate.setId === scenarioSet.setId)!;
      return {
        setId: registeredSet.setId,
        setName: registeredSet.setName,
        purpose: registeredSet.purpose,
        constraints: { ...registeredSet.constraints },
        reps: scenarioSet.reps.map((rep, repIndex) => ({
          repNumber: rep.repNumber,
          studentBehavior: rep.studentBehavior,
          fields: getFieldDefinitionsForRep(
            registeredSet,
            repIndex,
          ).map((field) => {
            const options = (field.optionLabels || []).map((label, optionIndex) => {
              const identity = getEvidenceSelectionIdentity({
                mode: "training",
                phase: definition.phase,
                setName: registeredSet.setName,
                repIndex,
                fieldKey: field.fieldKey,
                optionIndex,
              });
              if (!identity) {
                throw new Error(
                  `Unable to materialize Sandbox option identity for ${registeredSet.setId} ${field.fieldKey}.`,
                );
              }
              return { optionId: identity.optionId, label };
            });
            return {
              fieldKey: field.fieldKey,
              dimensionId: field.dimensionId,
              options,
            };
          }),
        })),
      };
    }),
  };
}

function materializeEvidenceSets(
  definition: SandboxScenarioDefinition,
  sourceSets: Array<{
    setId: string;
    reps: Array<{
      repNumber: number;
      observations: Record<string, SandboxSubmittedFieldObservation>;
    }>;
  }>,
): SubmittedEvidenceSet[] {
  const schema = getDrillSchemaDefinition("training", definition.phase);

  return schema.sets.map((registeredSet, setIndex) => {
    if (registeredSet.modelingOnly) {
      return {
        setName: registeredSet.setName,
        setId: registeredSet.setId,
        setOrder: setIndex + 1,
        drillSchemaId: schema.schemaId,
        drillSchemaVersion: schema.schemaVersion,
        drillDefinitionHash: schema.definitionHash,
        constraintProfile: { ...registeredSet.constraints },
        observations: [],
      };
    }

    const suppliedSet = sourceSets.find((candidate) => candidate.setId === registeredSet.setId);
    if (!suppliedSet || suppliedSet.reps.length !== registeredSet.reps) {
      throw new Error(`Sandbox submission is missing set ${registeredSet.setId}.`);
    }

    const observations = suppliedSet.reps.map((rep, repIndex) => {
      if (rep.repNumber !== repIndex + 1) {
        throw new Error(`Sandbox submission has an invalid rep order in ${registeredSet.setId}.`);
      }

      const row: Record<string, string> = {
        _rep_id: getRepPurposeId(registeredSet, repIndex),
        _rep_number: String(repIndex + 1),
        [TRAINING_INTERVENTION_FIELD]: "none",
      };

      getFieldDefinitionsForRep(registeredSet, repIndex).forEach((field) => {
        const submitted = rep.observations[field.fieldKey];
        if (!submitted?.optionId) {
          throw new Error(
            `Sandbox submission is missing ${registeredSet.setId} rep ${rep.repNumber} ${field.fieldKey}.`,
          );
        }
        const resolved = resolveEvidenceSelection({
          mode: "training",
          phase: definition.phase,
          setId: registeredSet.setId,
          repIndex,
          fieldKey: field.fieldKey,
          optionId: submitted.optionId,
          schemaVersion: schema.schemaVersion,
        });
        if (!resolved) {
          throw new Error(
            `Sandbox submission selected an invalid option for ${registeredSet.setId} rep ${rep.repNumber} ${field.fieldKey}.`,
          );
        }
        const rawOption = resolved.field.optionLabels?.[resolved.optionIndex];
        if (!rawOption) throw new Error("Sandbox option is missing its registered raw label.");

        row[field.fieldKey] = rawOption;
        row[`${field.fieldKey}_option_id`] = submitted.optionId;
        row[`${field.fieldKey}_dimension_id`] = resolved.field.dimensionId;
        row[`${field.fieldKey}_level`] = resolved.level;
        if (resolved.evidenceClass) {
          row[`${field.fieldKey}_evidence_class`] = resolved.evidenceClass;
        }
        row[trainingEvidenceStatusKey(field.fieldKey)] = normalizeStatus(submitted.evidenceStatus);
      });

      return row;
    });

    return {
      setName: registeredSet.setName,
      setId: registeredSet.setId,
      setOrder: setIndex + 1,
      drillSchemaId: schema.schemaId,
      drillSchemaVersion: schema.schemaVersion,
      drillDefinitionHash: schema.definitionHash,
      constraintProfile: { ...registeredSet.constraints },
      observations,
    };
  });
}

function canonicalSubmission(definition: SandboxScenarioDefinition): SandboxSimulationSubmission {
  return {
    sets: definition.sets.map((set) => ({
      setId: set.setId,
      reps: set.reps.map((rep) => ({
        repNumber: rep.repNumber,
        observations: Object.fromEntries(
          Object.entries(rep.observations).map(([fieldKey, observation]) => [
            fieldKey,
            {
              optionId: observation.optionId,
              evidenceStatus: normalizeStatus(observation.evidenceStatus),
            },
          ]),
        ),
      })),
    })),
  };
}

function flattenedSelections(submission: SandboxSimulationSubmission) {
  const map = new Map<string, SandboxSubmittedFieldObservation>();
  submission.sets.forEach((set) => {
    set.reps.forEach((rep) => {
      Object.entries(rep.observations).forEach(([fieldKey, observation]) => {
        map.set(observationKey(set.setId, rep.repNumber, fieldKey), {
          optionId: observation.optionId,
          evidenceStatus: normalizeStatus(observation.evidenceStatus),
        });
      });
    });
  });
  return map;
}

export function evaluateSandboxSimulation(
  definition: SandboxScenarioDefinition,
  submission: SandboxSimulationSubmission,
): SandboxSimulationEvaluation {
  validateSandboxScenarioDefinition(definition);

  const canonical = canonicalSubmission(definition);
  const canonicalSets = materializeEvidenceSets(definition, canonical.sets);
  const specialistSets = materializeEvidenceSets(definition, submission.sets);

  const canonicalEvaluation = evaluateTrainingEvidence({
    phase: definition.phase,
    previousStability: definition.previousStability,
    sets: canonicalSets,
  });
  const specialistEvaluation = evaluateTrainingEvidence({
    phase: definition.phase,
    previousStability: definition.previousStability,
    sets: specialistSets,
  });
  if (canonicalEvaluation.status !== "evaluated" || specialistEvaluation.status !== "evaluated") {
    throw new Error(
      canonicalEvaluation.status !== "evaluated"
        ? canonicalEvaluation.reason
        : specialistEvaluation.status !== "evaluated"
          ? specialistEvaluation.reason
          : "Sandbox evidence could not be evaluated.",
    );
  }

  const canonicalRoute = resolveTrainingEvidenceAuthorityRoute(canonicalEvaluation);
  const specialistRoute = resolveTrainingEvidenceAuthorityRoute(specialistEvaluation);
  const expected = flattenedSelections(canonical);
  const actual = flattenedSelections(submission);

  let matchingObservations = 0;
  for (const [key, expectedObservation] of expected.entries()) {
    const actualObservation = actual.get(key);
    const expectedStatus = normalizeStatus(expectedObservation.evidenceStatus);
    const actualStatus = normalizeStatus(actualObservation?.evidenceStatus);
    const statusMatches = actualStatus === expectedStatus;
    const optionMatches =
      expectedStatus === "observed"
        ? actualObservation?.optionId === expectedObservation.optionId
        : statusMatches;
    if (statusMatches && optionMatches) {
      matchingObservations += 1;
    }
  }

  const totalObservations = expected.size;
  const observationFidelityPercent = Number(
    ((matchingObservations / Math.max(1, totalObservations)) * 100).toFixed(2),
  );
  const systemOutcomeMatched =
    specialistRoute.route === canonicalRoute.route &&
    specialistRoute.nextPhase === canonicalRoute.nextPhase &&
    specialistRoute.nextStability === canonicalRoute.nextStability &&
    specialistRoute.targetPhase === canonicalRoute.targetPhase;

  return {
    scenarioKey: definition.key,
    scenarioVersion: definition.version,
    phase: definition.phase,
    previousStability: definition.previousStability,
    totalObservations,
    matchingObservations,
    observationFidelityPercent,
    systemOutcomeMatched,
    passed:
      observationFidelityPercent >= definition.passThresholdPercent &&
      systemOutcomeMatched,
    specialistOutcome: {
      route: specialistRoute.route,
      nextPhase: specialistRoute.nextPhase,
      nextStability: specialistRoute.nextStability,
      targetPhase: specialistRoute.targetPhase,
    },
    canonicalOutcome: {
      route: canonicalRoute.route,
      nextPhase: canonicalRoute.nextPhase,
      nextStability: canonicalRoute.nextStability,
      targetPhase: canonicalRoute.targetPhase,
    },
    studentStateAuthoritative: false,
    evidenceScope: "sandbox",
  };
}
