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


export type TrainingTabAvailabilityCode =
  | "PAYMENT_REQUIRED"
  | "RENEWAL_REQUIRED"
  | "NO_SESSIONS_BOOKED"
  | "SESSIONS_BOOKED"
  | "QUOTA_UNAVAILABLE"
  | "NOT_PACKAGE_BACKED";

export type TrainingTabAvailability = {
  code: TrainingTabAvailabilityCode;
  blocked: boolean;
  title: string;
  message: string;
};

export function resolveTrainingTabAvailability(options: {
  operationalMode: unknown;
  paymentRequired?: boolean;
  monthlyQuota?: TrainingPackageQuotaSnapshot | null;
  actionableSessionCount?: number;
}): TrainingTabAvailability {
  const packageBacked = isPackageBackedTrainingMode(options.operationalMode);
  const actionableSessionCount = Math.max(0, Number(options.actionableSessionCount || 0));

  if (packageBacked && options.paymentRequired) {
    return {
      code: "PAYMENT_REQUIRED",
      blocked: true,
      title: "Payment required before booking",
      message: "The parent has not completed the package payment required to book training sessions.",
    };
  }

  const quotaDecision = evaluateTrainingPackageQuota(
    options.operationalMode,
    options.monthlyQuota,
  );

  if (quotaDecision.required && quotaDecision.code === "PACKAGE_QUOTA_EXHAUSTED") {
    return {
      code: "RENEWAL_REQUIRED",
      blocked: true,
      title: "Awaiting parent renewal/payment",
      message: "The current package is exhausted. The parent must renew/pay before more sessions can be booked.",
    };
  }

  if (quotaDecision.required && quotaDecision.code === "PACKAGE_QUOTA_UNAVAILABLE") {
    return {
      code: "QUOTA_UNAVAILABLE",
      blocked: true,
      title: "Package status unavailable",
      message: "Response Integrity cannot verify this family's package capacity yet.",
    };
  }

  if (actionableSessionCount === 0) {
    const remaining = quotaDecision.sessionsRemaining;
    return {
      code: "NO_SESSIONS_BOOKED",
      blocked: false,
      title: "No sessions booked",
      message:
        packageBacked && remaining !== null
          ? `The family has ${remaining} package session${remaining === 1 ? "" : "s"} remaining, but no current training sessions are booked.`
          : "There are no current training sessions booked for this student.",
    };
  }

  return {
    code: packageBacked ? "SESSIONS_BOOKED" : "NOT_PACKAGE_BACKED",
    blocked: false,
    title: packageBacked ? "Sessions booked" : "Training schedule active",
    message: packageBacked
      ? "The family has active training sessions within the current package."
      : "Training scheduling is active for this student.",
  };
}
