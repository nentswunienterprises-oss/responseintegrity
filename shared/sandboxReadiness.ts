export const SANDBOX_REQUIRED_ACCOUNT_COUNT = 6;

export type SandboxReadinessDecision = "passed" | "remediation_required";

export interface SandboxPreparationGate {
  readyForCapabilityReadiness: boolean;
  blockers: string[];
  nextStage: "practicals";
}

export function evaluateSandboxPreparationGate({
  docsComplete,
  transformationComplete,
  sessionInfrastructureComplete,
  hasActiveFailHealth,
  sandboxAccountCount,
}: {
  docsComplete: boolean;
  transformationComplete: boolean;
  sessionInfrastructureComplete: boolean;
  hasActiveFailHealth: boolean;
  sandboxAccountCount: number;
}): SandboxPreparationGate {
  const blockers: string[] = [];

  if (!docsComplete) {
    blockers.push("Specialist onboarding documents are incomplete.");
  }
  if (!transformationComplete) {
    blockers.push("Transformation Phases Deep Dives are incomplete.");
  }
  if (!sessionInfrastructureComplete) {
    blockers.push("Session Infrastructure Deep Dives are incomplete.");
  }
  if (hasActiveFailHealth) {
    blockers.push("An active fail or critical-drift condition must be resolved.");
  }
  if (sandboxAccountCount < SANDBOX_REQUIRED_ACCOUNT_COUNT) {
    blockers.push(
      `${SANDBOX_REQUIRED_ACCOUNT_COUNT} Sandbox practice accounts are required; ${Math.max(0, sandboxAccountCount)} are available.`,
    );
  }

  return {
    readyForCapabilityReadiness: blockers.length === 0,
    blockers,
    nextStage: "practicals",
  };
}
