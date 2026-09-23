import { normalizeObservationLevelValue } from "./observationScoring";
import { PHASES, type TopicPhase } from "./topicConditioningEngine";

export type AdaptiveDiagnosisBand = "de-escalate" | "place" | "escalate";

export type AdaptiveDiagnosisStability = "Low" | "Medium" | "High";

export type AdaptiveDiagnosisRepRow = {
  rep: number;
  repScore: number;
};

export type AdaptiveDiagnosisPhaseSummary = {
  phase: TopicPhase;
  phaseScore: number;
  band: AdaptiveDiagnosisBand;
  stability: AdaptiveDiagnosisStability;
  repRows: AdaptiveDiagnosisRepRow[];
};

export const ADAPTIVE_DIAGNOSIS_THRESHOLDS = {
  deEscalateMax: 44,
  placeMax: 79,
} as const;

export const ADAPTIVE_DIAGNOSIS_WEIGHTS: Record<
  TopicPhase,
  Array<{ aliases: string[]; weight: number }>
> = {
  Clarity: [
    { aliases: ["vocabulary", "vocabulary_precision"], weight: 30 },
    { aliases: ["method", "method_recognition"], weight: 30 },
    { aliases: ["reason", "reason_clarity"], weight: 20 },
    { aliases: ["immediateApply", "immediate_apply_response"], weight: 20 },
  ],
  "Structured Execution": [
    { aliases: ["startBehavior", "start_behavior"], weight: 25 },
    { aliases: ["stepExecution", "step_execution"], weight: 30 },
    { aliases: ["repeatability", "repeatability"], weight: 25 },
    { aliases: ["independence", "independence_level"], weight: 20 },
  ],
  "Controlled Discomfort": [
    { aliases: ["initialResponse", "initial_boss_response"], weight: 30 },
    { aliases: ["firstStepControl", "first_step_control"], weight: 25 },
    { aliases: ["discomfortTolerance", "discomfort_tolerance"], weight: 25 },
    { aliases: ["rescueDependence", "rescue_dependence"], weight: 20 },
  ],
  "Time Pressure Stability": [
    { aliases: ["startUnderTime", "start_under_time"], weight: 20 },
    { aliases: ["structureUnderTime", "structure_under_time"], weight: 35 },
    { aliases: ["paceControl", "pace_control"], weight: 20 },
    { aliases: ["completionIntegrity", "completion_integrity"], weight: 25 },
  ],
};

const resolveObservationLevel = (repObs: Record<string, string>, aliases: string[]) => {
  for (const alias of aliases) {
    const explicitLevel = String(repObs?.[`${alias}_level`] || "").trim();
    if (explicitLevel) return normalizeObservationLevelValue(explicitLevel);

    const rawValue = String(repObs?.[alias] || "").trim();
    if (rawValue) return normalizeObservationLevelValue(rawValue);
  }
  return normalizeObservationLevelValue("");
};

const weightedScoreFor = (weight: number, level: "weak" | "partial" | "clear") => {
  if (level === "clear") return weight;
  if (level === "partial") return Math.round(weight * 0.6);
  return 0;
};

export function computeAdaptiveDiagnosisPhaseSummary(
  phase: TopicPhase,
  observations: Array<Record<string, string>>
): AdaptiveDiagnosisPhaseSummary {
  const weights = ADAPTIVE_DIAGNOSIS_WEIGHTS[phase] || [];
  const repRows = (observations || []).map((repObs, repIndex) => {
    const repScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          weights.reduce((sum, field) => {
            const level = resolveObservationLevel(repObs || {}, field.aliases);
            return sum + weightedScoreFor(field.weight, level);
          }, 0)
        )
      )
    );

    return {
      rep: repIndex + 1,
      repScore,
    };
  });

  const phaseScore = repRows.length > 0
    ? Math.round(repRows.reduce((sum, row) => sum + row.repScore, 0) / repRows.length)
    : 0;

  let band: AdaptiveDiagnosisBand = "de-escalate";
  let stability: AdaptiveDiagnosisStability = "Low";

  if (phaseScore <= ADAPTIVE_DIAGNOSIS_THRESHOLDS.deEscalateMax) {
    band = "de-escalate";
    stability = "Low";
  } else if (phaseScore <= ADAPTIVE_DIAGNOSIS_THRESHOLDS.placeMax) {
    band = "place";
    stability = "Medium";
  } else {
    band = "escalate";
    stability = "High";
  }

  return {
    phase,
    phaseScore,
    band,
    stability,
    repRows,
  };
}

export function getAdjacentDiagnosisPhase(
  phase: TopicPhase,
  direction: "previous" | "next"
): TopicPhase | null {
  const phaseIndex = PHASES.indexOf(phase);
  if (phaseIndex < 0) return null;
  const nextIndex = direction === "previous" ? phaseIndex - 1 : phaseIndex + 1;
  return PHASES[nextIndex] || null;
}

// Next-generation diagnosis contract. The legacy phase-block exports above stay intact
// while runtime integrations migrate to evidence-complete, named diagnostic probes.
export * from "./evidenceCompleteDiagnosis";
