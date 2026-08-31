import {
  projectResponseIntegrityEvidenceLedger,
  type EvidenceLedgerProjectionIssue,
  type EvidenceLedgerProjectionInput,
  type EvidenceSessionContext,
  type LedgerEvidenceSet,
  type ResponseIntegrityEvidenceLedgerEntry,
} from "../shared/responseIntegrityEvidenceLedger";
import { tryParsePhase, normalizeStability, type TopicPhase } from "../shared/topicConditioningEngine";

export type EvidenceLedgerShadowPersistenceResult = {
  status: "projected" | "legacy_unprojected" | "projection_invalid" | "persistence_failed";
  entryCount: number;
  issues?: Array<{ code: string; message: string; setOrder?: number }>;
  errorCode?: string | null;
};

export type StoredDrillLedgerProjectionBuildResult =
  | { ok: true; input: EvidenceLedgerProjectionInput }
  | { ok: false; issue: EvidenceLedgerProjectionIssue };

export type StoredDrillLedgerRow = {
  id?: unknown;
  student_id?: unknown;
  tutor_id?: unknown;
  scheduled_session_id?: unknown;
  training_session_run_id?: unknown;
  submitted_at?: unknown;
  drill?: unknown;
};

type EvidenceLedgerSupabaseClient = {
  from: (table: string) => {
    upsert: (
      rows: Array<Record<string, unknown>>,
      options: { onConflict: string; ignoreDuplicates: boolean },
    ) => Promise<{ error?: { code?: string; message?: string } | null }>;
  };
};

export const toEvidenceLedgerPersistenceRow = (
  entry: ResponseIntegrityEvidenceLedgerEntry,
): Record<string, unknown> => ({
  evidence_id: entry.evidenceId,
  projection_version: entry.projectionVersion,
  source_drill_id: entry.sourceDrillId,
  student_id: entry.studentId,
  tutor_id: entry.tutorId,
  topic: entry.topic,
  scheduled_session_id: entry.scheduledSessionId,
  training_session_run_id: entry.trainingSessionRunId,
  session_group_id: entry.sessionGroupId,
  session_context: entry.sessionContext,
  drill_type: entry.drillType,
  drill_schema_id: entry.drillSchemaId,
  drill_schema_version: entry.drillSchemaVersion,
  drill_definition_hash: entry.drillDefinitionHash,
  phase: entry.phase,
  state_phase_before: entry.statePhaseBefore,
  stability_before: entry.stabilityBefore,
  state_phase_after: entry.statePhaseAfter,
  stability_after: entry.stabilityAfter,
  transition_reason: entry.transitionReason,
  block_order: entry.blockOrder,
  set_id: entry.setId,
  set_order: entry.setOrder,
  rep_id: entry.repId,
  rep_number: entry.repNumber,
  dimension_id: entry.dimensionId,
  dimension_order: entry.dimensionOrder,
  field_key: entry.fieldKey,
  option_id: entry.optionId,
  raw_option: entry.rawOption,
  normalized_level: entry.normalizedLevel,
  score_contribution: entry.scoreContribution,
  score_contribution_max: entry.scoreContributionMax,
  constraint_profile: entry.constraintProfile,
  observed_at: entry.observedAt,
});

const parseStoredDrillPayload = (value: unknown): Record<string, any> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const cleanString = (value: unknown) => String(value || "").trim();

const sessionContextFromDiagnosisKind = (value: unknown): EvidenceSessionContext => {
  const normalized = cleanString(value).toLowerCase();
  return normalized === "training" ? "active_training" : "intro";
};

export const buildEvidenceLedgerProjectionInputFromStoredDrillRow = (
  row: StoredDrillLedgerRow,
): StoredDrillLedgerProjectionBuildResult => {
  const sourceDrillId = cleanString(row.id);
  const studentId = cleanString(row.student_id);
  const tutorId = cleanString(row.tutor_id);
  const observedAt = cleanString(row.submitted_at) || new Date(0).toISOString();
  const parsed = parseStoredDrillPayload(row.drill);

  if (!sourceDrillId || !studentId || !tutorId || !parsed) {
    return {
      ok: false,
      issue: {
        code: "missing_identity",
        message: "Stored drill row is missing id, student, tutor, or parseable drill payload",
      },
    };
  }

  const normalizedDrillType = cleanString(parsed.drillType || "diagnosis").toLowerCase();
  const scheduledSessionId = cleanString(row.scheduled_session_id || parsed.scheduledSessionId) || null;
  const trainingSessionRunId = cleanString(row.training_session_run_id || parsed.sessionId) || null;
  const sets = (Array.isArray(parsed.sets) ? parsed.sets : []) as LedgerEvidenceSet[];

  if (normalizedDrillType === "training") {
    const observedPhase = tryParsePhase(parsed.summary?.observedPhase || parsed.phase);
    const statePhaseAfter = tryParsePhase(parsed.summary?.phase || observedPhase);
    if (!observedPhase || !statePhaseAfter) {
      return {
        ok: false,
        issue: { code: "missing_identity", message: "Training drill is missing a valid phase" },
      };
    }
    return {
      ok: true,
      input: {
        sourceDrillId,
        studentId,
        tutorId,
        topic: cleanString(parsed.trainingTopic || parsed.introTopic),
        scheduledSessionId,
        trainingSessionRunId,
        sessionGroupId: cleanString(scheduledSessionId || trainingSessionRunId || sourceDrillId),
        sessionContext: "active_training",
        drillType: "training",
        observedPhase,
        statePhaseBefore: observedPhase,
        stabilityBefore: normalizeStability(parsed.summary?.previousStability || parsed.previousStability || "Low"),
        statePhaseAfter,
        stabilityAfter: normalizeStability(parsed.summary?.stability || "Low"),
        transitionReason: cleanString(parsed.summary?.transitionReason || parsed.summary?.transition_reason) || null,
        observedAt,
        sets,
      },
    };
  }

  if (normalizedDrillType === "handover_verification") {
    const handoverMode = cleanString(parsed.handoverMode).toLowerCase();
    const isTargetedRediagnosis = handoverMode === "targeted_re_diagnosis";
    const observedPhase = tryParsePhase(
      parsed.summary?.startingPhase || parsed.startingPhase || parsed.summary?.phase || parsed.phase,
    );
    const statePhaseBefore = tryParsePhase(parsed.phase || observedPhase);
    const statePhaseAfter = tryParsePhase(parsed.summary?.resultingPhase || parsed.summary?.phase || statePhaseBefore);
    if (!observedPhase || !statePhaseBefore || !statePhaseAfter) {
      return {
        ok: false,
        issue: { code: "missing_identity", message: "Handover drill is missing a valid phase" },
      };
    }
    return {
      ok: true,
      input: {
        sourceDrillId,
        studentId,
        tutorId,
        topic: cleanString(parsed.handoverTopic || parsed.trainingTopic || parsed.introTopic),
        scheduledSessionId,
        trainingSessionRunId: null,
        sessionGroupId: cleanString(scheduledSessionId || sourceDrillId),
        sessionContext: "handover_verification",
        drillType: isTargetedRediagnosis ? "diagnosis" : "verification",
        observedPhase,
        statePhaseBefore,
        stabilityBefore: normalizeStability(parsed.previousStability || parsed.summary?.previousStability || "Low"),
        statePhaseAfter,
        stabilityAfter: normalizeStability(parsed.summary?.resultingStability || parsed.summary?.stability || "Low"),
        transitionReason: cleanString(parsed.summary?.verificationOutcome || parsed.summary?.transitionReason) || null,
        observedAt,
        sets,
      },
    };
  }

  const observedPhase = tryParsePhase(parsed.startingPhase || parsed.summary?.startingPhase || parsed.phase || parsed.summary?.phase);
  const statePhaseAfter = tryParsePhase(parsed.summary?.phase || parsed.phase || observedPhase);
  if (!observedPhase || !statePhaseAfter) {
    return {
      ok: false,
      issue: { code: "missing_identity", message: "Diagnosis drill is missing a valid phase" },
    };
  }
  return {
    ok: true,
    input: {
      sourceDrillId,
      studentId,
      tutorId,
      topic: cleanString(parsed.introTopic || parsed.trainingTopic),
      scheduledSessionId,
      trainingSessionRunId,
      sessionGroupId: cleanString(scheduledSessionId || trainingSessionRunId || sourceDrillId),
      sessionContext: sessionContextFromDiagnosisKind(parsed.sessionContextKind),
      drillType: "diagnosis",
      observedPhase,
      statePhaseBefore: null,
      stabilityBefore: null,
      statePhaseAfter,
      stabilityAfter: normalizeStability(parsed.summary?.stability || "Low"),
      transitionReason: "remain",
      observedAt,
      sets,
    },
  };
};

export const persistResponseIntegrityEvidenceLedgerShadow = async (
  supabaseClient: EvidenceLedgerSupabaseClient,
  input: EvidenceLedgerProjectionInput,
): Promise<EvidenceLedgerShadowPersistenceResult> => {
  try {
    const projection = projectResponseIntegrityEvidenceLedger(input);
    if (projection.status === "legacy_unprojected") {
      return { status: "legacy_unprojected", entryCount: 0 };
    }
    if (projection.status === "invalid") {
      return {
        status: "projection_invalid",
        entryCount: 0,
        issues: projection.issues,
      };
    }
    if (projection.entries.length === 0) {
      return { status: "projected", entryCount: 0 };
    }

    const { error } = await supabaseClient
      .from("response_integrity_evidence_ledger")
      .upsert(projection.entries.map(toEvidenceLedgerPersistenceRow), {
        onConflict: "evidence_id",
        ignoreDuplicates: true,
      });
    if (error) {
      return {
        status: "persistence_failed",
        entryCount: 0,
        errorCode: error.code || null,
        issues: [{ code: error.code || "database_error", message: error.message || "Ledger insert failed" }],
      };
    }
    return { status: "projected", entryCount: projection.entries.length };
  } catch (error) {
    return {
      status: "persistence_failed",
      entryCount: 0,
      errorCode: null,
      issues: [{
        code: "unexpected_persistence_error",
        message: error instanceof Error ? error.message : "Unexpected ledger persistence failure",
      }],
    };
  }
};
