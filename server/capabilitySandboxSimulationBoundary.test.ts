import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const service = fs.readFileSync(new URL("./capabilitySandboxSimulation.ts", import.meta.url), "utf8");
const bank = fs.readFileSync(new URL("./capabilitySandboxSimulationBank.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("./routes/capabilitySandboxSimulation.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../migrations/2026-09-11_add_capability_sandbox_simulation_attempts.sql", import.meta.url),
  "utf8",
);

test("Sandbox Simulation service requires owned Sandbox-mode assignment", () => {
  assert.match(service, /FROM tutor_assignments/);
  assert.match(service, /tutor_id = \$2/);
  assert.match(service, /operational_mode/);
  assert.match(service, /!== "sandbox"/);
  assert.match(service, /available only while the Specialist is in Sandbox mode/);
});

test("simulation persistence is shadow-only and cannot mutate the human Mock Gate or Trial", () => {
  assert.match(service, /specialist_capability_sandbox_simulation_attempts/);
  assert.match(service, /authoritative\n\s*\) VALUES/);
  assert.match(service, /false\n\s*\)/);
  assert.doesNotMatch(service, /sandbox_mock_assessments/i);
  assert.doesNotMatch(service, /SandboxMock/i);
  assert.doesNotMatch(service, /operational_mode\s*=\s*['"]trial['"]/i);
  assert.doesNotMatch(service, /UPDATE\s+tutor_assignments/i);
});

test("live scenario definitions stay in private schema and attempt authority is database-constrained false", () => {
  assert.match(bank, /private\.specialist_capability_simulation_banks/);
  assert.match(bank, /private\.specialist_capability_simulation_scenarios/);
  assert.match(migration, /REVOKE ALL ON TABLE private\.specialist_capability_simulation_scenarios FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /authoritative boolean NOT NULL DEFAULT false CHECK \(authoritative = false\)/);
  assert.match(migration, /Immutable shadow Sandbox rehearsal evidence/);
});

test("Specialist routes expose rehearsal only and no COO Mock-decision endpoint", () => {
  assert.match(route, /\/api\/tutor\/capability-sandbox-simulation/);
  assert.match(route, /\/api\/tutor\/capability-sandbox-simulation\/attempt/);
  assert.match(route, /\/api\/tutor\/capability-sandbox-simulation\/history/);
  assert.doesNotMatch(route, /\/api\/coo\//);
  assert.doesNotMatch(route, /sandbox-mock-assessment/);
});
