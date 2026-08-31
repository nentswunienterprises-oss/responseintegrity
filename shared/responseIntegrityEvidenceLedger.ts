import type { ObservationLevel } from "./observationScoring";
import {
  getDrillSchemaDefinitionByVersion,
  getFieldDefinitionForRep,
  getRepPurposeId,
  hasSemanticEvidenceContract,
  validateAndNormalizeSemanticEvidenceSet,
  type EvidenceConstraintProfile,
  type EvidenceDrillMode,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import {
  tryParsePhase,
  type TopicPhase,
  type TopicStability,
} from "./topicConditioningEngine";

export const EVIDENCE_LEDGER_PROJECTION_VERSION = 1;

export type EvidenceSessionContext = "intro" | "active_training" | "handover_verification";

export type LedgerEvidenceSet = SubmittedEvidenceSet & { phase?: TopicPhase };

export type EvidenceLedgerProjectionInput = {
  sourceDrillId: string;
  studentId: string;
  tutorId: string;
  topic: string;
  scheduledSessionId?: string | null;
  trainingSessionRunId?: string | null;
  sessionGroupId?: string | null;
  sessionContext: EvidenceSessionContext;
  drillType: EvidenceDrillMode;
  observedPhase: TopicPhase;
  statePhaseBefore?: TopicPhase | null;
  stabilityBefore?: TopicStability | null;
  statePhaseAfter?: TopicPhase | null;
  stabilityAfter?: TopicStability | null;
  transitionReason?: string | null;
  observedAt: string;
  sets: LedgerEvidenceSet[];
};

export type ResponseIntegrityEvidenceLedgerEntry = {
  evidenceId: string;
  projectionVersion: number;
  sourceDrillId: string;
  studentId: string;
  tutorId: string;
  topic: string;
  scheduledSessionId: string | null;
  trainingSessionRunId: string | null;
  sessionGroupId: string;
  sessionContext: EvidenceSessionContext;
  drillType: EvidenceDrillMode;
  drillSchemaId: string;
  drillSchemaVersion: number;
  drillDefinitionHash: string;
  phase: TopicPhase;
  statePhaseBefore: TopicPhase | null;
  stabilityBefore: TopicStability | null;
  statePhaseAfter: TopicPhase | null;
  stabilityAfter: TopicStability | null;
  transitionReason: string | null;
  blockOrder: number;
  setId: string;
  setOrder: number;
  repId: string;
  repNumber: number;
  dimensionId: string;
  dimensionOrder: number;
  fieldKey: string;
  optionId: string;
  rawOption: string;
  normalizedLevel: ObservationLevel;
  scoreContribution: number;
  scoreContributionMax: number;
  constraintProfile: EvidenceConstraintProfile;
  observedAt: string;
};

export type EvidenceLedgerProjectionIssue = {
  code:
    | "missing_identity"
    | "mixed_capture_contract"
    | "invalid_semantic_evidence"
    | "unsupported_schema";
  message: string;
  setOrder?: number;
};

export type EvidenceLedgerProjectionResult =
  | { status: "projected"; entries: ResponseIntegrityEvidenceLedgerEntry[]; issues: [] }
  | { status: "legacy_unprojected"; entries: []; issues: [] }
  | { status: "invalid"; entries: []; issues: EvidenceLedgerProjectionIssue[] };

const requiredIdentityFields = ["sourceDrillId", "studentId", "tutorId", "topic", "observedAt"] as const;

const scoreContributionFor = (weight: number, level: ObservationLevel) => {
  if (level === "clear") return weight;
  if (level === "partial") return Math.round(weight * 0.6);
  return 0;
};

const buildEvidenceId = ({
  sourceDrillId,
  blockOrder,
  setId,
  repId,
  dimensionId,
}: Pick<ResponseIntegrityEvidenceLedgerEntry, "sourceDrillId" | "blockOrder" | "setId" | "repId" | "dimensionId">) =>
  [sourceDrillId, `block_${blockOrder}`, setId, repId, dimensionId].join("::");

export const projectResponseIntegrityEvidenceLedger = (
  input: EvidenceLedgerProjectionInput,
): EvidenceLedgerProjectionResult => {
  const missingIdentity = requiredIdentityFields.find((key) => !String(input[key] || "").trim());
  if (missingIdentity) {
    return {
      status: "invalid",
      entries: [],
      issues: [{ code: "missing_identity", message: `Evidence projection is missing ${missingIdentity}` }],
    };
  }

  const sets = Array.isArray(input.sets) ? input.sets : [];
  const semanticSetCount = sets.filter(hasSemanticEvidenceContract).length;
  if (semanticSetCount === 0) return { status: "legacy_unprojected", entries: [], issues: [] };
  if (semanticSetCount !== sets.length) {
    return {
      status: "invalid",
      entries: [],
      issues: [{
        code: "mixed_capture_contract",
        message: "Evidence projection cannot mix legacy and versioned set contracts",
      }],
    };
  }

  const entries: ResponseIntegrityEvidenceLedgerEntry[] = [];
  for (let blockIndex = 0; blockIndex < sets.length; blockIndex += 1) {
    const submittedSet = sets[blockIndex];
    const evidencePhase = tryParsePhase(submittedSet.phase) || input.observedPhase;
    const setOrder = Number(submittedSet.setOrder);
    const schemaVersion = Number(submittedSet.drillSchemaVersion);
    const schema = getDrillSchemaDefinitionByVersion(input.drillType, evidencePhase, schemaVersion);
    if (!schema) {
      return {
        status: "invalid",
        entries: [],
        issues: [{
          code: "unsupported_schema",
          message: `No retained schema ${schemaVersion} exists for ${input.drillType} ${evidencePhase}`,
          setOrder,
        }],
      };
    }

    const validation = validateAndNormalizeSemanticEvidenceSet({
      mode: input.drillType,
      phase: evidencePhase,
      setIndex: setOrder - 1,
      submittedSet,
      acceptHistoricalVersion: true,
    });
    if ("error" in validation) {
      return {
        status: "invalid",
        entries: [],
        issues: [{
          code: "invalid_semantic_evidence",
          message: validation.error,
          setOrder,
        }],
      };
    }

    const normalizedSet = validation.normalizedSet;
    const definition = schema.sets[setOrder - 1];
    for (let repIndex = 0; repIndex < normalizedSet.observations.length; repIndex += 1) {
      const rep = normalizedSet.observations[repIndex];
      const repId = getRepPurposeId(definition, repIndex);
      for (let dimensionOrder = 0; dimensionOrder < definition.fields.length; dimensionOrder += 1) {
        const baseField = definition.fields[dimensionOrder];
        const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey)!;
        const normalizedLevel = rep[`${field.fieldKey}_level`] as ObservationLevel;
        const entryBase = {
          sourceDrillId: String(input.sourceDrillId).trim(),
          blockOrder: blockIndex + 1,
          setId: definition.setId,
          repId,
          dimensionId: field.dimensionId,
        };
        entries.push({
          evidenceId: buildEvidenceId(entryBase),
          projectionVersion: EVIDENCE_LEDGER_PROJECTION_VERSION,
          ...entryBase,
          studentId: String(input.studentId).trim(),
          tutorId: String(input.tutorId).trim(),
          topic: String(input.topic).trim(),
          scheduledSessionId: String(input.scheduledSessionId || "").trim() || null,
          trainingSessionRunId: String(input.trainingSessionRunId || "").trim() || null,
          sessionGroupId: String(
            input.sessionGroupId || input.scheduledSessionId || input.trainingSessionRunId || input.sourceDrillId,
          ).trim(),
          sessionContext: input.sessionContext,
          drillType: input.drillType,
          drillSchemaId: schema.schemaId,
          drillSchemaVersion: schema.schemaVersion,
          drillDefinitionHash: schema.definitionHash,
          phase: evidencePhase,
          statePhaseBefore: input.statePhaseBefore || null,
          stabilityBefore: input.stabilityBefore || null,
          statePhaseAfter: input.statePhaseAfter || null,
          stabilityAfter: input.stabilityAfter || null,
          transitionReason: String(input.transitionReason || "").trim() || null,
          setOrder,
          repNumber: repIndex + 1,
          dimensionOrder: dimensionOrder + 1,
          fieldKey: field.fieldKey,
          optionId: rep[`${field.fieldKey}_option_id`],
          rawOption: rep[field.fieldKey],
          normalizedLevel,
          scoreContribution: scoreContributionFor(field.scoreWeight, normalizedLevel),
          scoreContributionMax: field.scoreWeight,
          constraintProfile: { ...definition.constraints },
          observedAt: input.observedAt,
        });
      }
    }
  }

  return { status: "projected", entries, issues: [] };
};
