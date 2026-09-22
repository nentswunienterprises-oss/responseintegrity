-- Allow evidence-complete diagnosis runs to carry explicit Handover lineage.
-- Handover targeted re-diagnosis uses the same behavioral evidence engine as Intro
-- and active Training re-diagnosis, but remains auditable as a continuity event.

ALTER TABLE public.response_integrity_diagnosis_runs
  DROP CONSTRAINT IF EXISTS response_integrity_diagnosis_runs_session_context_check;

ALTER TABLE public.response_integrity_diagnosis_runs
  ADD CONSTRAINT response_integrity_diagnosis_runs_session_context_check
  CHECK (session_context IN ('intro', 'active_training', 'handover_verification'));

COMMENT ON COLUMN public.response_integrity_diagnosis_runs.session_context IS
  'Evidence-complete diagnosis lineage: intro, active_training, or handover_verification.';
