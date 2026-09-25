import {
  DIAGNOSIS_OBSERVATION_MATRIX,
  type DiagnosisBehaviorClass,
  type DiagnosisDimensionId,
  type DiagnosisObservationOption,
} from "./diagnosisObservationMatrix";
import type { TrainingDimensionId, TrainingEvidenceClass } from "./trainingEvidenceContract";

export const TRAINING_DECISION_EVIDENCE_CLASSES = [
  "breakdown",
  "conditional",
  "near_stable",
  "supported",
] as const satisfies readonly TrainingEvidenceClass[];

export type TrainingDecisionEvidenceClass =
  (typeof TRAINING_DECISION_EVIDENCE_CLASSES)[number];

export type TrainingObservationOptionV2 = DiagnosisObservationOption & {
  behaviorClass: TrainingDecisionEvidenceClass;
};

export type TrainingObservationDimensionV2 = {
  id: TrainingDimensionId;
  label: string;
  observationQuestion: string;
  options: readonly TrainingObservationOptionV2[];
};

const isDecisionClass = (
  value: DiagnosisBehaviorClass,
): value is TrainingDecisionEvidenceClass =>
  (TRAINING_DECISION_EVIDENCE_CLASSES as readonly string[]).includes(value);

const buildDimension = (
  dimensionId: TrainingDimensionId,
): TrainingObservationDimensionV2 => {
  const canonical =
    DIAGNOSIS_OBSERVATION_MATRIX[dimensionId as DiagnosisDimensionId];
  if (!canonical) {
    throw new Error(
      `Missing canonical Response Evidence observation contract for ${dimensionId}`,
    );
  }

  const options = canonical.options.filter((option) =>
    isDecisionClass(option.behaviorClass),
  ) as TrainingObservationOptionV2[];

  const classes = new Set(options.map((option) => option.behaviorClass));
  for (const evidenceClass of TRAINING_DECISION_EVIDENCE_CLASSES) {
    if (!classes.has(evidenceClass)) {
      throw new Error(
        `Training observation contract ${dimensionId} is missing ${evidenceClass}`,
      );
    }
  }

  if (options.length !== TRAINING_DECISION_EVIDENCE_CLASSES.length) {
    throw new Error(
      `Training observation contract ${dimensionId} must expose exactly one decision option per evidence class`,
    );
  }

  return {
    id: dimensionId,
    label: canonical.label,
    observationQuestion: canonical.observationQuestion,
    options,
  };
};

const DIMENSION_IDS = Object.keys(
  DIAGNOSIS_OBSERVATION_MATRIX,
) as TrainingDimensionId[];

export const TRAINING_OBSERVATION_MATRIX_V2 = Object.fromEntries(
  DIMENSION_IDS.map((dimensionId) => [
    dimensionId,
    buildDimension(dimensionId),
  ]),
) as Record<TrainingDimensionId, TrainingObservationDimensionV2>;

export const getTrainingObservationDefinitionV2 = (
  dimensionId: TrainingDimensionId,
) => TRAINING_OBSERVATION_MATRIX_V2[dimensionId];

export const getTrainingObservationOptionV2 = (
  dimensionId: TrainingDimensionId,
  label: string,
) =>
  TRAINING_OBSERVATION_MATRIX_V2[dimensionId]?.options.find(
    (option) => option.label === label,
  ) || null;

export const getTrainingObservationOptionForClassV2 = (
  dimensionId: TrainingDimensionId,
  evidenceClass: TrainingDecisionEvidenceClass,
) =>
  TRAINING_OBSERVATION_MATRIX_V2[dimensionId]?.options.find(
    (option) => option.behaviorClass === evidenceClass,
  ) || null;
