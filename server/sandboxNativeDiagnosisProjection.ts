import type { SandboxDiagnosisOutcomeDefinition } from "../shared/sandboxDiagnosisEnvironment";

// Version the public opportunity as well as its scoring projection. A form
// issued before a protocol correction must not silently acquire new truth.
export const SANDBOX_NATIVE_DIAGNOSIS_PROTOCOL_VERSION = 3;

export function projectSandboxNativeDiagnosisOutcome(
  outcome: SandboxDiagnosisOutcomeDefinition,
): SandboxDiagnosisOutcomeDefinition {
  const independentOnly = outcome.probeId === "stack.normal_independent";
  const canonicalObservations = outcome.canonicalObservations.map(observation =>
    independentOnly && (observation.dimensionId === "clarity.vocabulary" ||
      observation.dimensionId === "clarity.reason")
      ? { ...observation, behaviorId: "not_observed" }
      : { ...observation },
  );
  // The authored student narrative is the continuous account of what the
  // learner did. Do not turn it into a checklist by appending every dimension's
  // option text: those are structured evidence records, not separate events.
  // Keep the one protocol-specific clarification where the task genuinely
  // does not elicit vocabulary or a spoken reason.
  return {
    ...outcome,
    canonicalObservations,
    studentBehavior: [
      outcome.studentBehavior,
      ...(independentOnly ? ["This independent-solving protocol does not ask the student to name the mathematical features or explain why the method fits; neither is established by the working alone."] : []),
    ].join("\n\n"),
  };
}
