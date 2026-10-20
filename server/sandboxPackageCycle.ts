/**
 * Sandbox package authority is a simulated cycle, not a wall-calendar month.
 * Legacy month_key identifies a stored cycle only; it must not expire
 * merely because the actual date crossed into another month.
 *
 * Read-only, server-side projection. Never synthesize payment or credits.
 */
export type SandboxDbReader = {
  query: (sql: string, values: any[]) => Promise<{ rows: any[] }>;
};
export type SandboxMembership = {
  id: string;
  parent_id: string;
  student_id: string;
  month_key: string;
  month_start: string | Date;
  status: string;
  is_sandbox: boolean;
  session_quota: number;
  sessions_used: number;
  sessions_remaining: number;
  [key: string]: unknown;
};
export type SandboxCycleSnapshot = SandboxMembership & {
  simulated_package_cycle: true;
  cycle_started_at: string;
};

function integerOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
function exactMonthStart(value: unknown): string | null {
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-01$/.test(date)) return null;
  const parsed = new Date(date + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(date)
    ? parsed.toISOString() : null;
}

/** Latest cycle is authoritative; do not fall back to a cancelled earlier row. */
export function selectSandboxCycle(
  rows: unknown,
  identity: { parentId: string; studentId: string },
): { membership: SandboxMembership; startIso: string } | null {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 2) return null;
  const [row, previous] = rows as Array<Partial<SandboxMembership>>;
  if (!row || row.is_sandbox !== true || row.status !== "active" || !row.id) return null;
  if (String(row.parent_id) !== identity.parentId || String(row.student_id) !== identity.studentId) return null;
  if (previous && String(row.month_key) === String(previous.month_key)) return null;
  const startIso = exactMonthStart(row.month_start);
  if (!startIso || String(row.month_key) !== startIso.slice(0, 10)) return null;
  const quota = integerOrNull(row.session_quota);
  const used = integerOrNull(row.sessions_used);
  const remaining = integerOrNull(row.sessions_remaining);
  if (quota === null || ![8, 12, 16].includes(quota) ||
      used === null || remaining === null || used + remaining !== quota) return null;
  return {
    membership: { ...row, session_quota: quota, sessions_used: used, sessions_remaining: remaining } as SandboxMembership,
    startIso,
  };
}

/** A renewal restarts the cycle. Prior use cannot carry across the boundary. */
export function projectSandboxBalance(
  source: { membership: SandboxMembership; startIso: string },
  opts: {
    renewalAt?: string | null;
    renewedQuota?: number | null;
    completedUsed: unknown;
    unlinkedBilledUsed: unknown;
  },
): SandboxCycleSnapshot | null {
  const { membership, startIso } = source;
  const renewedMs = opts.renewalAt ? Date.parse(opts.renewalAt) : null;
  if (opts.renewalAt && (renewedMs === null || !Number.isFinite(renewedMs) || renewedMs < Date.parse(startIso))) return null;
  const renewed = renewedMs !== null && renewedMs > Date.parse(startIso);
  if (opts.renewedQuota != null && (!Number.isSafeInteger(opts.renewedQuota) || opts.renewedQuota !== membership.session_quota)) {
    return null; // New size needs a matching persisted package entitlement.
  }
  const completedUsed = integerOrNull(opts.completedUsed);
  const unlinkedBilledUsed = integerOrNull(opts.unlinkedBilledUsed);
  if (completedUsed === null || unlinkedBilledUsed === null) return null;
  const observed = completedUsed + unlinkedBilledUsed;
  const used = renewed ? observed : Math.max(membership.sessions_used, observed);
  if (!Number.isSafeInteger(used) || used > membership.session_quota) return null;
  return {
    ...membership,
    sessions_used: used,
    sessions_remaining: membership.session_quota - used,
    simulated_package_cycle: true,
    cycle_started_at: renewed ? new Date(renewedMs!).toISOString() : startIso,
  };
}

const MEMBERSHIP_SQL = [
  "SELECT * FROM public.membership_months",
  " WHERE parent_id::text = $1::text AND student_id::text = $2::text",
  " AND is_sandbox = TRUE",
  " ORDER BY month_key DESC, created_at DESC LIMIT 2",
].join("\n");

const RENEWAL_SQL = [
  "WITH renewed AS (",
  " SELECT p.paid_at AS renewed_at, p.package_sessions::integer AS renewed_quota",
  " FROM public.payment_transactions p",
  " WHERE p.parent_id::text = $1::text AND p.student_id::text = $2::text",
  " AND p.payment_status = 'paid' AND p.provider = 'payfast' AND p.paid_at IS NOT NULL",
  " AND p.raw_payload->>'renewal' = 'true'",
  " AND (p.raw_payload->>'payfast_mode' = 'sandbox' OR p.raw_payload->>'sandbox_checkout' = 'true')",
  " AND p.paid_at >= $3::timestamptz",
  " UNION ALL",
  " SELECT b.effective_at AS renewed_at, NULL::integer AS renewed_quota",
  " FROM public.session_billing_events b",
  " WHERE b.parent_id::text = $1::text AND b.student_id::text = $2::text",
  " AND b.is_sandbox = TRUE AND b.event_type = 'renewal_payment'",
  " AND b.billing_impact = 'restore' AND b.effective_at >= $3::timestamptz",
  ") SELECT renewed_at, renewed_quota FROM renewed",
  " ORDER BY renewed_at DESC, renewed_quota DESC NULLS LAST LIMIT 1",
].join("\n");

const USAGE_SQL = [
  "WITH completed_keys AS (",
  " SELECT 'training:' || s.id::text AS usage_key FROM public.scheduled_sessions s",
  " WHERE s.parent_id::text = $1::text AND s.student_id::text = $2::text",
  " AND s.type = 'training' AND s.status = 'completed'",
  " AND s.scheduled_time >= $3::timestamptz",
  " UNION",
  " SELECT CASE WHEN r.scheduled_session_id IS NOT NULL",
  " THEN 'training:' || r.scheduled_session_id::text",
  " ELSE 'training-run:' || r.id::text END",
  " FROM public.training_session_runs r",
  " WHERE r.student_id::text = $2::text AND r.status IN ('submitted', 'completed')",
  " AND COALESCE(r.submitted_at, r.started_at, r.created_at) >= $3::timestamptz",
  " UNION",
  " SELECT CASE WHEN d.scheduled_session_id IS NOT NULL",
  " THEN 'training:' || d.scheduled_session_id::text",
  " WHEN d.training_session_run_id IS NOT NULL",
  " THEN 'training:' || d.training_session_run_id::text",
  " ELSE 'training-drill:' || d.id::text END",
  " FROM public.intro_session_drills d",
  " WHERE d.student_id::text = $2::text AND d.submitted_at >= $3::timestamptz",
  " AND LOWER(COALESCE(NULLIF(d.drill->>'drillType', ''),",
  " NULLIF(d.drill->>'sessionContextKind', ''),",
  " CASE WHEN d.training_session_run_id IS NOT NULL THEN 'training' ELSE '' END)) = 'training'",
  "), unlinked_billing AS (",
  " SELECT COALESCE(SUM(GREATEST(b.credits_delta,0)),0)::integer AS used",
  " FROM public.session_billing_events b",
  " WHERE b.parent_id::text = $1::text AND b.student_id::text = $2::text",
  " AND b.is_sandbox = TRUE AND b.billing_impact = 'consume'",
  " AND b.effective_at >= $3::timestamptz",
  " AND NOT EXISTS (SELECT 1 FROM completed_keys c",
  " WHERE c.usage_key = 'training:' || b.session_id::text",
  " OR c.usage_key = 'training-run:' || b.session_id::text)",
  ") SELECT (SELECT COUNT(*)::integer FROM completed_keys) AS completed_used,",
  " (SELECT used FROM unlinked_billing) AS unlinked_billed_used",
].join("\n");

/** All three queries are SELECT-only and are scoped to the exact parent/student. */
export async function readSandboxCycle(
  db: SandboxDbReader,
  parentId: string,
  studentId: string,
): Promise<SandboxCycleSnapshot | null> {
  if (!parentId.trim() || !studentId.trim()) return null;
  const membership = await db.query(MEMBERSHIP_SQL, [parentId, studentId]);
  const cycle = selectSandboxCycle(membership.rows, { parentId, studentId });
  if (!cycle) return null;
  const renewals = await db.query(RENEWAL_SQL, [parentId, studentId, cycle.startIso]);
  const latest = renewals.rows[0] || null;
  const renewalAt = latest?.renewed_at ? new Date(latest.renewed_at).toISOString() : null;
  const boundary = renewalAt && renewalAt > cycle.startIso ? renewalAt : cycle.startIso;
  const usage = await db.query(USAGE_SQL, [parentId, studentId, boundary]);
  if (!usage.rows[0]) return null;
  return projectSandboxBalance(cycle, {
    renewalAt,
    renewedQuota: latest?.renewed_quota ?? null,
    completedUsed: usage.rows[0].completed_used,
    unlinkedBilledUsed: usage.rows[0].unlinked_billed_used,
  });
}
