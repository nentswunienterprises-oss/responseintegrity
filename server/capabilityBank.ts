import { pool } from "./db";
import type { CapabilityEvidenceKind, CapabilityQuestionDefinition } from "@shared/capabilityEngine";
import {
  createCapabilityFormSeed,
  generateDeterministicCapabilityForm,
  type GeneratedCapabilityForm,
  type PrivateCapabilityAssessmentConfig,
} from "./capabilityFormGeneration";

export interface CapabilityAttemptPlan {
  config: PrivateCapabilityAssessmentConfig;
  form: GeneratedCapabilityForm;
  attemptNumber: number;
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  }
  return [];
}

async function loadActiveCapabilityConfig(assessmentKey: string): Promise<PrivateCapabilityAssessmentConfig | null> {
  const result = await pool.query(
    `SELECT assessment_key,
            bank_version,
            title,
            assessment_deep_dive_key,
            evidence_kind,
            pass_threshold_percent,
            form_size,
            max_attempts,
            retry_cooldown_hours,
            competency_blueprint
       FROM private.specialist_capability_assessment_configs
      WHERE assessment_key = $1
        AND active = true
      LIMIT 1`,
    [assessmentKey],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    assessmentKey: String(row.assessment_key),
    bankVersion: Number(row.bank_version),
    title: String(row.title),
    assessmentDeepDiveKey: String(row.assessment_deep_dive_key),
    evidenceKind: String(row.evidence_kind) as CapabilityEvidenceKind,
    passThresholdPercent: Number(row.pass_threshold_percent),
    formSize: Number(row.form_size),
    maxAttempts: Number(row.max_attempts),
    retryCooldownHours: Number(row.retry_cooldown_hours),
    competencyBlueprint: parseJsonArray(row.competency_blueprint),
  };
}

async function loadCapabilityItems(config: PrivateCapabilityAssessmentConfig): Promise<CapabilityQuestionDefinition[]> {
  const result = await pool.query(
    `SELECT item_key,
            competency_key,
            deep_dive_key,
            prompt,
            question_kind,
            options,
            correct_option_keys,
            critical_fail_option_keys,
            explanation
       FROM private.specialist_capability_assessment_items
      WHERE assessment_key = $1
        AND bank_version = $2
        AND active = true
      ORDER BY item_key ASC`,
    [config.assessmentKey, config.bankVersion],
  );

  return result.rows.map((row) => ({
    key: String(row.item_key),
    competencyKey: String(row.competency_key),
    deepDiveKey: String(row.deep_dive_key),
    prompt: String(row.prompt),
    kind: row.question_kind,
    options: parseJsonArray(row.options),
    correctOptionKeys: parseJsonArray(row.correct_option_keys),
    criticalFailOptionKeys: parseJsonArray(row.critical_fail_option_keys),
    explanation: String(row.explanation),
  }));
}

async function getAttemptState(tutorAssignmentId: string, assessmentKey: string) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS attempt_count,
            MAX(completed_at) AS latest_completed_at
       FROM specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND assessment_key = $2`,
    [tutorAssignmentId, assessmentKey],
  );

  return {
    attemptCount: Number(result.rows[0]?.attempt_count || 0),
    latestCompletedAt: result.rows[0]?.latest_completed_at ? new Date(result.rows[0].latest_completed_at) : null,
  };
}

function enforceRetryPolicy(config: PrivateCapabilityAssessmentConfig, state: { attemptCount: number; latestCompletedAt: Date | null }) {
  if (state.attemptCount >= config.maxAttempts) {
    const error = new Error("Maximum capability assessment attempts reached.") as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  if (config.retryCooldownHours > 0 && state.latestCompletedAt) {
    const eligibleAt = new Date(state.latestCompletedAt.getTime() + config.retryCooldownHours * 60 * 60 * 1000);
    if (eligibleAt.getTime() > Date.now()) {
      const error = new Error(`Capability assessment retry is not available until ${eligibleAt.toISOString()}.`) as Error & {
        status?: number;
      };
      error.status = 409;
      throw error;
    }
  }
}

export async function buildCapabilityAttemptPlan(input: {
  tutorAssignmentId: string;
  assessmentKey: string;
}): Promise<CapabilityAttemptPlan> {
  const config = await loadActiveCapabilityConfig(input.assessmentKey);
  if (!config) {
    const error = new Error("Capability assessment is not active.") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const state = await getAttemptState(input.tutorAssignmentId, input.assessmentKey);
  enforceRetryPolicy(config, state);

  const attemptNumber = state.attemptCount + 1;
  const itemPool = await loadCapabilityItems(config);
  const secret = process.env.CAPABILITY_FORM_SECRET || "";
  const seed = createCapabilityFormSeed({
    secret,
    tutorAssignmentId: input.tutorAssignmentId,
    assessmentKey: config.assessmentKey,
    bankVersion: config.bankVersion,
    attemptNumber,
  });

  const form = generateDeterministicCapabilityForm(config, itemPool, seed);
  return { config, form, attemptNumber };
}
