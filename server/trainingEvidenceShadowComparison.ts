import type { Pool } from "pg";
import type {
  TrainingEvidenceEvaluation,
  TrainingEvidenceShadowComparison,
} from "../shared/trainingEvidenceEvaluator";
import type { TopicPhase, TopicStability } from "../shared/topicConditioningEngine";

export const TRAINING_EVIDENCE_EVALUATOR_VERSION = 1;
export const TRAINING_EVIDENCE_CONTRACT_VERSION = 2;

export type TrainingEvidenceShadowDatasetInput = {
  sourceDrillId: string;
  studentId: string;
  tutorId: string;
  topic: string;
  scheduledSessionId?: string | null;
  trainingSessionRunId?: string | null;
  phase: TopicPhase;
  previousStability: TopicStability;
  observedAt: string;
  evidenceShadow: TrainingEvidenceEvaluation;
  comparison: TrainingEvidenceShadowComparison;
};

export type TrainingEvidenceShadowPersistenceResult = {
  status: "persisted" | "persistence_failed";
  comparisonId: string;
  errorCode?: string | null;
  message?: string | null;
};

type ShadowSupabaseClient = {
  from: (table: string) => {
    upsert: (
      rows: Array<Record<string, unknown>>,
      options: { onConflict: string; ignoreDuplicates: boolean },
    ) => Promise<{ error?: { code?: string; message?: string } | null }>;
  };
};

const normalizeTimestamp = (value: unknown) => {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

export const buildTrainingEvidenceShadowComparisonId = (sourceDrillId: string) =>
  [
    String(sourceDrillId).trim(),
    "evaluator",
    TRAINING_EVIDENCE_EVALUATOR_VERSION,
    "contract",
    TRAINING_EVIDENCE_CONTRACT_VERSION,
  ].join("::");

export const toTrainingEvidenceShadowDatasetRow = (
  input: TrainingEvidenceShadowDatasetInput,
): Record<string, unknown> => {
  const comparisonId = buildTrainingEvidenceShadowComparisonId(input.sourceDrillId);
  const evidence = input.comparison.evidence;
  const evaluated =
    input.evidenceShadow.status === "evaluated" ? input.evidenceShadow : null;

  return {
    comparison_id: comparisonId,
    source_drill_id: String(input.sourceDrillId).trim(),
    evaluator_version: TRAINING_EVIDENCE_EVALUATOR_VERSION,
    contract_version: TRAINING_EVIDENCE_CONTRACT_VERSION,
    authority: "shadow_only",
    student_id: String(input.studentId).trim(),
    tutor_id: String(input.tutorId).trim(),
    topic: String(input.topic).trim(),
    scheduled_session_id: String(input.scheduledSessionId || "").trim() || null,
    training_session_run_id: String(input.trainingSessionRunId || "").trim() || null,
    phase: input.phase,
    previous_stability: input.previousStability,
    legacy_score: Number(input.comparison.legacy.score),
    legacy_next_phase: input.comparison.legacy.nextPhase,
    legacy_next_stability: input.comparison.legacy.nextStability,
    legacy_transition_reason: input.comparison.legacy.transitionReason,
    evidence_available: input.comparison.available,
    evidence_observed_stability: evidence?.observedStability || null,
    evidence_next_phase: evidence?.nextPhase || null,
    evidence_next_stability: evidence?.nextStability || null,
    evidence_transition_reason: evidence?.transitionReason || null,
    high_maintenance_entry_qualified: evidence?.highMaintenanceEntryQualified ?? null,
    exit_qualified: evidence?.exitQualified ?? null,
    ineligible_evidence_count: evidence?.ineligibleEvidenceCount ?? null,
    intervention_events: evaluated?.interventionEvents || [],
    prerequisite_contradiction_status:
      evaluated?.prerequisiteContradiction?.status || null,
    diverged: input.comparison.diverged,
    comparison_reason: input.comparison.reason,
    evidence_payload: input.evidenceShadow,
    comparison_payload: input.comparison,
    observed_at: normalizeTimestamp(input.observedAt),
  };
};

export const persistTrainingEvidenceShadowComparison = async (
  client: ShadowSupabaseClient,
  input: TrainingEvidenceShadowDatasetInput,
): Promise<TrainingEvidenceShadowPersistenceResult> => {
  const comparisonId = buildTrainingEvidenceShadowComparisonId(input.sourceDrillId);
  try {
    const { error } = await client
      .from("training_evidence_shadow_comparisons")
      .upsert([toTrainingEvidenceShadowDatasetRow(input)], {
        onConflict: "comparison_id",
        ignoreDuplicates: true,
      });

    if (error) {
      return {
        status: "persistence_failed",
        comparisonId,
        errorCode: error.code || null,
        message: error.message || "Shadow comparison insert failed",
      };
    }

    return { status: "persisted", comparisonId };
  } catch (error) {
    return {
      status: "persistence_failed",
      comparisonId,
      errorCode: null,
      message:
        error instanceof Error
          ? error.message
          : "Unexpected shadow comparison persistence failure",
    };
  }
};

export const persistTrainingEvidenceShadowComparisonDirect = async (
  pool: Pick<Pool, "query">,
  input: TrainingEvidenceShadowDatasetInput,
): Promise<TrainingEvidenceShadowPersistenceResult> => {
  const comparisonId = buildTrainingEvidenceShadowComparisonId(input.sourceDrillId);
  const row = toTrainingEvidenceShadowDatasetRow(input);
  const columns = Object.keys(row);
  const values = columns.map((column) => row[column]);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");

  try {
    await pool.query(
      `INSERT INTO public.training_evidence_shadow_comparisons
        (${columns.map((column) => `"${column}"`).join(", ")})
       VALUES (${placeholders})
       ON CONFLICT (comparison_id) DO NOTHING`,
      values,
    );
    return { status: "persisted", comparisonId };
  } catch (error) {
    return {
      status: "persistence_failed",
      comparisonId,
      errorCode: null,
      message:
        error instanceof Error
          ? error.message
          : "Shadow comparison insert failed",
    };
  }
};
