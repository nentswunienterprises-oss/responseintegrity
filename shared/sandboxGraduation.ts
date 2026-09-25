import { PHASES, type TopicPhase } from "./topicConditioningEngine";

export type SandboxGraduationPolicyStatus = "candidate" | "approved";

export type SandboxGraduationPolicy = {
  policyVersion: number;
  status: SandboxGraduationPolicyStatus;
  minimumObservationFidelityPercent: number;
  requireSystemOutcomeMatch: boolean;
  requiredDistinctPassesByPhase: Record<TopicPhase, number>;
  nextStage: "practicals";
};

export type SandboxGraduationAttempt = {
  scenarioKey: string;
  phase: TopicPhase;
  observationFidelityPercent: number;
  systemOutcomeMatched: boolean;
  passed: boolean;
  completedAt: string;
};

export type SandboxGraduationPhaseStatus = {
  phase: TopicPhase;
  qualifyingDistinctScenarios: number;
  requiredDistinctScenarios: number;
  complete: boolean;
};

export type SandboxGraduationEvaluation = {
  policyStatus: SandboxGraduationPolicyStatus;
  minimumObservationFidelityPercent: number;
  requireSystemOutcomeMatch: boolean;
  evidenceReady: boolean;
  practicalsReady: boolean;
  automaticTransition: false;
  nextStage: "practicals";
  qualifyingDistinctScenarios: number;
  requiredDistinctScenarios: number;
  phases: SandboxGraduationPhaseStatus[];
  reason: string;
};

const isTopicPhase = (value: string): value is TopicPhase =>
  (PHASES as readonly string[]).includes(value);

export function parseSandboxGraduationPolicy(value: unknown): SandboxGraduationPolicy {
  const candidate = (typeof value === "string" ? JSON.parse(value) : value) as Partial<SandboxGraduationPolicy>;
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Sandbox graduation policy must be an object.");
  }
  if (!Number.isInteger(candidate.policyVersion) || Number(candidate.policyVersion) < 1) {
    throw new Error("Sandbox graduation policy version must be a positive integer.");
  }
  if (candidate.status !== "candidate" && candidate.status !== "approved") {
    throw new Error("Sandbox graduation policy status is invalid.");
  }
  const minimum = Number(candidate.minimumObservationFidelityPercent);
  if (!Number.isFinite(minimum) || minimum <= 0 || minimum > 100) {
    throw new Error("Sandbox graduation minimum observation fidelity must be between 0 and 100.");
  }
  if (typeof candidate.requireSystemOutcomeMatch !== "boolean") {
    throw new Error("Sandbox graduation system-outcome requirement must be explicit.");
  }
  if (candidate.nextStage !== "practicals") {
    throw new Error("Sandbox graduation may only open Practicals.");
  }

  const required = candidate.requiredDistinctPassesByPhase as Record<string, unknown> | undefined;
  if (!required) throw new Error("Sandbox graduation phase coverage is required.");

  const normalized = Object.fromEntries(
    PHASES.map((phase) => {
      const count = Number(required[phase]);
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`Sandbox graduation requires a positive distinct-pass count for ${phase}.`);
      }
      return [phase, count];
    }),
  ) as Record<TopicPhase, number>;

  return {
    policyVersion: Number(candidate.policyVersion),
    status: candidate.status,
    minimumObservationFidelityPercent: minimum,
    requireSystemOutcomeMatch: candidate.requireSystemOutcomeMatch,
    requiredDistinctPassesByPhase: normalized,
    nextStage: "practicals",
  };
}

export function evaluateSandboxGraduation(
  policyInput: SandboxGraduationPolicy,
  attempts: SandboxGraduationAttempt[],
): SandboxGraduationEvaluation {
  const policy = parseSandboxGraduationPolicy(policyInput);
  const qualifiedByPhase = new Map<TopicPhase, Set<string>>(
    PHASES.map((phase) => [phase, new Set<string>()]),
  );

  for (const attempt of attempts) {
    if (!isTopicPhase(String(attempt.phase))) continue;
    if (!attempt.passed) continue;
    if (attempt.observationFidelityPercent < policy.minimumObservationFidelityPercent) continue;
    if (policy.requireSystemOutcomeMatch && !attempt.systemOutcomeMatched) continue;
    qualifiedByPhase.get(attempt.phase)!.add(attempt.scenarioKey);
  }

  const phases = PHASES.map((phase) => {
    const qualifyingDistinctScenarios = qualifiedByPhase.get(phase)!.size;
    const requiredDistinctScenarios = policy.requiredDistinctPassesByPhase[phase];
    return {
      phase,
      qualifyingDistinctScenarios,
      requiredDistinctScenarios,
      complete: qualifyingDistinctScenarios >= requiredDistinctScenarios,
    };
  });

  const evidenceReady = phases.every((phase) => phase.complete);
  const practicalsReady = evidenceReady && policy.status === "approved";
  const qualifyingDistinctScenarios = phases.reduce(
    (sum, phase) => sum + Math.min(phase.qualifyingDistinctScenarios, phase.requiredDistinctScenarios),
    0,
  );
  const requiredDistinctScenarios = phases.reduce(
    (sum, phase) => sum + phase.requiredDistinctScenarios,
    0,
  );

  return {
    policyStatus: policy.status,
    minimumObservationFidelityPercent: policy.minimumObservationFidelityPercent,
    requireSystemOutcomeMatch: policy.requireSystemOutcomeMatch,
    evidenceReady,
    practicalsReady,
    automaticTransition: false,
    nextStage: "practicals",
    qualifyingDistinctScenarios,
    requiredDistinctScenarios,
    phases,
    reason: practicalsReady
      ? "Sandbox evidence satisfies the approved graduation policy. Practicals may be opened through the stage-control workflow."
      : evidenceReady
        ? "Sandbox evidence satisfies the candidate graduation standard, but the policy is not yet approved for stage progression."
        : "More distinct clean Sandbox scenarios are required across the RI phases.",
  };
}
