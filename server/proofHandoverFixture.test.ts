import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";

test("Proof Handover reset is Preview-only, authenticated, and Sandbox-scoped", () => {
  const source = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const start = source.indexOf('"/api/proof/handover-fixture/reset"');
  const end = source.indexOf('"/api/proof/training-fixture/reset"', start);
  const route = source.slice(start, end);

  assert.ok(start >= 0);
  assert.ok(end > start);
  assert.match(route, /isAuthenticated/);
  assert.match(route, /requireRole\(\["tutor"\]\)/);
  assert.match(route, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(route, /is_sandbox_account/);
  assert.match(route, /assignment_lane/);
  assert.match(route, /handoverRequiredAt/);
  assert.match(route, /handoverCompletedAt:\s*null/);
  assert.match(route, /restoreCanonicalState/);
  assert.match(route, /proof_fixture_reset/);
  assert.match(route, /requiresTargetedRediagnosis:\s*false/);
  assert.match(route, /targetedRediagnosisStartPhase:\s*null/);
  assert.match(route, /concept_mastery = \$3::jsonb/);
  assert.match(route, /type,[\s\S]*?'handover'/);
  assert.match(route, /status,[\s\S]*?'confirmed'/);
});

test("Handover completion selects one latest session even after repeated Proof runs", () => {
  const source = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const start = source.indexOf('"/api/tutor/students/:studentId/workflow/handover-completed"');
  const end = source.indexOf("app.get(", start);
  const route = source.slice(start, end);

  assert.match(
    route,
    /\.eq\("type", "handover"\)[\s\S]*?\.order\("created_at", \{ ascending: false \}\)[\s\S]*?\.limit\(1\)[\s\S]*?\.maybeSingle\(\)/,
  );
});


test("Proof Training reset is Preview-only, authenticated, Sandbox-scoped, and repeatable", () => {
  const source = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const start = source.indexOf('"/api/proof/training-fixture/reset"');
  const end = source.indexOf("const persistEvidenceLedgerShadow", start);
  const route = source.slice(start, end);

  assert.ok(start >= 0);
  assert.ok(end > start);
  assert.match(route, /isAuthenticated/);
  assert.match(route, /requireRole\(\["tutor"\]\)/);
  assert.match(route, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(route, /is_sandbox_account/);
  assert.match(route, /assignment_lane/);
  assert.match(route, /requestedRequiresTargetedRediagnosis/);
  assert.match(route, /requestedTargetedRediagnosisStartPhase/);
  assert.match(route, /requiresTargetedRediagnosis:\s*requestedRequiresTargetedRediagnosis/);
  assert.match(route, /targetedRediagnosisStartPhase:[\s\S]*?requestedTargetedRediagnosisStartPhase/);
  assert.match(route, /purpose:\s*"repeatable_training_live_proof"/);
  assert.match(route, /concept_mastery = \$2::jsonb/);
  assert.match(route, /'training'/);
  assert.match(route, /INTERVAL '2 hours'/);
  assert.match(route, /parent_confirmed/);
  assert.match(route, /tutor_confirmed/);
});
