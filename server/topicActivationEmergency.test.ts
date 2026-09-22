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
  assert.match(routeSource, /requiresTargetedRediagnosis = entry\?\.requiresTargetedRediagnosis === true/);
  assert.match(routeSource, /targetedRediagnosisStartPhase/);
  assert.match(routeSource, /prerequisiteContradictionStatus/);
  assert.match(routeSource, /prerequisiteContradictionReason/);
});
