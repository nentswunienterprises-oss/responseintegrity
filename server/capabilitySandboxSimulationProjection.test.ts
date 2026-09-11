import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSandboxSimulation } from "@shared/capabilitySandboxSimulation";
import { SANDBOX_SIMULATION_DESIGN_FIXTURE_V1 } from "@shared/capabilitySandboxSimulationFixtures";
import {
  projectSandboxSimulationForSpecialist,
  projectSandboxSimulationResultForSpecialist,
} from "./capabilitySandboxSimulationProjection";

const responses = SANDBOX_SIMULATION_DESIGN_FIXTURE_V1.decisions.map((decision) => ({
  decisionKey: decision.key,
  selectedOptionKeys: [...decision.correctOptionKeys],
}));

test("Specialist simulation projection exposes scenario choices but no evaluator secrets", () => {
  const projected = projectSandboxSimulationForSpecialist({
    definition: SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
    simulationFormId: "simulation-form-1",
    bankVersion: 1,
    attemptNumber: 1,
    maxAttempts: 3,
  });
  const serialized = JSON.stringify(projected);

  assert.equal(projected.decisions.length, 5);
  assert.equal(projected.fictionalScenarioConfirmed, true);
  assert.doesNotMatch(serialized, /correctOptionKeys/);
  assert.doesNotMatch(serialized, /criticalFailOptionKeys/);
  assert.doesNotMatch(serialized, /criticalBoundaryKeys/);
  assert.doesNotMatch(serialized, /riskOptionKeys/);
  assert.doesNotMatch(serialized, /explanation/);
  assert.doesNotMatch(serialized, /competencyKey/);
  assert.doesNotMatch(serialized, /deepDiveKey/);
});

test("Specialist result projection exposes aggregate outcome but no decision answer or boundary lineage", () => {
  const result = evaluateSandboxSimulation(SANDBOX_SIMULATION_DESIGN_FIXTURE_V1, responses);
  const projected = projectSandboxSimulationResultForSpecialist({
    attemptId: "simulation-attempt-1",
    completedAt: "2026-09-11T17:00:00Z",
    bankVersion: 1,
    attemptNumber: 1,
    simulationFormId: "simulation-form-1",
    result,
  });
  const serialized = JSON.stringify(projected);

  assert.equal(projected.passed, true);
  assert.equal(projected.authoritative, false);
  assert.doesNotMatch(serialized, /decisionResults/);
  assert.doesNotMatch(serialized, /correctOptionKeys/);
  assert.doesNotMatch(serialized, /criticalFailDecisionKeys/);
  assert.doesNotMatch(serialized, /triggeredCriticalBoundaryKeys/);
  assert.doesNotMatch(serialized, /explanation/);
});
