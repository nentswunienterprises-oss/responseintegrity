import { pool } from "./db";
import { CAPABILITY_ASSESSMENTS } from "@shared/capabilityAssessmentBank";
import {
  buildCapabilityLedger,
  evaluateCapabilityAssessment,
  type CapabilityAssessmentDefinition,
  type CapabilityLedgerAttempt,
  type CapabilityQuestionResult,
  type CapabilityResponseInput,
} from "@shared/capabilityEngine";

export function getCapabilityAssessmentDefinition(assessmentKey: string): CapabilityAssessmentDefinition | null {
  return CAPABILITY_ASSESSMENTS.find((assessment) => assessment.key === assessmentKey) || null;
}

export function buildPublicCapabilityAssessment(definition: CapabilityAssessmentDefinition) {
  return {
    key: definition.key,
    deepDiveKey: definition.deepDiveKey,
    title: definition.title,
    evidenceKind: definition.evidenceKind,
    passThresholdPercent: definition.passThresholdPercent,
    totalQuestions: definition.questions.length,
    questions: definition.questions.map((question) => ({
      key: question.key,
      competencyKey: question.competencyKey,
      prompt: question.prompt,
      kind: question.kind,
      options: question.options,
    })),
  };
}

async function assertTutorAssignmentOwnership(tutorAssignmentId: string, tutorId: string) {
  const result = await pool.query(
    `SELECT id
       FROM tutor_assignments
      WHERE id = $1
        AND tutor_id = $2
      LIMIT 1`,
    [tutorAssignmentId, tutorId]
  );

  if (!result.rowCount) {
    const error = new Error("Specialist assignment not found or does not belong to the authenticated user.") as Error & {
      status?: number;
    };
    error.status = 403;
    throw error;
  }
}

export async function persistCapabilityAssessmentAttempt(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
  responses: CapabilityResponseInput[];
}) {
  const definition = getCapabilityAssessmentDefinition(input.assessmentKey);
  if (!definition) {
    const error = new Error("Unknown capability assessment.") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  await assertTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const result = evaluateCapabilityAssessment(definition, input.responses);

  const insertResult = await pool.query(
    `INSERT INTO specialist_capability_assessment_attempts (
       tutor_assignment_id,
       tutor_id,
       assessment_key,
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
       $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12::jsonb, $13, $14::jsonb, $15::jsonb
     )
     RETURNING id, completed_at`,
    [
      input.tutorAssignmentId,
      input.tutorId,
      result.assessmentKey,
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
    ]
  );

  return {
    attemptId: insertResult.rows[0]?.id,
    completedAt: insertResult.rows[0]?.completed_at,
    ...result,
  };
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
            completed_at
       FROM specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
        ${assessmentFilter}
      ORDER BY completed_at DESC`,
    params
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
    [input.tutorAssignmentId, input.tutorId]
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
