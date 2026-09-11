export type CapabilityPracticalProofKey = "prepare" | "execute" | "evidence";
export type CapabilityPracticalArtifactType = "screen_voice" | "screen_video" | "video";
export type CapabilityPracticalReviewStatus = "submitted" | "approved" | "repeat_required" | "integrity_review";

export interface CapabilityPracticalCompetencyLink {
  deepDiveKey: string;
  competencyKey: string;
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
  realStudentDataAllowed: false;
}

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
    realStudentDataAllowed: false,
  },
];

export function getCapabilityPracticalProofDefinition(key: string) {
  return CAPABILITY_PRACTICAL_PROOFS.find((proof) => proof.key === key) || null;
}
