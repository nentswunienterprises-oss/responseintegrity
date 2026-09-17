import {
  getDrillSchemaDefinitionByVersion,
  getFieldDefinitionForRep,
  resolveEvidenceSelection,
  type EvidenceDrillMode,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import {
  decodeRepOperationalEvidenceV2,
  encodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
  type ActualSupportUsedV2,
} from "./responseIntegrityEvidenceContractV2";
import { tryParsePhase, type TopicPhase } from "./topicConditioningEngine";

export type EvidenceCorrectionKind = "observation_option" | "actual_support_used";

export type CorrectionSourceEvidenceRow = {
  evidence_id: string;
  source_drill_id: string;
  student_id: string;
  tutor_id: string;
  topic: string;
  block_order: number;
  set_id: string;
  set_order: number;
  rep_id: string;
  rep_number: number;
  dimension_id: string;
  field_key: string;
  drill_type: EvidenceDrillMode;
  phase: TopicPhase;
  drill_schema_id: string;
  drill_schema_version: number;
  drill_definition_hash: string;
  option_id: string;
  raw_option: string;
  normalized_level: "weak" | "partial" | "clear";
};

export type ApprovedEvidenceCorrection = {
  correctionId: string;
  correctionKind: EvidenceCorrectionKind;
  sourceEvidenceId?: string | null;
  sourceDrillId: string;
  blockOrder: number;
  setId: string;
  setOrder: number;
  repId: string;
  repNumber: number;
  dimensionId?: string | null;
  fieldKey?: string | null;
  drillType: EvidenceDrillMode;
  phase: TopicPhase;
  drillSchemaId: string;
  drillSchemaVersion: number;
  drillDefinitionHash: string;
  originalOptionId?: string | null;
  originalRawOption?: string | null;
  originalNormalizedLevel?: "weak" | "partial" | "clear" | null;
  proposedOptionId?: string | null;
  proposedRawOption?: string | null;
  proposedNormalizedLevel?: "weak" | "partial" | "clear" | null;
  originalActualSupportUsed?: ActualSupportUsedV2 | null;
  proposedActualSupportUsed?: ActualSupportUsedV2 | null;
};

export type ObservationCorrectionProposal = {
  proposedOptionId: string;
  proposedRawOption: string;
  proposedNormalizedLevel: "weak" | "partial" | "clear";
};

const ACTUAL_SUPPORT_VALUES = new Set<ActualSupportUsedV2>([
  "none",
  "response_control_cue",
  "first_step_math_support",
  "beyond_permitted_boundary",
]);

const cloneSets = <T extends SubmittedEvidenceSet>(sets: T[]): T[] =>
  JSON.parse(JSON.stringify(sets)) as T[];

export const resolveObservationCorrectionProposal = (
  source: CorrectionSourceEvidenceRow,
  proposedOptionId: string,
): ObservationCorrectionProposal | null => {
  const mode = source.drill_type;
  const phase = tryParsePhase(source.phase);
  if (!phase || !["diagnosis", "training", "verification"].includes(mode)) return null;
  const schema = getDrillSchemaDefinitionByVersion(mode, phase, Number(source.drill_schema_version));
  if (!schema) return null;
  if (schema.schemaId !== source.drill_schema_id || schema.definitionHash !== source.drill_definition_hash) return null;

  const resolved = resolveEvidenceSelection({
    mode,
    phase,
    setId: source.set_id,
    repIndex: Number(source.rep_number) - 1,
    fieldKey: source.field_key,
    optionId: proposedOptionId,
    schemaVersion: Number(source.drill_schema_version),
  });
  if (!resolved) return null;
  if (resolved.repId !== source.rep_id || resolved.field.dimensionId !== source.dimension_id) return null;
  const proposedRawOption = String(resolved.field.optionLabels?.[resolved.optionIndex] || "").trim();
  if (!proposedRawOption) return null;

  return {
    proposedOptionId,
    proposedRawOption,
    proposedNormalizedLevel: resolved.level,
  };
};

export const isActualSupportUsedV2 = (value: unknown): value is ActualSupportUsedV2 =>
  ACTUAL_SUPPORT_VALUES.has(value as ActualSupportUsedV2);

export const validateActualSupportCorrection = (
  originalValue: unknown,
  proposedValue: unknown,
): { original: ActualSupportUsedV2; proposed: ActualSupportUsedV2 } | null => {
  if (!isActualSupportUsedV2(originalValue) || !isActualSupportUsedV2(proposedValue)) return null;
  if (originalValue === proposedValue) return null;
  return { original: originalValue, proposed: proposedValue };
};

export type CorrectionOverlayResult<T extends SubmittedEvidenceSet = SubmittedEvidenceSet> =
  | { ok: true; sets: T[] }
  | { ok: false; error: string };

export const applyApprovedEvidenceCorrection = <T extends SubmittedEvidenceSet>(
  inputSets: T[],
  correction: ApprovedEvidenceCorrection,
): CorrectionOverlayResult<T> => {
  const sets = cloneSets(inputSets);
  const set = sets[correction.blockOrder - 1];
  if (!set) return { ok: false, error: "Correction target block does not exist" };
  if (String(set.setId || "") !== correction.setId || Number(set.setOrder) !== correction.setOrder) {
    return { ok: false, error: "Correction target set identity does not match submitted evidence" };
  }
  if (
    String(set.drillSchemaId || "") !== correction.drillSchemaId ||
    Number(set.drillSchemaVersion) !== correction.drillSchemaVersion ||
    String(set.drillDefinitionHash || "") !== correction.drillDefinitionHash
  ) {
    return { ok: false, error: "Correction target schema identity does not match submitted evidence" };
  }

  const rep = set.observations?.[correction.repNumber - 1];
  if (!rep) return { ok: false, error: "Correction target rep does not exist" };
  if (String(rep._rep_id || "") !== correction.repId) {
    return { ok: false, error: "Correction target rep identity does not match submitted evidence" };
  }

  if (correction.correctionKind === "actual_support_used") {
    if (!isActualSupportUsedV2(correction.originalActualSupportUsed) || !isActualSupportUsedV2(correction.proposedActualSupportUsed)) {
      return { ok: false, error: "Actual-support correction is missing canonical support values" };
    }
    const operationalEvidence = decodeRepOperationalEvidenceV2(rep[REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY]);
    if (!operationalEvidence) {
      return { ok: false, error: "Correction target rep does not contain valid V2 operational evidence" };
    }
    if (operationalEvidence.actualSupportUsed !== correction.originalActualSupportUsed) {
      return { ok: false, error: "Correction original support value no longer matches source evidence" };
    }
    operationalEvidence.actualSupportUsed = correction.proposedActualSupportUsed;
    rep[REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY] = encodeRepOperationalEvidenceV2(operationalEvidence);
    return { ok: true, sets };
  }

  if (
    !correction.fieldKey ||
    !correction.dimensionId ||
    !correction.originalOptionId ||
    !correction.proposedOptionId ||
    !correction.proposedRawOption ||
    !correction.proposedNormalizedLevel
  ) {
    return { ok: false, error: "Observation correction is missing canonical option identity" };
  }

  const schema = getDrillSchemaDefinitionByVersion(
    correction.drillType,
    correction.phase,
    correction.drillSchemaVersion,
  );
  const definition = schema?.sets[correction.setOrder - 1];
  const field = definition
    ? getFieldDefinitionForRep(definition, correction.repNumber - 1, correction.fieldKey)
    : null;
  if (!schema || !definition || !field) {
    return { ok: false, error: "Correction target no longer has retained schema support" };
  }
  if (
    schema.schemaId !== correction.drillSchemaId ||
    schema.definitionHash !== correction.drillDefinitionHash ||
    definition.setId !== correction.setId ||
    field.dimensionId !== correction.dimensionId
  ) {
    return { ok: false, error: "Correction target is inconsistent with retained schema identity" };
  }

  if (String(rep[`${correction.fieldKey}_option_id`] || "") !== correction.originalOptionId) {
    return { ok: false, error: "Correction original option no longer matches source evidence" };
  }

  const resolvedProposal = resolveEvidenceSelection({
    mode: correction.drillType,
    phase: correction.phase,
    setId: correction.setId,
    repIndex: correction.repNumber - 1,
    fieldKey: correction.fieldKey,
    optionId: correction.proposedOptionId,
    schemaVersion: correction.drillSchemaVersion,
  });
  if (!resolvedProposal) return { ok: false, error: "Proposed correction option is not registered" };
  const registeredRaw = String(resolvedProposal.field.optionLabels?.[resolvedProposal.optionIndex] || "").trim();
  if (
    resolvedProposal.level !== correction.proposedNormalizedLevel ||
    registeredRaw !== correction.proposedRawOption
  ) {
    return { ok: false, error: "Proposed correction does not match retained option semantics" };
  }

  rep[correction.fieldKey] = correction.proposedRawOption;
  rep[`${correction.fieldKey}_option_id`] = correction.proposedOptionId;
  rep[`${correction.fieldKey}_dimension_id`] = correction.dimensionId;
  rep[`${correction.fieldKey}_level`] = correction.proposedNormalizedLevel;
  return { ok: true, sets };
};

export const applyApprovedEvidenceCorrections = <T extends SubmittedEvidenceSet>(
  inputSets: T[],
  corrections: ApprovedEvidenceCorrection[],
): CorrectionOverlayResult<T> => {
  let sets = cloneSets(inputSets);
  for (const correction of corrections) {
    const applied = applyApprovedEvidenceCorrection(sets, correction);
    if (!applied.ok) return applied;
    sets = applied.sets;
  }
  return { ok: true, sets };
};
