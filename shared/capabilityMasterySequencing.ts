import {
  CAPABILITY_MVP_ASSESSMENT_PLAN_V1,
  type CapabilityAssessmentPlanEntry,
} from "./capabilityAssessmentPlan";

export type CapabilityMasteryAvailabilityStatus =
  | "unavailable"
  | "locked"
  | "available"
  | "complete";

export type CapabilityMasteryAvailabilityReason =
  | "bank_unavailable"
  | "attempt_limit"
  | "retry_cooldown"
  | null;

export interface CapabilityMasteryActiveBank {
  assessmentKey: string;
  bankVersion: number;
  maxAttempts: number;
  retryCooldownHours: number;
}

export interface CapabilityMasteryAttempt {
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  passed: boolean;
  completedAt: string | Date;
}

export interface CapabilityMasteryAvailability {
  assessmentKey: string;
  title: string;
  evidenceKind: "mastery";
  coveredDeepDiveKeys: string[];
  status: CapabilityMasteryAvailabilityStatus;
  reason: CapabilityMasteryAvailabilityReason;
  unlockAt: string | null;
  bankVersion: number | null;
  attemptCount: number;
  maxAttempts: number | null;
}

export const CAPABILITY_MASTERY_PLAN: CapabilityAssessmentPlanEntry[] =
  CAPABILITY_MVP_ASSESSMENT_PLAN_V1.filter((entry) => entry.evidenceKind === "mastery");

function timestamp(value: string | Date) {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(time)) {
    throw new Error(`Invalid capability attempt timestamp: ${String(value)}`);
  }
  return time;
}

export function buildCapabilityMasteryAvailability(input: {
  now: string | Date;
  activeBanks: CapabilityMasteryActiveBank[];
  attempts: CapabilityMasteryAttempt[];
  plan?: CapabilityAssessmentPlanEntry[];
}): CapabilityMasteryAvailability[] {
  const now = timestamp(input.now);
  const plan = (input.plan || CAPABILITY_MASTERY_PLAN).filter(
    (entry) => entry.evidenceKind === "mastery",
  );
  const activeBanks = new Map(
    input.activeBanks.map((bank) => [bank.assessmentKey, bank]),
  );

  return plan.map((entry) => {
    const bank = activeBanks.get(entry.assessmentKey) || null;
    if (!bank) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: "mastery" as const,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "unavailable" as const,
        reason: "bank_unavailable" as const,
        unlockAt: null,
        bankVersion: null,
        attemptCount: 0,
        maxAttempts: null,
      };
    }

    const attempts = input.attempts
      .filter(
        (attempt) =>
          attempt.assessmentKey === entry.assessmentKey &&
          attempt.bankVersion === bank.bankVersion,
      )
      .sort((left, right) => timestamp(left.completedAt) - timestamp(right.completedAt));

    if (attempts.some((attempt) => attempt.passed)) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: "mastery" as const,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "complete" as const,
        reason: null,
        unlockAt: null,
        bankVersion: bank.bankVersion,
        attemptCount: attempts.length,
        maxAttempts: bank.maxAttempts,
      };
    }

    if (attempts.length >= bank.maxAttempts) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: "mastery" as const,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "locked" as const,
        reason: "attempt_limit" as const,
        unlockAt: null,
        bankVersion: bank.bankVersion,
        attemptCount: attempts.length,
        maxAttempts: bank.maxAttempts,
      };
    }

    const latest = attempts[attempts.length - 1] || null;
    if (latest && bank.retryCooldownHours > 0) {
      const unlockTime =
        timestamp(latest.completedAt) + bank.retryCooldownHours * 60 * 60 * 1000;
      if (unlockTime > now) {
        return {
          assessmentKey: entry.assessmentKey,
          title: entry.title,
          evidenceKind: "mastery" as const,
          coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
          status: "locked" as const,
          reason: "retry_cooldown" as const,
          unlockAt: new Date(unlockTime).toISOString(),
          bankVersion: bank.bankVersion,
          attemptCount: attempts.length,
          maxAttempts: bank.maxAttempts,
        };
      }
    }

    return {
      assessmentKey: entry.assessmentKey,
      title: entry.title,
      evidenceKind: "mastery" as const,
      coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
      status: "available" as const,
      reason: null,
      unlockAt: null,
      bankVersion: bank.bankVersion,
      attemptCount: attempts.length,
      maxAttempts: bank.maxAttempts,
    };
  });
}
