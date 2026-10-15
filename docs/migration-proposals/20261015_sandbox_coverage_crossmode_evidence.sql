-- Sandbox cross-mode evidence V1. PROPOSAL: protected Proof migration review/application required.
-- Not deployed to Production or Capability Proof merely by merging code.
-- Server-owned captures of completed simulated Diagnosis/Handover opportunities.
-- No direct client grants: all TD projections must pass authenticated server role/Pod scope.
BEGIN;
CREATE TABLE IF NOT EXISTS public.specialist_sandbox_live_evidence_turns (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trajectory_id varchar NOT NULL REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE CASCADE,
  student_id varchar NOT NULL,
  scope varchar(16) NOT NULL CHECK(scope IN ('diagnosis','handover')),
  source_context_id varchar NOT NULL,
  form_id varchar NOT NULL,
  sequence_number integer NOT NULL CHECK(sequence_number>0),
  phase varchar NOT NULL,
  probe_id varchar NOT NULL,
  bank_version integer NOT NULL CHECK(bank_version>0),
  behavior_model_version smallint NOT NULL CHECK(behavior_model_version IN (1,2)),
  student_behavior text NOT NULL CHECK(length(btrim(student_behavior))>0),
  specialist_submission jsonb NOT NULL,
  condition_conformed boolean NOT NULL,
  observation_exact boolean NOT NULL,
  matching_observations integer NOT NULL,
  total_observations integer NOT NULL CHECK(total_observations>0),
  -- True only after independent native runner proof is linked and verified.
  native_authority_verified boolean NOT NULL DEFAULT false,
  evidence_scope varchar(16) NOT NULL DEFAULT 'sandbox' CHECK(evidence_scope='sandbox'),
  student_state_authoritative boolean NOT NULL DEFAULT false CHECK(student_state_authoritative=false),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_assignment_id, form_id)
);
ALTER TABLE public.specialist_sandbox_live_evidence_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_live_evidence_turns FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_sandbox_live_evidence_qualification
  ON public.specialist_sandbox_live_evidence_turns(tutor_assignment_id,tutor_id,completed_at);
CREATE TABLE IF NOT EXISTS private.specialist_sandbox_live_evidence_truth (
  event_id varchar PRIMARY KEY REFERENCES public.specialist_sandbox_live_evidence_turns(id) ON DELETE CASCADE,
  outcome_ref varchar NOT NULL,
  outcome_key varchar NOT NULL,
  outcome_version integer NOT NULL CHECK(outcome_version>0),
  canonical_observations jsonb NOT NULL,
  trajectory_class varchar NOT NULL,
  actual_support_event varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.specialist_sandbox_live_evidence_truth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_live_evidence_truth FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.specialist_sandbox_live_evidence_turns IS
  'Server-owned, non-authoritative historical simulated evidence only; no future canonical answers, not native-mode completion authority.';
COMMENT ON TABLE private.specialist_sandbox_live_evidence_truth IS
  'Completed Diagnosis/Handover simulated outcome truth, private and TD-projectable only after Pod authorization.';
-- Explicit Specialist session preparation, subsequently validated against
-- independently recorded first-rep behavior. Attestation alone never qualifies.
CREATE TABLE IF NOT EXISTS public.specialist_sandbox_preparation_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trajectory_id varchar NOT NULL REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE CASCADE,
  student_id varchar NOT NULL,
  session_number integer NOT NULL CHECK (session_number > 0),
  topic_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  phase varchar NOT NULL,
  set_id varchar NOT NULL,
  event_form_id varchar NOT NULL,
  condition_contract_sha256 varchar(64) NOT NULL CHECK (length(condition_contract_sha256) = 64),
  problem_prepared boolean NOT NULL CHECK (problem_prepared = true),
  conditions_reviewed boolean NOT NULL CHECK (conditions_reviewed = true),
  evidence_plan_reviewed boolean NOT NULL CHECK (evidence_plan_reviewed = true),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trajectory_id, session_number, topic_key)
);
ALTER TABLE public.specialist_sandbox_preparation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_preparation_events FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_sandbox_preparation_qualification
  ON public.specialist_sandbox_preparation_events(tutor_assignment_id,tutor_id,recorded_at);
COMMENT ON TABLE public.specialist_sandbox_preparation_events IS
 'Protected Specialist pre-session plan. Earns qualification only with a later matching, clean, canonical first rep; never by checkbox alone.';
COMMIT;
