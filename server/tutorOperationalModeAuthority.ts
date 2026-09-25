import { pool } from "./db";
import { resolveTutorOperationalModeAuthority } from "@shared/tutorOperationalModeAuthority";

export async function loadTutorOperationalModeAuthority(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  const result = await pool.query(
    `SELECT ta.id,
            ta.operational_mode AS assignment_mode,
            lifecycle.mode AS lifecycle_mode
       FROM public.tutor_assignments ta
       LEFT JOIN public.tutor_battle_test_statuses lifecycle
         ON lifecycle.tutor_assignment_id = ta.id
      WHERE ta.id = $1
        AND ta.tutor_id = $2
      LIMIT 1`,
    [input.tutorAssignmentId, input.tutorId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const resolved = resolveTutorOperationalModeAuthority({
    assignmentMode: row.assignment_mode,
    lifecycleMode: row.lifecycle_mode,
  });

  if (resolved.drift) {
    console.warn("[TUTOR MODE AUTHORITY DRIFT]", {
      tutorId: input.tutorId,
      tutorAssignmentId: input.tutorAssignmentId,
      assignmentMode: resolved.assignmentMode,
      lifecycleMode: resolved.lifecycleMode,
      resolvedMode: resolved.mode,
    });
  }

  return {
    assignmentId: String(row.id),
    ...resolved,
  };
}
