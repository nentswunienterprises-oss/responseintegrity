import type { Request, Response } from "express";
import { getDrillSchemaDefinition, getFieldDefinitionsForRep } from "@shared/responseIntegrityDrillRegistry";
import type { TopicPhase } from "@shared/topicConditioningEngine";

// The live route retains isAuthenticated middleware; the handler also checks role
// before reading private truth. Inject only the server-side PostgreSQL query API.
type DossierDatabase = {
  query: (sql: string, values: string[]) => Promise<{ rows: any[] }>;
};

function observationLabel(phase: unknown, setId: unknown, repNumber: unknown, fieldKey: string, value: any) {
  if (!value?.optionId) return null;
  const optionMatch = String(value.optionId).match(/\.option_(\d+)$/i);
  if (!optionMatch) return null;
  const schema = getDrillSchemaDefinition("training", String(phase) as TopicPhase);
  const set = schema?.sets.find((candidate) => candidate.setId === String(setId));
  const field = set ? getFieldDefinitionsForRep(set, Math.max(0, Number(repNumber) - 1)).find((candidate) => candidate.fieldKey === fieldKey) : null;
  return field?.optionLabels?.[Number(optionMatch[1]) - 1] || null;
}

export function createSandboxEvidenceDossierHandler(db: DossierDatabase) {
  return async (req: Request, res: Response) => {
    try {
      const td = (req as any).dbUser;
      if (!td?.id) return res.status(401).json({ message: "Authentication required." });
      if (String(td.role || "").toLowerCase() !== "td") {
        return res.status(403).json({ message: "TD access required." });
      }
      const tutorId = String(req.params.tutorId || "").trim();
      if (!tutorId) return res.status(400).json({ message: "tutorId is required." });
      const assignment = await db.query(
        `SELECT ta.id FROM (
            SELECT id, pod_id FROM public.tutor_assignments
            WHERE tutor_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1
          ) ta JOIN public.pods p ON p.id = ta.pod_id
          WHERE p.td_id = $2`,
        [tutorId, String(td.id)],
      );
      const assignmentId = assignment.rows[0]?.id;
      if (!assignmentId) return res.status(403).json({ message: "Specialist is outside your assigned Pod." });
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      const [reps, sessions] = await Promise.all([
        db.query(
          `SELECT e.id, e.event_sequence, e.session_number, e.phase, e.topic_key,
                  e.set_id, e.rep_number, e.student_behavior, e.specialist_submission,
                  e.condition_kept, e.total_observations, e.matching_observations,
                  e.observation_exact, e.evidence_exact, e.completed_at,
                  t.bank_key, t.bank_version, t.outcome_version,
                  t.canonical_observations, t.canonical_prerequisite_sentinel,
                  t.canonical_inherited_rescue_signal, t.actual_intervention_event
             FROM public.specialist_sandbox_rep_events e
             LEFT JOIN private.specialist_sandbox_rep_event_truth t ON t.event_id = e.id
            WHERE e.tutor_assignment_id = $1 AND e.tutor_id = $2
            ORDER BY e.completed_at DESC, e.event_sequence DESC LIMIT 180`,
          [assignmentId, tutorId],
        ),
        db.query(
          `SELECT e.id, e.session_number, e.phase, e.topic_key, e.authority_aligned,
                  e.state_track_aligned, e.state_change_observed, e.completed_at,
                  e.specialist_authority, t.canonical_authority
             FROM public.specialist_sandbox_session_evaluations e
             LEFT JOIN private.specialist_sandbox_session_truth t ON t.session_evaluation_id = e.id
            WHERE e.tutor_assignment_id = $1 AND e.tutor_id = $2
            ORDER BY e.completed_at DESC, e.session_number DESC LIMIT 90`,
          [assignmentId, tutorId],
        ),
      ]);
      const repRows = reps.rows.map((r: any) => {
        const observed = r.specialist_submission?.observations || {};
        const canonical = r.canonical_observations;
        const keys = canonical && typeof canonical === "object" ? Object.keys(canonical) : [];
        return {
          id: String(r.id), eventSequence: Number(r.event_sequence),
          sessionNumber: Number(r.session_number), phase: r.phase, topicKey: r.topic_key,
          setId: r.set_id, repNumber: Number(r.rep_number), studentBehavior: r.student_behavior,
          bankKey: r.bank_key, bankVersion: r.bank_version, outcomeVersion: r.outcome_version,
          intervention: r.specialist_submission?.interventionEvent || null,
          conditionKept: r.condition_kept, truthPresent: !!canonical,
          observationExact: r.observation_exact, evidenceExact: r.evidence_exact,
          matchingObservations: Number(r.matching_observations),
          totalObservations: Number(r.total_observations),
          comparisons: keys.map((fieldKey) => ({
            fieldKey,
            recorded: observed[fieldKey] ? { ...observed[fieldKey], label: observationLabel(r.phase, r.set_id, r.rep_number, fieldKey, observed[fieldKey]) } : null,
            expected: canonical[fieldKey] ? { ...canonical[fieldKey], label: observationLabel(r.phase, r.set_id, r.rep_number, fieldKey, canonical[fieldKey]) } : null,
            matched: observed[fieldKey]?.optionId === canonical[fieldKey]?.optionId &&
              (observed[fieldKey]?.evidenceStatus || "observed") ===
              (canonical[fieldKey]?.evidenceStatus || "observed"),
          })),
          prerequisite: { recorded: r.specialist_submission?.prerequisiteSentinel || null,
            expected: r.canonical_prerequisite_sentinel },
          rescueSignal: { recorded: r.specialist_submission?.inheritedRescueSignal || null,
            expected: r.canonical_inherited_rescue_signal },
          completedAt: r.completed_at,
        };
      });
      return res.json({
        tutorId, assignmentId,
        note: "Completed Sandbox evidence only. Canonical responses are TD-restricted and non-authoritative for real student state.",
        reps: repRows,
        sessions: sessions.rows.map((r: any) => ({
          id: String(r.id), sessionNumber: Number(r.session_number), phase: r.phase,
          topicKey: r.topic_key, authorityAligned: r.authority_aligned,
          stateTrackAligned: r.state_track_aligned, stateChangeObserved: r.state_change_observed,
          truthPresent: r.canonical_authority != null, specialistAuthority: r.specialist_authority,
          canonicalAuthority: r.canonical_authority, completedAt: r.completed_at,
        })),
      });
    } catch (error) {
      console.error("TD Sandbox dossier query failed", error);
      return res.status(500).json({ message: "Failed to load Sandbox evidence dossier." });
    }
  };
}
