-- Sandbox V2: stateful RI practice environment.
-- Canonical student truth and Outcome Matrix content remain private.
-- Public tables store only Specialist-visible or Specialist-readiness evidence.

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_outcome_banks (
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL,
  title varchar NOT NULL,
  active boolean NOT NULL DEFAULT false,
  target_outcomes_per_rep integer NOT NULL DEFAULT 8 CHECK (target_outcomes_per_rep BETWEEN 1 AND 20),
  minimum_outcomes_per_rep integer NOT NULL DEFAULT 6 CHECK (minimum_outcomes_per_rep BETWEEN 1 AND 20),
  maximum_outcomes_per_rep integer NOT NULL DEFAULT 10 CHECK (maximum_outcomes_per_rep BETWEEN 1 AND 30),
  readiness_policy jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bank_key, bank_version),
  CHECK (minimum_outcomes_per_rep <= target_outcomes_per_rep),
  CHECK (target_outcomes_per_rep <= maximum_outcomes_per_rep)
);

CREATE UNIQUE INDEX IF NOT EXISTS specialist_sandbox_outcome_banks_one_active
  ON private.specialist_sandbox_outcome_banks (bank_key)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_rep_outcomes (
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL,
  phase varchar NOT NULL,
  set_id varchar NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number > 0),
  outcome_key varchar NOT NULL,
  outcome_version integer NOT NULL DEFAULT 1 CHECK (outcome_version > 0),
  definition jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    bank_key,
    bank_version,
    phase,
    set_id,
    rep_number,
    outcome_key,
    outcome_version
  ),
  FOREIGN KEY (bank_key, bank_version)
    REFERENCES private.specialist_sandbox_outcome_banks(bank_key, bank_version)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS specialist_sandbox_rep_outcomes_lookup
  ON private.specialist_sandbox_rep_outcomes
  (bank_key, bank_version, phase, set_id, rep_number)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_students (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL,
  tutor_id varchar NOT NULL,
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL,
  status varchar NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),
  operating_mode varchar NOT NULL DEFAULT 'training'
    CHECK (operating_mode IN ('training', 'targeted_rediagnosis')),
  operating_phase varchar NOT NULL,
  operating_stability varchar NOT NULL,
  session_number integer NOT NULL DEFAULT 1 CHECK (session_number > 0),
  sequence_number integer NOT NULL DEFAULT 1 CHECK (sequence_number > 0),
  current_scored_set_index integer NOT NULL DEFAULT 0 CHECK (current_scored_set_index >= 0),
  current_rep_number integer NOT NULL DEFAULT 1 CHECK (current_rep_number > 0),
  student_state_authoritative boolean NOT NULL DEFAULT false
    CHECK (student_state_authoritative = false),
  evidence_scope varchar NOT NULL DEFAULT 'sandbox'
    CHECK (evidence_scope = 'sandbox'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS specialist_sandbox_students_one_active
  ON public.specialist_sandbox_students
  (tutor_assignment_id, tutor_id, bank_key, bank_version)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS specialist_sandbox_students_owner
  ON public.specialist_sandbox_students (tutor_assignment_id, tutor_id, status);

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_student_truth (
  sandbox_student_id varchar PRIMARY KEY
    REFERENCES public.specialist_sandbox_students(id) ON DELETE CASCADE,
  canonical_phase varchar NOT NULL,
  canonical_stability varchar NOT NULL,
  trajectory_seed varchar NOT NULL,
  previous_trajectory_class varchar,
  continuity_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  recent_outcome_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  prior_tracks_diverged boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_turns (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sandbox_student_id varchar NOT NULL
    REFERENCES public.specialist_sandbox_students(id) ON DELETE CASCADE,
  tutor_assignment_id varchar NOT NULL,
  tutor_id varchar NOT NULL,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  session_number integer NOT NULL CHECK (session_number > 0),
  phase varchar NOT NULL,
  set_id varchar NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number > 0),
  turn_form_id varchar NOT NULL,
  student_behavior text NOT NULL,
  status varchar NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed')),
  specialist_observations jsonb,
  recorded_intervention_event varchar,
  specialist_prerequisite_sentinel varchar,
  specialist_inherited_rescue_signal varchar,
  condition_conformed boolean,
  total_observations integer,
  matching_observations integer,
  matching_evidence_statuses integer,
  observation_exact boolean,
  evidence_exact boolean,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sandbox_student_id, sequence_number),
  UNIQUE (turn_form_id)
);

CREATE INDEX IF NOT EXISTS specialist_sandbox_turns_student_session
  ON public.specialist_sandbox_turns
  (sandbox_student_id, session_number, sequence_number);

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_turn_truth (
  sandbox_turn_id varchar PRIMARY KEY
    REFERENCES public.specialist_sandbox_turns(id) ON DELETE CASCADE,
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL,
  outcome_key varchar NOT NULL,
  outcome_version integer NOT NULL,
  canonical_observations jsonb NOT NULL,
  canonical_prerequisite_sentinel varchar,
  canonical_inherited_rescue_signal varchar,
  trajectory_class varchar NOT NULL,
  actual_intervention_event varchar NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_sessions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sandbox_student_id varchar NOT NULL
    REFERENCES public.specialist_sandbox_students(id) ON DELETE CASCADE,
  tutor_assignment_id varchar NOT NULL,
  tutor_id varchar NOT NULL,
  session_number integer NOT NULL CHECK (session_number > 0),
  phase varchar NOT NULL,
  specialist_previous_stability varchar NOT NULL,
  specialist_route varchar NOT NULL,
  specialist_next_phase varchar NOT NULL,
  specialist_next_stability varchar NOT NULL,
  specialist_target_phase varchar,
  system_outcome_matched boolean NOT NULL,
  canonical_state_changed boolean NOT NULL DEFAULT false,
  student_breakdown_recovery_observed boolean NOT NULL DEFAULT false,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sandbox_student_id, session_number)
);

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_session_truth (
  sandbox_session_id varchar PRIMARY KEY
    REFERENCES public.specialist_sandbox_sessions(id) ON DELETE CASCADE,
  canonical_previous_stability varchar NOT NULL,
  canonical_route varchar NOT NULL,
  canonical_next_phase varchar NOT NULL,
  canonical_next_stability varchar NOT NULL,
  canonical_target_phase varchar,
  canonical_result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_capability_evidence (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sandbox_student_id varchar NOT NULL
    REFERENCES public.specialist_sandbox_students(id) ON DELETE CASCADE,
  tutor_assignment_id varchar NOT NULL,
  tutor_id varchar NOT NULL,
  layer varchar NOT NULL CHECK (
    layer IN (
      'condition_integrity',
      'observation_integrity',
      'evidence_integrity',
      'authority_integrity',
      'continuity_integrity'
    )
  ),
  evidence_class varchar NOT NULL CHECK (
    evidence_class IN (
      'breakdown',
      'conditional',
      'near_stable',
      'supported',
      'not_observed',
      'confounded'
    )
  ),
  source_type varchar NOT NULL CHECK (source_type IN ('turn', 'session')),
  source_id varchar NOT NULL,
  sequence_number integer NOT NULL,
  session_number integer NOT NULL,
  phase varchar NOT NULL,
  set_id varchar NOT NULL,
  rep_number integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, layer)
);

CREATE INDEX IF NOT EXISTS specialist_sandbox_capability_evidence_owner
  ON public.specialist_sandbox_capability_evidence
  (sandbox_student_id, layer, sequence_number);

ALTER TABLE public.specialist_sandbox_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialist_sandbox_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialist_sandbox_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialist_sandbox_capability_evidence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.specialist_sandbox_students FROM anon, authenticated;
REVOKE ALL ON public.specialist_sandbox_turns FROM anon, authenticated;
REVOKE ALL ON public.specialist_sandbox_sessions FROM anon, authenticated;
REVOKE ALL ON public.specialist_sandbox_capability_evidence FROM anon, authenticated;

COMMENT ON TABLE private.specialist_sandbox_rep_outcomes IS
'Private phase/set/rep Outcome Matrix. Canonical answer truth must never be projected to the Specialist client.';

COMMENT ON TABLE public.specialist_sandbox_students IS
'Specialist-visible operating track for a persistent simulated Sandbox student. Never authoritative to real student state.';

COMMENT ON TABLE private.specialist_sandbox_student_truth IS
'Hidden canonical simulated-student trajectory state kept separate from the Specialist-derived operating track.';

COMMENT ON TABLE public.specialist_sandbox_capability_evidence IS
'Evidence-native Specialist Sandbox capability occurrences used to resolve the earliest unsupported operator capability.';
