import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const oralService = fs.readFileSync(new URL("./capabilityOralDefense.ts", import.meta.url), "utf8");
const readinessService = fs.readFileSync(new URL("./capabilityReadiness.ts", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("./routes/capabilityOralDefense.ts", import.meta.url), "utf8");
const readinessContract = fs.readFileSync(new URL("../shared/capabilityReadiness.ts", import.meta.url), "utf8");
const migrationSource = fs.readFileSync(
  new URL("../migrations/2026-09-11_add_capability_assessment_attempts.sql", import.meta.url),
  "utf8",
);

test("oral brief uses internal evidence risk but never exposes answer keys or stored item wording", () => {
  assert.match(oralService, /question_results/);
  assert.match(oralService, /incorrectCount/);
  assert.match(oralService, /criticalFailCount/);
  assert.doesNotMatch(oralService, /correctOptionKeys/);
  assert.doesNotMatch(oralService, /selectedOptionKeys/);
  assert.doesNotMatch(oralService, /prompt:/);
  assert.doesNotMatch(oralService, /explanation:/);
  assert.match(oralService, /Do not reuse a known assessment item/);
});

test("oral defense remains bounded to three baseline probes plus at most two evidence-risk probes", () => {
  assert.match(oralService, /\.slice\(0, 2\)/);
  assert.match(oralService, /ORAL_DEFENSE_ALWAYS_PROBE/);
  assert.match(routeSource, /\.min\(3\)\.max\(5\)/);
});

test("human oral defense cannot open before automated and practical prerequisites are satisfied", () => {
  assert.ok((oralService.match(/assertPreOralCapabilityEvidenceReady/g) || []).length >= 2);
  assert.match(readinessService, /requirement\.kind !== "oral_defense" && !requirement\.satisfied/);
  assert.match(readinessService, /missingRequirementCodes/);
});

test("TD access remains scoped by the existing pod TD relation", () => {
  assert.match(readinessService, /reviewerRole === "td"/);
  assert.match(readinessService, /String\(row\.td_id \|\| ""\) !== input\.reviewerId/);
});

test("oral defense evidence is immutable and sandbox-only", () => {
  assert.match(oralService, /INSERT INTO specialist_capability_oral_defenses/);
  assert.doesNotMatch(oralService, /UPDATE specialist_capability_oral_defenses/);
  assert.match(routeSource, /sandboxScenarioConfirmed: z\.literal\(true\)/);
  assert.match(migrationSource, /sandbox_scenario_confirmed boolean NOT NULL CHECK \(sandbox_scenario_confirmed = true\)/);
});

test("shadow readiness is structurally non-authoritative", () => {
  assert.match(readinessContract, /authoritative: false/);
  assert.doesNotMatch(readinessService, /UPDATE tutor_assignments/);
  assert.doesNotMatch(readinessService, /certification_status/);
  assert.doesNotMatch(readinessService, /operational_mode/);
  assert.doesNotMatch(oralService, /UPDATE tutor_assignments/);
  assert.doesNotMatch(oralService, /certification_status/);
  assert.doesNotMatch(oralService, /operational_mode/);
});

test("all oral/readiness routes require authentication and role boundaries", () => {
  assert.ok((routeSource.match(/isAuthenticated/g) || []).length >= 5);
  assert.match(routeSource, /Specialist access required/);
  assert.match(routeSource, /Capability review access is restricted/);
});
