-- Keep the scheduled Sandbox Training booking distinct from the entry-diagnosis
-- activity performed inside it. This value is a compatibility discriminator;
-- generated semantic columns expose the two independent facts to consumers.

ALTER TABLE public.response_integrity_diagnosis_runs
  DROP CONSTRAINT IF EXISTS response_integrity_diagnosis_runs_session_context_check;

ALTER TABLE public.response_integrity_diagnosis_runs
  ADD CONSTRAINT response_integrity_diagnosis_runs_session_context_check
  CHECK (session_context IN (
    'intro',
    'active_training',
    'handover_verification',
    'sandbox_entry_diagnosis'
  ));

ALTER TABLE public.response_integrity_diagnosis_runs
  DROP COLUMN IF EXISTS session_container,
  DROP COLUMN IF EXISTS activity_kind;

ALTER TABLE public.response_integrity_diagnosis_runs
  ADD COLUMN session_container varchar(40)
  GENERATED ALWAYS AS (
    CASE session_context
      WHEN 'intro' THEN 'intro_session'
      WHEN 'active_training' THEN 'scheduled_training_session'
      WHEN 'handover_verification' THEN 'handover_session'
      WHEN 'sandbox_entry_diagnosis' THEN 'scheduled_training_session'
      ELSE NULL
    END
  ) STORED,
  ADD COLUMN activity_kind varchar(40)
  GENERATED ALWAYS AS (
    CASE session_context
      WHEN 'intro' THEN 'intro_diagnosis'
      WHEN 'active_training' THEN 'targeted_rediagnosis'
      WHEN 'handover_verification' THEN 'targeted_rediagnosis'
      WHEN 'sandbox_entry_diagnosis' THEN 'intro_diagnosis'
      ELSE NULL
    END
  ) STORED;

ALTER TABLE public.response_integrity_evidence_ledger
  DROP CONSTRAINT IF EXISTS response_integrity_evidence_ledger_session_context_check;

ALTER TABLE public.response_integrity_evidence_ledger
  ADD CONSTRAINT response_integrity_evidence_ledger_session_context_check
  CHECK (session_context IN (
    'intro',
    'active_training',
    'handover_verification',
    'sandbox_entry_diagnosis'
  ));

ALTER TABLE public.response_integrity_evidence_ledger
  DROP COLUMN IF EXISTS session_container,
  DROP COLUMN IF EXISTS activity_kind;

ALTER TABLE public.response_integrity_evidence_ledger
  ADD COLUMN session_container varchar(40)
  GENERATED ALWAYS AS (
    CASE session_context
      WHEN 'intro' THEN 'intro_session'
      WHEN 'active_training' THEN 'scheduled_training_session'
      WHEN 'handover_verification' THEN 'handover_session'
      WHEN 'sandbox_entry_diagnosis' THEN 'scheduled_training_session'
      ELSE NULL
    END
  ) STORED,
  ADD COLUMN activity_kind varchar(40)
  GENERATED ALWAYS AS (
    CASE
      WHEN drill_type = 'training' THEN 'training'
      WHEN drill_type = 'verification' THEN 'handover_verification'
      WHEN drill_type = 'diagnosis' AND session_context IN ('intro', 'sandbox_entry_diagnosis')
        THEN 'intro_diagnosis'
      WHEN drill_type = 'diagnosis' AND session_context IN ('active_training', 'handover_verification')
        THEN 'targeted_rediagnosis'
      ELSE NULL
    END
  ) STORED;

COMMENT ON COLUMN public.response_integrity_diagnosis_runs.session_context IS
  'Legacy lineage discriminator. sandbox_entry_diagnosis means a scheduled Training container hosting an intro-diagnosis activity.';

COMMENT ON COLUMN public.response_integrity_diagnosis_runs.session_container IS
  'Session container used by the diagnosis: intro_session, scheduled_training_session, or handover_session.';

COMMENT ON COLUMN public.response_integrity_diagnosis_runs.activity_kind IS
  'Activity actually performed: intro_diagnosis or targeted_rediagnosis.';

COMMENT ON COLUMN public.response_integrity_evidence_ledger.session_context IS
  'Legacy compatibility lineage only. Use session_container + activity_kind for independent semantic axes.';

COMMENT ON COLUMN public.response_integrity_evidence_ledger.session_container IS
  'Session container for the evidence row: intro_session, scheduled_training_session, or handover_session.';

COMMENT ON COLUMN public.response_integrity_evidence_ledger.activity_kind IS
  'Activity represented by the evidence row: intro_diagnosis, training, targeted_rediagnosis, or handover_verification.';
