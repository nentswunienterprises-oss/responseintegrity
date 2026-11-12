import assert from "node:assert/strict";
import test from "node:test";
import { getTrainingSessionWeekKey, isScheduledTrainingSessionUpcoming } from "./trainingSessionWeek";

test("uses the saved IANA timezone when assigning a session to its Monday week", () => {
  assert.equal(getTrainingSessionWeekKey("2026-11-08T22:30:00.000Z", "Africa/Johannesburg"), "2026-11-09");
  assert.equal(getTrainingSessionWeekKey("2026-11-08T22:30:00.000Z", "UTC"), "2026-11-02");
});

test("invalid session dates return no week key and invalid zones fall back safely", () => {
  assert.equal(getTrainingSessionWeekKey("not-a-date", "Africa/Johannesburg"), null);
  assert.equal(getTrainingSessionWeekKey("2026-11-08T22:30:00.000Z", "Not/A_Zone"), "2026-11-09");
});

test("past confirmed bookings are not treated as upcoming lessons", () => {
  const now = Date.parse("2026-11-12T09:00:00.000Z");
  assert.equal(isScheduledTrainingSessionUpcoming("2026-10-02T13:00:00.000Z", now), false);
  assert.equal(isScheduledTrainingSessionUpcoming("2026-10-28T13:00:00.000Z", now), false);
  assert.equal(isScheduledTrainingSessionUpcoming("2026-11-13T13:00:00.000Z", now), true);
});

test("missing and invalid scheduled timestamps cannot launch as upcoming lessons", () => {
  const now = Date.parse("2026-11-12T09:00:00.000Z");
  assert.equal(isScheduledTrainingSessionUpcoming(null, now), false);
  assert.equal(isScheduledTrainingSessionUpcoming("not-a-date", now), false);
});
