-- Stage-scoped practical evidence, adapted from the unmerged Capability Engine Sprint 14.
-- No live identity may graduate through this migration alone.

CREATE TABLE IF NOT EXISTS specialist_capability_practical_evidence (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proof_key varchar NOT NULL CHECK (proof_key IN ('prepare', 'execute', 'evidence')),
  proof_version integer NOT NULL CHECK (proof_version > 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  artifact_url text NOT NULL,
  artifact_type varchar NOT NULL CHECK (artifact_type IN ('screen_voice', 'screen_video', 'video')),
  declaration jsonb NOT NULL,
  competency_links jsonb NOT NULL,
  no_real_student_data_confirmed boolean NOT NULL CHECK (no_real_student_data_confirmed = true),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_assignment_id, proof_key, proof_version, attempt_number)
);

ALTER TABLE specialist_capability_practical_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE specialist_capability_practical_evidence FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS specialist_capability_practical_reviews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  evidence_id varchar NOT NULL UNIQUE REFERENCES specialist_capability_practical_evidence(id) ON DELETE CASCADE,
  reviewer_id varchar NOT NULL REFERENCES users(id),
  reviewer_role varchar NOT NULL,
  outcome varchar NOT NULL CHECK (outcome IN ('approved', 'repeat_required', 'integrity_review')),
  reason_code varchar,
  feedback text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE specialist_capability_practical_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE specialist_capability_practical_reviews FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_capability_practical_tutor
  ON specialist_capability_practical_evidence (tutor_assignment_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_practical_reviewed_at
  ON specialist_capability_practical_reviews (reviewed_at DESC);


ALTER TABLE public.specialist_capability_practical_evidence ADD COLUMN IF NOT EXISTS rubric_version integer;
ALTER TABLE public.specialist_capability_practical_evidence ADD COLUMN IF NOT EXISTS rubric_snapshot jsonb;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS rubric_version integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS outcome_rule_version integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS criterion_judgments jsonb;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS clear_count integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS partial_count integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS fail_count integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS critical_fail_count integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS critical_fail_criterion_keys jsonb;

-- Legacy Sandbox exit approval table is required by the current TD endpoint, not as an automatic Trial transition.
CREATE TABLE IF NOT EXISTS public.tutor_sandbox_mock_assessments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_id varchar NOT NULL REFERENCES public.users(id),
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id),
  decision varchar(32) NOT NULL CHECK (decision IN ('passed', 'remediation_required')),
  checklist jsonb NOT NULL,
  evidence_note text NOT NULL CHECK (length(trim(evidence_note)) > 0),
  assessed_by_user_id varchar NOT NULL REFERENCES public.users(id),
  assessed_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tutor_sandbox_mock_assignment ON public.tutor_sandbox_mock_assessments(tutor_assignment_id, assessed_at DESC);
ALTER TABLE public.tutor_sandbox_mock_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tutor_sandbox_mock_assessments FROM PUBLIC, anon, authenticated;

-- Declarative completion evidence; not Trial permission. TD approval is deliberately not automatic.
CREATE TABLE IF NOT EXISTS public.specialist_practical_completion_decisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id),
  tutor_id varchar NOT NULL REFERENCES public.users(id),
  td_user_id varchar NOT NULL REFERENCES public.users(id),
  decision varchar NOT NULL CHECK(decision IN ('approved', 'remediation_required')),
  proof_evidence_ids jsonb NOT NULL,
  evidence_note text NOT NULL CHECK(length(trim(evidence_note)) >= 30),
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.specialist_practical_completion_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_practical_completion_decisions FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_practical_decisions_assignment ON public.specialist_practical_completion_decisions (tutor_assignment_id,decided_at DESC);
