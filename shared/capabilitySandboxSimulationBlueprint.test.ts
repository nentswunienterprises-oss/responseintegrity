import assert from "node:assert/strict";
import test from "node:test";
import { SANDBOX_SIMULATION_DESIGN_FIXTURE_V1 } from "./capabilitySandboxSimulationFixtures";
import { validateSandboxSimulationAgainstCapabilityBlueprint } from "./capabilitySandboxSimulationBlueprint";

test("cross-module design fixture resolves entirely against the canonical RI capability blueprint", () => {
  const coverage = validateSandboxSimulationAgainstCapabilityBlueprint(
    SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
  );

  assert.deepEqual(coverage.coveredDeepDiveKeys, [
    "clarity",
    "controlled_discomfort",
    "logging_system",
    "session_flow_control",
    "structured_execution",
  ]);
  assert.equal(coverage.coveredCompetencies.length, 5);
  assert.equal(coverage.coveredCriticalBoundaries.length, 5);
});

test("unknown Deep Dive, competency, and critical-boundary identities fail closed", () => {
  const unknownDeepDive = structuredClone(SANDBOX_SIMULATION_DESIGN_FIXTURE_V1);
  unknownDeepDive.decisions[0].deepDiveKey = "not_a_real_deep_dive";
  assert.throws(
    () => validateSandboxSimulationAgainstCapabilityBlueprint(unknownDeepDive),
    /unknown Deep Dive/,
  );

  const unknownCompetency = structuredClone(SANDBOX_SIMULATION_DESIGN_FIXTURE_V1);
  unknownCompetency.decisions[0].competencyKey = "clarity.not_real";
  assert.throws(
    () => validateSandboxSimulationAgainstCapabilityBlueprint(unknownCompetency),
    /unknown competency/,
  );

  const unknownBoundary = structuredClone(SANDBOX_SIMULATION_DESIGN_FIXTURE_V1);
  unknownBoundary.decisions[0].criticalBoundaryKeys = ["clarity.not_real"];
  assert.throws(
    () => validateSandboxSimulationAgainstCapabilityBlueprint(unknownBoundary),
    /unknown critical boundary/,
  );
});

test("critical-fail action cannot exist without named RI boundary lineage", () => {
  const missingLineage = structuredClone(SANDBOX_SIMULATION_DESIGN_FIXTURE_V1);
  missingLineage.decisions[0].criticalBoundaryKeys = [];
  assert.throws(
    () => validateSandboxSimulationAgainstCapabilityBlueprint(missingLineage),
    /without RI critical-boundary lineage/,
  );
});
