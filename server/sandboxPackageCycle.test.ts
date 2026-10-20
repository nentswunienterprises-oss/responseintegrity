import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  projectSandboxBalance,
  readSandboxCycle,
  selectSandboxCycle,
  type SandboxMembership,
  type SandboxDbReader,
} from "./sandboxPackageCycle";

const parentId = "parent-controlled-A";
const studentId = "student-controlled-A";
const oldCycle: SandboxMembership = {
  id: "cycle-1", parent_id: parentId, student_id: studentId,
  is_sandbox: true, status: "active",
  month_start: "2026-05-01", month_key: "2026-05-01",
  session_quota: 8, sessions_used: 4, sessions_remaining: 4,
};
function reader(
  memberships: unknown[] = [oldCycle],
  renewal: Record<string, unknown> | null = null,
  usage: Record<string, unknown> = { completed_used: 4, unlinked_billed_used: 0 },
) {
  const statements: Array<{ sql: string; values: any[] }> = [];
  const db: SandboxDbReader = {
    async query(sql, values) {
      statements.push({ sql, values });
      assert.match(sql.trim(), /^(SELECT|WITH)\b/);
      assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO|public|FROM|TABLE)\b/i);
      assert.equal(values[0], parentId);
      assert.equal(values[1], studentId);
      if (sql.includes("FROM public.membership_months")) return { rows: memberships };
      if (sql.includes("WITH renewed AS")) return { rows: renewal ? [renewal] : [] };
      if (sql.includes("WITH completed_keys AS")) return { rows: [usage] };
      throw new Error("Unexpected query");
    },
  };
  return { db, statements };
}

test("May Sandbox entitlement remains valid in October; four accepted sessions stay four", async () => {
  const fake = reader();
  const result = await readSandboxCycle(fake.db, parentId, studentId);
  assert.equal(result?.simulated_package_cycle, true);
  assert.equal(result?.month_key, "2026-05-01");
  assert.equal(result?.cycle_started_at, "2026-05-01T00:00:00.000Z");
  assert.equal(result?.sessions_used, 4);
  assert.equal(result?.sessions_remaining, 4);
  assert.equal(result?.session_quota, 8);
  assert.equal(fake.statements.length, 3);
  assert.deepEqual(fake.statements[2].values, [parentId, studentId, "2026-05-01T00:00:00.000Z"]);
  assert.ok(!fake.statements.some(({sql}) => /NOW\(\)|CURRENT_DATE|date_trunc\('month'/.test(sql)));
});

test("missing package is unavailable, not automatically replenished", async () => {
  const fake = reader([]);
  assert.equal(await readSandboxCycle(fake.db, parentId, studentId), null);
  assert.equal(fake.statements.length, 1);
});

test("read never queries another parent's or student's entitlements", async () => {
  const fake = reader([{ ...oldCycle, parent_id: "other-parent" }]);
  assert.equal(await readSandboxCycle(fake.db, parentId, studentId), null);
  assert.equal(fake.statements.length, 1);
  const crossStudent = reader([{ ...oldCycle, student_id: "other-student" }]);
  assert.equal(await readSandboxCycle(crossStudent.db, parentId, studentId), null);
  assert.equal(crossStudent.statements.length, 1);
  assert.equal(await readSandboxCycle(reader().db, "", studentId), null);
});

test("latest suspended cycle cannot fall back to older active package", () => {
  const last = { ...oldCycle, id: "cycle-new", month_key: "2026-09-01", month_start: "2026-09-01", status: "cancelled" };
  assert.equal(selectSandboxCycle([last, oldCycle], { parentId, studentId }), null);
  assert.equal(selectSandboxCycle([{ ...oldCycle, is_sandbox: false }], { parentId, studentId }), null);
  assert.equal(selectSandboxCycle([oldCycle, oldCycle], { parentId, studentId }), null);
});

test("contradictory, fabricated, or malformed membership rows cannot produce a balance", () => {
  for (const invalid of [
    { ...oldCycle, sessions_remaining: 8 },
    { ...oldCycle, sessions_used: null },
    { ...oldCycle, session_quota: 0 },
    { ...oldCycle, session_quota: 9 },
    { ...oldCycle, month_start: "2026-05-18" },
  ]) {
    assert.equal(selectSandboxCycle([invalid], { parentId, studentId }), null);
  }
});

test("accepted new sessions increase usage without mutating the stored cycle", async () => {
  const original = { ...oldCycle };
  const fake = reader([oldCycle], null, { completed_used: 5, unlinked_billed_used: 0 });
  const snapshot = await readSandboxCycle(fake.db, parentId, studentId);
  assert.equal(snapshot?.sessions_used, 5);
  assert.equal(snapshot?.sessions_remaining, 3);
  assert.deepEqual(oldCycle, original);
});

test("fully consumed cycle is exhausted and never loops back to eight available", async () => {
  const fake = reader([oldCycle], null, { completed_used: 8, unlinked_billed_used: 0 });
  const snapshot = await readSandboxCycle(fake.db, parentId, studentId);
  assert.equal(snapshot?.sessions_remaining, 0);
  assert.equal(snapshot?.sessions_used, 8);
});

test("explicit simulated paid renewal starts a new usage boundary, not a calendar reset", async () => {
  const receipt = { renewed_at: "2026-10-20T05:00:00.000Z", renewed_quota: 8 };
  const fake = reader([oldCycle], receipt, { completed_used: 2, unlinked_billed_used: 0 });
  const result = await readSandboxCycle(fake.db, parentId, studentId);
  assert.equal(result?.sessions_used, 2);
  assert.equal(result?.sessions_remaining, 6);
  assert.equal(result?.cycle_started_at, receipt.renewed_at);
  assert.deepEqual(fake.statements[2].values, [parentId, studentId, receipt.renewed_at]);
});

test("renewal with no new accepted sessions has zero usage, not stale historic four", async () => {
  const fake = reader([oldCycle], { renewed_at: "2026-10-20T05:00:00Z", renewed_quota: 8 }, { completed_used: 0, unlinked_billed_used: 0 });
  const result = await readSandboxCycle(fake.db, parentId, studentId);
  assert.equal(result?.sessions_used, 0);
  assert.equal(result?.sessions_remaining, 8);
});

test("unmatched upgraded renewal package must not silently inherit old quota", () => {
  const source = selectSandboxCycle([oldCycle], { parentId, studentId })!;
  assert.equal(projectSandboxBalance(source, {
    renewedQuota: 12, renewalAt: "2026-10-20T05:00:00Z", completedUsed: 0, unlinkedBilledUsed: 0,
  }), null);
  assert.equal(projectSandboxBalance(source, {
    completedUsed: 9, unlinkedBilledUsed: 0,
  }), null);
});

test("unlinked billing consumption counts once; source counts may not be guessed", async () => {
  const fake = reader([oldCycle], null, { completed_used: 4, unlinked_billed_used: 1 });
  const result = await readSandboxCycle(fake.db, parentId, studentId);
  assert.equal(result?.sessions_used, 5);
  assert.equal(result?.sessions_remaining, 3);
  const sql = fake.statements[2].sql;
  assert.match(sql, /UNION/); // same real session appears once across session/run/drill
  assert.match(sql, /NOT EXISTS/); // billed session already in canonical keys not double-counted
  assert.match(sql, /is_sandbox = TRUE/);
  assert.doesNotMatch(sql, /\bNOW\(\)|\bCURRENT_DATE/);
});

test("backend query errors propagate rather than becoming a valid zero-session package", async () => {
  const fake: SandboxDbReader = { async query() { throw new Error("permission denied"); } };
  await assert.rejects(readSandboxCycle(fake, parentId, studentId), /permission denied/);
});

test("route uses simulated authority across Specialist / Parent and preserves live real-month path", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const head = routes.indexOf("async function getMonthlySessionQuotaSnapshot(");
  const tail = routes.indexOf("// detect whether this parent/student should use sandbox membership row", head);
  const text = routes.slice(head, tail);
  assert.match(text, /options.isSandboxContext === true && usesDirectProofSessionDatabase\(\)/);
  assert.match(text, /return readSandboxCycle\(pool, options.parentId, String\(options.studentId\)\)/);
  assert.ok(text.indexOf("return readSandboxCycle") < text.indexOf("getMonthStartIso(options.referenceIso"));
  assert.match(text, /month_key = \$3 AND is_sandbox = \$4/); // real-family calendar path retained
  const sessions = routes.slice(routes.indexOf('"/api/tutor/students/:studentId/training-sessions"'));
  assert.match(sessions, /requireRole\(\["tutor"\]\)/);
  assert.match(sessions, /getTrainingPackageQuotaAuthority/);
  assert.match(routes, /isSandboxContext && !monthlyQuota/); // parent booking also fails closed
  assert.match(routes, /operationalMode === "sandbox"/);
});

test("simulated billing events never provision a new wall-month package", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const a = routes.indexOf("async function recordSessionBillingEvent(");
  const b = routes.indexOf("function isMissingAssignedStudentIdError(", a);
  const code = routes.slice(a, b);
  assert.ok(a >= 0 && b > a);
  assert.match(code, /const simulatedEvent = isSandboxEvent && usesDirectProofSessionDatabase\(\)/);
  assert.match(code, /if \(!simulatedEvent\) \{\s*await upsertMembershipMonth/);
  assert.match(code, /simulatedEvent\s*\?\s*readSandboxCycle\(pool, options\.parentId, options\.studentId\)/);
  assert.match(code, /if \(simulatedEvent\) \{\s*const truth = await readSandboxCycle/);
  assert.match(code, /options.billingImpact === "consume" \|\| options.billingImpact === "restore"/);
  assert.match(code, /AND is_sandbox = TRUE/);
});

test("simulated paid renewal preserves its cycle key and uses per-payment event identity", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const renewal = routes.slice(routes.indexOf('app.post("/api/parent/payments/renew"'));
  assert.match(renewal, /if \(isSandboxContext && !monthlyQuota\)/);
  assert.match(renewal, /isSandboxContext \? String\(monthlyQuota\?\.month_key \|\| ""\) : calendarMonthKey/);
  assert.match(renewal, /existingRenewalPayment && !isSandboxContext/);
  assert.match(routes, /sessionId: isSandboxTransaction \? /);
  assert.equal((routes.match(/sandbox-renewal-/g) || []).length, 2);
});

test("Preview-only fixture reconciliation never provisions next calendar month over an active cycle", () => {
  const fixture = readFileSync("server/proofSandboxCommercialState.ts", "utf8");
  assert.match(fixture, /if \(normalize\(process\.env\.VERCEL_ENV\) !== "preview"\)/);
  assert.match(fixture, /\.eq\("is_sandbox", true\)\s*\.order\("month_key", \{ ascending: false \}\)/);
  assert.match(fixture, /const monthKey = membership\?\.month_key \|\| monthKeyFromIso\(startIso\)/);
});

test("real family month-bound quota and three access boundaries remain intact", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const snapshot = routes.slice(
    routes.indexOf("async function getMonthlySessionQuotaSnapshot("),
    routes.indexOf("function trainingPackageQuotaMessage("),
  );
  assert.match(snapshot, /if \(options.isSandboxContext === true && usesDirectProofSessionDatabase\(\)\)/);
  assert.match(snapshot, /month_key = \$3 AND is_sandbox = \$4/);
  const tutor = routes.slice(
    routes.indexOf('"/api/tutor/students/:studentId/training-sessions"'),
    routes.indexOf('app.post(', routes.indexOf('"/api/tutor/students/:studentId/training-sessions"')),
  );
  assert.match(tutor, /requireRole\(\["tutor"\]\)/);
  assert.match(tutor, /getTrainingPackageQuotaAuthority/);
  assert.match(routes, /code: "PACKAGE_AUTHORITY_UNAVAILABLE"/);
  assert.match(routes, /code: "PACKAGE_QUOTA_EXHAUSTED"/);
});
