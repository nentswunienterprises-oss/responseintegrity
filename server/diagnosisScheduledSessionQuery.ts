/** Preserve identity values as PostgreSQL bindings in both diagnosis launch paths. */
export function diagnosisScheduledSessionQuery(input: {
  tutorId: string;
  studentId: string;
  scheduledSessionId?: string | null;
  requestedKind: "intro" | "training" | "handover";
}) {
  const values = [input.tutorId, input.studentId];
  let text = `SELECT id, tutor_id, student_id, type, status, scheduled_time
    FROM public.scheduled_sessions WHERE tutor_id = $1 AND student_id = $2`;
  if (input.scheduledSessionId) {
    values.push(input.scheduledSessionId);
    text += " AND id = $3";
  } else {
    values.push(input.requestedKind);
    text += " AND type = $3 ORDER BY scheduled_time DESC, created_at DESC LIMIT 20";
  }
  return { text, values };
}
