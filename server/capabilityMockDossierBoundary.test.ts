import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serviceSource = fs.readFileSync(new URL("./capabilityMockDossier.ts", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("./routes/capabilityMockDossier.ts", import.meta.url), "utf8");
const serverIndexSource = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const apiIndexSource = fs.readFileSync(new URL("../api/index.ts", import.meta.url), "utf8");
const pureCoreSource = fs.readFileSync(new URL("../shared/capabilityMockDossier.ts", import.meta.url), "utf8");
const sandboxWriterSource = fs.readFileSync(new URL("./sandboxReadiness.ts", import.meta.url), "utf8");

test("pre-Mock dossier is GET-only and restricted to the existing COO Mock surface", () => {
  assert.match(routeSource, /app\.get\(/);
  assert.doesNotMatch(routeSource, /app\.(post|put|patch|delete)\(/);
  assert.match(routeSource, /String\(user\.role \|\| ""\)\.toLowerCase\(\) !== "coo"/);
  assert.match(routeSource, /isAuthenticated/);
});

test("dossier service and pure core are structurally read-only and cannot invoke Mock authority", () => {
  for (const source of [serviceSource, pureCoreSource]) {
    assert.doesNotMatch(source, /INSERT\s+INTO/i);
    assert.doesNotMatch(source, /UPDATE\s+/i);
    assert.doesNotMatch(source, /DELETE\s+FROM/i);
    assert.doesNotMatch(source, /recordSandboxMockAssessment/);
    assert.doesNotMatch(source, /record_tutor_sandbox_mock_assessment/);
  }
  assert.match(sandboxWriterSource, /recordSandboxMockAssessment/);
  assert.match(sandboxWriterSource, /record_tutor_sandbox_mock_assessment/);
});

test("dossier is explicitly advisory and emits no Mock recommendation or checklist", () => {
  assert.match(serviceSource, /authoritative: false as const/);
  assert.match(serviceSource, /mockRecommendation: null/);
  assert.match(serviceSource, /Evidence context for the human Sandbox Mock reviewer only/);
  assert.doesNotMatch(serviceSource, /SANDBOX_MOCK_CRITERIA/);
  assert.doesNotMatch(serviceSource, /createEmptySandboxMockChecklist/);
  assert.doesNotMatch(serviceSource, /mockChecklist/);
  assert.doesNotMatch(pureCoreSource, /SANDBOX_MOCK_CRITERIA/);
});

test("dossier uses approved 16-assessment plan and canonical evidence-cell contract", () => {
  assert.match(serviceSource, /CAPABILITY_MVP_ASSESSMENT_PLAN_V1\.map/);
  assert.match(serviceSource, /getRequiredCapabilityEvidenceCells\(\)/);
  assert.match(serviceSource, /readinessEvidence\.satisfiedEvidenceCells/);
  assert.match(serviceSource, /buildCapabilityMockDossierSnapshot/);
});

test("dossier reads V2 Oral semantic critical-fail lineage rather than V1 reviewer concern vocabulary", () => {
  assert.match(serviceSource, /fail_count, critical_fail_count, outcome/);
  assert.match(serviceSource, /criticalFail: Number\(row\.critical_fail_count \|\| 0\)/);
  assert.doesNotMatch(serviceSource, /integrity_concern_count/);
});

test("dossier preserves stale/missing/conflict lineage as factual flags", () => {
  assert.match(pureCoreSource, /kind: "missing"/);
  assert.match(pureCoreSource, /kind: "stale"/);
  assert.match(pureCoreSource, /kind: "conflict"/);
  assert.match(pureCoreSource, /assessment_active_bank_conflict/);
  assert.match(pureCoreSource, /evidence_cell_conflict/);
  assert.match(pureCoreSource, /sandbox_simulation_stale_history/);
});

test("dossier fails closed when Sandbox assignment identity is ambiguous", () => {
  assert.match(serviceSource, /No Sandbox assignment exists/);
  assert.match(serviceSource, /Multiple Sandbox assignments exist/);
  assert.match(serviceSource, /lower\(coalesce\(operational_mode, ''\)\) = 'sandbox'/);
});

test("dossier code cannot mutate Trial certification operational mode or student state", () => {
  assert.doesNotMatch(serviceSource, /record_tutor_sandbox_mock_assessment/);
  assert.doesNotMatch(serviceSource, /certification_status/);
  assert.doesNotMatch(serviceSource, /SET\s+operational_mode/i);
  assert.doesNotMatch(serviceSource, /student_state/);
  assert.doesNotMatch(routeSource, /sandbox-mock-assessment/);
});

test("dossier route is registered in Express and Vercel runtimes", () => {
  assert.match(serverIndexSource, /registerCapabilityMockDossierRoutes/);
  assert.match(apiIndexSource, /registerCapabilityMockDossierRoutes/);
  assert.match(routeSource, /\/api\/coo\/tutors\/:tutorId\/capability-dossier/);
});
