import { createHash } from "crypto";
import { pool } from "./db";
import { isEmergencyDbMode } from "./emergencyMode";
import { supabase } from "./storage";
import {
  PASSIVE_EXECUTION_ATTEMPT_WIRE_KEY,
  PASSIVE_EXECUTION_TIMING_WIRE_KEY,
  TPS_TIMED_ATTEMPT_WIRE_KEY,
  TPS_TRAINING_BASELINE_SET_ID,
  decodePassiveExecutionTimingEvidence,
  decodeTpsPassiveAttemptEvidenceRef,
  decodeTpsTimedAttemptEvidenceRef,
  getTpsPrescribedSeconds,
  getTpsTrainingPressureForSet,
  validateTpsPassiveAttemptEvidenceRef,
  validateTpsPassiveAttemptSubmission,
  validateTpsTimedAttemptAgainstContract,
  type TpsPassiveAttemptEvidenceRefV1,
  type TpsPassiveAttemptSubmissionV1,
  type TpsTimedAttemptSubmissionV1,
  type TpsTimerContractV1,
} from "../shared/tpsTimingContract";
import type { StoredDrillRow } from "../shared/tpsTimingRuntime";

const TABLE = "response_integrity_tps_timer_contracts";

type QueryClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

const clean = (value: unknown) => String(value ?? "").trim();
const topicKey = (value: unknown) => clean(value).toLowerCase();

type TimerContractRow = {
  contract_id: string;
  contract_version: number;
  student_id: string;
  topic: string;
  topic_key: string;
  baseline_source:
    | "training_independent_execution"
    | "diagnosis_independent_baseline";
  baseline_source_epoch_key: string;
  baseline_group_id: string;
  baseline_record_ids: unknown;
  baseline_elapsed_ms: unknown;
  baseline_seconds: number;
  structure_under_timer_seconds: number;
  repeated_timed_execution_seconds: number;
  full_constraint_seconds: number;
  created_by_tutor_id: string;
  supersedes_contract_id?: string | null;
  created_at?: string;
};

export type PersistedTpsTimerContract = TpsTimerContractV1 & {
  contractId: string;
  createdByTutorId: string;
  supersedesContractId: string | null;
  createdAt: string | null;
};

const asStringArray = (value: unknown): [string, string, string] | null => {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const normalized = value.map((entry) => clean(entry));
  if (normalized.some((entry) => !entry)) return null;
  return normalized as [string, string, string];
};

const asNumberArray = (value: unknown): [number, number, number] | null => {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const normalized = value.map((entry) => Number(entry));
  if (normalized.some((entry) => !Number.isFinite(entry) || entry <= 0)) return null;
  return normalized as [number, number, number];
};

const rowToContract = (row: TimerContractRow): PersistedTpsTimerContract | null => {
  if (Number(row.contract_version) !== 1) return null;
  const recordIds = asStringArray(row.baseline_record_ids);
  const elapsedMs = asNumberArray(row.baseline_elapsed_ms);
  if (!recordIds || !elapsedMs) return null;

  return {
    version: 1,
    contractId: row.contract_id,
    studentId: row.student_id,
    topic: row.topic,
    baselineSource: row.baseline_source,
    baselineSourceEpochKey: row.baseline_source_epoch_key,
    baselineGroupId: row.baseline_group_id,
    baselineRecordIds: recordIds,
    baselineElapsedMs: elapsedMs,
    baselineSeconds: Number(row.baseline_seconds),
    structureUnderTimerSeconds: Number(row.structure_under_timer_seconds),
    repeatedTimedExecutionSeconds: Number(row.repeated_timed_execution_seconds),
    fullConstraintSeconds: Number(row.full_constraint_seconds),
    createdByTutorId: row.created_by_tutor_id,
    supersedesContractId: clean(row.supersedes_contract_id) || null,
    createdAt: clean(row.created_at) || null,
  };
};

const deterministicContractId = (
  contract: TpsTimerContractV1,
) => {
  const digest = createHash("sha256")
    .update(
      [
        contract.version,
        contract.studentId,
        topicKey(contract.topic),
        contract.baselineSource,
        contract.baselineSourceEpochKey,
        contract.baselineGroupId,
        ...contract.baselineRecordIds,
        ...contract.baselineElapsedMs,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
  return `ri-tps-v1-${digest}`;
};

const loadTpsTimerContractByIdDirect = async (
  queryClient: QueryClient,
  contractId: string,
): Promise<PersistedTpsTimerContract | null> => {
  const normalizedId = clean(contractId);
  if (!normalizedId) return null;
  const result = await queryClient.query(
    `SELECT *
       FROM public.${TABLE}
      WHERE contract_id = $1
      LIMIT 1`,
    [normalizedId],
  );
  return result.rows[0]
    ? rowToContract(result.rows[0] as TimerContractRow)
    : null;
};

const loadLatestTpsTimerContractDirect = async (
  queryClient: QueryClient,
  studentId: string,
  topic: string,
): Promise<PersistedTpsTimerContract | null> => {
  const normalizedStudentId = clean(studentId);
  const normalizedTopicKey = topicKey(topic);
  if (!normalizedStudentId || !normalizedTopicKey) return null;
  const result = await queryClient.query(
    `SELECT *
       FROM public.${TABLE}
      WHERE student_id = $1
        AND topic_key = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [normalizedStudentId, normalizedTopicKey],
  );
  return result.rows[0]
    ? rowToContract(result.rows[0] as TimerContractRow)
    : null;
};

export const loadTpsTimingDrillRows = async ({
  studentId,
  queryClient,
}: {
  studentId: string;
  queryClient?: QueryClient | null;
}): Promise<StoredDrillRow[]> => {
  const normalizedStudentId = clean(studentId);
  if (!normalizedStudentId) return [];

  if (queryClient) {
    const result = await queryClient.query(
      `SELECT id, student_id, submitted_at, drill
         FROM public.intro_session_drills
        WHERE student_id = $1
        ORDER BY submitted_at ASC
        LIMIT 500`,
      [normalizedStudentId],
    );
    return result.rows || [];
  }

  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT id, student_id, submitted_at, drill
         FROM public.intro_session_drills
        WHERE student_id = $1
        ORDER BY submitted_at ASC
        LIMIT 500`,
      [normalizedStudentId],
    );
    return result.rows || [];
  }

  const { data, error } = await supabase
    .from("intro_session_drills")
    .select("id, student_id, submitted_at, drill")
    .eq("student_id", normalizedStudentId)
    .order("submitted_at", { ascending: true })
    .limit(500);
  if (error) {
    throw new Error(`Failed to load TPS timing drill lineage: ${error.message}`);
  }
  return (data || []) as StoredDrillRow[];
};

export const loadTpsTimerContractById = async (
  contractId: string,
): Promise<PersistedTpsTimerContract | null> => {
  const normalizedId = clean(contractId);
  if (!normalizedId) return null;

  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT *
         FROM public.${TABLE}
        WHERE contract_id = $1
        LIMIT 1`,
      [normalizedId],
    );
    return result.rows[0]
      ? rowToContract(result.rows[0] as TimerContractRow)
      : null;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("contract_id", normalizedId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load TPS Timer Contract: ${error.message}`);
  }
  return data ? rowToContract(data as TimerContractRow) : null;
};

export const loadLatestTpsTimerContract = async ({
  studentId,
  topic,
}: {
  studentId: string;
  topic: string;
}): Promise<PersistedTpsTimerContract | null> => {
  const normalizedStudentId = clean(studentId);
  const normalizedTopicKey = topicKey(topic);
  if (!normalizedStudentId || !normalizedTopicKey) return null;

  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT *
         FROM public.${TABLE}
        WHERE student_id = $1
          AND topic_key = $2
        ORDER BY created_at DESC
        LIMIT 1`,
      [normalizedStudentId, normalizedTopicKey],
    );
    return result.rows[0]
      ? rowToContract(result.rows[0] as TimerContractRow)
      : null;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("student_id", normalizedStudentId)
    .eq("topic_key", normalizedTopicKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load latest TPS Timer Contract: ${error.message}`);
  }
  return data ? rowToContract(data as TimerContractRow) : null;
};

export const persistTpsTimerContractDirect = async ({
  queryClient,
  contract,
  tutorId,
}: {
  queryClient: QueryClient;
  contract: TpsTimerContractV1;
  tutorId: string;
}): Promise<PersistedTpsTimerContract> => {
  const contractId = deterministicContractId(contract);
  const existing = await loadTpsTimerContractByIdDirect(queryClient, contractId);
  if (existing) return existing;

  const latest = await loadLatestTpsTimerContractDirect(
    queryClient,
    contract.studentId,
    contract.topic,
  );
  const supersedesContractId =
    latest && latest.contractId !== contractId ? latest.contractId : null;

  await queryClient.query(
    `INSERT INTO public.${TABLE} (
      contract_id,
      contract_version,
      student_id,
      topic,
      topic_key,
      baseline_source,
      baseline_source_epoch_key,
      baseline_group_id,
      baseline_record_ids,
      baseline_elapsed_ms,
      baseline_seconds,
      structure_under_timer_seconds,
      repeated_timed_execution_seconds,
      full_constraint_seconds,
      created_by_tutor_id,
      supersedes_contract_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16
    )
    ON CONFLICT (contract_id) DO NOTHING`,
    [
      contractId,
      contract.version,
      contract.studentId,
      contract.topic,
      topicKey(contract.topic),
      contract.baselineSource,
      contract.baselineSourceEpochKey,
      contract.baselineGroupId,
      JSON.stringify(contract.baselineRecordIds),
      JSON.stringify(contract.baselineElapsedMs),
      contract.baselineSeconds,
      contract.structureUnderTimerSeconds,
      contract.repeatedTimedExecutionSeconds,
      contract.fullConstraintSeconds,
      clean(tutorId),
      supersedesContractId,
    ],
  );

  const persisted = await loadTpsTimerContractByIdDirect(queryClient, contractId);
  if (!persisted) {
    throw new Error("TPS Timer Contract was not readable after transactional persistence");
  }
  return persisted;
};

export const persistTpsTimerContract = async ({
  contract,
  tutorId,
}: {
  contract: TpsTimerContractV1;
  tutorId: string;
}): Promise<PersistedTpsTimerContract> => {
  const contractId = deterministicContractId(contract);
  const existing = await loadTpsTimerContractById(contractId);
  if (existing) return existing;

  const latest = await loadLatestTpsTimerContract({
    studentId: contract.studentId,
    topic: contract.topic,
  });
  const supersedesContractId =
    latest && latest.contractId !== contractId ? latest.contractId : null;

  const row: TimerContractRow = {
    contract_id: contractId,
    contract_version: contract.version,
    student_id: contract.studentId,
    topic: contract.topic,
    topic_key: topicKey(contract.topic),
    baseline_source: contract.baselineSource,
    baseline_source_epoch_key: contract.baselineSourceEpochKey,
    baseline_group_id: contract.baselineGroupId,
    baseline_record_ids: contract.baselineRecordIds,
    baseline_elapsed_ms: contract.baselineElapsedMs,
    baseline_seconds: contract.baselineSeconds,
    structure_under_timer_seconds: contract.structureUnderTimerSeconds,
    repeated_timed_execution_seconds: contract.repeatedTimedExecutionSeconds,
    full_constraint_seconds: contract.fullConstraintSeconds,
    created_by_tutor_id: clean(tutorId),
    supersedes_contract_id: supersedesContractId,
  };

  if (isEmergencyDbMode()) {
    await pool.query(
      `INSERT INTO public.${TABLE} (
        contract_id,
        contract_version,
        student_id,
        topic,
        topic_key,
        baseline_source,
        baseline_source_epoch_key,
        baseline_group_id,
        baseline_record_ids,
        baseline_elapsed_ms,
        baseline_seconds,
        structure_under_timer_seconds,
        repeated_timed_execution_seconds,
        full_constraint_seconds,
        created_by_tutor_id,
        supersedes_contract_id
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16
      )
      ON CONFLICT (contract_id) DO NOTHING`,
      [
        row.contract_id,
        row.contract_version,
        row.student_id,
        row.topic,
        row.topic_key,
        row.baseline_source,
        row.baseline_source_epoch_key,
        row.baseline_group_id,
        JSON.stringify(row.baseline_record_ids),
        JSON.stringify(row.baseline_elapsed_ms),
        row.baseline_seconds,
        row.structure_under_timer_seconds,
        row.repeated_timed_execution_seconds,
        row.full_constraint_seconds,
        row.created_by_tutor_id,
        row.supersedes_contract_id,
      ],
    );
  } else {
    const { error } = await supabase.from(TABLE).insert(row);
    if (error && error.code !== "23505") {
      throw new Error(`Failed to persist TPS Timer Contract: ${error.message}`);
    }
  }

  const persisted = await loadTpsTimerContractById(contractId);
  if (!persisted) {
    throw new Error("TPS Timer Contract was not readable after persistence");
  }
  return persisted;
};


const BASELINE_ATTEMPT_TABLE = "response_integrity_tps_baseline_attempts";

export type PersistedTpsPassiveAttempt = TpsPassiveAttemptSubmissionV1 & {
  studentId: string;
  topic: string;
  collectedByTutorId: string;
  createdAt: string | null;
};

const rowToPassiveAttempt = (
  row: Record<string, any>,
): PersistedTpsPassiveAttempt => ({
  attemptId: clean(row.attempt_id),
  studentId: clean(row.student_id),
  topic: clean(row.topic),
  collectedByTutorId: clean(row.collected_by_tutor_id),
  source: clean(row.source) as TpsPassiveAttemptSubmissionV1["source"],
  sourceContextId: clean(row.source_context_id),
  sourceItemId: clean(row.source_item_id),
  slotNumber: Number(row.slot_number),
  attemptNumber: Number(row.attempt_number),
  startedAt: new Date(row.started_at).toISOString(),
  endedAt: new Date(row.ended_at).toISOString(),
  elapsedMs: Number(row.elapsed_ms),
  timingValidity: clean(
    row.timing_validity,
  ) as TpsPassiveAttemptSubmissionV1["timingValidity"],
  endReason: clean(
    row.end_reason,
  ) as TpsPassiveAttemptSubmissionV1["endReason"],
  replacementForAttemptId: clean(row.replacement_for_attempt_id) || null,
  createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
});

export const loadTpsPassiveAttemptById = async (
  attemptId: string,
): Promise<PersistedTpsPassiveAttempt | null> => {
  const normalizedId = clean(attemptId);
  if (!normalizedId) return null;

  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT *
         FROM public.${BASELINE_ATTEMPT_TABLE}
        WHERE attempt_id = $1
        LIMIT 1`,
      [normalizedId],
    );
    return result.rows[0] ? rowToPassiveAttempt(result.rows[0]) : null;
  }

  const { data, error } = await supabase
    .from(BASELINE_ATTEMPT_TABLE)
    .select("*")
    .eq("attempt_id", normalizedId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load passive baseline timing attempt: ${error.message}`);
  }
  return data ? rowToPassiveAttempt(data as Record<string, any>) : null;
};

export const persistTpsPassiveAttempt = async ({
  studentId,
  topic,
  attempt,
  tutorId,
}: {
  studentId: string;
  topic: string;
  attempt: TpsPassiveAttemptSubmissionV1;
  tutorId: string;
}): Promise<PersistedTpsPassiveAttempt> => {
  const validation = validateTpsPassiveAttemptSubmission(attempt);
  if (!validation.ok) {
    throw Object.assign(new Error(validation.error), {
      statusCode: 400,
      code: "TPS_PASSIVE_ATTEMPT_INVALID",
    });
  }

  const normalizedStudentId = clean(studentId);
  const normalizedTopic = clean(topic);
  if (!normalizedStudentId || !normalizedTopic) {
    throw Object.assign(
      new Error("Student and topic are required for passive baseline timing."),
      { statusCode: 400, code: "TPS_PASSIVE_ATTEMPT_IDENTITY_REQUIRED" },
    );
  }
  if (
    attempt.source === "training" &&
    attempt.sourceItemId !== TPS_TRAINING_BASELINE_SET_ID
  ) {
    throw Object.assign(
      new Error("Training passive timing is only valid for canonical Independent Execution."),
      { statusCode: 400, code: "TPS_PASSIVE_ATTEMPT_SOURCE_INVALID" },
    );
  }
  if (
    attempt.source === "diagnosis" &&
    attempt.sourceItemId !== "stack.normal_independent" &&
    attempt.sourceItemId !== "execution.repeatability"
  ) {
    throw Object.assign(
      new Error("Diagnosis passive timing is only valid for clean comparable independent opportunities."),
      { statusCode: 400, code: "TPS_PASSIVE_ATTEMPT_SOURCE_INVALID" },
    );
  }

  const existing = await loadTpsPassiveAttemptById(attempt.attemptId);
  if (existing) {
    const same =
      existing.studentId === normalizedStudentId &&
      topicKey(existing.topic) === topicKey(normalizedTopic) &&
      existing.source === attempt.source &&
      existing.sourceContextId === attempt.sourceContextId &&
      existing.sourceItemId === attempt.sourceItemId &&
      existing.slotNumber === attempt.slotNumber &&
      existing.attemptNumber === attempt.attemptNumber &&
      existing.startedAt === new Date(attempt.startedAt).toISOString() &&
      existing.endedAt === new Date(attempt.endedAt).toISOString() &&
      existing.elapsedMs === attempt.elapsedMs &&
      existing.timingValidity === attempt.timingValidity &&
      existing.endReason === attempt.endReason &&
      (existing.replacementForAttemptId || null) ===
        (attempt.replacementForAttemptId || null);
    if (!same) {
      throw Object.assign(
        new Error("Passive timing attempt ID is already bound to different immutable evidence."),
        { statusCode: 409, code: "TPS_PASSIVE_ATTEMPT_ID_CONFLICT" },
      );
    }
    return existing;
  }

  if (attempt.replacementForAttemptId) {
    const replaced = await loadTpsPassiveAttemptById(
      attempt.replacementForAttemptId,
    );
    if (
      !replaced ||
      replaced.studentId !== normalizedStudentId ||
      topicKey(replaced.topic) !== topicKey(normalizedTopic) ||
      replaced.source !== attempt.source ||
      replaced.sourceContextId !== attempt.sourceContextId ||
      replaced.sourceItemId !== attempt.sourceItemId ||
      replaced.slotNumber !== attempt.slotNumber ||
      replaced.timingValidity !== "timing_invalid_technical"
    ) {
      throw Object.assign(
        new Error("Passive replacement lineage must point to a technical-invalid attempt for the same student/topic/source/context/opportunity."),
        { statusCode: 409, code: "TPS_PASSIVE_REPLACEMENT_LINEAGE_INVALID" },
      );
    }
  } else if (attempt.attemptNumber > 1) {
    throw Object.assign(
      new Error("Passive replacement attempts must identify the technical-invalid attempt they replace."),
      { statusCode: 409, code: "TPS_PASSIVE_REPLACEMENT_LINEAGE_REQUIRED" },
    );
  }

  const row = {
    attempt_id: attempt.attemptId,
    student_id: normalizedStudentId,
    topic: normalizedTopic,
    topic_key: topicKey(normalizedTopic),
    collected_by_tutor_id: clean(tutorId),
    source: attempt.source,
    source_context_id: attempt.sourceContextId,
    source_item_id: attempt.sourceItemId,
    slot_number: attempt.slotNumber,
    attempt_number: attempt.attemptNumber,
    started_at: attempt.startedAt,
    ended_at: attempt.endedAt,
    elapsed_ms: attempt.elapsedMs,
    timing_validity: attempt.timingValidity,
    end_reason: attempt.endReason,
    replacement_for_attempt_id: attempt.replacementForAttemptId || null,
  };

  if (isEmergencyDbMode()) {
    await pool.query(
      `INSERT INTO public.${BASELINE_ATTEMPT_TABLE} (
        attempt_id, student_id, topic, topic_key, collected_by_tutor_id,
        source, source_context_id, source_item_id, slot_number, attempt_number,
        started_at, ended_at, elapsed_ms, timing_validity, end_reason,
        replacement_for_attempt_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )`,
      [
        row.attempt_id,
        row.student_id,
        row.topic,
        row.topic_key,
        row.collected_by_tutor_id,
        row.source,
        row.source_context_id,
        row.source_item_id,
        row.slot_number,
        row.attempt_number,
        row.started_at,
        row.ended_at,
        row.elapsed_ms,
        row.timing_validity,
        row.end_reason,
        row.replacement_for_attempt_id,
      ],
    );
  } else {
    const { error } = await supabase
      .from(BASELINE_ATTEMPT_TABLE)
      .insert(row);
    if (error) {
      throw Object.assign(
        new Error(`Failed to persist passive baseline timing attempt: ${error.message}`),
        {
          statusCode: error.code === "23505" ? 409 : 500,
          code: error.code || "TPS_PASSIVE_ATTEMPT_PERSISTENCE_FAILED",
        },
      );
    }
  }

  const persisted = await loadTpsPassiveAttemptById(attempt.attemptId);
  if (!persisted) {
    throw new Error("Passive baseline timing attempt was not readable after persistence");
  }
  return persisted;
};

const validatePassiveAttemptReference = async ({
  reference,
  studentId,
  topic,
  source,
  sourceContextId,
  sourceItemId,
  slotNumber,
  rawTiming,
}: {
  reference: TpsPassiveAttemptEvidenceRefV1 | null;
  studentId: string;
  topic: string;
  source: TpsPassiveAttemptSubmissionV1["source"];
  sourceContextId: string;
  sourceItemId: string;
  slotNumber: number;
  rawTiming: unknown;
}): Promise<string | null> => {
  if (!reference) return "Passive timing is missing durable attempt lineage.";
  if (
    reference.source !== source ||
    reference.sourceContextId !== sourceContextId ||
    reference.sourceItemId !== sourceItemId ||
    reference.slotNumber !== slotNumber
  ) {
    return "Passive timing lineage does not match the canonical source context/opportunity.";
  }

  const timing =
    typeof rawTiming === "string"
      ? decodePassiveExecutionTimingEvidence(rawTiming)
      : rawTiming && typeof rawTiming === "object"
        ? (() => {
            try {
              return decodePassiveExecutionTimingEvidence(JSON.stringify(rawTiming));
            } catch {
              return null;
            }
          })()
        : null;
  if (!timing) return "Passive timing evidence is missing or invalid.";

  const persisted = await loadTpsPassiveAttemptById(reference.attemptId);
  if (!persisted) return "Passive timing lineage points to a missing persisted attempt.";
  if (
    persisted.studentId !== studentId ||
    topicKey(persisted.topic) !== topicKey(topic) ||
    persisted.source !== source ||
    persisted.sourceContextId !== sourceContextId ||
    persisted.sourceItemId !== sourceItemId ||
    persisted.slotNumber !== slotNumber ||
    persisted.attemptNumber !== reference.attemptNumber ||
    persisted.timingValidity !== "valid" ||
    persisted.endReason !== "student_finished" ||
    persisted.startedAt !== timing.startedAt ||
    persisted.endedAt !== timing.endedAt ||
    persisted.elapsedMs !== timing.elapsedMs
  ) {
    return "Passive timing lineage does not match the accepted execution boundary.";
  }
  return null;
};

export const validateTrainingPassiveTimingAttemptLineage = async ({
  studentId,
  topic,
  sourceContextId,
  sets,
}: {
  studentId: string;
  topic: string;
  sourceContextId: string;
  sets: any[];
}): Promise<string | null> => {
  const baselineSet = (Array.isArray(sets) ? sets : []).find(
    (set: any) => clean(set?.setId) === TPS_TRAINING_BASELINE_SET_ID,
  );
  if (!baselineSet) return "Structured Execution is missing canonical Independent Execution.";

  const observations = Array.isArray(baselineSet.observations)
    ? baselineSet.observations
    : [];
  for (let index = 0; index < observations.length; index += 1) {
    const repNumber = Number(observations[index]?._rep_number || index + 1);
    const reference = decodeTpsPassiveAttemptEvidenceRef(
      observations[index]?.[PASSIVE_EXECUTION_ATTEMPT_WIRE_KEY],
    );
    const error = await validatePassiveAttemptReference({
      reference,
      studentId,
      topic,
      source: "training",
      sourceContextId,
      sourceItemId: TPS_TRAINING_BASELINE_SET_ID,
      slotNumber: repNumber,
      rawTiming: observations[index]?.[PASSIVE_EXECUTION_TIMING_WIRE_KEY],
    });
    if (error) {
      return `Independent Execution Rep ${repNumber}: ${error}`;
    }
  }
  return null;
};

export const validateDiagnosisPassiveTimingAttemptLineage = async ({
  studentId,
  topic,
  runId,
  probeHistory,
}: {
  studentId: string;
  topic: string;
  runId: string;
  probeHistory: Array<Record<string, any>>;
}): Promise<string | null> => {
  for (let index = 0; index < probeHistory.length; index += 1) {
    const result = probeHistory[index];
    if (!result?.passiveTiming) continue;
    const reference = validateTpsPassiveAttemptEvidenceRef(
      result.passiveTimingAttempt,
    );
    const error = await validatePassiveAttemptReference({
      reference,
      studentId,
      topic,
      source: "diagnosis",
      sourceContextId: runId,
      sourceItemId: clean(result.probeId),
      slotNumber: index + 1,
      rawTiming: JSON.stringify(result.passiveTiming),
    });
    if (error) {
      return `Diagnosis Opportunity ${index + 1}: ${error}`;
    }
  }
  return null;
};

const TIMED_ATTEMPT_TABLE = "response_integrity_tps_timed_attempts";

export type PersistedTpsTimedAttempt = TpsTimedAttemptSubmissionV1 & {
  contractId: string;
  contractVersion: 1;
  studentId: string;
  topic: string;
  baselineSeconds: number;
  collectedByTutorId: string;
  createdAt: string | null;
};

const rowToTimedAttempt = (row: Record<string, any>): PersistedTpsTimedAttempt => ({
  attemptId: clean(row.attempt_id),
  contractId: clean(row.contract_id),
  contractVersion: 1,
  studentId: clean(row.student_id),
  topic: clean(row.topic),
  collectedByTutorId: clean(row.collected_by_tutor_id),
  setId: clean(row.set_id) as TpsTimedAttemptSubmissionV1["setId"],
  setName: clean(row.set_name),
  repNumber: Number(row.rep_number),
  attemptNumber: Number(row.attempt_number),
  pressureLevel: clean(row.pressure_level) as TpsTimedAttemptSubmissionV1["pressureLevel"],
  baselineSeconds: Number(row.baseline_seconds),
  prescribedSeconds: Number(row.prescribed_seconds),
  startedAt: new Date(row.started_at).toISOString(),
  endedAt: new Date(row.ended_at).toISOString(),
  elapsedMs: Number(row.elapsed_ms),
  completedBeforeExpiry: row.completed_before_expiry === true,
  timingValidity: clean(row.timing_validity) as TpsTimedAttemptSubmissionV1["timingValidity"],
  endReason: clean(row.end_reason) as TpsTimedAttemptSubmissionV1["endReason"],
  replacementForAttemptId: clean(row.replacement_for_attempt_id) || null,
  createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
});

export const loadTpsTimedAttemptById = async (
  attemptId: string,
): Promise<PersistedTpsTimedAttempt | null> => {
  const normalizedId = clean(attemptId);
  if (!normalizedId) return null;

  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT *
         FROM public.${TIMED_ATTEMPT_TABLE}
        WHERE attempt_id = $1
        LIMIT 1`,
      [normalizedId],
    );
    return result.rows[0] ? rowToTimedAttempt(result.rows[0]) : null;
  }

  const { data, error } = await supabase
    .from(TIMED_ATTEMPT_TABLE)
    .select("*")
    .eq("attempt_id", normalizedId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load TPS timed attempt: ${error.message}`);
  }
  return data ? rowToTimedAttempt(data as Record<string, any>) : null;
};

export const persistTpsTimedAttempt = async ({
  contract,
  attempt,
  tutorId,
}: {
  contract: PersistedTpsTimerContract;
  attempt: TpsTimedAttemptSubmissionV1;
  tutorId: string;
}): Promise<PersistedTpsTimedAttempt> => {
  const validation = validateTpsTimedAttemptAgainstContract({
    contract,
    attempt,
  });
  if (!validation.ok) {
    throw Object.assign(new Error(validation.error), {
      statusCode: 400,
      code: "TPS_TIMED_ATTEMPT_INVALID",
    });
  }

  const existing = await loadTpsTimedAttemptById(attempt.attemptId);
  if (existing) {
    const same =
      existing.contractId === contract.contractId &&
      existing.setId === attempt.setId &&
      existing.repNumber === attempt.repNumber &&
      existing.attemptNumber === attempt.attemptNumber &&
      existing.startedAt === new Date(attempt.startedAt).toISOString() &&
      existing.endedAt === new Date(attempt.endedAt).toISOString() &&
      existing.elapsedMs === attempt.elapsedMs &&
      existing.timingValidity === attempt.timingValidity &&
      existing.endReason === attempt.endReason;
    if (!same) {
      throw Object.assign(
        new Error("TPS attempt ID is already bound to different immutable timing evidence."),
        { statusCode: 409, code: "TPS_ATTEMPT_ID_CONFLICT" },
      );
    }
    return existing;
  }

  if (attempt.replacementForAttemptId) {
    const replaced = await loadTpsTimedAttemptById(attempt.replacementForAttemptId);
    if (
      !replaced ||
      replaced.contractId !== contract.contractId ||
      replaced.setId !== attempt.setId ||
      replaced.repNumber !== attempt.repNumber ||
      replaced.timingValidity !== "timing_invalid_technical"
    ) {
      throw Object.assign(
        new Error("TPS replacement lineage must point to a technical-invalid attempt for the same contract/set/rep."),
        { statusCode: 409, code: "TPS_REPLACEMENT_LINEAGE_INVALID" },
      );
    }
  } else if (attempt.attemptNumber > 1) {
    throw Object.assign(
      new Error("TPS replacement attempts must identify the technical-invalid attempt they replace."),
      { statusCode: 409, code: "TPS_REPLACEMENT_LINEAGE_REQUIRED" },
    );
  }

  const row = {
    attempt_id: attempt.attemptId,
    contract_id: contract.contractId,
    contract_version: contract.version,
    student_id: contract.studentId,
    topic: contract.topic,
    topic_key: topicKey(contract.topic),
    collected_by_tutor_id: clean(tutorId),
    set_id: attempt.setId,
    set_name: attempt.setName,
    rep_number: attempt.repNumber,
    attempt_number: attempt.attemptNumber,
    pressure_level: attempt.pressureLevel,
    baseline_seconds: contract.baselineSeconds,
    prescribed_seconds: attempt.prescribedSeconds,
    started_at: attempt.startedAt,
    ended_at: attempt.endedAt,
    elapsed_ms: attempt.elapsedMs,
    completed_before_expiry: attempt.completedBeforeExpiry,
    timing_validity: attempt.timingValidity,
    end_reason: attempt.endReason,
    replacement_for_attempt_id: attempt.replacementForAttemptId || null,
  };

  if (isEmergencyDbMode()) {
    await pool.query(
      `INSERT INTO public.${TIMED_ATTEMPT_TABLE} (
        attempt_id, contract_id, contract_version, student_id, topic, topic_key,
        collected_by_tutor_id, set_id, set_name, rep_number, attempt_number,
        pressure_level, baseline_seconds, prescribed_seconds, started_at, ended_at,
        elapsed_ms, completed_before_expiry, timing_validity, end_reason,
        replacement_for_attempt_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )`,
      [
        row.attempt_id, row.contract_id, row.contract_version, row.student_id,
        row.topic, row.topic_key, row.collected_by_tutor_id, row.set_id,
        row.set_name, row.rep_number, row.attempt_number, row.pressure_level,
        row.baseline_seconds, row.prescribed_seconds, row.started_at, row.ended_at,
        row.elapsed_ms, row.completed_before_expiry, row.timing_validity,
        row.end_reason, row.replacement_for_attempt_id,
      ],
    );
  } else {
    const { error } = await supabase.from(TIMED_ATTEMPT_TABLE).insert(row);
    if (error) {
      throw Object.assign(
        new Error(`Failed to persist TPS timed attempt: ${error.message}`),
        { statusCode: error.code === "23505" ? 409 : 500, code: error.code || "TPS_ATTEMPT_PERSISTENCE_FAILED" },
      );
    }
  }

  const persisted = await loadTpsTimedAttemptById(attempt.attemptId);
  if (!persisted) {
    throw new Error("TPS timed attempt was not readable after persistence");
  }
  return persisted;
};


export const validateTpsTrainingDrillTimedAttemptLineage = async ({
  contract,
  sets,
}: {
  contract: PersistedTpsTimerContract;
  sets: any[];
}): Promise<string | null> => {
  const normalizedSets = Array.isArray(sets) ? sets : [];
  const seenAttemptIds = new Set<string>();

  for (const set of normalizedSets) {
    const setId = clean(set?.setId);
    const pressureLevel = getTpsTrainingPressureForSet(setId);
    if (!pressureLevel) {
      return `TPS Training contains an unknown timed set: ${setId || "missing set ID"}.`;
    }

    const prescribedSeconds = getTpsPrescribedSeconds(contract, pressureLevel);
    const observations = Array.isArray(set?.observations) ? set.observations : [];
    for (let index = 0; index < observations.length; index += 1) {
      const repNumber = Number(observations[index]?._rep_number || index + 1);
      const reference = decodeTpsTimedAttemptEvidenceRef(
        observations[index]?.[TPS_TIMED_ATTEMPT_WIRE_KEY],
      );
      if (!reference) {
        return `${clean(set?.setName) || setId} Rep ${repNumber} is missing valid system-owned TPS timing lineage.`;
      }
      if (
        reference.contractId !== contract.contractId ||
        reference.setId !== setId ||
        reference.repNumber !== repNumber
      ) {
        return `${clean(set?.setName) || setId} Rep ${repNumber} timing lineage does not match the active Timer Contract and canonical rep identity.`;
      }
      if (seenAttemptIds.has(reference.attemptId)) {
        return `TPS timed attempt ${reference.attemptId} was reused across more than one canonical rep.`;
      }
      seenAttemptIds.add(reference.attemptId);

      const attempt = await loadTpsTimedAttemptById(reference.attemptId);
      if (!attempt) {
        return `${clean(set?.setName) || setId} Rep ${repNumber} does not have a persisted TPS timed-attempt record.`;
      }
      if (
        attempt.contractId !== contract.contractId ||
        attempt.studentId !== contract.studentId ||
        topicKey(attempt.topic) !== topicKey(contract.topic) ||
        attempt.setId !== setId ||
        attempt.repNumber !== repNumber ||
        attempt.attemptNumber !== reference.attemptNumber ||
        attempt.pressureLevel !== pressureLevel ||
        attempt.prescribedSeconds !== prescribedSeconds ||
        attempt.timingValidity !== "valid" ||
        attempt.endReason !== reference.endReason ||
        reference.timingValidity !== "valid"
      ) {
        return `${clean(set?.setName) || setId} Rep ${repNumber} timed-attempt lineage is not valid for the active individualized Timer Contract.`;
      }
    }
  }

  return null;
};
