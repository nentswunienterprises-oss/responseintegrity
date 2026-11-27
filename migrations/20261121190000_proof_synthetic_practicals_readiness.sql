CREATE TABLE IF NOT EXISTS private.proof_synthetic_practical_readiness_fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id varchar NOT NULL,
  tutor_assignment_id varchar NOT NULL,
  td_id varchar NOT NULL,
  fixture_label text NOT NULL
    CHECK (fixture_label = 'PROOF SYNTHETIC PRACTICALS ACCEPTANCE'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS proof_synthetic_practical_readiness_fixtures_owner_idx
  ON private.proof_synthetic_practical_readiness_fixtures
     (tutor_assignment_id, tutor_id, td_id, expires_at DESC);

ALTER TABLE private.proof_synthetic_practical_readiness_fixtures
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.proof_synthetic_practical_readiness_fixtures
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE private.proof_synthetic_practical_readiness_fixtures
  TO service_role;

COMMENT ON TABLE private.proof_synthetic_practical_readiness_fixtures IS
  'Short-lived, explicitly synthetic acceptance fixtures for the isolated Proof Preview. Never a real Sandbox qualification or TD sign-off and never enabled in Production.';
