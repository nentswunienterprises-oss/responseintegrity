ALTER TABLE users
  ADD COLUMN IF NOT EXISTS production_link_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tracking_source VARCHAR(128),
  ADD COLUMN IF NOT EXISTS tracking_campaign VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_users_production_link_code
  ON users(production_link_code);