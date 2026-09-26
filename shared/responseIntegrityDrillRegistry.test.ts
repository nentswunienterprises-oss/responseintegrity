import test from "node:test";
import assert from "node:assert/strict";

import {
  RESPONSE_INTEGRITY_DRILL_REGISTRY,
  TRAINING_SET_OBSERVATION_ELIGIBILITY_V3,
  getDrillSchemaDefinition,
  getDrillSchemaDefinitionByVersion,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getFieldDefinitionsForRep,
  getRepPurposeId,
  getScoredFieldDefinitionsForRep,
  hasSemanticEvidenceContract,
  validateAndNormalizeSemanticEvidenceSet,
  type EvidenceDrillMode,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import { PHASES, type TopicPhase } from "./topicConditioningEngine";
import {
  TRAINING_DECISION_EVIDENCE_CLASSES,
  TRAINING_OBSERVATION_MATRIX_V2,
} from "./trainingObservationContractV2";
import type { TrainingDimensionId } from "./trainingEvidenceContract";
import {
  TRAINING_CONDITION_OBSERVATION_DEFINITIONS_V4,
  TRAINING_REP_OBSERVATION_AUTHORITY_V4,
} from "./trainingObservationAuthorityV4";

const buildValidSet = (
  mode: EvidenceDrillMode,
  phase: TopicPhase,
  setIndex: number,
  optionIndex = 0,
  repCount?: number,
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
      : Array.from({ length: repCount ?? definition.reps }, (_, repIndex) => {
          const rep: Record<string, string> = {
            _rep_id: getRepPurposeId(definition, repIndex),
            _rep_number: String(repIndex + 1),
          };
          getFieldDefinitionsForRep(definition, repIndex).forEach((field) => {
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
            if (identity.evidenceClass) {
              rep[`${field.fieldKey}_evidence_class`] = identity.evidenceClass;
            }
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
      assert.equal(
        schema.schemaVersion,
        mode === "verification" ? 3 : mode === "training" ? 4 : 1,
      );
      assert.ok(schema.definitionHash);
      assert.ok(schema.sets.length > 0);

      schema.sets.forEach((definition) => {
        if (definition.completionPolicy === "evidence_sufficient") {
          assert.ok(definition.repPurposeIds.length >= definition.reps);
        } else {
          assert.equal(definition.repPurposeIds.length, definition.reps);
        }
        assert.equal(
          definition.fields.reduce((sum, field) => sum + field.scoreWeight, 0),
          definition.modelingOnly ? 0 : 100,
          `${definition.setId} score weights`,
        );
        for (let repIndex = 0; repIndex < definition.reps; repIndex += 1) {
          const fields = getFieldDefinitionsForRep(definition, repIndex);
          fields.forEach((field) => {
            assert.ok(
              field.optionLabels?.length,
              `${definition.setId}.rep_${repIndex + 1}.${field.fieldKey}`,
            );
            assert.equal(field.optionLabels?.length, field.optionLevels.length);
            if (mode === "verification" || mode === "training") {
              assert.equal(
                field.optionEvidenceClasses?.length,
                field.optionLabels?.length,
              );
            }
          });
        }
      });
    }
  }
});

test("current Training exposes one honest option for every decision-relevant evidence class", () => {
  for (const phase of PHASES) {
    const schema = getDrillSchemaDefinition("training", phase);
    assert.equal(schema.schemaVersion, 4);
    for (const definition of schema.sets) {
      if (definition.modelingOnly) continue;
      for (const field of definition.fields) {
        assert.deepEqual(
          field.optionEvidenceClasses,
          [...TRAINING_DECISION_EVIDENCE_CLASSES],
          `${definition.setId}.${field.fieldKey} evidence-class coverage`,
        );
        assert.equal(field.optionLabels?.length, 4);
        if (field.decisionEligible === false) {
          const condition =
            TRAINING_CONDITION_OBSERVATION_DEFINITIONS_V4[
              field.dimensionId as keyof typeof TRAINING_CONDITION_OBSERVATION_DEFINITIONS_V4
            ];
          assert.ok(condition);
          assert.deepEqual(
            field.optionLabels,
            condition.options.map((option) => option.label),
          );
          continue;
        }
        const canonical =
          TRAINING_OBSERVATION_MATRIX_V2[
            field.dimensionId as TrainingDimensionId
          ];
        assert.ok(canonical);
        assert.deepEqual(
          field.optionLabels,
          canonical.options.map((option) => option.label),
          `${definition.setId}.${field.fieldKey} canonical behavior semantics`,
        );
      }
    }
  }
});

test("Training V3 remains retained with set-level observation eligibility", () => {
  for (const phase of PHASES) {
    const schema = getDrillSchemaDefinitionByVersion("training", phase, 3);
    assert.ok(schema);
    assert.equal(schema!.schemaVersion, 3);
    for (const definition of schema!.sets) {
      if (definition.modelingOnly) continue;
      const expected =
        TRAINING_SET_OBSERVATION_ELIGIBILITY_V3[definition.setId];
      assert.ok(expected, `Missing V3 eligibility law for ${definition.setId}`);
      assert.deepEqual(
        definition.fields.map((field) => field.dimensionId),
        [...expected],
      );
    }
  }
});

test("Training V4 makes observation authority explicit at set and rep level", () => {
  for (const phase of PHASES) {
    const schema = getDrillSchemaDefinition("training", phase);
    assert.equal(schema.schemaVersion, 4);
    for (const definition of schema.sets) {
      if (definition.modelingOnly) continue;
      const authority =
        TRAINING_REP_OBSERVATION_AUTHORITY_V4[definition.setId];
      assert.ok(authority, `Missing V4 authority for ${definition.setId}`);

      for (let repIndex = 0; repIndex < definition.reps; repIndex += 1) {
        const fields = getFieldDefinitionsForRep(definition, repIndex);
        assert.deepEqual(
          fields.map((field) => field.fieldKey),
          authority.reps[repIndex + 1].map((entry) => entry.fieldKey),
          `${definition.setId} rep ${repIndex + 1} field authority`,
        );
        const scored = getScoredFieldDefinitionsForRep(definition, repIndex);
        assert.equal(
          Math.round(
            scored.reduce(
              (sum, field) => sum + Math.max(0, field.scoreWeight),
              0,
            ),
          ),
          100,
          `${definition.setId} rep ${repIndex + 1} weights`,
        );
      }
    }
  }

  const structured = getDrillSchemaDefinition(
    "training",
    "Structured Execution",
  );
  for (const setId of [
    "structured_execution.required_structure",
    "structured_execution.independent_execution",
    "structured_execution.variation_control",
  ]) {
    const definition = structured.sets.find((set) => set.setId === setId)!;
    assert.equal(
      getFieldDefinitionsForRep(definition, 0).some(
        (field) => field.dimensionId === "execution.repeatability",
      ),
      false,
      `${setId} rep 1 must not claim cross-rep repeatability`,
    );
    for (const repIndex of [1, 2]) {
      assert.equal(
        getFieldDefinitionsForRep(definition, repIndex).some(
          (field) => field.dimensionId === "execution.repeatability",
        ),
        true,
        `${setId} rep ${repIndex + 1} must expose repeatability`,
      );
    }
  }

  const required = structured.sets.find(
    (set) => set.setId === "structured_execution.required_structure",
  )!;
  const stepPlan = getFieldDefinitionsForRep(required, 0).find(
    (field) => field.fieldKey === "stepPlanAccuracy",
  );
  assert.ok(stepPlan);
  assert.equal(stepPlan?.decisionEligible, false);
  assert.equal(stepPlan?.authorityRole, "condition_check");
  assert.equal(stepPlan?.scoreWeight, 0);
  assert.match(stepPlan?.observationQuestion || "", /before solving/i);
});


test("Training V4 rejects evidence outside the active set-rep authority", () => {
  const schema = getDrillSchemaDefinition("training", "Clarity");
  const identificationIndex = schema.sets.findIndex(
    (set) => set.setId === "clarity.identification",
  );
  assert.notEqual(identificationIndex, -1);
  const submitted = buildValidSet(
    "training",
    "Clarity",
    identificationIndex,
    3,
  );
  submitted.observations[0].immediateApply =
    "Engaged independently and appropriately";
  submitted.observations[0].immediateApply_option_id =
    "clarity.identification.opportunity_1.clarity.immediate_apply.option_4";
  submitted.observations[0].immediateApply_dimension_id =
    "clarity.immediate_apply";
  submitted.observations[0].immediateApply_level = "clear";
  submitted.observations[0].immediateApply_evidence_class = "supported";

  const result = validateAndNormalizeSemanticEvidenceSet({
    mode: "training",
    phase: "Clarity",
    setIndex: identificationIndex,
    submittedSet: submitted,
  });

  assert.deepEqual(result, {
    ok: false,
    error:
      `Set ${identificationIndex + 1}, rep 1 contains evidence for a dimension that is not eligible under this set/rep condition`,
  });
});

test("the same Training dimension cannot silently change meaning between sets", () => {
  const seen = new Map<
    string,
    { labels: string[]; classes: string[] }
  >();

  for (const phase of PHASES) {
    const schema = getDrillSchemaDefinition("training", phase);
    for (const definition of schema.sets) {
      if (definition.modelingOnly) continue;
      for (const field of definition.fields.filter(
        (candidate) => candidate.decisionEligible !== false,
      )) {
        const current = {
          labels: [...(field.optionLabels || [])],
          classes: [...(field.optionEvidenceClasses || [])],
        };
        const previous = seen.get(field.dimensionId);
        if (previous) {
          assert.deepEqual(
            current,
            previous,
            `${field.dimensionId} drifted inside ${definition.setId}`,
          );
        } else {
          seen.set(field.dimensionId, current);
        }
      }
    }
  }
});

test("Training V1 remains historical while V2 restores partial recognition separately from hesitation", () => {
  const historical = getDrillSchemaDefinitionByVersion(
    "training",
    "Clarity",
    1,
  );
  const current = getDrillSchemaDefinition("training", "Clarity");
  const historicalIdentification = historical?.sets.find(
    (set) => set.setId === "clarity.identification",
  );
  const currentIdentification = current.sets.find(
    (set) => set.setId === "clarity.identification",
  );
  const historicalVocabulary = historicalIdentification?.fields.find(
    (field) => field.fieldKey === "vocabulary",
  );
  const currentVocabulary = currentIdentification?.fields.find(
    (field) => field.fieldKey === "vocabulary",
  );

  assert.deepEqual(historicalVocabulary?.optionLabels, [
    "wrong",
    "hesitant",
    "correct",
  ]);
  assert.deepEqual(currentVocabulary?.optionEvidenceClasses, [
    "breakdown",
    "conditional",
    "near_stable",
    "supported",
  ]);
  assert.match(currentVocabulary?.optionLabels?.[1] || "", /fragments/i);
  assert.match(currentVocabulary?.optionLabels?.[2] || "", /imprecision/i);
});

test("Training V2 student-behavior options do not encode Specialist intervention events", () => {
  const forbidden = /\b(prompted|specialist supplied|teaching\/full rescue|timer changed)\b/i;
  for (const phase of PHASES) {
    const schema = getDrillSchemaDefinition("training", phase);
    for (const definition of schema.sets) {
      if (definition.modelingOnly) continue;
      for (const field of definition.fields) {
        for (const label of field.optionLabels || []) {
          assert.doesNotMatch(
            label,
            forbidden,
            `${definition.setId}.${field.fieldKey}: ${label}`,
          );
        }
      }
    }
  }
});

test("repeatability identity exists only after a comparable Structured Execution opportunity", () => {
  const repOne = getEvidenceSelectionIdentity({
    mode: "training",
    phase: "Structured Execution",
    setName: "Required Structure",
    repIndex: 0,
    fieldKey: "repeatability",
    optionIndex: 3,
  });
  assert.equal(repOne, null);

  const repTwo = getEvidenceSelectionIdentity({
    mode: "training",
    phase: "Structured Execution",
    setName: "Required Structure",
    repIndex: 1,
    fieldKey: "repeatability",
    optionIndex: 3,
  });
  assert.equal(repTwo?.dimensionId, "execution.repeatability");
  assert.equal(repTwo?.level, "clear");
  assert.match(repTwo?.optionId || "", /\.option_4$/);
});


test("published schema versions remain explicitly addressable", () => {
  const current = getDrillSchemaDefinition("training", "Controlled Discomfort");
  assert.equal(current.schemaVersion, 4);
  assert.equal(
    getDrillSchemaDefinitionByVersion("training", "Controlled Discomfort", 1)?.schemaVersion,
    1,
  );
  assert.equal(
    getDrillSchemaDefinitionByVersion("training", "Controlled Discomfort", 2)?.schemaVersion,
    2,
  );
  assert.equal(
    getDrillSchemaDefinitionByVersion("training", "Controlled Discomfort", 3)?.schemaVersion,
    3,
  );
  assert.equal(
    getDrillSchemaDefinitionByVersion("training", "Controlled Discomfort", 4),
    current,
  );
  assert.equal(
    getDrillSchemaDefinitionByVersion("training", "Controlled Discomfort", 5),
    null,
  );
  assert.equal(getDrillSchemaDefinitionByVersion("verification", "Structured Execution", 1)?.schemaVersion, 1);
  assert.equal(getDrillSchemaDefinitionByVersion("verification", "Structured Execution", 2)?.schemaVersion, 2);
  assert.equal(getDrillSchemaDefinition("verification", "Structured Execution").schemaVersion, 3);
  assert.equal(
    getDrillSchemaDefinitionByVersion("verification", "Structured Execution", 3),
    getDrillSchemaDefinition("verification", "Structured Execution"),
  );
});

test("handover v3 uses the canonical Response Evidence behavior classes", () => {
  const schema = getDrillSchemaDefinition("verification", "Structured Execution");
  const definition = schema.sets[0];
  const field = definition.fields.find((item) => item.dimensionId === "execution.start");
  assert.ok(field);
  assert.deepEqual(field?.optionEvidenceClasses, [
    "breakdown",
    "conditional",
    "near_stable",
    "supported",
    "not_observed",
    "confounded",
  ]);
  assert.match(field?.optionLabels?.[4] || "", /not meaningfully observable/i);
  assert.match(field?.optionLabels?.[5] || "", /confounded/i);
});

test("handover verification accepts evidence-driven opportunity counts while fixed drills stay fixed", () => {
  for (const count of [1, 2, 3, 4, 5]) {
    const submittedSet = buildValidSet("verification", "Clarity", 0, 2, count);
    const result = validateAndNormalizeSemanticEvidenceSet({ mode: "verification", phase: "Clarity", setIndex: 0, submittedSet });
    assert.equal(result.ok, true);
  }
  const tooMany = buildValidSet("verification", "Clarity", 0, 2, 6);
  assert.equal(validateAndNormalizeSemanticEvidenceSet({ mode: "verification", phase: "Clarity", setIndex: 0, submittedSet: tooMany }).ok, false);
  const shortTraining = buildValidSet("training", "Structured Execution", 0, 2, 2);
  assert.equal(validateAndNormalizeSemanticEvidenceSet({ mode: "training", phase: "Structured Execution", setIndex: 0, submittedSet: shortTraining }).ok, false);
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
  assert.equal(result.normalizedSet.observations[0].stepExecution_level, "partial");
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
  submittedSet.drillSchemaVersion = 4;

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

test("handover rejects a forged behavior class paired with a canonical option ID", () => {
  const submittedSet = buildValidSet("verification", "Clarity", 0, 3);
  submittedSet.observations[0].method_evidence_class = "breakdown";

  const result = validateAndNormalizeSemanticEvidenceSet({
    mode: "verification",
    phase: "Clarity",
    setIndex: 0,
    submittedSet,
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Set 1, rep 1 evidence class does not match its option ID",
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
