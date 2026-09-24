import type { TutorBattleTestModuleKey, TutorBattleTestPhaseKey } from "./battleTesting";

export type CapabilityBlueprintEvidenceKind = "mastery" | "retrieval" | "transfer";

export interface CapabilityCriticalBoundary {
  key: string;
  description: string;
}

export interface CapabilityDeepDiveBlueprint {
  key: TutorBattleTestPhaseKey;
  title: string;
  moduleKey: TutorBattleTestModuleKey;
  operatingCapability: string;
  competencyKeys: string[];
  criticalBoundaries: CapabilityCriticalBoundary[];
  requiredEvidenceKinds: CapabilityBlueprintEvidenceKind[];
  transferPartners: TutorBattleTestPhaseKey[];
}

export interface CapabilityModuleBlueprint {
  key: TutorBattleTestModuleKey;
  title: string;
  deepDiveKeys: TutorBattleTestPhaseKey[];
}

export const CAPABILITY_BLUEPRINT_VERSION = 2;

export const CAPABILITY_CROSS_CUTTING_COMPETENCIES = [
  "evidence.observation_vs_inference",
  "evidence.contamination",
  "evidence.logging_integrity",
  "evidence.condition_integrity",
  "evidence.rep_lineage",
  "evidence.observability_integrity",
  "discernment.escalation_boundary",
  "system.authority",
] as const;

const FULL_CAPABILITY_EVIDENCE: CapabilityBlueprintEvidenceKind[] = [
  "mastery",
  "retrieval",
  "transfer",
];

export const CAPABILITY_MODULE_BLUEPRINTS: CapabilityModuleBlueprint[] = [
  {
    key: "transformation_phases",
    title: "Transformation Phases",
    deepDiveKeys: [
      "topic_conditioning",
      "clarity",
      "structured_execution",
      "controlled_discomfort",
      "time_pressure_stability",
    ],
  },
  {
    key: "session_infrastructure",
    title: "Session Infrastructure",
    deepDiveKeys: [
      "intro_session_structure",
      "logging_system",
      "session_flow_control",
      "drill_library",
      "handover_verification",
      "tools_required",
    ],
  },
];

export const CAPABILITY_DEEP_DIVE_BLUEPRINTS: CapabilityDeepDiveBlueprint[] = [
  {
    key: "clarity",
    title: "Clarity Deep Dive",
    moduleKey: "transformation_phases",
    operatingCapability:
      "Build and verify a clear topic mental map before independent execution or pressure: vocabulary, method, reason, and immediate apply.",
    competencyKeys: [
      "clarity.phase_purpose",
      "clarity.recognition_boundary",
      "clarity.light_apply_support",
      "clarity.vmr_sequence",
      "clarity.identification_set",
      "clarity.modeling_set",
      "clarity.progression",
      "clarity.constraints",
      "clarity.rep_purpose",
      "clarity.transfer",
      "evidence.observation_vs_inference",
      "evidence.contamination",
      "evidence.logging_integrity",
      "discernment.escalation_boundary",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "clarity.modeling_not_independent_evidence",
        description: "Specialist-led Modeling cannot be treated as independent student evidence.",
      },
      {
        key: "clarity.identification_no_solving",
        description: "Solving cannot replace the no-solving Identification condition.",
      },
      {
        key: "clarity.no_manual_progression",
        description: "Material weak evidence cannot be overridden by the Specialist to advance a topic.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["structured_execution", "topic_conditioning", "logging_system"],
  },
  {
    key: "structured_execution",
    title: "Structured Execution Deep Dive",
    moduleKey: "transformation_phases",
    operatingCapability:
      "Protect reliable, ordered, repeatable and independent execution of a method the student already understands.",
    competencyKeys: [
      "structured_execution.phase_purpose",
      "structured_execution.required_structure",
      "structured_execution.independent_execution",
      "structured_execution.variation_control",
      "structured_execution.constraints",
      "structured_execution.progression",
      "structured_execution.recipe_sequence",
      "structured_execution.repeatability",
      "structured_execution.phase_boundary",
      "evidence.observation_vs_inference",
      "evidence.contamination",
      "discernment.escalation_boundary",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "structured_execution.prompted_not_independent",
        description: "Repeatedly prompted performance cannot be treated as independent execution.",
      },
      {
        key: "structured_execution.no_support_independent_execution",
        description: "Independent Execution must preserve its no-support condition.",
      },
      {
        key: "structured_execution.no_disguised_assistance",
        description: "Material Specialist assistance cannot be disguised as independent evidence.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["clarity", "controlled_discomfort", "drill_library", "logging_system"],
  },
  {
    key: "controlled_discomfort",
    title: "Controlled Discomfort Deep Dive",
    moduleKey: "transformation_phases",
    operatingCapability:
      "Keep a known method and productive response functioning when controlled difficulty, uncertainty, or unfamiliarity appears.",
    competencyKeys: [
      "controlled_discomfort.response_under_uncertainty",
      "controlled_discomfort.observation_fields",
      "controlled_discomfort.controlled_entry_boundary",
      "controlled_discomfort.no_rescue_boundary",
      "controlled_discomfort.repeat_exposure_boundary",
      "controlled_discomfort.accessible_difficulty",
      "evidence.observation_vs_inference",
      "evidence.contamination",
      "discernment.escalation_boundary",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "controlled_discomfort.no_full_rescue",
        description: "Full rescue cannot be introduced inside the first-step-only No Rescue condition.",
      },
      {
        key: "controlled_discomfort.repeat_exposure_no_support",
        description: "Repeat Exposure must preserve its no-support condition.",
      },
      {
        key: "controlled_discomfort.preserve_assigned_difficulty",
        description: "The assigned controlled difficulty cannot be removed merely to avoid discomfort.",
      },
      {
        key: "controlled_discomfort.no_psychological_override",
        description: "Invented psychological conclusions cannot override repeated evidence or system movement.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["structured_execution", "time_pressure_stability", "drill_library", "logging_system"],
  },
  {
    key: "time_pressure_stability",
    title: "Time Pressure Stability Deep Dive",
    moduleKey: "transformation_phases",
    operatingCapability:
      "Preserve the trained start, method structure, pace control, and completion integrity under the system-owned Timer Contract while keeping timing lineage trustworthy.",
    competencyKeys: [
      "time_pressure_stability.method_under_time",
      "time_pressure_stability.baseline_authority",
      "time_pressure_stability.structure_under_timer",
      "time_pressure_stability.repeated_timed_execution",
      "time_pressure_stability.full_constraint",
      "time_pressure_stability.technical_failure_lineage",
      "evidence.condition_integrity",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "time_pressure_stability.speed_never_replaces_structure",
        description: "Speed with broken structure, panic-driven guessing, or incomplete method use cannot be treated as stable TPS evidence.",
      },
      {
        key: "time_pressure_stability.timer_contract_is_system_owned",
        description: "The Specialist cannot estimate, loosen, tighten, pause, or replace the system-owned Timer Contract with a personal timing rule.",
      },
      {
        key: "time_pressure_stability.technical_replacement_only_for_objective_failure",
        description: "A replacement timed attempt is allowed only after an objective technical timing failure, using a fresh pre-prepared equivalent reserve under the same Timer Contract and set condition.",
      },
      {
        key: "time_pressure_stability.student_failure_is_real_evidence",
        description: "Timeout, panic, wrong method, incomplete work, or weak performance is student evidence and never authorizes a replacement attempt.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["controlled_discomfort", "structured_execution", "topic_conditioning", "logging_system", "drill_library", "tools_required"],
  },
  {
    key: "topic_conditioning",
    title: "Topic Conditioning Deep Dive",
    moduleKey: "transformation_phases",
    operatingCapability:
      "Condition and read each mathematical topic through its own phase, stability, breakdown fields, assigned drill, evidence and deterministic next action.",
    competencyKeys: [
      "topic_conditioning.topic_specific_state",
      "topic_conditioning.operating_chain",
      "topic_conditioning.phase_vs_stability",
      "topic_conditioning.repeated_evidence",
      "topic_conditioning.phase_identification",
      "evidence.observation_vs_inference",
      "evidence.rep_lineage",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "topic_conditioning.system_owned_movement",
        description: "Phase and stability movement belong to deterministic system rules, not Specialist preference.",
      },
      {
        key: "topic_conditioning.no_manual_override",
        description: "A Specialist cannot manually override evidence-based topic movement.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: [
      "clarity",
      "structured_execution",
      "controlled_discomfort",
      "time_pressure_stability",
      "intro_session_structure",
      "logging_system",
    ],
  },
  {
    key: "intro_session_structure",
    title: "Intro Session Structure",
    moduleKey: "session_infrastructure",
    operatingCapability:
      "Establish a trustworthy topic-entry phase and starting stability through evidence-complete, system-routed Diagnosis without turning Diagnosis into Training.",
    competencyKeys: [
      "intro.placement_purpose",
      "intro.starting_signal_hypothesis",
      "intro.evidence_question_routing",
      "intro.constraint_stripping",
      "intro.evidence_status_and_intervention",
      "intro.evidence_complete_stop",
      "intro.topic_scoped_resume",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "intro.no_teaching_as_baseline",
        description: "Teaching, correction, rescue, or first-step confirmation cannot be treated as clean independent baseline placement evidence.",
      },
      {
        key: "intro.starting_signal_never_placement",
        description: "A starting signal may choose the first evidence question but cannot determine the final phase or stability.",
      },
      {
        key: "intro.no_fixed_rep_quota",
        description: "Diagnosis stops when the evidence question is resolved; fixed repetition cannot replace evidence-complete routing.",
      },
      {
        key: "intro.high_maintenance_training_only",
        description: "Diagnosis may place Low, Medium, or High, but High Maintenance is earned only through Training evidence.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["topic_conditioning", "session_flow_control", "logging_system", "drill_library"],
  },
  {
    key: "logging_system",
    title: "Logging System",
    moduleKey: "session_infrastructure",
    operatingCapability:
      "Preserve trustworthy source evidence by recording concrete student behavior, evidence eligibility, intervention, condition, and lineage without manually interpreting the resulting state.",
    competencyKeys: [
      "logging.evidence_purpose",
      "evidence.observation_vs_inference",
      "logging.evidence_status",
      "logging.intervention_separation",
      "evidence.condition_integrity",
      "evidence.rep_lineage",
      "logging.recovery_history",
      "logging.downstream_claim_integrity",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "logging.record_actual_behavior",
        description: "A preferred interpretation cannot replace the concrete behavior that actually occurred.",
      },
      {
        key: "logging.missing_is_not_weakness",
        description: "Not-observed evidence must remain missing rather than being converted into weakness, strength, or a guessed state.",
      },
      {
        key: "logging.intervention_not_hidden",
        description: "Prompting, rescue, teaching, neutral clarification, first-step confirmation, and other interventions must be recorded separately from student behavior.",
      },
      {
        key: "logging.condition_change_not_clean",
        description: "A materially changed timer, support level, task condition, or interrupted condition cannot be logged as clean proof under the original condition.",
      },
      {
        key: "logging.claims_cannot_override_system",
        description: "Narrative, reporting, or Specialist preference cannot strengthen evidence or override the evidence-derived operating decision.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["topic_conditioning", "intro_session_structure", "session_flow_control", "drill_library", "handover_verification", "time_pressure_stability"],
  },
  {
    key: "session_flow_control",
    title: "Session Flow Control",
    moduleKey: "session_infrastructure",
    operatingCapability:
      "Identify the active session context, preserve that context's authority and condition, and follow the system route without blending Diagnosis, Training, Handover, or targeted re-diagnosis.",
    competencyKeys: [
      "session_flow.context_identity",
      "session_flow.intro_diagnosis",
      "session_flow.active_training",
      "session_flow.handover_verification",
      "session_flow.targeted_rediagnosis",
      "session_flow.condition_integrity",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "session_flow.no_context_blending",
        description: "Diagnosis, Training, Handover Verification, and targeted re-diagnosis cannot borrow each other's authority or support rules.",
      },
      {
        key: "session_flow.handover_preserves_inherited_state",
        description: "A replacement Specialist verifies inherited truth before ordinary Training and cannot erase inherited state through personal re-placement.",
      },
      {
        key: "session_flow.no_hidden_baseline_calibration",
        description: "Missing prerequisite or timing authority must route through explicit targeted evidence-complete re-diagnosis rather than hidden calibration side reps.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["intro_session_structure", "drill_library", "handover_verification", "logging_system", "time_pressure_stability"],
  },
  {
    key: "drill_library",
    title: "Drill Library",
    moduleKey: "session_infrastructure",
    operatingCapability:
      "Operate Diagnosis, Training and Verification from purpose through phase, set, rep, constraint, observation, evidence and system action.",
    competencyKeys: [
      "drill_library.operating_hierarchy",
      "drill_library.diagnosis_purpose",
      "drill_library.training_purpose",
      "drill_library.verification_purpose",
      "drill_library.phase_set_constraints",
      "drill_library.repetition_as_evidence",
      "drill_library.preparation_contract",
      "evidence.condition_integrity",
    ],
    criticalBoundaries: [
      {
        key: "drill_library.identification_no_solving",
        description: "Solving cannot be accepted as evidence from recognition-only Identification.",
      },
      {
        key: "drill_library.variation_control_no_support",
        description: "Variation Control cannot include support and still prove independent transfer.",
      },
      {
        key: "drill_library.repeat_exposure_no_rescue",
        description: "Repeat Exposure cannot include rescue and still prove independent response under difficulty.",
      },
      {
        key: "drill_library.full_constraint_method_over_speed",
        description: "Full Constraint cannot treat speed with collapsed structure as success.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: [
      "clarity",
      "structured_execution",
      "controlled_discomfort",
      "time_pressure_stability",
      "session_flow_control",
      "tools_required",
    ],
  },
  {
    key: "handover_verification",
    title: "Handover Verification",
    moduleKey: "session_infrastructure",
    operatingCapability:
      "Preserve student history and verify the inherited topic-state before a replacement Specialist resumes normal training.",
    competencyKeys: [
      "handover.inherited_state",
      "handover.continuity_purpose",
      "handover.verification_block",
      "handover.outcome_families",
      "handover.training_reopen_gate",
      "handover.evidence_record",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "handover.no_personal_replacement",
        description: "Inherited topic-state cannot be erased and replaced by personal re-placement.",
      },
      {
        key: "handover.no_manual_phase_change",
        description: "A Specialist cannot manually change phase from one rep before the authorised verification result.",
      },
      {
        key: "handover.training_closed_on_mismatch",
        description: "Normal training must remain closed while a continuity mismatch is unresolved.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["topic_conditioning", "session_flow_control", "logging_system", "drill_library"],
  },
  {
    key: "tools_required",
    title: "Tools Required",
    moduleKey: "session_infrastructure",
    operatingCapability:
      "Establish and preserve the minimum visible handwritten-work and reliable-audio environment required for valid RI delivery and observable evidence.",
    competencyKeys: [
      "tools.compulsory_kit",
      "tools.top_down_visibility",
      "tools.audio_reliability",
      "tools.preflight_check",
      "tools.observability_gate",
      "tools.optional_vs_required",
      "evidence.observability_integrity",
    ],
    criticalBoundaries: [
      {
        key: "tools.no_scoring_unobservable_work",
        description: "A live drill cannot be scored when the written method is not reliably observable.",
      },
      {
        key: "tools.no_scoring_unreliable_audio",
        description: "Spoken evidence cannot be scored when audio is not reliably observable.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["drill_library", "logging_system", "session_flow_control", "time_pressure_stability"],
  },
];

export const CAPABILITY_DEEP_DIVE_BY_KEY = new Map(
  CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive) => [deepDive.key, deepDive] as const),
);

export function getCapabilityDeepDiveBlueprint(key: string) {
  return CAPABILITY_DEEP_DIVE_BY_KEY.get(key as TutorBattleTestPhaseKey) || null;
}

export function getCapabilityModuleBlueprint(key: TutorBattleTestModuleKey) {
  return CAPABILITY_MODULE_BLUEPRINTS.find((module) => module.key === key) || null;
}

export function getRequiredCapabilityEvidenceCells() {
  return CAPABILITY_DEEP_DIVE_BLUEPRINTS.flatMap((deepDive) =>
    deepDive.requiredEvidenceKinds.map((evidenceKind) => ({
      code: `deep_dive.${deepDive.key}.${evidenceKind}`,
      deepDiveKey: deepDive.key,
      evidenceKind,
      label: `${deepDive.title} - ${evidenceKind}`,
    })),
  );
}
