export const SANDBOX_REQUIRED_ACCOUNT_COUNT = 6;

export const SANDBOX_MOCK_CRITERIA = [
  {
    key: "system_direction_followed",
    label: "Followed the system-directed session flow without replacing it with free-form tutoring",
  },
  {
    key: "phase_constraints_preserved",
    label: "Preserved the active phase, drill, set, and rep constraints throughout the mock",
  },
  {
    key: "evidence_captured",
    label: "Captured complete observation evidence without invention, smoothing, or unsupported interpretation",
  },
  {
    key: "student_response_managed",
    label: "Managed difficulty and support boundaries without contaminating the response being tested",
  },
  {
    key: "system_result_respected",
    label: "Accepted the deterministic result and next action without manually manufacturing progression",
  },
] as const;

export type SandboxMockCriterionKey = (typeof SANDBOX_MOCK_CRITERIA)[number]["key"];
export type SandboxMockDecision = "passed" | "remediation_required";

export type SandboxMockChecklist = Record<SandboxMockCriterionKey, boolean>;

export interface SandboxMockAssessment {
  id: string;
  tutorId: string;
  tutorAssignmentId: string;
  decision: SandboxMockDecision;
  checklist: SandboxMockChecklist;
  evidenceNote: string;
  assessedByUserId: string;
  assessedAt: string;
}

export interface SandboxReadinessGate {
  readyForTrial: boolean;
  blockers: string[];
}

export function createEmptySandboxMockChecklist(): SandboxMockChecklist {
  return Object.fromEntries(
    SANDBOX_MOCK_CRITERIA.map((criterion) => [criterion.key, false]),
  ) as SandboxMockChecklist;
}

export function normalizeSandboxMockChecklist(value: unknown): SandboxMockChecklist {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    SANDBOX_MOCK_CRITERIA.map((criterion) => [criterion.key, raw[criterion.key] === true]),
  ) as SandboxMockChecklist;
}

export function isSandboxMockChecklistComplete(checklist: SandboxMockChecklist) {
  return SANDBOX_MOCK_CRITERIA.every((criterion) => checklist[criterion.key] === true);
}

export function evaluateSandboxReadinessGate({
  docsComplete,
  transformationComplete,
  sessionInfrastructureComplete,
  hasActiveFailHealth,
  sandboxAccountCount,
  latestMockAssessment,
}: {
  docsComplete: boolean;
  transformationComplete: boolean;
  sessionInfrastructureComplete: boolean;
  hasActiveFailHealth: boolean;
  sandboxAccountCount: number;
  latestMockAssessment: Pick<SandboxMockAssessment, "decision" | "checklist"> | null;
}): SandboxReadinessGate {
  const blockers: string[] = [];

  if (!docsComplete) blockers.push("Specialist onboarding documents are incomplete.");
  if (!transformationComplete) blockers.push("Transformation Phases Battle Tests are incomplete.");
  if (!sessionInfrastructureComplete) blockers.push("Session Infrastructure Battle Tests are incomplete.");
  if (hasActiveFailHealth) blockers.push("An active fail or critical-drift condition must be resolved.");
  if (sandboxAccountCount < SANDBOX_REQUIRED_ACCOUNT_COUNT) {
    blockers.push(
      `${SANDBOX_REQUIRED_ACCOUNT_COUNT} Sandbox practice accounts are required; ${Math.max(0, sandboxAccountCount)} are available.`,
    );
  }

  if (!latestMockAssessment) {
    blockers.push("The Sandbox Mock Readiness Gate has not been assessed.");
  } else if (
    latestMockAssessment.decision !== "passed" ||
    !isSandboxMockChecklistComplete(normalizeSandboxMockChecklist(latestMockAssessment.checklist))
  ) {
    blockers.push("The latest Sandbox Mock requires remediation and a new assessment.");
  }

  return { readyForTrial: blockers.length === 0, blockers };
}
