import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./supabaseAuth";
import { storage, supabase } from "./storage";
import { pool } from "./db";
import { isEmergencyDbMode } from "./emergencyMode";
import {
  NEXT_ACTION_ENGINE,
  tryParsePhase,
  type TopicPhase,
} from "@shared/topicConditioningEngine";
import {
  DIAGNOSIS_PROBES,
  getDiagnosisProbeOpportunityPurpose,
  isDiagnosisBaselineTimingOpportunity,
  isDiagnosisTimedProbe,
  type DiagnosisDimensionId,
  type DiagnosisProbeResult,
} from "@shared/evidenceCompleteDiagnosis";
import {
  behaviorClassToLegacyLevel,
  getDiagnosisObservationOption,
} from "@shared/diagnosisObservationMatrix";
import {
  EVIDENCE_COMPLETE_DIAGNOSIS_DEFINITION_HASH,
  EVIDENCE_COMPLETE_DIAGNOSIS_SCHEMA_ID,
  EVIDENCE_COMPLETE_DIAGNOSIS_SCHEMA_VERSION,
  buildEvidenceCompleteDiagnosisLedgerRows,
  canonicalizeEvidenceJson,
  replayEvidenceCompleteDiagnosis,
} from "@shared/evidenceCompleteDiagnosisSubmission";
import { deriveDiagnosisTpsTimerContract } from "@shared/tpsTimingRuntime";
import {
  loadLatestTpsTimerContract,
  loadTpsTimerContractById,
  persistTpsTimerContract,
  type PersistedTpsTimerContract,
} from "./tpsTimingAuthority";

type DiagnosisRunRow = {
  id: string;
  student_id: string;
  tutor_id: string;
  topic: string;
  starting_phase: TopicPhase;
  scheduled_session_id?: string | null;
  session_context: "intro" | "active_training" | "handover_verification";
  status: "in_progress" | "blocked" | "completed";
  probe_history: DiagnosisProbeResult[] | string | null;
  decision: Record<string, unknown> | string | null;
  source_drill_id?: string | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  timing_policy_version?: number | null;
  timing_authority_contract_id?: string | null;
  timing_authority_baseline_seconds?: number | null;
};

type ScheduledSession = {
  id: string;
  tutor_id: string;
  student_id: string;
  type: "intro" | "training" | "handover";
  status: string;
  scheduled_time?: string | null;
};

const RUN_TABLE = "response_integrity_diagnosis_runs";
const LAUNCHABLE_SESSION_STATUSES = new Set(["confirmed", "scheduled", "ready", "live"]);
const isLaunchableDiagnosisSessionStatus = (
  status: unknown,
  requestedKind: "intro" | "training" | "handover",
) =>
  LAUNCHABLE_SESSION_STATUSES.has(String(status || "")) ||
  (requestedKind === "handover" && String(status || "") === "completed");
const LIVE_SCHEDULING_MODES = new Set(["trial", "certified_live"]);

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const parseJsonValue = <T,>(value: unknown, fallback: T): T => {
  if (value && typeof value === "object") return value as T;
  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const requireTutor = (req: Request, res: Response): string | null => {
  const user = (req as any).dbUser;
  if (!user || user.role !== "tutor") {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return String(user.id || "").trim() || null;
};

async function loadDiagnosisRun(runId: string): Promise<DiagnosisRunRow | null> {
  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT * FROM public.${RUN_TABLE} WHERE id = $1 LIMIT 1`,
      [runId],
    );
    return (result.rows[0] as DiagnosisRunRow | undefined) || null;
  }

  const { data, error } = await supabase
    .from(RUN_TABLE)
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load evidence diagnosis run: ${error.message}`);
  }
  return (data as DiagnosisRunRow | null) || null;
}

async function saveDiagnosisRun(input: {
  runId: string;
  studentId: string;
  tutorId: string;
  topic: string;
  startingPhase: TopicPhase;
  scheduledSessionId: string | null;
  sessionContext: "intro" | "active_training" | "handover_verification";
  status: "in_progress" | "blocked" | "completed";
  probeHistory: DiagnosisProbeResult[];
  decision: Record<string, unknown>;
  sourceDrillId?: string | null;
  completedAt?: string | null;
  timingPolicyVersion?: 1 | null;
  timingAuthorityContractId?: string | null;
  timingAuthorityBaselineSeconds?: number | null;
}) {
  const nowIso = new Date().toISOString();
  const row = {
    id: input.runId,
    student_id: input.studentId,
    tutor_id: input.tutorId,
    topic: input.topic,
    starting_phase: input.startingPhase,
    scheduled_session_id: input.scheduledSessionId,
    session_context: input.sessionContext,
    status: input.status,
    probe_history: input.probeHistory,
    decision: input.decision,
    source_drill_id: input.sourceDrillId || null,
    timing_policy_version: input.timingPolicyVersion ?? 1,
    timing_authority_contract_id: input.timingAuthorityContractId || null,
    timing_authority_baseline_seconds:
      Number.isFinite(Number(input.timingAuthorityBaselineSeconds)) &&
      Number(input.timingAuthorityBaselineSeconds) > 0
        ? Math.max(1, Math.round(Number(input.timingAuthorityBaselineSeconds)))
        : null,
    updated_at: nowIso,
    completed_at: input.completedAt || null,
  };

  if (isEmergencyDbMode()) {
    await pool.query(
      `INSERT INTO public.${RUN_TABLE}
        (id, student_id, tutor_id, topic, starting_phase, scheduled_session_id, session_context,
         status, probe_history, decision, source_drill_id, timing_policy_version,
         timing_authority_contract_id, timing_authority_baseline_seconds, updated_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         scheduled_session_id = EXCLUDED.scheduled_session_id,
         session_context = EXCLUDED.session_context,
         status = EXCLUDED.status,
         probe_history = EXCLUDED.probe_history,
         decision = EXCLUDED.decision,
         source_drill_id = EXCLUDED.source_drill_id,
         timing_policy_version = COALESCE(public.${RUN_TABLE}.timing_policy_version, EXCLUDED.timing_policy_version),
         timing_authority_contract_id = COALESCE(public.${RUN_TABLE}.timing_authority_contract_id, EXCLUDED.timing_authority_contract_id),
         timing_authority_baseline_seconds = COALESCE(public.${RUN_TABLE}.timing_authority_baseline_seconds, EXCLUDED.timing_authority_baseline_seconds),
         updated_at = EXCLUDED.updated_at,
         completed_at = EXCLUDED.completed_at`,
      [
        row.id,
        row.student_id,
        row.tutor_id,
        row.topic,
        row.starting_phase,
        row.scheduled_session_id,
        row.session_context,
        row.status,
        JSON.stringify(row.probe_history),
        JSON.stringify(row.decision),
        row.source_drill_id,
        row.timing_policy_version,
        row.timing_authority_contract_id,
        row.timing_authority_baseline_seconds,
        row.updated_at,
        row.completed_at,
      ],
    );
    return;
  }

  const { error } = await supabase
    .from(RUN_TABLE)
    .upsert(row, { onConflict: "id" });

  if (error) {
    throw new Error(`Failed to persist evidence diagnosis run: ${error.message}`);
  }
}

async function assignmentIsAccepted(student: any, tutorId: string) {
  const enrollmentId = String(
    student?.parentEnrollmentId || student?.parent_enrollment_id || "",
  ).trim();

  if (isEmergencyDbMode()) {
    if (!enrollmentId) return true;
    const result = await pool.query(
      `SELECT status FROM public.parent_enrollments
        WHERE id = $1 AND assigned_tutor_id = $2 LIMIT 1`,
      [enrollmentId, tutorId],
    );
    return result.rows[0]?.status !== "awaiting_tutor_acceptance";
  }

  if (enrollmentId) {
    const { data } = await supabase
      .from("parent_enrollments")
      .select("status")
      .eq("id", enrollmentId)
      .eq("assigned_tutor_id", tutorId)
      .maybeSingle();
    if (data) return data.status !== "awaiting_tutor_acceptance";
  }

  const parentId = String(student?.parentId || student?.parent_id || "").trim();
  if (!parentId) return true;
  const { data } = await supabase
    .from("parent_enrollments")
    .select("status")
    .eq("assigned_tutor_id", tutorId)
    .eq("user_id", parentId)
    .eq("status", "awaiting_tutor_acceptance")
    .maybeSingle();
  return data?.status !== "awaiting_tutor_acceptance";
}

async function getTutorOperationalMode(tutorId: string) {
  const assignment = await storage.getTutorAssignment(tutorId);
  if (!assignment?.id) return "training";

  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT mode FROM public.tutor_battle_test_statuses
        WHERE tutor_assignment_id = $1 LIMIT 1`,
      [assignment.id],
    );
    return String(result.rows[0]?.mode || assignment.operationalMode || "training").trim() || "training";
  }

  const { data } = await supabase
    .from("tutor_battle_test_statuses")
    .select("mode")
    .eq("tutor_assignment_id", assignment.id)
    .maybeSingle();

  return String(data?.mode || assignment.operationalMode || "training").trim() || "training";
}

async function loadScheduledSession(input: {
  tutorId: string;
  studentId: string;
  scheduledSessionId?: string | null;
  requestedKind: "intro" | "training" | "handover";
}): Promise<ScheduledSession | null> {
  const { tutorId, studentId, scheduledSessionId, requestedKind } = input;

  if (isEmergencyDbMode()) {
    const values: unknown[] = [tutorId, studentId];
    let sql = `SELECT id, tutor_id, student_id, type, status, scheduled_time
                 FROM public.scheduled_sessions
                WHERE tutor_id = $1 AND student_id = $2`;
    if (scheduledSessionId) {
      values.push(scheduledSessionId);
      sql += ` AND id = $${values.length}`;
    } else {
      values.push(requestedKind);
      sql += ` AND type = $${values.length} ORDER BY scheduled_time DESC, created_at DESC LIMIT 20`;
    }
    const result = await pool.query(sql, values);
    if (scheduledSessionId) return (result.rows[0] as ScheduledSession | undefined) || null;
    return (result.rows.find((row: any) =>
      isLaunchableDiagnosisSessionStatus(row.status, requestedKind)
    ) as ScheduledSession | undefined) || null;
  }

  let query = supabase
    .from("scheduled_sessions")
    .select("id, tutor_id, student_id, type, status, scheduled_time")
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId);

  if (scheduledSessionId) {
    query = query.eq("id", scheduledSessionId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Failed to validate scheduled session: ${error.message}`);
    return (data as ScheduledSession | null) || null;
  }

  const { data, error } = await query
    .eq("type", requestedKind)
    .order("scheduled_time", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Failed to validate scheduled session: ${error.message}`);

  const rows = (data || []) as ScheduledSession[];
  return rows.find((row) => isLaunchableDiagnosisSessionStatus(row.status, requestedKind)) || null;
}

async function resolveSessionContext(input: {
  tutorId: string;
  studentId: string;
  scheduledSessionId?: string | null;
  requestedKind: "intro" | "training" | "handover";
}) {
  const normalizedScheduledSessionId = String(input.scheduledSessionId || "").trim() || null;
  const operationalMode = await getTutorOperationalMode(input.tutorId);
  let scheduledSession = await loadScheduledSession({
    ...input,
    scheduledSessionId: normalizedScheduledSessionId,
  });

  if (normalizedScheduledSessionId && !scheduledSession) {
    return { error: "The selected diagnosis session could not be found for this student." } as const;
  }

  if (!scheduledSession && LIVE_SCHEDULING_MODES.has(operationalMode)) {
    scheduledSession = await loadScheduledSession({
      ...input,
      scheduledSessionId: null,
    });
    if (!scheduledSession) {
      return {
        error:
          input.requestedKind === "handover"
            ? "A continuity-check session is required before targeted re-diagnosis can run."
            : input.requestedKind === "training"
              ? "A confirmed training lesson is required before re-diagnosis can run."
              : "A confirmed scheduled intro session is required before diagnosis can run.",
      } as const;
    }
  }

  if (scheduledSession && !isLaunchableDiagnosisSessionStatus(scheduledSession.status, input.requestedKind)) {
    return {
      error:
        input.requestedKind === "handover"
          ? "Targeted re-diagnosis is blocked until the continuity-check session is available."
          : scheduledSession.type === "training"
            ? "Diagnosis is blocked until the training lesson is confirmed."
            : "Diagnosis is blocked until the intro session is confirmed.",
    } as const;
  }

  const kind: "intro" | "training" | "handover" =
    scheduledSession?.type === "handover" || input.requestedKind === "handover"
      ? "handover"
      : scheduledSession?.type === "training" || input.requestedKind === "training"
        ? "training"
        : "intro";

  return {
    error: null,
    scheduledSession,
    scheduledSessionId: scheduledSession ? String(scheduledSession.id) : null,
    sessionContext:
      kind === "handover"
        ? "handover_verification" as const
        : kind === "training"
          ? "active_training" as const
          : "intro" as const,
    sessionKind: kind,
  };
}

const canonicalJson = canonicalizeEvidenceJson;

const assertHistoryPrefix = (
  existingHistory: DiagnosisProbeResult[],
  submittedHistory: DiagnosisProbeResult[],
) => {
  if (submittedHistory.length < existingHistory.length) {
    return "Submitted diagnosis history is stale and cannot remove recorded evidence.";
  }

  for (let index = 0; index < existingHistory.length; index += 1) {
    if (canonicalJson(existingHistory[index]) !== canonicalJson(submittedHistory[index])) {
      return `Recorded diagnosis evidence at probe ${index + 1} is immutable and cannot be rewritten.`;
    }
  }
  return null;
};

const LEGACY_FIELD_BY_DIMENSION: Record<DiagnosisDimensionId, string> = {
  "clarity.vocabulary": "vocabulary",
  "clarity.method": "method",
  "clarity.reason": "reason",
  "clarity.immediate_apply": "immediateApply",
  "execution.start": "startBehavior",
  "execution.step_discipline": "stepExecution",
  "execution.repeatability": "repeatability",
  "execution.independence": "independence",
  "difficulty.initial_response": "initialResponse",
  "difficulty.first_step_control": "firstStepControl",
  "difficulty.tolerance": "discomfortTolerance",
  "difficulty.rescue_dependence": "rescueDependence",
  "time.start": "startUnderTime",
  "time.structure": "structureUnderTime",
  "time.pace": "paceControl",
  "time.completion_integrity": "completionIntegrity",
};

const buildCompatibilitySets = (history: DiagnosisProbeResult[]) =>
  history.map((result, index) => {
    const definition = DIAGNOSIS_PROBES[result.probeId];
    return {
      setName: definition.label,
      setId: result.probeId,
      setOrder: index + 1,
      drillSchemaId: EVIDENCE_COMPLETE_DIAGNOSIS_SCHEMA_ID,
      drillSchemaVersion: EVIDENCE_COMPLETE_DIAGNOSIS_SCHEMA_VERSION,
      drillDefinitionHash: EVIDENCE_COMPLETE_DIAGNOSIS_DEFINITION_HASH,
      constraintProfile: {
        ...definition.constraints,
        evidenceQuestion: definition.evidenceQuestion,
        supportEvent: result.supportEvent || "none",
      },
      observations: [
        Object.fromEntries(
          result.observations.flatMap((observation) => {
            const behavior = getDiagnosisObservationOption(
              observation.dimensionId,
              observation.behaviorId,
            );
            if (!behavior) return [];
            const legacyLevel = behaviorClassToLegacyLevel(behavior.behaviorClass);
            if (!legacyLevel) return [];
            return [[
              `${LEGACY_FIELD_BY_DIMENSION[observation.dimensionId]}_level`,
              legacyLevel,
            ]];
          }),
        ),
      ],
    };
  });

async function ensureIntroDrill(input: {
  runId: string;
  studentId: string;
  tutorId: string;
  topic: string;
  startingPhase: TopicPhase;
  scheduledSessionId: string | null;
  sessionKind: "intro" | "training" | "handover";
  replay: Extract<ReturnType<typeof replayEvidenceCompleteDiagnosis>, { ok: true }>;
  timingAuthorityContract?: PersistedTpsTimerContract | null;
}) {
  const { decision, state } = input.replay;
  if (!decision.complete || !decision.placementPhase || !decision.stability) {
    throw new Error("Cannot finalize an incomplete diagnosis");
  }

  const nextActionConfig = NEXT_ACTION_ENGINE[decision.placementPhase][decision.stability];
  const nextAction = nextActionConfig?.primaryAction || "Begin conditioning from the diagnosed entry state.";
  const constraint = nextActionConfig?.rules?.[0] || null;
  const sets = buildCompatibilitySets(state.probeHistory);
  const responseSnapshot = {
    schemaVersion: "evidence-native-v2",
    sourceDrillId: input.runId,
    topic: input.topic,
    mode: input.sessionKind === "handover" ? "handover_rediagnosis" : "diagnosis",
    sessionContextKind: input.sessionKind,
    startingPhase: input.startingPhase,
    placementPhase: decision.placementPhase,
    placementStability: decision.stability,
    confidence: decision.confidence,
    stopReason: decision.reason,
    timingAuthority: input.timingAuthorityContract
      ? {
          contractId: input.timingAuthorityContract.contractId,
          baselineSeconds: input.timingAuthorityContract.baselineSeconds,
          source: input.timingAuthorityContract.baselineSource,
        }
      : null,
    opportunities: state.probeHistory.map((result, index) => ({
      order: index + 1,
      probeId: result.probeId,
      purpose: getDiagnosisProbeOpportunityPurpose(
        result.probeId,
        state.probeHistory.slice(0, index + 1).filter((row) => row.probeId === result.probeId).length,
      ),
      supportEvent: result.supportEvent || "none",
      observations: result.observations,
    })),
  };

  const summary = {
    startingPhase: input.startingPhase,
    phase: decision.placementPhase,
    stability: decision.stability,
    resultingPhase: decision.placementPhase,
    resultingStability: decision.stability,
    diagnosisScore: null,
    ...(input.sessionKind === "handover"
      ? {
          verificationOutcome: "targeted_re_diagnosis_completed" as const,
          verificationOutcomeLabel: "Targeted re-diagnosis completed",
          reDiagnosisRequired: false,
          handoverMode: "targeted_re_diagnosis",
        }
      : {}),
    decisionAuthority: "behavioral_evidence",
    placementEvidence: decision.placementEvidence,
    nextAction,
    constraint,
    diagnosisEngine: "evidence_native_v2",
    confidence: decision.confidence,
    reason: decision.reason,
    pathLength: state.probeHistory.length,
    cleanProbeCount: decision.cleanProbeCount,
    contaminatedProbeCount: decision.contaminatedProbeCount,
    phaseStates: decision.phaseStates,
    timingAuthority: input.timingAuthorityContract
      ? {
          contractId: input.timingAuthorityContract.contractId,
          baselineSeconds: input.timingAuthorityContract.baselineSeconds,
          source: input.timingAuthorityContract.baselineSource,
        }
      : null,
  };

  const drillPayload = JSON.stringify({
    introTopic: input.topic,
    phase: decision.placementPhase,
    startingPhase: input.startingPhase,
    drillType: input.sessionKind === "handover" ? "handover_verification" : "diagnosis",
    handoverMode: input.sessionKind === "handover" ? "targeted_re_diagnosis" : undefined,
    diagnosisMode: "evidence_native",
    diagnosisEngine: "evidence_native_v2",
    scheduledSessionId: input.scheduledSessionId,
    sessionContextKind: input.sessionKind,
    sets,
    probeHistory: state.probeHistory,
    evidence: state.evidence,
    summary,
    responseSnapshot,
  });
  const observedAt = new Date().toISOString();

  if (isEmergencyDbMode()) {
    await pool.query(
      `INSERT INTO public.intro_session_drills
        (id, student_id, tutor_id, drill, scheduled_session_id, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [input.runId, input.studentId, input.tutorId, drillPayload, input.scheduledSessionId, observedAt],
    );
  } else {
    const { error } = await supabase
      .from("intro_session_drills")
      .upsert({
        id: input.runId,
        student_id: input.studentId,
        tutor_id: input.tutorId,
        drill: drillPayload,
        scheduled_session_id: input.scheduledSessionId,
        submitted_at: observedAt,
      }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`Failed to store evidence diagnosis drill: ${error.message}`);
  }

  const ledgerRows = buildEvidenceCompleteDiagnosisLedgerRows({
    sourceDrillId: input.runId,
    studentId: input.studentId,
    tutorId: input.tutorId,
    topic: input.topic,
    scheduledSessionId: input.scheduledSessionId,
    sessionGroupId: input.scheduledSessionId || input.runId,
    sessionContext:
      input.sessionKind === "handover"
        ? "handover_verification"
        : input.sessionKind === "training"
          ? "active_training"
          : "intro",
    observedAt,
    state,
    decision,
  });

  if (isEmergencyDbMode()) {
    for (const row of ledgerRows) {
      const columns = Object.keys(row);
      const values = Object.values(row).map((value) =>
        value && typeof value === "object" ? JSON.stringify(value) : value
      );
      const placeholders = values.map((_, index) => `$${index + 1}`).join(",");
      await pool.query(
        `INSERT INTO public.response_integrity_evidence_ledger
          (${columns.join(",")})
         VALUES (${placeholders})
         ON CONFLICT (evidence_id) DO NOTHING`,
        values,
      );
    }
  } else {
    const { error } = await supabase
      .from("response_integrity_evidence_ledger")
      .upsert(ledgerRows, { onConflict: "evidence_id", ignoreDuplicates: true });
    if (error) throw new Error(`Failed to persist evidence diagnosis ledger: ${error.message}`);
  }

  const freshStudent = await storage.getStudent(input.studentId);
  if (!freshStudent || String(freshStudent.tutorId || "") !== input.tutorId) {
    throw new Error("Student ownership changed before diagnosis finalization");
  }

  const conceptMastery: any =
    freshStudent.conceptMastery && typeof freshStudent.conceptMastery === "object"
      ? { ...(freshStudent.conceptMastery as any) }
      : {};
  const topicConditioning: any =
    conceptMastery.topicConditioning && typeof conceptMastery.topicConditioning === "object"
      ? { ...conceptMastery.topicConditioning }
      : {};
  const topics: Record<string, any> =
    topicConditioning.topics && typeof topicConditioning.topics === "object"
      ? { ...topicConditioning.topics }
      : {};
  const existingKey =
    Object.keys(topics).find((key) => key.trim().toLowerCase() === input.topic.toLowerCase()) ||
    input.topic;
  const existingTopic =
    topics[existingKey] && typeof topics[existingKey] === "object" ? { ...topics[existingKey] } : {};
  const existingHistory = Array.isArray(existingTopic.history) ? [...existingTopic.history] : [];
  const hasRun = existingHistory.some((entry: any) => String(entry?.drillId || "") === input.runId);

  if (!hasRun) {
    existingHistory.push({
      date: observedAt,
      phase: decision.placementPhase,
      stability: decision.stability,
      nextAction,
      observationNotes: `Evidence-complete diagnosis. ${decision.reason}`,
      structuredObservation: {
        drillType: input.sessionKind === "handover" ? "handover_verification" : "diagnosis",
        handoverMode: input.sessionKind === "handover" ? "targeted_re_diagnosis" : undefined,
        diagnosisMode: "evidence_native",
        diagnosisEngine: "evidence_native_v2",
        decisionAuthority: "behavioral_evidence",
        startingPhase: input.startingPhase,
        placementPhase: decision.placementPhase,
        placementEvidence: decision.placementEvidence,
        confidence: decision.confidence,
        pathLength: state.probeHistory.length,
        cleanProbeCount: decision.cleanProbeCount,
        contaminatedProbeCount: decision.contaminatedProbeCount,
        stopReason: decision.reason,
      },
      drillId: input.runId,
    });
  }

  topics[existingKey] = {
    ...existingTopic,
    topic: input.topic,
    phase: decision.placementPhase,
    stability: decision.stability,
    lastUpdated: observedAt,
    nextAction,
    observationNotes: `Evidence-complete diagnosis. ${decision.reason}`,
    diagnosisEngine: "evidence_native_v2",
    diagnosisDecisionAuthority: "behavioral_evidence",
    diagnosisPlacementEvidence: decision.placementEvidence,
    diagnosisConfidence: decision.confidence,
    tpsTimerContractId:
      input.timingAuthorityContract?.contractId ||
      existingTopic.tpsTimerContractId ||
      null,
    tpsTimerBaselineSeconds:
      input.timingAuthorityContract?.baselineSeconds ||
      existingTopic.tpsTimerBaselineSeconds ||
      null,
    requiresTargetedRediagnosis: false,
    targetedRediagnosisStartPhase: null,
    prerequisiteContradictionStatus: null,
    prerequisiteContradictionReason: null,
    history: existingHistory.slice(-60),
  };
  topicConditioning.topic = input.topic;
  topicConditioning.entry_phase = decision.placementPhase;
  topicConditioning.stability = decision.stability;
  topicConditioning.lastUpdatedAt = observedAt;
  topicConditioning.topics = topics;
  conceptMastery.topicConditioning = topicConditioning;

  const existingProfile: any =
    freshStudent.personalProfile && typeof freshStudent.personalProfile === "object"
      ? { ...(freshStudent.personalProfile as any) }
      : {};
  const workflow =
    existingProfile.workflow && typeof existingProfile.workflow === "object"
      ? { ...existingProfile.workflow }
      : {};
  if (input.sessionKind === "intro" && !workflow.introCompletedAt) {
    workflow.introCompletedAt = observedAt;
  }

  await storage.updateStudent(input.studentId, {
    conceptMastery,
    personalProfile: { ...existingProfile, workflow },
  } as any);

  // Topic diagnosis completion must not complete the scheduled intro shell.
  // One intro session may diagnose several topics; closing the session after the first
  // completed topic would block the remaining topic-scoped diagnosis runs.


  return { summary, responseSnapshot, observedAt };
}

const boundTimingBaselineSeconds = (run: DiagnosisRunRow | null) => {
  const value = Number(run?.timing_authority_baseline_seconds);
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : null;
};

const resolveBoundTimingAuthority = async ({
  run,
  studentId,
  topic,
  startingPhase,
}: {
  run: DiagnosisRunRow | null;
  studentId: string;
  topic: string;
  startingPhase: TopicPhase;
}): Promise<PersistedTpsTimerContract | null> => {
  const boundContractId = String(run?.timing_authority_contract_id || "").trim();
  if (boundContractId) {
    const bound = await loadTpsTimerContractById(boundContractId);
    if (!bound) {
      throw new Error("The Timer Contract bound to this diagnosis run is missing.");
    }
    if (
      String(bound.studentId) !== String(studentId) ||
      bound.topic.trim().toLowerCase() !== topic.trim().toLowerCase()
    ) {
      throw new Error("The Timer Contract bound to this diagnosis run does not match the student/topic.");
    }
    return bound;
  }

  if (run) return null;
  if (startingPhase !== "Controlled Discomfort" && startingPhase !== "Time Pressure Stability") {
    return null;
  }
  return loadLatestTpsTimerContract({ studentId, topic });
};

const responseForLegacyCompletedRun = (run: DiagnosisRunRow) => {
  const history = parseJsonValue<DiagnosisProbeResult[]>(run.probe_history, []);
  const storedDecision = parseJsonValue<Record<string, any>>(run.decision, {});
  const placementPhase = tryParsePhase(storedDecision.placementPhase);
  const stability = String(storedDecision.stability || "").trim();
  return {
    success: true,
    runId: run.id,
    finalized: true,
    sourceDrillId: run.source_drill_id || run.id,
    startingPhase: run.starting_phase,
    probeHistory: history,
    decision: {
      ...storedDecision,
      complete: true,
      placementPhase: placementPhase || storedDecision.placementPhase || run.starting_phase,
      stability: stability || null,
      timingBaseline: {
        requiredSampleCount: 3,
        sampleCount: 0,
        ready: false,
        baselineSeconds: null,
        source: "none",
      },
    },
    nextProbe: null,
    opportunityNumber: null,
    opportunityPurpose: null,
    timingAuthority: {
      mode: "none",
      requiredSampleCount: 3,
      sampleCount: 0,
      baselineReady: false,
      baselineSeconds: null,
      prescribedSeconds: null,
      contractId: null,
      legacyHistoricalRun: true,
    },
  };
};

const responseForReplay = (
  runId: string,
  replay: Extract<ReturnType<typeof replayEvidenceCompleteDiagnosis>, { ok: true }>,
  finalized: boolean,
  sourceDrillId?: string | null,
  timingAuthorityContractId?: string | null,
) => {
  const nextProbeId = replay.decision.nextProbeId;
  const occurrenceNumber = nextProbeId
    ? replay.state.probeHistory.filter((row) => row.probeId === nextProbeId).length + 1
    : null;
  const currentProbeTimingMode = nextProbeId
    ? isDiagnosisTimedProbe(nextProbeId)
      ? "timed"
      : isDiagnosisBaselineTimingOpportunity(nextProbeId)
        ? "passive_baseline"
        : "none"
    : "none";

  return {
    success: true,
    runId,
    finalized,
    sourceDrillId: sourceDrillId || null,
    startingPhase: replay.state.recommendedStartingPhase,
    probeHistory: replay.state.probeHistory,
    decision: replay.decision,
    nextProbe: replay.nextProbe,
    opportunityNumber: occurrenceNumber,
    opportunityPurpose:
      nextProbeId && occurrenceNumber
        ? getDiagnosisProbeOpportunityPurpose(nextProbeId, occurrenceNumber)
        : null,
    timingAuthority: {
      mode: currentProbeTimingMode,
      requiredSampleCount: replay.decision.timingBaseline.requiredSampleCount,
      sampleCount: replay.decision.timingBaseline.sampleCount,
      baselineReady: replay.decision.timingBaseline.ready,
      baselineSeconds: replay.decision.timingBaseline.baselineSeconds,
      prescribedSeconds:
        currentProbeTimingMode === "timed"
          ? replay.decision.timingBaseline.baselineSeconds
          : null,
      contractId: timingAuthorityContractId || null,
      legacyHistoricalRun: false,
    },
  };
};

export function registerEvidenceCompleteDiagnosisRoutes(app: Express) {
  app.get(
    "/api/tutor/evidence-complete-diagnosis/:runId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const tutorId = requireTutor(req, res);
        if (!tutorId) return;
        const runId = String(req.params.runId || "").trim();
        if (!isUuid(runId)) return res.status(400).json({ message: "Invalid diagnosis run ID" });

        const run = await loadDiagnosisRun(runId);
        if (!run) return res.status(404).json({ message: "Diagnosis run not found" });
        if (String(run.tutor_id) !== tutorId) {
          return res.status(403).json({ message: "Diagnosis run does not belong to this specialist" });
        }

        if (run.status === "completed" && run.timing_policy_version !== 1) {
          return res.json(responseForLegacyCompletedRun(run));
        }

        const history = parseJsonValue<DiagnosisProbeResult[]>(run.probe_history, []);
        const boundContract = await resolveBoundTimingAuthority({
          run,
          studentId: run.student_id,
          topic: run.topic,
          startingPhase: run.starting_phase,
        });
        const replay = replayEvidenceCompleteDiagnosis(
          run.starting_phase,
          history,
          boundContract?.baselineSeconds ?? boundTimingBaselineSeconds(run),
        );
        if (replay.ok === false) {
          return res.status(409).json({ message: `Stored diagnosis evidence is invalid: ${replay.error}` });
        }

        return res.json(responseForReplay(
          run.id,
          replay,
          run.status === "completed",
          run.source_drill_id,
          boundContract?.contractId || run.timing_authority_contract_id || null,
        ));
      } catch (error) {
        console.error("[EVIDENCE_DIAGNOSIS] load failed", error);
        return res.status(500).json({ message: "Failed to load diagnosis run" });
      }
    },
  );

  app.post(
    "/api/tutor/evidence-complete-diagnosis",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const tutorId = requireTutor(req, res);
        if (!tutorId) return;

        const runId = String(req.body?.diagnosisRunId || "").trim();
        const studentId = String(req.body?.studentId || "").trim();
        const topic = String(req.body?.topic || "").trim();
        const startingPhase = tryParsePhase(req.body?.startingPhase);
        const scheduledSessionId = String(req.body?.scheduledSessionId || "").trim() || null;
        const requestedContext = String(req.body?.sessionContextKind || "").trim().toLowerCase();
        const requestedKind =
          requestedContext === "handover"
            ? "handover" as const
            : requestedContext === "training"
              ? "training" as const
              : "intro" as const;

        if (!isUuid(runId)) return res.status(400).json({ message: "A valid diagnosisRunId is required" });
        if (!studentId) return res.status(400).json({ message: "studentId is required" });
        if (!topic || topic.length > 200) return res.status(400).json({ message: "A valid diagnosis topic is required" });
        if (!startingPhase) return res.status(400).json({ message: "A valid starting phase is required" });

        const student = await storage.getStudent(studentId);
        if (!student || String(student.tutorId || "") !== tutorId) {
          return res.status(403).json({ message: "Student does not belong to this specialist" });
        }
        if (!(await assignmentIsAccepted(student, tutorId))) {
          return res.status(403).json({ message: "Accept this assignment before running diagnosis" });
        }

        const existingRun = await loadDiagnosisRun(runId);
        if (existingRun) {
          const identityMismatch =
            String(existingRun.student_id) !== studentId ||
            String(existingRun.tutor_id) !== tutorId ||
            String(existingRun.topic).trim().toLowerCase() !== topic.toLowerCase() ||
            existingRun.starting_phase !== startingPhase;
          if (identityMismatch) {
            return res.status(409).json({ message: "Diagnosis run identity cannot be reassigned" });
          }
          if (
            scheduledSessionId &&
            existingRun.scheduled_session_id &&
            String(existingRun.scheduled_session_id) !== scheduledSessionId
          ) {
            return res.status(409).json({ message: "Diagnosis run session lineage cannot be reassigned" });
          }
          const submittedContext = String(req.body?.sessionContextKind || "").trim().toLowerCase();
          if (
            submittedContext &&
            ((existingRun.session_context === "active_training" && submittedContext !== "training") ||
              (existingRun.session_context === "handover_verification" && submittedContext !== "handover") ||
              (existingRun.session_context === "intro" && submittedContext !== "intro"))
          ) {
            return res.status(409).json({ message: "Diagnosis run session context cannot be reassigned" });
          }

          if (existingRun.status === "completed") {
            if (existingRun.timing_policy_version !== 1) {
              return res.json(responseForLegacyCompletedRun(existingRun));
            }
            const storedHistory = parseJsonValue<DiagnosisProbeResult[]>(existingRun.probe_history, []);
            const completedBoundContract = await resolveBoundTimingAuthority({
              run: existingRun,
              studentId,
              topic,
              startingPhase,
            });
            const storedReplay = replayEvidenceCompleteDiagnosis(
              existingRun.starting_phase,
              storedHistory,
              completedBoundContract?.baselineSeconds ??
                boundTimingBaselineSeconds(existingRun),
            );
            if (storedReplay.ok === false) {
              return res.status(409).json({ message: "Completed diagnosis evidence is internally inconsistent" });
            }
            return res.json(responseForReplay(
              runId,
              storedReplay,
              true,
              existingRun.source_drill_id || runId,
              completedBoundContract?.contractId ||
                existingRun.timing_authority_contract_id ||
                null,
            ));
          }
        }

        const preexistingTimingContract = await resolveBoundTimingAuthority({
          run: existingRun,
          studentId,
          topic,
          startingPhase,
        });
        const replay = replayEvidenceCompleteDiagnosis(
          startingPhase,
          req.body?.probeHistory || [],
          preexistingTimingContract?.baselineSeconds ??
            boundTimingBaselineSeconds(existingRun),
        );
        if (replay.ok === false) {
          return res.status(400).json({
            message: replay.error,
            failedAtProbeIndex: replay.failedAtProbeIndex ?? null,
          });
        }

        if (existingRun) {
          const storedHistory = parseJsonValue<DiagnosisProbeResult[]>(existingRun.probe_history, []);
          const prefixError = assertHistoryPrefix(storedHistory, replay.state.probeHistory);
          if (prefixError) return res.status(409).json({ message: prefixError });
        }

        let effectiveTimingContract = preexistingTimingContract;
        if (
          !effectiveTimingContract &&
          replay.decision.timingBaseline.ready &&
          replay.decision.timingBaseline.source === "diagnosis_run"
        ) {
          const diagnosisContract = deriveDiagnosisTpsTimerContract({
            state: replay.state,
            studentId,
            topic,
            sourceEpochKey: `diagnosis-v1:${runId}`,
            baselineGroupId: `diagnosis:${runId}`,
          });
          if (!diagnosisContract) {
            return res.status(409).json({
              message:
                "Diagnosis timing evidence reports ready but the Timer Contract could not be derived. Do not run a timed probe.",
            });
          }
          effectiveTimingContract = await persistTpsTimerContract({
            contract: diagnosisContract,
            tutorId,
          });
        }

        const effectiveTimingContractId =
          effectiveTimingContract?.contractId ||
          existingRun?.timing_authority_contract_id ||
          null;
        const effectiveTimingBaselineSeconds =
          effectiveTimingContract?.baselineSeconds ??
          boundTimingBaselineSeconds(existingRun);

        const effectiveScheduledSessionId =
          String(existingRun?.scheduled_session_id || scheduledSessionId || "").trim() || null;
        const effectiveRequestedKind =
          existingRun?.session_context === "handover_verification"
            ? "handover" as const
            : existingRun?.session_context === "active_training"
              ? "training" as const
              : existingRun?.session_context === "intro"
                ? "intro" as const
                : requestedKind;

        const sessionResult = await resolveSessionContext({
          tutorId,
          studentId,
          scheduledSessionId: effectiveScheduledSessionId,
          requestedKind: effectiveRequestedKind,
        });
        if (sessionResult.error) {
          return res.status(400).json({ message: sessionResult.error });
        }

        const runStatus = replay.decision.complete
          ? "in_progress"
          : replay.decision.nextProbeId
            ? "in_progress"
            : "blocked";

        await saveDiagnosisRun({
          runId,
          studentId,
          tutorId,
          topic,
          startingPhase,
          scheduledSessionId: sessionResult.scheduledSessionId,
          sessionContext: sessionResult.sessionContext,
          status: runStatus,
          probeHistory: replay.state.probeHistory,
          decision: replay.decision as unknown as Record<string, unknown>,
          timingPolicyVersion: 1,
          timingAuthorityContractId: effectiveTimingContractId,
          timingAuthorityBaselineSeconds: effectiveTimingBaselineSeconds,
        });

        if (!replay.decision.complete) {
          return res.json(
            responseForReplay(
              runId,
              replay,
              false,
              null,
              effectiveTimingContractId,
            ),
          );
        }

        const finalized = await ensureIntroDrill({
          runId,
          studentId,
          tutorId,
          topic,
          startingPhase,
          scheduledSessionId: sessionResult.scheduledSessionId,
          sessionKind: sessionResult.sessionKind,
          replay,
          timingAuthorityContract: effectiveTimingContract,
        });

        await saveDiagnosisRun({
          runId,
          studentId,
          tutorId,
          topic,
          startingPhase,
          scheduledSessionId: sessionResult.scheduledSessionId,
          sessionContext: sessionResult.sessionContext,
          status: "completed",
          probeHistory: replay.state.probeHistory,
          decision: replay.decision as unknown as Record<string, unknown>,
          sourceDrillId: runId,
          completedAt: finalized.observedAt,
          timingPolicyVersion: 1,
          timingAuthorityContractId: effectiveTimingContractId,
          timingAuthorityBaselineSeconds: effectiveTimingBaselineSeconds,
        });

        return res.json({
          ...responseForReplay(
            runId,
            replay,
            true,
            runId,
            effectiveTimingContractId,
          ),
          summary: finalized.summary,
          responseSnapshot: finalized.responseSnapshot,
        });
      } catch (error) {
        console.error("[EVIDENCE_DIAGNOSIS] submission failed", error);
        return res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to process diagnosis evidence",
        });
      }
    },
  );
}
