import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEvidenceCorrectionCandidate,
  getEvidenceCorrectionOptions,
  prepareEvidenceCorrectionInsert,
  type EvidenceCorrectionLedgerRow,
  type EvidenceCorrectionRow,
} from "./responseIntegrityEvidenceCorrections";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
} from "../shared/responseIntegrityDrillRegistry";

function buildLedgerRow(): EvidenceCorrectionLedgerRow {
  const phase = "Structured Execution" as const;
  const schema = getDrillSchemaDefinition("training", phase);
  const set = schema.sets[1];
  const field = getFieldDefinitionForRep(set, 0, "stepExecution")!;
  const identity = getEvidenceSelectionIdentity({
    mode: "training",
    phase,
    setName: set.setName,
    repIndex: 0,
    fieldKey: field.fieldKey,
    optionIndex: 0,
  })!;

  return {
    evidence_id: "drill::block_2::set::rep::dimension",
    source_drill_id: "11111111-1111-4111-8111-111111111111",
    student_id: "22222222-2222-4222-8222-222222222222",
    tutor_id: "33333333-3333-4333-8333-333333333333",
    topic: "Fractions",
    drill_type: "training",
    drill_schema_version: schema.schemaVersion,
    phase,
    set_id: set.setId,
    set_order: 2,
    rep_id: set.repPurposeIds[0],
    rep_number: 1,
    dimension_id: field.dimensionId,
    field_key: field.fieldKey,
    option_id: identity.optionId,
    raw_option: field.optionLabels![0],
    normalized_level: identity.level,
  };
}

test("correction choices stay inside the retained source schema", () => {
  const row = buildLedgerRow();
  const options = getEvidenceCorrectionOptions(row);
  assert.equal(options.length, 4);
  assert.equal(options[0].optionId, row.option_id);
  assert.equal(options[0].rawOption, row.raw_option);
  assert.equal(options[3].rawOption, "no correction needed");
});

test("first correction preserves the original and appends a traceable replacement", () => {
  const row = buildLedgerRow();
  const options = getEvidenceCorrectionOptions(row);
  const prepared = prepareEvidenceCorrectionInsert({
    row,
    corrections: [],
    correctedOptionId: options[2].optionId,
    reason: "I selected the wrong behavior after the rep.",
    requestedBy: row.tutor_id,
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.insert.correction_sequence, 1);
  assert.equal(prepared.insert.previous_option_id, row.option_id);
  assert.equal(prepared.insert.corrected_option_id, options[2].optionId);
  assert.equal(prepared.insert.state_review_required, true);
});

test("a later correction supersedes the effective correction without mutating history", () => {
  const row = buildLedgerRow();
  const options = getEvidenceCorrectionOptions(row);
  const prior: EvidenceCorrectionRow = {
    correction_id: "c1",
    evidence_id: row.evidence_id,
    correction_sequence: 1,
    previous_option_id: row.option_id,
    previous_raw_option: row.raw_option,
    previous_normalized_level: row.normalized_level,
    corrected_option_id: options[2].optionId,
    corrected_raw_option: options[2].rawOption,
    corrected_normalized_level: options[2].normalizedLevel,
    reason: "Initial correction reason.",
    requested_by: row.tutor_id,
    requested_by_role: "tutor",
    state_review_required: true,
    created_at: "2026-09-24T20:00:00.000Z",
  };
  const candidate = buildEvidenceCorrectionCandidate(row, [prior]);
  assert.equal(candidate.original.optionId, row.option_id);
  assert.equal(candidate.effective.optionId, options[2].optionId);

  const prepared = prepareEvidenceCorrectionInsert({
    row,
    corrections: [prior],
    correctedOptionId: options[3].optionId,
    reason: "Second review found the precise behavior option.",
    requestedBy: row.tutor_id,
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.insert.correction_sequence, 2);
  assert.equal(prepared.insert.previous_option_id, options[2].optionId);
  assert.equal(prepared.insert.corrected_option_id, options[3].optionId);
});

test("corrections fail closed on same-value, invalid-option, and vague reason requests", () => {
  const row = buildLedgerRow();
  assert.equal(prepareEvidenceCorrectionInsert({
    row,
    corrections: [],
    correctedOptionId: row.option_id,
    reason: "This is a sufficiently clear reason.",
    requestedBy: row.tutor_id,
  }).ok, false);

  assert.equal(prepareEvidenceCorrectionInsert({
    row,
    corrections: [],
    correctedOptionId: "not-a-real-option",
    reason: "This is a sufficiently clear reason.",
    requestedBy: row.tutor_id,
  }).ok, false);

  assert.equal(prepareEvidenceCorrectionInsert({
    row,
    corrections: [],
    correctedOptionId: getEvidenceCorrectionOptions(row)[1].optionId,
    reason: "wrong",
    requestedBy: row.tutor_id,
  }).ok, false);
});
