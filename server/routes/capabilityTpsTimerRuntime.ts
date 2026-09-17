import { randomUUID } from "crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { isAuthenticated } from "../supabaseAuth";
import { storage, supabase } from "../storage";
import { pool } from "../db";
import { isEmergencyDbMode } from "../emergencyMode";
import { buildTpsTimerRuntimeStatus, type StoredTpsDrillRow } from "../../shared/capabilityTpsTimerRuntime";
import {
  deriveTpsTimerContractV1,
  getTpsPrescribedSeconds,
  type PassiveRepTimingRecord,
  type TpsTimerContractV1,
  type TpsPressureLevel,
} from "../../shared/capabilityTpsTimerContract";
import {
  decodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
  type ActualSupportUsedV2,
} from "../../shared/responseIntegrityEvidenceContractV2";

const TPS_PHASE = "Time Pressure Stability";
const CONTROLLED_DISCOMFORT_PHASE = "Controlled Discomfort";
const HIGH_MAINTENANCE = "High Maintenance";
const TIMER_CONTRACT_VERSION = 1;

const clean = (value: unknown) => String(value || "").trim();
const topicKeyFor = (value: unknown) => clean(value).toLowerCase();
const isActualSupportUsed = (value: unknown): value is ActualSupportUsedV2 =>
  ["none", "response_control_cue", "first_step_math_support", "beyond_permitted_boundary"].includes(clean(value));
const isTimedPressure = (
  value: unknown,
): value is Extract<TpsPressureLevel, "light_timer" | "repeated_timer" | "full_constraint"> =>
  ["light_timer", "repeated_timer", "full_constraint"].includes(clean(value));

const requireSpecialist = (req: Request, res: Response) => {
  const dbUser = (req as any).dbUser;
  if (!dbUser?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  if (String(dbUser.role || "").trim().toLowerCase() !== "tutor") {
    res.status(403).json({ message: "Specialist access required." });
    return null;
  }
  return dbUser;
};

const requireOwnedStudent = async (studentId: string, tutorId: string, res: Response) => {
  const student = await storage.getStudent(studentId);
  if (!student || String(student.tutorId || "") !== String(tutorId)) {
    res.status(403).json({ message: "Unauthorized: Student does not belong to this Specialist." });
    return null;
  }
  return student as any;
};

const getTopicState = (student: any, topic: string) => {
  const topicConditioning = student?.conceptMastery?.topicConditioning || student?.concept_mastery?.topicConditioning || {};
  const topics = topicConditioning?.topics && typeof topicConditioning.topics === "object"
    ? topicConditioning.topics
    : {};
  const normalizedTopic = topicKeyFor(topic);
  const matchingKey = Object.keys(topics).find((key) => topicKeyFor(key) === normalizedTopic);
  const state = matchingKey ? topics[matchingKey] : null;
  return state && typeof state === "object" ? state : {};
};

const deriveConditioningEpochKey = (student: any, topic: string) => {
  const state = getTopicState(student, topic);
  const history = Array.isArray(state?.history) ? state.history : [];
  let priorPhase = "";
  let enteredTpsCount = 0;
  for (const entry of history) {
    const phase = clean(entry?.phase);
    if (phase === TPS_PHASE && priorPhase !== TPS_PHASE) enteredTpsCount += 1;
    priorPhase = phase;
  }
  const currentPhase = clean(state?.phase);
  const epochNumber = currentPhase === TPS_PHASE
    ? Math.max(1, enteredTpsCount)
    : enteredTpsCount + 1;
  return `tps-v1-epoch-${epochNumber}`;
};

const loadRecentDrillRows = async (studentId: string): Promise<StoredTpsDrillRow[]> => {
  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT id, student_id, tutor_id, submitted_at, drill
         FROM public.intro_session_drills
        WHERE student_id = $1
        ORDER BY submitted_at DESC
        LIMIT 500`,
      [studentId],
    );
    return result.rows || [];
  }

  const { data, error } = await supabase
    .from("intro_session_drills")
    .select("id, student_id, tutor_id, submitted_at, drill")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(`Failed to load timing lineage: ${error.message}`);
  return (data || []) as StoredTpsDrillRow[];
};

type TimerContractRow = {
  contract_id: string;
  contract_version: number;
  conditioning_epoch_key: string;
  student_id: string;
  topic: string;
  topic_key: string;
  source: "historical_untimed" | "calibration";
  baseline_source_phase: "Structured Execution" | "pre_tps_calibration";
  baseline_seconds: number;
  baseline_sample_ids: string[];
  baseline_sample_elapsed_ms: number[];
  structure_under_timer_seconds: number;
  repeated_timed_execution_seconds: number;
  full_constraint_seconds: number;
  calibration_batch_id?: string | null;
  created_by_tutor_id: string;
  supersedes_contract_id?: string | null;
  created_at?: string;
};

type PersistedTimerContract = TpsTimerContractV1 & {
  contractId: string;
  conditioningEpochKey: string;
  createdAt?: string;
  supersedesContractId?: string | null;
};

const rowToContract = (row: TimerContractRow): PersistedTimerContract => ({
  version: 1,
  contractId: row.contract_id,
  conditioningEpochKey: row.conditioning_epoch_key,
  studentId: row.student_id,
  topic: row.topic,
  baselineSource: row.source === "calibration" ? "calibration" : "historical_eligible",
  baselineSourcePhase: row.baseline_source_phase,
  baselineSampleRecordIds: Array.isArray(row.baseline_sample_ids) ? row.baseline_sample_ids : [],
  baselineSampleElapsedMs: Array.isArray(row.baseline_sample_elapsed_ms) ? row.baseline_sample_elapsed_ms : [],
  baselineSeconds: Number(row.baseline_seconds),
  structureUnderTimerSeconds: Number(row.structure_under_timer_seconds),
  repeatedTimedExecutionSeconds: Number(row.repeated_timed_execution_seconds),
  fullConstraintSeconds: Number(row.full_constraint_seconds),
  createdAt: row.created_at,
  supersedesContractId: row.supersedes_contract_id || null,
});

const isTimerContractInvalidated = async (contractId: string) => {
  if (!contractId) return false;
  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT invalidation_id FROM public.capability_tps_timer_contract_invalidations WHERE contract_id = $1 LIMIT 1`,
      [contractId],
    );
    return result.rows.length > 0;
  }
  const { data, error } = await supabase
    .from("capability_tps_timer_contract_invalidations")
    .select("invalidation_id")
    .eq("contract_id", contractId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load TPS Timer Contract invalidation: ${error.message}`);
  return !!data;
};

const loadLatestTimerContract = async (
  studentId: string,
  topicKey: string,
  conditioningEpochKey: string,
): Promise<PersistedTimerContract | null> => {
  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT *
         FROM public.capability_tps_timer_contracts
        WHERE student_id = $1 AND topic_key = $2 AND conditioning_epoch_key = $3
        ORDER BY created_at DESC
        LIMIT 1`,
      [studentId, topicKey, conditioningEpochKey],
    );
    const contract = result.rows?.[0] ? rowToContract(result.rows[0]) : null;
    if (!contract) return null;
    return await isTimerContractInvalidated(contract.contractId) ? null : contract;
  }

  const { data, error } = await supabase
    .from("capability_tps_timer_contracts")
    .select("*")
    .eq("student_id", studentId)
    .eq("topic_key", topicKey)
    .eq("conditioning_epoch_key", conditioningEpochKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load TPS Timer Contract: ${error.message}`);
  const contract = data ? rowToContract(data as TimerContractRow) : null;
  if (!contract) return null;
  return await isTimerContractInvalidated(contract.contractId) ? null : contract;
};

const insertTimerContract = async ({
  contract,
  conditioningEpochKey,
  tutorId,
  source,
  calibrationBatchId = null,
  supersedesContractId = null,
}: {
  contract: TpsTimerContractV1;
  conditioningEpochKey: string;
  tutorId: string;
  source: "historical_untimed" | "calibration";
  calibrationBatchId?: string | null;
  supersedesContractId?: string | null;
}): Promise<PersistedTimerContract> => {
  const contractId = randomUUID();
  const row = {
    contract_id: contractId,
    contract_version: contract.version,
    conditioning_epoch_key: conditioningEpochKey,
    student_id: contract.studentId,
    topic: contract.topic,
    topic_key: topicKeyFor(contract.topic),
    source,
    baseline_source_phase: contract.baselineSourcePhase,
    baseline_seconds: contract.baselineSeconds,
    baseline_sample_ids: contract.baselineSampleRecordIds,
    baseline_sample_elapsed_ms: contract.baselineSampleElapsedMs,
    structure_under_timer_seconds: contract.structureUnderTimerSeconds,
    repeated_timed_execution_seconds: contract.repeatedTimedExecutionSeconds,
    full_constraint_seconds: contract.fullConstraintSeconds,
    calibration_batch_id: calibrationBatchId,
    created_by_tutor_id: tutorId,
    supersedes_contract_id: supersedesContractId,
    created_at: new Date().toISOString(),
  };

  if (isEmergencyDbMode()) {
    const inserted = await pool.query(
      `INSERT INTO public.capability_tps_timer_contracts
        (contract_id, contract_version, conditioning_epoch_key, student_id, topic, topic_key,
         source, baseline_source_phase, baseline_seconds, baseline_sample_ids,
         baseline_sample_elapsed_ms, structure_under_timer_seconds,
         repeated_timed_execution_seconds, full_constraint_seconds, calibration_batch_id,
         created_by_tutor_id, supersedes_contract_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        row.contract_id,
        row.contract_version,
        row.conditioning_epoch_key,
        row.student_id,
        row.topic,
        row.topic_key,
        row.source,
        row.baseline_source_phase,
        row.baseline_seconds,
        JSON.stringify(row.baseline_sample_ids),
        JSON.stringify(row.baseline_sample_elapsed_ms),
        row.structure_under_timer_seconds,
        row.repeated_timed_execution_seconds,
        row.full_constraint_seconds,
        row.calibration_batch_id,
        row.created_by_tutor_id,
        row.supersedes_contract_id,
        row.created_at,
      ],
    );
    return rowToContract(inserted.rows[0]);
  }

  const { data, error } = await supabase
    .from("capability_tps_timer_contracts")
    .insert(row)
    .select("*")
    .single();
  if (error || !data) throw new Error(`Failed to persist TPS Timer Contract: ${error?.message || "no row"}`);
  return rowToContract(data as TimerContractRow);
};

const loadCalibrationRows = async (studentId: string, topicKey: string, conditioningEpochKey: string) => {
  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT *
         FROM public.capability_tps_timer_calibration_samples
        WHERE student_id = $1 AND topic_key = $2 AND conditioning_epoch_key = $3
        ORDER BY created_at ASC, attempt_number ASC`,
      [studentId, topicKey, conditioningEpochKey],
    );
    return result.rows || [];
  }
  const { data, error } = await supabase
    .from("capability_tps_timer_calibration_samples")
    .select("*")
    .eq("student_id", studentId)
    .eq("topic_key", topicKey)
    .eq("conditioning_epoch_key", conditioningEpochKey)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load pre-TPS calibration: ${error.message}`);
  return data || [];
};

const calibrationRecordsFor = (rows: any[], studentId: string, topic: string): PassiveRepTimingRecord[] => {
  const records: PassiveRepTimingRecord[] = [];
  for (const repNumber of [1, 2, 3]) {
    const valid = [...rows]
      .reverse()
      .find((row) =>
        Number(row?.rep_number) === repNumber &&
        clean(row?.actual_support_used) === "none" &&
        clean(row?.timing_validity) === "valid" &&
        row?.structurally_valid === true,
      );
    if (!valid) continue;
    records.push({
      recordId: clean(valid.calibration_sample_id),
      studentId,
      topic,
      completedAt: clean(valid.ended_at || valid.created_at),
      elapsedMs: Number(valid.elapsed_ms),
      sourcePhase: "pre_tps_calibration",
      pressureLevel: "none",
      variationLevel: "same_form",
      difficultyLevel: "normal",
      actualSupportUsed: "none",
      structurallyValidCompletion: true,
      timingValidity: "valid",
      source: "calibration",
    });
  }
  return records;
};

const calibrationStatusFor = (rows: any[], studentId: string, topic: string) => {
  const records = calibrationRecordsFor(rows, studentId, topic);
  const validRepNumbers = records.map((record) => {
    const matching = rows.find((row) => clean(row.calibration_sample_id) === record.recordId);
    return Number(matching?.rep_number || 0);
  }).filter(Boolean);
  const nextRepNumber = [1, 2, 3].find((rep) => !validRepNumbers.includes(rep)) || null;
  return {
    attemptCount: rows.length,
    validRepNumbers,
    validRepCount: validRepNumbers.length,
    nextRepNumber,
    records,
  };
};

const ensureHistoricalContract = async ({
  student,
  studentId,
  topic,
  tutorId,
}: {
  student: any;
  studentId: string;
  topic: string;
  tutorId: string;
}) => {
  const conditioningEpochKey = deriveConditioningEpochKey(student, topic);
  const topicKey = topicKeyFor(topic);
  const existing = await loadLatestTimerContract(studentId, topicKey, conditioningEpochKey);
  if (existing) return { contract: existing, conditioningEpochKey, created: false };

  const rows = await loadRecentDrillRows(studentId);
  const runtime = buildTpsTimerRuntimeStatus({ rows, studentId, topic });
  if (!runtime.contract) {
    return { contract: null, conditioningEpochKey, created: false, runtime };
  }

  const contract = await insertTimerContract({
    contract: runtime.contract,
    conditioningEpochKey,
    tutorId,
    source: "historical_untimed",
  });
  return { contract, conditioningEpochKey, created: true, runtime };
};

const buildTimerStatus = async ({ student, studentId, topic }: { student: any; studentId: string; topic: string }) => {
  const conditioningEpochKey = deriveConditioningEpochKey(student, topic);
  const topicKey = topicKeyFor(topic);
  const rows = await loadRecentDrillRows(studentId);
  const runtime = buildTpsTimerRuntimeStatus({ rows, studentId, topic });
  const contract = await loadLatestTimerContract(studentId, topicKey, conditioningEpochKey);
  const calibrationRows = await loadCalibrationRows(studentId, topicKey, conditioningEpochKey);
  const calibration = calibrationStatusFor(calibrationRows, studentId, topic);
  const topicState = getTopicState(student, topic);
  return {
    conditioningEpochKey,
    currentPhase: clean(topicState?.phase) || null,
    currentStability: clean(topicState?.stability) || null,
    contract,
    historicalCandidate: contract ? null : runtime.contract,
    historicalCandidateReady: !contract && !!runtime.contract,
    tpsEntryReady: !!contract,
    preTpsCalibrationRequired: !contract && !runtime.contract,
    passiveRecordCount: runtime.passiveRecordCount,
    eligibleRecordCount: runtime.eligibleRecordCount,
    structuredExecutionRecordCount: runtime.structuredExecutionRecordCount,
    controlledDiscomfortRecordCount: runtime.controlledDiscomfortRecordCount,
    calibration: {
      attemptCount: calibration.attemptCount,
      validRepNumbers: calibration.validRepNumbers,
      validRepCount: calibration.validRepCount,
      nextRepNumber: calibration.nextRepNumber,
    },
  };
};

const insertCalibrationSample = async (row: Record<string, any>) => {
  if (isEmergencyDbMode()) {
    const inserted = await pool.query(
      `INSERT INTO public.capability_tps_timer_calibration_samples
        (calibration_sample_id, calibration_batch_id, conditioning_epoch_key, student_id, topic,
         topic_key, collected_by_tutor_id, rep_number, attempt_number, rep_id, actual_support_used,
         started_at, ended_at, elapsed_ms, timing_validity, structurally_valid,
         replacement_for_sample_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        row.calibration_sample_id,
        row.calibration_batch_id,
        row.conditioning_epoch_key,
        row.student_id,
        row.topic,
        row.topic_key,
        row.collected_by_tutor_id,
        row.rep_number,
        row.attempt_number,
        row.rep_id,
        row.actual_support_used,
        row.started_at,
        row.ended_at,
        row.elapsed_ms,
        row.timing_validity,
        row.structurally_valid,
        row.replacement_for_sample_id,
        row.created_at,
      ],
    );
    return inserted.rows[0];
  }
  const { data, error } = await supabase
    .from("capability_tps_timer_calibration_samples")
    .insert(row)
    .select("*")
    .single();
  if (error || !data) throw new Error(`Failed to store pre-TPS calibration sample: ${error?.message || "no row"}`);
  return data;
};

const loadTimedAttempt = async (attemptId: string) => {
  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT * FROM public.capability_tps_timed_attempts WHERE attempt_id = $1 LIMIT 1`,
      [attemptId],
    );
    return result.rows?.[0] || null;
  }
  const { data, error } = await supabase
    .from("capability_tps_timed_attempts")
    .select("*")
    .eq("attempt_id", attemptId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load TPS timed attempt: ${error.message}`);
  return data || null;
};

const insertTimedAttempt = async (row: Record<string, any>) => {
  if (isEmergencyDbMode()) {
    const inserted = await pool.query(
      `INSERT INTO public.capability_tps_timed_attempts
        (attempt_id, contract_id, contract_version, conditioning_epoch_key, student_id, topic,
         topic_key, collected_by_tutor_id, set_id, set_name, rep_number, pressure_level,
         actual_support_used, baseline_seconds, prescribed_seconds, started_at, ended_at,
         elapsed_ms, completed_before_expiry, timing_validity, replacement_for_attempt_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        row.attempt_id,
        row.contract_id,
        row.contract_version,
        row.conditioning_epoch_key,
        row.student_id,
        row.topic,
        row.topic_key,
        row.collected_by_tutor_id,
        row.set_id,
        row.set_name,
        row.rep_number,
        row.pressure_level,
        row.actual_support_used,
        row.baseline_seconds,
        row.prescribed_seconds,
        row.started_at,
        row.ended_at,
        row.elapsed_ms,
        row.completed_before_expiry,
        row.timing_validity,
        row.replacement_for_attempt_id,
        row.created_at,
      ],
    );
    return inserted.rows[0];
  }
  const { data, error } = await supabase
    .from("capability_tps_timed_attempts")
    .insert(row)
    .select("*")
    .single();
  if (error || !data) throw new Error(`Failed to store TPS timed attempt: ${error?.message || "no row"}`);
  return data;
};

const validateTpsDrillAgainstContract = async ({
  drillData,
  contract,
  studentId,
  topic,
}: {
  drillData: any;
  contract: PersistedTimerContract;
  studentId: string;
  topic: string;
}) => {
  const sets = Array.isArray(drillData?.drill) ? drillData.drill : [];
  if (sets.length === 0) return "TPS drill is missing its scored sets.";

  for (const set of sets) {
    const pressureLevel = clean(set?.constraintProfile?.pressureLevel);
    if (!isTimedPressure(pressureLevel)) {
      return `TPS set ${clean(set?.setName) || "unknown"} is missing a valid timed pressure contract.`;
    }
    const prescribedSeconds = getTpsPrescribedSeconds(contract, pressureLevel);
    const observations = Array.isArray(set?.observations) ? set.observations : [];
    for (const observation of observations) {
      const operationalEvidence = decodeRepOperationalEvidenceV2(
        observation?.[REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY],
      );
      if (!operationalEvidence || operationalEvidence.timing.mode !== "tps_prescribed") {
        return "Every TPS rep must carry V2 prescribed-timer evidence before submission.";
      }
      const timing = operationalEvidence.timing;
      if (operationalEvidence.actualSupportUsed !== "none") {
        return "TPS is a no-support condition. The assisted attempt is historical evidence but must be replaced before scoring.";
      }
      if (timing.timingValidity !== "valid") {
        return "A technical-invalid TPS attempt cannot score. Run the linked replacement rep first.";
      }
      if (
        clean(timing.timerContractId) !== contract.contractId ||
        clean(timing.conditioningEpochKey) !== contract.conditioningEpochKey ||
        Number(timing.timerContractVersion) !== TIMER_CONTRACT_VERSION ||
        Number(timing.baselineSeconds) !== contract.baselineSeconds ||
        Number(timing.prescribedSeconds) !== prescribedSeconds ||
        clean(timing.pressureLevel) !== pressureLevel
      ) {
        return "TPS rep timing does not match the active immutable Timer Contract.";
      }
      const attemptId = clean(timing.attemptId);
      const attempt = attemptId ? await loadTimedAttempt(attemptId) : null;
      if (
        !attempt ||
        clean(attempt.student_id) !== studentId ||
        topicKeyFor(attempt.topic) !== topicKeyFor(topic) ||
        clean(attempt.contract_id) !== contract.contractId ||
        clean(attempt.conditioning_epoch_key) !== contract.conditioningEpochKey ||
        clean(attempt.timing_validity) !== "valid" ||
        clean(attempt.actual_support_used) !== "none"
      ) {
        return "TPS rep does not have a matching valid timer-attempt lineage record.";
      }
    }
  }
  return null;
};

export const reconcileTpsTimerContractAfterCorrection = async ({
  correctionId,
  student,
  studentId,
  tutorId,
  topic,
  sourceDrillId,
  effectiveDrillRows,
}: {
  correctionId: string;
  student: any;
  studentId: string;
  tutorId: string;
  topic: string;
  sourceDrillId: string;
  effectiveDrillRows: Array<{ id?: unknown; student_id?: unknown; tutor_id?: unknown; submitted_at?: unknown; drill?: unknown }>;
}) => {
  const conditioningEpochKey = deriveConditioningEpochKey(student, topic);
  const normalizedTopicKey = topicKeyFor(topic);
  const current = await loadLatestTimerContract(studentId, normalizedTopicKey, conditioningEpochKey);
  if (!current) return { status: "no_active_contract" as const };

  const sourcePrefix = `${sourceDrillId}::`;
  const baselineDependsOnSource = current.baselineSampleRecordIds.some((id) => clean(id).startsWith(sourcePrefix));
  if (!baselineDependsOnSource) return { status: "unaffected" as const, contract: current };

  const invalidationId = randomUUID();
  const invalidation = {
    invalidation_id: invalidationId,
    contract_id: current.contractId,
    correction_id: correctionId,
    student_id: studentId,
    topic,
    topic_key: normalizedTopicKey,
    conditioning_epoch_key: conditioningEpochKey,
    reason: "Approved evidence correction changed lineage used by the active TPS baseline.",
    invalidated_at: new Date().toISOString(),
  };
  if (isEmergencyDbMode()) {
    await pool.query(
      `INSERT INTO public.capability_tps_timer_contract_invalidations
        (invalidation_id, contract_id, correction_id, student_id, topic, topic_key, conditioning_epoch_key, reason, invalidated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (contract_id, correction_id) DO NOTHING`,
      [invalidation.invalidation_id, invalidation.contract_id, invalidation.correction_id, invalidation.student_id, invalidation.topic, invalidation.topic_key, invalidation.conditioning_epoch_key, invalidation.reason, invalidation.invalidated_at],
    );
  } else {
    const { error } = await supabase.from("capability_tps_timer_contract_invalidations").upsert(invalidation, {
      onConflict: "contract_id,correction_id",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`Failed to invalidate TPS Timer Contract after correction: ${error.message}`);
  }

  const runtime = buildTpsTimerRuntimeStatus({ rows: effectiveDrillRows, studentId, topic });
  if (!runtime.contract) {
    return {
      status: "pre_tps_calibration_required" as const,
      invalidatedContractId: current.contractId,
      conditioningEpochKey,
    };
  }

  const replacement = await insertTimerContract({
    contract: runtime.contract,
    conditioningEpochKey,
    tutorId,
    source: "historical_untimed",
    supersedesContractId: current.contractId,
  });
  return {
    status: "superseded" as const,
    invalidatedContractId: current.contractId,
    contract: replacement,
    conditioningEpochKey,
  };
};

export function registerCapabilityTpsTimerRuntimeRoutes(app: Express) {
  app.get(
    "/api/tutor/students/:studentId/tps-timer-contract",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialist(req, res);
        if (!dbUser) return;
        const studentId = clean(req.params.studentId);
        const topic = clean(req.query.topic);
        if (!studentId || !topic) return res.status(400).json({ message: "studentId and topic are required." });
        const student = await requireOwnedStudent(studentId, String(dbUser.id), res);
        if (!student) return;
        const status = await buildTimerStatus({ student, studentId, topic });
        return res.json({ topic, ...status });
      } catch (error) {
        console.error("[TPS_TIMER_RUNTIME] Failed to load timer status", error);
        return res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to load TPS timer status.",
        });
      }
    },
  );

  app.post(
    "/api/tutor/students/:studentId/tps-timer-contract/ensure",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialist(req, res);
        if (!dbUser) return;
        const studentId = clean(req.params.studentId);
        const topic = clean(req.body?.topic);
        if (!studentId || !topic) return res.status(400).json({ message: "studentId and topic are required." });
        const student = await requireOwnedStudent(studentId, String(dbUser.id), res);
        if (!student) return;
        const ensured = await ensureHistoricalContract({
          student,
          studentId,
          topic,
          tutorId: String(dbUser.id),
        });
        if (!ensured.contract) {
          return res.status(409).json({
            code: "PRE_TPS_CALIBRATION_REQUIRED",
            message: "Three eligible Structured Execution timing samples are not available. Complete pre-TPS calibration before TPS activation.",
            conditioningEpochKey: ensured.conditioningEpochKey,
          });
        }
        return res.json({
          success: true,
          created: ensured.created,
          contract: ensured.contract,
          conditioningEpochKey: ensured.conditioningEpochKey,
        });
      } catch (error) {
        console.error("[TPS_TIMER_RUNTIME] Failed to ensure timer contract", error);
        return res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to ensure TPS Timer Contract.",
        });
      }
    },
  );

  app.post(
    "/api/tutor/students/:studentId/tps-calibration/sample",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialist(req, res);
        if (!dbUser) return;
        const studentId = clean(req.params.studentId);
        const topic = clean(req.body?.topic);
        const repNumber = Number(req.body?.repNumber);
        const actualSupportUsed = req.body?.actualSupportUsed;
        const structurallyValid = req.body?.structurallyValid === true;
        const timingValidity = clean(req.body?.timingValidity || "valid");
        const startedAt = clean(req.body?.startedAt);
        const endedAt = clean(req.body?.endedAt);
        const elapsedMs = Number(req.body?.elapsedMs);
        if (!studentId || !topic || ![1, 2, 3].includes(repNumber)) {
          return res.status(400).json({ message: "topic and repNumber 1-3 are required." });
        }
        if (!isActualSupportUsed(actualSupportUsed)) {
          return res.status(400).json({ message: "Record the actual support used on the calibration attempt." });
        }
        if (!["valid", "timing_invalid_technical"].includes(timingValidity)) {
          return res.status(400).json({ message: "Invalid calibration timing validity." });
        }
        if (!startedAt || !endedAt || !Number.isFinite(elapsedMs) || elapsedMs <= 0) {
          return res.status(400).json({ message: "Calibration timing evidence is incomplete." });
        }
        const student = await requireOwnedStudent(studentId, String(dbUser.id), res);
        if (!student) return;
        const conditioningEpochKey = deriveConditioningEpochKey(student, topic);
        const topicKey = topicKeyFor(topic);
        const existingContract = await loadLatestTimerContract(studentId, topicKey, conditioningEpochKey);
        if (existingContract) {
          return res.json({ success: true, contract: existingContract, calibrationComplete: true });
        }

        const calibrationBatchId = `pre-tps::${studentId}::${topicKey}::${conditioningEpochKey}`;
        const existingRows = await loadCalibrationRows(studentId, topicKey, conditioningEpochKey);
        const repRows = existingRows.filter((row) => Number(row?.rep_number) === repNumber);
        const attemptNumber = repRows.reduce((max, row) => Math.max(max, Number(row?.attempt_number || 0)), 0) + 1;
        const replacementForSampleId = repRows.length > 0
          ? clean(repRows[repRows.length - 1]?.calibration_sample_id) || null
          : null;
        const calibrationSampleId = randomUUID();
        await insertCalibrationSample({
          calibration_sample_id: calibrationSampleId,
          calibration_batch_id: calibrationBatchId,
          conditioning_epoch_key: conditioningEpochKey,
          student_id: studentId,
          topic,
          topic_key: topicKey,
          collected_by_tutor_id: String(dbUser.id),
          rep_number: repNumber,
          attempt_number: attemptNumber,
          rep_id: `pre_tps_calibration.rep_${repNumber}`,
          actual_support_used: actualSupportUsed,
          started_at: startedAt,
          ended_at: endedAt,
          elapsed_ms: Math.max(1, Math.round(elapsedMs)),
          timing_validity: timingValidity,
          structurally_valid: structurallyValid,
          replacement_for_sample_id: replacementForSampleId,
          created_at: new Date().toISOString(),
        });

        const rows = await loadCalibrationRows(studentId, topicKey, conditioningEpochKey);
        const calibration = calibrationStatusFor(rows, studentId, topic);
        let contract: PersistedTimerContract | null = null;
        if (calibration.validRepCount === 3) {
          const derived = deriveTpsTimerContractV1({
            records: calibration.records,
            studentId,
            topic,
            source: "calibration",
          });
          if (derived) {
            contract = await insertTimerContract({
              contract: derived,
              conditioningEpochKey,
              tutorId: String(dbUser.id),
              source: "calibration",
              calibrationBatchId,
            });
          }
        }

        return res.json({
          success: true,
          calibrationSampleId,
          acceptedAsBaseline: actualSupportUsed === "none" && structurallyValid && timingValidity === "valid",
          calibrationComplete: !!contract,
          validRepNumbers: calibration.validRepNumbers,
          nextRepNumber: contract ? null : calibration.nextRepNumber,
          contract,
          conditioningEpochKey,
        });
      } catch (error) {
        console.error("[TPS_TIMER_RUNTIME] Failed to store calibration sample", error);
        return res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to store pre-TPS calibration sample.",
        });
      }
    },
  );

  app.post(
    "/api/tutor/students/:studentId/tps-timed-attempt",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialist(req, res);
        if (!dbUser) return;
        const studentId = clean(req.params.studentId);
        const topic = clean(req.body?.topic);
        const attemptId = clean(req.body?.attemptId) || randomUUID();
        const setId = clean(req.body?.setId);
        const setName = clean(req.body?.setName);
        const repNumber = Number(req.body?.repNumber);
        const pressureLevel = clean(req.body?.pressureLevel);
        const actualSupportUsed = req.body?.actualSupportUsed;
        const timingValidity = clean(req.body?.timingValidity || "valid");
        const startedAt = clean(req.body?.startedAt);
        const endedAt = clean(req.body?.endedAt);
        const elapsedMs = Number(req.body?.elapsedMs);
        if (!studentId || !topic || !setId || !setName || !Number.isInteger(repNumber) || repNumber <= 0) {
          return res.status(400).json({ message: "TPS timed-attempt identity is incomplete." });
        }
        if (!isTimedPressure(pressureLevel)) {
          return res.status(400).json({ message: "TPS timed attempt requires a registered timed pressure level." });
        }
        if (!isActualSupportUsed(actualSupportUsed)) {
          return res.status(400).json({ message: "Record actual support used on the TPS attempt." });
        }
        if (!["valid", "timing_invalid_technical"].includes(timingValidity)) {
          return res.status(400).json({ message: "Invalid TPS timing validity." });
        }
        if (!startedAt || !endedAt || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
          return res.status(400).json({ message: "TPS timed-attempt timing evidence is incomplete." });
        }
        const student = await requireOwnedStudent(studentId, String(dbUser.id), res);
        if (!student) return;
        const conditioningEpochKey = deriveConditioningEpochKey(student, topic);
        const contract = await loadLatestTimerContract(studentId, topicKeyFor(topic), conditioningEpochKey);
        if (!contract) {
          return res.status(409).json({
            code: "TPS_TIMER_CONTRACT_REQUIRED",
            message: "A valid Timer Contract must exist before a TPS timed rep can run.",
          });
        }
        const prescribedSeconds = getTpsPrescribedSeconds(contract, pressureLevel);
        if (
          Number(req.body?.prescribedSeconds) !== prescribedSeconds ||
          Number(req.body?.baselineSeconds) !== contract.baselineSeconds ||
          clean(req.body?.timerContractId) !== contract.contractId ||
          clean(req.body?.conditioningEpochKey) !== conditioningEpochKey
        ) {
          return res.status(409).json({
            code: "TPS_TIMER_CONTRACT_MISMATCH",
            message: "The timed attempt does not match the active immutable Timer Contract.",
          });
        }
        const completedBeforeExpiry = elapsedMs <= prescribedSeconds * 1000;
        const row = await insertTimedAttempt({
          attempt_id: attemptId,
          contract_id: contract.contractId,
          contract_version: contract.version,
          conditioning_epoch_key: conditioningEpochKey,
          student_id: studentId,
          topic,
          topic_key: topicKeyFor(topic),
          collected_by_tutor_id: String(dbUser.id),
          set_id: setId,
          set_name: setName,
          rep_number: repNumber,
          pressure_level: pressureLevel,
          actual_support_used: actualSupportUsed,
          baseline_seconds: contract.baselineSeconds,
          prescribed_seconds: prescribedSeconds,
          started_at: startedAt,
          ended_at: endedAt,
          elapsed_ms: Math.max(0, Math.round(elapsedMs)),
          completed_before_expiry: completedBeforeExpiry,
          timing_validity: timingValidity,
          replacement_for_attempt_id: clean(req.body?.replacementForAttemptId) || null,
          created_at: new Date().toISOString(),
        });
        return res.json({
          success: true,
          attemptId: row.attempt_id,
          completedBeforeExpiry,
          timingValidity,
          acceptedForScoring: timingValidity === "valid" && actualSupportUsed === "none",
        });
      } catch (error) {
        console.error("[TPS_TIMER_RUNTIME] Failed to store timed attempt", error);
        return res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to store TPS timed attempt.",
        });
      }
    },
  );

  // This middleware runs before the legacy training-session handler. It makes Timer Contract V1 a
  // server invariant rather than a UI convention: the progression-capable CD/HM drill cannot submit
  // until the next TPS epoch has a contract, and TPS evidence cannot submit without matching timer
  // attempt lineage.
  app.post(
    "/api/tutor/training-session-drill",
    isAuthenticated,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dbUser = requireSpecialist(req, res);
        if (!dbUser) return;
        const studentId = clean(req.body?.studentId);
        const sessionDrills = Array.isArray(req.body?.sessionDrills) ? req.body.sessionDrills : [];
        if (!studentId || sessionDrills.length === 0) return next();
        const student = await requireOwnedStudent(studentId, String(dbUser.id), res);
        if (!student) return;

        for (const drillData of sessionDrills) {
          const topic = clean(drillData?.trainingTopic);
          const observedPhase = clean(drillData?.phase);
          if (!topic) continue;
          const topicState = getTopicState(student, topic);
          const currentPhase = clean(topicState?.phase || observedPhase);
          const currentStability = clean(topicState?.stability || drillData?.previousStability);

          if (
            observedPhase === CONTROLLED_DISCOMFORT_PHASE &&
            currentPhase === CONTROLLED_DISCOMFORT_PHASE &&
            currentStability === HIGH_MAINTENANCE
          ) {
            const ensured = await ensureHistoricalContract({
              student,
              studentId,
              topic,
              tutorId: String(dbUser.id),
            });
            if (!ensured.contract) {
              return res.status(409).json({
                code: "PRE_TPS_CALIBRATION_REQUIRED",
                topic,
                message: "This topic is at the TPS threshold, but its Timer Contract is not ready. Complete pre-TPS calibration before the progression-capable drill submits.",
              });
            }
          }

          if (observedPhase === TPS_PHASE) {
            const conditioningEpochKey = deriveConditioningEpochKey(student, topic);
            const contract = await loadLatestTimerContract(studentId, topicKeyFor(topic), conditioningEpochKey);
            if (!contract) {
              return res.status(409).json({
                code: "TPS_TIMER_CONTRACT_REQUIRED",
                topic,
                message: "TPS is locked until RI-OS has a valid Timer Contract for this topic epoch.",
              });
            }
            const validationError = await validateTpsDrillAgainstContract({
              drillData,
              contract,
              studentId,
              topic,
            });
            if (validationError) {
              return res.status(409).json({
                code: "TPS_TIMING_EVIDENCE_INVALID",
                topic,
                message: validationError,
              });
            }
          }
        }

        return next();
      } catch (error) {
        console.error("[TPS_TIMER_RUNTIME] Training submission gate failed", error);
        return res.status(500).json({
          message: error instanceof Error ? error.message : "TPS timing integrity gate failed.",
        });
      }
    },
  );
}
