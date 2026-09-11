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
  critical_boundary_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
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

CREATE TABLE IF NOT EXISTS specialist_capability_oral_defenses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  defense_version integer NOT NULL CHECK (defense_version > 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  reviewer_id varchar NOT NULL REFERENCES users(id),
  reviewer_role varchar NOT NULL,
  brief_snapshot jsonb NOT NULL,
  probes jsonb NOT NULL,
  clear_count integer NOT NULL CHECK (clear_count >= 0),
  partial_count integer NOT NULL CHECK (partial_count >= 0),
  fail_count integer NOT NULL CHECK (fail_count >= 0),
  integrity_concern_count integer NOT NULL CHECK (integrity_concern_count >= 0),
  outcome varchar NOT NULL CHECK (outcome IN ('approved', 'repeat_required', 'integrity_review')),
  feedback text,
  sandbox_scenario_confirmed boolean NOT NULL CHECK (sandbox_scenario_confirmed = true),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_assignment_id, defense_version, attempt_number)
);

ALTER TABLE specialist_capability_oral_defenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE specialist_capability_oral_defenses FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_capability_oral_defense_tutor
  ON specialist_capability_oral_defenses (tutor_assignment_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_oral_defense_outcome
  ON specialist_capability_oral_defenses (outcome, completed_at DESC);

COMMENT ON TABLE private.specialist_capability_assessment_configs IS
  'Private live capability assessment configuration. Production answer content must not be sourced from the public repository.';

COMMENT ON TABLE private.specialist_capability_assessment_items IS
  'Private live capability assessment item bank, including scoring keys and critical-boundary lineage. Not exposed through the Supabase Data API.';

COMMENT ON TABLE specialist_capability_assessment_attempts IS
  'Immutable submitted Specialist capability evidence including exact bank version and deterministic form identity. Direct client table access is denied.';

COMMENT ON TABLE specialist_capability_practical_evidence IS
  'Immutable Specialist practical evidence references with frozen competency lineage. Recordings must use sandbox scenarios and may not contain real student data.';

COMMENT ON TABLE specialist_capability_practical_reviews IS
  'Immutable human review decisions for Specialist practical capability evidence.';

COMMENT ON TABLE specialist_capability_oral_defenses IS
  'Immutable targeted human oral-defense evidence. Outcomes are derived from 3-5 recorded sandbox probes and never mutate existing Battle Test or Sandbox progression.';