-- HISTORICAL RECORD: APPLIED ONLY IN CAPABILITY PROOF (2026-10-14).
-- NEVER execute this proposal against Production (The Hub).
-- Production runtime safely skips transitions if this ledger is absent.
-- Capability Proof, founder-authorized V1 -> V2 Sandbox handover.
-- This is a *private* transition ledger; it does not modify an existing rep,
-- session evaluation, booking, or the historical V1 record. The runtime
-- applies an approved transition ONLY at a completed session boundary.
CREATE TABLE IF NOT EXISTS private.specialist_sandbox_behavior_model_transitions (
  trajectory_id varchar PRIMARY KEY
    REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE RESTRICT,
  tutor_assignment_id varchar NOT NULL,
  tutor_id varchar NOT NULL,
  student_id varchar NOT NULL,
  from_version smallint NOT NULL CHECK (from_version = 1),
  to_version smallint NOT NULL CHECK (to_version = 2),
  completing_session_number integer NOT NULL CHECK (completing_session_number > 0),
  accepted_rep_count_at_approval integer NOT NULL CHECK (accepted_rep_count_at_approval >= 0),
  expected_rep_count_at_boundary integer NOT NULL
    CHECK (expected_rep_count_at_boundary > accepted_rep_count_at_approval),
  status varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','activated','cancelled')),
  authorization_reason text NOT NULL CHECK (length(trim(authorization_reason)) > 0),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  evidence_receipt jsonb,
  CONSTRAINT sandbox_model_transition_activation_evidence CHECK (
    (status = 'activated' AND activated_at IS NOT NULL AND evidence_receipt IS NOT NULL)
    OR (status <> 'activated' AND activated_at IS NULL AND evidence_receipt IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_sandbox_model_transition_student
  ON private.specialist_sandbox_behavior_model_transitions
  (tutor_assignment_id, student_id, status);

ALTER TABLE private.specialist_sandbox_behavior_model_transitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_behavior_model_transitions FROM PUBLIC;
REVOKE ALL ON TABLE private.specialist_sandbox_behavior_model_transitions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE
  private.specialist_sandbox_behavior_model_transitions TO service_role;
