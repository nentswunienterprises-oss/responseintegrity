CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.emergency_tutor_onboarding_files (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,

  application_id varchar NOT NULL
    REFERENCES public.tutor_applications(id),

  user_id varchar NOT NULL
    REFERENCES public.users(id),

  doc_step integer NOT NULL
    CHECK (doc_step IN (2, 6)),

  original_file_name varchar(255) NOT NULL,
  mime_type varchar(128) NOT NULL,

  byte_size integer NOT NULL
    CHECK (byte_size > 0),

  sha256 varchar(64) NOT NULL
    CHECK (sha256 ~ '^[0-9a-f]{64}$'),

  ciphertext bytea NOT NULL
    CHECK (octet_length(ciphertext) > 0),

  iv bytea NOT NULL
    CHECK (octet_length(iv) = 12),

  auth_tag bytea NOT NULL
    CHECK (octet_length(auth_tag) = 16),

  created_at timestamptz NOT NULL DEFAULT now(),
  migrated_at timestamptz NULL
);

CREATE INDEX idx_emergency_tutor_onboarding_files_application
  ON private.emergency_tutor_onboarding_files
  (application_id, created_at DESC);

CREATE INDEX idx_emergency_tutor_onboarding_files_user_doc
  ON private.emergency_tutor_onboarding_files
  (user_id, doc_step, created_at DESC);

ALTER TABLE private.emergency_tutor_onboarding_files
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA private FROM PUBLIC;

REVOKE ALL
  ON TABLE private.emergency_tutor_onboarding_files
  FROM PUBLIC;

REVOKE ALL
  ON TABLE private.emergency_tutor_onboarding_files
  FROM anon;

REVOKE ALL
  ON TABLE private.emergency_tutor_onboarding_files
  FROM authenticated;
