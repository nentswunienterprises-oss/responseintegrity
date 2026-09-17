import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvidenceCompleteDiagnosisState,
  evaluateEvidenceCompleteDiagnosis,
  recordEvidenceCompleteDiagnosisProbe,
  type DiagnosisDimensionId,
  type DiagnosisObservationLevel,
  type DiagnosisProbeId,
} from "./evidenceCompleteDiagnosis";

const levels = (values: Partial<Record<DiagnosisDimensionId, DiagnosisObservationLevel>>) =>
  Object.entries(values).map(([dimensionId, level]) => ({
    dimensionId: dimensionId as DiagnosisDimensionId,
    level: level as DiagnosisObservationLevel,
  }));

const clarityClear = {
  "clarity.vocabulary": "clear",
  "clarity.method": "clear",
  "clarity.reason": "clear",
  "clarity.immediate_apply": "clear",
} as const;
const executionClear = {
  "execution.start": "clear",
  "execution.step_discipline": "clear",
  "execution.repeatability": "clear",
  "execution.independence": "clear",
} as const;
const difficultyClear = {
  "difficulty.initial_response": "clear",
  "difficulty.first_step_control": "clear",
  "difficulty.tolerance": "clear",
  "difficulty.rescue_dependence": "clear",
} as const;
const timeClear = {
  "time.start": "clear",
  "time.structure": "clear",
  "time.pace": "clear",
  "time.completion_integrity": "clear",
} as const;

function run(
  state: ReturnType<typeof createEvidenceCompleteDiagnosisState>,
  probeId: DiagnosisProbeId,
  values: Partial<Record<DiagnosisDimensionId, DiagnosisObservationLevel>>,
  supportEvent: "none" | "teaching" = "none",
) {
  return recordEvidenceCompleteDiagnosisProbe(state, {
    probeId,
    observations: levels(values),
    supportEvent,
  });
}

test("starts at the probe matching the system recommendation", () => {
  assert.equal(
    evaluateEvidenceCompleteDiagnosis(createEvidenceCompleteDiagnosisState("Clarity")).nextProbeId,
    "clarity.recognition",
  );
  assert.equal(
    evaluateEvidenceCompleteDiagnosis(createEvidenceCompleteDiagnosisState("Time Pressure Stability")).nextProbeId,
    "stack.timed_challenge",
  );
});

test("decisive clean clarity breakdown can finish after one opportunity", () => {
  let state = createEvidenceCompleteDiagnosisState("Clarity");
  state = run(state, "clarity.recognition", {
    "clarity.vocabulary": "weak",
    "clarity.method": "weak",
    "clarity.reason": "partial",
    "clarity.immediate_apply": "weak",
  });
  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, true);
  assert.equal(decision.placementPhase, "Clarity");
  assert.equal(decision.stability, "Low");
});

test("diagnosis is not structurally wired to Medium", () => {
  let medium = createEvidenceCompleteDiagnosisState("Clarity");
  medium = run(medium, "clarity.recognition", {
    "clarity.vocabulary": "partial",
    "clarity.method": "partial",
    "clarity.reason": "partial",
    "clarity.immediate_apply": "partial",
  });
  assert.equal(evaluateEvidenceCompleteDiagnosis(medium).stability, "Medium");

  let high = createEvidenceCompleteDiagnosisState("Controlled Discomfort");
  high = run(high, "stack.challenge_no_timer", {
    ...clarityClear,
    ...executionClear,
    "difficulty.initial_response": "clear",
    "difficulty.first_step_control": "clear",
    "difficulty.tolerance": "partial",
    "difficulty.rescue_dependence": "clear",
  });
  high = run(high, "execution.repeatability", { ...executionClear });
  const highDecision = evaluateEvidenceCompleteDiagnosis(high);
  assert.equal(highDecision.placementPhase, "Controlled Discomfort");
  assert.equal(highDecision.stability, "High");
});

test("one clean execution response cannot prove repeatability", () => {
  let state = createEvidenceCompleteDiagnosisState("Structured Execution");
  state = run(state, "stack.normal_independent", { ...clarityClear, ...executionClear });
  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, false);
  assert.equal(decision.nextProbeId, "execution.repeatability");
});

test("timed failure does not automatically condemn lower phases", () => {
  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");
  state = run(state, "stack.timed_challenge", {
    ...clarityClear,
    ...executionClear,
    ...difficultyClear,
    "time.start": "weak",
    "time.structure": "weak",
    "time.pace": "weak",
    "time.completion_integrity": "weak",
  });
  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, false);
  assert.equal(decision.nextProbeId, "execution.repeatability");
});

test("after lower layers are supported, timed breakdown places Time Pressure Stability", () => {
  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");
  state = run(state, "stack.timed_challenge", {
    ...clarityClear,
    ...executionClear,
    ...difficultyClear,
    "time.start": "weak",
    "time.structure": "partial",
    "time.pace": "weak",
    "time.completion_integrity": "partial",
  });
  state = run(state, "execution.repeatability", { ...executionClear });
  state = run(state, "difficulty.recovery", { ...difficultyClear });
  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, true);
  assert.equal(decision.placementPhase, "Time Pressure Stability");
  assert.equal(decision.stability, "Low");
});

test("all-clear response still requires temporal confirmation before High time placement", () => {
  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");
  state = run(state, "stack.timed_challenge", {
    ...clarityClear,
    ...executionClear,
    ...difficultyClear,
    ...timeClear,
  });
  state = run(state, "execution.repeatability", { ...executionClear });
  state = run(state, "difficulty.recovery", { ...difficultyClear });
  assert.equal(evaluateEvidenceCompleteDiagnosis(state).nextProbeId, "time.consistency");

  state = run(state, "time.consistency", { ...timeClear });
  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, true);
  assert.equal(decision.placementPhase, "Time Pressure Stability");
  assert.equal(decision.stability, "High");
});

test("teaching-contaminated observations cannot determine placement", () => {
  let state = createEvidenceCompleteDiagnosisState("Clarity");
  state = run(state, "clarity.recognition", {
    "clarity.vocabulary": "weak",
    "clarity.method": "weak",
    "clarity.reason": "weak",
    "clarity.immediate_apply": "weak",
  }, "teaching");
  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, false);
  assert.equal(decision.placementPhase, null);
  assert.equal(decision.nextProbeId, "clarity.recognition");
  assert.equal(decision.contaminatedProbeCount, 1);
});
