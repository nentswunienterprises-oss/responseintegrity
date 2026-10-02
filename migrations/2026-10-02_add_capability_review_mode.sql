ALTER TABLE private.specialist_capability_assessment_configs
  ADD COLUMN IF NOT EXISTS review_mode boolean NOT NULL DEFAULT false;
