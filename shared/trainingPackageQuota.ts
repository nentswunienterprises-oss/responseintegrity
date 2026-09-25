export type TrainingPackageQuotaSnapshot = {
  session_quota?: number | null;
  sessions_used?: number | null;
  sessions_remaining?: number | null;
  status?: string | null;
};

export type TrainingPackageQuotaDecision = {
  required: boolean;
  blocked: boolean;
  code: "PACKAGE_QUOTA_EXHAUSTED" | "PACKAGE_QUOTA_UNAVAILABLE" | null;
  sessionsRemaining: number | null;
  sessionQuota: number | null;
  sessionsUsed: number | null;
};

export function isPackageBackedTrainingMode(mode: unknown) {
  const normalized = String(mode || "").trim().toLowerCase();
  return normalized === "sandbox" || normalized === "certified_live";
}

const finiteNumberOrNull = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function evaluateTrainingPackageQuota(
  operationalMode: unknown,
  monthlyQuota: TrainingPackageQuotaSnapshot | null | undefined,
): TrainingPackageQuotaDecision {
  const required = isPackageBackedTrainingMode(operationalMode);
  if (!required) {
    return {
      required: false,
      blocked: false,
      code: null,
      sessionsRemaining: null,
      sessionQuota: null,
      sessionsUsed: null,
    };
  }

  if (!monthlyQuota) {
    return {
      required: true,
      blocked: true,
      code: "PACKAGE_QUOTA_UNAVAILABLE",
      sessionsRemaining: null,
      sessionQuota: null,
      sessionsUsed: null,
    };
  }

  const sessionsRemaining = finiteNumberOrNull(monthlyQuota.sessions_remaining);
  const sessionQuota = finiteNumberOrNull(monthlyQuota.session_quota);
  const sessionsUsed = finiteNumberOrNull(monthlyQuota.sessions_used);

  if (sessionsRemaining === null) {
    return {
      required: true,
      blocked: true,
      code: "PACKAGE_QUOTA_UNAVAILABLE",
      sessionsRemaining: null,
      sessionQuota,
      sessionsUsed,
    };
  }

  if (sessionsRemaining <= 0) {
    return {
      required: true,
      blocked: true,
      code: "PACKAGE_QUOTA_EXHAUSTED",
      sessionsRemaining: Math.max(0, sessionsRemaining),
      sessionQuota,
      sessionsUsed,
    };
  }

  return {
    required: true,
    blocked: false,
    code: null,
    sessionsRemaining,
    sessionQuota,
    sessionsUsed,
  };
}
