import test from "node:test";
import assert from "node:assert/strict";
import { trainingMilestone } from "./training-milestone";
const check = { title: "OS Retention", evidenceKind: "retrieval" as const,
  status: "complete" as const, reason: null, unlockAt: null };

test("Mastery totals alone cannot claim Training completion or Practicals entry", () => {
  const message = trainingMilestone([{ ...check, status: "locked", reason: "spacing_interval", unlockAt: "2026-10-11T09:54:47Z" }]);
  assert.match(message, /OS Retention.*Opens/);
  assert.doesNotMatch(message, /Practicals/);
});
test("complete Training requires the actual Practicals entry and completion decisions", () => {
  assert.match(trainingMilestone([check]), /Checking/);
  assert.match(trainingMilestone([check], "sandbox", { entry: { ready: false }, completion: { complete: false } }), /Continue Sandbox.*TD's approval/);
  assert.match(trainingMilestone([check], "sandbox", { entry: { ready: true }, completion: { complete: false } }), /Demonstrate Prepare, Execute and Evidence/);
  assert.match(trainingMilestone([check], "sandbox", { entry: { ready: true }, completion: { complete: true } }), /Next development milestone: Trial/);
});
test("later lifecycle stages do not send Specialists back to Practicals", () => {
  assert.match(trainingMilestone([check], "trial"), /Certification/);
  assert.match(trainingMilestone([check], "certified_live"), /milestones complete/);
});
test("empty and unavailable records do not claim completion", () => {
  assert.doesNotMatch(trainingMilestone([]), /checks complete/);
  assert.match(trainingMilestone([{ ...check, status: "unavailable" }]), /currently unavailable/);
});
