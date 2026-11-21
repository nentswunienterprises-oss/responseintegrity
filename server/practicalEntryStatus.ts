import { evaluatePracticalEntryGate, type PracticalReadinessSnapshot } from "../shared/practicalEntryGate";
import { isCapabilityProofPreview } from "./proofTrainingBooking";

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
  let signoff = result.rows[0] || null;
  let readiness = await loadReadiness({ tutorAssignmentId, tutorId });
  let proofSyntheticPath = false;

  // A synthetic readiness fixture is a separate, clearly identified acceptance
  // lane. It exists only in the isolated Capability Proof Preview and never
  // writes into genuine Sandbox evidence or the real TD assessment ledger.
  if (isCapabilityProofPreview(process.env) &&
      process.env.RI_PROOF_SYNTHETIC_PRACTICALS_V1 === "true") {
    const fixture = await db.query(
      `SELECT id, tutor_id, tutor_assignment_id, td_id, fixture_label, expires_at
         FROM private.proof_synthetic_practical_readiness_fixtures
        WHERE tutor_assignment_id=$1 AND tutor_id=$2 AND td_id=$3
          AND fixture_label='PROOF SYNTHETIC PRACTICALS ACCEPTANCE'
          AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1`,
      [tutorAssignmentId, tutorId, String(assignment.td_id || "")],
    );
    if (fixture.rows[0]) {
      const fixtureId = String(fixture.rows[0].id);
      const snapshot: PracticalReadinessSnapshot = {
        practicalsReady: true,
        policyStatus: "approved",
        policyVersion: Number(readiness.policyVersion) || 1,
        bankKey: String(readiness.bankKey || "sandbox_stateful_environment"),
        bankVersion: Number(readiness.bankVersion) || 1,
        qualification: {
          policyId: String(readiness.qualification?.policyId || "ri-sandbox-qualification"),
          policyVersion: Number(readiness.qualification?.policyVersion) || 2,
          qualificationReady: true,
          evidenceFingerprint: `proof-synthetic:${fixtureId}`,
        },
      };
      signoff = {
        decision: "passed",
        capabilitySnapshot: snapshot,
      };
      readiness = snapshot;
      proofSyntheticPath = true;
    }
  }
  const gate = evaluatePracticalEntryGate({
    operationalMode: assignment.operational_mode,
    assignedTdId: String(assignment.td_id || "") || null,
    latestAssignedTdSignoff: signoff ? {
      decision: signoff.decision,
      capabilitySnapshot: signoff.capabilitySnapshot || signoff.checklist?.capability_snapshot || null,
    } : null,
    currentReadiness: readiness,
  });
  return { ...gate, signoffId: proofSyntheticPath ? null : signoff?.id || null, proofSyntheticPath };
}
