import { pool } from "./db";
import { getDrillSchemaDefinition } from "@shared/responseIntegrityDrillRegistry";
import type { TopicPhase } from "@shared/topicConditioningEngine";
import {
  sandboxV1ToV2BoundaryReached,
  sandboxV1ToV2EvidenceAccepted,
} from "@shared/sandboxModelTransitionPolicy";

/**
 * Founder-approved, evidence-preserving Sandbox V1 -> V2 upgrade.
 *
 * An approved request is private, belongs to exactly one trajectory, and
 * cannot be activated while a session is in progress. Existing V1 rep rows,
 * event truth, evaluations, topic state, seed, and Specialist decisions are
 * never rewritten. The transition receipt fixes historical model provenance:
 * sessions <= lastHistoricalV1Session remain V1 even after the current model
 * changes to V2.
 *
 * The table is optional until its PROOF-only migration is promoted through
 * the protected DB workflow. Missing schema or absent approval => no upgrade.
 */

export type SandboxUpgradeIdentity = {
  id: string;
  tutor_assignment_id: string;
  tutor_id: string;
  student_id: string;
  session_number: number;
  behavior_model_version: 1 | 2;
};

type UpgradePlan = {
  completing_session_number: number;
  accepted_rep_count_at_approval: number;
  expected_rep_count_at_boundary: number;
  status: "pending" | "activated";
};

function blocked(reason: string): Error & { status: number } {
  const e = new Error(reason) as Error & { status: number };
  e.status = 409;
  return e;
}

const UPGRADE_TABLE =
  "private.specialist_sandbox_behavior_model_transitions";

export async function activateApprovedSandboxModelTransition(
  input: SandboxUpgradeIdentity,
): Promise<boolean> {
  if (input.behavior_model_version !== 1) return false;
  // Do not query an unavailable private schema on older deployments.
  const available = await pool.query(
    "SELECT to_regclass($1) AS table_name", [UPGRADE_TABLE],
  );
  if (!available.rows[0]?.table_name) return false;
  const pending = await pool.query(
    [
      "SELECT completing_session_number, accepted_rep_count_at_approval,",
      "expected_rep_count_at_boundary, status FROM " + UPGRADE_TABLE,
      "WHERE trajectory_id=$1 AND tutor_assignment_id=$2 AND tutor_id=$3",
      "AND student_id=$4 AND from_version=1 AND to_version=2",
      "AND status IN ('pending','activated') LIMIT 1",
    ].join(" "),
    [input.id,input.tutor_assignment_id,input.tutor_id,input.student_id],
  );
  const plan = pending.rows[0] as UpgradePlan | undefined;
  if (!plan) return false;
  const boundary = Number(plan.completing_session_number);
  const disposition = sandboxV1ToV2BoundaryReached({
    currentVersion: input.behavior_model_version,
    planStatus: plan.status,
    currentSession: Number(input.session_number),
    completingSession: boundary,
  });
  if (disposition === "already_active") return true;
  if (disposition === "not_yet") return false;
  if (disposition !== "eligible") {
    throw blocked("The approved Sandbox model change missed its session boundary; preserve the existing history for review.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize behind normal Session N finalization. That finalizer currently
    // writes some records outside its own transaction; DO NOT inspect them
    // until its advisory lock has been released.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      ["sandbox-complete:" + input.id + ":" + boundary],
    );
    const authority = await client.query(
      [
        "SELECT t.status,t.session_number,t.completed_rep_count,t.student_id,",
        "t.tutor_id,t.tutor_assignment_id,truth.behavior_model_version",
        "FROM public.specialist_sandbox_trajectories t",
        "JOIN private.specialist_sandbox_trajectory_truth truth ON truth.trajectory_id=t.id",
        "WHERE t.id=$1 FOR UPDATE OF t,truth",
      ].join(" "),
      [input.id],
    );
    const row = authority.rows[0];
    if (!row || row.status !== "active" ||
        String(row.student_id) !== input.student_id ||
        String(row.tutor_id) !== input.tutor_id ||
        String(row.tutor_assignment_id) !== input.tutor_assignment_id) {
      throw blocked("Sandbox model transition lost the authorized trainee/trajectory ownership.");
    }
    if (Number(row.behavior_model_version) === 2) {
      await client.query("COMMIT");
      return true;
    }
    const lockedPlan = await client.query(
      [
        "SELECT completing_session_number,accepted_rep_count_at_approval,",
        "expected_rep_count_at_boundary,status",
        "FROM " + UPGRADE_TABLE,
        "WHERE trajectory_id=$1 AND tutor_assignment_id=$2 AND tutor_id=$3",
        "AND student_id=$4 AND from_version=1 AND to_version=2 FOR UPDATE",
      ].join(" "),
      [input.id,input.tutor_assignment_id,input.tutor_id,input.student_id],
    );
    const accepted = lockedPlan.rows[0] as UpgradePlan | undefined;
    if (!accepted || accepted.status !== "pending" ||
        Number(accepted.completing_session_number) !== boundary ||
        Number(row.session_number) !== boundary + 1 ||
        Number(row.completed_rep_count) !== Number(accepted.expected_rep_count_at_boundary) ||
        Number(accepted.expected_rep_count_at_boundary) !== Number(plan.expected_rep_count_at_boundary) ||
        Number(accepted.accepted_rep_count_at_approval) !== Number(plan.accepted_rep_count_at_approval)) {
      throw blocked("Sandbox upgrade cannot establish the exact founder-approved boundary and rep count.");
    }
    const counts = await client.query(
      [
        "SELECT COUNT(*)::int total_reps,",
        "COUNT(*) FILTER(WHERE e.session_number=$2)::int boundary_reps,",
        "COUNT(*) FILTER(WHERE e.session_number=$2+1)::int new_session_reps,",
        "COUNT(v.event_id)::int paired_truth_rows,",
        "md5(string_agg(to_jsonb(e)::text,'|' ORDER BY e.event_sequence)) rep_hash,",
        "md5(string_agg(to_jsonb(v)::text,'|' ORDER BY e.event_sequence)) truth_hash",
        "FROM public.specialist_sandbox_rep_events e",
        "LEFT JOIN private.specialist_sandbox_rep_event_truth v ON v.event_id=e.id",
        "WHERE e.trajectory_id=$1",
      ].join(" "),
      [input.id,boundary],
    );
    const stored = counts.rows[0];
    const sessions = await client.query(
      [
        "SELECT COUNT(*)::int evaluated,",
        "md5(string_agg(to_jsonb(se)::text,'|' ORDER BY se.session_number)) eval_hash",
        "FROM public.specialist_sandbox_session_evaluations se",
        "WHERE se.trajectory_id=$1 AND se.session_number<=$2",
      ].join(" "),
      [input.id,boundary],
    );
    const billing = await client.query(
      [
        "SELECT COUNT(*)::int confirmed_completions",
        "FROM public.session_billing_events b",
        "JOIN public.scheduled_sessions s ON s.id::text=b.session_id::text",
        "WHERE b.student_id::text=$1::text AND s.student_id::text=$1::text",
        "AND s.tutor_id::text=$2::text AND s.status='completed'",
        "AND b.is_sandbox=true AND b.event_type='sandbox_training_completed'",
        "AND b.metadata->>'trajectory_id'=$3",
        "AND b.metadata->>'sandbox_session_number'=$4",
      ].join(" "),
      [input.student_id,input.tutor_id,input.id,String(boundary)],
    );
    const last = await client.query(
      [
        "SELECT e.event_sequence,e.phase,p.outcome_key",
        "FROM public.specialist_sandbox_rep_events e",
        "JOIN private.specialist_sandbox_rep_event_truth p ON p.event_id=e.id",
        "WHERE e.trajectory_id=$1 AND e.session_number=$2",
        "ORDER BY e.event_sequence DESC LIMIT 1",
      ].join(" "),
      [input.id,boundary],
    );
    const rep = last.rows[0];
    const phase: TopicPhase | null = rep ? String(rep.phase) as TopicPhase : null;
    const repPlanCount = phase
      ? getDrillSchemaDefinition("training",phase).sets
        .filter(set=>!set.modelingOnly).reduce((n,set)=>n+set.reps,0)
      : 0;
    if (!sandboxV1ToV2EvidenceAccepted({
      expectedTotalReps: Number(plan.expected_rep_count_at_boundary),
      recordedTotalReps: Number(stored?.total_reps),
      pairedPrivateTruthRows: Number(stored?.paired_truth_rows),
      boundaryReps: Number(stored?.boundary_reps),
      requiredBoundaryReps: repPlanCount,
      followingSessionReps: Number(stored?.new_session_reps),
      evaluatedSessions: Number(sessions.rows[0]?.evaluated),
      boundarySessionNumber: boundary,
      bookedSessionCompletions: Number(billing.rows[0]?.confirmed_completions),
      lastEventSequence: Number(rep?.event_sequence),
      lastOutcomeKey: String(rep?.outcome_key || ""),
    })) {
      throw blocked("V1->V2 boundary evidence is incomplete or the final rep uses a rejected exception. Never invent or consume evidence to upgrade.");
    }
    const receipt = {
      fromVersion:1,toVersion:2,lastHistoricalV1Session:boundary,
      firstV2Session:boundary+1, lastHistoricalV1Sequence:Number(rep.event_sequence),
      historicalRepCount:Number(stored.total_reps),
      historicalSessionCount:Number(sessions.rows[0].evaluated),
      repFingerprint:stored.rep_hash, privateTruthFingerprint:stored.truth_hash,
      sessionFingerprint:sessions.rows[0].eval_hash,
      completedBookedLessonVerified:true,
    };
    const upgrade = await client.query(
      [
        "UPDATE private.specialist_sandbox_trajectory_truth",
        "SET behavior_model_version=2,updated_at=now()",
        "WHERE trajectory_id=$1 AND behavior_model_version=1",
        "RETURNING trajectory_id",
      ].join(" "),
      [input.id],
    );
    if (upgrade.rowCount !== 1) throw blocked("Concurrent Sandbox version change prevented a safe upgrade.");
    const audit = await client.query(
      [
        "UPDATE " + UPGRADE_TABLE,
        "SET status='activated',activated_at=now(),evidence_receipt=$2::jsonb",
        "WHERE trajectory_id=$1 AND status='pending' RETURNING trajectory_id",
      ].join(" "),
      [input.id,JSON.stringify(receipt)],
    );
    if (audit.rowCount !== 1) throw blocked("Sandbox transition evidence receipt was not persisted.");
    await client.query("COMMIT");
    return true;
  } catch(error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
