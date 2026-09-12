import { pool } from "./db";
import {
  buildPersistedShadowConcordanceSnapshot,
} from "./capabilityShadowConcordance";
import { normalizeCapabilityReviewerRole } from "./capabilityReadiness";
import {
  buildShadowCohortReview,
  type ShadowCohortCandidateInput,
} from "@shared/capabilityShadowCohort";

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

interface CandidateAssignmentRow {
  tutor_assignment_id: string;
  tutor_id: string;
  operational_mode: string | null;
  pod_name: string | null;
  td_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

async function listShadowCohortCandidateAssignments(input: {
  reviewerId: string;
  reviewerRole: string;
}) {
  const reviewerRole = normalizeCapabilityReviewerRole(input.reviewerRole);
  const params: unknown[] = [];
  let tdScope = "";

  if (reviewerRole === "td") {
    params.push(input.reviewerId);
    tdScope = ` AND p.td_id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT ta.id AS tutor_assignment_id,
            ta.tutor_id,
            ta.operational_mode,
            p.pod_name,
            p.td_id,
            u.first_name,
            u.last_name,
            u.email
       FROM tutor_assignments ta
       JOIN users u ON u.id = ta.tutor_id
       LEFT JOIN pods p ON p.id = ta.pod_id
      WHERE (
              EXISTS (
                SELECT 1
                  FROM battle_test_runs b
                 WHERE b.tutor_assignment_id = ta.id
                   AND b.subject_type = 'tutor'
              )
              OR EXISTS (
                SELECT 1
                  FROM specialist_capability_assessment_attempts a
                 WHERE a.tutor_assignment_id = ta.id
              )
            )
        ${tdScope}
      ORDER BY p.pod_name NULLS LAST,
               u.first_name NULLS LAST,
               u.last_name NULLS LAST,
               ta.id`,
    params,
  );

  const rows = result.rows as CandidateAssignmentRow[];
  const assignmentIds = rows.map((row) => String(row.tutor_assignment_id));
  if (new Set(assignmentIds).size !== assignmentIds.length) {
    throw httpError(409, "Shadow cohort candidate query returned duplicate assignment identities.");
  }
  return rows;
}

function specialistName(row: CandidateAssignmentRow) {
  const value = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return value || row.email || `Specialist ${row.tutor_id}`;
}

export async function buildPersistedShadowCohortReview(input: {
  reviewerId: string;
  reviewerRole: string;
}) {
  const candidates = await listShadowCohortCandidateAssignments(input);
  const members: ShadowCohortCandidateInput[] = [];

  // Deliberately sequential. Each assignment snapshot performs multiple evidence
  // reads across two persistence clients. The shadow cohort is expected to be a
  // small review population, and bounded sequential reads avoid an uncontrolled
  // burst of database connections while preserving fail-closed behavior.
  for (const row of candidates) {
    const tutorAssignmentId = String(row.tutor_assignment_id);
    const snapshot = await buildPersistedShadowConcordanceSnapshot({
      tutorAssignmentId,
      reviewerId: input.reviewerId,
      reviewerRole: input.reviewerRole,
    });

    if (String(snapshot.tutorId) !== String(row.tutor_id)) {
      throw httpError(
        409,
        `Shadow cohort assignment ${tutorAssignmentId} resolved to an inconsistent Specialist identity.`,
      );
    }

    members.push({
      tutorAssignmentId,
      tutorId: String(row.tutor_id),
      specialistName: specialistName(row),
      specialistEmail: row.email ? String(row.email) : null,
      podName: row.pod_name ? String(row.pod_name) : null,
      operationalMode: row.operational_mode ? String(row.operational_mode) : null,
      comparison: snapshot.comparison,
    });
  }

  return buildShadowCohortReview(members);
}
