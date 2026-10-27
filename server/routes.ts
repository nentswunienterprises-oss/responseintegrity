Warning: truncated output (original token count: 330317)
... 272692 bytes omitted ...

import { confidentialReference, ensurePrivateBucket, createConfidentialDownloadHandler } from "./confidentialStorage";
import { captureDemandParent } from "./demandCapture";
import { registerDemandProductionRoutes } from "./demandProduction";
import { demandAssignmentBlock, resolveEntryType } from "../shared/demandProduction";
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
    enrollment.topic_response_symptoms && typeof enrollment.topic_response_symptoms === "object"
      ? Object.entries(enrollment.topic_response_symptoms as Record<string, unknown>)
          .map(([topic, symptoms]) => [String(topic || "").trim(), normalizeResponseSymptoms(symptoms)] as const)
          .filter(([topic, symptoms]) => topic.length > 0 && symptoms.length > 0)
      : [];

  return responseSymptoms.length > 0 && topicResponseSymptoms.length > 0;
}

async function reactivateDetachedSandboxEnrollment(enrollment: any, tutorId: string) {
  const nowIso = new Date().toISOString();
  const activationPayload = {
    assigned_tutor_id: tutorId,
    status: "awaiting_tutor_acceptance",
    current_step: "awaiting_tutor_acceptance",
    proposal_id: null,
    updated_at: nowIso,
  };

  let { data, error } = await supabase
    .from("parent_enrollments")
    .update(activationPayload)
    .eq("id", enrollment.id)
    .select("*")
    .maybeSingle();

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const missingOptionalColumn = message.includes("current_step") || message.includes("proposal_id");

    if (missingOptionalColumn) {
      const fallback = await supabase
        .from("parent_enrollments")
        .update({
          assigned_tutor_id: tutorId,
          status: "awaiting_tutor_acceptance",
          updated_at: nowIso,
        })
        .eq("id", enrollment.id)
        .select("*")
        .maybeSingle();

      data = fallback.data;
      error = fallback.error;
    }
  }

  if (error || !data) {
    throw new Error(
      `Failed to reactivate detached sandbox enrollment ${String(enrollment?.id || "unknown")}: ${
        error?.message || "no enrollment returned"
      }`
    );
  }

  return data;
}

async function autoProvisionSandboxAccountsForTutor(
  tutorId: string,
  minimumCount = SANDBOX_REQUIRED_ACCOUNT_COUNT,
) {
  const certificationMode = await getTutorCertificationMode(tutorId);
  if (certificationMode !== "sandbox") {
    return { certificationMode, createdAccounts: [] as any[] };
  }

  let { data: existingSandboxEnrollments, error: existingSandboxError } = await supabase
    .from("parent_enrollments")
    .select("id")
    .eq("assigned_tutor_id", tutorId)
    .eq("is_sandbox_account", true)
    .in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES]);

  if (existingSandboxError && isMissingSandboxAccountColumnError(existingSandboxError)) {
    const fallback = await supabase
      .from("parent_enrollments")
      .select("id")
      .eq("assigned_tutor_id", tutorId)
      .in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES]);
    existingSandboxEnrollments = (fallback.data || []).filter((enrollment: any) =>
      isHeuristicSandboxEnrollment(enrollment, tutorId)
    );
    existingSandboxError = fallback.error;
  }

  if (existingSandboxError) {
    throw new Error(`Failed to load sandbox enrollments: ${existingSandboxError.message}`);
  }

  const existingSandboxCount = existingSandboxEnrollments?.length || 0;
  if (existingSandboxCount >= minimumCount) {
    return { certificationMode, createdAccounts: [] as any[] };
  }

  const createdAccounts: Array<{
    parentId: string;
    enrollmentId: string;
    parentEmail: string;
    studentName: string;
    sourceEnrollmentId: string | null;
    authProvisioned?: boolean;
    caseProfile?: string | null;
    topicCount?: number | null;
    provisionAction: "created" | "reused";
  }> = [];

  const ensureCanonicalSandboxEnrollmentSignals = async (
    enrollment: any,
    seedIndex: number,
    source?: any | null
  ) => {
    if (!isSandboxLikeEnrollment(enrollment, tutorId) || hasCanonicalSandboxResponseSignals(enrollment)) {
      return enrollment;
    }

    const sandboxCase = buildSandboxEnrollmentCase(seedIndex, source || enrollment);
    const canonicalSignalUpdate = {
      response_symptoms: sandboxCase.responseSymptoms,
      topic_response_symptoms: sandboxCase.topicResponseSymptoms,
      response_signal_scores: sandboxCase.responseSignalScores,
      topic_response_signal_scores: sandboxCase.topicResponseSignalScores,
      recommended_starting_phase: sandboxCase.recommendedStartingPhase,
      topic_recommended_starting_phases: sandboxCase.topicRecommendedStartingPhases,
      previous_tutoring: enrollment?.previous_tutoring || sandboxCase.previousTutoring,
      parent_motivation: enrollment?.parent_motivation || sandboxCase.parentMotivation,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedEnrollment, error: canonicalSignalError } = await supabase
      .from("parent_enrollments")
      .update(canonicalSignalUpdate)
      .eq("id", enrollment.id)
      .select("*")
      .single();

    if (canonicalSignalError) {
      console.error("Failed to provision canonical sandbox response signals:", canonicalSignalError);
      return {
        ...enrollment,
        ...canonicalSignalUpdate,
      };
    }

    return updatedEnrollment || { ...enrollment, ...canonicalSignalUpdate };
  };

  const missingSandboxCount = minimumCount - existingSandboxCount;
  const { data: detachedSandboxEnrollments, error: detachedSandboxError } =
    await loadDetachedSandboxEnrollmentsForTutor(tutorId);

  if (detachedSandboxError) {
    throw new Error(`Failed to load detached sandbox enrollments: ${detachedSandboxError.message}`);
  }

  const reusableSandboxEnrollments = (detachedSandboxEnrollments || []).slice(0, missingSandboxCount);
  for (let index = 0; index < reusableSandboxEnrollments.length; index++) {
    const detachedEnrollment = reusableSandboxEnrollments[index];
    const reactivatedEnrollment = await reactivateDetachedSandboxEnrollment(detachedEnrollment, tutorId);
    const canonicalEnrollment = await ensureCanonicalSandboxEnrollmentSignals(
      reactivatedEnrollment,
      existingSandboxCount + index,
      detachedEnrollment
    );
    await ensureStudentForEnrollment(canonicalEnrollment, tutorId);

    createdAccounts.push({
      parentId: String(canonicalEnrollment.user_id || "").trim(),
      enrollmentId: canonicalEnrollment.id,
      parentEmail: canonicalEnrollment.parent_email,
      studentName: canonicalEnrollment.student_full_name,
      sourceEnrollmentId: null,
      authProvisioned: false,
      caseProfile: null,
      topicCount: null,
      provisionAction: "reused",
    });
  }

  const newSandboxCountNeeded = missingSandboxCount - reusableSandboxEnrollments.length;
  if (newSandboxCountNeeded <= 0) {
    return { certificationMode, createdAccounts };
  }

  let sourceEnrollments: any[] | null = null;
  let sourceEnrollmentsError: any = null;
  {
    const initial = await supabase
      .from("parent_enrollments")
      .select("id, parent_full_name, parent_email, student_full_name, student_grade, student_gender, school_name, response_symptoms, topic_response_symptoms, response_signal_scores, topic_response_signal_scores, recommended_starting_phase, topic_recommended_starting_phases, previous_tutoring, internet_access, parent_motivation")
      .eq("assigned_tutor_id", tutorId)
      .eq("is_sandbox_account", false)
      .in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES])
      .order("updated_at", { ascending: false });

    sourceEnrollments = initial.data as any;
    sourceEnrollmentsError = initial.error as any;
  }

  if (
    sourceEnrollmentsError &&
    (
      isMissingSandboxAccountColumnError(sourceEnrollmentsError) ||
      String(sourceEnrollmentsError?.message || "").toLowerCase().includes("response_symptoms") ||
      String(sourceEnrollmentsError?.message || "").toLowerCase().includes("topic_response_symptoms") ||
      String(sourceEnrollmentsError?.message || "").toLowerCase().includes("response_signal_scores") ||
      String(sourceEnrollmentsError?.message || "").toLowerCase().includes("topic_response_signal_scores") ||
      String(sourceEnrollmentsError?.message || "").toLowerCase().includes("recommended_starting_phase") ||
      String(sourceEnrollmentsError?.message || "").toLowerCase().includes("topic_recommended_starting_phases")
    )
  ) {
    const fallback = await supabase
      .from("parent_enrollments")
      .select("id, parent_full_name, parent_email, student_full_name, student_grade, school_name, previous_tutoring, internet_access, parent_motivation")
      .eq("assigned_tutor_id", tutorId)
      .in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES])
      .order("updated_at", { ascending: false });
    sourceEnrollments = (fallback.data || []).filter(
      (enrollment: any) => !isHeuristicSandboxEnrollment(enrollment, tutorId)
    );
    sourceEnrollmentsError = fallback.error;
  }

  if (sourceEnrollmentsError) {
    throw new Error(`Failed to load sandbox seed enrollments: ${sourceEnrollmentsError.message}`);
  }

  for (let offset = 0; offset < newSandboxCountNeeded; offset++) {
    const ordinalOffset = reusableSandboxEnrollments.length + offset;
    const source = (sourceEnrollments || []).length
      ? sourceEnrollments![ordinalOffset % sourceEnrollments!.length]
      : null;
    const caseSeed = buildSandboxEnrollmentCase(existingSandboxCount + ordinalOffset, source);
    const sandboxOrdinal = existingSandboxCount + ordinalOffset + 1;
    const fakeParentEmail = buildCompactSandboxEmail("sandbox-parent", `${tutorId}-${existingSandboxCount + ordinalOffset}`);
    const fakeParentName = source?.parent_full_name
      ? `Sandbox ${String(source.parent_full_name).trim()} ${sandboxOrdinal}`
      : `Sandbox Parent ${sandboxOrdinal}`;
    const fakeStudentName = source?.student_full_name
      ? `Sandbox ${String(source.student_full_name).trim()} ${sandboxOrdinal}`
      : `Sandbox Student ${sandboxOrdinal}`;

    const { data: parentUser, error: parentError } = await supabase.auth.admin.createUser({
      email: fakeParentEmail,
      password: "SandboxPass123!",
      email_confirm: true,
      user_metadata: {
        name: fakeParentName,
        role: "parent",
        is_sandbox: true,
      },
    });

    let fakeParentId = String(parentUser?.user?.id || "").trim();
    let authProvisioned = !!fakeParentId;

    if (!fakeParentId) {
      fakeParentId = uuidv4();
      try {
        await storage.upsertUser({
          id: fakeParentId,
          email: fakeParentEmail,
          firstName: fakeParentName,
          lastName: "",
          role: "parent",
        });
      } catch (fallbackError) {
        throw new Error(
          `Failed to create sandbox parent user: ${parentError?.message || "missing user id"}; fallback failed: ${
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          }`
        );
      }
    } else {
      await storage.upsertUser({
        id: fakeParentId,
        email: fakeParentEmail,
        firstName: fakeParentName,
        lastName: "",
        role: "parent",
      });
    }

    if (isEmergencyDbMode() && !authProvisioned) {
      await provisionEmergencyCredentialForExistingUser(
        pool,
        fakeParentId,
        "SandboxPass123!",
      );
    }

    const sandboxEnrollmentBase = {
      user_id: fakeParentId,
      parent_full_name: fakeParentName,
      parent_phone: "Sandbox Parent",
      parent_email: fakeParentEmail,
      parent_city: "Sandbox City",
      student_full_name: fakeStudentName,
      student_grade: source?.student_grade || ["8", "9", "10", "11", "12"][offset % 5],
      student_gender: source?.student_gender || (sandboxOrdinal % 2 === 0 ? "female" : "male"),
      school_name: caseSeed.schoolName,
      response_symptoms: caseSeed.responseSymptoms,
      topic_response_symptoms: caseSeed.topicResponseSymptoms,
      response_signal_scores: caseSeed.responseSignalScores,
      topic_response_signal_scores: caseSeed.topicResponseSignalScores,
      recommended_starting_phase: caseSeed.recommendedStartingPhase,
      topic_recommended_starting_phases: caseSeed.topicRecommendedStartingPhases,
      previous_tutoring: caseSeed.previousTutoring,
      internet_access: source?.internet_access || "Yes",
      parent_motivation: caseSeed.parentMotivation,
      assigned_tutor_id: tutorId,
      status: "awaiting_tutor_acceptance",
      current_step: "awaiting_tutor_acceptance",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const sandboxEnrollmentPayloads = [
      { ...sandboxEnrollmentBase, is_sandbox_account: true },
      { ...sandboxEnrollmentBase },
      (() => {
        const { student_gender, ...payload } = { ...sandboxEnrollmentBase, is_sandbox_account: true } as any;
        return payload;
      })(),
      (() => {
        const { student_gender, ...payload } = sandboxEnrollmentBase as any;
        return payload;
      })(),
    ];

    let sandboxEnrollment: any = null;
    let sandboxEnrollmentError: any = null;
    for (const payload of sandboxEnrollmentPayloads) {
      const attempt = await supabase
        .from("parent_enrollments")
        .insert(payload)
        .select("*")
        .single();

      if (!attempt.error && attempt.data) {
        sandboxEnrollment = attempt.data;
        sandboxEnrollmentError = null;
        break;
      }

      sandboxEnrollmentError = attempt.error;
      const message = String(attempt.error?.message || "").toLowerCase();
      const expectedCompatibilityError =
        message.includes("is_sandbox_account") ||
        message.includes("current_step") ||
        message.includes("student_gender") ||
        message.includes("response_symptoms") ||
        message.includes("topic_response_symptoms") ||
        message.includes("response_signal_scores") ||
        message.includes("topic_response_signal_scores") ||
        message.includes("recommended_starting_phase") ||
        message.includes("topic_recommended_starting_phases");

      if (!expectedCompatibilityError) {
        break;
      }
    }

    if (sandboxEnrollmentError || !sandboxEnrollment) {
      throw new Error(`Failed to create sandbox enrollment: ${sandboxEnrollmentError?.message || "no enrollment returned"}`);
    }

    sandboxEnrollment = await ensureCanonicalSandboxEnrollmentSignals(
      sandboxEnrollment,
      existingSandboxCount + ordinalOffset,
      source
    );

    await ensureStudentForEnrollment(sandboxEnrollment, tutorId);

    createdAccounts.push({
      parentId: fakeParentId,
      enrollmentId: sandboxEnrollment.id,
      parentEmail: fakeParentEmail,
      studentName: sandboxEnrollment.student_full_name,
      sourceEnrollmentId: source?.id ? String(source.id) : null,
      authProvisioned,
      caseProfile: caseSeed.caseId,
      topicCount: caseSeed.topicCount,
      provisionAction: "created",
    });
  }

  return { certificationMode, createdAccounts };
}

async function ensureVisibleSandboxStudentsForTutor(
  tutorId: string,
  minimumCount = SANDBOX_REQUIRED_ACCOUNT_COUNT,
) {
  const certificationMode = await getTutorCertificationMode(tutorId);
  if (certificationMode !== "sandbox") {
    return { certificationMode, createdAccounts: [] as any[], studentCount: 0 };
  }

  const provisionResult = await autoProvisionSandboxAccountsForTutor(tutorId, minimumCount);
  const { data: sandboxEnrollments, error: sandboxEnrollmentsError } = await loadTutorAssignedEnrollments(tutorId, {
    sandboxOnly: true,
    ordered: true,
  });

  if (sandboxEnrollmentsError) {
    throw new Error(`Failed to load sandbox enrollments for student backfill: ${sandboxEnrollmentsError.message}`);
  }

  for (const enrollment of sandboxEnrollments || []) {
    try {
      await ensureStudentForEnrollment(enrollment, tutorId);
    } catch (error) {
      console.error("Failed to backfill sandbox student for enrollment:", enrollment?.id, error);
    }
  }

  const students = await storage.getStudentsByTutor(tutorId);
  const sandboxStudentCount = students.filter(
    (student: any) => sandboxEnrollments?.some((enrollment: any) => String(enrollment.id) === String(student.parentEnrollmentId))
  ).length;

  return {
    certificationMode,
    createdAccounts: provisionResult.createdAccounts,
    studentCount: sandboxStudentCount,
  };
}


async function safeSendPush(
  userId: string | null | undefined,
  payload: {
    title: string;
    body: string;
    url: string;
    tag: string;
  },
  context: string,
) {
  if (!userId) return;

  try {
    await sendWebPushToUser(userId, payload);
  } catch (error) {
    console.error(`[push] Failed during ${context}:`, error);
  }
}

function getEffectiveScheduledSessionStatus(session: any): string {
  const rawStatus = String(session?.status || "").toLowerCase();
  const parentConfirmed = !!session?.parent_confirmed;
  const tutorConfirmed = !!session?.tutor_confirmed;

  if (["completed", "live", "ready"].includes(rawStatus)) {
    return rawStatus;
  }

  if (parentConfirmed && tutorConfirmed) {
    return "confirmed";
  }

  if (parentConfirmed && !tutorConfirmed) {
    return "pending_tutor_confirmation";
  }

  if (!parentConfirmed && tutorConfirmed) {
    return "pending_parent_confirmation";
  }

  if (rawStatus === "pending_parent_confirmation" || rawStatus === "pending_tutor_confirmation") {
    return rawStatus;
  }

  return "not_scheduled";
}

const REASSIGNMENT_RESUME_PREFIX = "reassignment_resume:";
const HANDOVER_STEP_PREFIX = "handover_";

function buildReassignmentResumeStep(status: string | null | undefined): string {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return `${REASSIGNMENT_RESUME_PREFIX}assigned`;
  return `${REASSIGNMENT_RESUME_PREFIX}${normalized}`;
}

function extractReassignmentResumeStatus(currentStep: string | null | undefined): string | null {
  const value = String(currentStep || "").trim().toLowerCase();
  if (!value.startsWith(REASSIGNMENT_RESUME_PREFIX)) return null;
  const restored = value.slice(REASSIGNMENT_RESUME_PREFIX.length).trim();
  return restored || null;
}

async function promoteAcceptedEnrollmentIfNeeded(student: any, tutorId: string) {
  const workflow = ((student?.personalProfile as any) || {}).workflow || {};
  if (!workflow.assignmentAcceptedAt) {
    return null;
  }

  const enrollmentId = String(
    (student as any)?.parentEnrollmentId || (student as any)?.parent_enrollment_id || ""
  ).trim();
  if (!enrollmentId) {
    return null;
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("parent_enrollments")
    .select("id, assigned_tutor_id, status, current_step")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    return null;
  }

  if (String(enrollment.assigned_tutor_id || "").trim() !== String(tutorId || "").trim()) {
    return enrollment;
  }

  const normalizedStatus = String(enrollment.status || "").trim().toLowerCase();
  const normalizedStep = String(enrollment.current_step || "").trim().toLowerCase();
  if (normalizedStatus !== "awaiting_tutor_acceptance" && normalizedStep !== "awaiting_tutor_acceptance") {
    return enrollment;
  }

  const resumedStatus = extractReassignmentResumeStatus(enrollment.current_step) || null;
  const nextEnrollmentStatus = resumedStatus || "assigned";
  const nextCurrentStep =
    resumedStatus && resumedStatus !== "assigned"
      ? "handover_not_scheduled"
      : nextEnrollmentStatus;

  const { data: updatedEnrollment, error: updateError } = await supabase
    .from("parent_enrollments")
    .update({
      assigned_tutor_id: tutorId,
      status: nextEnrollmentStatus,
      current_step: nextCurrentStep,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)
    .select("*")
    .maybeSingle();

  if (updateError) {
    console.error("Failed to promote accepted enrollment:", enrollmentId, updateError);
    return enrollment;
  }

  return updatedEnrollment || enrollment;
}

function isHandoverStep(currentStep: string | null | undefined): boolean {
  return String(currentStep || "").trim().toLowerCase().startsWith(HANDOVER_STEP_PREFIX);
}

function getEnrollmentSessionType(enrollment: any): "intro" | "handover" {
  return isHandoverStep(enrollment?.current_step) ? "handover" : "intro";
}

function getSessionDisplayLabel(sessionType: string | null | undefined): string {
  return String(sessionType || "").trim().toLowerCase() === "handover"
    ? "continuity check"
    : "intro session";
}

function isSandboxEnrollmentForTutor(enrollment: any, tutorId?: string) {
  return (
    Boolean(enrollment?.is_sandbox_account) ||
    isHeuristicSandboxEnrollment(enrollment, tutorId) ||
    String(enrollment?.current_step || "").trim().toLowerCase().startsWith("sandbox-")
  );
}

async function loadTutorAssignmentLoadStats(tutorId: string) {
  let data: any[] | null = null;
  let error: any = null;
  {
    const initial = await supabase
      .from("parent_enrollments")
      .select("id, status, current_step, is_sandbox_account, assignment_lane, parent_full_name, parent_email, student_full_name")
      .eq("assigned_tutor_id", tutorId)
      .in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES, "awaiting_tutor_acceptance"]);

    data = initial.data as any;
    error = initial.error as any;
  }

  if (error && isMissingSandboxAccountColumnError(error)) {
    const fallback = await supabase
      .from("parent_enrollments")
      .select("id, status, current_step, parent_full_name, parent_email, student_full_name")
      .eq("assigned_tutor_id", tutorId)
      .in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES, "awaiting_tutor_acceptance"]);
    data = fallback.data || [];
    error = fallback.error;
  }

  if (error) {
    throw new Error(`Failed to load tutor assignment stats: ${error.message}`);
  }

  const enrollments = data || [];
  const sandboxEnrollments = enrollments.filter((enrollment: any) =>
    isSandboxEnrollmentForTutor(enrollment, tutorId)
  );
  const trialEnrollments = enrollments.filter(
    (enrollment: any) => String(enrollment.assignment_lane || "").trim().toLowerCase() === "trial"
  );
  const liveEnrollments = enrollments.filter(
    (enrollment: any) =>
      !isSandboxEnrollmentForTutor(enrollment, tutorId) &&
      String(enrollment.assignment_lane || "commercial").trim().toLowerCase() !== "trial"
  );

  return {
    activeAssignmentCount: enrollments.length,
    sandboxParentCount: sandboxEnrollments.length,
    trialParentCount: trialEnrollments.length,
    liveParentCount: liveEnrollments.length,
    awaitingTutorAcceptanceCount: enrollments.filter(
      (enrollment: any) => String(enrollment.status || "").trim().toLowerCase() === "awaiting_tutor_acceptance"
    ).length,
  };
}

function derivePodOperatingState(modeCounts: Record<string, number>, totalTutors: number) {
  const applicant = modeCounts.applicant || 0;
  const training = modeCounts.training || 0;
  const sandbox = modeCounts.sandbox || 0;
  const trial = modeCounts.trial || 0;
  const certifiedLive = modeCounts.certified_live || 0;
  const watchlist = modeCounts.watchlist || 0;
  const suspended = modeCounts.suspended || 0;
  const trainingSideCount = applicant + training + watchlist + suspended;
  const activeStateBuckets = [
    certifiedLive > 0 ? "certified_live" : null,
    trial > 0 ? "trial_validation" : null,
    sandbox > 0 ? "sandbox" : null,
    trainingSideCount > 0 ? "training_side" : null,
  ].filter(Boolean);

  if (totalTutors === 0) {
    return {
      key: "empty",
      label: "No Tutors Assigned",
      description: "This pod has capacity but no tutor system running inside it yet.",
    };
  }

  if (certifiedLive === totalTutors) {
    return {
      key: "certified_live",
      label: "Certified Live Pod",
      description: "Every tutor in this pod is certified for live parent responsibility.",
    };
  }

  if (trial === totalTutors) {
    return {
      key: "trial_validation",
      label: "Trial Validation Pod",
      description: "Every tutor in this pod is carrying exactly bounded live Trial responsibility before certification.",
    };
  }

  if (sandbox === totalTutors) {
    return {
      key: "sandbox_training",
      label: "Sandbox Training Pod",
      description: "Every tutor in this pod is in sandbox conditioning before live operations.",
    };
  }

  if (trainingSideCount === totalTutors) {
    return {
      key: "training_plant",
      label: "Training Plant Pod",
      description: "Every tutor in this pod is still in the conditioning pipeline before sandbox or live responsibility opens.",
    };
  }

  return {
    key: "misaligned",
    label: "Misaligned Pod",
    description: activeStateBuckets.length > 1
      ? "This pod mixes tutor operating states and should be reorganized into state-pure pods."
      : "This pod is not aligned to a single operating state.",
  };
}

async function buildPodOperatingOverview(pod: any) {
  const assignments = await storage.getTutorAssignmentsByPod(pod.id);
  const tutorMeta = await Promise.all(
    assignments.map(async (assignment: any) => {
      const tutor = await storage.getUser(assignment.tutorId);
      const students = await storage.getStudentsByTutor(assignment.tutorId);
      return {
        assignmentId: assignment.id,
        tutorId: assignment.tutorId,
        tutorName: tutor?.name || tutor?.firstName || "Unknown Tutor",
        tutorEmail: tutor?.email || "",
        studentCount: students.length,
      };
    })
  );

  const tdUser = pod.tdId ? await storage.getUser(pod.tdId) : null;
  const summary = await buildPodBattleTestingSummary(
    pod.id,
    tutorMeta,
    tdUser
      ? {
          tdId: tdUser.id,
          tdName: tdUser.name || tdUser.firstName || "Assigned TD",
        }
      : null
  );

  const modeCounts = summary.tutorSummaries.reduce<Record<string, number>>((acc, tutorSummary) => {
    const key = String(tutorSummary.mode || "training");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const tutorLoadStats = await Promise.all(
    assignments.map(async (assignment: any) => loadTutorAssignmentLoadStats(assignment.tutorId))
  );

  const operatingState = derivePodOperatingState(modeCounts, assignments.length);

  return {
    podId: pod.id,
    totalTutors: assignments.length,
    tutorModeCounts: {
      applicant: modeCounts.applicant || 0,
      training: modeCounts.training || 0,
      sandbox: modeCounts.sandbox || 0,
      trial: modeCounts.trial || 0,
      certified_live: modeCounts.certified_live || 0,
      watchlist: modeCounts.watchlist || 0,
      suspended: modeCounts.suspended || 0,
    },
    assignmentCounts: tutorLoadStats.reduce(
      (acc, stats) => {
        acc.liveParents += stats.liveParentCount;
        acc.trialParents += stats.trialParentCount;
        acc.sandboxParents += stats.sandboxParentCount;
        acc.awaitingTutorAcceptance += stats.awaitingTutorAcceptanceCount;
        return acc;
      },
      { liveParents: 0, trialParents: 0, sandboxParents: 0, awaitingTutorAcceptance: 0 }
    ),
    operatingState,
  };
}

function usesDirectProofSessionDatabase() {
  return isEmergencyDbMode() || process.env.VERCEL_ENV === "preview";
}

const SCHEDULED_SESSION_SELECT = [
  "id",
  "scheduled_time",
  "scheduled_end",
  "timezone",
  "status",
  "type",
  "workflow_stage",
  "parent_confirmed",
  "tutor_confirmed",
  "parent_id",
  "tutor_id",
  "student_id",
  "google_calendar_id",
  "google_event_id",
  "google_meet_url",
  "google_conference_id",
  "google_meet_space_name",
  "google_meet_code",
  "host_account_id",
  "attendance_status",
  "recording_status",
  "recording_file_id",
  "recording_detected_at",
  "transcript_status",
  "transcript_file_id",
  "transcript_detected_at",
  "attendance_report_file_id",
  "cohost_sync_status",
  "cohost_sync_error",
  "last_artifact_sync_at",
  "last_meet_sync_error",
  "created_at",
  "updated_at",
].join(", ");

const INTRO_SESSION_DURATION_MINUTES = 60;
const TRAINING_SESSION_DURATION_MINUTES = 90;
const TRAINING_SESSION_IMMINENT_WINDOW_MS = 2 * 60 * 60 * 1000;
const RELAX_TRAINING_SESSION_LAUNCH_WINDOW =
  String(process.env.RELAX_TRAINING_SESSION_LAUNCH_WINDOW || "true").toLowerCase() === "true";

function addMinutesToIso(iso: string, minutes: number) {
  const date = new Date(iso);
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

function getSessionTimezone(session: any, fallback = "Africa/Johannesburg") {
  return String(session?.timezone || fallback).trim() || fallback;
}

function getScheduledSessionEndIso(session: any) {
  if (session?.scheduled_end) {
    return new Date(session.scheduled_end).toISOString();
  }
  const minutes = session?.type === "training" ? TRAINING_SESSION_DURATION_MINUTES : INTRO_SESSION_DURATION_MINUTES;
  return addMinutesToIso(session.scheduled_time, minutes);
}

function shouldReconcileSessionArtifacts(session: any) {
  const status = String(session?.status || "");
  if (!["completed", "live", "ready", "confirmed"].includes(status)) {
    return false;
  }
  const endMs = new Date(getScheduledSessionEndIso(session)).getTime();
  const hasPendingArtifacts =
    (String(session?.recording_status || "").toLowerCase() === "expected" && !session?.recording_file_id) ||
    (String(session?.transcript_status || "").toLowerCase() === "expected" && !session?.transcript_file_id);
  return endMs <= Date.now() && hasPendingArtifacts;
}

function getSessionLaunchState(session: any, kind: "intro" | "handover" | "training") {
  const startMs = new Date(session?.scheduled_time || 0).getTime();
  const endMs = new Date(getScheduledSessionEndIso(session)).getTime();
  const nowMs = Date.now();
  const isLive = nowMs >= startMs - 15 * 60 * 1000 && nowMs <= endMs + 3 * 60 * 60 * 1000;
  const isImminent = nowMs < startMs && startMs - nowMs <= TRAINING_SESSION_IMMINENT_WINDOW_MS;
  const blockedStatuses = new Set(["cancelled", "completed", "flagged"]);
  const allowedStatuses = new Set(["confirmed", "scheduled", "ready", "live"]);
  const hasOperationalStatus = allowedStatuses.has(String(session?.status || ""));

  if (kind === "intro" || kind === "handover") {
    return {
      canLaunch: hasOperationalStatus,
      isLive,
      isImminent,
    };
  }

  return {
    canLaunch: hasOperationalStatus &&
      !blockedStatuses.has(String(session?.status || "")) &&
      (RELAX_TRAINING_SESSION_LAUNCH_WINDOW || isLive || isImminent),
    isLive,
    isImminent,
  };
}

function formatAmountForPayfast(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return amount.toFixed(2);
}

async function getLatestPaymentForEnrollment(enrollmentId: string) {
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .eq("provider", PAYMENT_PROVIDER_PAYFAST)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

async function getLatestPaidPaymentForEnrollment(enrollmentId: string) {
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .eq("provider", PAYMENT_PROVIDER_PAYFAST)
    .eq("payment_status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

async function getLatestPaidPaymentForParent(parentId: string, studentId?: string | null) {
  if (isEmergencyDbMode()) {
    try {
      const result = await pool.query(
        `SELECT *
           FROM public.payment_transactions
          WHERE parent_id::text = $1::text
            AND provider = $3
            AND payment_status = 'paid'
            AND ($2::text IS NULL OR student_id::text = $2::text)
          ORDER BY paid_at DESC
          LIMIT 1`,
        [parentId, studentId || null, PAYMENT_PROVIDER_PAYFAST],
      );

      if (result.rows[0] || !studentId) {
        return { data: result.rows[0] || null, error: null };
      }

      const fallbackResult = await pool.query(
        `SELECT *
           FROM public.payment_transactions
          WHERE parent_id::text = $1::text
            AND provider = $2
            AND payment_status = 'paid'
          ORDER BY paid_at DESC
          LIMIT 1`,
        [parentId, PAYMENT_PROVIDER_PAYFAST],
      );

      return { data: fallbackResult.rows[0] || null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  let query = supabase
    .from("payment_transactions")
    .select("*")
    .eq("parent_id", parentId)
    .eq("provider", PAYMENT_PROVIDER_PAYFAST)
    .eq("payment_status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1);

  if (studentId) {
    query = query.eq("student_id", studentId);
  }

  const result = await query.maybeSingle();
  if (result.data || !studentId) {
    return result;
  }

  const fallbackResult = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("parent_id", parentId)
    .eq("provider", PAYMENT_PROVIDER_PAYFAST)
    .eq("payment_status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return fallbackResult;
}

const RESCHEDULE_LIMIT_PER_SESSION_PER_MONTH = 3;
const CANCELLATION_CUTOFF_HOURS = 12;

async function resolveEnrollmentServicePackage(options: {
  enrollmentId?: string | null;
  parentId?: string | null;
  fallbackPackageKey?: unknown;
}) {
  if (options.enrollmentId) {
    const { data } = await supabase
      .from("parent_enrollments")
      .select("package_key, package_sessions, planned_sessions_per_week")
      .eq("id", options.enrollmentId)
      .maybeSingle();
    if (data?.package_key) return getMonthlyServicePackage(data.package_key);
  }

  if (options.parentId) {
    const { data } = await supabase
      .from("parent_enrollments")
      .select("package_key, package_sessions, planned_sessions_per_week, updated_at")
      .eq("user_id", options.parentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.package_key) return getMonthlyServicePackage(data.package_key);
  }

  return getMonthlyServicePackage(options.fallbackPackageKey);
}

function getMonthStartIso(input: string | Date) {
  const date = input instanceof Date ? new Date(input) : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month, 1)).toISOString();
}

function toMonthKey(monthStartIso: string) {
  return monthStartIso.slice(0, 10);
}

function toIsoDateTime(value: unknown) {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

async function upsertMembershipMonth(options: {
  parentId: string;
  studentId: string;
  enrollmentId?: string | null;
  monthStartIso: string;
  isSandbox?: boolean;
  packageKey?: MonthlyPackageKey | null;
}) {
  const monthKey = toMonthKey(options.monthStartIso);
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from("membership_months")
    .select("*")
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .eq("month_key", monthKey)
    .eq("is_sandbox", !!options.isSandbox)
    .maybeSingle();

  if (existing) return existing;

  const servicePackage = await resolveEnrollmentServicePackage({
    enrollmentId: options.enrollmentId,
    parentId: options.parentId,
    fallbackPackageKey: options.packageKey,
  });

  const { data: inserted, error } = await supabase
    .from("membership_months")
    .insert({
      parent_id: options.parentId,
      student_id: options.studentId,
      enrollment_id: options.enrollmentId || null,
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
      sessions_used: 0,
      sessions_remaining: servicePackage.sessionsPerMonth,
      status: "active",
      is_sandbox: !!options.isSandbox,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Failed to upsert membership month:", error);
    return null;
  }

  return inserted;
}

async function recalculateMembershipMonthUsage(options: {
  parentId: string;
  studentId: string;
  monthStartIso: string;
  isSandbox?: boolean;
}) {
  const monthStart = options.monthStartIso.slice(0, 10);
  const nowIso = new Date().toISOString();
  const evidenceUpperBoundIso = options.isSandbox
    ? "9999-12-31T23:59:59.999Z"
    : nowIso;
  let usageWindowStart = `${monthStart}T00:00:00.000Z`;

  try {
    let renewalPaymentQuery = supabase
      .from("payment_transactions")
      .select("paid_at")
      .eq("parent_id", options.parentId)
      .eq("provider", PAYMENT_PROVIDER_PAYFAST)
      .eq("payment_status", "paid")
      .contains("raw_payload", { renewal: true })
      .order("paid_at", { ascending: false })
      .limit(1);

    if (options.studentId) {
      renewalPaymentQuery = renewalPaymentQuery.eq("student_id", options.studentId);
    }

    let { data: renewalPayments } = await renewalPaymentQuery;
    if ((!renewalPayments || renewalPayments.length === 0) && options.studentId) {
      const fallbackRenewalPayments = await supabase
        .from("payment_transactions")
        .select("paid_at")
        .eq("parent_id", options.parentId)
        .eq("provider", PAYMENT_PROVIDER_PAYFAST)
        .eq("payment_status", "paid")
        .contains("raw_payload", { renewal: true })
        .order("paid_at", { ascending: false })
        .limit(1);
      renewalPayments = fallbackRenewalPayments.data;
    }
    const latestRenewalPaidAt = String(renewalPayments?.[0]?.paid_at || "").trim();
    if (latestRenewalPaidAt && latestRenewalPaidAt >= usageWindowStart) {
      usageWindowStart = latestRenewalPaidAt;
    }

    const { data: metadataRestoreEvents } = await supabase
      .from("session_billing_events")
      .select("effective_at")
      .eq("parent_id", options.parentId)
      .eq("student_id", options.studentId)
      .eq("event_type", "renewal_payment")
      .eq("billing_impact", "restore")
      .eq("is_sandbox", !!options.isSandbox)
      .order("effective_at", { ascending: false })
      .limit(1);

    if (Array.isArray(metadataRestoreEvents) && metadataRestoreEvents.length > 0) {
      const effectiveAt = String(metadataRestoreEvents[0]?.effective_at || "").trim();
      if (effectiveAt && effectiveAt >= usageWindowStart) {
        usageWindowStart = effectiveAt;
      }
    }
  } catch (err) {
    console.error("Failed to determine renewal window start:", err);
  }

  const { data: completedSessions } = await supabase
    .from("scheduled_sessions")
    .select("id, tutor_id")
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .eq("type", "training")
    .eq("status", "completed")
    .gte("scheduled_time", usageWindowStart)
    .lt("scheduled_time", evidenceUpperBoundIso);

  const completedSessionKeys = new Set<string>();
  const completedScheduledSessions = new Map<string, string>();
  const recordCompletedScheduledSession = (row: any) => {
    const sessionId = String(row?.id || "").trim();
    if (!sessionId) return;
    completedSessionKeys.add(`training:${sessionId}`);
    completedScheduledSessions.set(sessionId, String(row?.tutor_id || "").trim());
  };
  // Filter sessions by sandbox flag (resolve enrollment per session)
  for (const row of (completedSessions || [])) {
    try {
      const sessionEnrollmentId = await resolveEnrollmentIdForSession({ parent_id: options.parentId, student_id: options.studentId, id: row.id });
      if (!sessionEnrollmentId) {
        // No enrollment, count as production
        recordCompletedScheduledSession(row);
        continue;
      }
      const { data: linkedEnrollment } = await supabase
        .from("parent_enrollments")
        .select("id, is_sandbox_account, parent_email, current_step")
        .eq("id", sessionEnrollmentId)
        .maybeSingle();

      const isSandbox = isSandboxPaymentEnrollment(linkedEnrollment);
      if (!!options.isSandbox) {
        if (isSandbox) recordCompletedScheduledSession(row);
      } else {
        if (!isSandbox) recordCompletedScheduledSession(row);
      }
    } catch (err) {
      // On error, be conservative and count the session
      recordCompletedScheduledSession(row);
    }
  }

  const { data: trainingRuns } = await supabase
    .from("training_session_runs")
    .select("id, scheduled_session_id")
    .eq("student_id", options.studentId)
    .in("status", ["submitted", "completed"])
    .gte("submitted_at", usageWindowStart)
    .lt("submitted_at", evidenceUpperBoundIso);

  for (const row of (trainingRuns || [])) {
    const scheduledId = String(row?.scheduled_session_id || "").trim();
    if (scheduledId) {
      completedSessionKeys.add(`training:${scheduledId}`);
    } else if (row?.id) {
      completedSessionKeys.add(`training-run:${row.id}`);
    }
  }

  const { data: drills } = await supabase
    .from("intro_session_drills")
    .select("id, scheduled_session_id, training_session_run_id, drill")
    .eq("student_id", options.studentId)
    .gte("submitted_at", usageWindowStart)
    .lt("submitted_at", evidenceUpperBoundIso);

  const evidenceEligibleSessionIds = new Set<string>();
  for (const row of (drills || [])) {
    if (!isTrainingDrillRecord(row)) continue;
    const scheduledId = String(row?.scheduled_session_id || "").trim();
    const runId = String(row?.training_session_run_id || "").trim();
    const drillId = String(row?.id || "").trim();

    if (scheduledId) {
      completedSessionKeys.add(`training:${scheduledId}`);
      if (completedScheduledSessions.has(scheduledId)) {
        evidenceEligibleSessionIds.add(scheduledId);
      }
    } else if (runId) {
      completedSessionKeys.add(`training:${runId}`);
    } else if (drillId) {
      completedSessionKeys.add(`training-drill:${drillId}`);
    }
  }

  const completedUsed = completedSessionKeys.size;

  const { data: eventRows } = await supabase
    .from("session_billing_events")
    .select("session_id, credits_delta, billing_impact")
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .gte("effective_at", usageWindowStart)
    .lt("effective_at", evidenceUpperBoundIso)
    .eq("billing_impact", "consume")
    .eq("is_sandbox", !!options.isSandbox);

  const eventUsed = (eventRows || []).reduce((sum: number, row: any) => {
    const sessionId = String(row?.session_id || "").trim();
    if (sessionId && completedSessionKeys.has(`training:${sessionId}`)) {
      return sum;
    }
    const delta = Number(row?.credits_delta || 0);
    return sum + Math.max(0, delta);
  }, 0);

  const { data: membershipMonth } = await supabase
    .from("membership_months")
    .select("*")
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .eq("month_key", toMonthKey(options.monthStartIso))
    .eq("is_sandbox", !!options.isSandbox)
    .maybeSingle();

  const servicePackage = getMonthlyServicePackage(membershipMonth?.package_key);
  const sessionQuota = Number(membershipMonth?.session_quota || servicePackage.sessionsPerMonth);
  const used = Math.max(0, Math.min(sessionQuota, completedUsed + eventUsed));
  const remaining = Math.max(0, sessionQuota - used);
  const payoutState = buildPackagePayoutState({
    packageKey: servicePackage.key,
    eligibleSessionCount: evidenceEligibleSessionIds.size,
    consumedSessionCount: used,
  });
  const protectedPayoutStatus = ["paid", "withheld"].includes(String(membershipMonth?.payout_status || ""))
    ? String(membershipMonth.payout_status)
    : payoutState.payoutStatus;

  const snapshot = {
    ...(membershipMonth || {}),
    package_key: servicePackage.key,
    planned_sessions_per_week: servicePackage.plannedSessionsPerWeek,
    session_quota: sessionQuota,
    sessions_used: used,
    sessions_remaining: remaining,
    specialist_earned_amount: payoutState.accruedAmountZar,
    specialist_payable_amount: payoutState.payableAmountZar,
    payout_status: protectedPayoutStatus,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  const { data: updated } = await supabase
    .from("membership_months")
    .update({
      sessions_used: used,
      sessions_remaining: remaining,
      specialist_earned_amount: payoutState.accruedAmountZar,
      specialist_payable_amount: payoutState.payableAmountZar,
      payout_status: protectedPayoutStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .eq("month_key", toMonthKey(options.monthStartIso))
    .eq("is_sandbox", !!options.isSandbox)
    .select("*")
    .maybeSingle();

  const resolvedMembershipMonth = updated || membershipMonth;
  if (!options.isSandbox && resolvedMembershipMonth?.id) {
    let tutorId = Array.from(completedScheduledSessions.values()).find(Boolean) || "";
    let enrollmentId = String(resolvedMembershipMonth.enrollment_id || "").trim();
    if (!tutorId && enrollmentId) {
      const { data: enrollment } = await supabase
        .from("parent_enrollments")
        .select("assigned_tutor_id")
        .eq("id", enrollmentId)
        .maybeSingle();
      tutorId = String(enrollment?.assigned_tutor_id || "").trim();
    }

    if (tutorId) {
      const { data: existingPayout } = await supabase
        .from("specialist_package_payouts")
        .select("id, status")
        .eq("membership_month_id", resolvedMembershipMonth.id)
        .maybeSingle();
      const payoutStatus = ["paid", "withheld"].includes(String(existingPayout?.status || ""))
        ? String(existingPayout.status)
        : payoutState.payoutStatus;
      const payoutRecord = {
        membership_month_id: resolvedMembershipMonth.id,
        tutor_id: tutorId,
        parent_id: options.parentId,
        student_id: options.studentId,
        enrollment_id: enrollmentId || null,
        package_key: servicePackage.key,
        required_session_count: sessionQuota,
        eligible_session_count: payoutState.eligibleSessionCount,
        consumed_session_count: payoutState.consumedSessionCount,
        accrued_amount: payoutState.accruedAmountZar,
        payable_amount: payoutState.payableAmountZar,
        status: payoutStatus,
        package_completed_at: payoutState.payoutStatus === "payable" ? new Date().toISOString() : null,
        evidence_snapshot: {
          qualifyingSessionIds: Array.from(evidenceEligibleSessionIds),
          evaluatedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };
      const { error: payoutError } = await supabase
        .from("specialist_package_payouts")
        .upsert(
          existingPayout?.id ? { ...payoutRecord, id: existingPayout.id } : payoutRecord,
          { onConflict: "membership_month_id" },
        );
      if (payoutError) console.error("Failed to reconcile Specialist package payout:", payoutError);
    }
  }

  return {
    ...snapshot,
    ...(updated || {}),
    session_quota: sessionQuota,
    sessions_used: used,
    sessions_remaining: remaining,
    specialist_earned_amount: payoutState.accruedAmountZar,
    specialist_payable_amount: payoutState.payableAmountZar,
    payout_status: protectedPayoutStatus,
    status: "active",
  };
}

async function recordSessionBillingEvent(options: {
  sessionId: string;
  parentId: string;
  studentId: string;
  enrollmentId?: string | null;
  eventType: string;
  actorRole: "parent" | "tutor" | "system";
  actorId: string;
  billingImpact: "none" | "consume" | "restore";
  creditsDelta: number;
  reasonCodes?: string[];
  reasonNote?: string | null;
  metadata?: Record<string, unknown>;
  effectiveAtIso?: string | null;
}) {
  const effectiveAtIso = options.effectiveAtIso || new Date().toISOString();
  let monthStartIso = getMonthStartIso(effectiveAtIso);
  if (!monthStartIso) return null;

  // detect whether this event should be marked as sandbox
  let isSandboxEvent = false;
  try {
    if (options.enrollmentId) {
      const { data: linkedEnrollment } = await supabase
        .from("parent_enrollments")
        .select("id, is_sandbox_account, parent_email, current_step, assigned_tutor_id")
        .eq("id", options.enrollmentId)
        .maybeSingle();

      if (linkedEnrollment) {
        isSandboxEvent = isSandboxLikeEnrollment(linkedEnrollment, linkedEnrollment.assigned_tutor_id);
      } else {
        isSandboxEvent = await resolveSandboxContextForParentStudent({
          parentId: options.parentId,
          studentId: options.studentId,
        });
      }
    } else {
      isSandboxEvent = await resolveSandboxContextForParentStudent({
        parentId: options.parentId,
        studentId: options.studentId,
      });
    }
  } catch (err) {
    console.error("Failed to resolve enrollment for sandbox detection:", err);
  }

  if (isSandboxEvent) {
    const rawCycleKey = options.metadata?.monthKey;
    let cycleKey: string | null = null;
    if (options.eventType === "renewal_payment" &&
        options.billingImpact === "restore" &&
        isSandboxCycleKey(rawCycleKey)) {
      // Only the server's verified renewal-application path can start a new
      // simulated cycle. Never derive an entitlement from wall-clock time.
      cycleKey = rawCycleKey;
    } else {
      const { data, error } = await supabase
        .from("membership_months")
        .select("*")
        .eq("parent_id", options.parentId)
        .eq("student_id", options.studentId)
        .eq("is_sandbox", true)
        .order("month_key", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2);
      if (error) {
        console.error("Failed to resolve Sandbox billing cycle:", error);
        return null;
      }
      const cycle = selectAuthoritativeSandboxCycle(data, options.parentId, options.studentId);
      if (!cycle) return null;
      cycleKey = String(cycle.month_key);
    }
    monthStartIso = `${cycleKey}T00:00:00.000Z`;
  }

  await upsertMembershipMonth({
    parentId: options.parentId,
    studentId: options.studentId,
    enrollmentId: options.enrollmentId || null,
    monthStartIso,
    isSandbox: isSandboxEvent,
  });

  const { data: existingEvents } = await supabase
    .from("session_billing_events")
    .select("id")
    .eq("session_id", options.sessionId)
    .eq("event_type", options.eventType)
    .limit(1);

  if (Array.isArray(existingEvents) && existingEvents.length > 0) {
    return recalculateMembershipMonthUsage({
      parentId: options.parentId,
      studentId: options.studentId,
      monthStartIso,
      isSandbox: isSandboxEvent,
    });
  }

  const { error } = await supabase.from("session_billing_events").insert({
    session_id: options.sessionId,
    parent_id: options.parentId,
    student_id: options.studentId,
    enrollment_id: options.enrollmentId || null,
    event_type: options.eventType,
    actor_role: options.actorRole,
    actor_id: options.actorId,
    billing_impact: options.billingImpact,
    credits_delta: options.creditsDelta,
    reason_codes: options.reasonCodes || [],
    reason_note: options.reasonNote || null,
    metadata: options.metadata || {},
    is_sandbox: isSandboxEvent,
    effective_at: effectiveAtIso,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to record session billing event:", error);
    return null;
  }

  const recalculated = await recalculateMembershipMonthUsage({
    parentId: options.parentId,
    studentId: options.studentId,
    monthStartIso,
    isSandbox: isSandboxEvent,
  });

  if (recalculated) {
    return recalculated;
  }

  const { data: fallbackRow } = await supabase
    .from("membership_months")
    .select("*")
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .eq("month_key", toMonthKey(monthStartIso))
    .eq("is_sandbox", isSandboxEvent)
    .maybeSingle();

  return fallbackRow;
}

function isMissingAssignedStudentIdError(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("assigned_student_id") || String(error?.code || "").trim() === "42703";
}

async function getMonthlySessionQuotaSnapshot(options: {
  parentId: string;
  studentId: string;
  referenceIso?: string | null;
  isSandboxContext?: boolean | null;
}) {
  const monthStartIso = getMonthStartIso(options.referenceIso || new Date().toISOString());
  if (!monthStartIso) return null;
  const monthKey = toMonthKey(monthStartIso);

  if (isEmergencyDbMode()) {
    const isSandbox = options.isSandboxContext === true;
    // Sandbox month_key names a simulated package cycle, not calendar expiry.
    const result = isSandbox
      ? await pool.query(
          `SELECT *
             FROM public.membership_months
            WHERE parent_id::text = $1::text AND student_id::text = $2::text
              AND is_sandbox = TRUE
            ORDER BY month_key DESC, created_at DESC
            LIMIT 2`,
          [options.parentId, options.studentId],
        )
      : await pool.query(
          `SELECT *
             FROM public.membership_months
            WHERE parent_id::text = $1::text AND student_id::text = $2::text
              AND month_key = $3 AND is_sandbox = FALSE
            LIMIT 1`,
          [options.parentId, options.studentId, monthKey],
        );
    const row = isSandbox
      ? selectAuthoritativeSandboxCycle(result.rows, options.parentId, options.studentId)
      : result.rows[0];
    if (!row) return null;

    const selectedCycleKey = isSandbox ? String(row.month_key) : monthKey;
    const cycleStartIso = new Date(`${selectedCycleKey}T00:00:00.000Z`).toISOString();
    const nextMonth = new Date(cycleStartIso);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const nowIso = new Date().toISOString();
    // Sandbox evidence can carry an accelerated virtual timeline. Real clock
    // time must not be a cap on completed simulated training or renewals.
    const evidenceUpperBoundIso = isSandbox ? "9999-12-31T23:59:59.999Z" : nowIso;
    const nextMonthIso = isSandbox ? evidenceUpperBoundIso : nextMonth.toISOString();
    const activatedAt = toIsoDateTime(row.created_at);
    let usageWindowStart = isSandbox && activatedAt && activatedAt < cycleStartIso
      ? activatedAt
      : cycleStartIso;

    try {
      const boundaryResult = await pool.query(
        `WITH student_renewal AS (
           SELECT paid_at
             FROM public.payment_transactions
            WHERE parent_id::text = $1::text
              AND student_id::text = $2::text
              AND provider = $6
              AND payment_status = 'paid'
              AND raw_payload @> '{"renewal": true}'::jsonb
              AND ($5 = FALSE OR raw_payload->>'payfast_mode' = 'sandbox'
                   OR raw_payload @> '{"sandbox_checkout": true}'::jsonb)
              AND paid_at >= $3::timestamptz
              AND paid_at < $4::timestamptz
            ORDER BY paid_at DESC
            LIMIT 1
         ),
         parent_renewal AS (
           SELECT paid_at
             FROM public.payment_transactions
            WHERE parent_id::text = $1::text
              AND provider = $6
              AND payment_status = 'paid'
              AND raw_payload @> '{"renewal": true}'::jsonb
              AND ($5 = FALSE OR (
                (student_id::text = $2::text OR ($7::text <> '' AND enrollment_id::text = $7::text))
                AND (raw_payload->>'payfast_mode' = 'sandbox'
                     OR raw_payload @> '{"sandbox_checkout": true}'::jsonb)
              ))
              AND paid_at >= $3::timestamptz
              AND paid_at < $4::timestamptz
            ORDER BY paid_at DESC
            LIMIT 1
         ),
         restore_event AS (
           SELECT effective_at
             FROM public.session_billing_events
            WHERE parent_id::text = $1::text
              AND student_id::text = $2::text
              AND event_type = 'renewal_payment'
              AND billing_impact = 'restore'
              AND is_sandbox = $5
              AND effective_at >= $3::timestamptz
              AND effective_at < $4::timestamptz
            ORDER BY effective_at DESC
            LIMIT 1
         )
         SELECT GREATEST(
           $3::timestamptz,
           COALESCE(
             (SELECT paid_at FROM student_renewal),
             (SELECT paid_at FROM parent_renewal),
             $3::timestamptz
           ),
           COALESCE((SELECT effective_at FROM restore_event), $3::timestamptz)
         ) AS usage_window_start`,
        [
          options.parentId,
          options.studentId,
          usageWindowStart,
          nextMonthIso,
          isSandbox,
          PAYMENT_PROVIDER_PAYFAST,
          String(row.enrollment_id || ""),
        ],
      );

      const resolvedBoundary = toIsoDateTime(boundaryResult.rows[0]?.usage_window_start);
      if (resolvedBoundary) {
        usageWindowStart = resolvedBoundary;
      }
    } catch (error) {
      console.error("Failed to determine emergency quota renewal window:", error);
      if (isSandbox) throw error;
    }

    const usageResult = await pool.query(
      `WITH completed_keys AS (
         SELECT 'training:' || s.id::text AS usage_key
           FROM public.scheduled_sessions s
          WHERE s.parent_id::text = $1::text
            AND s.student_id::text = $2::text
            AND s.type = 'training'
            AND s.status = 'completed'
            AND s.scheduled_time >= $3::timestamptz
            AND s.scheduled_time < $4::timestamptz
         UNION
         SELECT CASE
                  WHEN r.scheduled_session_id IS NOT NULL
                    THEN 'training:' || r.scheduled_session_id::text
                  ELSE 'training-run:' || r.id::text
                END AS usage_key
           FROM public.training_session_runs r
          WHERE r.student_id::text = $2::text
            AND r.status IN ('submitted', 'completed')
            AND COALESCE(r.submitted_at, r.started_at, r.created_at) >= $3::timestamptz
            AND COALESCE(r.submitted_at, r.started_at, r.created_at) < $4::timestamptz
         UNION
         SELECT CASE
                  WHEN d.scheduled_session_id IS NOT NULL
                    THEN 'training:' || d.scheduled_session_id::text
                  WHEN d.training_session_run_id IS NOT NULL
                    THEN 'training:' || d.training_session_run_id::text
                  ELSE 'training-drill:' || d.id::text
                END AS usage_key
           FROM public.intro_session_drills d
          WHERE d.student_id::text = $2::text
            AND d.submitted_at >= $3::timestamptz
            AND d.submitted_at < $4::timestamptz
            AND LOWER(
              COALESCE(
                NULLIF(d.drill->>'drillType', ''),
                NULLIF(d.drill->>'sessionContextKind', ''),
                CASE WHEN d.training_session_run_id IS NOT NULL THEN 'training' ELSE '' END
              )
            ) = 'training'
       )
       SELECT COUNT(*)::int AS completed_used,
             COALESCE(ARRAY_AGG(usage_key), ARRAY[]::text[]) AS completed_keys
          FROM completed_keys`,
      [options.parentId, options.studentId, usageWindowStart, evidenceUpperBoundIso],
    );

    const eventResult = isSandbox
      ? await pool.query(
          `SELECT session_id::text, credits_delta
             FROM public.session_billing_events
            WHERE parent_id::text = $1::text
              AND student_id::text = $2::text
              AND effective_at >= $3::timestamptz
              AND effective_at < $4::timestamptz
              AND billing_impact = 'consume'
              AND is_sandbox = TRUE`,
          [options.parentId, options.studentId, usageWindowStart, evidenceUpperBoundIso],
        )
      : await pool.query(
          `SELECT COALESCE(SUM(GREATEST(credits_delta, 0)), 0)::int AS event_used
             FROM public.session_billing_events
            WHERE parent_id::text = $1::text
              AND student_id::text = $2::text
              AND effective_at >= $3::timestamptz
              AND effective_at < $4::timestamptz
              AND billing_impact = 'consume'
              AND is_sandbox = FALSE`,
          [options.parentId, options.studentId, usageWindowStart, evidenceUpperBoundIso],
        );

    const sessionQuota = Number(row.session_quota ?? DEFAULT_SERVICE_PACKAGE.sessionsPerMonth);
    const completedUsed = Number(usageResult.rows[0]?.completed_used || 0);
    const completedKeys = new Set<string>(usageResult.rows[0]?.completed_keys || []);
    // Do not count a matching delivered lesson and billing event twice.
    const eventUsed = isSandbox
      ? eventResult.rows.reduce((sum: number, event: any) => {
          const id = String(event.session_id || "").trim();
          // A delivered lesson already represented by training evidence
          // must not be consumed a second time via its billing event.
          if (id && (completedKeys.has(`training:${id}`) || completedKeys.has(`training-run:${id}`))) return sum;
          return sum + Math.max(0, Number(event.credits_delta) || 0);
        }, 0)
      : Number(eventResult.rows[0]?.event_used || 0);
    const actualConsumed = completedUsed + eventUsed;
    const sessionsUsed = Math.max(0, Math.min(sessionQuota, actualConsumed));
    const sessionsRemaining = Math.max(0, sessionQuota - sessionsUsed);

    // Reading a simulated package must not alter the evidence or provision
    // new capacity. Block when the persistent snapshot and usage disagree.
    if (isSandbox && !verifySandboxCycleConsumption(row, actualConsumed)) return null;

    let persistedRow = row;
    if (!isSandbox && (
      Number(row.sessions_used ?? 0) !== sessionsUsed ||
      Number(row.sessions_remaining ?? sessionQuota) !== sessionsRemaining
    )) {
      const persisted = await pool.query(
        `UPDATE public.membership_months
            SET sessions_used = $1,
                sessions_remaining = $2,
                updated_at = NOW()
          WHERE id = $3
          RETURNING *`,
        [sessionsUsed, sessionsRemaining, row.id],
      );
      persistedRow = persisted.rows[0] || row;
    }

    return {
      ...persistedRow,
      session_quota: sessionQuota,
      sessions_used: sessionsUsed,
      sessions_remaining: sessionsRemaining,
      status: String(persistedRow.status || "active"),
    };
  }

  // detect whether this parent/student should use sandbox membership row
  let isSandboxContext = options.isSandboxContext;
  if (typeof isSandboxContext !== "boolean") {
    try {
      isSandboxContext = await resolveSandboxContextForParentStudent({
        parentId: options.parentId,
        studentId: options.studentId,
      });
    } catch (err) {
      console.error("Failed to resolve enrollment for sandbox context:", err);
      isSandboxContext = false;
    }
  }

  if (isSandboxContext === true) {
    // Proof/Sandbox reads never create or renew a package because time passed.
    const { data, error } = await supabase
      .from("membership_months")
      .select("*")
      .eq("parent_id", options.parentId)
      .eq("student_id", options.studentId)
      .eq("is_sandbox", true)
      .order("month_key", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2);
    if (error) throw error;
    return selectAuthoritativeSandboxCycle(data, options.parentId, options.studentId);
  }

  let { data: row } = await supabase
    .from("membership_months")
    .select("*")
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .eq("month_key", monthKey)
    .eq("is_sandbox", false)
    .maybeSingle();

  if (!row) {
    row = await upsertMembershipMonth({
      parentId: options.parentId,
      studentId: options.studentId,
      monthStartIso,
      isSandbox: isSandboxContext,
    });
  }

  if (!row) return null;

  try {
    const recalculated = await recalculateMembershipMonthUsage({
      parentId: options.parentId,
      studentId: options.studentId,
      monthStartIso,
      isSandbox: isSandboxContext,
    });

    if (recalculated) {
      return {
        ...recalculated,
        session_quota: Number(recalculated.session_quota ?? DEFAULT_SERVICE_PACKAGE.sessionsPerMonth),
        sessions_used: Number(recalculated.sessions_used ?? 0),
        sessions_remaining: Number(recalculated.sessions_remaining ?? 0),
        status: String(recalculated.status || "active"),
      };
    }
  } catch (error) {
    console.error("Failed to reconcile monthly session quota snapshot:", error);
  }

  return {
    ...row,
    session_quota: Number(row.session_quota ?? DEFAULT_SERVICE_PACKAGE.sessionsPerMonth),
    sessions_used: Number(row.sessions_used ?? 0),
    sessions_remaining: Number(row.sessions_remaining ?? 0),
    status: String(row.status || "active"),
  };
}


type TrainingPackageQuotaAuthority = {
  monthlyQuota: any | null;
  decision: TrainingPackageQuotaDecision;
};

async function getTrainingPackageQuotaAuthority(options: {
  operationalMode: unknown;
  studentId: string;
  student?: any;
  session?: any;
}): Promise<TrainingPackageQuotaAuthority> {
  const unavailableDecision = evaluateTrainingPackageQuota(options.operationalMode, null);
  if (!unavailableDecision.required) {
    return { monthlyQuota: null, decision: unavailableDecision };
  }

  const parentId = String(
    options.session?.parent_id ||
      options.student?.parentId ||
      options.student?.parent_id ||
      "",
  ).trim();

  if (!parentId) {
    return { monthlyQuota: null, decision: unavailableDecision };
  }

  try {
    const monthlyQuota = await getMonthlySessionQuotaSnapshot({
      parentId,
      studentId: String(options.studentId),
      referenceIso: new Date().toISOString(),
      isSandboxContext:
        String(options.operationalMode || "").trim().toLowerCase() === "sandbox"
          ? true
          : undefined,
    });
    return {
      monthlyQuota,
      decision: evaluateTrainingPackageQuota(options.operationalMode, monthlyQuota),
    };
  } catch (error) {
    console.error("Failed to resolve training package quota authority:", error);
    return { monthlyQuota: null, decision: unavailableDecision };
  }
}

function trainingPackageQuotaMessage(decision: TrainingPackageQuotaDecision) {
  return decision.code === "PACKAGE_QUOTA_EXHAUSTED"
    ? "This family's package has no sessions remaining. Training is locked until the package renews."
    : "Training is locked because the family's package quota could not be verified.";
}

function applyTrainingPackageQuotaToLaunch(
  launch: ReturnType<typeof getSessionLaunchState>,
  decision: TrainingPackageQuotaDecision,
) {
  if (!decision.blocked) return launch;
  return {
    ...launch,
    canLaunch: false,
    code: decision.code,
  };
}

async function reconcileTrainingSessionCompletionFromRun(options: {
  session: any;
  tutorId: string;
  studentId: string;
}) {
  const session = options.session;
  const sessionId = String(session?.id || "").trim();
  const status = String(session?.status || "").trim();
  if (
    !sessionId ||
    !["confirmed", "scheduled", "ready", "live"].includes(status)
  ) {
    return session;
  }

  if (usesDirectProofSessionDatabase()) {
    const runResult = await pool.query(
      `SELECT id
         FROM public.training_session_runs
        WHERE scheduled_session_id::text = $1
          AND student_id = $2
          AND tutor_id = $3
          AND status IN ('submitted', 'completed')
        ORDER BY COALESCE(submitted_at, started_at, created_at) DESC
        LIMIT 1`,
      [sessionId, options.studentId, options.tutorId],
    );
    if (!runResult.rows[0]) return session;

    const updateResult = await pool.query(
      `UPDATE public.scheduled_sessions
          SET status = 'completed',
              updated_at = NOW()
        WHERE id::text = $1
          AND tutor_id = $2
          AND student_id = $3
          AND status IN ('confirmed', 'scheduled', 'ready', 'live')
      RETURNING ${SCHEDULED_SESSION_SELECT}`,
      [sessionId, options.tutorId, options.studentId],
    );
    return updateResult.rows[0] || { ...session, status: "completed" };
  }

  const { data: linkedRun, error: runError } = await supabase
    .from("training_session_runs")
    .select("id")
    .eq("scheduled_session_id", sessionId)
    .eq("student_id", options.studentId)
    .eq("tutor_id", options.tutorId)
    .in("status", ["submitted", "completed"])
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError) {
    console.error("Failed to reconcile scheduled lesson against training run:", runError);
    return session;
  }
  if (!linkedRun) return session;

  const { data: updatedSession, error: updateError } = await supabase
    .from("scheduled_sessions")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("tutor_id", options.tutorId)
    .eq("student_id", options.studentId)
    .in("status", ["confirmed", "scheduled", "ready", "live"])
    .select(SCHEDULED_SESSION_SELECT)
    .maybeSingle();

  if (updateError) {
    console.error("Failed to retire consumed scheduled lesson:", updateError);
    return session;
  }

  return updatedSession || { ...session, status: "completed" };
}

async function resolveEnrollmentIdForSession(session: any) {
  const parentId = String(session?.parent_id || "").trim();
  const tutorId = String(session?.tutor_id || "").trim();
  const studentId = String(session?.student_id || "").trim();
  if (!parentId) return null;

  let enrollmentQuery = supabase
    .from("parent_enrollments")
    .select("id")
    .eq("user_id", parentId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (tutorId) enrollmentQuery = enrollmentQuery.eq("assigned_tutor_id", tutorId);
  if (studentId) enrollmentQuery = enrollmentQuery.eq("assigned_student_id", studentId);

  const { data, error } = await enrollmentQuery.maybeSingle();
  if (data?.id) return data.id;

  if (studentId && error && isMissingAssignedStudentIdError(error)) {
    let fallbackQuery = supabase
      .from("parent_enrollments")
      .select("id")
      .eq("user_id", parentId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (tutorId) {
      fallbackQuery = fallbackQuery.eq("assigned_tutor_id", tutorId);
    }

    const { data: fallbackData } = await fallbackQuery.maybeSingle();
    return fallbackData?.id || null;
  }

  return null;
}

function classifyCancellationBillingImpact(options: {
  actorRole: "parent" | "tutor";
  scheduledTimeIso?: string | null;
  nowIso?: string | null;
}) {
  const scheduledAt = toIsoDateTime(options.scheduledTimeIso);
  const nowIso = options.nowIso || new Date().toISOString();
  const now = new Date(nowIso).getTime();
  const scheduled = scheduledAt ? new Date(scheduledAt).getTime() : null;

  if (!scheduled) {
    return {
      eventType: "cancelled_unknown_timing",
      impact: "none" as const,
      creditsDelta: 0,
    };
  }

  if (now >= scheduled) {
    return {
      eventType: options.actorRole === "parent" ? "no_show_parent" : "no_show_tutor",
      impact: options.actorRole === "parent" ? ("consume" as const) : ("restore" as const),
      creditsDelta: options.actorRole === "parent" ? 1 : 0,
    };
  }

  const diffHours = (scheduled - now) / (1000 * 60 * 60);
  if (diffHours < CANCELLATION_CUTOFF_HOURS) {
    return {
      eventType: options.actorRole === "parent" ? "cancelled_late_parent" : "cancelled_late_tutor",
      impact: options.actorRole === "parent" ? ("consume" as const) : ("none" as const),
      creditsDelta: options.actorRole === "parent" ? 1 : 0,
    };
  }

  return {
    eventType: options.actorRole === "parent" ? "cancelled_early_parent" : "cancelled_early_tutor",
    impact: "none" as const,
    creditsDelta: 0,
  };
}

function classifyTrainingSessionCancellation(options: {
  actorRole: "parent" | "tutor";
  reasonCodes: string[];
  scheduledTimeIso?: string | null;
}) {
  const parentRequestedThroughSpecialist =
    options.actorRole === "tutor" &&
    options.reasonCodes.includes("parent_requested_cancellation");
  const responsibleActorRole: "parent" | "tutor" =
    parentRequestedThroughSpecialist ? "parent" : options.actorRole;
  const billing = classifyCancellationBillingImpact({
    actorRole: responsibleActorRole,
    scheduledTimeIso: options.scheduledTimeIso,
  });
  const disposition = deriveTrainingSessionCancellationDisposition({
    actorRole: options.actorRole,
    reasonCodes: options.reasonCodes,
    eventType: billing.eventType,
    billingImpact: billing.impact,
  });

  return {
    ...billing,
    disposition,
    responsibleActorRole,
  };
}

function normalizeStoredCancellationDisposition(
  value: unknown,
): TrainingSessionCancellationDisposition | null {
  const normalized = String(value || "").trim();
  if (
    normalized === "replacement_required" ||
    normalized === "closed_consumed" ||
    normalized === "manual_review"
  ) {
    return normalized;
  }
  return null;
}

function buildTrainingSessionCancellationContext(event: any) {
  if (!event) {
    return {
      disposition: "manual_review" as const,
      eventType: null,
      billingImpact: null,
      reasonCodes: [] as string[],
      reasonNote: null,
      cancelledAt: null,
    };
  }

  const metadata =
    event.metadata && typeof event.metadata === "object"
      ? event.metadata
      : {};
  const reasonCodes = Array.isArray(event.reason_codes)
    ? event.reason_codes.map((value: unknown) => String(value || "").trim()).filter(Boolean)
    : [];
  const storedDisposition = normalizeStoredCancellationDisposition(
    (metadata as Record<string, unknown>).cancellation_disposition,
  );
  const disposition =
    storedDisposition ||
    deriveTrainingSessionCancellationDisposition({
      actorRole: String(event.actor_role || "") === "tutor" ? "tutor" : "parent",
      reasonCodes,
      eventType: event.event_type,
      billingImpact: event.billing_impact,
    });

  return {
    disposition,
    eventType: String(event.event_type || "").trim() || null,
    billingImpact: String(event.billing_impact || "").trim() || null,
    reasonCodes,
    reasonNote: String(event.reason_note || "").trim() || null,
    cancelledAt: event.effective_at || event.created_at || null,
  };
}

async function attachTrainingSessionCancellationContext(sessions: any[]) {
  const cancelledSessionIds = Array.from(
    new Set(
      sessions
        .filter((session: any) => String(session?.status || "") === "cancelled")
        .map((session: any) => String(session?.id || "").trim())
        .filter(Boolean),
    ),
  );

  if (cancelledSessionIds.length === 0) return sessions;

  try {
    const cancellationEventsResult = await pool.query(
      `SELECT DISTINCT ON (session_id::text)
              session_id, event_type, actor_role, billing_impact,
              reason_codes, reason_note, metadata, effective_at, created_at
         FROM public.session_billing_events
        WHERE session_id::text = ANY($1::text[])
          AND (
            event_type LIKE 'cancelled_%'
            OR event_type LIKE 'no_show_%'
          )
        ORDER BY session_id::text, effective_at DESC, created_at DESC`,
      [cancelledSessionIds],
    );

    const eventsBySessionId = new Map<string, any>();
    for (const event of cancellationEventsResult.rows || []) {
      eventsBySessionId.set(String(event.session_id), event);
    }

    return sessions.map((session: any) => {
      if (String(session?.status || "") !== "cancelled") return session;
      return {
        ...session,
        cancellation: buildTrainingSessionCancellationContext(
          eventsBySessionId.get(String(session.id)),
        ),
      };
    });
  } catch (error) {
    console.error("Failed to attach training-session cancellation context:", error);
    return sessions.map((session: any) => {
      if (String(session?.status || "") !== "cancelled") return session;
      return {
        ...session,
        cancellation: buildTrainingSessionCancellationContext(null),
      };
    });
  }
}

async function isSandboxPaymentTransaction(transaction: any) {
  const rawPayload =
    transaction?.raw_payload && typeof transaction?.raw_payload === "object"
      ? (transaction.raw_payload as Record<string, unknown>)
      : {};

  if (
    String(rawPayload.payfast_mode || "").trim().toLowerCase() === "sandbox" ||
    String(rawPayload.sandbox_checkout || "").trim().toLowerCase() === "true"
  ) {
    return true;
  }

  const enrollmentId = String(transaction?.enrollment_id || "").trim();
  if (!enrollmentId) return false;

  const { data: linkedEnrollment } = await supabase
    .from("parent_enrollments")
    .select("id, current_step, assigned_tutor_id, parent_email, is_sandbox_account, student_full_name")
    .eq("id", enrollmentId)
    .maybeSingle();

  return isSandboxPaymentEnrollment(linkedEnrollment);
}

function isRenewalPaymentTransaction(transaction: any) {
  const rawPayload =
    transaction?.raw_payload && typeof transaction?.raw_payload === "object"
      ? (transaction.raw_payload as Record<string, unknown>)
      : {};

  return (
    rawPayload.renewal === true ||
    String(rawPayload.renewal || "").trim().toLowerCase() === "true"
  );
}

async function applyRenewalTransactionToMembershipMonth(transaction: any) {
  const rawPayload =
    transaction?.raw_payload && typeof transaction.raw_payload === "object"
      ? (transaction.raw_payload as Record<string, unknown>)
      : {};

  const renewal =
    rawPayload.renewal === true ||
    String(rawPayload.renewal || "").trim().toLowerCase() === "true";
  const monthKey = String(rawPayload.month_key || "").trim();
  const parentId = String(transaction?.parent_id || "").trim();
  let studentId = String(transaction?.student_id || "").trim();
  const servicePackage = getMonthlyServicePackage(
    transaction?.package_key || rawPayload.package_key || DEFAULT_MONTHLY_PACKAGE_KEY,
  );

  if (!renewal || !monthKey || !parentId) {
    return null;
  }

  const enrollmentId = String(transaction?.enrollment_id || "").trim();
  if (enrollmentId) {
    try {
      const { data: enrollment } = await supabase
        .from("parent_enrollments")
        .select("id, user_id, assigned_tutor_id, student_full_name, student_grade, parent_email, is_sandbox_account, current_step")
        .eq("id", enrollmentId)
        .maybeSingle();

      if (enrollment) {
        let canonicalStudentId = "";

        if (!canonicalStudentId && enrollment.id) {
          const { data: byEnrollmentId } = await supabase
            .from("students")
            .select("id, parent_enrollment_id, updated_at")
            .eq("parent_enrollment_id", enrollment.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          canonicalStudentId = String(byEnrollmentId?.id || "").trim();
        }

        if (!canonicalStudentId && enrollment.assigned_tutor_id && enrollment.user_id && enrollment.student_full_name) {
          const { data: byParentAndName } = await supabase
            .from("students")
            .select("id")
            .eq("parent_id", enrollment.user_id)
            .eq("tutor_id", enrollment.assigned_tutor_id)
            .eq("name", enrollment.student_full_name)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          canonicalStudentId = String(byParentAndName?.id || "").trim();
        }

        if (!canonicalStudentId && enrollment.assigned_tutor_id && enrollment.parent_email && enrollment.student_full_name) {
          const { data: byParentContact } = await supabase
            .from("students")
            .select("id")
            .eq("parent_contact", enrollment.parent_email)
            .eq("tutor_id", enrollment.assigned_tutor_id)
            .eq("name", enrollment.student_full_name)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          canonicalStudentId = String(byParentContact?.id || "").trim();
        }

        if (!canonicalStudentId && enrollment.user_id) {
          const { data: byParent } = await supabase
            .from("students")
            .select("id")
            .eq("parent_id", enrollment.user_id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          canonicalStudentId = String(byParent?.id || "").trim();
        }

        if (canonicalStudentId) {
          studentId = canonicalStudentId;
        }
      }
    } catch (error) {
      console.error("Failed to resolve canonical student for renewal application:", error);
    }
  }

  if (!studentId) {
    return null;
  }

  const monthStartIso = toIsoDateTime(`${monthKey}T00:00:00.000Z`);
  if (!monthStartIso) {
    return null;
  }

  let isSandboxTransaction = false;
  try {
    if (enrollmentId) {
      const { data: linkedEnrollment } = await supabase
        .from("parent_enrollments")
        .select("id, current_step, assigned_tutor_id, parent_email, is_sandbox_account, student_full_name")
        .eq("id", enrollmentId)
        .maybeSingle();

      if (linkedEnrollment) {
        isSandboxTransaction = isSandboxPaymentEnrollment(linkedEnrollment);
      } else {
        isSandboxTransaction = await isSandboxPaymentTransaction(transaction);
      }
    } else {
      isSandboxTransaction = await isSandboxPaymentTransaction(transaction);
    }
  } catch (error) {
    console.error("Failed to resolve sandbox context for renewal application:", error);
    isSandboxTransaction = await isSandboxPaymentTransaction(transaction);
  }

  const { data: existingMonth } = await supabase
    .from("membership_months")
    .select("*")
    .eq("parent_id", parentId)
    .eq("student_id", studentId)
    .eq("month_key", monthKey)
    .eq("is_sandbox", isSandboxTransaction)
    .maybeSingle();

  if (!existingMonth) {
    const month = await upsertMembershipMonth({
      parentId,
      studentId,
      monthStartIso,
      isSandbox: isSandboxTransaction,
      packageKey: servicePackage.key,
    });
    if (!month) return null;
    await recordSessionBillingEvent({
      sessionId: `renewal-${monthKey}-${parentId}-${studentId}`,
      parentId,
      studentId,
      enrollmentId: enrollmentId || null,
      eventType: "renewal_payment",
      actorRole: "system",
      actorId: "system",
      billingImpact: "restore",
      creditsDelta: servicePackage.sessionsPerMonth,
      reasonCodes: ["renewal"],
      reasonNote: "Monthly renewal payment applied",
      metadata: {
        monthKey,
        renewal: true,
        packageKey: servicePackage.key,
        transactionId: String(transaction?.id || ""),
      },
      effectiveAtIso: String(transaction?.paid_at || new Date().toISOString()),
    });

    const { data: resetMonth, error: resetError } = await supabase
      .from("membership_months")
      .update({
        sessions_used: 0,
        sessions_remaining: servicePackage.sessionsPerMonth,
        session_quota: servicePackage.sessionsPerMonth,
        package_key: servicePackage.key,
        planned_sessions_per_week: servicePackage.plannedSessionsPerWeek,
        specialist_earned_amount: 0,
        specialist_payable_amount: 0,
        payout_status: "accruing",
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("parent_id", parentId)
      .eq("student_id", studentId)
      .eq("month_key", monthKey)
      .eq("is_sandbox", isSandboxTransaction)
      .select("*")
      .maybeSingle();

    if (resetError) {
      console.error("Failed to reset membership month after renewal upsert:", resetError);
    }

    return resetMonth || month;
  }

  const renewedMonth = await recordSessionBillingEvent({
    sessionId: `renewal-${monthKey}-${parentId}-${studentId}`,
    parentId,
    studentId,
    enrollmentId: enrollmentId || null,
    eventType: "renewal_payment",
    actorRole: "system",
    actorId: "system",
    billingImpact: "restore",
    creditsDelta: servicePackage.sessionsPerMonth,
    reasonCodes: ["renewal"],
    reasonNote: "Monthly renewal payment applied",
    metadata: {
      monthKey,
      renewal: true,
      packageKey: servicePackage.key,
      transactionId: String(transaction?.id || ""),
    },
    effectiveAtIso: String(transaction?.paid_at || new Date().toISOString()),
  });

  if (renewedMonth) {
    return renewedMonth;
  }

  const { data: updatedMonth, error: updateError } = await supabase
    .from("membership_months")
    .update({
      sessions_used: 0,
      sessions_remaining: servicePackage.sessionsPerMonth,
      session_quota: servicePackage.sessionsPerMonth,
      package_key: servicePackage.key,
      planned_sessions_per_week: servicePackage.plannedSessionsPerWeek,
      specialist_earned_amount: 0,
      specialist_payable_amount: 0,
      payout_status: "accruing",
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", existingMonth.id)
    .select("*")
    .maybeSingle();

  if (updateError) {
    console.error("Failed to apply renewal to membership month:", updateError);
    return null;
  }

  return updatedMonth;
}

async function getParentBillingModel(parentId: string) {
  if (isEmergencyDbMode()) {
    try {
      const [parentResult, enrollmentResult] = await Promise.all([
        pool.query(
          `SELECT onboarding_type, affiliate_code, affiliate_type
             FROM public.parents
            WHERE user_id::text = $1::text
            LIMIT 1`,
          [parentId],
        ),
        pool.query(
          `SELECT id, onboarding_type, demand_flow_version, is_sandbox_account
             FROM public.parent_enrollments
            WHERE user_id::text = $1::text
            ORDER BY updated_at DESC
            LIMIT 1`,
          [parentId],
        ),
      ]);

      const parent = parentResult.rows[0] || null;
      const enrollment = enrollmentResult.rows[0] || null;
      let onboardingType = resolveEntryType(parent);
      const enrollmentEntryType = resolveEntryType(enrollment);
      const isSandboxEnrollment = Boolean(enrollment?.is_sandbox_account);
      const isLegacyEnrollment = Number(enrollment?.demand_flow_version) === 0;

      // Emergency/local Proof must derive billing authority from the same
      // direct database as the authenticated session. Sandbox and proven
      // pre-migration enrollments are outside the Demand Production review gate.
      if (isSandboxEnrollment || isLegacyEnrollment) {
        if (enrollmentEntryType === "pilot" || enrollmentEntryType === "commercial") {
          onboardingType = enrollmentEntryType;
        } else if (!onboardingType || onboardingType === "pending") {
          onboardingType = "commercial";
        }
      }

      return {
        data: {
          onboardingType,
          affiliateCode: parent?.affiliate_code || null,
          affiliateType: parent?.affiliate_type || null,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: {
          onboardingType: null,
          affiliateCode: null,
          affiliateType: null,
        },
        error,
      };
    }
  }

  const { data, error } = await supabase
    .from("parents")
    .select("onboarding_type, affiliate_code, affiliate_type")
    .eq("user_id", parentId)
    .maybeSingle();

  let onboardingType = resolveEntryType(data);
  // Preserve the former commercial fallback only for a proven pre-migration enrollment.
  if (!data && !error) {
    const legacy = await supabase.from("parent_enrollments").select("id")
      .eq("user_id", parentId).eq("demand_flow_version", 0).limit(1).maybeSingle();
    if (legacy.error) return { data: { onboardingType: null, affiliateCode: null, affiliateType: null }, error: legacy.error };
    if (legacy.data) onboardingType = "commercial";
  }

  return {
    data: {
      onboardingType,
      affiliateCode: data?.affiliate_code || null,
      affiliateType: data?.affiliate_type || null,
    },
    error,
  };
}

function parseStoredDrillPayload(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isTrainingDrillRecord(row: any) {
  const payload = parseStoredDrillPayload(row?.drill);
  const drillType = String(
    payload?.drillType ||
      payload?.sessionContextKind ||
      (row?.training_session_run_id ? "training" : ""),
  )
    .trim()
    .toLowerCase();

  return drillType === "training";
}

async function getCompletedSessionCountForStudent(studentId: string) {
  const { data: trainingRuns, error: trainingRunError } = await supabase
    .from("training_session_runs")
    .select("id, scheduled_session_id, status")
    .eq("student_id", studentId);

  if (trainingRunError) {
    return {
      count: 0,
      error: trainingRunError,
    };
  }

  const completedTrainingRuns = (trainingRuns || []).filter((row: any) =>
    ["submitted", "completed"].includes(String(row?.status || "").trim().toLowerCase()),
  );

  const completedSessionKeys = new Set<string>();
  completedTrainingRuns.forEach((row: any) => {
    const scheduledId = String(row?.scheduled_session_id || "").trim();
    const runId = String(row?.id || "").trim();
    if (scheduledId) {
      completedSessionKeys.add(`training:${scheduledId}`);
    } else if (runId) {
      completedSessionKeys.add(`training-run:${runId}`);
    }
  });

  if (completedSessionKeys.size > 0) {
    return {
      count: completedSessionKeys.size,
      error: null,
    };
  }

  const { data: drills, error } = await supabase
    .from("intro_session_drills")
    .select("id, scheduled_session_id, training_session_run_id, drill")
    .eq("student_id", studentId);

  if (error) {
    return {
      count: 0,
      error,
    };
  }

  (drills || []).forEach((row: any) => {
    if (!isTrainingDrillRecord(row)) return;

    const scheduledId = String(row?.scheduled_session_id || "").trim();
    const runId = String(row?.training_session_run_id || "").trim();
    const drillId = String(row?.id || "").trim();

    if (scheduledId) {
      completedSessionKeys.add(`training:${scheduledId}`);
    } else if (runId) {
      completedSessionKeys.add(`training-run:${runId}`);
    } else if (drillId) {
      completedSessionKeys.add(`training-drill:${drillId}`);
    }
  });

  return {
    count: completedSessionKeys.size,
    error: null,
  };
}

async function ensurePremiumAccessForParent(parentId: string, studentId?: string | null) {
  // Sandbox mirrors the commercial package journey through PayFast sandbox.
  // A sandbox membership row is quota state, not payment authority.
  const billingModel = await getParentBillingModel(parentId);
  if (billingModel.error) {
    return {
      allowed: false,
      status: 500,
      message: "Failed to resolve onboarding type for payment rules.",
    };
  }

  if (!billingModel.data.onboardingType || billingModel.data.onboardingType === "pending") {
    return { allowed: false, status: 409, message: "Application review and entry selection must be completed before service." };
  }

  if (billingModel.data.onboardingType === "pilot") {
    if (!studentId) {
      return {
        allowed: true,
        status: 200,
        message: null,
        onboardingType: "pilot",
        freeSessionsRemaining: 9,
      };
    }

    const sessionProgress = await getCompletedSessionCountForStudent(studentId);
    if (sessionProgress.error) {
      return {
        allowed: false,
        status: 500,
        message: "Failed to verify pilot session usage.",
      };
    }

    const completedSessions = sessionProgress.count;
    const freeSessionsRemaining = Math.max(0, 9 - completedSessions);

    if (completedSessions < 9) {
      return {
        allowed: true,
        status: 200,
        message: null,
        onboardingType: "pilot",
        completedSessions,
        freeSessionsRemaining,
      };
    }
  }

  let { data, error } = await getLatestPaidPaymentForParent(parentId, studentId);
  if (error) {
    return {
      allowed: false,
      status: 500,
      message: "Failed to verify payment status.",
    };
  }

  if (!data && studentId) {
    const fallbackResult = await getLatestPaidPaymentForParent(parentId);
    if (fallbackResult.error) {
      return {
        allowed: false,
        status: 500,
        message: "Failed to verify payment status.",
      };
    }

    data = fallbackResult.data;
  }

  if (!data) {
    return {
      allowed: false,
      status: 402,
      message:
        billingModel.data.onboardingType === "pilot"
          ? "Pilot access is exhausted. Monthly package payment is now required before more training sessions can be accessed."
          : "Monthly package payment is required before training sessions can be accessed.",
      onboardingType: billingModel.data.onboardingType,
    };
  }

  return {
    allowed: true,
    status: 200,
    message: null,
    onboardingType: billingModel.data.onboardingType,
    payment: data,
  };
}

async function ensurePremiumAccessForStudent(student: any) {
  const parentId = String((student as any)?.parentId || "").trim();
  if (!parentId) {
    return {
      allowed: false,
      status: 400,
      message: "Student must be linked to a parent before payment status can be verified.",
    };
  }

  return ensurePremiumAccessForParent(parentId, String(student?.id || "").trim() || null);
}

async function finalizeAcceptedProposalFromPayment(transaction: any) {
  const enrollmentId = String(transaction?.enrollment_id || "").trim();
  const proposalId = String(transaction?.proposal_id || "").trim();

  if (!enrollmentId || !proposalId) {
    throw new Error("Payment transaction is missing enrollment or proposal linkage.");
  }

  if (isEmergencyDbMode()) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const enrollmentResult = await client.query(
        `SELECT id, status, current_step, proposal_id
           FROM public.parent_enrollments
          WHERE id = $1
          FOR UPDATE`,
        [enrollmentId],
      );
      const enrollment = enrollmentResult.rows[0] || null;
      if (!enrollment) {
        throw new Error("Failed to resolve parent enrollment for paid transaction.");
      }

      const proposalResult = await client.query(
        `SELECT id, accepted_at, parent_code, student_id, tutor_id,
                topic_conditioning_topic, topic_conditioning_entry_phase,
                topic_conditioning_stability, package_key, package_sessions,
                planned_sessions_per_week
           FROM public.onboarding_proposals
          WHERE id = $1
          FOR UPDATE`,
        [proposalId],
      );
      const proposal = proposalResult.rows[0] || null;
      if (!proposal) {
        throw new Error("Failed to resolve onboarding proposal for paid transaction.");
      }

      if (proposal.accepted_at && proposal.parent_code && enrollment.status === "session_booked") {
        if (String(enrollment.current_step || "").trim().toLowerCase() !== "active_training") {
          await client.query(
            `UPDATE public.parent_enrollments
                SET current_step = 'active_training',
                    updated_at = $1
              WHERE id = $2`,
            [new Date().toISOString(), enrollment.id],
          );
        }
        await client.query("COMMIT");
        return {
          status: "session_booked",
          parentCode: proposal.parent_code,
        };
      }

      const generateParentCode = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      let parentCode = proposal.parent_code || generateParentCode();
      let codeIsUnique = !!proposal.parent_code;
      let attempts = 0;

      while (!codeIsUnique && attempts < 10) {
        const existingCode = await client.query(
          `SELECT id
             FROM public.onboarding_proposals
            WHERE parent_code = $1
              AND id <> $2
            LIMIT 1`,
          [parentCode, proposal.id],
        );
        if (!existingCode.rows[0]) {
          codeIsUnique = true;
        } else {
          parentCode = generateParentCode();
          attempts++;
        }
      }

      const nowIso = new Date().toISOString();
      const servicePackage = getMonthlyServicePackage(transaction?.package_key || proposal.package_key);

      await client.query(
        `UPDATE public.parent_enrollments
            SET status = 'session_booked',
                current_step = 'active_training',
                package_key = $1,
                package_sessions = $2,
                planned_sessions_per_week = $3,
                updated_at = $4
          WHERE id = $5`,
        [
          servicePackage.key,
          servicePackage.sessionsPerMonth,
          servicePackage.plannedSessionsPerWeek,
          nowIso,
          enrollment.id,
        ],
      );

      await client.query(
        `UPDATE public.onboarding_proposals
            SET enrollment_id = $1,
                accepted_at = COALESCE(accepted_at, $2),
                parent_code = $3,
                updated_at = $2
          WHERE id = $4`,
        [enrollment.id, nowIso, parentCode, proposal.id],
      );

      const acceptedTopic = String(proposal.topic_conditioning_topic || "").trim();
      const acceptedPhase = tryParsePhase(proposal.topic_conditioning_entry_phase) || "Clarity";
      const acceptedStability = normalizeStability(proposal.topic_conditioning_stability || "Low");

      if (proposal.student_id && proposal.tutor_id && acceptedTopic) {
        const activationReason = [
          "Auto-activated from accepted proposal",
          `Phase ${acceptedPhase}`,
          `Stability ${acceptedStability}`,
        ].join(" | ");

        const existingActivation = await client.query(
          `SELECT id
             FROM public.topic_conditioning_activations
            WHERE student_id = $1
              AND topic = $2
            LIMIT 1`,
          [proposal.student_id, acceptedTopic],
        );

        if (!existingActivation.rows[0]) {
          await client.query(
            `INSERT INTO public.topic_conditioning_activations
              (student_id, tutor_id, topic, reason)
             VALUES ($1, $2, $3, $4)`,
            [proposal.student_id, proposal.tutor_id, acceptedTopic, activationReason],
          );
        }

        const studentResult = await client.query(
          `SELECT id, concept_mastery
             FROM public.students
            WHERE id = $1
            LIMIT 1`,
          [proposal.student_id],
        );
        const studentForConcept = studentResult.rows[0] || null;

        if (studentForConcept) {
          const currentConceptMastery =
            studentForConcept.concept_mastery && typeof studentForConcept.concept_mastery === "object"
              ? studentForConcept.concept_mastery
              : {};
          const topicConditioning =
            currentConceptMastery.topicConditioning && typeof currentConceptMastery.topicConditioning === "object"
              ? currentConceptMastery.topicConditioning
              : {};
          const topics =
            topicConditioning.topics && typeof topicConditioning.topics === "object"
              ? { ...topicConditioning.topics }
              : {};
          const existingTopicState =
            topics[acceptedTopic] && typeof topics[acceptedTopic] === "object"
              ? topics[acceptedTopic]
              : {};
          const existingHistory = Array.isArray(existingTopicState.history)
            ? existingTopicState.history
            : [];

          topics[acceptedTopic] = {
            ...existingTopicState,
            topic: acceptedTopic,
            phase: acceptedPhase,
            stability: acceptedStability,
            lastUpdated: nowIso,
            observationNotes: "Auto-activated from accepted proposal after confirmed premium payment.",
            history: [
              ...existingHistory,
              {
                date: nowIso,
                phase: acceptedPhase,
                stability: acceptedStability,
                nextAction: NEXT_ACTION_ENGINE[acceptedPhase][acceptedStability].primaryAction,
                observationNotes: "Auto-activated from accepted proposal.",
              },
            ],
          };

          const mergedConceptMastery = {
            ...currentConceptMastery,
            topicConditioning: {
              ...topicConditioning,
              topic: acceptedTopic,
              entry_phase: acceptedPhase,
              stability: acceptedStability,
              lastUpdated: nowIso,
              topics,
            },
          };

          await client.query(
            `UPDATE public.students
                SET concept_mastery = $1::jsonb
              WHERE id = $2`,
            [JSON.stringify(mergedConceptMastery), proposal.student_id],
          );
        }
      }

      await client.query("COMMIT");

      await safeSendPush(
        proposal?.tutor_id,
        {
          title: "Proposal paid and accepted",
          body: "A parent completed monthly package payment. Continue with the scheduled session flow.",
          url: "/operational/tutor/pod",
          tag: `tutor-proposal-paid-${proposal.id}`,
        },
        "tutor premium payment completed",
      );

      return {
        status: "session_booked",
        parentCode,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("parent_enrollments")
    .select("id, status, current_step, proposal_id")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    throw new Error("Failed to resolve parent enrollment for paid transaction.");
  }

  const { data: proposal } = await supabase
    .from("onboarding_proposals")
    .select("id, accepted_at, parent_code, student_id, tutor_id, topic_conditioning_topic, topic_conditioning_entry_phase, topic_conditioning_stability, package_key, package_sessions, planned_sessions_per_week")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) {
    throw new Error("Failed to resolve onboarding proposal for paid transaction.");
  }

  if (proposal.accepted_at && proposal.parent_code && enrollment.status === "session_booked") {
    if (String(enrollment.current_step || "").trim().toLowerCase() !== "active_training") {
      const { error: repairStepError } = await supabase
        .from("parent_enrollments")
        .update({
          current_step: "active_training",
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id);

      if (repairStepError) {
        throw new Error("Failed to repair active training step after confirmed payment.");
      }
    }

    return {
      status: "session_booked",
      parentCode: proposal.parent_code,
    };
  }

  const generateParentCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  let parentCode = proposal.parent_code || generateParentCode();
  let codeIsUnique = !!proposal.parent_code;
  let attempts = 0;

  while (!codeIsUnique && attempts < 10) {
    const { data: existing } = await supabase
      .from("onboarding_proposals")
      .select("id")
      .eq("parent_code", parentCode)
      .neq("id", proposal.id)
      .maybeSingle();

    if (!existing) {
      codeIsUnique = true;
    } else {
      parentCode = generateParentCode();
      attempts++;
    }
  }

  const nowIso = new Date().toISOString();
  const servicePackage = getMonthlyServicePackage(proposal.package_key || transaction?.package_key);

  const { error: updateError } = await supabase
    .from("parent_enrollments")
    .update({
      status: "session_booked",
      current_step: "active_training",
      package_key: servicePackage.key,
      package_sessions: servicePackage.sessionsPerMonth,
      planned_sessions_per_week: servicePackage.plannedSessionsPerWeek,
      updated_at: nowIso,
    })
    .eq("id", enrollment.id);

  if (updateError) {
    throw new Error("Failed to unlock session flow after payment.");
  }

  await supabase
    .from("onboarding_proposals")
    .update({
      enrollment_id: enrollment.id,
      accepted_at: proposal.accepted_at || nowIso,
      parent_code: parentCode,
      updated_at: nowIso,
    })
    .eq("id", proposal.id);

  const acceptedTopic = String(proposal?.topic_conditioning_topic || "").trim();
  const acceptedPhase = tryParsePhase(proposal?.topic_conditioning_entry_phase) || "Clarity";
  const acceptedStability = normalizeStability(proposal?.topic_conditioning_stability || "Low");

  if (proposal?.student_id && proposal?.tutor_id && acceptedTopic) {
    const activationReason = [
      "Auto-activated from accepted proposal",
      `Phase ${acceptedPhase}`,
      `Stability ${acceptedStability}`,
    ].join(" | ");

    const { data: existingActivation } = await supabase
      .from("topic_conditioning_activations")
      .select("id")
      .eq("student_id", proposal.student_id)
      .eq("topic", acceptedTopic)
      .limit(1)
      .maybeSingle();

    if (!existingActivation) {
      const { error: activationInsertError } = await supabase
        .from("topic_conditioning_activations")
        .insert({
          student_id: proposal.student_id,
          tutor_id: proposal.tutor_id,
          topic: acceptedTopic,
          reason: activationReason,
        });

      if (activationInsertError) {
        console.error("Error auto-activating accepted proposal topic:", activationInsertError);
      }
    }

    const { data: studentForConcept } = await supabase
      .from("students")
      .select("id, concept_mastery")
      .eq("id", proposal.student_id)
      .maybeSingle();

    if (studentForConcept) {
      const currentConceptMastery =
        studentForConcept.concept_mastery && typeof studentForConcept.concept_mastery === "object"
          ? studentForConcept.concept_mastery
          : {};

      const topicConditioning =
        currentConceptMastery.topicConditioning && typeof currentConceptMastery.topicConditioning === "object"
          ? currentConceptMastery.topicConditioning
          : {};

      const topics =
        topicConditioning.topics && typeof topicConditioning.topics === "object"
          ? { ...topicConditioning.topics }
          : {};

      const key = acceptedTopic;
      const existingTopicState = topics[key] && typeof topics[key] === "object" ? topics[key] : {};
      const existingHistory = Array.isArray(existingTopicState.history) ? existingTopicState.history : [];

      topics[key] = {
        ...existingTopicState,
        topic: acceptedTopic,
        phase: acceptedPhase,
        stability: acceptedStability,
        lastUpdated: nowIso,
        observationNotes: "Auto-activated from accepted proposal after confirmed premium payment.",
        history: [
          ...existingHistory,
          {
            date: nowIso,
            phase: acceptedPhase,
            stability: acceptedStability,
            nextAction: NEXT_ACTION_ENGINE[acceptedPhase][acceptedStability].primaryAction,
            observationNotes: "Auto-activated from accepted proposal.",
          },
        ],
      };

      const mergedConceptMastery = {
        ...currentConceptMastery,
        topicConditioning: {
          ...topicConditioning,
          topic: acceptedTopic,
          entry_phase: acceptedPhase,
          stability: acceptedStability,
          lastUpdated: nowIso,
          topics,
        },
      };

      const { error: conceptUpdateError } = await supabase
        .from("students")
        .update({ concept_mastery: mergedConceptMastery })
        .eq("id", proposal.student_id);

      if (conceptUpdateError) {
        console.error("Error updating concept mastery after proposal acceptance:", conceptUpdateError);
      }
    }
  }

  const parentId = String(transaction.parent_id || "").trim();
  const lead = await storage.getCanonicalLeadByUser(parentId);

  if (lead && proposal?.student_id) {
    const { data: existingClose } = await supabase
      .from("closes")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("parent_id", parentId)
      .eq("child_id", proposal.student_id)
      .maybeSingle();

    if (!existingClose) {
      const { data: tutorAssignment } = await supabase
        .from("tutor_assignments")
        .select("id")
        .eq("tutor_id", proposal.tutor_id)
        .maybeSingle();

      const productionLink = lead.production_link_code
        ? await storage.getAffiliateByCode(lead.production_link_code)
        : null;
      const lineage = resolveProductionCloseLineage(lead, productionLink);
      const { error: closeError } = await supabase
        .from("closes")
        .insert({
          affiliate_id: lineage.affiliateId,
          production_link_code: lineage.productionLinkCode,
          production_owner_type: lineage.ownerType,
          production_owner_name: lineage.ownerName,
          parent_id: parentId,
          lead_id: lead.id,
          child_id: proposal.student_id,
          pod_assignment_id: tutorAssignment?.id || null,
          closed_at: nowIso,
        });

      if (closeError) {
        console.error("Error creating affiliate close:", closeError);
      }
    }
  }

  await safeSendPush(
    proposal?.tutor_id,
    {
      title: "Proposal paid and accepted",
      body: "A parent completed monthly package payment. Continue with the scheduled session flow.",
      url: "/operational/tutor/pod",
      tag: `tutor-proposal-paid-${proposal.id}`,
    },
    "tutor premium payment completed",
  );

  return {
    status: "session_booked",
    parentCode,
  };
}

async function getUserEmailName(userId?: string | null) {
  if (!userId) return null;
  const user = await storage.getUser(userId);
  if (!user) return null;
  return {
    email: user.email || null,
    displayName: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
  };
}

async function syncMeetForScheduledSession(session: any, options?: { studentName?: string | null }) {
  const tutorInfo = await getUserEmailName(session?.tutor_id);
  const parentInfo = await getUserEmailName(session?.parent_id);
  const studentName = String(options?.studentName || "Student").trim() || "Student";
  const summary = session?.type === "training"
    ? `Response Integrity Training Session - ${studentName}`
    : `Response Integrity Intro Session - ${studentName}`;
  const description = [
    `Response Integrity operational session`,
    `Kind: ${session?.type || "session"}`,
    `Scheduled session ID: ${session?.id}`,
  ].join("\n");

  const syncResult = await syncGoogleMeetEvent({
    scheduledSessionId: session.id,
    summary,
    description,
    startIso: new Date(session.scheduled_time).toISOString(),
    endIso: getScheduledSessionEndIso(session),
    timezone: getSessionTimezone(session),
    attendees: [tutorInfo, parentInfo],
    existingEventId: session?.google_event_id || null,
    tutorEmail: tutorInfo?.email || null,
  });

  if (syncResult.provider === "google_calendar") {
    const nextStatus = session?.status === "confirmed" ? "ready" : session?.status;
    const lastMeetSyncError = syncResult.meetConfigError || null;
    const { error } = await supabase
      .from("scheduled_sessions")
      .update({
        status: nextStatus,
        google_calendar_id: syncResult.googleCalendarId,
        google_event_id: syncResult.googleEventId,
        google_meet_url: syncResult.googleMeetUrl,
        google_conference_id: syncResult.googleConferenceId,
        google_meet_space_name: syncResult.googleMeetSpaceName,
        google_meet_code: syncResult.googleMeetCode,
        host_account_id: syncResult.hostAccountId,
        attendance_status: session?.attendance_status || "not_started",
        recording_status: syncResult.autoRecordingEnabled ? "expected" : "manual_start_required",
        transcript_status: syncResult.autoTranscriptionEnabled ? "expected" : "manual_start_required",
        cohost_sync_status: syncResult.tutorCohostStatus,
        cohost_sync_error: syncResult.tutorCohostError,
        last_meet_sync_error: lastMeetSyncError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (error) {
      console.error("Failed to persist Google Meet metadata:", error);
    }
  }

  return syncResult;
}

async function reconcileArtifactsForScheduledSession(session: any) {
  let artifactResult;
  try {
    artifactResult = await reconcileGoogleMeetArtifacts({
      googleMeetSpaceName: session?.google_meet_space_name || null,
      googleMeetCode: session?.google_meet_code || null,
    });
  } catch (error) {
    console.error("Failed to reconcile Google Meet artifacts:", error);
    artifactResult = {
      provider: "error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  if (artifactResult.provider === "google_meet_artifacts") {
    const recordingStatus = artifactResult.recordingFileId
      ? "stored"
      : String(session?.recording_status || "").toLowerCase() === "expected"
        ? "not_found_in_google"
        : session?.recording_status;
    const transcriptStatus = artifactResult.transcriptFileId
      ? "stored"
      : String(session?.transcript_status || "").toLowerCase() === "expected"
        ? "not_found_in_google"
        : session?.transcript_status;
    const { error } = await supabase
      .from("scheduled_sessions")
      .update({
        recording_file_id: artifactResult.recordingFileId,
        recording_detected_at: artifactResult.recordingDetectedAt,
        recording_status: recordingStatus,
        transcript_file_id: artifactResult.transcriptFileId,
        transcript_detected_at: artifactResult.transcriptDetectedAt,
        transcript_status: transcriptStatus,
        last_artifact_sync_at: artifactResult.artifactSyncAt,
        last_meet_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (error) {
      console.error("Failed to persist Meet artifact metadata:", error);
    }
  } else if (artifactResult.provider === "error") {
    await supabase
      .from("scheduled_sessions")
      .update({
        last_artifact_sync_at: new Date().toISOString(),
        last_meet_sync_error: artifactResult.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);
  }

  return artifactResult;
}

function getMeetSyncResponsePayload(syncResult: any) {
  if (!syncResult) {
    return {
      googleMeetSync: null,
      googleMeetError: null,
    };
  }

  return {
    googleMeetSync: syncResult.provider || null,
    googleMeetError:
      syncResult.provider === "error" || syncResult.provider === "disabled"
        ? syncResult.reason || "Google Meet sync failed."
        : syncResult.provider === "google_calendar"
          ? syncResult.meetConfigError || null
        : null,
  };
}

async function resolveTutorScheduledSession(
  tutorId: string,
  studentId: string,
  kind: "intro" | "handover" | "training",
  sessionId?: string | null
) {
  if (usesDirectProofSessionDatabase()) {
    const values: unknown[] = [tutorId, studentId, kind];
    let query = `SELECT ${SCHEDULED_SESSION_SELECT}
                   FROM public.scheduled_sessions
                  WHERE tutor_id = $1 AND student_id = $2 AND type = $3`;
    if (sessionId) {
      values.push(sessionId);
      query += ` AND id = $${values.length}`;
    }
    query += " ORDER BY scheduled_time DESC, created_at DESC";
    if (!sessionId) query += " LIMIT 20";
    const result = await pool.query(query, values);
    if (sessionId) return { session: result.rows[0] || null, error: null };
    const preferred = result.rows.find((row: any) => getSessionLaunchState(row, kind).isLive)
      || result.rows.find((row: any) => getSessionLaunchState(row, kind).isImminent)
      || result.rows[0]
      || null;
    return { session: preferred, error: null };
  }
  let query = supabase
    .from("scheduled_sessions")
    .select(SCHEDULED_SESSION_SELECT)
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .eq("type", kind)
    .order("scheduled_time", { ascending: false })
    .order("created_at", { ascending: false });

  if (sessionId) {
    query = query.eq("id", sessionId);
  }

  const scheduledSessionResult: any = sessionId ? await query.maybeSingle() : await query.limit(20);
  const { data, error } = scheduledSessionResult;
  if (error) {
    return { session: null, error };
  }

  if (sessionId) {
    return { session: data || null, error: null };
  }

  const rows = Array.isArray(data) ? data : [];
  const preferred =
    rows.find((row) => getSessionLaunchState(row, kind).isLive) ||
    rows.find((row) => getSessionLaunchState(row, kind).isImminent) ||
    rows[0] ||
    null;

  return { session: preferred, error: null };
}

async function getPendingTrainingConfirmationSession(tutorId: string, studentId: string) {
  if (usesDirectProofSessionDatabase()) {
    const result = await pool.query(
      `SELECT ${SCHEDULED_SESSION_SELECT}
         FROM public.scheduled_sessions
        WHERE tutor_id = $1 AND student_id = $2
          AND type = 'training'
          AND status = 'pending_parent_confirmation'
        ORDER BY scheduled_time ASC, created_at DESC
        LIMIT 1`,
      [tutorId, studentId],
    );
    return { session: result.rows[0] || null, error: null };
  }
  const pendingSessionResult: any = await supabase
    .from("scheduled_sessions")
    .select(SCHEDULED_SESSION_SELECT)
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .eq("type", "training")
    .eq("status", "pending_parent_confirmation")
    .order("scheduled_time", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = pendingSessionResult;

  return { session: data || null, error };
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/confidential-file", isAuthenticated,
    createConfidentialDownloadHandler({ query: (sql, values) => pool.query(sql, values), client: supabase, supabaseUrl: process.env.SUPABASE_URL || "" }));
  registerDemandProductionRoutes(app, { client: supabase, isAuthenticated, requireRole });

  app.post(
    "/api/proof/personas/provision",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      if (process.env.VERCEL_ENV !== "preview") {
        return res.status(404).json({ message: "Not found" });
      }

      try {
        const actor = (req as any).dbUser;
        const actorSandbox = await pool.query(
          `SELECT 1
             FROM public.tutor_assignments
            WHERE tutor_id = $1
              AND operational_mode = 'sandbox'
            LIMIT 1`,
          [actor.id],
        );
        if (!actorSandbox.rows[0]) {
          return res.status(403).json({ message: "Proof persona provisioning requires a Sandbox Specialist" });
        }

        const email = normalizeEmail(req.body?.email);
        const role = String(req.body?.role || "").trim().toLowerCase();
        const firstName = String(req.body?.firstName || "Proof").trim() || "Proof";
        const lastName = String(req.body?.lastName || role.toUpperCase()).trim() || role.toUpperCase();
        const password = String(req.body?.password || "");

        if (!email.endsWith("@proof.responseintegrity.co.za")) {
          return res.status(400).json({ message: "Proof personas must use the dedicated Proof identity domain" });
        }
        if (!["coo", "hr", "cto", "cmo", "td", "tutor"].includes(role)) {
          return res.status(400).json({ message: "Unsupported Proof persona role" });
        }
        if (password.length < 8) {
          return res.status(400).json({ message: "Proof persona password must be at least 8 characters" });
        }

        const existing = await pool.query<{ id: string }>(
          `SELECT id
             FROM public.users
            WHERE lower(email) = $1
            LIMIT 1`,
          [email],
        );
        const userId = existing.rows[0]?.id || uuidv4();
        const fullName = `${firstName} ${lastName}`.trim();

        const userResult = await pool.query(
          `INSERT INTO public.users (
             id, email, first_name, last_name, role, name, verified, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5::public.role, $6, TRUE, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE
             SET first_name = EXCLUDED.first_name,
                 last_name = EXCLUDED.last_name,
                 role = EXCLUDED.role,
                 name = EXCLUDED.name,
                 verified = TRUE,
                 updated_at = NOW()
           RETURNING id, email, first_name, last_name, role, name, verified`,
          [userId, email, firstName, lastName, role, fullName],
        );
        const user = userResult.rows[0];

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return res.status(503).json({
            message: "Proof persona Supabase Auth provisioning is unavailable",
          });
        }

        const authLookup = await supabase.auth.admin.getUserById(user.id);
        const authLookupMissing =
          !!authLookup.error &&
          (
            authLookup.error.status === 404 ||
            authLookup.error.code === "user_not_found" ||
            /not found/i.test(String(authLookup.error.message || ""))
          );

        if (authLookup.error && !authLookupMissing) {
          throw authLookup.error;
        }

        let authUser = authLookup.data?.user || null;

        if (authUser) {
          if (normalizeEmail(authUser.email || "") !== email) {
            throw new Error("Proof Auth identity ID is already bound to another email");
          }

          const updatedAuth = await supabase.auth.admin.updateUserById(user.id, {
            email,
            password,
            email_confirm: true,
            app_metadata: {
              ...(authUser.app_metadata || {}),
              proof_persona: true,
            },
            user_metadata: {
              ...(authUser.user_metadata || {}),
              first_name: firstName,
              last_name: lastName,
              name: fullName,
            },
          });

          if (updatedAuth.error || !updatedAuth.data.user) {
            throw updatedAuth.error || new Error("Failed to update Proof Supabase Auth identity");
          }

          authUser = updatedAuth.data.user;
        } else {
          const createdAuth = await supabase.auth.admin.createUser({
            id: user.id,
            email,
            password,
            email_confirm: true,
            app_metadata: {
              proof_persona: true,
            },
            user_metadata: {
              first_name: firstName,
              last_name: lastName,
              name: fullName,
            },
          });

          if (createdAuth.error || !createdAuth.data.user) {
            throw createdAuth.error || new Error("Failed to create Proof Supabase Auth identity");
          }

          authUser = createdAuth.data.user;
        }

        if (authUser.id !== user.id || normalizeEmail(authUser.email || "") !== email) {
          throw new Error("Proof Supabase Auth identity does not match canonical public user");
        }

        await setEmergencyCredentialForExistingUser(pool, user.id, password);

        if (role === "coo") {
          await pool.query(
            `INSERT INTO public.executive_role_appointments (
               role,
               appointed_user_id,
               appointed_by_user_id,
               notes,
               appointed_at,
               created_at,
               updated_at
             )
             VALUES (
               'coo'::public.executive_department,
               $1,
               $2,
               'Proof environment persistent COO control-plane persona',
               NOW(),
               NOW(),
               NOW()
             )
             ON CONFLICT (role) DO UPDATE
               SET appointed_user_id = EXCLUDED.appointed_user_id,
                   appointed_by_user_id = EXCLUDED.appointed_by_user_id,
                   notes = EXCLUDED.notes,
                   appointed_at = EXCLUDED.appointed_at,
                   updated_at = NOW()`,
            [user.id, actor.id],
          );
        }

        return res.json({
          user,
          appointedExecutiveRole: role === "coo" ? "coo" : null,
          credentialProvisioned: true,
          supabaseAuthProvisioned: true,
          authUserId: authUser.id,
        });
      } catch (error) {
        console.error("[PROOF] Failed to provision Proof persona", error);
        return res.status(500).json({ message: "Failed to provision Proof persona" });
      }
    },
  );

  app.post(
    "/api/proof/handover-fixture/reset",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      if (process.env.VERCEL_ENV !== "preview") {
        return res.status(404).json({ message: "Not found" });
      }

      try {
        const dbUser = (req as any).dbUser;
        const studentId = String(req.body?.studentId || "").trim();
        const requestedTopic = String(req.body?.topic || "").trim();
        const restoreCanonicalState = req.body?.restoreCanonicalState === true;
        const requestedRestorePhase = restoreCanonicalState
          ? tryParsePhase(req.body?.restorePhase)
          : null;
        const requestedRestoreStabilityRaw = restoreCanonicalState
          ? String(req.body?.restoreStability || "").trim()
          : "";
        const requestedRestoreStability =
          restoreCanonicalState &&
          ["Low", "Medium", "High", "High Maintenance"].includes(requestedRestoreStabilityRaw)
            ? (requestedRestoreStabilityRaw as TopicStability)
            : null;

        if (!studentId) {
          return res.status(400).json({ message: "studentId is required" });
        }

        const result = await pool.query(
          `SELECT s.id,
                  s.name,
                  s.tutor_id,
                  s.parent_id,
                  s.parent_enrollment_id,
                  s.personal_profile,
                  s.concept_mastery,
                  e.id AS enrollment_id,
                  e.is_sandbox_account,
                  e.assignment_lane
             FROM public.students s
             LEFT JOIN public.parent_enrollments e
               ON e.id = s.parent_enrollment_id
            WHERE s.id = $1
              AND s.tutor_id = $2
            LIMIT 1`,
          [studentId, dbUser.id],
        );

        const row = result.rows[0] || null;
        if (!row) {
          return res.status(404).json({ message: "Proof student not found for this Specialist" });
        }

        const isSandbox =
          row.is_sandbox_account === true ||
          String(row.assignment_lane || "").trim().toLowerCase() === "sandbox";
        if (!isSandbox) {
          return res.status(403).json({ message: "Proof Handover fixtures are limited to Sandbox students" });
        }

        const conceptMastery =
          row.concept_mastery && typeof row.concept_mastery === "object"
            ? row.concept_mastery
            : {};
        const topicStore =
          conceptMastery.topicConditioning && typeof conceptMastery.topicConditioning === "object"
            ? conceptMastery.topicConditioning
            : {};
        const topic = requestedTopic || String(topicStore.topic || "").trim();
        const topicState =
          topic &&
          topicStore.topics &&
          typeof topicStore.topics === "object" &&
          topicStore.topics[topic] &&
          typeof topicStore.topics[topic] === "object"
            ? topicStore.topics[topic]
            : null;
        const phase = tryParsePhase(topicState?.phase || topicStore.entry_phase || topicStore.entryPhase);
        const stability = normalizeStability(topicState?.stability || topicStore.stability || "Low");

        if (!topic || !phase || !topicState) {
          return res.status(400).json({
            message: "Sandbox student needs a canonical topic state before Handover proof can reset",
          });
        }
        if (restoreCanonicalState && (!requestedRestorePhase || !requestedRestoreStability)) {
          return res.status(400).json({
            message: "restorePhase and restoreStability must be valid when restoreCanonicalState is enabled",
          });
        }

        const nowIso = new Date().toISOString();
        let effectivePhase = phase;
        let effectiveStability = stability;
        let updatedConceptMastery = conceptMastery;

        if (restoreCanonicalState && requestedRestorePhase && requestedRestoreStability) {
          const nextActionConfig =
            (NEXT_ACTION_ENGINE as any)?.[requestedRestorePhase]?.[requestedRestoreStability] || null;
          const restoredTopicState = {
            ...topicState,
            phase: requestedRestorePhase,
            stability: requestedRestoreStability,
            lastUpdated: nowIso,
            nextAction: nextActionConfig?.primaryAction || topicState.nextAction || null,
            requiresTargetedRediagnosis: false,
            targetedRediagnosisStartPhase: null,
            prerequisiteContradictionReason: null,
            prerequisiteContradictionStatus: null,
            history: [
              ...(Array.isArray(topicState.history) ? topicState.history : []),
              {
                date: nowIso,
                phase: requestedRestorePhase,
                stability: requestedRestoreStability,
                nextAction: nextActionConfig?.primaryAction || topicState.nextAction || null,
                observationNotes: "Proof fixture reset to canonical Handover baseline.",
                structuredObservation: {
                  drillType: "proof_fixture_reset",
                  decisionAuthority: "proof_fixture",
                  purpose: "repeatable_handover_live_proof",
                },
              },
            ].slice(-60),
          };
          const restoredTopics = {
            ...(topicStore.topics && typeof topicStore.topics === "object"
              ? topicStore.topics
              : {}),
            [topic]: restoredTopicState,
          };
          const restoredTopicConditioning = {
            ...topicStore,
            topics: restoredTopics,
            lastUpdatedAt: nowIso,
          };
          updatedConceptMastery = {
            ...conceptMastery,
            topicConditioning: restoredTopicConditioning,
          };
          effectivePhase = requestedRestorePhase;
          effectiveStability = requestedRestoreStability;
        }
        const existingProfile =
          row.personal_profile && typeof row.personal_profile === "object"
            ? row.personal_profile
            : {};
        const updatedProfile = {
          ...existingProfile,
          workflow: {
            ...(existingProfile.workflow || {}),
            handoverRequiredAt: nowIso,
            handoverCompletedAt: null,
          },
        };

        await pool.query(
          `UPDATE public.students
              SET personal_profile = $2::jsonb,
                  concept_mastery = $3::jsonb,
                  updated_at = NOW()
            WHERE id = $1`,
          [studentId, JSON.stringify(updatedProfile), JSON.stringify(updatedConceptMastery)],
        );

        if (row.enrollment_id) {
          await pool.query(
            `UPDATE public.parent_enrollments
                SET current_step = 'handover_session_booked',
                    updated_at = NOW()
              WHERE id = $1`,
            [row.enrollment_id],
          );
        }

        const sessionResult = await pool.query(
          `INSERT INTO public.scheduled_sessions (
              parent_id,
              tutor_id,
              student_id,
              scheduled_time,
              scheduled_end,
              timezone,
              type,
              status,
              parent_confirmed,
              tutor_confirmed,
              workflow_stage,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3::uuid,
              NOW(),
              NOW() + INTERVAL '60 minutes',
              'Africa/Johannesburg',
              'handover',
              'confirmed',
              TRUE,
              TRUE,
              'handover_verification',
              NOW(),
              NOW()
            )
            RETURNING id, student_id, tutor_id, type, status, scheduled_time`,
          [String(row.parent_id || ""), String(dbUser.id), studentId],
        );

        const session = sessionResult.rows[0];
        return res.json({
          studentId,
          studentName: row.name,
          topic,
          phase: effectivePhase,
          stability: effectiveStability,
          restoredCanonicalState: restoreCanonicalState,
          handoverRequiredAt: nowIso,
          session,
        });
      } catch (error) {
        console.error("[PROOF] Failed to reset Handover fixture", error);
        return res.status(500).json({ message: "Failed to reset Proof Handover fixture" });
      }
    },
  );

  app.post(
    "/api/proof/training-fixture/reset",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      if (process.env.VERCEL_ENV !== "preview") {
        return res.status(404).json({ message: "Not found" });
      }

      try {
        const dbUser = (req as any).dbUser;
        const studentId = String(req.body?.studentId || "").trim();
        const requestedTopic = String(req.body?.topic || "").trim();
        const requestedRestorePhase = tryParsePhase(req.body?.restorePhase);
        const requestedRestoreStabilityRaw = String(req.body?.restoreStability || "").trim();
        const requestedRestoreStability =
          ["Low", "Medium", "High", "High Maintenance"].includes(requestedRestoreStabilityRaw)
            ? (requestedRestoreStabilityRaw as TopicStability)
            : null;
        const requestedRequiresTargetedRediagnosis = req.body?.requiresTargetedRediagnosis === true;
        const requestedTargetedRediagnosisStartPhase = requestedRequiresTargetedRediagnosis
          ? tryParsePhase(req.body?.targetedRediagnosisStartPhase) || requestedRestorePhase
          : null;

        if (!studentId || !requestedTopic || !requestedRestorePhase || !requestedRestoreStability) {
          return res.status(400).json({
            message: "studentId, topic, restorePhase and restoreStability are required",
          });
        }

        const result = await pool.query(
          `SELECT s.id,
                  s.name,
                  s.tutor_id,
                  s.parent_id,
                  s.personal_profile,
                  s.concept_mastery,
                  e.id AS enrollment_id,
                  e.is_sandbox_account,
                  e.assignment_lane
             FROM public.students s
             LEFT JOIN public.parent_enrollments e
               ON e.id = s.parent_enrollment_id
            WHERE s.id = $1
              AND s.tutor_id = $2
            LIMIT 1`,
          [studentId, dbUser.id],
        );

        const row = result.rows[0] || null;
        if (!row) {
          return res.status(404).json({ message: "Proof student not found for this Specialist" });
        }

        const isSandbox =
          row.is_sandbox_account === true ||
          String(row.assignment_lane || "").trim().toLowerCase() === "sandbox";
        if (!isSandbox) {
          return res.status(403).json({ message: "Proof Training fixtures are limited to Sandbox students" });
        }

        const conceptMastery =
          row.concept_mastery && typeof row.concept_mastery === "object"
            ? row.concept_mastery
            : {};
        const topicStore =
          conceptMastery.topicConditioning && typeof conceptMastery.topicConditioning === "object"
            ? conceptMastery.topicConditioning
            : {};
        const existingTopics =
          topicStore.topics && typeof topicStore.topics === "object"
            ? topicStore.topics
            : {};
        const topicKey =
          Object.keys(existingTopics).find(
            (key) => key.trim().toLowerCase() === requestedTopic.toLowerCase(),
          ) || requestedTopic;
        const topicState =
          existingTopics[topicKey] && typeof existingTopics[topicKey] === "object"
            ? existingTopics[topicKey]
            : null;

        if (!topicState) {
          return res.status(400).json({
            message: "Sandbox student needs a canonical topic state before Training proof can reset",
          });
        }

        const nowIso = new Date().toISOString();
        const nextActionConfig =
          (NEXT_ACTION_ENGINE as any)?.[requestedRestorePhase]?.[requestedRestoreStability] || null;
        const restoredTopicState = {
          ...topicState,
          topic: topicKey,
          phase: requestedRestorePhase,
          stability: requestedRestoreStability,
          lastUpdated: nowIso,
          nextAction: nextActionConfig?.primaryAction || topicState.nextAction || null,
          requiresTargetedRediagnosis: requestedRequiresTargetedRediagnosis,
          targetedRediagnosisStartPhase: requestedRequiresTargetedRediagnosis
            ? requestedTargetedRediagnosisStartPhase
            : null,
          prerequisiteContradictionReason: requestedRequiresTargetedRediagnosis
            ? "Proof fixture seeded targeted re-diagnosis gate."
            : null,
          prerequisiteContradictionStatus: requestedRequiresTargetedRediagnosis ? "confirmed" : null,
          history: [
            ...(Array.isArray(topicState.history) ? topicState.history : []),
            {
              date: nowIso,
              phase: requestedRestorePhase,
              stability: requestedRestoreStability,
              nextAction: nextActionConfig?.primaryAction || topicState.nextAction || null,
              observationNotes: "Proof fixture reset to canonical Training baseline.",
              structuredObservation: {
                drillType: "proof_fixture_reset",
                decisionAuthority: "proof_fixture",
                purpose: "repeatable_training_live_proof",
              },
            },
          ].slice(-60),
        };
        const restoredTopicConditioning = {
          ...topicStore,
          topics: {
            ...existingTopics,
            [topicKey]: restoredTopicState,
          },
          lastUpdatedAt: nowIso,
        };
        const updatedConceptMastery = {
          ...conceptMastery,
          topicConditioning: restoredTopicConditioning,
        };
        const existingProfile =
          row.personal_profile && typeof row.personal_profile === "object"
            ? row.personal_profile
            : {};
        const existingWorkflow =
          existingProfile.workflow && typeof existingProfile.workflow === "object"
            ? existingProfile.workflow
            : {};
        const updatedProfile = {
          ...existingProfile,
          workflow: {
            ...existingWorkflow,
            handoverCompletedAt: existingWorkflow.handoverRequiredAt
              ? existingWorkflow.handoverCompletedAt || nowIso
              : existingWorkflow.handoverCompletedAt || null,
          },
        };

        await pool.query(
          `UPDATE public.students
              SET concept_mastery = $2::jsonb,
                  personal_profile = $3::jsonb,
                  updated_at = NOW()
            WHERE id = $1`,
          [studentId, JSON.stringify(updatedConceptMastery), JSON.stringify(updatedProfile)],
        );

        if (row.enrollment_id) {
          await pool.query(
            `UPDATE public.parent_enrollments
                SET current_step = 'active_training',
                    updated_at = NOW()
              WHERE id = $1`,
            [row.enrollment_id],
          );
        }

        const primaryResult = await pool.query(
          `INSERT INTO public.scheduled_sessions (
              parent_id,
              tutor_id,
              student_id,
              scheduled_time,
              scheduled_end,
              timezone,
              type,
              status,
              parent_confirmed,
              tutor_confirmed,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3::uuid,
              NOW(),
              NOW() + INTERVAL '60 minutes',
              'Africa/Johannesburg',
              'training',
              'confirmed',
              TRUE,
              TRUE,
              NOW(),
              NOW()
            )
            RETURNING id, student_id, tutor_id, type, status, scheduled_time`,
          [String(row.parent_id || ""), String(dbUser.id), studentId],
        );

        const companionResult = await pool.query(
          `INSERT INTO public.scheduled_sessions (
              parent_id,
              tutor_id,
              student_id,
              scheduled_time,
              scheduled_end,
              timezone,
              type,
              status,
              parent_confirmed,
              tutor_confirmed,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3::uuid,
              NOW() + INTERVAL '2 hours',
              NOW() + INTERVAL '3 hours',
              'Africa/Johannesburg',
              'training',
              'confirmed',
              TRUE,
              TRUE,
              NOW(),
              NOW()
            )
            RETURNING id, student_id, tutor_id, type, status, scheduled_time`,
          [String(row.parent_id || ""), String(dbUser.id), studentId],
        );

        return res.json({
          studentId,
          studentName: row.name,
          topic: topicKey,
          phase: requestedRestorePhase,
          stability: requestedRestoreStability,
          restoredCanonicalState: true,
          session: primaryResult.rows[0],
          companionSession: companionResult.rows[0],
        });
      } catch (error) {
        console.error("[PROOF] Failed to reset Training fixture", error);
        return res.status(500).json({ message: "Failed to reset Proof Training fixture" });
      }
    },
  );

          const persistEvidenceLedgerShadow = async (input: EvidenceLedgerProjectionInput) => {
            const result = isEmergencyDbMode()
              ? await persistResponseIntegrityEvidenceLedgerShadowDirect(pool, input)
              : await persistResponseIntegrityEvidenceLedgerShadow(supabase as any, input);
            const logContext = {
              sourceDrillId: input.sourceDrillId,
              drillType: input.drillType,
              status: result.status,
              entryCount: result.entryCount,
              errorCode: result.errorCode || null,
              issues: result.issues || [],
            };
            if (result.status === "projection_invalid" || result.status === "persistence_failed") {
              console.warn("[RI_EVIDENCE_LEDGER_SHADOW] projection not persisted", logContext);
            } else {
              console.info("[RI_EVIDENCE_LEDGER_SHADOW] projection complete", logContext);
            }
            return result;
          };

          const persistTrainingShadowComparison = async (
            input: TrainingEvidenceShadowDatasetInput,
          ) => {
            const result = isEmergencyDbMode()
              ? await persistTrainingEvidenceShadowComparisonDirect(pool, input)
              : await persistTrainingEvidenceShadowComparison(supabase as any, input);
            if (result.status === "persistence_failed") {
              console.warn("[RI_TRAINING_EVIDENCE_SHADOW] comparison not persisted", {
                sourceDrillId: input.sourceDrillId,
                comparisonId: result.comparisonId,
                errorCode: result.errorCode || null,
                message: result.message || null,
              });
            } else {
              console.info("[RI_TRAINING_EVIDENCE_SHADOW] comparison persisted", {
                sourceDrillId: input.sourceDrillId,
                comparisonId: result.comparisonId,
              });
            }
            return result;
          };


          type NormalizedEvidenceSet = {
            setName: string;
            setId?: string;
            setOrder?: number;
            drillSchemaId?: string;
            drillSchemaVersion?: number;
            drillDefinitionHash?: string;
            constraintProfile?: Record<string, unknown> | null;
            observations: Array<Record<string, string>>;
          };

          const parseAuthoritativePhase = (value: unknown): TopicPhase | null => {
            return tryParsePhase(value);
          };

          const normalizeIntroDrillSets = (raw: any): NormalizedEvidenceSet[] => {
            if (Array.isArray(raw)) {
              return raw.map((set: any) => ({
                setName: String(set?.setName || "Set"),
                setId: String(set?.setId || "").trim() || undefined,
                setOrder: Number.isInteger(Number(set?.setOrder)) ? Number(set.setOrder) : undefined,
                drillSchemaId: String(set?.drillSchemaId || "").trim() || undefined,
                drillSchemaVersion: Number.isInteger(Number(set?.drillSchemaVersion))
                  ? Number(set.drillSchemaVersion)
                  : undefined,
                drillDefinitionHash: String(set?.drillDefinitionHash || "").trim() || undefined,
                constraintProfile:
                  set?.constraintProfile && typeof set.constraintProfile === "object"
                    ? set.constraintProfile
                    : null,
                observations: Array.isArray(set?.observations) ? set.observations : [],
              }));
            }
            if (raw && Array.isArray(raw.sets)) {
              return raw.sets.map((set: any) => ({
                setName: String(set?.setName || "Set"),
                setId: String(set?.setId || "").trim() || undefined,
                setOrder: Number.isInteger(Number(set?.setOrder)) ? Number(set.setOrder) : undefined,
                drillSchemaId: String(set?.drillSchemaId || "").trim() || undefined,
                drillSchemaVersion: Number.isInteger(Number(set?.drillSchemaVersion))
                  ? Number(set.drillSchemaVersion)
                  : undefined,
                drillDefinitionHash: String(set?.drillDefinitionHash || "").trim() || undefined,
                constraintProfile:
                  set?.constraintProfile && typeof set.constraintProfile === "object"
                    ? set.constraintProfile
                    : null,
                observations: Array.isArray(set?.observations) ? set.observations : [],
              }));
            }
            return [];
          };

          const normalizeAdaptiveDiagnosisBlocks = (
            raw: any
          ): Array<{
            phase: TopicPhase;
            setName: string;
            setId?: string;
            setOrder?: number;
            drillSchemaId?: string;
            drillSchemaVersion?: number;
            drillDefinitionHash?: string;
            constraintProfile?: Record<string, unknown> | null;
            observations: Array<Record<string, string>>;
          }> => {
            if (!Array.isArray(raw)) return [];

            return raw
              .map((block: any) => {
                const phase = parseAuthoritativePhase(block?.phase);
                if (!phase) return null;
                return {
                  phase,
                  setName: String(block?.setName || "Verification Block"),
                  setId: String(block?.setId || "").trim() || undefined,
                  setOrder: Number.isInteger(Number(block?.setOrder)) ? Number(block.setOrder) : undefined,
                  drillSchemaId: String(block?.drillSchemaId || "").trim() || undefined,
                  drillSchemaVersion: Number.isInteger(Number(block?.drillSchemaVersion))
                    ? Number(block.drillSchemaVersion)
                    : undefined,
                  drillDefinitionHash: String(block?.drillDefinitionHash || "").trim() || undefined,
                  constraintProfile:
                    block?.constraintProfile && typeof block.constraintProfile === "object"
                      ? block.constraintProfile
                      : null,
                  observations: Array.isArray(block?.observations) ? block.observations : [],
                };
              …162152 tokens truncated…toms),
            JSON.stringify(responseRecommendation.scores),
            JSON.stringify(topicSignalScores),
            responseRecommendation.phase,
            JSON.stringify(topicStartingPhases),
            previousTutoring,
            internetAccess,
            normalizedParentMotivation,
          ],
        );
        const enrollmentData = enrollmentResult.rows;
  
        res.json({
          message: "Enrollment submitted successfully",
          enrollment: enrollmentData?.[0],
        });
  
      } else {
        // Create enrollment record
        const { data: enrollmentData, error } = await supabase
          .from("parent_enrollments")
          .insert({
            user_id: userId,
            parent_full_name: parentFullName,
            parent_phone: parentPhone,
            parent_email: parentEmail,
            parent_city: parentCity,
            student_full_name: studentFullName,
            student_grade: studentGrade,
            student_gender: studentGender,
            school_name: schoolName,
            response_symptoms: effectiveResponseSymptoms,
            topic_response_symptoms: normalizedTopicResponseSymptoms,
            response_signal_scores: responseRecommendation.scores,
            topic_response_signal_scores: Object.fromEntries(
              Object.entries(topicResponseRecommendations).map(([topic, value]) => [topic, (value as any).scores])
            ),
            recommended_starting_phase: responseRecommendation.phase,
            topic_recommended_starting_phases: Object.fromEntries(
              Object.entries(topicResponseRecommendations).map(([topic, value]) => [
                topic,
                {
                  phase: (value as any).phase,
                  supportingSymptoms: (value as any).supportingSymptoms,
                  rationale: (value as any).rationale,
                },
              ])
            ),
            previous_tutoring: previousTutoring,
            internet_access: internetAccess,
            parent_motivation: normalizedParentMotivation,
            status: "awaiting_assignment",
            current_step: "qualification-pending",
            demand_flow_version: 1,
            qualification_status: "pending",
            created_at: new Date().toISOString(),
          })
          .select();
  
        if (error) {
          console.error("Failed to create parent enrollment:", error);
          return res.status(500).json({
            message: "Failed to save enrollment",
            detail: error.message,
          });
        }
  
        res.json({
          message: "Enrollment submitted successfully",
          enrollment: enrollmentData?.[0],
        });
  
      }
    } catch (error) {
      console.error("Error in enroll:", error);
      return res.status(500).json({
        message: "Failed to save enrollment",
      });
    }
  });

  // ========================================
  // ONBOARDING PROPOSAL ROUTES
  // ========================================

  // Create/Send proposal (Tutor)
  app.post("/api/tutor/proposal", isAuthenticated, requireRole(["tutor", "td", "hr", "coo", "ceo"]), async (req: Request, res: Response) => {
    try {
      const tutorId = (req as any).dbUser.id;
      const {
        studentId,
        enrollmentId,
        introDrillId,
        primaryIdentity,
        mathRelationship,
        confidenceTriggers,
        confidenceKillers,
        pressureResponse,
        growthDrivers,
        currentTopics,
        immediateStruggles,
        gapsIdentified,
        tutorNotes,
        topicConditioningTopic,
        topicConditioningEntryPhase,
        topicConditioningStability,
        futureIdentity,
        wantToRemembered,
        hiddenMotivations,
        internalConflict,
        recommendedPlan,
        justification,
        childWillWin,
        packageKey,
      } = req.body;

      // Validate required fields
      if (!studentId || !recommendedPlan || !justification) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (packageKey != null && !isMonthlyPackageKey(packageKey)) {
        return res.status(400).json({ message: "Choose a valid 8, 12, or 16-session monthly package." });
      }
      const servicePackage = getMonthlyServicePackage(packageKey || DEFAULT_MONTHLY_PACKAGE_KEY);

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      if (student?.tutorId && student.tutorId !== tutorId) {
        return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
      }

      const existingProfile = (student.personalProfile as any) || {};
      const workflow = existingProfile.workflow || {};
      const assignmentAccepted = !!workflow.assignmentAcceptedAt;
      if (!assignmentAccepted) {
        return res.status(403).json({ message: "Accept this assignment before sending a proposal." });
      }

      const { data: confirmedIntroSession, error: confirmedIntroSessionError } = await supabase
        .from("scheduled_sessions")
        .select("id, status, type, tutor_id, student_id, created_at")
        .eq("student_id", studentId)
        .eq("tutor_id", tutorId)
        .eq("type", "intro")
        .in("status", ["confirmed", "ready", "live", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (confirmedIntroSessionError) {
        console.error("Error validating confirmed intro session before proposal:", confirmedIntroSessionError);
        return res.status(500).json({ message: "Failed to validate confirmed intro session before proposal" });
      }

      if (!confirmedIntroSession) {
        return res.status(400).json({ message: "Confirm the intro session before sending a proposal." });
      }

      // Tie proposal generation to latest intro drill result for this tutor+student.
      const { data: latestIntroDrills, error: introDrillError } = await supabase
        .from("intro_session_drills")
        .select("id, drill, submitted_at, scheduled_session_id")
        .eq("student_id", studentId)
        .eq("tutor_id", tutorId)
        .order("submitted_at", { ascending: false })
        .limit(20);

      if (introDrillError) {
        console.error("Error fetching latest intro drill for proposal:", introDrillError);
        return res.status(500).json({ message: "Failed to validate intro drill before proposal" });
      }

      if (!latestIntroDrills || latestIntroDrills.length === 0) {
        return res.status(400).json({ message: "Complete intro drill before generating proposal" });
      }

      let latestIntroDrill: any = null;
      let parsedIntro: any = null;
      let fallbackIntroDiagnosis: any = null;
      let fallbackParsedIntro: any = null;
      for (const row of latestIntroDrills) {
        let parsed: any = null;
        try {
          parsed = typeof row.drill === "string" ? JSON.parse(row.drill) : row.drill;
        } catch {
          parsed = null;
        }
        const isDiagnosis = (parsed?.drillType || "diagnosis") === "diagnosis";
        const resolvedScheduledSessionId = String(
          row.scheduled_session_id || parsed?.scheduledSessionId || ""
        ).trim();
        const scheduledSessionMatch =
          resolvedScheduledSessionId === String(confirmedIntroSession.id);
        const sessionContextKind = String(parsed?.sessionContextKind || "intro").trim().toLowerCase();
        const isAcceptedProposalContext = sessionContextKind === "intro";
        const explicitDrillMatch = introDrillId && String(row.id) === String(introDrillId);
        const isLegacyDirectIntroContext =
          sessionContextKind === "training" &&
          !resolvedScheduledSessionId &&
          (
            explicitDrillMatch ||
            String((workflow as any)?.introCompletedAt || "").trim().length > 0
          );

        if (isDiagnosis && (isAcceptedProposalContext || isLegacyDirectIntroContext) && explicitDrillMatch) {
          latestIntroDrill = row;
          parsedIntro = parsed;
          break;
        }

        if (
          isDiagnosis &&
          scheduledSessionMatch &&
          (isAcceptedProposalContext || isLegacyDirectIntroContext)
        ) {
          latestIntroDrill = row;
          parsedIntro = parsed;
          break;
        }

        if (!fallbackIntroDiagnosis && isDiagnosis && (isAcceptedProposalContext || isLegacyDirectIntroContext)) {
          fallbackIntroDiagnosis = row;
          fallbackParsedIntro = parsed;
        }
      }

      if ((!latestIntroDrill || !parsedIntro) && fallbackIntroDiagnosis && fallbackParsedIntro) {
        latestIntroDrill = fallbackIntroDiagnosis;
        parsedIntro = fallbackParsedIntro;
      }

      if (!latestIntroDrill || !parsedIntro) {
        return res.status(400).json({
          message: "Complete the diagnosis drill from the confirmed intro session before generating proposal",
        });
      }

      let diagnosisFinalized = false;
      if (isEmergencyDbMode()) {
        const diagnosisRunResult = await pool.query(
          `SELECT id
             FROM public.response_integrity_diagnosis_runs
            WHERE id::text = $1
              AND student_id = $2
              AND tutor_id = $3
              AND status = 'completed'
              AND source_drill_id::text = id::text
            LIMIT 1`,
          [String(latestIntroDrill.id), studentId, tutorId],
        );
        diagnosisFinalized = !!diagnosisRunResult.rows[0];
      } else {
        const { data: completedDiagnosisRun, error: completedDiagnosisRunError } = await supabase
          .from("response_integrity_diagnosis_runs")
          .select("id, status, source_drill_id")
          .eq("id", String(latestIntroDrill.id))
          .eq("student_id", studentId)
          .eq("tutor_id", tutorId)
          .eq("status", "completed")
          .maybeSingle();

        if (completedDiagnosisRunError) {
          return res.status(500).json({ message: "Failed to validate diagnosis finalization before proposal" });
        }

        diagnosisFinalized =
          !!completedDiagnosisRun &&
          String(completedDiagnosisRun.source_drill_id || "") === String(completedDiagnosisRun.id || "");
      }

      if (!diagnosisFinalized) {
        return res.status(409).json({
          message: "Diagnosis finalization is incomplete. Reopen the intro drill and let the stored evidence finish processing before generating a proposal.",
        });
      }

      const introTopicFromDrill = String(parsedIntro?.introTopic || "").trim();
      const introSummary = parsedIntro?.summary || null;
      const drillPhase = normalizePhase(introSummary?.phase || parsedIntro?.phase || "Clarity");
      const drillStability = normalizeStability(introSummary?.stability || "Low");
      const trainingEntryPhase = deriveTrainingEntryPhase(drillPhase, drillStability);
      const drillNextAction = introSummary?.nextAction || NEXT_ACTION_ENGINE[drillPhase][drillStability].primaryAction;
      const drillConstraint = introSummary?.constraint || NEXT_ACTION_ENGINE[drillPhase][drillStability].rules[0] || null;

      if (!introTopicFromDrill) {
        return res.status(400).json({
          message: "Intro drill diagnostic topic is missing. Re-run intro session with Add Diagnostic Topic before generating proposal",
        });
      }

      const resolvedCurrentTopics = Array.from(
        new Set([
          ...(Array.isArray(currentTopics) ? currentTopics : []),
          introTopicFromDrill,
        ].map((item) => String(item || "").trim()).filter(Boolean))
      );

      const systemLinkedTutorNotes = [
        String(tutorNotes || "").trim(),
        "",
        "[System Intro Drill Link]",
        `Intro Topic: ${introTopicFromDrill}`,
        `Diagnosis Phase: ${drillPhase}`,
        `Training Entry Phase: ${trainingEntryPhase}`,
        `Stability: ${drillStability}`,
        `Next Action: ${drillNextAction}`,
        drillConstraint ? `Constraint: ${drillConstraint}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      // Find the canonical enrollment record for this student+tutor
      const normalizedStudent = normalizeStudentRecord(student);
      let actualEnrollmentId =
        enrollmentId ||
        normalizedStudent?.parentEnrollmentId ||
        null;

      if (!actualEnrollmentId && normalizedStudent?.parentId) {
        const { data: enrollmentByParentAndTutor, error: parentTutorLookupError } = await supabase
          .from("parent_enrollments")
          .select("id, assigned_tutor_id, user_id, student_full_name, student_grade")
          .eq("user_id", normalizedStudent.parentId)
          .eq("assigned_tutor_id", tutorId)
          .order("updated_at", { ascending: false })
          .limit(5);

        if (parentTutorLookupError) {
          console.error("Error looking up enrollment by parent+tutor:", parentTutorLookupError);
          return res.status(500).json({ message: "Failed to resolve enrollment for proposal" });
        }

        const enrollmentRows = enrollmentByParentAndTutor || [];
        const exactNameMatch = enrollmentRows.find(
          (row: any) => String(row.student_full_name || "").trim() === String(normalizedStudent.name || student.name || "").trim()
        );
        const candidateEnrollment = exactNameMatch || enrollmentRows[0] || null;

        if (candidateEnrollment) {
          actualEnrollmentId = candidateEnrollment.id;
          try {
            await ensureStudentForEnrollment(candidateEnrollment, tutorId);
          } catch (error) {
            console.error("Failed to backfill canonical enrollment link for proposal:", error);
          }
        }
      }

      if (!actualEnrollmentId) {
        const { data: enrollmentByAssignedStudent, error: assignedStudentLookupError } = await supabase
          .from("parent_enrollments")
          .select("id, status, current_step, assigned_tutor_id, assigned_student_id, user_id")
          .eq("assigned_student_id", studentId)
          .eq("assigned_tutor_id", tutorId)
          .maybeSingle();

        if (
          assignedStudentLookupError &&
          !String(assignedStudentLookupError.message || "").includes("assigned_student_id")
        ) {
          console.error("Error looking up enrollment by assigned_student_id:", assignedStudentLookupError);
          return res.status(500).json({ message: "Failed to resolve enrollment for proposal" });
        }

        actualEnrollmentId = enrollmentByAssignedStudent?.id || null;
      }

      if (!actualEnrollmentId) {
        return res.status(400).json({
          message: "No canonical enrollment linked to this assigned student+tutor. Confirm assignment and intro flow before sending proposal.",
        });
      }

      // Create proposal
      // The student record can carry a stale enrollment link after reassignment.
      // Re-resolve it against the current tutor assignment before inserting so a
      // stale FK never turns into an opaque 500 from Supabase.
      const enrollmentValidationResult = actualEnrollmentId
        ? await pool.query(
            `SELECT id, assigned_tutor_id, student_full_name, user_id
               FROM public.parent_enrollments
              WHERE id = $1
                AND assigned_tutor_id = $2
              LIMIT 1`,
            [actualEnrollmentId, tutorId],
          )
        : { rows: [] };
      if (!enrollmentValidationResult.rows[0]) {
        const enrollmentLookupResult = normalizedStudent?.parentId
          ? await pool.query(
              `SELECT id, assigned_tutor_id, student_full_name, user_id
                 FROM public.parent_enrollments
                WHERE assigned_tutor_id = $1
                  AND user_id = $2
                ORDER BY updated_at DESC NULLS LAST
                LIMIT 1`,
              [tutorId, normalizedStudent.parentId],
            )
          : await pool.query(
              `SELECT id, assigned_tutor_id, student_full_name, user_id
                 FROM public.parent_enrollments
                WHERE assigned_tutor_id = $1
                  AND student_full_name = $2
                ORDER BY updated_at DESC NULLS LAST
                LIMIT 1`,
              [tutorId, String(normalizedStudent.name || student.name || "").trim()],
            );
        actualEnrollmentId = enrollmentLookupResult.rows[0]?.id || null;
      }
      if (!actualEnrollmentId) {
        return res.status(400).json({
          message: "No current parent enrollment is linked to this assigned student+tutor. Refresh the assignment and try again.",
        });
      }
      const currentTopicsText = resolvedCurrentTopics.join(", ");
      const { data: proposalData, error } = await supabase
        .from("onboarding_proposals")
        .insert({
          enrollment_id: actualEnrollmentId,
          tutor_id: tutorId,
          student_id: studentId,
          primary_identity: primaryIdentity,
          math_relationship: mathRelationship,
          confidence_triggers: confidenceTriggers,
          confidence_killers: confidenceKillers,
          pressure_response: pressureResponse,
          growth_drivers: growthDrivers,
          current_topics: currentTopicsText,
          topic_conditioning_topic: introTopicFromDrill,
          topic_conditioning_entry_phase: trainingEntryPhase,
          topic_conditioning_stability: drillStability,
          immediate_struggles: immediateStruggles,
          gaps_identified: gapsIdentified,
          tutor_notes: systemLinkedTutorNotes,
          future_identity: futureIdentity,
          want_to_remembered: wantToRemembered,
          hidden_motivations: hiddenMotivations,
          internal_conflict: internalConflict,
          recommended_plan: recommendedPlan,
          justification: justification,
          child_will_win: childWillWin,
          package_key: servicePackage.key,
          package_sessions: servicePackage.sessionsPerMonth,
          planned_sessions_per_week: servicePackage.plannedSessionsPerWeek,
          package_amount: servicePackage.amountZar,
          specialist_per_session_amount: SPECIALIST_SESSION_SHARE_ZAR,
          platform_per_session_amount: RESPONSE_INTEGRITY_SESSION_SHARE_ZAR,
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating proposal:", {
          code: (error as any)?.code || null,
          message: error.message,
          details: (error as any)?.details || null,
          hint: (error as any)?.hint || null,
        });
        return res.status(500).json({
          message: "Failed to create proposal",
          detail: error.message,
          code: (error as any)?.code || undefined,
        });
      }

      // Link the proposal to the canonical enrollment through the server-side
      // Postgres connection. The shared Supabase client can legitimately fall
      // back to the anon key in local/proof environments, where tutor RLS does
      // not permit parent_enrollments updates. Treating that zero-row update as
      // success leaves the workflow stuck on "Create & Send Proposal".
      const proposalSentAt = new Date().toISOString();
      const enrollmentUpdate = await pool.query(
        `UPDATE public.parent_enrollments
            SET status = 'proposal_sent',
                proposal_id = $1,
                proposal_sent_at = $2,
                updated_at = NOW()
          WHERE id = $3
            AND assigned_tutor_id = $4
          RETURNING id, user_id, status, proposal_id, proposal_sent_at`,
        [proposalData.id, proposalSentAt, actualEnrollmentId, tutorId],
      );
      const updatedEnrollment = enrollmentUpdate.rows[0] || null;

      if (!updatedEnrollment) {
        // Do not leave an orphan proposal if the enrollment transition did not happen.
        await pool.query(
          `DELETE FROM public.onboarding_proposals
            WHERE id = $1
              AND enrollment_id = $2`,
          [proposalData.id, actualEnrollmentId],
        );
        return res.status(409).json({
          message: "Proposal could not be linked to the active parent enrollment. Refresh the assignment and try again.",
        });
      }

      await safeSendPush(
        updatedEnrollment.user_id,
        {
          title: "Proposal ready",
          body: "Your tutor has sent a proposal. Open Response Integrity to review and respond.",
          url: "/client/parent/gateway",
          tag: `parent-proposal-sent-${proposalData.id}`,
        },
        "parent proposal sent",
      );

      res.json({
        message: "Proposal sent successfully",
        proposal: proposalData,
      });
    } catch (error) {
      console.error("Error in create proposal:", error);
      res.status(500).json({
        message: "Failed to create proposal",
        detail: error instanceof Error ? error.message : "Unexpected server error",
      });
    }
  });

  // Get proposal by ID (Parent or Tutor)
  app.get("/api/proposal/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const proposalId = req.params.id;
      const userId = (req as any).dbUser.id;
      const userRole = (req as any).dbUser.role;

      // Fetch proposal with enrollment and student info
      const { data: proposal, error } = await supabase
        .from("onboarding_proposals")
        .select(`
          *,
          enrollment:parent_enrollments(parent_id, student_full_name, student_grade),
          student:students(name, grade),
          tutor:users!onboarding_proposals_tutor_id_fkey(name, bio, phone, email)
        `)
        .eq("id", proposalId)
        .single();

      if (error || !proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }

      // Authorization: only the parent, tutor, or admin roles can view
      const isParent = userRole === "parent" && proposal.enrollment?.parent_id === userId;
      const isTutor = proposal.tutor_id === userId;
      const isAdmin = ["hr", "coo", "ceo", "td"].includes(userRole);

      if (!isParent && !isTutor && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to view this proposal" });
      }

      // Track view count for parents
      if (isParent) {
        await supabase
          .from("onboarding_proposals")
          .update({
            viewed_at: new Date().toISOString(),
            viewed_count: (proposal.viewed_count || 0) + 1,
          })
          .eq("id", proposalId);
      }

      res.json(proposal);
    } catch (error) {
      console.error("Error fetching proposal:", error);
      res.status(500).json({ message: "Failed to fetch proposal" });
    }
  });

  // Get parent's proposal (for gateway/dashboard)
  app.get("/api/parent/proposal", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;
      const requestedPackageKey = String(req.body?.packageKey || "").trim().toLowerCase();
      if (requestedPackageKey && !isMonthlyPackageKey(requestedPackageKey)) {
        return res.status(400).json({ message: "Choose a valid 8, 12, or 16-session monthly package." });
      }

      if (isEmergencyDbMode()) {
        const enrollmentResult = await pool.query(
          `SELECT * FROM public.parent_enrollments
            WHERE user_id = $1
            ORDER BY updated_at DESC
            LIMIT 1`,
          [parentId],
        );
        const enrollment = enrollmentResult.rows[0] || null;
        let proposal = null;
        if (enrollment?.proposal_id) {
          const proposalResult = await pool.query(
            "SELECT * FROM public.onboarding_proposals WHERE id = $1 LIMIT 1",
            [enrollment.proposal_id],
          );
          proposal = proposalResult.rows[0] || null;
        }
        if (!proposal && enrollment?.id) {
          const proposalResult = await pool.query(
            `SELECT * FROM public.onboarding_proposals
              WHERE enrollment_id = $1
              ORDER BY created_at DESC
              LIMIT 1`,
            [enrollment.id],
          );
          proposal = proposalResult.rows[0] || null;
        }
        if (!proposal) return res.status(404).json({ message: "Proposal not found" });

        const studentResult = proposal.student_id
          ? await pool.query("SELECT name, grade, concept_mastery, personal_profile FROM public.students WHERE id = $1 LIMIT 1", [proposal.student_id])
          : { rows: [] };
        const student = studentResult.rows[0] || null;
        const tutorResult = proposal.tutor_id
          ? await pool.query("SELECT email, name, bio, phone FROM public.users WHERE id = $1 LIMIT 1", [String(proposal.tutor_id)])
          : { rows: [] };
        const tutor = tutorResult.rows[0] || null;
        const topicConditioning = buildTopicConditioningMap(proposal);
        const reportedTopics = buildReportedTopics(
          enrollment.topic_response_symptoms,
          enrollment.reported_topics,
          enrollment.topic_recommended_starting_phases,
        );

        return res.json({
          id: proposal.id,
          primaryIdentity: proposal.primary_identity,
          mathRelationship: proposal.math_relationship,
          confidenceTriggers: proposal.confidence_triggers,
          confidenceKillers: proposal.confidence_killers,
          pressureResponse: proposal.pressure_response,
          growthDrivers: proposal.growth_drivers,
          reportedTopics,
          currentTopics: proposal.current_topics || reportedTopics.join(", "),
          topicConditioning,
          immediateStruggles: proposal.immediate_struggles,
          gapsIdentified: proposal.gaps_identified,
          tutorNotes: proposal.tutor_notes,
          futureIdentity: proposal.future_identity,
          wantToRemembered: proposal.want_to_remembered,
          hiddenMotivations: proposal.hidden_motivations,
          internalConflict: proposal.internal_conflict,
          recommendedPlan: proposal.recommended_plan,
          justification: proposal.justification,
          childWillWin: proposal.child_will_win,
          packageKey: getMonthlyServicePackage(proposal.package_key).key,
          packageSessions: getMonthlyServicePackage(proposal.package_key).sessionsPerMonth,
          plannedSessionsPerWeek: getMonthlyServicePackage(proposal.package_key).plannedSessionsPerWeek,
          packageAmount: getMonthlyServicePackage(proposal.package_key).amountZar,
          sessionPrice: SESSION_PRICE_ZAR,
          parentCode: proposal.parent_code,
          sentAt: proposal.sent_at,
          acceptedAt: proposal.accepted_at,
          createdAt: proposal.created_at,
          student: {
            name: student?.name || enrollment.student_full_name || "Your child",
            grade: student?.grade || enrollment.student_grade || "",
            gender: enrollment.student_gender || null,
          },
          tutor: tutor ? { name: tutor.name || tutor.email, email: tutor.email, bio: tutor.bio, phone: tutor.phone } : null,
          payment: null,
          onboardingType: null,
          freeSessionsRemaining: 0,
          isSandboxAccount: Boolean(enrollment?.is_sandbox_account),
        });
      }

      console.log("📋 Fetching proposal for parent:", parentId);

      const { data: enrollment, error: enrollmentError } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, proposal_id, status, student_full_name, student_grade, is_sandbox_account",
        preferPaidEnrollment: true,
      });

      const { data: enrollmentFull } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "student_gender, response_symptoms, topic_response_symptoms, topic_recommended_starting_phases",
        fallbackSelect: "response_symptoms, topic_response_symptoms, topic_recommended_starting_phases",
        preferPaidEnrollment: true,
      });

      console.log("📋 Enrollment data:", enrollment, "Error:", enrollmentError);

      if (enrollmentError) {
        console.error("Error fetching enrollment:", enrollmentError);
        return res.status(500).json({ message: "Failed to fetch enrollment" });
      }

      if (!enrollment) {
        console.log("No enrollment found for parent");
        return res.status(404).json({ message: "No enrollment found" });
      }

      if (!enrollment.proposal_id) {
        console.log("No proposal_id in enrollment");
        return res.status(404).json({ message: "No proposal found" });
      }

      // Get the proposal
      const { data: proposal, error } = await supabase
        .from("onboarding_proposals")
        .select("*")
        .eq("id", enrollment.proposal_id)
        .single();

      console.log("📋 Proposal data:", proposal, "Error:", error);

      if (error) {
        console.error("Error fetching proposal:", error);
        return res.status(500).json({ message: "Failed to fetch proposal", error: error.message });
      }

      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }

      // Get student info separately
      const { data: student } = await supabase
        .from("students")
        .select("name, grade, concept_mastery, personal_profile")
        .eq("id", proposal.student_id)
        .single();

      // Get tutor info separately
      const { data: tutor } = await supabase
        .from("auth.users")
        .select("id, email, user_metadata")
        .eq("id", proposal.tutor_id)
        .single();

      const normalizeTopicConditioningPhase = (value?: string | null) => {
        const v = String(value || "").toLowerCase();
        if (v.includes("clarity")) return "Clarity";
        if (v.includes("structured")) return "Structured Execution";
        if (v.includes("discomfort")) return "Controlled Discomfort";
        if (v.includes("time") || v.includes("pressure")) return "Time Pressure Stability";
        return "Clarity";
      };

      const normalizeTopicConditioningStability = (value?: string | null) => {
        const v = String(value || "").toLowerCase();
        if (v.includes("high maintenance")) return "High Maintenance";
        if (v.includes("high")) return "High";
        if (v.includes("medium")) return "Medium";
        return "Low";
      };

      const liveTopicConditioning = (() => {
        const conceptMastery =
          student?.concept_mastery && typeof student.concept_mastery === "object"
            ? student.concept_mastery
            : {};
        const topicConditioningStore =
          conceptMastery.topicConditioning && typeof conceptMastery.topicConditioning === "object"
            ? conceptMastery.topicConditioning
            : {};
        const topicsStore =
          topicConditioningStore.topics && typeof topicConditioningStore.topics === "object"
            ? topicConditioningStore.topics
            : {};

        const latestTopic = Object.entries(topicsStore as Record<string, any>)
          .map(([topicKey, entry]) => {
            const topic = String(topicKey || entry?.topic || "").trim();
            if (!topic) return null;

            const entryPhase = normalizeTopicConditioningPhase(
              entry?.phase || topicConditioningStore.entry_phase || "Clarity"
            );
            const entryStability = normalizeTopicConditioningStability(
              entry?.stability || topicConditioningStore.stability || "Low"
            );

            const normalizedHistory = Array.isArray(entry?.history)
              ? entry.history
                  .map((item: any) => ({
                    phase: normalizeTopicConditioningPhase(item?.phase || entryPhase),
                    stability: normalizeTopicConditioningStability(item?.stability || entryStability),
                    date: String(item?.date || "").trim(),
                  }))
                  .filter((item: any) => !!item.date)
                  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
              : [];

            const latest = normalizedHistory[normalizedHistory.length - 1] || {
              phase: entryPhase,
              stability: entryStability,
              date:
                String(
                  entry?.lastUpdated ||
                  entry?.lastUpdatedAt ||
                  topicConditioningStore.lastUpdated ||
                  topicConditioningStore.lastUpdatedAt ||
                  ""
                ).trim() || new Date().toISOString(),
            };

            return {
              topic,
              entryPhase: latest.phase,
              stability: latest.stability,
              lastUpdated: latest.date,
            };
          })
          .filter((item): item is NonNullable<typeof item> => !!item)
          .sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime())
          .pop();

        return latestTopic || null;
      })();

      const resolvedStudentGender =
        String(
          (student?.personal_profile &&
          typeof student.personal_profile === "object" &&
          ((student.personal_profile as any).gender || (student.personal_profile as any).pronouns)) ||
          enrollmentFull?.student_gender ||
          ""
        ).trim() || null;

      // Combine data and convert to camelCase
      const enrichedProposal = {
        id: proposal.id,
        primaryIdentity: proposal.primary_identity,
        mathRelationship: proposal.math_relationship,
        confidenceTriggers: proposal.confidence_triggers,
        confidenceKillers: proposal.confidence_killers,
        pressureResponse: proposal.pressure_response,
        growthDrivers: proposal.growth_drivers,
        reportedTopics: buildReportedTopics(
          enrollmentFull?.topic_response_symptoms,
          enrollmentFull?.reported_topics,
          enrollmentFull?.topic_recommended_starting_phases
        ),
        currentTopics: (proposal.current_topics && proposal.current_topics !== "Onboarding baseline diagnostic")
          ? proposal.current_topics
          : (
              buildReportedTopics(
                enrollmentFull?.topic_response_symptoms,
                enrollmentFull?.reported_topics,
                enrollmentFull?.topic_recommended_starting_phases
              ).join(", ") || proposal.current_topics
            ),
        topicConditioning:
          liveTopicConditioning ||
          buildTopicConditioningMap({
            ...proposal,
            current_topics: (proposal.current_topics && proposal.current_topics !== "Onboarding baseline diagnostic")
              ? proposal.current_topics
              : (
                  buildReportedTopics(
                    enrollmentFull?.topic_response_symptoms,
                    enrollmentFull?.reported_topics,
                    enrollmentFull?.topic_recommended_starting_phases
                  ).join(", ") || proposal.current_topics
                ),
          }),
        immediateStruggles: proposal.immediate_struggles,
        gapsIdentified: proposal.gaps_identified,
        tutorNotes: proposal.tutor_notes,
        futureIdentity: proposal.future_identity,
        wantToRemembered: proposal.want_to_remembered,
        hiddenMotivations: proposal.hidden_motivations,
        internalConflict: proposal.internal_conflict,
        recommendedPlan: proposal.recommended_plan,
        justification: proposal.justification,
        childWillWin: proposal.child_will_win,
        packageKey: getMonthlyServicePackage(proposal.package_key).key,
        packageSessions: getMonthlyServicePackage(proposal.package_key).sessionsPerMonth,
        plannedSessionsPerWeek: getMonthlyServicePackage(proposal.package_key).plannedSessionsPerWeek,
        packageAmount: getMonthlyServicePackage(proposal.package_key).amountZar,
        sessionPrice: SESSION_PRICE_ZAR,
        parentCode: proposal.parent_code,
        createdAt: proposal.created_at,
        student: {
          name: student?.name || enrollment?.student_full_name || "Your child",
          grade: student?.grade || enrollment?.student_grade || "",
          gender: resolvedStudentGender,
        },
        tutor: tutor ? {
          name: tutor.user_metadata?.name || tutor.email,
          email: tutor.email,
          bio: tutor.user_metadata?.bio,
          phone: tutor.user_metadata?.phone,
        } : null,
        payment: null as any,
      };

      const { data: latestPayment } = await getLatestPaymentForEnrollment(String(enrollment.id));
      const billingModel = await getParentBillingModel(parentId);
      const sessionProgress = proposal?.student_id
        ? await getCompletedSessionCountForStudent(String(proposal.student_id))
        : { count: 0, error: null as any };
      if (latestPayment) {
        enrichedProposal.payment = {
          provider: latestPayment.provider,
          status: String(latestPayment.payment_status || "").toUpperCase(),
          amount: Number(latestPayment.amount || 0),
          plan: latestPayment.plan,
          paymentDate: latestPayment.payment_date || latestPayment.paid_at || null,
        };
      } else if (billingModel.data.onboardingType === "pilot") {
        const pilotFreeSessionsRemaining = Math.max(0, 9 - (sessionProgress.count || 0));
        enrichedProposal.payment = {
          provider: "pilot",
          status: pilotFreeSessionsRemaining > 0 ? "FREE_ACCESS" : "UNPAID",
          amount: 0,
          plan: "Pilot",
          paymentDate: null,
        };
      }

      (enrichedProposal as any).onboardingType = billingModel.data.onboardingType;
      (enrichedProposal as any).freeSessionsRemaining =
        billingModel.data.onboardingType === "pilot"
          ? Math.max(0, 9 - (sessionProgress.count || 0))
          : 0;
      (enrichedProposal as any).isSandboxAccount = Boolean((enrollment as any)?.is_sandbox_account);

      // Track view
      await supabase
        .from("onboarding_proposals")
        .update({
          viewed_at: new Date().toISOString(),
          viewed_count: (proposal.viewed_count || 0) + 1,
        })
        .eq("id", proposal.id);

      console.log("📋 Returning enriched proposal");
      res.json(enrichedProposal);
    } catch (error) {
      console.error("Error fetching parent proposal:", error);
      res.status(500).json({ message: "Failed to fetch proposal" });
    }
  });

  // Accept proposal (Parent)
  app.post("/api/parent/proposal/accept", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;

      if (isEmergencyDbMode()) {
        let paymentEnrollmentResult = await pool.query(
          `SELECT id, user_id, status, proposal_id, student_full_name, current_step,
                  assigned_tutor_id, parent_email, is_sandbox_account
             FROM public.parent_enrollments
            WHERE user_id = $1
              AND status IN ('proposal_sent', 'session_booked')
              AND proposal_id IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT 1`,
          [parentId],
        );
        let paymentEnrollment = paymentEnrollmentResult.rows[0] || null;

        if (!paymentEnrollment) {
          const userResult = await pool.query(
            "SELECT email FROM public.users WHERE id = $1 LIMIT 1",
            [parentId],
          );
          const parentEmail = normalizeEmail(userResult.rows[0]?.email);
          if (parentEmail) {
            paymentEnrollmentResult = await pool.query(
              `SELECT id, user_id, status, proposal_id, student_full_name, current_step,
                      assigned_tutor_id, parent_email, is_sandbox_account
                 FROM public.parent_enrollments
                WHERE lower(parent_email) = $1
                  AND status IN ('proposal_sent', 'session_booked')
                  AND proposal_id IS NOT NULL
                ORDER BY updated_at DESC
                LIMIT 1`,
              [parentEmail],
            );
            paymentEnrollment = paymentEnrollmentResult.rows[0] || null;
          }
        }

        if (!paymentEnrollment?.proposal_id) {
          return res.status(404).json({ message: "No pending proposal found" });
        }

        const payfastSandboxForEnrollment = isSandboxPaymentEnrollment(paymentEnrollment);
        if (
          String(paymentEnrollment.status || "") === "session_booked" &&
          !payfastSandboxForEnrollment
        ) {
          return res.status(404).json({ message: "No pending proposal found" });
        }

        const billingResult = await pool.query(
          `SELECT onboarding_type, affiliate_code, affiliate_type
             FROM public.parents
            WHERE user_id = $1
            LIMIT 1`,
          [String(paymentEnrollment.user_id || parentId)],
        );
        const billingRow = billingResult.rows[0] || null;
        const onboardingType =
          String(billingRow?.onboarding_type || "").trim().toLowerCase() === "pilot"
            ? "pilot"
            : "commercial";

        if (onboardingType === "commercial" && !isMonthlyPackagePaymentReady(payfastSandboxForEnrollment)) {
          return res.status(500).json({ message: "PayFast is not configured on this deployment." });
        }

        const existingPaymentResult = await pool.query(
          `SELECT *
             FROM public.payment_transactions
            WHERE enrollment_id = $1
              AND provider = $2
            ORDER BY created_at DESC
            LIMIT 1`,
          [String(paymentEnrollment.id), PAYMENT_PROVIDER_PAYFAST],
        );
        const existingPayment = existingPaymentResult.rows[0] || null;

        if (String(existingPayment?.payment_status || "").toLowerCase() === "paid") {
          const finalized = await finalizeAcceptedProposalFromPayment(existingPayment);
          return res.json({
            message: "Monthly package payment already confirmed.",
            paymentStatus: "PAID",
            status: finalized.status,
            parentCode: finalized.parentCode,
          });
        }

        const paymentProposalResult = await pool.query(
          `SELECT id, student_id, tutor_id, package_key, package_sessions,
                  planned_sessions_per_week, package_amount
             FROM public.onboarding_proposals
            WHERE id = $1
            LIMIT 1`,
          [paymentEnrollment.proposal_id],
        );
        const paymentProposal = paymentProposalResult.rows[0] || null;

        if (!paymentProposal?.student_id || !paymentProposal?.tutor_id) {
          return res.status(400).json({ message: "Proposal is missing student or tutor linkage." });
        }

        const servicePackage = getMonthlyServicePackage(requestedPackageKey || paymentProposal.package_key);

        if (onboardingType === "pilot") {
          const finalizationSeed = existingPayment || {
            parent_id: String(paymentEnrollment.user_id || parentId),
            enrollment_id: paymentEnrollment.id,
            proposal_id: paymentProposal.id,
          };
          const finalized = await finalizeAcceptedProposalFromPayment(finalizationSeed);

          return res.json({
            message: "Pilot proposal accepted. Free access is active.",
            onboardingType: "pilot",
            paymentStatus: "FREE_ACCESS",
            status: finalized.status,
            parentCode: finalized.parentCode,
            freeSessionsRemaining: 9,
          });
        }

        const merchantReference = String(
          existingPayment?.merchant_reference || `response-integrity-package-${uuidv4()}`,
        );
        const payfastConfig = getPayfastConfig(payfastSandboxForEnrollment);
        const nowIso = new Date().toISOString();
        const paymentRawPayload = {
          ...(existingPayment?.raw_payload && typeof existingPayment.raw_payload === "object"
            ? existingPayment.raw_payload
            : {}),
          payfast_mode: payfastSandboxForEnrollment ? "sandbox" : "live",
          sandbox_checkout: payfastSandboxForEnrollment,
          package_key: servicePackage.key,
        };

        const savedPaymentResult = await pool.query(
          `INSERT INTO public.payment_transactions (
             parent_id, enrollment_id, proposal_id, student_id, tutor_id, provider,
             payment_status, plan, amount, currency, tutor_share, platform_share,
             package_key, package_sessions, planned_sessions_per_week, session_price,
             merchant_reference, item_name, item_description, raw_payload, created_at, updated_at
           )
           VALUES (
             $1,$2,$3,$4,$5,$6,
             'pending',$7,$8,'ZAR',$9,$10,
             $11,$12,$13,$14,
             $15,$16,$17,$18::jsonb,$19,$19
           )
           ON CONFLICT (merchant_reference)
           DO UPDATE SET
             parent_id = EXCLUDED.parent_id,
             enrollment_id = EXCLUDED.enrollment_id,
             proposal_id = EXCLUDED.proposal_id,
             student_id = EXCLUDED.student_id,
             tutor_id = EXCLUDED.tutor_id,
             provider = EXCLUDED.provider,
             payment_status = 'pending',
             plan = EXCLUDED.plan,
             amount = EXCLUDED.amount,
             currency = EXCLUDED.currency,
             tutor_share = EXCLUDED.tutor_share,
             platform_share = EXCLUDED.platform_share,
             package_key = EXCLUDED.package_key,
             package_sessions = EXCLUDED.package_sessions,
             planned_sessions_per_week = EXCLUDED.planned_sessions_per_week,
             session_price = EXCLUDED.session_price,
             item_name = EXCLUDED.item_name,
             item_description = EXCLUDED.item_description,
             raw_payload = EXCLUDED.raw_payload,
             updated_at = EXCLUDED.updated_at
           RETURNING *`,
          [
            String(paymentEnrollment.user_id || parentId),
            String(paymentEnrollment.id),
            String(paymentProposal.id),
            String(paymentProposal.student_id),
            String(paymentProposal.tutor_id),
            PAYMENT_PROVIDER_PAYFAST,
            servicePackage.label,
            servicePackage.amountZar.toFixed(2),
            servicePackage.specialistAllocationZar.toFixed(2),
            servicePackage.responseIntegrityAllocationZar.toFixed(2),
            servicePackage.key,
            servicePackage.sessionsPerMonth,
            servicePackage.plannedSessionsPerWeek,
            SESSION_PRICE_ZAR,
            merchantReference,
            servicePackage.label,
            buildPackagePaymentDescription(paymentEnrollment.student_full_name, servicePackage.key),
            JSON.stringify(paymentRawPayload),
            nowIso,
          ],
        );
        const savedPayment = savedPaymentResult.rows[0] || null;

        if (!savedPayment) {
          return res.status(500).json({ message: "Failed to prepare payment transaction" });
        }

        const payfastFields = payfastSandboxForEnrollment
          ? withPayfastSignature(
              {
                merchant_id: payfastConfig.merchantId,
                merchant_key: payfastConfig.merchantKey,
                return_url: buildPayfastSandboxReturnUrl(req, "return", merchantReference),
                cancel_url: buildPayfastSandboxReturnUrl(req, "cancelled", merchantReference),
                m_payment_id: merchantReference,
                amount: servicePackage.amountZar.toFixed(2),
                item_name: servicePackage.label,
              },
              payfastConfig.passphrase,
            )
          : withPayfastSignature(
              {
                merchant_id: payfastConfig.merchantId,
                merchant_key: payfastConfig.merchantKey,
                return_url: `${getAppBaseUrl()}/client/parent/gateway?payfast=return&merchantReference=${encodeURIComponent(merchantReference)}`,
                cancel_url: `${getAppBaseUrl()}/client/parent/gateway?payfast=cancelled&merchantReference=${encodeURIComponent(merchantReference)}`,
                notify_url: `${getApiPublicUrl()}/api/payments/payfast/notify`,
                name_first: String((req as any).dbUser?.firstName || "").trim(),
                name_last: String((req as any).dbUser?.lastName || "").trim(),
                email_address: resolvePayfastEmailAddress({
                  dbUserEmail: (req as any).dbUser?.email,
                  enrollmentEmail: paymentEnrollment.parent_email,
                  parentId: String(paymentEnrollment.user_id || parentId),
                  useSandbox: false,
                }),
                m_payment_id: merchantReference,
                amount: servicePackage.amountZar.toFixed(2),
                item_name: servicePackage.label,
                item_description: buildPackagePaymentDescription(paymentEnrollment.student_full_name, servicePackage.key),
                custom_str1: String(paymentEnrollment.id),
                custom_str2: String(paymentProposal.id),
                custom_str3: String(paymentProposal.student_id),
                custom_str4: String(paymentProposal.tutor_id),
                custom_str5: servicePackage.key,
              },
              payfastConfig.passphrase,
            );

        return res.json({
          message: "PayFast payment prepared.",
          onboardingType: "commercial",
          paymentStatus: "UNPAID",
          paymentProvider: PAYMENT_PROVIDER_PAYFAST,
          plan: servicePackage.label,
          packageKey: servicePackage.key,
          sessionsPerMonth: servicePackage.sessionsPerMonth,
          plannedSessionsPerWeek: servicePackage.plannedSessionsPerWeek,
          amount: servicePackage.amountZar,
          tutorShare: servicePackage.specialistAllocationZar,
          platformShare: servicePackage.responseIntegrityAllocationZar,
          ttShare: servicePackage.responseIntegrityAllocationZar,
          merchantReference,
          checkoutUrl: payfastConfig.processUrl,
          sandbox: payfastSandboxForEnrollment,
          formFields: payfastFields,
        });
      }

      const billingModel = await getParentBillingModel(parentId);
      if (billingModel.error) {
        return res.status(500).json({ message: "Failed to resolve onboarding type for billing." });
      }

      if (!billingModel.data.onboardingType || billingModel.data.onboardingType === "pending") {
        return res.status(409).json({ message: "Application review and entry selection must be completed before proposal acceptance." });
      }

      const { data: paymentEnrollment, error: paymentEnrollmentError } = await supabase
        .from("parent_enrollments")
        .select("id, status, proposal_id, student_full_name, current_step, assigned_tutor_id, parent_email, is_sandbox_account")
        .eq("user_id", parentId)
        .in("status", ["proposal_sent", "session_booked"])
        .not("proposal_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentEnrollmentError) {
        console.error("Error fetching pending enrollment for payment:", paymentEnrollmentError);
        return res.status(500).json({ message: "Failed to find pending proposal" });
      }

      if (!paymentEnrollment?.proposal_id) {
        return res.status(404).json({ message: "No pending proposal found" });
      }

      const payfastSandboxForEnrollment = isSandboxPaymentEnrollment(paymentEnrollment);
      if (
        String(paymentEnrollment.status || "") === "session_booked" &&
        !payfastSandboxForEnrollment
      ) {
        return res.status(404).json({ message: "No pending proposal found" });
      }
      if (billingModel.data.onboardingType === "commercial" && !isMonthlyPackagePaymentReady(payfastSandboxForEnrollment)) {
        return res.status(500).json({ message: "PayFast is not configured on this deployment." });
      }

      const { data: existingPayment, error: latestPaymentError } = await getLatestPaymentForEnrollment(paymentEnrollment.id);
      if (latestPaymentError) {
        console.error("Error fetching latest payment transaction:", latestPaymentError);
        return res.status(500).json({ message: "Failed to prepare payment" });
      }

      if (existingPayment?.payment_status === "paid") {
        const finalized = await finalizeAcceptedProposalFromPayment(existingPayment);
        return res.json({
          message: "Monthly package payment already confirmed.",
          paymentStatus: "PAID",
          status: finalized.status,
          parentCode: finalized.parentCode,
        });
      }

      const { data: paymentProposal } = await supabase
        .from("onboarding_proposals")
        .select("id, student_id, tutor_id, package_key, package_sessions, planned_sessions_per_week, package_amount")
        .eq("id", paymentEnrollment.proposal_id)
        .maybeSingle();

      if (!paymentProposal?.student_id || !paymentProposal?.tutor_id) {
        return res.status(400).json({ message: "Proposal is missing student or tutor linkage." });
      }
      const servicePackage = getMonthlyServicePackage(paymentProposal.package_key);

      if (billingModel.data.onboardingType === "pilot") {
        const finalizationSeed = existingPayment || {
          parent_id: parentId,
          enrollment_id: paymentEnrollment.id,
          proposal_id: paymentProposal.id,
        };
        const finalized = await finalizeAcceptedProposalFromPayment(finalizationSeed);
        const sessionProgress = await getCompletedSessionCountForStudent(String(paymentProposal.student_id));

        return res.json({
          message: "Pilot proposal accepted. Free access is active.",
          onboardingType: "pilot",
          paymentStatus: "FREE_ACCESS",
          status: finalized.status,
          parentCode: finalized.parentCode,
          freeSessionsRemaining: Math.max(0, 9 - (sessionProgress.count || 0)),
        });
      }

      const merchantReference = String(existingPayment?.merchant_reference || `response-integrity-package-${uuidv4()}`);
      const payfastConfig = getPayfastConfig(payfastSandboxForEnrollment);
      const nowIso = new Date().toISOString();
      const paymentRawPayload = {
        ...(existingPayment?.raw_payload && typeof existingPayment.raw_payload === "object" ? existingPayment.raw_payload : {}),
        payfast_mode: payfastSandboxForEnrollment ? "sandbox" : "live",
        sandbox_checkout: payfastSandboxForEnrollment,
        package_key: servicePackage.key,
      };
      const paymentRecord = existingPayment
        ? {
            id: existingPayment.id,
            parent_id: parentId,
            enrollment_id: paymentEnrollment.id,
            proposal_id: paymentProposal.id,
            student_id: paymentProposal.student_id,
            tutor_id: paymentProposal.tutor_id,
            provider: PAYMENT_PROVIDER_PAYFAST,
            payment_status: "pending",
            plan: servicePackage.label,
            amount: servicePackage.amountZar.toFixed(2),
            currency: "ZAR",
            tutor_share: servicePackage.specialistAllocationZar.toFixed(2),
            platform_share: servicePackage.responseIntegrityAllocationZar.toFixed(2),
            package_key: servicePackage.key,
            package_sessions: servicePackage.sessionsPerMonth,
            planned_sessions_per_week: servicePackage.plannedSessionsPerWeek,
            session_price: SESSION_PRICE_ZAR,
            merchant_reference: merchantReference,
            item_name: servicePackage.label,
            item_description: buildPackagePaymentDescription(paymentEnrollment.student_full_name, servicePackage.key),
            raw_payload: paymentRawPayload,
            updated_at: nowIso,
          }
        : {
            parent_id: parentId,
            enrollment_id: paymentEnrollment.id,
            proposal_id: paymentProposal.id,
            student_id: paymentProposal.student_id,
            tutor_id: paymentProposal.tutor_id,
            provider: PAYMENT_PROVIDER_PAYFAST,
            payment_status: "pending",
            plan: servicePackage.label,
            amount: servicePackage.amountZar.toFixed(2),
            currency: "ZAR",
            tutor_share: servicePackage.specialistAllocationZar.toFixed(2),
            platform_share: servicePackage.responseIntegrityAllocationZar.toFixed(2),
            package_key: servicePackage.key,
            package_sessions: servicePackage.sessionsPerMonth,
            planned_sessions_per_week: servicePackage.plannedSessionsPerWeek,
            session_price: SESSION_PRICE_ZAR,
            merchant_reference: merchantReference,
            item_name: servicePackage.label,
            item_description: buildPackagePaymentDescription(paymentEnrollment.student_full_name, servicePackage.key),
            raw_payload: paymentRawPayload,
            created_at: nowIso,
            updated_at: nowIso,
          };

      const { data: savedPayment, error: paymentSaveError } = await supabase
        .from("payment_transactions")
        .upsert(paymentRecord, { onConflict: "merchant_reference" })
        .select("*")
        .single();

      if (paymentSaveError || !savedPayment) {
        console.error("Error saving payment transaction:", paymentSaveError);
        return res.status(500).json({ message: "Failed to prepare payment transaction" });
      }

      const payfastFields = payfastSandboxForEnrollment
        ? withPayfastSignature(
            {
              merchant_id: payfastConfig.merchantId,
              merchant_key: payfastConfig.merchantKey,
              return_url: buildPayfastSandboxReturnUrl(req, "return", merchantReference),
              cancel_url: buildPayfastSandboxReturnUrl(req, "cancelled", merchantReference),
              m_payment_id: merchantReference,
              amount: servicePackage.amountZar.toFixed(2),
              item_name: servicePackage.label,
            },
            payfastConfig.passphrase,
          )
        : withPayfastSignature(
            {
              merchant_id: payfastConfig.merchantId,
              merchant_key: payfastConfig.merchantKey,
              return_url: `${getAppBaseUrl()}/client/parent/gateway?payfast=return&merchantReference=${encodeURIComponent(merchantReference)}`,
              cancel_url: `${getAppBaseUrl()}/client/parent/gateway?payfast=cancelled&merchantReference=${encodeURIComponent(merchantReference)}`,
              notify_url: `${getApiPublicUrl()}/api/payments/payfast/notify`,
              name_first: String((req as any).dbUser?.firstName || "").trim(),
              name_last: String((req as any).dbUser?.lastName || "").trim(),
              email_address: resolvePayfastEmailAddress({
                dbUserEmail: (req as any).dbUser?.email,
                enrollmentEmail: paymentEnrollment.parent_email,
                parentId,
                useSandbox: false,
              }),
              m_payment_id: merchantReference,
              amount: servicePackage.amountZar.toFixed(2),
              item_name: servicePackage.label,
              item_description: buildPackagePaymentDescription(paymentEnrollment.student_full_name, servicePackage.key),
              custom_str1: String(paymentEnrollment.id),
              custom_str2: String(paymentProposal.id),
              custom_str3: String(paymentProposal.student_id),
              custom_str4: String(paymentProposal.tutor_id),
              custom_str5: servicePackage.key,
            },
            payfastConfig.passphrase,
          );

      return res.json({
        message: "PayFast payment prepared.",
        onboardingType: "commercial",
        paymentStatus: "UNPAID",
        paymentProvider: PAYMENT_PROVIDER_PAYFAST,
        plan: servicePackage.label,
        packageKey: servicePackage.key,
        sessionsPerMonth: servicePackage.sessionsPerMonth,
        plannedSessionsPerWeek: servicePackage.plannedSessionsPerWeek,
        amount: servicePackage.amountZar,
        tutorShare: servicePackage.specialistAllocationZar,
        platformShare: servicePackage.responseIntegrityAllocationZar,
        ttShare: servicePackage.responseIntegrityAllocationZar,
        merchantReference,
        checkoutUrl: payfastConfig.processUrl,
        sandbox: payfastSandboxForEnrollment,
        formFields: payfastFields,
      });

      // Get latest pending proposal enrollment for this parent.
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("parent_enrollments")
        .select("id, status, proposal_id")
        .eq("user_id", parentId)
        .eq("status", "proposal_sent")
        .not("proposal_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (enrollmentError) {
        console.error("Error fetching pending enrollment for accept:", enrollmentError);
        return res.status(500).json({ message: "Failed to find pending proposal" });
      }

      if (!enrollment || !enrollment.proposal_id) {
        return res.status(404).json({ message: "No pending proposal found" });
      }

      // Get proposal details to get student and topic conditioning info
      const { data: proposal } = await supabase
        .from("onboarding_proposals")
        .select("student_id, tutor_id, package_key, topic_conditioning_topic, topic_conditioning_entry_phase, topic_conditioning_stability")
        .eq("id", enrollment.proposal_id)
        .maybeSingle();

      // Generate unique parent code (8 characters: letters and numbers)
      const generateParentCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar looking chars
        let code = '';
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      let parentCode = generateParentCode();
      let codeIsUnique = false;
      let attempts = 0;

      // Ensure code is unique
      while (!codeIsUnique && attempts < 10) {
        const { data: existing } = await supabase
          .from("onboarding_proposals")
          .select("id")
          .eq("parent_code", parentCode)
          .maybeSingle();
        
        if (!existing) {
          codeIsUnique = true;
        } else {
          parentCode = generateParentCode();
          attempts++;
        }
      }

      // Move to post-accept state so parent code and next-step UI unlock immediately.
      const { error: updateError } = await supabase
        .from("parent_enrollments")
        .update({
          status: "session_booked",
          package_key: getMonthlyServicePackage(requestedPackageKey || proposal?.package_key).key,
          package_sessions: getMonthlyServicePackage(requestedPackageKey || proposal?.package_key).sessionsPerMonth,
          planned_sessions_per_week: getMonthlyServicePackage(requestedPackageKey || proposal?.package_key).plannedSessionsPerWeek,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id);

      if (updateError) {
        console.error("Error accepting proposal:", updateError);
        return res.status(500).json({ message: "Failed to accept proposal" });
      }

      // Mark proposal as accepted and add parent code
      await supabase
        .from("onboarding_proposals")
        .update({
          enrollment_id: enrollment.id,
          accepted_at: new Date().toISOString(),
          parent_code: parentCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.proposal_id);

      // Auto-activate the proposal topic for Topic Management/Map only after parent accepts.
      const acceptedTopic = String(proposal?.topic_conditioning_topic || "").trim();
      const acceptedPhase = tryParsePhase(proposal?.topic_conditioning_entry_phase) || "Clarity";
      const acceptedStability = normalizeStability(proposal?.topic_conditioning_stability || "Low");

      if (proposal?.student_id && proposal?.tutor_id && acceptedTopic) {
        const activationReason = [
          "Auto-activated from accepted proposal",
          `Phase ${acceptedPhase}`,
          `Stability ${acceptedStability}`,
        ].join(" | ");

        const { data: existingActivation } = await supabase
          .from("topic_conditioning_activations")
          .select("id")
          .eq("student_id", proposal.student_id)
          .eq("topic", acceptedTopic)
          .limit(1)
          .maybeSingle();

        if (!existingActivation) {
          const { error: activationInsertError } = await supabase
            .from("topic_conditioning_activations")
            .insert({
              student_id: proposal.student_id,
              tutor_id: proposal.tutor_id,
              topic: acceptedTopic,
              reason: activationReason,
            });

          if (activationInsertError) {
            console.error("Error auto-activating accepted proposal topic:", activationInsertError);
          }
        }

        const { data: studentForConcept } = await supabase
          .from("students")
          .select("id, concept_mastery")
          .eq("id", proposal.student_id)
          .maybeSingle();

        if (studentForConcept) {
          const nowIso = new Date().toISOString();
          const currentConceptMastery =
            studentForConcept.concept_mastery && typeof studentForConcept.concept_mastery === "object"
              ? studentForConcept.concept_mastery
              : {};

          const topicConditioning =
            currentConceptMastery.topicConditioning && typeof currentConceptMastery.topicConditioning === "object"
              ? currentConceptMastery.topicConditioning
              : {};

          const topics =
            topicConditioning.topics && typeof topicConditioning.topics === "object"
              ? { ...topicConditioning.topics }
              : {};

          const key = acceptedTopic;
          const existingTopicState = topics[key] && typeof topics[key] === "object" ? topics[key] : {};
          const existingHistory = Array.isArray(existingTopicState.history) ? existingTopicState.history : [];

          topics[key] = {
            ...existingTopicState,
            topic: acceptedTopic,
            phase: acceptedPhase,
            stability: acceptedStability,
            lastUpdated: nowIso,
            observationNotes: "Auto-activated from accepted proposal after intro drill diagnosis.",
            history: [
              ...existingHistory,
              {
                date: nowIso,
                phase: acceptedPhase,
                stability: acceptedStability,
                nextAction: NEXT_ACTION_ENGINE[acceptedPhase][acceptedStability].primaryAction,
                observationNotes: "Auto-activated from accepted proposal.",
              },
            ],
          };

          const mergedConceptMastery = {
            ...currentConceptMastery,
            topicConditioning: {
              ...topicConditioning,
              topic: acceptedTopic,
              entry_phase: acceptedPhase,
              stability: acceptedStability,
              lastUpdated: nowIso,
              topics,
            },
          };

          const { error: conceptUpdateError } = await supabase
            .from("students")
            .update({ concept_mastery: mergedConceptMastery })
            .eq("id", proposal.student_id);

          if (conceptUpdateError) {
            console.error("Error updating concept mastery after proposal acceptance:", conceptUpdateError);
          }
        }
      }

      // Check if this parent came from an affiliate (has a lead record)
      const { data: lead } = await supabase
        .from("leads")
        .select("id, affiliate_id")
        .eq("user_id", parentId)
        .maybeSingle();

      if (lead && proposal?.student_id) {
        console.log("📊 Creating affiliate close record for lead:", lead.id);
        
        // Get tutor's assignment
        const { data: tutorAssignment } = await supabase
          .from("tutor_assignments")
          .select("id")
          .eq("tutor_id", proposal.tutor_id)
          .maybeSingle();

        // Create close record for affiliate
        const { error: closeError } = await supabase
          .from("closes")
          .insert({
            affiliate_id: lead.affiliate_id,
            parent_id: parentId,
            lead_id: lead.id,
            child_id: proposal.student_id,
            pod_assignment_id: tutorAssignment?.id || null,
            closed_at: new Date().toISOString(),
          });

        if (closeError) {
          console.error("Error creating affiliate close:", closeError);
          // Don't fail the whole request if close creation fails
        } else {
          console.log("✅ Affiliate close created successfully");
        }
      }

      await safeSendPush(
        proposal?.tutor_id,
        {
          title: "Proposal accepted",
          body: "A parent accepted your onboarding proposal. Continue with the scheduled session flow.",
          url: "/operational/tutor/pod",
          tag: `tutor-proposal-accepted-${enrollment.proposal_id}`,
        },
        "tutor proposal accepted",
      );

      res.json({ 
        message: "Proposal accepted successfully", 
        status: "session_booked",
        parentCode: parentCode 
      });
    } catch (error) {
      console.error("Error accepting proposal:", error);
      res.status(500).json({ message: "Failed to accept proposal" });
    }
  });

  app.post("/api/payments/payfast/notify", async (req: Request, res: Response) => {
    try {
      const payload = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const merchantReference = String(payload.m_payment_id || "").trim();

      if (!merchantReference) {
        return res.status(400).send("Missing m_payment_id");
      }

      const { data: transaction, error: transactionError } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("merchant_reference", merchantReference)
        .maybeSingle();

      if (transactionError || !transaction) {
        console.error("PayFast ITN transaction lookup failed:", transactionError);
        return res.status(404).send("Unknown transaction");
      }

      const transactionMode = await isSandboxPaymentTransaction(transaction);
      const payfastConfig = getPayfastConfig(transactionMode);
      const signatureValid = verifyPayfastSignature(payload as any, payfastConfig.passphrase);
      const merchantIdMatches =
        String(payload.merchant_id || "").trim() === payfastConfig.merchantId;
      const amountMatches =
        formatAmountForPayfast((payload as any).amount_gross || (payload as any).amount_fee || (payload as any).amount) ===
        formatAmountForPayfast(transaction.amount);
      const sandboxValidationAccepted = transactionMode && amountMatches;

      if ((!signatureValid || !merchantIdMatches || !amountMatches) && !sandboxValidationAccepted) {
        console.error("PayFast ITN validation failed:", {
          merchantReference,
          transactionMode,
          signatureValid,
          merchantIdMatches,
          amountMatches,
        });

        const existingRawPayload =
          transaction.raw_payload && typeof transaction.raw_payload === "object"
            ? transaction.raw_payload
            : {};

        await supabase
          .from("payment_transactions")
          .update({
            payment_status: "failed",
            raw_payload: {
              ...existingRawPayload,
              ...payload,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);

        return res.status(400).send("Invalid ITN");
      }

      const internalStatus = normalizePayfastPaymentStatus(payload.payment_status);
      const nowIso = new Date().toISOString();
      const existingRawPayload =
        transaction.raw_payload && typeof transaction.raw_payload === "object"
          ? transaction.raw_payload
          : {};
      const mergedPayload = {
        ...existingRawPayload,
        ...payload,
        payfast_mode: transactionMode ? "sandbox" : existingRawPayload.payfast_mode,
        sandbox_checkout: transactionMode ? true : existingRawPayload.sandbox_checkout,
        sandbox_validation_relaxed: sandboxValidationAccepted ? true : existingRawPayload.sandbox_validation_relaxed,
      };

      const { data: updatedTransaction, error: updateError } = await supabase
        .from("payment_transactions")
        .update({
          payment_status: internalStatus,
          payment_date: internalStatus === "paid" ? nowIso : transaction.payment_date,
          paid_at: internalStatus === "paid" ? nowIso : transaction.paid_at,
          cancelled_at: internalStatus === "cancelled" ? nowIso : transaction.cancelled_at,
          payfast_payment_id: String(payload.pf_payment_id || transaction.payfast_payment_id || "").trim() || null,
          raw_payload: mergedPayload,
          itn_received_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", transaction.id)
        .select("*")
        .single();

      if (updateError || !updatedTransaction) {
        console.error("PayFast ITN update failed:", updateError);
        return res.status(500).send("Failed to update transaction");
      }

      if (internalStatus === "paid") {
        await applyRenewalTransactionToMembershipMonth(updatedTransaction);
        if (!isRenewalPaymentTransaction(updatedTransaction)) {
          await finalizeAcceptedProposalFromPayment(updatedTransaction);
        }
      }

      return res.status(200).send("OK");
    } catch (error) {
      console.error("PayFast ITN error:", error);
      return res.status(500).send("ITN error");
    }
  });

  app.post("/api/parent/payments/payfast/sandbox-confirm", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = String((req as any).dbUser?.id || "").trim();
      if (!parentId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const merchantReference = String(req.body?.merchantReference || "").trim();

      if (isEmergencyDbMode()) {
        let canonicalParentId = parentId;
        let transactionResult = merchantReference
          ? await pool.query(
              `SELECT *
                 FROM public.payment_transactions
                WHERE parent_id = $1
                  AND provider = $2
                  AND merchant_reference = $3
                LIMIT 1`,
              [canonicalParentId, PAYMENT_PROVIDER_PAYFAST, merchantReference],
            )
          : await pool.query(
              `SELECT *
                 FROM public.payment_transactions
                WHERE parent_id = $1
                  AND provider = $2
                  AND payment_status = 'pending'
                ORDER BY created_at DESC
                LIMIT 1`,
              [canonicalParentId, PAYMENT_PROVIDER_PAYFAST],
            );

        let transaction = transactionResult.rows[0] || null;

        if (!transaction) {
          const userResult = await pool.query(
            "SELECT email FROM public.users WHERE id = $1 LIMIT 1",
            [parentId],
          );
          const parentEmail = normalizeEmail(userResult.rows[0]?.email);
          if (parentEmail) {
            const enrollmentResult = await pool.query(
              `SELECT user_id
                 FROM public.parent_enrollments
                WHERE lower(parent_email) = $1
                ORDER BY updated_at DESC
                LIMIT 1`,
              [parentEmail],
            );
            canonicalParentId = String(enrollmentResult.rows[0]?.user_id || parentId);
            transactionResult = merchantReference
              ? await pool.query(
                  `SELECT *
                     FROM public.payment_transactions
                    WHERE parent_id = $1
                      AND provider = $2
                      AND merchant_reference = $3
                    LIMIT 1`,
                  [canonicalParentId, PAYMENT_PROVIDER_PAYFAST, merchantReference],
                )
              : await pool.query(
                  `SELECT *
                     FROM public.payment_transactions
                    WHERE parent_id = $1
                      AND provider = $2
                      AND payment_status = 'pending'
                    ORDER BY created_at DESC
                    LIMIT 1`,
                  [canonicalParentId, PAYMENT_PROVIDER_PAYFAST],
                );
            transaction = transactionResult.rows[0] || null;
          }
        }

        if (!transaction) {
          return res.status(404).json({ message: "No pending sandbox PayFast payment found" });
        }

        let transactionSandboxMode =
          String(
            (transaction.raw_payload && typeof transaction.raw_payload === "object"
              ? transaction.raw_payload.payfast_mode
              : "") || ""
          ).trim().toLowerCase() === "sandbox";

        if (!transactionSandboxMode) {
          const enrollmentId = String(transaction.enrollment_id || "").trim();
          if (enrollmentId) {
            const linkedEnrollmentResult = await pool.query(
              `SELECT id, current_step, assigned_tutor_id, parent_email,
                      is_sandbox_account, student_full_name
                 FROM public.parent_enrollments
                WHERE id = $1
                LIMIT 1`,
              [enrollmentId],
            );
            transactionSandboxMode = isSandboxPaymentEnrollment(
              linkedEnrollmentResult.rows[0] || null,
            );
          }
        }

        if (!transactionSandboxMode) {
          return res.status(403).json({
            message: "Sandbox confirmation is only available for sandbox payment transactions.",
          });
        }

        if (String(transaction.payment_status || "").toLowerCase() === "paid") {
          if (isRenewalPaymentTransaction(transaction)) {
            const renewedMonth = await applyRenewalTransactionToMembershipMonth(transaction);
            if (!renewedMonth) {
              return res.status(500).json({ message: "Failed to activate sandbox renewal package" });
            }
            return res.json({
              message: "Sandbox renewal package activated.",
              paymentStatus: "PAID",
              membershipMonth: renewedMonth,
              sandbox: true,
            });
          }
          const finalized = await finalizeAcceptedProposalFromPayment(transaction);
          return res.json({
            message: "Sandbox PayFast payment already confirmed.",
            paymentStatus: "PAID",
            status: finalized.status,
            parentCode: finalized.parentCode,
            sandbox: true,
          });
        }

        if (!["pending", "failed", "cancelled"].includes(String(transaction.payment_status || "").toLowerCase())) {
          return res.status(409).json({
            message: `Sandbox payment cannot be confirmed from status ${transaction.payment_status}.`,
          });
        }

        if (isRenewalPaymentTransaction(transaction)) {
          const renewedMonth = await applyRenewalTransactionToMembershipMonth(transaction);
          if (!renewedMonth) {
            return res.status(500).json({ message: "Failed to activate sandbox renewal package" });
          }
          return res.json({
            message: "Sandbox renewal package activated.",
            paymentStatus: "PAID",
            membershipMonth: renewedMonth,
            sandbox: true,
          });
        }

        const nowIso = new Date().toISOString();
        const rawPayload =
          transaction.raw_payload && typeof transaction.raw_payload === "object"
            ? transaction.raw_payload
            : {};
        const mergedPayload = {
          ...rawPayload,
          payfast_mode: "sandbox",
          sandbox_checkout: true,
          sandbox_manual_confirmation: true,
          sandbox_manual_confirmation_at: nowIso,
        };

        const updatedResult = await pool.query(
          `UPDATE public.payment_transactions
              SET payment_status = 'paid',
                  payment_date = $1,
                  paid_at = $1,
                  itn_received_at = COALESCE(itn_received_at, $1),
                  raw_payload = $2::jsonb,
                  updated_at = $1
            WHERE id = $3
            RETURNING *`,
          [nowIso, JSON.stringify(mergedPayload), transaction.id],
        );
        const updatedTransaction = updatedResult.rows[0] || null;
        if (!updatedTransaction) {
          return res.status(500).json({ message: "Failed to confirm sandbox payment" });
        }

        const finalized = await finalizeAcceptedProposalFromPayment(updatedTransaction);
        return res.json({
          message: "Sandbox PayFast payment confirmed.",
          paymentStatus: "PAID",
          status: finalized.status,
          parentCode: finalized.parentCode,
          sandbox: true,
        });
      }
      let transactionQuery = supabase
        .from("payment_transactions")
        .select("*")
        .eq("parent_id", parentId)
        .eq("provider", PAYMENT_PROVIDER_PAYFAST);

      if (merchantReference) {
        transactionQuery = transactionQuery.eq("merchant_reference", merchantReference);
      } else {
        transactionQuery = transactionQuery
          .in("payment_status", ["pending"])
          .order("created_at", { ascending: false })
          .limit(1);
      }

      const { data: transaction, error: transactionError } = await transactionQuery.maybeSingle();

      if (transactionError) {
        console.error("Sandbox PayFast confirmation lookup failed:", transactionError);
        return res.status(500).json({ message: "Failed to look up sandbox payment" });
      }

      if (!transaction) {
        return res.status(404).json({ message: "No pending sandbox PayFast payment found" });
      }

      let transactionSandboxMode =
        String(
          (transaction.raw_payload && typeof transaction.raw_payload === "object"
            ? (transaction.raw_payload as Record<string, unknown>).payfast_mode
            : "") || ""
        ).trim().toLowerCase() === "sandbox";

      if (!transactionSandboxMode) {
        const enrollmentId = String(transaction.enrollment_id || "").trim();
        if (enrollmentId) {
          const { data: linkedEnrollment } = await supabase
            .from("parent_enrollments")
            .select("id, current_step, assigned_tutor_id, parent_email, is_sandbox_account, student_full_name")
            .eq("id", enrollmentId)
            .maybeSingle();

          transactionSandboxMode = isSandboxPaymentEnrollment(linkedEnrollment);
        }
      }

      if (!transactionSandboxMode) {
        return res.status(403).json({ message: "Sandbox confirmation is only available for sandbox payment transactions." });
      }

      if (transaction.payment_status === "paid") {
        await applyRenewalTransactionToMembershipMonth(transaction);
        if (!isRenewalPaymentTransaction(transaction)) {
          const finalized = await finalizeAcceptedProposalFromPayment(transaction);
          return res.json({
            message: "Sandbox PayFast payment already confirmed.",
            paymentStatus: "PAID",
            status: finalized.status,
            parentCode: finalized.parentCode,
            sandbox: true,
          });
        }

        return res.json({
          message: "Sandbox PayFast payment already confirmed.",
          paymentStatus: "PAID",
          sandbox: true,
        });
      }

      if (!["pending", "failed", "cancelled"].includes(String(transaction.payment_status || "").toLowerCase())) {
        return res.status(409).json({
          message: `Sandbox payment cannot be confirmed from status ${transaction.payment_status}.`,
        });
      }

      const nowIso = new Date().toISOString();
      const rawPayload =
        transaction.raw_payload && typeof transaction.raw_payload === "object"
          ? transaction.raw_payload
          : {};

      const mergedPayload = {
        ...rawPayload,
        payfast_mode: "sandbox",
        sandbox_checkout: true,
        sandbox_manual_confirmation: true,
        sandbox_manual_confirmation_at: nowIso,
      };

      const { data: updatedTransaction, error: updateError } = await supabase
        .from("payment_transactions")
        .update({
          payment_status: "paid",
          payment_date: nowIso,
          paid_at: nowIso,
          itn_received_at: transaction.itn_received_at || nowIso,
          raw_payload: mergedPayload,
          updated_at: nowIso,
        })
        .eq("id", transaction.id)
        .select("*")
        .single();

      if (updateError || !updatedTransaction) {
        console.error("Sandbox PayFast confirmation update failed:", updateError);
        return res.status(500).json({ message: "Failed to confirm sandbox payment" });
      }

      await applyRenewalTransactionToMembershipMonth(updatedTransaction);
      if (!isRenewalPaymentTransaction(updatedTransaction)) {
        const finalized = await finalizeAcceptedProposalFromPayment(updatedTransaction);
        return res.json({
          message: "Sandbox PayFast payment confirmed.",
          paymentStatus: "PAID",
          status: finalized.status,
          parentCode: finalized.parentCode,
          sandbox: true,
        });
      }

      return res.json({
        message: "Sandbox PayFast payment confirmed.",
        paymentStatus: "PAID",
        sandbox: true,
      });
    } catch (error) {
      console.error("Sandbox PayFast confirmation error:", error);
      return res.status(500).json({ message: "Failed to confirm sandbox payment" });
    }
  });

  // Generate student code for accepted proposal (Parent)
  app.post("/api/parent/generate-student-code", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;
      console.log("🎓 Generate student code request from parent:", parentId);

      // Get the latest enrollment that has a linked proposal.
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("parent_enrollments")
        .select("id, status, proposal_id")
        .eq("user_id", parentId)
        .not("proposal_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("📋 Enrollment:", enrollment, "Error:", enrollmentError);

      if (!enrollment || !enrollment.proposal_id) {
        console.log("❌ No proposal found for parent");
        return res.status(404).json({ message: "No proposal found" });
      }

      // Check if proposal is accepted
      const { data: proposal, error: proposalError } = await supabase
        .from("onboarding_proposals")
        .select("id, accepted_at, parent_code")
        .eq("id", enrollment.proposal_id)
        .single();

      console.log("📄 Proposal:", proposal, "Error:", proposalError);

      if (!proposal || !proposal.accepted_at) {
        console.log("❌ Proposal not yet accepted");
        return res.status(400).json({ message: "Proposal not yet accepted" });
      }

      // If code already exists, return it
      if (proposal.parent_code) {
        console.log("✅ Code already exists:", proposal.parent_code);
        return res.json({ parentCode: proposal.parent_code });
      }

      console.log("🎲 Generating new parent code...");

      // Generate unique parent code
      const generateParentCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      let parentCode = generateParentCode();
      let codeIsUnique = false;
      let attempts = 0;

      while (!codeIsUnique && attempts < 10) {
        const { data: existing } = await supabase
          .from("onboarding_proposals")
          .select("id")
          .eq("parent_code", parentCode)
          .maybeSingle();
        
        if (!existing) {
          codeIsUnique = true;
        } else {
          parentCode = generateParentCode();
          attempts++;
        }
      }

      console.log("🎲 Generated unique code:", parentCode);

      // Save code to proposal
      const { error: updateError } = await supabase
        .from("onboarding_proposals")
        .update({
          parent_code: parentCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);

      if (updateError) {
        console.error("❌ Error updating proposal with parent code:", updateError);
        return res.status(500).json({ message: "Failed to generate student code" });
      }

      console.log("✅ Successfully saved parent code to database");
      res.json({ parentCode: parentCode });
    } catch (error) {
      console.error("Error generating student code:", error);
      res.status(500).json({ message: "Failed to generate student code" });
    }
  });

  // Decline proposal (Parent)
  app.post("/api/parent/proposal/decline", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;
      const { reason } = req.body; // Optional decline reason

      // Get latest pending proposal enrollment for this parent.
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("parent_enrollments")
        .select("id, status, proposal_id")
        .eq("user_id", parentId)
        .eq("status", "proposal_sent")
        .not("proposal_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (enrollmentError) {
        console.error("Error fetching pending enrollment for decline:", enrollmentError);
        return res.status(500).json({ message: "Failed to find pending proposal" });
      }

      if (!enrollment || !enrollment.proposal_id) {
        return res.status(404).json({ message: "No pending proposal found" });
      }

      // Update enrollment status back to assigned (tutor can revise proposal)
      const { error: updateError } = await supabase
        .from("parent_enrollments")
        .update({
          status: "assigned", // Back to assigned - tutor needs to revise
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id);

      if (updateError) {
        console.error("Error declining proposal:", updateError);
        return res.status(500).json({ message: "Failed to decline proposal" });
      }

      const { data: declinedProposal } = await supabase
        .from("onboarding_proposals")
        .select("tutor_id")
        .eq("id", enrollment.proposal_id)
        .maybeSingle();

      // Mark proposal as declined
      await supabase
        .from("onboarding_proposals")
        .update({
          declined_at: new Date().toISOString(),
          decline_reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.proposal_id);

      await safeSendPush(
        declinedProposal?.tutor_id,
        {
          title: "Proposal declined",
          body: "A parent declined your onboarding proposal. Open Response Integrity to revise the next step.",
          url: "/operational/tutor/pod",
          tag: `tutor-proposal-declined-${enrollment.proposal_id}`,
        },
        "tutor proposal declined",
      );

      res.json({ message: "Proposal declined. Your tutor will be notified.", status: "assigned" });
    } catch (error) {
      console.error("Error declining proposal:", error);
      res.status(500).json({ message: "Failed to decline proposal" });
    }
  });

  // Monthly subscription renewal — creates a new PayFast checkout for the current month
  app.get("/api/parent/payment-history", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = String((req as any).dbUser.id || "").trim();
      if (isEmergencyDbMode()) {
        const result = await pool.query(
          `SELECT id, provider, merchant_reference, plan, amount, currency, payment_status, payment_date, paid_at, created_at, raw_payload
             FROM public.payment_transactions
            WHERE parent_id = $1
            ORDER BY created_at DESC
            LIMIT 50`,
          [parentId],
        );
        return res.json({
          payments: result.rows.map((payment: any) => {
            const rawPayload = payment?.raw_payload && typeof payment.raw_payload === "object"
              ? payment.raw_payload
              : {};
            return {
              id: payment.id,
              provider: payment.provider,
              reference: payment.merchant_reference,
              plan: payment.plan,
              amount: Number(payment.amount || 0),
              currency: payment.currency,
              status: String(payment.payment_status || "pending").toUpperCase(),
              type: rawPayload.renewal ? "Monthly renewal" : "Monthly package",
              paymentDate: payment.payment_date || payment.paid_at || payment.created_at,
              createdAt: payment.created_at,
            };
          }),
        });
      }
      const { data, error } = await supabase
        .from("payment_transactions")
        .select("id, provider, merchant_reference, plan, amount, currency, payment_status, payment_date, paid_at, created_at, raw_payload")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching parent payment history:", error);
        return res.status(500).json({ message: "Failed to fetch payment history" });
      }

      res.json({
        payments: (data || []).map((payment: any) => {
          const rawPayload = payment?.raw_payload && typeof payment.raw_payload === "object"
            ? payment.raw_payload
            : {};

          return {
            id: payment.id,
            provider: payment.provider,
            reference: payment.merchant_reference,
            plan: payment.plan,
            amount: Number(payment.amount || 0),
            currency: payment.currency,
            status: String(payment.payment_status || "pending").toUpperCase(),
            type: rawPayload.renewal ? "Monthly renewal" : "Monthly package",
            paymentDate: payment.payment_date || payment.paid_at || payment.created_at,
            createdAt: payment.created_at,
          };
        }),
      });
    } catch (error) {
      console.error("Exception fetching parent payment history:", error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  app.post("/api/parent/payments/renew", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;

      const { data: enrollment, error: enrollmentError } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, status, student_full_name, assigned_tutor_id, parent_email, is_sandbox_account, assigned_student_id, current_step, package_key, package_sessions, planned_sessions_per_week",
        fallbackSelect: "id, status, student_full_name, assigned_tutor_id, parent_email, is_sandbox_account, current_step, package_key, package_sessions, planned_sessions_per_week",
      });

      const activeStatuses = ["confirmed", "session_booked", "report_received"];
      if (enrollmentError || !enrollment || !activeStatuses.includes(enrollment.status)) {
        return res.status(404).json({ message: "No active enrollment found for renewal." });
      }

      const useSandbox = isSandboxPaymentEnrollment(enrollment);
      if (!isMonthlyPackagePaymentReady(useSandbox)) {
        return res.status(500).json({ message: "PayFast is not configured on this deployment." });
      }
      const servicePackage = getMonthlyServicePackage(enrollment.package_key);

      let monthKey = toMonthKey(getMonthStartIso(new Date().toISOString())!);
      const canonicalStudent = await resolveCanonicalStudentForEnrollment(enrollment);
      const studentId = canonicalStudent?.id || enrollment.assigned_student_id || null;
      const isSandboxContext = isSandboxPaymentEnrollment(enrollment);

      let monthlyQuota = null;
      if (studentId) {
        monthlyQuota = await getMonthlySessionQuotaSnapshot({
          parentId,
          studentId: String(studentId),
          isSandboxContext,
        });
      }

      if (monthlyQuota && Number(monthlyQuota.sessions_remaining || 0) > 0) {
        return res.status(409).json({
          message: `Your current ${servicePackage.sessionsPerMonth}-session monthly package is not complete yet. Renewal opens after all package sessions are used.`,
        });
      }

      if (useSandbox) {
        if (!monthlyQuota) {
          return res.status(409).json({
            message: "Sandbox package-cycle authority is unavailable. Renewal cannot create an unverified entitlement.",
          });
        }
        const nextCycleKey = nextSandboxCycleKey(monthlyQuota.month_key);
        if (!nextCycleKey) {
          return res.status(409).json({
            message: "Sandbox package-cycle lineage is invalid. Renewal remains blocked.",
          });
        }
        // Only an explicit paid Sandbox renewal advances the simulated cycle.
        // The calendar date has no authority over Sandbox package capacity.
        monthKey = nextCycleKey;
      }

      let existingRenewalPaymentQuery = supabase
        .from("payment_transactions")
        .select("*")
        .eq("parent_id", parentId)
        .eq("provider", PAYMENT_PROVIDER_PAYFAST)
        .eq("payment_status", "paid")
        .eq("enrollment_id", enrollment.id)
        .contains("raw_payload", { renewal: true, month_key: monthKey });

      const { data: existingRenewalPayment } = await existingRenewalPaymentQuery
        .limit(1)
        .maybeSingle();

      if (existingRenewalPayment) {
        await applyRenewalTransactionToMembershipMonth(existingRenewalPayment);
        return res.json({
          message: "This month's renewal payment has already been made.",
          paymentStatus: "PAID",
          alreadyPaid: true,
        });
      }

      const merchantReference = `response-integrity-renewal-${monthKey}-${uuidv4()}`;
      const payfastConfig = getPayfastConfig(useSandbox);
      const nowIso = new Date().toISOString();

      const { data: savedPayment, error: paymentSaveError } = await supabase
        .from("payment_transactions")
        .insert({
          parent_id: parentId,
          enrollment_id: enrollment.id,
          student_id: studentId,
          provider: PAYMENT_PROVIDER_PAYFAST,
          payment_status: "pending",
          plan: servicePackage.label,
          amount: servicePackage.amountZar.toFixed(2),
          currency: "ZAR",
          tutor_share: servicePackage.specialistAllocationZar.toFixed(2),
          platform_share: servicePackage.responseIntegrityAllocationZar.toFixed(2),
          package_key: servicePackage.key,
          package_sessions: servicePackage.sessionsPerMonth,
          planned_sessions_per_week: servicePackage.plannedSessionsPerWeek,
          session_price: SESSION_PRICE_ZAR,
          merchant_reference: merchantReference,
          item_name: `${servicePackage.label} Renewal`,
          item_description: buildPackagePaymentDescription(enrollment.student_full_name, servicePackage.key),
          raw_payload: {
            payfast_mode: useSandbox ? "sandbox" : "live",
            renewal: true,
            month_key: monthKey,
            package_key: servicePackage.key,
          },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("*")
        .single();

      if (paymentSaveError || !savedPayment) {
        console.error("Error saving renewal payment transaction:", paymentSaveError);
        return res.status(500).json({ message: "Failed to prepare renewal payment." });
      }

      const payfastFields = withPayfastSignature(
        {
          merchant_id: payfastConfig.merchantId,
          merchant_key: payfastConfig.merchantKey,
          return_url: useSandbox ? buildPayfastSandboxReturnUrl(req, "return", merchantReference) : `${getAppBaseUrl()}/client/parent/gateway?payfast=return&merchantReference=${encodeURIComponent(merchantReference)}&renewal=true`,
          cancel_url: useSandbox ? buildPayfastSandboxReturnUrl(req, "cancelled", merchantReference) : `${getAppBaseUrl()}/client/parent/gateway?payfast=cancelled&merchantReference=${encodeURIComponent(merchantReference)}&renewal=true`,
          notify_url: `${getApiPublicUrl()}/api/payments/payfast/notify`,
          name_first: String((req as any).dbUser?.firstName || "").trim(),
          name_last: String((req as any).dbUser?.lastName || "").trim(),
          email_address: resolvePayfastEmailAddress({
            dbUserEmail: (req as any).dbUser?.email,
            enrollmentEmail: enrollment.parent_email,
            parentId,
            useSandbox,
          }),
          m_payment_id: merchantReference,
          amount: servicePackage.amountZar.toFixed(2),
          item_name: `${servicePackage.label} Renewal`,
          item_description: buildPackagePaymentDescription(enrollment.student_full_name, servicePackage.key),
          custom_str1: String(enrollment.id),
          custom_str5: servicePackage.key,
        },
        payfastConfig.passphrase,
      );

      return res.json({
        message: "Renewal payment prepared.",
        packageKey: servicePackage.key,
        sessionsPerMonth: servicePackage.sessionsPerMonth,
        amount: servicePackage.amountZar,
        merchantReference,
        checkoutUrl: payfastConfig.processUrl,
        sandbox: useSandbox,
        formFields: payfastFields,
      });
    } catch (error) {
      console.error("Error preparing renewal payment:", error);
      res.status(500).json({ message: "Failed to prepare renewal payment." });
    }
  });

  // ========================================
  // STUDENT AUTH ROUTES
  // ========================================

  // Student signup with parent code validation
  app.post("/api/student/signup", async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, parentCode } = req.body;
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const normalizedParentCode = String(parentCode || "").trim().toUpperCase();
      console.log("🎓 Student signup request:", {
        email: normalizedEmail,
        firstName,
        lastName,
        parentCode: normalizedParentCode,
      });

      if (!normalizedEmail || !password || !normalizedParentCode) {
        return res.status(400).json({ message: "Email, password, and parent code are required" });
      }

      console.log("🔍 Validating parent code:", normalizedParentCode);

      let proposal: any = null;
      let proposalError: any = null;

      if (isEmergencyDbMode()) {
        try {
          const proposalResult = await pool.query(
            `SELECT
                id::text,
                student_id::text,
                accepted_at,
                parent_code,
                tutor_id::text,
                enrollment_id::text
               FROM public.onboarding_proposals
              WHERE upper(parent_code) = $1
              LIMIT 1`,
            [normalizedParentCode],
          );
          proposal = proposalResult.rows[0] || null;
        } catch (error) {
          proposalError = error;
        }
      } else {
        const proposalResult = await supabase
          .from("onboarding_proposals")
          .select("id, student_id, accepted_at, parent_code, tutor_id, enrollment_id")
          .eq("parent_code", normalizedParentCode)
          .maybeSingle();

        proposal = proposalResult.data;
        proposalError = proposalResult.error;
      }

      console.log("📋 Proposal found:", proposal, "Error:", proposalError);

      if (proposalError || !proposal) {
        console.log("❌ Invalid parent code");
        return res.status(400).json({ message: "Invalid parent code" });
      }

      if (!proposal.accepted_at) {
        console.log("❌ Proposal not accepted yet");
        return res.status(400).json({ message: "Parent has not yet accepted the proposal for this code" });
      }

      console.log("🔍 Checking if code already used...");
      let existingStudent: any = null;
      let checkError: any = null;

      if (isEmergencyDbMode()) {
        try {
          const existingResult = await pool.query(
            `SELECT id::text
               FROM public.student_users
              WHERE upper(parent_code) = $1
              LIMIT 1`,
            [normalizedParentCode],
          );
          existingStudent = existingResult.rows[0] || null;
        } catch (error) {
          checkError = error;
        }
      } else {
        const existingResult = await supabase
          .from("student_users")
          .select("id")
          .eq("parent_code", normalizedParentCode)
          .maybeSingle();

        existingStudent = existingResult.data;
        checkError = existingResult.error;
      }

      console.log("👥 Existing student:", existingStudent, "Check error:", checkError);

      if (checkError) {
        console.error("❌ Failed to verify parent code usage:", checkError);
        return res.status(500).json({ message: "Failed to verify parent code" });
      }

      if (existingStudent) {
        console.log("❌ Code already used");
        return res.status(400).json({ message: "This parent code has already been used" });
      }

      console.log("🔐 Hashing password...");
      const { hash } = await import("bcryptjs");
      const hashedPassword = await hash(password, 10);

      console.log("💾 Creating student user in database...");
      let studentUser: any = null;
      let insertError: any = null;

      if (isEmergencyDbMode()) {
        try {
          const insertResult = await pool.query(
            `INSERT INTO public.student_users (
                email,
                password,
                first_name,
                last_name,
                student_id,
                parent_code
              )
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING
                id::text,
                email,
                first_name,
                last_name,
                student_id::text,
                parent_code,
                created_at,
                last_login`,
            [
              normalizedEmail,
              hashedPassword,
              firstName || null,
              lastName || null,
              proposal.student_id || null,
              normalizedParentCode,
            ],
          );
          studentUser = insertResult.rows[0] || null;
        } catch (error: any) {
          insertError = error;
        }
      } else {
        const insertResult = await supabase
          .from("student_users")
          .insert({
            email: normalizedEmail,
            password: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            student_id: proposal.student_id,
            parent_code: normalizedParentCode,
          })
          .select()
          .single();

        studentUser = insertResult.data;
        insertError = insertResult.error;
      }

      if (insertError || !studentUser) {
        console.error("❌ Error creating student user:", insertError);
        if (insertError?.code === "23505") {
          return res.status(400).json({ message: "A student account already exists for this email or parent code" });
        }
        return res.status(500).json({
          message: "Failed to create student account",
          error: insertError?.message || "Student account was not created",
        });
      }

      console.log("✅ Student user created:", {
        id: studentUser.id,
        email: studentUser.email,
        studentId: studentUser.student_id,
      });

      // Keep any unlinked intro session attached to the canonical student.
      if (proposal.student_id && proposal.tutor_id) {
        if (isEmergencyDbMode()) {
          try {
            let parentId: string | null = null;
            if (proposal.enrollment_id) {
              const enrollmentResult = await pool.query(
                `SELECT user_id::text
                   FROM public.parent_enrollments
                  WHERE id = $1
                  LIMIT 1`,
                [proposal.enrollment_id],
              );
              parentId = enrollmentResult.rows[0]?.user_id || null;
            }

            if (parentId) {
              const linkResult = await pool.query(
                `UPDATE public.scheduled_sessions
                    SET student_id = $1::uuid,
                        updated_at = NOW()
                  WHERE parent_id = $2
                    AND tutor_id = $3
                    AND student_id IS NULL
                    AND type = 'intro'
                  RETURNING id::text`,
                [proposal.student_id, parentId, proposal.tutor_id],
              );
              if (linkResult.rows.length > 0) {
                console.log("✅ Linked intro sessions to student_id:", linkResult.rows.map((row: any) => row.id));
              }
            }
          } catch (linkError) {
            console.error("❌ Error linking intro sessions to student_id:", linkError);
          }
        } else {
          let parentId = String(req.body.parentId || "").trim() || null;

          if (!parentId && proposal.enrollment_id) {
            const { data: enrollment } = await supabase
              .from("parent_enrollments")
              .select("user_id")
              .eq("id", proposal.enrollment_id)
              .maybeSingle();
            parentId = String(enrollment?.user_id || "").trim() || null;
          }

          if (parentId) {
            const { data: introSessions, error: sessionFetchError } = await supabase
              .from("scheduled_sessions")
              .select("id")
              .eq("parent_id", parentId)
              .eq("tutor_id", proposal.tutor_id)
              .is("student_id", null)
              .eq("type", "intro");

            if (sessionFetchError) {
              console.error("❌ Error fetching intro sessions for student linkage:", sessionFetchError);
            } else if (introSessions && introSessions.length > 0) {
              const sessionIds = introSessions.map((session: any) => session.id);
              const { error: updateSessionError } = await supabase
                .from("scheduled_sessions")
                .update({ student_id: proposal.student_id, updated_at: new Date().toISOString() })
                .in("id", sessionIds);

              if (updateSessionError) {
                console.error("❌ Error updating intro sessions with student_id:", updateSessionError);
              } else {
                console.log("✅ Linked intro sessions to student_id:", sessionIds);
              }
            }
          }
        }
      }

      (req.session as any).studentUserId = studentUser.id;
      (req.session as any).studentEmail = studentUser.email;
      req.session.touch();

      console.log("✅ Student signup successful!");
      return res.json({
        message: "Student account created successfully",
        user: {
          id: studentUser.id,
          email: studentUser.email,
          firstName: studentUser.first_name,
          lastName: studentUser.last_name,
          studentId: studentUser.student_id,
        },
      });
    } catch (error: any) {
      console.error("❌ Student signup error:", error);
      console.error("❌ Error stack:", error.stack);
      return res.status(500).json({ message: "Failed to create student account", error: error.message });
    }
  });

  // Student signin
  app.post("/api/student/signin", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = String(email || "").trim().toLowerCase();

      if (!normalizedEmail || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      let studentUser: any = null;
      let lookupError: any = null;

      if (isEmergencyDbMode()) {
        try {
          const userResult = await pool.query(
            `SELECT
                id::text,
                email,
                password,
                first_name,
                last_name,
                student_id::text,
                created_at,
                last_login
               FROM public.student_users
              WHERE lower(email) = $1
              LIMIT 1`,
            [normalizedEmail],
          );
          studentUser = userResult.rows[0] || null;
        } catch (error) {
          lookupError = error;
        }
      } else {
        const userResult = await supabase
          .from("student_users")
          .select("*")
          .eq("email", normalizedEmail)
          .maybeSingle();

        studentUser = userResult.data;
        lookupError = userResult.error;
      }

      if (lookupError || !studentUser) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const { compare } = await import("bcryptjs");
      const passwordMatch = await compare(password, studentUser.password);

      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (isEmergencyDbMode()) {
        await pool.query(
          `UPDATE public.student_users
              SET last_login = NOW()
            WHERE id = $1`,
          [studentUser.id],
        );
      } else {
        await supabase
          .from("student_users")
          .update({ last_login: new Date().toISOString() })
          .eq("id", studentUser.id);
      }

      (req.session as any).studentUserId = studentUser.id;
      (req.session as any).studentEmail = studentUser.email;
      req.session.touch();

      return res.json({
        message: "Signed in successfully",
        user: {
          id: studentUser.id,
          email: studentUser.email,
          firstName: studentUser.first_name,
          lastName: studentUser.last_name,
          studentId: studentUser.student_id,
        },
      });
    } catch (error) {
      console.error("Student signin error:", error);
      return res.status(500).json({ message: "Failed to sign in" });
    }
  });

  // Get current student user
  app.get("/api/student/me", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;

      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      let studentUser: any = null;
      let lookupError: any = null;

      if (isEmergencyDbMode()) {
        try {
          const userResult = await pool.query(
            `SELECT
                id::text,
                email,
                first_name,
                last_name,
                student_id::text,
                created_at,
                last_login
               FROM public.student_users
              WHERE id = $1
              LIMIT 1`,
            [studentUserId],
          );
          studentUser = userResult.rows[0] || null;
        } catch (error) {
          lookupError = error;
        }
      } else {
        const userResult = await supabase
          .from("student_users")
          .select("id, email, first_name, last_name, student_id, created_at, last_login")
          .eq("id", studentUserId)
          .single();

        studentUser = userResult.data;
        lookupError = userResult.error;
      }

      if (lookupError || !studentUser) {
        return res.status(404).json({ message: "Student user not found" });
      }

      let podName = null;

      if (studentUser.student_id) {
        if (isEmergencyDbMode()) {
          const podResult = await pool.query(
            `SELECT p.pod_name
               FROM public.students s
               LEFT JOIN public.tutor_assignments ta
                 ON ta.tutor_id = s.tutor_id
               LEFT JOIN public.pods p
                 ON p.id = ta.pod_id
              WHERE s.id = $1
              LIMIT 1`,
            [studentUser.student_id],
          );
          podName = podResult.rows[0]?.pod_name || null;
        } else {
          const { data: student } = await supabase
            .from("students")
            .select("tutor_id")
            .eq("id", studentUser.student_id)
            .maybeSingle();

          if (student?.tutor_id) {
            const { data: tutorAssignment } = await supabase
              .from("tutor_assignments")
              .select("pod:pods(pod_name)")
              .eq("tutor_id", student.tutor_id)
              .maybeSingle();

            const pod = tutorAssignment?.pod as { pod_name?: string } | null;
            if (pod) {
              podName = pod.pod_name || null;
            }
          }
        }
      }

      return res.json({
        id: studentUser.id,
        email: studentUser.email,
        firstName: studentUser.first_name,
        lastName: studentUser.last_name,
        studentId: studentUser.student_id,
        createdAt: studentUser.created_at,
        lastLogin: studentUser.last_login,
        podName,
      });
    } catch (error) {
      console.error("Error fetching student user:", error);
      return res.status(500).json({ message: "Failed to fetch student user" });
    }
  });

  app.get("/api/student/communications", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser, error } = await supabase
        .from("student_users")
        .select("id, student_id")
        .eq("id", studentUserId)
        .single();

      if (error || !studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const student = await storage.getStudent(studentUser.student_id);
      if (!student || !student.tutorId) {
        return res.status(404).json({ message: "Student not found" });
      }

      const parentId = await resolveParentIdForStudent(student, student.tutorId);
      const bundle = await buildStudentCommunicationBundle({ student, parentId });
      await markCommunicationThreadRead({ studentId: student.id, audience: "student", viewerRole: "student" });
      res.json({
        student: bundle.student,
        tutor: bundle.tutor,
        parent: bundle.parent,
        thread: bundle.threads.student,
      });
    } catch (error) {
      console.error("Error fetching student communications:", error);
      res.status(500).json({ message: "Failed to fetch communications" });
    }
  });

  app.get("/api/student/communications/unread-count", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser, error } = await supabase
        .from("student_users")
        .select("id, student_id")
        .eq("id", studentUserId)
        .single();

      if (error || !studentUser?.student_id) {
        return res.json({ unreadCount: 0 });
      }

      const student = await storage.getStudent(studentUser.student_id);
      if (!student || !student.tutorId) {
        return res.json({ unreadCount: 0 });
      }

      const thread = await ensureStudentCommunicationThread({
        studentId: student.id,
        tutorId: student.tutorId,
        parentId: await resolveParentIdForStudent(student, student.tutorId),
        audience: "student",
      });

      const { data, error: unreadError } = await supabase
        .from("student_communication_messages")
        .select("id")
        .eq("thread_id", thread.id)
        .neq("sender_role", "student")
        .is("read_by_student_at", null);

      if (unreadError) throw unreadError;

      res.json({ unreadCount: (data || []).length });
    } catch (error) {
      console.error("Error fetching student communication unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.post("/api/student/communications", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const parsed = insertStudentCommunicationMessageSchema.parse({ ...(req.body || {}), audience: "student" });
      const { data: studentUser, error } = await supabase
        .from("student_users")
        .select("id, student_id")
        .eq("id", studentUserId)
        .single();

      if (error || !studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const student = await storage.getStudent(studentUser.student_id);
      if (!student || !student.tutorId) {
        return res.status(404).json({ message: "Student not found" });
      }

      const parentId = await resolveParentIdForStudent(student, student.tutorId);
      const inserted = await createStudentCommunicationMessage({
        student,
        parentId,
        audience: "student",
        senderRole: "student",
        senderStudentUserId: studentUser.id,
        replyToMessageId: parsed.replyToMessageId,
        message: parsed.message,
      });

      res.json({
        id: inserted.id,
        audience: inserted.audience,
        createdAt: inserted.created_at,
      });
    } catch (error) {
      console.error("Error sending student communication:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to send message" });
    }
  });

  app.get("/api/student/sessions", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const operationalMode = await getStudentOperationalMode(studentUser.student_id);
      if (!isLiveSchedulingMode(operationalMode)) {
        return res.json({
          sessions: [],
          operationalMode,
          sessionSchedulingEnabled: false,
        });
      }

      const { data: sessions, error } = await supabase
        .from("scheduled_sessions")
        .select("id, scheduled_time, scheduled_end, timezone, status, type, workflow_stage, parent_confirmed, tutor_confirmed, google_meet_url, created_at, updated_at")
        .eq("student_id", studentUser.student_id)
        .not("status", "in", '("cancelled","flagged")')
        .order("scheduled_time", { ascending: true });

      if (error) {
        console.error("Error fetching student sessions:", error);
        return res.status(500).json({ message: "Failed to fetch student sessions" });
      }

      res.json({
        sessions: sessions || [],
        operationalMode,
        sessionSchedulingEnabled: true,
      });
    } catch (error) {
      console.error("Error fetching student sessions:", error);
      res.status(500).json({ message: "Failed to fetch student sessions" });
    }
  });

  // Student logout
  app.post("/api/student/logout", async (req: Request, res: Response) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  // ========================================
  // STUDENT PORTAL ROUTES
  // ========================================

  // Get student stats (gamified dashboard)
  const resolveStudentIdForPortalSession = async (studentUserId: string) => {
    if (isEmergencyDbMode()) {
      const result = await pool.query(
        `SELECT student_id::text
           FROM public.student_users
          WHERE id = $1
          LIMIT 1`,
        [studentUserId],
      );
      return String(result.rows[0]?.student_id || "").trim() || null;
    }

    const { data: studentUser } = await supabase
      .from("student_users")
      .select("student_id")
      .eq("id", studentUserId)
      .single();

    return String(studentUser?.student_id || "").trim() || null;
  };

  app.get("/api/student/stats", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const studentId = await resolveStudentIdForPortalSession(studentUserId);

      if (!studentId) {
        return res.status(404).json({ message: "Student not found" });
      }

      const stats = await getStudentDashboardStats(studentId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching student stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get student commitments
  app.get("/api/student/commitments", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const { data: commitments, error } = await supabase
        .from("student_commitments")
        .select("*")
        .eq("student_id", studentUser.student_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      res.json(commitments || []);
    } catch (error) {
      console.error("Error fetching commitments:", error);
      res.status(500).json({ message: "Failed to fetch commitments" });
    }
  });

  // Create student commitment
  app.post("/api/student/commitments", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const { name, description, why_important, daily_action } = req.body;

      const { data: commitment, error } = await supabase
        .from("student_commitments")
        .insert({
          student_id: studentUser.student_id,
          name,
          description,
          why_important,
          daily_action,
          streak_count: 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      res.json(commitment);
    } catch (error) {
      console.error("Error creating commitment:", error);
      res.status(500).json({ message: "Failed to create commitment" });
    }
  });

  // Update student commitment
  app.put("/api/student/commitments/:id", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { id } = req.params;
      const { name, description, why_important, daily_action } = req.body;

      const { data: commitment, error } = await supabase
        .from("student_commitments")
        .update({
          name,
          description,
          why_important,
          daily_action,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      res.json(commitment);
    } catch (error) {
      console.error("Error updating commitment:", error);
      res.status(500).json({ message: "Failed to update commitment" });
    }
  });

  // Delete student commitment
  app.delete("/api/student/commitments/:id", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { id } = req.params;

      const { error } = await supabase
        .from("student_commitments")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting commitment:", error);
      res.status(500).json({ message: "Failed to delete commitment" });
    }
  });

  // Complete commitment for today
  app.post("/api/student/commitments/:id/complete", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { id } = req.params;
      const today = new Date().toISOString().split("T")[0];

      // Check if already completed today
      const { data: existingLog } = await supabase
        .from("commitment_logs")
        .select("id")
        .eq("commitment_id", id)
        .gte("completed_date", today)
        .maybeSingle();

      if (existingLog) {
        return res.status(400).json({ message: "Already completed today" });
      }

      // Log the completion
      const { data: log, error } = await supabase
        .from("commitment_logs")
        .insert({
          commitment_id: id,
          completed_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger will auto-update streak
      res.json(log);
    } catch (error) {
      console.error("Error completing commitment:", error);
      res.status(500).json({ message: "Failed to complete commitment" });
    }
  });

  // Get student reflections
  app.get("/api/student/reflections", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const { data: reflections, error } = await supabase
        .from("student_reflections")
        .select("*")
        .eq("student_id", studentUser.student_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      res.json(reflections || []);
    } catch (error) {
      console.error("Error fetching reflections:", error);
      res.status(500).json({ message: "Failed to fetch reflections" });
    }
  });

  // Create student reflection
  app.post("/api/student/reflections", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const { reflection_text, mood, date } = req.body;
      
      console.log("📝 Creating reflection with data:", { 
        student_id: studentUser.student_id, 
        reflection_text, 
        mood, 
        date,
        dateProvided: !!date,
        finalDate: date || new Date().toISOString()
      });

      const { data: reflection, error } = await supabase
        .from("student_reflections")
        .insert({
          student_id: studentUser.student_id,
          reflection_text,
          mood,
          date: date || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating reflection:", error);
        throw error;
      }
      res.json(reflection);
    } catch (error) {
      console.error("Error creating reflection:", error);
      res.status(500).json({ message: "Failed to create reflection" });
    }
  });

  // Get student assignments
  app.get("/api/student/assignments", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const { data: assignments, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("student_id", studentUser.student_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      res.json(assignments || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  // Submit assignment
  app.post("/api/student/assignments/:id/submit", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { id } = req.params;
      const { student_result, student_work } = req.body;

      const { data: assignment, error } = await supabase
        .from("assignments")
        .update({
          student_result,
          student_work,
          completed_at: new Date().toISOString(),
          status: "completed",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      res.json(assignment);
    } catch (error) {
      console.error("Error submitting assignment:", error);
      res.status(500).json({ message: "Failed to submit assignment" });
    }
  });

  // Get student academic profile
  app.get("/api/student/profile", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const profile = await storage.getAcademicProfile(studentUser.student_id);
      res.json(profile || {});
    } catch (error) {
      console.error("Error fetching student profile:", error);
      res.status(500).json({ message: "Failed to fetch student profile" });
    }
  });

  app.post("/api/student/profile", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const profile = await storage.upsertAcademicProfile({
        studentId: studentUser.student_id,
        fullName: req.body?.fullName,
        grade: req.body?.grade,
        school: req.body?.school,
        latestTermReport: req.body?.latestTermReport,
        myThoughts: req.body?.myThoughts,
        currentChallenges: req.body?.currentChallenges,
        recentWins: req.body?.recentWins,
        upcomingExamsProjects: req.body?.upcomingExamsProjects,
      });

      res.json(profile);
    } catch (error) {
      console.error("Error saving student profile:", error);
      res.status(500).json({ message: "Failed to save student profile" });
    }
  });

  app.get("/api/student/academic-profile", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const { data: profile, error } = await supabase
        .from("academic_profiles")
        .select("*")
        .eq("student_id", studentUser.student_id)
        .maybeSingle();

      if (error) throw error;
      res.json(profile || {});
    } catch (error) {
      console.error("Error fetching academic profile:", error);
      res.status(500).json({ message: "Failed to fetch academic profile" });
    }
  });

  // Get student struggle targets
  app.get("/api/student/targets", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const targets = await storage.getStruggleTargets(studentUser.student_id);
      res.json(targets || []);
    } catch (error) {
      console.error("Error fetching student targets:", error);
      res.status(500).json({ message: "Failed to fetch student targets" });
    }
  });

  app.post("/api/student/targets", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const target = await storage.createStruggleTarget({
        studentId: studentUser.student_id,
        subject: req.body?.subject,
        topicConcept: req.body?.topicConcept,
        myStruggle: req.body?.myStruggle,
        strategy: req.body?.strategy,
        consolidationDate: req.body?.consolidationDate,
      });

      res.json(target);
    } catch (error) {
      console.error("Error creating student target:", error);
      res.status(500).json({ message: "Failed to create student target" });
    }
  });

  app.put("/api/student/targets/:id", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const existingTargets = await storage.getStruggleTargets(studentUser.student_id);
      if (!existingTargets.some((target) => String(target.id) === String(req.params.id))) {
        return res.status(404).json({ message: "Target not found" });
      }

      const updatedTarget = await storage.updateStruggleTarget(req.params.id, {
        subject: req.body?.subject,
        topicConcept: req.body?.topicConcept,
        myStruggle: req.body?.myStruggle,
        strategy: req.body?.strategy,
        consolidationDate: req.body?.consolidationDate,
        overcame: req.body?.overcame,
      });

      res.json(updatedTarget || null);
    } catch (error) {
      console.error("Error updating student target:", error);
      res.status(500).json({ message: "Failed to update student target" });
    }
  });

  app.delete("/api/student/targets/:id", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const existingTargets = await storage.getStruggleTargets(studentUser.student_id);
      if (!existingTargets.some((target) => String(target.id) === String(req.params.id))) {
        return res.status(404).json({ message: "Target not found" });
      }

      await storage.deleteStruggleTarget(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting student target:", error);
      res.status(500).json({ message: "Failed to delete student target" });
    }
  });

  app.get("/api/student/struggle-targets", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const { data: targets, error } = await supabase
        .from("struggle_targets")
        .select("*")
        .eq("student_id", studentUser.student_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      res.json(targets || []);
    } catch (error) {
      console.error("Error fetching struggle targets:", error);
      res.status(500).json({ message: "Failed to fetch struggle targets" });
    }
  });

  app.get("/api/student/topic-conditioning-state", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const studentId = await resolveStudentIdForPortalSession(studentUserId);

      if (!studentId) {
        return res.status(404).json({ message: "Student not found" });
      }

      const student = await storage.getStudent(studentId);

      if (!student?.tutorId) {
        return res.json({
          topic: null,
          phase: null,
          stability: null,
          stage: "Foundation",
          lastUpdated: null,
        });
      }

      const normalizePhase = (value?: string | null) => {
        const v = String(value || "").toLowerCase();
        if (v.includes("clarity")) return "Clarity";
        if (v.includes("structured")) return "Structured Execution";
        if (v.includes("discomfort")) return "Controlled Discomfort";
        if (v.includes("time") || v.includes("pressure")) return "Time Pressure Stability";
        return "Structured Execution";
      };

      const normalizeStability = (value?: string | null) => {
        const v = String(value || "").toLowerCase();
        if (v.includes("high maintenance")) return "High Maintenance";
        if (v.includes("high")) return "High";
        if (v.includes("medium")) return "Medium";
        return "Low";
      };

      const sanitizeTopic = (value?: string | null) => {
        const cleaned = String(value || "").trim();
        if (!cleaned) return null;
        if (cleaned.toLowerCase() === "onboarding baseline diagnostic") return null;
        if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
          try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
              const first = String(parsed[0] || "").trim();
              if (!first) return null;
              if (first.toLowerCase() === "onboarding baseline diagnostic") return null;
              return first;
            }
          } catch {
            // Fall back to the raw cleaned string.
          }
        }
        return cleaned;
      };

      const phaseToStage: Record<string, string> = {
        Clarity: "Foundation",
        "Structured Execution": "Method",
        "Controlled Discomfort": "Challenge",
        "Time Pressure Stability": "Timed Stability",
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

      let latest = Object.entries(topicsStore)
        .map(([topicKey, entry]) => {
          const topic = sanitizeTopic(topicKey) || sanitizeTopic((entry as any)?.topic) || null;
          if (!topic) return null;

          const latestPhase = tryParsePhase((entry as any)?.phase) || tryParsePhase(topicConditioningStore.entry_phase);
          if (!latestPhase) return null;
          const latestStability = normalizeStability((entry as any)?.stability || topicConditioningStore.stability || "Low");
          const normalizedHistory = Array.isArray((entry as any)?.history)
            ? (entry as any).history
                .map((item: any) => ({
                  phase: tryParsePhase(item?.phase) || latestPhase,
                  stability: normalizeStability(item?.stability || latestStability),
                  date: String(item?.date || "").trim(),
                }))
                .filter((item: any) => !!item.date)
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
            : [];

          const resolvedLatest = normalizedHistory[normalizedHistory.length - 1] || {
            phase: latestPhase,
            stability: latestStability,
            date:
              String(
                (entry as any)?.lastUpdated ||
                (entry as any)?.lastUpdatedAt ||
                topicConditioningStore.lastUpdated ||
                topicConditioningStore.lastUpdatedAt ||
                ""
              ).trim() || new Date().toISOString(),
          };

          return {
            topic,
            phase: resolvedLatest.phase,
            stability: resolvedLatest.stability,
            date: resolvedLatest.date,
          };
        })
        .filter((item): item is NonNullable<typeof item> => !!item)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .pop() || null;

      if (!latest) {
        let activations: any[] = [];
        if (isEmergencyDbMode()) {
          const activationResult = await pool.query(
            `SELECT topic, created_at
               FROM public.topic_conditioning_activations
              WHERE student_id = $1
              ORDER BY created_at ASC`,
            [student.id],
          );
          activations = activationResult.rows;
        } else {
          const { data } = await supabase
            .from("topic_conditioning_activations")
            .select("topic, created_at")
            .eq("student_id", student.id)
            .order("created_at", { ascending: true });
          activations = data || [];
        }

        const activation = activations
          .map((row: any) => ({
            topic: sanitizeTopic(row?.topic),
            date: String(row?.created_at || "").trim(),
          }))
          .filter((row: any) => !!row.topic && !!row.date)
          .pop();

        if (activation) {
          const activationPhase = tryParsePhase(topicConditioningStore.entry_phase);
          if (activationPhase) {
            latest = {
              topic: activation.topic,
              phase: activationPhase,
              stability: normalizeStability(topicConditioningStore.stability || "Low"),
              date: activation.date,
            };
          }
        }
      }

      if (!latest) {
        return res.json({
          topic: null,
          phase: null,
          stability: null,
          stage: "Foundation",
          lastUpdated: null,
        });
      }

      res.json({
        topic: latest.topic,
        phase: latest.phase,
        stability: latest.stability,
        stage: phaseToStage[latest.phase] || "Foundation",
        lastUpdated: latest.date,
      });
    } catch (error) {
      console.error("Error fetching student topic conditioning state:", error);
      res.status(500).json({ message: "Failed to fetch topic conditioning state" });
    }
  });

  app.get("/api/student/topic-conditioning-states", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const studentId = await resolveStudentIdForPortalSession(studentUserId);

      if (!studentId) {
        return res.status(404).json({ message: "Student not found" });
      }

      const student = await storage.getStudent(studentId);
      if (!student?.tutorId) {
        return res.json([]);
      }

      const sanitizeTopic = (value?: string | null) => {
        const cleaned = String(value || "").trim();
        if (!cleaned) return null;
        if (cleaned.toLowerCase() === "onboarding baseline diagnostic") return null;
        if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
          try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
              const first = String(parsed[0] || "").trim();
              if (!first || first.toLowerCase() === "onboarding baseline diagnostic") return null;
              return first;
            }
          } catch {
            return cleaned;
          }
        }
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
