import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityEvidenceCellState } from "./capabilityEvidenceSelection";
import { buildCapabilityAssessmentAvailability } from "./capabilitySequencing";

function cell(code: string, satisfiedAt = "2026-09-10T08:00:00Z"): CapabilityEvidenceCellState {
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

const deepDives = [
  "topic_conditioning",
  "clarity",
  "structured_execution",
  "controlled_discomfort",
  "time_pressure_stability",
];

test("transfer remains locked if current mastery disappears even when retrieval evidence still exists", () => {
  const evidenceCells = [
    ...deepDives.filter((deepDive) => deepDive !== "clarity").map((deepDive) => cell(`deep_dive.${deepDive}.mastery`)),
    ...deepDives.map((deepDive) => cell(`deep_dive.${deepDive}.retrieval`)),
  ];

  const status = buildCapabilityAssessmentAvailability({
    now: "2026-09-12T12:00:00Z",
    activeBanks: [
      {
        assessmentKey: "transformation_state_transfer_v1",
        bankVersion: 1,
        maxAttempts: 3,
        retryCooldownHours: 0,
      },
    ],
    evidenceCells,
    attempts: [],
  }).find((entry) => entry.assessmentKey === "transformation_state_transfer_v1");

  assert.ok(status);
  assert.equal(status.status, "locked");
  assert.equal(status.reason, "prerequisite_missing");
  assert.ok(status.missingPrerequisiteCodes.includes("deep_dive.clarity.mastery"));
});
