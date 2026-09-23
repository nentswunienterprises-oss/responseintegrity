export const TPS_TIMER_CONTRACT_VERSION = 1 as const;
export const TPS_BASELINE_SAMPLE_SIZE = 3 as const;
export const TPS_FULL_CONSTRAINT_FACTOR = 0.85 as const;
export const TPS_TRAINING_BASELINE_SET_ID = "structured_execution.independent_execution" as const;

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
