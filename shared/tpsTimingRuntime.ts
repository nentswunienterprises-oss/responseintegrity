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
import {
  getDiagnosisBaselineTimingSamples,
  type DiagnosisProbeResult,
  type EvidenceCompleteDiagnosisState,
} from "./evidenceCompleteDiagnosis";

export type StoredDrillRow = {
  id?: unknown;
  student_id?: unknown;
  submitted_at?: unknown;
  drill?: unknown;
};

const clean = (value: unknown) => String(value ?? "").trim();
const topicKey = (value: unknown) => clean(value).toLowerCase();

const STRUCTURED_EXECUTION_PHASE = "Structured Execution";

export const deriveStructuredExecutionEpochKeyForTraining = ({
  history,
  observedPhase,
}: {
  history: Array<{ phase?: unknown; date?: unknown }>;
  observedPhase: string;
}): string | null => {
  if (clean(observedPhase) !== STRUCTURED_EXECUTION_PHASE) return null;

  const ordered = [...(Array.isArray(history) ? history : [])].sort((left, right) => {
    const leftMs = Date.parse(clean(left?.date));
    const rightMs = Date.parse(clean(right?.date));
    if (!Number.isFinite(leftMs) && !Number.isFinite(rightMs)) return 0;
    if (!Number.isFinite(leftMs)) return 1;
    if (!Number.isFinite(rightMs)) return -1;
    return leftMs - rightMs;
  });

  let entriesIntoStructuredExecution = 0;
  let previousPhase = "";
  for (const entry of ordered) {
    const phase = clean(entry?.phase);
    if (phase === STRUCTURED_EXECUTION_PHASE && previousPhase !== STRUCTURED_EXECUTION_PHASE) {
      entriesIntoStructuredExecution += 1;
    }
    if (phase) previousPhase = phase;
  }

  const latestPhase = [...ordered]
    .reverse()
    .map((entry) => clean(entry?.phase))
    .find(Boolean) || "";

  const epochNumber =
    latestPhase === STRUCTURED_EXECUTION_PHASE
      ? Math.max(1, entriesIntoStructuredExecution)
      : entriesIntoStructuredExecution + 1;

  return `se-v1-epoch-${epochNumber}`;
};

export const validateTrainingPassiveTimingSubmission = ({
  observedPhase,
  sets,
}: {
  observedPhase: string;
  sets: any[];
}): string | null => {
  const normalizedSets = Array.isArray(sets) ? sets : [];
  const passiveTimingOccurrences: Array<{ setId: string; repNumber: number; raw: unknown }> = [];

  normalizedSets.forEach((set: any) => {
    const setId = clean(set?.setId);
    const observations = Array.isArray(set?.observations) ? set.observations : [];
    observations.forEach((rep: any, index: number) => {
      const raw = rep?.[PASSIVE_EXECUTION_TIMING_WIRE_KEY];
      if (raw !== undefined && clean(raw)) {
        passiveTimingOccurrences.push({
          setId,
          repNumber: Number(rep?._rep_number || index + 1),
          raw,
        });
      }
    });
  });

  if (clean(observedPhase) !== STRUCTURED_EXECUTION_PHASE) {
    return passiveTimingOccurrences.length > 0
      ? "Passive TPS baseline timing is only valid inside Structured Execution Independent Execution."
      : null;
  }

  const wrongSetTiming = passiveTimingOccurrences.find(
    (occurrence) => occurrence.setId !== TPS_TRAINING_BASELINE_SET_ID,
  );
  if (wrongSetTiming) {
    return `Passive baseline timing cannot be recorded in ${wrongSetTiming.setId || "an unknown set"}; only Independent Execution is eligible.`;
  }

  const independentSet = normalizedSets.find(
    (set: any) => clean(set?.setId) === TPS_TRAINING_BASELINE_SET_ID,
  );
  if (!independentSet) {
    return "Structured Execution is missing its canonical Independent Execution set.";
  }

  const observations = Array.isArray(independentSet.observations)
    ? independentSet.observations
    : [];
  if (observations.length !== 3) {
    return "Structured Execution Independent Execution must contain exactly three canonical reps.";
  }

  for (let index = 0; index < observations.length; index += 1) {
    const timing = decodePassiveExecutionTimingEvidence(
      observations[index]?.[PASSIVE_EXECUTION_TIMING_WIRE_KEY],
    );
    if (!timing) {
      return `Independent Execution Rep ${index + 1} is missing valid Begin Rep -> Student Finished timing evidence.`;
    }
  }

  return null;
};

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
    if (clean(drill.tpsTimingAuthority?.sourceEpochKey) !== sourceEpochKey) continue;

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
        sourceEpochKey: clean(drill.tpsTimingAuthority?.sourceEpochKey),
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


export const collectDiagnosisTpsBaselineTimingRecords = ({
  state,
  studentId,
  topic,
  sourceEpochKey,
  baselineGroupId,
}: {
  state: EvidenceCompleteDiagnosisState;
  studentId: string;
  topic: string;
  sourceEpochKey: string;
  baselineGroupId: string;
}): TpsBaselineTimingRecord[] => {
  const samples = getDiagnosisBaselineTimingSamples(state).slice(-3);
  return samples.map((sample: DiagnosisProbeResult, index) => ({
    recordId: `${baselineGroupId}::${sample.probeId}::sample-${index + 1}`,
    studentId,
    topic,
    source: "diagnosis" as const,
    sourceEpochKey,
    baselineGroupId,
    baselineSlot: (index + 1) as 1 | 2 | 3,
    attemptNumber: 1,
    sourcePhase: "diagnosis" as const,
    sourceSetId: sample.probeId,
    completedAt: sample.passiveTiming!.endedAt,
    elapsedMs: sample.passiveTiming!.elapsedMs,
    pressureLevel: "none" as const,
    variationLevel: "same_form" as const,
    difficultyLevel: "normal" as const,
    independencePreserved: true,
    structurallyValidCompletion: true,
    timingValidity: "valid" as const,
  }));
};

export const deriveDiagnosisTpsTimerContract = ({
  state,
  studentId,
  topic,
  sourceEpochKey,
  baselineGroupId,
}: {
  state: EvidenceCompleteDiagnosisState;
  studentId: string;
  topic: string;
  sourceEpochKey: string;
  baselineGroupId: string;
}): TpsTimerContractV1 | null => {
  const records = collectDiagnosisTpsBaselineTimingRecords({
    state,
    studentId,
    topic,
    sourceEpochKey,
    baselineGroupId,
  });
  if (records.length !== 3) return null;

  const selected = [
    records.find((record) => record.baselineSlot === 1),
    records.find((record) => record.baselineSlot === 2),
    records.find((record) => record.baselineSlot === 3),
  ];
  if (selected.some((record) => !record)) return null;

  return deriveTpsTimerContractV1(
    deriveTpsBaselineSnapshot(
      selected as [
        TpsBaselineTimingRecord,
        TpsBaselineTimingRecord,
        TpsBaselineTimingRecord,
      ],
    ),
  );
};
