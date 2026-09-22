import test from "node:test";
import assert from "node:assert/strict";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import { evaluateHandoverVerificationEvidence } from "./handoverEvidenceEvaluator";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";

const buildVerificationSet = (
  phase: TopicPhase,
  optionIndexFor: (fieldKey: string, repIndex: number, optionCount: number) => number,
): SubmittedEvidenceSet => {
  const schema = getDrillSchemaDefinition("verification", phase);
  const definition = schema.sets[0];
  return {
    setName: definition.setName,
    setId: definition.setId,
    setOrder: 1,
    drillSchemaId: schema.schemaId,
    drillSchemaVersion: schema.schemaVersion,
    drillDefinitionHash: schema.definitionHash,
    constraintProfile: { ...definition.constraints },
    observations: Array.from({ length: definition.reps }, (_, repIndex) => {
      const rep: Record<string, string> = {
        _rep_id: definition.repPurposeIds[repIndex],
        _rep_number: String(repIndex + 1),
      };
      definition.fields.forEach((baseField) => {
        const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey) || baseField;
        const labels = [...(field.optionLabels || [])];
        const optionIndex = Math.max(0, Math.min(labels.length - 1, optionIndexFor(field.fieldKey, repIndex, labels.length)));
        const identity = getEvidenceSelectionIdentity({
          mode: "verification",
          phase,
          setName: definition.setName,
          repIndex,
          fieldKey: field.fieldKey,
          optionIndex,
        });
        assert.ok(identity);
        rep[field.fieldKey] = labels[optionIndex];
        rep[field.fieldKey + "_option_id"] = identity.optionId;
        rep[field.fieldKey + "_dimension_id"] = identity.dimensionId;
        rep[field.fieldKey + "_level"] = identity.level;
      });
      return rep;
    }),
  };
};

const evaluate = (
  phase: TopicPhase,
  previousStability: TopicStability,
  set: SubmittedEvidenceSet,
) => {
  const result = evaluateHandoverVerificationEvidence({ phase, previousStability, set });
  assert.equal(result.status, "evaluated");
  return result as Extract<typeof result, { status: "evaluated" }>;
};

test("repeated supported continuity evidence holds the inherited state", () => {
  const set = buildVerificationSet("Structured Execution", (_field, _rep, count) => count - 1);
  const result = evaluate("Structured Execution", "High", set);
  assert.equal(result.authority, "evidence_native");
  assert.equal(result.verificationOutcome, "hold");
  assert.equal(result.confidence, "strong");
  assert.equal(result.resultingStability, "High");
  assert.equal(result.reDiagnosisRequired, false);
});

test("conditional continuity evidence adjusts stability without changing phase", () => {
  const set = buildVerificationSet("Controlled Discomfort", (field, _rep, count) =>
    field === "discomfortTolerance" ? 1 : count - 1
  );
  const result = evaluate("Controlled Discomfort", "High Maintenance", set);
  assert.equal(result.verificationOutcome, "stability_adjust");
  assert.equal(result.resultingPhase, "Controlled Discomfort");
  assert.equal(result.resultingStability, "High");
  assert.equal(result.reDiagnosisRequired, false);
});

test("confirmed phase-defining breakdown requires targeted re-diagnosis", () => {
  const set = buildVerificationSet("Time Pressure Stability", (field, rep, count) =>
    field === "structureUnderTime" && rep >= 1 ? 0 : count - 1
  );
  const result = evaluate("Time Pressure Stability", "High", set);
  assert.equal(result.verificationOutcome, "targeted_re_diagnosis_required");
  assert.equal(result.resultingPhase, "Time Pressure Stability");
  assert.equal(result.resultingStability, "High");
  assert.equal(result.reDiagnosisRequired, true);
  assert.equal(
    result.dimensions.find((dimension) => dimension.dimensionId === "time.structure")?.state,
    "BREAKDOWN",
  );
});

test("forged semantic evidence is unavailable rather than scored", () => {
  const set = buildVerificationSet("Clarity", (_field, _rep, count) => count - 1);
  set.observations[0].vocabulary_level = "weak";
  const result = evaluateHandoverVerificationEvidence({
    phase: "Clarity",
    previousStability: "Medium",
    set,
  });
  assert.equal(result.status, "unavailable");
});
