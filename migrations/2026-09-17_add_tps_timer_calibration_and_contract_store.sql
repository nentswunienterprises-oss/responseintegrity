-- Dedicated TPS timing infrastructure.
-- Calibration samples and timer contracts are intentionally separate from intro_session_drills so
-- non-scored calibration cannot alter deterministic weekly/monthly report cadence or training state.

CREATE TABLE IF NOT EXISTS public.capability_tps_timer_calibration_samples (
  calibration_sample_id text PRIMARY KEY,
  calibration_batch_id text NOT NULL,
  student_id varchar(64) NOT NULL,
  topic text NOT NULL,
  topic_key text NOT NULL,
  collected_by_tutor_id varchar(64) NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number BETWEEN 1 AND 3),
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  rep_id text NOT NULL,
  actual_support_used varchar(40) NOT NULL CHECK (
    actual_support_used IN (
      'none',
      'response_control_cue',
      'first_step_math_support',
      'beyond_permitted_boundary'
    )
  ),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  elapsed_ms integer NOT NULL CHECK (elapsed_ms > 0),
  timing_validity varchar(40) NOT NULL CHECK (
    timing_validity IN ('valid', 'timing_invalid_technical')
  ),
  structurally_valid boolean NOT NULL DEFAULT false,
  replacement_for_sample_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calibration_batch_id, rep_number, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_tps_calibration_student_topic_time
  ON public.capability_tps_timer_calibration_samples (student_id, topic_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tps_calibration_batch
  ON public.capability_tps_timer_calibration_samples (calibration_batch_id, rep_number, attempt_number);

CREATE TABLE IF NOT EXISTS public.capability_tps_timer_contracts (
  contract_id text PRIMARY KEY,
  contract_version integer NOT NULL CHECK (contract_version > 0),
  student_id varchar(64) NOT NULL,
  topic text NOT NULL,
  topic_key text NOT NULL,
  source varchar(32) NOT NULL CHECK (source IN ('historical_untimed', 'calibration')),
  baseline_seconds integer NOT NULL CHECK (baseline_seconds > 0),
  baseline_sample_ids jsonb NOT NULL,
  baseline_sample_elapsed_ms jsonb NOT NULL,
  structure_under_timer_seconds integer NOT NULL CHECK (structure_under_timer_seconds > 0),
  repeated_timed_execution_seconds integer NOT NULL CHECK (repeated_timed_execution_seconds > 0),
  full_constraint_seconds integer NOT NULL CHECK (full_constraint_seconds > 0),
  calibration_batch_id text,
  created_by_tutor_id varchar(64) NOT NULL,
  supersedes_contract_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tps_contract_student_topic_time
  ON public.capability_tps_timer_contracts (student_id, topic_key, contract_version, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_capability_tps_timer_record_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'TPS timer calibration and contract records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_tps_calibration_samples_immutable
  ON public.capability_tps_timer_calibration_samples;
CREATE TRIGGER trg_tps_calibration_samples_immutable
BEFORE UPDATE ON public.capability_tps_timer_calibration_samples
FOR EACH ROW EXECUTE FUNCTION public.prevent_capability_tps_timer_record_mutation();

DROP TRIGGER IF EXISTS trg_tps_timer_contracts_immutable
  ON public.capability_tps_timer_contracts;
CREATE TRIGGER trg_tps_timer_contracts_immutable
BEFORE UPDATE ON public.capability_tps_timer_contracts
FOR EACH ROW EXECUTE FUNCTION public.prevent_capability_tps_timer_record_mutation();

-- Internal operational evidence. Direct client access is denied; authenticated server routes use
-- the service role after checking current Specialist ownership of the student.
ALTER TABLE public.capability_tps_timer_calibration_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_tps_timer_contracts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.capability_tps_timer_calibration_samples IS
  'Append-only, non-scored TPS calibration attempts. Kept outside drill rows so calibration cannot affect reports or topic progression.';
COMMENT ON TABLE public.capability_tps_timer_contracts IS
  'Append-only snapshots of deterministic student/topic TPS Timer Contract versions.';

-- Recovery/rollback (manual, before runtime consumers are activated):
-- DROP TRIGGER IF EXISTS trg_tps_timer_contracts_immutable ON public.capability_tps_timer_contracts;
-- DROP TRIGGER IF EXISTS trg_tps_calibration_samples_immutable ON public.capability_tps_timer_calibration_samples;
-- DROP FUNCTION IF EXISTS public.prevent_capability_tps_timer_record_mutation();
-- DROP TABLE IF EXISTS public.capability_tps_timer_contracts;
-- DROP TABLE IF EXISTS public.capability_tps_timer_calibration_samples;
