import {
  deriveTpsTimerContractV1,
  isEligibleTpsBaselineRecord,
  type PassiveRepTimingRecord,
  type TpsDifficultyLevel,
  type TpsPressureLevel,
  type TpsTimingSourcePhase,
  type TpsVariationLevel,
} from "./capabilityTpsTimerContract";
import {
  decodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
} from "./responseIntegrityEvidenceContractV2";

export type StoredTpsDrillRow = {
  id?: unknown;
  student_id?: unknown;
  tutor_id?: unknown;
  submitted_at?: unknown;
  drill?: unknown;
};

const clean = (value: unknown) => String(value || "").trim();
const normalizeTopic = (value: unknown) => clean(value).toLowerCase();

const parseDrill = (value: unknown): Record<string, any> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : null;
  } catch {
    return null;
  }
};

const isPressureLevel = (value: unknown): value is TpsPressureLevel =>
  ["none", "difficulty", "light_timer", "repeated_timer", "full_constraint"].includes(clean(value));

const isVariationLevel = (value: unknown): value is TpsVariationLevel =>
  ["same_form", "changed_form"].includes(clean(value));

const isDifficultyLevel = (value: unknown): value is TpsDifficultyLevel =>
  ["recognition", "normal", "challenging"].includes(clean(value));

const isPreTpsPassiveTimingPhase = (value: unknown): value is Extract<
  TpsTimingSourcePhase,
  "Structured Execution" | "Controlled Discomfort"
> => ["Structured Execution", "Controlled Discomfort"].includes(clean(value));

export const isStructurallyValidPassiveCompletion = (observation: Record<string, unknown>) => {
  const levels = Object.entries(observation || {})
    .filter(([key]) => key.endsWith("_level"))
    .map(([, value]) => clean(value));
  return levels.length > 0 && levels.every((level) => level === "clear");
};

export const collectPassiveTpsTimingRecords = ({
  rows,
  studentId,
  topic,
}: {
  rows: StoredTpsDrillRow[];
  studentId: string;
  topic: string;
}): PassiveRepTimingRecord[] => {
  const normalizedStudentId = clean(studentId);
  const normalizedTopic = normalizeTopic(topic);
  const records: PassiveRepTimingRecord[] = [];

  for (const row of rows) {
    if (clean(row.student_id) !== normalizedStudentId) continue;
    const parsed = parseDrill(row.drill);
    if (!parsed || clean(parsed.drillType).toLowerCase() !== "training") continue;
    if (normalizeTopic(parsed.trainingTopic) !== normalizedTopic) continue;

    // V1 starts passive TPS preparation in Structured Execution and keeps measuring through
    // Controlled Discomfort. Clarity is intentionally excluded: recognition / mental-map work is
    // not a comparable execution-time condition. Controlled Discomfort timing remains useful
    // longitudinal data, but its difficulty condition prevents it from becoming a V1 TPS baseline.
    const sourcePhase = clean(parsed.phase);
    if (!isPreTpsPassiveTimingPhase(sourcePhase)) continue;

    const sets = Array.isArray(parsed.sets) ? parsed.sets : [];
    for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
      const set = sets[setIndex] || {};
      const constraints = set.constraintProfile && typeof set.constraintProfile === "object"
        ? set.constraintProfile
        : {};
      const pressureLevel = constraints.pressureLevel;
      const variationLevel = constraints.variationLevel;
      const difficultyLevel = constraints.difficultyLevel;
      if (!isPressureLevel(pressureLevel) || !isVariationLevel(variationLevel) || !isDifficultyLevel(difficultyLevel)) {
        continue;
      }

      const observations = Array.isArray(set.observations) ? set.observations : [];
      for (let repIndex = 0; repIndex < observations.length; repIndex += 1) {
        const observation = observations[repIndex];
        if (!observation || typeof observation !== "object" || Array.isArray(observation)) continue;
        const operationalEvidence = decodeRepOperationalEvidenceV2(
          (observation as Record<string, unknown>)[REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY],
        );
        if (!operationalEvidence || operationalEvidence.timing.mode !== "passive_untimed") continue;

        const elapsedMs = Number(operationalEvidence.timing.elapsedMs);
        const endedAt = clean(operationalEvidence.timing.endedAt) || clean(row.submitted_at);
        if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || !endedAt) continue;

        records.push({
          recordId: [
            clean(row.id),
            clean(set.setId) || `set_${setIndex + 1}`,
            operationalEvidence.repId || `rep_${repIndex + 1}`,
          ].join("::"),
          studentId: normalizedStudentId,
          topic: clean(parsed.trainingTopic),
          completedAt: endedAt,
          elapsedMs,
          sourcePhase,
          pressureLevel,
          variationLevel,
          difficultyLevel,
          actualSupportUsed: operationalEvidence.actualSupportUsed,
          structurallyValidCompletion: isStructurallyValidPassiveCompletion(
            observation as Record<string, unknown>,
          ),
          timingValidity: operationalEvidence.timing.timingValidity,
          source: "historical_untimed",
        });
      }
    }
  }

  return records;
};

export const buildTpsTimerRuntimeStatus = ({
  rows,
  studentId,
  topic,
}: {
  rows: StoredTpsDrillRow[];
  studentId: string;
  topic: string;
}) => {
  const passiveRecords = collectPassiveTpsTimingRecords({ rows, studentId, topic });
  const eligibleRecords = passiveRecords.filter((record) =>
    isEligibleTpsBaselineRecord(record, studentId, topic, "historical_untimed"),
  );
  const contract = deriveTpsTimerContractV1({
    records: passiveRecords,
    studentId,
    topic,
    source: "historical_untimed",
  });
  const structuredExecutionRecordCount = passiveRecords.filter(
    (record) => record.sourcePhase === "Structured Execution",
  ).length;
  const controlledDiscomfortRecordCount = passiveRecords.filter(
    (record) => record.sourcePhase === "Controlled Discomfort",
  ).length;

  return {
    contract,
    calibrationRequired: contract === null,
    preTpsCalibrationRequired: contract === null,
    tpsEntryReady: contract !== null,
    passiveRecordCount: passiveRecords.length,
    structuredExecutionRecordCount,
    controlledDiscomfortRecordCount,
    eligibleRecordCount: eligibleRecords.length,
  };
};
