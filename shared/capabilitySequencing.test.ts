import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityEvidenceCellState } from "./capabilityEvidenceSelection";
import { buildCapabilityAssessmentAvailability } from "./capabilitySequencing";

const NOW = "2026-09-11T16:00:00Z";

function cell(code: string, satisfiedAt = "2026-09-10T15:00:00Z"): CapabilityEvidenceCellState {
  const [, deepDiveKey, evidenceKind] = code.split(".");
  return {
    code,
    deepDiveKey,
    evidenceKind: evidenceKind as "mastery" | "retrieval" | "transfer",
    satisfiedAt,
    assessmentKey: `${deepDiveKey}_${evidenceKind}_fixture`,
    bankVersion: 1,
    attemptNumber: 1,
  };
}

function statusFor(
  assessmentKey: string,
  options: {
    activeBanks?: Array<{ assessmentKey: string; bankVersion: number; maxAttempts: number; retryCooldownHours: number }>;
    evidenceCells?: CapabilityEvidenceCellState[];
    attempts?: Array<{ assessmentKey: string; bankVersion: number; attemptNumber: number; completedAt: string }>;
    now?: string;
  } = {},
) {
  return buildCapabilityAssessmentAvailability({
    now: options.now || NOW,
    activeBanks: options.activeBanks || [],
    evidenceCells: options.evidenceCells || [],
    attempts: options.attempts || [],
  }).find((entry) => entry.assessmentKey === assessmentKey)!;
}

const transformationDeepDives = [
  "topic_conditioning",
  "clarity",
  "structured_execution",
  "controlled_discomfort",
  "time_pressure_stability",
];

test("missing private bank is unavailable rather than presented as an active assessment", () => {
  const status = statusFor("clarity_mastery_v1");
  assert.equal(status.status, "unavailable");
  assert.equal(status.reason, "bank_unavailable");
});

test("active mastery bank is immediately available when its mastery cell is not complete", () => {
  const status = statusFor("clarity_mastery_v1", {
    activeBanks: [
      { assessmentKey: "clarity_mastery_v1", bankVersion: 1, maxAttempts: 3, retryCooldownHours: 0 },
    ],
  });
  assert.equal(status.status, "available");
  assert.equal(status.bankVersion, 1);
});

test("current evidence makes its planned assessment complete even if that evidence came from another valid assessment", () => {
  const status = statusFor("clarity_mastery_v1", {
    evidenceCells: [cell("deep_dive.clarity.mastery")],
  });
  assert.equal(status.status, "complete");
  assert.equal(status.reason, null);
});

test("retrieval stays locked until every covered mastery cell exists", () => {
  const status = statusFor("transformation_phases_retrieval_v1", {
    activeBanks: [
      { assessmentKey: "transformation_phases_retrieval_v1", bankVersion: 1, maxAttempts: 3, retryCooldownHours: 0 },
    ],
    evidenceCells: transformationDeepDives.slice(0, 4).map((deepDive) => cell(`deep_dive.${deepDive}.mastery`)),
  });
  assert.equal(status.status, "locked");
  assert.equal(status.reason, "prerequisite_missing");
  assert.deepEqual(status.missingPrerequisiteCodes, ["deep_dive.time_pressure_stability.mastery"]);
});

test("retrieval enforces the 24-hour spacing floor from the latest prerequisite mastery", () => {
  const activeBanks = [
    { assessmentKey: "transformation_phases_retrieval_v1", bankVersion: 1, maxAttempts: 3, retryCooldownHours: 0 },
  ];
  const evidenceCells = transformationDeepDives.map((deepDive, index) =>
    cell(
      `deep_dive.${deepDive}.mastery`,
      index === 4 ? "2026-09-11T04:00:00Z" : "2026-09-10T12:00:00Z",
    ),
  );

  const locked = statusFor("transformation_phases_retrieval_v1", {
    activeBanks,
    evidenceCells,
    now: NOW,
  });
  assert.equal(locked.status, "locked");
  assert.equal(locked.reason, "spacing_window");
  assert.equal(locked.unlockAt, "2026-09-12T04:00:00.000Z");

  const available = statusFor("transformation_phases_retrieval_v1", {
    activeBanks,
    evidenceCells,
    now: "2026-09-12T05:00:00Z",
  });
  assert.equal(available.status, "available");
});

test("transfer requires retrieval evidence, not merely mastery evidence", () => {
  const activeBanks = [
    { assessmentKey: "transformation_state_transfer_v1", bankVersion: 1, maxAttempts: 3, retryCooldownHours: 0 },
  ];
  const masteryCells = transformationDeepDives.map((deepDive) => cell(`deep_dive.${deepDive}.mastery`));
  const locked = statusFor("transformation_state_transfer_v1", { activeBanks, evidenceCells: masteryCells });
  assert.equal(locked.status, "locked");
  assert.equal(locked.reason, "prerequisite_missing");
  assert.ok(locked.missingPrerequisiteCodes.every((code) => code.endsWith(".retrieval")));
});

test("rotating a bank resets the attempt budget because only active-bank attempts count", () => {
  const status = statusFor("clarity_mastery_v1", {
    activeBanks: [
      { assessmentKey: "clarity_mastery_v1", bankVersion: 2, maxAttempts: 3, retryCooldownHours: 0 },
    ],
    attempts: [
      { assessmentKey: "clarity_mastery_v1", bankVersion: 1, attemptNumber: 1, completedAt: "2026-09-10T10:00:00Z" },
      { assessmentKey: "clarity_mastery_v1", bankVersion: 1, attemptNumber: 2, completedAt: "2026-09-10T11:00:00Z" },
      { assessmentKey: "clarity_mastery_v1", bankVersion: 1, attemptNumber: 3, completedAt: "2026-09-10T12:00:00Z" },
    ],
  });
  assert.equal(status.status, "available");
  assert.equal(status.attemptCount, 0);
  assert.equal(status.bankVersion, 2);
});

test("current-bank attempt limit locks further attempts", () => {
  const attempts = [1, 2, 3].map((attemptNumber) => ({
    assessmentKey: "clarity_mastery_v1",
    bankVersion: 2,
    attemptNumber,
    completedAt: `2026-09-11T0${attemptNumber}:00:00Z`,
  }));
  const status = statusFor("clarity_mastery_v1", {
    activeBanks: [
      { assessmentKey: "clarity_mastery_v1", bankVersion: 2, maxAttempts: 3, retryCooldownHours: 0 },
    ],
    attempts,
  });
  assert.equal(status.status, "locked");
  assert.equal(status.reason, "attempt_limit");
  assert.equal(status.attemptCount, 3);
});

test("retry cooldown is visible in availability rather than discovered only after clicking", () => {
  const status = statusFor("clarity_mastery_v1", {
    activeBanks: [
      { assessmentKey: "clarity_mastery_v1", bankVersion: 1, maxAttempts: 3, retryCooldownHours: 24 },
    ],
    attempts: [
      { assessmentKey: "clarity_mastery_v1", bankVersion: 1, attemptNumber: 1, completedAt: "2026-09-11T10:00:00Z" },
    ],
    now: NOW,
  });
  assert.equal(status.status, "locked");
  assert.equal(status.reason, "retry_cooldown");
  assert.equal(status.unlockAt, "2026-09-12T10:00:00.000Z");
});
