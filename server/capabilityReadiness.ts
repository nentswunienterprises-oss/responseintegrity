import { pool } from "./db";
import {
  evaluateCapabilityReadiness,
  FOUNDATION_CAPABILITY_SHADOW_GATE_V1,
  type CapabilityReadinessResult,
} from "@shared/capabilityReadiness";
import { CAPABILITY_PRACTICAL_PROOFS } from "@shared/capabilityPracticalEvidence";
import { ORAL_DEFENSE_VERSION } from "@shared/capabilityOralDefense";
import { selectCurrentCapabilityReadinessEvidence } from "@shared/capabilityEvidenceSelection";
import {
  canCapabilityReviewerAccessAssignment,
  isCapabilityReviewerRole,
  type CapabilityReviewerRole,
} from "@shared/capabilityReviewerScope";

function httpError(status: number, message: string, data?: Record<string, unknown>) {
  const error = new Error(message) as Error & { status?: number; data?: Record<string, unknown> };
  error.status = status;
  error.data = data;
  return error;
}

export function normalizeCapabilityReviewerRole(role: string): CapabilityReviewerRole {
  const normalized = String(role || "").toLowerCase();
  if (!isCapabilityReviewerRole(normalized)) {
    throw httpError(403, "Capability review access is restricted.");
  }
  return normalized;
}

export async function assertCapabilityTutorAssignmentOwnership(
  tutorAssignmentId: string,
  tutorId: string,
) {
  const result = await pool.query(
    `SELECT ta.id, ta.tutor_id, ta.pod_id, p.td_id
       FROM tutor_assignments ta
       LEFT JOIN pods p ON p.id = ta.pod_id
      WHERE ta.id = $1
        AND ta.tutor_id = $2
      LIMIT 1`,
    [tutorAssignmentId, tutorId],
  );

  if (!result.rowCount) {
    throw httpError(403, "Specialist assignment not found or does not belong to the authenticated user.");
  }

  return result.rows[0];
}

export async function assertCapabilityReviewerAccessToAssignment(input: {
  tutorAssignmentId: string;
  reviewerId: string;
  reviewerRole: string;
}) {
  const reviewerRole = normalizeCapabilityReviewerRole(input.reviewerRole);

  const result = await pool.query(
    `SELECT ta.id, ta.tutor_id, ta.pod_id, p.td_id
       FROM tutor_assignments ta
       LEFT JOIN pods p ON p.id = ta.pod_id
      WHERE ta.id = $1
      LIMIT 1`,
    [input.tutorAssignmentId],
  );

  const row = result.rows[0];
  if (!row) throw httpError(404, "Specialist assignment not found.");
  if (!canCapabilityReviewerAccessAssignment({
    reviewerId: input.reviewerId,
    reviewerRole,
    assignmentTdId: row.td_id || null,
  })) {
    throw httpError(403, "This Specialist is outside the reviewer's assigned pod scope.");
  }

  return { ...row, reviewerRole };
}

export async function getCapabilityReadinessEvidence(tutorAssignmentId: string) {
  const [assessmentResult, activeConfigResult, practicalResult, oralResult] = await Promise.all([
    pool.query(
      `SELECT assessment_key,
              bank_version,
              attempt_number,
              passed,
              completed_at
         FROM specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
        ORDER BY assessment_key, attempt_number ASC, completed_at ASC`,
      [tutorAssignmentId],
    ),
    pool.query(
      `SELECT assessment_key, bank_version
         FROM private.specialist_capability_assessment_configs
        WHERE active = true`,
    ),
    pool.query(
      `SELECT e.proof_key,
              e.proof_version,
              e.attempt_number,
              e.submitted_at,
              r.outcome,
              r.reviewed_at
         FROM specialist_capability_practical_evidence e
         LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
        WHERE e.tutor_assignment_id = $1
        ORDER BY e.proof_key, e.attempt_number ASC, e.submitted_at ASC`,
      [tutorAssignmentId],
    ),
    pool.query(
      `SELECT defense_version,
              attempt_number,
              outcome,
              completed_at
         FROM specialist_capability_oral_defenses
        WHERE tutor_assignment_id = $1
        ORDER BY attempt_number ASC, completed_at ASC`,
      [tutorAssignmentId],
    ),
  ]);

  return selectCurrentCapabilityReadinessEvidence({
    assessments: assessmentResult.rows.map((row) => ({
      assessmentKey: String(row.assessment_key),
      bankVersion: Number(row.bank_version),
      attemptNumber: Number(row.attempt_number),
      passed: Boolean(row.passed),
      completedAt: row.completed_at,
    })),
    activeAssessmentVersions: activeConfigResult.rows.map((row) => ({
      assessmentKey: String(row.assessment_key),
      bankVersion: Number(row.bank_version),
    })),
    practicals: practicalResult.rows.map((row) => ({
      proofKey: String(row.proof_key),
      proofVersion: Number(row.proof_version),
      attemptNumber: Number(row.attempt_number),
      outcome: (row.outcome || "submitted") as "submitted" | "approved" | "repeat_required" | "integrity_review",
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at || null,
    })),
    currentPracticalVersions: CAPABILITY_PRACTICAL_PROOFS.map((proof) => ({
      proofKey: proof.key,
      proofVersion: proof.version,
    })),
    oralDefenses: oralResult.rows.map((row) => ({
      defenseVersion: Number(row.defense_version),
      attemptNumber: Number(row.attempt_number),
      outcome: row.outcome as "approved" | "repeat_required" | "integrity_review",
      completedAt: row.completed_at,
    })),
    currentOralDefenseVersion: ORAL_DEFENSE_VERSION,
  });
}

export async function getFoundationCapabilityReadiness(
  tutorAssignmentId: string,
): Promise<CapabilityReadinessResult> {
  const evidence = await getCapabilityReadinessEvidence(tutorAssignmentId);
  return evaluateCapabilityReadiness(FOUNDATION_CAPABILITY_SHADOW_GATE_V1, evidence);
}

export async function assertPreOralCapabilityEvidenceReady(tutorAssignmentId: string) {
  const readiness = await getFoundationCapabilityReadiness(tutorAssignmentId);
  const missingBeforeOral = readiness.requirements.filter(
    (requirement) => requirement.kind !== "oral_defense" && !requirement.satisfied,
  );

  if (missingBeforeOral.length > 0) {
    throw httpError(409, "Capability evidence is not ready for human oral defense.", {
      missingRequirementCodes: missingBeforeOral.map((requirement) => requirement.code),
    });
  }

  return readiness;
}
