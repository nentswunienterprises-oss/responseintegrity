import { pool } from "./db";
import type { CapabilityEvidenceKind } from "@shared/capabilityEngine";
import { buildCapabilityCriticalBoundaryRequirements } from "@shared/capabilityCriticalCoverage";
import {
  createCapabilityFormSeed,
  generateDeterministicCapabilityForm,
  resolveCapabilityFormSecret,
  type CapabilityBoundaryTaggedQuestion,
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
            COALESCE((to_jsonb(config)->>'review_mode')::boolean, false) AS review_mode,
            competency_blueprint
       FROM private.specialist_capability_assessment_configs AS config
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
    reviewMode: Boolean(row.review_mode),
    competencyBlueprint: parseJsonArray(row.competency_blueprint),
    criticalBoundaryRequirements: buildCapabilityCriticalBoundaryRequirements(String(row.assessment_key)),
  };
}

async function loadCapabilityItems(config: PrivateCapabilityAssessmentConfig): Promise<CapabilityBoundaryTaggedQuestion[]> {
  const result = await pool.query(
    `SELECT item_key,
            competency_key,
            deep_dive_key,
            prompt,
            question_kind,
            options,
            correct_option_keys,
            critical_fail_option_keys,
            critical_boundary_keys,
            explanation,
            option_feedback
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
    criticalBoundaryKeys: parseJsonArray(row.critical_boundary_keys),
    explanation: String(row.explanation),
    optionFeedback:
      row.option_feedback && typeof row.option_feedback === "object" && !Array.isArray(row.option_feedback)
        ? (row.option_feedback as Record<string, string>)
        : {},
  })) satisfies CapabilityBoundaryTaggedQuestion[];
}

async function getAttemptState(
  tutorAssignmentId: string,
  assessmentKey: string,
  bankVersion: number,
) {
  const result = await pool.query(
    `SELECT attempt_number,
            form_item_keys,
            completed_at
       FROM specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND assessment_key = $2
        AND bank_version = $3
      ORDER BY attempt_number ASC`,
    [tutorAssignmentId, assessmentKey, bankVersion],
  );

  const latest = result.rows.at(-1) || null;
  const usedItemKeys = Array.from(
    new Set(
      result.rows.flatMap((row) =>
        parseJsonArray<string>(row.form_item_keys).map((value) => String(value)),
      ),
    ),
  );

  return {
    attemptCount: result.rows.length,
    latestCompletedAt: latest?.completed_at
      ? new Date(latest.completed_at)
      : null,
    usedItemKeys,
  };
}

function enforceRetryPolicy(
  config: PrivateCapabilityAssessmentConfig,
  state: {
    attemptCount: number;
    latestCompletedAt: Date | null;
    usedItemKeys: string[];
  },
) {
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

  const state = await getAttemptState(
    input.tutorAssignmentId,
    input.assessmentKey,
    config.bankVersion,
  );
  enforceRetryPolicy(config, state);

  const attemptNumber = state.attemptCount + 1;
  const itemPool = await loadCapabilityItems(config);
  const resolvedSecret = resolveCapabilityFormSecret();
  if (!resolvedSecret.secret) {
    const error = new Error("Capability form secret is not configured.") as Error & { status?: number };
    error.status = 503;
    throw error;
  }
  if (resolvedSecret.source === "proof_session_derived") {
    console.warn(
      "[CAPABILITY] Proof is using the isolated session-derived Capability form secret; production still requires CAPABILITY_FORM_SECRET.",
    );
  }
  const seed = createCapabilityFormSeed({
    secret: resolvedSecret.secret,
    tutorAssignmentId: input.tutorAssignmentId,
    assessmentKey: config.assessmentKey,
    bankVersion: config.bankVersion,
    attemptNumber,
  });

  let form: GeneratedCapabilityForm;
  if (
    config.evidenceKind === "mastery" &&
    attemptNumber > 1 &&
    state.usedItemKeys.length > 0
  ) {
    const used = new Set(state.usedItemKeys);
    const unseenPool = itemPool.filter((item) => !used.has(item.key));

    try {
      form = generateDeterministicCapabilityForm(config, unseenPool, seed);
    } catch (error) {
      console.warn(
        "[CAPABILITY] Unseen-only retry could not satisfy the approved form coverage; falling back to the full bank.",
        {
          assessmentKey: config.assessmentKey,
          bankVersion: config.bankVersion,
          attemptNumber,
          unseenItems: unseenPool.length,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      form = generateDeterministicCapabilityForm(config, itemPool, seed);
    }
  } else {
    form = generateDeterministicCapabilityForm(config, itemPool, seed);
  }

  return { config, form, attemptNumber };
}
