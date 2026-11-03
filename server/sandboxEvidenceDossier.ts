import type { Request, Response } from "express";
import { getDrillSchemaDefinition, getFieldDefinitionsForRep } from "@shared/responseIntegrityDrillRegistry";
import type { TopicPhase } from "@shared/topicConditioningEngine";
import { getDiagnosisObservationOption } from "@shared/diagnosisObservationMatrix";

// The live route retains isAuthenticated middleware; the handler also checks role
// before reading private truth. Inject only the server-side PostgreSQL query API.
type DossierDatabase = {
  query: (sql: string, values: string[]) => Promise<{ rows: any[] }>;
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
      const diagnosisResult = await db.query(`SELECT r.id, r.student_id, u.name AS student_name, r.topic, r.starting_phase,
                       r.session_context, r.session_container, r.activity_kind, r.status,
                       r.probe_history, r.decision, r.source_drill_id,
                       r.created_at, r.completed_at, d.submitted_at,
                       CASE WHEN jsonb_typeof(d.drill) = 'string'
                         THEN (d.drill #>> '{}')::jsonb
                         ELSE d.drill
                       END -> 'responseSnapshot' AS response_snapshot
                  FROM public.response_integrity_diagnosis_runs r
                  INNER JOIN public.intro_session_drills d
                    ON d.id = r.source_drill_id
                   AND d.tutor_id = r.tutor_id
                   AND d.student_id = r.student_id
                   AND d.scheduled_session_id::text = r.scheduled_session_id
                  INNER JOIN public.scheduled_sessions ss
                    ON ss.id::text = r.scheduled_session_id
                   AND ss.tutor_id = r.tutor_id
                   AND ss.student_id::text = r.student_id
                  INNER JOIN public.tutor_assignments authorised_assignment
                    ON authorised_assignment.id = $3
                   AND authorised_assignment.tutor_id = r.tutor_id
                  LEFT JOIN public.users u ON u.id = r.student_id
                 WHERE r.tutor_id = $1
                   AND d.tutor_id = $2
                   AND r.student_id IN (SELECT id FROM public.students WHERE tutor_id = $1)
                   AND r.session_container = 'intro_session'
                   AND r.activity_kind = 'intro_diagnosis'
                   AND r.status = 'completed'
                 ORDER BY COALESCE(r.completed_at, r.created_at) DESC
                 LIMIT 90`, [tutorId, tutorId, assignmentId]);
      const liveEvidenceResult = await db.query(
        `SELECT e.source_context_id, e.sequence_number, e.probe_id, e.id AS event_id,
                t.outcome_key, t.outcome_version, t.canonical_observations, t.trajectory_class
           FROM public.specialist_sandbox_live_evidence_turns e
           INNER JOIN private.specialist_sandbox_live_evidence_truth t ON t.event_id = e.id
          WHERE e.scope = 'diagnosis'
            AND e.tutor_assignment_id = $1
            AND e.tutor_id = $2
            AND e.student_id IN (SELECT id FROM public.students WHERE tutor_id = $2)
            AND e.source_context_id IN (
              SELECT r.id FROM public.response_integrity_diagnosis_runs r
               WHERE r.tutor_id = $2 AND r.session_container = 'intro_session'
                 AND r.activity_kind = 'intro_diagnosis' AND r.status = 'completed'
            )
          ORDER BY e.source_context_id, e.sequence_number`,
        [assignmentId, tutorId],
      );
      const liveEvidenceByProbe = new Map(
        liveEvidenceResult.rows.map((capture: any) => [
          `${capture.source_context_id}:${capture.sequence_number}:${capture.probe_id}`, capture
        ])
      );
      const diagnosisRows = diagnosisResult.rows.map((row: any) => {
        const history = Array.isArray(row.probe_history) ? row.probe_history : [];
        const snapshot = row.response_snapshot && typeof row.response_snapshot === "object" ? row.response_snapshot : {};
        const opportunities = Array.isArray(snapshot.opportunities) ? snapshot.opportunities : [];
        const probes = history.map((probe: any, index: number) => {
          const submitted = opportunities.find((opportunity: any) =>
            Number(opportunity?.order) === index + 1 ||
            (opportunity?.probeId && opportunity.probeId === probe?.probeId)
          );
          const observations = Array.isArray(probe?.observations)
            ? probe.observations
            : Array.isArray(submitted?.observations) ? submitted.observations : [];
          const probeId = String(probe?.probeId || submitted?.probeId || "unknown");
          const recorded = observations.map((observation: any) => ({
            dimensionId: String(observation?.dimensionId || ""),
            behaviorId: String(observation?.behaviorId || ""),
          })).filter((observation: any) => observation.dimensionId && observation.behaviorId);
          const capture = liveEvidenceByProbe.get(`${row.id}:${index + 1}:${probeId}`) as any;
          const canonical = capture && Array.isArray(capture.canonical_observations)
            ? capture.canonical_observations.map((observation: any) => ({
                dimensionId: String(observation?.dimensionId || ""),
                behaviorId: String(observation?.behaviorId || ""),
                behaviorLabel: getDiagnosisObservationOption(
                  observation?.dimensionId as any, String(observation?.behaviorId || "")
                )?.label || String(observation?.behaviorId || ""),
              })).filter((observation: any) => observation.dimensionId && observation.behaviorId)
            : [];
          const expectedByDimension = new Map(canonical.map((item: any) => [item.dimensionId, item.behaviorId]));
          const comparisons = recorded.map((item: any) => ({
            dimensionId: item.dimensionId,
            recordedBehaviorId: item.behaviorId,
            expectedBehaviorId: expectedByDimension.get(item.dimensionId) || null,
            expectedBehaviorLabel: canonical.find((entry: any) => entry.dimensionId === item.dimensionId)?.behaviorLabel || null,
            matched: expectedByDimension.has(item.dimensionId) ? expectedByDimension.get(item.dimensionId) === item.behaviorId : null,
          }));
          return {
            sequence: index + 1,
            probeId,
            purpose: String(submitted?.purpose || ""),
            observations: recorded,
            canonicalObservations: canonical,
            comparisons,
            supportEvent: String(probe?.supportEvent || submitted?.supportEvent || "not_recorded"),
            supportRecognitionStatus: "not_authored",
            passiveTiming: probe?.passiveTiming || null,
            canonicalEvidenceAvailable: canonical.length > 0,
            evidenceStatus: canonical.length ? "versioned_outcome_captured" : "canonical_truth_not_captured",
            canonicalOutcomeKey: canonical.length ? String(capture.outcome_key || "") : null,
            canonicalOutcomeVersion: canonical.length ? Number(capture.outcome_version) : null,
            simulatedBehavior: [],
            contaminationStatus: "not_established",
            contaminationReason: null,
          };
        });
        const hasCanonical = probes.some((probe: any) => probe.canonicalEvidenceAvailable);
        return {
          id: String(row.id),
          sourceDrillId: row.source_drill_id ? String(row.source_drill_id) : null,
          studentId: String(row.student_id),
          studentName: row.student_name || null,
          topic: String(row.topic || ""),
          startingPhase: String(row.starting_phase || ""),
          sessionContext: String(row.session_context || ""),
          sessionContainer: String(row.session_container || ""),
          activityKind: String(row.activity_kind || ""),
          status: String(row.status || ""),
          createdAt: row.created_at ? String(row.created_at) : null,
          completedAt: row.completed_at ? String(row.completed_at) : row.submitted_at ? String(row.submitted_at) : null,
          placementPhase: row.decision?.placementPhase || row.decision?.placement_phase || snapshot.placementPhase || null,
          stability: row.decision?.stability || snapshot.placementStability || null,
          probes,
          canonicalEvidenceAvailable: hasCanonical,
          evidenceNotice: hasCanonical
            ? "RI's exact versioned diagnosis outcome was captured for the marked probes. Expected observations are compared with the Specialist's recorded observations. Expected support intervention is not yet independently authored."
            : "This historical diagnosis run has no linked immutable canonical outcome capture. The saved response profile is not treated as canonical truth, and no expected response or support intervention has been reconstructed.",
        };
      });
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
        diagnoses: diagnosisRows,
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
