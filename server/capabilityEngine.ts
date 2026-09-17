import { pool } from "./db";
import { buildCapabilityAttemptPlan, type CapabilityAttemptPlan } from "./capabilityBank";
import {
  buildCapabilityLedger,
  evaluateCapabilityAssessment,
  type CapabilityLedgerAttempt,
  type CapabilityPracticalLedgerRecord,
  type CapabilityQuestionResult,
  type CapabilityResponseInput,
} from "@shared/capabilityEngine";
import {
  projectCapabilityAssessmentForSpecialist,
  projectCapabilityAttemptResultForSpecialist,
} from "./capabilityPublicProjection";

export function buildPublicCapabilityAssessment(plan: CapabilityAttemptPlan) {
  return projectCapabilityAssessmentForSpecialist({
    definition: plan.form.definition,
    formId: plan.form.formId,
    bankVersion: plan.form.bankVersion,
    attemptNumber: plan.attemptNumber,
    maxAttempts: plan.config.maxAttempts,
  });
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

    return projectCapabilityAttemptResultForSpecialist({
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

  const [assessmentResult, practicalResult] = await Promise.all([
    pool.query(
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
    ),
    pool.query(
      `SELECT e.id,
              e.proof_key,
              e.proof_version,
              e.attempt_number,
              e.competency_links,
              e.submitted_at,
              r.outcome,
              r.reviewed_at
         FROM specialist_capability_practical_evidence e
         LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
        WHERE e.tutor_assignment_id = $1
          AND e.tutor_id = $2
        ORDER BY e.submitted_at ASC`,
      [input.tutorAssignmentId, input.tutorId],
    ),
  ]);

  const attempts: CapabilityLedgerAttempt[] = assessmentResult.rows.map((row) => ({
    attemptId: String(row.id),
    assessmentKey: String(row.assessment_key),
    evidenceKind: row.evidence_kind,
    passed: Boolean(row.passed),
    completedAt: row.completed_at,
    questionResults: (Array.isArray(row.question_results) ? row.question_results : []) as CapabilityQuestionResult[],
  }));

  const practicalRecords: CapabilityPracticalLedgerRecord[] = practicalResult.rows.map((row) => ({
    evidenceId: String(row.id),
    proofKey: String(row.proof_key),
    proofVersion: Number(row.proof_version),
    attemptNumber: Number(row.attempt_number),
    status: row.outcome || "submitted",
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at || null,
    competencyLinks: Array.isArray(row.competency_links) ? row.competency_links : [],
  }));

  return buildCapabilityLedger(attempts, practicalRecords);
}
