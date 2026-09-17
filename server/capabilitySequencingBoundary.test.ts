import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sequencingService = fs.readFileSync(new URL("./capabilitySequencing.ts", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("./routes/capabilityEngine.ts", import.meta.url), "utf8");
const bankSource = fs.readFileSync(new URL("./capabilityBank.ts", import.meta.url), "utf8");
const readinessSource = fs.readFileSync(new URL("./capabilityReadiness.ts", import.meta.url), "utf8");

test("capability plan status is built from active private banks and current assignment evidence", () => {
  assert.match(sequencingService, /private\.specialist_capability_assessment_configs/);
  assert.match(sequencingService, /specialist_capability_assessment_attempts/);
  assert.match(sequencingService, /selectCurrentPassingCapabilityAssessments/);
  assert.match(sequencingService, /buildCurrentCapabilityEvidenceCellStates/);
  assert.match(sequencingService, /buildCapabilityAssessmentAvailability/);
});

test("form issuance and submission both enforce sequencing before assessment execution", () => {
  assert.match(routeSource, /\/api\/tutor\/capability-plan/);
  assert.ok((routeSource.match(/assertCapabilityAssessmentAvailable/g) || []).length >= 3);

  const getRouteStart = routeSource.indexOf('"/api/tutor/capability-assessments/:assessmentKey"');
  const postRouteStart = routeSource.indexOf('"/api/tutor/capability-assessments/:assessmentKey/attempt"');
  assert.notEqual(getRouteStart, -1);
  assert.notEqual(postRouteStart, -1);

  const getRoute = routeSource.slice(getRouteStart, postRouteStart);
  assert.match(getRoute, /assertCapabilityAssessmentAvailable/);
  assert.match(getRoute, /prepareCapabilityAssessmentForm/);
  assert.ok(getRoute.indexOf("assertCapabilityAssessmentAvailable") < getRoute.indexOf("prepareCapabilityAssessmentForm"));

  const postRoute = routeSource.slice(postRouteStart);
  assert.match(postRoute, /assertCapabilityAssessmentAvailable/);
  assert.match(postRoute, /persistCapabilityAssessmentAttempt/);
  assert.ok(postRoute.indexOf("assertCapabilityAssessmentAvailable") < postRoute.indexOf("persistCapabilityAssessmentAttempt"));
});

test("bank-version rotation resets only the attempt budget, not historical evidence", () => {
  assert.match(bankSource, /AND bank_version = \$3/);
  assert.match(bankSource, /getAttemptState\([\s\S]*config\.bankVersion/);
  assert.doesNotMatch(bankSource, /DELETE FROM specialist_capability_assessment_attempts/);
});

test("sequencing and readiness remain shadow-only and cannot mutate operational authority", () => {
  for (const source of [sequencingService, readinessSource]) {
    assert.doesNotMatch(source, /UPDATE tutor_assignments/);
    assert.doesNotMatch(source, /certification_status/);
    assert.doesNotMatch(source, /operational_mode/);
    assert.doesNotMatch(source, /trial_status/);
  }
});

test("legacy Sprint 1-7 assessments are not silently reinterpreted as official MVP plan entries", () => {
  assert.match(sequencingService, /getCapabilityMvpAssessmentPlanEntry/);
  assert.match(sequencingService, /if \(!planEntry\) return null/);
});
