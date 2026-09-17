-- Dedicated TPS timing infrastructure.
-- Calibration samples, immutable timer contracts, and timed-attempt lineage are intentionally
-- separate from intro_session_drills so non-scored calibration and technical timer failures cannot
-- alter deterministic weekly/monthly report cadence or topic state.

CREATE TABLE IF NOT EXISTS public.capability_tps_timer_calibration_samples (
  calibration_sample_id text PRIMARY KEY,
  calibration_batch_id text NOT NULL,
  conditioning_epoch_key text NOT NULL,
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

ALTER TABLE public.capability_tps_timer_calibration_samples
  ADD COLUMN IF NOT EXISTS conditioning_epoch_key text;
UPDATE public.capability_tps_timer_calibration_samples
SET conditioning_epoch_key = COALESCE(NULLIF(conditioning_epoch_key, ''), 'legacy-epoch')
WHERE conditioning_epoch_key IS NULL OR conditioning_epoch_key = '';
ALTER TABLE public.capability_tps_timer_calibration_samples
  ALTER COLUMN conditioning_epoch_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tps_calibration_student_topic_epoch_time
  ON public.capability_tps_timer_calibration_samples
    (student_id, topic_key, conditioning_epoch_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tps_calibration_batch
  ON public.capability_tps_timer_calibration_samples (calibration_batch_id, rep_number, attempt_number);

CREATE TABLE IF NOT EXISTS public.capability_tps_timer_contracts (
  contract_id text PRIMARY KEY,
  contract_version integer NOT NULL CHECK (contract_version > 0),
  conditioning_epoch_key text NOT NULL,
  student_id varchar(64) NOT NULL,
  topic text NOT NULL,
  topic_key text NOT NULL,
  source varchar(32) NOT NULL CHECK (source IN ('historical_untimed', 'calibration')),
  baseline_source_phase varchar(40) NOT NULL CHECK (
    baseline_source_phase IN ('Structured Execution', 'pre_tps_calibration')
  ),
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

ALTER TABLE public.capability_tps_timer_contracts
  ADD COLUMN IF NOT EXISTS conditioning_epoch_key text;
ALTER TABLE public.capability_tps_timer_contracts
  ADD COLUMN IF NOT EXISTS baseline_source_phase varchar(40);
UPDATE public.capability_tps_timer_contracts
SET conditioning_epoch_key = COALESCE(NULLIF(conditioning_epoch_key, ''), 'legacy-epoch'),
    baseline_source_phase = COALESCE(
      baseline_source_phase,
      CASE WHEN source = 'calibration' THEN 'pre_tps_calibration' ELSE 'Structured Execution' END
    )
WHERE conditioning_epoch_key IS NULL OR conditioning_epoch_key = '' OR baseline_source_phase IS NULL;
ALTER TABLE public.capability_tps_timer_contracts
  ALTER COLUMN conditioning_epoch_key SET NOT NULL;
ALTER TABLE public.capability_tps_timer_contracts
  ALTER COLUMN baseline_source_phase SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tps_contract_student_topic_epoch_time
  ON public.capability_tps_timer_contracts
    (student_id, topic_key, conditioning_epoch_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.capability_tps_timed_attempts (
  attempt_id text PRIMARY KEY,
  contract_id text NOT NULL,
  contract_version integer NOT NULL CHECK (contract_version > 0),
  conditioning_epoch_key text NOT NULL,
  student_id varchar(64) NOT NULL,
  topic text NOT NULL,
  topic_key text NOT NULL,
  collected_by_tutor_id varchar(64) NOT NULL,
  set_id text NOT NULL,
  set_name text NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number > 0),
  pressure_level varchar(32) NOT NULL CHECK (
    pressure_level IN ('light_timer', 'repeated_timer', 'full_constraint')
  ),
  actual_support_used varchar(40) NOT NULL CHECK (
    actual_support_used IN (
      'none',
      'response_control_cue',
      'first_step_math_support',
      'beyond_permitted_boundary'
    )
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
  replacement_for_attempt_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tps_timed_attempt_student_topic_epoch_time
  ON public.capability_tps_timed_attempts
    (student_id, topic_key, conditioning_epoch_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tps_timed_attempt_contract
  ON public.capability_tps_timed_attempts (contract_id, set_id, rep_number, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_capability_tps_timer_record_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'TPS timer operational records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_tps_calibration_samples_immutable
  ON public.capability_tps_timer_calibration_samples;
CREATE TRIGGER trg_tps_calibration_samples_immutable
BEFORE UPDATE OR DELETE ON public.capability_tps_timer_calibration_samples
FOR EACH ROW EXECUTE FUNCTION public.prevent_capability_tps_timer_record_mutation();

DROP TRIGGER IF EXISTS trg_tps_timer_contracts_immutable
  ON public.capability_tps_timer_contracts;
CREATE TRIGGER trg_tps_timer_contracts_immutable
BEFORE UPDATE OR DELETE ON public.capability_tps_timer_contracts
FOR EACH ROW EXECUTE FUNCTION public.prevent_capability_tps_timer_record_mutation();

DROP TRIGGER IF EXISTS trg_tps_timed_attempts_immutable
  ON public.capability_tps_timed_attempts;
CREATE TRIGGER trg_tps_timed_attempts_immutable
BEFORE UPDATE OR DELETE ON public.capability_tps_timed_attempts
FOR EACH ROW EXECUTE FUNCTION public.prevent_capability_tps_timer_record_mutation();

-- Internal operational evidence. Direct client access is denied; authenticated server routes use
-- the service role after checking current Specialist ownership of the student.
ALTER TABLE public.capability_tps_timer_calibration_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_tps_timer_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_tps_timed_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.capability_tps_timer_calibration_samples IS
  'Append-only non-scored pre-TPS calibration attempts. They never count as drill/report/state evidence.';
COMMENT ON TABLE public.capability_tps_timer_contracts IS
  'Append-only immutable student/topic TPS Timer Contract snapshots, scoped to deterministic conditioning epochs.';
COMMENT ON TABLE public.capability_tps_timed_attempts IS
  'Append-only TPS timer attempt lineage, including technical-invalid and contaminated attempts that cannot score.';

-- Recovery/rollback (manual, before runtime consumers are activated):
-- DROP TRIGGER IF EXISTS trg_tps_timed_attempts_immutable ON public.capability_tps_timed_attempts;
-- DROP TRIGGER IF EXISTS trg_tps_timer_contracts_immutable ON public.capability_tps_timer_contracts;
-- DROP TRIGGER IF EXISTS trg_tps_calibration_samples_immutable ON public.capability_tps_timer_calibration_samples;
-- DROP FUNCTION IF EXISTS public.prevent_capability_tps_timer_record_mutation();
-- DROP TABLE IF EXISTS public.capability_tps_timed_attempts;
-- DROP TABLE IF EXISTS public.capability_tps_timer_contracts;
-- DROP TABLE IF EXISTS public.capability_tps_timer_calibration_samples;
