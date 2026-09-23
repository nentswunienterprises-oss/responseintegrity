import { createHash } from "crypto";
import { pool } from "./db";
import { isEmergencyDbMode } from "./emergencyMode";
import { supabase } from "./storage";
import type { TpsTimerContractV1 } from "../shared/tpsTimingContract";

const TABLE = "response_integrity_tps_timer_contracts";

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
