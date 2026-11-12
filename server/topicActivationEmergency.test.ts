import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("topic activation keeps emergency reads and writes on direct PostgreSQL", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const routeStart = routesSource.indexOf('app.post("/api/tutor/students/:studentId/topic-conditioning"');
  const routeEnd = routesSource.indexOf("ensureStudentForEnrollment = async", routeStart);

  assert.ok(routeStart >= 0, "topic activation route must exist");
  assert.ok(routeEnd > routeStart, "topic activation route must have a stable boundary");

  const routeSource = routesSource.slice(routeStart, routeEnd);
  const emergencyStart = routeSource.indexOf("if (isEmergencyDbMode())");
  const normalStart = routeSource.indexOf('const { data: existingActivations', emergencyStart);

  assert.ok(emergencyStart >= 0, "topic activation must branch for emergency DB mode");
  assert.ok(normalStart > emergencyStart, "normal Supabase path must follow emergency path");

  const emergencyBranch = routeSource.slice(emergencyStart, normalStart);

  assert.match(emergencyBranch, /pool\.query/);
  assert.match(emergencyBranch, /INSERT INTO public\.topic_conditioning_activations/);
  assert.doesNotMatch(emergencyBranch, /supabase\./);
  assert.match(routeSource, /storage\.getStudent\(studentId\)/);
  assert.match(routeSource, /Unauthorized: Student does not belong to this tutor/);
});


test("tutor topic-conditioning read model exposes targeted re-diagnosis authority", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const routeStart = routesSource.indexOf('app.get("/api/tutor/topic-conditioning/:studentId"');
  const routeEnd = routesSource.indexOf("// Get parent reports", routeStart);

  assert.ok(routeStart >= 0, "tutor topic-conditioning read route must exist");
  assert.ok(routeEnd > routeStart, "tutor topic-conditioning read route must have a stable boundary");

  const routeSource = routesSource.slice(routeStart, routeEnd);
  assert.match(
    routeSource,
    /persistedRequiresTargetedRediagnosis =\s*entry\?\.requiresTargetedRediagnosis === true/,
  );
  assert.match(
    routeSource,
    /persistedRequiresTargetedRediagnosis \|\| timingBaselineIncomplete/,
  );
  assert.match(routeSource, /loadLatestTpsTimerContract/);
  assert.match(routeSource, /TPS_TIMER_BASELINE_INCOMPLETE/);
  assert.match(routeSource, /targetedRediagnosisStartPhase/);
  assert.match(routeSource, /prerequisiteContradictionStatus/);
  assert.match(routeSource, /prerequisiteContradictionReason/);
});

test("pending parent-reported topics stay review-only in Start Session and are revalidated at launch", () => {
  const dialogSource = readFileSync(
    resolve(process.cwd(), "client/src/components/tutor/StudentTopicConditioningDialog.tsx"),
    "utf8",
  );

  assert.match(
    dialogSource,
    /const parentReportedTopics = topics\.filter\(\(row\) =>[\s\S]*?row\.parentReported[\s\S]*?!row\.hasObservedState[\s\S]*?!activationTopics\.some/,
    "only unobserved parent reports without explicit activation belong to the review-only set",
  );
  assert.match(
    dialogSource,
    /const pendingParentReportedTopicKeys = new Set\([\s\S]*?parentReportedTopics\.map/,
    "the launch boundary must use the same pending parent-report authority",
  );
  assert.match(
    dialogSource,
    /const sessionEligibleTopics = topics\.filter\([\s\S]*?pendingParentReportedTopicKeys/,
    "session eligibility must exclude pending parent reports",
  );
  assert.match(
    dialogSource,
    /\{sessionEligibleTopics\.map\(\(topic\) => \(/,
    "Start Session must render only eligible topics",
  );

  const launchStart = dialogSource.indexOf("const launchTrainingSession = async (sessionId?: string | null) => {");
  const launchEnd = dialogSource.indexOf("\n  const handleStartTrainingSession", launchStart);
  const launchSource = dialogSource.slice(launchStart, launchEnd);
  assert.ok(launchStart >= 0 && launchEnd > launchStart);
  assert.match(launchSource, /pendingParentReportedTopicKeys\.has/);
  assert.match(launchSource, /noLongerEligibleTopics/);
  assert.match(launchSource, /Parent-reported topics must be reviewed and explicitly activated/);

  assert.match(
    dialogSource,
    /selectedSessionUnknownTopics\.length === selectedSessionPrepPlans\.length &&[\s\S]*?selectedSessionUnknownTopics\.length <= 2/,
    "the existing two-topic sequential entry-diagnosis limit must remain intact",
  );
});
