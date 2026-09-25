import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";

const commercialStateSource = readFileSync(
  resolve(process.cwd(), "server/proofSandboxCommercialState.ts"),
  "utf8",
);
const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");

test("Proof sandbox commercial reconciliation is Preview-only and synthetic-only", () => {
  assert.match(commercialStateSource, /VERCEL_ENV/);
  assert.match(commercialStateSource, /"preview"/);
  assert.match(commercialStateSource, /is_sandbox_account !== true/);
  assert.match(commercialStateSource, /sandbox-parent-/);
  assert.match(commercialStateSource, /parentName\.startsWith\("sandbox "\)/);
  assert.match(commercialStateSource, /studentName\.startsWith\("sandbox "\)/);
  assert.match(commercialStateSource, /step === "active_training"/);
  assert.match(commercialStateSource, /step\.startsWith\("handover_"\)/);
});

test("Proof reconciliation restores payment authority instead of bypassing it", () => {
  assert.match(commercialStateSource, /provider: "payfast"/);
  assert.match(commercialStateSource, /payment_status: "paid"/);
  assert.match(commercialStateSource, /processor_charge_occurred: false/);
  assert.match(commercialStateSource, /proof_fixture: true/);
  assert.match(commercialStateSource, /synthetic_reconciliation: true/);
  assert.match(commercialStateSource, /renewal: options\.renewal/);
  assert.doesNotMatch(commercialStateSource, /FREE_ACCESS/);
});

test("Proof reconciliation preserves seeded quota state with renewal lineage", () => {
  assert.match(commercialStateSource, /deriveSyntheticRenewalBoundary/);
  assert.match(commercialStateSource, /distinctUsageCount > intendedUsed/);
  assert.match(commercialStateSource, /intendedUsed < quota/);
  assert.match(commercialStateSource, /raw_payload\?\.renewal === true/);
  assert.match(commercialStateSource, /sessions_used: inferredUsed/);
  assert.match(commercialStateSource, /sessions_remaining: Math\.max/);
});

test("parent access and Specialist pod reconcile before quota/payment projection", () => {
  const helper = "ensurePreviewSandboxFixtureCommercialState";
  assert.ok(routesSource.includes(helper));

  const podQuota = routesSource.indexOf("Failed to load tutor pod monthly quota snapshot");
  const podRepair = routesSource.lastIndexOf(helper, podQuota);
  const podSnapshot = routesSource.lastIndexOf("getMonthlySessionQuotaSnapshot", podQuota);
  assert.ok(podRepair >= 0 && podSnapshot >= 0 && podRepair < podSnapshot);

  const parentTraining = routesSource.indexOf('app.get("/api/parent/training-sessions"');
  const parentPaymentCheck = routesSource.indexOf("ensurePremiumAccessForParent", parentTraining);
  const parentRepair = routesSource.lastIndexOf(helper, parentPaymentCheck);
  assert.ok(parentRepair > parentTraining && parentRepair < parentPaymentCheck);
});
