import type { ObservationLevel } from "./observationScoring";

export const RESPONSE_INTEGRITY_EVIDENCE_CONTRACT_VERSION = 2 as const;
export const REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY = "_ri_operational_evidence_v2" as const;

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
  attemptId?: string;
  timerContractId?: string;
  conditioningEpochKey?: string;
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

type RepOperationalEvidenceWireV2 = {
  evidenceContractVersion: typeof RESPONSE_INTEGRITY_EVIDENCE_CONTRACT_VERSION;
  evidence: RepOperationalEvidenceV2;
};

const ACTUAL_SUPPORT_VALUES = new Set<ActualSupportUsedV2>([
  "none",
  "response_control_cue",
  "first_step_math_support",
  "beyond_permitted_boundary",
]);
const TIMING_MODES = new Set<RepTimingModeV2>(["passive_untimed", "tps_prescribed"]);
const TIMING_VALIDITY_VALUES = new Set<RepTimingValidityV2>(["valid", "timing_invalid_technical"]);
const INHERITED_DIMENSION_VALUES = new Set<InheritedEvidenceDimensionV2>([
  "clarity.vocabulary",
  "clarity.method",
  "clarity.reason",
  "clarity.immediate_apply",
  "execution.start",
  "execution.step_discipline",
  "execution.repeatability",
  "execution.independence",
  "difficulty.initial_response",
  "difficulty.first_step_control",
  "difficulty.tolerance",
  "difficulty.rescue_dependence",
]);
const OBSERVATION_LEVEL_VALUES = new Set<ObservationLevel>(["weak", "partial", "clear"]);
const INHERITED_MATERIALITY_VALUES = new Set<SupplementalInheritedEvidenceV2["materiality"]>([
  "informational",
  "material",
]);

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isSupplementalInheritedEvidenceV2 = (value: unknown): value is SupplementalInheritedEvidenceV2 => {
  if (!isRecord(value)) return false;
  if (!INHERITED_DIMENSION_VALUES.has(value.dimensionId)) return false;
  if (!String(value.rawObservation || "").trim()) return false;
  if (!OBSERVATION_LEVEL_VALUES.has(value.normalizedLevel)) return false;
  if (!INHERITED_MATERIALITY_VALUES.has(value.materiality)) return false;
  return true;
};

/**
 * The live V1 semantic set validator already preserves unregistered rep metadata while validating
 * every registered scored dimension. Until the full V2 set envelope is activated, the runner uses
 * one reserved rep-level string field as an additive wire carrier. This keeps published V1 schema
 * identity immutable while persisting the V2 operational source fact inside the authoritative drill
 * payload. The codec is deterministic and version-stamped so the carrier can be retired cleanly once
 * the full V2 envelope is activated.
 */
export const encodeRepOperationalEvidenceV2 = (evidence: RepOperationalEvidenceV2) =>
  JSON.stringify({
    evidenceContractVersion: RESPONSE_INTEGRITY_EVIDENCE_CONTRACT_VERSION,
    evidence,
  } satisfies RepOperationalEvidenceWireV2);

export const decodeRepOperationalEvidenceV2 = (value: unknown): RepOperationalEvidenceV2 | null => {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed) || parsed.evidenceContractVersion !== RESPONSE_INTEGRITY_EVIDENCE_CONTRACT_VERSION) {
    return null;
  }
  const evidence = parsed.evidence;
  if (!isRecord(evidence) || !ACTUAL_SUPPORT_VALUES.has(evidence.actualSupportUsed)) return null;
  if (!String(evidence.repId || "").trim() || !Number.isInteger(evidence.repNumber) || evidence.repNumber <= 0) {
    return null;
  }
  if (!Array.isArray(evidence.inheritedEvidence)) return null;
  if (!evidence.inheritedEvidence.every(isSupplementalInheritedEvidenceV2)) return null;

  const timing = evidence.timing;
  if (!isRecord(timing) || !TIMING_MODES.has(timing.mode) || !TIMING_VALIDITY_VALUES.has(timing.timingValidity)) {
    return null;
  }
  if (!String(timing.startedAt || "").trim() || !String(timing.endedAt || "").trim()) return null;
  if (!Number.isFinite(Number(timing.elapsedMs)) || Number(timing.elapsedMs) < 0) return null;

  if (timing.mode === "tps_prescribed") {
    if (!String(timing.attemptId || "").trim()) return null;
    if (!String(timing.timerContractId || "").trim()) return null;
    if (!String(timing.conditioningEpochKey || "").trim()) return null;
    if (!Number.isFinite(Number(timing.timerContractVersion)) || Number(timing.timerContractVersion) <= 0) return null;
    if (!Number.isFinite(Number(timing.baselineSeconds)) || Number(timing.baselineSeconds) <= 0) return null;
    if (!Number.isFinite(Number(timing.prescribedSeconds)) || Number(timing.prescribedSeconds) <= 0) return null;
  }

  return evidence as RepOperationalEvidenceV2;
};
