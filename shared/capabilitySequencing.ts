import {
  CAPABILITY_MVP_ASSESSMENT_PLAN_V1,
  type CapabilityAssessmentPlanEntry,
} from "./capabilityAssessmentPlan";
import type { CapabilityEvidenceCellState } from "./capabilityEvidenceSelection";

export type CapabilityAssessmentAvailabilityStatus =
  | "unavailable"
  | "locked"
  | "available"
  | "complete";

export type CapabilityAssessmentAvailabilityReason =
  | "bank_unavailable"
  | "prerequisite_missing"
  | "spacing_window"
  | "attempt_limit"
  | "retry_cooldown"
  | null;

export interface CapabilityActiveBankState {
  assessmentKey: string;
  bankVersion: number;
  maxAttempts: number;
  retryCooldownHours: number;
}

export interface CapabilityAssessmentAttemptState {
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  completedAt: string | Date;
}

export interface CapabilityAssessmentAvailability {
  assessmentKey: string;
  title: string;
  evidenceKind: CapabilityAssessmentPlanEntry["evidenceKind"];
  coveredDeepDiveKeys: string[];
  status: CapabilityAssessmentAvailabilityStatus;
  reason: CapabilityAssessmentAvailabilityReason;
  missingPrerequisiteCodes: string[];
  unlockAt: string | null;
  bankVersion: number | null;
  attemptCount: number;
  maxAttempts: number | null;
}

function asTime(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  const time = parsed.getTime();
  if (Number.isNaN(time)) throw new Error(`Invalid capability sequencing timestamp: ${String(value)}`);
  return time;
}

function iso(time: number) {
  return new Date(time).toISOString();
}

function cellCode(deepDiveKey: string, evidenceKind: "mastery" | "retrieval" | "transfer") {
  return `deep_dive.${deepDiveKey}.${evidenceKind}`;
}

function targetCodes(plan: CapabilityAssessmentPlanEntry) {
  return plan.coveredDeepDiveKeys.map((deepDiveKey) => cellCode(deepDiveKey, plan.evidenceKind));
}

function prerequisiteCodes(plan: CapabilityAssessmentPlanEntry) {
  if (plan.evidenceKind === "mastery") return [];
  if (plan.evidenceKind === "retrieval") {
    return plan.coveredDeepDiveKeys.map((deepDiveKey) => cellCode(deepDiveKey, "mastery"));
  }

  // Transfer depends on both layers. This prevents an old retrieval pass from
  // bypassing a newly-invalidated or rotated mastery requirement.
  return plan.coveredDeepDiveKeys.flatMap((deepDiveKey) => [
    cellCode(deepDiveKey, "mastery"),
    cellCode(deepDiveKey, "retrieval"),
  ]);
}

export function buildCapabilityAssessmentAvailability(input: {
  now: string | Date;
  activeBanks: CapabilityActiveBankState[];
  evidenceCells: CapabilityEvidenceCellState[];
  attempts: CapabilityAssessmentAttemptState[];
  plan?: CapabilityAssessmentPlanEntry[];
}): CapabilityAssessmentAvailability[] {
  const now = asTime(input.now);
  const plan = input.plan || CAPABILITY_MVP_ASSESSMENT_PLAN_V1;
  const activeBanks = new Map(input.activeBanks.map((bank) => [bank.assessmentKey, bank]));
  const evidenceCells = new Map(input.evidenceCells.map((cell) => [cell.code, cell]));

  return plan.map((entry) => {
    const targets = targetCodes(entry);
    const completed = targets.every((code) => evidenceCells.has(code));
    const bank = activeBanks.get(entry.assessmentKey) || null;
    const currentAttempts = bank
      ? input.attempts.filter(
          (attempt) =>
            attempt.assessmentKey === entry.assessmentKey &&
            attempt.bankVersion === bank.bankVersion,
        )
      : [];
    const attemptCount = currentAttempts.length;

    if (completed) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: entry.evidenceKind,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "complete" as const,
        reason: null,
        missingPrerequisiteCodes: [],
        unlockAt: null,
        bankVersion: bank?.bankVersion || null,
        attemptCount,
        maxAttempts: bank?.maxAttempts || null,
      };
    }

    if (!bank) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: entry.evidenceKind,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "unavailable" as const,
        reason: "bank_unavailable" as const,
        missingPrerequisiteCodes: [],
        unlockAt: null,
        bankVersion: null,
        attemptCount: 0,
        maxAttempts: null,
      };
    }

    const prerequisites = prerequisiteCodes(entry);
    const missingPrerequisiteCodes = prerequisites.filter((code) => !evidenceCells.has(code));
    if (missingPrerequisiteCodes.length > 0) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: entry.evidenceKind,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "locked" as const,
        reason: "prerequisite_missing" as const,
        missingPrerequisiteCodes,
        unlockAt: null,
        bankVersion: bank.bankVersion,
        attemptCount,
        maxAttempts: bank.maxAttempts,
      };
    }

    if (prerequisites.length > 0 && entry.minimumDelayHours > 0) {
      const latestPrerequisiteAt = Math.max(
        ...prerequisites.map((code) => asTime(evidenceCells.get(code)!.satisfiedAt)),
      );
      const unlockTime = latestPrerequisiteAt + entry.minimumDelayHours * 60 * 60 * 1000;
      if (now < unlockTime) {
        return {
          assessmentKey: entry.assessmentKey,
          title: entry.title,
          evidenceKind: entry.evidenceKind,
          coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
          status: "locked" as const,
          reason: "spacing_window" as const,
          missingPrerequisiteCodes: [],
          unlockAt: iso(unlockTime),
          bankVersion: bank.bankVersion,
          attemptCount,
          maxAttempts: bank.maxAttempts,
        };
      }
    }

    if (attemptCount >= bank.maxAttempts) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: entry.evidenceKind,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "locked" as const,
        reason: "attempt_limit" as const,
        missingPrerequisiteCodes: [],
        unlockAt: null,
        bankVersion: bank.bankVersion,
        attemptCount,
        maxAttempts: bank.maxAttempts,
      };
    }

    if (bank.retryCooldownHours > 0 && currentAttempts.length > 0) {
      const latestAttemptAt = Math.max(...currentAttempts.map((attempt) => asTime(attempt.completedAt)));
      const retryAt = latestAttemptAt + bank.retryCooldownHours * 60 * 60 * 1000;
      if (now < retryAt) {
        return {
          assessmentKey: entry.assessmentKey,
          title: entry.title,
          evidenceKind: entry.evidenceKind,
          coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
          status: "locked" as const,
          reason: "retry_cooldown" as const,
          missingPrerequisiteCodes: [],
          unlockAt: iso(retryAt),
          bankVersion: bank.bankVersion,
          attemptCount,
          maxAttempts: bank.maxAttempts,
        };
      }
    }

    return {
      assessmentKey: entry.assessmentKey,
      title: entry.title,
      evidenceKind: entry.evidenceKind,
      coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
      status: "available" as const,
      reason: null,
      missingPrerequisiteCodes: [],
      unlockAt: null,
      bankVersion: bank.bankVersion,
      attemptCount,
      maxAttempts: bank.maxAttempts,
    };
  });
}
