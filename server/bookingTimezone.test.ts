import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
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


test("timezone migration preserves server-only security and complete session view projection", () => {
  const migration = readFileSync("migrations/20261109_scheduled_session_timezone_instants.sql", "utf8");
  const viewStart = migration.indexOf("CREATE VIEW public.scheduled_sessions_with_names");
  const viewEnd = migration.indexOf("CREATE OR REPLACE FUNCTION public.capture_tutor_trial_first_session_v2");
  assert.ok(viewStart >= 0 && viewEnd > viewStart);
  const viewSql = migration.slice(viewStart, viewEnd);
  assert.match(viewSql, /WITH \(security_invoker = true\)/);
  assert.match(viewSql, /SELECT\s+ss\.\*/);
  assert.match(viewSql, /REVOKE ALL PRIVILEGES[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(viewSql, /GRANT SELECT[\s\S]*TO service_role/);
  assert.doesNotMatch(viewSql, /GRANT ALL PRIVILEGES[\s\S]*TO anon, authenticated/);
});
