CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_scenario_banks (
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  title varchar NOT NULL,
  max_attempts integer NOT NULL DEFAULT 6 CHECK (max_attempts > 0),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  PRIMARY KEY (bank_key, bank_version)
);
ALTER TABLE private.specialist_sandbox_scenario_banks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_scenario_banks FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_scenario_bank_one_active
ON private.specialist_sandbox_scenario_banks (bank_key) WHERE active = true;

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_scenarios (
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL,
  scenario_key varchar NOT NULL,
  scenario_version integer NOT NULL CHECK (scenario_version > 0),
  definition jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bank_key, bank_version, scenario_key),
  FOREIGN KEY (bank_key, bank_version)
    REFERENCES private.specialist_sandbox_scenario_banks (bank_key, bank_version)
    ON DELETE RESTRICT
);
ALTER TABLE private.specialist_sandbox_scenarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_scenarios FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_simulation_attempts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  scenario_form_id varchar NOT NULL,
  scenario_key varchar NOT NULL,
  scenario_version integer NOT NULL CHECK (scenario_version > 0),
  phase varchar NOT NULL,
  previous_stability varchar NOT NULL,
  total_observations integer NOT NULL CHECK (total_observations > 0),
  matching_observations integer NOT NULL CHECK (matching_observations >= 0),
  observation_fidelity_percent numeric(5,2) NOT NULL CHECK (observation_fidelity_percent >= 0 AND observation_fidelity_percent <= 100),
  system_outcome_matched boolean NOT NULL,
  passed boolean NOT NULL,
  specialist_outcome jsonb NOT NULL,
  canonical_outcome jsonb NOT NULL,
  submission jsonb NOT NULL,
  student_state_authoritative boolean NOT NULL DEFAULT false CHECK (student_state_authoritative = false),
  evidence_scope varchar(16) NOT NULL DEFAULT 'sandbox' CHECK (evidence_scope = 'sandbox'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_assignment_id, bank_key, bank_version, attempt_number)
);
ALTER TABLE public.specialist_sandbox_simulation_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_simulation_attempts FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_specialist_sandbox_attempt_assignment
ON public.specialist_sandbox_simulation_attempts (tutor_assignment_id, completed_at DESC);

-- Private Sandbox scenario content is intentionally not stored in this public repository.
-- Versioned scenario banks are imported into the target private schema through a controlled
-- private-content workflow after schema deployment. Canonical simulated observations must
-- never be committed alongside application source.
