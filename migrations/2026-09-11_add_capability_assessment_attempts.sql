CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.specialist_capability_assessment_configs (
  assessment_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  title varchar NOT NULL,
  assessment_deep_dive_key varchar NOT NULL,
  evidence_kind varchar NOT NULL CHECK (evidence_kind IN ('mastery', 'retrieval', 'transfer')),
  pass_threshold_percent numeric(5,2) NOT NULL CHECK (pass_threshold_percent > 0 AND pass_threshold_percent <= 100),
  form_size integer NOT NULL CHECK (form_size > 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  retry_cooldown_hours numeric(6,2) NOT NULL DEFAULT 0 CHECK (retry_cooldown_hours >= 0),
  competency_blueprint jsonb NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  PRIMARY KEY (assessment_key, bank_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_config_one_active_version
  ON private.specialist_capability_assessment_configs (assessment_key)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS private.specialist_capability_assessment_items (
  assessment_key varchar NOT NULL,
  bank_version integer NOT NULL,
  item_key varchar NOT NULL,
  competency_key varchar NOT NULL,
  deep_dive_key varchar NOT NULL,
  prompt text NOT NULL,
  question_kind varchar NOT NULL CHECK (question_kind IN ('single_choice', 'multi_select', 'sequence')),
  options jsonb NOT NULL,
  correct_option_keys jsonb NOT NULL,
  critical_fail_option_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_key, bank_version, item_key),
  FOREIGN KEY (assessment_key, bank_version)
    REFERENCES private.specialist_capability_assessment_configs (assessment_key, bank_version)
    ON DELETE RESTRICT
);

REVOKE ALL ON TABLE private.specialist_capability_assessment_configs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.specialist_capability_assessment_items FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS specialist_capability_assessment_attempts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_key varchar NOT NULL,
  bank_version integer NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  form_id varchar NOT NULL,
  form_item_keys jsonb NOT NULL,
  assessment_deep_dive_key varchar NOT NULL,
  evidence_kind varchar NOT NULL CHECK (evidence_kind IN ('mastery', 'retrieval', 'transfer')),
  covered_deep_dive_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  pass_threshold_percent numeric(5,2) NOT NULL,
  total_questions integer NOT NULL,
  correct_questions integer NOT NULL,
  percent numeric(5,2) NOT NULL,
  has_critical_fail boolean NOT NULL DEFAULT false,
  critical_fail_question_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  passed boolean NOT NULL DEFAULT false,
  responses jsonb NOT NULL,
  question_results jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_assignment_id, assessment_key, attempt_number)
);

ALTER TABLE specialist_capability_assessment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE specialist_capability_assessment_attempts FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_capability_attempts_tutor_assignment
  ON specialist_capability_assessment_attempts (tutor_assignment_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_attempts_tutor_evidence_kind
  ON specialist_capability_assessment_attempts (tutor_id, evidence_kind, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_attempts_assessment
  ON specialist_capability_assessment_attempts (assessment_key, completed_at DESC);

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
  no_real_student_data_confirmed boolean NOT NULL CHECK (no_real_student_data_confirmed = true),
  status varchar NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'repeat_required', 'integrity_review')),
  reviewer_id varchar REFERENCES users(id),
  reviewer_role varchar,
  review_reason_code varchar,
  reviewer_feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_assignment_id, proof_key, proof_version, attempt_number)
);

ALTER TABLE specialist_capability_practical_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE specialist_capability_practical_evidence FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_capability_practical_tutor
  ON specialist_capability_practical_evidence (tutor_assignment_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_practical_review_queue
  ON specialist_capability_practical_evidence (status, submitted_at ASC);

COMMENT ON TABLE private.specialist_capability_assessment_configs IS
  'Private live capability assessment configuration. Production answer content must not be sourced from the public repository.';

COMMENT ON TABLE private.specialist_capability_assessment_items IS
  'Private live capability assessment item bank, including scoring keys. Not exposed through the Supabase Data API.';

COMMENT ON TABLE specialist_capability_assessment_attempts IS
  'Immutable submitted Specialist capability evidence including exact bank version and deterministic form identity. Direct client table access is denied.';

COMMENT ON TABLE specialist_capability_practical_evidence IS
  'Immutable Specialist practical evidence references and human review outcomes. Practical recordings must use sandbox scenarios and may not contain real student data.';
