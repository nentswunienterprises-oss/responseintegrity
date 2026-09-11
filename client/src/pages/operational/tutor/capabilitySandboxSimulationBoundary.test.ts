import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("./capability-sandbox-simulation.tsx", import.meta.url),
  "utf8",
);
const standalone = fs.readFileSync(
  new URL("../../../capabilityStandaloneApp.tsx", import.meta.url),
  "utf8",
);

test("Sandbox Simulation workspace is routed through the Specialist gateway", () => {
  assert.match(standalone, /capability-sandbox-simulation/);
  assert.match(standalone, /TutorGatewayGuard/);
  assert.match(standalone, /SpecialistCapabilitySandboxSimulation/);
});

test("workspace refuses to load rehearsal outside Sandbox mode", () => {
  assert.match(page, /operationalMode/);
  assert.match(page, /const inSandbox = operationalMode === "sandbox"/);
  assert.match(page, /enabled: Boolean\(tutorAssignmentId\) && inSandbox/);
  assert.match(page, /available only while your Specialist operational mode is Sandbox/);
});

test("workspace clearly separates rehearsal from the human Sandbox Mock Gate", () => {
  assert.match(page, /Simulation results are non-authoritative/);
  assert.match(page, /does not pass the human Sandbox Mock Readiness Gate/);
  assert.match(page, /does not.*open Trial/);
  assert.match(page, /No AI judgment is used/);
});

test("workspace submits only form identity and selected action keys", () => {
  assert.match(page, /simulationFormId/);
  assert.match(page, /selectedOptionKeys/);
  assert.doesNotMatch(page, /correctOptionKeys/);
  assert.doesNotMatch(page, /criticalFailOptionKeys/);
  assert.doesNotMatch(page, /riskOptionKeys/);
  assert.doesNotMatch(page, /decisionResults/);
});
