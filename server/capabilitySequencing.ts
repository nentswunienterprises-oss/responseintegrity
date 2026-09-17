import { pool } from "./db";
import { assertCapabilityTutorAssignmentOwnership } from "./capabilityReadiness";
import {
  buildCurrentCapabilityEvidenceCellStates,
  selectCurrentPassingCapabilityAssessments,
  type CapabilityAssessmentEvidenceSnapshot,
  type CapabilityActiveAssessmentVersion,
} from "@shared/capabilityEvidenceSelection";
import {
  buildCapabilityAssessmentAvailability,
  type CapabilityAssessmentAvailability,
  type CapabilityAssessmentAttemptState,
  type CapabilityActiveBankState,
} from "@shared/capabilitySequencing";
import { getCapabilityMvpAssessmentPlanEntry } from "@shared/capabilityAssessmentPlan";

function httpError(status: number, message: string, data?: Record<string, unknown>) {
  const error = new Error(message) as Error & { status?: number; data?: Record<string, unknown> };
  error.status = status;
  error.data = data;
  return error;
}

export async function getSpecialistCapabilityPlanStatus(input: {
  tutorAssignmentId: string;
  tutorId: string;
  now?: Date;
}): Promise<CapabilityAssessmentAvailability[]> {
  await assertCapabilityTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const [activeBankResult, attemptResult] = await Promise.all([
    pool.query(
      `SELECT assessment_key,
              bank_version,
              max_attempts,
              retry_cooldown_hours
         FROM private.specialist_capability_assessment_configs
        WHERE active = true`,
    ),
    pool.query(
      `SELECT assessment_key,
              bank_version,
              attempt_number,
              evidence_kind,
              covered_deep_dive_keys,
              passed,
              completed_at
         FROM specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
        ORDER BY assessment_key, bank_version, attempt_number ASC, completed_at ASC`,
      [input.tutorAssignmentId],
    ),
  ]);

  const activeBanks: CapabilityActiveBankState[] = activeBankResult.rows.map((row) => ({
    assessmentKey: String(row.assessment_key),
    bankVersion: Number(row.bank_version),
    maxAttempts: Number(row.max_attempts),
    retryCooldownHours: Number(row.retry_cooldown_hours),
  }));
  const activeAssessmentVersions: CapabilityActiveAssessmentVersion[] = activeBanks.map((bank) => ({
    assessmentKey: bank.assessmentKey,
    bankVersion: bank.bankVersion,
  }));
  const assessments: CapabilityAssessmentEvidenceSnapshot[] = attemptResult.rows.map((row) => ({
    assessmentKey: String(row.assessment_key),
    bankVersion: Number(row.bank_version),
    attemptNumber: Number(row.attempt_number),
    evidenceKind: row.evidence_kind,
    coveredDeepDiveKeys: Array.isArray(row.covered_deep_dive_keys)
      ? row.covered_deep_dive_keys.map(String)
      : [],
    passed: Boolean(row.passed),
    completedAt: row.completed_at,
  }));
  const attempts: CapabilityAssessmentAttemptState[] = assessments.map((attempt) => ({
    assessmentKey: attempt.assessmentKey,
    bankVersion: attempt.bankVersion,
    attemptNumber: attempt.attemptNumber,
    completedAt: attempt.completedAt,
  }));

  const currentPassingAssessments = selectCurrentPassingCapabilityAssessments(
    assessments,
    activeAssessmentVersions,
  );
  const evidenceCells = buildCurrentCapabilityEvidenceCellStates(currentPassingAssessments);

  return buildCapabilityAssessmentAvailability({
    now: input.now || new Date(),
    activeBanks,
    evidenceCells,
    attempts,
  });
}

export async function assertCapabilityAssessmentAvailable(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
}) {
  const planEntry = getCapabilityMvpAssessmentPlanEntry(input.assessmentKey);

  // Sprint 1-7 legacy shadow assessments remain readable while the V1 plan is
  // introduced. Only assessments in the approved 16-event MVP plan are gated
  // by this sequencer.
  if (!planEntry) return null;

  const statuses = await getSpecialistCapabilityPlanStatus({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
  });
  const status = statuses.find((entry) => entry.assessmentKey === input.assessmentKey);
  if (!status) {
    throw httpError(404, "Capability assessment is not part of the active MVP plan.");
  }
  if (status.status === "available") return status;

  if (status.status === "unavailable") {
    throw httpError(404, "Capability assessment is not active yet.", {
      availability: status,
    });
  }
  if (status.status === "complete") {
    throw httpError(409, "Current capability evidence for this assessment is already complete.", {
      availability: status,
    });
  }

  throw httpError(409, "Capability assessment is currently locked.", {
    availability: status,
  });
}
