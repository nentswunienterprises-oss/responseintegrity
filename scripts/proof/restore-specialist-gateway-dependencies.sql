-- Proof-only baseline repair for ordinary Specialist gateway/session-feed dependencies.
-- Target project: Nenterprises RI Proof (tzgkiaiwnhmnzznvmbfg).
-- Do not promote this file to production as a migration artifact. The permanent Proof
-- environment still requires a fresh production-parity certification when production
-- schema access is available again.

DO $$
BEGIN
  CREATE TYPE public.enrollment_status AS ENUM (
    'not_enrolled',
    'awaiting_assignment',
    'awaiting_tutor_acceptance',
    'assigned',
    'proposal_sent',
    'session_booked',
    'report_received',
    'confirmed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.parent_enrollments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  parent_id varchar REFERENCES public.users(id),
  user_id varchar,
  parent_full_name varchar NOT NULL DEFAULT 'Proof Parent',
  parent_phone varchar NOT NULL DEFAULT '',
  parent_email varchar NOT NULL DEFAULT '',
  parent_city varchar NOT NULL DEFAULT '',
  student_full_name varchar NOT NULL DEFAULT 'Proof Student',
  student_grade varchar NOT NULL DEFAULT '',
  student_gender varchar,
  school_name varchar NOT NULL DEFAULT '',
  response_symptoms jsonb,
  topic_response_symptoms jsonb,
  response_signal_scores jsonb,
  topic_response_signal_scores jsonb,
  recommended_starting_phase varchar,
  topic_recommended_starting_phases jsonb,
  previous_tutoring varchar NOT NULL DEFAULT '',
  internet_access varchar NOT NULL DEFAULT '',
  parent_motivation text,
  math_struggle_areas text,
  confidence_level text,
  current_step text,
  is_sandbox_account boolean NOT NULL DEFAULT false,
  status public.enrollment_status NOT NULL DEFAULT 'awaiting_assignment',
  assigned_tutor_id varchar REFERENCES public.users(id),
  assigned_student_id varchar REFERENCES public.students(id),
  proposal_id varchar,
  assigned_at timestamptz,
  assignment_lane varchar(16) NOT NULL DEFAULT 'commercial'
    CHECK (assignment_lane IN ('commercial','sandbox','trial')),
  package_key varchar(24) NOT NULL DEFAULT 'monthly_8',
  package_sessions integer NOT NULL DEFAULT 8,
  planned_sessions_per_week integer NOT NULL DEFAULT 2,
  proposal_sent_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parent_enrollments_package_contract_check CHECK (
    (package_key = 'monthly_8' AND package_sessions = 8 AND planned_sessions_per_week = 2)
    OR (package_key = 'monthly_12' AND package_sessions = 12 AND planned_sessions_per_week = 3)
    OR (package_key = 'monthly_16' AND package_sessions = 16 AND planned_sessions_per_week = 4)
  )
);

CREATE INDEX IF NOT EXISTS idx_parent_enrollments_parent_id ON public.parent_enrollments(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_enrollments_user_id ON public.parent_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_parent_enrollments_assigned_tutor_id ON public.parent_enrollments(assigned_tutor_id);
CREATE INDEX IF NOT EXISTS idx_parent_enrollments_status ON public.parent_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_parent_enrollments_updated_at ON public.parent_enrollments(updated_at DESC);

CREATE TABLE IF NOT EXISTS public.scheduled_sessions (
  id varchar(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  parent_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id varchar REFERENCES public.students(id) ON DELETE SET NULL,
  scheduled_time timestamptz NOT NULL,
  scheduled_end timestamptz,
  timezone varchar(64) NOT NULL DEFAULT 'Africa/Johannesburg',
  type varchar(32) NOT NULL,
  status varchar(64) NOT NULL,
  parent_confirmed boolean NOT NULL DEFAULT false,
  tutor_confirmed boolean NOT NULL DEFAULT false,
  workflow_stage varchar(64),
  host_account_id varchar(128),
  google_calendar_id varchar(255),
  google_event_id varchar(255),
  google_meet_url text,
  google_conference_id varchar(255),
  google_meet_space_name varchar(255),
  google_meet_code varchar(32),
  attendance_status varchar(32) NOT NULL DEFAULT 'not_started',
  recording_status varchar(32) NOT NULL DEFAULT 'not_expected_yet',
  recording_file_id varchar(255),
  recording_detected_at timestamptz,
  transcript_status varchar(32) NOT NULL DEFAULT 'not_expected_yet',
  transcript_file_id varchar(255),
  transcript_detected_at timestamptz,
  attendance_report_file_id varchar(255),
  cohost_sync_status varchar(32) NOT NULL DEFAULT 'not_configured',
  cohost_sync_error text,
  last_artifact_sync_at timestamptz,
  last_meet_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_tutor_id ON public.scheduled_sessions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_parent_id ON public.scheduled_sessions(parent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_student_type ON public.scheduled_sessions(student_id, type);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_status ON public.scheduled_sessions(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_scheduled_time ON public.scheduled_sessions(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_google_meet_space_name ON public.scheduled_sessions(google_meet_space_name);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_google_meet_code ON public.scheduled_sessions(google_meet_code);

CREATE TABLE IF NOT EXISTS public.training_session_runs (
  id varchar(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scheduled_session_id varchar(64) NOT NULL REFERENCES public.scheduled_sessions(id) ON DELETE CASCADE,
  student_id varchar NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  status varchar(32) NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_session_runs_scheduled_session_id ON public.training_session_runs(scheduled_session_id);
CREATE INDEX IF NOT EXISTS idx_training_session_runs_tutor_id ON public.training_session_runs(tutor_id);
CREATE INDEX IF NOT EXISTS idx_training_session_runs_student_id ON public.training_session_runs(student_id);

CREATE TABLE IF NOT EXISTS public.intro_session_drills (
  id varchar(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_id varchar NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scheduled_session_id varchar(64) REFERENCES public.scheduled_sessions(id) ON DELETE SET NULL,
  training_session_run_id varchar(64) REFERENCES public.training_session_runs(id) ON DELETE SET NULL,
  drill jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intro_session_drills_student_id ON public.intro_session_drills(student_id);
CREATE INDEX IF NOT EXISTS idx_intro_session_drills_tutor_id ON public.intro_session_drills(tutor_id);
CREATE INDEX IF NOT EXISTS idx_intro_session_drills_scheduled_session_id ON public.intro_session_drills(scheduled_session_id);

-- Keep direct client access fail-closed for the Proof repair. Server-side service-role
-- and direct Postgres paths remain available.
ALTER TABLE public.parent_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_session_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intro_session_drills ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.parent_enrollments FROM anon, authenticated;
REVOKE ALL ON TABLE public.scheduled_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.training_session_runs FROM anon, authenticated;
REVOKE ALL ON TABLE public.intro_session_drills FROM anon, authenticated;
GRANT ALL ON TABLE public.parent_enrollments TO service_role;
GRANT ALL ON TABLE public.scheduled_sessions TO service_role;
GRANT ALL ON TABLE public.training_session_runs TO service_role;
GRANT ALL ON TABLE public.intro_session_drills TO service_role;
