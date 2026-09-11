import { pool } from "./db";
import {
  evaluateCapabilityReadiness,
  FOUNDATION_CAPABILITY_SHADOW_GATE_V1,
  type CapabilityReadinessResult,
} from "@shared/capabilityReadiness";
import { getCapabilityPracticalProofDefinition } from "@shared/capabilityPracticalEvidence";
import { ORAL_DEFENSE_VERSION } from "@shared/capabilityOralDefense";

function httpError(status: number, message: string, data?: Record<string, unknown>) {
  const error = new Error(message) as Error & { status?: number; data?: Record<string, unknown> };
  error.status = status;
  error.data = data;
  return error;
}

export function normalizeCapabilityReviewerRole(role: string) {
  const normalized = String(role || "").toLowerCase();
  if (!new Set(["td", "coo", "hr"]).has(normalized)) {
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
  if (reviewerRole === "td" && String(row.td_id || "") !== input.reviewerId) {
    throw httpError(403, "This Specialist is outside the reviewer's assigned pod scope.");
  }

  return { ...row, reviewerRole };
}

export async function getCapabilityReadinessEvidence(tutorAssignmentId: string) {
  const [assessmentResult, practicalResult, oralResult] = await Promise.all([
    pool.query(
      `WITH latest_attempt AS (
         SELECT DISTINCT ON (assessment_key)
                assessment_key,
                bank_version,
                passed,
                attempt_number,
                completed_at
           FROM specialist_capability_assessment_attempts
          WHERE tutor_assignment_id = $1
          ORDER BY assessment_key, attempt_number DESC, completed_at DESC
       )
       SELECT latest_attempt.assessment_key
         FROM latest_attempt
         JOIN private.specialist_capability_assessment_configs config
           ON config.assessment_key = latest_attempt.assessment_key
          AND config.bank_version = latest_attempt.bank_version
          AND config.active = true
        WHERE latest_attempt.passed = true`,
      [tutorAssignmentId],
    ),
    pool.query(
      `WITH latest_practical AS (
         SELECT DISTINCT ON (e.proof_key)
                e.id,
                e.proof_key,
                e.proof_version,
                e.attempt_number,
                e.submitted_at
           FROM specialist_capability_practical_evidence e
          WHERE e.tutor_assignment_id = $1
          ORDER BY e.proof_key, e.attempt_number DESC, e.submitted_at DESC
       )
       SELECT latest_practical.proof_key,
              latest_practical.proof_version,
              r.outcome
         FROM latest_practical
         LEFT JOIN specialist_capability_practical_reviews r
           ON r.evidence_id = latest_practical.id`,
      [tutorAssignmentId],
    ),
    pool.query(
      `SELECT defense_version, outcome
         FROM specialist_capability_oral_defenses
        WHERE tutor_assignment_id = $1
        ORDER BY attempt_number DESC, completed_at DESC
        LIMIT 1`,
      [tutorAssignmentId],
    ),
  ]);

  const approvedPracticalProofKeys = practicalResult.rows
    .filter((row) => {
      if (row.outcome !== "approved") return false;
      const definition = getCapabilityPracticalProofDefinition(String(row.proof_key));
      return Boolean(definition && definition.version === Number(row.proof_version));
    })
    .map((row) => String(row.proof_key));

  const latestOral = oralResult.rows[0] || null;
  const oralDefenseApproved = Boolean(
    latestOral &&
      Number(latestOral.defense_version) === ORAL_DEFENSE_VERSION &&
      latestOral.outcome === "approved",
  );

  return {
    passedAssessmentKeys: assessmentResult.rows.map((row) => String(row.assessment_key)),
    approvedPracticalProofKeys,
    oralDefenseApproved,
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
