import type { ObservationLevel } from "./observationScoring";

export const RESPONSE_INTEGRITY_EVIDENCE_CONTRACT_VERSION = 2 as const;

export type ActualSupportUsedV2 =
  | "none"
  | "response_control_cue"
  | "first_step_math_support"
  | "beyond_permitted_boundary";

export type InheritedEvidenceDimensionV2 =
  | "clarity.vocabulary"
  | "clarity.method"
  | "clarity.reason"
  | "clarity.immediate_apply"
  | "execution.start"
  | "execution.step_discipline"
  | "execution.repeatability"
  | "execution.independence"
  | "difficulty.initial_response"
  | "difficulty.first_step_control"
  | "difficulty.tolerance"
  | "difficulty.rescue_dependence";

export type SupplementalInheritedEvidenceV2 = {
  dimensionId: InheritedEvidenceDimensionV2;
  rawObservation: string;
  normalizedLevel: ObservationLevel;
  materiality: "informational" | "material";
};

export type RepTimingValidityV2 = "valid" | "timing_invalid_technical";
export type RepTimingModeV2 = "passive_untimed" | "tps_prescribed";
export type RepTimingBaselineSourceV2 = "historical_eligible" | "calibration";

export type RepTimingEvidenceV2 = {
  mode: RepTimingModeV2;
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  timingValidity: RepTimingValidityV2;
  timerContractVersion?: number;
  baselineSeconds?: number;
  prescribedSeconds?: number;
  completedBeforeExpiry?: boolean;
  pressureLevel?: "none" | "difficulty" | "light_timer" | "repeated_timer" | "full_constraint";
  baselineSource?: RepTimingBaselineSourceV2;
  replacementForAttemptId?: string | null;
};

export type RepOperationalEvidenceV2 = {
  repId: string;
  repNumber: number;
  actualSupportUsed: ActualSupportUsedV2;
  timing: RepTimingEvidenceV2;
  inheritedEvidence: SupplementalInheritedEvidenceV2[];
};

/**
 * V2 deliberately sits beside the published V1 drill/evidence contract.
 * It adds operational facts that V1 cannot represent without rewriting history:
 * actual support used, rep timing, and supplemental inherited-layer evidence.
 */
export type SubmittedEvidenceSetV2 = {
  evidenceContractVersion: typeof RESPONSE_INTEGRITY_EVIDENCE_CONTRACT_VERSION;
  setName: string;
  setId: string;
  setOrder: number;
  drillSchemaId: string;
  drillSchemaVersion: number;
  drillDefinitionHash: string;
  constraintProfile: Record<string, unknown> | null;
  observations: Array<Record<string, string>>;
  repOperationalEvidence: RepOperationalEvidenceV2[];
};
