import {
  getDrillSchemaDefinitionByVersion,
  getFieldDefinitionForRep,
  type EvidenceDrillMode,
} from "../shared/responseIntegrityDrillRegistry";
import { tryParsePhase } from "../shared/topicConditioningEngine";

export type EvidenceCorrectionLedgerRow = {
  evidence_id: string;
  source_drill_id: string;
  student_id: string;
  tutor_id: string;
  topic: string;
  drill_type: string;
  drill_schema_version: number;
  phase: string;
  set_id: string;
  set_order: number;
  rep_id: string;
  rep_number: number;
  dimension_id: string;
  field_key: string;
  option_id: string;
  raw_option: string;
  normalized_level: string;
};

export type EvidenceCorrectionRow = {
  correction_id: string;
  evidence_id: string;
  correction_sequence: number;
  previous_option_id: string;
  previous_raw_option: string;
  previous_normalized_level: string;
  corrected_option_id: string;
  corrected_raw_option: string;
  corrected_normalized_level: string;
  reason: string;
  requested_by: string;
  requested_by_role: string;
  state_review_required: boolean;
  created_at: string;
};

export type EvidenceCorrectionOption = {
  optionId: string;
  rawOption: string;
  normalizedLevel: string;
};

const clean = (value: unknown) => String(value || "").trim();

export function getEvidenceCorrectionOptions(
  row: EvidenceCorrectionLedgerRow,
): EvidenceCorrectionOption[] {
  const phase = tryParsePhase(row.phase);
  const drillType = clean(row.drill_type) as EvidenceDrillMode;
  if (!phase || !["diagnosis", "training", "verification"].includes(drillType)) return [];

  const schema = getDrillSchemaDefinitionByVersion(
    drillType,
    phase,
    Number(row.drill_schema_version),
  );
  if (!schema) return [];

  const setDefinition = schema.sets[Number(row.set_order) - 1];
  if (!setDefinition || setDefinition.setId !== row.set_id) return [];

  const field = getFieldDefinitionForRep(
    setDefinition,
    Number(row.rep_number) - 1,
    row.field_key,
  );
  if (!field || field.dimensionId !== row.dimension_id) return [];

  return (field.optionLabels || []).map((rawOption, index) => ({
    optionId: `${row.rep_id}.${row.dimension_id}.option_${index + 1}`,
    rawOption,
    normalizedLevel: String(field.optionLevels[index] || ""),
  }));
}

const orderedCorrections = (corrections: EvidenceCorrectionRow[]) =>
  [...corrections].sort((a, b) => Number(a.correction_sequence) - Number(b.correction_sequence));

export function buildEvidenceCorrectionCandidate(
  row: EvidenceCorrectionLedgerRow,
  corrections: EvidenceCorrectionRow[],
) {
  const history = orderedCorrections(corrections);
  const latest = history[history.length - 1] || null;
  const options = getEvidenceCorrectionOptions(row);

  return {
    evidenceId: row.evidence_id,
    sourceDrillId: row.source_drill_id,
    topic: row.topic,
    setId: row.set_id,
    setOrder: Number(row.set_order),
    repId: row.rep_id,
    repNumber: Number(row.rep_number),
    dimensionId: row.dimension_id,
    fieldKey: row.field_key,
    original: {
      optionId: row.option_id,
      rawOption: row.raw_option,
      normalizedLevel: row.normalized_level,
    },
    effective: latest
      ? {
          optionId: latest.corrected_option_id,
          rawOption: latest.corrected_raw_option,
          normalizedLevel: latest.corrected_normalized_level,
        }
      : {
          optionId: row.option_id,
          rawOption: row.raw_option,
          normalizedLevel: row.normalized_level,
        },
    options,
    correctionHistory: history.map((item) => ({
      correctionId: item.correction_id,
      sequence: Number(item.correction_sequence),
      previousOptionId: item.previous_option_id,
      previousRawOption: item.previous_raw_option,
      correctedOptionId: item.corrected_option_id,
      correctedRawOption: item.corrected_raw_option,
      reason: item.reason,
      requestedByRole: item.requested_by_role,
      stateReviewRequired: Boolean(item.state_review_required),
      createdAt: item.created_at,
    })),
  };
}

export function prepareEvidenceCorrectionInsert({
  row,
  corrections,
  correctedOptionId,
  reason,
  requestedBy,
}: {
  row: EvidenceCorrectionLedgerRow;
  corrections: EvidenceCorrectionRow[];
  correctedOptionId: string;
  reason: string;
  requestedBy: string;
}) {
  const trimmedReason = clean(reason);
  if (trimmedReason.length < 10) {
    return { ok: false as const, error: "Correction reason must explain the recording mistake in at least 10 characters." };
  }
  if (trimmedReason.length > 1000) {
    return { ok: false as const, error: "Correction reason is too long." };
  }

  const candidate = buildEvidenceCorrectionCandidate(row, corrections);
  const corrected = candidate.options.find((option) => option.optionId === clean(correctedOptionId));
  if (!corrected) {
    return { ok: false as const, error: "Corrected option is not valid for this retained evidence schema." };
  }
  if (corrected.optionId === candidate.effective.optionId) {
    return { ok: false as const, error: "Corrected option must differ from the currently effective observation." };
  }

  const history = orderedCorrections(corrections);
  const nextSequence = (history[history.length - 1]?.correction_sequence || 0) + 1;

  return {
    ok: true as const,
    insert: {
      evidence_id: row.evidence_id,
      source_drill_id: row.source_drill_id,
      student_id: row.student_id,
      tutor_id: row.tutor_id,
      correction_sequence: nextSequence,
      previous_option_id: candidate.effective.optionId,
      previous_raw_option: candidate.effective.rawOption,
      previous_normalized_level: candidate.effective.normalizedLevel,
      corrected_option_id: corrected.optionId,
      corrected_raw_option: corrected.rawOption,
      corrected_normalized_level: corrected.normalizedLevel,
      reason: trimmedReason,
      requested_by: clean(requestedBy),
      requested_by_role: "tutor",
      state_review_required: true,
    },
  };
}
