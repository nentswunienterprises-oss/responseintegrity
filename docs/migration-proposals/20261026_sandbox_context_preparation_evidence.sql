-- Sandbox context-specific preparation receipts.
-- A generic preparation checkbox is not sufficient: qualification must know
-- which governed session context was prepared before the opportunity opened.
BEGIN;
CREATE TABLE IF NOT EXISTS public.specialist_sandbox_context_preparation_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trajectory_id varchar NOT NULL REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE CASCADE,
  student_id varchar NOT NULL,
  preparation_context varchar NOT NULL CHECK (preparation_context IN ('training','handover','targeted_rediagnosis','diagnosis:Clarity','diagnosis:Structured Execution','diagnosis:Controlled Discomfort','diagnosis:Time Pressure Stability')),
  source_context_id varchar NOT NULL,
  phase varchar NOT NULL,
  topic_key varchar NOT NULL,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  probe_id varchar,
  plan_fingerprint varchar(64),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_assignment_id, preparation_context, source_context_id, sequence_number)
);
ALTER TABLE public.specialist_sandbox_context_preparation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_context_preparation_events FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_sandbox_context_preparation_qualification
  ON public.specialist_sandbox_context_preparation_events(tutor_assignment_id,tutor_id,recorded_at);
COMMENT ON TABLE public.specialist_sandbox_context_preparation_events IS
  'Protected, server-authored preparation receipt by governed Sandbox session context.';
COMMIT;
