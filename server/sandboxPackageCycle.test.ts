import test from "node:test";
import assert from "node:assert/strict";
import {
  nextSandboxCycleKey,
  selectAuthoritativeSandboxCycle,
  verifySandboxCycleConsumption,
} from "./sandboxPackageCycle";

const cycle = (overrides: Record<string, unknown> = {}) => ({
  id: "cycle-1",
  parent_id: "parent-a",
  student_id: "student-a",
  month_key: "2026-05-01",
  created_at: "2026-05-27T08:01:00Z",
  is_sandbox: true,
  status: "active",
  session_quota: 8,
  sessions_used: 4,
  sessions_remaining: 4,
  ...overrides,
});

const select = (rows: unknown) => selectAuthoritativeSandboxCycle(rows, "parent-a", "student-a");

test("May Sandbox balance remains authoritative in October without calendar rollover", () => {
  const latest = select([cycle()]);
  assert.deepEqual(
    [latest?.month_key, latest?.session_quota, latest?.sessions_used, latest?.sessions_remaining],
    ["2026-05-01", 8, 4, 4],
  );
  assert.deepEqual(verifySandboxCycleConsumption(latest, 4), latest);
});

test("more recent explicit virtual cycle supersedes older cycle", () => {
  const older = cycle({ sessions_used: 8, sessions_remaining: 0 });
  const renewed = cycle({ id: "cycle-2", month_key: "2026-06-01", sessions_used: 1, sessions_remaining: 7 });
  const latest = select([older, renewed]);
  assert.equal(latest?.id, "cycle-2");
  assert.equal(nextSandboxCycleKey(latest?.month_key), "2026-07-01");
});

test("exhausted package retains zero remaining until explicit renewal", () => {
  const exhausted = select([cycle({ sessions_used: 8, sessions_remaining: 0 })]);
  assert.equal(exhausted?.sessions_remaining, 0);
  assert.equal(verifySandboxCycleConsumption(exhausted, 8)?.sessions_remaining, 0);
});

test("missing or internally contradictory Sandbox membership fails closed", () => {
  assert.equal(select([]), null);
  assert.equal(select([cycle({ status: "cancelled" })]), null);
  assert.equal(select([cycle({ session_quota: 8, sessions_used: 4, sessions_remaining: 8 })]), null);
  assert.equal(select([cycle({ sessions_used: null })]), null);
  assert.equal(select([cycle({ session_quota: -8 })]), null);
  assert.equal(select([cycle({ month_key: "bad" })]), null);
  assert.equal(select([cycle({ month_key: "2026-10-20" })]), null);
});

test("unknown, crossed-student, live-family or malformed rows cannot authorize a package", () => {
  assert.equal(select([cycle({ student_id: "student-b" })]), null);
  assert.equal(select([cycle({ parent_id: "parent-b" })]), null);
  assert.equal(select([cycle({ is_sandbox: false })]), null);
  assert.equal(select([cycle({ is_sandbox: undefined })]), null);
  assert.equal(select([cycle(), cycle()]), null);
  assert.equal(select(null), null);
});

test("newer blocked cycle never resurrects an older package", () => {
  const old = cycle();
  const unavailableNew = cycle({ month_key: "2026-06-01", status: "closed" });
  assert.equal(select([old, unavailableNew]), null);
  assert.equal(select([old, cycle({ month_key: "2026-06-01", sessions_remaining: 99 })]), null);
});

test("unrecorded consumption or stale snapshots stay unavailable rather than estimated", () => {
  const latest = select([cycle()]);
  assert.equal(verifySandboxCycleConsumption(latest, 5), null);
  assert.equal(verifySandboxCycleConsumption(latest, 3), null);
  assert.equal(verifySandboxCycleConsumption(latest, Number.NaN), null);
  assert.equal(verifySandboxCycleConsumption(latest, 4)?.sessions_remaining, 4);
});

test("explicit renewal cycle increments its key independent of today's date", () => {
  assert.equal(nextSandboxCycleKey("2026-05-01"), "2026-06-01");
  assert.equal(nextSandboxCycleKey("2026-12-01"), "2027-01-01");
  assert.equal(nextSandboxCycleKey("2026-10-20"), null);
  assert.equal(nextSandboxCycleKey(null), null);
  assert.equal(nextSandboxCycleKey("9998-12-01"), null);
});
