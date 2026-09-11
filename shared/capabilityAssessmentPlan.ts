import type { TutorBattleTestPhaseKey } from "./battleTesting";
import {
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  type CapabilityBlueprintEvidenceKind,
} from "./capabilityBlueprint";

export interface CapabilityAssessmentPlanEntry {
  assessmentKey: string;
  title: string;
  evidenceKind: CapabilityBlueprintEvidenceKind;
  coveredDeepDiveKeys: TutorBattleTestPhaseKey[];
  formSize: number;
  minimumItemPoolSize: number;
  passThresholdPercent: number;
  minimumDelayHours: number;
  purpose: string;
}

const MASTERY_FORM_SIZE = 15;
const MASTERY_MINIMUM_POOL_SIZE = 30;
const CUMULATIVE_FORM_SIZE = 20;
const CUMULATIVE_MINIMUM_POOL_SIZE = 40;
const PASS_THRESHOLD_PERCENT = 96;

const masteryEntry = (
  deepDiveKey: TutorBattleTestPhaseKey,
  title: string,
): CapabilityAssessmentPlanEntry => ({
  assessmentKey: `${deepDiveKey}_mastery_v1`,
  title: `${title} Mastery Check`,
  evidenceKind: "mastery",
  coveredDeepDiveKeys: [deepDiveKey],
  formSize: MASTERY_FORM_SIZE,
  minimumItemPoolSize: MASTERY_MINIMUM_POOL_SIZE,
  passThresholdPercent: PASS_THRESHOLD_PERCENT,
  minimumDelayHours: 0,
  purpose: "Verify immediate operating understanding after the Specialist has worked through the Deep Dive.",
});

const MASTERY_ENTRIES = CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive) =>
  masteryEntry(deepDive.key, deepDive.title),
);

export const CAPABILITY_MVP_ASSESSMENT_PLAN_V1: CapabilityAssessmentPlanEntry[] = [
  ...MASTERY_ENTRIES,
  {
    assessmentKey: "transformation_phases_retrieval_v1",
    title: "Transformation Phases Delayed Retrieval",
    evidenceKind: "retrieval",
    coveredDeepDiveKeys: [
      "topic_conditioning",
      "clarity",
      "structured_execution",
      "controlled_discomfort",
      "time_pressure_stability",
    ],
    formSize: CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    purpose:
      "Re-test the Transformation Phases after a spacing interval so recognition and operating boundaries must be retrieved rather than immediately repeated.",
  },
  {
    assessmentKey: "session_infrastructure_retrieval_v1",
    title: "Session Infrastructure Delayed Retrieval",
    evidenceKind: "retrieval",
    coveredDeepDiveKeys: [
      "intro_session_structure",
      "logging_system",
      "session_flow_control",
      "drill_library",
      "handover_verification",
      "tools_required",
    ],
    formSize: CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    purpose:
      "Re-test session infrastructure after a spacing interval so the Specialist must retrieve operating rules without relying on immediate module familiarity.",
  },
  {
    assessmentKey: "transformation_state_transfer_v1",
    title: "Transformation State Interleaved Transfer",
    evidenceKind: "transfer",
    coveredDeepDiveKeys: [
      "topic_conditioning",
      "clarity",
      "structured_execution",
      "controlled_discomfort",
      "time_pressure_stability",
    ],
    formSize: CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    purpose:
      "Mix phase and topic-state scenarios so the Specialist must identify which capability and boundary applies without being told the Deep Dive in advance.",
  },
  {
    assessmentKey: "session_operation_transfer_v1",
    title: "Session Operation Interleaved Transfer",
    evidenceKind: "transfer",
    coveredDeepDiveKeys: [
      "intro_session_structure",
      "logging_system",
      "session_flow_control",
      "drill_library",
    ],
    formSize: CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    purpose:
      "Mix placement, session-context, drill-selection and evidence scenarios so the Specialist must preserve the operating chain across subsystem boundaries.",
  },
  {
    assessmentKey: "continuity_delivery_transfer_v1",
    title: "Continuity and Delivery Integrity Transfer",
    evidenceKind: "transfer",
    coveredDeepDiveKeys: [
      "handover_verification",
      "tools_required",
      "logging_system",
      "session_flow_control",
    ],
    formSize: CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    purpose:
      "Mix continuity, observability, evidence and session-flow failures so the Specialist must protect valid delivery before resuming or scoring work.",
  },
];

export function getCapabilityMvpAssessmentPlanEntry(assessmentKey: string) {
  return CAPABILITY_MVP_ASSESSMENT_PLAN_V1.find((entry) => entry.assessmentKey === assessmentKey) || null;
}

export function getCapabilityMvpPlannedEvidenceCells() {
  return Array.from(
    new Set(
      CAPABILITY_MVP_ASSESSMENT_PLAN_V1.flatMap((entry) =>
        entry.coveredDeepDiveKeys.map(
          (deepDiveKey) => `deep_dive.${deepDiveKey}.${entry.evidenceKind}`,
        ),
      ),
    ),
  ).sort();
}
