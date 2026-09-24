import test from "node:test";
import assert from "node:assert/strict";
import { buildCapabilityMasteryAvailability } from "./capabilityMasterySequencing";

const plan = [
  {
    assessmentKey: "clarity_mastery_v1",
    title: "Clarity Mastery Check",
    evidenceKind: "mastery" as const,
    coveredDeepDiveKeys: ["clarity"],
    formSize: 15,
    minimumItemPoolSize: 45,
    passThresholdPercent: 96,
    minimumDelayHours: 0,
    criticalCoverageMode: "all_boundaries" as const,
    purpose: "test",
  },
  {
    assessmentKey: "logging_system_mastery_v1",
    title: "Logging System Mastery Check",
    evidenceKind: "mastery" as const,
    coveredDeepDiveKeys: ["logging_system"],
    formSize: 15,
    minimumItemPoolSize: 45,
    passThresholdPercent: 96,
    minimumDelayHours: 0,
    criticalCoverageMode: "all_boundaries" as const,
    purpose: "test",
  },
];

test("inactive mastery banks stay unavailable while active approved banks can run", () => {
  const result = buildCapabilityMasteryAvailability({
    now: "2026-09-24T12:00:00Z",
    plan,
    activeBanks: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 8,
        maxAttempts: 3,
        retryCooldownHours: 0,
      },
    ],
    attempts: [],
  });

  assert.equal(result[0].status, "available");
  assert.equal(result[0].bankVersion, 8);
  assert.equal(result[1].status, "unavailable");
  assert.equal(result[1].reason, "bank_unavailable");
});

test("a current-version pass completes a mastery bank", () => {
  const result = buildCapabilityMasteryAvailability({
    now: "2026-09-24T12:00:00Z",
    plan: [plan[0]],
    activeBanks: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 8,
        maxAttempts: 3,
        retryCooldownHours: 0,
      },
    ],
    attempts: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 8,
        attemptNumber: 1,
        passed: true,
        completedAt: "2026-09-24T11:00:00Z",
      },
    ],
  });

  assert.equal(result[0].status, "complete");
});

test("stale-version passes do not complete a rotated bank", () => {
  const result = buildCapabilityMasteryAvailability({
    now: "2026-09-24T12:00:00Z",
    plan: [plan[0]],
    activeBanks: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 8,
        maxAttempts: 3,
        retryCooldownHours: 0,
      },
    ],
    attempts: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 7,
        attemptNumber: 1,
        passed: true,
        completedAt: "2026-09-24T11:00:00Z",
      },
    ],
  });

  assert.equal(result[0].status, "available");
  assert.equal(result[0].attemptCount, 0);
});

test("attempt limits and cooldowns lock without inventing prerequisites", () => {
  const limited = buildCapabilityMasteryAvailability({
    now: "2026-09-24T12:00:00Z",
    plan: [plan[0]],
    activeBanks: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 8,
        maxAttempts: 1,
        retryCooldownHours: 0,
      },
    ],
    attempts: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 8,
        attemptNumber: 1,
        passed: false,
        completedAt: "2026-09-24T11:00:00Z",
      },
    ],
  });
  assert.equal(limited[0].status, "locked");
  assert.equal(limited[0].reason, "attempt_limit");

  const cooldown = buildCapabilityMasteryAvailability({
    now: "2026-09-24T12:00:00Z",
    plan: [plan[0]],
    activeBanks: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 8,
        maxAttempts: 3,
        retryCooldownHours: 2,
      },
    ],
    attempts: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 8,
        attemptNumber: 1,
        passed: false,
        completedAt: "2026-09-24T11:00:00Z",
      },
    ],
  });
  assert.equal(cooldown[0].status, "locked");
  assert.equal(cooldown[0].reason, "retry_cooldown");
  assert.equal(cooldown[0].unlockAt, "2026-09-24T13:00:00.000Z");
});
