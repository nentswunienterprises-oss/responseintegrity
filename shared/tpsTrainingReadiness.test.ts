import test from "node:test";
import assert from "node:assert/strict";
import {
  TPS_TIMER_BASELINE_INCOMPLETE,
  resolveTpsTrainingReadiness,
} from "./tpsTrainingReadiness";

test("SE progression freezes a legitimate clean training baseline before leaving the phase", () => {
  const decision = resolveTpsTrainingReadiness({
    observedPhase: "Structured Execution",
    previousStability: "High Maintenance",
    proposedPhase: "Controlled Discomfort",
    proposedStability: "Low",
    transitionReason: "phase progress",
    hasTimerContract: false,
    canFreezeTrainingBaseline: true,
  });

  assert.equal(decision.action, "allow");
  assert.equal(decision.shouldFreezeTrainingContract, true);
});

test("SE does not progress when its current epoch lacks a complete clean IE timing set", () => {
  const decision = resolveTpsTrainingReadiness({
    observedPhase: "Structured Execution",
    previousStability: "High Maintenance",
    proposedPhase: "Controlled Discomfort",
    proposedStability: "Low",
    transitionReason: "phase progress",
    hasTimerContract: false,
    canFreezeTrainingBaseline: false,
  });

  assert.equal(decision.action, "hold_structured_execution");
  if (decision.action !== "hold_structured_execution") return;
  assert.equal(decision.issueCode, TPS_TIMER_BASELINE_INCOMPLETE);
  assert.equal(decision.resultingPhase, "Structured Execution");
  assert.equal(decision.resultingStability, "High Maintenance");
  assert.equal(decision.requiresTargetedRediagnosis, false);
});

test("CD cannot cross into TPS without a persisted Timer Contract", () => {
  const decision = resolveTpsTrainingReadiness({
    observedPhase: "Controlled Discomfort",
    previousStability: "High Maintenance",
    proposedPhase: "Time Pressure Stability",
    proposedStability: "Low",
    transitionReason: "phase progress",
    hasTimerContract: false,
    canFreezeTrainingBaseline: false,
  });

  assert.equal(decision.action, "targeted_rediagnosis");
  if (decision.action !== "targeted_rediagnosis") return;
  assert.equal(decision.issueCode, TPS_TIMER_BASELINE_INCOMPLETE);
  assert.equal(decision.resultingPhase, "Controlled Discomfort");
  assert.equal(decision.resultingStability, "High Maintenance");
  assert.equal(decision.targetedRediagnosisStartPhase, "Structured Execution");
});

test("CD progression into TPS is unchanged when timing authority already exists", () => {
  const decision = resolveTpsTrainingReadiness({
    observedPhase: "Controlled Discomfort",
    previousStability: "High Maintenance",
    proposedPhase: "Time Pressure Stability",
    proposedStability: "Low",
    transitionReason: "phase progress",
    hasTimerContract: true,
    canFreezeTrainingBaseline: false,
  });

  assert.equal(decision.action, "allow");
  assert.equal(decision.shouldFreezeTrainingContract, false);
});

test("legacy TPS without timing authority preserves phase truth but blocks ordinary TPS evidence", () => {
  const decision = resolveTpsTrainingReadiness({
    observedPhase: "Time Pressure Stability",
    previousStability: "Medium",
    proposedPhase: "Time Pressure Stability",
    proposedStability: "High",
    transitionReason: "stability advance",
    hasTimerContract: false,
    canFreezeTrainingBaseline: false,
  });

  assert.equal(decision.action, "targeted_rediagnosis");
  if (decision.action !== "targeted_rediagnosis") return;
  assert.equal(decision.resultingPhase, "Time Pressure Stability");
  assert.equal(decision.resultingStability, "Medium");
  assert.equal(decision.targetedRediagnosisStartPhase, "Structured Execution");
});
