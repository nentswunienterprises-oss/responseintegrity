import {
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  type CapabilityBlueprintEvidenceKind,
  type CapabilityDeepDiveKey,
} from "./capabilityBlueprint";

export type CapabilityCriticalCoverageMode = "all_boundaries" | "one_per_deep_dive";

export interface CapabilityAssessmentPlanEntry {
  assessmentKey: string;
  title: string;
  evidenceKind: CapabilityBlueprintEvidenceKind;
  coveredDeepDiveKeys: CapabilityDeepDiveKey[];
  formSize: number;
  minimumItemPoolSize: number;
  passThresholdPercent: number;
  minimumDelayHours: number;
  criticalCoverageMode: CapabilityCriticalCoverageMode;
  purpose: string;
}

const MASTERY_FORM_SIZE = 15;
const MASTERY_MINIMUM_POOL_SIZE = 45;
const MASTERY_PASS_THRESHOLD_PERCENT = 100;
const TRANSFORMATION_CUMULATIVE_FORM_SIZE = 25;
const TRANSFORMATION_CUMULATIVE_MINIMUM_POOL_SIZE = 25;
const FUTURE_CUMULATIVE_FORM_SIZE = 20;
const FUTURE_CUMULATIVE_MINIMUM_POOL_SIZE = 40;
const OPERATING_SYSTEM_CUMULATIVE_FORM_SIZE = 30;
const OPERATING_SYSTEM_CUMULATIVE_MINIMUM_POOL_SIZE = 60;
const CURRICULUM_V2_OPERATING_SYSTEM_CUMULATIVE_FORM_SIZE = 32;
const CURRICULUM_V2_OPERATING_SYSTEM_CUMULATIVE_MINIMUM_POOL_SIZE = 64;
const CUMULATIVE_PASS_THRESHOLD_PERCENT = 96;

const masteryEntry = (
  deepDiveKey: CapabilityDeepDiveKey,
  title: string,
): CapabilityAssessmentPlanEntry => ({
  assessmentKey: `${deepDiveKey}_mastery_v1`,
  title: `${title} Mastery Check`,
  evidenceKind: "mastery",
  coveredDeepDiveKeys: [deepDiveKey],
  formSize: MASTERY_FORM_SIZE,
  minimumItemPoolSize: MASTERY_MINIMUM_POOL_SIZE,
  passThresholdPercent: MASTERY_PASS_THRESHOLD_PERCENT,
  minimumDelayHours: 0,
  criticalCoverageMode: "all_boundaries",
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
    formSize: TRANSFORMATION_CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: TRANSFORMATION_CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: CUMULATIVE_PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    criticalCoverageMode: "one_per_deep_dive",
    purpose:
      "Re-test the Transformation Phases after a spacing interval so recognition and operating boundaries must be retrieved rather than immediately repeated.",
  },
  {
    assessmentKey: "operating_system_retrieval_v1",
    title: "Operating System Delayed Retrieval",
    evidenceKind: "retrieval",
    coveredDeepDiveKeys: [
      "how_to_model",
      "how_to_intervene",
      "how_to_use_boss_battles",
      "what_not_to_do",
      "emotional_discipline_under_discomfort",
      "how_to_diagnose",
      "how_to_interpret_prompts",
      "how_baselines_are_established",
      "how_the_system_resolves_uncertainty",
      "intro_session_structure",
      "logging_system",
      "session_flow_control",
      "drill_library",
      "handover_verification",
      "tools_required",
    ],
    formSize: OPERATING_SYSTEM_CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: OPERATING_SYSTEM_CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: CUMULATIVE_PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    criticalCoverageMode: "one_per_deep_dive",
    purpose:
      "Re-test the post-Sandbox operating system after spacing so the Specialist must retrieve execution, system-intelligence and session-infrastructure rules without relying on immediate Deep Dive context.",
  },
  {
    assessmentKey: "operating_system_transfer_v1",
    title: "Operating System Interleaved Transfer",
    evidenceKind: "transfer",
    coveredDeepDiveKeys: [
      "how_to_model",
      "how_to_intervene",
      "how_to_use_boss_battles",
      "what_not_to_do",
      "emotional_discipline_under_discomfort",
      "how_to_diagnose",
      "how_to_interpret_prompts",
      "how_baselines_are_established",
      "how_the_system_resolves_uncertainty",
      "intro_session_structure",
      "logging_system",
      "session_flow_control",
      "drill_library",
      "handover_verification",
      "tools_required",
    ],
    formSize: OPERATING_SYSTEM_CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: OPERATING_SYSTEM_CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: CUMULATIVE_PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 0,
    criticalCoverageMode: "one_per_deep_dive",
    purpose:
      "Mix execution, diagnosis, evidence, continuity and delivery scenarios so the Specialist must preserve the RI operating chain across module boundaries without being told which Deep Dive or rule governs the case.",
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
    formSize: FUTURE_CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: FUTURE_CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: CUMULATIVE_PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    criticalCoverageMode: "one_per_deep_dive",
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
    formSize: TRANSFORMATION_CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: TRANSFORMATION_CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: CUMULATIVE_PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 0,
    criticalCoverageMode: "one_per_deep_dive",
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
    formSize: FUTURE_CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: FUTURE_CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: CUMULATIVE_PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    criticalCoverageMode: "one_per_deep_dive",
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
    formSize: FUTURE_CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: FUTURE_CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: CUMULATIVE_PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    criticalCoverageMode: "one_per_deep_dive",
    purpose:
      "Mix continuity, observability, evidence and session-flow failures so the Specialist must protect valid delivery before resuming or scoring work.",
  },
];



export const CURRICULUM_V2_SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS: CapabilityDeepDiveKey[] = [
  "how_to_diagnose",
  "why_training_continues_beyond_clarity",
  "how_to_interpret_prompts",
  "how_baselines_are_established",
  "how_the_system_resolves_uncertainty",
];

export const OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2 =
  "operating_system_retrieval_v2";
export const OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2 =
  "operating_system_transfer_v2";

const CURRICULUM_V2_POST_SANDBOX_DEEP_DIVE_KEYS: CapabilityDeepDiveKey[] = [
  ...EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
  ...CURRICULUM_V2_SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
  ...SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
];

export const CAPABILITY_CURRICULUM_V2_REVIEW_ASSESSMENT_PLAN: CapabilityAssessmentPlanEntry[] = [
  {
    assessmentKey: "why_training_continues_beyond_clarity_mastery_v1",
    title: "Why Training Continues Beyond Clarity Mastery Check",
    evidenceKind: "mastery",
    coveredDeepDiveKeys: ["why_training_continues_beyond_clarity"],
    formSize: MASTERY_FORM_SIZE,
    minimumItemPoolSize: MASTERY_MINIMUM_POOL_SIZE,
    passThresholdPercent: MASTERY_PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 0,
    criticalCoverageMode: "all_boundaries",
    purpose:
      "Verify immediate operating understanding of why RI trains beyond Clarity.",
  },
  {
    assessmentKey: OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
    title: "Operating System Delayed Retrieval v2",
    evidenceKind: "retrieval",
    coveredDeepDiveKeys: CURRICULUM_V2_POST_SANDBOX_DEEP_DIVE_KEYS,
    formSize: CURRICULUM_V2_OPERATING_SYSTEM_CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: CURRICULUM_V2_OPERATING_SYSTEM_CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: CUMULATIVE_PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 24,
    criticalCoverageMode: "one_per_deep_dive",
    purpose:
      "Re-test all 16 post-Sandbox Deep Dives after spacing, including why Training continues beyond Clarity.",
  },
  {
    assessmentKey: OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2,
    title: "Operating System Interleaved Transfer v2",
    evidenceKind: "transfer",
    coveredDeepDiveKeys: CURRICULUM_V2_POST_SANDBOX_DEEP_DIVE_KEYS,
    formSize: CURRICULUM_V2_OPERATING_SYSTEM_CUMULATIVE_FORM_SIZE,
    minimumItemPoolSize: CURRICULUM_V2_OPERATING_SYSTEM_CUMULATIVE_MINIMUM_POOL_SIZE,
    passThresholdPercent: CUMULATIVE_PASS_THRESHOLD_PERCENT,
    minimumDelayHours: 0,
    criticalCoverageMode: "one_per_deep_dive",
    purpose:
      "Interleave all 16 post-Sandbox Deep Dives so the Specialist must preserve RI operating reasoning across execution, training purpose, evidence, continuity, and delivery.",
  },
];

export const TRANSFORMATION_DEEP_DIVE_KEYS: CapabilityDeepDiveKey[] = [
  "topic_conditioning",
  "clarity",
  "structured_execution",
  "controlled_discomfort",
  "time_pressure_stability",
];

export const EXECUTION_STANDARDS_DEEP_DIVE_KEYS: CapabilityDeepDiveKey[] = [
  "how_to_model",
  "how_to_intervene",
  "how_to_use_boss_battles",
  "what_not_to_do",
  "emotional_discipline_under_discomfort",
];

export const SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS: CapabilityDeepDiveKey[] = [
  "how_to_diagnose",
  "how_to_interpret_prompts",
  "how_baselines_are_established",
  "how_the_system_resolves_uncertainty",
];

export const SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS: CapabilityDeepDiveKey[] = [
  "intro_session_structure",
  "logging_system",
  "session_flow_control",
  "drill_library",
  "handover_verification",
  "tools_required",
];

export const TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY =
  "transformation_phases_retrieval_v1";
export const TRANSFORMATION_TRANSFER_ASSESSMENT_KEY =
  "transformation_state_transfer_v1";
export const OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY =
  "operating_system_retrieval_v1";
export const OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY =
  "operating_system_transfer_v1";

export const CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V1 =
  CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter(
    (entry) =>
      entry.evidenceKind === "mastery" ||
      entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY ||
      entry.assessmentKey === TRANSFORMATION_TRANSFER_ASSESSMENT_KEY ||
      entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY ||
      entry.assessmentKey === OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
  );

export const CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V2: CapabilityAssessmentPlanEntry[] = [
  ...CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V1.filter(
    (entry) =>
      entry.assessmentKey !== OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY &&
      entry.assessmentKey !== OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
  ),
  ...CAPABILITY_CURRICULUM_V2_REVIEW_ASSESSMENT_PLAN,
];

export function getCapabilityMvpAssessmentPlanEntry(assessmentKey: string) {
  return (
    CAPABILITY_MVP_ASSESSMENT_PLAN_V1.find((entry) => entry.assessmentKey === assessmentKey) ||
    CAPABILITY_CURRICULUM_V2_REVIEW_ASSESSMENT_PLAN.find(
      (entry) => entry.assessmentKey === assessmentKey,
    ) ||
    null
  );
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
