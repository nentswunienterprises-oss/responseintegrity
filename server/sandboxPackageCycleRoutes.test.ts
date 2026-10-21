import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("server/routes.ts", "utf8");
const source = (begin: string, end: string) => {
  const start = routes.indexOf(begin);
  const stop = routes.indexOf(end, start + begin.length);
  assert.ok(start >= 0 && stop > start, "expected route boundary missing");
  return routes.slice(start, stop);
};

test("Sandbox package read chooses stored cycle, not current UTC month", () => {
  const src = source("async function getMonthlySessionQuotaSnapshot(", "type TrainingPackageQuotaAuthority =");
  assert.match(src, /isSandbox[\s\S]*SELECT \*[\s\S]*WHERE parent_id::text = \$1::text AND student_id::text = \$2::text[\s\S]*is_sandbox = TRUE[\s\S]*ORDER BY month_key DESC, created_at DESC[\s\S]*LIMIT 2/);
  assert.match(src, /selectAuthoritativeSandboxCycle\(result\.rows, options\.parentId, options\.studentId\)/);
  assert.match(src, /selectAuthoritativeSandboxCycle\(data, options\.parentId, options\.studentId\)/);
  assert.ok(src.includes("if (isSandbox && !verifySandboxCycleConsumption(row, actualConsumed)) return null;"));
  assert.ok(src.includes("if (!isSandbox && ("));
  assert.ok(src.includes("if (isSandboxContext === true) {"));
  const proofRead = source("  if (isSandboxContext === true) {", "  let { data: row } = await supabase");
  assert.doesNotMatch(proofRead, /\.insert\(|\.update\(|upsertMembershipMonth|recalculateMembershipMonthUsage/);
});

test("real family retains calendar-month quota, payment logic, and reconciler", () => {
  const src = source("async function getMonthlySessionQuotaSnapshot(", "type TrainingPackageQuotaAuthority =");
  assert.ok(src.includes("AND month_key = $3 AND is_sandbox = FALSE"));
  assert.ok(src.includes('.eq("month_key", monthKey)'));
  assert.ok(src.includes("if (!isSandbox && ("));
  assert.match(src, /!isSandbox[\s\S]*UPDATE public\.membership_months/);
});

test("Specialist quota and launch authority resolve through shared package getter", () => {
  const getter = source("async function getTrainingPackageQuotaAuthority(", "function trainingPackageQuotaMessage(");
  assert.match(getter, /getMonthlySessionQuotaSnapshot\(/);
  assert.match(getter, /String\(options\.operationalMode \|\| ""\)\.trim\(\)\.toLowerCase\(\) === "sandbox"/);
  const tutor = source('"/api/tutor/students/:studentId/training-sessions"', '"/api/tutor/students/:studentId/training-sessions",');
  assert.match(tutor, /requireRole\(\["tutor"\]\)/);
  assert.match(tutor, /Student does not belong to this tutor/);
  assert.match(tutor, /getTrainingPackageQuotaAuthority\(/);
  assert.match(tutor, /applyTrainingPackageQuotaToLaunch/);
});

test("parent booking blocks missing Sandbox authority and exhaustion", () => {
  const snippet = source(
    "Sandbox package-cycle authority cannot be verified. Booking remains blocked.",
    "const parsedSlots = rawSlots",
  );
  assert.match(snippet, /if \(monthlyQuota && Number\(monthlyQuota\.sessions_remaining \|\| 0\) <= 0\)/);
  assert.match(snippet, /Simulated package exhausted/);
  assert.match(snippet, /const currentMonthKey = toMonthKey/);
});

test("parent renewal is explicit, not triggered by calendar rollover", () => {
  const snippet = source('app.post("/api/parent/payments/renew"', "let existingRenewalPaymentQuery");
  assert.match(snippet, /if \(useSandbox\)/);
  assert.match(snippet, /if \(!monthlyQuota\)/);
  assert.match(snippet, /nextSandboxCycleKey\(monthlyQuota\.month_key\)/);
  assert.match(snippet, /monthKey = nextCycleKey/);
});

test("Sandbox consumption paths remain student-scoped and read side is write-free", () => {
  const src = source("async function getMonthlySessionQuotaSnapshot(", "type TrainingPackageQuotaAuthority =");
  assert.match(src, /AND student_id::text = \$2::text/);
  assert.match(src, /AND is_sandbox = TRUE/);
  assert.match(src, /COALESCE\(ARRAY_AGG\(usage_key\), ARRAY\[\]::text\[\]\)/);
  assert.match(src, /completedKeys\.has/);
});

test("Sandbox simulated completion and renewal windows are not capped by the actual clock", () => {
  const src = source("async function getMonthlySessionQuotaSnapshot(", "type TrainingPackageQuotaAuthority =");
  assert.ok(src.includes('const evidenceUpperBoundIso = isSandbox ? "9999-12-31T23:59:59.999Z" : nowIso'));
  assert.ok(src.includes('const nextMonthIso = isSandbox ? evidenceUpperBoundIso : nextMonth.toISOString()'));
  assert.ok(src.includes('activatedAt && activatedAt < cycleStartIso'));
  assert.ok(src.includes('usageWindowStart, evidenceUpperBoundIso'));
});

test("Sandbox billing reconciler includes completed future-dated simulated events", () => {
  const src = source("async function recalculateMembershipMonthUsage(", "async function recordSessionBillingEvent(");
  assert.ok(src.includes('const evidenceUpperBoundIso = options.isSandbox'));
  assert.match(src, /\.lt\("scheduled_time", evidenceUpperBoundIso\)/);
  assert.match(src, /\.lt\("submitted_at", evidenceUpperBoundIso\)/);
  assert.match(src, /\.lt\("effective_at", evidenceUpperBoundIso\)/);
});

test("Preview fixture retains the simulated cycle and does not grant another month", () => {
  const preview = readFileSync("server/proofSandboxCommercialState.ts", "utf8");
  const lookup = preview.slice(
    preview.indexOf("const now = new Date();"),
    preview.indexOf("const usageEvents = await loadUsageEvents("),
  );
  assert.ok(lookup.includes("selectAuthoritativeSandboxCycle(existingCycles, parentId, studentId)"));
  assert.ok(lookup.includes('.eq("is_sandbox", true)'));
  assert.ok(lookup.includes('.order("month_key", { ascending: false })'));
  assert.ok(lookup.includes("existingCycles.length > 0 && !membership"));
  assert.ok(lookup.includes('reason: "membership_unavailable"'));
  assert.ok(lookup.includes('String(membership.month_key) + "T00:00:00.000Z"'));
  assert.doesNotMatch(lookup, /\.eq\("month_key",\s*monthKey\)/);
  assert.doesNotMatch(lookup, /\.insert\(|\.update\(/);
  assert.ok(preview.includes('normalize(process.env.VERCEL_ENV) !== "preview"'));
  assert.ok(preview.includes('const evidenceUpperBoundIso = "9999-12-31T23:59:59.999Z"'));
  assert.ok(preview.includes("loadUsageEvents(parentId, studentId, startIso, evidenceUpperBoundIso)"));
  assert.ok(preview.includes("latestTimes[0] + 1"));
  assert.ok(preview.includes('student_id.eq.${studentId},enrollment_id.eq.${enrollmentId}'));
  assert.ok(preview.includes('normalize(process.env.VERCEL_ENV) !== "preview"'));

});


test("targeted re-diagnosis consumes a package session only after scoped completed evidence", () => {
  const source = readFileSync("server/evidenceCompleteDiagnosisRoutes.ts", "utf8");
  const begin = source.indexOf("async function completeScheduledTrainingSessionAfterDiagnosis(");
  const finish = source.indexOf("const canonicalJson = canonicalizeEvidenceJson;", begin);
  assert.ok(begin >= 0 && finish > begin);
  const completion = source.slice(begin, finish);
  assert.match(completion, /await client\.query\("BEGIN"\)/);
  assert.match(completion, /FOR UPDATE OF session/);
  assert.match(completion, /enrollment\.is_sandbox_account/);
  assert.match(completion, /enrollment_parent_id/);
  assert.match(completion, /enrollment_tutor_id/);
  assert.match(completion, /run\.status = 'completed'/);
  assert.match(completion, /run\.activity_kind = 'targeted_rediagnosis'/);
  assert.match(completion, /public\.intro_session_drills/);
  assert.match(completion, /public\.response_integrity_evidence_ledger/);
  assert.match(completion, /selectAuthoritativeSandboxCycle/);
  assert.match(completion, /existingConsumption\.rows\.length === 0/);
  assert.match(completion, /sandbox_targeted_rediagnosis_completed/);
  assert.match(completion, /'consume', 1/);
  assert.match(completion, /WHERE NOT EXISTS/);
  assert.match(completion, /sessions_used = sessions_used \+ 1/);
  assert.match(completion, /sessions_remaining = sessions_remaining - 1/);
  assert.match(completion, /'training_progression_earned', FALSE/);
  assert.match(completion, /'specialist_accrual_eligible', FALSE/);
  assert.match(completion, /await client\.query\("COMMIT"\)/);
  assert.match(completion, /await client\.query\("ROLLBACK"\)/);
  assert.doesNotMatch(completion, /INSERT INTO public\.membership_months|UPDATE public\.specialist_package_payouts|specialist_earned_amount/);
  const callback = source.slice(source.indexOf("sessionResult.activityKind ==="));
  assert.match(callback, /completeScheduledTrainingSessionAfterDiagnosis\(/);
  assert.match(callback, /runId,/);
});
