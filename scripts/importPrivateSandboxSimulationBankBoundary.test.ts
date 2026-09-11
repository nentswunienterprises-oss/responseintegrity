import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("./import-private-sandbox-simulation-bank.ts", import.meta.url),
  "utf8",
);

test("Sandbox Simulation bank importer validates offline before any database import", () => {
  assert.match(source, /validateSandboxSimulationDefinition/);
  assert.match(source, /validateSandboxSimulationAgainstCapabilityBlueprint/);
  assert.match(source, /if \(!apply\)/);
  assert.match(source, /No database connection was opened/);
  assert.match(source, /await import\("\.\.\/server\/db"\)/);
  assert.doesNotMatch(source, /^import .* from "\.\.\/server\/db"/m);
});

test("Sandbox Simulation bank activation is explicit and versions are immutable", () => {
  assert.match(source, /--apply/);
  assert.match(source, /Bank versions are immutable/);
  assert.match(source, /active = false/);
  assert.match(source, /active = true/);
  assert.match(source, /must contain at least two scenarios for rotation/);
});

test("private importer does not source live banks from the public design fixture", () => {
  assert.doesNotMatch(source, /capabilitySandboxSimulationFixtures/);
  assert.doesNotMatch(source, /SANDBOX_SIMULATION_DESIGN_FIXTURE/);
});
