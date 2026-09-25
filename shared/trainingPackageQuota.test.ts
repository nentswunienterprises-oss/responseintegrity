import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateTrainingPackageQuota,
  isPackageBackedTrainingMode,
} from "./trainingPackageQuota";

test("Sandbox and Certified Live are package-backed training modes", () => {
  assert.equal(isPackageBackedTrainingMode("sandbox"), true);
  assert.equal(isPackageBackedTrainingMode("certified_live"), true);
  assert.equal(isPackageBackedTrainingMode("trial"), false);
  assert.equal(isPackageBackedTrainingMode("training"), false);
});

test("package-backed training fails closed when quota is unavailable", () => {
  assert.deepEqual(
    evaluateTrainingPackageQuota("sandbox", null),
    {
      required: true,
      blocked: true,
      code: "PACKAGE_QUOTA_UNAVAILABLE",
      sessionsRemaining: null,
      sessionQuota: null,
      sessionsUsed: null,
    },
  );
});

test("zero remaining sessions blocks Sandbox delivery", () => {
  const decision = evaluateTrainingPackageQuota("sandbox", {
    session_quota: 8,
    sessions_used: 8,
    sessions_remaining: 0,
    status: "active",
  });
  assert.equal(decision.blocked, true);
  assert.equal(decision.code, "PACKAGE_QUOTA_EXHAUSTED");
  assert.equal(decision.sessionsRemaining, 0);
});

test("remaining package capacity permits Sandbox delivery", () => {
  const decision = evaluateTrainingPackageQuota("sandbox", {
    session_quota: 8,
    sessions_used: 6,
    sessions_remaining: 2,
    status: "active",
  });
  assert.equal(decision.blocked, false);
  assert.equal(decision.code, null);
  assert.equal(decision.sessionsRemaining, 2);
});

test("Trial is not accidentally governed by monthly package quota", () => {
  const decision = evaluateTrainingPackageQuota("trial", {
    session_quota: 8,
    sessions_used: 8,
    sessions_remaining: 0,
  });
  assert.equal(decision.required, false);
  assert.equal(decision.blocked, false);
});
