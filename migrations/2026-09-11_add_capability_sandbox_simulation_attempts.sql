CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.specialist_capability_simulation_banks (
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  title varchar NOT NULL,
  max_attempts integer NOT NULL DEFAULT 6 CHECK (max_attempts > 0),
  retry_cooldown_hours numeric(6,2) NOT NULL DEFAULT 0 CHECK (retry_cooldown_hours >= 0),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  PRIMARY KEY (bank_key, bank_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_simulation_bank_one_active
  ON private.specialist_capability_simulation_banks (bank_key)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS private.specialist_capability_simulation_scenarios (
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL,
  scenario_key varchar NOT NULL,
  scenario_version integer NOT NULL CHECK (scenario_version > 0),
  definition jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bank_key, bank_version, scenario_key),
  FOREIGN KEY (bank_key, bank_version)
    REFERENCES private.specialist_capability_simulation_banks (bank_key, bank_version)
    ON DELETE RESTRICT
);

REVOKE ALL ON TABLE private.specialist_capability_simulation_banks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.specialist_capability_simulation_scenarios FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS specialist_capability_sandbox_simulation_attempts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  simulation_form_id varchar NOT NULL,
  scenario_key varchar NOT NULL,
  scenario_version integer NOT NULL CHECK (scenario_version > 0),
  total_decisions integer NOT NULL CHECK (total_decisions > 0),
  correct_decisions integer NOT NULL CHECK (correct_decisions >= 0),
  percent numeric(5,2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  passed boolean NOT NULL DEFAULT false,
  has_critical_fail boolean NOT NULL DEFAULT false,
  critical_fail_decision_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_critical_boundary_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_contamination_count integer NOT NULL DEFAULT 0 CHECK (evidence_contamination_count >= 0),
  authority_violation_count integer NOT NULL DEFAULT 0 CHECK (authority_violation_count >= 0),
  escalation_failure_count integer NOT NULL DEFAULT 0 CHECK (escalation_failure_count >= 0),
  covered_deep_dive_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  responses jsonb NOT NULL,
  decision_results jsonb NOT NULL,
  authoritative boolean NOT NULL DEFAULT false CHECK (authoritative = false),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_assignment_id, bank_key, bank_version, attempt_number)
);

ALTER TABLE specialist_capability_sandbox_simulation_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE specialist_capability_sandbox_simulation_attempts FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_capability_sandbox_simulation_tutor
  ON specialist_capability_sandbox_simulation_attempts (tutor_assignment_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_sandbox_simulation_bank
  ON specialist_capability_sandbox_simulation_attempts (bank_key, bank_version, completed_at DESC);

COMMENT ON TABLE private.specialist_capability_simulation_banks IS
  'Private versioned Sandbox Simulation bank configuration. Live evaluator content must not be sourced from the public repository.';

COMMENT ON TABLE private.specialist_capability_simulation_scenarios IS
  'Private fictional Sandbox Simulation scenario definitions including evaluator keys, risk mappings and explanations.';

COMMENT ON TABLE specialist_capability_sandbox_simulation_attempts IS
  'Immutable shadow Sandbox rehearsal evidence. authoritative is permanently false; these attempts cannot pass the human Sandbox Mock Gate or open Trial.';
