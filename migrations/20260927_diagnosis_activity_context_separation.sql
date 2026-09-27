-- Separate scheduled-session container truth from the activity performed inside it.
-- Legacy session_context remains for compatibility only. New semantic columns are
-- generated from existing immutable lineage so the axes cannot drift apart.

ALTER TABLE public.response_integrity_diagnosis_runs
  ADD COLUMN IF NOT EXISTS session_container varchar(40)
  GENERATED ALWAYS AS (
    CASE session_context
      WHEN 'intro' THEN 'intro_session'
      WHEN 'active_training' THEN 'scheduled_training_session'
      WHEN 'handover_verification' THEN 'handover_session'
      ELSE NULL
    END
  ) STORED;

ALTER TABLE public.response_integrity_diagnosis_runs
  ADD COLUMN IF NOT EXISTS activity_kind varchar(40)
  GENERATED ALWAYS AS (
    CASE session_context
      WHEN 'intro' THEN 'intro_diagnosis'
      WHEN 'active_training' THEN 'targeted_rediagnosis'
      WHEN 'handover_verification' THEN 'targeted_rediagnosis'
      ELSE NULL
    END
  ) STORED;

COMMENT ON COLUMN public.response_integrity_diagnosis_runs.session_context IS
  'Legacy compatibility lineage only. Do not interpret as activity type. Use session_container + activity_kind.';

COMMENT ON COLUMN public.response_integrity_diagnosis_runs.session_container IS
  'Session container used by the diagnosis: intro_session, scheduled_training_session, or handover_session.';

COMMENT ON COLUMN public.response_integrity_diagnosis_runs.activity_kind IS
  'Activity actually performed: intro_diagnosis or targeted_rediagnosis.';

ALTER TABLE public.response_integrity_evidence_ledger
  ADD COLUMN IF NOT EXISTS session_container varchar(40)
  GENERATED ALWAYS AS (
    CASE session_context
      WHEN 'intro' THEN 'intro_session'
      WHEN 'active_training' THEN 'scheduled_training_session'
      WHEN 'handover_verification' THEN 'handover_session'
      ELSE NULL
    END
  ) STORED;

ALTER TABLE public.response_integrity_evidence_ledger
  ADD COLUMN IF NOT EXISTS activity_kind varchar(40)
  GENERATED ALWAYS AS (
    CASE
      WHEN drill_type = 'training' THEN 'training'
      WHEN drill_type = 'verification' THEN 'handover_verification'
      WHEN drill_type = 'diagnosis' AND session_context = 'intro' THEN 'intro_diagnosis'
      WHEN drill_type = 'diagnosis' AND session_context IN ('active_training', 'handover_verification')
        THEN 'targeted_rediagnosis'
      ELSE NULL
    END
  ) STORED;

COMMENT ON COLUMN public.response_integrity_evidence_ledger.session_context IS
  'Legacy compatibility lineage only. Do not interpret as activity type. Use session_container + activity_kind.';

COMMENT ON COLUMN public.response_integrity_evidence_ledger.session_container IS
  'Session container for the evidence row: intro_session, scheduled_training_session, or handover_session.';

COMMENT ON COLUMN public.response_integrity_evidence_ledger.activity_kind IS
  'Activity represented by the evidence row: intro_diagnosis, training, targeted_rediagnosis, or handover_verification.';
