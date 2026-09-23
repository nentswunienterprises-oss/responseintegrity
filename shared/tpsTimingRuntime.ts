import {
  PASSIVE_EXECUTION_TIMING_WIRE_KEY,
  TPS_TRAINING_BASELINE_SET_ID,
  decodePassiveExecutionTimingEvidence,
  selectLatestCompleteTrainingBaselineSet,
  deriveTpsBaselineSnapshot,
  deriveTpsTimerContractV1,
  type TpsBaselineTimingRecord,
  type TpsTimerContractV1,
} from "./tpsTimingContract";
import { readTrainingInterventionEvent } from "./trainingEvidenceCapture";

type StoredDrillRow = {
  id?: unknown;
  student_id?: unknown;
  submitted_at?: unknown;
  drill?: unknown;
};

const clean = (value: unknown) => String(value ?? "").trim();
const topicKey = (value: unknown) => clean(value).toLowerCase();

const parseDrill = (value: unknown): Record<string, any> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : null;
  } catch {
    return null;
  }
};

const repHasSupportedExecutionEvidence = (rep: Record<string, unknown>) => {
  const evidenceClasses = Object.entries(rep)
    .filter(([key]) => key.endsWith("_evidence_class"))
    .map(([, value]) => clean(value));

  if (evidenceClasses.length === 0) return false;
  return evidenceClasses.every((value) => value === "supported");
};

const repPreservesIndependentExecution = (rep: Record<string, string>) => {
  const intervention = readTrainingInterventionEvent(rep);
  return intervention === "none" || intervention === "neutral_clarification";
};

export const collectTrainingTpsBaselineTimingRecords = ({
  rows,
  studentId,
  topic,
  sourceEpochKey,
}: {
  rows: StoredDrillRow[];
  studentId: string;
  topic: string;
  sourceEpochKey: string;
}): TpsBaselineTimingRecord[] => {
  const output: TpsBaselineTimingRecord[] = [];

  for (const row of rows) {
    if (clean(row.student_id) !== studentId) continue;
    const drill = parseDrill(row.drill);
    if (!drill) continue;
    if (clean(drill.drillType).toLowerCase() !== "training") continue;
    if (topicKey(drill.trainingTopic || drill.introTopic) !== topicKey(topic)) continue;

    const observedPhase = clean(drill.summary?.observedPhase || drill.phase);
    if (observedPhase !== "Structured Execution") continue;

    const sets = Array.isArray(drill.sets) ? drill.sets : [];
    const baselineSet = sets.find(
      (set: any) => clean(set?.setId) === TPS_TRAINING_BASELINE_SET_ID,
    );
    if (!baselineSet) continue;

    const observations = Array.isArray(baselineSet.observations)
      ? baselineSet.observations
      : [];
    const baselineGroupId = `${clean(row.id)}::${TPS_TRAINING_BASELINE_SET_ID}`;

    observations.forEach((rawRep: unknown, index: number) => {
      if (!rawRep || typeof rawRep !== "object" || Array.isArray(rawRep)) return;
      const rep = rawRep as Record<string, string>;
      const slot = Number(rep._rep_number || index + 1);
      if (slot !== 1 && slot !== 2 && slot !== 3) return;

      const timing = decodePassiveExecutionTimingEvidence(
        rep[PASSIVE_EXECUTION_TIMING_WIRE_KEY],
      );
      if (!timing) return;

      output.push({
        recordId: `${clean(row.id)}::${TPS_TRAINING_BASELINE_SET_ID}::rep-${slot}`,
        studentId,
        topic: clean(drill.trainingTopic || drill.introTopic),
        source: "training",
        sourceEpochKey,
        baselineGroupId,
        baselineSlot: slot,
        attemptNumber: 1,
        sourcePhase: "Structured Execution",
        sourceSetId: TPS_TRAINING_BASELINE_SET_ID,
        completedAt: timing.endedAt,
        elapsedMs: timing.elapsedMs,
        pressureLevel: "none",
        variationLevel: "same_form",
        difficultyLevel: "normal",
        independencePreserved: repPreservesIndependentExecution(rep),
        structurallyValidCompletion: repHasSupportedExecutionEvidence(rep),
        timingValidity: timing.timingValidity,
      });
    });
  }

  return output;
};

export const deriveTrainingTpsTimerContract = ({
  rows,
  studentId,
  topic,
  sourceEpochKey,
}: {
  rows: StoredDrillRow[];
  studentId: string;
  topic: string;
  sourceEpochKey: string;
}): TpsTimerContractV1 | null => {
  const records = collectTrainingTpsBaselineTimingRecords({
    rows,
    studentId,
    topic,
    sourceEpochKey,
  });
  const selected = selectLatestCompleteTrainingBaselineSet({
    records,
    studentId,
    topic,
    sourceEpochKey,
  });
  if (!selected) return null;
  return deriveTpsTimerContractV1(deriveTpsBaselineSnapshot(selected));
};
