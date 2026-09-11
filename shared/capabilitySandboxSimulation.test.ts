import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateSandboxSimulation,
  validateSandboxSimulationDefinition,
  type SandboxSimulationDefinition,
  type SandboxSimulationResponseInput,
} from "./capabilitySandboxSimulation";
import { SANDBOX_SIMULATION_DESIGN_FIXTURE_V1 } from "./capabilitySandboxSimulationFixtures";

function correctResponses(
  definition: SandboxSimulationDefinition = SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
): SandboxSimulationResponseInput[] {
  return definition.decisions.map((decision) => ({
    decisionKey: decision.key,
    selectedOptionKeys: [...decision.correctOptionKeys],
  }));
}

function replaceResponse(
  responses: SandboxSimulationResponseInput[],
  decisionKey: string,
  selectedOptionKeys: string[],
) {
  return responses.map((response) =>
    response.decisionKey === decisionKey ? { ...response, selectedOptionKeys } : response,
  );
}

test("cross-module design fixture covers five RI Deep Dives and passes deterministically", () => {
  const first = evaluateSandboxSimulation(
    SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
    correctResponses(),
  );
  const second = evaluateSandboxSimulation(
    SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
    correctResponses(),
  );

  assert.deepEqual(first, second);
  assert.equal(first.passed, true);
  assert.equal(first.percent, 100);
  assert.equal(first.authoritative, false);
  assert.deepEqual(first.coveredDeepDiveKeys, [
    "clarity",
    "controlled_discomfort",
    "logging_system",
    "session_flow_control",
    "structured_execution",
  ]);
  assert.deepEqual(first.triggeredCriticalBoundaryKeys, []);
  assert.equal(first.evidenceContaminationCount, 0);
  assert.equal(first.authorityViolationCount, 0);
});

test("operational miss and evidence contamination remain separately visible", () => {
  const responses = replaceResponse(
    correctResponses(),
    "clarity_identification_boundary",
    ["continue"],
  );
  const result = evaluateSandboxSimulation(
    SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
    responses,
  );

  assert.equal(result.correctDecisions, 4);
  assert.equal(result.percent, 80);
  assert.equal(result.passed, true);
  assert.equal(result.hasCriticalFail, false);
  assert.deepEqual(result.triggeredCriticalBoundaryKeys, []);
  assert.equal(result.evidenceContaminationCount, 1);
  assert.equal(result.authorityViolationCount, 0);
});

test("critical authority violation fails the simulation regardless of aggregate score", () => {
  const responses = replaceResponse(
    correctResponses(),
    "session_flow_system_authority",
    ["silent_override"],
  );
  const result = evaluateSandboxSimulation(
    SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
    responses,
  );

  assert.equal(result.percent, 80);
  assert.equal(result.passed, false);
  assert.equal(result.hasCriticalFail, true);
  assert.deepEqual(result.criticalFailDecisionKeys, ["session_flow_system_authority"]);
  assert.deepEqual(result.triggeredCriticalBoundaryKeys, ["session_flow.no_manual_drill_override"]);
  assert.equal(result.authorityViolationCount, 1);
  assert.equal(result.evidenceContaminationCount, 1);
});

test("full rescue inside Controlled Discomfort is captured as critical contaminated evidence", () => {
  const responses = replaceResponse(
    correctResponses(),
    "controlled_discomfort_no_rescue_boundary",
    ["full_rescue"],
  );
  const result = evaluateSandboxSimulation(
    SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
    responses,
  );

  assert.equal(result.passed, false);
  assert.equal(result.hasCriticalFail, true);
  assert.deepEqual(result.triggeredCriticalBoundaryKeys, ["controlled_discomfort.no_full_rescue"]);
  assert.equal(result.evidenceContaminationCount, 1);
});

test("single-choice decisions reject multiple selected actions", () => {
  const responses = replaceResponse(
    correctResponses(),
    "clarity_identification_boundary",
    ["preserve", "continue"],
  );

  assert.throws(
    () => evaluateSandboxSimulation(SANDBOX_SIMULATION_DESIGN_FIXTURE_V1, responses),
    /exactly one action/,
  );
});

test("definition validation rejects duplicate decisions and non-fictional simulations", () => {
  const duplicate = {
    ...SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
    decisions: [
      ...SANDBOX_SIMULATION_DESIGN_FIXTURE_V1.decisions,
      SANDBOX_SIMULATION_DESIGN_FIXTURE_V1.decisions[0],
    ],
  };
  assert.throws(() => validateSandboxSimulationDefinition(duplicate), /Duplicate Sandbox simulation decision key/);

  const nonFictional = {
    ...SANDBOX_SIMULATION_DESIGN_FIXTURE_V1,
    fictionalScenarioConfirmed: false,
  } as unknown as SandboxSimulationDefinition;
  assert.throws(() => validateSandboxSimulationDefinition(nonFictional), /explicitly fictional/);
});

test("named critical boundary requires a critical-fail action", () => {
  const invalid = structuredClone(SANDBOX_SIMULATION_DESIGN_FIXTURE_V1);
  invalid.decisions[0].criticalFailOptionKeys = [];
  assert.throws(
    () => validateSandboxSimulationDefinition(invalid),
    /names a critical boundary without a critical-fail action/,
  );
});

test("response set fails closed on missing, duplicate and unknown decisions", () => {
  const correct = correctResponses();
  assert.throws(
    () => evaluateSandboxSimulation(SANDBOX_SIMULATION_DESIGN_FIXTURE_V1, correct.slice(1)),
    /Expected 5 Sandbox simulation responses/,
  );

  assert.throws(
    () =>
      evaluateSandboxSimulation(SANDBOX_SIMULATION_DESIGN_FIXTURE_V1, [
        ...correct.slice(0, 4),
        correct[0],
      ]),
    /Duplicate Sandbox simulation response/,
  );

  const unknown = replaceResponse(correct, "clarity_identification_boundary", ["not-an-option"]);
  assert.throws(
    () => evaluateSandboxSimulation(SANDBOX_SIMULATION_DESIGN_FIXTURE_V1, unknown),
    /selected unknown option/,
  );
});
