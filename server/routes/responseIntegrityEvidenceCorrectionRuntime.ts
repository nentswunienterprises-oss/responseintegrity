import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../supabaseAuth";
import { storage, supabase } from "../storage";
import {
  applyApprovedEvidenceCorrections,
  decodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
  resolveObservationCorrectionProposal,
  validateActualSupportCorrection,
  type ApprovedEvidenceCorrection,
  type CorrectionSourceEvidenceRow,
} from "../../shared/responseIntegrityEvidenceCorrection";
import type { ActualSupportUsedV2 } from "../../shared/responseIntegrityEvidenceContractV2";
import {
  replayCorrectedTopicLineage,
  type CorrectionReplayEvent,
} from "../../shared/responseIntegrityCorrectionReplay";
import {
  normalizeStability,
  tryParsePhase,
  type TopicPhase,
  type TopicStability,
} from "../../shared/topicConditioningEngine";

const clean = (value: unknown) => String(value || "").trim();
const topicKey = (value: unknown) => clean(value).toLowerCase();

export type EffectiveCorrectionDrillRow = {
  id: string;
  student_id: string;
  tutor_id: string;
  submitted_at: string;
  scheduled_session_id?: string | null;
  training_session_run_id?: string | null;
  drill: Record<string, any>;
};

export type CorrectionRuntimeHooks = {
  regenerateAffectedReports?: (input: {
    correctionId: string;
    studentId: string;
    tutorId: string;
    topic: string;
    sourceDrillId: string;
    sourceSubmittedAt: string;
    effectiveDrillRows: EffectiveCorrectionDrillRow[];
  }) => Promise<unknown>;
  reconcileTpsTimerContract?: (input: {
    correctionId: string;
    student: any;
    studentId: string;
    tutorId: string;
    topic: string;
    sourceDrillId: string;
    effectiveDrillRows: EffectiveCorrectionDrillRow[];
  }) => Promise<unknown>;
};

type StoredCorrectionRow = {
  correction_id: string;
  correction_kind: "observation_option" | "actual_support_used";
  source_evidence_id?: string | null;
  source_drill_id: string;
  student_id: string;
  tutor_id: string;
  topic: string;
  block_order: number;
  set_id: string;
  set_order: number;
  rep_id: string;
  rep_number: number;
  dimension_id?: string | null;
  field_key?: string | null;
  drill_type: "diagnosis" | "training" | "verification";
  phase: TopicPhase;
  drill_schema_id: string;
  drill_schema_version: number;
  drill_definition_hash: string;
  original_option_id?: string | null;
  original_raw_option?: string | null;
  original_normalized_level?: "weak" | "partial" | "clear" | null;
  proposed_option_id?: string | null;
  proposed_raw_option?: string | null;
  proposed_normalized_level?: "weak" | "partial" | "clear" | null;
  original_actual_support_used?: ActualSupportUsedV2 | null;
  proposed_actual_support_used?: ActualSupportUsedV2 | null;
  reason_code: string;
  reason_text: string;
  raised_by_user_id: string;
  raised_by_role: "tutor" | "td" | "coo";
  supersedes_correction_id?: string | null;
  created_at: string;
};

const toApprovedCorrection = (row: StoredCorrectionRow): ApprovedEvidenceCorrection => ({
  correctionId: row.correction_id,
  correctionKind: row.correction_kind,
  sourceEvidenceId: row.source_evidence_id || null,
  sourceDrillId: row.source_drill_id,
  blockOrder: Number(row.block_order),
  setId: row.set_id,
  setOrder: Number(row.set_order),
  repId: row.rep_id,
  repNumber: Number(row.rep_number),
  dimensionId: row.dimension_id || null,
  fieldKey: row.field_key || null,
  drillType: row.drill_type,
  phase: row.phase,
  drillSchemaId: row.drill_schema_id,
  drillSchemaVersion: Number(row.drill_schema_version),
  drillDefinitionHash: row.drill_definition_hash,
  originalOptionId: row.original_option_id || null,
  originalRawOption: row.original_raw_option || null,
  originalNormalizedLevel: row.original_normalized_level || null,
  proposedOptionId: row.proposed_option_id || null,
  proposedRawOption: row.proposed_raw_option || null,
  proposedNormalizedLevel: row.proposed_normalized_level || null,
  originalActualSupportUsed: row.original_actual_support_used || null,
  proposedActualSupportUsed: row.proposed_actual_support_used || null,
});

const requireRole = (req: Request, res: Response, roles: string[]) => {
  const user = (req as any).dbUser;
  if (!user?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  const role = clean(user.role).toLowerCase();
  if (!roles.includes(role)) {
    res.status(403).json({ message: "This evidence-correction action is not authorized for your role." });
    return null;
  }
  return { ...user, role };
};

const requireOwnedStudent = async (studentId: string, tutorId: string, res: Response) => {
  const student = await storage.getStudent(studentId);
  if (!student || clean((student as any).tutorId) !== tutorId) {
    res.status(403).json({ message: "The correction source is outside this Specialist's assigned student scope." });
    return null;
  }
  return student as any;
};

const parseDrill = (value: unknown): Record<string, any> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const drillTopic = (drill: Record<string, any>) => clean(
  drill.trainingTopic || drill.introTopic || drill.handoverTopic || drill.inheritedTopic || drill.topic,
);

const loadDrill = async (sourceDrillId: string) => {
  const { data, error } = await supabase
    .from("intro_session_drills")
    .select("id, student_id, tutor_id, submitted_at, scheduled_session_id, training_session_run_id, drill")
    .eq("id", sourceDrillId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load correction source drill: ${error.message}`);
  return data || null;
};

const loadCorrection = async (correctionId: string): Promise<StoredCorrectionRow | null> => {
  const { data, error } = await supabase
    .from("response_integrity_evidence_corrections")
    .select("*")
    .eq("correction_id", correctionId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load evidence correction: ${error.message}`);
  return (data as StoredCorrectionRow | null) || null;
};

const loadReview = async (correctionId: string) => {
  const { data, error } = await supabase
    .from("response_integrity_evidence_correction_reviews")
    .select("*")
    .eq("correction_id", correctionId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load correction review: ${error.message}`);
  return data || null;
};

const loadApprovedCorrections = async (studentId: string, topic: string): Promise<StoredCorrectionRow[]> => {
  const { data: corrections, error: correctionError } = await supabase
    .from("response_integrity_evidence_corrections")
    .select("*")
    .eq("student_id", studentId)
    .eq("topic", topic)
    .order("created_at", { ascending: true });
  if (correctionError) throw new Error(`Failed to load topic corrections: ${correctionError.message}`);
  if (!corrections?.length) return [];

  const ids = corrections.map((row: any) => row.correction_id);
  const { data: reviews, error: reviewError } = await supabase
    .from("response_integrity_evidence_correction_reviews")
    .select("correction_id, outcome")
    .in("correction_id", ids);
  if (reviewError) throw new Error(`Failed to load topic correction reviews: ${reviewError.message}`);
  const approved = new Set((reviews || []).filter((review: any) => review.outcome === "approved").map((review: any) => review.correction_id));
  return (corrections as StoredCorrectionRow[]).filter((row) => approved.has(row.correction_id));
};

const latestApprovedTargetCorrection = async ({
  studentId,
  topic,
  sourceEvidenceId,
  sourceDrillId,
  blockOrder,
  setId,
  repId,
  correctionKind,
}: {
  studentId: string;
  topic: string;
  sourceEvidenceId?: string | null;
  sourceDrillId: string;
  blockOrder: number;
  setId: string;
  repId: string;
  correctionKind: "observation_option" | "actual_support_used";
}) => {
  const approved = await loadApprovedCorrections(studentId, topic);
  return [...approved].reverse().find((row) => {
    if (row.correction_kind !== correctionKind) return false;
    if (sourceEvidenceId) return row.source_evidence_id === sourceEvidenceId;
    return row.source_drill_id === sourceDrillId &&
      Number(row.block_order) === blockOrder &&
      row.set_id === setId &&
      row.rep_id === repId;
  }) || null;
};

const ensureNoPendingTargetCorrection = async (input: {
  sourceEvidenceId?: string | null;
  sourceDrillId: string;
  blockOrder: number;
  setId: string;
  repId: string;
  correctionKind: "observation_option" | "actual_support_used";
}) => {
  let query = supabase
    .from("response_integrity_evidence_corrections")
    .select("correction_id")
    .eq("correction_kind", input.correctionKind)
    .eq("source_drill_id", input.sourceDrillId)
    .eq("block_order", input.blockOrder)
    .eq("set_id", input.setId)
    .eq("rep_id", input.repId);
  if (input.sourceEvidenceId) query = query.eq("source_evidence_id", input.sourceEvidenceId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error(`Failed to check existing correction requests: ${error.message}`);
  if (!data?.length) return;
  const ids = data.map((row: any) => row.correction_id);
  const { data: reviews } = await supabase
    .from("response_integrity_evidence_correction_reviews")
    .select("correction_id")
    .in("correction_id", ids);
  const reviewed = new Set((reviews || []).map((row: any) => row.correction_id));
  const pending = data.find((row: any) => !reviewed.has(row.correction_id));
  if (pending) throw new Error("A correction request for this exact source fact is already awaiting review.");
};

const loadSourceEvidence = async (sourceEvidenceId: string): Promise<CorrectionSourceEvidenceRow | null> => {
  const { data, error } = await supabase
    .from("response_integrity_evidence_ledger")
    .select("*")
    .eq("evidence_id", sourceEvidenceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load correction source evidence: ${error.message}`);
  return (data as CorrectionSourceEvidenceRow | null) || null;
};

const reviewerCanApprove = async (reviewer: any, correction: StoredCorrectionRow) => {
  if (reviewer.id === correction.raised_by_user_id) return false;
  if (reviewer.role === "coo") return true;
  if (reviewer.role !== "td") return false;
  const assignment = await storage.getTutorAssignment(correction.tutor_id);
  const pod = (assignment as any)?.pod;
  return clean(pod?.tdId || pod?.td_id) === clean(reviewer.id);
};

const eventKindFor = (drill: Record<string, any>): CorrectionReplayEvent["kind"] => {
  const drillType = clean(drill.drillType).toLowerCase();
  if (drillType === "training") return "training";
  if (drillType === "inherited_verification") return "inherited_verification";
  if (drillType === "handover_verification") return "handover_verification";
  return "diagnosis";
};

const observedPhaseFor = (drill: Record<string, any>): TopicPhase | null => tryParsePhase(
  drill.summary?.observedPhase ||
  drill.targetPhase ||
  drill.summary?.targetPhase ||
  drill.startingPhase ||
  drill.summary?.startingPhase ||
  drill.phase ||
  drill.summary?.phase,
);

const loadTopicDrillRows = async (studentId: string, topic: string): Promise<EffectiveCorrectionDrillRow[]> => {
  const { data, error } = await supabase
    .from("intro_session_drills")
    .select("id, student_id, tutor_id, submitted_at, scheduled_session_id, training_session_run_id, drill")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: true })
    .limit(2000);
  if (error) throw new Error(`Failed to load topic lineage: ${error.message}`);
  return (data || [])
    .map((row: any) => ({ ...row, drill: parseDrill(row.drill) }))
    .filter((row: any) => row.drill && topicKey(drillTopic(row.drill)) === topicKey(topic)) as EffectiveCorrectionDrillRow[];
};

const correctionReplayStart = async (correction: StoredCorrectionRow, sourceDrill: any) => {
  const { data: ledgerRow } = await supabase
    .from("response_integrity_evidence_ledger")
    .select("state_phase_before, stability_before, phase")
    .eq("source_drill_id", correction.source_drill_id)
    .order("block_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  const drill = parseDrill(sourceDrill?.drill) || {};
  const phase = tryParsePhase(ledgerRow?.state_phase_before || ledgerRow?.phase || drill.summary?.observedPhase || drill.phase || correction.phase)
    || correction.phase;
  const stability = normalizeStability(
    ledgerRow?.stability_before || drill.summary?.previousStability || drill.previousStability || "Low",
  );
  return { phase, stability };
};

const buildReplayEvents = async ({
  correction,
  currentCorrection,
}: {
  correction: StoredCorrectionRow;
  currentCorrection: ApprovedEvidenceCorrection;
}) => {
  const rows = await loadTopicDrillRows(correction.student_id, correction.topic);
  const sourceIndex = rows.findIndex((row) => row.id === correction.source_drill_id);
  if (sourceIndex < 0) throw new Error("The correction source drill is no longer available for replay.");
  const approved = await loadApprovedCorrections(correction.student_id, correction.topic);
  const approvedWithCurrent = [
    ...approved.filter((row) => row.correction_id !== correction.correction_id).map(toApprovedCorrection),
    currentCorrection,
  ];

  const replayRows = rows.slice(sourceIndex);
  const events: CorrectionReplayEvent[] = replayRows.map((row) => {
    const drill = row.drill;
    const observedPhase = observedPhaseFor(drill);
    if (!observedPhase) throw new Error(`Drill ${row.id} is missing a replayable phase.`);
    const kind = eventKindFor(drill);
    const sets = Array.isArray(drill.sets) ? drill.sets : [];
    return {
      sourceDrillId: row.id,
      submittedAt: clean(row.submitted_at),
      kind,
      observedPhase,
      sets,
      corrections: approvedWithCurrent.filter((item) => item.sourceDrillId === row.id),
      storedResultingPhase: tryParsePhase(drill.summary?.resultingPhase || drill.summary?.phase) || null,
      storedResultingStability: drill.summary?.resultingStability || drill.summary?.stability
        ? normalizeStability(drill.summary?.resultingStability || drill.summary?.stability)
        : null,
      inheritedVerificationMode: clean(drill.inheritedVerificationMode).toLowerCase() === "targeted_re_diagnosis"
        ? "targeted_re_diagnosis"
        : kind === "inherited_verification"
          ? "verification"
          : null,
    };
  });
  return { rows, replayRows, events, sourceRow: rows[sourceIndex] };
};

const updateEffectiveRowsFromReplay = ({
  rows,
  replay,
}: {
  rows: EffectiveCorrectionDrillRow[];
  replay: ReturnType<typeof replayCorrectedTopicLineage>;
}) => {
  const lineageById = new Map(replay.lineage.map((entry) => [entry.sourceDrillId, entry]));
  return rows.map((row) => {
    const lineage = lineageById.get(row.id);
    const sets = replay.effectiveSetsByDrillId[row.id];
    if (!lineage && !sets) return row;
    const drill = JSON.parse(JSON.stringify(row.drill || {}));
    if (sets) drill.sets = sets;
    if (lineage) {
      drill.summary = {
        ...(drill.summary || {}),
        observedPhase: lineage.phaseBefore,
        previousStability: lineage.stabilityBefore,
        phase: lineage.phaseAfter,
        stability: lineage.stabilityAfter,
        transitionReason: lineage.reason,
        correctionReplayStatus: lineage.status,
      };
    }
    return { ...row, drill };
  });
};

const updateActiveTopicState = async ({
  correction,
  replay,
  replayId,
}: {
  correction: StoredCorrectionRow;
  replay: ReturnType<typeof replayCorrectedTopicLineage>;
  replayId: string;
}) => {
  const student = await storage.getStudent(correction.student_id) as any;
  if (!student) throw new Error("Student no longer exists while applying correction replay.");
  const conceptMastery = JSON.parse(JSON.stringify(student.conceptMastery || student.concept_mastery || {}));
  const store = conceptMastery.topicConditioning && typeof conceptMastery.topicConditioning === "object"
    ? conceptMastery.topicConditioning
    : {};
  const topics = store.topics && typeof store.topics === "object" ? store.topics : {};
  const existingKey = Object.keys(topics).find((key) => topicKey(key) === topicKey(correction.topic)) || correction.topic;
  const previous = topics[existingKey] && typeof topics[existingKey] === "object" ? topics[existingKey] : {};
  const history = Array.isArray(previous.history) ? previous.history : [];
  const now = new Date().toISOString();
  topics[existingKey] = {
    ...previous,
    phase: replay.resultingPhase,
    stability: replay.resultingStability,
    inheritedVerificationHold: replay.pendingInheritedVerificationHold,
    correctionRediagnosisRequired: replay.requiresFreshRediagnosis,
    lastUpdatedAt: now,
    history: [
      ...history,
      {
        phase: replay.resultingPhase,
        stability: replay.resultingStability,
        at: now,
        source: "evidence_correction_replay",
        correctionId: correction.correction_id,
        replayId,
      },
    ],
  };
  store.topics = topics;
  store.topic = correction.topic;
  store.stability = replay.resultingStability;
  store.lastUpdatedAt = now;
  conceptMastery.topicConditioning = store;
  await storage.updateStudent(correction.student_id, { conceptMastery } as any);
  return student;
};

const persistReplay = async ({
  replayId,
  correction,
  replay,
  startingPhase,
  startingStability,
}: {
  replayId: string;
  correction: StoredCorrectionRow;
  replay: ReturnType<typeof replayCorrectedTopicLineage>;
  startingPhase: TopicPhase;
  startingStability: TopicStability;
}) => {
  const row = {
    replay_id: replayId,
    correction_id: correction.correction_id,
    student_id: correction.student_id,
    topic: correction.topic,
    replay_version: 1,
    replay_from_source_drill_id: correction.source_drill_id,
    starting_phase: startingPhase,
    starting_stability: startingStability,
    resulting_phase: replay.resultingPhase,
    resulting_stability: replay.resultingStability,
    replayed_event_count: replay.replayedEventCount,
    skipped_event_count: replay.skippedEventCount,
    replay_lineage: replay.lineage,
    replayed_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase
    .from("response_integrity_topic_replay_runs")
    .select("replay_id")
    .eq("correction_id", correction.correction_id)
    .maybeSingle();
  if (existing?.replay_id) return existing.replay_id as string;
  const { error } = await supabase.from("response_integrity_topic_replay_runs").insert(row);
  if (error && error.code !== "23505") throw new Error(`Failed to persist correction replay: ${error.message}`);
  return replayId;
};

const processApprovedCorrection = async (
  correction: StoredCorrectionRow,
  hooks: CorrectionRuntimeHooks,
) => {
  const sourceDrill = await loadDrill(correction.source_drill_id);
  if (!sourceDrill) throw new Error("Correction source drill no longer exists.");
  const currentCorrection = toApprovedCorrection(correction);
  const { rows, events, sourceRow } = await buildReplayEvents({ correction, currentCorrection });
  const starting = await correctionReplayStart(correction, sourceDrill);
  const replay = replayCorrectedTopicLineage({
    startingPhase: starting.phase,
    startingStability: starting.stability,
    events,
  });
  const effectiveDrillRows = updateEffectiveRowsFromReplay({ rows, replay });
  const replayId = randomUUID();
  const persistedReplayId = await persistReplay({
    replayId,
    correction,
    replay,
    startingPhase: starting.phase,
    startingStability: starting.stability,
  });
  const studentBeforeUpdate = await updateActiveTopicState({ correction, replay, replayId: persistedReplayId });

  const tpsResult = hooks.reconcileTpsTimerContract
    ? await hooks.reconcileTpsTimerContract({
        correctionId: correction.correction_id,
        student: studentBeforeUpdate,
        studentId: correction.student_id,
        tutorId: correction.tutor_id,
        topic: correction.topic,
        sourceDrillId: correction.source_drill_id,
        effectiveDrillRows,
      })
    : null;

  const reportResult = hooks.regenerateAffectedReports
    ? await hooks.regenerateAffectedReports({
        correctionId: correction.correction_id,
        studentId: correction.student_id,
        tutorId: correction.tutor_id,
        topic: correction.topic,
        sourceDrillId: correction.source_drill_id,
        sourceSubmittedAt: sourceRow.submitted_at,
        effectiveDrillRows,
      })
    : null;

  return { replayId: persistedReplayId, replay, tpsResult, reportResult };
};

const createObservationCorrection = async (req: Request, res: Response, user: any) => {
  const sourceEvidenceId = clean(req.body?.sourceEvidenceId);
  const proposedOptionId = clean(req.body?.proposedOptionId);
  const reasonCode = clean(req.body?.reasonCode);
  const reasonText = clean(req.body?.reasonText);
  if (!sourceEvidenceId || !proposedOptionId || !reasonCode || !reasonText) {
    return res.status(400).json({ message: "sourceEvidenceId, proposedOptionId, reasonCode, and reasonText are required." });
  }
  const source = await loadSourceEvidence(sourceEvidenceId);
  if (!source) return res.status(404).json({ message: "Source evidence not found." });
  if (clean(source.tutor_id) !== clean(user.id)) return res.status(403).json({ message: "Only the submitting Specialist can raise this source correction." });
  if (!await requireOwnedStudent(source.student_id, user.id, res)) return;
  const sourceDrill = await loadDrill(source.source_drill_id);
  if (!sourceDrill) return res.status(404).json({ message: "Source drill not found." });

  await ensureNoPendingTargetCorrection({
    sourceEvidenceId,
    sourceDrillId: source.source_drill_id,
    blockOrder: source.block_order,
    setId: source.set_id,
    repId: source.rep_id,
    correctionKind: "observation_option",
  });
  const previous = await latestApprovedTargetCorrection({
    studentId: source.student_id,
    topic: source.topic,
    sourceEvidenceId,
    sourceDrillId: source.source_drill_id,
    blockOrder: source.block_order,
    setId: source.set_id,
    repId: source.rep_id,
    correctionKind: "observation_option",
  });
  const activeSource: CorrectionSourceEvidenceRow = {
    ...source,
    option_id: previous?.proposed_option_id || source.option_id,
    raw_option: previous?.proposed_raw_option || source.raw_option,
    normalized_level: previous?.proposed_normalized_level || source.normalized_level,
  };
  const proposal = resolveObservationCorrectionProposal(activeSource, proposedOptionId);
  if (!proposal) return res.status(400).json({ message: "The proposed option is not valid for the retained source schema." });
  if (proposal.proposedOptionId === activeSource.option_id) {
    return res.status(400).json({ message: "The proposed correction matches the active source value." });
  }

  const correctionId = randomUUID();
  const row = {
    correction_id: correctionId,
    correction_kind: "observation_option",
    source_evidence_id: sourceEvidenceId,
    source_drill_id: source.source_drill_id,
    student_id: source.student_id,
    tutor_id: source.tutor_id,
    topic: source.topic,
    block_order: source.block_order,
    set_id: source.set_id,
    set_order: source.set_order,
    rep_id: source.rep_id,
    rep_number: source.rep_number,
    dimension_id: source.dimension_id,
    field_key: source.field_key,
    drill_type: source.drill_type,
    phase: source.phase,
    drill_schema_id: source.drill_schema_id,
    drill_schema_version: source.drill_schema_version,
    drill_definition_hash: source.drill_definition_hash,
    original_option_id: activeSource.option_id,
    original_raw_option: activeSource.raw_option,
    original_normalized_level: activeSource.normalized_level,
    proposed_option_id: proposal.proposedOptionId,
    proposed_raw_option: proposal.proposedRawOption,
    proposed_normalized_level: proposal.proposedNormalizedLevel,
    reason_code: reasonCode,
    reason_text: reasonText,
    raised_by_user_id: user.id,
    raised_by_role: "tutor",
    supersedes_correction_id: previous?.correction_id || null,
  };
  const { error } = await supabase.from("response_integrity_evidence_corrections").insert(row);
  if (error) throw new Error(`Failed to create evidence correction: ${error.message}`);
  return res.status(201).json({ correctionId, status: "pending_review" });
};

const createSupportCorrection = async (req: Request, res: Response, user: any) => {
  const sourceDrillId = clean(req.body?.sourceDrillId);
  const blockOrder = Number(req.body?.blockOrder);
  const setId = clean(req.body?.setId);
  const repId = clean(req.body?.repId);
  const proposedActualSupportUsed = clean(req.body?.proposedActualSupportUsed) as ActualSupportUsedV2;
  const reasonCode = clean(req.body?.reasonCode);
  const reasonText = clean(req.body?.reasonText);
  if (!sourceDrillId || !Number.isInteger(blockOrder) || blockOrder <= 0 || !setId || !repId || !proposedActualSupportUsed || !reasonCode || !reasonText) {
    return res.status(400).json({ message: "sourceDrillId, blockOrder, setId, repId, proposedActualSupportUsed, reasonCode, and reasonText are required." });
  }
  const sourceRow = await loadDrill(sourceDrillId);
  if (!sourceRow) return res.status(404).json({ message: "Source drill not found." });
  if (clean(sourceRow.tutor_id) !== clean(user.id)) return res.status(403).json({ message: "Only the submitting Specialist can raise this source correction." });
  if (!await requireOwnedStudent(sourceRow.student_id, user.id, res)) return;
  const drill = parseDrill(sourceRow.drill);
  if (!drill) return res.status(409).json({ message: "Source drill payload is not replayable." });
  const sets = Array.isArray(drill.sets) ? drill.sets : [];
  const set = sets[blockOrder - 1];
  if (!set || clean(set.setId) !== setId) return res.status(400).json({ message: "Correction set identity does not match the submitted drill." });
  const repIndex = (set.observations || []).findIndex((rep: any) => clean(rep?._rep_id) === repId);
  if (repIndex < 0) return res.status(400).json({ message: "Correction rep identity does not match the submitted drill." });

  await ensureNoPendingTargetCorrection({ sourceDrillId, blockOrder, setId, repId, correctionKind: "actual_support_used" });
  const topic = drillTopic(drill);
  const previous = await latestApprovedTargetCorrection({
    studentId: sourceRow.student_id,
    topic,
    sourceDrillId,
    blockOrder,
    setId,
    repId,
    correctionKind: "actual_support_used",
  });
  const operational = decodeRepOperationalEvidenceV2(set.observations[repIndex]?.[REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY]);
  if (!operational) return res.status(409).json({ message: "Source rep does not contain valid V2 operational evidence." });
  const activeSupport = previous?.proposed_actual_support_used || operational.actualSupportUsed;
  const validated = validateActualSupportCorrection(activeSupport, proposedActualSupportUsed);
  if (!validated) return res.status(400).json({ message: "The proposed actual-support correction is invalid or unchanged." });
  const phase = observedPhaseFor(drill);
  if (!phase) return res.status(409).json({ message: "Source drill does not retain a valid phase." });
  const correctionId = randomUUID();
  const row = {
    correction_id: correctionId,
    correction_kind: "actual_support_used",
    source_evidence_id: null,
    source_drill_id: sourceDrillId,
    student_id: sourceRow.student_id,
    tutor_id: sourceRow.tutor_id,
    topic,
    block_order: blockOrder,
    set_id: setId,
    set_order: Number(set.setOrder || blockOrder),
    rep_id: repId,
    rep_number: repIndex + 1,
    dimension_id: null,
    field_key: null,
    drill_type: clean(drill.drillType).toLowerCase() === "training" ? "training" : "diagnosis",
    phase,
    drill_schema_id: clean(set.drillSchemaId),
    drill_schema_version: Number(set.drillSchemaVersion),
    drill_definition_hash: clean(set.drillDefinitionHash),
    original_actual_support_used: validated.original,
    proposed_actual_support_used: validated.proposed,
    reason_code: reasonCode,
    reason_text: reasonText,
    raised_by_user_id: user.id,
    raised_by_role: "tutor",
    supersedes_correction_id: previous?.correction_id || null,
  };
  const { error } = await supabase.from("response_integrity_evidence_corrections").insert(row);
  if (error) throw new Error(`Failed to create support correction: ${error.message}`);
  return res.status(201).json({ correctionId, status: "pending_review" });
};

export const registerResponseIntegrityEvidenceCorrectionRuntimeRoutes = (
  app: Express,
  hooks: CorrectionRuntimeHooks = {},
) => {
  app.post("/api/response-integrity/evidence-corrections", isAuthenticated, async (req, res) => {
    try {
      const user = requireRole(req, res, ["tutor"]);
      if (!user) return;
      const kind = clean(req.body?.correctionKind);
      if (kind === "observation_option") return await createObservationCorrection(req, res, user);
      if (kind === "actual_support_used") return await createSupportCorrection(req, res, user);
      return res.status(400).json({ message: "correctionKind must be observation_option or actual_support_used." });
    } catch (error: any) {
      console.error("Evidence correction request failed:", error);
      return res.status(500).json({ message: error?.message || "Failed to create evidence correction." });
    }
  });

  app.get("/api/response-integrity/evidence-corrections/pending", isAuthenticated, async (req, res) => {
    try {
      const reviewer = requireRole(req, res, ["td", "coo"]);
      if (!reviewer) return;
      const { data: corrections, error } = await supabase
        .from("response_integrity_evidence_corrections")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      const ids = (corrections || []).map((row: any) => row.correction_id);
      const { data: reviews } = ids.length
        ? await supabase.from("response_integrity_evidence_correction_reviews").select("correction_id").in("correction_id", ids)
        : { data: [] as any[] };
      const reviewed = new Set((reviews || []).map((row: any) => row.correction_id));
      const pending: StoredCorrectionRow[] = (corrections || []).filter((row: any) => !reviewed.has(row.correction_id));
      const scoped: StoredCorrectionRow[] = [];
      for (const correction of pending) {
        if (reviewer.role === "coo" || await reviewerCanApprove(reviewer, correction)) scoped.push(correction);
      }
      return res.json(scoped);
    } catch (error: any) {
      console.error("Failed to load pending evidence corrections:", error);
      return res.status(500).json({ message: "Failed to load pending evidence corrections." });
    }
  });

  app.post("/api/response-integrity/evidence-corrections/:correctionId/review", isAuthenticated, async (req, res) => {
    try {
      const reviewer = requireRole(req, res, ["td", "coo"]);
      if (!reviewer) return;
      const correctionId = clean(req.params.correctionId);
      const outcome = clean(req.body?.outcome).toLowerCase();
      const reviewNote = clean(req.body?.reviewNote) || null;
      if (!["approved", "rejected"].includes(outcome)) {
        return res.status(400).json({ message: "outcome must be approved or rejected." });
      }
      const correction = await loadCorrection(correctionId);
      if (!correction) return res.status(404).json({ message: "Evidence correction not found." });
      if (!await reviewerCanApprove(reviewer, correction)) {
        return res.status(403).json({ message: "Reviewer is not authorized for this correction. Requesters cannot approve their own correction." });
      }
      if (await loadReview(correctionId)) return res.status(409).json({ message: "This correction already has an immutable review decision." });

      let processingPreview: any = null;
      if (outcome === "approved") {
        const sourceDrill = await loadDrill(correction.source_drill_id);
        if (!sourceDrill) return res.status(409).json({ message: "Correction source drill is unavailable; approval cannot be replayed safely." });
        const { events } = await buildReplayEvents({ correction, currentCorrection: toApprovedCorrection(correction) });
        const starting = await correctionReplayStart(correction, sourceDrill);
        processingPreview = replayCorrectedTopicLineage({ startingPhase: starting.phase, startingStability: starting.stability, events });
      }

      const reviewId = randomUUID();
      const { error: reviewError } = await supabase.from("response_integrity_evidence_correction_reviews").insert({
        review_id: reviewId,
        correction_id: correctionId,
        outcome,
        reviewed_by_user_id: reviewer.id,
        reviewed_by_role: reviewer.role,
        review_note: reviewNote,
        reviewed_at: new Date().toISOString(),
      });
      if (reviewError) throw new Error(`Failed to persist correction review: ${reviewError.message}`);

      if (outcome === "rejected") {
        return res.json({ correctionId, reviewId, outcome, replay: null });
      }
      const processed = await processApprovedCorrection(correction, hooks);
      return res.json({ correctionId, reviewId, outcome, processingPreview, ...processed });
    } catch (error: any) {
      console.error("Evidence correction review failed:", error);
      return res.status(500).json({ message: error?.message || "Failed to review evidence correction." });
    }
  });

  app.post("/api/response-integrity/evidence-corrections/:correctionId/reprocess", isAuthenticated, async (req, res) => {
    try {
      const reviewer = requireRole(req, res, ["td", "coo"]);
      if (!reviewer) return;
      const correction = await loadCorrection(clean(req.params.correctionId));
      if (!correction) return res.status(404).json({ message: "Evidence correction not found." });
      if (!await reviewerCanApprove(reviewer, correction)) return res.status(403).json({ message: "Reviewer is not authorized for this correction." });
      const review = await loadReview(correction.correction_id);
      if (!review || review.outcome !== "approved") return res.status(409).json({ message: "Only an approved correction can be reprocessed." });
      const processed = await processApprovedCorrection(correction, hooks);
      return res.json({ correctionId: correction.correction_id, outcome: "approved", ...processed });
    } catch (error: any) {
      console.error("Evidence correction reprocess failed:", error);
      return res.status(500).json({ message: error?.message || "Failed to reprocess evidence correction." });
    }
  });
};
