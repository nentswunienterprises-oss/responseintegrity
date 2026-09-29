-- Capability Checks are interactive learning loops:
-- each answer is committed before feedback is revealed, and end-of-check
-- experience feedback is stored independently of capability evidence.

ALTER TABLE public.specialist_capability_assessment_attempts
  ADD COLUMN IF NOT EXISTS experience_rating integer,
  ADD COLUMN IF NOT EXISTS experience_feedback text,
  ADD COLUMN IF NOT EXISTS experience_feedback_submitted_at timestamptz;

ALTER TABLE public.specialist_capability_assessment_attempts
  ADD CONSTRAINT specialist_capability_attempts_experience_rating_check
  CHECK (experience_rating IS NULL OR experience_rating BETWEEN 1 AND 5);

CREATE TABLE IF NOT EXISTS public.specialist_capability_question_confirmations (
  id varchar PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tutor_assignment_id varchar NOT NULL
    REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  assessment_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  form_id varchar NOT NULL,
  question_key varchar NOT NULL,
  selected_option_keys jsonb NOT NULL,
  correct boolean NOT NULL,
  critical_fail boolean NOT NULL DEFAULT false,
  feedback text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT specialist_capability_question_confirmation_unique
    UNIQUE (
      tutor_assignment_id,
      assessment_key,
      bank_version,
      attempt_number,
      form_id,
      question_key
    )
);

CREATE INDEX IF NOT EXISTS idx_capability_question_confirmations_attempt
  ON public.specialist_capability_question_confirmations (
    tutor_assignment_id,
    assessment_key,
    bank_version,
    attempt_number,
    form_id
  );

ALTER TABLE public.specialist_capability_question_confirmations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE private.specialist_capability_assessment_items
  ADD COLUMN IF NOT EXISTS option_feedback jsonb NOT NULL DEFAULT '{}'::jsonb;
