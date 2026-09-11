CREATE TABLE IF NOT EXISTS specialist_capability_assessment_attempts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_key varchar NOT NULL,
  deep_dive_key varchar NOT NULL,
  mastery_threshold_percent numeric(5,2) NOT NULL,
  total_questions integer NOT NULL,
  correct_questions integer NOT NULL,
  percent numeric(5,2) NOT NULL,
  has_critical_fail boolean NOT NULL DEFAULT false,
  critical_fail_question_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  mastered boolean NOT NULL DEFAULT false,
  responses jsonb NOT NULL,
  question_results jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capability_attempts_tutor_assignment
  ON specialist_capability_assessment_attempts (tutor_assignment_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_attempts_tutor_deep_dive
  ON specialist_capability_assessment_attempts (tutor_id, deep_dive_key, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_attempts_assessment
  ON specialist_capability_assessment_attempts (assessment_key, completed_at DESC);

COMMENT ON TABLE specialist_capability_assessment_attempts IS
  'Immutable evidence for deterministic Specialist capability assessments. Sprint 1 does not replace Battle Test certification progression.';
