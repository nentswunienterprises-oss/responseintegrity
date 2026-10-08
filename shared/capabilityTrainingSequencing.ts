import type { CapabilityEvidenceKind } from "./capabilityEngine";
import {
  CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V1,
  CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V2,
  CAPABILITY_CURRICULUM_V2_ASSESSMENT_PLAN,
  EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
  SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
  SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
  CURRICULUM_V2_SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
  OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
  OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
  OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
  OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2,
  TRANSFORMATION_DEEP_DIVE_KEYS,
  TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY,
  TRANSFORMATION_TRANSFER_ASSESSMENT_KEY,
  type CapabilityAssessmentPlanEntry,
} from "./capabilityAssessmentPlan";

export type CapabilityTrainingAvailabilityStatus =
  | "unavailable"
  | "locked"
  | "available"
  | "complete";

export type CapabilityTrainingAvailabilityReason =
  | "bank_unavailable"
  | "attempt_limit"
  | "retry_cooldown"
  | "prerequisite_incomplete"
  | "spacing_interval"
  | null;

export interface CapabilityTrainingActiveBank {
  assessmentKey: string;
  bankVersion: number;
  evidenceKind: CapabilityEvidenceKind;
  maxAttempts: number;
  retryCooldownHours: number;
  reviewMode?: boolean;
}

export interface CapabilityTrainingAttempt {
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  evidenceKind: CapabilityEvidenceKind;
  passed: boolean;
  completedAt: string | Date;
}

export interface CapabilityTrainingAvailability {
  assessmentKey: string;
  title: string;
  evidenceKind: CapabilityEvidenceKind;
  coveredDeepDiveKeys: string[];
  status: CapabilityTrainingAvailabilityStatus;
  reason: CapabilityTrainingAvailabilityReason;
  unlockAt: string | null;
  bankVersion: number | null;
  attemptCount: number;
  maxAttempts: number | null;
  passThresholdPercent: number;
  formSize: number;
  reviewMode?: boolean;
  stage:
    | "transformation_mastery"
    | "transformation_retrieval"
    | "transformation_transfer"
    | "execution_standards_mastery"
    | "system_intelligence_mastery"
    | "session_infrastructure_mastery"
    | "operating_system_retrieval"
    | "operating_system_transfer";
}

const transformationMasteryKeys = TRANSFORMATION_DEEP_DIVE_KEYS.map(
  (deepDiveKey) => `${deepDiveKey}_mastery_v1`,
);
const executionStandardsMasteryKeys = EXECUTION_STANDARDS_DEEP_DIVE_KEYS.map(
  (deepDiveKey) => `${deepDiveKey}_mastery_v1`,
);
const systemIntelligenceMasteryKeys = SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS.map(
  (deepDiveKey) => `${deepDiveKey}_mastery_v1`,
);
const sessionInfrastructureMasteryKeys = SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS.map(
  (deepDiveKey) => `${deepDiveKey}_mastery_v1`,
);
const curriculumV2SystemIntelligenceMasteryKeys =
  CURRICULUM_V2_SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS.map(
    (deepDiveKey) => `${deepDiveKey}_mastery_v1`,
  );

const operatingSystemRetrievalAssessmentKeys = new Set([
  OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
  OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
]);

const operatingSystemTransferToRetrievalKey = new Map<string, string>([
  [OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY, OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY],
  [OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2, OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2],
]);
function timestamp(value: string | Date) {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(time)) {
    throw new Error(`Invalid capability attempt timestamp: ${String(value)}`);
  }
  return time;
}

function stageFor(entry: CapabilityAssessmentPlanEntry): CapabilityTrainingAvailability["stage"] {
  if (entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY) {
    return "transformation_retrieval";
  }
  if (entry.assessmentKey === TRANSFORMATION_TRANSFER_ASSESSMENT_KEY) {
    return "transformation_transfer";
  }
  if (operatingSystemRetrievalAssessmentKeys.has(entry.assessmentKey)) {
    return "operating_system_retrieval";
  }
  if (operatingSystemTransferToRetrievalKey.has(entry.assessmentKey)) {
    return "operating_system_transfer";
  }
  if (
    entry.evidenceKind === "mastery" &&
    entry.coveredDeepDiveKeys.some((key) =>
      EXECUTION_STANDARDS_DEEP_DIVE_KEYS.includes(key),
    )
  ) {
    return "execution_standards_mastery";
  }
  if (
    entry.evidenceKind === "mastery" &&
    entry.coveredDeepDiveKeys.some(
      (key) =>
        SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS.includes(key) ||
        CURRICULUM_V2_SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS.includes(key),
    )
  ) {
    return "system_intelligence_mastery";
  }
  if (
    entry.evidenceKind === "mastery" &&
    entry.coveredDeepDiveKeys.some((key) =>
      SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS.includes(key),
    )
  ) {
    return "session_infrastructure_mastery";
  }
  return "transformation_mastery";
}

export function getCapabilityTrainingAssessmentPlan(options?: {
  includeCurriculumV2Review?: boolean;
  curriculumVersion?: "v1" | "v2";
}) {
  const curriculumVersion = options?.curriculumVersion || "v1";
  const includeCurriculumV2 = curriculumVersion === "v2";
  const sourcePlan = includeCurriculumV2
    ? CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V2
    : options?.includeCurriculumV2Review
      ? [
          ...CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V1,
          ...CAPABILITY_CURRICULUM_V2_ASSESSMENT_PLAN,
        ]
      : CAPABILITY_ACTIVE_TRAINING_ASSESSMENT_PLAN_V1;

  const byKey = new Map(
    sourcePlan.map((entry) => [
      entry.assessmentKey,
      entry,
    ] as const),
  );

  const includeV2ReviewArtifacts =
    includeCurriculumV2 || Boolean(options?.includeCurriculumV2Review);

  const orderedKeys = [
    ...transformationMasteryKeys,
    TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY,
    TRANSFORMATION_TRANSFER_ASSESSMENT_KEY,
    ...executionStandardsMasteryKeys,
    ...(includeCurriculumV2
      ? curriculumV2SystemIntelligenceMasteryKeys
      : [
          ...systemIntelligenceMasteryKeys,
          ...(options?.includeCurriculumV2Review
            ? ["why_training_continues_beyond_clarity_mastery_v1"]
            : []),
        ]),
    ...sessionInfrastructureMasteryKeys,
    ...(includeCurriculumV2
      ? [
          OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
          OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2,
        ]
      : [
          OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
          OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
          ...(options?.includeCurriculumV2Review
            ? [
                OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
                OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2,
              ]
            : []),
        ]),
  ];

  return orderedKeys
    .map((key) => byKey.get(key))
    .filter((entry): entry is CapabilityAssessmentPlanEntry => Boolean(entry));
}

function passedAttemptFor(
  assessmentKey: string,
  bank: CapabilityTrainingActiveBank | null,
  attempts: CapabilityTrainingAttempt[],
) {
  if (!bank || bank.reviewMode) return null;
  return (
    attempts
      .filter(
        (attempt) =>
          attempt.assessmentKey === assessmentKey &&
          attempt.bankVersion === bank.bankVersion &&
          attempt.passed,
      )
      .sort((left, right) => timestamp(left.completedAt) - timestamp(right.completedAt))
      .at(-1) || null
  );
}

export function isCapabilityTransformationSandboxReady(
  assessments: CapabilityTrainingAvailability[],
) {
  const byKey = new Map(assessments.map((entry) => [entry.assessmentKey, entry] as const));
  return [
    ...transformationMasteryKeys,
    TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY,
    TRANSFORMATION_TRANSFER_ASSESSMENT_KEY,
  ].every((key) => byKey.get(key)?.status === "complete");
}

export function buildCapabilityTrainingAvailability(input: {
  now: string | Date;
  activeBanks: CapabilityTrainingActiveBank[];
  attempts: CapabilityTrainingAttempt[];
  plan?: CapabilityAssessmentPlanEntry[];
}): CapabilityTrainingAvailability[] {
  const now = timestamp(input.now);
  const plan = input.plan || getCapabilityTrainingAssessmentPlan();
  const activeBanks = new Map(
    input.activeBanks.map((bank) => [bank.assessmentKey, bank] as const),
  );

  const currentAttemptsFor = (entry: CapabilityAssessmentPlanEntry) => {
    const bank = activeBanks.get(entry.assessmentKey);
    if (!bank) return [];
    return input.attempts
      .filter(
        (attempt) =>
          attempt.assessmentKey === entry.assessmentKey &&
          attempt.bankVersion === bank.bankVersion,
      )
      .sort((left, right) => timestamp(left.completedAt) - timestamp(right.completedAt));
  };

  const isCurrentComplete = (assessmentKey: string) => {
    const bank = activeBanks.get(assessmentKey) || null;
    return Boolean(passedAttemptFor(assessmentKey, bank, input.attempts));
  };

  const transformationMasteryComplete = () =>
    transformationMasteryKeys.every(isCurrentComplete);
  const masteryKeysFor = (entry: CapabilityAssessmentPlanEntry) =>
    entry.coveredDeepDiveKeys.map((deepDiveKey) => `${deepDiveKey}_mastery_v1`);

  const prerequisiteComplete = (entry: CapabilityAssessmentPlanEntry) => {
    if (entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY) {
      return transformationMasteryComplete();
    }
    if (entry.assessmentKey === TRANSFORMATION_TRANSFER_ASSESSMENT_KEY) {
      return isCurrentComplete(TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY);
    }
    if (operatingSystemRetrievalAssessmentKeys.has(entry.assessmentKey)) {
      return masteryKeysFor(entry).every(isCurrentComplete);
    }
    const prerequisiteRetrievalKey =
      operatingSystemTransferToRetrievalKey.get(entry.assessmentKey);
    if (prerequisiteRetrievalKey) {
      return isCurrentComplete(prerequisiteRetrievalKey);
    }
    if (
      entry.evidenceKind === "mastery" &&
      entry.coveredDeepDiveKeys.some((key) =>
        SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS.includes(key),
      )
    ) {
      return isCurrentComplete(TRANSFORMATION_TRANSFER_ASSESSMENT_KEY);
    }
    return true;
  };

  const prerequisiteCompletionTime = (entry: CapabilityAssessmentPlanEntry) => {
    if (entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY) {
      const passedTimes = transformationMasteryKeys
        .map((key) =>
          passedAttemptFor(key, activeBanks.get(key) || null, input.attempts),
        )
        .filter((attempt): attempt is CapabilityTrainingAttempt => Boolean(attempt))
        .map((attempt) => timestamp(attempt.completedAt));
      return passedTimes.length === transformationMasteryKeys.length
        ? Math.max(...passedTimes)
        : null;
    }
    if (entry.assessmentKey === TRANSFORMATION_TRANSFER_ASSESSMENT_KEY) {
      const attempt = passedAttemptFor(
        TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY,
        activeBanks.get(TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY) || null,
        input.attempts,
      );
      return attempt ? timestamp(attempt.completedAt) : null;
    }
    if (operatingSystemRetrievalAssessmentKeys.has(entry.assessmentKey)) {
      const requiredMasteryKeys = masteryKeysFor(entry);
      const passedTimes = requiredMasteryKeys
        .map((key) =>
          passedAttemptFor(key, activeBanks.get(key) || null, input.attempts),
        )
        .filter((attempt): attempt is CapabilityTrainingAttempt => Boolean(attempt))
        .map((attempt) => timestamp(attempt.completedAt));
      return passedTimes.length === requiredMasteryKeys.length
        ? Math.max(...passedTimes)
        : null;
    }
    const prerequisiteRetrievalKey =
      operatingSystemTransferToRetrievalKey.get(entry.assessmentKey);
    if (prerequisiteRetrievalKey) {
      const attempt = passedAttemptFor(
        prerequisiteRetrievalKey,
        activeBanks.get(prerequisiteRetrievalKey) || null,
        input.attempts,
      );
      return attempt ? timestamp(attempt.completedAt) : null;
    }
    return null;
  };

  return plan.map((entry) => {
    const bank = activeBanks.get(entry.assessmentKey) || null;
    const stage = stageFor(entry);

    if (!bank) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: entry.evidenceKind,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "unavailable",
        reason: "bank_unavailable",
        unlockAt: null,
        bankVersion: null,
        attemptCount: 0,
        maxAttempts: null,
        passThresholdPercent: entry.passThresholdPercent,
        formSize: entry.formSize,
        stage,
      };
    }

    const attempts = currentAttemptsFor(entry);

    const founderReviewMode =
      Boolean(bank.reviewMode) &&
      (entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY ||
        entry.assessmentKey === TRANSFORMATION_TRANSFER_ASSESSMENT_KEY ||
        operatingSystemRetrievalAssessmentKeys.has(entry.assessmentKey) ||
        operatingSystemTransferToRetrievalKey.has(entry.assessmentKey) ||
        stage === "execution_standards_mastery" ||
        stage === "system_intelligence_mastery" ||
        stage === "session_infrastructure_mastery");

    if (founderReviewMode) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: entry.evidenceKind,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "available",
        reason: null,
        unlockAt: null,
        bankVersion: bank.bankVersion,
        attemptCount: attempts.length,
        maxAttempts: bank.maxAttempts,
        passThresholdPercent: entry.passThresholdPercent,
        formSize: entry.formSize,
        reviewMode: true,
        stage,
      };
    }

    if (attempts.some((attempt) => attempt.passed)) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: entry.evidenceKind,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "complete",
        reason: null,
        unlockAt: null,
        bankVersion: bank.bankVersion,
        attemptCount: attempts.length,
        maxAttempts: bank.maxAttempts,
        passThresholdPercent: entry.passThresholdPercent,
        formSize: entry.formSize,
        stage,
      };
    }

    if (!prerequisiteComplete(entry)) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: entry.evidenceKind,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "locked",
        reason: "prerequisite_incomplete",
        unlockAt: null,
        bankVersion: bank.bankVersion,
        attemptCount: attempts.length,
        maxAttempts: bank.maxAttempts,
        passThresholdPercent: entry.passThresholdPercent,
        formSize: entry.formSize,
        stage,
      };
    }

    const prerequisiteTime = prerequisiteCompletionTime(entry);
    if (prerequisiteTime != null && entry.minimumDelayHours > 0) {
      const unlockTime = prerequisiteTime + entry.minimumDelayHours * 60 * 60 * 1000;
      if (unlockTime > now) {
        return {
          assessmentKey: entry.assessmentKey,
          title: entry.title,
          evidenceKind: entry.evidenceKind,
          coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
          status: "locked",
          reason: "spacing_interval",
          unlockAt: new Date(unlockTime).toISOString(),
          bankVersion: bank.bankVersion,
          attemptCount: attempts.length,
          maxAttempts: bank.maxAttempts,
          passThresholdPercent: entry.passThresholdPercent,
          formSize: entry.formSize,
          stage,
        };
      }
    }

    if (attempts.length >= bank.maxAttempts) {
      return {
        assessmentKey: entry.assessmentKey,
        title: entry.title,
        evidenceKind: entry.evidenceKind,
        coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
        status: "locked",
        reason: "attempt_limit",
        unlockAt: null,
        bankVersion: bank.bankVersion,
        attemptCount: attempts.length,
        maxAttempts: bank.maxAttempts,
        passThresholdPercent: entry.passThresholdPercent,
        formSize: entry.formSize,
        stage,
      };
    }

    const latest = attempts.at(-1) || null;
    if (latest && bank.retryCooldownHours > 0) {
      const unlockTime =
        timestamp(latest.completedAt) + bank.retryCooldownHours * 60 * 60 * 1000;
      if (unlockTime > now) {
        return {
          assessmentKey: entry.assessmentKey,
          title: entry.title,
          evidenceKind: entry.evidenceKind,
          coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
          status: "locked",
          reason: "retry_cooldown",
          unlockAt: new Date(unlockTime).toISOString(),
          bankVersion: bank.bankVersion,
          attemptCount: attempts.length,
          maxAttempts: bank.maxAttempts,
          passThresholdPercent: entry.passThresholdPercent,
          formSize: entry.formSize,
          stage,
        };
      }
    }

    return {
      assessmentKey: entry.assessmentKey,
      title: entry.title,
      evidenceKind: entry.evidenceKind,
      coveredDeepDiveKeys: [...entry.coveredDeepDiveKeys],
      status: "available",
      reason: null,
      unlockAt: null,
      bankVersion: bank.bankVersion,
      attemptCount: attempts.length,
      maxAttempts: bank.maxAttempts,
      passThresholdPercent: entry.passThresholdPercent,
      formSize: entry.formSize,
      stage,
    };
  });
}
