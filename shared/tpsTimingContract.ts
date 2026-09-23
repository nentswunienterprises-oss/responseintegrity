export const TPS_TIMER_CONTRACT_VERSION = 1 as const;
export const TPS_BASELINE_SAMPLE_SIZE = 3 as const;
export const TPS_FULL_CONSTRAINT_FACTOR = 0.85 as const;
export const TPS_TRAINING_BASELINE_SET_ID = "structured_execution.independent_execution" as const;
export const PASSIVE_EXECUTION_TIMING_WIRE_KEY = "_passive_execution_timing_v1" as const;
export const TPS_TIMED_ATTEMPT_WIRE_KEY = "_tps_timed_attempt_v1" as const;

export type TimedExecutionEvidenceV1 = {
  version: 1;
  boundary: "system_countdown";
  prescribedSeconds: number;
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  completedBeforeExpiry: boolean;
  timingValidity: "valid";
};

export const buildTimedExecutionEvidence = ({
  startedAt,
  endedAt,
  prescribedSeconds,
}: {
  startedAt: string;
  endedAt: string;
  prescribedSeconds: number;
}): TimedExecutionEvidenceV1 | null => {
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs ||
    !Number.isFinite(prescribedSeconds) ||
    prescribedSeconds <= 0
  ) return null;
  const elapsedMs = endMs - startMs;
  return {
    version: 1,
    boundary: "system_countdown",
    prescribedSeconds: Math.max(1, Math.round(prescribedSeconds)),
    startedAt: new Date(startMs).toISOString(),
    endedAt: new Date(endMs).toISOString(),
    elapsedMs,
    completedBeforeExpiry: elapsedMs < Math.max(1, Math.round(prescribedSeconds)) * 1000,
    timingValidity: "valid",
  };
};

export const validateTimedExecutionEvidence = (
  value: unknown,
): TimedExecutionEvidenceV1 | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = value as Partial<TimedExecutionEvidenceV1>;
  if (
    parsed.version !== 1 ||
    parsed.boundary !== "system_countdown" ||
    parsed.timingValidity !== "valid" ||
    typeof parsed.prescribedSeconds !== "number" ||
    typeof parsed.startedAt !== "string" ||
    typeof parsed.endedAt !== "string" ||
    typeof parsed.elapsedMs !== "number" ||
    typeof parsed.completedBeforeExpiry !== "boolean"
  ) return null;

  const rebuilt = buildTimedExecutionEvidence({
    startedAt: parsed.startedAt,
    endedAt: parsed.endedAt,
    prescribedSeconds: parsed.prescribedSeconds,
  });
  if (
    !rebuilt ||
    rebuilt.elapsedMs !== parsed.elapsedMs ||
    rebuilt.completedBeforeExpiry !== parsed.completedBeforeExpiry
  ) return null;
  return rebuilt;
};

export type PassiveExecutionTimingEvidenceV1 = {
  version: 1;
  boundary: "begin_to_student_finished";
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  timingValidity: "valid";
};

export const buildPassiveExecutionTimingEvidence = ({
  startedAt,
  endedAt,
}: {
  startedAt: string;
  endedAt: string;
}): PassiveExecutionTimingEvidenceV1 | null => {
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return {
    version: 1,
    boundary: "begin_to_student_finished",
    startedAt: new Date(startMs).toISOString(),
    endedAt: new Date(endMs).toISOString(),
    elapsedMs: endMs - startMs,
    timingValidity: "valid",
  };
};

export const encodePassiveExecutionTimingEvidence = (
  evidence: PassiveExecutionTimingEvidenceV1,
) => JSON.stringify(evidence);

export const decodePassiveExecutionTimingEvidence = (
  raw: unknown,
): PassiveExecutionTimingEvidenceV1 | null => {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PassiveExecutionTimingEvidenceV1>;
    if (
      parsed.version !== 1 ||
      parsed.boundary !== "begin_to_student_finished" ||
      parsed.timingValidity !== "valid" ||
      typeof parsed.startedAt !== "string" ||
      typeof parsed.endedAt !== "string" ||
      typeof parsed.elapsedMs !== "number"
    ) return null;
    const recomputed = buildPassiveExecutionTimingEvidence({
      startedAt: parsed.startedAt,
      endedAt: parsed.endedAt,
    });
    if (!recomputed || recomputed.elapsedMs !== parsed.elapsedMs) return null;
    return recomputed;
  } catch {
    return null;
  }
};

export type TpsBaselineSource = "training" | "diagnosis";
export type TpsBaselinePressureLevel =
  | "none"
  | "difficulty"
  | "light_timer"
  | "repeated_timer"
  | "full_constraint";
export type TpsBaselineVariationLevel = "same_form" | "changed_form";
export type TpsBaselineDifficultyLevel = "recognition" | "normal" | "challenging";
export type TpsTimingValidity = "valid" | "timing_invalid_technical" | "confounded";

export type TpsBaselineSlot = 1 | 2 | 3;

export type TpsBaselineTimingRecord = {
  recordId: string;
  studentId: string;
  topic: string;
  source: TpsBaselineSource;
  sourceEpochKey: string;
  baselineGroupId: string;
  baselineSlot: TpsBaselineSlot;
  attemptNumber: number;
  sourcePhase: "Structured Execution" | "diagnosis";
  sourceSetId: string;
  completedAt: string;
  elapsedMs: number;
  pressureLevel: TpsBaselinePressureLevel;
  variationLevel: TpsBaselineVariationLevel;
  difficultyLevel: TpsBaselineDifficultyLevel;
  independencePreserved: boolean;
  structurallyValidCompletion: boolean;
  timingValidity: TpsTimingValidity;
  replacementForRecordId?: string | null;
};

export type TpsBaselineSnapshot = {
  source: TpsBaselineSource;
  sourceEpochKey: string;
  baselineGroupId: string;
  studentId: string;
  topic: string;
  recordIds: [string, string, string];
  elapsedMs: [number, number, number];
  baselineSeconds: number;
  completedAt: string;
};

export type TpsTimerContractV1 = {
  version: typeof TPS_TIMER_CONTRACT_VERSION;
  studentId: string;
  topic: string;
  baselineSource: "training_independent_execution" | "diagnosis_independent_baseline";
  baselineSourceEpochKey: string;
  baselineGroupId: string;
  baselineRecordIds: [string, string, string];
  baselineElapsedMs: [number, number, number];
  baselineSeconds: number;
  structureUnderTimerSeconds: number;
  repeatedTimedExecutionSeconds: number;
  fullConstraintSeconds: number;
};

const normalizeTopic = (topic: string) => String(topic || "").trim().toLowerCase();

const timestamp = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isBaselineSlot = (value: number): value is TpsBaselineSlot =>
  value === 1 || value === 2 || value === 3;

export const isEligibleTpsBaselineRecord = (
  record: TpsBaselineTimingRecord,
  studentId: string,
  topic: string,
) => {
  const completedAt = timestamp(record.completedAt);
  const sourceShapeIsValid =
    record.source === "training"
      ? record.sourcePhase === "Structured Execution" &&
        record.sourceSetId === TPS_TRAINING_BASELINE_SET_ID
      : record.sourcePhase === "diagnosis";

  return (
    record.studentId === studentId &&
    normalizeTopic(record.topic) === normalizeTopic(topic) &&
    sourceShapeIsValid &&
    Boolean(record.sourceEpochKey) &&
    Boolean(record.baselineGroupId) &&
    isBaselineSlot(record.baselineSlot) &&
    Number.isInteger(record.attemptNumber) &&
    record.attemptNumber > 0 &&
    record.pressureLevel === "none" &&
    record.variationLevel === "same_form" &&
    record.difficultyLevel === "normal" &&
    record.independencePreserved === true &&
    record.structurallyValidCompletion === true &&
    record.timingValidity === "valid" &&
    Number.isFinite(record.elapsedMs) &&
    record.elapsedMs > 0 &&
    completedAt !== null
  );
};

const newestEligibleAttemptBySlot = (
  records: TpsBaselineTimingRecord[],
): Map<TpsBaselineSlot, TpsBaselineTimingRecord> => {
  const selected = new Map<TpsBaselineSlot, TpsBaselineTimingRecord>();
  for (const record of records) {
    const current = selected.get(record.baselineSlot);
    if (!current) {
      selected.set(record.baselineSlot, record);
      continue;
    }

    const attemptDifference = record.attemptNumber - current.attemptNumber;
    if (attemptDifference > 0) {
      selected.set(record.baselineSlot, record);
      continue;
    }
    if (attemptDifference < 0) continue;

    const completedDifference =
      (timestamp(record.completedAt) || 0) - (timestamp(current.completedAt) || 0);
    if (completedDifference > 0) {
      selected.set(record.baselineSlot, record);
      continue;
    }
    if (completedDifference === 0 && record.recordId.localeCompare(current.recordId) > 0) {
      selected.set(record.baselineSlot, record);
    }
  }
  return selected;
};

const completeGroup = (
  records: TpsBaselineTimingRecord[],
  studentId: string,
  topic: string,
): [TpsBaselineTimingRecord, TpsBaselineTimingRecord, TpsBaselineTimingRecord] | null => {
  const eligible = records.filter((record) =>
    isEligibleTpsBaselineRecord(record, studentId, topic),
  );
  const selected = newestEligibleAttemptBySlot(eligible);
  const first = selected.get(1);
  const second = selected.get(2);
  const third = selected.get(3);
  if (!first || !second || !third) return null;
  return [first, second, third];
};

const groupCompletedAt = (
  group: [TpsBaselineTimingRecord, TpsBaselineTimingRecord, TpsBaselineTimingRecord],
) => Math.max(...group.map((record) => timestamp(record.completedAt) || 0));

export const selectLatestCompleteTrainingBaselineSet = ({
  records,
  studentId,
  topic,
  sourceEpochKey,
}: {
  records: TpsBaselineTimingRecord[];
  studentId: string;
  topic: string;
  sourceEpochKey: string;
}): [TpsBaselineTimingRecord, TpsBaselineTimingRecord, TpsBaselineTimingRecord] | null => {
  const candidateGroups = new Map<string, TpsBaselineTimingRecord[]>();

  for (const record of records) {
    if (
      record.source !== "training" ||
      record.sourceEpochKey !== sourceEpochKey ||
      record.sourceSetId !== TPS_TRAINING_BASELINE_SET_ID
    ) {
      continue;
    }
    const group = candidateGroups.get(record.baselineGroupId) || [];
    group.push(record);
    candidateGroups.set(record.baselineGroupId, group);
  }

  const completeGroups = Array.from(candidateGroups.values())
    .map((groupRecords) => completeGroup(groupRecords, studentId, topic))
    .filter(
      (
        group,
      ): group is [
        TpsBaselineTimingRecord,
        TpsBaselineTimingRecord,
        TpsBaselineTimingRecord,
      ] => Boolean(group),
    )
    .sort((left, right) => {
      const timeDifference = groupCompletedAt(right) - groupCompletedAt(left);
      if (timeDifference !== 0) return timeDifference;
      return right[0].baselineGroupId.localeCompare(left[0].baselineGroupId);
    });

  return completeGroups[0] || null;
};

export const selectCompleteDiagnosisBaseline = ({
  records,
  studentId,
  topic,
  sourceEpochKey,
  baselineGroupId,
}: {
  records: TpsBaselineTimingRecord[];
  studentId: string;
  topic: string;
  sourceEpochKey: string;
  baselineGroupId: string;
}): [TpsBaselineTimingRecord, TpsBaselineTimingRecord, TpsBaselineTimingRecord] | null => {
  const groupRecords = records.filter(
    (record) =>
      record.source === "diagnosis" &&
      record.sourceEpochKey === sourceEpochKey &&
      record.baselineGroupId === baselineGroupId,
  );
  return completeGroup(groupRecords, studentId, topic);
};

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const secondsFromMs = (elapsedMs: number) => Math.max(1, Math.round(elapsedMs / 1000));

export const deriveTpsBaselineSnapshot = (
  group: [TpsBaselineTimingRecord, TpsBaselineTimingRecord, TpsBaselineTimingRecord],
): TpsBaselineSnapshot => {
  const elapsedMs = group.map((record) => record.elapsedMs) as [number, number, number];
  const completedAtRecord = [...group].sort(
    (left, right) => (timestamp(right.completedAt) || 0) - (timestamp(left.completedAt) || 0),
  )[0];

  return {
    source: group[0].source,
    sourceEpochKey: group[0].sourceEpochKey,
    baselineGroupId: group[0].baselineGroupId,
    studentId: group[0].studentId,
    topic: group[0].topic.trim(),
    recordIds: group.map((record) => record.recordId) as [string, string, string],
    elapsedMs,
    baselineSeconds: secondsFromMs(median(elapsedMs)),
    completedAt: completedAtRecord.completedAt,
  };
};

export const deriveTpsTimerContractV1 = (
  snapshot: TpsBaselineSnapshot,
): TpsTimerContractV1 => {
  const baselineSeconds = snapshot.baselineSeconds;
  const fullConstraintSeconds = Math.max(
    1,
    Math.round(baselineSeconds * TPS_FULL_CONSTRAINT_FACTOR),
  );

  return {
    version: TPS_TIMER_CONTRACT_VERSION,
    studentId: snapshot.studentId,
    topic: snapshot.topic,
    baselineSource:
      snapshot.source === "training"
        ? "training_independent_execution"
        : "diagnosis_independent_baseline",
    baselineSourceEpochKey: snapshot.sourceEpochKey,
    baselineGroupId: snapshot.baselineGroupId,
    baselineRecordIds: snapshot.recordIds,
    baselineElapsedMs: snapshot.elapsedMs,
    baselineSeconds,
    structureUnderTimerSeconds: baselineSeconds,
    repeatedTimedExecutionSeconds: baselineSeconds,
    fullConstraintSeconds,
  };
};

export const getTpsPrescribedSeconds = (
  contract: TpsTimerContractV1,
  pressureLevel: "light_timer" | "repeated_timer" | "full_constraint",
) => {
  if (pressureLevel === "light_timer") return contract.structureUnderTimerSeconds;
  if (pressureLevel === "repeated_timer") return contract.repeatedTimedExecutionSeconds;
  return contract.fullConstraintSeconds;
};


export const TPS_TRAINING_TIMED_SET_PRESSURE = {
  "time_pressure.structure_under_timer": "light_timer",
  "time_pressure.repeated_timed_execution": "repeated_timer",
  "time_pressure.full_constraint": "full_constraint",
} as const;

export type TpsTimedTrainingSetId = keyof typeof TPS_TRAINING_TIMED_SET_PRESSURE;
export type TpsTimedPressureLevel =
  (typeof TPS_TRAINING_TIMED_SET_PRESSURE)[TpsTimedTrainingSetId];
export type TpsTimedAttemptEndReason =
  | "student_finished"
  | "timer_expired"
  | "technical_failure";

export type TpsTimedAttemptSubmissionV1 = {
  attemptId: string;
  setId: TpsTimedTrainingSetId;
  setName: string;
  repNumber: number;
  attemptNumber: number;
  pressureLevel: TpsTimedPressureLevel;
  prescribedSeconds: number;
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  completedBeforeExpiry: boolean;
  timingValidity: "valid" | "timing_invalid_technical";
  endReason: TpsTimedAttemptEndReason;
  replacementForAttemptId?: string | null;
};

export type TpsTimedAttemptEvidenceRefV1 = {
  version: 1;
  attemptId: string;
  contractId: string;
  setId: TpsTimedTrainingSetId;
  repNumber: number;
  attemptNumber: number;
  timingValidity: "valid";
  endReason: "student_finished" | "timer_expired";
};

export const encodeTpsTimedAttemptEvidenceRef = (
  evidence: TpsTimedAttemptEvidenceRefV1,
) => JSON.stringify(evidence);

export const decodeTpsTimedAttemptEvidenceRef = (
  raw: unknown,
): TpsTimedAttemptEvidenceRefV1 | null => {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TpsTimedAttemptEvidenceRefV1>;
    if (
      parsed.version !== 1 ||
      typeof parsed.attemptId !== "string" ||
      !parsed.attemptId.trim() ||
      typeof parsed.contractId !== "string" ||
      !parsed.contractId.trim() ||
      typeof parsed.setId !== "string" ||
      !getTpsTrainingPressureForSet(parsed.setId) ||
      !Number.isInteger(parsed.repNumber) ||
      Number(parsed.repNumber) < 1 ||
      !Number.isInteger(parsed.attemptNumber) ||
      Number(parsed.attemptNumber) < 1 ||
      parsed.timingValidity !== "valid" ||
      (parsed.endReason !== "student_finished" &&
        parsed.endReason !== "timer_expired")
    ) {
      return null;
    }
    return {
      version: 1,
      attemptId: parsed.attemptId,
      contractId: parsed.contractId,
      setId: parsed.setId as TpsTimedTrainingSetId,
      repNumber: Number(parsed.repNumber),
      attemptNumber: Number(parsed.attemptNumber),
      timingValidity: "valid",
      endReason: parsed.endReason,
    };
  } catch {
    return null;
  }
};

export const getTpsTrainingPressureForSet = (
  setId: string,
): TpsTimedPressureLevel | null =>
  TPS_TRAINING_TIMED_SET_PRESSURE[setId as TpsTimedTrainingSetId] || null;

export type TpsTimedAttemptValidation =
  | { ok: true; attempt: TpsTimedAttemptSubmissionV1 }
  | { ok: false; error: string };

export const validateTpsTimedAttemptAgainstContract = ({
  contract,
  attempt,
}: {
  contract: TpsTimerContractV1;
  attempt: TpsTimedAttemptSubmissionV1;
}): TpsTimedAttemptValidation => {
  const expectedPressure = getTpsTrainingPressureForSet(attempt.setId);
  if (!expectedPressure) {
    return { ok: false, error: "Unknown TPS Training set." };
  }
  if (attempt.pressureLevel !== expectedPressure) {
    return {
      ok: false,
      error: `TPS pressure mismatch: ${attempt.setId} requires ${expectedPressure}.`,
    };
  }

  const expectedSeconds = getTpsPrescribedSeconds(contract, expectedPressure);
  if (
    !Number.isInteger(attempt.prescribedSeconds) ||
    attempt.prescribedSeconds !== expectedSeconds
  ) {
    return {
      ok: false,
      error: `TPS timer mismatch: ${attempt.setId} requires ${expectedSeconds}s.`,
    };
  }

  if (!String(attempt.attemptId || "").trim()) {
    return { ok: false, error: "TPS attempt ID is required." };
  }
  if (!Number.isInteger(attempt.repNumber) || attempt.repNumber < 1) {
    return { ok: false, error: "TPS rep number must be a positive integer." };
  }
  if (!Number.isInteger(attempt.attemptNumber) || attempt.attemptNumber < 1) {
    return { ok: false, error: "TPS attempt number must be a positive integer." };
  }
  if (
    attempt.replacementForAttemptId &&
    attempt.replacementForAttemptId === attempt.attemptId
  ) {
    return { ok: false, error: "A TPS attempt cannot replace itself." };
  }

  const startedMs = Date.parse(attempt.startedAt);
  const endedMs = Date.parse(attempt.endedAt);
  if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs) || endedMs < startedMs) {
    return { ok: false, error: "TPS attempt timestamps are invalid." };
  }
  const recomputedElapsedMs = endedMs - startedMs;
  if (
    !Number.isFinite(attempt.elapsedMs) ||
    attempt.elapsedMs < 0 ||
    attempt.elapsedMs !== recomputedElapsedMs
  ) {
    return { ok: false, error: "TPS elapsed time does not match its system boundaries." };
  }

  const expiryMs = expectedSeconds * 1000;
  if (attempt.timingValidity === "timing_invalid_technical") {
    if (attempt.endReason !== "technical_failure") {
      return {
        ok: false,
        error: "Technical-invalid TPS attempts must end as technical failures.",
      };
    }
    if (attempt.completedBeforeExpiry) {
      return {
        ok: false,
        error: "Technical-invalid TPS attempts cannot claim clean completion.",
      };
    }
    return { ok: true, attempt };
  }

  if (attempt.endReason === "technical_failure") {
    return {
      ok: false,
      error: "A valid TPS attempt cannot end as a technical failure.",
    };
  }

  if (attempt.endReason === "timer_expired") {
    if (attempt.elapsedMs !== expiryMs || attempt.completedBeforeExpiry) {
      return {
        ok: false,
        error: "Expired TPS attempts must end exactly at the prescribed system boundary.",
      };
    }
    return { ok: true, attempt };
  }

  if (attempt.elapsedMs >= expiryMs || !attempt.completedBeforeExpiry) {
    return {
      ok: false,
      error: "Student-finished TPS attempts must finish before the prescribed expiry boundary.",
    };
  }
  return { ok: true, attempt };
};
