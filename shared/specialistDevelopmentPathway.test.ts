import test from "node:test";
import assert from "node:assert/strict";
import {
  addUtcDays,
  deriveSpecialistPathwayTimeline,
} from "./specialistDevelopmentPathway";

const startedAt = "2026-01-01T00:00:00.000Z";

test("the standard Specialist Development Pathway is 75 days with a 90-day maximum", () => {
  const timeline = deriveSpecialistPathwayTimeline({
    status: "active",
    startedAt,
    now: addUtcDays(startedAt, 20),
  });

  assert.equal(timeline.standardEndsAt, addUtcDays(startedAt, 75));
  assert.equal(timeline.maximumEndsAt, addUtcDays(startedAt, 90));
  assert.equal(timeline.state, "standard_active");
});

test("day 75 requires a documented extension rather than silently becoming the normal pathway", () => {
  const timeline = deriveSpecialistPathwayTimeline({
    status: "active",
    startedAt,
    now: addUtcDays(startedAt, 76),
  });

  assert.equal(timeline.state, "extension_required");
  assert.equal(timeline.canContinue, false);
  assert.equal(timeline.canApproveExtension, true);
});

test("an approved extension opens only the remaining time up to day 90", () => {
  const timeline = deriveSpecialistPathwayTimeline({
    status: "active",
    startedAt,
    extensionApprovedAt: addUtcDays(startedAt, 70),
    now: addUtcDays(startedAt, 80),
  });

  assert.equal(timeline.state, "extension_active");
  assert.equal(timeline.daysRemaining, 10);
  assert.equal(timeline.canContinue, true);
});

test("the pathway expires at the 90-day maximum even with an extension", () => {
  const timeline = deriveSpecialistPathwayTimeline({
    status: "active",
    startedAt,
    extensionApprovedAt: addUtcDays(startedAt, 70),
    now: addUtcDays(startedAt, 90),
  });

  assert.equal(timeline.state, "expired");
  assert.equal(timeline.canContinue, false);
});
