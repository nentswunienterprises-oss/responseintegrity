CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.emergency_auth_credentials (
  user_id varchar PRIMARY KEY
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz NULL
);

ALTER TABLE private.emergency_auth_credentials
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM authenticated;
