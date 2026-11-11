-- New Sandbox trajectories must default to the approved longitudinal Behaviour Model V2.
-- Existing rows are deliberately untouched; historical trajectories remain version-pinned.
ALTER TABLE private.specialist_sandbox_trajectory_truth
  ALTER COLUMN behavior_model_version SET DEFAULT 2;

COMMENT ON COLUMN private.specialist_sandbox_trajectory_truth.behavior_model_version
  IS '1=legacy deterministic outcome selection; 2=versioned longitudinal profile transitions. New trajectories default to V2; existing trajectories remain version-pinned.';
