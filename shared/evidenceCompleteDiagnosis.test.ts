import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvidenceCompleteDiagnosisState,
  evaluateEvidenceCompleteDiagnosis,
  recordEvidenceCompleteDiagnosisProbe,
  type DiagnosisDimensionId,
  type DiagnosisProbeId,
} from "./evidenceCompleteDiagnosis";
import {
  DIAGNOSIS_OBSERVATION_MATRIX,
  type DiagnosisBehaviorClass,
} from "./diagnosisObservationMatrix";

const behavior = (
  values: Partial<Record<DiagnosisDimensionId, string>>,
) =>
  Object.entries(values).map(([dimensionId, behaviorId]) => ({
    dimensionId: dimensionId as DiagnosisDimensionId,
    behaviorId: String(behaviorId),
  }));

const claritySupported = {
  "clarity.vocabulary": "accurate_recognition",
  "clarity.method": "correct_method_cleanly",
  "clarity.reason": "clear_reason",
  "clarity.immediate_apply": "engages_cleanly",
} as const;

const executionImmediateSupported = {
  "execution.start": "valid_independent_start",
  "execution.step_discipline": "structure_maintained",
  "execution.independence": "independent_throughout",
} as const;

const executionSupported = {
  ...executionImmediateSupported,
  "execution.repeatability": "repeat_clean",
} as const;

const difficultySupported = {
  "difficulty.initial_response": "controlled_attempt",
  "difficulty.first_step_control": "controlled_independent_step",
  "difficulty.tolerance": "holds_and_recovers",
  "difficulty.rescue_dependence": "no_rescue",
} as const;

const timeSupported = {
  "time.start": "timed_controlled_start",
  "time.structure": "timed_structure_maintained",
  "time.pace": "controlled_pace",
  "time.completion_integrity": "complete_with_structure",
} as const;

function run(
  state: ReturnType<typeof createEvidenceCompleteDiagnosisState>,
  probeId: DiagnosisProbeId,
  values: Partial<Record<DiagnosisDimensionId, string>>,
  supportEvent: "none" | "teaching" = "none",
) {
  return recordEvidenceCompleteDiagnosisProbe(state, {
    probeId,
    observations: behavior(values),
    supportEvent,
  });
}

test("every dimension exposes concrete decision-relevant behavior options", () => {
  for (const definition of Object.values(DIAGNOSIS_OBSERVATION_MATRIX)) {
    const ids = new Set(definition.options.map((item) => item.id));
    const classes = new Set<DiagnosisBehaviorClass>(
      definition.options.map((item) => item.behaviorClass),
    );
    assert.equal(ids.size, definition.options.length);
    assert.ok(classes.has("breakdown"));
    assert.ok(classes.has("conditional"));
    assert.ok(classes.has("near_stable"));
    assert.ok(classes.has("supported"));
    assert.ok(classes.has("not_observed"));
    assert.ok(classes.has("confounded"));
  }
});

test("no starting signal uses a neutral independent baseline", () => {
  const decision = evaluateEvidenceCompleteDiagnosis(
    createEvidenceCompleteDiagnosisState(null),
  );
  assert.equal(decision.nextProbeId, "stack.normal_independent");
  assert.match(decision.reason, /No starting signal/);
});

test("starting signals route the first question but do not decide placement", () => {
  assert.equal(
    evaluateEvidenceCompleteDiagnosis(
      createEvidenceCompleteDiagnosisState("Clarity"),
    ).nextProbeId,
    "clarity.recognition",
  );
  assert.equal(
    evaluateEvidenceCompleteDiagnosis(
      createEvidenceCompleteDiagnosisState("Time Pressure Stability"),
    ).nextProbeId,
    "stack.timed_challenge",
  );
});

test("decisive clarity breakdown places Low from behavior, not a score", () => {
  let state = createEvidenceCompleteDiagnosisState("Clarity");
  state = run(state, "clarity.recognition", {
    "clarity.vocabulary": "no_recognition",
    "clarity.method": "no_method",
    "clarity.reason": "no_reason",
    "clarity.immediate_apply": "cannot_engage",
  });

  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, true);
  assert.equal(decision.placementPhase, "Clarity");
  assert.equal(decision.stability, "Low");
  assert.equal(decision.decisionAuthority, "behavioral_evidence");
  assert.equal("score" in (decision.phaseStates[0] as any), false);
});

test("conditional behavior derives Medium without numeric thresholds", () => {
  let state = createEvidenceCompleteDiagnosisState("Clarity");
  state = run(state, "clarity.recognition", {
    ...claritySupported,
    "clarity.reason": "partial_reason",
  });

  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.placementPhase, "Clarity");
  assert.equal(decision.stability, "Medium");
});

test("near-stable behavior derives High without numeric thresholds", () => {
  let state = createEvidenceCompleteDiagnosisState("Clarity");
  state = run(state, "clarity.recognition", {
    ...claritySupported,
    "clarity.reason": "correct_reason_imprecise",
  });

  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.placementPhase, "Clarity");
  assert.equal(decision.stability, "High");
});

test("not observed remains unresolved and is never converted into weakness", () => {
  let state = createEvidenceCompleteDiagnosisState("Clarity");
  state = run(state, "clarity.recognition", {
    ...claritySupported,
    "clarity.reason": "not_observed",
  });

  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, false);
  assert.equal(decision.placementPhase, null);
  assert.equal(decision.nextProbeId, "clarity.recognition");
});

test("teaching-contaminated behavior cannot determine placement", () => {
  let state = createEvidenceCompleteDiagnosisState("Clarity");
  state = run(
    state,
    "clarity.recognition",
    {
      "clarity.vocabulary": "no_recognition",
      "clarity.method": "no_method",
      "clarity.reason": "no_reason",
      "clarity.immediate_apply": "cannot_engage",
    },
    "teaching",
  );

  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, false);
  assert.equal(decision.placementPhase, null);
  assert.equal(decision.nextProbeId, "clarity.recognition");
  assert.equal(decision.contaminatedProbeCount, 1);
});

test("one execution opportunity cannot claim repeatability", () => {
  let state = createEvidenceCompleteDiagnosisState("Structured Execution");
  state = run(state, "stack.normal_independent", {
    ...claritySupported,
    ...executionImmediateSupported,
  });

  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, false);
  assert.equal(decision.nextProbeId, "execution.repeatability");
});

test("repeatability behavior can place Structured Execution at High", () => {
  let state = createEvidenceCompleteDiagnosisState("Structured Execution");
  state = run(state, "stack.normal_independent", {
    ...claritySupported,
    ...executionImmediateSupported,
  });
  state = run(state, "execution.repeatability", {
    ...executionImmediateSupported,
    "execution.repeatability": "repeat_with_minor_drift",
  });

  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, true);
  assert.equal(decision.placementPhase, "Structured Execution");
  assert.equal(decision.stability, "High");
});

test("timed failure does not automatically condemn lower phases", () => {
  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");
  state = run(state, "stack.timed_challenge", {
    ...claritySupported,
    ...executionImmediateSupported,
    ...difficultySupported,
    "time.start": "timed_freeze",
    "time.structure": "timed_structure_collapse",
    "time.pace": "panic_pace",
    "time.completion_integrity": "timed_non_completion",
  });

  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, false);
  assert.equal(decision.placementPhase, null);
  assert.equal(decision.nextProbeId, "execution.repeatability");
});

test("lower-layer confirmation isolates a Time Pressure breakdown", () => {
  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");
  state = run(state, "stack.timed_challenge", {
    ...claritySupported,
    ...executionImmediateSupported,
    ...difficultySupported,
    "time.start": "timed_freeze",
    "time.structure": "timed_structure_collapse",
    "time.pace": "panic_pace",
    "time.completion_integrity": "timed_non_completion",
  });
  state = run(state, "execution.repeatability", executionSupported);
  state = run(state, "difficulty.recovery", difficultySupported);

  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, true);
  assert.equal(decision.placementPhase, "Time Pressure Stability");
  assert.equal(decision.stability, "Low");
});

test("all-clear diagnosis requires repeated temporal evidence and never mints High Maintenance", () => {
  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");
  state = run(state, "stack.timed_challenge", {
    ...claritySupported,
    ...executionImmediateSupported,
    ...difficultySupported,
    ...timeSupported,
  });
  state = run(state, "execution.repeatability", executionSupported);
  state = run(state, "difficulty.recovery", difficultySupported);

  assert.equal(
    evaluateEvidenceCompleteDiagnosis(state).nextProbeId,
    "time.consistency",
  );

  state = run(state, "time.consistency", timeSupported);
  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, true);
  assert.equal(decision.placementPhase, "Time Pressure Stability");
  assert.equal(decision.stability, "High");
});
