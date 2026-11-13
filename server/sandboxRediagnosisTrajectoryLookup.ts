export type SandboxTrajectoryLookupInput = {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
  bankKey: string;
  trajectoryId?: string | null;
  rediagnosisRunId?: string | null;
};

/** Keep trajectory and run identity in one owner-scoped query contract. */
export function buildSandboxRediagnosisTrajectoryLookup(input: SandboxTrajectoryLookupInput) {
  return {
    sql: `SELECT t.*, truth.canonical_phase, truth.canonical_stability,
            truth.canonical_route, truth.canonical_targeted_rediagnosis_phase,
            truth.trajectory_seed, truth.behavior_model_version, truth.continuity_tags,
            CASE
              WHEN $5::varchar IS NOT NULL OR $6::varchar IS NOT NULL THEN 0
              WHEN EXISTS (
                SELECT 1 FROM specialist_sandbox_rediagnosis_runs current_run
                 WHERE current_run.trajectory_id = t.id
                   AND current_run.started_session_number = t.session_number
                   AND current_run.status IN ('active', 'blocked')
              ) THEN 0
              WHEN truth.canonical_route = 'targeted_rediagnosis'
                OR (truth.canonical_route = 'normal_training'
                    AND truth.canonical_phase IN ('Controlled Discomfort', 'Time Pressure Stability')) THEN 1
              WHEN t.bank_version = (
                SELECT bank_version FROM private.specialist_sandbox_environment_banks
                 WHERE bank_key = $4 AND active = true
              ) THEN 2
              ELSE 3
            END AS trajectory_resolution_priority
       FROM specialist_sandbox_trajectories t
       JOIN private.specialist_sandbox_trajectory_truth truth
         ON truth.trajectory_id = t.id
      WHERE t.tutor_assignment_id = $1
        AND t.tutor_id = $2
        AND t.student_id = $3
        AND t.bank_key = $4
        AND t.status = 'active'
        AND ($5::varchar IS NULL OR t.id = $5)
        AND ($6::varchar IS NULL OR EXISTS (
          SELECT 1 FROM specialist_sandbox_rediagnosis_runs requested_run
           WHERE requested_run.id = $6 AND requested_run.trajectory_id = t.id
             AND requested_run.tutor_assignment_id = $1
             AND requested_run.tutor_id = $2 AND requested_run.student_id = $3
        ))
      ORDER BY trajectory_resolution_priority ASC, t.created_at DESC
      LIMIT 2`,
    values: [input.tutorAssignmentId, input.tutorId, input.studentId, input.bankKey,
      input.trajectoryId || null, input.rediagnosisRunId || null],
  };
}
