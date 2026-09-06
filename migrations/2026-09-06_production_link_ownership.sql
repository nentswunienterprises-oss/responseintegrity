ALTER TABLE affiliate_codes
  ALTER COLUMN affiliate_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS owner_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_affiliate_codes_created_by ON affiliate_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_affiliate_codes_owner_user_id ON affiliate_codes(owner_user_id);