import test from "node:test";
import assert from "node:assert/strict";

import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import {
  compareTrainingEvidenceShadowToLegacy,
  evaluateTrainingEvidence,
  evaluateTrainingEvidenceShadow,
  resolveTrainingEvidenceAuthorityRoute,
  trainingDimensionForFieldKey,
  trainingEvidenceClassForRawBehavior,
  trainingRawObservationRequiresPrerequisiteSentinel,
} from "./trainingEvidenceEvaluator";
import {
  TRAINING_INTERVENTION_FIELD,
  TRAINING_PREREQUISITE_SENTINEL_FIELD,
  trainingEvidenceStatusKey,
} from "./trainingEvidenceCapture";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";

test("all registered training raw options map into evidence classes", () => {
  const phases: TopicPhase[] = [
    "Clarity",
    "Structured Execution",
    "Controlled Discomfort",
    "Time Pressure Stability",
  ];

  phases.forEach((phase) => {
    const schema = getDrillSchemaDefinition("training", phase);
    schema.sets.forEach((setDefinition) => {
      if (setDefinition.modelingOnly) return;

      setDefinition.fields.forEach((field) => {
        const dimensionId = trainingDimensionForFieldKey(field.fieldKey);
        assert.ok(dimensionId, `Expected dimension mapping for ${phase} / ${setDefinition.setId} / ${field.fieldKey}`);

        field.optionLabels?.forEach((rawOption) => {
          assert.ok(
            trainingEvidenceClassForRawBehavior(dimensionId, rawOption),
            `Expected evidence class for ${phase} / ${setDefinition.setId} / ${field.fieldKey}: ${rawOption}`,
          );
        });
      });
    });
  });
});

const buildTrainingSets = ({
  phase,
  optionIndexFor,
}: {
  phase: TopicPhase;
  optionIndexFor?: (args: {
    setId: string;
    repIndex: number;
    fieldKey: string;
    optionLabels: string[];
  }) => number;
}): SubmittedEvidenceSet[] => {
  const schema = getDrillSchemaDefinition("training", phase);

  return schema.sets.map((definition, setIndex) => {
    if (definition.modelingOnly) {
      return {
        setName: definition.setName,
        setId: definition.setId,
        setOrder: setIndex + 1,
        drillSchemaId: schema.schemaId,
        drillSchemaVersion: schema.schemaVersion,
        drillDefinitionHash: schema.definitionHash,
        constraintProfile: { ...definition.constraints },
        observations: [],
      };
    }

    const observations = Array.from({ length: definition.reps }, (_, repIndex) => {
      const rep: Record<string, string> = {
        _rep_id: definition.repPurposeIds[repIndex] || `${definition.setId}.opportunity_${repIndex + 1}`,
        _rep_number: String(repIndex + 1),
      };

      definition.fields.forEach((baseField) => {
        const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey) || baseField;
        const optionLabels = [...(field.optionLabels || [])];
        const selectedIndex = optionIndexFor
          ? optionIndexFor({
              setId: definition.setId,
              repIndex,
              fieldKey: field.fieldKey,
              optionLabels,
            })
          : optionLabels.length - 1;
        const identity = getEvidenceSelectionIdentity({
          mode: "training",
          phase,
          setName: definition.setName,
          repIndex,
          fieldKey: field.fieldKey,
          optionIndex: selectedIndex,
        });

        assert.ok(identity);
        rep[field.fieldKey] = optionLabels[selectedIndex];
        rep[`${field.fieldKey}_option_id`] = identity.optionId;
        rep[`${field.fieldKey}_dimension_id`] = identity.dimensionId;
        rep[`${field.fieldKey}_level`] = identity.level;
      });

      return rep;
    });

    return {
      setName: definition.setName,
      setId: definition.setId,
      setOrder: setIndex + 1,
      drillSchemaId: schema.schemaId,
      drillSchemaVersion: schema.schemaVersion,
      drillDefinitionHash: schema.definitionHash,
      constraintProfile: { ...definition.constraints },
      observations,
    };
  });
};

const setPrerequisiteSentinel = (
  sets: SubmittedEvidenceSet[],
  setId: string,
  repIndexes: number[],
  result: "held" | "contradicted" | "not_observed" | "confounded",
) => {
  const set = sets.find((candidate) => candidate.setId === setId);
  assert.ok(set);
  for (const repIndex of repIndexes) {
    assert.ok(set.observations[repIndex]);
    set.observations[repIndex][TRAINING_PREREQUISITE_SENTINEL_FIELD] = result;
  }
};

const evaluate = (
  phase: TopicPhase,
  previousStability: TopicStability,
  sets: SubmittedEvidenceSet[],
) => {
  const result = evaluateTrainingEvidence({ phase, previousStability, sets });
  assert.equal(result.status, "evaluated");
  if (result.status === "evaluated") {
    assert.equal(result.authority, "evidence_native");
  }
  return result as Extract<typeof result, { status: "evaluated" }>;
};

test("legacy shadow evaluator name remains a compatibility alias", () => {
  assert.equal(evaluateTrainingEvidenceShadow, evaluateTrainingEvidence);
});

test("fully supported evidence establishes High from Low but not High Maintenance", () => {
  const sets = buildTrainingSets({ phase: "Structured Execution" });
  const result = evaluate("Structured Execution", "Low", sets);

  assert.equal(result.observedStability, "High");
  assert.equal(result.highMaintenanceEntryQualified, true);
  assert.equal(result.exitQualified, true);
  assert.equal(result.predictedTransition.nextStability, "High");
  assert.equal(result.predictedTransition.transitionReason, "stability advance");
});

test("repeated phase-critical breakdown cannot be averaged away by otherwise supported evidence", () => {
  const sets = buildTrainingSets({
    phase: "Structured Execution",
    optionIndexFor: ({ setId, repIndex, fieldKey, optionLabels }) => {
      if (
        setId === "structured_execution.variation_control" &&
        fieldKey === "stepExecution" &&
        repIndex >= 1
      ) {
        return 0;
      }
      return optionLabels.length - 1;
    },
  });

  setPrerequisiteSentinel(sets, "structured_execution.variation_control", [1, 2], "held");

  const result = evaluate("Structured Execution", "High", sets);
  const stepDiscipline = result.dimensions.find(
    (item) => item.dimensionId === "execution.step_discipline",
  );

  assert.equal(stepDiscipline?.state, "BREAKDOWN");
  assert.equal(result.observedStability, "Low");
  assert.equal(result.predictedTransition.nextStability, "Medium");
  assert.equal(result.predictedTransition.transitionReason, "stability regress");
});

test("one early breakdown followed by clean recovery does not automatically make the phase Low", () => {
  const sets = buildTrainingSets({
    phase: "Structured Execution",
    optionIndexFor: ({ setId, repIndex, fieldKey, optionLabels }) => {
      if (
        setId === "structured_execution.required_structure" &&
        fieldKey === "startBehavior" &&
        repIndex === 0
      ) {
        return 0;
      }
      return optionLabels.length - 1;
    },
  });

  setPrerequisiteSentinel(sets, "structured_execution.required_structure", [0], "held");

  const result = evaluate("Structured Execution", "Medium", sets);
  const start = result.dimensions.find((item) => item.dimensionId === "execution.start");

  assert.notEqual(start?.state, "BREAKDOWN");
  assert.notEqual(result.observedStability, "Low");
});

test("High enters High Maintenance only from a later evidence-qualified High session", () => {
  const sets = buildTrainingSets({ phase: "Controlled Discomfort" });
  const result = evaluate("Controlled Discomfort", "High", sets);

  assert.equal(result.observedStability, "High");
  assert.equal(result.highMaintenanceEntryQualified, true);
  assert.equal(result.predictedTransition.nextStability, "High Maintenance");
  assert.equal(result.predictedTransition.transitionReason, "high maintenance entry");
});

test("High Maintenance progresses only when the exit evidence is supported", () => {
  const sets = buildTrainingSets({ phase: "Controlled Discomfort" });
  const result = evaluate("Controlled Discomfort", "High Maintenance", sets);

  assert.equal(result.exitQualified, true);
  assert.equal(result.predictedTransition.nextPhase, "Time Pressure Stability");
  assert.equal(result.predictedTransition.nextStability, "Low");
  assert.equal(result.predictedTransition.transitionReason, "phase progress");
});

test("near-stable evidence can support High but cannot mint High Maintenance", () => {
  const sets = buildTrainingSets({
    phase: "Time Pressure Stability",
    optionIndexFor: ({ setId, repIndex, fieldKey, optionLabels }) => {
      if (fieldKey === "paceControl") {
        return 1;
      }
      return optionLabels.length - 1;
    },
  });

  const result = evaluate("Time Pressure Stability", "High", sets);
  const pace = result.dimensions.find((item) => item.dimensionId === "time.pace");

  assert.equal(pace?.state, "NEAR_STABLE");
  assert.equal(result.observedStability, "High");
  assert.equal(result.highMaintenanceEntryQualified, false);
  assert.equal(result.predictedTransition.nextStability, "High");
});

test("final-phase High Maintenance confirmation remains in final-phase maintenance", () => {
  const sets = buildTrainingSets({ phase: "Time Pressure Stability" });
  const result = evaluate("Time Pressure Stability", "High Maintenance", sets);

  assert.equal(result.exitQualified, true);
  assert.equal(result.predictedTransition.nextPhase, "Time Pressure Stability");
  assert.equal(result.predictedTransition.nextStability, "High Maintenance");
  assert.equal(result.predictedTransition.transitionReason, "final maintenance hold");
});

test("shadow evaluator refuses incomplete versioned training evidence", () => {
  const sets = buildTrainingSets({ phase: "Clarity" });
  const incomplete = sets.slice(0, 2);
  const result = evaluateTrainingEvidenceShadow({
    phase: "Clarity",
    previousStability: "Low",
    sets: incomplete,
  });

  assert.equal(result.status, "unavailable");
  assert.match(result.reason, /Missing training set/i);
});


test("explicit not-observed evidence is excluded from capability authority", () => {
  const sets = buildTrainingSets({ phase: "Clarity" });
  for (const set of sets) {
    for (const rep of set.observations) {
      if ("reason" in rep) {
        rep[trainingEvidenceStatusKey("reason")] = "not_observed";
      }
    }
  }

  const result = evaluate("Clarity", "High", sets);
  const reason = result.dimensions.find((item) => item.dimensionId === "clarity.reason");

  assert.equal(reason?.state, "UNRESOLVED");
  assert.equal(result.observedStability, "Medium");
  assert.ok(result.ineligibleEvidenceCount > 0);
});

test("recorded intervention confounds only the dimensions it supplied", () => {
  const sets = buildTrainingSets({ phase: "Controlled Discomfort" });
  for (const set of sets) {
    for (const rep of set.observations) {
      rep[TRAINING_INTERVENTION_FIELD] = "first_step_confirmation";
    }
  }

  const result = evaluate("Controlled Discomfort", "High", sets);
  const firstStep = result.dimensions.find(
    (item) => item.dimensionId === "difficulty.first_step_control",
  );
  const tolerance = result.dimensions.find(
    (item) => item.dimensionId === "difficulty.tolerance",
  );

  assert.equal(firstStep?.state, "UNRESOLVED");
  assert.equal(tolerance?.state, "SUPPORTED");
  assert.equal(result.observedStability, "Medium");
  assert.ok(result.interventionEvents.includes("first_step_confirmation"));
});

test("score-vs-evidence divergence is explicitly preserved for proof analysis", () => {
  const sets = buildTrainingSets({
    phase: "Structured Execution",
    optionIndexFor: ({ setId, repIndex, fieldKey, optionLabels }) => {
      if (
        setId === "structured_execution.variation_control" &&
        fieldKey === "stepExecution" &&
        repIndex >= 1
      ) {
        return 0;
      }
      return optionLabels.length - 1;
    },
  });
  const shadow = evaluateTrainingEvidenceShadow({
    phase: "Structured Execution",
    previousStability: "High",
    sets,
  });

  const comparison = compareTrainingEvidenceShadowToLegacy({
    sessionScore: 98,
    legacyTransition: {
      nextPhase: "Structured Execution",
      nextStability: "High Maintenance",
      transitionReason: "stability advance",
    },
    evidenceShadow: shadow,
  });

  assert.equal(comparison.available, true);
  assert.equal(comparison.diverged, true);
  assert.equal(comparison.stateDiverged, true);
  assert.equal(comparison.legacy.score, 98);
  assert.notEqual(comparison.evidence?.nextStability, "High Maintenance");
});


test("reason-only differences do not count as a state divergence", () => {
  const sets = buildTrainingSets({ phase: "Controlled Discomfort" });
  const shadow = evaluateTrainingEvidenceShadow({
    phase: "Controlled Discomfort",
    previousStability: "High",
    sets,
  });

  const comparison = compareTrainingEvidenceShadowToLegacy({
    sessionScore: 100,
    legacyTransition: {
      nextPhase: "Controlled Discomfort",
      nextStability: "High Maintenance",
      transitionReason: "stability advance",
    },
    evidenceShadow: shadow,
  });

  assert.equal(comparison.available, true);
  assert.equal(comparison.diverged, false);
  assert.equal(comparison.stateDiverged, false);
  assert.equal(comparison.reasonDiverged, true);
  assert.equal(comparison.evidence?.transitionReason, "high maintenance entry");
});

test("later clean Clarity evidence can resolve earlier conditional evidence", () => {
  const sets = buildTrainingSets({
    phase: "Clarity",
    optionIndexFor: ({ setId, fieldKey, optionLabels }) => {
      if (fieldKey === "reason" && setId === "clarity.identification") {
        return 1; // weak / conditional
      }
      return optionLabels.length - 1;
    },
  });

  const result = evaluate("Clarity", "Low", sets);
  const reason = result.dimensions.find((item) => item.dimensionId === "clarity.reason");

  assert.equal(reason?.state, "SUPPORTED");
  assert.equal(result.observedStability, "High");
  assert.equal(result.predictedTransition.nextStability, "High");
});

test("persistent conditional Clarity evidence cannot be averaged into High Maintenance", () => {
  const sets = buildTrainingSets({
    phase: "Clarity",
    optionIndexFor: ({ fieldKey, optionLabels }) => {
      if (fieldKey === "reason") return 1;
      return optionLabels.length - 1;
    },
  });

  const result = evaluate("Clarity", "High", sets);
  const reason = result.dimensions.find((item) => item.dimensionId === "clarity.reason");

  assert.equal(reason?.state, "CONDITIONAL");
  assert.equal(result.observedStability, "Medium");
  assert.equal(result.highMaintenanceEntryQualified, false);
  assert.equal(result.predictedTransition.nextStability, "Medium");
});

test("High Maintenance exit can use a clean recovery run inside the designated exit context", () => {
  const sets = buildTrainingSets({
    phase: "Clarity",
    optionIndexFor: ({ setId, repIndex, fieldKey, optionLabels }) => {
      if (setId === "clarity.identification") {
        if (fieldKey === "vocabulary") return 1; // hesitant / near-stable
        if (fieldKey === "reason") return 1; // weak / conditional
        if (fieldKey === "immediateApply") return 1; // unsure but tries / near-stable
      }
      if (setId === "clarity.light_apply" && repIndex === 0) {
        if (fieldKey === "vocabulary") return 1; // partial / conditional
        if (fieldKey === "reason") return 1; // weak / conditional
        if (fieldKey === "immediateApply") return 1; // hesitant / near-stable
      }
      return optionLabels.length - 1;
    },
  });

  const result = evaluate("Clarity", "High Maintenance", sets);

  assert.equal(result.observedStability, "High");
  assert.equal(result.exitQualified, true);
  assert.equal(result.predictedTransition.nextPhase, "Structured Execution");
  assert.equal(result.predictedTransition.nextStability, "Low");
  assert.equal(result.predictedTransition.transitionReason, "phase progress");
});


test("confirmed Structured Execution prerequisite loss routes to Clarity re-diagnosis without moving state backward", () => {
  const sets = buildTrainingSets({
    phase: "Structured Execution",
    optionIndexFor: ({ setId, repIndex, fieldKey, optionLabels }) => {
      if (setId === "structured_execution.variation_control" && fieldKey === "stepExecution" && repIndex === 1) return 0;
      return optionLabels.length - 1;
    },
  });
  setPrerequisiteSentinel(sets, "structured_execution.variation_control", [1], "contradicted");

  const result = evaluate("Structured Execution", "High", sets);
  assert.equal(result.prerequisiteContradiction.status, "confirmed");
  assert.equal(result.prerequisiteContradiction.targetPhase, "Clarity");
  const route = resolveTrainingEvidenceAuthorityRoute(result);
  assert.equal(route.route, "targeted_rediagnosis");
  assert.equal(route.targetPhase, "Clarity");
  assert.equal(route.nextPhase, "Structured Execution");
  assert.equal(route.nextStability, "High");
  assert.equal(route.transitionReason, "targeted re-diagnosis required");
});

test("a held prerequisite sentinel keeps the breakdown inside the current training phase", () => {
  const sets = buildTrainingSets({
    phase: "Controlled Discomfort",
    optionIndexFor: ({ setId, repIndex, fieldKey, optionLabels }) => {
      if (setId === "controlled_discomfort.repeat_exposure" && fieldKey === "initialResponse" && repIndex === 2) return 0;
      return optionLabels.length - 1;
    },
  });
  setPrerequisiteSentinel(sets, "controlled_discomfort.repeat_exposure", [2], "held");
  const result = evaluate("Controlled Discomfort", "High", sets);
  assert.equal(result.prerequisiteContradiction.status, "cleared");
  assert.equal(resolveTrainingEvidenceAuthorityRoute(result).route, "normal_training");
});

test("missing sentinel evidence freezes Training authority and routes to re-diagnosis", () => {
  const sets = buildTrainingSets({
    phase: "Time Pressure Stability",
    optionIndexFor: ({ setId, repIndex, fieldKey, optionLabels }) => {
      if (setId === "time_pressure.full_constraint" && fieldKey === "structureUnderTime" && repIndex === 0) return 0;
      return optionLabels.length - 1;
    },
  });
  const result = evaluate("Time Pressure Stability", "Medium", sets);
  assert.equal(result.prerequisiteContradiction.status, "unresolved");
  assert.equal(result.prerequisiteContradiction.targetPhase, "Structured Execution");
  const route = resolveTrainingEvidenceAuthorityRoute(result);
  assert.equal(route.route, "targeted_rediagnosis");
  assert.equal(route.nextPhase, "Time Pressure Stability");
  assert.equal(route.nextStability, "Medium");
  assert.equal(route.targetPhase, "Structured Execution");
});


test("live prerequisite trigger uses raw field evidence without a registry round-trip", () => {
  assert.equal(
    trainingRawObservationRequiresPrerequisiteSentinel({
      phase: "Controlled Discomfort",
      fieldKey: "initialResponse",
      rawOption: "freeze",
    }),
    true,
  );
  assert.equal(
    trainingRawObservationRequiresPrerequisiteSentinel({
      phase: "Structured Execution",
      fieldKey: "stepExecution",
      rawOption: "skips",
    }),
    true,
  );
  assert.equal(
    trainingRawObservationRequiresPrerequisiteSentinel({
      phase: "Structured Execution",
      fieldKey: "startBehavior",
      rawOption: "delayed",
    }),
    false,
  );
  assert.equal(
    trainingRawObservationRequiresPrerequisiteSentinel({
      phase: "Controlled Discomfort",
      fieldKey: "initialResponse",
      rawOption: "freeze",
      explicitStatus: "confounded",
    }),
    false,
  );
  assert.equal(
    trainingRawObservationRequiresPrerequisiteSentinel({
      phase: "Clarity",
      fieldKey: "method",
      rawOption: "missing",
    }),
    false,
  );
});
