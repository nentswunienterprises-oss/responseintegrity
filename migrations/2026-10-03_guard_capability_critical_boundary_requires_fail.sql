-- Prevent future Capability bank authoring from attaching a critical-boundary
-- tag without at least one critical-fail option. Runtime form generation already
-- rejects this state; the database guard stops invalid staged banks earlier.
--
-- NOT VALID intentionally preserves historical retired bank versions that predate
-- this guard while enforcing the rule for all future inserts and updates.

ALTER TABLE private.specialist_capability_assessment_items
  ADD CONSTRAINT specialist_capability_boundary_requires_critical_fail
  CHECK (
    COALESCE(jsonb_array_length(critical_boundary_keys), 0) = 0
    OR COALESCE(jsonb_array_length(critical_fail_option_keys), 0) > 0
  ) NOT VALID;
