import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serviceSource = fs.readFileSync(new URL("./capabilityPracticalEvidence.ts", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("./routes/capabilityPracticalEvidence.ts", import.meta.url), "utf8");
const migrationSource = fs.readFileSync(
  new URL("../migrations/2026-09-11_add_capability_assessment_attempts.sql", import.meta.url),
  "utf8",
);

test("practical evidence requires HTTPS references and explicit sandbox-data confirmation", () => {
  assert.match(serviceSource, /parsed\.protocol !== "https:"/);
  assert.match(serviceSource, /Real student data is not allowed/);
  assert.match(routeSource, /noRealStudentDataConfirmed: z\.literal\(true\)/);
  assert.match(migrationSource, /no_real_student_data_confirmed boolean NOT NULL CHECK \(no_real_student_data_confirmed = true\)/);
});

test("practical submission freezes competency lineage and never updates historical evidence", () => {
  assert.match(migrationSource, /competency_links jsonb NOT NULL/);
  assert.match(serviceSource, /JSON\.stringify\(definition\.competencyLinks\)/);
  assert.doesNotMatch(serviceSource, /UPDATE specialist_capability_practical_evidence/);
});

test("review decisions are immutable rows separate from Specialist evidence", () => {
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS specialist_capability_practical_reviews/);
  assert.match(migrationSource, /evidence_id varchar NOT NULL UNIQUE/);
  assert.match(serviceSource, /INSERT INTO specialist_capability_practical_reviews/);
  assert.doesNotMatch(serviceSource, /UPDATE specialist_capability_practical_reviews/);
});

test("TD review queue and decisions are scoped to the reviewer's assigned pod", () => {
  assert.match(serviceSource, /reviewerRole === "td"/);
  assert.match(serviceSource, /p\.td_id = \$/);
  assert.match(serviceSource, /String\(row\.td_id \|\| ""\) !== input\.reviewerId/);
});

test("only explicit practical review outcomes are accepted", () => {
  assert.match(routeSource, /z\.enum\(\["approved", "repeat_required", "integrity_review"\]\)/);
  assert.match(serviceSource, /repeat_required" \|\| input\.outcome === "integrity_review/);
  assert.match(serviceSource, /Reviewer feedback is required/);
});

test("Specialist practical history does not return recording URLs", () => {
  const start = serviceSource.indexOf("export async function getSpecialistPracticalEvidence");
  const end = serviceSource.indexOf("function assertReviewerRole", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const history = serviceSource.slice(start, end);
  const mapperStart = history.indexOf("return result.rows.map");
  assert.notEqual(mapperStart, -1);
  const publicMapping = history.slice(mapperStart);
  assert.doesNotMatch(publicMapping, /artifactUrl/);
  assert.match(publicMapping, /feedback/);
  assert.match(publicMapping, /status/);
});

test("all practical capability routes require authentication and enforce role boundaries", () => {
  assert.ok((routeSource.match(/isAuthenticated/g) || []).length >= 5);
  assert.match(routeSource, /Specialist access required/);
  assert.match(routeSource, /Capability practical review access is restricted/);
});
