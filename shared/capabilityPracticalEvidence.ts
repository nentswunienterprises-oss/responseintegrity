import { SANDBOX_MOCK_CRITERIA, type SandboxMockCriterionKey } from "./sandboxReadiness";
import { getCapabilityDeepDiveBlueprint } from "./capabilityBlueprint";

export type CapabilityPracticalProofKey = "prepare" | "execute" | "evidence";
export type CapabilityPracticalArtifactType = "screen_voice" | "screen_video" | "video";
export type CapabilityPracticalReviewStatus = "submitted" | "approved" | "repeat_required" | "integrity_review";
export type CapabilityPracticalCriterionJudgment = "clear" | "partial" | "fail";
export type CapabilityPracticalReviewOutcome = "approved" | "repeat_required" | "integrity_review";

export interface CapabilityPracticalCompetencyLink {
  deepDiveKey: string;
  competencyKey: string;
}

export interface CapabilityPracticalCriticalBoundaryLink {
  deepDiveKey: string;
  boundaryKey: string;
}

export interface CapabilityPracticalRubricCriterion {
  key: string;
  label: string;
  observableStandard: string;
  clearAnchor: string;
  partialAnchor: string;
  failAnchor: string;
  criticalOnFail: boolean;
  competencyLinks: CapabilityPracticalCompetencyLink[];
  criticalBoundaryLinks: CapabilityPracticalCriticalBoundaryLink[];
  sandboxMockCriteria: SandboxMockCriterionKey[];
}

export interface CapabilityPracticalReviewRubric {
  version: number;
  outcomeRuleVersion: 1;
  criteria: CapabilityPracticalRubricCriterion[];
}

export interface CapabilityPracticalCriterionReviewInput {
  criterionKey: string;
  judgment: CapabilityPracticalCriterionJudgment;
  evidenceNote?: string | null;
}

export interface CapabilityPracticalCriterionReview {
  criterionKey: string;
  judgment: CapabilityPracticalCriterionJudgment;
  evidenceNote: string | null;
}

export interface CapabilityPracticalDerivedReview {
  outcome: CapabilityPracticalReviewOutcome;
  reasonCode: "rubric_clear" | "rubric_repeat_required" | "rubric_critical_fail";
  rubricVersion: number;
  outcomeRuleVersion: 1;
  clearCount: number;
  partialCount: number;
  failCount: number;
  criticalFailCount: number;
  criticalFailCriterionKeys: string[];
  criterionReviews: CapabilityPracticalCriterionReview[];
}

export interface CapabilityPracticalProofDefinition {
  key: CapabilityPracticalProofKey;
  version: number;
  title: string;
  purpose: string;
  requiredArtifactTypes: CapabilityPracticalArtifactType[];
  mustShow: string[];
  declarationPrompts: Array<{
    key: string;
    prompt: string;
    minLength: number;
  }>;
  competencyLinks: CapabilityPracticalCompetencyLink[];
  reviewRubric: CapabilityPracticalReviewRubric;
  realStudentDataAllowed: false;
}

const PREPARE_RUBRIC: CapabilityPracticalReviewRubric = {
  version: 1,
  outcomeRuleVersion: 1,
  criteria: [
    {
      key: "case_state_fidelity",
      label: "Reads the provided case without replacing its state",
      observableStandard: "Uses the sandbox case as given, identifies the current topic/session state, and does not invent a fresh placement or preferred starting point.",
      clearAnchor: "State and context are read correctly from the provided case and carried into preparation unchanged.",
      partialAnchor: "Most state/context information is used correctly, but one material element is unclear, omitted, or weakly justified.",
      failAnchor: "The Specialist replaces, ignores, or materially invents the provided state/context.",
      criticalOnFail: false,
      competencyLinks: [
        { deepDiveKey: "topic_conditioning", competencyKey: "topic_conditioning.topic_specific_state" },
        { deepDiveKey: "session_flow_control", competencyKey: "session_flow.context_mapping" },
      ],
      criticalBoundaryLinks: [],
      sandboxMockCriteria: ["system_direction_followed"],
    },
    {
      key: "system_selected_plan",
      label: "Builds the plan from system direction",
      observableStandard: "Selects the session context, drill, set conditions, and order from the assigned RI state rather than personal preference.",
      clearAnchor: "Every material planning choice follows the system-provided state and assigned operating path.",
      partialAnchor: "The final plan is mostly correct, but at least one choice is uncertain or justified from preference rather than the system contract.",
      failAnchor: "The Specialist replaces a system-selected drill, state, or movement with a preferred alternative and treats that replacement as authorised.",
      criticalOnFail: true,
      competencyLinks: [
        { deepDiveKey: "session_flow_control", competencyKey: "session_flow.system_selected_drill" },
        { deepDiveKey: "topic_conditioning", competencyKey: "system.authority" },
      ],
      criticalBoundaryLinks: [
        { deepDiveKey: "session_flow_control", boundaryKey: "session_flow.no_manual_drill_override" },
        { deepDiveKey: "topic_conditioning", boundaryKey: "topic_conditioning.no_manual_override" },
      ],
      sandboxMockCriteria: ["system_direction_followed", "system_result_respected"],
    },
    {
      key: "condition_preparation",
      label: "Prepares the exact evidence condition",
      observableStandard: "Prepares problem opportunities, order, support boundaries, and set constraints without weakening or changing the condition being tested.",
      clearAnchor: "The prepared materials and sequence preserve the assigned set condition and support boundary exactly.",
      partialAnchor: "The intended condition is recognisable, but one preparation detail could contaminate or weaken the evidence if left unresolved.",
      failAnchor: "The planned materials, support, order, or constraints materially test a different condition from the one assigned.",
      criticalOnFail: false,
      competencyLinks: [
        { deepDiveKey: "session_flow_control", competencyKey: "session_flow.preparation_integrity" },
        { deepDiveKey: "clarity", competencyKey: "clarity.constraints" },
      ],
      criticalBoundaryLinks: [],
      sandboxMockCriteria: ["phase_constraints_preserved"],
    },
    {
      key: "observation_targets",
      label: "Defines observable evidence before delivery",
      observableStandard: "States the visible or audible responses to watch for and keeps those targets separate from psychological interpretation.",
      clearAnchor: "Targets are concrete observable behaviours tied to the active condition, with no unsupported inference presented as fact.",
      partialAnchor: "Most targets are observable, but one target is vague, global, or slips toward interpretation.",
      failAnchor: "The evidence plan relies mainly on impressions, labels, or unobservable psychological conclusions.",
      criticalOnFail: false,
      competencyLinks: [
        { deepDiveKey: "clarity", competencyKey: "evidence.observation_vs_inference" },
        { deepDiveKey: "logging_system", competencyKey: "logging.evidence_purpose" },
      ],
      criticalBoundaryLinks: [],
      sandboxMockCriteria: ["evidence_captured"],
    },
    {
      key: "observability_preflight",
      label: "Checks that evidence can actually be observed",
      observableStandard: "Checks the required tools, view, audio, and working visibility before relying on the planned session evidence.",
      clearAnchor: "The Specialist explicitly verifies that written work and spoken responses will be observable and identifies what would block scoring.",
      partialAnchor: "A preflight is present but one material observability dependency is assumed rather than checked.",
      failAnchor: "The Specialist plans to score or infer evidence even when required work or audio would not be observable.",
      criticalOnFail: true,
      competencyLinks: [
        { deepDiveKey: "tools_required", competencyKey: "tools.preflight_check" },
        { deepDiveKey: "tools_required", competencyKey: "evidence.observability_integrity" },
      ],
      criticalBoundaryLinks: [
        { deepDiveKey: "tools_required", boundaryKey: "tools.no_scoring_unobservable_work" },
        { deepDiveKey: "tools_required", boundaryKey: "tools.no_scoring_unreliable_audio" },
      ],
      sandboxMockCriteria: ["evidence_captured"],
    },
    {
      key: "authority_and_escalation",
      label: "Keeps decisions inside Specialist authority",
      observableStandard: "Names what the Specialist may execute, what the system decides, and what must be escalated rather than improvised.",
      clearAnchor: "The authority boundary is explicit and the Specialist leaves state movement and unsupported exceptions to the system or authorised escalation path.",
      partialAnchor: "The Specialist recognises the boundary but is uncertain about one escalation or system-owned decision.",
      failAnchor: "The Specialist claims authority to manufacture progression, rewrite system state, or resolve an unauthorised exception personally.",
      criticalOnFail: true,
      competencyLinks: [
        { deepDiveKey: "topic_conditioning", competencyKey: "system.authority" },
        { deepDiveKey: "structured_execution", competencyKey: "discernment.escalation_boundary" },
      ],
      criticalBoundaryLinks: [
        { deepDiveKey: "topic_conditioning", boundaryKey: "topic_conditioning.system_owned_movement" },
        { deepDiveKey: "topic_conditioning", boundaryKey: "topic_conditioning.no_manual_override" },
      ],
      sandboxMockCriteria: ["system_result_respected"],
    },
  ],
};

const EXECUTE_RUBRIC: CapabilityPracticalReviewRubric = {
  version: 1,
  outcomeRuleVersion: 1,
  criteria: [
    {
      key: "opening_and_condition",
      label: "Opens the session condition clearly",
      observableStandard: "Opens professionally, establishes what the fictional student is being asked to do, and does not turn the assigned session into a different context.",
      clearAnchor: "The student-facing instruction is clear, concise, and faithful to the assigned session condition.",
      partialAnchor: "The intended condition is mostly clear but one instruction or framing detail could create ambiguity.",
      failAnchor: "The opening materially changes the task, context, or capability being tested.",
      criticalOnFail: false,
      competencyLinks: [
        { deepDiveKey: "session_flow_control", competencyKey: "session_flow.context_vs_drill" },
        { deepDiveKey: "clarity", competencyKey: "clarity.rep_purpose" },
      ],
      criticalBoundaryLinks: [],
      sandboxMockCriteria: ["system_direction_followed"],
    },
    {
      key: "instruction_support_boundary",
      label: "Uses only permitted instructions and support",
      observableStandard: "Keeps prompts, cues, and support inside the active set's defined boundary even when the fictional student hesitates.",
      clearAnchor: "Support never exceeds the active condition and responsibility returns to the student at the correct point.",
      partialAnchor: "One cue or instruction is close to the boundary and would need tightening before live responsibility.",
      failAnchor: "Material support is supplied where the active condition prohibits it or the Specialist carries execution for the student.",
      criticalOnFail: false,
      competencyLinks: [
        { deepDiveKey: "clarity", competencyKey: "clarity.light_apply_support" },
        { deepDiveKey: "structured_execution", competencyKey: "structured_execution.independent_execution" },
        { deepDiveKey: "controlled_discomfort", competencyKey: "controlled_discomfort.no_rescue_boundary" },
      ],
      criticalBoundaryLinks: [],
      sandboxMockCriteria: ["phase_constraints_preserved", "student_response_managed"],
    },
    {
      key: "difficulty_without_rescue",
      label: "Allows the response to emerge under difficulty",
      observableStandard: "Handles pauses, uncertainty, wrong starts, or struggle without reflexively rescuing the fictional student out of the condition.",
      clearAnchor: "Difficulty is tolerated long enough for the intended response evidence to emerge and any permitted support is controlled.",
      partialAnchor: "The Specialist mostly preserves difficulty but intervenes early or over-explains once in a way that weakens the evidence.",
      failAnchor: "The Specialist repeatedly removes the assigned difficulty or gives full rescue instead of preserving the intended condition.",
      criticalOnFail: false,
      competencyLinks: [
        { deepDiveKey: "controlled_discomfort", competencyKey: "controlled_discomfort.response_under_uncertainty" },
        { deepDiveKey: "controlled_discomfort", competencyKey: "controlled_discomfort.accessible_difficulty" },
      ],
      criticalBoundaryLinks: [],
      sandboxMockCriteria: ["student_response_managed", "phase_constraints_preserved"],
    },
    {
      key: "assistance_evidence_fidelity",
      label: "Never disguises assistance as independence",
      observableStandard: "If assistance occurs, preserves its evidentiary meaning instead of presenting the resulting response as independent.",
      clearAnchor: "Any support is acknowledged accurately and the Specialist distinguishes assisted completion from independent evidence.",
      partialAnchor: "The Specialist notices the support but is imprecise about how it changes the evidence classification.",
      failAnchor: "Assisted performance is described, logged, or defended as independent evidence.",
      criticalOnFail: true,
      competencyLinks: [
        { deepDiveKey: "structured_execution", competencyKey: "evidence.contamination" },
        { deepDiveKey: "logging_system", competencyKey: "logging.raw_option_fidelity" },
      ],
      criticalBoundaryLinks: [
        { deepDiveKey: "structured_execution", boundaryKey: "structured_execution.no_disguised_assistance" },
        { deepDiveKey: "logging_system", boundaryKey: "logging.assisted_not_independent" },
      ],
      sandboxMockCriteria: ["evidence_captured"],
    },
    {
      key: "system_flow_fidelity",
      label: "Follows the assigned drill and next-action authority",
      observableStandard: "Runs the system-selected drill and does not silently replace its flow because another activity feels preferable.",
      clearAnchor: "The assigned flow is followed and any desired deviation is surfaced rather than silently executed.",
      partialAnchor: "The Specialist follows the flow but shows uncertainty about when an authorised deviation or escalation is required.",
      failAnchor: "The Specialist silently overrides the assigned drill, state, or next action and treats the personal choice as authoritative.",
      criticalOnFail: true,
      competencyLinks: [
        { deepDiveKey: "session_flow_control", competencyKey: "session_flow.system_selected_drill" },
        { deepDiveKey: "topic_conditioning", competencyKey: "system.authority" },
      ],
      criticalBoundaryLinks: [
        { deepDiveKey: "session_flow_control", boundaryKey: "session_flow.no_manual_drill_override" },
        { deepDiveKey: "topic_conditioning", boundaryKey: "topic_conditioning.no_manual_override" },
      ],
      sandboxMockCriteria: ["system_direction_followed", "system_result_respected"],
    },
    {
      key: "close_record_escalate",
      label: "Closes with the actual result intact",
      observableStandard: "Closes the set without smoothing the result, states what should be recorded, and identifies any deviation that requires escalation.",
      clearAnchor: "The demonstrated close preserves the actual fictional response and leaves system-owned conclusions to the correct authority.",
      partialAnchor: "The close preserves most evidence but misses one material logging or escalation detail.",
      failAnchor: "The close rewrites the result, hides a deviation, or manufactures a stronger outcome than the demonstration supports.",
      criticalOnFail: true,
      competencyLinks: [
        { deepDiveKey: "logging_system", competencyKey: "evidence.logging_integrity" },
        { deepDiveKey: "structured_execution", competencyKey: "discernment.escalation_boundary" },
      ],
      criticalBoundaryLinks: [
        { deepDiveKey: "logging_system", boundaryKey: "logging.record_actual_behavior" },
        { deepDiveKey: "logging_system", boundaryKey: "logging.claims_cannot_override_system" },
      ],
      sandboxMockCriteria: ["evidence_captured", "system_result_respected"],
    },
  ],
};

const EVIDENCE_RUBRIC: CapabilityPracticalReviewRubric = {
  version: 1,
  outcomeRuleVersion: 1,
  criteria: [
    {
      key: "observation_vs_inference",
      label: "Separates observation from interpretation",
      observableStandard: "Identifies visible or audible behaviour as evidence and does not convert unsupported psychological explanations into facts.",
      clearAnchor: "Observable facts are preserved accurately and unsupported inferences are explicitly excluded.",
      partialAnchor: "Most evidence is classified correctly, but one statement remains vague or inferential.",
      failAnchor: "Material psychological interpretation or impression is treated as observed evidence.",
      criticalOnFail: false,
      competencyLinks: [
        { deepDiveKey: "logging_system", competencyKey: "evidence.observation_vs_inference" },
      ],
      criticalBoundaryLinks: [],
      sandboxMockCriteria: ["evidence_captured"],
    },
    {
      key: "raw_behavior_fidelity",
      label: "Records the behaviour that actually occurred",
      observableStandard: "Selects or describes evidence from the fictional record without improving, averaging, softening, or inventing what happened.",
      clearAnchor: "Every selected observation matches the supplied evidence, including weak or uncomfortable facts.",
      partialAnchor: "The Specialist preserves the overall record but smooths or compresses one non-critical detail.",
      failAnchor: "A preferred, invented, or materially altered observation replaces the behaviour actually supplied in the case.",
      criticalOnFail: true,
      competencyLinks: [
        { deepDiveKey: "logging_system", competencyKey: "logging.raw_option_fidelity" },
        { deepDiveKey: "logging_system", competencyKey: "evidence.logging_integrity" },
      ],
      criticalBoundaryLinks: [
        { deepDiveKey: "logging_system", boundaryKey: "logging.record_actual_behavior" },
        { deepDiveKey: "logging_system", boundaryKey: "logging.no_invented_behavior" },
      ],
      sandboxMockCriteria: ["evidence_captured"],
    },
    {
      key: "assistance_contamination",
      label: "Detects when support changes the evidence",
      observableStandard: "Identifies prompting, rescue, cueing, or other assistance that prevents a response from being treated as independent.",
      clearAnchor: "Material support is identified and its impact on independence is described correctly.",
      partialAnchor: "The assistance is noticed but its impact on the claim is incompletely or inconsistently described.",
      failAnchor: "Material assistance is ignored or the resulting response is presented as independent evidence.",
      criticalOnFail: true,
      competencyLinks: [
        { deepDiveKey: "logging_system", competencyKey: "evidence.contamination" },
        { deepDiveKey: "structured_execution", competencyKey: "structured_execution.independent_execution" },
      ],
      criticalBoundaryLinks: [
        { deepDiveKey: "logging_system", boundaryKey: "logging.assisted_not_independent" },
        { deepDiveKey: "structured_execution", boundaryKey: "structured_execution.no_disguised_assistance" },
      ],
      sandboxMockCriteria: ["evidence_captured", "phase_constraints_preserved"],
    },
    {
      key: "rep_lineage_and_history",
      label: "Preserves set, rep, and weak-history lineage",
      observableStandard: "Keeps evidence attached to the condition and repetition where it occurred and does not erase earlier weak evidence because later reps improve.",
      clearAnchor: "Set/rep context and the full response history are preserved without collapsing them into a cleaner story.",
      partialAnchor: "The main pattern is preserved but one rep or condition is insufficiently distinguished.",
      failAnchor: "Earlier weak evidence or its set/rep condition is removed, replaced, or materially rewritten to improve the overall story.",
      criticalOnFail: false,
      competencyLinks: [
        { deepDiveKey: "logging_system", competencyKey: "evidence.rep_lineage" },
      ],
      criticalBoundaryLinks: [],
      sandboxMockCriteria: ["evidence_captured"],
    },
    {
      key: "missing_evidence_recovery",
      label: "Refuses to manufacture missing evidence",
      observableStandard: "Declares missing evidence and uses the authorised recovery path rather than reconstructing unobserved reps from memory or impression.",
      clearAnchor: "Missing evidence is surfaced explicitly and the Specialist identifies rerun/recovery rather than fabrication.",
      partialAnchor: "The Specialist recognises the missing evidence but is uncertain about the exact authorised recovery path.",
      failAnchor: "The Specialist proposes or accepts recreating unobserved evidence from memory, averages, or likely behaviour.",
      criticalOnFail: true,
      competencyLinks: [
        { deepDiveKey: "logging_system", competencyKey: "logging.missing_evidence_recovery" },
      ],
      criticalBoundaryLinks: [
        { deepDiveKey: "logging_system", boundaryKey: "logging.no_retroactive_fabrication" },
      ],
      sandboxMockCriteria: ["evidence_captured"],
    },
    {
      key: "claim_and_system_authority",
      label: "Keeps downstream claims aligned to the evidence and system result",
      observableStandard: "Does not rewrite the narrative, progression claim, or parent-facing conclusion to contradict the deterministic result.",
      clearAnchor: "The Specialist preserves the system result and limits claims to what the evidence supports, escalating anything outside authority.",
      partialAnchor: "The correct system result is accepted but one proposed claim is broader than the evidence cleanly supports.",
      failAnchor: "The Specialist proposes changing evidence or narrative so a desired progression or stronger claim can override the system result.",
      criticalOnFail: true,
      competencyLinks: [
        { deepDiveKey: "logging_system", competencyKey: "logging.downstream_claim_integrity" },
        { deepDiveKey: "structured_execution", competencyKey: "discernment.escalation_boundary" },
        { deepDiveKey: "topic_conditioning", competencyKey: "system.authority" },
      ],
      criticalBoundaryLinks: [
        { deepDiveKey: "logging_system", boundaryKey: "logging.claims_cannot_override_system" },
        { deepDiveKey: "topic_conditioning", boundaryKey: "topic_conditioning.no_manual_override" },
      ],
      sandboxMockCriteria: ["system_result_respected"],
    },
  ],
};

export const CAPABILITY_PRACTICAL_PROOFS: CapabilityPracticalProofDefinition[] = [
  {
    key: "prepare",
    version: 1,
    title: "Practical 1 - Prepare",
    purpose: "Show that you can inspect a provided sandbox case and prepare an RI session from the system rather than from improvisation.",
    requiredArtifactTypes: ["screen_voice", "screen_video"],
    mustShow: [
      "Open and inspect the provided sandbox student case.",
      "Identify the active topic state and the purpose of the session.",
      "Select the correct mode, drill and set conditions from RI-OS.",
      "Prepare the required problem opportunities without changing the defined condition.",
      "State exactly what observable student responses you will watch for.",
      "State what you would escalate rather than decide yourself.",
    ],
    declarationPrompts: [
      { key: "sessionPurpose", prompt: "What is the session trying to establish?", minLength: 30 },
      { key: "drillChoiceReason", prompt: "Why is this drill and condition correct for the provided case?", minLength: 40 },
      { key: "observationTarget", prompt: "What observable responses will you watch for?", minLength: 40 },
      { key: "authorityBoundary", prompt: "What decision remains outside your authority and must be left to the system or escalated?", minLength: 30 },
    ],
    competencyLinks: [
      { deepDiveKey: "clarity", competencyKey: "system.authority" },
      { deepDiveKey: "clarity", competencyKey: "evidence.observation_vs_inference" },
      { deepDiveKey: "structured_execution", competencyKey: "structured_execution.phase_boundary" },
    ],
    reviewRubric: PREPARE_RUBRIC,
    realStudentDataAllowed: false,
  },
  {
    key: "execute",
    version: 1,
    title: "Practical 2 - Execute",
    purpose: "Show how you conduct yourself while running a defined RI session condition, including communication, support boundaries and response to difficulty.",
    requiredArtifactTypes: ["screen_video", "video"],
    mustShow: [
      "Open the simulated session professionally and establish the task condition clearly.",
      "Give the student only the instructions permitted by the active set.",
      "Preserve support boundaries when the simulated student hesitates or struggles.",
      "Do not rescue the student into stronger-looking evidence.",
      "Show how you would close the set and preserve the actual result.",
      "Explain when you would stop, record a deviation or escalate rather than improvise protocol.",
    ],
    declarationPrompts: [
      { key: "conditionPreserved", prompt: "Which condition did you have to preserve during the demonstration?", minLength: 30 },
      { key: "difficultyResponse", prompt: "How did you respond when difficulty appeared without contaminating the evidence?", minLength: 40 },
      { key: "closingDecision", prompt: "What did you preserve at the end of the demonstration and what remains for the system to decide?", minLength: 40 },
    ],
    competencyLinks: [
      { deepDiveKey: "clarity", competencyKey: "clarity.light_apply_support" },
      { deepDiveKey: "structured_execution", competencyKey: "structured_execution.independent_execution" },
      { deepDiveKey: "structured_execution", competencyKey: "structured_execution.required_structure" },
      { deepDiveKey: "structured_execution", competencyKey: "discernment.escalation_boundary" },
    ],
    reviewRubric: EXECUTE_RUBRIC,
    realStudentDataAllowed: false,
  },
  {
    key: "evidence",
    version: 1,
    title: "Practical 3 - Evidence",
    purpose: "Show that you can inspect messy sandbox session evidence and preserve the difference between observation, inference, contamination and authorised escalation.",
    requiredArtifactTypes: ["screen_voice", "screen_video"],
    mustShow: [
      "Inspect the provided sandbox session evidence without rewriting it.",
      "Separate observable facts from inference or interpretation.",
      "Identify any support that contaminated a claim of independence.",
      "Preserve weak earlier evidence even where later reps improved.",
      "Identify what can be logged, what cannot be claimed and what must be escalated.",
    ],
    declarationPrompts: [
      { key: "validEvidence", prompt: "Which observations are valid evidence and why?", minLength: 40 },
      { key: "contamination", prompt: "Where, if anywhere, was the evidence contaminated?", minLength: 40 },
      { key: "unsupportedClaim", prompt: "Which conclusion would be unsafe or unsupported by the evidence?", minLength: 40 },
      { key: "escalation", prompt: "What, if anything, should be escalated rather than resolved by the Specialist?", minLength: 30 },
    ],
    competencyLinks: [
      { deepDiveKey: "clarity", competencyKey: "evidence.observation_vs_inference" },
      { deepDiveKey: "clarity", competencyKey: "evidence.contamination" },
      { deepDiveKey: "clarity", competencyKey: "evidence.logging_integrity" },
      { deepDiveKey: "structured_execution", competencyKey: "discernment.escalation_boundary" },
    ],
    reviewRubric: EVIDENCE_RUBRIC,
    realStudentDataAllowed: false,
  },
];

function knownCompetency(link: CapabilityPracticalCompetencyLink) {
  const deepDive = getCapabilityDeepDiveBlueprint(link.deepDiveKey);
  return Boolean(deepDive?.competencyKeys.includes(link.competencyKey));
}

export function validateCapabilityPracticalRubric(rubric: CapabilityPracticalReviewRubric) {
  if (!Number.isInteger(rubric.version) || rubric.version < 1) {
    throw new Error("Practical review rubric version must be a positive integer.");
  }
  if (rubric.outcomeRuleVersion !== 1) {
    throw new Error("Unsupported practical review outcome rule version.");
  }
  if (rubric.criteria.length < 5) {
    throw new Error("Practical review rubric must contain at least five observable criteria.");
  }

  const keys = rubric.criteria.map((criterion) => criterion.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Practical review rubric contains duplicate criterion keys.");
  }
  const knownSandboxMockCriteria = new Set(SANDBOX_MOCK_CRITERIA.map((criterion) => criterion.key));

  for (const criterion of rubric.criteria) {
    if (!criterion.key.trim() || !criterion.label.trim() || !criterion.observableStandard.trim()) {
      throw new Error("Practical review criteria require key, label, and observable standard.");
    }
    if (!criterion.clearAnchor.trim() || !criterion.partialAnchor.trim() || !criterion.failAnchor.trim()) {
      throw new Error(`Practical review criterion ${criterion.key} requires Clear, Partial, and Fail anchors.`);
    }
    if (!criterion.competencyLinks.length || criterion.competencyLinks.some((link) => !knownCompetency(link))) {
      throw new Error(`Practical review criterion ${criterion.key} references an unknown RI competency.`);
    }

    for (const link of criterion.criticalBoundaryLinks) {
      const deepDive = getCapabilityDeepDiveBlueprint(link.deepDiveKey);
      if (!deepDive?.criticalBoundaries.some((boundary) => boundary.key === link.boundaryKey)) {
        throw new Error(`Practical review criterion ${criterion.key} references unknown RI critical boundary ${link.deepDiveKey}:${link.boundaryKey}.`);
      }
    }
    if (criterion.criticalOnFail && criterion.criticalBoundaryLinks.length === 0) {
      throw new Error(`Practical review criterion ${criterion.key} is critical but has no canonical RI boundary lineage.`);
    }
    if (!criterion.sandboxMockCriteria.length) {
      throw new Error(`Practical review criterion ${criterion.key} must support at least one Sandbox Mock criterion.`);
    }
    if (criterion.sandboxMockCriteria.some((key) => !knownSandboxMockCriteria.has(key))) {
      throw new Error(`Practical review criterion ${criterion.key} references an unknown Sandbox Mock criterion.`);
    }
  }

  return rubric;
}

export function snapshotCapabilityPracticalRubric(rubric: CapabilityPracticalReviewRubric) {
  validateCapabilityPracticalRubric(rubric);
  return JSON.parse(JSON.stringify(rubric)) as CapabilityPracticalReviewRubric;
}

export function deriveCapabilityPracticalReview(
  rubric: CapabilityPracticalReviewRubric,
  inputs: CapabilityPracticalCriterionReviewInput[],
): CapabilityPracticalDerivedReview {
  validateCapabilityPracticalRubric(rubric);

  if (inputs.length !== rubric.criteria.length) {
    throw new Error(`Expected ${rubric.criteria.length} practical rubric judgments, received ${inputs.length}.`);
  }

  const inputMap = new Map<string, CapabilityPracticalCriterionReviewInput>();
  for (const input of inputs) {
    if (inputMap.has(input.criterionKey)) {
      throw new Error(`Duplicate practical rubric judgment: ${input.criterionKey}.`);
    }
    inputMap.set(input.criterionKey, input);
  }

  const criterionReviews = rubric.criteria.map((criterion) => {
    const input = inputMap.get(criterion.key);
    if (!input) throw new Error(`Missing practical rubric judgment: ${criterion.key}.`);
    if (!new Set<CapabilityPracticalCriterionJudgment>(["clear", "partial", "fail"]).has(input.judgment)) {
      throw new Error(`Invalid practical rubric judgment for ${criterion.key}.`);
    }

    const evidenceNote = String(input.evidenceNote || "").trim() || null;
    if (input.judgment !== "clear" && (!evidenceNote || evidenceNote.length < 20)) {
      throw new Error(`Practical rubric ${criterion.key} requires at least 20 characters of evidence for Partial or Fail.`);
    }

    return {
      criterionKey: criterion.key,
      judgment: input.judgment,
      evidenceNote,
    } satisfies CapabilityPracticalCriterionReview;
  });

  const clearCount = criterionReviews.filter((entry) => entry.judgment === "clear").length;
  const partialCount = criterionReviews.filter((entry) => entry.judgment === "partial").length;
  const failCount = criterionReviews.filter((entry) => entry.judgment === "fail").length;
  const criticalFailCriterionKeys = rubric.criteria
    .filter((criterion) => criterion.criticalOnFail)
    .filter((criterion) => inputMap.get(criterion.key)?.judgment === "fail")
    .map((criterion) => criterion.key);
  const criticalFailCount = criticalFailCriterionKeys.length;

  const outcome: CapabilityPracticalReviewOutcome = criticalFailCount > 0
    ? "integrity_review"
    : partialCount > 0 || failCount > 0
      ? "repeat_required"
      : "approved";
  const reasonCode: CapabilityPracticalDerivedReview["reasonCode"] = criticalFailCount > 0
    ? "rubric_critical_fail"
    : outcome === "repeat_required"
      ? "rubric_repeat_required"
      : "rubric_clear";

  return {
    outcome,
    reasonCode,
    rubricVersion: rubric.version,
    outcomeRuleVersion: rubric.outcomeRuleVersion,
    clearCount,
    partialCount,
    failCount,
    criticalFailCount,
    criticalFailCriterionKeys,
    criterionReviews,
  };
}

export function getCapabilityPracticalProofDefinition(key: string) {
  return CAPABILITY_PRACTICAL_PROOFS.find((proof) => proof.key === key) || null;
}
