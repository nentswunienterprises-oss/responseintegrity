import {
  decodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
  type ActualSupportUsedV2,
} from "./responseIntegrityEvidenceContractV2";
import {
  getDrillSchemaDefinitionByVersion,
  getDrillSchemaDefinition,
  type EvidenceConstraintProfile,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";

export type SupportConditionIssueReason =
  | "missing_operational_evidence"
  | "support_exceeded_ceiling"
  | "support_marked_beyond_boundary";

export type SupportConditionIssue = {
  reason: SupportConditionIssueReason;
  setId: string;
  setName: string;
  repId: string;
  repNumber: number;
  permittedSupport: EvidenceConstraintProfile["supportLevel"];
  actualSupportUsed: ActualSupportUsedV2 | null;
};

export type SupportConditionValidity = {
  status: "clean" | "missing_operational_evidence" | "contaminated";
  clean: boolean;
  checkedRepCount: number;
  issues: SupportConditionIssue[];
};

export type SupportValidityTrainingSummaryLike = {
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

const MAX_ACTUAL_SUPPORT_BY_CEILING: Record<
  Exclude<EvidenceConstraintProfile["supportLevel"], "modeled">,
  Exclude<ActualSupportUsedV2, "beyond_permitted_boundary">
> = {
  none: "none",
  minimal: "response_control_cue",
  first_step_only: "first_step_math_support",
};

const SUPPORT_RANK: Record<Exclude<ActualSupportUsedV2, "beyond_permitted_boundary">, number> = {
  none: 0,
  response_control_cue: 1,
  first_step_math_support: 2,
};

export const isActualSupportWithinCeiling = (
  permittedSupport: EvidenceConstraintProfile["supportLevel"],
  actualSupportUsed: ActualSupportUsedV2,
) => {
  if (permittedSupport === "modeled") return true;
  if (actualSupportUsed === "beyond_permitted_boundary") return false;
  return SUPPORT_RANK[actualSupportUsed] <= SUPPORT_RANK[MAX_ACTUAL_SUPPORT_BY_CEILING[permittedSupport]];
};

const schemaForSubmittedSet = (phase: TopicPhase, submittedSet: SubmittedEvidenceSet) => {
  const liveSchema = getDrillSchemaDefinition("training", phase);
  const schemaVersion = Number(submittedSet.drillSchemaVersion || liveSchema.schemaVersion);
  return getDrillSchemaDefinitionByVersion("training", phase, schemaVersion) || liveSchema;
};

/**
 * Evaluates whether each scored training rep was run inside the support ceiling assigned by the
 * versioned drill registry. Student-performance observations remain untouched: support validity is
 * a separate evidence-condition fact, not another student score.
 */
export const evaluateTrainingSupportCondition = (
  phase: TopicPhase,
  sets: SubmittedEvidenceSet[],
): SupportConditionValidity => {
  const issues: SupportConditionIssue[] = [];
  let checkedRepCount = 0;

  for (const submittedSet of sets || []) {
    const schema = schemaForSubmittedSet(phase, submittedSet);
    const definition =
      schema.sets.find((candidate) => submittedSet.setId && candidate.setId === submittedSet.setId) ||
      schema.sets.find((candidate) => candidate.setName === submittedSet.setName) ||
      null;
    if (!definition || definition.modelingOnly) continue;

    (submittedSet.observations || []).forEach((observation, repIndex) => {
      checkedRepCount += 1;
      const repNumber = repIndex + 1;
      const repId = definition.repPurposeIds[repIndex] || `${definition.setId}.opportunity_${repNumber}`;
      const operational = decodeRepOperationalEvidenceV2(
        observation?.[REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY],
      );
      if (!operational) {
        issues.push({
          reason: "missing_operational_evidence",
          setId: definition.setId,
          setName: definition.setName,
          repId,
          repNumber,
          permittedSupport: definition.constraints.supportLevel,
          actualSupportUsed: null,
        });
        return;
      }

      const actualSupportUsed = operational.actualSupportUsed;
      if (actualSupportUsed === "beyond_permitted_boundary") {
        issues.push({
          reason: "support_marked_beyond_boundary",
          setId: definition.setId,
          setName: definition.setName,
          repId,
          repNumber,
          permittedSupport: definition.constraints.supportLevel,
          actualSupportUsed,
        });
        return;
      }
      if (!isActualSupportWithinCeiling(definition.constraints.supportLevel, actualSupportUsed)) {
        issues.push({
          reason: "support_exceeded_ceiling",
          setId: definition.setId,
          setName: definition.setName,
          repId,
          repNumber,
          permittedSupport: definition.constraints.supportLevel,
          actualSupportUsed,
        });
      }
    });
  }

  const contaminated = issues.some((issue) => issue.reason !== "missing_operational_evidence");
  const missing = issues.some((issue) => issue.reason === "missing_operational_evidence");
  const status = contaminated
    ? "contaminated"
    : missing
      ? "missing_operational_evidence"
      : "clean";

  return {
    status,
    clean: status === "clean",
    checkedRepCount,
    issues,
  };
};

/**
 * Invalid support conditions never become student weakness. The scored observations remain in the
 * historical record, but the drill cannot move topic state up or down until fresh evidence is run
 * under the assigned support ceiling.
 */
export const applySupportConditionValidityGate = <T extends SupportValidityTrainingSummaryLike>(
  summary: T,
  validity: SupportConditionValidity,
): T & {
  evidenceConditionValidity: SupportConditionValidity;
  transitionWithheld?: {
    reason: "support_condition_invalid";
    projectedPhase: TopicPhase;
    projectedStability: TopicStability;
    projectedTransitionReason: string;
  };
} => {
  if (validity.clean) {
    return {
      ...summary,
      evidenceConditionValidity: validity,
    };
  }

  return {
    ...summary,
    phase: summary.observedPhase,
    stability: summary.previousStability,
    transitionReason: "remain",
    phaseDecision: "remain",
    nextAction: "Run fresh evidence under the assigned support ceiling before topic-state movement can resume.",
    constraint:
      validity.status === "contaminated"
        ? "Support exceeded the assigned evidence condition. Student performance remains recorded, but this drill cannot move topic state."
        : "Rep-level support evidence is missing. This drill cannot move topic state until the evidence condition is complete.",
    evidenceConditionValidity: validity,
    transitionWithheld: {
      reason: "support_condition_invalid",
      projectedPhase: summary.phase,
      projectedStability: summary.stability,
      projectedTransitionReason: summary.transitionReason,
    },
  };
};
