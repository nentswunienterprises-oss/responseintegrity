import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serviceSource = fs.readFileSync(
  new URL("./capabilityShadowCohort.ts", import.meta.url),
  "utf8",
);
const routeSource = fs.readFileSync(
  new URL("./routes/capabilityShadowCohort.ts", import.meta.url),
  "utf8",
);
const concordanceSource = fs.readFileSync(
  new URL("./capabilityShadowConcordance.ts", import.meta.url),
  "utf8",
);
const serverIndexSource = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const apiIndexSource = fs.readFileSync(new URL("../api/index.ts", import.meta.url), "utf8");

test("shadow cohort candidate discovery includes either pathway instead of selecting only paired successes", () => {
  assert.match(serviceSource, /EXISTS\s*\([\s\S]*battle_test_runs/);
  assert.match(serviceSource, /OR EXISTS\s*\([\s\S]*specialist_capability_assessment_attempts/);
  assert.doesNotMatch(serviceSource, /battle_test_runs[\s\S]*AND EXISTS\s*\([\s\S]*specialist_capability_assessment_attempts/);
});

test("TD cohort discovery is pod-scoped and every member is rechecked by the Sprint 18 reviewer guard", () => {
  assert.match(serviceSource, /reviewerRole === "td"/);
  assert.match(serviceSource, /p\.td_id = \$/);
  assert.match(serviceSource, /buildPersistedShadowConcordanceSnapshot/);
  assert.match(concordanceSource, /assertCapabilityReviewerAccessToAssignment/);
});

test("shadow cohort route is authenticated GET-only", () => {
  assert.match(routeSource, /app\.get\(/);
  assert.match(routeSource, /isAuthenticated/);
  assert.match(routeSource, /\/api\/capability-review\/shadow-cohort/);
  assert.doesNotMatch(routeSource, /app\.(post|put|patch|delete)\(/);
});

test("shadow cohort service contains no evidence or authority mutation", () => {
  for (const source of [serviceSource, routeSource]) {
    assert.doesNotMatch(source, /INSERT\s+INTO/i);
    assert.doesNotMatch(source, /UPDATE\s+[a-z_]/i);
    assert.doesNotMatch(source, /DELETE\s+FROM/i);
    assert.doesNotMatch(source, /\.insert\s*\(/);
    assert.doesNotMatch(source, /\.update\s*\(/);
    assert.doesNotMatch(source, /\.delete\s*\(/);
    assert.doesNotMatch(source, /recordSandboxMockAssessment/);
    assert.doesNotMatch(source, /createTrialCase/);
    assert.doesNotMatch(source, /recordTrialCertificationDecision/);
    assert.doesNotMatch(source, /operational_mode\s*=/i);
    assert.doesNotMatch(source, /certification_status\s*=/i);
    assert.doesNotMatch(source, /student_state\s*=/i);
  }
});

test("cohort aggregation is built from all discovered assignment snapshots before UI filtering", () => {
  assert.match(serviceSource, /for \(const row of candidates\)/);
  assert.match(serviceSource, /members\.push/);
  assert.match(serviceSource, /return buildShadowCohortReview\(members\)/);
  assert.doesNotMatch(serviceSource, /completeness/);
  assert.doesNotMatch(serviceSource, /classification/);
});

test("cohort route is registered in both server runtimes", () => {
  assert.match(serverIndexSource, /registerCapabilityShadowCohortRoutes/);
  assert.match(apiIndexSource, /registerCapabilityShadowCohortRoutes/);
});
