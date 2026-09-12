ALTER TABLE specialist_capability_oral_defenses
  ADD COLUMN IF NOT EXISTS critical_fail_count integer;

UPDATE specialist_capability_oral_defenses
   SET critical_fail_count = 0
 WHERE critical_fail_count IS NULL
   AND defense_version >= 2;

ALTER TABLE specialist_capability_oral_defenses
  ADD CONSTRAINT specialist_capability_oral_defenses_critical_fail_count_nonnegative
  CHECK (critical_fail_count IS NULL OR critical_fail_count >= 0);

COMMENT ON COLUMN specialist_capability_oral_defenses.integrity_concern_count IS
  'Legacy Oral Defense V1 reviewer-selected integrity concern count. Retained for immutable historical evidence; V2 does not write or read this field.';

COMMENT ON COLUMN specialist_capability_oral_defenses.critical_fail_count IS
  'Oral Defense V2+ count of Fail judgments on issued probes whose frozen rubric marks critical_on_fail. System-derived; not reviewer-selected.';
