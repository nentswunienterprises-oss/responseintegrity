import test from "node:test";
import assert from "node:assert/strict";

import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import { evaluateTrainingEvidenceShadow } from "./trainingEvidenceEvaluator";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";

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

const evaluate = (
  phase: TopicPhase,
  previousStability: TopicStability,
  sets: SubmittedEvidenceSet[],
) => {
  const result = evaluateTrainingEvidenceShadow({ phase, previousStability, sets });
  assert.equal(result.status, "evaluated");
  return result as Extract<typeof result, { status: "evaluated" }>;
};

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
        setId === "structured_execution.required_structure" &&
        fieldKey === "startBehavior" &&
        repIndex < 2
      ) {
        return 0;
      }
      return optionLabels.length - 1;
    },
  });

  const result = evaluate("Structured Execution", "High", sets);
  const start = result.dimensions.find((item) => item.dimensionId === "execution.start");

  assert.equal(start?.state, "BREAKDOWN");
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
      if (
        setId === "time_pressure.repeated_timed_execution" &&
        fieldKey === "paceControl" &&
        repIndex === 1
      ) {
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
