ALTER TABLE tutor_applications
  ADD COLUMN IF NOT EXISTS production_link_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tracking_source VARCHAR(128),
  ADD COLUMN IF NOT EXISTS tracking_campaign VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_tutor_applications_production_link_code
  ON tutor_applications(production_link_code);