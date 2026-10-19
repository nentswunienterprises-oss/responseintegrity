-- Schema-first migration for the approved RI stability/progression separation.
-- Do not promote application code until this migration has been applied and verified.
-- Historical session evaluations and evidence are immutable and remain unchanged.
BEGIN;

ALTER TABLE public.specialist_sandbox_trajectories
  ADD COLUMN IF NOT EXISTS specialist_progression_authority varchar(40);
ALTER TABLE private.specialist_sandbox_trajectory_truth
  ADD COLUMN IF NOT EXISTS canonical_progression_authority varchar(40);

-- Preserve every previously earned checkpoint before normalizing its stability.
UPDATE public.specialist_sandbox_trajectories
SET specialist_progression_authority = CASE
  WHEN specialist_stability = 'High Maintenance' THEN 'exit_confirmation_eligible'
  ELSE 'building'
END
WHERE specialist_progression_authority IS NULL;

UPDATE private.specialist_sandbox_trajectory_truth
SET canonical_progression_authority = CASE
  WHEN canonical_stability = 'High Maintenance' THEN 'exit_confirmation_eligible'
  ELSE 'building'
END
WHERE canonical_progression_authority IS NULL;

UPDATE public.specialist_sandbox_trajectories
SET specialist_stability = 'High'
WHERE specialist_stability = 'High Maintenance';

UPDATE private.specialist_sandbox_trajectory_truth
SET canonical_stability = 'High'
WHERE canonical_stability = 'High Maintenance';

ALTER TABLE public.specialist_sandbox_trajectories
  ALTER COLUMN specialist_progression_authority SET DEFAULT 'building',
  ALTER COLUMN specialist_progression_authority SET NOT NULL;

ALTER TABLE private.specialist_sandbox_trajectory_truth
  ALTER COLUMN canonical_progression_authority SET DEFAULT 'building',
  ALTER COLUMN canonical_progression_authority SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.specialist_sandbox_trajectories'::regclass
      AND conname = 'sandbox_specialist_stability_progression_separated'
  ) THEN
    ALTER TABLE public.specialist_sandbox_trajectories
      ADD CONSTRAINT sandbox_specialist_stability_progression_separated CHECK (
        specialist_stability IN ('Low','Medium','High')
        AND specialist_progression_authority IN ('building','exit_confirmation_eligible','transfer_maintenance')
        AND (specialist_progression_authority = 'building' OR specialist_stability = 'High')
        AND (specialist_progression_authority <> 'transfer_maintenance'
             OR specialist_phase = 'Time Pressure Stability')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'private.specialist_sandbox_trajectory_truth'::regclass
      AND conname = 'sandbox_canonical_stability_progression_separated'
  ) THEN
    ALTER TABLE private.specialist_sandbox_trajectory_truth
      ADD CONSTRAINT sandbox_canonical_stability_progression_separated CHECK (
        canonical_stability IN ('Low','Medium','High')
        AND canonical_progression_authority IN ('building','exit_confirmation_eligible','transfer_maintenance')
        AND (canonical_progression_authority = 'building' OR canonical_stability = 'High')
        AND (canonical_progression_authority <> 'transfer_maintenance'
             OR canonical_phase = 'Time Pressure Stability')
      );
  END IF;
END $$;

-- No grants. Public sandbox tables remain server-owned and RLS-protected;
-- private canonical truth never becomes available to a browser.
COMMIT;
