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


CREATE TABLE IF NOT EXISTS public.response_integrity_tps_timed_attempts (
  attempt_id text PRIMARY KEY,
  contract_id text NOT NULL REFERENCES public.response_integrity_tps_timer_contracts(contract_id),
  contract_version integer NOT NULL CHECK (contract_version = 1),
  student_id varchar(64) NOT NULL,
  topic text NOT NULL,
  topic_key text NOT NULL,
  collected_by_tutor_id varchar(64) NOT NULL,
  set_id text NOT NULL CHECK (
    set_id IN (
      'time_pressure.structure_under_timer',
      'time_pressure.repeated_timed_execution',
      'time_pressure.full_constraint'
    )
  ),
  set_name text NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number > 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  pressure_level varchar(32) NOT NULL CHECK (
    pressure_level IN ('light_timer', 'repeated_timer', 'full_constraint')
  ),
  baseline_seconds integer NOT NULL CHECK (baseline_seconds > 0),
  prescribed_seconds integer NOT NULL CHECK (prescribed_seconds > 0),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  elapsed_ms integer NOT NULL CHECK (elapsed_ms >= 0),
  completed_before_expiry boolean NOT NULL,
  timing_validity varchar(40) NOT NULL CHECK (
    timing_validity IN ('valid', 'timing_invalid_technical')
  ),
  end_reason varchar(32) NOT NULL CHECK (
    end_reason IN ('student_finished', 'timer_expired', 'technical_failure')
  ),
  replacement_for_attempt_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, set_id, rep_number, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_ri_tps_attempt_student_topic_time
  ON public.response_integrity_tps_timed_attempts
    (student_id, topic_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ri_tps_attempt_contract_rep
  ON public.response_integrity_tps_timed_attempts
    (contract_id, set_id, rep_number, attempt_number);

DROP TRIGGER IF EXISTS trg_response_integrity_tps_attempt_immutable
  ON public.response_integrity_tps_timed_attempts;

CREATE TRIGGER trg_response_integrity_tps_attempt_immutable
BEFORE UPDATE ON public.response_integrity_tps_timed_attempts
FOR EACH ROW EXECUTE FUNCTION public.prevent_response_integrity_tps_contract_update();

ALTER TABLE public.response_integrity_tps_timed_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.response_integrity_tps_timed_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.response_integrity_tps_timed_attempts TO service_role;

COMMENT ON TABLE public.response_integrity_tps_timed_attempts IS
  'Append-only runner-owned TPS timing lineage. Technical failures remain durable and replacement attempts are linked explicitly.';

CREATE TABLE IF NOT EXISTS public.response_integrity_tps_baseline_attempts (
  attempt_id text PRIMARY KEY,
  student_id varchar(64) NOT NULL,
  topic text NOT NULL,
  topic_key text NOT NULL,
  collected_by_tutor_id varchar(64) NOT NULL,
  source varchar(20) NOT NULL CHECK (source IN ('training', 'diagnosis')),
  source_context_id text NOT NULL,
  source_item_id text NOT NULL,
  slot_number integer NOT NULL CHECK (slot_number > 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  elapsed_ms integer NOT NULL CHECK (elapsed_ms >= 0),
  timing_validity varchar(40) NOT NULL CHECK (
    timing_validity IN ('valid', 'timing_invalid_technical')
  ),
  end_reason varchar(32) NOT NULL CHECK (
    end_reason IN ('student_finished', 'technical_failure')
  ),
  replacement_for_attempt_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    student_id,
    topic_key,
    source,
    source_context_id,
    source_item_id,
    slot_number,
    attempt_number
  )
);

CREATE INDEX IF NOT EXISTS idx_ri_tps_baseline_attempt_student_topic_time
  ON public.response_integrity_tps_baseline_attempts
    (student_id, topic_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ri_tps_baseline_attempt_context_slot
  ON public.response_integrity_tps_baseline_attempts
    (source, source_context_id, source_item_id, slot_number, attempt_number);

DROP TRIGGER IF EXISTS trg_response_integrity_tps_baseline_attempt_immutable
  ON public.response_integrity_tps_baseline_attempts;

CREATE TRIGGER trg_response_integrity_tps_baseline_attempt_immutable
BEFORE UPDATE ON public.response_integrity_tps_baseline_attempts
FOR EACH ROW EXECUTE FUNCTION public.prevent_response_integrity_tps_contract_update();

ALTER TABLE public.response_integrity_tps_baseline_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.response_integrity_tps_baseline_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.response_integrity_tps_baseline_attempts TO service_role;

COMMENT ON TABLE public.response_integrity_tps_baseline_attempts IS
  'Append-only passive baseline measurement lineage for canonical SE Independent Execution and evidence-native Diagnosis. Technical failures remain durable and replacements are linked explicitly; this is not a calibration activity.';

-- Recovery/rollback (manual and only before runtime consumers are activated):
-- ALTER TABLE public.response_integrity_diagnosis_runs
--   DROP COLUMN IF EXISTS timing_authority_baseline_seconds,
--   DROP COLUMN IF EXISTS timing_authority_contract_id,
--   DROP COLUMN IF EXISTS timing_policy_version;
-- DROP TRIGGER IF EXISTS trg_response_integrity_tps_baseline_attempt_immutable
--   ON public.response_integrity_tps_baseline_attempts;
-- DROP TRIGGER IF EXISTS trg_response_integrity_tps_attempt_immutable
--   ON public.response_integrity_tps_timed_attempts;
-- DROP TRIGGER IF EXISTS trg_response_integrity_tps_contract_immutable
--   ON public.response_integrity_tps_timer_contracts;
-- DROP TABLE IF EXISTS public.response_integrity_tps_baseline_attempts;
-- DROP TABLE IF EXISTS public.response_integrity_tps_timed_attempts;
-- DROP TABLE IF EXISTS public.response_integrity_tps_timer_contracts;
-- DROP FUNCTION IF EXISTS public.prevent_response_integrity_tps_contract_update();
