ALTER TABLE closes
  ALTER COLUMN affiliate_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS production_link_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS production_owner_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS production_owner_name VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_closes_production_link_code
  ON closes(production_link_code);