export const SESSION_PRICE_ZAR = 200;
export const SPECIALIST_SESSION_SHARE_ZAR = 130;
export const RESPONSE_INTEGRITY_SESSION_SHARE_ZAR = 70;

export const MONTHLY_PACKAGE_KEYS = ["monthly_8", "monthly_12", "monthly_16"] as const;

export type MonthlyPackageKey = (typeof MONTHLY_PACKAGE_KEYS)[number];

export interface MonthlyServicePackage {
  key: MonthlyPackageKey;
  label: string;
  sessionsPerMonth: 8 | 12 | 16;
  plannedSessionsPerWeek: 2 | 3 | 4;
  amountZar: number;
  specialistAllocationZar: number;
  responseIntegrityAllocationZar: number;
}

function buildPackage(
  key: MonthlyPackageKey,
  sessionsPerMonth: MonthlyServicePackage["sessionsPerMonth"],
  plannedSessionsPerWeek: MonthlyServicePackage["plannedSessionsPerWeek"],
): MonthlyServicePackage {
  return Object.freeze({
    key,
    label: `${sessionsPerMonth}-Session Monthly Package`,
    sessionsPerMonth,
    plannedSessionsPerWeek,
    amountZar: sessionsPerMonth * SESSION_PRICE_ZAR,
    specialistAllocationZar: sessionsPerMonth * SPECIALIST_SESSION_SHARE_ZAR,
    responseIntegrityAllocationZar: sessionsPerMonth * RESPONSE_INTEGRITY_SESSION_SHARE_ZAR,
  });
}

export const MONTHLY_SERVICE_PACKAGES: Readonly<Record<MonthlyPackageKey, MonthlyServicePackage>> =
  Object.freeze({
    monthly_8: buildPackage("monthly_8", 8, 2),
    monthly_12: buildPackage("monthly_12", 12, 3),
    monthly_16: buildPackage("monthly_16", 16, 4),
  });

export const DEFAULT_MONTHLY_PACKAGE_KEY: MonthlyPackageKey = "monthly_8";

export function isMonthlyPackageKey(value: unknown): value is MonthlyPackageKey {
  return MONTHLY_PACKAGE_KEYS.includes(String(value || "").trim().toLowerCase() as MonthlyPackageKey);
}

export function getMonthlyServicePackage(value: unknown): MonthlyServicePackage {
  const normalized = String(value || "").trim().toLowerCase();
  if (isMonthlyPackageKey(normalized)) {
    return MONTHLY_SERVICE_PACKAGES[normalized];
  }

  // Legacy paid records used "Premium" without a package key. Preserve them as
  // the 8-session package rather than manufacturing a new commercial meaning.
  return MONTHLY_SERVICE_PACKAGES[DEFAULT_MONTHLY_PACKAGE_KEY];
}

export function getMonthlyServicePackageBySessions(value: unknown): MonthlyServicePackage {
  const sessions = Number(value);
  return (
    Object.values(MONTHLY_SERVICE_PACKAGES).find((servicePackage) => servicePackage.sessionsPerMonth === sessions) ||
    MONTHLY_SERVICE_PACKAGES[DEFAULT_MONTHLY_PACKAGE_KEY]
  );
}

export function buildPackagePayoutState({
  packageKey,
  eligibleSessionCount,
  consumedSessionCount,
}: {
  packageKey: MonthlyPackageKey;
  eligibleSessionCount: number;
  consumedSessionCount: number;
}) {
  const servicePackage = getMonthlyServicePackage(packageKey);
  const eligibleSessions = Math.max(
    0,
    Math.min(servicePackage.sessionsPerMonth, Math.floor(Number(eligibleSessionCount) || 0)),
  );
  const consumedSessions = Math.max(
    0,
    Math.min(servicePackage.sessionsPerMonth, Math.floor(Number(consumedSessionCount) || 0)),
  );
  const accruedAmountZar = eligibleSessions * SPECIALIST_SESSION_SHARE_ZAR;
  const packageConsumed = consumedSessions >= servicePackage.sessionsPerMonth;
  const evidenceComplete = eligibleSessions >= servicePackage.sessionsPerMonth;
  const payoutStatus = evidenceComplete
    ? "payable"
    : packageConsumed
      ? "evidence_blocked"
      : "accruing";

  return {
    packageKey: servicePackage.key,
    requiredSessionCount: servicePackage.sessionsPerMonth,
    eligibleSessionCount: eligibleSessions,
    consumedSessionCount: consumedSessions,
    accruedAmountZar,
    payableAmountZar: evidenceComplete ? servicePackage.specialistAllocationZar : 0,
    payoutStatus: payoutStatus as "accruing" | "evidence_blocked" | "payable",
  };
}
