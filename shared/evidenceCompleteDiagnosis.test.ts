import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvidenceCompleteDiagnosisState,
  evaluateEvidenceCompleteDiagnosis,
  getDiagnosisPhaseSupportEvidence,
  recordEvidenceCompleteDiagnosisProbe,
  type DiagnosisDimensionId,
  type DiagnosisProbeId,
} from "./evidenceCompleteDiagnosis";
import {
  DIAGNOSIS_OBSERVATION_MATRIX,
  type DiagnosisBehaviorClass,
} from "./diagnosisObservationMatrix";
import {
  PHASES,
  type TopicPhase,
  type TopicStability,
} from "./topicConditioningEngine";
import {
  buildPassiveExecutionTimingEvidence,
  buildTimedExecutionEvidence,
} from "./tpsTimingContract";

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

const passiveTiming = (seconds = 60) => {
  const startedAt = "2026-09-23T10:00:00.000Z";
  const endedAt = new Date(Date.parse(startedAt) + seconds * 1000).toISOString();
  const timing = buildPassiveExecutionTimingEvidence({ startedAt, endedAt });
  assert.ok(timing);
  return timing;
};

const timedTiming = (prescribedSeconds = 60, elapsedSeconds = 50) => {
  const startedAt = "2026-09-23T10:00:00.000Z";
  const endedAt = new Date(Date.parse(startedAt) + elapsedSeconds * 1000).toISOString();
  const timing = buildTimedExecutionEvidence({
    startedAt,
    endedAt,
    prescribedSeconds,
  });
  assert.ok(timing);
  return timing;
};

function run(
  state: ReturnType<typeof createEvidenceCompleteDiagnosisState>,
  probeId: DiagnosisProbeId,
  values: Partial<Record<DiagnosisDimensionId, string>>,
  supportEvent: "none" | "teaching" = "none",
  elapsedSeconds = 60,
) {
  const baselineProbe =
    probeId === "stack.normal_independent" ||
    probeId === "execution.repeatability";
  const timedProbe =
    probeId === "stack.timed_challenge" || probeId === "time.consistency";
  return recordEvidenceCompleteDiagnosisProbe(state, {
    probeId,
    observations: behavior(values),
    supportEvent,
    ...(baselineProbe ? { passiveTiming: passiveTiming(elapsedSeconds) } : {}),
    ...(timedProbe ? { timedTiming: timedTiming(60, Math.min(elapsedSeconds, 59)) } : {}),
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
  const tpsStart = evaluateEvidenceCompleteDiagnosis(
    createEvidenceCompleteDiagnosisState("Time Pressure Stability"),
  );
  assert.equal(tpsStart.nextProbeId, "stack.normal_independent");
  assert.match(tpsStart.reason, /no arbitrary timer/i);
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

test("Clarity High means near-stable behavior, not fully sustained clarity", () => {
  const definition = DIAGNOSIS_OBSERVATION_MATRIX["clarity.reason"];
  const nearStable = definition.options.find(
    (option) => option.id === "correct_reason_imprecise",
  );

  assert.equal(nearStable?.behaviorClass, "near_stable");
  assert.match(nearStable?.detail || "", /substantially correct/i);
  assert.doesNotMatch(nearStable?.detail || "", /fully clean/i);
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

test("Structured Execution placement does not force completion of the three-sample TPS baseline", () => {
  let state = createEvidenceCompleteDiagnosisState("Structured Execution");
  state = run(state, "stack.normal_independent", {
    ...claritySupported,
    ...executionImmediateSupported,
  }, "none", 61);
  state = run(state, "execution.repeatability", {
    ...executionImmediateSupported,
    "execution.repeatability": "repeat_with_minor_drift",
  }, "none", 63);

  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, true);
  assert.equal(decision.placementPhase, "Structured Execution");
  assert.equal(decision.timingBaseline.sampleCount, 1);
  assert.equal(decision.timingBaseline.ready, false);
});

test("TPS starting signal establishes lower-layer and timing authority before any timed probe", () => {
  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");

  state = run(state, "stack.normal_independent", {
    ...claritySupported,
    ...executionImmediateSupported,
  }, "none", 58);
  assert.equal(evaluateEvidenceCompleteDiagnosis(state).nextProbeId, "execution.repeatability");

  state = run(state, "execution.repeatability", executionSupported, "none", 60);
  assert.equal(evaluateEvidenceCompleteDiagnosis(state).nextProbeId, "stack.challenge_no_timer");

  state = run(state, "stack.challenge_no_timer", {
    ...claritySupported,
    ...executionImmediateSupported,
    ...difficultySupported,
  });
  const beforeThirdBaseline = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(beforeThirdBaseline.nextProbeId, "execution.repeatability");
  assert.equal(beforeThirdBaseline.timingBaseline.sampleCount, 2);
  assert.equal(beforeThirdBaseline.timingBaseline.ready, false);

  state = run(state, "execution.repeatability", executionSupported, "none", 62);
  const ready = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(ready.nextProbeId, "stack.timed_challenge");
  assert.equal(ready.timingBaseline.ready, true);
  assert.equal(ready.timingBaseline.baselineSeconds, 60);
});

test("individualized timed failure isolates a Time Pressure breakdown after lower layers clear", () => {
  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");
  state = run(state, "stack.normal_independent", {
    ...claritySupported,
    ...executionImmediateSupported,
  }, "none", 58);
  state = run(state, "execution.repeatability", executionSupported, "none", 60);
  state = run(state, "stack.challenge_no_timer", {
    ...claritySupported,
    ...executionImmediateSupported,
    ...difficultySupported,
  });
  state = run(state, "execution.repeatability", executionSupported, "none", 62);
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
  assert.equal(decision.complete, true);
  assert.equal(decision.placementPhase, "Time Pressure Stability");
  assert.equal(decision.stability, "Low");
  assert.equal(decision.timingBaseline.ready, true);
  assert.equal(decision.timingBaseline.baselineSeconds, 60);
});


type DiagnosisStartingStability = Exclude<TopicStability, "High Maintenance">;

const behaviorClassByStability: Record<
  DiagnosisStartingStability,
  DiagnosisBehaviorClass
> = {
  Low: "breakdown",
  Medium: "conditional",
  High: "near_stable",
};

function placementDecisionFor(
  phase: TopicPhase,
  stability: DiagnosisStartingStability,
) {
  if (phase === "Clarity") {
    const decisiveBehavior = {
      Low: "no_reason",
      Medium: "partial_reason",
      High: "correct_reason_imprecise",
    }[stability];

    let state = createEvidenceCompleteDiagnosisState("Clarity");
    state = run(state, "clarity.recognition", {
      ...claritySupported,
      "clarity.reason": decisiveBehavior,
    });
    return evaluateEvidenceCompleteDiagnosis(state);
  }

  if (phase === "Structured Execution") {
    const decisiveBehavior = {
      Low: "no_start",
      Medium: "guessing_or_disordered_start",
      High: "valid_start_after_hesitation",
    }[stability];

    let state = createEvidenceCompleteDiagnosisState("Structured Execution");
    state = run(state, "stack.normal_independent", {
      ...claritySupported,
      ...executionImmediateSupported,
      "execution.start": decisiveBehavior,
    });
    return evaluateEvidenceCompleteDiagnosis(state);
  }

  if (phase === "Controlled Discomfort") {
    const decisiveBehavior = {
      Low: "withdraws_or_freezes",
      Medium: "avoidant_hesitation",
      High: "brief_hesitation_then_attempt",
    }[stability];

    let state = createEvidenceCompleteDiagnosisState("Controlled Discomfort");
    state = run(state, "stack.challenge_no_timer", {
      ...claritySupported,
      ...executionImmediateSupported,
      ...difficultySupported,
      "difficulty.initial_response": decisiveBehavior,
    });
    state = run(state, "execution.repeatability", executionSupported, "none", 58);
    state = run(state, "stack.normal_independent", {
      ...claritySupported,
      ...executionImmediateSupported,
    }, "none", 60);
    state = run(state, "execution.repeatability", executionSupported, "none", 62);
    return evaluateEvidenceCompleteDiagnosis(state);
  }

  const decisiveBehavior = {
    Low: "timed_freeze",
    Medium: "timed_disordered_delay",
    High: "timed_valid_with_disruption",
  }[stability];

  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");
  state = run(state, "stack.normal_independent", {
    ...claritySupported,
    ...executionImmediateSupported,
  }, "none", 58);
  state = run(state, "execution.repeatability", executionSupported, "none", 60);
  state = run(state, "stack.challenge_no_timer", {
    ...claritySupported,
    ...executionImmediateSupported,
    ...difficultySupported,
  });
  state = run(state, "execution.repeatability", executionSupported, "none", 62);
  state = run(state, "stack.timed_challenge", {
    ...claritySupported,
    ...executionImmediateSupported,
    ...difficultySupported,
    ...timeSupported,
    "time.start": decisiveBehavior,
  });
  return evaluateEvidenceCompleteDiagnosis(state);
}

test("every phase entry uses the same behavior-native Low Medium High contract and explains cleared lower layers", () => {
  const stabilities: DiagnosisStartingStability[] = ["Low", "Medium", "High"];

  for (const phase of PHASES) {
    for (const stability of stabilities) {
      const decision = placementDecisionFor(phase, stability);

      assert.equal(decision.complete, true, `${phase} / ${stability} should complete`);
      assert.equal(decision.placementPhase, phase);
      assert.equal(decision.stability, stability);
      assert.ok(
        decision.placementEvidence.some(
          (item) => item.behaviorClass === behaviorClassByStability[stability],
        ),
        `${phase} / ${stability} should be justified by the matching behavior class`,
      );

      const phaseIndex = PHASES.indexOf(phase);
      const earlierPhases = PHASES.slice(0, phaseIndex);
      for (const earlierPhase of earlierPhases) {
        const earlierState = decision.phaseStates.find(
          (state) => state.phase === earlierPhase,
        );
        assert.equal(
          earlierState?.status,
          "supported",
          `${earlierPhase} must clear before ${phase} can be the entry phase`,
        );
        assert.ok(earlierState);
        const proof = getDiagnosisPhaseSupportEvidence(earlierState!);
        assert.equal(
          proof.dimensions.length,
          earlierState!.dimensions.length,
          `${earlierPhase} must expose support evidence for every dimension`,
        );
        for (const dimension of proof.dimensions) {
          assert.ok(
            dimension.supportedCount >= dimension.requiredSupportedObservations,
            `${earlierPhase} / ${dimension.dimensionId} must meet its support count`,
          );
          assert.ok(
            dimension.supportingBehaviors.length >=
              dimension.requiredSupportedObservations,
            `${earlierPhase} / ${dimension.dimensionId} must expose the clean behaviors that prove support`,
          );
        }
        assert.ok(
          decision.reason.includes(earlierPhase),
          `${phase} reasoning should name cleared earlier layer ${earlierPhase}`,
        );
      }

      if (earlierPhases.length > 0) {
        assert.match(decision.reason, /Earlier layers cleanly supported:/);
      }
      assert.match(decision.reason, /Decisive evidence:/);
    }
  }
});

test("all-clear diagnosis requires individualized baseline plus repeated temporal evidence and never mints High Maintenance", () => {
  let state = createEvidenceCompleteDiagnosisState("Time Pressure Stability");
  state = run(state, "stack.normal_independent", {
    ...claritySupported,
    ...executionImmediateSupported,
  }, "none", 58);
  state = run(state, "execution.repeatability", executionSupported, "none", 60);
  state = run(state, "stack.challenge_no_timer", {
    ...claritySupported,
    ...executionImmediateSupported,
    ...difficultySupported,
  });
  state = run(state, "execution.repeatability", executionSupported, "none", 62);

  assert.equal(
    evaluateEvidenceCompleteDiagnosis(state).nextProbeId,
    "stack.timed_challenge",
  );

  state = run(state, "stack.timed_challenge", {
    ...claritySupported,
    ...executionImmediateSupported,
    ...difficultySupported,
    ...timeSupported,
  });

  assert.equal(
    evaluateEvidenceCompleteDiagnosis(state).nextProbeId,
    "time.consistency",
  );

  state = run(state, "time.consistency", timeSupported);
  const decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, true);
  assert.equal(decision.placementPhase, "Time Pressure Stability");
  assert.equal(decision.stability, "High");
  assert.equal(decision.timingBaseline.ready, true);
  assert.equal(decision.timingBaseline.baselineSeconds, 60);

  for (const phaseState of decision.phaseStates) {
    const proof = getDiagnosisPhaseSupportEvidence(phaseState);
    assert.equal(proof.dimensions.length, phaseState.dimensions.length);
    for (const dimension of proof.dimensions) {
      assert.ok(
        dimension.supportedCount >= dimension.requiredSupportedObservations,
      );
      assert.ok(
        dimension.supportingBehaviors.length >=
          dimension.requiredSupportedObservations,
      );
    }
  }
});
