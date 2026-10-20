/**
 * A Sandbox membership's month_key is a legacy unique cycle identifier, not
 * an expiry date. Sandbox cycles change only after an explicit simulated
 * package activation/renewal. Real-family monthly billing is unaffected.
 *
 * Selection and validation are pure. Reading package status never provisions
 * a package, creates a payment, or changes historical evidence.
 */
export type SandboxPackageCycleRow = {
  id?: string | null;
  parent_id?: string | null;
  student_id?: string | null;
  is_sandbox?: boolean | null;
  month_key?: string | null;
  status?: string | null;
  session_quota?: unknown;
  sessions_used?: unknown;
  sessions_remaining?: unknown;
  created_at?: string | null;
  [property: string]: unknown;
};

export function isSandboxCycleKey(value: unknown): value is string {
  const key = String(value ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(key)) return false;
  const year = Number(key.slice(0, 4));
  return Number.isSafeInteger(year) && year >= 2000 && year < 9999;
}

const validCount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
};

export function selectAuthoritativeSandboxCycle(
  rows: unknown,
  parentId: string,
  studentId: string,
): SandboxPackageCycleRow | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const requestedParentId = String(parentId || "").trim();
  const requestedStudentId = String(studentId || "").trim();
  if (!requestedParentId || !requestedStudentId) return null;

  const candidates = rows as SandboxPackageCycleRow[];
  if (candidates.some(row =>
    !row ||
    row.is_sandbox !== true ||
    String(row.parent_id || "").trim() !== requestedParentId ||
    String(row.student_id || "").trim() !== requestedStudentId ||
    !isSandboxCycleKey(row.month_key)
  )) return null;

  const ordered = [...candidates].sort((a, b) => {
    const byCycle = String(b.month_key).localeCompare(String(a.month_key));
    return byCycle || String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });

  // There must be one authoritative record per simulated cycle. A duplicate
  // or more recent invalid cycle must never silently revive an older balance.
  if (ordered.length > 1 && ordered[0].month_key === ordered[1].month_key) return null;
  const latest = ordered[0];
  if (String(latest.status || "").trim().toLowerCase() !== "active") return null;

  const quota = validCount(latest.session_quota);
  const used = validCount(latest.sessions_used);
  const remaining = validCount(latest.sessions_remaining);
  if (
    quota === null || quota <= 0 ||
    used === null || remaining === null ||
    used + remaining !== quota
  ) return null;

  return {
    ...latest,
    session_quota: quota,
    sessions_used: used,
    sessions_remaining: remaining,
  };
}

/** Reject unrecorded consumption, overspend, and stale count projections. */
export function verifySandboxCycleConsumption(
  cycle: SandboxPackageCycleRow | null,
  actualConsumed: unknown,
): SandboxPackageCycleRow | null {
  if (!cycle) return null;
  const consumed = validCount(actualConsumed);
  if (consumed === null || consumed !== cycle.sessions_used) return null;
  return cycle;
}

/** An explicit simulated renewal increments the unique cycle key, never "now". */
export function nextSandboxCycleKey(previousMonthKey: unknown): string | null {
  if (!isSandboxCycleKey(previousMonthKey)) return null;
  const year = Number(previousMonthKey.slice(0, 4));
  const month = Number(previousMonthKey.slice(5, 7));
  if (year === 9998 && month === 12) return null;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return String(nextYear).padStart(4, "0") + "-" + String(nextMonth).padStart(2, "0") + "-01";
}
