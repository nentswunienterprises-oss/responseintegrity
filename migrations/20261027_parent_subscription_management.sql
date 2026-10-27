-- Parent subscription changes are staged for the next package cycle.
-- The current paid membership_month remains authoritative until it is exhausted.
ALTER TABLE parent_enrollments
  ADD COLUMN IF NOT EXISTS next_package_key varchar(24);

ALTER TABLE parent_enrollments
  DROP CONSTRAINT IF EXISTS parent_enrollments_next_package_contract_check;

ALTER TABLE parent_enrollments
  ADD CONSTRAINT parent_enrollments_next_package_contract_check
  CHECK (next_package_key IS NULL OR next_package_key IN ('monthly_8', 'monthly_12', 'monthly_16'));
