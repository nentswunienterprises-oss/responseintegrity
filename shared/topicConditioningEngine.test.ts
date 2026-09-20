import test from "node:test";
import assert from "node:assert/strict";
import {
  PARENT_DASHBOARD_COPY_BY_STATE,
  PHASES,
  computeTransition,
  mapObservationsToBehavior,
  normalizePhase,
  tryParsePhase,
} from "./topicConditioningEngine";

test("computeTransition promotes High to High Maintenance at 85+", () => {
  const result = computeTransition("Structured Execution", "High", 88);
  assert.equal(result.next_phase, "Structured Execution");
  assert.equal(result.next_stability, "High Maintenance");
  assert.equal(result.transition_reason, "stability advance");
});

test("computeTransition phase progresses only from High Maintenance and enters next phase at Low", () => {
  const result = computeTransition("Clarity", "High Maintenance", 91);
  assert.equal(result.next_phase, "Structured Execution");
  assert.equal(result.next_stability, "Low");
  assert.equal(result.transition_reason, "phase progress");
});

test("computeTransition keeps final phase in High Maintenance on a strong maintenance score", () => {
  const result = computeTransition("Time Pressure Stability", "High Maintenance", 91);
  assert.equal(result.next_phase, "Time Pressure Stability");
  assert.equal(result.next_stability, "High Maintenance");
  assert.equal(result.transition_reason, "remain");
});

test("mapObservationsToBehavior maps weak and clear observation labels deterministically", () => {
  const behaviors = mapObservationsToBehavior([
    { key: "start_behavior", value: "Delayed start" },
    { key: "step_execution", value: "Skips steps" },
    { key: "independence_level", value: "Executed without support" },
    { key: "pace_control", value: "Controlled pace" },
  ]);

  assert.deepEqual(behaviors, [
    "delayed starts",
    "inconsistent step execution",
    "more independent execution",
    "more controlled pace",
  ]);
});

test("normalizePhase falls back conservatively to Clarity", () => {
  assert.equal(normalizePhase(""), "Clarity");
  assert.equal(normalizePhase("unknown legacy phase"), "Clarity");
});

test("tryParsePhase rejects unknown values", () => {
  assert.equal(tryParsePhase("Clarity"), "Clarity");
  assert.equal(tryParsePhase("legacy unknown"), null);
});


test("High parent copy across every phase does not overclaim sustained stability", () => {
  for (const phase of PHASES) {
    const high = PARENT_DASHBOARD_COPY_BY_STATE[phase].High;
    const highMaintenance =
      PARENT_DASHBOARD_COPY_BY_STATE[phase]["High Maintenance"];

    assert.doesNotMatch(high.status, /sustained|consistently/i);
    assert.match(high.meaning, /substantially present and usable/i);
    assert.match(high.meaning, /not yet considered sustained/i);
    assert.match(
      `${highMaintenance.status} ${highMaintenance.meaning}`,
      /sustained|held|consistently/i,
    );
  }
});
