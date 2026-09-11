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

export const CAPABILITY_BLUEPRINT_VERSION = 1;

export const CAPABILITY_CROSS_CUTTING_COMPETENCIES = [
  "evidence.observation_vs_inference",
  "evidence.condition_integrity",
  "evidence.assistance_contamination",
  "evidence.rep_lineage",
  "evidence.observability_integrity",
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
      "clarity.mental_map",
      "clarity.observation_fields",
      "clarity.modeling_vs_evidence",
      "clarity.identification_constraint",
      "clarity.light_apply_constraint",
      "evidence.observation_vs_inference",
      "evidence.assistance_contamination",
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
      "structured_execution.method_ownership",
      "structured_execution.observation_fields",
      "structured_execution.required_structure_boundary",
      "structured_execution.independent_execution_boundary",
      "structured_execution.variation_control_boundary",
      "evidence.observation_vs_inference",
      "evidence.assistance_contamination",
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
      "evidence.assistance_contamination",
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
      "Preserve the trained start, method structure, pace control and completion integrity when urgency and limited time are introduced.",
    competencyKeys: [
      "time_pressure_stability.method_under_time",
      "time_pressure_stability.observation_fields",
      "time_pressure_stability.structure_under_timer",
      "time_pressure_stability.repeated_timed_execution",
      "time_pressure_stability.full_constraint",
      "time_pressure_stability.method_over_speed",
      "evidence.assistance_contamination",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "time_pressure_stability.speed_never_replaces_structure",
        description: "Speed with broken structure or guessing cannot be treated as stable timed evidence.",
      },
      {
        key: "time_pressure_stability.no_panic_coaching",
        description: "Panic coaching cannot be added to a no-support timed condition.",
      },
      {
        key: "time_pressure_stability.rescued_not_independent",
        description: "A rescued timed rep cannot be treated as independent stability evidence.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["controlled_discomfort", "topic_conditioning", "drill_library", "tools_required"],
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
      "Verify the correct topic-entry phase through adaptive Diagnosis and stop when the system locks the entry state.",
    competencyKeys: [
      "intro.placement_purpose",
      "intro.recommended_start_hypothesis",
      "intro.adjacent_phase_movement",
      "intro.entry_lock_stop",
      "intro.diagnosis_vs_training",
      "evidence.observation_vs_inference",
      "evidence.assistance_contamination",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "intro.no_teaching_as_diagnosis",
        description: "Intro cannot be converted into teaching and assisted performance scored as placement evidence.",
      },
      {
        key: "intro.adjacent_movement_only",
        description: "Specialist instinct cannot bypass adjacent score-driven phase verification.",
      },
      {
        key: "intro.parent_cannot_override_placement",
        description: "Parent preference cannot override scored topic placement.",
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
      "Preserve a trustworthy rep-by-rep record of observable student behaviour so scoring, movement and downstream claims remain defensible.",
    competencyKeys: [
      "logging.evidence_purpose",
      "evidence.observation_vs_inference",
      "evidence.rep_lineage",
      "logging.raw_option_fidelity",
      "evidence.assistance_contamination",
      "logging.missing_evidence_recovery",
      "logging.downstream_claim_integrity",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "logging.record_actual_behavior",
        description: "A preferred observation cannot replace the behaviour that actually occurred.",
      },
      {
        key: "logging.assisted_not_independent",
        description: "Assisted performance cannot be recorded as independent evidence.",
      },
      {
        key: "logging.no_invented_behavior",
        description: "Unobserved behaviour cannot be invented to complete the evidence record.",
      },
      {
        key: "logging.no_retroactive_fabrication",
        description: "Missing rep evidence cannot be retrospectively manufactured from memory or impression.",
      },
      {
        key: "logging.claims_cannot_override_system",
        description: "Narrative or parent-facing claims cannot be altered to override a deterministic hold result.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["topic_conditioning", "intro_session_structure", "session_flow_control", "drill_library", "handover_verification"],
  },
  {
    key: "session_flow_control",
    title: "Session Flow Control",
    moduleKey: "session_infrastructure",
    operatingCapability:
      "Identify why the session exists, run the drill type that serves that context, preserve phase constraints and follow the system-selected next action.",
    competencyKeys: [
      "session_flow.context_vs_drill",
      "session_flow.context_mapping",
      "session_flow.active_training_new_topic",
      "session_flow.handover_context",
      "session_flow.system_selected_drill",
      "session_flow.preparation_integrity",
      "system.authority",
    ],
    criticalBoundaries: [
      {
        key: "session_flow.no_manual_drill_override",
        description: "The system-selected drill cannot be replaced by Specialist preference.",
      },
      {
        key: "session_flow.handover_preserves_inherited_state",
        description: "A replacement Specialist cannot erase inherited state and bypass the Handover Verification context.",
      },
    ],
    requiredEvidenceKinds: [...FULL_CAPABILITY_EVIDENCE],
    transferPartners: ["intro_session_structure", "drill_library", "handover_verification", "logging_system"],
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
