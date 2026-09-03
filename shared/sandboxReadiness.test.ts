import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptySandboxMockChecklist,
  evaluateSandboxReadinessGate,
  SANDBOX_MOCK_CRITERIA,
} from "./sandboxReadiness";

function completeChecklist() {
  return Object.fromEntries(SANDBOX_MOCK_CRITERIA.map((criterion) => [criterion.key, true])) as any;
}

test("Sandbox cannot open Trial before the Mock Readiness Gate passes", () => {
  const result = evaluateSandboxReadinessGate({
    docsComplete: true,
    transformationComplete: true,
    sessionInfrastructureComplete: true,
    hasActiveFailHealth: false,
    sandboxAccountCount: 6,
    latestMockAssessment: null,
  });

  assert.equal(result.readyForTrial, false);
  assert.match(result.blockers.join(" "), /Mock Readiness Gate/);
});

test("a passed decision with an incomplete checklist is not a valid Sandbox exit", () => {
  const result = evaluateSandboxReadinessGate({
    docsComplete: true,
    transformationComplete: true,
    sessionInfrastructureComplete: true,
    hasActiveFailHealth: false,
    sandboxAccountCount: 6,
    latestMockAssessment: {
      decision: "passed",
      checklist: createEmptySandboxMockChecklist(),
    },
  });

  assert.equal(result.readyForTrial, false);
});

test("complete preparation plus a clean Mock assessment opens Trial readiness", () => {
  const result = evaluateSandboxReadinessGate({
    docsComplete: true,
    transformationComplete: true,
    sessionInfrastructureComplete: true,
    hasActiveFailHealth: false,
    sandboxAccountCount: 6,
    latestMockAssessment: {
      decision: "passed",
      checklist: completeChecklist(),
    },
  });

  assert.deepEqual(result, { readyForTrial: true, blockers: [] });
});

test("Sandbox exit remains blocked until all six practice accounts are available", () => {
  const result = evaluateSandboxReadinessGate({
    docsComplete: true,
    transformationComplete: true,
    sessionInfrastructureComplete: true,
    hasActiveFailHealth: false,
    sandboxAccountCount: 5,
    latestMockAssessment: {
      decision: "passed",
      checklist: completeChecklist(),
    },
  });

  assert.equal(result.readyForTrial, false);
  assert.match(result.blockers.join(" "), /6 Sandbox practice accounts/);
});
