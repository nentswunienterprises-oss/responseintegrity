import assert from "node:assert/strict";
import test from "node:test";
import { normalizeScheduledInstant, normalizeScheduledTimeZone } from "./bookingTimezone";

test("normalizes explicit ISO instants without changing the instant", () => {
  assert.equal(normalizeScheduledInstant("2026-11-07T14:30:00+02:00"), "2026-11-07T12:30:00.000Z");
  assert.equal(normalizeScheduledInstant("2026-11-07T12:30:00.000Z"), "2026-11-07T12:30:00.000Z");
});

test("rejects timezone-less, malformed, and impossible timestamps", () => {
  assert.equal(normalizeScheduledInstant("2026-11-07T14:30:00"), null);
  assert.equal(normalizeScheduledInstant("2026-02-30T14:30:00Z"), null);
  assert.equal(normalizeScheduledInstant("not-a-date"), null);
});

test("accepts valid IANA zones and rejects invalid zones", () => {
  assert.equal(normalizeScheduledTimeZone("Africa/Johannesburg"), "Africa/Johannesburg");
  assert.equal(normalizeScheduledTimeZone("Not/A_Timezone"), null);
  assert.equal(normalizeScheduledTimeZone(undefined), "Africa/Johannesburg");
});
