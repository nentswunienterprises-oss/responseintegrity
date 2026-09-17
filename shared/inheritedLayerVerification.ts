import {
  decodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
  type InheritedEvidenceDimensionV2,
  type SupplementalInheritedEvidenceV2,
} from "./responseIntegrityEvidenceContractV2";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";

const PHASE_ORDER: TopicPhase[] = [
  "Clarity",
  "Structured Execution",
  "Controlled Discomfort",
  "Time Pressure Stability",
];

export type MaterialInheritedBreak = SupplementalInheritedEvidenceV2 & {
  sourcePhase: Exclude<TopicPhase, "Time Pressure Stability">;
  setName: string;
  repNumber: number;
  repId: string;
};

export type InheritedVerificationHold = {
  kind: "inherited_verification_required";
  targetPhase: Exclude<TopicPhase, "Time Pressure Stability">;
  triggeredFromPhase: TopicPhase;
  resumePhase: TopicPhase;
  resumeStability: TopicStability;
  sourceBreaks: MaterialInheritedBreak[];
  freshCurrentPhaseEvidenceRequired: boolean;
  status: "verification_required" | "targeted_re_diagnosis_required";
  originallyProjectedPhase?: TopicPhase;
  originallyProjectedStability?: TopicStability;
  originallyProjectedTransitionReason?: string;
};

export type InheritedVerificationResolution = {
  verificationScore: number;
  outcome: "verification_cleared" | "regress_to_earlier_phase" | "targeted_re_diagnosis_required";
  resultingPhase: TopicPhase;
  resultingStability: TopicStability;
  holdCleared: boolean;
  freshCurrentPhaseEvidenceRequired: boolean;
  targetedRediagnosisStartingPhase: Exclude<TopicPhase, "Time Pressure Stability"> | null;
};

export type TrainingSummaryLike = {
  observedPhase: TopicPhase;
  previousStability: TopicStability;
  phase: TopicPhase;
  stability: TopicStability;
  transitionReason: string;
  phaseDecision: "remain" | "advance" | "regress";
  nextAction?: string | null;
  constraint?: string | null;
  [key: string]: unknown;
};

const dimensionSourcePhase = (
  dimensionId: InheritedEvidenceDimensionV2,
): Exclude<TopicPhase, "Time Pressure Stability"> => {
  if (dimensionId.startsWith("clarity.")) return "Clarity";
  if (dimensionId.startsWith("execution.")) return "Structured Execution";
  return "Controlled Discomfort";
};

const isEarlierLayer = (sourcePhase: TopicPhase, currentPhase: TopicPhase) =>
  PHASE_ORDER.indexOf(sourcePhase) < PHASE_ORDER.indexOf(currentPhase);

export const collectMaterialInheritedBreaks = (
  sets: Array<{ setName?: string; observations?: Array<Record<string, unknown>> }>,
  currentPhase: TopicPhase,
): MaterialInheritedBreak[] => {
  const breaks: MaterialInheritedBreak[] = [];

  for (const set of sets || []) {
    const setName = String(set?.setName || "").trim();
    for (const observation of set?.observations || []) {
      const operational = decodeRepOperationalEvidenceV2(
        observation?.[REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY],
      );
      if (!operational) continue;

      for (const inherited of operational.inheritedEvidence || []) {
        if (inherited.materiality !== "material" || inherited.normalizedLevel !== "weak") continue;
        const sourcePhase = dimensionSourcePhase(inherited.dimensionId);
        if (!isEarlierLayer(sourcePhase, currentPhase)) continue;
        breaks.push({
          ...inherited,
          sourcePhase,
          setName,
          repNumber: operational.repNumber,
          repId: operational.repId,
        });
      }
    }
  }

  return breaks.sort((a, b) => {
    const phaseDelta = PHASE_ORDER.indexOf(a.sourcePhase) - PHASE_ORDER.indexOf(b.sourcePhase);
    if (phaseDelta !== 0) return phaseDelta;
    if (a.setName !== b.setName) return a.setName.localeCompare(b.setName);
    return a.repNumber - b.repNumber;
  });
};

export const earliestInheritedVerificationTarget = (
  breaks: MaterialInheritedBreak[],
): Exclude<TopicPhase, "Time Pressure Stability"> | null =>
  breaks.length > 0 ? breaks[0].sourcePhase : null;

const isPositiveMovement = (transitionReason: string) =>
  transitionReason === "stability advance" || transitionReason === "phase progress";

/**
 * Supplemental inherited evidence never changes the current phase score. Instead, a material earlier-layer
 * break gates positive movement and creates a deterministic verification hold. Downward current-phase
 * movement is preserved because weak current-phase evidence must not be hidden by the hold.
 */
export const applyInheritedVerificationGate = <T extends TrainingSummaryLike>(
  summary: T,
  sets: Array<{ setName?: string; observations?: Array<Record<string, unknown>> }>,
): T & {
  inheritedVerificationHold?: InheritedVerificationHold;
  transitionWithheld?: {
    reason: "inherited_verification_required";
    phase: TopicPhase;
    stability: TopicStability;
    transitionReason: string;
  };
} => {
  const materialBreaks = collectMaterialInheritedBreaks(sets, summary.observedPhase);
  const targetPhase = earliestInheritedVerificationTarget(materialBreaks);
  if (!targetPhase) return summary;

  const positiveMovement = isPositiveMovement(summary.transitionReason);
  const resumePhase = positiveMovement ? summary.observedPhase : summary.phase;
  const resumeStability = positiveMovement ? summary.previousStability : summary.stability;
  const hold: InheritedVerificationHold = {
    kind: "inherited_verification_required",
    targetPhase,
    triggeredFromPhase: summary.observedPhase,
    resumePhase,
    resumeStability,
    sourceBreaks: materialBreaks,
    freshCurrentPhaseEvidenceRequired: true,
    status: "verification_required",
    originallyProjectedPhase: summary.phase,
    originallyProjectedStability: summary.stability,
    originallyProjectedTransitionReason: summary.transitionReason,
  };

  if (!positiveMovement) {
    return {
      ...summary,
      nextAction: `Run ${targetPhase} inherited-layer verification before any upward movement.`,
      constraint: `Inherited ${targetPhase} integrity must be verified before positive movement can resume.`,
      inheritedVerificationHold: hold,
    };
  }

  return {
    ...summary,
    phase: summary.observedPhase,
    stability: summary.previousStability,
    transitionReason: "remain",
    phaseDecision: "remain",
    nextAction: `Run ${targetPhase} inherited-layer verification before any upward movement.`,
    constraint: `Positive movement was withheld because a material inherited ${targetPhase} break was observed.`,
    inheritedVerificationHold: hold,
    transitionWithheld: {
      reason: "inherited_verification_required",
      phase: summary.phase,
      stability: summary.stability,
      transitionReason: summary.transitionReason,
    },
  };
};

/**
 * Approved inherited-layer verification consequence bands:
 * - 60-100: earlier layer holds in its native condition; clear the hold and return to the later phase.
 * - 40-59: confirmed earlier-layer weakening; regress to that earlier phase at High.
 * - 0-39: do not guess placement; keep the hold and start targeted adaptive re-diagnosis there.
 */
export const resolveInheritedVerification = (
  hold: InheritedVerificationHold,
  verificationScoreInput: number,
): InheritedVerificationResolution => {
  const verificationScore = Math.max(0, Math.min(100, Math.round(verificationScoreInput)));

  if (verificationScore >= 60) {
    return {
      verificationScore,
      outcome: "verification_cleared",
      resultingPhase: hold.resumePhase,
      resultingStability: hold.resumeStability,
      holdCleared: true,
      freshCurrentPhaseEvidenceRequired: true,
      targetedRediagnosisStartingPhase: null,
    };
  }

  if (verificationScore >= 40) {
    return {
      verificationScore,
      outcome: "regress_to_earlier_phase",
      resultingPhase: hold.targetPhase,
      resultingStability: "High",
      holdCleared: true,
      freshCurrentPhaseEvidenceRequired: false,
      targetedRediagnosisStartingPhase: null,
    };
  }

  return {
    verificationScore,
    outcome: "targeted_re_diagnosis_required",
    resultingPhase: hold.resumePhase,
    resultingStability: hold.resumeStability,
    holdCleared: false,
    freshCurrentPhaseEvidenceRequired: false,
    targetedRediagnosisStartingPhase: hold.targetPhase,
  };
};
