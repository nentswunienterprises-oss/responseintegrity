import { pool } from "./db";
import {
  CAPABILITY_MASTERY_PLAN,
  buildCapabilityMasteryAvailability,
  type CapabilityMasteryActiveBank,
  type CapabilityMasteryAttempt,
  type CapabilityMasteryAvailability,
} from "@shared/capabilityMasterySequencing";
import { assertCapabilityTutorAssignmentOwnership } from "./capabilityEngine";

function httpError(status: number, message: string, data?: Record<string, unknown>) {
  const error = new Error(message) as Error & {
    status?: number;
    data?: Record<string, unknown>;
  };
  error.status = status;
  error.data = data;
  return error;
}

export async function getSpecialistCapabilityPlanStatus(input: {
  tutorAssignmentId: string;
  tutorId: string;
  now?: Date;
}): Promise<CapabilityMasteryAvailability[]> {
  await assertCapabilityTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const [bankResult, attemptResult] = await Promise.all([
    pool.query(
      `SELECT assessment_key,
              bank_version,
              max_attempts,
              retry_cooldown_hours
         FROM private.specialist_capability_assessment_configs
        WHERE active = true
          AND evidence_kind = 'mastery'`,
    ),
    pool.query(
      `SELECT assessment_key,
              bank_version,
              attempt_number,
              passed,
              completed_at
         FROM specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
          AND tutor_id = $2
          AND evidence_kind = 'mastery'
        ORDER BY completed_at ASC`,
      [input.tutorAssignmentId, input.tutorId],
    ),
  ]);

  const activeBanks: CapabilityMasteryActiveBank[] = bankResult.rows.map((row) => ({
    assessmentKey: String(row.assessment_key),
    bankVersion: Number(row.bank_version),
    maxAttempts: Number(row.max_attempts),
    retryCooldownHours: Number(row.retry_cooldown_hours),
  }));

  const attempts: CapabilityMasteryAttempt[] = attemptResult.rows.map((row) => ({
    assessmentKey: String(row.assessment_key),
    bankVersion: Number(row.bank_version),
    attemptNumber: Number(row.attempt_number),
    passed: Boolean(row.passed),
    completedAt: row.completed_at,
  }));

  return buildCapabilityMasteryAvailability({
    now: input.now || new Date(),
    activeBanks,
    attempts,
  });
}

export async function assertCapabilityAssessmentAvailable(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
}) {
  const isMasteryAssessment = CAPABILITY_MASTERY_PLAN.some(
    (entry) => entry.assessmentKey === input.assessmentKey,
  );
  if (!isMasteryAssessment) {
    throw httpError(
      404,
      "This assessment is not part of the active Training mastery engine.",
    );
  }

  const statuses = await getSpecialistCapabilityPlanStatus({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
  });
  const status = statuses.find(
    (entry) => entry.assessmentKey === input.assessmentKey,
  );
  if (!status) {
    throw httpError(404, "Capability assessment is not part of the mastery plan.");
  }
  if (status.status === "available") return status;
  if (status.status === "unavailable") {
    throw httpError(404, "This mastery bank is not active yet.", {
      availability: status,
    });
  }
  if (status.status === "complete") {
    throw httpError(
      409,
      "Current-version mastery evidence for this Deep Dive is already complete.",
      { availability: status },
    );
  }

  throw httpError(409, "This mastery check is currently locked.", {
    availability: status,
  });
}
