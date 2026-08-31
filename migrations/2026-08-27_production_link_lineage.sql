ALTER TABLE affiliate_codes
  ADD COLUMN IF NOT EXISTS pipeline_type VARCHAR(16) NOT NULL DEFAULT 'demand',
  ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS production_link_code VARCHAR(20);

ALTER TABLE affiliate_applications
  ADD COLUMN IF NOT EXISTS production_link_code VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_affiliate_codes_pipeline_type ON affiliate_codes(pipeline_type);
CREATE INDEX IF NOT EXISTS idx_leads_production_link_code ON leads(production_link_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_production_link_code ON affiliate_applications(production_link_code);
