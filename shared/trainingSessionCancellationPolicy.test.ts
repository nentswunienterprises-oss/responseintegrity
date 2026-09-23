import test from "node:test";
import assert from "node:assert/strict";

import {
  cancellationNeedsReplacement,
  deriveTrainingSessionCancellationDisposition,
} from "./trainingSessionCancellationPolicy";

test("early parent cancellation preserves the replacement obligation", () => {
  assert.equal(
    deriveTrainingSessionCancellationDisposition({
      actorRole: "parent",
      reasonCodes: ["student_unavailable"],
      eventType: "cancelled_early_parent",
      billingImpact: "none",
    }),
    "replacement_required",
  );
});

test("late parent cancellation closes the slot when the credit is consumed", () => {
  assert.equal(
    deriveTrainingSessionCancellationDisposition({
      actorRole: "parent",
      reasonCodes: ["student_unavailable"],
      eventType: "cancelled_late_parent",
      billingImpact: "consume",
    }),
    "closed_consumed",
  );
});

test("specialist-side cancellation preserves the replacement obligation", () => {
  assert.equal(
    deriveTrainingSessionCancellationDisposition({
      actorRole: "tutor",
      reasonCodes: ["tutor_unavailable"],
      eventType: "cancelled_late_tutor",
      billingImpact: "none",
    }),
    "replacement_required",
  );
});

test("legacy schedule-conflict cancellations remain recoverable", () => {
  assert.equal(
    deriveTrainingSessionCancellationDisposition({
      actorRole: "parent",
      reasonCodes: ["schedule_conflict"],
      eventType: "cancelled_early_parent",
      billingImpact: "none",
    }),
    "replacement_required",
  );
});

test("old specialist cancellation on behalf of a parent is not guessed", () => {
  assert.equal(
    deriveTrainingSessionCancellationDisposition({
      actorRole: "tutor",
      reasonCodes: ["parent_requested_cancellation"],
      eventType: "cancelled_late_tutor",
      billingImpact: "none",
    }),
    "manual_review",
  );
});

test("replacement helper only accepts explicit replacement-required state", () => {
  assert.equal(cancellationNeedsReplacement("replacement_required"), true);
  assert.equal(cancellationNeedsReplacement("closed_consumed"), false);
  assert.equal(cancellationNeedsReplacement("manual_review"), false);
});
