import assert from "node:assert/strict";
import test from "node:test";
import {
  DIAGNOSIS_PROBES,
  evaluateEvidenceCompleteDiagnosis,
  type DiagnosisBehaviorClass,
  type DiagnosisProbeId,
} from "./evidenceCompleteDiagnosis";
import { DIAGNOSIS_OBSERVATION_MATRIX } from "./diagnosisObservationMatrix";
import {
  buildSandboxDiagnosisProbeResult,
  compareSandboxDiagnosisDecisions,
  compareSandboxDiagnosisProbe,
  rebuildSandboxDiagnosisState,
  selectSandboxDiagnosisOutcome,
  validateSandboxDiagnosisOutcomeDefinition,
  type SandboxDiagnosisOutcomeDefinition,
} from "./sandboxDiagnosisEnvironment";

const outcomeFor = (
  probeId: DiagnosisProbeId,
  key: string,
  behaviorClass: DiagnosisBehaviorClass = "supported",
  challenge: SandboxDiagnosisOutcomeDefinition["challengeCapabilities"] = [],
): SandboxDiagnosisOutcomeDefinition => {
  const probe = DIAGNOSIS_PROBES[probeId];
  return {
    key,
    version: 1,
    probeId,
    studentBehavior: "The simulated student gives a coherent observable diagnosis response.",
    canonicalObservations: probe.dimensions.map((dimensionId) => {
      const option =
        DIAGNOSIS_OBSERVATION_MATRIX[dimensionId].options.find(
          (candidate) => candidate.behaviorClass === behaviorClass,
        ) ||
        DIAGNOSIS_OBSERVATION_MATRIX[dimensionId].options.find(
          (candidate) => candidate.behaviorClass === "supported",
        )!;
      return { dimensionId, behaviorId: option.id };
    }),
    trajectoryClass: behaviorClass,
    weight: 1,
    simulatedElapsedSeconds: 48,
    challengeCapabilities: challenge,
    allowedStartingPhases: ["Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability"],
  };
};

test("Sandbox diagnosis outcome is bound to the live evidence-complete probe dimensions", () => {
  const outcome = outcomeFor("clarity.recognition", "clarity-clean");
  assert.doesNotThrow(() => validateSandboxDiagnosisOutcomeDefinition(outcome));
  const broken = {
    ...outcome,
    canonicalObservations: outcome.canonicalObservations.slice(1),
  };
  assert.throws(() => validateSandboxDiagnosisOutcomeDefinition(broken));
});

test("Sandbox diagnosis selector prioritizes the earliest unsupported capability when plausible", () => {
  const plain = outcomeFor("clarity.recognition", "plain");
  const target = outcomeFor(
    "clarity.recognition",
    "target",
    "conditional",
    ["observation_integrity"],
  );
  const context = {
    startingPhase: "Clarity" as const,
    probeId: "clarity.recognition" as const,
    sequenceNumber: 2,
    earliestUnsupportedCapability: "observation_integrity" as const,
    recentOutcomeKeys: [] as string[],
  };
  const a = selectSandboxDiagnosisOutcome({
    seed: "fixed-seed",
    outcomes: [plain, target],
    context,
  });
  const b = selectSandboxDiagnosisOutcome({
    seed: "fixed-seed",
    outcomes: [plain, target],
    context,
  });
  assert.equal(a.key, "target");
  assert.equal(b.key, "target");
});

test("Sandbox diagnosis comparison separates condition and observation truth", () => {
  const outcome = outcomeFor("clarity.recognition", "clarity-clean");
  const correct = compareSandboxDiagnosisProbe({
    sequenceNumber: 1,
    sessionNumber: 2,
    phase: "Clarity",
    outcome,
    submitted: {
      probeId: outcome.probeId,
      observations: outcome.canonicalObservations,
      supportEvent: "none",
    },
  });
  assert.equal(correct.observationExact, true);
  assert.equal(correct.conditionConformed, true);

  const contaminated = compareSandboxDiagnosisProbe({
    sequenceNumber: 1,
    sessionNumber: 2,
    phase: "Clarity",
    outcome,
    submitted: {
      probeId: outcome.probeId,
      observations: outcome.canonicalObservations,
      supportEvent: "teaching",
    },
  });
  assert.equal(contaminated.conditionConformed, false);
  assert.equal(
    contaminated.capabilityEvidence.find((item) => item.layer === "condition_integrity")
      ?.evidenceClass,
    "breakdown",
  );
});

test("Sandbox diagnosis baseline timing is system-owned and can drive evidence-complete diagnosis", () => {
  const first = outcomeFor("stack.normal_independent", "normal-1", "supported");
  const second = outcomeFor("execution.repeatability", "repeat-1", "supported");

  const firstResult = buildSandboxDiagnosisProbeResult({
    outcome: first,
    observations: first.canonicalObservations,
    supportEvent: "none",
    sequenceNumber: 1,
    timingBaselineSeconds: null,
  });
  assert.ok(firstResult.passiveTiming);
  assert.equal(firstResult.passiveTiming?.elapsedMs, 48000);

  let state = rebuildSandboxDiagnosisState({
    startingPhase: "Structured Execution",
    history: [firstResult],
  });
  let decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, false);
  assert.equal(decision.nextProbeId, "execution.repeatability");

  const secondResult = buildSandboxDiagnosisProbeResult({
    outcome: second,
    observations: second.canonicalObservations,
    supportEvent: "none",
    sequenceNumber: 2,
    timingBaselineSeconds: decision.timingBaseline.baselineSeconds,
  });
  state = rebuildSandboxDiagnosisState({
    startingPhase: "Structured Execution",
    history: [firstResult, secondResult],
  });
  decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.ok(decision.timingBaseline.sampleCount >= 1);
});

test("Sandbox targeted diagnosis authority detects Specialist placement divergence", () => {
  const canonicalOutcome = outcomeFor("clarity.recognition", "clarity-break", "breakdown");
  const specialistOutcome = outcomeFor("clarity.recognition", "clarity-clean", "supported");

  const canonicalResult = buildSandboxDiagnosisProbeResult({
    outcome: canonicalOutcome,
    observations: canonicalOutcome.canonicalObservations,
    supportEvent: "none",
    sequenceNumber: 1,
    timingBaselineSeconds: null,
  });
  const specialistResult = buildSandboxDiagnosisProbeResult({
    outcome: canonicalOutcome,
    observations: specialistOutcome.canonicalObservations,
    supportEvent: "none",
    sequenceNumber: 1,
    timingBaselineSeconds: null,
  });

  const canonicalState = rebuildSandboxDiagnosisState({
    startingPhase: "Clarity",
    history: [canonicalResult],
  });
  const specialistState = rebuildSandboxDiagnosisState({
    startingPhase: "Clarity",
    history: [specialistResult],
  });
  const comparison = compareSandboxDiagnosisDecisions({
    canonicalState,
    specialistState,
    sequenceNumber: 1,
    sessionNumber: 3,
    phase: "Clarity",
    probeId: "clarity.recognition",
  });
  assert.equal(comparison.canonicalDecision.complete, true);
  assert.equal(comparison.canonicalDecision.placementPhase, "Clarity");
  assert.equal(comparison.authorityAligned, false);
  assert.equal(
    comparison.capabilityEvidence.find((item) => item.layer === "authority_integrity")
      ?.evidenceClass,
    "breakdown",
  );
});
