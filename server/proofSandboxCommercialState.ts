import {
  RESPONSE_INTEGRITY_SESSION_SHARE_ZAR,
  SESSION_PRICE_ZAR,
  SPECIALIST_SESSION_SHARE_ZAR,
  getMonthlyServicePackage,
} from "@shared/servicePackages";
import { supabase } from "./storage";

type SyntheticUsageEvent = {
  key: string;
  eventAt: string;
};

type PreviewSandboxIntegrityEnv = {
  VERCEL_ENV?: string;
};

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function monthStartIso(reference = new Date()) {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1)).toISOString();
}

function monthKeyFromIso(value: string) {
  return value.slice(0, 10);
}

function parseStoredDrill(value: unknown): any {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function isTrainingDrill(row: any) {
  const payload = parseStoredDrill(row?.drill);
  const drillType = normalize(
    payload?.drillType ||
      payload?.sessionContextKind ||
      (row?.training_session_run_id ? "training" : ""),
  );
  return drillType === "training";
}

export function isPreviewSyntheticSandboxPaidStage(
  enrollment: any,
  env: PreviewSandboxIntegrityEnv = process.env,
) {
  if (normalize(env.VERCEL_ENV) !== "preview") return false;
  if (enrollment?.is_sandbox_account !== true) return false;

  const parentEmail = normalize(enrollment?.parent_email);
  const parentName = normalize(enrollment?.parent_full_name);
  const studentName = normalize(enrollment?.student_full_name);
  const syntheticIdentity =
    (parentEmail.startsWith("sandbox-parent-") && parentEmail.endsWith("@gmail.com")) ||
    parentName.startsWith("sandbox ") ||
    studentName.startsWith("sandbox ");
  if (!syntheticIdentity) return false;

  const status = normalize(enrollment?.status);
  const step = normalize(enrollment?.current_step);
  return (
    ["session_booked", "report_received", "confirmed"].includes(status) ||
    step === "active_training" ||
    step.startsWith("handover_")
  );
}

export function deriveSyntheticRenewalBoundary(
  events: SyntheticUsageEvent[],
  intendedUsed: number,
  nowIso = new Date().toISOString(),
) {
  const latestByKey = new Map<string, number>();
  for (const event of events) {
    const key = String(event?.key || "").trim();
    const time = new Date(event?.eventAt || "").getTime();
    if (!key || !Number.isFinite(time)) continue;
    latestByKey.set(key, Math.max(latestByKey.get(key) || 0, time));
  }

  const latestTimes = Array.from(latestByKey.values()).sort((a, b) => b - a);
  const desired = Math.max(0, Math.floor(Number(intendedUsed) || 0));
  if (latestTimes.length <= desired) return null;
  if (desired === 0) return nowIso;

  const newestExcluded = latestTimes[desired];
  const oldestIncluded = latestTimes[desired - 1];
  if (!Number.isFinite(newestExcluded) || !Number.isFinite(oldestIncluded)) return null;
  if (oldestIncluded <= newestExcluded) return null;

  return new Date(Math.floor((newestExcluded + oldestIncluded) / 2)).toISOString();
}

async function loadUsageEvents(parentId: string, studentId: string, startIso: string, endIso: string) {
  const [scheduledResult, runResult, drillResult] = await Promise.all([
    supabase
      .from("scheduled_sessions")
      .select("id, scheduled_time")
      .eq("parent_id", parentId)
      .eq("student_id", studentId)
      .eq("type", "training")
      .eq("status", "completed")
      .gte("scheduled_time", startIso)
      .lt("scheduled_time", endIso),
    supabase
      .from("training_session_runs")
      .select("id, scheduled_session_id, submitted_at, status")
      .eq("student_id", studentId)
      .in("status", ["submitted", "completed"])
      .gte("submitted_at", startIso)
      .lt("submitted_at", endIso),
    supabase
      .from("intro_session_drills")
      .select("id, scheduled_session_id, training_session_run_id, drill, submitted_at")
      .eq("student_id", studentId)
      .gte("submitted_at", startIso)
      .lt("submitted_at", endIso),
  ]);

  const errors = [scheduledResult.error, runResult.error, drillResult.error].filter(Boolean);
  if (errors.length > 0) {
    throw errors[0];
  }

  const events: SyntheticUsageEvent[] = [];
  for (const row of scheduledResult.data || []) {
    if (!row?.id || !row?.scheduled_time) continue;
    events.push({ key: `training:${row.id}`, eventAt: row.scheduled_time });
  }
  for (const row of runResult.data || []) {
    if (!row?.submitted_at) continue;
    const scheduledId = String(row?.scheduled_session_id || "").trim();
    const runId = String(row?.id || "").trim();
    if (!scheduledId && !runId) continue;
    events.push({
      key: scheduledId ? `training:${scheduledId}` : `training-run:${runId}`,
      eventAt: row.submitted_at,
    });
  }
  for (const row of drillResult.data || []) {
    if (!row?.submitted_at || !isTrainingDrill(row)) continue;
    const scheduledId = String(row?.scheduled_session_id || "").trim();
    const runId = String(row?.training_session_run_id || "").trim();
    const drillId = String(row?.id || "").trim();
    if (!scheduledId && !runId && !drillId) continue;
    events.push({
      key: scheduledId
        ? `training:${scheduledId}`
        : runId
          ? `training:${runId}`
          : `training-drill:${drillId}`,
      eventAt: row.submitted_at,
    });
  }
  return events;
}

async function upsertSyntheticPaidPayment(options: {
  enrollment: any;
  studentId: string;
  merchantReference: string;
  paidAt: string;
  renewal: boolean;
  note: string;
}) {
  const servicePackage = getMonthlyServicePackage(options.enrollment?.package_key);
  const packageAmount = servicePackage.sessionsPerMonth * SESSION_PRICE_ZAR;
  const row = {
    parent_id: String(options.enrollment.user_id),
    enrollment_id: String(options.enrollment.id),
    proposal_id: options.enrollment.proposal_id || null,
    student_id: options.studentId,
    tutor_id: options.enrollment.assigned_tutor_id || null,
    provider: "payfast",
    merchant_reference: options.merchantReference,
    plan: "Premium",
    amount: packageAmount,
    currency: "ZAR",
    payment_status: "paid",
    payment_date: options.paidAt,
    paid_at: options.paidAt,
    tutor_share: servicePackage.sessionsPerMonth * SPECIALIST_SESSION_SHARE_ZAR,
    platform_share: servicePackage.sessionsPerMonth * RESPONSE_INTEGRITY_SESSION_SHARE_ZAR,
    item_name: `Response Integrity ${servicePackage.sessionsPerMonth}-session sandbox package${options.renewal ? " renewal" : ""}`,
    item_description: options.note,
    raw_payload: {
      payfast_mode: "sandbox",
      sandbox_checkout: true,
      synthetic_reconciliation: true,
      processor_charge_occurred: false,
      proof_fixture: true,
      renewal: options.renewal,
    },
    package_key: servicePackage.key,
    package_sessions: servicePackage.sessionsPerMonth,
    planned_sessions_per_week: servicePackage.plannedSessionsPerWeek,
    session_price: SESSION_PRICE_ZAR,
    created_at: options.paidAt,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("payment_transactions")
    .upsert(row, { onConflict: "merchant_reference", ignoreDuplicates: true });
  if (error) throw error;
}

export async function ensurePreviewSandboxFixtureCommercialState(options: {
  enrollment: any;
  studentId: string | null | undefined;
}) {
  if (normalize(process.env.VERCEL_ENV) !== "preview") {
    return { repaired: false, reason: "not_preview" as const };
  }

  const enrollmentId = String(options.enrollment?.id || "").trim();
  const studentId = String(options.studentId || "").trim();
  if (!enrollmentId || !studentId) {
    return { repaired: false, reason: "missing_identity" as const };
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("parent_enrollments")
    .select("id, user_id, proposal_id, assigned_tutor_id, status, current_step, is_sandbox_account, parent_email, parent_full_name, student_full_name, package_key, package_sessions, planned_sessions_per_week")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (enrollmentError) throw enrollmentError;
  if (!enrollment || !isPreviewSyntheticSandboxPaidStage(enrollment)) {
    return { repaired: false, reason: "not_eligible" as const };
  }

  const parentId = String(enrollment.user_id || "").trim();
  if (!parentId) {
    return { repaired: false, reason: "missing_parent" as const };
  }

  const now = new Date();
  const startIso = monthStartIso(now);
  const monthKey = monthKeyFromIso(startIso);
  const nowIso = now.toISOString();
  const servicePackage = getMonthlyServicePackage(enrollment.package_key);

  let { data: membership, error: membershipError } = await supabase
    .from("membership_months")
    .select("*")
    .eq("parent_id", parentId)
    .eq("student_id", studentId)
    .eq("month_key", monthKey)
    .eq("is_sandbox", true)
    .maybeSingle();
  if (membershipError) throw membershipError;

  const usageEvents = await loadUsageEvents(parentId, studentId, startIso, nowIso);
  const distinctUsageCount = new Set(usageEvents.map((event) => event.key)).size;

  if (!membership) {
    const inferredUsed =
      distinctUsageCount === 0
        ? 0
        : ((distinctUsageCount - 1) % servicePackage.sessionsPerMonth) + 1;
    const { data: inserted, error } = await supabase
      .from("membership_months")
      .insert({
        parent_id: parentId,
        student_id: studentId,
        enrollment_id: enrollmentId,
        month_start: monthKey,
        month_key: monthKey,
        package_key: servicePackage.key,
        planned_sessions_per_week: servicePackage.plannedSessionsPerWeek,
        session_price: SESSION_PRICE_ZAR,
        specialist_per_session_amount: SPECIALIST_SESSION_SHARE_ZAR,
        platform_per_session_amount: RESPONSE_INTEGRITY_SESSION_SHARE_ZAR,
        specialist_earned_amount: 0,
        specialist_payable_amount: 0,
        payout_status: "accruing",
        session_quota: servicePackage.sessionsPerMonth,
        sessions_used: inferredUsed,
        sessions_remaining: Math.max(0, servicePackage.sessionsPerMonth - inferredUsed),
        status: "active",
        is_sandbox: true,
        created_at: startIso,
        updated_at: nowIso,
      })
      .select("*")
      .maybeSingle();
    if (error) throw error;
    membership = inserted;
  }

  if (!membership) {
    return { repaired: false, reason: "membership_unavailable" as const };
  }

  const quota = Math.max(1, Number(membership.session_quota || servicePackage.sessionsPerMonth));
  const intendedUsed = Math.max(0, Math.min(quota, Number(membership.sessions_used || 0)));

  const { data: paidRows, error: paidError } = await supabase
    .from("payment_transactions")
    .select("id, paid_at, raw_payload")
    .eq("parent_id", parentId)
    .eq("provider", "payfast")
    .eq("payment_status", "paid")
    .order("paid_at", { ascending: false })
    .limit(20);
  if (paidError) throw paidError;

  const paid = paidRows || [];
  const hasPaidAuthority = paid.length > 0;
  const currentMonthRenewal = paid.find((row: any) => {
    const paidAt = String(row?.paid_at || "");
    return paidAt >= startIso && row?.raw_payload?.renewal === true;
  });

  let repaired = false;
  if (!hasPaidAuthority) {
    const anchor = String(membership.created_at || startIso);
    await upsertSyntheticPaidPayment({
      enrollment,
      studentId,
      merchantReference: `proof-sandbox-entitlement-${monthKey}-${enrollmentId}`,
      paidAt: anchor >= startIso ? anchor : startIso,
      renewal: false,
      note: "Preview-only synthetic payment authority restored for a progressed sandbox fixture.",
    });
    repaired = true;
  }

  if (!currentMonthRenewal && distinctUsageCount > intendedUsed && intendedUsed < quota) {
    const boundary = deriveSyntheticRenewalBoundary(usageEvents, intendedUsed, nowIso);
    if (boundary) {
      await upsertSyntheticPaidPayment({
        enrollment,
        studentId,
        merchantReference: `proof-sandbox-renewal-${monthKey}-${enrollmentId}-used-${intendedUsed}`,
        paidAt: boundary,
        renewal: true,
        note: `Preview-only synthetic renewal boundary preserving fixture quota state ${intendedUsed}/${quota}.`,
      });
      repaired = true;
    }
  }

  if (!membership.enrollment_id || String(membership.enrollment_id) !== enrollmentId) {
    const { error } = await supabase
      .from("membership_months")
      .update({ enrollment_id: enrollmentId, updated_at: nowIso })
      .eq("id", membership.id);
    if (error) throw error;
    repaired = true;
  }

  return {
    repaired,
    reason: repaired ? "reconciled" as const : "already_consistent" as const,
    intendedUsed,
    quota,
    distinctUsageCount,
  };
}
