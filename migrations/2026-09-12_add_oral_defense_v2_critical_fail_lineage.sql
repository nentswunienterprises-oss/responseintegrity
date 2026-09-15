ALTER TABLE specialist_capability_oral_defenses
  ADD COLUMN IF NOT EXISTS critical_fail_count integer
  GENERATED ALWAYS AS (
    CASE
      WHEN defense_version >= 2 THEN integrity_concern_count
      ELSE NULL
    END
  ) STORED;

COMMENT ON COLUMN specialist_capability_oral_defenses.integrity_concern_count IS
  'Legacy Oral Defense V1 reviewer-selected integrity concern count. For V2+, the runtime writes the system-derived critical-Fail count here only as a backward-compatible storage slot; no reviewer integrity flag exists in V2.';

COMMENT ON COLUMN specialist_capability_oral_defenses.critical_fail_count IS
  'Generated semantic V2+ projection of the system-derived count of Fail judgments on issued probes whose frozen rubric marks critical_on_fail. NULL for V1 history.';
