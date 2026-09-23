-- Response Integrity individualized TPS timer authority.
-- No calibration tables exist in this design. Baseline evidence comes only from
-- canonical Structured Execution Independent Execution or evidence-native Diagnosis.

CREATE TABLE IF NOT EXISTS public.response_integrity_tps_timer_contracts (
  contract_id text PRIMARY KEY,
  contract_version integer NOT NULL CHECK (contract_version > 0),
  student_id varchar(64) NOT NULL,
  topic text NOT NULL,
  topic_key text NOT NULL,
  baseline_source varchar(48) NOT NULL CHECK (
    baseline_source IN ('training_independent_execution', 'diagnosis_independent_baseline')
  ),
  baseline_source_epoch_key text NOT NULL,
  baseline_group_id text NOT NULL,
  baseline_record_ids jsonb NOT NULL,
  baseline_elapsed_ms jsonb NOT NULL,
  baseline_seconds integer NOT NULL CHECK (baseline_seconds > 0),
  structure_under_timer_seconds integer NOT NULL CHECK (structure_under_timer_seconds > 0),
  repeated_timed_execution_seconds integer NOT NULL CHECK (repeated_timed_execution_seconds > 0),
  full_constraint_seconds integer NOT NULL CHECK (full_constraint_seconds > 0),
  created_by_tutor_id varchar(64) NOT NULL,
  supersedes_contract_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    student_id,
    topic_key,
    baseline_source_epoch_key,
    baseline_group_id,
    contract_version
  )
);

CREATE INDEX IF NOT EXISTS idx_ri_tps_contract_student_topic_time
  ON public.response_integrity_tps_timer_contracts
    (student_id, topic_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ri_tps_contract_epoch
  ON public.response_integrity_tps_timer_contracts
    (student_id, topic_key, baseline_source_epoch_key, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_response_integrity_tps_contract_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Response Integrity TPS Timer Contracts are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_response_integrity_tps_contract_immutable
  ON public.response_integrity_tps_timer_contracts;

CREATE TRIGGER trg_response_integrity_tps_contract_immutable
BEFORE UPDATE ON public.response_integrity_tps_timer_contracts
FOR EACH ROW EXECUTE FUNCTION public.prevent_response_integrity_tps_contract_update();

ALTER TABLE public.response_integrity_tps_timer_contracts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.response_integrity_tps_timer_contracts FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.response_integrity_tps_timer_contracts TO service_role;

COMMENT ON TABLE public.response_integrity_tps_timer_contracts IS
  'Immutable individualized TPS timer authority derived only from legitimate RI Training or Diagnosis evidence. No pre-TPS calibration source is permitted.';

ALTER TABLE public.response_integrity_diagnosis_runs
  ADD COLUMN IF NOT EXISTS timing_policy_version integer,
  ADD COLUMN IF NOT EXISTS timing_authority_contract_id text,
  ADD COLUMN IF NOT EXISTS timing_authority_baseline_seconds integer;

ALTER TABLE public.response_integrity_diagnosis_runs
  DROP CONSTRAINT IF EXISTS response_integrity_diagnosis_runs_timing_policy_version_check,
  DROP CONSTRAINT IF EXISTS response_integrity_diagnosis_runs_timing_baseline_check;

ALTER TABLE public.response_integrity_diagnosis_runs
  ADD CONSTRAINT response_integrity_diagnosis_runs_timing_policy_version_check
    CHECK (timing_policy_version IS NULL OR timing_policy_version = 1),
  ADD CONSTRAINT response_integrity_diagnosis_runs_timing_baseline_check
    CHECK (
      timing_authority_baseline_seconds IS NULL
      OR timing_authority_baseline_seconds > 0
    );

COMMENT ON COLUMN public.response_integrity_diagnosis_runs.timing_policy_version IS
  'NULL identifies historical diagnosis runs created before individualized TPS timing authority. Version 1 uses the evidence-native three-sample baseline contract.';
COMMENT ON COLUMN public.response_integrity_diagnosis_runs.timing_authority_contract_id IS
  'Immutable Timer Contract bound to this diagnosis run when existing or created during the run.';
COMMENT ON COLUMN public.response_integrity_diagnosis_runs.timing_authority_baseline_seconds IS
  'Bound individualized baseline seconds copied from the Timer Contract so replay does not drift if later topic contracts supersede it.';

-- Recovery/rollback (manual and only before runtime consumers are activated):
-- ALTER TABLE public.response_integrity_diagnosis_runs
--   DROP COLUMN IF EXISTS timing_authority_baseline_seconds,
--   DROP COLUMN IF EXISTS timing_authority_contract_id,
--   DROP COLUMN IF EXISTS timing_policy_version;
-- DROP TRIGGER IF EXISTS trg_response_integrity_tps_contract_immutable
--   ON public.response_integrity_tps_timer_contracts;
-- DROP FUNCTION IF EXISTS public.prevent_response_integrity_tps_contract_update();
-- DROP TABLE IF EXISTS public.response_integrity_tps_timer_contracts;
