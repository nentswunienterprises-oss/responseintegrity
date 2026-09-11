import { pool } from "./db";
import {
  evaluateCapabilityReadiness,
  FOUNDATION_CAPABILITY_SHADOW_GATE_V1,
  type CapabilityReadinessResult,
} from "@shared/capabilityReadiness";

function httpError(status: number, message: string, data?: Record<string, unknown>) {
  const error = new Error(message) as Error & { status?: number; data?: Record<string, unknown> };
  error.status = status;
  error.data = data;
  return error;
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
  const reviewerRole = String(input.reviewerRole || "").toLowerCase();
  if (!new Set(["td", "coo", "hr"]).has(reviewerRole)) {
    throw httpError(403, "Capability review access is restricted.");
  }

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
  if (reviewerRole === "td" && String(row.td_id || "") !== input.reviewerId) {
    throw httpError(403, "This Specialist is outside the reviewer's assigned pod scope.");
  }

  return { ...row, reviewerRole };
}

export async function getCapabilityReadinessEvidence(tutorAssignmentId: string) {
  const [assessmentResult, practicalResult, oralResult] = await Promise.all([
    pool.query(
      `SELECT DISTINCT assessment_key
         FROM specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
          AND passed = true`,
      [tutorAssignmentId],
    ),
    pool.query(
      `SELECT DISTINCT e.proof_key
         FROM specialist_capability_practical_evidence e
         JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
        WHERE e.tutor_assignment_id = $1
          AND r.outcome = 'approved'`,
      [tutorAssignmentId],
    ),
    pool.query(
      `SELECT EXISTS (
         SELECT 1
           FROM specialist_capability_oral_defenses
          WHERE tutor_assignment_id = $1
            AND outcome = 'approved'
       ) AS approved`,
      [tutorAssignmentId],
    ),
  ]);

  return {
    passedAssessmentKeys: assessmentResult.rows.map((row) => String(row.assessment_key)),
    approvedPracticalProofKeys: practicalResult.rows.map((row) => String(row.proof_key)),
    oralDefenseApproved: Boolean(oralResult.rows[0]?.approved),
  };
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
