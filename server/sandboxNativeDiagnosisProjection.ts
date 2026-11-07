import type { SandboxDiagnosisOutcomeDefinition } from "../shared/sandboxDiagnosisEnvironment";
import { DIAGNOSIS_OBSERVATION_MATRIX, getDiagnosisObservationOption } from "../shared/diagnosisObservationMatrix";

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
  // V2 Untimed Challenge outcomes are authored as complete, continuous
  // narratives. Their structured observations are not appended as a checklist.
  // Other probes retain the evidence-complete projection: every observed
  // dimension must be represented in prose or a semantically equivalent clause.
  const authoredContinuousScenario =
    outcome.probeId === "stack.challenge_no_timer" && outcome.version >= 2;
  const details = authoredContinuousScenario ? [] : canonicalObservations.flatMap(observation => {
    if (independentOnly && (observation.dimensionId === "clarity.vocabulary" ||
      observation.dimensionId === "clarity.reason")) return [];
    const option = getDiagnosisObservationOption(observation.dimensionId, observation.behaviorId);
    if (!option) throw new Error("Native Sandbox response has unknown observation truth.");
    return [`${DIAGNOSIS_OBSERVATION_MATRIX[observation.dimensionId].label}: ${option.detail}`];
  });
  return {
    ...outcome,
    canonicalObservations,
    studentBehavior: [
      outcome.studentBehavior,
      ...(independentOnly ? ["This independent-solving protocol does not ask the student to name the mathematical features or explain why the method fits; neither is established by the working alone."] : []),
      ...details,
    ].join("\n\n"),
  };
}
