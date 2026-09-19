-- Server-only resumable state for evidence-complete Response Integrity diagnosis.
-- Direct browser access is intentionally denied. The authenticated server writes through service_role.
--
-- This migration mirrors the schema verified on the Response Integrity Capability Proof project.

CREATE TABLE IF NOT EXISTS public.response_integrity_diagnosis_runs (
  id uuid PRIMARY KEY,
  student_id varchar(64) NOT NULL,
  tutor_id varchar(64) NOT NULL,
  topic text NOT NULL CHECK (length(btrim(topic)) BETWEEN 1 AND 200),
  starting_phase varchar(40) NOT NULL CHECK (
    starting_phase IN (
      'Clarity',
      'Structured Execution',
      'Controlled Discomfort',
      'Time Pressure Stability'
    )
  ),
  scheduled_session_id varchar(64),
  session_context varchar(32) NOT NULL CHECK (
    session_context IN ('intro', 'active_training')
  ),
  status varchar(24) NOT NULL CHECK (
    status IN ('in_progress', 'blocked', 'completed')
  ),
  probe_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_drill_id varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ri_diagnosis_runs_student_topic
  ON public.response_integrity_diagnosis_runs (student_id, topic, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ri_diagnosis_runs_tutor_status
  ON public.response_integrity_diagnosis_runs (tutor_id, status, updated_at DESC);

ALTER TABLE public.response_integrity_diagnosis_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.response_integrity_diagnosis_runs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.response_integrity_diagnosis_runs TO service_role;

COMMENT ON TABLE public.response_integrity_diagnosis_runs IS
  'Server-only resumable state for evidence-complete Response Integrity diagnosis. No direct client access.';
