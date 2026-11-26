Warning: truncated output (original token count: 341106)
... 315848 bytes omitted ...

import { confidentialReference, ensurePrivateBucket, createConfidentialDownloadHandler } from "./confidentialStorage";
import { captureDemandParent } from "./demandCapture";
import { normalizeScheduledInstant, normalizeScheduledTimeZone } from "./bookingTimezone";
import { registerDemandProductionRoutes } from "./demandProduction";
import { demandAssignmentBlock, resolveEntryType } from "../shared/demandProduction";
import { updateDiagnosisProposalSnapshotPackage } from "@shared/diagnosisProposalCopy";
import type { Express, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { createHash, randomUUID } from "crypto";
import { existsSync } from "fs";
import { createServer, type Server } from "http";
import { join, resolve } from "path";
import { storage, supabase, createAffiliateCode } from "./storage";
import { getTutorOnboardingDocumentDefinition, loadTutorOnboardingDocument, TUTOR_ONBOARDING_DOCUMENTS } from "./tutorOnboardingDocuments";
import { selectCurrentTutorOnboardingAcceptance } from "@shared/tutorOnboardingAcceptanceVersion";
import { EGP_ONBOARDING_DOCUMENTS, getEgpOnboardingDocumentDefinition, loadEgpOnboardingDocument } from "./egpOnboardingDocuments";
import { TD_ONBOARDING_DOCUMENTS, getTdOnboardingDocumentDefinition, loadTdOnboardingDocument } from "./tdOnboardingDocuments";
import { isAuthenticated } from "./supabaseAuth";
import { pool } from "./db";
import { isEmergencyDbMode } from "./emergencyMode";
import { ensurePreviewSandboxFixtureCommercialState } from "./proofSandboxCommercialState";
import { isSandboxCycleKey, nextSandboxCycleKey, selectAuthoritativeSandboxCycle, verifySandboxCycleConsumption } from "./sandboxPackageCycle";
import { buildEmergencyEnrollmentStatusFilter } from "./emergencyPodQuery";
import {
  createEmergencyFileBundle,
  decryptEmergencyFileBundle,
  provisionEmergencyCredentialForExistingUser,
  setEmergencyCredentialForExistingUser,
} from "./emergencyAuth";
import { withSandboxProvisionLock } from "./sandboxProvisionLock";
import { fileURLToPath } from "url";
import {
  insertPodSchema,
  insertTutorAssignmentSchema,
  insertStudentSchema,
  insertSessionSchema,
  insertReflectionSchema,
  insertAcademicProfileSchema,
  insertStruggleTargetSchema,
  insertBroadcastSchema,
  insertCooBrainRichTextSchema,
  insertStudentCommunicationMessageSchema,
  insertTutorApplicationSchema,
  roleAuthorizationSchema,
  insertEncounterSchema,
  insertAffiliateReflectionSchema,
  uploadCooBrainPdfSchema,
} from "@shared/schema";
import {
  NEXT_ACTION_ENGINE,
  PHASES,
  STABILITY_THRESHOLDS,
  normalizePhase,
  tryParsePhase,
  normalizeStability,
  stabilityToScore,
  computeTransition,
  mapObservationsToBehavior,
  getParentDashboardCopyByState,
  type TopicPhase,
  type TopicStability,
  type TransitionReason,
  type ObservationSignal,
} from "@shared/topicConditioningEngine";
import { normalizeObservationLevelValue } from "@shared/observationScoring";
import {
  computeAdaptiveDiagnosisPhaseSummary,
  getAdjacentDiagnosisPhase,
  type AdaptiveDiagnosisBand,
} from "@shared/adaptiveDiagnosis";
import {
  getDrillSchemaDefinition,
  hasSemanticEvidenceContract,
  validateAndNormalizeSemanticEvidenceSet,
  type EvidenceDrillMode,
} from "@shared/responseIntegrityDrillRegistry";
import {
  compareTrainingEvidenceShadowToLegacy,
  evaluateTrainingEvidence,
  resolveTrainingEvidenceAuthorityRoute,
} from "@shared/trainingEvidenceEvaluator";
import { evaluateHandoverVerificationEvidence } from "@shared/handoverEvidenceEvaluator";
import { buildResponseSnapshotV1, summarizeSnapshotObservedResponse } from "@shared/responseSnapshot";
import {
  extractAuthoritativeResponseEvidenceSignals,
  reportClaimLabelsFromEvidence,
  resolveResponseEvidenceReportAuthority,
  type ResponseEvidenceReportSignal,
} from "@shared/responseEvidenceReporting";
import {
  cancellationNeedsReplacement,
  deriveTrainingSessionCancellationDisposition,
  getSandboxParentCancellationBilling,
  type TrainingSessionCancellationDisposition,
} from "@shared/trainingSessionCancellationPolicy";
import {
  evaluateTrainingPackageQuota,
  resolveTrainingTabAvailability,
  type TrainingPackageQuotaDecision,
} from "@shared/trainingPackageQuota";
import {
  normalizeTopicReferenceContent,
  parseStoredTopicReference,
  TOPIC_REFERENCE_SCHEMA_VERSION,
} from "@shared/topicReference";
import type { EvidenceLedgerProjectionInput } from "@shared/responseIntegrityEvidenceLedger";
import {
  deriveStructuredExecutionEpochKeyForTraining,
  deriveTrainingTpsTimerContract,
  validateTrainingPassiveTimingSubmission,
  type StoredDrillRow,
} from "@shared/tpsTimingRuntime";
import {
  TPS_TIMER_BASELINE_INCOMPLETE,
  resolveTpsTrainingReadiness,
} from "@shared/tpsTrainingReadiness";
import {
  buildStartingPhaseRationale,
  getResponseSymptomLabels,
  normalizeResponseSymptoms,
  recommendStartingPhaseFromSymptoms,
  RESPONSE_SYMPTOM_GROUPS,
} from "@shared/responseSymptomMapping";
import { z } from "zod";
import {
  isGoogleMeetIntegrationAvailable,
  reconcileGoogleMeetArtifacts,
  syncGoogleMeetEvent,
} from "./googleMeet";
import { getWebPushPublicKey, sendWebPushToUser } from "./webPush";
import { getAllowedOdEmailList, isAllowedOdEmail, normalizeEmail } from "@shared/odAccess";
import {
  getPayfastProcessUrl,
  normalizePayfastPaymentStatus,
  verifyPayfastSignature,
  withPayfastSignature,
} from "./payfast";
import {
  BATTLE_TEST_VARIANT_KEYS,
  type BattleTestResponseInput,
  type BattleTestVariantKey,
  type TutorTrainingMode,
} from "@shared/battleTesting";
import { proposalRequiresConfirmedIntroSession } from "./proposalBookingGate";
import {
  buildBattleTestSuccessPayload,
  buildPodBattleTestingSummary,
  checkTutorDocumentationComplete,
  clearTutorAssignmentCertificationState,
  getBattleTestRunDetail,
  getBattleTestRunHistoryForPod,
  getTutorBattleTestAssignedVariants,
  hydrateTutorAssignmentFromPortableSnapshot,
  persistBattleTestRun,
  upsertTutorPortableCertificationSnapshot,
} from "./battleTesting";
import {
  TD_BATTLE_TEST_PHASE_EXACT,
  TUTOR_BATTLE_TEST_PHASES_EXACT,
  TUTOR_BATTLE_TEST_PHASES_SAFE,
  getTutorBattleTestPhaseDefinitionsExact,
} from "./battleTestingBanks";
import {
  ACTIVE_PARENT_ENROLLMENT_STATUSES,
  cleanupDetachedEnrollmentArtifacts,
  cleanupLegacyLiveEnrollmentsForNonLiveTutor,
  restoreDetachedEnrollmentToTutor,
  safelyUnassignEnrollmentFromTutor,
} from "./tutorAssignmentProtection";
import { registerExecutiveCommandRhythmRoutes } from "./routes/executiveCommandRhythm";
import {
  buildCanonicalProductionLinkUrl,
  getAppBaseUrl,
} from "./productionLinkUrls";
import {
  normalizeProductionLinkCode,
  normalizeProductionPipeline,
  preserveFirstProductionLink,
  resolveDurableProductionLink,
  validateProductionLinkForRole,
} from "@shared/productionLinks";
import { resolveProductionCloseLineage } from "./productionCloseLineage";
import { buildProductionEconomy } from "./productionEconomy";
import {
  persistResponseIntegrityEvidenceLedgerShadow,
  persistResponseIntegrityEvidenceLedgerShadowDirect,
} from "./responseIntegrityEvidenceLedger";
import {
  buildEvidenceCorrectionCandidate,
  prepareEvidenceCorrectionInsert,
  type EvidenceCorrectionLedgerRow,
  type EvidenceCorrectionRow,
} from "./responseIntegrityEvidenceCorrections";
import {
  persistTrainingEvidenceShadowComparison,
  persistTrainingEvidenceShadowComparisonDirect,
  type TrainingEvidenceShadowDatasetInput,
} from "./trainingEvidenceShadowComparison";
import {
  loadLatestTpsTimerContract,
  loadTpsTimingDrillRows,
  persistTpsTimerContract,
  persistTpsTimerContractDirect,
  validateTrainingPassiveTimingAttemptLineage,
  validateTpsHandoverTimedAttemptLineage,
  validateTpsTrainingDrillTimedAttemptLineage,
  type PersistedTpsTimerContract,
} from "./tpsTimingAuthority";
import {
  createTrialCase,
  createTrialPlacement,
  decideTrialCase,
  extendTrialCase,
  getOpenTrialCaseForTutor,
  getParentTrialCase,
  getTrialCaseById,
  recordTrialFeedback,
  recordTrialReview,
  removeTrialPlacementCreatedDuringFailedAssignment,
} from "./trialCertification";
import {
  getLatestSandboxReadinessAssessment,
  recordSandboxReadinessAssessment,
} from "./sandboxReadiness";
import { getSandboxCapabilityReadiness } from "./sandboxEnvironment";
import { getSpecialistCapabilityTrainingState } from "./capabilitySequencing";
import {
  approveSpecialistPathwayExtension,
  ensureSpecialistDevelopmentPathway,
  getSpecialistDevelopmentPathway,
  linkSpecialistPathwayAssignment,
} from "./specialistDevelopmentPathway";
import {
  DEFAULT_MONTHLY_PACKAGE_KEY,
  MONTHLY_SERVICE_PACKAGES,
  RESPONSE_INTEGRITY_SESSION_SHARE_ZAR,
  SESSION_PRICE_ZAR,
  SPECIALIST_SESSION_SHARE_ZAR,
  buildPackagePayoutState,
  getMonthlyServicePackage,
  isMonthlyPackageKey,
  type MonthlyPackageKey,
} from "@shared/servicePackages";
import {
  SANDBOX_REQUIRED_ACCOUNT_COUNT,
  evaluateSandboxPreparationGate,
} from "@shared/sandboxReadiness";

const PAYMENT_PROVIDER_PAYFAST = "payfast";
const DEFAULT_SERVICE_PACKAGE = MONTHLY_SERVICE_PACKAGES[DEFAULT_MONTHLY_PACKAGE_KEY];

type SandboxCaseTemplate = {
  id: string;
  topics: string[];
  responseSymptoms: string[];
  topicSymptoms?: Record<string, string[]>;
  previousTutoring: string;
  parentMotivation: string;
};

const SANDBOX_CASE_TEMPLATES: SandboxCaseTemplate[] = [
  {
    id: "single-topic-clarity",
    topics: ["Fractions"],
    responseSymptoms: ["question_confusion", "term_formula_forgetting", "confused_before_start"],
    topicSymptoms: {
      Fractions: ["question_confusion", "term_formula_forgetting", "confused_before_start"],
    },
    previousTutoring: "No formal tutoring before. Parent reports repeated confusion at the start of tasks.",
    parentMotivation: "Sandbox training case focused on a single-topic clarity breakdown.",
  },
  {
    id: "double-topic-structure",
    topics: ["Algebra", "Linear equations"],
    responseSymptoms: ["guided_but_not_alone", "skips_steps", "needs_prompting"],
    topicSymptoms: {
      Algebra: ["guided_but_not_alone", "skips_steps"],
      "Linear equations": ["starts_wrong_after_examples", "needs_prompting"],
    },
    previousTutoring: "Some tutoring before, but the student still loses structure when working alone.",
    parentMotivation: "Sandbox training case focused on a two-topic execution breakdown.",
  },
  {
    id: "triple-topic-pressure",
    topics: ["Word problems", "Percentages", "Ratios"],
    responseSymptoms: ["freezes_unfamiliar", "overwhelmed_by_uncertainty", "panics_in_tests"],
    topicSymptoms: {
      "Word problems": ["freezes_unfamiliar", "asks_help_immediately"],
      Percentages: ["overwhelmed_by_uncertainty", "gives_up_quickly"],
      Ratios: ["panics_in_tests", "rushes_under_time"],
    },
    previousTutoring: "Previous support helped with homework, but unfamiliar questions still trigger collapse.",
    parentMotivation: "Sandbox training case focused on discomfort and time-pressure breakdowns across multiple topics.",
  },
  {
    id: "double-topic-mixed",
    topics: ["Exponents", "Factorisation"],
    responseSymptoms: ["cannot_explain_reason", "guesses_without_method", "loses_structure_when_fast"],
    topicSymptoms: {
      Exponents: ["cannot_explain_reason", "guesses_without_method"],
      Factorisation: ["skips_steps", "loses_structure_when_fast"],
    },
    previousTutoring: "Student can sometimes copy steps, but reasoning and structure collapse under pressure.",
    parentMotivation: "Sandbox training case focused on mixed clarity and execution drift.",
  },
];

function buildSandboxEnrollmentCase(seedIndex: number, source?: any | null) {
  const template = SANDBOX_CASE_TEMPLATES[seedIndex % SANDBOX_CASE_TEMPLATES.length];
  const sourceTopicResponseSymptoms =
    source?.topic_response_symptoms && typeof source.topic_response_symptoms === "object"
      ? Object.fromEntries(
          Object.entries(source.topic_response_symptoms as Record<string, unknown>)
            .map(([topic, symptoms]) => [String(topic || "").trim(), normalizeResponseSymptoms(symptoms)])
            .filter(([topic, symptoms]) => topic.length > 0 && (symptoms as string[]).length > 0)
        )
      : {};
  const sourceTopicRecommendedStartingPhases =
    source?.topic_recommended_starting_phases &&
    typeof source.topic_recommended_starting_phases === "object"
      ? Object.fromEntries(
          Object.entries(source.topic_recommended_starting_phases as Record<string, unknown>)
            .map(([topic, recommendation]) => [String(topic || "").trim(), recommendation] as [string, unknown])
            .filter(([topic]) => topic.length > 0)
        )
      : {};
  const sourceResponseSymptoms = normalizeResponseSymptoms(source?.response_symptoms);
  const sourceTopics = Array.from(
    new Set([
      ...Object.keys(sourceTopicResponseSymptoms),
      ...Object.keys(sourceTopicRecommendedStartingPhases),
    ])
  );
  const topics = sourceTopics.length > 0 ? sourceTopics : template.topics;
  const normalizedResponseSymptoms =
    sourceResponseSymptoms.length > 0
      ? sourceResponseSymptoms
      : normalizeResponseSymptoms(template.responseSymptoms);
  const responseRecommendation = recommendStartingPhaseFromSymptoms(normalizedResponseSymptoms);

  const topicResponseSymptoms = Object.fromEntries(
    topics.map((topic) => {
      const symptoms = normalizeResponseSymptoms(
        sourceTopicResponseSymptoms[topic] ||
        template.topicSymptoms?.[topic] ||
        normalizedResponseSymptoms
      );
      return [topic, symptoms];
    })
  );

  const topicResponseRecommendations = Object.fromEntries(
    Object.entries(topicResponseSymptoms).map(([topic, symptoms]) => {
      const recommendation = recommendStartingPhaseFromSymptoms(symptoms as string[]);
      return [
        topic,
        {
          phase: recommendation.phase,
          scores: recommendation.scores,
          supportingSymptoms: recommendation.supportingSymptoms,
          rationale: buildStartingPhaseRationale(recommendation.phase, recommendation.supportingSymptoms),
        },
      ];
    })
  );

  return {
    caseId: template.id,
    topicCount: topics.length,
    responseSymptoms: normalizedResponseSymptoms,
    topicResponseSymptoms,
    responseSignalScores: responseRecommendation.scores,
    topicResponseSignalScores: Object.fromEntries(
      Object.entries(topicResponseRecommendations).map(([topic, value]) => [topic, (value as any).scores])
    ),
    recommendedStartingPhase: responseRecommendation.phase,
    topicRecommendedStartingPhases: Object.fromEntries(
      Object.entries(topicResponseRecommendations).map(([topic, value]) => [
        topic,
        {
          phase: (value as any).phase,
          supportingSymptoms: (value as any).supportingSymptoms,
          rationale: (value as any).rationale,
        },
      ])
    ),
    schoolName:
      source?.school_name ||
      (topics.length >= 3 ? "Sandbox Comprehensive" : topics.length === 2 ? "Sandbox Prep" : "Sandbox Academy"),
    previousTutoring: source?.previous_tutoring || template.previousTutoring,
    parentMotivation: source?.parent_motivation || template.parentMotivation,
  };
}

function getApiPublicUrl() {
  return (
    String(process.env.API_PUBLIC_URL || "").trim() ||
    "https://tt-confidence-hub-api.onrender.com"
  );
}

const PAYFAST_SANDBOX_BRANCH_RELAY_BASE_URL =
  "https://tt-confidence-hub-git-feat-evi-31b8c6-relief-works-technologies.vercel.app";

function isAllowedSandboxReturnOrigin(value: string | null | undefined) {
  try {
    const parsed = new URL(String(value || "").trim());
    const hostname = parsed.hostname.toLowerCase();
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".vercel.app") ||
      hostname === "responseintegrity.co.za" ||
      hostname.endsWith(".responseintegrity.co.za")
    );
  } catch {
    return false;
  }
}

function resolveSandboxPaymentReturnOrigin(req: Request) {
  const origin = String(req.get("origin") || "").trim();
  if (isAllowedSandboxReturnOrigin(origin)) {
    return new URL(origin).origin;
  }

  const referer = String(req.get("referer") || "").trim();
  if (isAllowedSandboxReturnOrigin(referer)) {
    return new URL(referer).origin;
  }

  return getAppBaseUrl();
}

function getPayfastSandboxRelayBaseUrl() {
  const configured = String(process.env.PAYFAST_SANDBOX_RELAY_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  const vercelUrl = String(process.env.VERCEL_URL || "").trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  if (String(process.env.VERCEL_ENV || "").trim().toLowerCase() === "production") {
    return getAppBaseUrl();
  }

  return PAYFAST_SANDBOX_BRANCH_RELAY_BASE_URL;
}

function buildPayfastSandboxReturnUrl(
  req: Request,
  state: "return" | "cancelled",
  merchantReference: string,
) {
  const relay = new URL("/payfast-sandbox-return.html", getPayfastSandboxRelayBaseUrl());
  relay.searchParams.set("payfast", state);
  relay.searchParams.set("merchantReference", merchantReference);
  relay.searchParams.set("targetOrigin", resolveSandboxPaymentReturnOrigin(req));
  return relay.toString();
}

function usePayfastSandbox() {
  return String(process.env.PAYFAST_SANDBOX || "").trim().toLowerCase() === "true";
}

function isSandboxPaymentEnrollment(enrollment: any) {
  return (
    Boolean(enrollment?.is_sandbox_account) ||
    isHeuristicSandboxEnrollment(enrollment, enrollment?.assigned_tutor_id) ||
    String(enrollment?.current_step || "").trim().toLowerCase().startsWith("sandbox-")
  );
}

const PAYFAST_PUBLIC_SANDBOX_MERCHANT_ID = "10004002";
const PAYFAST_PUBLIC_SANDBOX_MERCHANT_KEY = "q1cd2rdny4a53";
const PAYFAST_PUBLIC_SANDBOX_PASSPHRASE = "payfast";

function isValidPayfastMerchantId(value: string) {
  return /^\d{8}$/.test(String(value || "").trim());
}

function isValidPayfastMerchantKey(value: string) {
  return /^[A-Za-z0-9]{13}$/.test(String(value || "").trim());
}

function getPayfastConfig(useSandbox: boolean) {
  if (useSandbox) {
    // Use PayFast's currently documented shared sandbox credentials with the
    // matching passphrase. Live credentials never participate in this path.
    return {
      merchantId: PAYFAST_PUBLIC_SANDBOX_MERCHANT_ID,
      merchantKey: PAYFAST_PUBLIC_SANDBOX_MERCHANT_KEY,
      passphrase: PAYFAST_PUBLIC_SANDBOX_PASSPHRASE,
      processUrl: getPayfastProcessUrl(true),
    };
  }

  return {
    merchantId: String(process.env.PAYFAST_MERCHANT_ID || "").trim(),
    merchantKey: String(process.env.PAYFAST_MERCHANT_KEY || "").trim(),
    passphrase: String(process.env.PAYFAST_PASSPHRASE || "").trim(),
    processUrl: getPayfastProcessUrl(false),
  };
}

function isMonthlyPackagePaymentReady(useSandbox = usePayfastSandbox()) {
  const config = getPayfastConfig(useSandbox);
  return (
    isValidPayfastMerchantId(config.merchantId) &&
    isValidPayfastMerchantKey(config.merchantKey)
  );
}

function buildPackagePaymentDescription(
  studentName: string | null | undefined,
  packageKey: MonthlyPackageKey = DEFAULT_MONTHLY_PACKAGE_KEY,
) {
  const label = String(studentName || "student").trim() || "student";
  const servicePackage = getMonthlyServicePackage(packageKey);
  return `Response Integrity ${servicePackage.sessionsPerMonth}-session monthly package for ${label}`;
}

function isValidPayfastEmail(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function buildCompactSandboxSeed(seed: string | null | undefined) {
  return (
    String(seed || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10) || "parent"
  );
}

function buildCompactSandboxEmailPrefix(prefix: string, seed: string | null | undefined) {
  return `${prefix}-${buildCompactSandboxSeed(seed)}-`;
}

function buildCompactSandboxEmail(prefix: string, seed: string | null | undefined) {
  const compactSeed = buildCompactSandboxSeed(seed);
  const compactTime = Date.now().toString(36).slice(-8);
  return `${prefix}-${compactSeed}-${compactTime}-responseintegrity@gmail.com`;
}

function resolvePayfastEmailAddress(options: {
  dbUserEmail?: string | null;
  enrollmentEmail?: string | null;
  parentId?: string | null;
  useSandbox: boolean;
}) {
  if (options.useSandbox) {
    return buildCompactSandboxEmail("sandbox-payfast", options.parentId);
  }

  const candidates = [options.dbUserEmail, options.enrollmentEmail].map((value) => String(value || "").trim());
  const validCandidate = candidates.find((value) => isValidPayfastEmail(value));
  if (validCandidate) return validCandidate;

  return "";
}

// Extend Express session type to include affiliateCode
declare module 'express-session' {
  interface SessionData {
    affiliateCode?: string;
  }
}

const battleTestResponseSchema = z.object({
  phaseKey: z.string().min(1),
  questionKey: z.string().min(1),
  score: z.enum(["clear", "partial", "fail"]),
  answerEvidence: z.string().trim().min(1),
  note: z.string().optional(),
  isCriticalFail: z.boolean().optional(),
});

const battleTestVariantSchema = z.enum(
  BATTLE_TEST_VARIANT_KEYS as unknown as [BattleTestVariantKey, ...BattleTestVariantKey[]]
);

const tutorBattleTestSubmissionSchema = z.object({
  tutorAssignmentId: z.string().min(1),
  tutorId: z.string().min(1),
  phaseKeys: z.array(z.string().min(1)).min(1),
  phaseVariants: z.record(z.string().min(1), battleTestVariantSchema),
  responses: z.array(battleTestResponseSchema).min(1),
});

const tdBattleTestSubmissionSchema = z.object({
  tdId: z.string().min(1),
  responses: z.array(battleTestResponseSchema).min(1),
});


// Helper middleware to check user role
const requireRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: Function) => {
    const dbUser = (req as any).dbUser;
    console.log("🔐 requireRole check:", {
      hasDbUser: !!dbUser,
      dbUserRole: dbUser?.role,
      requiredRoles: roles,
      isAuthorized: dbUser && roles.includes(dbUser.role)
    });
    if (!dbUser || !roles.includes(dbUser.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};

async function getTutorOperationalMode(tutorId: string): Promise<TutorTrainingMode> {
  return getTutorCertificationMode(tutorId);
}

async function reconcileSandboxTrainingPrerequisite(input: {
  tutorId: string;
  assignmentId: string;
  mode: TutorTrainingMode;
}): Promise<TutorTrainingMode> {
  if (input.mode !== "sandbox") return input.mode;

  try {
    const capabilityState = await getSpecialistCapabilityTrainingState({
      tutorAssignmentId: input.assignmentId,
      tutorId: input.tutorId,
      skipStageGate: true,
    });

    if (capabilityState.sandboxReady) return input.mode;

    await pool.query(
      `UPDATE public.tutor_assignments
          SET operational_mode = 'training'
        WHERE id = $1
          AND tutor_id = $2
          AND operational_mode = 'sandbox'`,
      [input.assignmentId, input.tutorId],
    );
    await pool.query(
      `UPDATE public.tutor_battle_test_statuses
          SET mode = 'training',
              updated_at = now(),
              last_synced_at = now()
        WHERE tutor_assignment_id = $1
          AND tutor_id = $2
          AND mode = 'sandbox'`,
      [input.assignmentId, input.tutorId],
    );

    console.warn("[SPECIALIST STAGE RECONCILIATION] Sandbox prerequisite incomplete; reverted to Training", {
      tutorId: input.tutorId,
      assignmentId: input.assignmentId,
    });
    return "training";
  } catch (error) {
    console.error("[SPECIALIST STAGE RECONCILIATION] Could not verify Sandbox prerequisite; failing closed to Training", {
      tutorId: input.tutorId,
      assignmentId: input.assignmentId,
      message: error instanceof Error ? error.message : String(error),
    });
    return "training";
  }
}

export function resolveEmergencyTutorMode({
  assignmentMode,
  certificationMode,
}: {
  assignmentMode?: string | null;
  certificationMode?: string | null;
}): TutorTrainingMode {
  return (String(certificationMode || "").trim() || String(assignmentMode || "training").trim() || "training") as TutorTrainingMode;
}

export function mapEmergencyTutorParentReport(report: any, structuredData: any = null) {
  return {
    id: report.id,
    tutorId: report.tutor_id,
    studentId: report.student_id,
    parentId: report.parent_id,
    reportType: report.report_type,
    weekNumber: report.week_number,
    monthName: report.month_name,
    summary: report.summary,
    topicsLearned: report.topics_learned,
    strengths: report.strengths,
    areasForGrowth: report.areas_for_growth,
    bossBattlesCompleted: report.boss_battles_completed,
    solutionsUnlocked: report.solutions_unlocked,
    confidenceGrowth: report.confidence_growth,
    nextSteps: report.next_steps,
    parentFeedback: report.parent_feedback,
    parentFeedbackAt: report.parent_feedback_at,
    sentAt: report.sent_at,
    createdAt: report.created_at,
    structuredData,
  };
}

function isLiveSchedulingMode(mode: TutorTrainingMode) {
  return mode === "trial" || mode === "certified_live";
}

function isFamilySchedulingMode(mode: TutorTrainingMode) {
  return mode === "sandbox" || isLiveSchedulingMode(mode);
}

async function getTutorCertificationMode(tutorId: string): Promise<TutorTrainingMode> {
  const assignment = await storage.getTutorAssignment(tutorId);
  if (isEmergencyDbMode()) {
    if (!assignment?.id) return "training";
    const certificationResult = await pool.query(
      `SELECT mode
         FROM public.tutor_battle_test_statuses
        WHERE tutor_assignment_id = $1
        LIMIT 1`,
      [assignment.id],
    );
    const certificationMode = String(certificationResult.rows[0]?.mode || "").trim() as TutorTrainingMode;
    const assignmentMode = String(assignment.operationalMode || "training").trim() as TutorTrainingMode;
    if (certificationMode && certificationMode !== assignmentMode) {
      console.warn("[EMERGENCY MODE DRIFT]", {
        tutorId,
        assignmentId: assignment.id,
        assignmentMode,
        certificationMode,
      });

      // Preview Proof should not keep carrying a stale assignment mode once the
      // authoritative battle-test/certification state is known. Repair only in
      // Vercel Preview so production emergency continuity remains read-only
      // with respect to mode drift.
      if (process.env.VERCEL_ENV === "preview") {
        try {
          const repairResult = await pool.query(
            `UPDATE public.tutor_assignments
                SET operational_mode = $1
              WHERE id = $2
                AND tutor_id = $3
                AND operational_mode <> $1
              RETURNING id, operational_mode`,
            [certificationMode, assignment.id, tutorId],
          );
          if (repairResult.rows[0]) {
            console.info("[EMERGENCY MODE DRIFT] preview assignment repaired", {
              tutorId,
              assignmentId: assignment.id,
              operationalMode: repairResult.rows[0].operational_mode,
            });
          }
        } catch (error) {
          console.warn("[EMERGENCY MODE DRIFT] preview repair failed", {
            tutorId,
            assignmentId: assignment.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    const resolvedMode = resolveEmergencyTutorMode({ assignmentMode, certificationMode });
    return reconcileSandboxTrainingPrerequisite({
      tutorId,
      assignmentId: assignment.id,
      mode: resolvedMode,
    });
  }
  if (!assignment?.id) {
    const { data: portableSnapshot } = await supabase
      .from("tutor_portable_certification_snapshots")
      .select("mode")
      .eq("tutor_id", tutorId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return (portableSnapshot?.mode as TutorTrainingMode | undefined) || "training";
  }

  const { data: certificationStatus } = await supabase
    .from("tutor_battle_test_statuses")
    .select("mode")
    .eq("tutor_assignment_id", assignment.id)
    .maybeSingle();

  if (certificationStatus?.mode) {
    const persistedMode = certificationStatus.mode as TutorTrainingMode;
    if (persistedMode !== "watchlist" && persistedMode !== "training" && persistedMode !== "applicant") {
      return reconcileSandboxTrainingPrerequisite({
        tutorId,
        assignmentId: assignment.id,
        mode: persistedMode,
      });
    }

    try {
      const tutor = await storage.getUser(tutorId);
      const students = await storage.getStudentsByTutor(tutorId);
      const summary = await buildPodBattleTestingSummary(
        assignment.podId,
        [
          {
            assignmentId: assignment.id,
            tutorId,
            tutorName: tutor?.name || tutor?.firstName || "Unknown Tutor",
            tutorEmail: tutor?.email || "",
            studentCount: students.length,
          },
        ],
        null
      );
      const reconciledMode = summary.tutorSummaries.find((entry) => entry.assignmentId === assignment.id)?.mode;
      if (reconciledMode) {
        return reconciledMode;
      }
    } catch (error) {
      console.error("Failed to reconcile tutor certification mode:", error);
    }

    return persistedMode;
  }

  const { data: portableSnapshot } = await supabase
    .from("tutor_portable_certification_snapshots")
    .select("mode")
    .eq("tutor_id", tutorId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (portableSnapshot?.mode) {
    return portableSnapshot.mode as TutorTrainingMode;
  }

  return (assignment?.operationalMode as TutorTrainingMode | undefined) || "training";
}

async function getTutorSandboxReadiness(tutorId: string) {
  const assignment = await storage.getTutorAssignment(tutorId);
  if (!assignment?.id) throw new Error("Specialist must have an active pod assignment.");

  const [
    tutor,
    students,
    docsComplete,
    latestAssessment,
    pathway,
    sandboxAccounts,
    capabilityReadiness,
    trainingState,
    criticalFailResult,
  ] = await Promise.all([
    storage.getUser(tutorId),
    storage.getStudentsByTutor(tutorId),
    checkTutorDocumentationComplete(tutorId),
    getLatestSandboxReadinessAssessment(assignment.id),
    getSpecialistDevelopmentPathway(tutorId),
    supabase
      .from("parent_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("assigned_tutor_id", tutorId)
      .eq("is_sandbox_account", true)
      .in("status", ACTIVE_PARENT_ENROLLMENT_STATUSES),
    getSandboxCapabilityReadiness({
      tutorAssignmentId: assignment.id,
      tutorId,
    }),
    getSpecialistCapabilityTrainingState({
      tutorAssignmentId: assignment.id,
      tutorId,
    }),
    pool.query(
      `SELECT DISTINCT ON (assessment_key) passed, has_critical_fail
         FROM public.specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
          AND tutor_id = $2
        ORDER BY assessment_key, completed_at DESC`,
      [assignment.id, tutorId],
    ),
  ]);

  const summary = await buildPodBattleTestingSummary(
    assignment.podId,
    [{
      assignmentId: assignment.id,
      tutorId,
      tutorName: tutor?.name || tutor?.firstName || "Unknown Specialist",
      tutorEmail: tutor?.email || "",
      studentCount: students.length,
    }],
    null,
  );
  const specialistSummary = summary.tutorSummaries[0] || null;
  const moduleProgress = specialistSummary?.moduleProgress || [];
  const transformationAssessments = trainingState.assessments.filter(
    (assessment) => assessment.stage === "transformation_mastery",
  );
  const sessionInfrastructureAssessments = trainingState.assessments.filter(
    (assessment) => assessment.stage === "session_infrastructure_mastery",
  );
  const transformationComplete =
    transformationAssessments.length > 0 &&
    transformationAssessments.every((assessment) => assessment.status === "complete");
  const sessionInfrastructureComplete =
    sessionInfrastructureAssessments.length > 0 &&
    sessionInfrastructureAssessments.every((assessment) => assessment.status === "complete");
  const hasActiveFailHealth = criticalFailResult.rows.some(
    (row) => Boolean(row.has_critical_fail) && !Boolean(row.passed),
  );

  const preparationGate = evaluateSandboxPreparationGate({
    docsComplete,
    transformationComplete,
    sessionInfrastructureComplete,
    hasActiveFailHealth,
    sandboxAccountCount: sandboxAccounts.count || 0,
  });
  const preparationBlockers = preparationGate.blockers;

  const blockers = [...preparationBlockers];
  if (!capabilityReadiness.practicalsReady) {
    blockers.push(capabilityReadiness.reason);
  }
  if (!latestAssessment) {
    blockers.push("TD Sandbox readiness assessment has not been recorded.");
  } else if (latestAssessment.decision !== "passed") {
    blockers.push("The latest TD Sandbox readiness assessment requires remediation.");
  }

  return {
    tutorId,
    tutorAssignmentId: assignment.id,
    mode: specialistSummary?.mode || assignment.operationalMode || "training",
    pathway,
    sandboxAccountCount: sandboxAccounts.count || 0,
    moduleProgress,
    capabilityReadiness,
    latestAssessment,
    gate: {
      readyForPracticals: blockers.length === 0,
      blockers,
      preparationBlockers,
      systemPracticalsReady: capabilityReadiness.practicalsReady === true,
      tdApproved: latestAssessment?.decision === "passed",
      nextStage: "practicals" as const,
      automaticTransition: false as const,
    },
  };
}

async function createPortableTutorAssignment(tutorId: string, podId: string) {
  const assignment = await storage.createTutorAssignment({
    tutorId,
    podId,
    certificationStatus: "pending",
  });

  try {
    await hydrateTutorAssignmentFromPortableSnapshot(assignment.id, tutorId);
    await linkSpecialistPathwayAssignment(tutorId, assignment.id);
    return assignment;
  } catch (error: any) {
    try {
      await clearTutorAssignmentCertificationState(assignment.id);
    } catch (cleanupError) {
      console.error("Failed to clear partial tutor certification state during assignment rollback:", cleanupError);
    }

    try {
      await storage.deleteTutorAssignment(assignment.id);
    } catch (rollbackError) {
      console.error("Failed to roll back tutor assignment after portable hydration error:", rollbackError);
      throw new Error(
        `Failed to restore tutor portability state and could not roll back pod assignment: ${error?.message || "Unknown error"}`
      );
    }

    throw new Error(`Failed to restore tutor portability state on new pod assignment: ${error?.message || "Unknown error"}`);
  }
}

async function rollbackPortableTutorAssignments(assignments: Array<{ id: string }>) {
  for (const assignment of [...assignments].reverse()) {
    try {
      await clearTutorAssignmentCertificationState(assignment.id);
    } catch (cleanupError) {
      console.error("Failed to clear tutor certification state during pod assignment rollback:", cleanupError);
    }

    try {
      await storage.deleteTutorAssignment(assignment.id);
    } catch (rollbackError) {
      console.error("Failed to delete tutor assignment during rollback:", rollbackError);
    }
  }
}

export function buildEmergencyParentTrialCaseContract(enrollmentLike?: { assignment_lane?: string | null; assignmentLane?: string | null } | null) {
  const assignmentLane = String(enrollmentLike?.assignment_lane ?? enrollmentLike?.assignmentLane ?? "").trim().toLowerCase();
  if (assignmentLane === "trial") {
    return { case: null, unavailable: true };
  }
  return { case: null, unavailable: false };
}

export function buildEmergencyParentStudentStats({
  sessionCount = 0,
  commitmentCount = 0,
  currentStreak = 0,
  introDiagnosisCount = 0,
  trainingSessionCount = 0,
  bossBattlesCompleted = 0,
  solutionsUnlocked = 0,
}: {
  sessionCount?: number;
  commitmentCount?: number;
  currentStreak?: number;
  introDiagnosisCount?: number;
  trainingSessionCount?: number;
  bossBattlesCompleted?: number;
  solutionsUnlocked?: number;
} = {}) {
  return {
    introDiagnosisCompleted: Number(introDiagnosisCount || 0),
    bossBattlesCompleted: Number(bossBattlesCompleted || 0),
    solutionsUnlocked: Number(solutionsUnlocked || 0),
    confidenceGrowth: 50,
    sessionsCompleted: Number(sessionCount || 0),
    trainingSessionsCompleted: Number(trainingSessionCount || 0),
    currentStreak: Number(currentStreak || 0),
    totalCommitments: Number(commitmentCount || 0),
  };
}

export function mapEmergencyNotification(row: any) {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    actorUserId: row.actor_user_id,
    channel: row.channel || "informational",
    title: row.title,
    message: row.message,
    link: row.link,
    entityType: row.entity_type,
    entityId: row.entity_id,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function getEmergencyBroadcastVisibilities(role: string | null | undefined): string[] {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "tutor") return ["all", "tutors"];
  if (normalizedRole === "parent") return ["all", "parents"];
  if (normalizedRole === "student") return ["all", "students"];
  if (normalizedRole === "td") return ["all", "tds"];
  if (normalizedRole === "coo") return ["all", "ceo"];
  if (normalizedRole === "affiliate") return ["all", "affiliates"];
  if (normalizedRole === "od") return ["all", "od"];
  if (normalizedRole === "hr") return ["all", "hr"];
  return ["all"];
}

export function mapEmergencyBroadcast(row: any) {
  return {
    id: row.id,
    subject: row.subject || "(No Subject)",
    message: row.message,
    senderRole: row.sender_role,
    visibility: row.visibility,
    channel: row.channel,
    createdAt: row.created_at,
  };
}

async function getParentAssignedTutorOperationalMode(parentId: string): Promise<TutorTrainingMode> {
  let assignedTutorId: string | null = null;

  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT ta.operational_mode
         FROM public.parent_enrollments pe
        JOIN public.tutor_assignments ta ON ta.tutor_id = pe.assigned_tutor_id::text
        WHERE pe.user_id = $1
        ORDER BY pe.updated_at DESC
        LIMIT 1`,
      [parentId],
    );
    return (result.rows[0]?.operational_mode as TutorTrainingMode | undefined) || "training";
  }

  const directEnrollmentResult = await supabase
    .from("parent_enrollments")
    .select("assigned_tutor_id, updated_at")
    .eq("user_id", parentId)
    .order("updated_at", { ascending: false })
    .limit(1);

  assignedTutorId = String(directEnrollmentResult.data?.[0]?.assigned_tutor_id || "").trim() || null;

  if (!assignedTutorId) {
    const { data: userRow } = await supabase
      .from("users")
      .select("email")
      .eq("id", parentId)
      .maybeSingle();

    const parentEmail = normalizeEmail(userRow?.email);

    if (parentEmail) {
      const emailEnrollmentResult = await supabase
        .from("parent_enrollments")
        .select("assigned_tutor_id, updated_at")
        .eq("parent_email", parentEmail)
        .order("updated_at", { ascending: false })
        .limit(1);

      assignedTutorId = String(emailEnrollmentResult.data?.[0]?.assigned_tutor_id || "").trim() || null;

      if (!assignedTutorId) {
        const studentResult = await supabase
          .from("students")
          .select("tutor_id, created_at")
          .eq("parent_contact", parentEmail)
          .order("created_at", { ascending: false })
          .limit(1);

        assignedTutorId = String(studentResult.data?.[0]?.tutor_id || "").trim() || null;
      }
    }
  }

  if (!assignedTutorId) {
    const studentResult = await supabase
      .from("students")
      .select("tutor_id, created_at")
      .eq("parent_id", parentId)
      .order("created_at", { ascending: false })
      .limit(1);

    assignedTutorId = String(studentResult.data?.[0]?.tutor_id || "").trim() || null;
  }

  if (!assignedTutorId) return "training";
  return getTutorOperationalMode(assignedTutorId);
}

async function getStudentOperationalMode(studentId: string): Promise<TutorTrainingMode> {
  const student = await storage.getStudent(studentId);
  if (!student?.tutorId) return "training";
  return getTutorOperationalMode(student.tutorId);
}

function isMissingSandboxAccountColumnError(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("is_sandbox_account") || message.includes("student_gender") || message.includes("assignment_lane");
}

function isTutorScopedSandboxParentEmail(parentEmail: string | null | undefined, tutorId?: string) {
  if (!tutorId) return false;
  const normalizedEmail = String(parentEmail || "").trim().toLowerCase();
  return (
    normalizedEmail.startsWith(buildCompactSandboxEmailPrefix("sandbox-parent", tutorId)) &&
    normalizedEmail.endsWith("@gmail.com")
  );
}

function isHeuristicSandboxEnrollment(enrollment: any, tutorId?: string) {
  const parentEmail = String(enrollment?.parent_email || "").trim().toLowerCase();
  const parentName = String(enrollment?.parent_full_name || "").trim().toLowerCase();
  const studentName = String(enrollment?.student_full_name || "").trim().toLowerCase();

  return (
    (
      (tutorId
        ? isTutorScopedSandboxParentEmail(parentEmail, tutorId)
        : parentEmail.startsWith("sandbox-parent-")) &&
      parentEmail.endsWith("@gmail.com")
    ) ||
    parentName.startsWith("sandbox ") ||
    studentName.startsWith("sandbox ")
  );
}

function isHeuristicSandboxStudent(student: any, tutorId?: string) {
  const parentContact = String(student?.parent_contact || student?.parentContact || "").trim().toLowerCase();
  const studentName = String(student?.name || "").trim().toLowerCase();

  return (
    (
      (tutorId
        ? isTutorScopedSandboxParentEmail(parentContact, tutorId)
        : parentContact.startsWith("sandbox-parent-")) &&
      parentContact.endsWith("@gmail.com")
    ) ||
    studentName.startsWith("sandbox ")
  );
}

function isSandboxLikeEnrollment(enrollment: any, tutorId?: string) {
  return (
    Boolean(enrollment?.is_sandbox_account) ||
    isHeuristicSandboxEnrollment(enrollment, tutorId || enrollment?.assigned_tutor_id) ||
    String(enrollment?.current_step || "").trim().toLowerCase().startsWith("sandbox-")
  );
}

async function resolveSandboxContextForParentStudent(options: {
  parentId: string;
  studentId?: string | null;
  tutorId?: string | null;
}) {
  if (!options.parentId) return false;

  const query = supabase
    .from("parent_enrollments")
    .select("id, is_sandbox_account, parent_email, current_step, assigned_tutor_id")
    .eq("user_id", options.parentId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (options.studentId) {
    query.eq("assigned_student_id", options.studentId);
  }

  const { data: enrollment, error } = await query.maybeSingle();
  if (!error && enrollment) {
    if (isSandboxLikeEnrollment(enrollment, options.tutorId || enrollment?.assigned_tutor_id)) {
      return true;
    }
  }

  if (options.studentId) {
    try {
      const student = await storage.getStudent(options.studentId);
      if (isHeuristicSandboxStudent(student, options.tutorId || (enrollment as any)?.assigned_tutor_id)) {
        return true;
      }
    } catch (err) {
      console.error("Failed to resolve student for sandbox context:", err);
    }
  }

  return false;
}

function studentMatchesEnrollmentSandboxBoundary(enrollment: any, student: any, tutorId?: string) {
  const sandboxEnrollment = isSandboxLikeEnrollment(enrollment, tutorId || enrollment?.assigned_tutor_id);
  const sandboxStudent = isHeuristicSandboxStudent(student, tutorId || enrollment?.assigned_tutor_id);
  return sandboxEnrollment ? sandboxStudent : !sandboxStudent;
}

function isTrafficVisibleEnrollment(enrollment: any) {
  return !isSandboxLikeEnrollment(enrollment, enrollment?.assigned_tutor_id);
}

let ensureStudentForEnrollment: (enrollment: any, tutorIdOverride?: string) => Promise<any> = async () => null;

async function loadTutorAssignedEnrollments(
  tutorId: string,
  options?: {
    sandboxOnly?: boolean;
    ordered?: boolean;
    includeAnyAssignedState?: boolean;
  }
) {
  const sandboxOnly = !!options?.sandboxOnly;
  const ordered = !!options?.ordered;
  const includeAnyAssignedState = !!options?.includeAnyAssignedState;

  if (isEmergencyDbMode()) {
    const values: unknown[] = [tutorId];
    const conditions = ["assigned_tutor_id = $1"];
    if (!includeAnyAssignedState) {
      values.push(ACTIVE_PARENT_ENROLLMENT_STATUSES);
      conditions.push(buildEmergencyEnrollmentStatusFilter(values.length));
    }
    if (sandboxOnly) {
      values.push(true);
      conditions.push(`is_sandbox_account = $${values.length}`);
    }
    const result = await pool.query(
      `SELECT * FROM public.parent_enrollments
        WHERE ${conditions.join(" AND ")}
        ${ordered ? "ORDER BY updated_at DESC" : ""}`,
      values,
    );
    return { data: result.rows, error: null };
  }

  let query = supabase
    .from("parent_enrollments")
    .select("*")
    .eq("assigned_tutor_id", tutorId);

  if (!includeAnyAssignedState) {
    query = query.in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES]);
  }

  if (sandboxOnly) {
    query = query.eq("is_sandbox_account", true);
  }

  if (ordered) {
    query = query.order("updated_at", { ascending: false });
  }

  let { data, error } = await query;
  if (error && sandboxOnly && isMissingSandboxAccountColumnError(error)) {
    let fallbackQuery = supabase
      .from("parent_enrollments")
      .select("*")
      .eq("assigned_tutor_id", tutorId);

    if (!includeAnyAssignedState) {
      fallbackQuery = fallbackQuery.in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES]);
    }

    if (ordered) {
      fallbackQuery = fallbackQuery.order("updated_at", { ascending: false });
    }

    const fallback = await fallbackQuery;
    data = (fallback.data || []).filter((enrollment: any) => isHeuristicSandboxEnrollment(enrollment, tutorId));
    error = fallback.error;
  }

  return { data: data || [], error };
}

async function normalizeSandboxIdentitiesForTutor(tutorId: string, enrollments: any[]) {
  const orderedEnrollments = [...(enrollments || [])].sort((left, right) => {
    const leftCreatedAt = new Date(String(left?.created_at || "")).getTime();
    const rightCreatedAt = new Date(String(right?.created_at || "")).getTime();
    const safeLeftCreatedAt = Number.isNaN(leftCreatedAt) ? Number.MAX_SAFE_INTEGER : leftCreatedAt;
    const safeRightCreatedAt = Number.isNaN(rightCreatedAt) ? Number.MAX_SAFE_INTEGER : rightCreatedAt;

    return safeLeftCreatedAt - safeRightCreatedAt || String(left?.id || "").localeCompare(String(right?.id || ""));
  });

  const normalizedEnrollments: any[] = [];
  for (let index = 0; index < orderedEnrollments.length; index += 1) {
    const enrollment = orderedEnrollments[index];
    const studentName = `Sandbox Student ${index + 1}`;
    const parentName = `Sandbox Parent ${index + 1}`;
    const identityUpdate: Record<string, string> = {};

    if (String(enrollment?.student_full_name || "").trim() !== studentName) {
      identityUpdate.student_full_name = studentName;
    }
    if (String(enrollment?.parent_full_name || "").trim() !== parentName) {
      identityUpdate.parent_full_name = parentName;
    }

    let normalizedEnrollment = { ...enrollment, ...identityUpdate };
    if (enrollment?.id && Object.keys(identityUpdate).length > 0) {
      const { data: updatedEnrollment, error: updateError } = await supabase
        .from("parent_enrollments")
        .update(identityUpdate)
        .eq("id", enrollment.id)
        .select("*")
        .maybeSingle();

      if (updateError) {
        console.error("Failed to normalize sandbox enrollment identity:", enrollment.id, updateError);
      } else if (updatedEnrollment) {
        normalizedEnrollment = updatedEnrollment;
      }
    }

    try {
      await ensureStudentForEnrollment(normalizedEnrollment, tutorId);
    } catch (error) {
      console.error("Failed to sync sandbox student identity:", normalizedEnrollment?.id, error);
    }

    normalizedEnrollments.push(normalizedEnrollment);
  }

  return normalizedEnrollments;
}

async function loadDetachedSandboxEnrollmentsForTutor(tutorId: string) {
  let { data, error } = await supabase
    .from("parent_enrollments")
    .select("*")
    .is("assigned_tutor_id", null)
    .eq("status", "awaiting_assignment")
    .eq("is_sandbox_account", true)
    .order("updated_at", { ascending: true });

  if (error && isMissingSandboxAccountColumnError(error)) {
    const fallback = await supabase
      .from("parent_enrollments")
      .select("*")
      .is("assigned_tutor_id", null)
      .eq("status", "awaiting_assignment")
      .order("updated_at", { ascending: true });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return { data: [] as any[], error };
  }

  return {
    data: (data || []).filter((enrollment: any) =>
      isTutorScopedSandboxParentEmail(enrollment?.parent_email, tutorId)
    ),
    error: null,
  };
}

function hasCanonicalSandboxResponseSignals(enrollment: any): boolean {
  if (!enrollment || typeof enrollment !== "object") {
    return false;
  }

  const responseSymptoms = normalizeResponseSymptoms(enrollment.response_symptoms);
  const topicResponseSymptoms =
    enrollment.to…237152 tokens truncated…     movement = "changed";
            }
          }

          const daysSinceUpdate = Math.floor((now - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24));
          const bucket = daysSinceUpdate <= 14 ? "active" : daysSinceUpdate <= 45 ? "recent" : "older";

          return {
            topic,
            phase: latest.phase,
            stability: latest.stability,
            lastUpdated: latest.date,
            previousPhase: previous?.phase || null,
            previousStability: previous?.stability || null,
            movement,
            bucket,
          };
        })
        .filter((row): row is NonNullable<typeof row> => !!row)
        // The parent view must reflect the Specialist's complete current
        // topic map. Age is presentation metadata, not permission to hide a
        // topic that is still active in the student's conditioning record.
        .sort((a, b) => {
          if (a.bucket !== b.bucket) return a.bucket === "active" ? -1 : 1;
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        });

      const dedupedRows = Array.from(
        rows.reduce((map, row) => {
          const key = String(row.topic || "").trim().toLowerCase();
          const existing = map.get(key);

          if (!existing) {
            map.set(key, row);
            return map;
          }

          const existingDate = new Date(existing.lastUpdated || 0).getTime();
          const rowDate = new Date(row.lastUpdated || 0).getTime();

          if (rowDate >= existingDate) {
            map.set(key, row);
          }

          return map;
        }, new Map<string, any>())
        .values()
      ).sort((a, b) => {
        if (a.bucket !== b.bucket) return a.bucket === "active" ? -1 : 1;
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      });

      res.json(dedupedRows);
    } catch (error) {
      console.error("Error fetching student topic conditioning states:", error);
      res.status(500).json({ message: "Failed to fetch topic conditioning states" });
    }
  });

  // ========================================
  // PARENT PORTAL ROUTES
  // ========================================

  // Get parent's student stats
  app.get("/api/parent/student-stats", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;

      if (isEmergencyDbMode()) {
        const enrollmentResult = await pool.query(
          `SELECT id, assigned_tutor_id, user_id, student_full_name FROM public.parent_enrollments
            WHERE user_id = $1
            ORDER BY updated_at DESC
            LIMIT 1`,
          [parentId],
        );
        const enrollment = enrollmentResult.rows[0];
        const studentResult = await pool.query(
          `SELECT id
             FROM public.students
            WHERE parent_enrollment_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
           [enrollment?.id || null],
        );
        const studentId = studentResult.rows[0]?.id || null;
        if (!studentId) {
          return res.json(buildEmergencyParentStudentStats());
        }
        const [scheduledSessionResult, drillResult, trainingRunResult, commitmentResult, streakResult] = await Promise.all([
          pool.query(
            `SELECT id, type, status, parent_confirmed, tutor_confirmed
               FROM public.scheduled_sessions
              WHERE student_id = $1 AND type IN ('intro', 'training')`,
            [studentId],
          ),
          pool.query(
            `SELECT id, scheduled_session_id, training_session_run_id, drill
               FROM public.intro_session_drills
              WHERE student_id = $1
              ORDER BY submitted_at DESC`,
            [studentId],
          ),
          pool.query(
            `SELECT id, scheduled_session_id, topic_count, status
               FROM public.training_session_runs
              WHERE student_id = $1
              ORDER BY submitted_at DESC`,
            [studentId],
          ),
          pool.query("SELECT count(*)::int AS count FROM public.student_commitments WHERE student_id = $1 AND is_active = true", [studentId]),
          pool.query("SELECT COALESCE(MAX(streak_count), 0)::int AS streak_count FROM public.student_commitments WHERE student_id = $1 AND is_active = true", [studentId]),
        ]);

        const parseDrillPayload = (value: unknown) => {
          if (typeof value !== "string") return null;
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        };
        const trainingRuns = trainingRunResult.rows.filter((row: any) =>
          ["submitted", "completed"].includes(String(row?.status || "").toLowerCase())
        );
        const introDrills = drillResult.rows.filter((row: any) => {
          const payload = parseDrillPayload(row?.drill);
          const drillType = payload?.drillType || (row?.training_session_run_id ? "training" : "diagnosis");
          return String(drillType).trim().toLowerCase() === "diagnosis";
        });
        const completedSessionKeys = new Set<string>();
        introDrills.forEach((row: any) => {
          completedSessionKeys.add(row.scheduled_session_id ? `intro:${row.scheduled_session_id}` : `intro:${row.id}`);
        });
        trainingRuns.forEach((row: any) => {
          const sessionId = String(row.scheduled_session_id || "").trim();
          const runId = String(row.id || "").trim();
          completedSessionKeys.add(`training:${sessionId || runId}`);
        });
        const completedTrainingSessions = scheduledSessionResult.rows.filter((row: any) =>
          String(row.type || "").toLowerCase() === "training" &&
          getEffectiveScheduledSessionStatus(row) === "completed"
        );
        if (trainingRuns.length === 0) {
          completedTrainingSessions.forEach((row: any) => completedSessionKeys.add(`training:${row.id}`));
        }
        const derivedBossBattles = trainingRuns.reduce((sum: number, row: any) => sum + Number(row.topic_count || 0), 0);
        const derivedSolutionsUnlocked = trainingRuns.length;
        return res.json(buildEmergencyParentStudentStats({
          sessionCount: completedSessionKeys.size,
          commitmentCount: Number(commitmentResult.rows[0]?.count || 0),
          currentStreak: Number(streakResult.rows[0]?.streak_count || 0),
          introDiagnosisCount: introDrills.length,
          trainingSessionCount: completedTrainingSessions.length || trainingRuns.length,
          bossBattlesCompleted: derivedBossBattles,
          solutionsUnlocked: derivedSolutionsUnlocked,
        }));
      }

      const { data: enrollment, error: enrollmentError } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, user_id, student_full_name, student_grade, assigned_tutor_id, assigned_student_id, parent_email, proposal_id",
        fallbackSelect: "id, user_id, student_full_name, student_grade, assigned_tutor_id, parent_email, proposal_id",
      });

      if (enrollmentError) {
        return res.status(500).json({ message: "Failed to fetch enrollment" });
      }

      if (!enrollment?.assigned_tutor_id) {
        return res.json({
          introDiagnosisCompleted: 0,
          bossBattlesCompleted: 0,
          solutionsUnlocked: 0,
          confidenceGrowth: 0,
          sessionsCompleted: 0,
          trainingSessionsCompleted: 0,
          currentStreak: 0,
          totalCommitments: 0,
        });
      }

      const studentRecord = await resolveCanonicalStudentForEnrollment(enrollment);
      const studentId = studentRecord?.id || enrollment.assigned_student_id || null;

      const stats = studentId
        ? await getStudentDashboardStats(studentId)
        : {
            bossBattlesCompleted: 0,
            solutionsUnlocked: 0,
            currentStreak: 0,
            totalSessions: 0,
            trainingSessionsCompleted: 0,
            confidenceLevel: 50,
          };

      // Get commitments count
      let commitments: any[] | null = null;
      if (studentId) {
        const { data } = await supabase
          .from("student_commitments")
          .select("id")
          .eq("student_id", studentId)
          .eq("is_active", true);
        commitments = data || [];
      }

      res.json({
        introDiagnosisCompleted: (stats as any).introDiagnosisCompleted ?? 0,
        bossBattlesCompleted: stats.bossBattlesCompleted,
        solutionsUnlocked: stats.solutionsUnlocked,
        confidenceGrowth: 50,
        sessionsCompleted: stats.totalSessions,
        trainingSessionsCompleted: stats.trainingSessionsCompleted,
        currentStreak: stats.currentStreak,
        totalCommitments: commitments?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching parent student stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get parent's student info
  app.get("/api/parent/student-info", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;

      if (isEmergencyDbMode()) {
        const { data: enrollment } = await selectLatestParentEnrollment({
          parentId,
          primarySelect: "*",
        });
        if (!enrollment) return res.status(404).json({ message: "No enrollment found" });
        const student = await resolveCanonicalStudentForEnrollment(enrollment);
        let podName: string | null = null;
        if (enrollment.assigned_tutor_id) {
          const podResult = await pool.query(
            `SELECT p.pod_name
               FROM public.tutor_assignments ta
               JOIN public.pods p ON p.id = ta.pod_id
              WHERE ta.tutor_id = $1 AND p.deleted_at IS NULL
              LIMIT 1`,
            [enrollment.assigned_tutor_id],
          );
          podName = podResult.rows[0]?.pod_name || null;
        }
        return res.json({
          name: student?.name || enrollment.student_full_name,
          grade: student?.grade || enrollment.student_grade,
          podName,
        });
      }

      const { data: enrollment, error: enrollmentError } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, user_id, student_full_name, student_grade, assigned_tutor_id, assigned_student_id, parent_email",
        fallbackSelect: "id, user_id, student_full_name, student_grade, assigned_tutor_id, parent_email",
      });

      if (enrollmentError) {
        console.error("Error fetching parent enrollment:", enrollmentError);
      }

      if (!enrollment) {
        return res.status(404).json({ message: "No enrollment found" });
      }

      const studentRecord = await resolveCanonicalStudentForEnrollment(enrollment);

      // Get tutor's pod if assigned
      let podName = null;
      if (enrollment.assigned_tutor_id) {
        const { data: tutorAssignment, error: podError } = await supabase
          .from("tutor_assignments")
          .select("pod:pods(pod_name)")
          .eq("tutor_id", enrollment.assigned_tutor_id)
          .maybeSingle();

        if (podError) {
          console.error("Error fetching tutor pod:", podError);
        }

        const pod = tutorAssignment?.pod as { pod_name?: string } | null;
        if (pod) {
          podName = pod.pod_name || null;
        }
      }

      console.log("📊 Parent student info response:", {
        name: studentRecord?.name || enrollment.student_full_name,
        grade: studentRecord?.grade || enrollment.student_grade,
        podName: podName,
      });

      res.json({
        name: studentRecord?.name || enrollment.student_full_name,
        grade: studentRecord?.grade || enrollment.student_grade,
        podName: podName,
      });
    } catch (error) {
      console.error("Error fetching student info:", error);
      res.status(500).json({ message: "Failed to fetch student info" });
    }
  });

  app.get("/api/parent/topic-conditioning-states", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;

      const { data: enrollment, error: enrollmentError } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, user_id, student_full_name, student_grade, assigned_tutor_id, assigned_student_id, parent_email",
        fallbackSelect: "id, user_id, student_full_name, student_grade, assigned_tutor_id, parent_email",
      });

      if (enrollmentError) {
        return res.status(500).json({ message: "Failed to fetch enrollment" });
      }

      if (!enrollment?.assigned_tutor_id || !enrollment?.student_full_name) {
        return res.json([]);
      }

      const sanitizeTopic = (value?: string | null) => {
        const cleaned = String(value || "").trim();
        if (!cleaned) return null;
        if (cleaned.toLowerCase() === "onboarding baseline diagnostic") return null;
        return cleaned;
      };

      let studentRecord = await resolveCanonicalStudentForEnrollment(enrollment);

      if (!studentRecord && enrollment?.proposal_id) {
        const { data: proposalStudent } = await supabase
          .from("onboarding_proposals")
          .select("student_id")
          .eq("id", enrollment.proposal_id)
          .maybeSingle();

        if (proposalStudent?.student_id) {
          const proposalLinkedStudent = await storage.getStudent(String(proposalStudent.student_id));
          if (proposalLinkedStudent) {
            studentRecord = normalizeStudentRecord(proposalLinkedStudent);
          }
        }
      }

      if (!studentRecord) return res.json([]);

      const conceptMastery: any =
        studentRecord.conceptMastery && typeof studentRecord.conceptMastery === "object"
          ? studentRecord.conceptMastery
          : {};
      const topicConditioningStore: any =
        conceptMastery.topicConditioning && typeof conceptMastery.topicConditioning === "object"
          ? conceptMastery.topicConditioning
          : {};
      const topicsStore: Record<string, any> =
        topicConditioningStore.topics && typeof topicConditioningStore.topics === "object"
          ? topicConditioningStore.topics
          : {};

      const now = Date.now();
      const rows = Object.entries(topicsStore)
        .map(([topicKey, entry]) => {
          const topic = sanitizeTopic(topicKey) || sanitizeTopic(entry?.topic) || null;
          if (!topic) return null;

          const latestPhase = tryParsePhase(entry?.phase) || tryParsePhase(topicConditioningStore.entry_phase);
          if (!latestPhase) return null;
          const latestStability = normalizeStability(entry?.stability || topicConditioningStore.stability || "Low");

          const normalizedHistory = Array.isArray(entry?.history)
            ? entry.history
                .map((item: any) => ({
                  phase: tryParsePhase(item?.phase) || latestPhase,
                  stability: normalizeStability(item?.stability || latestStability),
                  date: String(item?.date || "").trim(),
                }))
                .filter((item: any) => !!item.date)
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
            : [];

          const latest = normalizedHistory[normalizedHistory.length - 1] || {
            phase: latestPhase,
            stability: latestStability,
            date: entry?.lastUpdated || topicConditioningStore.lastUpdatedAt || new Date().toISOString(),
          };
          const previous = normalizedHistory.length > 1 ? normalizedHistory[normalizedHistory.length - 2] : null;

          const latestPhaseIdx = PHASE_ORDER.indexOf(latest.phase);
          const previousPhaseIdx = previous ? PHASE_ORDER.indexOf(previous.phase) : -1;
          const latestStabilityScore = stabilityToScore(latest.stability);
          const previousStabilityScore = previous ? stabilityToScore(previous.stability) : 0;

          let movement: "none" | "improved" | "regressed" | "changed" = "none";
          if (previous) {
            if (latestPhaseIdx > previousPhaseIdx || (latestPhaseIdx === previousPhaseIdx && latestStabilityScore > previousStabilityScore)) {
              movement = "improved";
            } else if (latestPhaseIdx < previousPhaseIdx || (latestPhaseIdx === previousPhaseIdx && latestStabilityScore < previousStabilityScore)) {
              movement = "regressed";
            } else if (latest.phase !== previous.phase || latest.stability !== previous.stability) {
              movement = "changed";
            }
          }

          const daysSinceUpdate = Math.floor((now - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24));
          const bucket = daysSinceUpdate <= 14 ? "active" : daysSinceUpdate <= 45 ? "recent" : "older";

          // Translate internal states to parent-friendly language per Response Integrity Drift Correction Spec
          const translatedState = getParentDashboardCopyByState(latest.phase, latest.stability);

          return {
            topic,
            phase: latest.phase,
            stability: latest.stability,
            // Parent-facing translations (never expose "High Maintenance", etc.)
            parentStatus: translatedState.status,
            parentMeaning: translatedState.meaning,
            parentFocus: translatedState.focus,
            lastUpdated: latest.date,
            previousPhase: previous?.phase || null,
            previousStability: previous?.stability || null,
            movement,
            bucket,
          };
        })
        .filter((row): row is NonNullable<typeof row> => !!row)
        // The parent view must reflect the Specialist's complete current
        // topic map. Age is presentation metadata, not permission to hide a
        // topic that is still active in the student's conditioning record.
        .sort((a, b) => {
          if (a.bucket !== b.bucket) return a.bucket === "active" ? -1 : 1;
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        });

      const dedupedRows = Array.from(
        rows.reduce((map, row) => {
          const key = String(row.topic || "").trim().toLowerCase();
          const existing = map.get(key);

          if (!existing) {
            map.set(key, row);
            return map;
          }

          const existingDate = new Date(existing.lastUpdated || 0).getTime();
          const rowDate = new Date(row.lastUpdated || 0).getTime();

          if (rowDate >= existingDate) {
            map.set(key, row);
          }

          return map;
        }, new Map<string, any>())
        .values()
      ).sort((a, b) => {
        if (a.bucket !== b.bucket) return a.bucket === "active" ? -1 : 1;
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      });

      res.json(dedupedRows);
    } catch (error) {
      console.error("Error fetching parent topic conditioning states:", error);
      res.status(500).json({ message: "Failed to fetch topic conditioning states" });
    }
  });


  app.post("/api/parent/topic-focus-requests", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = String((req as any).dbUser.id || "");
      const topic = String(req.body?.topic || "").trim().replace(/\\s+/g, " ");
      const description = String(req.body?.description || "").trim();

      if (!topic || topic.length > 120) {
        return res.status(400).json({ message: "Enter a topic name of 1 to 120 characters." });
      }
      if (description.length > 600 || (description.length > 0 && description.length < 10)) {
        return res.status(400).json({ message: "If provided, additional context must be 10 to 600 characters." });
      }

      const { data: enrollment, error: enrollmentError } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, topic_response_symptoms, topic_response_symptom_ids, topic_response_signal_scores, topic_recommended_starting_phases, assigned_tutor_id, student_full_name",
        fallbackSelect: "id, topic_response_symptoms, topic_response_symptom_ids, topic_response_signal_scores, topic_recommended_starting_phases, assigned_tutor_id, student_full_name",
      });

      if (enrollmentError || !enrollment?.id) {
        return res.status(404).json({ message: "We could not find an active student enrollment for this account." });
      }

      const symptoms = enrollment.topic_response_symptoms && typeof enrollment.topic_response_symptoms === "object"
        ? { ...(enrollment.topic_response_symptoms as Record<string, unknown>) }
        : {};
      const symptomIdsByTopic = enrollment.topic_response_symptom_ids && typeof enrollment.topic_response_symptom_ids === "object"
        ? { ...(enrollment.topic_response_symptom_ids as Record<string, unknown>) }
        : {};
      const signalScoresByTopic = enrollment.topic_response_signal_scores && typeof enrollment.topic_response_signal_scores === "object"
        ? { ...(enrollment.topic_response_signal_scores as Record<string, unknown>) }
        : {};
      const recommendations = enrollment.topic_recommended_starting_phases && typeof enrollment.topic_recommended_starting_phases === "object"
        ? { ...(enrollment.topic_recommended_starting_phases as Record<string, unknown>) }
        : {};
      const existingTopic = [...new Set([...Object.keys(symptoms), ...Object.keys(recommendations)])]
        .find((value) => value.trim().toLowerCase() === topic.toLowerCase());
      if (existingTopic) {
        return res.status(409).json({ message: existingTopic + " is already recorded as a parent-reported topic." });
      }

      const submittedSymptomIds = normalizeResponseSymptoms(req.body?.symptomIds);
      const symptomRecommendation = recommendStartingPhaseFromSymptoms(submittedSymptomIds);
      const hasWeightedSymptomSignal = Object.values(symptomRecommendation.scores).some((score) => Number(score) > 0);
      const recommendedPhase: TopicPhase = hasWeightedSymptomSignal
        ? symptomRecommendation.phase
        : "Clarity";
      const supportingSymptoms = hasWeightedSymptomSignal
        ? symptomRecommendation.supportingSymptoms
        : [];
      const rationale = hasWeightedSymptomSignal
        ? buildStartingPhaseRationale(recommendedPhase, supportingSymptoms)
        : "No standardized symptoms were supplied. Clarity is used as a neutral starting baseline; the Specialist must validate the starting phase through diagnosis.";

      // Parent descriptions are free text, not standardized symptom IDs.
      // Keep them as contextual evidence while symptom IDs alone drive scoring.
      symptoms[topic] = getResponseSymptomLabels(submittedSymptomIds);
      symptomIdsByTopic[topic] = submittedSymptomIds;
      signalScoresByTopic[topic] = symptomRecommendation.scores;
      recommendations[topic] = {
        phase: recommendedPhase,
        supportingSymptoms,
        rationale: description ? `${rationale} Parent context: ${description}` : rationale,
        parentDescription: description,
      };

      if (isEmergencyDbMode() || process.env.VERCEL_ENV === "preview") {
        const updateResult = await pool.query(
          `UPDATE public.parent_enrollments
              SET topic_response_symptoms = $2::jsonb,
                  topic_response_symptom_ids = $3::jsonb,
                  topic_response_signal_scores = $4::jsonb,
                  topic_recommended_starting_phases = $5::jsonb,
                  updated_at = NOW()
            WHERE id = $1`,
          [
            String(enrollment.id),
            JSON.stringify(symptoms),
            JSON.stringify(symptomIdsByTopic),
            JSON.stringify(signalScoresByTopic),
            JSON.stringify(recommendations),
          ],
        );
        if (updateResult.rowCount !== 1) {
          return res.status(500).json({ message: "We could not save the topic request. Please try again." });
        }
      } else {
        const { data: updatedEnrollment, error: updateError } = await supabase
          .from("parent_enrollments")
          .update({
            topic_response_symptoms: symptoms,
            topic_response_symptom_ids: symptomIdsByTopic,
            topic_response_signal_scores: signalScoresByTopic,
            topic_recommended_starting_phases: recommendations,
            updated_at: new Date().toISOString(),
          })
          .eq("id", enrollment.id)
          .select("id")
          .maybeSingle();
        if (updateError || !updatedEnrollment?.id) {
          console.error("Parent topic focus request update failed:", updateError);
          return res.status(500).json({ message: "We could not save the topic request. Please try again." });
        }
      }

      return res.status(201).json({
        success: true,
        topic,
        message: "Your topic request has been sent to the Specialist for review.",
      });
    } catch (error) {
      console.error("Error saving parent topic focus request:", error);
      return res.status(500).json({ message: "Failed to submit the topic request." });
    }
  });

  app.put("/api/tutor/topic-conditioning/:studentId/topic-reference", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
    try {
      const tutorId = (req as any).dbUser.id;
      const { studentId } = req.params;
      const topic = String(req.body?.topic || "").trim();
      const topicReferenceContent = normalizeTopicReferenceContent(req.body?.topicReference);

      if (!studentId || !topic) {
        return res.status(400).json({ message: "Student and topic are required." });
      }
      if (!topicReferenceContent) {
        return res.status(400).json({
          message: "Complete Vocabulary, Recognition / Method, Ordered Steps, and Reason before saving.",
        });
      }

      const student = await storage.getStudent(studentId);
      if (!student || student.tutorId !== tutorId) {
        return res.status(403).json({ message: "Unauthorized: Student does not belong to this specialist." });
      }

      const conceptMastery: any =
        student.conceptMastery && typeof student.conceptMastery === "object"
          ? { ...(student.conceptMastery as any) }
          : {};
      const topicConditioningStore: any =
        conceptMastery.topicConditioning && typeof conceptMastery.topicConditioning === "object"
          ? { ...conceptMastery.topicConditioning }
          : {};
      const topicsStore: Record<string, any> =
        topicConditioningStore.topics && typeof topicConditioningStore.topics === "object"
          ? { ...topicConditioningStore.topics }
          : {};
      const topicKey = Object.keys(topicsStore).find(
        (candidate) => candidate.trim().toLowerCase() === topic.toLowerCase(),
      );

      if (!topicKey || !topicsStore[topicKey] || typeof topicsStore[topicKey] !== "object") {
        return res.status(404).json({ message: "This topic is not active for the student." });
      }

      const existingReference = parseStoredTopicReference(topicsStore[topicKey].topicReference);
      if (existingReference) {
        return res.json({ success: true, created: false, topicReference: existingReference });
      }

      const topicReference = {
        ...topicReferenceContent,
        schemaVersion: TOPIC_REFERENCE_SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        createdByTutorId: tutorId,
      };
      topicsStore[topicKey] = {
        ...topicsStore[topicKey],
        topicReference,
      };
      topicConditioningStore.topics = topicsStore;
      topicConditioningStore.lastUpdatedAt = new Date().toISOString();
      conceptMastery.topicConditioning = topicConditioningStore;

      const updatedStudent = await storage.updateStudent(studentId, { conceptMastery });
      if (!updatedStudent) {
        return res.status(500).json({ message: "Failed to save the Topic Reference." });
      }

      res.status(201).json({ success: true, created: true, topicReference });
    } catch (error) {
      console.error("Error saving tutor topic reference:", error);
      res.status(500).json({ message: "Failed to save the Topic Reference." });
    }
  });

  app.get("/api/tutor/topic-conditioning/:studentId", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
    try {
      const tutorId = (req as any).dbUser.id;
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json({ message: "Missing studentId" });
      }

      const student = await storage.getStudent(studentId);
      if (!student || student.tutorId !== tutorId) {
        return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
      }

      const sanitizeTopic = (value?: string | null) => {
        const cleaned = String(value || "").trim();
        if (!cleaned) return null;
        if (cleaned.toLowerCase() === "onboarding baseline diagnostic") return null;
        return cleaned;
      };

      const conceptMastery: any =
        student.conceptMastery && typeof student.conceptMastery === "object"
          ? student.conceptMastery
          : {};
      const topicConditioningStore: any =
        conceptMastery.topicConditioning && typeof conceptMastery.topicConditioning === "object"
          ? conceptMastery.topicConditioning
          : {};
      const topicsStore: Record<string, any> =
        topicConditioningStore.topics && typeof topicConditioningStore.topics === "object"
          ? topicConditioningStore.topics
          : {};

      const topics = (
        await Promise.all(
          Object.entries(topicsStore).map(async ([topicKey, entry]) => {
            const topic = sanitizeTopic(topicKey) || sanitizeTopic(entry?.topic) || null;
            if (!topic) return null;

            const latestPhase =
              tryParsePhase(entry?.phase) ||
              tryParsePhase(topicConditioningStore.entry_phase);
            if (!latestPhase) return null;
            const latestStability = normalizeStability(
              entry?.stability || topicConditioningStore.stability || "Low",
            );
            const progressionAuthority = [
              "building",
              "exit_confirmation_eligible",
              "transfer_maintenance",
            ].includes(String(entry?.progressionAuthority || ""))
              ? String(entry.progressionAuthority)
              : latestStability === "High Maintenance"
                ? "exit_confirmation_eligible"
                : null;

            const normalizedHistory = Array.isArray(entry?.history)
              ? entry.history
                  .map((item: any) => ({
                    phase: tryParsePhase(item?.phase) || latestPhase,
                    stability: normalizeStability(item?.stability || latestStability),
                    date: String(item?.date || "").trim(),
                  }))
                  .filter((item: any) => !!item.date)
                  .sort(
                    (a: any, b: any) =>
                      new Date(a.date).getTime() - new Date(b.date).getTime(),
                  )
              : [];

            const latest = normalizedHistory[normalizedHistory.length - 1] || {
              phase: latestPhase,
              stability: latestStability,
              date:
                entry?.lastUpdated ||
                topicConditioningStore.lastUpdatedAt ||
                new Date().toISOString(),
            };

            const aboveStructuredExecution =
              latest.phase === "Controlled Discomfort" ||
              latest.phase === "Time Pressure Stability";
            const timerContract = aboveStructuredExecution
              ? await loadLatestTpsTimerContract({ studentId, topic })
              : null;
            const timingBaselineIncomplete =
              aboveStructuredExecution && !timerContract;

            const persistedRequiresTargetedRediagnosis =
              entry?.requiresTargetedRediagnosis === true;
            const requiresTargetedRediagnosis =
              persistedRequiresTargetedRediagnosis || timingBaselineIncomplete;
            const targetedRediagnosisStartPhase =
              persistedRequiresTargetedRediagnosis
                ? tryParsePhase(entry?.targetedRediagnosisStartPhase)
                : timingBaselineIncomplete
                  ? "Structured Execution"
                  : null;
            const prerequisiteContradictionStatus =
              typeof entry?.prerequisiteContradictionStatus === "string"
                ? entry.prerequisiteContradictionStatus
                : null;
            const prerequisiteContradictionReason =
              typeof entry?.prerequisiteContradictionReason === "string"
                ? entry.prerequisiteContradictionReason
                : null;

            return {
              topic,
              phase: latest.phase,
              stability: latest.stability,
              progressionAuthority,
              history: normalizedHistory,
              lastUpdated: latest.date,
              topicReference: parseStoredTopicReference(entry?.topicReference),
              requiresTargetedRediagnosis,
              targetedRediagnosisStartPhase,
              prerequisiteContradictionStatus,
              prerequisiteContradictionReason,
              timingReadiness: {
                status: !aboveStructuredExecution
                  ? "not_required"
                  : timerContract
                    ? "ready"
                    : "targeted_rediagnosis",
                issueCode: timingBaselineIncomplete
                  ? TPS_TIMER_BASELINE_INCOMPLETE
                  : null,
                contractId: timerContract?.contractId || null,
                baselineSeconds: timerContract?.baselineSeconds || null,
                reason: timingBaselineIncomplete
                  ? "This above-Structured-Execution topic predates or lacks valid individualized timing authority. Ordinary Training is held until targeted evidence-native re-diagnosis establishes the missing baseline."
                  : null,
              },
            };
          }),
        )
      )
        .filter((row): row is NonNullable<typeof row> => !!row)
        .sort(
          (a, b) =>
            new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
        );

      res.json({ topics });
    } catch (error) {
      console.error("Error fetching tutor topic conditioning states:", error);
      res.status(500).json({ message: "Failed to fetch topic conditioning states" });
    }
  });

  // Get parent reports
  app.get("/api/parent/reports", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;

      if (isEmergencyDbMode()) {
        const reportResult = await pool.query(
          `SELECT pr.*, u.name AS tutor_name
             FROM public.parent_reports pr
             LEFT JOIN public.users u ON u.id = pr.tutor_id
            WHERE pr.parent_id = $1
            ORDER BY pr.sent_at DESC`,
          [parentId],
        );
        return res.json(reportResult.rows.map((report: any) => mapParentFacingReport(report, report.tutor_name)));
      }

      const { data: reports, error } = await supabase
        .from("parent_reports")
        .select("*")
        .eq("parent_id", parentId)
        .order("sent_at", { ascending: false });

      if (error) throw error;

      const tutorIds = Array.from(new Set((reports || []).map((report: any) => report.tutor_id).filter(Boolean)));
      let tutorNameMap: Record<string, string> = {};

      if (tutorIds.length > 0) {
        const { data: tutors, error: tutorError } = await supabase
          .from("users")
          .select("id, name")
          .in("id", tutorIds);

        if (tutorError) {
          console.error("Error fetching tutor names for parent reports:", tutorError);
        } else {
          tutorNameMap = (tutors || []).reduce((acc: Record<string, string>, tutor: any) => {
            acc[tutor.id] = tutor.name || "Tutor";
            return acc;
          }, {});
        }
      }

      const parentFacingReports = (reports || []).map((report: any) =>
        mapParentFacingReport(report, tutorNameMap[report.tutor_id])
      );

      res.json(parentFacingReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Submit parent feedback on report
  app.post("/api/parent/reports/:id/feedback", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { feedback } = req.body;

      const { data: existingReport, error: existingReportError } = await supabase
        .from("parent_reports")
        .select("id, parent_id, report_type")
        .eq("id", id)
        .single();

      if (existingReportError) throw existingReportError;
      if (!existingReport || existingReport.parent_id !== (req as any).dbUser.id) {
        return res.status(404).json({ message: "Report not found" });
      }
      if (existingReport.report_type !== "monthly") {
        return res.status(400).json({ message: "Feedback is only available for monthly reports" });
      }

      const { data: report, error } = await supabase
        .from("parent_reports")
        .update({
          parent_feedback: feedback,
          parent_feedback_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      res.json(report);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // Get parent broadcasts (filter for parents)
  app.get("/api/parent/broadcasts", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const userCreatedAt = (req as any).dbUser?.createdAt;
      let query = supabase
        .from("broadcasts")
        .select("*")
        .contains("target_roles", ["parent"])
        .order("created_at", { ascending: false });
      
      // Only show broadcasts created after user's account was created
      if (userCreatedAt) {
        query = query.gte("created_at", userCreatedAt);
      }
      
      const { data: broadcasts, error } = await query;

      if (error) throw error;
      res.json(broadcasts || []);
    } catch (error) {
      console.error("Error fetching broadcasts:", error);
      res.status(500).json({ message: "Failed to fetch broadcasts" });
    }
  });

  app.get("/api/parent/communications", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;

      if (isEmergencyDbMode()) {
        const enrollmentResult = await pool.query(
          `SELECT id, assigned_tutor_id, student_full_name, student_grade
             FROM public.parent_enrollments
            WHERE user_id = $1
            ORDER BY updated_at DESC
            LIMIT 1`,
          [parentId],
        );
        const enrollment = enrollmentResult.rows[0] || null;
        if (!enrollment) return res.status(404).json({ message: "No active enrollment found" });

        const studentResult = await pool.query(
          `SELECT id, name, grade, tutor_id
             FROM public.students
            WHERE parent_enrollment_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
          [enrollment.id],
        );
        const student = studentResult.rows[0] || null;
        if (!student || String(student.tutor_id || "") !== String(enrollment.assigned_tutor_id || "")) {
          return res.status(404).json({ message: "Student not found" });
        }

        const [tutorResult, parentResult, threadResult] = await Promise.all([
          pool.query("SELECT id, name FROM public.users WHERE id = $1 LIMIT 1", [student.tutor_id]),
          pool.query("SELECT id, name FROM public.users WHERE id = $1 LIMIT 1", [parentId]),
          pool.query(
            `SELECT id, student_id, tutor_id, parent_id, audience
               FROM public.student_communication_threads
              WHERE student_id = $1 AND parent_id = $2 AND audience = 'parent'
              LIMIT 1`,
            [student.id, parentId],
          ),
        ]);
        let thread = threadResult.rows[0] || null;
        if (!thread) {
          const insertedThread = await pool.query(
            `INSERT INTO public.student_communication_threads (student_id, tutor_id, parent_id, audience)
             VALUES ($1, $2, $3, 'parent')
             RETURNING id, student_id, tutor_id, parent_id, audience`,
            [student.id, student.tutor_id, parentId],
          );
          thread = insertedThread.rows[0] || null;
        }
        if (!thread) return res.status(500).json({ message: "Communication thread unavailable" });

        const messageResult = await pool.query(
          `SELECT id, thread_id, student_id, tutor_id, parent_id, audience, sender_role,
                  sender_user_id, sender_student_user_id, reply_to_message_id, message,
                  created_at, read_by_tutor_at, read_by_parent_at, read_by_student_at
             FROM public.student_communication_messages
            WHERE thread_id = $1 AND student_id = $2 AND parent_id = $3 AND audience = 'parent'
            ORDER BY created_at ASC`,
          [thread.id, student.id, parentId],
        );
        const messagesById = new Map<string, any>(messageResult.rows.map((row: any) => [String(row.id), row]));
        const tutorName = tutorResult.rows[0]?.name || "Tutor";
        const parentName = parentResult.rows[0]?.name || "Parent";
        const senderName = (row: any) => row.sender_role === "tutor"
          ? tutorName
          : row.sender_role === "parent"
            ? parentName
            : String(student.name || "Student").trim() || "Student";
        const messages = messageResult.rows.map((row: any) => {
          const replyTarget = row.reply_to_message_id ? messagesById.get(String(row.reply_to_message_id)) : null;
          return {
            id: row.id,
            threadId: row.thread_id,
            studentId: row.student_id,
            tutorId: row.tutor_id,
            parentId: row.parent_id,
            audience: row.audience,
            senderRole: row.sender_role,
            senderUserId: row.sender_user_id,
            senderStudentUserId: row.sender_student_user_id,
            senderName: senderName(row),
            replyToMessageId: row.reply_to_message_id || null,
            replyTo: replyTarget ? {
              id: replyTarget.id,
              senderName: senderName(replyTarget),
              message: replyTarget.message,
            } : null,
            message: row.message,
            createdAt: row.created_at,
            readByTutorAt: row.read_by_tutor_at,
            readByParentAt: row.read_by_parent_at,
            readByStudentAt: row.read_by_student_at,
          };
        });

        await pool.query(
          `UPDATE public.student_communication_messages
              SET read_by_parent_at = NOW()
            WHERE thread_id = $1 AND student_id = $2 AND parent_id = $3
              AND audience = 'parent' AND read_by_parent_at IS NULL`,
          [thread.id, student.id, parentId],
        );

        return res.json({
          student: { id: student.id, name: student.name, grade: student.grade || null },
          tutor: { id: student.tutor_id, name: tutorName },
          parent: { id: parentId, name: parentName, available: !!parentResult.rows[0] },
          thread: { threadId: thread.id, audience: "parent", messages },
        });
      }

      const { data: enrollment, error } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, user_id, assigned_tutor_id, assigned_student_id, student_full_name, student_grade, parent_email",
        fallbackSelect: "id, user_id, assigned_tutor_id, student_full_name, student_grade, parent_email",
      });

      if (error) throw error;
      if (!enrollment) {
        return res.status(404).json({ message: "No active enrollment found" });
      }

      const student = await resolveCanonicalStudentForEnrollment(enrollment);
      if (!student || !student.tutorId) {
        return res.status(404).json({ message: "Student not found" });
      }

      const bundle = await buildStudentCommunicationBundle({ student, parentId });
      await markCommunicationThreadRead({ studentId: student.id, audience: "parent", viewerRole: "parent" });
      res.json({
        student: bundle.student,
        tutor: bundle.tutor,
        parent: bundle.parent,
        thread: bundle.threads.parent,
      });
    } catch (error) {
      console.error("Error fetching parent communications:", error);
      res.status(500).json({ message: "Failed to fetch communications" });
    }
  });

  app.get("/api/parent/communications/unread-count", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;

      if (isEmergencyDbMode()) {
        const enrollmentResult = await pool.query(
          `SELECT id, assigned_tutor_id, student_full_name
             FROM public.parent_enrollments
            WHERE user_id = $1
            ORDER BY updated_at DESC
            LIMIT 1`,
          [parentId],
        );
        const enrollment = enrollmentResult.rows[0] || null;
        if (!enrollment?.assigned_tutor_id) return res.json({ unreadCount: 0 });

        const studentResult = await pool.query(
          `SELECT id, tutor_id
             FROM public.students
            WHERE parent_enrollment_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
           [enrollment.id],
        );
        const student = studentResult.rows[0] || null;
        if (!student || String(student.tutor_id) !== String(enrollment.assigned_tutor_id)) {
          return res.json({ unreadCount: 0 });
        }

        const unreadResult = await pool.query(
          `SELECT count(*)::int AS count
             FROM public.student_communication_messages
            WHERE student_id = $1
              AND parent_id = $2
              AND audience = 'parent'
              AND read_by_parent_at IS NULL
              AND sender_role <> 'parent'`,
          [student.id, parentId],
        );
        return res.json({ unreadCount: Number(unreadResult.rows[0]?.count || 0) });
      }

      const { data: enrollment, error } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, user_id, assigned_tutor_id, assigned_student_id, student_full_name, student_grade, parent_email",
        fallbackSelect: "id, user_id, assigned_tutor_id, student_full_name, student_grade, parent_email",
      });

      if (error) throw error;
      if (!enrollment) {
        return res.json({ unreadCount: 0 });
      }

      const student = await resolveCanonicalStudentForEnrollment(enrollment);
      if (!student || !student.tutorId) {
        return res.json({ unreadCount: 0 });
      }

      const thread = await ensureStudentCommunicationThread({
        studentId: student.id,
        tutorId: student.tutorId,
        parentId,
        audience: "parent",
      });

      const { data, error: unreadError } = await supabase
        .from("student_communication_messages")
        .select("id")
        .eq("thread_id", thread.id)
        .neq("sender_role", "parent")
        .is("read_by_parent_at", null);

      if (unreadError) throw unreadError;

      res.json({ unreadCount: (data || []).length });
    } catch (error) {
      console.error("Error fetching parent communication unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.post("/api/parent/communications", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;
      const parsed = insertStudentCommunicationMessageSchema.parse({ ...(req.body || {}), audience: "parent" });
      const { data: enrollment, error } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, user_id, assigned_tutor_id, assigned_student_id, student_full_name, student_grade, parent_email",
        fallbackSelect: "id, user_id, assigned_tutor_id, student_full_name, student_grade, parent_email",
      });

      if (error) throw error;
      if (!enrollment) {
        return res.status(404).json({ message: "No active enrollment found" });
      }

      const student = await resolveCanonicalStudentForEnrollment(enrollment);
      if (!student || !student.tutorId) {
        return res.status(404).json({ message: "Student not found" });
      }

      const inserted = await createStudentCommunicationMessage({
        student,
        parentId,
        audience: "parent",
        senderRole: "parent",
        senderUserId: parentId,
        replyToMessageId: parsed.replyToMessageId,
        message: parsed.message,
      });

      res.json({
        id: inserted.id,
        audience: inserted.audience,
        createdAt: inserted.created_at,
      });
    } catch (error) {
      console.error("Error sending parent communication:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to send message" });
    }
  });

  registerExecutiveCommandRhythmRoutes(app, isAuthenticated);

  const httpServer = createServer(app);
  return httpServer;
}
