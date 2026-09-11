import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serviceSource = fs.readFileSync(new URL("./capabilityPracticalEvidence.ts", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("./routes/capabilityPracticalEvidence.ts", import.meta.url), "utf8");
const baseMigrationSource = fs.readFileSync(
  new URL("../migrations/2026-09-11_add_capability_assessment_attempts.sql", import.meta.url),
  "utf8",
);
const rubricMigrationSource = fs.readFileSync(
  new URL("../migrations/2026-09-11_add_capability_practical_review_rubric.sql", import.meta.url),
  "utf8",
);

test("practical evidence requires HTTPS references and explicit sandbox-data confirmation", () => {
  assert.match(serviceSource, /parsed\.protocol !== "https:"/);
  assert.match(serviceSource, /Real student data is not allowed/);
  assert.match(routeSource, /noRealStudentDataConfirmed: z\.literal\(true\)/);
  assert.match(baseMigrationSource, /no_real_student_data_confirmed boolean NOT NULL CHECK \(no_real_student_data_confirmed = true\)/);
});

test("practical submission freezes competency and rubric lineage and never updates historical evidence", () => {
  assert.match(baseMigrationSource, /competency_links jsonb NOT NULL/);
  assert.match(rubricMigrationSource, /rubric_snapshot jsonb/);
  assert.match(serviceSource, /JSON\.stringify\(definition\.competencyLinks\)/);
  assert.match(serviceSource, /snapshotCapabilityPracticalRubric\(definition\.reviewRubric\)/);
  assert.match(serviceSource, /JSON\.stringify\(rubricSnapshot\)/);
  assert.doesNotMatch(serviceSource, /UPDATE specialist_capability_practical_evidence/);
});

test("review rows preserve exact rubric judgments and remain immutable", () => {
  assert.match(baseMigrationSource, /CREATE TABLE IF NOT EXISTS specialist_capability_practical_reviews/);
  assert.match(baseMigrationSource, /evidence_id varchar NOT NULL UNIQUE/);
  assert.match(rubricMigrationSource, /criterion_judgments jsonb/);
  assert.match(rubricMigrationSource, /critical_fail_criterion_keys jsonb/);
  assert.match(serviceSource, /INSERT INTO specialist_capability_practical_reviews/);
  assert.match(serviceSource, /JSON\.stringify\(derived\.criterionReviews\)/);
  assert.doesNotMatch(serviceSource, /UPDATE specialist_capability_practical_reviews/);
});

test("TD review queue and decisions are scoped to the reviewer's assigned pod", () => {
  assert.match(serviceSource, /reviewerRole === "td"/);
  assert.match(serviceSource, /p\.td_id = \$/);
  assert.match(serviceSource, /String\(row\.td_id \|\| ""\) !== input\.reviewerId/);
});

test("API accepts rubric judgments and cannot accept a reviewer-selected outcome", () => {
  const schemaStart = routeSource.indexOf("const practicalReviewSchema");
  const schemaEnd = routeSource.indexOf("function requireSpecialist", schemaStart);
  assert.notEqual(schemaStart, -1);
  assert.notEqual(schemaEnd, -1);
  const reviewSchema = routeSource.slice(schemaStart, schemaEnd);

  assert.match(reviewSchema, /rubricVersion: z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(reviewSchema, /criterionJudgments: z\.array/);
  assert.match(reviewSchema, /judgment: z\.enum\(\["clear", "partial", "fail"\]\)/);
  assert.match(reviewSchema, /\.strict\(\)/);
  assert.doesNotMatch(reviewSchema, /outcome:/);
  assert.doesNotMatch(reviewSchema, /reasonCode:/);
  assert.match(serviceSource, /deriveCapabilityPracticalReview\(access\.rubric, input\.criterionJudgments\)/);
});

test("derived practical outcome and reason code are persisted rather than reviewer input", () => {
  assert.match(serviceSource, /derived\.outcome/);
  assert.match(serviceSource, /derived\.reasonCode/);
  assert.match(serviceSource, /derived\.clearCount/);
  assert.match(serviceSource, /derived\.partialCount/);
  assert.match(serviceSource, /derived\.failCount/);
  assert.match(serviceSource, /derived\.criticalFailCount/);
  assert.doesNotMatch(serviceSource, /input\.outcome/);
  assert.doesNotMatch(serviceSource, /input\.reasonCode/);
});

test("non-approved practical reviews require actionable Specialist feedback", () => {
  assert.match(serviceSource, /derived\.outcome !== "approved"/);
  assert.match(serviceSource, /feedback\.length < 20/);
  assert.match(serviceSource, /Repeat required and integrity review outcomes need at least 20 characters of actionable reviewer feedback/);
});

test("Specialist practical history does not return recording URLs or reviewer rubric internals", () => {
  const start = serviceSource.indexOf("export async function getSpecialistPracticalEvidence");
  const end = serviceSource.indexOf("function assertReviewerRole", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const history = serviceSource.slice(start, end);
  const mapperStart = history.indexOf("return result.rows.map");
  assert.notEqual(mapperStart, -1);
  const publicMapping = history.slice(mapperStart);
  assert.doesNotMatch(publicMapping, /artifactUrl/);
  assert.doesNotMatch(publicMapping, /rubricSnapshot/);
  assert.doesNotMatch(publicMapping, /criterionJudgments/);
  assert.match(publicMapping, /feedback/);
  assert.match(publicMapping, /status/);
  assert.match(publicMapping, /rubricCounts/);
});

test("all practical capability routes require authentication and enforce role boundaries", () => {
  assert.ok((routeSource.match(/isAuthenticated/g) || []).length >= 5);
  assert.match(routeSource, /Specialist access required/);
  assert.match(routeSource, /Capability practical review access is restricted/);
});
