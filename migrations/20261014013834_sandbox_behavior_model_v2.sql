-- Managed Production prerequisite; apply only via protected Production DB Promotion.
-- Existing trajectories remain on the original deterministic V1 selection rules.
-- A newly created Sandbox trajectory explicitly elects behavior model V2.
-- No historical response or Specialist evidence is changed.
ALTER TABLE private.specialist_sandbox_trajectory_truth
  ADD COLUMN IF NOT EXISTS behavior_model_version SMALLINT NOT NULL DEFAULT 1;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'private.specialist_sandbox_trajectory_truth'::regclass
      AND conname = 'specialist_sandbox_behavior_model_version_ck'
  ) THEN
    ALTER TABLE private.specialist_sandbox_trajectory_truth
      ADD CONSTRAINT specialist_sandbox_behavior_model_version_ck
      CHECK (behavior_model_version IN (1, 2));
  END IF;
END
$$;
COMMENT ON COLUMN private.specialist_sandbox_trajectory_truth.behavior_model_version
  IS '1=legacy deterministic outcome selection; 2=versioned longitudinal profile transitions. Existing trajectories stay V1.';
