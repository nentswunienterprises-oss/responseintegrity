import type { EvidenceCompleteDiagnosisDecision } from "../shared/evidenceCompleteDiagnosis";

export type DiagnosisSessionLineage = { scheduledSessionId: string | null; startProbeIndex: number; sessionKind?: "intro" | "training" | "handover" };
export type DiagnosisContinuationContext = {
  legacyPrefixLength: number;
  sessions: DiagnosisSessionLineage[];
  /** Persisted at creation for new Sandbox episodes; absent preserves legacy selection. */
  sandboxSelectionVersion?: 2;
};

/** Only read this context from the persisted run, never from a submitted decision. */
export function diagnosisContinuationContext(decision: any, historyLength: number, originalSessionId: string | null): DiagnosisContinuationContext {
  const saved = decision?._diagnosisContext;
  if (saved && ((saved.sandboxSelectionVersion != null && saved.sandboxSelectionVersion !== 2) ||
    !Number.isInteger(saved.legacyPrefixLength) || saved.legacyPrefixLength < 0 || saved.legacyPrefixLength > historyLength ||
    !Array.isArray(saved.sessions) || !saved.sessions.length || saved.sessions[0].startProbeIndex !== 0 ||
    saved.sessions.some((s: any, i: number) => !Number.isInteger(s.startProbeIndex) || s.startProbeIndex < 0 || s.startProbeIndex > historyLength ||
      (i > 0 && s.startProbeIndex <= saved.sessions[i - 1].startProbeIndex)))) {
    throw Object.assign(new Error("The persisted diagnosis session lineage is invalid. Preserve the source for repair."), { status: 409 });
  }
  return saved || { legacyPrefixLength: decision?.decisionPolicyVersion === 2 ? 0 : historyLength,
    sessions: [{ scheduledSessionId: originalSessionId, startProbeIndex: 0 }] };
}
export function diagnosisDecisionWithContext(decision: EvidenceCompleteDiagnosisDecision, context: DiagnosisContinuationContext, previous?: any) {
  return { ...decision, _diagnosisContext: context,
    // Record a policy reinterpretation without changing a single observation.
    ...(previous && previous.decisionPolicyVersion !== 2
      ? { previousDecision: previous } : previous?.previousDecision ? { previousDecision: previous.previousDecision } : {}) };
}
export async function authorizeDiagnosisContinuation(input: {
  tutorId: string; studentId: string; scheduledSessionId: string;
  context: DiagnosisContinuationContext; historyLength: number;
  decision: EvidenceCompleteDiagnosisDecision;
}, db: { query: (sql: string, values: any[]) => Promise<{ rows: any[] }> }): Promise<DiagnosisContinuationContext> {
  if (input.decision.complete || !input.decision.continuation || input.decision.nextProbeId) {
    throw Object.assign(new Error("Finish the current prescribed evidence opportunity before continuing in another session."), { status: 409 });
  }
  const previous = input.context.sessions.at(-1)!;
  if (input.context.sessions.some(s => s.scheduledSessionId === input.scheduledSessionId)) {
    throw Object.assign(new Error("The session limit cannot be reset in the same or an earlier lesson."), { status: 409 });
  }
  const result = await db.query(
    `SELECT next.id, next.type FROM scheduled_sessions next
      LEFT JOIN scheduled_sessions previous ON previous.id::text = $4::text
      WHERE next.id::text = $1 AND next.tutor_id::text = $2 AND next.student_id::text = $3
        AND next.status IN ('confirmed', 'ready', 'live')
        AND ($4::text IS NULL OR (previous.tutor_id::text = $2 AND previous.student_id::text = $3
          AND next.scheduled_time > previous.scheduled_time))`,
    [input.scheduledSessionId, input.tutorId, input.studentId, previous.scheduledSessionId]);
  if (!result.rows[0]) throw Object.assign(new Error("Continue through a later confirmed lesson for this student and Specialist."), { status: 409 });
  return { ...input.context, sessions: [...input.context.sessions,
    { scheduledSessionId: input.scheduledSessionId, startProbeIndex: input.historyLength, ...(result.rows[0].type ? { sessionKind: result.rows[0].type } : {}) }] };
}
