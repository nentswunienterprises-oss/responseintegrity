import assert from "node:assert/strict";
import test from "node:test";
import { SANDBOX_SIMULATION_DESIGN_FIXTURE_V1 } from "@shared/capabilitySandboxSimulationFixtures";
import {
  createSandboxSimulationRotationSeed,
  generateDeterministicSandboxSimulation,
  type SandboxSimulationBankConfig,
} from "./capabilitySandboxSimulationGeneration";

function scenario(key: string) {
  return {
    ...SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
    key,
    title: `Fixture ${key}`,
  };
}

const config: SandboxSimulationBankConfig = {
  bankKey: "sandbox_foundation_v1",
  bankVersion: 1,
  maxAttempts: 6,
  retryCooldownHours: 0,
  scenarios: [scenario("scenario_a"), scenario("scenario_b"), scenario("scenario_c")],
};

function generate(attemptNumber: number, assignment = "assignment-1", bank = config) {
  return generateDeterministicSandboxSimulation({
    config: bank,
    tutorAssignmentId: assignment,
    attemptNumber,
    secret: "simulation-test-secret",
  });
}

test("same assignment, bank version and attempt always resolve to the same scenario and form id", () => {
  const first = generate(2);
  const second = generate(2);
  assert.equal(first.definition.key, second.definition.key);
  assert.equal(first.simulationFormId, second.simulationFormId);
});

test("successive attempts rotate through the scenario pool before repeating", () => {
  const firstCycle = [generate(1), generate(2), generate(3)].map((entry) => entry.definition.key);
  assert.equal(new Set(firstCycle).size, 3);
  assert.equal(generate(4).definition.key, generate(1).definition.key);
});

test("bank-version rotation changes the deterministic selection namespace", () => {
  const nextBank: SandboxSimulationBankConfig = { ...config, bankVersion: 2 };
  const current = generate(1);
  const next = generate(1, "assignment-1", nextBank);
  assert.notEqual(current.simulationFormId, next.simulationFormId);
  assert.equal(next.bankVersion, 2);
});

test("different assignment identities do not share the same form identity", () => {
  const first = generate(1, "assignment-1");
  const second = generate(1, "assignment-2");
  assert.notEqual(first.simulationFormId, second.simulationFormId);
});

test("rotation seed requires the server secret", () => {
  assert.throws(
    () =>
      createSandboxSimulationRotationSeed({
        secret: "",
        tutorAssignmentId: "assignment-1",
        bankKey: config.bankKey,
        bankVersion: config.bankVersion,
      }),
    /CAPABILITY_SIMULATION_SECRET/,
  );
});

test("duplicate scenario identities fail closed", () => {
  const invalid: SandboxSimulationBankConfig = {
    ...config,
    scenarios: [scenario("duplicate"), scenario("duplicate")],
  };
  assert.throws(() => generate(1, "assignment-1", invalid), /duplicate scenario keys/);
});
