import type {
  SandboxSimulationDefinition,
  SandboxSimulationResult,
} from "@shared/capabilitySandboxSimulation";

export function projectSandboxSimulationForSpecialist(input: {
  definition: SandboxSimulationDefinition;
  simulationFormId: string;
  bankVersion: number;
  attemptNumber: number;
  maxAttempts: number;
}) {
  return {
    key: input.definition.key,
    title: input.definition.title,
    description: input.definition.description,
    passThresholdPercent: input.definition.passThresholdPercent,
    fictionalScenarioConfirmed: true as const,
    totalDecisions: input.definition.decisions.length,
    simulationFormId: input.simulationFormId,
    bankVersion: input.bankVersion,
    attemptNumber: input.attemptNumber,
    maxAttempts: input.maxAttempts,
    decisions: input.definition.decisions.map((decision) => ({
      key: decision.key,
      prompt: decision.prompt,
      kind: decision.kind,
      options: decision.options.map((option) => ({ ...option })),
    })),
  };
}

export function projectSandboxSimulationResultForSpecialist(input: {
  attemptId?: string;
  completedAt: unknown;
  bankVersion: number;
  attemptNumber: number;
  simulationFormId: string;
  result: SandboxSimulationResult;
}) {
  return {
    attemptId: input.attemptId,
    completedAt: input.completedAt,
    bankVersion: input.bankVersion,
    attemptNumber: input.attemptNumber,
    simulationFormId: input.simulationFormId,
    simulationKey: input.result.simulationKey,
    totalDecisions: input.result.totalDecisions,
    correctDecisions: input.result.correctDecisions,
    percent: input.result.percent,
    passed: input.result.passed,
    hasCriticalFail: input.result.hasCriticalFail,
    evidenceContaminationCount: input.result.evidenceContaminationCount,
    authorityViolationCount: input.result.authorityViolationCount,
    escalationFailureCount: input.result.escalationFailureCount,
    authoritative: false as const,
  };
}
