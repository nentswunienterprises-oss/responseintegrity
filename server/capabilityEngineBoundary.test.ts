import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const serviceSource = fs.readFileSync(new URL("./capabilityEngine.ts", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("./routes/capabilityEngine.ts", import.meta.url), "utf8");

test("public assessment projection does not expose answer keys or critical-fail keys", () => {
  const projectionStart = serviceSource.indexOf("export function buildPublicCapabilityAssessment");
  const projectionEnd = serviceSource.indexOf("async function assertTutorAssignmentOwnership", projectionStart);
  assert.notEqual(projectionStart, -1);
  assert.notEqual(projectionEnd, -1);

  const projection = serviceSource.slice(projectionStart, projectionEnd);
  assert.doesNotMatch(projection, /correctOptionKeys/);
  assert.doesNotMatch(projection, /criticalFailOptionKeys/);
  assert.match(projection, /competencyKey/);
  assert.match(projection, /options/);
});

test("all capability endpoints require authenticated Specialist access", () => {
  assert.match(routeSource, /\/api\/tutor\/capability-assessments\/:assessmentKey/);
  assert.match(routeSource, /\/api\/tutor\/capability-ledger/);
  assert.ok((routeSource.match(/isAuthenticated/g) || []).length >= 4);
  assert.match(routeSource, /Specialist access required/);
});

test("attempt persistence is ownership-bound to tutor assignment and authenticated tutor", () => {
  assert.match(serviceSource, /WHERE id = \$1\s+AND tutor_id = \$2/);
  assert.match(serviceSource, /assertTutorAssignmentOwnership\(input\.tutorAssignmentId, input\.tutorId\)/);
});
