CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_environment_banks (
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  title varchar NOT NULL,
  target_outcomes_per_rep integer NOT NULL DEFAULT 8 CHECK (target_outcomes_per_rep BETWEEN 1 AND 20),
  minimum_outcomes_per_rep integer NOT NULL DEFAULT 6 CHECK (minimum_outcomes_per_rep BETWEEN 1 AND 20),
  maximum_outcomes_per_rep integer NOT NULL DEFAULT 10 CHECK (maximum_outcomes_per_rep BETWEEN 1 AND 30),
  capability_policy jsonb,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  PRIMARY KEY (bank_key, bank_version),
  CHECK (minimum_outcomes_per_rep <= target_outcomes_per_rep),
  CHECK (target_outcomes_per_rep <= maximum_outcomes_per_rep)
);
ALTER TABLE private.specialist_sandbox_environment_banks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_environment_banks FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_environment_bank_one_active
ON private.specialist_sandbox_environment_banks (bank_key) WHERE active = true;

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_rep_outcomes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  public_ref varchar NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  outcome_key varchar NOT NULL,
  outcome_version integer NOT NULL CHECK (outcome_version > 0),
  phase varchar NOT NULL,
  set_id varchar NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number > 0),
  definition jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_key, bank_version, outcome_key),
  FOREIGN KEY (bank_key, bank_version)
    REFERENCES private.specialist_sandbox_environment_banks (bank_key, bank_version)
    ON DELETE RESTRICT
);
ALTER TABLE private.specialist_sandbox_rep_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_rep_outcomes FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_sandbox_rep_outcomes_lookup
ON private.specialist_sandbox_rep_outcomes (bank_key, bank_version, phase, set_id, rep_number)
WHERE active = true;

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_trajectories (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  specialist_phase varchar NOT NULL,
  specialist_stability varchar NOT NULL,
  specialist_route varchar NOT NULL DEFAULT 'normal_training',
  specialist_targeted_rediagnosis_phase varchar,
  session_number integer NOT NULL DEFAULT 1 CHECK (session_number > 0),
  completed_rep_count integer NOT NULL DEFAULT 0 CHECK (completed_rep_count >= 0),
  divergence_active boolean NOT NULL DEFAULT false,
  status varchar NOT NULL DEFAULT 'active' CHECK (status IN ('active','complete','retired')),
  student_state_authoritative boolean NOT NULL DEFAULT false CHECK (student_state_authoritative = false),
  evidence_scope varchar(16) NOT NULL DEFAULT 'sandbox' CHECK (evidence_scope = 'sandbox'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.specialist_sandbox_trajectories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_trajectories FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_one_active_trajectory
ON public.specialist_sandbox_trajectories (tutor_assignment_id, bank_key, bank_version)
WHERE status = 'active';

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_trajectory_truth (
  trajectory_id varchar PRIMARY KEY
    REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE CASCADE,
  canonical_phase varchar NOT NULL,
  canonical_stability varchar NOT NULL,
  canonical_route varchar NOT NULL DEFAULT 'normal_training',
  canonical_targeted_rediagnosis_phase varchar,
  trajectory_seed varchar NOT NULL,
  previous_trajectory_class varchar,
  continuity_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  recent_outcome_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  prior_tracks_diverged boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.specialist_sandbox_trajectory_truth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_trajectory_truth FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_rep_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trajectory_id varchar NOT NULL REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE CASCADE,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_sequence integer NOT NULL CHECK (event_sequence > 0),
  session_number integer NOT NULL CHECK (session_number > 0),
  phase varchar NOT NULL,
  set_id varchar NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number > 0),
  outcome_ref varchar NOT NULL,
  student_behavior text NOT NULL,
  selection_seed_digest varchar NOT NULL,
  specialist_submission jsonb NOT NULL,
  condition_kept boolean,
  total_observations integer NOT NULL DEFAULT 0 CHECK (total_observations >= 0),
  matching_observations integer NOT NULL DEFAULT 0 CHECK (matching_observations >= 0),
  matching_evidence_statuses integer NOT NULL DEFAULT 0 CHECK (matching_evidence_statuses >= 0),
  observation_exact boolean,
  evidence_exact boolean,
  student_state_authoritative boolean NOT NULL DEFAULT false CHECK (student_state_authoritative = false),
  evidence_scope varchar(16) NOT NULL DEFAULT 'sandbox' CHECK (evidence_scope = 'sandbox'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trajectory_id, event_sequence)
);
ALTER TABLE public.specialist_sandbox_rep_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_rep_events FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_sandbox_rep_events_trajectory
ON public.specialist_sandbox_rep_events (trajectory_id, event_sequence);

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_rep_event_truth (
  event_id varchar PRIMARY KEY
    REFERENCES public.specialist_sandbox_rep_events(id) ON DELETE CASCADE,
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL,
  outcome_ref varchar NOT NULL,
  outcome_key varchar NOT NULL,
  outcome_version integer NOT NULL,
  canonical_observations jsonb NOT NULL,
  canonical_prerequisite_sentinel varchar,
  canonical_inherited_rescue_signal varchar,
  trajectory_class varchar NOT NULL,
  actual_intervention_event varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.specialist_sandbox_rep_event_truth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_rep_event_truth FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_session_evaluations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trajectory_id varchar NOT NULL REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE CASCADE,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_number integer NOT NULL CHECK (session_number > 0),
  phase varchar NOT NULL,
  specialist_authority jsonb NOT NULL,
  authority_aligned boolean NOT NULL,
  state_track_aligned boolean NOT NULL,
  canonical_state_changed boolean NOT NULL DEFAULT false,
  student_breakdown_recovery_observed boolean NOT NULL DEFAULT false,
  student_state_authoritative boolean NOT NULL DEFAULT false CHECK (student_state_authoritative = false),
  evidence_scope varchar(16) NOT NULL DEFAULT 'sandbox' CHECK (evidence_scope = 'sandbox'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trajectory_id, session_number)
);
ALTER TABLE public.specialist_sandbox_session_evaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_session_evaluations FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_session_truth (
  session_evaluation_id varchar PRIMARY KEY
    REFERENCES public.specialist_sandbox_session_evaluations(id) ON DELETE CASCADE,
  canonical_authority jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.specialist_sandbox_session_truth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_session_truth FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_capability_evidence (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trajectory_id varchar NOT NULL REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE CASCADE,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  capability_id varchar NOT NULL CHECK (
    capability_id IN (
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
  source_type varchar NOT NULL CHECK (source_type IN ('turn','session')),
  source_id varchar NOT NULL,
  phase varchar NOT NULL,
  set_id varchar NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number > 0),
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  session_number integer NOT NULL CHECK (session_number > 0),
  reason text NOT NULL,
  student_state_authoritative boolean NOT NULL DEFAULT false CHECK (student_state_authoritative = false),
  evidence_scope varchar(16) NOT NULL DEFAULT 'sandbox' CHECK (evidence_scope = 'sandbox'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, capability_id)
);
ALTER TABLE public.specialist_sandbox_capability_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_capability_evidence FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_sandbox_capability_evidence_assignment
ON public.specialist_sandbox_capability_evidence (
  tutor_assignment_id,
  capability_id,
  sequence_number
);


CREATE TABLE IF NOT EXISTS private.specialist_sandbox_diagnosis_outcomes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  public_ref varchar NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  probe_id varchar NOT NULL,
  outcome_key varchar NOT NULL,
  outcome_version integer NOT NULL CHECK (outcome_version > 0),
  definition jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_key, bank_version, probe_id, outcome_key),
  FOREIGN KEY (bank_key, bank_version)
    REFERENCES private.specialist_sandbox_environment_banks (bank_key, bank_version)
    ON DELETE RESTRICT
);
ALTER TABLE private.specialist_sandbox_diagnosis_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_diagnosis_outcomes FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_sandbox_diagnosis_outcomes_lookup
ON private.specialist_sandbox_diagnosis_outcomes (bank_key, bank_version, probe_id)
WHERE active = true;

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_rediagnosis_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trajectory_id varchar NOT NULL REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE CASCADE,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  started_session_number integer NOT NULL CHECK (started_session_number > 0),
  target_phase varchar NOT NULL,
  specialist_probe_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  specialist_decision jsonb,
  status varchar NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','blocked')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.specialist_sandbox_rediagnosis_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_rediagnosis_runs FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_one_active_rediagnosis
ON public.specialist_sandbox_rediagnosis_runs (trajectory_id)
WHERE status = 'active';

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_rediagnosis_truth (
  rediagnosis_run_id varchar PRIMARY KEY
    REFERENCES public.specialist_sandbox_rediagnosis_runs(id) ON DELETE CASCADE,
  canonical_probe_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  canonical_decision jsonb,
  recent_outcome_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.specialist_sandbox_rediagnosis_truth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_rediagnosis_truth FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_rediagnosis_turns (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rediagnosis_run_id varchar NOT NULL
    REFERENCES public.specialist_sandbox_rediagnosis_runs(id) ON DELETE CASCADE,
  trajectory_id varchar NOT NULL REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE CASCADE,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  probe_id varchar NOT NULL,
  turn_form_id varchar NOT NULL UNIQUE,
  student_behavior text NOT NULL,
  specialist_submission jsonb NOT NULL,
  condition_conformed boolean NOT NULL,
  total_observations integer NOT NULL CHECK (total_observations > 0),
  matching_observations integer NOT NULL CHECK (matching_observations >= 0),
  observation_exact boolean NOT NULL,
  authority_aligned boolean NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rediagnosis_run_id, sequence_number)
);
ALTER TABLE public.specialist_sandbox_rediagnosis_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_rediagnosis_turns FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_rediagnosis_turn_truth (
  rediagnosis_turn_id varchar PRIMARY KEY
    REFERENCES public.specialist_sandbox_rediagnosis_turns(id) ON DELETE CASCADE,
  outcome_ref varchar NOT NULL,
  outcome_key varchar NOT NULL,
  outcome_version integer NOT NULL,
  canonical_observations jsonb NOT NULL,
  trajectory_class varchar NOT NULL,
  simulated_elapsed_seconds numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.specialist_sandbox_rediagnosis_turn_truth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_rediagnosis_turn_truth FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE private.specialist_sandbox_diagnosis_outcomes IS
'Private targeted re-diagnosis outcome matrix. Canonical diagnosis behavior truth must never be projected with its answer record.';

COMMENT ON TABLE private.specialist_sandbox_rediagnosis_truth IS
'Private canonical evidence-complete diagnosis history for a Sandbox targeted re-diagnosis run.';

COMMENT ON TABLE private.specialist_sandbox_rep_outcomes IS
'Private phase/set/rep Outcome Matrix. Canonical student behaviour truth must never be projected with its answer record.';

COMMENT ON TABLE private.specialist_sandbox_trajectory_truth IS
'Hidden canonical simulated-student state, trajectory continuity and seed. It is separate from the Specialist-derived operating track.';

COMMENT ON TABLE public.specialist_sandbox_trajectories IS
'Specialist-derived operating track for a persistent simulated Sandbox student. Never authoritative to real student state.';

COMMENT ON TABLE public.specialist_sandbox_capability_evidence IS
'Evidence-native Specialist capability ledger. Readiness is resolved through ordered capability evidence plus breadth and longitudinal proof, never a scenario count or score alone.';
