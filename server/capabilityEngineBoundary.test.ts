import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const serviceSource = fs.readFileSync(new URL("./capabilityEngine.ts", import.meta.url), "utf8");
const projectionSource = fs.readFileSync(new URL("./capabilityPublicProjection.ts", import.meta.url), "utf8");
const bankSource = fs.readFileSync(new URL("./capabilityBank.ts", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("./routes/capabilityEngine.ts", import.meta.url), "utf8");
const migrationSource = fs.readFileSync(
  new URL("../migrations/2026-09-11_add_capability_assessment_attempts.sql", import.meta.url),
  "utf8",
);

test("runtime delegates Specialist assessment output to the safe projector", () => {
  assert.match(serviceSource, /projectCapabilityAssessmentForSpecialist/);
  assert.match(serviceSource, /projectCapabilityAttemptResultForSpecialist/);
});

test("public assessment projection exposes only presentation-safe question fields", () => {
  const projectionStart = projectionSource.indexOf("export function projectCapabilityAssessmentForSpecialist");
  const projectionEnd = projectionSource.indexOf("export function projectCapabilityAttemptResultForSpecialist", projectionStart);
  assert.notEqual(projectionStart, -1);
  assert.notEqual(projectionEnd, -1);

  const projection = projectionSource.slice(projectionStart, projectionEnd);
  assert.doesNotMatch(projection, /correctOptionKeys/);
  assert.doesNotMatch(projection, /criticalFailOptionKeys/);
  assert.doesNotMatch(projection, /competencyKey/);
  assert.doesNotMatch(projection, /explanation/);
  assert.match(projection, /prompt/);
  assert.match(projection, /options/);
  assert.match(projection, /formId/);
  assert.match(projection, /bankVersion/);
});

test("submitted result projection never returns answer-level evidence", () => {
  const projectionStart = projectionSource.indexOf("export function projectCapabilityAttemptResultForSpecialist");
  assert.notEqual(projectionStart, -1);

  const projection = projectionSource.slice(projectionStart);
  assert.doesNotMatch(projection, /questionResults/);
  assert.doesNotMatch(projection, /correctOptionKeys/);
  assert.doesNotMatch(projection, /criticalFailQuestionKeys/);
  assert.doesNotMatch(projection, /explanation/);
  assert.match(projection, /hasCriticalFail/);
  assert.match(projection, /percent/);
  assert.match(projection, /passed/);
});

test("Specialist history does not expose question-level answer or critical-key lineage", () => {
  const historyStart = serviceSource.indexOf("export async function getCapabilityAssessmentHistory");
  const historyEnd = serviceSource.indexOf("export async function getSpecialistCapabilityLedger", historyStart);
  assert.notEqual(historyStart, -1);
  assert.notEqual(historyEnd, -1);

  const history = serviceSource.slice(historyStart, historyEnd);
  assert.doesNotMatch(history, /question_results/);
  assert.doesNotMatch(history, /critical_fail_question_keys/);
  assert.match(history, /has_critical_fail/);
  assert.match(history, /percent/);
});

test("runtime capability service never imports public fixture assessment banks", () => {
  assert.doesNotMatch(serviceSource, /capabilityAssessmentBank/);
  assert.doesNotMatch(serviceSource, /capabilityAssessments/);
  assert.match(serviceSource, /capabilityBank/);
  assert.match(bankSource, /private\.specialist_capability_assessment_configs/);
  assert.match(bankSource, /private\.specialist_capability_assessment_items/);
});

test("private assessment-bank tables are explicitly outside direct client access without changing the whole private schema", () => {
  assert.match(migrationSource, /CREATE SCHEMA IF NOT EXISTS private/);
  assert.doesNotMatch(migrationSource, /REVOKE ALL ON SCHEMA private/);
  assert.match(migrationSource, /REVOKE ALL ON TABLE private\.specialist_capability_assessment_configs FROM PUBLIC, anon, authenticated/);
  assert.match(migrationSource, /REVOKE ALL ON TABLE private\.specialist_capability_assessment_items FROM PUBLIC, anon, authenticated/);
});

test("all capability endpoints require authenticated Specialist access", () => {
  assert.match(routeSource, /\/api\/tutor\/capability-assessments\/:assessmentKey/);
  assert.match(routeSource, /\/api\/tutor\/capability-ledger/);
  assert.ok((routeSource.match(/isAuthenticated/g) || []).length >= 4);
  assert.match(routeSource, /Specialist access required/);
});

test("attempt submission is bound to assignment ownership and issued form identity", () => {
  assert.match(serviceSource, /WHERE id = \$1\s+AND tutor_id = \$2/);
  assert.match(serviceSource, /plan\.form\.formId !== input\.formId/);
  assert.match(serviceSource, /plan\.form\.bankVersion !== input\.bankVersion/);
  assert.match(routeSource, /formId: z\.string/);
  assert.match(routeSource, /bankVersion: z\.number/);
});
