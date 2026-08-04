export interface SandboxGuideStep {
  id: string;
  title: string;
  detail: string;
  actionLabel?: string;
  action?: "student-card" | "assignment" | "identity-sheet" | "proposal" | "topic-conditioning" | "reports" | "communications" | "intro-drill";
}

export function getSandboxGuideSteps(studentName = "this sandbox student"): SandboxGuideStep[] {
  const studentLabel = studentName || "this sandbox student";

  return [
    {
      id: "review-assignment",
      title: "1. Review the assignment as the tutor",
      detail: `Open ${studentLabel}’s card, read the case notes, and confirm you understand the family’s request before you move the workflow forward.`,
      actionLabel: "Open assignment review",
      action: "assignment",
    },
    {
      id: "accept-assignment",
      title: "2. Accept the assignment handoff",
      detail: "Move from review into acceptance so the student is formally handed to you and the onboarding stages can unlock.",
      actionLabel: "Open assignment review",
      action: "assignment",
    },
    {
      id: "sandbox-parent-intro",
      title: "3. Switch to the sandbox parent account",
      detail: "Log in as the sandbox parent, open the parent gateway, and get ready to take the next step from the family side.",
    },
    {
      id: "book-intro-as-parent",
      title: "4. Book the intro session as the parent",
      detail: "From the parent account, propose the intro-session time so the onboarding flow moves from review into actual scheduling.",
    },
    {
      id: "return-as-tutor",
      title: "5. Log back in as the tutor and accept the booking",
      detail: "Return to the tutor view, open the intro-session flow, and accept the parent’s proposed slot so the session can move forward.",
      actionLabel: "Open intro flow",
      action: "intro-drill",
    },
    {
      id: "choose-diagnostic-topic",
      title: "6. Choose the diagnostic topic",
      detail: "Pick the topic that should anchor the first diagnostic conversation so the student is assessed in the right place.",
      actionLabel: "Open topic conditioning",
      action: "topic-conditioning",
    },
    {
      id: "diagnose",
      title: "7. Diagnose the student",
      detail: "Run the diagnostic experience, capture what the student does under pressure, and use that evidence to shape the next move.",
      actionLabel: "Open intro drill",
      action: "intro-drill",
    },
    {
      id: "send-proposal",
      title: "8. Send the parent-facing proposal",
      detail: "Translate the diagnostic result into a proposal that explains the student’s current state and recommended next step.",
      actionLabel: "Open proposal",
      action: "proposal",
    },
    {
      id: "parent-review-proposal",
      title: "9. Switch back to the sandbox parent and review the proposal",
      detail: "Log in as the parent again and view the proposal so you can see the exact family-facing experience.",
    },
    {
      id: "parent-accept-proposal",
      title: "10. Accept the proposal from the parent side",
      detail: "Have the parent accept the proposal so the service can move from assessment into active onboarding.",
    },
    {
      id: "student-login",
      title: "11. Log in as the student",
      detail: "Open the student experience so you understand what the learner sees once the onboarding path is unlocked.",
    },
    {
      id: "parent-book-weekly-sessions",
      title: "12. Log back in as the parent and book training sessions for the week",
      detail: "From the parent account, schedule the training sessions for the upcoming week so the rhythm becomes visible to the family.",
    },
    {
      id: "tutor-run-training-drill",
      title: "13. Log back in as the tutor and run the training drills",
      detail: "Return to the tutor role and run the training drill so the first live coaching moment is delivered in the same order as the sandbox flow.",
      actionLabel: "Open intro drill",
      action: "intro-drill",
    },
  ];
}
