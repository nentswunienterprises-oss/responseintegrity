import { pool } from "./db";
import {
  CAPABILITY_PRACTICAL_PROOFS,
  getCapabilityPracticalProofDefinition,
  type CapabilityPracticalArtifactType,
  type CapabilityPracticalProofDefinition,
} from "@shared/capabilityPracticalEvidence";

export type PracticalReviewOutcome = "approved" | "repeat_required" | "integrity_review";

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function normalizeArtifactUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw httpError(400, "A valid HTTPS recording link is required.");
  }

  if (parsed.protocol !== "https:") {
    throw httpError(400, "Practical evidence recording links must use HTTPS.");
  }

  return parsed.toString();
}

function validateDeclaration(
  definition: CapabilityPracticalProofDefinition,
  declaration: Record<string, unknown>,
) {
  const normalized: Record<string, string> = {};

  for (const prompt of definition.declarationPrompts) {
    const value = String(declaration[prompt.key] || "").trim();
    if (value.length < prompt.minLength) {
      throw httpError(
        400,
        `Declaration ${prompt.key} must contain at least ${prompt.minLength} characters.`,
      );
    }
    normalized[prompt.key] = value;
  }

  return normalized;
}

export function buildPublicPracticalDefinitions() {
  return CAPABILITY_PRACTICAL_PROOFS.map((proof) => ({
    key: proof.key,
    version: proof.version,
    title: proof.title,
    purpose: proof.purpose,
    requiredArtifactTypes: proof.requiredArtifactTypes,
    mustShow: proof.mustShow,
    declarationPrompts: proof.declarationPrompts,
    realStudentDataAllowed: false,
  }));
}

async function assertTutorAssignmentOwnership(tutorAssignmentId: string, tutorId: string) {
  const result = await pool.query(
    `SELECT ta.id, ta.pod_id, p.td_id
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

async function getLatestProofAttempt(tutorAssignmentId: string, proofKey: string, proofVersion: number) {
  const result = await pool.query(
    `SELECT e.id,
            e.attempt_number,
            e.submitted_at,
            r.outcome,
            r.feedback,
            r.reviewed_at
       FROM specialist_capability_practical_evidence e
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE e.tutor_assignment_id = $1
        AND e.proof_key = $2
        AND e.proof_version = $3
      ORDER BY e.attempt_number DESC
      LIMIT 1`,
    [tutorAssignmentId, proofKey, proofVersion],
  );

  return result.rows[0] || null;
}

export async function submitPracticalCapabilityEvidence(input: {
  tutorAssignmentId: string;
  tutorId: string;
  proofKey: string;
  proofVersion: number;
  artifactUrl: string;
  artifactType: CapabilityPracticalArtifactType;
  declaration: Record<string, unknown>;
  noRealStudentDataConfirmed: boolean;
}) {
  await assertTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const definition = getCapabilityPracticalProofDefinition(input.proofKey);
  if (!definition) throw httpError(404, "Unknown practical capability proof.");
  if (input.proofVersion !== definition.version) {
    throw httpError(409, "This practical proof version is no longer current.");
  }
  if (!definition.requiredArtifactTypes.includes(input.artifactType)) {
    throw httpError(400, "The submitted recording type does not satisfy this practical proof.");
  }
  if (!input.noRealStudentDataConfirmed) {
    throw httpError(400, "Practical evidence may only use the provided sandbox scenario. Real student data is not allowed.");
  }

  const latest = await getLatestProofAttempt(
    input.tutorAssignmentId,
    definition.key,
    definition.version,
  );

  if (latest && !latest.outcome) {
    throw httpError(409, "This practical proof already has a submission awaiting review.");
  }
  if (latest?.outcome === "approved") {
    throw httpError(409, "This practical proof has already been approved.");
  }
  if (latest?.outcome === "integrity_review") {
    throw httpError(409, "This practical proof is under integrity review and cannot be resubmitted yet.");
  }

  const attemptNumber = Number(latest?.attempt_number || 0) + 1;
  const artifactUrl = normalizeArtifactUrl(input.artifactUrl);
  const declaration = validateDeclaration(definition, input.declaration);

  try {
    const result = await pool.query(
      `INSERT INTO specialist_capability_practical_evidence (
         tutor_assignment_id,
         tutor_id,
         proof_key,
         proof_version,
         attempt_number,
         artifact_url,
         artifact_type,
         declaration,
         no_real_student_data_confirmed
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, true)
       RETURNING id, submitted_at`,
      [
        input.tutorAssignmentId,
        input.tutorId,
        definition.key,
        definition.version,
        attemptNumber,
        artifactUrl,
        input.artifactType,
        JSON.stringify(declaration),
      ],
    );

    return {
      evidenceId: result.rows[0]?.id,
      proofKey: definition.key,
      proofVersion: definition.version,
      attemptNumber,
      status: "submitted" as const,
      submittedAt: result.rows[0]?.submitted_at,
    };
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      throw httpError(409, "This practical proof attempt already exists.");
    }
    throw error;
  }
}

export async function getSpecialistPracticalEvidence(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  await assertTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const result = await pool.query(
    `SELECT e.id,
            e.proof_key,
            e.proof_version,
            e.attempt_number,
            e.artifact_type,
            e.submitted_at,
            r.outcome,
            r.feedback,
            r.reason_code,
            r.reviewed_at
       FROM specialist_capability_practical_evidence e
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE e.tutor_assignment_id = $1
        AND e.tutor_id = $2
      ORDER BY e.submitted_at DESC`,
    [input.tutorAssignmentId, input.tutorId],
  );

  return result.rows.map((row) => ({
    evidenceId: row.id,
    proofKey: row.proof_key,
    proofVersion: Number(row.proof_version),
    attemptNumber: Number(row.attempt_number),
    artifactType: row.artifact_type,
    status: row.outcome || "submitted",
    feedback: row.feedback || null,
    reasonCode: row.reason_code || null,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at || null,
  }));
}

function assertReviewerRole(role: string) {
  const normalized = String(role || "").toLowerCase();
  if (!new Set(["td", "coo", "hr"]).has(normalized)) {
    throw httpError(403, "Capability practical review access is restricted.");
  }
  return normalized;
}

export async function getPracticalReviewQueue(input: {
  reviewerId: string;
  reviewerRole: string;
}) {
  const reviewerRole = assertReviewerRole(input.reviewerRole);
  const params: unknown[] = [];
  let tdScope = "";

  if (reviewerRole === "td") {
    params.push(input.reviewerId);
    tdScope = ` AND p.td_id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT e.id,
            e.tutor_assignment_id,
            e.tutor_id,
            e.proof_key,
            e.proof_version,
            e.attempt_number,
            e.artifact_url,
            e.artifact_type,
            e.declaration,
            e.submitted_at,
            p.pod_name,
            u.first_name,
            u.last_name
       FROM specialist_capability_practical_evidence e
       JOIN tutor_assignments ta ON ta.id = e.tutor_assignment_id
       LEFT JOIN pods p ON p.id = ta.pod_id
       JOIN users u ON u.id = e.tutor_id
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE r.id IS NULL
        ${tdScope}
      ORDER BY e.submitted_at ASC`,
    params,
  );

  return result.rows.map((row) => ({
    evidenceId: row.id,
    tutorAssignmentId: row.tutor_assignment_id,
    tutorId: row.tutor_id,
    specialistName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
    podName: row.pod_name || null,
    proofKey: row.proof_key,
    proofVersion: Number(row.proof_version),
    attemptNumber: Number(row.attempt_number),
    artifactUrl: row.artifact_url,
    artifactType: row.artifact_type,
    declaration: row.declaration,
    submittedAt: row.submitted_at,
  }));
}

async function assertReviewerCanAccessEvidence(input: {
  evidenceId: string;
  reviewerId: string;
  reviewerRole: string;
}) {
  const reviewerRole = assertReviewerRole(input.reviewerRole);
  const result = await pool.query(
    `SELECT e.id, p.td_id, r.id AS review_id
       FROM specialist_capability_practical_evidence e
       JOIN tutor_assignments ta ON ta.id = e.tutor_assignment_id
       LEFT JOIN pods p ON p.id = ta.pod_id
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE e.id = $1
      LIMIT 1`,
    [input.evidenceId],
  );

  const row = result.rows[0];
  if (!row) throw httpError(404, "Practical capability evidence not found.");
  if (row.review_id) throw httpError(409, "This practical capability evidence has already been reviewed.");
  if (reviewerRole === "td" && String(row.td_id || "") !== input.reviewerId) {
    throw httpError(403, "This evidence is outside the Territory Director's assigned pod scope.");
  }

  return reviewerRole;
}

export async function reviewPracticalCapabilityEvidence(input: {
  evidenceId: string;
  reviewerId: string;
  reviewerRole: string;
  outcome: PracticalReviewOutcome;
  reasonCode?: string | null;
  feedback?: string | null;
}) {
  const reviewerRole = await assertReviewerCanAccessEvidence(input);
  const feedback = String(input.feedback || "").trim();
  const reasonCode = String(input.reasonCode || "").trim() || null;

  if ((input.outcome === "repeat_required" || input.outcome === "integrity_review") && feedback.length < 20) {
    throw httpError(400, "Reviewer feedback is required when requesting a repeat or escalating integrity review.");
  }

  try {
    const result = await pool.query(
      `INSERT INTO specialist_capability_practical_reviews (
         evidence_id,
         reviewer_id,
         reviewer_role,
         outcome,
         reason_code,
         feedback
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, reviewed_at`,
      [
        input.evidenceId,
        input.reviewerId,
        reviewerRole,
        input.outcome,
        reasonCode,
        feedback || null,
      ],
    );

    return {
      reviewId: result.rows[0]?.id,
      evidenceId: input.evidenceId,
      outcome: input.outcome,
      reviewedAt: result.rows[0]?.reviewed_at,
    };
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      throw httpError(409, "This practical capability evidence has already been reviewed.");
    }
    throw error;
  }
}
