import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateTrainingPackageQuota,
  isPackageBackedTrainingMode,
  resolveTrainingPackageProgressSummary,
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

test("Sandbox package progress uses the membership balance instead of the historical completed-session count", () => {
  assert.deepEqual(
    resolveTrainingPackageProgressSummary({
      session_quota: 8,
      sessions_used: 4,
      sessions_remaining: 4,
    }),
    { sessionQuota: 8, sessionsUsed: 4, sessionsRemaining: 4 },
  );
  assert.deepEqual(
    resolveTrainingPackageProgressSummary({
      session_quota: 12,
      sessions_used: 7,
      sessions_remaining: 5,
    }),
    { sessionQuota: 12, sessionsUsed: 7, sessionsRemaining: 5 },
  );
});

test("Sandbox package progress never manufactures usage from history or inconsistent membership data", () => {
  assert.equal(resolveTrainingPackageProgressSummary(null), null);
  assert.equal(
    resolveTrainingPackageProgressSummary({
      session_quota: 8,
      sessions_used: 1,
      sessions_remaining: 4,
    }),
    null,
  );
  assert.equal(
    resolveTrainingPackageProgressSummary({
      session_quota: 8,
      sessions_used: undefined,
      sessions_remaining: 4,
    }),
    null,
  );
  assert.equal(
    resolveTrainingPackageProgressSummary({
      session_quota: 8,
      sessions_used: 8,
      sessions_remaining: -1,
    }),
    null,
  );
  assert.equal(
    resolveTrainingPackageProgressSummary({
      session_quota: 0,
      sessions_used: 0,
      sessions_remaining: 0,
    }),
    null,
  );
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


test("Training tab distinguishes no booking from commercial blockage", async () => {
  const { resolveTrainingTabAvailability } = await import("./trainingPackageQuota");

  assert.deepEqual(
    resolveTrainingTabAvailability({
      operationalMode: "sandbox",
      paymentRequired: true,
      monthlyQuota: null,
      actionableSessionCount: 0,
    }),
    {
      code: "PAYMENT_REQUIRED",
      blocked: true,
      title: "Payment required before booking",
      message: "The parent has not completed the package payment required to book training sessions.",
    },
  );

  const renewal = resolveTrainingTabAvailability({
    operationalMode: "sandbox",
    paymentRequired: false,
    monthlyQuota: {
      session_quota: 8,
      sessions_used: 8,
      sessions_remaining: 0,
    },
    actionableSessionCount: 0,
  });
  assert.equal(renewal.code, "RENEWAL_REQUIRED");
  assert.equal(renewal.blocked, true);

  const noBooking = resolveTrainingTabAvailability({
    operationalMode: "sandbox",
    paymentRequired: false,
    monthlyQuota: {
      session_quota: 8,
      sessions_used: 3,
      sessions_remaining: 5,
    },
    actionableSessionCount: 0,
  });
  assert.equal(noBooking.code, "NO_SESSIONS_BOOKED");
  assert.equal(noBooking.blocked, false);
  assert.equal(noBooking.title, "No current lessons booked");
  assert.match(noBooking.message, /5 package sessions remaining/);
  assert.match(noBooking.message, /Previously completed lessons remain in history/);

  const booked = resolveTrainingTabAvailability({
    operationalMode: "sandbox",
    paymentRequired: false,
    monthlyQuota: {
      session_quota: 8,
      sessions_used: 3,
      sessions_remaining: 5,
    },
    actionableSessionCount: 2,
  });
  assert.equal(booked.code, "SESSIONS_BOOKED");
});
