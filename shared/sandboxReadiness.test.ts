import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSandboxPreparationGate,
  SANDBOX_REQUIRED_ACCOUNT_COUNT,
} from "./sandboxReadiness";

test("Sandbox preparation points to Practicals and never to Trial", () => {
  const result = evaluateSandboxPreparationGate({
    docsComplete: true,
    transformationComplete: true,
    sessionInfrastructureComplete: true,
    hasActiveFailHealth: false,
    sandboxAccountCount: SANDBOX_REQUIRED_ACCOUNT_COUNT,
  });

  assert.deepEqual(result, {
    readyForCapabilityReadiness: true,
    blockers: [],
    nextStage: "practicals",
  });
});

test("Sandbox preparation remains blocked until all six practice accounts are available", () => {
  const result = evaluateSandboxPreparationGate({
    docsComplete: true,
    transformationComplete: true,
    sessionInfrastructureComplete: true,
    hasActiveFailHealth: false,
    sandboxAccountCount: SANDBOX_REQUIRED_ACCOUNT_COUNT - 1,
  });

  assert.equal(result.readyForCapabilityReadiness, false);
  assert.match(result.blockers.join(" "), /6 Sandbox practice accounts/);
  assert.equal(result.nextStage, "practicals");
});

test("Sandbox preparation refuses active fail health even when preparation is otherwise complete", () => {
  const result = evaluateSandboxPreparationGate({
    docsComplete: true,
    transformationComplete: true,
    sessionInfrastructureComplete: true,
    hasActiveFailHealth: true,
    sandboxAccountCount: SANDBOX_REQUIRED_ACCOUNT_COUNT,
  });

  assert.equal(result.readyForCapabilityReadiness, false);
  assert.match(result.blockers.join(" "), /active fail or critical-drift/i);
});
