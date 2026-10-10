import assert from "node:assert/strict";
import test from "node:test";
import {
  displayTopicStability,
  hasPhaseConfirmationCheckpoint,
  topicStabilityConfirmationLabel,
  topicStabilityConfirmationExplanation,
} from "./topicStabilityPresentation";

test("public display retains Low, Medium and High without revealing the deprecated checkpoint name", () => {
  for (const value of ["Low", "Medium", "High"]) {
    assert.equal(displayTopicStability(value), value);
    assert.equal(hasPhaseConfirmationCheckpoint(value), false);
    assert.equal(topicStabilityConfirmationLabel(value, "Clarity"), null);
  }
  assert.equal(displayTopicStability(null), "Unknown");
  assert.equal(displayTopicStability(""), "Unknown");
});

test("legacy persisted checkpoint displays High but never conceals separate phase exit validation", () => {
  for (const raw of ["High Maintenance", "high maintenance", "HIGH_MAINTENANCE"]) {
    assert.equal(hasPhaseConfirmationCheckpoint(raw), true);
    assert.equal(displayTopicStability(raw), "High");
    assert.equal(topicStabilityConfirmationLabel(raw, "Clarity"), "Phase-exit confirmation required");
    assert.match(topicStabilityConfirmationExplanation(raw, "Clarity") || "", /separate, later qualifying exit confirmation/);
  }
});

test("TPS final-phase checkpoint requires transfer evidence and does not claim transfer readiness", () => {
  assert.equal(
    topicStabilityConfirmationLabel("High Maintenance", "Time Pressure Stability"),
    "Transfer evidence must be confirmed",
  );
  assert.match(
    topicStabilityConfirmationExplanation("High Maintenance", "Time Pressure Stability") || "",
    /does not authorize a transfer claim/,
  );
});
