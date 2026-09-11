import { pool } from "./db";
import { buildCapabilityAttemptPlan, type CapabilityAttemptPlan } from "./capabilityBank";
import {
  buildCapabilityLedger,
  evaluateCapabilityAssessment,
  type CapabilityLedgerAttempt,
  type CapabilityQuestionResult,
  type CapabilityResponseInput,
} from "@shared/capabilityEngine";

export function buildPublicCapabilityAssessment(plan: CapabilityAttemptPlan) {
  const definition = plan.form.definition;
  return {
    key: definition.key,
    deepDiveKey: definition.deepDiveKey,
    title: definition.title,
    evidenceKind: definition.evidenceKind,
    passThresholdPercent: definition.passThresholdPercent,
    totalQuestions: definition.questions.length,
    formId: plan.form.formId,
    bankVersion: plan.form.bankVersion,
    attemptNumber: plan.attemptNumber,
    maxAttempts: plan.config.maxAttempts,
    questions: definition.questions.map((question) => ({
      key: question.key,
      prompt: question.prompt,
      kind: question.kind,
      options: question.options,
    })),
  };
}

function buildPublicCapabilityAttemptResult(input: {
  attemptId: string | undefined;
  completedAt: unknown;
  bankVersion: number;
  attemptNumber: number;
  formId: string;
  result: ReturnType<typeof evaluateCapabilityAssessment>;
}) {
  return {
    attemptId: input.attemptId,
    completedAt: input.completedAt,
    bankVersion: input.bankVersion,
    attemptNumber: input.attemptNumber,
    formId: input.formId,
    assessmentKey: input.result.assessmentKey,
    evidenceKind: input.result.evidenceKind,
    totalQuestions: input.result.totalQuestions,
    correctQuestions: input.result.correctQuestions,
    percent: input.result.percent,
    passed: input.result.passed,
    hasCriticalFail: input.result.hasCriticalFail,
  };
}

async function assertTutorAssignmentOwnership(tutorAssignmentId: string, tutorId: string) {
  const result = await pool.query(
    `SELECT id
       FROM tutor_assignments
      WHERE id = $1
        AND tutor_id = $2
      LIMIT 1`,
    [tutorAssignmentId, tutorId],
  );

  if (!result.rowCount) {
    const error = new Error("Specialist assignment not found or does not belong to the authenticated user.") as Error & {
      status?: number;
    };
    error.status = 403;
    throw error;
  }
}

export async function prepareCapabilityAssessmentForm(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
}) {
  await assertTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);
  const plan = await buildCapabilityAttemptPlan({
    tutorAssignmentId: input.tutorAssignmentId,
    assessmentKey: input.assessmentKey,
  });
  return buildPublicCapabilityAssessment(plan);
}

export async function persistCapabilityAssessmentAttempt(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
  formId: string;
  bankVersion: number;
  responses: CapabilityResponseInput[];
}) {
  await assertTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const plan = await buildCapabilityAttemptPlan({
    tutorAssignmentId: input.tutorAssignmentId,
    assessmentKey: input.assessmentKey,
  });

  if (plan.form.formId !== input.formId || plan.form.bankVersion !== input.bankVersion) {
    const error = new Error("Capability assessment form is stale or does not match the active attempt.") as Error & {
      status?: number;
    };
    error.status = 409;
    throw error;
  }

  const definition = plan.form.definition;
  const result = evaluateCapabilityAssessment(definition, input.responses);

  try {
    const insertResult = await pool.query(
      `INSERT INTO specialist_capability_assessment_attempts (
         tutor_assignment_id,
         tutor_id,
         assessment_key,
         bank_version,
         attempt_number,
         form_id,
         form_item_keys,
         assessment_deep_dive_key,
         evidence_kind,
         covered_deep_dive_keys,
         pass_threshold_percent,
         total_questions,
         correct_questions,
         percent,
         has_critical_fail,
         critical_fail_question_keys,
         passed,
         responses,
         question_results
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb,
         $11, $12, $13, $14, $15, $16::jsonb, $17, $18::jsonb, $19::jsonb
       )
       RETURNING id, completed_at`,
      [
        input.tutorAssignmentId,
        input.tutorId,
        result.assessmentKey,
        plan.form.bankVersion,
        plan.attemptNumber,
        plan.form.formId,
        JSON.stringify(plan.form.itemKeys),
        result.assessmentDeepDiveKey,
        result.evidenceKind,
        JSON.stringify(result.coveredDeepDiveKeys),
        definition.passThresholdPercent,
        result.totalQuestions,
        result.correctQuestions,
        result.percent,
        result.hasCriticalFail,
        JSON.stringify(result.criticalFailQuestionKeys),
        result.passed,
        JSON.stringify(input.responses),
        JSON.stringify(result.questionResults),
      ],
    );

    return buildPublicCapabilityAttemptResult({
      attemptId: insertResult.rows[0]?.id,
      completedAt: insertResult.rows[0]?.completed_at,
      bankVersion: plan.form.bankVersion,
      attemptNumber: plan.attemptNumber,
      formId: plan.form.formId,
      result,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      const conflict = new Error("This capability assessment attempt has already been submitted.") as Error & {
        status?: number;
      };
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
}

export async function getCapabilityAssessmentHistory(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey?: string;
}) {
  await assertTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const params: unknown[] = [input.tutorAssignmentId, input.tutorId];
  let assessmentFilter = "";
  if (input.assessmentKey) {
    params.push(input.assessmentKey);
    assessmentFilter = ` AND assessment_key = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT id,
            assessment_key,
            bank_version,
            attempt_number,
            form_id,
            assessment_deep_dive_key,
            evidence_kind,
            pass_threshold_percent,
            total_questions,
            correct_questions,
            percent,
            has_critical_fail,
            passed,
            completed_at
       FROM specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
        ${assessmentFilter}
      ORDER BY completed_at DESC`,
    params,
  );

  return result.rows;
}

export async function getSpecialistCapabilityLedger(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  await assertTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const result = await pool.query(
    `SELECT id,
            assessment_key,
            evidence_kind,
            passed,
            question_results,
            completed_at
       FROM specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
      ORDER BY completed_at ASC`,
    [input.tutorAssignmentId, input.tutorId],
  );

  const attempts: CapabilityLedgerAttempt[] = result.rows.map((row) => ({
    attemptId: String(row.id),
    assessmentKey: String(row.assessment_key),
    evidenceKind: row.evidence_kind,
    passed: Boolean(row.passed),
    completedAt: row.completed_at,
    questionResults: (Array.isArray(row.question_results) ? row.question_results : []) as CapabilityQuestionResult[],
  }));

  return buildCapabilityLedger(attempts);
}
