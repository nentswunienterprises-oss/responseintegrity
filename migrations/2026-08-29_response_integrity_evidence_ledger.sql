-- Shadow-mode, claim-ready Response Integrity evidence ledger.
-- Additive only: current drill storage, progression, and reports remain authoritative.

CREATE TABLE IF NOT EXISTS public.response_integrity_evidence_ledger (
  evidence_id text PRIMARY KEY,
  projection_version integer NOT NULL,
  source_drill_id varchar(64) NOT NULL REFERENCES public.intro_session_drills(id) ON DELETE CASCADE,
  student_id varchar(64) NOT NULL,
  tutor_id varchar(64) NOT NULL,
  topic text NOT NULL,
  scheduled_session_id varchar(64),
  training_session_run_id varchar(64),
  session_group_id text NOT NULL,
  session_context varchar(32) NOT NULL CHECK (
    session_context IN ('intro', 'active_training', 'handover_verification')
  ),
  drill_type varchar(20) NOT NULL CHECK (drill_type IN ('diagnosis', 'training', 'verification')),
  drill_schema_id text NOT NULL,
  drill_schema_version integer NOT NULL,
  drill_definition_hash text NOT NULL,
  phase varchar(40) NOT NULL CHECK (
    phase IN ('Clarity', 'Structured Execution', 'Controlled Discomfort', 'Time Pressure Stability')
  ),
  state_phase_before varchar(40) CHECK (
    state_phase_before IS NULL OR state_phase_before IN (
      'Clarity', 'Structured Execution', 'Controlled Discomfort', 'Time Pressure Stability'
    )
  ),
  stability_before varchar(20) CHECK (
    stability_before IS NULL OR stability_before IN ('Low', 'Medium', 'High', 'High Maintenance')
  ),
  state_phase_after varchar(40) CHECK (
    state_phase_after IS NULL OR state_phase_after IN (
      'Clarity', 'Structured Execution', 'Controlled Discomfort', 'Time Pressure Stability'
    )
  ),
  stability_after varchar(20) CHECK (
    stability_after IS NULL OR stability_after IN ('Low', 'Medium', 'High', 'High Maintenance')
  ),
  transition_reason text,
  block_order integer NOT NULL CHECK (block_order > 0),
  set_id text NOT NULL,
  set_order integer NOT NULL CHECK (set_order > 0),
  rep_id text NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number > 0),
  dimension_id text NOT NULL,
  dimension_order integer NOT NULL CHECK (dimension_order > 0),
  field_key text NOT NULL,
  option_id text NOT NULL,
  raw_option text NOT NULL,
  normalized_level varchar(10) NOT NULL CHECK (normalized_level IN ('weak', 'partial', 'clear')),
  score_contribution integer NOT NULL CHECK (score_contribution >= 0),
  score_contribution_max integer NOT NULL CHECK (score_contribution_max > 0),
  constraint_profile jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_drill_id, block_order, set_id, rep_id, dimension_id)
);

CREATE INDEX IF NOT EXISTS idx_ri_evidence_student_topic_time
  ON public.response_integrity_evidence_ledger (student_id, topic, observed_at);

CREATE INDEX IF NOT EXISTS idx_ri_evidence_session_group
  ON public.response_integrity_evidence_ledger (session_group_id);

CREATE INDEX IF NOT EXISTS idx_ri_evidence_scheduled_session
  ON public.response_integrity_evidence_ledger (scheduled_session_id)
  WHERE scheduled_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ri_evidence_training_run
  ON public.response_integrity_evidence_ledger (training_session_run_id)
  WHERE training_session_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ri_evidence_claim_scan
  ON public.response_integrity_evidence_ledger (
    student_id,
    topic,
    phase,
    dimension_id,
    normalized_level,
    observed_at
  );

CREATE INDEX IF NOT EXISTS idx_ri_evidence_source_drill
  ON public.response_integrity_evidence_ledger (source_drill_id);

CREATE OR REPLACE FUNCTION public.prevent_response_integrity_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Response Integrity evidence ledger rows are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_response_integrity_evidence_immutable
  ON public.response_integrity_evidence_ledger;

CREATE TRIGGER trg_response_integrity_evidence_immutable
BEFORE UPDATE ON public.response_integrity_evidence_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_response_integrity_evidence_mutation();

-- Internal shadow infrastructure: direct client access is denied. The server-side service role
-- performs idempotent inserts; progression and report readers do not query this table yet.
-- Deletion is reserved for protected server/data-retention workflows and cascades with its source
-- drill so the ledger cannot prevent an authorized student-data deletion.
-- scheduled_session_id and training_session_run_id are intentionally lineage fields rather than
-- hard foreign keys because historical environments disagree on uuid vs varchar ID types there.
ALTER TABLE public.response_integrity_evidence_ledger ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.response_integrity_evidence_ledger IS
  'Immutable shadow projection of versioned Response Integrity rep observations for future claim authorization.';

-- Recovery/rollback (manual and only before any ledger consumer is activated):
-- DROP TRIGGER IF EXISTS trg_response_integrity_evidence_immutable ON public.response_integrity_evidence_ledger;
-- DROP FUNCTION IF EXISTS public.prevent_response_integrity_evidence_mutation();
-- DROP TABLE IF EXISTS public.response_integrity_evidence_ledger;
