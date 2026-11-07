import type { Request, Response } from "express";
import { getDrillSchemaDefinition, getFieldDefinitionsForRep } from "@shared/responseIntegrityDrillRegistry";
import type { TopicPhase } from "@shared/topicConditioningEngine";
import { DIAGNOSIS_OBSERVATION_MATRIX } from "@shared/diagnosisObservationMatrix";

// The live route retains isAuthenticated middleware; the handler also checks role
// before reading private truth. Inject only the server-side PostgreSQL query API.
type DossierDatabase = {
  query: (sql: string, values: unknown[]) => Promise<{ rows: any[] }>;
};

function observationLabel(phase: unknown, setId: unknown, repNumber: unknown, fieldKey: string, value: any) {
  if (!value?.optionId) return null;
  // Older persisted Sandbox submissions used the human-readable option suffix
  // (`... Option 2`) while current submissions use the canonical
  // `.option_2` suffix. Both identify the same contract option and should
  // render the contract label instead of leaking an internal ID to TDs.
  const optionMatch = String(value.optionId).match(/(?:\.option_|\soption\s)(\d+)$/i);
  if (!optionMatch) return null;
  const schema = getDrillSchemaDefinition("training", String(phase) as TopicPhase);
  const set = schema?.sets.find((candidate) => candidate.setId === String(setId));
  // Historical rows can contain a dimension that is no longer eligible for
  // that rep under the current authority projection. Resolve its label from
  // the set's canonical field as a compatibility fallback so old evidence is
  // still readable.
  const field = set
    ? getFieldDefinitionsForRep(set, Math.max(0, Number(repNumber) - 1)).find((candidate) => candidate.fieldKey === fieldKey)
      || set.fields.find((candidate) => candidate.fieldKey === fieldKey)
    : null;
  const fallbackField = field || schema?.sets
    .flatMap((candidate) => candidate.fields)
    .find((candidate) => candidate.fieldKey === fieldKey);
  return fallbackField?.optionLabels?.[Number(optionMatch[1]) - 1] || null;
}

function expectedConditionLabel(phase: unknown, setId: unknown) {
  const schema = getDrillSchemaDefinition("training", String(phase) as TopicPhase);
  const set = schema?.sets.find((candidate) => candidate.setId === String(setId));
  switch (set?.constraints?.supportLevel) {
    case "first_step_only":
      return "First-step confirmation";
    case "minimal":
      return "First-step confirmation or method/step prompt";
    case "none":
    default:
      return "No intervention";
  }
}

export function createSandboxEvidenceDossierHandler(db: DossierDatabase) {
  return async (req: Request, res: Response) => {
    try {
      const td = (req as any).dbUser;
      if (!td?.id) return res.status(401).json({ message: "Authentication required." });
      const role = String(td.role || "").toLowerCase();
      if (role !== "td") {
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
      const roster = await db.query(
        `SELECT id, name FROM public.students
          WHERE tutor_id = $1
          ORDER BY name ASC NULLS LAST, id ASC`,
        [tutorId],
      );

      const studentIds = roster.rows.map((row: any) => String(row.id));
      const diagnosisRuns = studentIds.length
        ? await db.query(
            `SELECT r.id, r.student_id, r.tutor_id, r.topic, r.starting_phase,
                    r.session_context, r.session_container, r.activity_kind,
                    r.status, r.scheduled_session_id, r.probe_history, r.decision,
                    r.created_at, r.completed_at,
                    ss.type AS scheduled_session_type, ss.scheduled_time
               FROM public.response_integrity_diagnosis_runs r
               LEFT JOIN public.scheduled_sessions ss
                 ON ss.id::text = r.scheduled_session_id::text
              WHERE r.tutor_id = $1
                AND r.student_id = ANY($2::text[])
                AND r.status = 'completed'
              ORDER BY COALESCE(r.completed_at, r.updated_at, r.created_at) DESC,
                       r.id DESC
              LIMIT 100`,
            [tutorId, studentIds],
          )
        : { rows: [] };

      const diagnosisRunIds = diagnosisRuns.rows.map((row: any) => String(row.id));
      const diagnosisEvidence = diagnosisRunIds.length
        ? await db.query(
            `SELECT e.id, e.source_context_id, e.student_id, e.sequence_number,
                    e.probe_id, e.phase, e.bank_version, e.behavior_model_version,
                    e.student_behavior, e.specialist_submission,
                    e.condition_conformed, e.observation_exact,
                    e.matching_observations, e.total_observations, e.completed_at,
                    t.canonical_observations, t.actual_support_event
               FROM public.specialist_sandbox_live_evidence_turns e
               LEFT JOIN private.specialist_sandbox_live_evidence_truth t
                 ON t.event_id = e.id
              WHERE e.tutor_assignment_id = $1
                AND e.tutor_id = $2
                AND e.student_id = ANY($3::text[])
                AND e.source_context_id = ANY($4::text[])
                AND e.scope = 'diagnosis'
              ORDER BY e.source_context_id, e.sequence_number ASC`,
            [assignmentId, tutorId, studentIds, diagnosisRunIds],
          )
        : { rows: [] };

      const diagnosisEvidenceByRun = new Map<string, Map<number, any>>();
      for (const row of diagnosisEvidence.rows) {
        const runId = String(row.source_context_id);
        if (!diagnosisEvidenceByRun.has(runId)) diagnosisEvidenceByRun.set(runId, new Map());
        diagnosisEvidenceByRun.get(runId)!.set(Number(row.sequence_number), row);
      }

      const parseJsonArray = (value: unknown): any[] => {
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };
      const observationView = (value: any) => {
        const dimensionId = String(value?.dimensionId || "");
        const behaviorId = String(value?.behaviorId || "");
        const definition = DIAGNOSIS_OBSERVATION_MATRIX[dimensionId as keyof typeof DIAGNOSIS_OBSERVATION_MATRIX];
        return {
          dimensionId,
          dimensionLabel: definition?.label || dimensionId,
          behaviorId,
          behaviorLabel: definition?.options.find((option) => option.id === behaviorId)?.label || behaviorId,
        };
      };
      const diagnosisRunPayload = diagnosisRuns.rows.map((run: any) => {
        const runId = String(run.id);
        const history = parseJsonArray(run.probe_history);
        const turns = diagnosisEvidenceByRun.get(runId) || new Map<number, any>();
        const decision = run.decision && typeof run.decision === "object" && !Array.isArray(run.decision)
          ? run.decision
          : {};
        const probes = history.map((probe: any, index: number) => {
          const turn = turns.get(index + 1);
          const recordedRaw = parseJsonArray(turn?.specialist_submission?.observations).length
            ? parseJsonArray(turn.specialist_submission.observations)
            : parseJsonArray(probe?.observations);
          const expectedRaw = turn ? parseJsonArray(turn.canonical_observations) : [];
          const recordedObservations = recordedRaw.map(observationView);
          const expectedObservations = turn?.canonical_observations == null
            ? null
            : expectedRaw.map(observationView);
          const byDimension = new Map<string, { recorded: any; expected: any }>();
          for (const observation of recordedObservations) {
            byDimension.set(observation.dimensionId, { recorded: observation, expected: null });
          }
          for (const observation of expectedObservations || []) {
            const existing = byDimension.get(observation.dimensionId) || { recorded: null, expected: null };
            existing.expected = observation;
            byDimension.set(observation.dimensionId, existing);
          }
          const comparisons = Array.from(byDimension.entries()).map(([dimensionId, pair]) => ({
            dimensionId,
            dimensionLabel: pair.recorded?.dimensionLabel || pair.expected?.dimensionLabel || dimensionId,
            recorded: pair.recorded,
            expected: pair.expected,
            matched: Boolean(pair.recorded && pair.expected &&
              pair.recorded.behaviorId === pair.expected.behaviorId),
          }));
          return {
            sequenceNumber: index + 1,
            probeId: String(probe?.probeId || turn?.probe_id || "unknown"),
            phase: turn?.phase || null,
            studentBehavior: typeof turn?.student_behavior === "string" ? turn.student_behavior : null,
            narrativePreserved: typeof turn?.student_behavior === "string" && turn.student_behavior.length > 0,
            bankVersion: turn?.bank_version == null ? null : Number(turn.bank_version),
            behaviorModelVersion: turn?.behavior_model_version == null ? null : Number(turn.behavior_model_version),
            truthPresent: turn?.canonical_observations != null,
            recordedObservations,
            expectedObservations,
            comparisons,
            recordedSupportEvent: turn?.specialist_submission?.supportEvent ?? probe?.supportEvent ?? null,
            expectedSupportEvent: turn?.actual_support_event ?? null,
            supportEventMatched: turn?.actual_support_event == null
              ? null
              : String(turn?.specialist_submission?.supportEvent ?? probe?.supportEvent ?? "") === String(turn.actual_support_event),
            conditionConformed: turn?.condition_conformed ?? null,
            observationExact: turn?.observation_exact ?? null,
            matchingObservations: turn?.matching_observations == null ? null : Number(turn.matching_observations),
            totalObservations: turn?.total_observations == null ? recordedObservations.length : Number(turn.total_observations),
            completedAt: turn?.completed_at || null,
          };
        });
        return {
          id: runId,
          studentId: String(run.student_id),
          tutorId: String(run.tutor_id),
          topic: String(run.topic || ""),
          startingPhase: String(run.starting_phase || ""),
          sessionContext: String(run.session_context || ""),
          sessionContainer: run.session_container || null,
          activityKind: run.activity_kind || null,
          status: String(run.status || ""),
          scheduledSessionId: run.scheduled_session_id ? String(run.scheduled_session_id) : null,
          scheduledSessionType: run.scheduled_session_type || null,
          scheduledTime: run.scheduled_time || null,
          createdAt: run.created_at || null,
          completedAt: run.completed_at || null,
          placementPhase: decision.placementPhase || null,
          confidence: decision.confidence || null,
          stability: decision.stability || null,
          reason: decision.reason || null,
          probes,
        };
      });
      const [reps, sessions] = await Promise.all([
        db.query(
          `SELECT e.id, e.trajectory_id, e.student_id, u.name AS student_name, e.event_sequence, e.session_number, e.phase, e.topic_key,
                  e.set_id, e.rep_number, e.student_behavior, e.specialist_submission,
                  e.condition_kept, e.total_observations, e.matching_observations,
                  e.observation_exact, e.evidence_exact, e.completed_at,
                  t.bank_key, t.bank_version, t.outcome_version,
                  t.canonical_observations, t.canonical_prerequisite_sentinel,
                  t.canonical_inherited_rescue_signal, t.actual_intervention_event
             FROM public.specialist_sandbox_rep_events e
             LEFT JOIN public.users u ON u.id = e.student_id
             LEFT JOIN private.specialist_sandbox_rep_event_truth t ON t.event_id = e.id
            WHERE e.tutor_assignment_id = $1 AND e.tutor_id = $2
            ORDER BY e.completed_at DESC, e.event_sequence DESC LIMIT 180`,
          [assignmentId, tutorId],
        ),
        db.query(
          `SELECT e.id, e.trajectory_id, e.student_id, u.name AS student_name, e.session_number, e.phase, e.topic_key, e.authority_aligned,
                  e.state_track_aligned, e.state_change_observed, e.completed_at,
                  e.specialist_authority, t.canonical_authority
             FROM public.specialist_sandbox_session_evaluations e
             LEFT JOIN public.users u ON u.id = e.student_id
             LEFT JOIN private.specialist_sandbox_session_truth t ON t.session_evaluation_id = e.id
            WHERE e.tutor_assignment_id = $1 AND e.tutor_id = $2
            ORDER BY e.completed_at DESC, e.session_number DESC LIMIT 90`,
          [assignmentId, tutorId],
        ),
      ]);
      const repRows = reps.rows.map((r: any) => {
        const observed = r.specialist_submission?.observations || {};
        const canonical = r.canonical_observations;
        const schema = getDrillSchemaDefinition("training", String(r.phase) as TopicPhase);
        const set = schema?.sets.find((candidate) => candidate.setId === String(r.set_id));
        const orderedKeys = set
          ? getFieldDefinitionsForRep(set, Math.max(0, Number(r.rep_number) - 1)).map((field) => field.fieldKey)
          : [];
        const keys = canonical && typeof canonical === "object"
          ? [...orderedKeys, ...Object.keys(canonical).filter((key) => !orderedKeys.includes(key))].filter((key) => canonical[key] != null)
          : [];
        return {
          id: String(r.id), trajectoryId: String(r.trajectory_id), studentId: String(r.student_id), studentName: r.student_name || null, eventSequence: Number(r.event_sequence),
          sessionNumber: Number(r.session_number), phase: r.phase, topicKey: r.topic_key,
          setId: r.set_id, repNumber: Number(r.rep_number), studentBehavior: r.student_behavior,
          bankKey: r.bank_key, bankVersion: r.bank_version, outcomeVersion: r.outcome_version,
          intervention: r.specialist_submission?.interventionEvent || null,
          expectedIntervention: expectedConditionLabel(r.phase, r.set_id),
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
        students: roster.rows.map((row: any) => ({ id: String(row.id), name: row.name || null })),
        note: "Completed Sandbox evidence only. Canonical responses are TD-restricted and non-authoritative for real student state.",
        reps: repRows,
        diagnosisRuns: diagnosisRunPayload,
        sessions: sessions.rows.map((r: any) => ({
          id: String(r.id), trajectoryId: String(r.trajectory_id), studentId: String(r.student_id), studentName: r.student_name || null, sessionNumber: Number(r.session_number), phase: r.phase,
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
