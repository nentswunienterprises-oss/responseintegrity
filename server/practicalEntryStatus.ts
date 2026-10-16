import { evaluatePracticalEntryGate, type PracticalReadinessSnapshot } from "../shared/practicalEntryGate";

type Query = { query(sql: string, params: unknown[]): Promise<{ rows: any[] }> };
type LoadReadiness = (input: { tutorAssignmentId: string; tutorId: string }) => Promise<PracticalReadinessSnapshot>;

// The runtime and isolated PostgreSQL acceptance exercise this same ownership,
// current-assessor selection and evidence-bound entry path.
export async function loadPracticalEntryStatus(
  db: Query,
  loadReadiness: LoadReadiness,
  tutorAssignmentId: string,
  tutorId: string,
) {
  const owned = await db.query(
    `SELECT ta.id, ta.pod_id, ta.operational_mode, p.td_id
       FROM tutor_assignments ta
       LEFT JOIN pods p ON p.id = ta.pod_id
      WHERE ta.id = $1 AND ta.tutor_id = $2
      LIMIT 1`,
    [tutorAssignmentId, tutorId],
  );
  const assignment = owned.rows[0];
  if (!assignment) {
    throw Object.assign(new Error("Specialist assignment not found or does not belong to the authenticated user."), { status: 403 });
  }
  const result = await db.query(
    `SELECT id, decision, checklist FROM public.tutor_sandbox_mock_assessments
      WHERE tutor_assignment_id=$1 AND tutor_id=$2
        AND assessed_by_user_id=$3
        AND checklist->>'assessment_version'='2'
        AND checklist->>'assessment_owner'='td'
        AND checklist->>'next_stage'='practicals'
      ORDER BY assessed_at DESC, id DESC LIMIT 1`,
    [tutorAssignmentId, tutorId, String(assignment.td_id || "")],
  );
  const signoff = result.rows[0] || null;
  const gate = evaluatePracticalEntryGate({
    operationalMode: assignment.operational_mode,
    assignedTdId: String(assignment.td_id || "") || null,
    latestAssignedTdSignoff: signoff ? {
      decision: signoff.decision,
      capabilitySnapshot: signoff.checklist?.capability_snapshot || null,
    } : null,
    currentReadiness: await loadReadiness({ tutorAssignmentId, tutorId }),
  });
  return { ...gate, signoffId: signoff?.id || null };
}
