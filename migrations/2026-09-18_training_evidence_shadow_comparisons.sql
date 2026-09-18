-- Immutable score-vs-evidence proof dataset for training shadow validation.
-- Additive only. This table cannot authorize live student-state movement.

CREATE TABLE IF NOT EXISTS public.training_evidence_shadow_comparisons (
  comparison_id text PRIMARY KEY,
  source_drill_id varchar(64) NOT NULL REFERENCES public.intro_session_drills(id) ON DELETE CASCADE,
  evaluator_version integer NOT NULL CHECK (evaluator_version > 0),
  contract_version integer NOT NULL CHECK (contract_version > 0),
  authority varchar(20) NOT NULL CHECK (authority = 'shadow_only'),
  student_id varchar(64) NOT NULL,
  tutor_id varchar(64) NOT NULL,
  topic text NOT NULL,
  scheduled_session_id varchar(64),
  training_session_run_id varchar(64),
  phase varchar(40) NOT NULL CHECK (
    phase IN ('Clarity', 'Structured Execution', 'Controlled Discomfort', 'Time Pressure Stability')
  ),
  previous_stability varchar(20) NOT NULL CHECK (
    previous_stability IN ('Low', 'Medium', 'High', 'High Maintenance')
  ),
  legacy_score integer NOT NULL CHECK (legacy_score >= 0 AND legacy_score <= 100),
  legacy_next_phase varchar(40) NOT NULL CHECK (
    legacy_next_phase IN ('Clarity', 'Structured Execution', 'Controlled Discomfort', 'Time Pressure Stability')
  ),
  legacy_next_stability varchar(20) NOT NULL CHECK (
    legacy_next_stability IN ('Low', 'Medium', 'High', 'High Maintenance')
  ),
  legacy_transition_reason text NOT NULL,
  evidence_available boolean NOT NULL,
  evidence_observed_stability varchar(20) CHECK (
    evidence_observed_stability IS NULL OR evidence_observed_stability IN ('Low', 'Medium', 'High')
  ),
  evidence_next_phase varchar(40) CHECK (
    evidence_next_phase IS NULL OR evidence_next_phase IN (
      'Clarity', 'Structured Execution', 'Controlled Discomfort', 'Time Pressure Stability'
    )
  ),
  evidence_next_stability varchar(20) CHECK (
    evidence_next_stability IS NULL OR evidence_next_stability IN ('Low', 'Medium', 'High', 'High Maintenance')
  ),
  evidence_transition_reason text,
  high_maintenance_entry_qualified boolean,
  exit_qualified boolean,
  ineligible_evidence_count integer CHECK (
    ineligible_evidence_count IS NULL OR ineligible_evidence_count >= 0
  ),
  intervention_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  prerequisite_contradiction_status text,
  diverged boolean,
  comparison_reason text NOT NULL,
  evidence_payload jsonb NOT NULL,
  comparison_payload jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_drill_id, evaluator_version, contract_version)
);

CREATE INDEX IF NOT EXISTS idx_training_evidence_shadow_diverged
  ON public.training_evidence_shadow_comparisons (diverged, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_evidence_shadow_student_topic
  ON public.training_evidence_shadow_comparisons (student_id, topic, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_evidence_shadow_phase_state
  ON public.training_evidence_shadow_comparisons (
    phase,
    previous_stability,
    evidence_observed_stability,
    observed_at DESC
  );

CREATE OR REPLACE FUNCTION public.prevent_training_evidence_shadow_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Training evidence shadow comparison rows are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_training_evidence_shadow_immutable
  ON public.training_evidence_shadow_comparisons;

CREATE TRIGGER trg_training_evidence_shadow_immutable
BEFORE UPDATE ON public.training_evidence_shadow_comparisons
FOR EACH ROW EXECUTE FUNCTION public.prevent_training_evidence_shadow_mutation();

ALTER TABLE public.training_evidence_shadow_comparisons ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.training_evidence_shadow_comparisons IS
  'Immutable proof-only comparison of legacy score transitions and evidence-native shadow transitions. Never authoritative for live topic state.';
