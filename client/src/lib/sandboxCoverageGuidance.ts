export type SandboxCoverageGuidance = {
  whatToDo: string;
  whatCounts: string;
};

export function getSandboxCoverageGuidance(category: string): SandboxCoverageGuidance {
  if (category === "Preparation contexts") {
    return {
      whatToDo: "Complete the pre-session preparation confirmation in the Sandbox flow, then finish the linked Training session.",
      whatCounts: "A completed session confirms preparation was completed before the session began. That saved preparation evidence should count for this context; no separate post-session confirmation is needed. If it remains at 0, inspect the completed session's evidence link rather than asking the Specialist to repeat preparation.",
    };
  }
  if (category === "Operating modes") {
    return {
      whatToDo: "Open Sandbox Training in the operating mode named above and complete the guided session.",
      whatCounts: "The opportunity counts when the completed session's saved evidence meets this requirement's governed criteria.",
    };
  }
  return {
    whatToDo: "Complete the guided Sandbox Training opportunity for the response situation named above and record the requested response evidence.",
    whatCounts: "The opportunity counts when the completed session's saved evidence meets this requirement's governed criteria. A single opportunity may contribute to more than one requirement.",
  };
}
