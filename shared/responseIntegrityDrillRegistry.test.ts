import test from "node:test";
import assert from "node:assert/strict";

import {
  RESPONSE_INTEGRITY_DRILL_REGISTRY,
  getDrillSchemaDefinition,
  getDrillSchemaDefinitionByVersion,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getRepPurposeId,
  hasSemanticEvidenceContract,
  validateAndNormalizeSemanticEvidenceSet,
  type EvidenceDrillMode,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import { PHASES, type TopicPhase } from "./topicConditioningEngine";

const buildValidSet = (
  mode: EvidenceDrillMode,
  phase: TopicPhase,
  setIndex: number,
  optionIndex = 0,
): SubmittedEvidenceSet => {
  const schema = getDrillSchemaDefinition(mode, phase);
  const definition = schema.sets[setIndex];
  return {
    setName: definition.setName,
    setId: definition.setId,
    setOrder: setIndex + 1,
    drillSchemaId: schema.schemaId,
    drillSchemaVersion: schema.schemaVersion,
    drillDefinitionHash: schema.definitionHash,
    constraintProfile: definition.constraints,
    observations: definition.modelingOnly
      ? []
      : Array.from({ length: definition.reps }, (_, repIndex) => {
          const rep: Record<string, string> = {
            _rep_id: getRepPurposeId(definition, repIndex),
            _rep_number: String(repIndex + 1),
          };
          definition.fields.forEach((baseField) => {
            const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey)!;
            const selectedIndex = Math.min(optionIndex, field.optionLevels.length - 1);
            const identity = getEvidenceSelectionIdentity({
              mode,
              phase,
              setName: definition.setName,
              repIndex,
              fieldKey: field.fieldKey,
              optionIndex: selectedIndex,
            })!;
            rep[field.fieldKey] = field.optionLabels![selectedIndex];
            rep[`${field.fieldKey}_option_id`] = identity.optionId;
            rep[`${field.fieldKey}_dimension_id`] = identity.dimensionId;
            rep[`${field.fieldKey}_level`] = identity.level;
          });
          return rep;
        }),
  };
};

test("the versioned registry covers every mode and phase with complete option semantics", () => {
  for (const mode of ["diagnosis", "training", "verification"] as const) {
    for (const phase of PHASES) {
      const schema = RESPONSE_INTEGRITY_DRILL_REGISTRY[mode][phase];
      assert.equal(schema.mode, mode);
      assert.equal(schema.phase, phase);
      assert.equal(schema.schemaVersion, 1);
      assert.ok(schema.definitionHash);
      assert.ok(schema.sets.length > 0);

      schema.sets.forEach((definition) => {
        assert.equal(definition.repPurposeIds.length, definition.reps);
        assert.equal(
          definition.fields.reduce((sum, field) => sum + field.scoreWeight, 0),
          definition.modelingOnly ? 0 : 100,
          `${definition.setId} score weights`,
        );
        definition.fields.forEach((baseField) => {
          for (let repIndex = 0; repIndex < definition.reps; repIndex += 1) {
            const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey)!;
            assert.ok(field.optionLabels?.length, `${definition.setId}.${field.fieldKey}`);
            assert.equal(field.optionLabels?.length, field.optionLevels.length);
          }
        });
      });
    }
  }
});

test("stable option identity retains four-option semantics", () => {
  const identity = getEvidenceSelectionIdentity({
    mode: "training",
    phase: "Structured Execution",
    setName: "Required Structure",
    repIndex: 0,
    fieldKey: "repeatability",
    optionIndex: 3,
  });

  assert.deepEqual(
    {
      setId: identity?.setId,
      repId: identity?.repId,
      dimensionId: identity?.dimensionId,
      level: identity?.level,
    },
    {
      setId: "structured_execution.required_structure",
      repId: "structured_execution.required_structure.opportunity_1",
      dimensionId: "execution.repeatability",
      level: "clear",
    },
  );
  assert.match(identity?.optionId || "", /\.option_4$/);
});

test("published schema versions remain explicitly addressable", () => {
  const current = getDrillSchemaDefinition("training", "Controlled Discomfort");
  assert.equal(getDrillSchemaDefinitionByVersion("training", "Controlled Discomfort", 1), current);
  assert.equal(getDrillSchemaDefinitionByVersion("training", "Controlled Discomfort", 2), null);
});

test("semantic evidence validates and is normalized from the registered definition", () => {
  const submittedSet = buildValidSet("training", "Structured Execution", 0, 2);
  const result = validateAndNormalizeSemanticEvidenceSet({
    mode: "training",
    phase: "Structured Execution",
    setIndex: 0,
    submittedSet,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.normalizedSet.constraintProfile?.supportLevel, "minimal");
  assert.equal(result.normalizedSet.observations[0].stepExecution_level, "clear");
});

test("semantic evidence rejects a clear level forged onto a weak option", () => {
  const submittedSet = buildValidSet("training", "Structured Execution", 0, 0);
  submittedSet.observations[0].stepExecution_level = "clear";

  const result = validateAndNormalizeSemanticEvidenceSet({
    mode: "training",
    phase: "Structured Execution",
    setIndex: 0,
    submittedSet,
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Set 1, rep 1 level does not match its option ID",
  });
});

test("semantic evidence rejects a raw option paired with another option ID", () => {
  const submittedSet = buildValidSet("diagnosis", "Clarity", 0, 0);
  submittedSet.observations[0].vocabulary = "clear";

  const result = validateAndNormalizeSemanticEvidenceSet({
    mode: "diagnosis",
    phase: "Clarity",
    setIndex: 0,
    submittedSet,
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Set 1, rep 1 raw option does not match its option ID",
  });
});

test("semantic evidence rejects an unregistered schema version", () => {
  const submittedSet = buildValidSet("verification", "Time Pressure Stability", 0, 2);
  submittedSet.drillSchemaVersion = 2;

  const result = validateAndNormalizeSemanticEvidenceSet({
    mode: "verification",
    phase: "Time Pressure Stability",
    setIndex: 0,
    submittedSet,
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Set 1 has an unsupported drill schema version",
  });
});

test("semantic markers inside reps cannot silently downgrade to the legacy contract", () => {
  const submittedSet = buildValidSet("diagnosis", "Clarity", 0, 1);
  submittedSet.setId = undefined;
  submittedSet.drillSchemaId = undefined;
  submittedSet.drillSchemaVersion = undefined;
  submittedSet.drillDefinitionHash = undefined;

  assert.equal(hasSemanticEvidenceContract(submittedSet), true);
});
