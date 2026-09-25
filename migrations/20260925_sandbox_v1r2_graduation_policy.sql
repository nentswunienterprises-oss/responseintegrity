ALTER TABLE private.specialist_sandbox_scenario_banks
ADD COLUMN IF NOT EXISTS graduation_policy jsonb;

COMMENT ON COLUMN private.specialist_sandbox_scenario_banks.graduation_policy IS
'Versioned Sandbox evidence-readiness contract. A candidate policy may measure evidence without authorizing progression. Approved policy may mark Practicals readiness but never changes lifecycle mode automatically.';
