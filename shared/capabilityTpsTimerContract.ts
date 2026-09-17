import type {
  ActualSupportUsedV2,
  RepTimingBaselineSourceV2,
  RepTimingValidityV2,
} from "./responseIntegrityEvidenceContractV2";

export const TPS_TIMER_CONTRACT_VERSION = 1 as const;
export const TPS_BASELINE_SAMPLE_SIZE = 3 as const;
export const TPS_FULL_CONSTRAINT_FACTOR = 0.85 as const;

export type TpsPressureLevel =
  | "none"
  | "difficulty"
  | "light_timer"
  | "repeated_timer"
  | "full_constraint";

export type TpsVariationLevel = "same_form" | "changed_form";
export type TpsDifficultyLevel = "recognition" | "normal" | "challenging";
export type TpsBaselineRecordSource = "historical_untimed" | "calibration";

export type PassiveRepTimingRecord = {
  recordId: string;
  studentId: string;
  topic: string;
  completedAt: string;
  elapsedMs: number;
  pressureLevel: TpsPressureLevel;
  variationLevel: TpsVariationLevel;
  difficultyLevel: TpsDifficultyLevel;
  actualSupportUsed: ActualSupportUsedV2;
  structurallyValidCompletion: boolean;
  timingValidity: RepTimingValidityV2;
  source: TpsBaselineRecordSource;
};

export type TpsTimerContractV1 = {
  version: typeof TPS_TIMER_CONTRACT_VERSION;
  studentId: string;
  topic: string;
  baselineSource: RepTimingBaselineSourceV2;
  baselineSampleRecordIds: string[];
  baselineSampleElapsedMs: number[];
  baselineSeconds: number;
  structureUnderTimerSeconds: number;
  repeatedTimedExecutionSeconds: number;
  fullConstraintSeconds: number;
};

export type TpsTimedAttempt = {
  attemptId: string;
  timerContractVersion: typeof TPS_TIMER_CONTRACT_VERSION;
  pressureLevel: Exclude<TpsPressureLevel, "none" | "difficulty">;
  prescribedSeconds: number;
  baselineSeconds: number;
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  completedBeforeExpiry: boolean;
  timingValidity: RepTimingValidityV2;
  replacementForAttemptId?: string | null;
};

const normalizeTopic = (topic: string) => String(topic || "").trim().toLowerCase();

const parsedTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const isEligibleTpsBaselineRecord = (
  record: PassiveRepTimingRecord,
  studentId: string,
  topic: string,
  source: TpsBaselineRecordSource,
) => {
  const timestamp = parsedTimestamp(record.completedAt);
  return (
    record.studentId === studentId &&
    normalizeTopic(record.topic) === normalizeTopic(topic) &&
    record.source === source &&
    record.pressureLevel === "none" &&
    record.variationLevel === "same_form" &&
    record.difficultyLevel === "normal" &&
    record.actualSupportUsed === "none" &&
    record.structurallyValidCompletion === true &&
    record.timingValidity === "valid" &&
    Number.isFinite(record.elapsedMs) &&
    record.elapsedMs > 0 &&
    timestamp !== null
  );
};

export const selectTpsBaselineSamples = ({
  records,
  studentId,
  topic,
  source,
}: {
  records: PassiveRepTimingRecord[];
  studentId: string;
  topic: string;
  source: TpsBaselineRecordSource;
}) =>
  records
    .filter((record) => isEligibleTpsBaselineRecord(record, studentId, topic, source))
    .sort((left, right) => {
      const completedDifference = Date.parse(right.completedAt) - Date.parse(left.completedAt);
      if (completedDifference !== 0) return completedDifference;
      return right.recordId.localeCompare(left.recordId);
    })
    .slice(0, TPS_BASELINE_SAMPLE_SIZE);

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

const secondsFromMs = (elapsedMs: number) => Math.max(1, Math.round(elapsedMs / 1000));

export const deriveTpsTimerContractV1 = ({
  records,
  studentId,
  topic,
  source = "historical_untimed",
}: {
  records: PassiveRepTimingRecord[];
  studentId: string;
  topic: string;
  source?: TpsBaselineRecordSource;
}): TpsTimerContractV1 | null => {
  const samples = selectTpsBaselineSamples({ records, studentId, topic, source });
  if (samples.length < TPS_BASELINE_SAMPLE_SIZE) return null;

  const baselineMs = median(samples.map((sample) => sample.elapsedMs));
  const baselineSeconds = secondsFromMs(baselineMs);
  const fullConstraintSeconds = Math.max(1, Math.round(baselineSeconds * TPS_FULL_CONSTRAINT_FACTOR));

  return {
    version: TPS_TIMER_CONTRACT_VERSION,
    studentId,
    topic: topic.trim(),
    baselineSource: source === "calibration" ? "calibration" : "historical_eligible",
    baselineSampleRecordIds: samples.map((sample) => sample.recordId),
    baselineSampleElapsedMs: samples.map((sample) => sample.elapsedMs),
    baselineSeconds,
    structureUnderTimerSeconds: baselineSeconds,
    repeatedTimedExecutionSeconds: baselineSeconds,
    fullConstraintSeconds,
  };
};

export const needsTpsCalibration = ({
  records,
  studentId,
  topic,
}: {
  records: PassiveRepTimingRecord[];
  studentId: string;
  topic: string;
}) =>
  deriveTpsTimerContractV1({
    records,
    studentId,
    topic,
    source: "historical_untimed",
  }) === null;

export const getTpsPrescribedSeconds = (
  contract: TpsTimerContractV1,
  pressureLevel: Exclude<TpsPressureLevel, "none" | "difficulty">,
) => {
  if (pressureLevel === "light_timer") return contract.structureUnderTimerSeconds;
  if (pressureLevel === "repeated_timer") return contract.repeatedTimedExecutionSeconds;
  return contract.fullConstraintSeconds;
};

export const isScorableTpsTimedAttempt = (attempt: TpsTimedAttempt) =>
  attempt.timingValidity === "valid" &&
  Number.isFinite(attempt.elapsedMs) &&
  attempt.elapsedMs >= 0 &&
  Number.isFinite(attempt.prescribedSeconds) &&
  attempt.prescribedSeconds > 0;

export const createTechnicalInvalidTpsAttempt = ({
  attemptId,
  pressureLevel,
  prescribedSeconds,
  baselineSeconds,
  startedAt,
  endedAt,
  elapsedMs,
  replacementForAttemptId = null,
}: Omit<TpsTimedAttempt, "timerContractVersion" | "completedBeforeExpiry" | "timingValidity"> & {
  replacementForAttemptId?: string | null;
}): TpsTimedAttempt => ({
  attemptId,
  timerContractVersion: TPS_TIMER_CONTRACT_VERSION,
  pressureLevel,
  prescribedSeconds,
  baselineSeconds,
  startedAt,
  endedAt,
  elapsedMs,
  completedBeforeExpiry: false,
  timingValidity: "timing_invalid_technical",
  replacementForAttemptId,
});
