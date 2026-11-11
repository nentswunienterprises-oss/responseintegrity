import assert from "node:assert/strict";
import test from "node:test";
import { formatScheduledSessionTime } from "./scheduledSessionTime";

test("formats the stored instant in its saved South African timezone using 24-hour time", () => {
  const formatted = formatScheduledSessionTime("2026-11-07T12:30:00.000Z", "Africa/Johannesburg");
  assert.match(formatted, /14:30/);
  assert.doesNotMatch(formatted, /16:30/);
});

test("invalid stored times are reported without attempting a local conversion", () => {
  assert.equal(formatScheduledSessionTime("not-a-date", "Africa/Johannesburg"), "Time unavailable");
});
