CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_environment_banks (
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  title varchar NOT NULL,
  capability_policy jsonb,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  PRIMARY KEY (bank_key, bank_version)
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
  canonical_phase varchar NOT NULL,
  canonical_stability varchar NOT NULL,
  specialist_phase varchar NOT NULL,
  specialist_stability varchar NOT NULL,
  canonical_route varchar NOT NULL DEFAULT 'normal_training',
  specialist_route varchar NOT NULL DEFAULT 'normal_training',
  canonical_targeted_rediagnosis_phase varchar,
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
  selection_seed_digest varchar NOT NULL,
  specialist_submission jsonb NOT NULL,
  condition_kept boolean,
  exact_observation_count integer NOT NULL DEFAULT 0 CHECK (exact_observation_count >= 0),
  comparable_observation_count integer NOT NULL DEFAULT 0 CHECK (comparable_observation_count >= 0),
  evidence_status_exact boolean,
  intervention_event_exact boolean,
  system_outcome_matched boolean,
  state_track_aligned boolean,
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

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_session_evaluations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trajectory_id varchar NOT NULL REFERENCES public.specialist_sandbox_trajectories(id) ON DELETE CASCADE,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_number integer NOT NULL CHECK (session_number > 0),
  phase varchar NOT NULL,
  canonical_authority jsonb NOT NULL,
  specialist_authority jsonb NOT NULL,
  authority_aligned boolean NOT NULL,
  state_track_aligned boolean NOT NULL,
  student_state_authoritative boolean NOT NULL DEFAULT false CHECK (student_state_authoritative = false),
  evidence_scope varchar(16) NOT NULL DEFAULT 'sandbox' CHECK (evidence_scope = 'sandbox'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trajectory_id, session_number)
);
ALTER TABLE public.specialist_sandbox_session_evaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_session_evaluations FROM PUBLIC, anon, authenticated;

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
  phase varchar NOT NULL,
  set_id varchar NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number > 0),
  session_number integer NOT NULL CHECK (session_number > 0),
  source_event_id varchar,
  reason text NOT NULL,
  student_state_authoritative boolean NOT NULL DEFAULT false CHECK (student_state_authoritative = false),
  evidence_scope varchar(16) NOT NULL DEFAULT 'sandbox' CHECK (evidence_scope = 'sandbox'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.specialist_sandbox_capability_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_capability_evidence FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_sandbox_capability_evidence_assignment
ON public.specialist_sandbox_capability_evidence (
  tutor_assignment_id,
  capability_id,
  created_at
);

COMMENT ON TABLE private.specialist_sandbox_rep_outcomes IS
'Private stateful Sandbox outcome matrix. Canonical simulated student behavior and answer truth must never be projected to Specialist clients or committed as public bank content.';

COMMENT ON TABLE public.specialist_sandbox_trajectories IS
'Persistent non-authoritative Sandbox student trajectories. Canonical simulated truth and Specialist-recorded RI state are held separately so evidence divergence can be measured without mutating live student state.';

COMMENT ON TABLE public.specialist_sandbox_capability_evidence IS
'Evidence-native Specialist capability ledger for Sandbox. Readiness is resolved by ordered capability evidence, not by scenario completion counts or a percentage alone.';
