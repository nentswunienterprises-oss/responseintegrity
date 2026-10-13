type Assessment = {
  title: string;
  evidenceKind: "mastery" | "retrieval" | "transfer";
  status: "unavailable" | "locked" | "available" | "complete";
  reason: string | null;
  unlockAt: string | null;
};

export function trainingMilestone(
  assessments: Assessment[],
  mode?: string,
  practicals?: { entry: { ready: boolean }; completion: { complete: boolean } },
) {
  if (mode === "certified_live") {
    return "Development milestones complete. Continue Certified Live delivery from your Pod.";
  }
  if (mode === "trial") {
    return "Next development milestone: Certification. Complete the required Trial evidence and family outcome reviews for the COO's certification decision.";
  }
  const next = assessments.find((assessment) => assessment.status !== "complete");
  if (next) {
    if (next.reason === "spacing_interval" && next.unlockAt) {
      return `Next Training milestone: ${next.title}. Opens ${new Date(next.unlockAt).toLocaleString()}.`;
    }
    if (next.status === "unavailable") {
      return `Next Training milestone: ${next.title}. This check is currently unavailable.`;
    }
    if (next.reason === "attempt_limit" || next.reason === "retry_cooldown") {
      return `Next Training milestone: ${next.title}. Check its availability in your Deep Dive before continuing.`;
    }
    return `Next Training milestone: ${next.title}. Complete the required check to continue your development.`;
  }
  if (!assessments.length) return "Your next development milestone will appear when your Training record is available.";
  if (!practicals) return "Training checks complete. Checking your next development milestone…";
  if (practicals.completion.complete) {
    return "Next development milestone: Trial. Your Practicals are approved. Return to your Pod for the governed Trial entry process.";
  }
  return practicals.entry.ready
    ? "Next development milestone: Practicals. Demonstrate Prepare, Execute and Evidence for your assigned TD's review."
    : "Next development milestone: Practicals. Your Training checks are complete. Continue Sandbox until capability readiness and your assigned TD's approval open Practicals.";
}
