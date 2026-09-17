import test from "node:test";
import assert from "node:assert/strict";

import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getRepPurposeId,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import {
  encodeRepOperationalEvidenceV2,
  decodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
} from "./responseIntegrityEvidenceContractV2";
import {
  applyApprovedEvidenceCorrection,
  resolveObservationCorrectionProposal,
  type ApprovedEvidenceCorrection,
  type CorrectionSourceEvidenceRow,
} from "./responseIntegrityEvidenceCorrection";

const buildStructuredSet = (optionIndex = 0): SubmittedEvidenceSet => {
  const mode = "training" as const;
  const phase = "Structured Execution" as const;
  const schema = getDrillSchemaDefinition(mode, phase);
  const definition = schema.sets[0];
  return {
    setName: definition.setName,
    setId: definition.setId,
    setOrder: 1,
    drillSchemaId: schema.schemaId,
    drillSchemaVersion: schema.schemaVersion,
    drillDefinitionHash: schema.definitionHash,
    constraintProfile: definition.constraints,
    observations: Array.from({ length: definition.reps }, (_, repIndex) => {
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
      rep[REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY] = encodeRepOperationalEvidenceV2({
        repId: getRepPurposeId(definition, repIndex),
        repNumber: repIndex + 1,
        actualSupportUsed: "none",
        timing: {
          mode: "passive_untimed",
          startedAt: "2026-09-17T08:00:00.000Z",
          endedAt: "2026-09-17T08:00:45.000Z",
          elapsedMs: 45000,
          timingValidity: "valid",
          pressureLevel: "none",
        },
        inheritedEvidence: [],
      });
      return rep;
    }),
  };
};

const sourceRowForStepExecution = (set: SubmittedEvidenceSet): CorrectionSourceEvidenceRow => {
  const rep = set.observations[0];
  return {
    evidence_id: "drill-1::block_1::structured_execution.required_structure::structured_execution.required_structure.opportunity_1::execution.step_discipline",
    source_drill_id: "drill-1",
    student_id: "student-1",
    tutor_id: "tutor-1",
    topic: "Linear Equations",
    block_order: 1,
    set_id: String(set.setId),
    set_order: 1,
    rep_id: String(rep._rep_id),
    rep_number: 1,
    dimension_id: "execution.step_discipline",
    field_key: "stepExecution",
    drill_type: "training",
    phase: "Structured Execution",
    drill_schema_id: String(set.drillSchemaId),
    drill_schema_version: Number(set.drillSchemaVersion),
    drill_definition_hash: String(set.drillDefinitionHash),
    option_id: rep.stepExecution_option_id,
    raw_option: rep.stepExecution,
    normalized_level: rep.stepExecution_level as "weak" | "partial" | "clear",
  };
};

test("observation correction proposal resolves against retained schema semantics", () => {
  const set = buildStructuredSet(0);
  const source = sourceRowForStepExecution(set);
  const proposed = getEvidenceSelectionIdentity({
    mode: "training",
    phase: "Structured Execution",
    setName: set.setName,
    repIndex: 0,
    fieldKey: "stepExecution",
    optionIndex: 2,
  })!;

  assert.deepEqual(resolveObservationCorrectionProposal(source, proposed.optionId), {
    proposedOptionId: proposed.optionId,
    proposedRawOption: "full",
    proposedNormalizedLevel: "clear",
  });
});

test("approved observation correction overlays only the exact submitted source fact", () => {
  const set = buildStructuredSet(0);
  const source = sourceRowForStepExecution(set);
  const proposed = getEvidenceSelectionIdentity({
    mode: "training",
    phase: "Structured Execution",
    setName: set.setName,
    repIndex: 0,
    fieldKey: "stepExecution",
    optionIndex: 2,
  })!;
  const correction: ApprovedEvidenceCorrection = {
    correctionId: "correction-1",
    correctionKind: "observation_option",
    sourceEvidenceId: source.evidence_id,
    sourceDrillId: source.source_drill_id,
    blockOrder: 1,
    setId: source.set_id,
    setOrder: source.set_order,
    repId: source.rep_id,
    repNumber: source.rep_number,
    dimensionId: source.dimension_id,
    fieldKey: source.field_key,
    drillType: source.drill_type,
    phase: source.phase,
    drillSchemaId: source.drill_schema_id,
    drillSchemaVersion: source.drill_schema_version,
    drillDefinitionHash: source.drill_definition_hash,
    originalOptionId: source.option_id,
    originalRawOption: source.raw_option,
    originalNormalizedLevel: source.normalized_level,
    proposedOptionId: proposed.optionId,
    proposedRawOption: "full",
    proposedNormalizedLevel: "clear",
  };

  const result = applyApprovedEvidenceCorrection([set], correction);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.sets[0].observations[0].stepExecution, "full");
  assert.equal(result.sets[0].observations[0].stepExecution_level, "clear");
  assert.equal(result.sets[0].observations[1].stepExecution, set.observations[1].stepExecution);
  assert.equal(set.observations[0].stepExecution, "skips", "source evidence stays immutable");
});

test("approved support correction updates only V2 actual-support source fact", () => {
  const set = buildStructuredSet(2);
  const schema = getDrillSchemaDefinition("training", "Structured Execution");
  const definition = schema.sets[0];
  const correction: ApprovedEvidenceCorrection = {
    correctionId: "correction-support",
    correctionKind: "actual_support_used",
    sourceDrillId: "drill-1",
    blockOrder: 1,
    setId: definition.setId,
    setOrder: 1,
    repId: getRepPurposeId(definition, 0),
    repNumber: 1,
    drillType: "training",
    phase: "Structured Execution",
    drillSchemaId: schema.schemaId,
    drillSchemaVersion: schema.schemaVersion,
    drillDefinitionHash: schema.definitionHash,
    originalActualSupportUsed: "none",
    proposedActualSupportUsed: "response_control_cue",
  };

  const result = applyApprovedEvidenceCorrection([set], correction);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const corrected = decodeRepOperationalEvidenceV2(
    result.sets[0].observations[0][REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY],
  );
  const untouched = decodeRepOperationalEvidenceV2(
    result.sets[0].observations[1][REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY],
  );
  assert.equal(corrected?.actualSupportUsed, "response_control_cue");
  assert.equal(untouched?.actualSupportUsed, "none");
  assert.equal(
    decodeRepOperationalEvidenceV2(set.observations[0][REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY])?.actualSupportUsed,
    "none",
    "source evidence stays immutable",
  );
});

test("correction overlay rejects stale original identity instead of mutating history", () => {
  const set = buildStructuredSet(0);
  const source = sourceRowForStepExecution(set);
  const correction: ApprovedEvidenceCorrection = {
    correctionId: "stale",
    correctionKind: "observation_option",
    sourceEvidenceId: source.evidence_id,
    sourceDrillId: source.source_drill_id,
    blockOrder: 1,
    setId: source.set_id,
    setOrder: source.set_order,
    repId: source.rep_id,
    repNumber: 1,
    dimensionId: source.dimension_id,
    fieldKey: source.field_key,
    drillType: "training",
    phase: "Structured Execution",
    drillSchemaId: source.drill_schema_id,
    drillSchemaVersion: source.drill_schema_version,
    drillDefinitionHash: source.drill_definition_hash,
    originalOptionId: "wrong-original",
    proposedOptionId: source.option_id,
    proposedRawOption: source.raw_option,
    proposedNormalizedLevel: source.normalized_level,
  };
  const result = applyApprovedEvidenceCorrection([set], correction);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /original option/i);
});
