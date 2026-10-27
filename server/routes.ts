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
    console.log("üîê requireRole check:", {
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
      const servicePackage = getMonthlyServicePackage(proposal.package_key || transaction?.package_key);

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
              })
              .filter(Boolean) as Array<{
              phase: TopicPhase;
              setName: string;
              setId?: string;
              setOrder?: number;
              drillSchemaId?: string;
              drillSchemaVersion?: number;
              drillDefinitionHash?: string;
              constraintProfile?: Record<string, unknown> | null;
              observations: Array<Record<string, string>>;
            }>;
          };

          const EXACT_SET_LIBRARY: Record<
            "diagnosis" | "training",
            Record<
              "Clarity" | "Structured Execution" | "Controlled Discomfort" | "Time Pressure Stability",
              Array<{ setName: string; reps: number; modelingOnly?: boolean }>
            >
          > = Object.fromEntries(
            (["diagnosis", "training"] as const).map((mode) => [
              mode,
              Object.fromEntries(
                PHASES.map((phase) => [
                  phase,
                  getDrillSchemaDefinition(mode, phase).sets.map((definition) => ({
                    setName: definition.setName,
                    reps: definition.reps,
                    modelingOnly: definition.modelingOnly,
                  })),
                ]),
              ),
            ]),
          ) as any;

          const ADAPTIVE_DIAGNOSIS_SET_LIBRARY: Record<TopicPhase, { setName: string; reps: number }> =
            Object.fromEntries(
              PHASES.map((phase) => {
                const definition = getDrillSchemaDefinition("diagnosis", phase).sets[0];
                return [phase, { setName: definition.setName, reps: definition.reps }];
              }),
            ) as Record<TopicPhase, { setName: string; reps: number }>;

          const validateSemanticEvidenceSets = (
            mode: EvidenceDrillMode,
            phase: TopicPhase,
            sets: NormalizedEvidenceSet[],
          ): string | null => {
            const semanticSetCount = sets.filter(hasSemanticEvidenceContract).length;
            if (semanticSetCount === 0) return null;
            if (semanticSetCount !== sets.length) {
              return "Drill evidence cannot mix legacy and versioned set contracts";
            }

            for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
              const result = validateAndNormalizeSemanticEvidenceSet({
                mode,
                phase,
                setIndex,
                submittedSet: sets[setIndex],
              });
              if ("error" in result) return result.error;
              sets[setIndex] = result.normalizedSet;
            }

            return null;
          };

          const validateDrillStructure = (
            mode: "diagnosis" | "training",
            phase: "Clarity" | "Structured Execution" | "Controlled Discomfort" | "Time Pressure Stability",
            sets: Array<{ setName: string; observations: Array<Record<string, string>> }>
          ): string | null => {
            const expectedSets = EXACT_SET_LIBRARY[mode][phase] || [];
            const expectedSetCount = expectedSets.length;
            if (sets.length !== expectedSetCount) {
              return `${mode} drill must include exactly ${expectedSetCount} sets`;
            }

            const semanticValidationError = validateSemanticEvidenceSets(mode, phase, sets);
            if (semanticValidationError) return semanticValidationError;

            const phaseFields = INTRO_PHASE_WEIGHTS[phase] || [];
            for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
              const set = sets[setIndex];
              const observations = Array.isArray(set?.observations) ? set.observations : [];
              const expectedSet = expectedSets[setIndex];
              const actualSetName = String(set?.setName || "").trim();

              if (!expectedSet) {
                return `Unexpected set ${setIndex + 1} for ${phase} ${mode} drill`;
              }
              if (actualSetName !== expectedSet.setName) {
                return `Set ${setIndex + 1} must be "${expectedSet.setName}"`;
              }

              // Clarity training Set 1 is modeling-only. It is non-scored and has no required observations.
              if (expectedSet.modelingOnly) {
                if (observations.length > 0) {
                  return `Set ${setIndex + 1} must not include scored observations`;
                }
                continue;
              }

              if (observations.length !== expectedSet.reps) {
                return `Set ${setIndex + 1} must include exactly ${expectedSet.reps} reps`;
              }

              for (let repIndex = 0; repIndex < observations.length; repIndex += 1) {
                const rep = observations[repIndex] || {};
                for (const field of phaseFields) {
                  const explicitLevel = field.aliases
                    .map((alias) => String(rep?.[`${alias}_level`] || "").trim())
                    .find(Boolean);
                  if (!explicitLevel) {
                    return `Set ${setIndex + 1}, rep ${repIndex + 1} is missing required observation level`;
                  }
                  if (!["weak", "partial", "clear"].includes(explicitLevel)) {
                    return `Set ${setIndex + 1}, rep ${repIndex + 1} has invalid observation level`;
                  }
                }
              }
            }

            return null;
          };

          const validateAdaptiveDiagnosisBlocks = (
            blocks: Array<{
              phase: TopicPhase;
              setName: string;
              setId?: string;
              setOrder?: number;
              drillSchemaId?: string;
              drillSchemaVersion?: number;
              drillDefinitionHash?: string;
              constraintProfile?: Record<string, unknown> | null;
              observations: Array<Record<string, string>>;
            }>,
            evidenceMode: Extract<EvidenceDrillMode, "diagnosis" | "verification"> = "diagnosis",
          ): string | null => {
            if (!blocks.length) {
              return "Adaptive diagnosis must include at least one phase verification block";
            }

            const semanticBlockCount = blocks.filter(hasSemanticEvidenceContract).length;
            if (semanticBlockCount > 0 && semanticBlockCount !== blocks.length) {
              return "Adaptive evidence cannot mix legacy and versioned block contracts";
            }

            for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
              let block = blocks[blockIndex];
              if (semanticBlockCount > 0) {
                const result = validateAndNormalizeSemanticEvidenceSet({
                  mode: evidenceMode,
                  phase: block.phase,
                  setIndex: 0,
                  submittedSet: block,
                });
                if ("error" in result) return `Adaptive diagnosis block ${blockIndex + 1}: ${result.error}`;
                block = { phase: block.phase, ...result.normalizedSet };
                blocks[blockIndex] = block;
              }
              const expectedSet = ADAPTIVE_DIAGNOSIS_SET_LIBRARY[block.phase];
              const observations = Array.isArray(block.observations) ? block.observations : [];
              const phaseFields = INTRO_PHASE_WEIGHTS[block.phase] || [];

              if (!expectedSet) {
                return `Adaptive diagnosis block ${blockIndex + 1} has an invalid phase`;
              }

              if (String(block.setName || "").trim() !== expectedSet.setName) {
                return `Adaptive diagnosis block ${blockIndex + 1} must be "${expectedSet.setName}"`;
              }

              if (evidenceMode === "verification") {
                const verificationDefinition = getDrillSchemaDefinition("verification", block.phase).sets[0];
                const minimumReps = Math.max(1, Number(verificationDefinition.minimumReps || 1));
                const maximumReps = Math.max(minimumReps, Number(verificationDefinition.maximumReps || verificationDefinition.reps));
                if (observations.length < minimumReps || observations.length > maximumReps) {
                  return `Handover verification block ${blockIndex + 1} must include between ${minimumReps} and ${maximumReps} evidence opportunities`;
                }
              } else if (observations.length !== expectedSet.reps) {
                return `Adaptive diagnosis block ${blockIndex + 1} must include exactly ${expectedSet.reps} reps`;
              }

              for (let repIndex = 0; repIndex < observations.length; repIndex += 1) {
                const rep = observations[repIndex] || {};
                for (const field of phaseFields) {
                  const explicitLevel = field.aliases
                    .map((alias) => String(rep?.[`${alias}_level`] || "").trim())
                    .find(Boolean);
                  if (!explicitLevel) {
                    return `Adaptive diagnosis block ${blockIndex + 1}, rep ${repIndex + 1} is missing required observation level`;
                  }
                  if (!["weak", "partial", "clear"].includes(explicitLevel)) {
                    return `Adaptive diagnosis block ${blockIndex + 1}, rep ${repIndex + 1} has invalid observation level`;
                  }
                }
              }
            }

            return null;
          };

          const resolveObservationValue = (repObs: Record<string, string>, aliases: string[]): string => {
            for (const alias of aliases) {
              const levelValue = String(repObs?.[`${alias}_level`] || "").trim();
              if (levelValue) return levelValue;
            }
            return "";
          };

          const observationLevelFor = (value: unknown): "weak" | "partial" | "clear" => {
            return normalizeObservationLevelValue(value);
          };

          const weightedScoreFor = (weight: number, level: "weak" | "partial" | "clear") => {
            if (level === "clear") return weight;
            if (level === "partial") return Math.round(weight * 0.6);
            return 0;
          };

          const INTRO_PHASE_WEIGHTS: Record<
            "Clarity" | "Structured Execution" | "Controlled Discomfort" | "Time Pressure Stability",
            Array<{ aliases: string[]; weight: number }>
          > = {
            Clarity: [
              { aliases: ["vocabulary", "vocabulary_precision"], weight: 30 },
              { aliases: ["method", "method_recognition"], weight: 30 },
              { aliases: ["reason", "reason_clarity"], weight: 20 },
              { aliases: ["immediateApply", "immediate_apply_response"], weight: 20 },
            ],
            "Structured Execution": [
              { aliases: ["startBehavior", "start_behavior"], weight: 25 },
              { aliases: ["stepExecution", "step_execution"], weight: 30 },
              { aliases: ["repeatability", "repeatability"], weight: 25 },
              { aliases: ["independence", "independence_level"], weight: 20 },
            ],
            "Controlled Discomfort": [
              { aliases: ["initialResponse", "initial_boss_response"], weight: 30 },
              { aliases: ["firstStepControl", "first_step_control"], weight: 25 },
              { aliases: ["discomfortTolerance", "discomfort_tolerance"], weight: 25 },
              { aliases: ["rescueDependence", "rescue_dependence"], weight: 20 },
            ],
            "Time Pressure Stability": [
              { aliases: ["startUnderTime", "start_under_time"], weight: 20 },
              { aliases: ["structureUnderTime", "structure_under_time"], weight: 35 },
              { aliases: ["paceControl", "pace_control"], weight: 20 },
              { aliases: ["completionIntegrity", "completion_integrity"], weight: 25 },
            ],
          };

          const computeIntroDiagnosisSummary = (
            phase: "Clarity" | "Structured Execution" | "Controlled Discomfort" | "Time Pressure Stability",
            sets: Array<{ setName: string; observations: Array<Record<string, string>> }>
          ) => {
            const phaseWeights = INTRO_PHASE_WEIGHTS[phase];
            const repRows: Array<{ set: string; rep: number; repScore: number }> = [];
            const setScores: number[] = [];
            let highGuardPasses = true;

            const firstTwoSets = sets.slice(0, 2);
            firstTwoSets.forEach((set) => {
              const repScores = (set.observations || []).map((repObs, repIndex) => {
                const score = phaseWeights.reduce((sum, field) => {
                  const rawValue = resolveObservationValue(repObs, field.aliases);
                  const level = observationLevelFor(rawValue);
                  const fieldScore = weightedScoreFor(field.weight, level);
                  return sum + fieldScore;
                }, 0);

                const normalizedRepScore = Math.max(0, Math.min(100, Math.round(score)));
                repRows.push({
                  set: set.setName,
                  rep: repIndex + 1,
                  repScore: normalizedRepScore,
                });
                return normalizedRepScore;
              });

              const setScore = repScores.length > 0
                ? Math.round(repScores.reduce((sum, value) => sum + value, 0) / repScores.length)
                : 0;
              setScores.push(setScore);

              if (phase === "Clarity") {
                const repHasZeroField = (set.observations || []).some((repObs) =>
                  phaseWeights.some((field) => {
                    const rawValue = resolveObservationValue(repObs, field.aliases);
                    return weightedScoreFor(field.weight, observationLevelFor(rawValue)) === 0;
                  })
                );
                if (repHasZeroField) highGuardPasses = false;
              }

              if (phase === "Structured Execution") {
                const repViolates = (set.observations || []).some((repObs) => {
                  const step = String(repObs?.stepExecution || repObs?.step_execution || "").toLowerCase();
                  const start = String(repObs?.startBehavior || repObs?.start_behavior || "").toLowerCase();
                  return step.includes("guess") || start.includes("avoid");
                });
                if (repViolates) highGuardPasses = false;
              }

              if (phase === "Controlled Discomfort") {
                const repViolates = (set.observations || []).some((repObs) => {
                  const initial = String(repObs?.initialResponse || repObs?.initial_boss_response || "").toLowerCase();
                  const firstStep = String(repObs?.firstStepControl || repObs?.first_step_control || "").toLowerCase();
                  return initial.includes("avoid") || initial.includes("froze") || firstStep.includes("could not");
                });
                if (repViolates) highGuardPasses = false;
              }

              if (phase === "Time Pressure Stability") {
                const repViolates = (set.observations || []).some((repObs) => {
                  const structure = String(repObs?.structureUnderTime || repObs?.structure_under_time || "").toLowerCase();
                  const pace = String(repObs?.paceControl || repObs?.pace_control || "").toLowerCase();
                  return !structure.includes("maintained") || !pace.includes("controlled");
                });
                if (repViolates) highGuardPasses = false;
              }
            });

            // Diagnosis sessions use Set1 x1 and Set2 x1, normalized to 0-100.
            const diagnosisScore = Math.round(
              setScores.length > 0
                ? setScores.reduce((sum, setScore) => sum + setScore, 0) / setScores.length
                : 0
            );

            let stability: "Low" | "Medium" | "High" = "Low";
            if (diagnosisScore <= 49) stability = "Low";
            else if (diagnosisScore <= 69) stability = "Medium";
            else stability = highGuardPasses ? "High" : "Medium";

            const nextActionConfig = (NEXT_ACTION_ENGINE as any)?.[phase]?.[stability] || null;

            return {
              phase,
              stability,
              diagnosisScore,
              nextAction: nextActionConfig?.primaryAction || null,
              constraint: nextActionConfig?.rules?.[0] || null,
              repRows,
              setScores,
              highGuardPasses,
            };
          };

          const labelAdaptiveDiagnosisBand = (band: AdaptiveDiagnosisBand) => {
            if (band === "de-escalate") return "Phase too advanced";
            if (band === "escalate") return "Phase too easy";
            return "Phase match";
          };

          const computeAdaptiveDiagnosisSummary = (
            startingPhase: TopicPhase,
            blocks: Array<{
              phase: TopicPhase;
              setName: string;
              observations: Array<Record<string, string>>;
            }>
          ) => {
            const phaseChecks = blocks.map((block) => {
              const phaseSummary = computeAdaptiveDiagnosisPhaseSummary(block.phase, block.observations);
              const nextPhase =
                phaseSummary.band === "de-escalate"
                  ? getAdjacentDiagnosisPhase(block.phase, "previous")
                  : phaseSummary.band === "escalate"
                    ? getAdjacentDiagnosisPhase(block.phase, "next")
                    : null;

              return {
                phase: block.phase,
                setName: block.setName,
                phaseScore: phaseSummary.phaseScore,
                band: phaseSummary.band,
                stability: phaseSummary.stability,
                nextPhase,
                repRows: phaseSummary.repRows,
              };
            });

            const finalCheck = phaseChecks[phaseChecks.length - 1];
            const finalPhase = finalCheck?.phase || startingPhase;
            const finalStability = finalCheck?.stability || "Low";
            const nextActionConfig = (NEXT_ACTION_ENGINE as any)?.[finalPhase]?.[finalStability] || null;

            return {
              startingPhase,
              pathLength: phaseChecks.length,
              phaseChecks,
              phase: finalPhase,
              stability: finalStability,
              diagnosisScore: finalCheck?.phaseScore || 0,
              finalBand: finalCheck?.band || "place",
              finalBandLabel: labelAdaptiveDiagnosisBand(finalCheck?.band || "place"),
              nextAction: nextActionConfig?.primaryAction || null,
              constraint: nextActionConfig?.rules?.[0] || null,
            };
          };

          const validateAdaptiveDiagnosisPath = (
            startingPhase: TopicPhase,
            summary: ReturnType<typeof computeAdaptiveDiagnosisSummary>
          ): string | null => {
            if (!summary.phaseChecks.length) {
              return "Adaptive diagnosis path is empty";
            }

            if (summary.phaseChecks[0]?.phase !== startingPhase) {
              return "Adaptive diagnosis must begin at the selected starting phase";
            }

            for (let index = 0; index < summary.phaseChecks.length - 1; index += 1) {
              const current = summary.phaseChecks[index];
              const next = summary.phaseChecks[index + 1];

              if (current.band === "place") {
                return "Adaptive diagnosis cannot continue after a placement match";
              }

              if (!current.nextPhase) {
                return "Adaptive diagnosis cannot continue after reaching a phase boundary";
              }

              if (current.nextPhase !== next.phase) {
                return "Adaptive diagnosis path must move only to the adjacent recommended phase";
              }
            }

            return null;
          };

          const computeHandoverVerificationSummary = (
            phase: TopicPhase,
            previousStability: TopicStability,
            submittedSet: any,
          ) => {
            // Retain the old score only as a compatibility measurement. It must
            // never authorize the continuity decision.
            const compatibilitySummary = computeAdaptiveDiagnosisPhaseSummary(
              phase,
              Array.isArray(submittedSet?.observations) ? submittedSet.observations : [],
            );
            const evidenceEvaluation = evaluateHandoverVerificationEvidence({
              phase,
              previousStability,
              set: submittedSet,
            });

            if (evidenceEvaluation.status !== "evaluated") {
              return {
                status: "unavailable" as const,
                phase,
                previousStability,
                reason: evidenceEvaluation.reason,
              };
            }

            const {
              verificationOutcome,
              confidence,
              resultingPhase,
              resultingStability,
              reDiagnosisRequired,
              reason,
              dimensions,
            } = evidenceEvaluation;

            const nextActionConfig =
              verificationOutcome === "targeted_re_diagnosis_required" || verificationOutcome === "continue_verification"
                ? null
                : (NEXT_ACTION_ENGINE as any)?.[resultingPhase]?.[resultingStability] || null;

            const verificationOutcomeLabel =
              verificationOutcome === "continue_verification"
                ? "More continuity evidence required"
                : verificationOutcome === "targeted_re_diagnosis_required"
                  ? "Targeted re-diagnosis required"
                  : verificationOutcome === "stability_adjust"
                    ? "Stability adjust"
                    : confidence === "strong"
                      ? "Inherited state confirmed"
                      : "Inherited state held";

            const nextAction =
              verificationOutcome === "continue_verification"
                ? "Record another clean continuity opportunity under the same inherited phase conditions."
                : verificationOutcome === "targeted_re_diagnosis_required"
                  ? "Run evidence-complete targeted re-diagnosis on this topic before standard training resumes."
                  : verificationOutcome === "stability_adjust"
                    ? `Adjust stability to ${resultingStability} and continue reinforcement from the inherited phase.`
                    : nextActionConfig?.primaryAction || "Continue training from the inherited state.";

            const constraint =
              verificationOutcome === "continue_verification"
                ? "Remain in continuity verification. Do not teach forward or progress the student while evidence is still unresolved."
                : verificationOutcome === "targeted_re_diagnosis_required"
                  ? "Do not resume normal training until evidence-complete targeted re-diagnosis is completed."
                  : nextActionConfig?.rules?.[0] || null;

            return {
              status: "evaluated" as const,
              phase,
              previousStability,
              verificationScore: compatibilitySummary.phaseScore,
              compatibilityScore: compatibilitySummary.phaseScore,
              scoreAuthority: false as const,
              decisionAuthority: "evidence_native" as const,
              verificationOutcome,
              verificationOutcomeLabel,
              confidence,
              resultingPhase,
              resultingStability,
              reDiagnosisRequired,
              evidenceReason: reason,
              dimensions,
              nextAction,
              constraint,
              repRows: compatibilitySummary.repRows,
            };
          };

          const computeHandoverRediagnosisSummary = (
            startingPhase: TopicPhase,
            previousStability: TopicStability,
            blocks: Array<{
              phase: TopicPhase;
              setName: string;
              observations: Array<Record<string, string>>;
            }>
          ) => {
            const diagnosisSummary = computeAdaptiveDiagnosisSummary(startingPhase, blocks);
            const nextActionConfig =
              (NEXT_ACTION_ENGINE as any)?.[diagnosisSummary.phase]?.[diagnosisSummary.stability] || null;

            return {
              phase: startingPhase,
              previousStability,
              verificationScore: diagnosisSummary.diagnosisScore,
              verificationOutcome: "targeted_re_diagnosis_completed" as const,
              verificationOutcomeLabel: "Targeted re-diagnosis completed",
              confidence: "normal" as const,
              resultingPhase: diagnosisSummary.phase,
              resultingStability: diagnosisSummary.stability as TopicStability,
              reDiagnosisRequired: false,
              nextAction:
                diagnosisSummary.nextAction ||
                nextActionConfig?.primaryAction ||
                "Continue from the re-diagnosed topic state.",
              constraint: diagnosisSummary.constraint || nextActionConfig?.rules?.[0] || null,
              repRows: diagnosisSummary.phaseChecks.flatMap((check: any) => check.repRows),
              startingPhase: diagnosisSummary.startingPhase,
              pathLength: diagnosisSummary.pathLength,
              phaseChecks: diagnosisSummary.phaseChecks,
              finalBand: diagnosisSummary.finalBand,
              finalBandLabel: diagnosisSummary.finalBandLabel,
            };
          };

          const computeTrainingSessionSummary = (
            observedPhase: "Clarity" | "Structured Execution" | "Controlled Discomfort" | "Time Pressure Stability",
            previousStability: "Low" | "Medium" | "High" | "High Maintenance",
            sets: Array<{ setName: string; observations: Array<Record<string, string>> }>,
            priorConsecutiveLows = 0
          ) => {
            const phaseWeights = INTRO_PHASE_WEIGHTS[observedPhase];
            const repRows: Array<{ set: string; rep: number; repScore: number }> = [];
            const setScores: number[] = [];
            let highGuardPasses = true;

            const scoredSets =
              observedPhase === "Clarity"
                ? sets.slice(1, 3)
                : sets.slice(0, 3);

            scoredSets.forEach((set) => {
              const repScores = (set.observations || []).map((repObs, repIndex) => {
                const score = phaseWeights.reduce((sum, field) => {
                  const rawValue = resolveObservationValue(repObs, field.aliases);
                  const level = observationLevelFor(rawValue);
                  return sum + weightedScoreFor(field.weight, level);
                }, 0);

                const normalizedRepScore = Math.max(0, Math.min(100, Math.round(score)));
                repRows.push({
                  set: set.setName,
                  rep: repIndex + 1,
                  repScore: normalizedRepScore,
                });
                return normalizedRepScore;
              });

              const setScore = repScores.length > 0
                ? Math.round(repScores.reduce((sum, value) => sum + value, 0) / repScores.length)
                : 0;
              setScores.push(setScore);

              if (observedPhase === "Clarity") {
                const repHasZeroField = (set.observations || []).some((repObs) =>
                  phaseWeights.some((field) => {
                    const rawValue = resolveObservationValue(repObs, field.aliases);
                    return weightedScoreFor(field.weight, observationLevelFor(rawValue)) === 0;
                  })
                );
                if (repHasZeroField) highGuardPasses = false;
              }

              if (observedPhase === "Structured Execution") {
                const repViolates = (set.observations || []).some((repObs) => {
                  const step = String(repObs?.stepExecution || repObs?.step_execution || "").toLowerCase();
                  const start = String(repObs?.startBehavior || repObs?.start_behavior || "").toLowerCase();
                  return step.includes("guess") || start.includes("avoid");
                });
                if (repViolates) highGuardPasses = false;
              }

              if (observedPhase === "Controlled Discomfort") {
                const repViolates = (set.observations || []).some((repObs) => {
                  const initial = String(repObs?.initialResponse || repObs?.initial_boss_response || "").toLowerCase();
                  const firstStep = String(repObs?.firstStepControl || repObs?.first_step_control || "").toLowerCase();
                  return initial.includes("avoid") || initial.includes("froze") || firstStep.includes("could not");
                });
                if (repViolates) highGuardPasses = false;
              }

              if (observedPhase === "Time Pressure Stability") {
                const repViolates = (set.observations || []).some((repObs) => {
                  const structure = String(repObs?.structureUnderTime || repObs?.structure_under_time || "").toLowerCase();
                  const pace = String(repObs?.paceControl || repObs?.pace_control || "").toLowerCase();
                  return !structure.includes("maintained") || !pace.includes("controlled");
                });
                if (repViolates) highGuardPasses = false;
              }
            });

            const setWeights = observedPhase === "Clarity" ? [2, 2] : [1, 2, 2];
            const weighted = setScores.reduce(
              (acc, score, idx) => {
                const w = setWeights[idx] || 1;
                return {
                  sum: acc.sum + score * w,
                  weight: acc.weight + w,
                };
              },
              { sum: 0, weight: 0 }
            );

            const sessionScore = weighted.weight > 0
              ? Math.round(weighted.sum / weighted.weight)
              : 0;

            // Evidence-native training is the live authority. Numeric scoring remains
            // available for compatibility analytics and score-vs-evidence comparison only.
            const evidenceEvaluation = evaluateTrainingEvidence({
              phase: observedPhase,
              previousStability,
              sets: sets as any,
            });

            if (evidenceEvaluation.status !== "evaluated") {
              throw new Error(
                `Training evidence cannot authorize live state: ${evidenceEvaluation.reason}`,
              );
            }

            // Preserve the former score decision only as a proof comparison. It must not
            // authorize topic state, next action, snapshots, ledger state, or reporting lineage.
            const legacyTransitionResult = computeTransition(
              observedPhase,
              previousStability,
              sessionScore,
            );
            const legacyTransition = {
              nextPhase: legacyTransitionResult.next_phase,
              nextStability: legacyTransitionResult.next_stability,
              transitionReason: normalizeTransitionReason(legacyTransitionResult.transition_reason),
            };
            const evidenceShadowComparison = compareTrainingEvidenceShadowToLegacy({
              sessionScore,
              legacyTransition,
              evidenceShadow: evidenceEvaluation,
            });

            const authorityRoute =
              resolveTrainingEvidenceAuthorityRoute(evidenceEvaluation);
            const requiresTargetedRediagnosis =
              authorityRoute.route === "targeted_rediagnosis";
            const nextActionConfig = requiresTargetedRediagnosis
              ? null
              : (NEXT_ACTION_ENGINE as any)?.[authorityRoute.nextPhase]?.[
                  authorityRoute.nextStability
                ] || null;
            const nextAction = requiresTargetedRediagnosis
              ? `Run targeted evidence-native re-diagnosis beginning at ${authorityRoute.targetPhase || observedPhase}.`
              : nextActionConfig?.primaryAction || null;
            const constraint = requiresTargetedRediagnosis
              ? "Do not continue ordinary Training for this topic until evidence-native re-diagnosis establishes a trustworthy entry state."
              : nextActionConfig?.rules?.[0] || null;

            return {
              observedPhase,
              previousStability,
              observedStability: evidenceEvaluation.observedStability,
              phase: authorityRoute.nextPhase,
              stability: authorityRoute.nextStability,
              transitionReason: authorityRoute.transitionReason,
              phaseDecision: requiresTargetedRediagnosis
                ? "re-diagnose"
                : authorityRoute.transitionReason === "phase progress"
                  ? "advance"
                  : authorityRoute.transitionReason === "stability regress"
                    ? "regress"
                    : "remain",
              sessionScore,
              decisionAuthority: "evidence_native" as const,
              nextAction,
              constraint,
              requiresTargetedRediagnosis,
              targetedRediagnosisStartPhase: requiresTargetedRediagnosis
                ? authorityRoute.targetPhase
                : null,
              prerequisiteContradiction: evidenceEvaluation.prerequisiteContradiction,
              repRows,
              setScores,
              highGuardPasses,
              evidence: evidenceEvaluation,
              // Compatibility alias retained for the immutable historical comparison dataset.
              evidenceShadow: evidenceEvaluation,
              evidenceShadowComparison,
              lowStreakAfterSession: 0, // No longer used in new transition engine
            };
          };

          const isResponseSnapshotV1 = (value: any) =>
            !!value &&
            typeof value === "object" &&
            value.version === "response-snapshot-v1" &&
            !!value.source &&
            typeof value.source === "object" &&
            !!value.drill &&
            typeof value.drill === "object" &&
            Array.isArray(value.sets);

          const mapDrillRowToDeterministicSession = (row: any) => {
            const extractObservationSignalsFromDrill = (drillPayload: any): ObservationSignal[] => {
              const signals: ObservationSignal[] = [];
              const sets = Array.isArray(drillPayload?.drill?.sets)
                ? drillPayload.drill.sets
                : Array.isArray(drillPayload?.sets)
                ? drillPayload.sets
                : [];

              sets.forEach((set: any) => {
                (Array.isArray(set?.observations) ? set.observations : []).forEach((observation: any) => {
                  if (!observation || typeof observation !== "object") return;
                  const levelEntries = Object.entries(observation).filter(([key, value]) =>
                    key.endsWith("_level") && value !== null && value !== undefined && String(value).trim()
                  );

                  if (levelEntries.length > 0) {
                    levelEntries.forEach(([key, value]) => {
                      signals.push({
                        key: key.replace(/_level$/i, ""),
                        value: String(value),
                      });
                    });
                    return;
                  }

                  Object.entries(observation).forEach(([key, value]) => {
                    if (value !== null && value !== undefined && String(value).trim()) {
                      signals.push({ key, value: String(value) });
                    }
                  });
                });
              });

              return signals;
            };

            const buildBehaviorSummary = (signals: ObservationSignal[], context: string, stability?: string) => {
              const labels = normalizeBehaviorLabelsForContext(
                mapObservationsToBehavior(signals).filter(
                  (behavior) => behavior !== "no mapped observation signal detected"
                ),
                "absolute"
              );
              if (labels.length === 0) {
                return `No mapped observation pattern was detected during ${context}.`;
              }

              const stabilityNormalized = String(stability || "").trim();

              const toVerbPhrase = (label: string) => {
                const l = String(label || "").trim();
                const lower = l.toLowerCase();

                if (stabilityNormalized === "High") {
                  return `showed ${lower}`;
                }

                if (stabilityNormalized === "Medium") {
                  // neutral, descriptive phrasing without implying progress
                  if (/^clear(er)?\s+/i.test(lower)) {
                    return `demonstrated ${lower.replace(/^clear(er)?\s+/i, "")}`;
                  }
                  return `demonstrated ${lower}`;
                }

                // Low or unknown -> cautious / limited phrasing
                if (stabilityNormalized === "Low") {
                  if (/^clear(er)?\s+/i.test(lower)) {
                    return `had limited ${lower.replace(/^clear(er)?\s+/i, "")}`;
                  }
                  return `${lower} was limited`;
                }

                // default (no stability): keep original neutral show
                return `showed ${lower}`;
              };

              const verbPhrases = labels.map(toVerbPhrase);
              // join verb phrases into a readable sentence fragment
              const combined = verbPhrases.length === 1 ? verbPhrases[0] : naturalJoin(verbPhrases);
              return `The student ${combined} during ${context}.`;
            };

            const rawBehaviorPatterns = (signals: ObservationSignal[]) =>
              mapObservationsToBehavior(signals).filter(
                (behavior) => behavior !== "no mapped observation signal detected"
              );

            let parsed: any = null;
            try {
              parsed = row?.drill && typeof row.drill === "object"
                ? row.drill
                : JSON.parse(typeof row?.drill === "string" ? row.drill : "{}");
            } catch {
              parsed = null;
            }

            if (!parsed || typeof parsed !== "object") return null;

            const responseEvidenceSignals = extractAuthoritativeResponseEvidenceSignals(parsed);
            const hasAuthoritativeResponseEvidence = responseEvidenceSignals.length > 0;
            const authoritativeBehaviorPatterns = reportClaimLabelsFromEvidence(responseEvidenceSignals);
            const authoritativeBehaviorSummary = (() => {
              if (!hasAuthoritativeResponseEvidence) return "";
              const strong = responseEvidenceSignals.filter((signal) => signal.polarity === "strong");
              const weak = responseEvidenceSignals.filter((signal) => signal.polarity === "weak");
              const conditional = responseEvidenceSignals.filter((signal) => signal.polarity === "conditional");
              const recovered = strong.filter((signal) => signal.recoveredAfterBreakdown);

              const parts = [
                ...recovered.map((signal) => `recovered to ${signal.label}`),
                ...strong.filter((signal) => !signal.recoveredAfterBreakdown).map((signal) => signal.label),
                ...weak.map((signal) => signal.label),
                ...conditional.map((signal) => signal.label),
              ];
              const unique = Array.from(new Set(parts.filter(Boolean)));
              return unique.length > 0
                ? `Evidence resolved as ${naturalJoin(unique.slice(0, 4))}.`
                : "No decision-eligible strength or breakdown claim was established from this evidence.";
            })();

            const normalizedDrillType = String(parsed.drillType || "diagnosis").trim().toLowerCase();
            const drillType =
              normalizedDrillType === "training"
                ? "training"
                : normalizedDrillType === "handover_verification"
                  ? "handover_verification"
                  : "diagnosis";

            if (drillType === "handover_verification") {
              return null;
            }

            if (drillType === "diagnosis") {
              const topic = String(parsed.introTopic || parsed.trainingTopic || "").trim();
              const diagnosisPhase = parseAuthoritativePhase(parsed.phase || parsed.summary?.phase);
              if (!diagnosisPhase) return null;
              const stability = normalizeStability(parsed.summary?.stability || "Low");
              const diagnosisScore = Number(parsed.summary?.diagnosisScore ?? 0);
              const trainingEntryPhase = deriveTrainingEntryPhase(diagnosisPhase, stability);
              const nextAction = String(
                parsed.summary?.nextAction ||
                NEXT_ACTION_ENGINE[diagnosisPhase]?.[stability]?.primaryAction ||
                ""
              ).trim();
              const constraint = String(
                parsed.summary?.constraint ||
                NEXT_ACTION_ENGINE[diagnosisPhase]?.[stability]?.rules?.[0] ||
                ""
              ).trim() || null;
              const observationSignals = extractObservationSignalsFromDrill(parsed);
              const snapshotBehaviorSummary = summarizeSnapshotObservedResponse(parsed.responseSnapshot);
              const transitionReason: TransitionReason = "remain";

              return {
                id: row.id,
                date: row.submitted_at,
                duration: 0,
                sessionGroupId: String(parsed.sessionId || row.id),
                topic,
                drillType: "diagnosis",
                responseSnapshot: isResponseSnapshotV1(parsed.responseSnapshot) ? parsed.responseSnapshot : null,
                responseEvidenceSignals,
                behaviorPatterns: hasAuthoritativeResponseEvidence
                  ? authoritativeBehaviorPatterns
                  : rawBehaviorPatterns(observationSignals),
                score: diagnosisScore,
                phaseBefore: diagnosisPhase,
                phaseAfter: trainingEntryPhase,
                stabilityBefore: stability,
                stabilityAfter: stability,
                nextAction,
                transitionReason,
                deterministicLog: {
                  topicFocus: `This session focused on ${topic}, targeting baseline diagnosis in ${diagnosisPhase}.`,
                  whatWasTrained: `A diagnosis drill was used to identify ${DRILL_PURPOSE_BY_PHASE[diagnosisPhase] || "phase-specific response patterns"}.`,
                  behaviorSummary: hasAuthoritativeResponseEvidence
                    ? authoritativeBehaviorSummary
                    : snapshotBehaviorSummary || buildBehaviorSummary(observationSignals, "diagnosis", stability),
                  performanceResult: describePerformanceResult({
                    phaseBefore: diagnosisPhase,
                    phaseAfter: trainingEntryPhase,
                    stabilityAfter: stability,
                    score: diagnosisScore,
                    transitionReason,
                  }),
                  stateMovement: describeSessionMovement({
                    phaseBefore: diagnosisPhase,
                    phaseAfter: trainingEntryPhase,
                    stabilityBefore: stability,
                    stabilityAfter: stability,
                    transitionReason,
                  }),
                  transitionReason,
                  whatThisMeans: buildTutorMeaning({
                    phaseBefore: diagnosisPhase,
                    phaseAfter: trainingEntryPhase,
                    stabilityAfter: stability,
                    transitionReason,
                    drillType: "diagnosis",
                  }),
                  nextMove: nextAction,
                  summaryText: `This session focused on ${topic}, targeting baseline diagnosis in ${diagnosisPhase}.`,
                  drillLabel: `Intro Diagnosis (${diagnosisPhase})`,
                  score: diagnosisScore,
                  stability,
                  constraint,
                  practiceAssigned: `Prepare the next ${trainingEntryPhase} drill cycle for ${topic}.`,
                },
              };
            }

            const topic = String(parsed.trainingTopic || parsed.introTopic || "").trim();
            const observedPhase = parseAuthoritativePhase(parsed.phase || parsed.summary?.observedPhase);
            const resultingPhase = parseAuthoritativePhase(parsed.summary?.phase || observedPhase);
            if (!observedPhase || !resultingPhase) return null;
            const stability = normalizeStability(parsed.summary?.stability || "Low");
            const previousStability = normalizeStability(parsed.summary?.previousStability || stability);
            const sessionScore = Number(parsed.summary?.sessionScore ?? 0);
            const phaseDecision = String(parsed.summary?.phaseDecision || "remain").toLowerCase();
            const transitionReason = resolveTransitionReason({
              storedReason: parsed.summary?.transitionReason || parsed.summary?.transition_reason,
              phaseDecision,
            });
            const nextAction = String(
              parsed.summary?.nextAction ||
              NEXT_ACTION_ENGINE[resultingPhase]?.[stability]?.primaryAction ||
              ""
            ).trim();
            const constraint = String(
              parsed.summary?.constraint ||
              NEXT_ACTION_ENGINE[resultingPhase]?.[stability]?.rules?.[0] ||
              ""
            ).trim() || null;
            const observationSignals = extractObservationSignalsFromDrill(parsed);
            const snapshotBehaviorSummary = summarizeSnapshotObservedResponse(parsed.responseSnapshot);

              return {
                id: row.id,
                date: row.submitted_at,
                duration: 0,
                sessionGroupId: String(parsed.sessionId || row.id),
                topic,
                drillType: "training",
                responseSnapshot: isResponseSnapshotV1(parsed.responseSnapshot) ? parsed.responseSnapshot : null,
                responseEvidenceSignals,
                behaviorPatterns: hasAuthoritativeResponseEvidence
                  ? authoritativeBehaviorPatterns
                  : rawBehaviorPatterns(observationSignals),
                score: sessionScore,
                phaseBefore: observedPhase,
                phaseAfter: resultingPhase,
              stabilityBefore: previousStability,
              stabilityAfter: stability,
              nextAction,
              transitionReason,
                deterministicLog: {
                topicFocus: `This session focused on ${topic}, targeting ${observedPhase} phase skills.`,
                  whatWasTrained: `A training drill was used to train ${DRILL_PURPOSE_BY_PHASE[observedPhase] || "phase-specific behavior"}.`,
                  behaviorSummary: hasAuthoritativeResponseEvidence
                    ? authoritativeBehaviorSummary
                    : snapshotBehaviorSummary || buildBehaviorSummary(observationSignals, "the drill", stability),
                  performanceResult: describePerformanceResult({
                    phaseBefore: observedPhase,
                    phaseAfter: resultingPhase,
                    stabilityAfter: stability,
                    score: sessionScore,
                    transitionReason,
                  }),
                  stateMovement: describeSessionMovement({
                    phaseBefore: observedPhase,
                    phaseAfter: resultingPhase,
                    stabilityBefore: previousStability,
                    stabilityAfter: stability,
                    transitionReason,
                  }),
                  transitionReason,
                  whatThisMeans: buildTutorMeaning({
                    phaseBefore: observedPhase,
                    phaseAfter: resultingPhase,
                    stabilityAfter: stability,
                    transitionReason,
                    drillType: "training",
                  }),
                nextMove: nextAction,
                summaryText: `This session focused on ${topic}, targeting ${observedPhase} phase skills.`,
                drillLabel: `Training Drill (${observedPhase})`,
                score: sessionScore,
                stability,
                constraint,
                practiceAssigned: `Prepare the next ${resultingPhase} drill cycle for ${topic}.`,
              },
            };
          };

          const aggregateDeterministicSessions = (drillRows: any[]) => {
            const mappedSessions = (drillRows || [])
              .map((row: any) => {
                const mappedSession = mapDrillRowToDeterministicSession(row);
                if (!mappedSession?.deterministicLog) return null;

                const reportDate = resolveReportAnchorDate(row, mappedSession);
                return {
                  ...mappedSession,
                  date: reportDate || mappedSession.date,
                  sessionGroupId: String(
                    row?.report_scheduled_session_id ||
                      resolveScheduledSessionIdFromDrillRow(row) ||
                      mappedSession.sessionGroupId ||
                      mappedSession.id,
                  ),
                };
              })
              .filter(Boolean) as any[];

            const groupedSessions = mappedSessions.reduce((acc: Record<string, any[]>, session: any) => {
              const key = String(session.sessionGroupId || session.id);
              if (!acc[key]) acc[key] = [];
              acc[key].push(session);
              return acc;
            }, {});

            return Object.entries(groupedSessions)
              .map(([groupId, entries]) => {
                const sortedEntries = [...(entries as any[])].sort(
                  (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                );

                if (sortedEntries.length === 1) {
                  const [single] = sortedEntries;
                  return {
                    ...single,
                    id: groupId,
                  };
                }

                const topics = Array.from(new Set(sortedEntries.map((entry) => String(entry.topic || "").trim()).filter(Boolean)));
                const topicCount = topics.length;
                const sessionTypes = Array.from(new Set(sortedEntries.map((entry) => String(entry.drillType || "").trim()).filter(Boolean)));
                const containsDiagnosis = sessionTypes.includes("diagnosis");
                const containsTraining = sessionTypes.includes("training");
                const behaviorLines = sortedEntries.map((entry) => {
                  const snapshotSummary = String(entry.deterministicLog?.behaviorSummary || "").trim();
                  const behaviors = snapshotSummary
                    || (Array.isArray(entry.behaviorPatterns) && entry.behaviorPatterns.length > 0
                      ? naturalJoin(entry.behaviorPatterns)
                      : "no mapped observation pattern detected");
                  return `${entry.topic}: ${behaviors}`;
                });
                const performanceLines = sortedEntries.map((entry) =>
                  `${entry.topic}: ${entry.phaseBefore} / ${entry.stabilityBefore} -> ${entry.phaseAfter} / ${entry.stabilityAfter}`
                );
                const stateMovementLines = sortedEntries.map((entry) =>
                  `${entry.topic}: ${entry.deterministicLog?.stateMovement || "State recorded"}`
                );
                const meaningLines = sortedEntries.map((entry) =>
                  `${entry.topic}: ${entry.deterministicLog?.whatThisMeans || "State interpretation recorded"}`
                );
                const nextMoveLines = sortedEntries.map((entry) =>
                  `${entry.topic}: ${entry.nextAction || entry.deterministicLog?.nextMove || "Continue current drill"}`
                );
                const trainedLines = sortedEntries.map((entry) =>
                  `${entry.topic}: ${DRILL_PURPOSE_BY_PHASE[entry.phaseBefore] || "phase-specific behavior"}`
                );

                return {
                  id: groupId,
                  sessionGroupId: groupId,
                  date: sortedEntries[0].date,
                  duration: 0,
                  topic: topics[0] || "Unknown topic",
                  drillType: sessionTypes.length === 1 ? sessionTypes[0] : "mixed",
                  responseSnapshots: sortedEntries.map((entry) => entry.responseSnapshot).filter(Boolean),
                  responseEvidenceSignals: sortedEntries.flatMap((entry) =>
                    Array.isArray(entry.responseEvidenceSignals) ? entry.responseEvidenceSignals : []
                  ),
                  sessionTypes,
                  containsDiagnosis,
                  containsTraining,
                  deterministicLog: {
                    topicFocus: `This session covered: ${naturalJoin(topics)}.`,
                    whatWasTrained: containsDiagnosis && !containsTraining
                      ? `Diagnosis evidence was collected for:\n- ${trainedLines.join("\n- ")}`
                      : containsDiagnosis
                        ? `Diagnosis and training evidence were recorded for:\n- ${trainedLines.join("\n- ")}`
                        : `Drills were run to train:\n- ${trainedLines.join("\n- ")}`,
                    behaviorSummary: `Across ${topicCount} ${topicCount === 1 ? "topic" : "topics"}:\n- ${behaviorLines.join("\n- ")}`,
                    performanceResult: `Performance by topic:\n- ${performanceLines.join("\n- ")}`,
                    stateMovement: `State movement by topic:\n- ${stateMovementLines.join("\n- ")}`,
                    whatThisMeans: `Interpretation by topic:\n- ${meaningLines.join("\n- ")}`,
                    nextMove: `Next moves:\n- ${nextMoveLines.join("\n- ")}`,
                    summaryText: `This session covered ${naturalJoin(topics)} across ${sortedEntries.length} drills.`,
                    drillLabel: `${containsDiagnosis && containsTraining ? "Mixed Conditioning Session" : containsDiagnosis ? "Diagnosis Session" : "Training Session"} (${topicCount} ${topicCount === 1 ? "topic" : "topics"})`,
                    score: Math.round(
                      sortedEntries.reduce((sum, entry) => sum + Number(entry.score || 0), 0) / Math.max(sortedEntries.length, 1)
                    ),
                    stability: "Multi-topic",
                    constraint: null,
                    practiceAssigned: `Prepare the next drill cycle for ${naturalJoin(topics)}.`,
                  },
                };
              })
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          };

          const resolveScheduledSessionIdFromDrillRow = (row: any) => {
            const direct = String(row?.report_scheduled_session_id || row?.scheduled_session_id || "").trim();
            if (direct) return direct;

            const parsed = parseStoredDrillPayload(row?.drill);
            const embedded = String(parsed?.scheduledSessionId || "").trim();
            return embedded || null;
          };

          const resolveReportAnchorDate = (row: any, mappedSession?: any) =>
            String(row?.report_anchor_time || mappedSession?.date || row?.submitted_at || "").trim();

          const attachReportAnchorTimes = async (drillRows: any[]) => {
            const rows = Array.isArray(drillRows) ? drillRows : [];
            const scheduledSessionIds = Array.from(
              new Set(
                rows
                  .map((row) => resolveScheduledSessionIdFromDrillRow(row))
                  .filter((value): value is string => !!value),
              ),
            );

            if (scheduledSessionIds.length === 0) {
              return rows;
            }

            let scheduledSessions: any[] = [];
            if (isEmergencyDbMode()) {
              const scheduledResult = await pool.query(
                `SELECT id::text AS id, scheduled_time
                   FROM public.scheduled_sessions
                  WHERE id::text = ANY($1::text[])`,
                [scheduledSessionIds],
              );
              scheduledSessions = scheduledResult.rows || [];
            } else {
              const { data, error: scheduledSessionsError } = await supabase
                .from("scheduled_sessions")
                .select("id, scheduled_time")
                .in("id", scheduledSessionIds);

              if (scheduledSessionsError) {
                return rows;
              }
              scheduledSessions = data || [];
            }

            if (!scheduledSessions.length) {
              return rows;
            }

            const scheduledTimeById = new Map<string, string>();
            for (const session of scheduledSessions) {
              const sessionId = String(session?.id || "").trim();
              const scheduledTime = String(session?.scheduled_time || "").trim();
              if (sessionId && scheduledTime) {
                scheduledTimeById.set(sessionId, scheduledTime);
              }
            }

            return rows.map((row) => {
              const scheduledSessionId = resolveScheduledSessionIdFromDrillRow(row);
              const reportAnchorTime = scheduledSessionId ? scheduledTimeById.get(scheduledSessionId) : null;
              return {
                ...row,
                report_scheduled_session_id: scheduledSessionId,
                report_anchor_time: reportAnchorTime || row?.report_anchor_time || row?.submitted_at,
              };
            });
          };

          const mapDeterministicSessionsForReport = (drillRows: any[]) =>
            (drillRows || [])
              .map((row: any) => {
                const mappedSession = mapDrillRowToDeterministicSession(row);
                if (!mappedSession?.deterministicLog) return null;

                const reportDate = resolveReportAnchorDate(row, mappedSession);
                const scheduledSessionId = resolveScheduledSessionIdFromDrillRow(row);

                return {
                  ...mappedSession,
                  date: reportDate || mappedSession.date,
                  sessionGroupId: String(
                    row?.report_scheduled_session_id ||
                      scheduledSessionId ||
                      mappedSession.sessionGroupId ||
                      mappedSession.id,
                  ),
                };
              })
              .filter((session: any) => !!session?.deterministicLog);

          const buildSessionAwareWeeklyWindows = (drillRows: any[]) => {
            const groupedSessions = (drillRows || []).reduce((acc: Record<string, { date: string; rows: any[] }>, row: any) => {
              const mappedSession = mapDrillRowToDeterministicSession(row);
              if (!mappedSession?.deterministicLog) return acc;

              const key = String(
                row?.report_scheduled_session_id ||
                  resolveScheduledSessionIdFromDrillRow(row) ||
                  mappedSession.sessionGroupId ||
                  mappedSession.id ||
                  row.id,
              );
              const reportDate = resolveReportAnchorDate(row, mappedSession);
              if (!acc[key]) {
                acc[key] = {
                  date: reportDate || mappedSession.date || row.submitted_at,
                  rows: [],
                };
              }

              acc[key].rows.push(row);

              if (new Date(reportDate || mappedSession.date).getTime() < new Date(acc[key].date).getTime()) {
                acc[key].date = reportDate || mappedSession.date;
              }

              return acc;
            }, {});

            const orderedSessions = Object.values(groupedSessions) as Array<{ date: string; rows: any[] }>;
            orderedSessions.sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            const weeklyWindows: any[][] = [];
            for (let i = 0; i + 1 < orderedSessions.length; i += 2) {
              weeklyWindows.push([
                ...orderedSessions[i].rows,
                ...orderedSessions[i + 1].rows,
              ]);
            }

            return weeklyWindows;
          };

          const buildSessionAwareMonthlyWindows = (drillRows: any[]) => {
            const groupedSessions = (drillRows || []).reduce((acc: Record<string, { date: string; rows: any[] }>, row: any) => {
              const mappedSession = mapDrillRowToDeterministicSession(row);
              if (!mappedSession?.deterministicLog) return acc;

              const key = String(
                row?.report_scheduled_session_id ||
                  resolveScheduledSessionIdFromDrillRow(row) ||
                  mappedSession.sessionGroupId ||
                  mappedSession.id ||
                  row.id,
              );
              const reportDate = resolveReportAnchorDate(row, mappedSession);
              if (!acc[key]) {
                acc[key] = {
                  date: reportDate || mappedSession.date || row.submitted_at,
                  rows: [],
                };
              }

              acc[key].rows.push(row);

              if (new Date(reportDate || mappedSession.date).getTime() < new Date(acc[key].date).getTime()) {
                acc[key].date = reportDate || mappedSession.date;
              }

              return acc;
            }, {});

            const orderedSessions = Object.values(groupedSessions) as Array<{ date: string; rows: any[] }>;
            orderedSessions.sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            const monthlyWindows: any[][] = [];
            for (let i = 0; i + 7 < orderedSessions.length; i += 8) {
              monthlyWindows.push(orderedSessions.slice(i, i + 8).flatMap((session) => session.rows));
            }

            return monthlyWindows;
          };

          const DRILL_PURPOSE_BY_PHASE: Record<string, string> = {
            Clarity: "the four-layer mental model: what the problem is, how to solve it, why it works, and applying that clarity",
            "Structured Execution": "following steps independently",
            "Controlled Discomfort": "staying stable under difficulty",
            "Time Pressure Stability": "maintaining structure under time",
          };

          const naturalJoin = (items: string[]) => {
            const clean = items.map((item) => String(item || "").trim()).filter(Boolean);
            if (clean.length === 0) return "";
            if (clean.length === 1) return clean[0];
            if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
            return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
          };

          const normalizeTransitionReason = (value: unknown): TransitionReason => {
            const reason = String(value || "").trim().toLowerCase();
            if (reason === "phase progress") return "phase progress";
            if (reason === "stability advance") return "stability advance";
            if (reason === "stability regress") return "stability regress";
            return "remain";
          };

          const resolveTransitionReason = ({
            storedReason,
            phaseDecision,
          }: {
            storedReason?: unknown;
            phaseDecision?: unknown;
          }): TransitionReason => {
            const normalizedStoredReason = normalizeTransitionReason(storedReason);
            if (normalizedStoredReason !== "remain" || String(storedReason || "").trim()) {
              return normalizedStoredReason;
            }

            const decision = String(phaseDecision || "").trim().toLowerCase();
            if (decision === "advance") return "phase progress";
            if (decision === "regress") return "stability regress";
            return "remain";
          };

          const transitionReasonToSessionMovement = (reason: TransitionReason) => {
            if (reason === "phase progress") return "phase progressed";
            if (reason === "stability advance") return "improved";
            if (reason === "stability regress") return "regressed";
            return "remained";
          };

          const transitionReasonToWeeklyMovement = (reasons: TransitionReason[]) => {
            if (reasons.includes("phase progress")) return "introduced next phase";
            if (reasons.includes("stability advance")) return "improved stability";
            return "reinforced phase";
          };

          const transitionReasonToMonthlyOutcome = (reasons: TransitionReason[]) => {
            if (reasons.includes("phase progress")) return "advanced";
            if (reasons.includes("stability advance")) return "improved";
            if (reasons.includes("stability regress")) return "regressed";
            return "held";
          };

          const getBehaviorBuckets = (behaviors: string[]) => {
            const weak = behaviors.filter((behavior) =>
              /breakdown|dependence|hesitation|delayed|pace loss|inconsistent/i.test(behavior)
            );
            const strong = behaviors.filter((behavior) => !weak.includes(behavior));
            return { weak, strong };
          };

          const countBehaviorLabels = (behaviors: string[]) => {
            return behaviors.reduce((acc: Record<string, number>, behavior: string) => {
              acc[behavior] = (acc[behavior] || 0) + 1;
              return acc;
            }, {});
          };

          const summarizeBehaviorLabels = (behaviors: string[], limit = 2) => {
            const counts = countBehaviorLabels(behaviors);
            return Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, Math.max(1, limit))
              .map(([label]) => label);
          };

          const buildBehaviorShiftSummary = (
            earlyBehaviors: string[],
            lateBehaviors: string[],
            fallback: string
          ) => {
            const earlyCounts = countBehaviorLabels(earlyBehaviors);
            const lateCounts = countBehaviorLabels(lateBehaviors);
            const { weak: earlyWeak, strong: earlyStrong } = getBehaviorBuckets(earlyBehaviors);
            const { weak: lateWeak, strong: lateStrong } = getBehaviorBuckets(lateBehaviors);

            const reducedWeak = Array.from(new Set(earlyWeak)).filter(
              (label) => (lateCounts[label] || 0) < (earlyCounts[label] || 0)
            );
            const strengthened = Array.from(new Set(lateStrong)).filter(
              (label) => (lateCounts[label] || 0) > (earlyCounts[label] || 0) || !earlyStrong.includes(label)
            );

            const summaryParts = [
              ...reducedWeak.slice(0, 2).map((label) => `less ${label}`),
              ...strengthened.slice(0, 2),
            ];

            return summaryParts.length > 0 ? naturalJoin(summaryParts) : fallback;
          };

          const ABSOLUTE_BEHAVIOR_LABELS: Record<string, string> = {
            "clearer concept recall": "clear concept recall",
            "more reliable step execution": "reliable step execution",
            "more independent execution": "independent execution",
            "earlier independent starts": "independent starts",
            "better control under difficulty": "control under difficulty",
            "stronger structure retention": "structure retention",
            "more controlled pace": "controlled pace",
          };

          const toAbsoluteBehaviorLabel = (label: string) =>
            ABSOLUTE_BEHAVIOR_LABELS[String(label || "").trim().toLowerCase()] || String(label || "").trim();

          const normalizeBehaviorLabelsForContext = (labels: string[], mode: "absolute" | "comparative") =>
            labels
              .map((label) => (mode === "absolute" ? toAbsoluteBehaviorLabel(label) : String(label || "").trim()))
              .filter(Boolean);
          const capitalizeFirst = (text: string) =>
            text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
          const formatTopicScopedLine = (topic: string, content: string, includeTopic: boolean) =>
            includeTopic ? `${topic}: ${content}` : capitalizeFirst(content);
          const formatSingleTopicMovementLine = (content: string) => {
            const normalized = String(content || "").trim();
            if (!normalized) return "";
            if (/^(moved|remained|advanced)\b/i.test(normalized)) {
              return capitalizeFirst(normalized);
            }
            const withoutTopicPrefix = normalized.replace(/^[^:]+:\s*/, "");
            return capitalizeFirst(withoutTopicPrefix);
          };
          const describeStrengthSignal = (signal: string) => {
            const normalized = String(signal || "").trim().toLowerCase();
            if (normalized === "clear concept recall") return "recognition is clearer";
            if (normalized === "reliable step execution") return "execution is now more reliable";
            if (normalized === "independent execution") return "independent execution is holding more consistently";
            if (normalized === "independent starts") return "independent starts are holding more consistently";
            if (normalized === "control under difficulty") return "control under difficulty is holding more consistently";
            if (normalized === "structure retention") return "structure is holding more consistently";
            if (normalized === "controlled pace") return "pace control is holding more consistently";
            return normalized;
          };
          const buildMonthlyStrengthLine = (topic: string, strongSignals: string[], includeTopic: boolean) => {
            if (strongSignals.length === 0) return "";
            const [first, second] = strongSignals.map(describeStrengthSignal);
            const content = second ? `${first}, with ${second}` : first;
            return formatTopicScopedLine(topic, content, includeTopic);
          };

          const isFinalPhaseMaintenanceState = (phase: string, stability: string) =>
            phase === "Time Pressure Stability" && stability === "High Maintenance";

          const didPhaseProgress = ({
            phaseBefore,
            phaseAfter,
            transitionReason,
          }: {
            phaseBefore: string;
            phaseAfter: string;
            transitionReason: TransitionReason;
          }) => transitionReason === "phase progress" && phaseBefore !== phaseAfter;

          const describePerformanceResult = ({
            phaseBefore,
            phaseAfter,
            stabilityAfter,
            transitionReason,
          }: {
            phaseBefore: string;
            phaseAfter: string;
            stabilityAfter: string;
            score?: number;
            transitionReason: TransitionReason;
          }) => {
            if (didPhaseProgress({ phaseBefore, phaseAfter, transitionReason })) {
              return `Evidence established movement into ${phaseAfter}, with current stability at ${stabilityAfter}.`;
            }
            if (isFinalPhaseMaintenanceState(phaseAfter, stabilityAfter)) {
              return `Evidence confirmed ${phaseAfter} at ${stabilityAfter}.`;
            }
            return `Evidence places the current response at ${phaseAfter} / ${stabilityAfter}.`;
          };

          const describeSessionMovement = ({
            phaseBefore,
            phaseAfter,
            stabilityBefore,
            stabilityAfter,
            transitionReason,
          }: {
            phaseBefore: string;
            phaseAfter: string;
            stabilityBefore: string;
            stabilityAfter: string;
            transitionReason: TransitionReason;
          }) => {
            if (didPhaseProgress({ phaseBefore, phaseAfter, transitionReason })) {
              return `Phase progressed from ${phaseBefore} to ${phaseAfter}.`;
            }
            if (transitionReason === "stability advance" && stabilityBefore !== stabilityAfter) {
              return `Stability improved from ${stabilityBefore} to ${stabilityAfter} within ${phaseAfter}.`;
            }
            if (transitionReason === "stability regress" && stabilityBefore !== stabilityAfter) {
              return `Stability regressed from ${stabilityBefore} to ${stabilityAfter} within ${phaseAfter}.`;
            }
            return `State remained at ${phaseAfter} ${stabilityAfter}.`;
          };

          const TUTOR_ENTRY_MEANING_BY_PHASE: Record<TopicPhase, string> = {
            Clarity: "Student is entering Clarity and needs foundational recognition before independent execution can be trained.",
            "Structured Execution": "Student can begin Structured Execution but needs consistency without tutor carry.",
            "Controlled Discomfort": "Student can enter Controlled Discomfort but needs stability when challenge rises.",
            "Time Pressure Stability": "Student can enter Time Pressure Stability but needs structure to hold under urgency.",
          };

          const TUTOR_ONGOING_MEANING_BY_PHASE: Record<TopicPhase, string> = {
            Clarity: "Student is in Clarity and still needs foundational recognition before independent execution can be trained.",
            "Structured Execution": "Student is in Structured Execution and still needs consistency without tutor carry.",
            "Controlled Discomfort": "Student is in Controlled Discomfort and still destabilizes when challenge spikes.",
            "Time Pressure Stability": "Student is in Time Pressure Stability and urgency still tests structure retention.",
          };

          const buildTutorMeaning = ({
            phaseBefore,
            phaseAfter,
            stabilityAfter,
            transitionReason,
            drillType,
          }: {
            phaseBefore: TopicPhase;
            phaseAfter: TopicPhase;
            stabilityAfter: TopicStability;
            transitionReason: TransitionReason;
            drillType: "diagnosis" | "training";
          }) => {
            if (drillType === "diagnosis" || didPhaseProgress({ phaseBefore, phaseAfter, transitionReason })) {
              return TUTOR_ENTRY_MEANING_BY_PHASE[phaseAfter];
            }
            if (transitionReason === "stability regress") {
              return `Student showed enough instability that ${phaseAfter} must be reinforced before progressing.`;
            }
            if (isFinalPhaseMaintenanceState(phaseAfter, stabilityAfter)) {
              return "Student is sustaining final-phase control and is now in maintenance and transfer territory.";
            }
            return TUTOR_ONGOING_MEANING_BY_PHASE[phaseAfter];
          };

          const PARENT_ENTRY_MEANING_BY_PHASE: Record<TopicPhase, string> = {
            Clarity: "Entered foundation rebuilding before independent solving begins.",
            "Structured Execution": "Entered independent execution, now building consistency without tutor carry.",
            "Controlled Discomfort": "Entered the challenge phase, now learning to stay stable under difficulty.",
            "Time Pressure Stability": "Entered timed stability, now learning to keep structure under urgency.",
          };
          const buildTTMeaningByState = (phase: TopicPhase, stability: TopicStability) => {
            if (phase === "Clarity") {
              if (stability === "High" || stability === "High Maintenance") {
                return "Recognition holds, but execution is not yet stable on its own.";
              }
              return "Recognition is improving, but independent execution is not yet stable.";
            }
            if (phase === "Structured Execution") {
              if (stability === "High" || stability === "High Maintenance") {
                return "Execution is now holding independently.";
              }
              return "Execution is forming, but consistency is not yet stable.";
            }
            if (phase === "Controlled Discomfort") {
              if (stability === "High" || stability === "High Maintenance") {
                return "Structure is holding under difficulty.";
              }
              return "Structure breaks when difficulty rises.";
            }
            if (stability === "High" || stability === "High Maintenance") {
              return "Structure is holding under pace pressure.";
            }
            return "Structure breaks when pace increases.";
          };

          const buildParentMeaningForContext = ({
            phaseBefore,
            phaseAfter,
            stabilityAfter,
            transitionReasons,
          }: {
            phaseBefore: TopicPhase;
            phaseAfter: TopicPhase;
            stabilityAfter: TopicStability;
            transitionReasons: TransitionReason[];
          }) => {
            const finalTransitionReason = transitionReasons[transitionReasons.length - 1] || "remain";
            if (didPhaseProgress({ phaseBefore, phaseAfter, transitionReason: finalTransitionReason })) {
              return PARENT_ENTRY_MEANING_BY_PHASE[phaseAfter];
            }
            if (finalTransitionReason === "stability regress") {
              return "Stability has dipped at this level and needs reinforcement before progression.";
            }
            if (isFinalPhaseMaintenanceState(phaseAfter, stabilityAfter)) {
              return "Top-level stability is holding, now in maintenance and transfer.";
            }
            return buildTTMeaningByState(phaseAfter, stabilityAfter);
          };

          const buildTopicImprovementSummary = ({
            topic,
            firstDrillState,
            lastDrillState,
            transitionReasons,
            drillBehaviors,
          }: {
            topic: string;
            firstDrillState: { phase: string; stability: string };
            lastDrillState: { phase: string; stability: string };
            transitionReasons: TransitionReason[];
            drillBehaviors: string[][];
          }) => {
            const latestTransitionReason = transitionReasons[transitionReasons.length - 1] || "remain";
            if (didPhaseProgress({
              phaseBefore: firstDrillState.phase,
              phaseAfter: lastDrillState.phase,
              transitionReason: latestTransitionReason,
            })) {
              const strongLate = summarizeBehaviorLabels(
                normalizeBehaviorLabelsForContext(
                  getBehaviorBuckets(drillBehaviors[drillBehaviors.length - 1] || []).strong,
                  "absolute"
                ),
                2
              );
              const behaviorClause = strongLate.length > 0 ? ` with ${naturalJoin(strongLate)}` : "";
              return `${topic}: progressed from ${firstDrillState.phase} to ${lastDrillState.phase}${behaviorClause}`;
            }

            const midpoint = Math.max(1, Math.floor(drillBehaviors.length / 2));
            const earlyBehaviors = drillBehaviors.slice(0, midpoint).flat();
            const lateBehaviors = drillBehaviors.slice(midpoint).flat();
            const fallback = transitionReasons.includes("stability advance")
              ? "showed stronger stability"
              : "improved stability across drills";
            return `${topic}: ${buildBehaviorShiftSummary(earlyBehaviors, lateBehaviors, fallback)}`;
          };

          const buildTopicResponsePattern = (topic: string, allBehaviors: string[]) => {
            const behaviors = summarizeBehaviorLabels(
              normalizeBehaviorLabelsForContext(allBehaviors, "absolute"),
              3
            );
            return `${topic}: ${behaviors.length > 0 ? naturalJoin(behaviors) : "no mapped observation signal detected"}`;
          };

          const buildWeeklySystemMovement = ({
            topic,
            firstDrillState,
            lastDrillState,
            transitionReasons,
          }: {
            topic: string;
            firstDrillState: { phase: string; stability: string };
            lastDrillState: { phase: string; stability: string };
            transitionReasons: TransitionReason[];
          }) => {
            const latestTransitionReason = transitionReasons[transitionReasons.length - 1] || "remain";
            if (didPhaseProgress({
              phaseBefore: firstDrillState.phase,
              phaseAfter: lastDrillState.phase,
              transitionReason: latestTransitionReason,
            })) {
              return `${topic}: entered ${lastDrillState.phase}`;
            }
            if (latestTransitionReason === "stability advance") {
              return `${topic}: improved stability inside ${lastDrillState.phase}`;
            }
            if (latestTransitionReason === "stability regress") {
              return `${topic}: regressed within ${lastDrillState.phase}`;
            }
            if (isFinalPhaseMaintenanceState(lastDrillState.phase, lastDrillState.stability)) {
              return `${topic}: sustained final-phase maintenance`;
            }
            return `${topic}: reinforced ${lastDrillState.phase}`;
          };

          const buildMonthlySystemOutcome = ({
            topic,
            firstDrillState,
            lastDrillState,
            transitionReasons,
          }: {
            topic: string;
            firstDrillState: { phase: string; stability: string };
            lastDrillState: { phase: string; stability: string };
            transitionReasons: TransitionReason[];
          }) => {
            const latestTransitionReason = transitionReasons[transitionReasons.length - 1] || "remain";
            if (didPhaseProgress({
              phaseBefore: firstDrillState.phase,
              phaseAfter: lastDrillState.phase,
              transitionReason: latestTransitionReason,
            })) {
              return `${topic}: advanced into ${lastDrillState.phase}`;
            }
            if (isFinalPhaseMaintenanceState(lastDrillState.phase, lastDrillState.stability)) {
              return `${topic}: remained in final-phase maintenance`;
            }
            if (latestTransitionReason === "stability advance") {
              return `${topic}: improved within ${lastDrillState.phase}`;
            }
            if (latestTransitionReason === "stability regress") {
              return `${topic}: regressed within ${lastDrillState.phase}`;
            }
            return `${topic}: held in ${lastDrillState.phase}`;
          };

          const formatStateLabel = (state: { phase: string; stability: string }) =>
            `${state.phase} (${state.stability})`;

          const buildCappedBehaviorShiftSummary = (
            earlyBehaviors: string[],
            lateBehaviors: string[],
            fallback: string
          ) => {
            const earlyCounts = countBehaviorLabels(earlyBehaviors);
            const lateCounts = countBehaviorLabels(lateBehaviors);
            const { weak: earlyWeak, strong: earlyStrong } = getBehaviorBuckets(earlyBehaviors);
            const { weak: lateWeak, strong: lateStrong } = getBehaviorBuckets(lateBehaviors);

            const reducedWeak = Array.from(new Set(earlyWeak)).filter(
              (label) => (lateCounts[label] || 0) < (earlyCounts[label] || 0)
            );
            const strengthened = Array.from(new Set(lateStrong)).filter(
              (label) => (lateCounts[label] || 0) > (earlyCounts[label] || 0) || !earlyStrong.includes(label)
            );

            const summaryParts = [
              ...reducedWeak.map((label) => `less ${label}`),
              ...strengthened,
            ].slice(0, 2);

            return summaryParts.length > 0 ? naturalJoin(summaryParts) : fallback;
          };

          const buildTopicWeakSignals = (allBehaviors: string[]) =>
            summarizeBehaviorLabels(getBehaviorBuckets(allBehaviors).weak, 2);

          const buildTopicStrongSignals = (allBehaviors: string[]) =>
            summarizeBehaviorLabels(
              normalizeBehaviorLabelsForContext(getBehaviorBuckets(allBehaviors).strong, "absolute"),
              2
            );

          const buildWeeklyWhatChangedLine = ({
            topic,
            firstDrillState,
            lastDrillState,
            transitionReasons,
            drillBehaviors,
            hasTrainingEvidence,
          }: {
            topic: string;
            firstDrillState: { phase: string; stability: string };
            lastDrillState: { phase: string; stability: string };
            transitionReasons: TransitionReason[];
            drillBehaviors: string[][];
            hasTrainingEvidence: boolean;
          }) => {
            if (!hasTrainingEvidence) {
              return `${topic} baseline established at ${formatStateLabel(lastDrillState)}; no training movement claimed yet.`;
            }

            const latestTransitionReason = transitionReasons[transitionReasons.length - 1] || "remain";
            const midpoint = Math.max(1, Math.floor(drillBehaviors.length / 2));
            const earlyBehaviors = drillBehaviors.slice(0, midpoint).flat();
            const lateBehaviors = drillBehaviors.slice(midpoint).flat();
            const strongSignals = buildTopicStrongSignals(lateBehaviors);
            const weakSignals = summarizeBehaviorLabels(getBehaviorBuckets(lateBehaviors).weak, 1).map(
              (label) => `continued ${label}`
            );
            const behaviorShift = buildCappedBehaviorShiftSummary(
              earlyBehaviors,
              lateBehaviors,
              naturalJoin([...strongSignals, ...weakSignals].slice(0, 2)) || "no consistent behavior shift recognized yet"
            );

            if (
              didPhaseProgress({
                phaseBefore: firstDrillState.phase,
                phaseAfter: lastDrillState.phase,
                transitionReason: latestTransitionReason,
              }) ||
              formatStateLabel(firstDrillState) !== formatStateLabel(lastDrillState)
            ) {
              return `${topic} moved from ${formatStateLabel(firstDrillState)} to ${formatStateLabel(lastDrillState)}, with ${behaviorShift}.`;
            }

            return `${topic} remained in ${formatStateLabel(lastDrillState)}, with ${behaviorShift}.`;
          };

          const buildMonthlyMovementLine = ({
            topic,
            firstDrillState,
            lastDrillState,
            transitionReasons,
            hasTrainingEvidence,
          }: {
            topic: string;
            firstDrillState: { phase: string; stability: string };
            lastDrillState: { phase: string; stability: string };
            transitionReasons: TransitionReason[];
            hasTrainingEvidence: boolean;
          }) => {
            if (!hasTrainingEvidence) {
              return `${topic} baseline established at ${lastDrillState.phase} (${lastDrillState.stability}); no training movement claimed yet.`;
            }

            const latestTransitionReason = transitionReasons[transitionReasons.length - 1] || "remain";

            if (
              didPhaseProgress({
                phaseBefore: firstDrillState.phase,
                phaseAfter: lastDrillState.phase,
                transitionReason: latestTransitionReason,
              })
            ) {
              return `${topic} advanced from ${firstDrillState.phase} to ${lastDrillState.phase}.`;
            }
            if (latestTransitionReason === "stability advance") {
              return `${topic} remained in ${lastDrillState.phase}, with stability improving across sessions.`;
            }
            if (latestTransitionReason === "stability regress") {
              return `${topic} remained in ${lastDrillState.phase} with reduced stability.`;
            }
            if (isFinalPhaseMaintenanceState(lastDrillState.phase, lastDrillState.stability)) {
              return `${topic} remained in ${lastDrillState.phase} with sustained maintenance.`;
            }
            return `${topic} remained in ${lastDrillState.phase}.`;
          };

          const buildCurrentPositionText = (phase: TopicPhase, stability: TopicStability) => {
            if (phase === "Clarity") {
              if (stability === "High" || stability === "High Maintenance") {
                return "Recognition holds, but independent execution is not yet stable.";
              }
              return "Recognition is improving, but independent solving is not yet stable.";
            }
            if (phase === "Structured Execution") {
              if (stability === "High" || stability === "High Maintenance") {
                return "Execution holds independently but not yet under pressure.";
              }
              return "Execution is forming, but independent step control is not yet stable.";
            }
            if (phase === "Controlled Discomfort") {
              if (stability === "High" || stability === "High Maintenance") {
                return "Structure holds under difficulty, but timed pressure is not yet stable.";
              }
              return "Structure holds in familiar work, but breaks when difficulty rises.";
            }
            if (stability === "High" || stability === "High Maintenance") {
              return "Structure holds under pace pressure.";
            }
            return "Structure is present, but breaks when pace increases.";
          };

          const buildParentNextMove = (phase: TopicPhase, stability: TopicStability) => {
            if (phase === "Clarity") {
              if (stability === "High Maintenance") {
                return "introduce Structured Execution while protecting recognition and step choice.";
              }
              return "reinforce recognition and first-step decisions before introducing independent problem-solving.";
            }
            if (phase === "Structured Execution") {
              if (stability === "High Maintenance") {
                return "introduce Controlled Discomfort while protecting structure.";
              }
              if (stability === "High") {
                return "increase variation while protecting step order and independent starts.";
              }
              return "reinforce step order and independent starts before increasing difficulty.";
            }
            if (phase === "Controlled Discomfort") {
              if (stability === "High Maintenance") {
                return "introduce Time Pressure Stability while protecting structure.";
              }
              if (stability === "High") {
                return "increase timed demand while protecting structure under difficulty.";
              }
              return "increase exposure to harder problems while maintaining structure.";
            }
            if (stability === "High Maintenance") {
              return "maintain timed performance and begin transfer across related topics.";
            }
            return "increase timed exposure while protecting structure and pace control.";
          };
          const buildParentNextMoveForContext = ({
            phaseBefore,
            phaseAfter,
            stabilityBefore,
            stabilityAfter,
            transitionReasons,
          }: {
            phaseBefore: TopicPhase;
            phaseAfter: TopicPhase;
            stabilityBefore: TopicStability;
            stabilityAfter: TopicStability;
            transitionReasons: TransitionReason[];
          }) => {
            const latestTransitionReason = transitionReasons[transitionReasons.length - 1] || "remain";
            const enteredMaintenanceCheckpoint =
              latestTransitionReason === "stability advance" &&
              phaseBefore === phaseAfter &&
              stabilityBefore === "High" &&
              stabilityAfter === "High Maintenance";

            if (!enteredMaintenanceCheckpoint) {
              return buildParentNextMove(phaseAfter, stabilityAfter);
            }

            if (phaseAfter === "Clarity") {
              return "run a Clarity High Maintenance check before introducing Structured Execution.";
            }
            if (phaseAfter === "Structured Execution") {
              return "run a Structured Execution High Maintenance check before introducing Controlled Discomfort.";
            }
            if (phaseAfter === "Controlled Discomfort") {
              return "run a Controlled Discomfort High Maintenance check before introducing Time Pressure Stability.";
            }
            return "run a final maintenance check and confirm transfer before broadening timed demands.";
          };
          const getTopicMovementPriority = (transitionReasons: TransitionReason[], lastDrillState: { phase: string; stability: string }) => {
            const latestTransitionReason = transitionReasons[transitionReasons.length - 1] || "remain";
            if (latestTransitionReason === "phase progress") return 0;
            if (latestTransitionReason === "stability advance") return 1;
            if (latestTransitionReason === "stability regress") return 2;
            if (isFinalPhaseMaintenanceState(lastDrillState.phase, lastDrillState.stability)) return 3;
            return 4;
          };
          const sortTopicsForReport = (
            topics: string[],
            topicSnapshots: Record<string, {
              firstDrillState: { phase: string; stability: string; date: string };
              lastDrillState: { phase: string; stability: string; date: string };
              drillCount: number;
              transitionReasons: TransitionReason[];
              latestNextAction: string;
              drillBehaviors: string[][];
              allBehaviors: string[];
              evidenceIds: string[];
              claimEvidence: ResponseEvidenceReportSignal[];
              hasTrainingEvidence: boolean;
            }>
          ) =>
            [...topics].sort((a, b) => {
              const aSnapshot = topicSnapshots[a];
              const bSnapshot = topicSnapshots[b];
              const priorityDiff =
                getTopicMovementPriority(aSnapshot.transitionReasons, aSnapshot.lastDrillState) -
                getTopicMovementPriority(bSnapshot.transitionReasons, bSnapshot.lastDrillState);
              if (priorityDiff !== 0) return priorityDiff;
              return a.localeCompare(b);
            });

          const buildTopicSnapshots = (sessions: any[]) => {
            const snapshots: Record<string, {
              firstDrillState: { phase: string; stability: string; date: string };
              lastDrillState: { phase: string; stability: string; date: string };
              drillCount: number;
              transitionReasons: TransitionReason[];
              latestNextAction: string;
              drillBehaviors: string[][];
              allBehaviors: string[];
              evidenceIds: string[];
              claimEvidence: ResponseEvidenceReportSignal[];
              hasTrainingEvidence: boolean;
            }> = {};

            sessions.forEach((session) => {
              const topic = String(session?.topic || "").trim() || "Unknown topic";
              const parsedPhase = tryParsePhase(session?.phaseAfter);
              if (!parsedPhase) return;
              const state = {
                phase: parsedPhase,
                stability: normalizeStability(session?.stabilityAfter || "Low"),
                date: String(session?.date || ""),
              };
              const transitionReason = normalizeTransitionReason(
                session?.transitionReason || session?.deterministicLog?.transitionReason
              );
              const behaviors = Array.isArray(session?.behaviorPatterns)
                ? session.behaviorPatterns.filter((behavior: unknown) => String(behavior || "").trim())
                : [];
              const claimEvidence = (Array.isArray(session?.responseEvidenceSignals)
                ? session.responseEvidenceSignals
                : []
              ).filter((signal: ResponseEvidenceReportSignal) => Boolean(signal?.evidenceId));
              const evidenceIds = Array.from(
                new Set(
                  claimEvidence
                    .map((signal: ResponseEvidenceReportSignal) => String(signal?.evidenceId || "").trim())
                    .filter(Boolean),
                ),
              );
              const nextAction = String(session?.nextAction || session?.deterministicLog?.nextMove || "").trim();

              if (!snapshots[topic]) {
                snapshots[topic] = {
                  firstDrillState: state,
                  lastDrillState: state,
                  drillCount: 1,
                  transitionReasons: [transitionReason],
                    latestNextAction: nextAction,
                    drillBehaviors: [behaviors],
                    allBehaviors: [...behaviors],
                    evidenceIds: [...evidenceIds],
                    claimEvidence: [...claimEvidence],
                    hasTrainingEvidence: session?.drillType === "training" || session?.containsTraining === true,
                };
                return;
              }

              if (new Date(state.date) < new Date(snapshots[topic].firstDrillState.date)) {
                snapshots[topic].firstDrillState = state;
              }
              if (new Date(state.date) > new Date(snapshots[topic].lastDrillState.date)) {
                snapshots[topic].lastDrillState = state;
              }

              snapshots[topic].drillCount += 1;
              snapshots[topic].transitionReasons.push(transitionReason);
              snapshots[topic].drillBehaviors.push(behaviors);
              snapshots[topic].allBehaviors.push(...behaviors);
              snapshots[topic].evidenceIds = Array.from(
                new Set([...snapshots[topic].evidenceIds, ...evidenceIds]),
              );
              const knownClaimIds = new Set(
                snapshots[topic].claimEvidence.map((signal) => signal.evidenceId),
              );
              claimEvidence.forEach((signal: ResponseEvidenceReportSignal) => {
                if (!knownClaimIds.has(signal.evidenceId)) {
                  snapshots[topic].claimEvidence.push(signal);
                  knownClaimIds.add(signal.evidenceId);
                }
              });
              if (session?.drillType === "training" || session?.containsTraining === true) {
                snapshots[topic].hasTrainingEvidence = true;
              }
              if (nextAction) snapshots[topic].latestNextAction = nextAction;
            });

            return snapshots;
          };

          const resolveParentIdForStudent = async (student: any, tutorId: string) => {
            let parentId = (student as any)?.parentId || (student as any)?.parent_id || null;
            if (parentId) return parentId;

            const { data: enrollment } = await supabase
              .from("enrollments")
              .select("parent_id")
              .eq("assigned_tutor_id", tutorId)
              .eq("student_id", student.id)
              .maybeSingle();

            return enrollment?.parent_id || null;
          };

          const isTutorAssignmentAcceptedForStudent = async (student: any, tutorId: string) => {
            if (isEmergencyDbMode()) {
              const enrollmentId = String(
                (student as any)?.parentEnrollmentId || (student as any)?.parent_enrollment_id || ""
              ).trim();
              if (!enrollmentId) return true;
              const enrollmentResult = await pool.query(
                `SELECT status
                   FROM public.parent_enrollments
                  WHERE id = $1 AND assigned_tutor_id = $2
                  LIMIT 1`,
                [enrollmentId, tutorId],
              );
              return enrollmentResult.rows[0]?.status !== "awaiting_tutor_acceptance";
            }
            let enrollmentForStudent: { status: string } | null = null;

            const explicitEnrollmentId = String(
              (student as any)?.parentEnrollmentId || (student as any)?.parent_enrollment_id || ""
            ).trim();
            if (explicitEnrollmentId) {
              const { data: enrollmentById } = await supabase
                .from("parent_enrollments")
                .select("status")
                .eq("assigned_tutor_id", tutorId)
                .eq("id", explicitEnrollmentId)
                .maybeSingle();
              enrollmentForStudent = enrollmentById;
            }

            if (!enrollmentForStudent) {
              const parentId = (student as any)?.parentId || (student as any)?.parent_id || null;
              if (parentId) {
                const { data: enrollmentByParent } = await supabase
                  .from("parent_enrollments")
                  .select("status")
                  .eq("assigned_tutor_id", tutorId)
                  .eq("user_id", parentId)
                  .eq("status", "awaiting_tutor_acceptance")
                  .maybeSingle();
                enrollmentForStudent = enrollmentByParent;
              }
            }

            return enrollmentForStudent?.status !== "awaiting_tutor_acceptance";
          };

          const createWeeklyStructuredDataFromDrills = (drillRows: any[]) => {
            const deterministicSessions = mapDeterministicSessionsForReport(drillRows);
            const groupedSessions = aggregateDeterministicSessions(drillRows || []);

            if (!deterministicSessions.length) return null;

            const sorted = [...deterministicSessions].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            const phaseRank = (phase: string) => {
              if (phase === "Clarity") return 0;
              if (phase === "Structured Execution") return 1;
              if (phase === "Controlled Discomfort") return 2;
              if (phase === "Time Pressure Stability") return 3;
              return -1;
            };
            const stabilityRank = (stability: string) => {
              if (stability === "Low") return 0;
              if (stability === "Medium") return 1;
              if (stability === "High") return 2;
              if (stability === "High Maintenance") return 3;
              return -1;
            };
            const scoreState = (state: { phase: string; stability: string }) =>
              phaseRank(state.phase) * 10 + stabilityRank(state.stability);
            const topicSnapshots = buildTopicSnapshots(sorted);

            const topics = sortTopicsForReport(Object.keys(topicSnapshots), topicSnapshots);
            const includeTopicLabels = topics.length > 1;

            // Final weekly report structure
            const topicsWorkedOn = topics;
            const whatChanged = topics.map(topic => {
              const snapshot = topicSnapshots[topic];
              const line = buildWeeklyWhatChangedLine({
                topic,
                firstDrillState: snapshot.firstDrillState,
                lastDrillState: snapshot.lastDrillState,
                transitionReasons: snapshot.transitionReasons,
                drillBehaviors: snapshot.drillBehaviors,
                hasTrainingEvidence: snapshot.hasTrainingEvidence,
              });
              return includeTopicLabels ? line : formatSingleTopicMovementLine(line);
            });

            const breakdownPattern = topics.map(topic => {
              const snapshot = topicSnapshots[topic];
              const weakSignals = buildTopicWeakSignals(snapshot.allBehaviors);
              const isInitialTopicBaseline = snapshot.drillCount <= 1;
              return formatTopicScopedLine(
                topic,
                weakSignals.length > 0
                  ? naturalJoin(weakSignals)
                  : isInitialTopicBaseline
                    ? "initial baseline established; no recurring breakdown pattern yet"
                    : "no consistent breakdown pattern identified",
                includeTopicLabels
              );
            });

            const whatThisMeans = topics.map(topic => {
              const snapshot = topicSnapshots[topic];
              return formatTopicScopedLine(
                topic,
                buildParentMeaningForContext({
                  phaseBefore: snapshot.firstDrillState.phase as TopicPhase,
                  phaseAfter: snapshot.lastDrillState.phase as TopicPhase,
                  stabilityAfter: snapshot.lastDrillState.stability as TopicStability,
                  transitionReasons: snapshot.transitionReasons,
                }),
                includeTopicLabels
              );
            });

            const nextMove = topics.map(topic => {
              const snapshot = topicSnapshots[topic];
              return formatTopicScopedLine(
                topic,
                buildParentNextMoveForContext({
                  phaseBefore: snapshot.firstDrillState.phase as TopicPhase,
                  phaseAfter: snapshot.lastDrillState.phase as TopicPhase,
                  stabilityBefore: snapshot.firstDrillState.stability as TopicStability,
                  stabilityAfter: snapshot.lastDrillState.stability as TopicStability,
                  transitionReasons: snapshot.transitionReasons,
                }),
                includeTopicLabels
              );
            });

            const startDate = sorted[0].date;
            const endDate = sorted[sorted.length - 1].date;
            const reportDecisionAuthority = resolveResponseEvidenceReportAuthority(
              sorted.map((session) =>
                Array.isArray(session?.responseEvidenceSignals) ? session.responseEvidenceSignals : []
              ),
            );

            return {
              version: "weekly-v3-evidence",
              weekStartDate: new Date(startDate).toISOString().slice(0, 10),
              weekEndDate: new Date(endDate).toISOString().slice(0, 10),
              sessionsCompletedThisWeek: groupedSessions.length,
              topicsWorkedOn,
              whatChanged,
              breakdownPattern: breakdownPattern.length > 0 ? breakdownPattern : ["No consistent breakdown pattern identified"],
              whatThisMeans,
              nextMove,
              internalWeeklyTutorNote: "",
              drillCount: deterministicSessions.length,
              sourceSessionIds: groupedSessions.map((session) => session.id),
              reportDecisionAuthority,
              evidenceLineage: topics.map((topic) => ({
                topic,
                evidenceIds: topicSnapshots[topic].evidenceIds,
                claims: topicSnapshots[topic].claimEvidence.map((signal) => ({
                  evidenceId: signal.evidenceId,
                  dimensionId: signal.dimensionId,
                  rawOption: signal.rawOption,
                  polarity: signal.polarity,
                  label: signal.label,
                  claimEligible: signal.claimEligible,
                  recoveredAfterBreakdown: signal.recoveredAfterBreakdown,
                  sourceAuthority: signal.sourceAuthority,
                })),
              })),
            };
          };

          const createMonthlyStructuredDataFromDrills = (drillRows: any[]) => {
            const deterministicSessions = mapDeterministicSessionsForReport(drillRows);
            const groupedSessions = aggregateDeterministicSessions(drillRows || []);

            if (!deterministicSessions.length) return null;

            const sorted = [...deterministicSessions].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            const phaseRank = (phase: string) => {
              if (phase === "Clarity") return 0;
              if (phase === "Structured Execution") return 1;
              if (phase === "Controlled Discomfort") return 2;
              if (phase === "Time Pressure Stability") return 3;
              return -1;
            };
            const stabilityRank = (stability: string) => {
              if (stability === "Low") return 0;
              if (stability === "Medium") return 1;
              if (stability === "High") return 2;
              if (stability === "High Maintenance") return 3;
              return -1;
            };
            const scoreState = (state: { phase: string; stability: string }) =>
              phaseRank(state.phase) * 10 + stabilityRank(state.stability);
            const topicSnapshots = buildTopicSnapshots(sorted);

            const topics = sortTopicsForReport(Object.keys(topicSnapshots), topicSnapshots);
            const includeTopicLabels = topics.length > 1;

            // Final monthly report structure
            const topicsConditioned = topics;
            const systemMovement = topics.map(topic => {
              const snapshot = topicSnapshots[topic];
              const line = buildMonthlyMovementLine({
                topic,
                firstDrillState: snapshot.firstDrillState,
                lastDrillState: snapshot.lastDrillState,
                transitionReasons: snapshot.transitionReasons,
                hasTrainingEvidence: snapshot.hasTrainingEvidence,
              });
              return includeTopicLabels ? line : formatSingleTopicMovementLine(line);
            });

            const whatBecameStronger = topics
              .map(topic => {
                const snapshot = topicSnapshots[topic];
                if (!snapshot.hasTrainingEvidence) {
                  return formatTopicScopedLine(
                    topic,
                    "baseline established; no training strength claim made yet",
                    includeTopicLabels,
                  );
                }
                const strongSignals = buildTopicStrongSignals(snapshot.allBehaviors);
                return buildMonthlyStrengthLine(topic, strongSignals, includeTopicLabels);
              })
              .filter(Boolean);

            const breakdownPattern = topics.map(topic => {
              const snapshot = topicSnapshots[topic];
              const weakSignals = buildTopicWeakSignals(snapshot.allBehaviors);
              const isInitialTopicBaseline = snapshot.drillCount <= 1;
              return formatTopicScopedLine(
                topic,
                weakSignals.length > 0
                  ? naturalJoin(weakSignals)
                  : isInitialTopicBaseline
                    ? "initial baseline established; no recurring breakdown pattern yet"
                    : "no consistent breakdown pattern identified",
                includeTopicLabels
              );
            });

            const currentPosition = topics.map(topic => {
              const snapshot = topicSnapshots[topic];
              return {
                topic,
                state: `${snapshot.lastDrillState.phase} (${snapshot.lastDrillState.stability})`,
                position: buildCurrentPositionText(
                  snapshot.lastDrillState.phase as TopicPhase,
                  snapshot.lastDrillState.stability as TopicStability
                ),
              };
            });

            const whatThisMeans = topics.map(topic => {
              const snapshot = topicSnapshots[topic];
              return formatTopicScopedLine(
                topic,
                buildParentMeaningForContext({
                  phaseBefore: snapshot.firstDrillState.phase as TopicPhase,
                  phaseAfter: snapshot.lastDrillState.phase as TopicPhase,
                  stabilityAfter: snapshot.lastDrillState.stability as TopicStability,
                  transitionReasons: snapshot.transitionReasons,
                }),
                includeTopicLabels
              );
            });

            const nextMonthMove = topics.map(topic => {
              const snapshot = topicSnapshots[topic];
              return formatTopicScopedLine(
                topic,
                buildParentNextMove(
                  snapshot.lastDrillState.phase as TopicPhase,
                  snapshot.lastDrillState.stability as TopicStability
                ),
                includeTopicLabels
              );
            });

            const startDate = sorted[0].date;
            const endDate = sorted[sorted.length - 1].date;
            const reportDecisionAuthority = resolveResponseEvidenceReportAuthority(
              sorted.map((session) =>
                Array.isArray(session?.responseEvidenceSignals) ? session.responseEvidenceSignals : []
              ),
            );

            return {
              version: "monthly-v3-evidence",
              monthStartDate: new Date(startDate).toISOString().slice(0, 10),
              monthEndDate: new Date(endDate).toISOString().slice(0, 10),
              totalSessionsCompletedThisMonth: groupedSessions.length,
              topicsConditioned,
              systemMovement: systemMovement.length > 0 ? systemMovement : ["No clear system movement recorded this month"],
              whatBecameStronger: whatBecameStronger.length > 0 ? whatBecameStronger : ["No consistent strength pattern recognized yet"],
              breakdownPattern: breakdownPattern.length > 0 ? breakdownPattern : ["No consistent breakdown pattern identified"],
              currentPosition,
              whatThisMeans,
              nextMonthMove,
              drillCount: topics.reduce((sum, topic) => sum + topicSnapshots[topic].drillCount, 0),
              monthRange: `${new Date(startDate).toISOString().slice(0, 10)} to ${new Date(endDate).toISOString().slice(0, 10)}`,
              sourceSessionIds: groupedSessions.map((session) => session.id),
              reportDecisionAuthority,
              evidenceLineage: topics.map((topic) => ({
                topic,
                evidenceIds: topicSnapshots[topic].evidenceIds,
                claims: topicSnapshots[topic].claimEvidence.map((signal) => ({
                  evidenceId: signal.evidenceId,
                  dimensionId: signal.dimensionId,
                  rawOption: signal.rawOption,
                  polarity: signal.polarity,
                  label: signal.label,
                  claimEligible: signal.claimEligible,
                  recoveredAfterBreakdown: signal.recoveredAfterBreakdown,
                  sourceAuthority: signal.sourceAuthority,
                })),
              })),
            };
          };


          const resolveReportSessionGroupId = (row: any) => {
            const mappedSession = mapDrillRowToDeterministicSession(row);
            return String(
              row?.report_scheduled_session_id ||
                resolveScheduledSessionIdFromDrillRow(row) ||
                mappedSession?.sessionGroupId ||
                mappedSession?.id ||
                row?.id ||
                "",
            ).trim();
          };

          const buildDeterministicReportWindowKey = (reportType: "weekly" | "monthly", structuredData: any) => {
            const sourceSessionIds = Array.from(
              new Set(
                (Array.isArray(structuredData?.sourceSessionIds) ? structuredData.sourceSessionIds : [])
                  .map((id: unknown) => String(id || "").trim())
                  .filter(Boolean),
              ),
            ).sort();

            if (sourceSessionIds.length === 0) return null;
            return `${reportType}:${sourceSessionIds.join("|")}`;
          };

          const insertDeterministicParentReport = async (payload: Record<string, any>, reportWindowKey: string | null) => {
            const insertPayload = reportWindowKey
              ? { ...payload, report_window_key: reportWindowKey }
              : payload;

            if (isEmergencyDbMode()) {
              try {
                const inserted = await pool.query(
                  `INSERT INTO public.parent_reports
                    (tutor_id, student_id, parent_id, report_type, week_number, month_name,
                     summary, topics_learned, strengths, areas_for_growth,
                     boss_battles_completed, solutions_unlocked, confidence_growth,
                     next_steps, sent_at, report_window_key)
                   VALUES
                    ($1, $2, $3, $4, $5, $6,
                     $7, $8, $9, $10,
                     $11, $12, $13,
                     $14, $15, $16)
                   RETURNING id`,
                  [
                    insertPayload.tutor_id,
                    insertPayload.student_id,
                    insertPayload.parent_id,
                    insertPayload.report_type,
                    insertPayload.week_number ?? null,
                    insertPayload.month_name ?? null,
                    insertPayload.summary,
                    insertPayload.topics_learned ?? null,
                    insertPayload.strengths ?? null,
                    insertPayload.areas_for_growth ?? null,
                    Number(insertPayload.boss_battles_completed || 0),
                    Number(insertPayload.solutions_unlocked || 0),
                    insertPayload.confidence_growth ?? null,
                    insertPayload.next_steps ?? null,
                    insertPayload.sent_at,
                    reportWindowKey,
                  ],
                );
                return { ...inserted.rows[0], created: true };
              } catch (error: any) {
                if (error?.code === "23505" && reportWindowKey) {
                  const existing = await pool.query(
                    `SELECT id
                       FROM public.parent_reports
                      WHERE tutor_id = $1
                        AND student_id = $2
                        AND report_type = $3
                        AND report_window_key = $4
                      LIMIT 1`,
                    [payload.tutor_id, payload.student_id, payload.report_type, reportWindowKey],
                  );
                  if (existing.rows[0]) {
                    return { ...existing.rows[0], created: false };
                  }
                }
                throw error;
              }
            }

            const { data, error } = await supabase
              .from("parent_reports")
              .insert(insertPayload)
              .select("id")
              .single();

            if (!error) return { ...data, created: true };

            // A concurrent trigger may have inserted the same deterministic window.
            if (error.code === "23505" && reportWindowKey) {
              const { data: existing, error: existingError } = await supabase
                .from("parent_reports")
                .select("id")
                .eq("tutor_id", payload.tutor_id)
                .eq("student_id", payload.student_id)
                .eq("report_type", payload.report_type)
                .eq("report_window_key", reportWindowKey)
                .maybeSingle();

              if (!existingError && existing) return { ...existing, created: false };
            }

            throw error;
          };

          const insertWeeklyReport = async ({
            tutorId,
            studentId,
            parentId,
            structuredData,
          }: {
            tutorId: string;
            studentId: string;
            parentId: string;
            structuredData: any;
          }) => {
            const weekNumber = getIsoWeekNumber(new Date(structuredData.weekStartDate));
            const reportWindowKey = buildDeterministicReportWindowKey("weekly", structuredData);

            return insertDeterministicParentReport({
                tutor_id: tutorId,
                student_id: studentId,
                parent_id: parentId,
                report_type: "weekly",
                week_number: weekNumber,
                month_name: null,
                summary: JSON.stringify(structuredData),
                topics_learned: Array.isArray(structuredData.topicsWorkedOn) ? structuredData.topicsWorkedOn.join(", ") : "",
                strengths: Array.isArray(structuredData.whatChanged) ? structuredData.whatChanged.join(" | ") : "",
                areas_for_growth: Array.isArray(structuredData.breakdownPattern) ? structuredData.breakdownPattern.join(" | ") : "",
                boss_battles_completed: Number(structuredData.bossBattlesCompletedThisWeek || 0),
                solutions_unlocked: Number(structuredData.sessionsCompletedThisWeek || 0),
                confidence_growth: null,
                next_steps: Array.isArray(structuredData.nextMove) ? structuredData.nextMove.join(" | ") : "",
                sent_at: new Date().toISOString(),
              }, reportWindowKey);
          };

          const insertMonthlyReport = async ({
            tutorId,
            studentId,
            parentId,
            structuredData,
          }: {
            tutorId: string;
            studentId: string;
            parentId: string;
            structuredData: any;
          }) => {
            const monthName = formatMonthName(new Date(structuredData.monthStartDate));
            const reportWindowKey = buildDeterministicReportWindowKey("monthly", structuredData);

            return insertDeterministicParentReport({
                tutor_id: tutorId,
                student_id: studentId,
                parent_id: parentId,
                report_type: "monthly",
                week_number: null,
                month_name: monthName,
                summary: JSON.stringify(structuredData),
                topics_learned: Array.isArray(structuredData.topicsConditioned) ? structuredData.topicsConditioned.join(", ") : "",
                strengths: Array.isArray(structuredData.whatBecameStronger) ? structuredData.whatBecameStronger.join(" | ") : "",
                areas_for_growth: Array.isArray(structuredData.breakdownPattern) ? structuredData.breakdownPattern.join(" | ") : "",
                boss_battles_completed: 0,
                solutions_unlocked: Number(structuredData.totalSessionsCompletedThisMonth || 0),
                confidence_growth: null,
                next_steps: Array.isArray(structuredData.nextMonthMove) ? structuredData.nextMonthMove.join(" | ") : "",
                sent_at: new Date().toISOString(),
              }, reportWindowKey);
          };

          const maybeAutoSendDeterministicReports = async (studentId: string, tutorId: string) => {
            let parentId = "";
            let drillRows: any[] = [];
            let existingWeeklyReports: any[] = [];
            let existingMonthlyReports: any[] = [];

            if (isEmergencyDbMode()) {
              const studentResult = await pool.query(
                `SELECT id, tutor_id, parent_id, parent_enrollment_id
                   FROM public.students
                  WHERE id = $1
                  LIMIT 1`,
                [studentId],
              );
              const student = studentResult.rows[0] || null;
              if (!student || String(student.tutor_id || "") !== String(tutorId)) return;

              parentId = String(student.parent_id || "").trim();
              if (!parentId && student.parent_enrollment_id) {
                const enrollmentResult = await pool.query(
                  `SELECT user_id
                     FROM public.parent_enrollments
                    WHERE id = $1
                    LIMIT 1`,
                  [student.parent_enrollment_id],
                );
                parentId = String(enrollmentResult.rows[0]?.user_id || "").trim();
              }
              if (!parentId) return;

              const [drillResult, weeklyResult, monthlyResult] = await Promise.all([
                pool.query(
                  `SELECT id, drill, submitted_at, scheduled_session_id
                     FROM public.intro_session_drills
                    WHERE student_id = $1 AND tutor_id = $2
                    ORDER BY submitted_at ASC`,
                  [studentId, tutorId],
                ),
                pool.query(
                  `SELECT summary, report_window_key
                     FROM public.parent_reports
                    WHERE student_id = $1
                      AND tutor_id = $2
                      AND report_type = 'weekly'
                    ORDER BY sent_at DESC
                    LIMIT 1000`,
                  [studentId, tutorId],
                ),
                pool.query(
                  `SELECT summary, report_window_key
                     FROM public.parent_reports
                    WHERE student_id = $1
                      AND tutor_id = $2
                      AND report_type = 'monthly'
                    ORDER BY sent_at DESC
                    LIMIT 1000`,
                  [studentId, tutorId],
                ),
              ]);
              drillRows = drillResult.rows || [];
              existingWeeklyReports = weeklyResult.rows || [];
              existingMonthlyReports = monthlyResult.rows || [];
            } else {
              const student = await storage.getStudent(studentId);
              if (!student || student.tutorId !== tutorId) return;

              parentId = String(await resolveParentIdForStudent(student, tutorId) || "").trim();
              if (!parentId) return;

              const { data, error: drillRowsError } = await supabase
                .from("intro_session_drills")
                .select("id, drill, submitted_at, scheduled_session_id")
                .eq("student_id", studentId)
                .eq("tutor_id", tutorId)
                .order("submitted_at", { ascending: true });

              if (drillRowsError) return;
              drillRows = data || [];

              const [{ data: weeklyData }, { data: monthlyData }] = await Promise.all([
                supabase
                  .from("parent_reports")
                  .select("summary, report_window_key")
                  .eq("student_id", studentId)
                  .eq("tutor_id", tutorId)
                  .eq("report_type", "weekly")
                  .limit(1000),
                supabase
                  .from("parent_reports")
                  .select("summary, report_window_key")
                  .eq("student_id", studentId)
                  .eq("tutor_id", tutorId)
                  .eq("report_type", "monthly")
                  .limit(1000),
              ]);
              existingWeeklyReports = weeklyData || [];
              existingMonthlyReports = monthlyData || [];
            }

            if (drillRows.length === 0) return;

            const anchoredDrillRows = await attachReportAnchorTimes(drillRows);
            // Two-session and eight-session windows are delivery windows. The
            // intro diagnosis establishes the starting state but is not one of
            // the paid/qualifying training sessions in those windows.
            const reportEligibleDrillRows = anchoredDrillRows.filter((row: any) => {
              const mapped = mapDrillRowToDeterministicSession(row);
              return mapped?.drillType === "training";
            });

            const coveredSessionIds = (reports: any[] | null | undefined) => new Set(
              (reports || []).flatMap((report: any) => {
                let summary: any = {};
                try {
                  summary = typeof report?.summary === "string"
                    ? JSON.parse(report.summary)
                    : report?.summary || {};
                } catch {
                  summary = {};
                }
                return Array.isArray(summary?.sourceSessionIds)
                  ? summary.sourceSessionIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
                  : [];
              }),
            );

            const weeklyCoveredSessionIds = coveredSessionIds(existingWeeklyReports);
            const monthlyCoveredSessionIds = coveredSessionIds(existingMonthlyReports);
            const weeklyPending = reportEligibleDrillRows.filter(
              (row: any) => !weeklyCoveredSessionIds.has(resolveReportSessionGroupId(row))
            );
            const monthlyPending = reportEligibleDrillRows.filter(
              (row: any) => !monthlyCoveredSessionIds.has(resolveReportSessionGroupId(row))
            );

            const weeklyWindows = buildSessionAwareWeeklyWindows(weeklyPending);
            let weeklyReportsCreated = 0;
            if (weeklyWindows.length > 0) {
              for (const weeklyWindow of weeklyWindows) {
                const structuredData = createWeeklyStructuredDataFromDrills(weeklyWindow);
                if (structuredData) {
                  const weeklyReport = await insertWeeklyReport({ tutorId, studentId, parentId, structuredData });
                  if (weeklyReport.created !== false) {
                    weeklyReportsCreated += 1;
                  }
                }
              }
            }

            if (weeklyReportsCreated > 0) {
              await safeSendPush(
                parentId,
                {
                  title: weeklyReportsCreated === 1 ? "Conditioning update available" : "Conditioning updates available",
                  body: weeklyReportsCreated === 1
                    ? "A new two-session conditioning update is available for your child."
                    : `${weeklyReportsCreated} two-session conditioning updates are available for your child.`,
                  url: "/client/parent/progress",
                  tag: "parent-weekly-report-catch-up",
                },
                "parent weekly report catch-up",
              );
            }

            const monthlyWindows = buildSessionAwareMonthlyWindows(monthlyPending);
            let monthlyReportsCreated = 0;
            if (monthlyWindows.length > 0) {
              for (const monthlyWindow of monthlyWindows) {
                const structuredData = createMonthlyStructuredDataFromDrills(monthlyWindow);
                if (structuredData) {
                  const monthlyReport = await insertMonthlyReport({ tutorId, studentId, parentId, structuredData });
                  if (monthlyReport.created !== false) {
                    monthlyReportsCreated += 1;
                  }
                }
              }
            }

            if (monthlyReportsCreated > 0) {
              await safeSendPush(
                parentId,
                {
                  title: monthlyReportsCreated === 1 ? "Eight-session report available" : "Eight-session reports available",
                  body: monthlyReportsCreated === 1
                    ? "A new eight-session conditioning report is available for your child."
                    : `${monthlyReportsCreated} eight-session conditioning reports are available for your child.`,
                  url: "/client/parent/progress",
                  tag: "parent-monthly-report-catch-up",
                },
                "parent monthly report catch-up",
              );
            }
          };

          // Tutor submits intro session drill results
          app.post("/api/tutor/intro-session-drill", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
            try {
              const tutorId = (req as any).dbUser.id;
              const { studentId, drill, introTopic, phase: rawPhase, startingPhase: rawStartingPhase, adaptiveBlocks: rawAdaptiveBlocks, scheduledSessionId } = req.body;
              const drillSets = normalizeIntroDrillSets(drill);
              const adaptiveBlocks = normalizeAdaptiveDiagnosisBlocks(rawAdaptiveBlocks);
              const drillPhase = parseAuthoritativePhase(rawPhase);
              const startingPhase = parseAuthoritativePhase(rawStartingPhase) || drillPhase;
              const normalizedIntroTopic = String(introTopic || "").trim();
              const isAdaptiveDiagnosis = adaptiveBlocks.length > 0;

              if (!studentId || (!isAdaptiveDiagnosis && drillSets.length === 0)) {
                return res.status(400).json({ message: "Missing or invalid studentId or drill data" });
              }
              if (!isAdaptiveDiagnosis && !drillPhase) {
                return res.status(400).json({ message: "Invalid or missing diagnostic phase" });
              }
              if (isAdaptiveDiagnosis && !startingPhase) {
                return res.status(400).json({ message: "Adaptive diagnosis requires a valid starting phase" });
              }
              if (!normalizedIntroTopic) {
                return res.status(400).json({ message: "Diagnostic topic is required before intro drill submission" });
              }

              const drillValidationError = isAdaptiveDiagnosis
                ? validateAdaptiveDiagnosisBlocks(adaptiveBlocks)
                : validateDrillStructure("diagnosis", drillPhase!, drillSets);
              if (drillValidationError) {
                return res.status(400).json({ message: drillValidationError });
              }

              const requestedSessionContextKind = String(req.body.sessionContextKind || "").trim().toLowerCase();
              const sessionContextKindOverride =
                requestedSessionContextKind === "training" ? "training" : requestedSessionContextKind === "intro" ? "intro" : null;

              // Validate student ownership
              const student = await storage.getStudent(studentId);
              if (!student || student.tutorId !== tutorId) {
                return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
              }

              const assignmentAccepted = await isTutorAssignmentAcceptedForStudent(student, tutorId);
              if (!assignmentAccepted) {
                return res.status(403).json({ message: "Accept this assignment before running drills for this student." });
              }

              const operationalMode = await getTutorOperationalMode(tutorId);
              const normalizedScheduledSessionId =
                typeof scheduledSessionId === "string" && String(scheduledSessionId).trim().length > 0
                  ? String(scheduledSessionId).trim()
                  : null;
              let diagnosisSessionKind: "intro" | "training" = sessionContextKindOverride === "training" ? "training" : "intro";
              let scheduledSession: any = null;

              const { session: pendingTrainingConfirmation, error: pendingTrainingConfirmationError } =
                await getPendingTrainingConfirmationSession(tutorId, studentId);
              if (pendingTrainingConfirmationError) {
                return res.status(500).json({ message: "Failed to validate training session confirmation state" });
              }

              if (normalizedScheduledSessionId) {
                const explicitScheduledSessionResult = isEmergencyDbMode()
                  ? { data: (await pool.query(
                      `SELECT ${SCHEDULED_SESSION_SELECT}
                         FROM public.scheduled_sessions
                        WHERE id = $1 AND tutor_id = $2 AND student_id = $3
                          AND type IN ('intro', 'training')
                        LIMIT 1`,
                      [normalizedScheduledSessionId, tutorId, studentId],
                    )).rows[0] || null, error: null }
                  : await supabase
                      .from("scheduled_sessions")
                      .select(SCHEDULED_SESSION_SELECT)
                      .eq("id", normalizedScheduledSessionId)
                      .eq("tutor_id", tutorId)
                      .eq("student_id", studentId)
                      .in("type", ["intro", "training"])
                      .maybeSingle();
                const { data: explicitScheduledSession, error: explicitScheduledSessionError } = explicitScheduledSessionResult;

                if (explicitScheduledSessionError) {
                  return res.status(500).json({ message: "Failed to validate drill session context" });
                }

                if (!explicitScheduledSession) {
                  return res.status(400).json({ message: "The selected drill session could not be found for this student." });
                }

                diagnosisSessionKind = explicitScheduledSession.type === "training" ? "training" : "intro";
                scheduledSession = explicitScheduledSession;
              }

              if (
                pendingTrainingConfirmation &&
                diagnosisSessionKind === "training" &&
                normalizedScheduledSessionId !== String(pendingTrainingConfirmation.id)
              ) {
                return res.status(400).json({
                  message: "A proposed Response Integrity training lesson is still waiting for parent confirmation before drills can run.",
                });
              }

              if (!scheduledSession) {
                if (isLiveSchedulingMode(operationalMode)) {
                  const { session: resolvedIntroSession, error: scheduledSessionError } = await resolveTutorScheduledSession(
                    tutorId,
                    studentId,
                    "intro",
                    null
                  );
                  if (scheduledSessionError) {
                    return res.status(500).json({ message: "Failed to validate intro session context" });
                  }
                  if (!resolvedIntroSession) {
                    return res.status(400).json({ message: "A confirmed scheduled intro session is required before drill submission." });
                  }
                  scheduledSession = resolvedIntroSession;
                }
              }

              if (scheduledSession) {
                const diagnosisLaunch = getSessionLaunchState(scheduledSession, diagnosisSessionKind);
                if (!diagnosisLaunch.canLaunch) {
                  return res.status(400).json({
                    message:
                      diagnosisSessionKind === "training"
                        ? "Diagnosis submission is blocked until the training lesson is confirmed."
                        : "Intro drill submission is blocked until the intro session is confirmed.",
                  });
                }
              }

              const diagnosisSummary = isAdaptiveDiagnosis
                ? computeAdaptiveDiagnosisSummary(startingPhase!, adaptiveBlocks)
                : computeIntroDiagnosisSummary(drillPhase!, drillSets);
              const adaptiveDiagnosisSummary = isAdaptiveDiagnosis
                ? (diagnosisSummary as ReturnType<typeof computeAdaptiveDiagnosisSummary>)
                : null;
              const introDiagnosisSummary = !isAdaptiveDiagnosis
                ? (diagnosisSummary as ReturnType<typeof computeIntroDiagnosisSummary>)
                : null;
              if (isAdaptiveDiagnosis) {
                const adaptivePathError = validateAdaptiveDiagnosisPath(startingPhase!, adaptiveDiagnosisSummary!);
                if (adaptivePathError) {
                  return res.status(400).json({ message: adaptivePathError });
                }
              }

              const diagnosisScheduledSessionId = scheduledSession?.id ? String(scheduledSession.id) : null;
              const id = uuidv4();
              const responseSnapshot = buildResponseSnapshotV1({
                sourceDrillId: id,
                topic: normalizedIntroTopic,
                mode: "diagnosis",
                phase: isAdaptiveDiagnosis ? startingPhase! : drillPhase!,
                sets: (isAdaptiveDiagnosis ? adaptiveBlocks : drillSets) as any,
                drillScore: Number((diagnosisSummary as any).diagnosisScore ?? 0),
                setScores: isAdaptiveDiagnosis
                  ? adaptiveDiagnosisSummary!.phaseChecks.map((check: any) => Number(check.phaseScore || 0))
                  : introDiagnosisSummary!.setScores,
                engineOutcomeRef: {
                  phaseBefore: null,
                  stabilityBefore: null,
                  phaseAfter: diagnosisSummary.phase,
                  stabilityAfter: normalizeStability(diagnosisSummary.stability),
                  transitionReason: "remain",
                },
              });

              // Store drill results in intro_session_drills table
              const drillPayload = JSON.stringify({
                introTopic: normalizedIntroTopic,
                phase: diagnosisSummary.phase,
                startingPhase: isAdaptiveDiagnosis ? startingPhase : drillPhase,
                drillType: "diagnosis",
                diagnosisMode: isAdaptiveDiagnosis ? "adaptive" : "legacy",
                scheduledSessionId: diagnosisScheduledSessionId,
                sessionContextKind: diagnosisSessionKind,
                sets: isAdaptiveDiagnosis ? adaptiveBlocks : drillSets,
                summary: diagnosisSummary,
                responseSnapshot,
              });
              const submittedAt = new Date().toISOString();
              const inserted = isEmergencyDbMode()
                ? (await pool.query(
                    `INSERT INTO public.intro_session_drills
                      (id, student_id, tutor_id, drill, scheduled_session_id, submitted_at)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING *`,
                    [id, studentId, tutorId, drillPayload, diagnosisScheduledSessionId, submittedAt],
                  )).rows[0]
                : (await supabase
                    .from("intro_session_drills")
                    .insert({
                      id,
                      student_id: studentId,
                      tutor_id: tutorId,
                      drill: drillPayload,
                      scheduled_session_id: diagnosisScheduledSessionId,
                      submitted_at: submittedAt,
                    })
                    .select()
                    .single()).data;
              const error = inserted ? null : new Error("Failed to store drill results");
              if (error) {
                console.error("Error inserting intro session drill:", error);
                return res.status(500).json({ message: "Failed to store drill results" });
              }

              await persistEvidenceLedgerShadow({
                sourceDrillId: String(inserted?.id || id),
                studentId: String(studentId),
                tutorId: String(tutorId),
                topic: normalizedIntroTopic,
                scheduledSessionId: diagnosisScheduledSessionId,
                trainingSessionRunId: null,
                sessionGroupId: diagnosisScheduledSessionId || String(inserted?.id || id),
                sessionContext: diagnosisSessionKind === "intro" ? "intro" : "active_training",
                drillType: "diagnosis",
                observedPhase: isAdaptiveDiagnosis ? startingPhase! : drillPhase!,
                statePhaseBefore: null,
                stabilityBefore: null,
                statePhaseAfter: diagnosisSummary.phase,
                stabilityAfter: normalizeStability(diagnosisSummary.stability),
                transitionReason: "remain",
                observedAt: String(inserted?.submitted_at || new Date().toISOString()),
                sets: (isAdaptiveDiagnosis ? adaptiveBlocks : drillSets) as any,
              });

              // Mark intro completed on the first successful diagnosis submission.
              // Sandbox/training-mode intros can run without a scheduled intro shell, so this
              // cannot depend on `diagnosisSessionKind === "intro"`.
              const existingProfile = (student.personalProfile as any) || {};
              const existingWorkflow = (existingProfile.workflow as any) || {};
              if (!existingWorkflow.introCompletedAt) {
                await storage.updateStudent(studentId, {
                  personalProfile: {
                    ...existingProfile,
                    workflow: {
                      ...existingWorkflow,
                      introCompletedAt: new Date().toISOString(),
                    },
                  },
                } as any);
              }

              const scoringResults = isAdaptiveDiagnosis
                ? adaptiveDiagnosisSummary!.phaseChecks.flatMap((check: any) =>
                    check.repRows.map((row: any) => ({
                      set: check.setName,
                      rep: row.rep,
                      score: row.repScore,
                      setScore: check.phaseScore,
                      setPoints: check.phaseScore,
                      setMaxPoints: 100,
                      sessionScore: check.phaseScore,
                      phase: check.phase,
                      stability: check.stability,
                      band: check.band,
                      bandLabel: labelAdaptiveDiagnosisBand(check.band),
                      nextPhase: check.nextPhase,
                      nextAction: adaptiveDiagnosisSummary!.nextAction,
                      constraint: adaptiveDiagnosisSummary!.constraint,
                    }))
                  )
                : introDiagnosisSummary!.repRows.map((row) => {
                    const setIndex = introDiagnosisSummary!.repRows.findIndex(
                      (candidate) => candidate.set === row.set && candidate.rep === row.rep
                    );
                    const scoredSetIndex = Math.max(0, Math.floor(setIndex / 3));
                    const setScore = introDiagnosisSummary!.setScores[scoredSetIndex] ?? row.repScore;

                    return {
                      set: row.set,
                      rep: row.rep,
                      score: row.repScore,
                      setScore,
                      setPoints: setScore,
                      setMaxPoints: 100,
                      sessionScore: introDiagnosisSummary!.diagnosisScore,
                      phase: introDiagnosisSummary!.phase,
                      stability: introDiagnosisSummary!.stability,
                      nextAction: introDiagnosisSummary!.nextAction,
                      constraint: introDiagnosisSummary!.constraint,
                    };
                  });

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
              const existingTopic = topicsStore[normalizedIntroTopic] && typeof topicsStore[normalizedIntroTopic] === "object"
                ? topicsStore[normalizedIntroTopic]
                : {};
              const existingHistory = Array.isArray(existingTopic.history) ? [...existingTopic.history] : [];
              const nowIso = new Date().toISOString();

              topicsStore[normalizedIntroTopic] = {
                ...existingTopic,
                topic: normalizedIntroTopic,
                phase: diagnosisSummary.phase,
                stability: diagnosisSummary.stability,
                lastUpdated: nowIso,
                nextAction: diagnosisSummary.nextAction,
                observationNotes: [
                  `Intro Diagnosis Score: ${diagnosisSummary.diagnosisScore}`,
                  diagnosisSummary.constraint ? `Constraint: ${diagnosisSummary.constraint}` : null,
                ]
                  .filter(Boolean)
                  .join(" | "),
                history: [
                  ...existingHistory,
                  {
                    date: nowIso,
                    phase: diagnosisSummary.phase,
                    stability: diagnosisSummary.stability,
                    nextAction: diagnosisSummary.nextAction,
                    observationNotes: `Intro diagnosis update. Score ${diagnosisSummary.diagnosisScore}.`,
                    structuredObservation: {
                      drillType: "diagnosis",
                      observedPhase: isAdaptiveDiagnosis ? diagnosisSummary.phase : drillPhase,
                      startingPhase: isAdaptiveDiagnosis ? startingPhase : drillPhase,
                      diagnosisMode: isAdaptiveDiagnosis ? "adaptive" : "legacy",
                      diagnosisScore: diagnosisSummary.diagnosisScore,
                      finalBand: isAdaptiveDiagnosis ? adaptiveDiagnosisSummary?.finalBand || null : null,
                      pathLength: isAdaptiveDiagnosis ? adaptiveDiagnosisSummary?.pathLength || null : null,
                      nextAction: diagnosisSummary.nextAction,
                      constraint: diagnosisSummary.constraint,
                    },
                    drillId: inserted.id,
                  },
                ].slice(-60),
              };

              topicConditioningStore.topic = normalizedIntroTopic;
              topicConditioningStore.entry_phase = diagnosisSummary.phase;
              topicConditioningStore.stability = diagnosisSummary.stability;
              topicConditioningStore.lastUpdatedAt = nowIso;
              topicConditioningStore.topics = topicsStore;
              conceptMastery.topicConditioning = topicConditioningStore;

              await storage.updateStudent(studentId, { conceptMastery });

              try {
                await maybeAutoSendDeterministicReports(studentId, tutorId);
              } catch (autoReportError) {
                console.error("Auto report generation failed after intro drill:", autoReportError);
              }

              if (diagnosisSessionKind === "intro" && scheduledSession) {
                if (isEmergencyDbMode()) {
                  await pool.query(
                    `UPDATE public.scheduled_sessions
                        SET status = 'completed', attendance_status = 'both_joined',
                            recording_status = 'manual_not_tracked',
                            transcript_status = 'manual_not_tracked', updated_at = NOW()
                      WHERE id = $1 AND tutor_id = $2`,
                    [scheduledSession.id, tutorId],
                  );
                } else {
                  await supabase
                    .from("scheduled_sessions")
                    .update({
                      status: "completed",
                      attendance_status: "both_joined",
                      recording_status: "manual_not_tracked",
                      transcript_status: "manual_not_tracked",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", scheduledSession.id);
                }
              }

              res.json({
                success: true,
                id: inserted.id,
                introTopic: normalizedIntroTopic,
                scoring: scoringResults,
                summary: diagnosisSummary,
                responseSnapshot,
              });
            } catch (err) {
              console.error("Exception in intro session drill submission:", err);
              res.status(500).json({ message: "Internal server error" });
            }
          });

          app.post("/api/tutor/handover-verification-drill", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
            try {
              const tutorId = (req as any).dbUser.id;
              const {
                studentId,
                drill,
                handoverTopic,
                phase: rawPhase,
                startingPhase: rawStartingPhase,
                stability: rawStability,
                adaptiveBlocks: rawAdaptiveBlocks,
                scheduledSessionId,
                rediagnosis,
              } = req.body;
              const handoverBlocks = normalizeAdaptiveDiagnosisBlocks(
                Array.isArray(drill)
                  ? drill.map((set: any) => ({
                      ...set,
                      phase: rawPhase,
                    }))
                  : []
              );
              const adaptiveBlocks = normalizeAdaptiveDiagnosisBlocks(rawAdaptiveBlocks);
              const legacyTargetedRediagnosisRequested = !!rediagnosis || adaptiveBlocks.length > 0;
              if (legacyTargetedRediagnosisRequested) {
                return res.status(409).json({
                  message:
                    "Legacy Handover re-diagnosis is retired. Launch evidence-complete targeted re-diagnosis from the Handover result.",
                  decisionAuthority: "evidence_native",
                  requiredRoute: "evidence_complete_diagnosis",
                });
              }
              const isTargetedRediagnosis = false;
              const verificationBlocks = handoverBlocks;
              const verificationPhase = parseAuthoritativePhase(rawPhase);
              const startingPhase = parseAuthoritativePhase(rawStartingPhase) || verificationPhase;
              const previousStability = normalizeStability(rawStability || "Low");
              const normalizedTopic = String(handoverTopic || "").trim();

              if (!studentId || verificationBlocks.length === 0) {
                return res.status(400).json({ message: "Missing or invalid studentId or verification drill data" });
              }
              if (!verificationPhase) {
                return res.status(400).json({ message: "Handover verification requires a valid inherited phase" });
              }
              if (isTargetedRediagnosis && !startingPhase) {
                return res.status(400).json({ message: "Targeted re-diagnosis requires a valid starting phase" });
              }
              if (!normalizedTopic) {
                return res.status(400).json({ message: "Handover verification topic is required" });
              }
              if (!isTargetedRediagnosis && verificationBlocks.length !== 1) {
                return res.status(400).json({ message: "Handover verification must submit exactly one phase verification block" });
              }

              const verificationValidationError = isTargetedRediagnosis
                ? validateAdaptiveDiagnosisBlocks(verificationBlocks, "diagnosis")
                : validateAdaptiveDiagnosisBlocks(verificationBlocks, "verification");
              if (verificationValidationError) {
                return res.status(400).json({ message: verificationValidationError });
              }

              const student = await storage.getStudent(studentId);
              const normalizedStudent = normalizeStudentRecord(student);
              let tutorOwnsStudent = !!normalizedStudent && String(normalizedStudent.tutorId || "") === String(tutorId);

              if (!tutorOwnsStudent) {
                const parentEnrollmentId = String(
                  (normalizedStudent as any)?.parentEnrollmentId || (normalizedStudent as any)?.parent_enrollment_id || ""
                ).trim();

                if (parentEnrollmentId) {
                  const { data: linkedEnrollment } = await supabase
                    .from("parent_enrollments")
                    .select("id, assigned_tutor_id, user_id, student_full_name, student_grade")
                    .eq("id", parentEnrollmentId)
                    .maybeSingle();

                  tutorOwnsStudent = String(linkedEnrollment?.assigned_tutor_id || "") === String(tutorId);

                  if (tutorOwnsStudent && linkedEnrollment) {
                    try {
                      await ensureStudentForEnrollment(linkedEnrollment, tutorId);
                    } catch (error) {
                      console.error("Failed to backfill canonical tutor link for intro drill:", error);
                    }
                  }
                }
              }

              if (!normalizedStudent || !tutorOwnsStudent) {
                return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
              }

              const assignmentAccepted = await isTutorAssignmentAcceptedForStudent(student, tutorId);
              if (!assignmentAccepted) {
                return res.status(403).json({ message: "Accept this assignment before running handover verification." });
              }

              const workflow = ((student.personalProfile as any) || {}).workflow || {};
              if (!workflow.handoverRequiredAt || workflow.handoverCompletedAt) {
                return res.status(400).json({ message: "This student is not currently in handover verification." });
              }

              const { session: scheduledSession, error: scheduledSessionError } = await resolveTutorScheduledSession(
                tutorId,
                studentId,
                "handover",
                typeof scheduledSessionId === "string" ? scheduledSessionId : null
              );
              if (scheduledSessionError) {
                return res.status(500).json({ message: "Failed to validate handover session context" });
              }
              if (!scheduledSession) {
                return res.status(400).json({ message: "A confirmed continuity check session is required before handover verification can submit." });
              }

              const handoverLaunch = getSessionLaunchState(scheduledSession, "handover");
              if (!handoverLaunch.canLaunch) {
                return res.status(400).json({ message: "Handover verification is blocked until the continuity check session is confirmed." });
              }

              if (verificationPhase === "Time Pressure Stability") {
                const inheritedTimerContract = await loadLatestTpsTimerContract({
                  studentId: String(studentId),
                  topic: normalizedTopic,
                });
                if (!inheritedTimerContract) {
                  return res.status(409).json({
                    code: TPS_TIMER_BASELINE_INCOMPLETE,
                    message:
                      "Inherited Time Pressure Stability cannot be verified without the student/topic Timer Contract. Re-establish timing authority through targeted evidence-native re-diagnosis.",
                    decisionAuthority: "evidence_native",
                    requiredRoute: "evidence_complete_diagnosis",
                    targetedRediagnosisStartPhase: "Structured Execution",
                  });
                }
                const handoverTimingLineageError =
                  await validateTpsHandoverTimedAttemptLineage({
                    contract: inheritedTimerContract,
                    sets: verificationBlocks,
                  });
                if (handoverTimingLineageError) {
                  return res.status(409).json({
                    code: "TPS_HANDOVER_TIMING_LINEAGE_INVALID",
                    message: handoverTimingLineageError,
                    decisionAuthority: "evidence_native",
                  });
                }
              }

              let handoverSummary:
                | ReturnType<typeof computeHandoverVerificationSummary>
                | ReturnType<typeof computeHandoverRediagnosisSummary>;
              let verificationBlock = verificationBlocks[0];

              if (isTargetedRediagnosis) {
                const adaptiveSummary = computeAdaptiveDiagnosisSummary(startingPhase!, verificationBlocks);
                const adaptivePathError = validateAdaptiveDiagnosisPath(startingPhase!, adaptiveSummary);
                if (adaptivePathError) {
                  return res.status(400).json({ message: adaptivePathError });
                }
                handoverSummary = computeHandoverRediagnosisSummary(
                  startingPhase!,
                  previousStability,
                  verificationBlocks
                );
              } else {
                const verificationSummary = computeHandoverVerificationSummary(
                  verificationPhase,
                  previousStability,
                  verificationBlock,
                );
                if (verificationSummary.status !== "evaluated") {
                  return res.status(400).json({
                    message: `Handover evidence is not decision-eligible: ${verificationSummary.reason}`,
                  });
                }
                if (verificationSummary.verificationOutcome === "continue_verification") {
                  return res.status(409).json({
                    message: "Handover continuity evidence is not yet sufficient. Record another clean opportunity under the same inherited phase conditions.",
                    decisionAuthority: "evidence_native",
                    requiredAction: "record_additional_continuity_evidence",
                    dimensions: verificationSummary.dimensions,
                  });
                }
                handoverSummary = verificationSummary;
              }

              const id = uuidv4();
              const responseSnapshot = buildResponseSnapshotV1({
                sourceDrillId: id,
                topic: normalizedTopic,
                mode: isTargetedRediagnosis ? "handover_rediagnosis" : "handover_verification",
                phase: isTargetedRediagnosis ? startingPhase! : verificationPhase!,
                sets: verificationBlocks as any,
                drillScore: Number(handoverSummary.verificationScore || 0),
                setScores: isTargetedRediagnosis
                  ? (handoverSummary as ReturnType<typeof computeHandoverRediagnosisSummary>).phaseChecks.map((check: any) =>
                      Number(check.phaseScore || 0),
                    )
                  : [Number(handoverSummary.verificationScore || 0)],
                engineOutcomeRef: {
                  phaseBefore: verificationPhase,
                  stabilityBefore: previousStability,
                  phaseAfter: handoverSummary.resultingPhase,
                  stabilityAfter: handoverSummary.resultingStability,
                  transitionReason: String(handoverSummary.verificationOutcome),
                },
              });
              const { data: inserted, error } = await supabase
                .from("intro_session_drills")
                .insert({
                  id,
                  student_id: studentId,
                  tutor_id: tutorId,
                  drill: JSON.stringify({
                    handoverTopic: normalizedTopic,
                    phase: verificationPhase,
                    startingPhase: startingPhase,
                    previousStability,
                    drillType: "handover_verification",
                    handoverMode: isTargetedRediagnosis ? "targeted_re_diagnosis" : "verification",
                    scheduledSessionId: scheduledSession.id,
                    sets: verificationBlocks,
                    summary: handoverSummary,
                    responseSnapshot,
                  }),
                  scheduled_session_id: scheduledSession.id,
                  submitted_at: new Date().toISOString(),
                })
                .select()
                .single();
              if (error) {
                console.error("Error inserting handover verification drill:", error);
                return res.status(500).json({ message: "Failed to store handover verification results" });
              }

              await persistEvidenceLedgerShadow({
                sourceDrillId: String(inserted?.id || id),
                studentId: String(studentId),
                tutorId: String(tutorId),
                topic: normalizedTopic,
                scheduledSessionId: String(scheduledSession.id),
                trainingSessionRunId: null,
                sessionGroupId: String(scheduledSession.id),
                sessionContext: "handover_verification",
                drillType: isTargetedRediagnosis ? "diagnosis" : "verification",
                observedPhase: startingPhase!,
                statePhaseBefore: verificationPhase,
                stabilityBefore: previousStability,
                statePhaseAfter: handoverSummary.resultingPhase,
                stabilityAfter: handoverSummary.resultingStability,
                transitionReason: String(handoverSummary.verificationOutcome),
                observedAt: String(inserted?.submitted_at || new Date().toISOString()),
                sets: verificationBlocks as any,
              });

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
              const existingTopic = topicsStore[normalizedTopic] && typeof topicsStore[normalizedTopic] === "object"
                ? topicsStore[normalizedTopic]
                : {};
              const existingHistory = Array.isArray(existingTopic.history) ? [...existingTopic.history] : [];
              const nowIso = new Date().toISOString();

              topicsStore[normalizedTopic] = {
                ...existingTopic,
                topic: normalizedTopic,
                phase: handoverSummary.resultingPhase,
                stability: handoverSummary.resultingStability,
                lastUpdated: nowIso,
                nextAction: handoverSummary.nextAction,
                observationNotes: [
                  `Handover evidence decision: ${handoverSummary.verificationOutcomeLabel}`,
                  (handoverSummary as any).evidenceReason
                    ? `Evidence: ${(handoverSummary as any).evidenceReason}`
                    : null,
                  handoverSummary.constraint ? `Constraint: ${handoverSummary.constraint}` : null,
                  typeof handoverSummary.verificationScore === "number"
                    ? `Compatibility score (non-authoritative): ${handoverSummary.verificationScore}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" | "),
                history: [
                  ...existingHistory,
                  {
                    date: nowIso,
                    phase: handoverSummary.resultingPhase,
                    stability: handoverSummary.resultingStability,
                    nextAction: handoverSummary.nextAction,
                    observationNotes: `Handover evidence decision: ${handoverSummary.verificationOutcomeLabel}.`,
                    structuredObservation: {
                      drillType: "handover_verification",
                      handoverMode: isTargetedRediagnosis ? "targeted_re_diagnosis" : "verification",
                      observedPhase: handoverSummary.phase,
                      previousStability: handoverSummary.previousStability,
                      decisionAuthority: (handoverSummary as any).decisionAuthority || "evidence_native",
                      scoreAuthority: (handoverSummary as any).scoreAuthority ?? false,
                      compatibilityScore: handoverSummary.verificationScore,
                      verificationScore: handoverSummary.verificationScore,
                      verificationOutcome: handoverSummary.verificationOutcome,
                      verificationOutcomeLabel: handoverSummary.verificationOutcomeLabel,
                      verificationConfidence: handoverSummary.confidence,
                      evidenceReason: (handoverSummary as any).evidenceReason || null,
                      dimensionDecisions: (handoverSummary as any).dimensions || [],
                      resultingPhase: handoverSummary.resultingPhase,
                      resultingStability: handoverSummary.resultingStability,
                      reDiagnosisRequired: handoverSummary.reDiagnosisRequired,
                      nextAction: handoverSummary.nextAction,
                      constraint: handoverSummary.constraint,
                    },
                    drillId: inserted.id,
                  },
                ].slice(-60),
              };

              topicConditioningStore.topics = topicsStore;
              topicConditioningStore.lastUpdatedAt = nowIso;
              conceptMastery.topicConditioning = topicConditioningStore;

              await storage.updateStudent(studentId, { conceptMastery });

              await supabase
                .from("scheduled_sessions")
                .update({
                  status: "completed",
                  attendance_status: "both_joined",
                  recording_status: "manual_not_tracked",
                  transcript_status: "manual_not_tracked",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", scheduledSession.id);

              const scoring = handoverSummary.repRows.map((row) => ({
                set: verificationBlocks[0]?.setName || verificationBlock?.setName || "Verification Block",
                rep: row.rep,
                score: row.repScore,
                setScore: handoverSummary.verificationScore,
                setPoints: handoverSummary.verificationScore,
                setMaxPoints: 100,
                sessionScore: handoverSummary.verificationScore,
                decisionAuthority: (handoverSummary as any).decisionAuthority || "evidence_native",
                scoreAuthority: (handoverSummary as any).scoreAuthority ?? false,
                phase: handoverSummary.phase,
                stability: handoverSummary.resultingStability,
                previousStability: handoverSummary.previousStability,
                verificationOutcome: handoverSummary.verificationOutcome,
                verificationOutcomeLabel: handoverSummary.verificationOutcomeLabel,
                confidence: handoverSummary.confidence,
                reDiagnosisRequired: handoverSummary.reDiagnosisRequired,
                nextAction: handoverSummary.nextAction,
                constraint: handoverSummary.constraint,
              }));

              res.json({
                success: true,
                id: inserted.id,
                handoverTopic: normalizedTopic,
                scoring,
                summary: handoverSummary,
                responseSnapshot,
              });
            } catch (err) {
              console.error("Exception in handover verification submission:", err);
              res.status(500).json({ message: "Internal server error" });
            }
          });

          app.post("/api/tutor/training-session-drill", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
            let emergencyDbClient: any = null;
            try {
              const tutorId = (req as any).dbUser.id;
              const { studentId, sessionDrills, scheduledSessionId } = req.body;

              if (!studentId || !Array.isArray(sessionDrills) || sessionDrills.length === 0) {
                return res.status(400).json({ message: "Missing or invalid studentId or sessionDrills array" });
              }

              const student = await storage.getStudent(studentId);
              if (!student || student.tutorId !== tutorId) {
                return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
              }

              const assignmentAccepted = await isTutorAssignmentAcceptedForStudent(student, tutorId);
              if (!assignmentAccepted) {
                return res.status(403).json({ message: "Accept this assignment before running drills for this student." });
              }

              const operationalMode = await getTutorOperationalMode(tutorId);
              let scheduledSession: any = null;

              if (isLiveSchedulingMode(operationalMode) || operationalMode === "training" || operationalMode === "sandbox") {
                const { session: resolvedScheduledSession, error: scheduledSessionError } = await resolveTutorScheduledSession(
                  tutorId,
                  studentId,
                  "training",
                  typeof scheduledSessionId === "string" ? scheduledSessionId : null
                );
                if (scheduledSessionError) {
                  return res.status(500).json({ message: "Failed to validate training session context" });
                }
                if (!resolvedScheduledSession) {
                  return res.status(400).json({ message: "A Response Integrity training lesson must be attached before drill submission." });
                }

                const authoritativeScheduledSession = await reconcileTrainingSessionCompletionFromRun({
                  session: resolvedScheduledSession,
                  tutorId,
                  studentId,
                });

                if (operationalMode === "training" || operationalMode === "sandbox") {
                  const status = String(authoritativeScheduledSession.status || "").trim();
                  const hasConfirmedSchedule =
                    ["confirmed", "ready", "live"].includes(status) &&
                    !!resolvedScheduledSession.parent_confirmed &&
                    !!resolvedScheduledSession.tutor_confirmed;

                  if (!hasConfirmedSchedule) {
                    return res.status(400).json({
                      message: "Training drills must submit from a tutor-confirmed weekly Response Integrity lesson.",
                    });
                  }
                } else {
                  const trainingLaunch = getSessionLaunchState(authoritativeScheduledSession, "training");
                  if (!trainingLaunch.canLaunch) {
                    return res.status(400).json({ message: "Training drills must submit from an active or imminently scheduled Response Integrity lesson." });
                  }
                }

                const quotaAuthority = await getTrainingPackageQuotaAuthority({
                  operationalMode,
                  studentId,
                  student,
                  session: authoritativeScheduledSession,
                });
                if (quotaAuthority.decision.blocked) {
                  return res.status(409).json({
                    message: trainingPackageQuotaMessage(quotaAuthority.decision),
                    code: quotaAuthority.decision.code,
                    monthlyQuota: quotaAuthority.monthlyQuota,
                  });
                }

                scheduledSession = authoritativeScheduledSession;
              }

              emergencyDbClient = isEmergencyDbMode() ? await pool.connect() : null;
              if (emergencyDbClient) await emergencyDbClient.query("BEGIN");
              const pendingEmergencyLedgerInputs: EvidenceLedgerProjectionInput[] = [];
              const pendingEmergencyShadowComparisons: TrainingEvidenceShadowDatasetInput[] = [];

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

              const sessionId = uuidv4();
              const sessionStartTime = new Date().toISOString();
              const drillResults = [];
              const scheduledSessionRecordId = scheduledSession?.id || null;

              const trainingRun = isEmergencyDbMode()
                ? (await emergencyDbClient!.query(
                    `INSERT INTO public.training_session_runs
                      (id, scheduled_session_id, student_id, tutor_id, topic_count, started_at, status, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', $6, $6)
                     RETURNING *`,
                    [sessionId, scheduledSessionRecordId, studentId, tutorId, sessionDrills.length, sessionStartTime],
                  )).rows[0]
                : (await supabase
                    .from("training_session_runs")
                    .insert({
                      id: sessionId,
                      scheduled_session_id: scheduledSessionRecordId,
                      student_id: studentId,
                      tutor_id: tutorId,
                      topic_count: sessionDrills.length,
                      started_at: sessionStartTime,
                      status: "in_progress",
                      created_at: sessionStartTime,
                      updated_at: sessionStartTime,
                    })
                    .select()
                    .single()).data;

              // Process each drill in the session
              for (const drillData of sessionDrills) {
                const {
                  trainingTopic,
                  drill,
                  phase: rawPhase,
                  previousStability: rawPreviousStability,
                  tpsTimingSourceContextId,
                } = drillData;
                const drillSets = normalizeIntroDrillSets(drill);
                const observedPhase = parseAuthoritativePhase(rawPhase);
                const normalizedTopic = String(trainingTopic || "").trim();

                if (drillSets.length === 0) {
                  throw new Error(`Missing drill data for topic ${normalizedTopic}`);
                }
                if (!observedPhase) {
                  throw new Error(`Invalid or missing phase for topic ${normalizedTopic}`);
                }
                if (!normalizedTopic) {
                  throw new Error("Training topic is required for each drill");
                }

                const drillValidationError = validateDrillStructure("training", observedPhase, drillSets);
                if (drillValidationError) {
                  throw new Error(`Validation error for ${normalizedTopic}: ${drillValidationError}`);
                }
                const passiveTimingValidationError = validateTrainingPassiveTimingSubmission({
                  observedPhase,
                  sets: drillSets,
                });
                if (passiveTimingValidationError) {
                  throw Object.assign(
                    new Error(
                      `Timing evidence invalid for ${normalizedTopic}: ${passiveTimingValidationError}`,
                    ),
                    {
                      statusCode: 400,
                      code: "TPS_TIMING_EVIDENCE_INVALID",
                    },
                  );
                }

                if (observedPhase === "Structured Execution") {
                  const passiveTimingSourceContextId =
                    scheduledSessionRecordId ||
                    String(tpsTimingSourceContextId || "").trim();
                  if (!passiveTimingSourceContextId) {
                    throw Object.assign(
                      new Error(
                        `Timing evidence invalid for ${normalizedTopic}: passive baseline lineage is missing its session context.`,
                      ),
                      {
                        statusCode: 400,
                        code: "TPS_PASSIVE_TIMING_LINEAGE_INVALID",
                      },
                    );
                  }
                  const passiveTimingLineageError =
                    await validateTrainingPassiveTimingAttemptLineage({
                      studentId,
                      topic: normalizedTopic,
                      sourceContextId: passiveTimingSourceContextId,
                      sets: drillSets,
                    });
                  if (passiveTimingLineageError) {
                    throw Object.assign(
                      new Error(
                        `Timing evidence invalid for ${normalizedTopic}: ${passiveTimingLineageError}`,
                      ),
                      {
                        statusCode: 409,
                        code: "TPS_PASSIVE_TIMING_LINEAGE_INVALID",
                      },
                    );
                  }
                }

                // Get current topic state
                const existing = topicsStore[normalizedTopic] && typeof topicsStore[normalizedTopic] === "object"
                  ? topicsStore[normalizedTopic]
                  : {};

                const previousStability = normalizeStability(
                  existing?.stability || rawPreviousStability || "Low"
                );
                // Score the drill against the phase that was actually run. If persisted topic
                // state lags behind the launched drill, falling back to the stored phase turns
                // every later-phase observation into a silent zero because the field aliases differ.
                const effectivePhase = observedPhase;
                const existingHistory = Array.isArray(existing.history) ? [...existing.history] : [];
                let priorConsecutiveLows = 0;
                if (existingHistory.length > 0) {
                  for (let idx = existingHistory.length - 1; idx >= 0; idx -= 1) {
                    const entryStability = normalizeStability(existingHistory[idx]?.stability || "");
                    if (entryStability === "Low") {
                      priorConsecutiveLows += 1;
                    } else {
                      break;
                    }
                  }
                } else if (previousStability === "Low") {
                  priorConsecutiveLows = 1;
                }

                const tpsTimingSourceEpochKey = deriveStructuredExecutionEpochKeyForTraining({
                  history: existingHistory,
                  observedPhase: effectivePhase,
                });

                const proposedTrainingSummary = computeTrainingSessionSummary(
                  effectivePhase,
                  previousStability,
                  drillSets,
                  priorConsecutiveLows
                );

                const drillId = uuidv4();
                let pendingTrainingTimerContract = null as ReturnType<
                  typeof deriveTrainingTpsTimerContract
                >;
                let persistedTimerContract: PersistedTpsTimerContract | null = null;

                const progressingFromStructuredExecution =
                  effectivePhase === "Structured Execution" &&
                  proposedTrainingSummary.phase === "Controlled Discomfort" &&
                  proposedTrainingSummary.transitionReason === "phase progress";

                if (progressingFromStructuredExecution && tpsTimingSourceEpochKey) {
                  const priorTimingRows = await loadTpsTimingDrillRows({
                    studentId,
                    queryClient: isEmergencyDbMode() ? emergencyDbClient : null,
                  });
                  const currentTimingRow: StoredDrillRow = {
                    id: drillId,
                    student_id: studentId,
                    submitted_at: sessionStartTime,
                    drill: {
                      drillType: "training",
                      trainingTopic: normalizedTopic,
                      phase: effectivePhase,
                      sets: drillSets,
                      tpsTimingAuthority: {
                        version: 1,
                        source: "training_independent_execution",
                        sourceEpochKey: tpsTimingSourceEpochKey,
                        measurementBoundary: "begin_to_student_finished",
                        assignedBy: "server",
                      },
                    },
                  };
                  pendingTrainingTimerContract = deriveTrainingTpsTimerContract({
                    rows: [...priorTimingRows, currentTimingRow],
                    studentId,
                    topic: normalizedTopic,
                    sourceEpochKey: tpsTimingSourceEpochKey,
                  });
                }

                const needsExistingTimerContract =
                  effectivePhase === "Time Pressure Stability" ||
                  effectivePhase === "Controlled Discomfort";

                if (needsExistingTimerContract) {
                  persistedTimerContract = await loadLatestTpsTimerContract({
                    studentId,
                    topic: normalizedTopic,
                  });
                }

                const timingReadiness = resolveTpsTrainingReadiness({
                  observedPhase: effectivePhase,
                  previousStability,
                  proposedPhase: proposedTrainingSummary.phase,
                  proposedStability: proposedTrainingSummary.stability,
                  transitionReason: proposedTrainingSummary.transitionReason,
                  hasTimerContract: Boolean(persistedTimerContract),
                  canFreezeTrainingBaseline: Boolean(pendingTrainingTimerContract),
                });

                if (timingReadiness.action === "targeted_rediagnosis") {
                  const timingError = Object.assign(
                    new Error(timingReadiness.reason),
                    {
                      statusCode: 409,
                      code: TPS_TIMER_BASELINE_INCOMPLETE,
                      targetedRediagnosisStartPhase:
                        timingReadiness.targetedRediagnosisStartPhase,
                    },
                  );
                  throw timingError;
                }

                if (
                  effectivePhase === "Time Pressure Stability" &&
                  persistedTimerContract
                ) {
                  const timedAttemptLineageError =
                    await validateTpsTrainingDrillTimedAttemptLineage({
                      contract: persistedTimerContract,
                      sets: drillSets,
                    });
                  if (timedAttemptLineageError) {
                    throw Object.assign(new Error(timedAttemptLineageError), {
                      statusCode: 409,
                      code: "TPS_TIMED_EVIDENCE_INVALID",
                    });
                  }
                }

                let trainingSummary = proposedTrainingSummary;
                if (timingReadiness.action === "hold_structured_execution") {
                  trainingSummary = {
                    ...proposedTrainingSummary,
                    phase: timingReadiness.resultingPhase,
                    stability: timingReadiness.resultingStability,
                    transitionReason: "remain",
                    phaseDecision: "remain",
                    nextAction:
                      "Run the next legitimate Structured Execution Training cycle and preserve a complete clean Independent Execution timing set.",
                    constraint:
                      "Do not progress to Controlled Discomfort until the current Structured Execution epoch has a complete clean Independent Execution baseline set.",
                    requiresTargetedRediagnosis: false,
                    targetedRediagnosisStartPhase: null,
                    timingReadiness: {
                      code: timingReadiness.issueCode,
                      status: "hold_structured_execution",
                      reason: timingReadiness.reason,
                    },
                  };
                }

                const responseSnapshot = buildResponseSnapshotV1({
                  sourceDrillId: drillId,
                  topic: normalizedTopic,
                  mode: "training",
                  phase: effectivePhase,
                  sets: drillSets as any,
                  drillScore: trainingSummary.sessionScore,
                  setScores: trainingSummary.setScores,
                  engineOutcomeRef: {
                    phaseBefore: effectivePhase,
                    stabilityBefore: previousStability,
                    phaseAfter: trainingSummary.phase,
                    stabilityAfter: trainingSummary.stability,
                    transitionReason: trainingSummary.transitionReason,
                  },
                });
                const drillPayload = {
                  trainingTopic: normalizedTopic,
                  phase: trainingSummary.observedPhase,
                  previousStability: trainingSummary.previousStability,
                  drillType: "training",
                  sets: drillSets,
                  summary: trainingSummary,
                  responseSnapshot,
                  sessionId: sessionId,
                  scheduledSessionId: scheduledSessionRecordId,
                  tpsTimingAuthority: tpsTimingSourceEpochKey
                    ? {
                        version: 1,
                        source: "training_independent_execution",
                        sourceEpochKey: tpsTimingSourceEpochKey,
                        measurementBoundary: "begin_to_student_finished",
                        assignedBy: "server",
                      }
                    : null,
                };
                const inserted = isEmergencyDbMode()
                  ? (await emergencyDbClient!.query(
                      `INSERT INTO public.intro_session_drills
                        (id, student_id, tutor_id, drill, scheduled_session_id, training_session_run_id, submitted_at)
                       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
                       RETURNING *`,
                      [drillId, studentId, tutorId, JSON.stringify(drillPayload), scheduledSessionRecordId, trainingRun?.id || sessionId, sessionStartTime],
                    )).rows[0]
                  : (await supabase
                      .from("intro_session_drills")
                      .insert({
                        id: drillId,
                        student_id: studentId,
                        tutor_id: tutorId,
                        drill: JSON.stringify(drillPayload),
                        scheduled_session_id: scheduledSessionRecordId,
                        training_session_run_id: trainingRun?.id || sessionId,
                        submitted_at: sessionStartTime,
                      })
                      .select()
                      .single()).data;
                const error = inserted ? null : new Error("Training drill insert returned no row");

                if (error) {
                  throw new Error(`Failed to store drill for ${normalizedTopic}`);
                }

                if (
                  timingReadiness.action === "allow" &&
                  timingReadiness.shouldFreezeTrainingContract &&
                  pendingTrainingTimerContract
                ) {
                  persistedTimerContract = isEmergencyDbMode()
                    ? await persistTpsTimerContractDirect({
                        queryClient: emergencyDbClient!,
                        contract: pendingTrainingTimerContract,
                        tutorId,
                      })
                    : await persistTpsTimerContract({
                        contract: pendingTrainingTimerContract,
                        tutorId,
        ÔO4ÁfÚµÎ(ö+my÷WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%GWF˜"∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG2“vóB&ˆ÷ó6RÊ∆¬Ä¢EUDı%ÙÙ‰$Ù$Dî‰uÙDÙ5T‘TÂE2Ê÷Ü7ñÊ2ÜFˆ7V÷VÁBí”‚∞¢ñbÇFˆ7V÷VÁBÁ&WVó&W466WFÊ6Rí∞¢&WGW&‚Fˆ7V÷VÁC∞¢–†¢6ˆÁ7B∆ˆFVB“vóB∆ˆEGWF˜$ˆÊ&ˆ&FñÊtFˆ7V÷VÁBÜFˆ7V÷VÁBÁ7FWì∞¢&WGW&‚∞¢7FW¢∆ˆFVBÁ7FW¿¢6ˆFS¢∆ˆFVBÊ6ˆFR¿¢FóF∆S¢∆ˆFVBÁFóF∆R¿¢fW'6ñˆ„¢∆ˆFVBÁfW'6ñˆ‚¿¢VffV7FófTFFS¢∆ˆFVBÊVffV7FófTFFRÛÚÁV∆¬¿¢∆7EWFFVDC¢∆ˆFVBÊ∆7EWFFVDBÛÚÁV∆¬¿¢&WVó&W466WFÊ6S¢∆ˆFVBÁ&WVó&W466WFÊ6R¿¢&WVó&W5W∆ˆC¢∆ˆFVBÁ&WVó&W5W∆ˆB¿¢÷ÊFF˜'î6∆W6W3¢∆ˆFVBÊ÷ÊFF˜'î6∆W6W2¿¢6ˆÁFVÁC¢∆ˆFVBÊ6ˆÁFVÁB¿¢6ˆÁFVÁDÜ6É¢∆ˆFVBÊ6ˆÁFVÁDÜ6Ç¿¢”∞¢“ê¢ì∞†¢&W2Êß6ˆ‚á∞¢∆ñ6Fñˆ‰ñC¢∆FW7DÊñB¿¢Fˆ7V÷VÁG2¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrGWF˜"ˆÊ&ˆ&FñÊrFˆ7V÷VÁG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇˆÊ&ˆ&FñÊrFˆ7V÷VÁG2"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆí˜GWF˜"ˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2Û¶Fˆ57FWˆ66WB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'GWF˜"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7BFˆ57FW“ÁV÷&W"á&WÁ&◊2ÊFˆ57FWì∞¢6ˆÁ7B∞¢∆ñ6Fñˆ‰ñB¿¢Fˆ7V÷VÁEfW'6ñˆ‚¿¢Fˆ7V÷VÁDÜ6Ç¿¢GóVDgV∆ƒÊ÷R¿¢66WFVEFñ÷W¶ˆÊR¿¢∆ˆ6∆R¿¢∆Ff˜&“¿¢6˜W&6Tf∆˜r¿¢f˜&‘FF¿¢66WFVD6∆W6T∂Wó2¿¢67&ˆ∆ƒ6ˆ◊∆WFñˆÂW&6VÁB¿¢fñWu7F'FVDB¿¢fñWt6ˆ◊∆WFVDB¿¢66WD6∆ñ6∂VDB¿¢““&WÊ&ˆGíÛÚ∑”∞†¢ñbÇ∆ñ6Fñˆ‰ñB«¬ÁV÷&W"Êó4ñÁFVvW"ÜFˆ57FWí«¬Fˆ57FW¬«¬Fˆ57FW‚Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ñÁf∆ñBˆÊ&ˆ&FñÊr66WFÊ6R&WVW7B"“ì∞¢–†¢ñbÇGóVDgV∆ƒÊ÷R«¬7G&ñÊráGóVDgV∆ƒÊ÷RíÁG&ñ“Çíí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%GóVBgV∆¬Ê÷Ró2&WVó&VB"“ì∞¢–†¢6ˆÁ7B∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ4'ïW6W"áW6W$ñBì∞¢6ˆÁ7B∆ñ6Fñˆ‚“∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'íí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBì∞¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"“ì∞¢–†¢6ˆÁ7BFVfñÊóFñˆ‚“vWEGWF˜$ˆÊ&ˆ&FñÊtFˆ7V÷VÁDFVfñÊóFñˆ‚ÜFˆ57FWì∞¢ñbÇFVfñÊóFñˆ‚Á&WVó&W466WFÊ6Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%FÜó2ˆÊ&ˆ&FñÊr7FWFˆW2Ê˜BW6Rñ‚÷66WFÊ6R‚"“ì∞¢–†¢6ˆÁ7B∆ˆFVB“vóB∆ˆEGWF˜$ˆÊ&ˆ&FñÊtFˆ7V÷VÁBÜFˆ57FWì∞¢ñbÜFˆ7V÷VÁEfW'6ñˆ‚bbFˆ7V÷VÁEfW'6ñˆ‚”“∆ˆFVBÁfW'6ñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢$Fˆ7V÷VÁBfW'6ñˆ‚÷ó6÷F6Ç"“ì∞¢–¢ñbÜFˆ7V÷VÁDÜ6ÇbbFˆ7V÷VÁDÜ6Ç”“∆ˆFVBÊ6ˆÁFVÁDÜ6Çí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢$Fˆ7V÷VÁB6ˆÁFVÁBÜ6Ç÷ó6÷F6Ç"“ì∞¢–†¢6ˆÁ7B66WFVD6∆W6T∂Wï6WB“ÊWr6WBÄ¢'&íÊó4'&íÜ66WFVD6∆W6T∂Wó2íÚ66WFVD6∆W6T∂Wó2Ê÷Çáf«VRí”‚7G&ñÊráf«VRíí¢µ–¢ì∞¢6ˆÁ7B÷ó76ñÊt6∆W6R“FVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W2ÊfñÊBÇÜ6∆W6Rí”‚66WFVD6∆W6T∂Wï6WBÊÜ2Ü6∆W6RÊ∂Wííì∞¢ñbÜ÷ó76ñÊt6∆W6Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢÷ÊFF˜'í6∆W6RÊ˜B6∂Ê˜v∆VFvVC¢G∂÷ó76ñÊt6∆W6RÊ∆&V«÷“ì∞¢–†¢6ˆÁ7B'6VEfñWu7F'FVDB“fñWu7F'FVDBÚÊWrFFRáfñWu7F'FVDBí¢ÁV∆√∞¢6ˆÁ7B'6VEfñWt6ˆ◊∆WFVDB“fñWt6ˆ◊∆WFVDBÚÊWrFFRáfñWt6ˆ◊∆WFVDBí¢ÁV∆√∞¢6ˆÁ7B'6VD66WD6∆ñ6∂VDB“66WD6∆ñ6∂VDBÚÊWrFFRÜ66WD6∆ñ6∂VDBí¢ÊWrFFRÇì∞†¢6ˆÁ7B&W7V«B“vóB7F˜&vRÊ7&VFUGWF˜$ˆÊ&ˆ&FñÊt66WFÊ6Rá∞¢∆ñ6Fñˆ‰ñB¿¢W6W$ñB¿¢Fˆ7V÷VÁE7FW¢Fˆ57FW¿¢Fˆ7V÷VÁD6ˆFS¢∆ˆFVBÊ6ˆFR¿¢Fˆ7V÷VÁEFóF∆S¢∆ˆFVBÁFóF∆R¿¢Fˆ7V÷VÁEfW'6ñˆ„¢∆ˆFVBÁfW'6ñˆ‚¿¢Fˆ7V÷VÁDVffV7FófTFFS¢∆ˆFVBÊVffV7FófTFFRÛÚÁV∆¬¿¢Fˆ7V÷VÁD∆7EWFFVDC¢∆ˆFVBÊ∆7EWFFVDBÚÊWrFFRÜ∆ˆFVBÊ∆7EWFFVDBí¢ÁV∆¬¿¢Fˆ7V÷VÁE6Ê6Ü˜C¢∆ˆFVBÊ6ˆÁFVÁB¿¢Fˆ7V÷VÁD6ÜV6∑7V”¢∆ˆFVBÊ6ˆÁFVÁDÜ6Ç¿¢GóVDgV∆ƒÊ÷S¢7G&ñÊráGóVDgV∆ƒÊ÷RíÁG&ñ“Çí¿¢66˜VÁDV÷ñ√¢∆ñ6Fñˆ‚ÊV÷ñ¬¿¢ÜˆÊTÁV÷&W%6Ê6Ü˜C¢∆ñ6Fñˆ‚ÁÜˆÊRÛÚÁV∆¬¿¢66WFVEFñ÷W¶ˆÊS¢66WFVEFñ÷W¶ˆÊRÚ7G&ñÊrÜ66WFVEFñ÷W¶ˆÊRí¢ÁV∆¬¿¢óFG&W73¢WáG&7E&WVW7Dóá&Wí¿¢W6W$vVÁC¢&WÊÜVFW'5≤'W6W"÷vVÁB%“«¬ÁV∆¬¿¢FWfñ6UGóS¢ñÊfW$FWfñ6UGóRá&WÊÜVFW'5≤'W6W"÷vVÁB%“í¿¢∆Ff˜&”¢∆Ff˜&“Ú7G&ñÊrá∆Ff˜&“í¢'vV""¿¢6W76ñˆ‰ñC¢&WÁ6W76ñˆ‰îB«¬ÁV∆¬¿¢∆ˆ6∆S¢∆ˆ6∆RÚ7G&ñÊrÜ∆ˆ6∆Rí¢ÁV∆¬¿¢6˜W&6Tf∆˜s¢6˜W&6Tf∆˜rÚ7G&ñÊrá6˜W&6Tf∆˜rí¢'GWF˜%ˆˆÊ&ˆ&FñÊu˜7FW"¿¢f˜&’6Ê6Ü˜Dß6ˆ„†¢f˜&‘FFbbGóVˆbf˜&‘FF””“&ˆ&¶V7B ¢Úˆ&¶V7BÊg&ˆ‘VÁG&ñW2Ä¢ˆ&¶V7BÊVÁG&ñW2Üf˜&‘FFíÊ÷ÇÖ∂∂Wí¬f«VU“í”‚µ7G&ñÊrÜ∂Wíí¬7G&ñÊráf«VRÛÚ""íÁG&ñ“Çï“ê¢ê¢¢ÁV∆¬¿¢66WFVD6∆W6W3¢FVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W2Êfñ«FW"ÇÜ6∆W6Rí”‚66WFVD6∆W6T∂Wï6WBÊÜ2Ü6∆W6RÊ∂Wííí¿¢67&ˆ∆ƒ6ˆ◊∆WFñˆÂW&6VÁC†¢GóVˆb67&ˆ∆ƒ6ˆ◊∆WFñˆÂW&6VÁB””“&ÁV÷&W" ¢Ú÷FÇÊ÷ÇÉ¬÷FÇÊ÷ñ‚É¬÷FÇÁ&˜VÊBá67&ˆ∆ƒ6ˆ◊∆WFñˆÂW&6VÁBííê¢¢ÁV∆¬¿¢fñWu7F'FVDC¢'6VEfñWu7F'FVDBbbÁV÷&W"Êó4Ê‚á'6VEfñWu7F'FVDBÊvWEFñ÷RÇííÚ'6VEfñWu7F'FVDB¢ÁV∆¬¿¢fñWt6ˆ◊∆WFVDC†¢'6VEfñWt6ˆ◊∆WFVDBbbÁV÷&W"Êó4Ê‚á'6VEfñWt6ˆ◊∆WFVDBÊvWEFñ÷RÇííÚ'6VEfñWt6ˆ◊∆WFVDB¢ÁV∆¬¿¢66WD6∆ñ6∂VDC†¢'6VD66WD6∆ñ6∂VDBbbÁV÷&W"Êó4Ê‚á'6VD66WD6∆ñ6∂VDBÊvWEFñ÷RÇííÚ'6VD66WD6∆ñ6∂VDB¢ÊWrFFRÇí¿¢“ì∞†¢ñbÇ&W7V«BÊ∆ñ6Fñˆ‚«¬&W7V«BÊ66WFÊ6Rí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFRˆÊ&ˆ&FñÊr66WFÊ6R"“ì∞¢–†¢&W2Êß6ˆ‚á∞¢7V66W73¢G'VR¿¢∆ñ6Fñˆ„¢&W7V«BÊ∆ñ6Fñˆ‚¿¢66WFÊ6S¢&W7V«BÊ66WFÊ6R¿¢&V6VóC¢∞¢66WFVDC¢&W7V«BÊ66WFÊ6RÊ66WFVDB¿¢Fˆ7V÷VÁD6ˆFS¢&W7V«BÊ66WFÊ6RÊFˆ7V÷VÁD6ˆFR¿¢Fˆ7V÷VÁEfW'6ñˆ„¢&W7V«BÊ66WFÊ6RÊFˆ7V÷VÁEfW'6ñˆ‚¿¢Fˆ7V÷VÁD6ÜV6∑7V”¢&W7V«BÊ66WFÊ6RÊFˆ7V÷VÁD6ÜV6∑7V“¿¢“¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"66WFñÊrGWF˜"ˆÊ&ˆ&FñÊrFˆ7V÷VÁC¢"¬W'&˜"ì∞¢ñbÄ¢W'&˜"ñÁ7FÊ6VˆbW'&˜"b`¢Úá7FW˜&FW"fñˆ∆FñˆÁ∆«&VGí&VV‚66WFVG«&WVó&VG∆÷ÊFF˜'í6∆W6RíˆíÁFW7BÜW'&˜"Ê÷W76vRê¢í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"Ê÷W76vR“ì∞¢–¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ66WBˆÊ&ˆ&FñÊrFˆ7V÷VÁB"“ì∞¢–¢–¢ì∞†¢ÚÚW∆ˆBGWF˜"ˆÊ&ˆ&FñÊrFˆ7V÷VÁ@¢Á˜7BÄ¢"ˆí˜GWF˜"ˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2˜W∆ˆB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'GWF˜"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B≤∆ñ6Fñˆ‰ñB¬Fˆ57FW¬fñ∆TÊ÷R¬fñ∆TFF¬fñ∆UGóR““&WÊ&ˆGì∞¢6ˆÁ7B'6VDFˆ57FW“GóVˆbFˆ57FW””“&ÁV÷&W""ÚFˆ57FW¢ÁV÷&W"ÜFˆ57FWì∞¢6ˆÁ7Bó56WVVÁFñ≈W∆ˆB“'6VDFˆ57FW””“"«¬'6VDFˆ57FW””“c∞†¢ñbÇ∆ñ6Fñˆ‰ñB«¬fñ∆TÊ÷R«¬fñ∆TFF«¬ó56WVVÁFñ≈W∆ˆBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ˆÊ«íFˆ27FW"Ñ÷G&ñ26W'Fñfñ6FRíÊBFˆ27FWbÜ6W'FñfñVBîBí66WBfñ∆RW∆ˆG2‚"“ì∞¢–†¢6ˆÁ7B∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ4'ïW6W"áW6W$ñBì∞¢6ˆÁ7B“∆ñ6FñˆÁ2ÊfñÊBÜ”‚ÊñB””“∆ñ6Fñˆ‰ñBí2Áì∞¢ñbÇí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"“ì∞¢–†¢6ˆÁ7B7W'&VÁDFˆ3"–¢'6VDFˆ57FW””“"ÚvóB∆ˆEGWF˜$ˆÊ&ˆ&FñÊtFˆ7V÷VÁBÉ"í¢ÁV∆√∞¢6ˆÁ7BÜ47W'&VÁDFˆ3$66WFÊ6R–¢'6VDFˆ57FW”“"«¿¢&ˆˆ∆V‚Ä¢6V∆V7D7W'&VÁEGWF˜$ˆÊ&ˆ&FñÊt66WFÊ6RÄ¢ÚÊˆÊ&ˆ&FñÊt66WFÊ6W2ÛÚµ“¿¢7W'&VÁDFˆ3"¿¢í¿¢ì∞†¢ñbá'6VDFˆ57FW””“"bbÜ47W'&VÁDFˆ3$66WFÊ6Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%ñ˜R◊W7B66WBFÜR7W'&VÁB&W7ˆÁ6RñÁFVw&óGí‘Ub”"ñ‚&Vf˜&RW∆ˆFñÊrñ˜W"6W'FñfñVB÷G&ñ26W'Fñfñ6FR‚"“ì∞¢–†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7BÊ˜&÷∆ó¶VDfñ∆TÊ÷R“7G&ñÊrÜfñ∆TÊ÷R«¬""íÁG&ñ“Çì∞¢ñbÇÊ˜&÷∆ó¶VDfñ∆TÊ÷Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$÷ó76ñÊrfñ∆RÊ÷R‚"“ì∞¢–†¢6ˆÁ7BÊ˜&÷∆ó¶VDfñ∆UGóR“7G&ñÊrÜfñ∆UGóR«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7Bfñ∆UGóT∆∆˜vVB“ÊWr6WBÖ≤&∆ñ6Fñˆ‚˜Fb"¬&ñ÷vR˜Êr"¬&ñ÷vRˆßVr"¬&ñ÷vRˆßr%“ì∞¢6ˆÁ7B∆˜vW$fñ∆TÊ÷R“Ê˜&÷∆ó¶VDfñ∆TÊ÷RÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7BWáFVÁ6ñˆ‰∆∆˜vVB“∆˜vW$fñ∆TÊ÷RÊVÊG5vóFÇÇ"ÁFb"í«¬∆˜vW$fñ∆TÊ÷RÊVÊG5vóFÇÇ"ÁÊr"í«¬∆˜vW$fñ∆TÊ÷RÊVÊG5vóFÇÇ"Êßr"í«¬∆˜vW$fñ∆TÊ÷RÊVÊG5vóFÇÇ"ÊßVr"ì∞†¢ñbÇfñ∆UGóT∆∆˜vVBÊÜ2ÜÊ˜&÷∆ó¶VDfñ∆UGóRíbbWáFVÁ6ñˆ‰∆∆˜vVBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ˆÊ«íDb¬‰r¬•r¬ÊB•Trfñ∆W2&R7W˜'FVBf˜"V÷W&vVÊ7íW∆ˆG2‚"“ì∞¢–†¢6ˆÁ7BÊ˜&÷∆ó¶VD&6ScB“7G&ñÊrÜfñ∆TFFíÊñÊ6«VFW2Ç"¬"ê¢ÚÖ7G&ñÊrÜfñ∆TFFíÁ7∆óBÇ"¬"íÁ˜Çí«¬""ê¢¢7G&ñÊrÜfñ∆TFFì∞†¢6ˆÁ7B'VffW"“'VffW"Êg&ˆ“ÜÊ˜&÷∆ó¶VD&6ScB¬&&6ScB"ì∞¢ñbÇ'VffW"Ê'óFT∆VÊwFÇí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%W∆ˆFVBfñ∆Rv2V◊Gí‚"“ì∞¢–†¢ñbÜ'VffW"Ê'óFT∆VÊwFÇ‚#R¢#B¢#Bí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%W∆ˆFVBfñ∆R◊W7B&R#R‘"˜"6÷∆∆W"‚"“ì∞¢–†¢∆WB'VÊF∆S¢&WGW&ÂGóS«GóVˆb7&VFTV÷W&vVÊ7îfñ∆T'VÊF∆S„∞¢G'í∞¢'VÊF∆R“7&VFTV÷W&vVÊ7îfñ∆T'VÊF∆RÜ'VffW"¬&ˆ6W72ÊVÁb‰T‘U$tT‰5ïÙDÙ5T‘TÂEÙT‰5%ïDîÙÂÙ¥Uíì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$V÷W&vVÊ7ífñ∆RVÊ7'óFñˆ‚fñ∆VC¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á∞¢÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$V÷W&vVÊ7ífñ∆RVÊ7'óFñˆ‚ó2VÊfñ∆&∆R‚"¿¢“ì∞¢–†¢6ˆÁ7B&˜FV7FVEW&¬“ˆí˜GWF˜"ˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2ÚG∑'6VDFˆ57FW“ˆfñ∆Sˆ∆ñ6Fñˆ‰ñC“G∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÜ∆ñ6Fñˆ‰ñBó÷∞¢6ˆÁ7B6∆ñVÁB“vóBˆˆ¬Ê6ˆÊÊV7BÇì∞†¢G'í∞¢vóB6∆ñVÁBÁVW'íÇ$$Ttî‚"ì∞†¢6ˆÁ7B∆ñ6FñˆÂ&W7V«B“vóB6∆ñVÁBÁVW'íÄ¢4TƒT5B†¢e$Ù“V&∆ñ2ÁGWF˜%ˆ∆ñ6FñˆÁ0¢tÑU$RñB“C¢‰BW6W%ˆñB“C ¢dı"UDDV¿¢∂∆ñ6Fñˆ‰ñB¬W6W$ñE“¿¢ì∞¢6ˆÁ7BWÜó7FñÊr“∆ñ6FñˆÂ&W7V«BÁ&˜w5≥”∞¢ñbÇWÜó7FñÊrí∞¢Fá&˜rÊWrW'&˜"Ç$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG57FGW2“GóVˆbWÜó7FñÊrÊFˆ7V÷VÁG5˜7FGW2””“&ˆ&¶V7B"bbWÜó7FñÊrÊFˆ7V÷VÁG5˜7FGW0¢Ú≤‚‚ÊWÜó7FñÊrÊFˆ7V÷VÁG5˜7FGW2–¢¢∞¢##¢&Ê˜E˜7F'FVB"¿¢#"#¢&Ê˜E˜7F'FVB"¿¢#2#¢&Ê˜E˜7F'FVB"¿¢#B#¢&Ê˜E˜7F'FVB"¿¢#R#¢&Ê˜E˜7F'FVB"¿¢#b#¢&Ê˜E˜7F'FVB"¿¢”∞†¢ñbá'6VDFˆ57FW””“"í∞¢ñbÇÜ47W'&VÁDFˆ3$66WFÊ6Rí∞¢Fá&˜rÊWrW'&˜"Ç%ñ˜R◊W7B66WBFÜR7W'&VÁB&W7ˆÁ6RñÁFVw&óGí‘Ub”"ñ‚&Vf˜&RW∆ˆFñÊrñ˜W"6W'FñfñVB÷G&ñ26W'Fñfñ6FR‚"ì∞¢–†¢ñbÖ7G&ñÊrÜFˆ7V÷VÁG57FGW5≤#"%“«¬&Ê˜E˜7F'FVB"í””“&&˜fVB"í∞¢Fá&˜rÊWrW'&˜"Ç%7FW"ó2«&VGí&˜fVBÊB6ÊÊ˜B&R&R◊W∆ˆFVB‚"ì∞¢–†¢Fˆ7V÷VÁG57FGW5≤#"%““'VÊFñÊu˜&WfñWr#∞¢Fˆ7V÷VÁG57FGW5≤#2%““&Ê˜E˜7F'FVB#∞†¢vóB6∆ñVÁBÁVW'íÄ¢îÂ4U%BîÂDÚ&ófFRÊV÷W&vVÊ7ï˜GWF˜%ˆˆÊ&ˆ&FñÊuˆfñ∆W2Ä¢∆ñ6FñˆÂˆñB¿¢W6W%ˆñB¿¢Fˆ5˜7FW¿¢˜&ñvñÊ≈ˆfñ∆UˆÊ÷R¿¢÷ñ÷U˜GóR¿¢'óFU˜6ó¶R¿¢6Ü#Sb¿¢6óÜW'FWáB¿¢ób¿¢WFÖ˜Fr¿¢7&VFVEˆ@¢íd≈TU2ÇC¬C"¬C2¬CB¬CR¬Cb¬Cr¬CÇ¬Cí¬C¬Ê˜rÇíñ¿¢∞¢∆ñ6Fñˆ‰ñB¿¢W6W$ñB¿¢'6VDFˆ57FW¿¢Ê˜&÷∆ó¶VDfñ∆TÊ÷R¿¢Ê˜&÷∆ó¶VDfñ∆UGóR«¬&∆ñ6Fñˆ‚ˆˆ7FWB◊7G&V“"¿¢'VffW"Ê'óFT∆VÊwFÇ¿¢'VÊF∆RÁ6Ü#Sb¿¢'VÊF∆RÊ6óÜW'FWáB¿¢'VÊF∆RÊób¿¢'VÊF∆RÊWFÖFr¿¢“¿¢ì∞†¢6ˆÁ7BWFFVE&W7V«B“vóB6∆ñVÁBÁVW'íÄ¢UDDRV&∆ñ2ÁGWF˜%ˆ∆ñ6FñˆÁ0¢4UBFˆ7V÷VÁG5˜7FGW2“C£¶ß6ˆÊ"¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW“"¿¢Fˆ5Û%˜7V&÷ó76ñˆÂ˜W&¬“C"¿¢Fˆ5Û%˜7V&÷ó76ñˆÂ˜W∆ˆFVEˆB“Ê˜rÇí¿¢Fˆ5Û%˜7V&÷ó76ñˆÂ˜fW&ñfñVB“f«6R¿¢Fˆ5Û%˜7V&÷ó76ñˆÂ˜fW&ñfñVEˆ'í“ÂTƒ¬¿¢Fˆ5Û%˜7V&÷ó76ñˆÂ˜fW&ñfñVEˆB“ÂTƒ¬¿¢Fˆ5Û%˜7V&÷ó76ñˆÂ˜&V¶V7FñˆÂ˜&V6ˆ‚“ÂTƒ¬¿¢WFFVEˆB“Ê˜rÇê¢tÑU$RñB“C0¢‰BW6W%ˆñB“C@¢$UEU$‰î‰r¶¿¢∞¢•4Ù‚Á7G&ñÊvñgíÜFˆ7V÷VÁG57FGW2í¿¢&˜FV7FVEW&¬¿¢∆ñ6Fñˆ‰ñB¿¢W6W$ñB¿¢“¿¢ì∞†¢ñbÇWFFVE&W7V«BÁ&˜w5≥“í∞¢Fá&˜rÊWrW'&˜"Ç$fñ∆VBFÚWFFRFˆ7V÷VÁB&V6˜&B"ì∞¢–¢“V«6Rñbá'6VDFˆ57FW””“bí∞¢ñbÖ7G&ñÊrÜWÜó7FñÊrÁ7FGW2«¬""íÁFÙ∆˜vW$66RÇí”“&&˜fVB"í∞¢Fá&˜rÊWrW'&˜"Ç$∆ñ6Fñˆ‚◊W7B&R&˜fVB&Vf˜&RW∆ˆFñÊrFÜR6W'FñfñVBîB6˜í‚"ì∞¢–†¢ñbÑÁV÷&W"ÜWÜó7FñÊrÊFˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FWí”“bí∞¢Fá&˜rÊWrW'&˜"Ç$6W'FñfñVBîBW∆ˆBó2ˆÊ«í∆∆˜vVBvÜñ∆RFÜR∆ñ6Fñˆ‚ó2ˆ‚7FWb‚"ì∞¢–†¢6ˆÁ7B∆ƒV&∆ñW%7FW4&˜fVB“≤#"¬#""¬#2"¬#B"¬#R%“ÊWfW'íÄ¢á7FWí”‚7G&ñÊrÜFˆ7V÷VÁG57FGW5∑7FW“«¬""í””“&&˜fVB"¿¢ì∞†¢ñbÇ∆ƒV&∆ñW%7FW4&˜fVBí∞¢Fá&˜rÊWrW'&˜"Ç%7FW2Fá&˜VvÇR◊W7B∆¬&R&˜fVB&Vf˜&RW∆ˆFñÊrFÜR6W'FñfñVBîB6˜í‚"ì∞¢–†¢6ˆÁ7B7W'&VÁE7FWe7FGW2“7G&ñÊrÜFˆ7V÷VÁG57FGW5≤#b%“«¬&Ê˜E˜7F'FVB"ì∞¢ñbÜ7W'&VÁE7FWe7FGW2””“'VÊFñÊu˜&WfñWr"í∞¢Fá&˜rÊWrW'&˜"Ç$6W'FñfñVBîB6˜íó2«&VGíVÊFñÊr4ÙÚ&WfñWrÊB6ÊÊ˜B&R&R◊W∆ˆFVB‚"ì∞¢–¢ñbÜ7W'&VÁE7FWe7FGW2””“&&˜fVB"í∞¢Fá&˜rÊWrW'&˜"Ç$6W'FñfñVBîB6˜íó2«&VGí&˜fVBÊB6ÊÊ˜B&R&R◊W∆ˆFVB‚"ì∞¢–¢ñbÜ7W'&VÁE7FWe7FGW2”“'VÊFñÊu˜W∆ˆB"bb7W'&VÁE7FWe7FGW2”“'&V¶V7FVB"í∞¢Fá&˜rÊWrW'&˜"Ç$6W'FñfñVBîBW∆ˆBó2ˆÊ«í∆∆˜vVBvÜñ∆R7FWbó2VÊFñÊrW∆ˆB˜"Ü2&VV‚&V¶V7FVBf˜"&W7V&÷ó76ñˆ‚‚"ì∞¢–†¢Fˆ7V÷VÁG57FGW5≤#b%““'VÊFñÊu˜&WfñWr#∞†¢vóB6∆ñVÁBÁVW'íÄ¢îÂ4U%BîÂDÚ&ófFRÊV÷W&vVÊ7ï˜GWF˜%ˆˆÊ&ˆ&FñÊuˆfñ∆W2Ä¢∆ñ6FñˆÂˆñB¿¢W6W%ˆñB¿¢Fˆ5˜7FW¿¢˜&ñvñÊ≈ˆfñ∆UˆÊ÷R¿¢÷ñ÷U˜GóR¿¢'óFU˜6ó¶R¿¢6Ü#Sb¿¢6óÜW'FWáB¿¢ób¿¢WFÖ˜Fr¿¢7&VFVEˆ@¢íd≈TU2ÇC¬C"¬C2¬CB¬CR¬Cb¬Cr¬CÇ¬Cí¬C¬Ê˜rÇíñ¿¢∞¢∆ñ6Fñˆ‰ñB¿¢W6W$ñB¿¢'6VDFˆ57FW¿¢Ê˜&÷∆ó¶VDfñ∆TÊ÷R¿¢Ê˜&÷∆ó¶VDfñ∆UGóR«¬&∆ñ6Fñˆ‚ˆˆ7FWB◊7G&V“"¿¢'VffW"Ê'óFT∆VÊwFÇ¿¢'VÊF∆RÁ6Ü#Sb¿¢'VÊF∆RÊ6óÜW'FWáB¿¢'VÊF∆RÊób¿¢'VÊF∆RÊWFÖFr¿¢“¿¢ì∞†¢6ˆÁ7BWFFVE&W7V«B“vóB6∆ñVÁBÁVW'íÄ¢UDDRV&∆ñ2ÁGWF˜%ˆ∆ñ6FñˆÁ0¢4UBFˆ7V÷VÁG5˜7FGW2“C£¶ß6ˆÊ"¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW“b¿¢Fˆ5Ûe˜7V&÷ó76ñˆÂ˜W&¬“C"¿¢Fˆ5Ûe˜7V&÷ó76ñˆÂ˜W∆ˆFVEˆB“Ê˜rÇí¿¢Fˆ5Ûe˜7V&÷ó76ñˆÂ˜fW&ñfñVB“f«6R¿¢Fˆ5Ûe˜7V&÷ó76ñˆÂ˜fW&ñfñVEˆ'í“ÂTƒ¬¿¢Fˆ5Ûe˜7V&÷ó76ñˆÂ˜fW&ñfñVEˆB“ÂTƒ¬¿¢Fˆ5Ûe˜7V&÷ó76ñˆÂ˜&V¶V7FñˆÂ˜&V6ˆ‚“ÂTƒ¬¿¢ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆB“ÂTƒ¬¿¢WFFVEˆB“Ê˜rÇê¢tÑU$RñB“C0¢‰BW6W%ˆñB“C@¢$UEU$‰î‰r¶¿¢∞¢•4Ù‚Á7G&ñÊvñgíÜFˆ7V÷VÁG57FGW2í¿¢&˜FV7FVEW&¬¿¢∆ñ6Fñˆ‰ñB¿¢W6W$ñB¿¢“¿¢ì∞†¢ñbÇWFFVE&W7V«BÁ&˜w5≥“í∞¢Fá&˜rÊWrW'&˜"Ç$fñ∆VBFÚWFFRFˆ7V÷VÁB&V6˜&B"ì∞¢–¢–†¢vóB6∆ñVÁBÁVW'íÇ$4Ù‘‘ïB"ì∞¢“6F6ÇÜW'&˜"í∞¢vóB6∆ñVÁBÁVW'íÇ%$Ùƒƒ$4≤"íÊ6F6ÇÇÇí”‚VÊFVfñÊVBì∞¢Fá&˜rW'&˜#∞¢“fñÊ∆«í∞¢6∆ñVÁBÁ&V∆V6RÇì∞¢–†¢6ˆÁ7B&Vg&W6ÜVD∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ4'ïW6W"áW6W$ñBì∞¢6ˆÁ7B&Vg&W6ÜVD“&Vg&W6ÜVD∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'íí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí2Áì∞†¢&WGW&‚&W2Êß6ˆ‚á∞¢7V66W73¢G'VR¿¢∆ñ6Fñˆ„¢&Vg&W6ÜVD¿¢&˜FV7FVEW&¬¿¢“ì∞¢–†¢ÚÚFV6ˆFR&6ScBfñ∆RFF¢6ˆÁ7B'VffW"“'VffW"Êg&ˆ“Üfñ∆TFF¬v&6ScBrì∞†¢ÚÚVÁ7W&Rfñ∆RFÇ&VvñÁ2vóFÇW6W$ñBfˆ∆FW ¢6ˆÁ7B6fTfñ∆TÊ÷R“G∑W6W$ñG“ÚG∑&ÊFˆ’UTîBÇó““Gµ7G&ñÊrÜfñ∆TÊ÷RíÁ&W∆6RÇıµÊ◊§’£”íÂÚ’“ˆr¬%Ú"ó÷∞†¢ÚÚW∆ˆBW6ñÊr6W'fW"á6W'fñ6R&ˆ∆Rí7W&6R6∆ñVÁBFÚfˆñB$≈2ó77VW0¢vóBVÁ7W&U&ófFT'V6∂WBá7W&6R¬'GWF˜"÷Fˆ7V÷VÁG2"ì∞¢6ˆÁ7B≤FF¢W∆ˆDFF¬W'&˜#¢W∆ˆDW'&˜"““vóB7W&6RÁ7F˜&vP¢Êg&ˆ“ÇwGWF˜"÷Fˆ7V÷VÁG2rê¢ÁW∆ˆBá6fTfñ∆TÊ÷R¬'VffW"¬∞¢6ˆÁFVÁEGóS¢fñ∆UGóR«¬VÊFVfñÊVB¿¢W6W'C¢f«6R¿¢“ì∞†¢ñbáW∆ˆDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Çu7W&6R7F˜&vRW∆ˆBW'&˜#¢r¬W∆ˆDW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢u7F˜&vRW∆ˆBfñ∆VBr¬W'&˜#¢W∆ˆDW'&˜"Ê÷W76vR“ì∞¢–†¢ÚÚW'6ó7BFÜRñ÷◊WF&∆Rˆ&¶V7B&VfW&VÊ6S≤&VG2&WVó&R&V6˜&BWFÜ˜&ó¶Fñˆ‚‡¢6ˆÁ7BW&ƒFF“≤V&∆ñ5W&√¢6ˆÊfñFVÁFñ≈&VfW&VÊ6RÇwGWF˜"÷Fˆ7V÷VÁG2r¬6fTfñ∆TÊ÷Rí”∞¢ñbÇW&ƒFFÚÁV&∆ñ5W&¬í∞¢6ˆÁ6ˆ∆RÊW'&˜"Çt6˜V∆BÊ˜B&W6ˆ«fRV&∆ñ2U$¬f˜"W∆ˆFVBˆÊ&ˆ&FñÊrFˆ7V÷VÁBr¬∞¢∆ñ6Fñˆ‰ñB¿¢Fˆ57FW¢'6VDFˆ57FW¿¢6fTfñ∆TÊ÷R¿¢“ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢uW∆ˆB7V66VVFVB'WBfñ∆RU$¬6˜V∆BÊ˜B&RvVÊW&FVBr“ì∞¢–†¢ÚÚ6fRFÚFF&6P¢6ˆÁ7BWFFVB“vóB7F˜&vRÁWFFUGWF˜%6WVVÁFñƒFˆ7V÷VÁBÜ∆ñ6Fñˆ‰ñB¬'6VDFˆ57FW¬W&ƒFFÁV&∆ñ5W&¬ì∞†¢ñbÇWFFVBí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢tfñ∆VBFÚWFFRFˆ7V÷VÁB&V6˜&Br“ì∞¢–†¢&W2Êß6ˆ‚á≤7V66W73¢G'VR¬∆ñ6Fñˆ„¢WFFVB¬V&∆ñ5W&√¢W&ƒFFÁV&∆ñ5W&¬“ì∞¢“6F6ÇÜW'&˜"í∞¢ñbÄ¢W'&˜"ñÁ7FÊ6VˆbW'&˜"b`¢Úá6WVVÁFñ¬7FW˜&FW"fñˆ∆FñˆÁ∆&∆ˆ6∂VBVÁFñ«∆«&VGí&˜fVG«&WVó&VG«VÊFñÊr&WfñWríˆíÁFW7BÄ¢W'&˜"Ê÷W76vP¢ê¢í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"Ê÷W76vR“ì∞¢–¢6ˆÁ6ˆ∆RÊW'&˜"ÇtW'&˜"W∆ˆFñÊrˆÊ&ˆ&FñÊrFˆ7V÷VÁBá6W'fW"ÜÊF∆W"ì¢r¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢tfñ∆VBFÚW∆ˆBFˆ7V÷VÁBr“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆí˜GWF˜"ˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2Û¶Fˆ57FWˆfñ∆R"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'GWF˜""¬&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B∆ñ6Fñˆ‰ñB“7G&ñÊrá&WÁVW'íÊ∆ñ6Fñˆ‰ñB«¬""íÁG&ñ“Çì∞¢6ˆÁ7BFˆ57FW“ÁV÷&W"á&WÁ&◊2ÊFˆ57FWì∞†¢ñbÇ∆ñ6Fñˆ‰ñB«¬ÁV÷&W"Êó4ñÁFVvW"ÜFˆ57FWí«¬ÜFˆ57FW”“"bbFˆ57FW”“bíí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ñÁf∆ñBV÷W&vVÊ7íFˆ7V÷VÁB&WVW7B‚"“ì∞¢–†¢6ˆÁ7B&ˆ∆R“á&W2ÁííÊF%W6W#ÚÁ&ˆ∆R«¬á&WÁ6W76ñˆ‚2ÁíìÚÁ&ˆ∆S∞¢ñbá&ˆ∆R””“'GWF˜""í∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ4'ïW6W"áW6W$ñBì∞¢6ˆÁ7B“∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'íí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBì∞¢ñbÇí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"“ì∞¢–¢–†¢6ˆÁ7B&˜u&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5B†¢e$Ù“&ófFRÊV÷W&vVÊ7ï˜GWF˜%ˆˆÊ&ˆ&FñÊuˆfñ∆W0¢tÑU$R∆ñ6FñˆÂˆñB“C¢‰BFˆ5˜7FW“C ¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïB¿¢∂∆ñ6Fñˆ‰ñB¬Fˆ57FW“¿¢ì∞†¢6ˆÁ7B&˜r“&˜u&W7V«BÁ&˜w5≥”∞¢ñbÇ&˜rí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$V÷W&vVÊ7íFˆ7V÷VÁBÊ˜Bf˜VÊB‚"“ì∞¢–†¢6ˆÁ7BÊ˜&÷∆ó¶T'óFV“áf«VS¢VÊ∂Ê˜v‚ì¢'VffW"”‚∞¢ñbÑ'VffW"Êó4'VffW"áf«VRíí∞¢&WGW&‚f«VS∞¢–¢ñbáf«VRñÁ7FÊ6VˆbVñÁCÑ'&íí∞¢&WGW&‚'VffW"Êg&ˆ“áf«VRì∞¢–¢ñbáGóVˆbf«VR””“'7G&ñÊr"í∞¢&WGW&‚'VffW"Êg&ˆ“áf«VR¬&&ñÊ'í"ì∞¢–¢ñbáf«VR”“ÁV∆¬í∞¢Fá&˜rÊWrW'&˜"Ç$V÷W&vVÊ7íFˆ7V÷VÁB7F˜&VBf«VRó2÷ó76ñÊr‚"ì∞¢–¢&WGW&‚'VffW"Êg&ˆ“áf«VR2Áíì∞¢”∞†¢6ˆÁ7B6óÜW'FWáB“Ê˜&÷∆ó¶T'óFVá&˜rÊ6óÜW'FWáBì∞¢6ˆÁ7Bób“Ê˜&÷∆ó¶T'óFVá&˜rÊóbì∞¢6ˆÁ7BWFÖFr“Ê˜&÷∆ó¶T'óFVá&˜rÊWFÖ˜Frì∞†¢6ˆÁ7B'VÊF∆R“∞¢6óÜW'FWáB¿¢ób¿¢WFÖFr¿¢”∞†¢6ˆÁ7B∆ñÁFWáB“FV7'óDV÷W&vVÊ7îfñ∆T'VÊF∆RÜ'VÊF∆R¬&ˆ6W72ÊVÁb‰T‘U$tT‰5ïÙDÙ5T‘TÂEÙT‰5%ïDîÙÂÙ¥Uíì∞¢6ˆÁ7BWáV7FVE6Ü#Sb“7G&ñÊrá&˜rÁ6Ü#Sb«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7B7GV≈6Ü#Sb“7&VFTÜ6ÇÇ'6Ü#Sb"íÁWFFRá∆ñÁFWáBíÊFñvW7BÇ&ÜWÇ"ì∞†¢ñbÜWáV7FVE6Ü#Sbbb7GV≈6Ü#Sb”“WáV7FVE6Ü#Sbí∞¢Fá&˜rÊWrW'&˜"Ç$V÷W&vVÊ7íFˆ7V÷VÁBñÁFVw&óGí6ÜV6≤fñ∆VC¢4Ñ”#Sb÷ó6÷F6Ç‚"ì∞¢–†¢6ˆÁ7B&tfñ∆TÊ÷R“7G&ñÊrá&˜rÊ˜&ñvñÊ≈ˆfñ∆UˆÊ÷R«¬Fˆ2“G∂Fˆ57FW“Ê&ñÊì∞¢6ˆÁ7B6fTfñ∆VÊ÷R“&tfñ∆TÊ÷RÁ7∆óBÇıµ≈¬ı“ÚíÁ˜Çí«¬Fˆ2“G∂Fˆ57FW“Ê&ñÊ∞†¢&W2Á6WDÜVFW"Ç$6ˆÁFVÁB’GóR"¬&˜rÊ÷ñ÷U˜GóR«¬&∆ñ6Fñˆ‚ˆˆ7FWB◊7G&V“"ì∞¢&W2Á6WDÜVFW"Ç$6ˆÁFVÁB‘Fó7˜6óFñˆ‚"¬ñÊ∆ñÊS≤fñ∆VÊ÷S“"G∑6fTfñ∆VÊ÷RÁ&W∆6RÇıµ«%∆‚%“ˆr¬%Ú"ó“&ì∞¢&W2Á6WDÜVFW"Ç$6ˆÁFVÁB‘∆VÊwFÇ"¬7G&ñÊrá∆ñÁFWáBÊ'óFT∆VÊwFÇíì∞¢&W2Á6WDÜVFW"Ç$66ÜR‘6ˆÁG&ˆ¬"¬'&ófFR¬ÊÚ◊7F˜&R"ì∞¢&WGW&‚&W2ÊVÊBá∆ñÁFWáBì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&WG&ñWfñÊrV÷W&vVÊ7íˆÊ&ˆ&FñÊrFˆ7V÷VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ&WG&ñWfRV÷W&vVÊ7íFˆ7V÷VÁB‚"“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆí˜GWF˜"ˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2Û¶Fˆ57FWˆF˜vÊ∆ˆB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'GWF˜"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BFˆ57FW“ÁV÷&W"á&WÁ&◊2ÊFˆ57FWì∞¢6ˆÁ7BFV◊∆FTfñ∆W3¢&V6˜&C∆ÁV÷&W"¬≤76WDfñ∆TÊ÷S¢7G&ñÊs≤F˜vÊ∆ˆDfñ∆TÊ÷S¢7G&ñÊr”‚“∞¢¢≤76WDfñ∆TÊ÷S¢%EB’D4b”ÁFb"¬F˜vÊ∆ˆDfñ∆TÊ÷S¢%&W7ˆÁ6RñÁFVw&óGí’D4b”ÁFb"“¿¢#¢≤76WDfñ∆TÊ÷S¢%EB‘Ub”"ÁFb"¬F˜vÊ∆ˆDfñ∆TÊ÷S¢%&W7ˆÁ6RñÁFVw&óGí‘Ub”"ÁFb"“¿¢3¢≤76WDfñ∆TÊ÷S¢%EB‘î4”2ÁFb"¬F˜vÊ∆ˆDfñ∆TÊ÷S¢%&W7ˆÁ6RñÁFVw&óGí‘î4”2ÁFb"“¿¢C¢≤76WDfñ∆TÊ÷S¢%EB’45”BÁFb"¬F˜vÊ∆ˆDfñ∆TÊ÷S¢%&W7ˆÁ6RñÁFVw&óGí’45”BÁFb"“¿¢S¢≤76WDfñ∆TÊ÷S¢%EB‘E2”RÁFb"¬F˜vÊ∆ˆDfñ∆TÊ÷S¢%&W7ˆÁ6RñÁFVw&óGí‘E2”RÁFb"“¿¢”∞†¢6ˆÁ7BFV◊∆FTfñ∆R“FV◊∆FTfñ∆W5∂Fˆ57FW”∞¢ñbÇFV◊∆FTfñ∆Rí∞¢ñbÜFˆ57FW””“bí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%7FWbó26W'FñfñVBîB6˜íÊBÜ2ÊÚF˜vÊ∆ˆF&∆RFV◊∆FR‚"“ì∞¢–¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ñÁf∆ñBFˆ7V÷VÁB7FW"“ì∞¢–†¢6ˆÁ7B≤76WDfñ∆TÊ÷R¬F˜vÊ∆ˆDfñ∆TÊ÷R““FV◊∆FTfñ∆S∞†¢6ˆÁ7BFV◊∆FUFÑ6ÊFñFFW2“∞¢ÚÚ6˜W&6RWÜV7WFñˆ‚áG7Ç6W'fW"ˆñÊFWÇÁG2ê¢fñ∆UU$≈FıFÇÜÊWrU$¬Ü‚‚ˆ76WG2˜GWF˜"÷ˆÊ&ˆ&FñÊrÚG∂76WDfñ∆TÊ÷W÷¬ñ◊˜'BÊ÷WFÁW&¬íí¿¢ÚÚFó7BWÜV7WFñˆ‚ÜÊˆFRFó7BˆñÊFWÇÊß2ê¢fñ∆UU$≈FıFÇÜÊWrU$¬Ü‚‚Ú‚‚ˆ76WG2˜GWF˜"÷ˆÊ&ˆ&FñÊrÚG∂76WDfñ∆TÊ÷W÷¬ñ◊˜'BÊ÷WFÁW&¬íí¿¢ÚÚ'VÁFñ÷R7vBf∆∆&6∞¢&W6ˆ«fRá&ˆ6W72Ê7vBÇí¬&76WG2"¬'GWF˜"÷ˆÊ&ˆ&FñÊr"¬76WDfñ∆TÊ÷Rí¿¢ÚÚ'VÁFñ÷R7vBf∆∆&6≤vÜV‚7F'FVBg&ˆ“6W'fW"fˆ∆FW ¢&W6ˆ«fRá&ˆ6W72Ê7vBÇí¬"‚‚"¬&76WG2"¬'GWF˜"÷ˆÊ&ˆ&FñÊr"¬76WDfñ∆TÊ÷Rí¿¢”∞†¢6ˆÁ7BFV◊∆FUFÇ“FV◊∆FUFÑ6ÊFñFFW2ÊfñÊBÇÜ6ÊFñFFRí”‚WÜó7G57ñÊ2Ü6ÊFñFFRíì∞†¢ñbÇFV◊∆FUFÇí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$ˆÊ&ˆ&FñÊrFV◊∆FRÊ˜Bf˜VÊB"¬∞¢Fˆ57FW¿¢76WDfñ∆TÊ÷R¿¢F˜vÊ∆ˆDfñ∆TÊ÷R¿¢G&ñVEFá3¢FV◊∆FUFÑ6ÊFñFFW2¿¢“ì∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á∞¢÷W76vS¢%FV◊∆FRfñ∆RÊ˜Bf˜VÊBˆ‚í6W'fW"f˜"FÜó27FW"¿¢76WDfñ∆TÊ÷R¿¢F˜vÊ∆ˆDfñ∆TÊ÷R¿¢“ì∞¢–†¢&W2ÊF˜vÊ∆ˆBáFV◊∆FUFÇ¬F˜vÊ∆ˆDfñ∆TÊ÷Rì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"F˜vÊ∆ˆFñÊrˆÊ&ˆ&FñÊrFV◊∆FS¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚF˜vÊ∆ˆBFˆ7V÷VÁBFV◊∆FR"“ì∞¢–¢–¢ì∞†¢ÚÚGWF˜"÷&∑2ˆÊ&ˆ&FñÊr6ˆ◊∆WFRÜgFW"76ñvÊ÷VÁBí“∆∆˜w2∆VfñÊrvFWvíW&÷ÊVÁF«ê¢Á˜7BÄ¢"ˆí˜GWF˜"ˆ6ˆ◊∆WFR÷ˆÊ&ˆ&FñÊr"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'GWF˜"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B≤∆ñ6Fñˆ‰ñB““&WÊ&ˆGì∞†¢ñbÇ∆ñ6Fñˆ‰ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$÷ó76ñÊr∆ñ6Fñˆ‰ñB"“ì∞¢–†¢ÚÚfW&ñgí˜vÊW'6Üó ¢6ˆÁ7B∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ4'ïW6W"áW6W$ñBì∞¢6ˆÁ7B“∆ñ6FñˆÁ2ÊfñÊBÜ”‚ÊñB””“∆ñ6Fñˆ‰ñBì∞¢ñbÇí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"“ì∞¢–†¢6ˆÁ7BWFFVB“vóB7F˜&vRÊ6ˆ◊∆WFUGWF˜$ˆÊ&ˆ&FñÊrÜ∆ñ6Fñˆ‰ñBì∞¢ñbÇWFFVBí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6ˆ◊∆WFRˆÊ&ˆ&FñÊr"“ì∞¢–†¢&W2Êß6ˆ‚á≤7V66W73¢G'VR¬∆ñ6Fñˆ„¢WFFVB“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"ÇtW'&˜"6ˆ◊∆WFñÊrˆÊ&ˆ&FñÊs¢r¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢tfñ∆VBFÚ6ˆ◊∆WFRˆÊ&ˆ&FñÊrr“ì∞¢–¢–¢ì∞†¢ÚÚ4ÙÛ¢fW&ñgíGWF˜"ˆÊ&ˆ&FñÊrFˆ7V÷VÁ@¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜GWF˜"Û¶ñBˆFˆ7V÷VÁBÛ¶Fˆ57FWˆ6ˆ◊∆WFVB◊W∆ˆB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7BFˆ57FW“ÁV÷&W"á&WÁ&◊2ÊFˆ57FWì∞¢6ˆÁ7B&WfñWvW$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B≤fñ∆TÊ÷R¬fñ∆TFF¬fñ∆UGóR““&WÊ&ˆGì∞†¢ñbÇÁV÷&W"Êó4ñÁFVvW"ÜFˆ57FWí«¬Fˆ57FW¬«¬Fˆ57FW‚Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$6ˆ◊∆WFVBFV◊∆FRW∆ˆBó2ˆÊ«íf∆ñBf˜"∆Vv7í7FW2FÚR‚"“ì∞¢–†¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%&W7ˆÁ6RñÁFVw&óGíñÁFW&Ê¬6˜íW∆ˆG2&RÊÚ∆ˆÊvW"W6VB‚w&VV÷VÁB7FW2Ê˜rW6Rñ‚÷66WFÊ6R‚"“ì∞¢ñbÇfñ∆TÊ÷R«¬fñ∆TFFí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$÷ó76ñÊr&WVó&VBfñ∆Rñ∆ˆBf˜"6ˆ◊∆WFVBFV◊∆FRW∆ˆB‚"“ì∞¢–†¢6ˆÁ7B∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ2Çì∞¢6ˆÁ7B“∆ñ6FñˆÁ2ÊfñÊBÇÜí”‚ÊñB””“ñBì∞¢ñbÇí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B'VffW"“'VffW"Êg&ˆ“Üfñ∆TFF¬&&6ScB"ì∞¢6ˆÁ7B6fTfñ∆TÊ÷R“6ˆÚ÷6ˆ◊∆WFVBÚG∂ñG“ˆFˆ5ÚG∂Fˆ57FW’ˆ6ˆ◊∆WFVEÚG¥FFRÊÊ˜rÇó’ÚGµ7G&ñÊrÜfñ∆TÊ÷RíÁ&W∆6RÇıµÊ◊§’£”íÂÚ’“ˆr¬%Ú"ó÷∞†¢vóBVÁ7W&U&ófFT'V6∂WBá7W&6R¬'GWF˜"÷Fˆ7V÷VÁG2"ì∞¢6ˆÁ7B≤W'&˜#¢W∆ˆDW'&˜"““vóB7W&6RÁ7F˜&vP¢Êg&ˆ“Ç'GWF˜"÷Fˆ7V÷VÁG2"ê¢ÁW∆ˆBá6fTfñ∆TÊ÷R¬'VffW"¬∞¢6ˆÁFVÁEGóS¢fñ∆UGóR«¬VÊFVfñÊVB¿¢W6W'C¢f«6R¿¢“ì∞†¢ñbáW∆ˆDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%7W&6R7F˜&vRW∆ˆBW'&˜"Ü6ˆ◊∆WFVBFV◊∆FRì¢"¬W∆ˆDW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢%7F˜&vRW∆ˆBfñ∆VB"¬W'&˜#¢W∆ˆDW'&˜"Ê÷W76vR“ì∞¢–†¢6ˆÁ7BW&ƒFF“≤V&∆ñ5W&√¢6ˆÊfñFVÁFñ≈&VfW&VÊ6RÇ'GWF˜"÷Fˆ7V÷VÁG2"¬6fTfñ∆TÊ÷Rí”∞¢ñbÇW&ƒFFÚÁV&∆ñ5W&¬í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢%W∆ˆB7V66VVFVB'WB6ˆ◊∆WFVBFV◊∆FRU$¬6˜V∆BÊ˜B&RvVÊW&FVB"“ì∞¢–†¢6ˆÁ7BWFFVB“vóB7F˜&vRÁW∆ˆD6ˆ◊∆WFVEGWF˜%6WVVÁFñƒFˆ7V÷VÁBÄ¢ñB¿¢Fˆ57FW¿¢W&ƒFFÁV&∆ñ5W&¬¿¢&WfñWvW$ñ@¢ì∞†¢ñbÇWFFVBí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6fR6ˆ◊∆WFVBFV◊∆FRU$¬"“ì∞¢–†¢&W2Êß6ˆ‚á∞¢7V66W73¢G'VR¿¢∆ñ6Fñˆ„¢WFFVB¿¢6ˆ◊∆WFVDFˆ7V÷VÁEW&√¢W&ƒFFÁV&∆ñ5W&¬¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"W∆ˆFñÊr4ÙÚ6ˆ◊∆WFVBFV◊∆FS¢"¬W'&˜"ì∞¢ñbÄ¢W'&˜"ñÁ7FÊ6VˆbW'&˜"b`¢Úá&WVó&VG«VÊFñÊr&WfñWw∆&∆ˆ6∂VG∆«&VGí&˜fVG«7FW˜&FW"íˆíÁFW7BÜW'&˜"Ê÷W76vRê¢í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"Ê÷W76vR“ì∞¢–¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚW∆ˆB6ˆ◊∆WFVBFV◊∆FR"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜GWF˜"Û¶ñBˆFˆ7V÷VÁBÛ¶Fˆ57FW˜&WfñWr"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7BFˆ57FW“ÁV÷&W"á&WÁ&◊2ÊFˆ57FWì∞¢6ˆÁ7B≤&˜fVB¬&V¶V7FñˆÂ&V6ˆ‚¬6ˆ◊∆WFVDFˆ7V÷VÁEW&¬““&WÊ&ˆGì∞¢6ˆÁ7B&WfñWvW$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞†¢ñbÜFˆ57FW”“"bbFˆ57FW”“bí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ˆÊ«í7FW"÷G&ñ26W'Fñfñ6FRW∆ˆG2ÊB7FWb6W'FñfñVBîBW∆ˆG2&WVó&R4ÙÚ&WfñWr‚"“ì∞¢–†¢ñbáGóVˆb&˜fVB”“&&ˆˆ∆V‚"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$÷ó76ñÊr&˜f¬FV6ó6ñˆ‚"“ì∞¢–†¢6ˆÁ7BWFFVB“vóB7F˜&vRÁ&WfñWuGWF˜%6WVVÁFñƒFˆ7V÷VÁBÄ¢ñB¿¢Fˆ57FW¿¢&˜fVB¿¢&WfñWvW$ñB¿¢6ˆ◊∆WFVDFˆ7V÷VÁEW&¬¿¢&V¶V7FñˆÂ&V6ˆ‡¢ì∞†¢ñbÇWFFVBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢vóB6fU6VÊEW6ÇÄ¢WFFVBÁW6W$ñB¿¢∞¢FóF∆S¢&˜fVBÚ$Fˆ7V÷VÁB&˜fVB"¢$Fˆ7V÷VÁB&V¶V7FVB"¿¢&ˆGì¢&˜fV@¢Úñ˜W"ˆÊ&ˆ&FñÊrFˆ7V÷VÁBG∂Fˆ57FW“v2&˜fVBÊ ¢¢ñ˜W"ˆÊ&ˆ&FñÊrFˆ7V÷VÁBG∂Fˆ57FW“v2&V¶V7FVBÊBÊVVG2&W7V&÷ó76ñˆ‚Ê¿¢W&√¢"ˆ˜W&FñˆÊ¬˜GWF˜"ˆvFWví"¿¢Fs¢GWF˜"÷Fˆ7V÷VÁB◊&WfñWr“G∑WFFVBÊñG““G∂Fˆ57FW““G∂&˜fVBÚ&&˜fVB"¢'&V¶V7FVB'÷¿¢“¿¢'GWF˜"Fˆ7V÷VÁB&WfñWr&W7V«B"¿¢ì∞†¢&W2Êß6ˆ‚á∞¢7V66W73¢G'VR¿¢∆ñ6Fñˆ„¢WFFVB¿¢÷W76vS¢&˜fV@¢ÚFˆ57FW””“bbbˆ&¶V7BÁf«VW2áWFFVBÊFˆ7V÷VÁG57FGW2«¬∑“íÊWfW'íÇá7FGW2í”‚7FGW2””“&&˜fVB"ê¢Ú$Fˆ7V÷VÁB&˜fVB‚GWF˜"ˆÊ&ˆ&FñÊró26ˆ◊∆WFR‚ ¢¢Fˆ57FW””“ ¢Ú$÷G&ñ26W'Fñfñ6FR&˜fVB‚GWF˜"6‚÷˜fRFÚFÜRÊWáBw&VV÷VÁB‚ ¢¢Fˆ7V÷VÁBG∂Fˆ57FW“&˜fVB‚GWF˜"6‚÷˜fRFÚFÜRÊWáBFˆ7V÷VÁBÊ ¢¢Fˆ7V÷VÁBG∂Fˆ57FW“&V¶V7FVB‚GWF˜"◊W7B&W7V&÷óBFÜó27FWÊ¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&WfñWvñÊr6WVVÁFñ¬GWF˜"Fˆ7V÷VÁC¢"¬W'&˜"ì∞¢ñbÄ¢W'&˜"ñÁ7FÊ6VˆbW'&˜"b`¢Úá&WVó&VG«VÊFñÊr&WfñWw∆&∆ˆ6∂VG∆«&VGí&˜fVG«7FW˜&FW"íˆíÁFW7BÜW'&˜"Ê÷W76vRê¢í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"Ê÷W76vR“ì∞¢–¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&WfñWrFˆ7V÷VÁB"“ì∞¢–¢–¢ì∞†¢ÚÚvWBGWF˜"w2˜v‚∆ñ6FñˆÁ0¢ÊvWBÄ¢"ˆí˜GWF˜"ˆ∆ñ6FñˆÁ2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'GWF˜"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ4'ïW6W"áW6W$ñBì∞¢&W2Êß6ˆ‚Ü∆ñ6FñˆÁ2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrGWF˜"∆ñ6FñˆÁ3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç∆ñ6FñˆÁ2"“ì∞¢–¢–¢ì∞†¢ÚÚvWB∆¬GWF˜"∆ñ6FñˆÁ2Ñ4ÙÚÊBÖ"ê¢ÊvWBÄ¢"ˆíˆ6ˆÚ˜G&ffñ2◊7V÷÷'í"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ"¬&á"%“í¿¢7ñÊ2Ö˜&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&W7V«B“vóBˆˆ¬ÁVW'ì«∞¢VÊFñÊuˆ∆ñ6FñˆÁ3¢7G&ñÊs∞¢ÊVVG5˜&WfñWs¢7G&ñÊs∞¢vóFñÊuˆˆÂ˜GWF˜#¢7G&ñÊs∞¢”‚Ü ¢4TƒT5@¢6˜VÁBÇ¢ídî≈DU"ÖtÑU$R7FGW2“wVÊFñÊrrì£ßFWáB2VÊFñÊuˆ∆ñ6FñˆÁ2¿¢6˜VÁBÇ¢ídî≈DU"Ä¢tÑU$R7FGW2“v&˜fVBp¢‰BÜFˆ7V÷VÁG5˜7FGW2”„‚s"r“wVÊFñÊu˜&WfñWrrı"Fˆ7V÷VÁG5˜7FGW2”„‚sbr“wVÊFñÊu˜&WfñWrrê¢ì£ßFWáB2ÊVVG5˜&WfñWr¿¢6˜VÁBÇ¢ídî≈DU"Ä¢tÑU$R7FGW2“v&˜fVBp¢‰BFˆ7V÷VÁG5˜7FGW2”„‚sr√‚v&˜fVBp¢‰BFˆ7V÷VÁG5˜7FGW2”„‚s"r√‚v&˜fVBp¢‰BFˆ7V÷VÁG5˜7FGW2”„‚s2r√‚v&˜fVBp¢‰BFˆ7V÷VÁG5˜7FGW2”„‚sBr√‚v&˜fVBp¢‰BFˆ7V÷VÁG5˜7FGW2”„‚sRr√‚v&˜fVBp¢‰BFˆ7V÷VÁG5˜7FGW2”„‚sbr√‚v&˜fVBp¢‰BFˆ7V÷VÁG5˜7FGW2”„‚s"r√‚wVÊFñÊu˜&WfñWrp¢‰BFˆ7V÷VÁG5˜7FGW2”„‚sbr√‚wVÊFñÊu˜&WfñWrp¢ì£ßFWáB2vóFñÊuˆˆÂ˜GWF˜ ¢e$Ù“GWF˜%ˆ∆ñ6FñˆÁ0¢ì∞¢6ˆÁ7B&˜r“&W7V«BÁ&˜w5≥“«¬≤VÊFñÊuˆ∆ñ6FñˆÁ3¢#"¬ÊVVG5˜&WfñWs¢#"¬vóFñÊuˆˆÂ˜GWF˜#¢#"”∞¢6ˆÁ7BVÊFñÊt∆ñ6FñˆÁ2“ÁV÷&W"á&˜rÁVÊFñÊuˆ∆ñ6FñˆÁ2«¬ì∞¢6ˆÁ7BÊVVG5&WfñWr“ÁV÷&W"á&˜rÊÊVVG5˜&WfñWr«¬ì∞¢6ˆÁ7BvóFñÊtˆÂGWF˜"“ÁV÷&W"á&˜rÁvóFñÊuˆˆÂ˜GWF˜"«¬ì∞¢&W2Êß6ˆ‚á≤VÊFñÊt∆ñ6FñˆÁ2¬ÊVVG5&WfñWr¬vóFñÊtˆÂGWF˜"¬F˜Fƒ7Fñˆ‰6˜VÁC¢VÊFñÊt∆ñ6FñˆÁ2≤ÊVVG5&WfñWr≤vóFñÊtˆÂGWF˜"“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr4ÙÚG&ffñ27V÷÷'ì¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇG&ffñ27V÷÷'í"“ì∞¢–¢“¿¢ì∞†¢ÊvWBÄ¢"ˆíˆ6ˆÚ˜GWF˜"÷∆ñ6FñˆÁ2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ"¬&á"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤7FGW2““&WÁVW'ì∞¢∆WB∆ñ6FñˆÁ3∞¢ ¢ñbá7FGW2bbá7FGW2””“'VÊFñÊr"«¬7FGW2””“&&˜fVB"«¬7FGW2””“'&V¶V7FVB"íí∞¢∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ4'ï7FGW2á7FGW2ì∞¢“V«6R∞¢∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ2Çì∞¢–¢ ¢&W2Êß6ˆ‚Ü∆ñ6FñˆÁ2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrGWF˜"∆ñ6FñˆÁ3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç∆ñ6FñˆÁ2"“ì∞¢–¢–¢ì∞†¢ÚÚ&˜fRGWF˜"∆ñ6Fñˆ‚Ñ4ÙÚê¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜GWF˜"÷∆ñ6FñˆÁ2Û¶ñBˆ&˜fR"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B&WfñWvW$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B∆ñ6Fñˆ‚“vóB7F˜&vRÊ&˜fUGWF˜$∆ñ6Fñˆ‚ÜñB¬&WfñWvW$ñBì∞¢ ¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–¢ñbÇó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢vóBVÁ7W&U7V6ñ∆ó7DFWfV∆˜÷VÁEFávíá∞¢GWF˜$ñC¢∆ñ6Fñˆ‚ÁW6W$ñB¿¢∆ñ6Fñˆ‰ñC¢∆ñ6Fñˆ‚ÊñB¿¢7F'FVDC¢∆ñ6Fñˆ‚Á&WfñWvVDB«¬ÊWrFFRÇí¿¢“ì∞¢–¢vóB6fU6VÊEW6ÇÄ¢∆ñ6Fñˆ‚ÁW6W$ñB¿¢∞¢FóF∆S¢%7V6ñ∆ó7B∆ñ6Fñˆ‚&˜fVB"¿¢&ˆGì¢%ñ˜W"sR÷Fí7V6ñ∆ó7BFWfV∆˜÷VÁBFávíÜ27F'FVB‚˜V‚&W7ˆÁ6RñÁFVw&óGíFÚ6ˆÁFñÁVRˆÊ&ˆ&FñÊr‚"¿¢W&√¢"ˆ˜W&FñˆÊ¬˜GWF˜"ˆvFWví"¿¢Fs¢GWF˜"÷∆ñ6Fñˆ‚÷&˜fVB“G∂∆ñ6Fñˆ‚ÊñG÷¿¢“¿¢%7V6ñ∆ó7B∆ñ6Fñˆ‚&˜fVB"¿¢ì∞¢ ¢&W2Êß6ˆ‚Ü∆ñ6Fñˆ‚ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&˜fñÊrGWF˜"∆ñ6Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&˜fR∆ñ6Fñˆ‚"“ì∞¢–¢–¢ì∞†¢ÚÚ&V¶V7BGWF˜"∆ñ6Fñˆ‚Ñ4ÙÚê¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜GWF˜"÷∆ñ6FñˆÁ2Û¶ñB˜&V¶V7B"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B≤&V6ˆ‚““&WÊ&ˆGì∞¢6ˆÁ7B&WfñWvW$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B∆ñ6Fñˆ‚“vóB7F˜&vRÁ&V¶V7EGWF˜$∆ñ6Fñˆ‚ÜñB¬&WfñWvW$ñB¬&V6ˆ‚«¬""ì∞¢ ¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–¢6ˆÁ7BG&ñ÷÷VE&V6ˆ‚“GóVˆb&V6ˆ‚””“'7G&ñÊr"Ú&V6ˆ‚ÁG&ñ“Çí¢"#∞¢6ˆÁ7B÷W76vR“G&ñ÷÷VE&V6ˆ‡¢Úñ˜W"∆ñ6Fñˆ‚v2Ê˜B66WFVB‚&V6ˆ„¢G∑G&ñ÷÷VE&V6ˆÁ÷ ¢¢%ñ˜W"∆ñ6Fñˆ‚v2&WfñWvVBÊBv2Ê˜B66WFVB‚#∞†¢vóB6fU6VÊEW6ÇÄ¢∆ñ6Fñˆ‚ÁW6W$ñB¿¢∞¢FóF∆S¢%GWF˜"∆ñ6Fñˆ‚WFFR"¿¢&ˆGì¢÷W76vR¿¢W&√¢"ˆ˜W&FñˆÊ¬˜GWF˜"ˆvFWví"¿¢Fs¢GWF˜"÷∆ñ6Fñˆ‚◊&V¶V7FVB“G∂∆ñ6Fñˆ‚ÊñG÷¿¢“¿¢'GWF˜"∆ñ6Fñˆ‚&V¶V7FVB"¿¢ì∞¢ ¢&W2Êß6ˆ‚Ü∆ñ6Fñˆ‚ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&V¶V7FñÊrGWF˜"∆ñ6Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&V¶V7B∆ñ6Fñˆ‚"“ì∞¢–¢–¢ì∞†¢ÚÚ”””””””””””””””””””””””””””””””””””””””–¢ÚÚTuÚddîƒîDRtDUtí$ıUDU0¢ÚÚ”””””””””””””””””””””””””””””””””””””””–†¢Á˜7BÄ¢"ˆí˜FBˆ∆ñ6Fñˆ‚"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'FB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7Bñ∆ˆB“&WÊ&ˆGíÛÚ∑”∞¢6ˆÁ7B&WVó&VDfñV∆G2“∞¢&gV∆ƒÊ÷R"¿¢&vR"¿¢&6óGí"¿¢'ÜˆÊR"¿¢&ñEGóR"¿¢&ñDÁV÷&W""¿¢&FFTˆd&ó'FÇ"¿¢'FVváD˜$÷VÁF˜&VD&Vf˜&R"¿¢&∆VD˜%7WW'fó6VD˜FÜW'2"¿¢&Ü˜W'4fñ∆&∆UW%vVV≤"¿¢'7ó7FV’VÊFW'7FÊFñÊtFñffW&VÊ6R"¿¢'7GVFVÁDg&VW¶W4'&V≤"¿¢&Wá∆ñÊñÊt&WGFW$Ê˜DVÊ˜VvÇ"¿¢'7WW'fó6ñÊuGWF˜$7Fñˆ‚"¿¢&g'W7G&FñˆÂ&W7ˆÁ6R"¿¢&FßW7E7ó7FV‘Á7vW""¿¢&ÜñvÖFÙ÷VFóV‘6W6W2"¿¢&ÜñvÖ66˜&W4ÊÙñ◊&˜fV÷VÁB"¿¢'6Ü&VEGWF˜$÷ó7F∂T÷VÊñÊr"¿¢&6˜'&V7Dˆ∆FW%GWF˜""¿¢'W6Ü&6µ&W7ˆÁ6R"¿¢'VÁ˜V∆$VÊf˜&6V÷VÁD66R"¿¢&Êı&W67VTWá∆ÊFñˆ‚"¿¢&÷˜&TFÊvW&˜W5GWF˜""¿¢'7ó7FV‘FW7G'V7Fñˆ‰f7F˜'2"¿¢&6ˆ÷÷óF÷VÁEFı7FÊF&B"¿¢'G'W7E&V6ˆ‚"¿¢”∞†¢6ˆÁ7B÷ó76ñÊtfñV∆B“&WVó&VDfñV∆G2ÊfñÊBÇÜfñV∆Bí”‚∞¢6ˆÁ7Bf«VR“áñ∆ˆB2Áíï∂fñV∆E”∞¢ñbáGóVˆbf«VR””“&ÁV÷&W""í&WGW&‚ÁV÷&W"Êó4Ê‚áf«VRì∞¢&WGW&‚7G&ñÊráf«VRÛÚ""íÁG&ñ“Çì∞¢“ì∞¢ñbÜ÷ó76ñÊtfñV∆Bí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$∆¬FW'&óF˜'íFó&V7F˜"∆ñ6Fñˆ‚fñV∆G2&R&WVó&VB‚"“ì∞¢–†¢6ˆÁ7BFVváD˜$÷VÁF˜&VD&Vf˜&R“7G&ñÊráñ∆ˆBÁFVváD˜$÷VÁF˜&VD&Vf˜&R«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7B∆VD˜%7WW'fó6VD˜FÜW'2“7G&ñÊráñ∆ˆBÊ∆VD˜%7WW'fó6VD˜FÜW'2«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7BÜ˜W'4fñ∆&∆UW%vVV≤“ÁV÷&W"áñ∆ˆBÊÜ˜W'4fñ∆&∆UW%vVV≤ì∞¢6ˆÁ7B6ˆ÷÷óF÷VÁEFı7FÊF&B“7G&ñÊráñ∆ˆBÊ6ˆ÷÷óF÷VÁEFı7FÊF&B«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7BñEGóR“7G&ñÊráñ∆ˆBÊñEGóR«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7BñDÁV÷&W"“7G&ñÊráñ∆ˆBÊñDÁV÷&W"«¬""íÁG&ñ“Çì∞¢6ˆÁ7BFFTˆd&ó'FÇ“7G&ñÊráñ∆ˆBÊFFTˆd&ó'FÇ«¬""íÁG&ñ“Çì∞¢6ˆÁ7B66˜VÁDV÷ñ¬“7G&ñÊrÇá&W2ÁííÊF%W6W#ÚÊV÷ñ¬«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞†¢ñbáFVváD˜$÷VÁF˜&VD&Vf˜&R”“'ñW2"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%FW'&óF˜'íFó&V7F˜"∆ñ6ÁG2◊W7BÜfRFVváB˜"÷VÁF˜&VB&Vf˜&R‚"“ì∞¢–¢ñbÜ∆VD˜%7WW'fó6VD˜FÜW'2”“'ñW2"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%FW'&óF˜'íFó&V7F˜"∆ñ6ÁG2◊W7BÜfR∆VB˜"7WW'fó6VB˜FÜW'2&Vf˜&R‚"“ì∞¢–¢ñbÇÁV÷&W"Êó4fñÊóFRÜÜ˜W'4fñ∆&∆UW%vVV≤í«¬Ü˜W'4fñ∆&∆UW%vVV≤¬bí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%FW'&óF˜'íFó&V7F˜"∆ñ6ÁG2◊W7BÜfRB∆V7BbÜ˜W'2fñ∆&∆RW"vVV≤‚"“ì∞¢–¢ñbÜ6ˆ÷÷óF÷VÁEFı7FÊF&B”“'ñW2"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%FÜó2&ˆ∆R&WVó&W2Wá∆ñ6óB6ˆ÷÷óF÷VÁBFÚFó&V7BVÊf˜&6V÷VÁBÊB7FÊF&B&˜FV7Fñˆ‚‚"“ì∞¢–¢ñbÜñEGóR”“'6ˆñB"bbñEGóR”“'77˜'B"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%DB∆ñ6ÁG2◊W7B6Üˆ˜6R6˜WFÇg&ñ6‚îB˜"77˜'B‚"“ì∞¢–¢ñbÜñDÁV÷&W"Ê∆VÊwFÇ¬bí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$f∆ñBñFVÁFñfñ6Fñˆ‚ÁV÷&W"ó2&WVó&VB‚"“ì∞¢–¢ñbÇFFTˆd&ó'FÇí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$FFRˆb&ó'FÇó2&WVó&VB‚"“ì∞¢–¢ñbÑÁV÷&W"Êó4Ê‚ÜÊWrFFRÜFFTˆd&ó'FÇíÊvWEFñ÷RÇííí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$f∆ñBFFRˆb&ó'FÇó2&WVó&VB‚"“ì∞¢–¢ñbÇ66˜VÁDV÷ñ¬í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$6ñvÊVB÷ñ‚66˜VÁBV÷ñ¬ó2&WVó&VBf˜"DB∆ñ6Fñˆ‚7V&÷ó76ñˆ‚‚"“ì∞¢–†¢6ˆÁ7BWÜó7FñÊt∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B&WW6&∆T∆ñ6Fñˆ‚“WÜó7FñÊt∆ñ6FñˆÁ2ÊfñÊBÇÜ∆ñ6Fñˆ„¢Áíí”‡¢≤'VÊFñÊr"¬'&V¶V7FVB%“ÊñÊ6«VFW2Ö7G&ñÊrÜ∆ñ6Fñˆ‚Á7FGW2«¬""íÁFÙ∆˜vW$66RÇíê¢ì∞†¢6ˆÁ7B&V6˜&B“∞¢W6W%ˆñC¢W6W$ñB¿¢gV∆≈ˆÊ÷S¢7G&ñÊráñ∆ˆBÊgV∆ƒÊ÷RíÁG&ñ“Çí¿¢vS¢ÁV÷&W"áñ∆ˆBÊvRí¿¢6óGì¢7G&ñÊráñ∆ˆBÊ6óGííÁG&ñ“Çí¿¢V÷ñ√¢66˜VÁDV÷ñ¬¿¢ÜˆÊS¢7G&ñÊráñ∆ˆBÁÜˆÊRíÁG&ñ“Çí¿¢ñE˜GóS¢ñEGóR¿¢ñEˆÁV÷&W#¢ñDÁV÷&W"¿¢FFUˆˆeˆ&ó'FÉ¢FFTˆd&ó'FÇ¿¢FVváEˆ˜%ˆ÷VÁF˜&VEˆ&Vf˜&S¢FVváD˜$÷VÁF˜&VD&Vf˜&R¿¢∆VEˆ˜%˜7WW'fó6VEˆ˜FÜW'3¢∆VD˜%7WW'fó6VD˜FÜW'2¿¢Ü˜W'5ˆfñ∆&∆U˜W%˜vVV≥¢Ü˜W'4fñ∆&∆UW%vVV≤¿¢∆ñ6FñˆÂ˜&W7ˆÁ6W3¢∞¢7ó7FV’VÊFW'7FÊFñÊtFñffW&VÊ6S¢7G&ñÊráñ∆ˆBÁ7ó7FV’VÊFW'7FÊFñÊtFñffW&VÊ6RíÁG&ñ“Çí¿¢7GVFVÁDg&VW¶W4'&V≥¢7G&ñÊráñ∆ˆBÁ7GVFVÁDg&VW¶W4'&V≤íÁG&ñ“Çí¿¢Wá∆ñÊñÊt&WGFW$Ê˜DVÊ˜VvÉ¢7G&ñÊráñ∆ˆBÊWá∆ñÊñÊt&WGFW$Ê˜DVÊ˜VvÇíÁG&ñ“Çí¿¢7WW'fó6ñÊuGWF˜$7Fñˆ„¢7G&ñÊráñ∆ˆBÁ7WW'fó6ñÊuGWF˜$7Fñˆ‚íÁG&ñ“Çí¿¢g'W7G&FñˆÂ&W7ˆÁ6S¢7G&ñÊráñ∆ˆBÊg'W7G&FñˆÂ&W7ˆÁ6RíÁG&ñ“Çí¿¢FßW7E7ó7FV‘Á7vW#¢7G&ñÊráñ∆ˆBÊFßW7E7ó7FV‘Á7vW"íÁG&ñ“Çí¿¢ÜñvÖFÙ÷VFóV‘6W6W3¢7G&ñÊráñ∆ˆBÊÜñvÖFÙ÷VFóV‘6W6W2íÁG&ñ“Çí¿¢ÜñvÖ66˜&W4ÊÙñ◊&˜fV÷VÁC¢7G&ñÊráñ∆ˆBÊÜñvÖ66˜&W4ÊÙñ◊&˜fV÷VÁBíÁG&ñ“Çí¿¢6Ü&VEGWF˜$÷ó7F∂T÷VÊñÊs¢7G&ñÊráñ∆ˆBÁ6Ü&VEGWF˜$÷ó7F∂T÷VÊñÊríÁG&ñ“Çí¿¢6˜'&V7Dˆ∆FW%GWF˜#¢7G&ñÊráñ∆ˆBÊ6˜'&V7Dˆ∆FW%GWF˜"íÁG&ñ“Çí¿¢W6Ü&6µ&W7ˆÁ6S¢7G&ñÊráñ∆ˆBÁW6Ü&6µ&W7ˆÁ6RíÁG&ñ“Çí¿¢VÁ˜V∆$VÊf˜&6V÷VÁD66S¢7G&ñÊráñ∆ˆBÁVÁ˜V∆$VÊf˜&6V÷VÁD66RíÁG&ñ“Çí¿¢Êı&W67VTWá∆ÊFñˆ„¢7G&ñÊráñ∆ˆBÊÊı&W67VTWá∆ÊFñˆ‚íÁG&ñ“Çí¿¢÷˜&TFÊvW&˜W5GWF˜#¢7G&ñÊráñ∆ˆBÊ÷˜&TFÊvW&˜W5GWF˜"íÁG&ñ“Çí¿¢7ó7FV‘FW7G'V7Fñˆ‰f7F˜'3¢7G&ñÊráñ∆ˆBÁ7ó7FV‘FW7G'V7Fñˆ‰f7F˜'2íÁG&ñ“Çí¿¢6ˆ÷÷óF÷VÁEFı7FÊF&B¿¢G'W7E&V6ˆ„¢7G&ñÊráñ∆ˆBÁG'W7E&V6ˆ‚íÁG&ñ“Çí¿¢“¿¢”∞†¢∆WBFF¢Áí“ÁV∆√∞¢∆WBW'&˜#¢Áí“ÁV∆√∞†¢ñbá&WW6&∆T∆ñ6Fñˆ‚í∞¢6ˆÁ7B&W7V«B“vóB7W&6P¢Êg&ˆ“Ç'FEˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢‚‚Á&V6˜&B¿¢7FGW3¢'VÊFñÊr"¿¢&WfñWvVEˆ'ì¢ÁV∆¬¿¢&WfñWvVEˆC¢ÁV∆¬¿¢&V¶V7FñˆÂ˜&V6ˆ„¢ÁV∆¬¿¢ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆC¢ÁV∆¬¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜W&√¢ÁV∆¬¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜W∆ˆFVEˆC¢ÁV∆¬¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜&WfñWvVEˆC¢ÁV∆¬¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜&WfñWvVEˆ'ì¢ÁV∆¬¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜&V¶V7FñˆÂ˜&V6ˆ„¢ÁV∆¬¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW¢¿¢Fˆ7V÷VÁG5˜7FGW3¢≤‚‚‰î‰ïDî≈ıDEÙDÙ5T‘TÂEı5DEU4U2¬##¢&Ê˜E˜7F'FVB"“¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬&WW6&∆T∆ñ6Fñˆ‚ÊñBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢FF“&W7V«BÊFF∞¢W'&˜"“&W7V«BÊW'&˜#∞¢“V«6R∞¢6ˆÁ7B&W7V«B“vóB7W&6P¢Êg&ˆ“Ç'FEˆ∆ñ6FñˆÁ2"ê¢ÊñÁ6W'Bá&V6˜&Bê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢FF“&W7V«BÊFF∞¢W'&˜"“&W7V«BÊW'&˜#∞¢–†¢ñbÜW'&˜"«¬FFí∞¢Fá&˜rÊWrW'&˜"ÜW'&˜#ÚÊ÷W76vR«¬$fñ∆VBFÚ7V&÷óBDB∆ñ6Fñˆ‚"ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7V&÷óGFñÊrDB∆ñ6Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ7V&÷óBDB∆ñ6Fñˆ‚"“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆí˜FBˆ∆ñ6Fñˆ‚◊7FGW2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'FB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B6ÊˆÊñ6ƒ∆ñ6Fñˆ‚“6V∆V7D6ÊˆÊñ6≈FD∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞¢ñbÇ6ÊˆÊñ6ƒ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Êß6ˆ‚á≤7FGW3¢&Ê˜Eˆ∆ñVB"“ì∞¢–†¢&W2Êß6ˆ‚ÜFW&ófUFDvFWvî∆ñ6FñˆÂ7FGW2Ü6ÊˆÊñ6ƒ∆ñ6Fñˆ‚íì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrDB∆ñ6Fñˆ‚7FGW3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇDB∆ñ6Fñˆ‚7FGW2"“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆí˜FBˆvFWví◊6W76ñˆ‚"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'FB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B∆FW7D“6V∆V7D6ÊˆÊñ6≈FD∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞¢6ˆÁ7B76ñvÊVEˆG2“vóB7F˜&vRÊvWEˆG4'ïDBáW6W$ñBì∞†¢&W2Êß6ˆ‚á∞¢&ˆ∆S¢á&W2ÁííÊF%W6W#ÚÁ&ˆ∆R«¬'FB"¿¢∆ñ6FñˆÂ7FGW3¢∆FW7DÚFW&ófUFDvFWvî∆ñ6FñˆÂ7FGW2Ü∆FW7Dí¢ÁV∆¬¿¢76ñvÊVEˆG2¿¢Ü476ñvÊVEˆG3¢76ñvÊVEˆG2Ê∆VÊwFÇ‚¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrDBvFWví6W76ñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇDBvFWví6W76ñˆ‚"“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆí˜FBˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'FB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B∆FW7D“6V∆V7D6ÊˆÊñ6≈FD∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞†¢ñbÇ∆FW7Dí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%DB∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG2“vóB&ˆ÷ó6RÊ∆¬Ä¢DEÙÙ‰$Ù$Dî‰uÙDÙ5T‘TÂE2Ê÷Ü7ñÊ2ÜFˆ7V÷VÁBí”‚∞¢6ˆÁ7B∆ˆFVB“vóB∆ˆEFDˆÊ&ˆ&FñÊtFˆ7V÷VÁBÜFˆ7V÷VÁBÁ7FWì∞¢&WGW&‚∞¢7FW¢∆ˆFVBÁ7FW¿¢6ˆFS¢∆ˆFVBÊ6ˆFR¿¢FóF∆S¢∆ˆFVBÁFóF∆R¿¢fW'6ñˆ„¢∆ˆFVBÁfW'6ñˆ‚¿¢&WVó&W466WFÊ6S¢∆ˆFVBÁ&WVó&W466WFÊ6R¿¢&WVó&W5W∆ˆC¢∆ˆFVBÁ&WVó&W5W∆ˆB¿¢W∆ˆEFóF∆S¢∆ˆFVBÁW∆ˆEFóF∆R¿¢W∆ˆDFW67&óFñˆ„¢∆ˆFVBÁW∆ˆDFW67&óFñˆ‚¿¢÷ÊFF˜'î6∆W6W3¢∆ˆFVBÊ÷ÊFF˜'î6∆W6W2¿¢6ˆÁFVÁC¢∆ˆFVBÊ6ˆÁFVÁB¿¢6ˆÁFVÁDÜ6É¢∆ˆFVBÊ6ˆÁFVÁDÜ6Ç¿¢”∞¢“ê¢ì∞†¢&W2Êß6ˆ‚á∞¢∆ñ6Fñˆ‰ñC¢∆FW7DÊñB¿¢Fˆ7V÷VÁG2¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrDBˆÊ&ˆ&FñÊrFˆ7V÷VÁG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇDBˆÊ&ˆ&FñÊrFˆ7V÷VÁG2"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆí˜FBˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2Û¶Fˆ57FWˆ66WB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'FB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7BFˆ57FW“ÁV÷&W"á&WÁ&◊2ÊFˆ57FWì∞¢6ˆÁ7B∞¢∆ñ6Fñˆ‰ñB¿¢Fˆ7V÷VÁEfW'6ñˆ‚¿¢Fˆ7V÷VÁDÜ6Ç¿¢GóVDgV∆ƒÊ÷R¿¢66WFVEFñ÷W¶ˆÊR¿¢∆ˆ6∆R¿¢∆Ff˜&“¿¢6˜W&6Tf∆˜r¿¢f˜&‘FF¿¢66WFVD6∆W6T∂Wó2¿¢67&ˆ∆ƒ6ˆ◊∆WFñˆÂW&6VÁB¿¢fñWu7F'FVDB¿¢fñWt6ˆ◊∆WFVDB¿¢66WD6∆ñ6∂VDB¿¢““&WÊ&ˆGíÛÚ∑”∞†¢ñbÇ∆ñ6Fñˆ‰ñB«¬ÁV÷&W"Êó4ñÁFVvW"ÜFˆ57FWí«¬Fˆ57FW¬«¬Fˆ57FW‚rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ñÁf∆ñBDBˆÊ&ˆ&FñÊr66WFÊ6R&WVW7B"“ì∞¢–¢ñbÇ7G&ñÊráGóVDgV∆ƒÊ÷R«¬""íÁG&ñ“Çíí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%GóVBgV∆¬Ê÷Ró2&WVó&VB"“ì∞¢–†¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B∆ñ6Fñˆ‚–¢∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí«¬6V∆V7D6ÊˆÊñ6≈FD∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"“ì∞¢–†¢6ˆÁ7BFVfñÊóFñˆ‚“vWEFDˆÊ&ˆ&FñÊtFˆ7V÷VÁDFVfñÊóFñˆ‚ÜFˆ57FWì∞¢ñbÇFVfñÊóFñˆ‚Á&WVó&W466WFÊ6Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%FÜó2DBˆÊ&ˆ&FñÊr7FW&WVó&W2fñ∆RW∆ˆB¬Ê˜Bw&VV÷VÁB66WFÊ6R‚"“ì∞¢–¢6ˆÁ7B∆ˆFVB“vóB∆ˆEFDˆÊ&ˆ&FñÊtFˆ7V÷VÁBÜFˆ57FWì∞¢ñbÜFˆ7V÷VÁEfW'6ñˆ‚bbFˆ7V÷VÁEfW'6ñˆ‚”“∆ˆFVBÁfW'6ñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢$Fˆ7V÷VÁBfW'6ñˆ‚÷ó6÷F6Ç"“ì∞¢–¢ñbÜFˆ7V÷VÁDÜ6ÇbbFˆ7V÷VÁDÜ6Ç”“∆ˆFVBÊ6ˆÁFVÁDÜ6Çí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢$Fˆ7V÷VÁB6ˆÁFVÁBÜ6Ç÷ó6÷F6Ç"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG57FGW2“'Vñ∆EFDˆÊ&ˆ&FñÊu7FGW6W2Ü∆ñ6Fñˆ‚ÊFˆ7V÷VÁG57FGW2«¬∆ñ6Fñˆ‚ÊFˆ7V÷VÁG5˜7FGW2ì∞¢6ˆÁ7B7W'&VÁE7FW“vWD7W'&VÁEFE7FWg&ˆ’7FGW6W2ÜFˆ7V÷VÁG57FGW2ì∞¢ñbÜFˆ57FW”“7W'&VÁE7FWí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢6WVVÁFñ¬7FW˜&FW"fñˆ∆Fñˆ„¢7W'&VÁB66WFÊ6R7FWó2G∂7W'&VÁE7FW“Ê“ì∞¢–†¢6ˆÁ7B66WFVD6∆W6T∂Wï6WB“ÊWr6WBÄ¢'&íÊó4'&íÜ66WFVD6∆W6T∂Wó2íÚ66WFVD6∆W6T∂Wó2Ê÷Çáf«VS¢VÊ∂Ê˜v‚í”‚7G&ñÊráf«VRíí¢µ–¢ì∞¢6ˆÁ7B÷ó76ñÊt6∆W6R“FVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W2ÊfñÊBÇÜ6∆W6Rí”‚66WFVD6∆W6T∂Wï6WBÊÜ2Ü6∆W6RÊ∂Wííì∞¢ñbÜ÷ó76ñÊt6∆W6Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢÷ÊFF˜'í6∆W6RÊ˜B6∂Ê˜v∆VFvVC¢G∂÷ó76ñÊt6∆W6RÊ∆&V«÷“ì∞¢–†¢6ˆÁ7B≤FF¢66WFÊ6U&˜r¬W'&˜#¢66WFÊ6TW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'FEˆˆÊ&ˆ&FñÊuˆ66WFÊ6W2"ê¢ÊñÁ6W'Bá∞¢∆ñ6FñˆÂˆñC¢∆ñ6Fñˆ‰ñB¿¢W6W%ˆñC¢W6W$ñB¿¢Fˆ7V÷VÁE˜7FW¢Fˆ57FW¿¢Fˆ7V÷VÁEˆ6ˆFS¢∆ˆFVBÊ6ˆFR¿¢Fˆ7V÷VÁE˜FóF∆S¢∆ˆFVBÁFóF∆R¿¢Fˆ7V÷VÁE˜fW'6ñˆ„¢∆ˆFVBÁfW'6ñˆ‚¿¢Fˆ7V÷VÁE˜6Ê6Ü˜C¢∆ˆFVBÊ6ˆÁFVÁB¿¢Fˆ7V÷VÁEˆ6ÜV6∑7V”¢∆ˆFVBÊ6ˆÁFVÁDÜ6Ç¿¢GóVEˆgV∆≈ˆÊ÷S¢7G&ñÊráGóVDgV∆ƒÊ÷RíÁG&ñ“Çí¿¢66˜VÁEˆV÷ñ√¢∆ñ6Fñˆ‚ÊV÷ñ¬¿¢ÜˆÊUˆÁV÷&W%˜6Ê6Ü˜C¢∆ñ6Fñˆ‚ÁÜˆÊR«¬ÁV∆¬¿¢66WFVE˜Fñ÷W¶ˆÊS¢66WFVEFñ÷W¶ˆÊRÚ7G&ñÊrÜ66WFVEFñ÷W¶ˆÊRí¢ÁV∆¬¿¢66WFÊ6Uˆ÷WFÜˆC¢&6ÜV6∂&˜Ö˜GóVEˆÊ÷R"¿¢óˆFG&W73¢WáG&7E&WVW7Dóá&Wí¿¢W6W%ˆvVÁC¢&WÊÜVFW'5≤'W6W"÷vVÁB%“«¬ÁV∆¬¿¢FWfñ6U˜GóS¢ñÊfW$FWfñ6UGóRá&WÊÜVFW'5≤'W6W"÷vVÁB%“í¿¢∆Ff˜&”¢∆Ff˜&“Ú7G&ñÊrá∆Ff˜&“í¢'vV""¿¢6W76ñˆÂˆñC¢&WÁ6W76ñˆ‰îB«¬ÁV∆¬¿¢∆ˆ6∆S¢∆ˆ6∆RÚ7G&ñÊrÜ∆ˆ6∆Rí¢ÁV∆¬¿¢6˜W&6Uˆf∆˜s¢6˜W&6Tf∆˜rÚ7G&ñÊrá6˜W&6Tf∆˜rí¢FEˆˆÊ&ˆ&FñÊu˜7FWÚG∂Fˆ57FW÷¿¢f˜&’˜6Ê6Ü˜Eˆß6ˆ„†¢f˜&‘FFbbGóVˆbf˜&‘FF””“&ˆ&¶V7B ¢Úˆ&¶V7BÊg&ˆ‘VÁG&ñW2Ñˆ&¶V7BÊVÁG&ñW2Üf˜&‘FFíÊ÷ÇÖ∂∂Wí¬f«VU“í”‚µ7G&ñÊrÜ∂Wíí¬7G&ñÊráf«VRÛÚ""íÁG&ñ“Çï“íê¢¢ÁV∆¬¿¢66WFVEˆ6∆W6W5ˆß6ˆ„¢FVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W0¢Êfñ«FW"ÇÜ6∆W6Rí”‚66WFVD6∆W6T∂Wï6WBÊÜ2Ü6∆W6RÊ∂Wííê¢Ê÷ÇÜ6∆W6Rí”‚6∆W6RÊ∂Wíí¿¢67&ˆ∆≈ˆ6ˆ◊∆WFñˆÂ˜W&6VÁC†¢GóVˆb67&ˆ∆ƒ6ˆ◊∆WFñˆÂW&6VÁB””“&ÁV÷&W" ¢Ú÷FÇÊ÷ÇÉ¬÷FÇÊ÷ñ‚É¬÷FÇÁ&˜VÊBá67&ˆ∆ƒ6ˆ◊∆WFñˆÂW&6VÁBííê¢¢ÁV∆¬¿¢fñWu˜7F'FVEˆC¢fñWu7F'FVDBÚÊWrFFRáfñWu7F'FVDBí¢ÁV∆¬¿¢fñWuˆ6ˆ◊∆WFVEˆC¢fñWt6ˆ◊∆WFVDBÚÊWrFFRáfñWt6ˆ◊∆WFVDBí¢ÁV∆¬¿¢66WEˆ6∆ñ6∂VEˆC¢66WD6∆ñ6∂VDBÚÊWrFFRÜ66WD6∆ñ6∂VDBí¢ÊWrFFRÇí¿¢“ê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbÜ66WFÊ6TW'&˜"«¬66WFÊ6U&˜rí∞¢Fá&˜rÊWrW'&˜"Ü66WFÊ6TW'&˜#ÚÊ÷W76vR«¬$fñ∆VBFÚ7&VFRDBˆÊ&ˆ&FñÊr66WFÊ6R"ì∞¢–†¢ñbÜFVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W2Ê∆VÊwFÇí∞¢6ˆÁ7B≤W'&˜#¢6∆W6TW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'FEˆˆÊ&ˆ&FñÊuˆ6∆W6Uˆ6∂Ê˜v∆VFvV÷VÁG2"ê¢ÊñÁ6W'BÄ¢FVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W0¢Êfñ«FW"ÇÜ6∆W6Rí”‚66WFVD6∆W6T∂Wï6WBÊÜ2Ü6∆W6RÊ∂Wííê¢Ê÷ÇÜ6∆W6Rí”‚á∞¢66WFÊ6UˆñC¢66WFÊ6U&˜rÊñB¿¢6∆W6Uˆ∂Wì¢6∆W6RÊ∂Wí¿¢6∆W6Uˆ∆&V√¢6∆W6RÊ∆&V¬¿¢“íê¢ì∞†¢ñbÜ6∆W6TW'&˜"í∞¢Fá&˜rÊWrW'&˜"Ü6∆W6TW'&˜"Ê÷W76vRì∞¢–¢–†¢6ˆÁ7B≤W'&˜#¢WfVÁDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'FEˆˆÊ&ˆ&FñÊuˆ66WFÊ6UˆWfVÁG2"ê¢ÊñÁ6W'BÖ∞¢∞¢66WFÊ6UˆñC¢66WFÊ6U&˜rÊñB¿¢∆ñ6FñˆÂˆñC¢∆ñ6Fñˆ‰ñB¿¢W6W%ˆñC¢W6W$ñB¿¢Fˆ7V÷VÁE˜7FW¢Fˆ57FW¿¢WfVÁE˜GóS¢&66WFVB"¿¢ñ∆ˆC¢∞¢6∆W6W3¢FVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W2Êfñ«FW"ÇÜ6∆W6Rí”‚66WFVD6∆W6T∂Wï6WBÊÜ2Ü6∆W6RÊ∂WíííÊ÷ÇÜ6∆W6Rí”‚6∆W6RÊ∂Wíí¿¢66WFVDC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“¿¢“¿¢“ì∞†¢ñbÜWfVÁDW'&˜"í∞¢Fá&˜rÊWrW'&˜"ÜWfVÁDW'&˜"Ê÷W76vRì∞¢–†¢Fˆ7V÷VÁG57FGW5µ7G&ñÊrÜFˆ57FWï““&&˜fVB#∞¢ñbÜFˆ57FW¬rbbFˆ7V÷VÁG57FGW5µ7G&ñÊrÜFˆ57FW≤ï“”“&&˜fVB"í∞¢Fˆ7V÷VÁG57FGW5µ7G&ñÊrÜFˆ57FW≤ï““'VÊFñÊu˜W∆ˆB#∞¢–†¢6ˆÁ7B∆ƒ&˜fVB“≤#"¬#""¬#2"¬#B"¬#R"¬#b"¬#r%“ÊWfW'íÇá7FWí”‚7G&ñÊrÜFˆ7V÷VÁG57FGW5∑7FW“«¬""í””“&&˜fVB"ì∞¢6ˆÁ7B≤W'&˜#¢WFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'FEˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢Fˆ7V÷VÁG5˜7FGW3¢Fˆ7V÷VÁG57FGW2¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW¢Fˆ57FW¬rÚFˆ57FW≤¢r¿¢ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆC¢∆ƒ&˜fVBÚÊWrFFRÇí¢ÁV∆¬¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬∆ñ6Fñˆ‰ñBì∞†¢ñbáWFFTW'&˜"í∞¢Fá&˜rÊWrW'&˜"áWFFTW'&˜"Ê÷W76vRì∞¢–†¢6ˆÁ7BWFFVD∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7BWFFVD∆ñ6Fñˆ‚–¢WFFVD∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí«¿¢6V∆V7D6ÊˆÊñ6≈FD∆ñ6Fñˆ‚áWFFVD∆ñ6FñˆÁ2ì∞†¢&W2Êß6ˆ‚á∞¢7V66W73¢G'VR¿¢∆ñ6Fñˆ„¢WFFVD∆ñ6Fñˆ‚¿¢66WFÊ6S¢66WFÊ6U&˜r¿¢&V6VóC¢∞¢66WFVDC¢66WFÊ6U&˜rÊ66WFVEˆB¿¢Fˆ7V÷VÁD6ˆFS¢66WFÊ6U&˜rÊFˆ7V÷VÁEˆ6ˆFR¿¢Fˆ7V÷VÁEfW'6ñˆ„¢66WFÊ6U&˜rÊFˆ7V÷VÁE˜fW'6ñˆ‚¿¢Fˆ7V÷VÁD6ÜV6∑7V”¢66WFÊ6U&˜rÊFˆ7V÷VÁEˆ6ÜV6∑7V“¿¢“¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"66WFñÊrDBˆÊ&ˆ&FñÊrFˆ7V÷VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ66WBDBˆÊ&ˆ&FñÊrFˆ7V÷VÁB"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆí˜FBˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2˜W∆ˆB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'FB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B≤∆ñ6Fñˆ‰ñB¬Fˆ57FW¬fñ∆TÊ÷R¬fñ∆TFF¬fñ∆UGóR““&WÊ&ˆGíÛÚ∑”∞¢6ˆÁ7B'6VDFˆ57FW“GóVˆbFˆ57FW””“&ÁV÷&W""ÚFˆ57FW¢ÁV÷&W"ÜFˆ57FWì∞†¢ñbÇ∆ñ6Fñˆ‰ñB«¬'6VDFˆ57FW”“r«¬fñ∆TÊ÷R«¬fñ∆TFFí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ˆÊ«íDB7FWr66WG2ñFVÁFñfñ6Fñˆ‚W∆ˆG2‚"“ì∞¢–†¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B∆ñ6Fñˆ‚–¢∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí«¬6V∆V7D6ÊˆÊñ6≈FD∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞†¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG57FGW2“'Vñ∆EFDˆÊ&ˆ&FñÊu7FGW6W2Ü∆ñ6Fñˆ‚ÊFˆ7V÷VÁG57FGW2«¬∆ñ6Fñˆ‚ÊFˆ7V÷VÁG5˜7FGW2ì∞¢6ˆÁ7B7W'&VÁE7FW“vWD7W'&VÁEFE7FWg&ˆ’7FGW6W2ÜFˆ7V÷VÁG57FGW2ì∞¢ñbÜ7W'&VÁE7FW”“rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ñFVÁFñfñ6Fñˆ‚W∆ˆBó2&∆ˆ6∂VBVÁFñ¬FÜRfó'7B6óÇDBw&VV÷VÁG2&R&˜fVB‚"“ì∞¢–†¢6ˆÁ7B7FW7FGW2“7G&ñÊrÜFˆ7V÷VÁG57FGW5≤#r%“«¬&Ê˜E˜7F'FVB"ì∞¢ñbá7FW7FGW2””“'VÊFñÊu˜&WfñWr"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%ñ˜W"ñFVÁFñfñ6Fñˆ‚6˜íó2«&VGívóFÇ4ÙÚf˜"&WfñWr‚"“ì∞¢–¢ñbá7FW7FGW2””“&&˜fVB"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%ñ˜W"ñFVÁFñfñ6Fñˆ‚6˜íÜ2«&VGí&VV‚&˜fVB‚"“ì∞¢–†¢6ˆÁ7B'VffW"“'VffW"Êg&ˆ“Üfñ∆TFF¬&&6ScB"ì∞¢6ˆÁ7B6ÊóFó¶VDÊ÷R“7G&ñÊrÜfñ∆TÊ÷RíÁ&W∆6RÇıµÊ◊§’£”íÂÚ’“ˆr¬%Ú"ì∞¢6ˆÁ7B6fTfñ∆TÊ÷R“FB÷Fˆ7V÷VÁG2ÚG∑W6W$ñG“˜FB÷6W'FñfñVB÷ñB“G∂∆ñ6Fñˆ‰ñG““G¥FFRÊÊ˜rÇó““G∑6ÊóFó¶VDÊ÷W÷∞†¢vóBVÁ7W&U&ófFT'V6∂WBá7W&6R¬'GWF˜"÷Fˆ7V÷VÁG2"ì∞¢6ˆÁ7B≤W'&˜#¢W∆ˆDW'&˜"““vóB7W&6RÁ7F˜&vP¢Êg&ˆ“Ç'GWF˜"÷Fˆ7V÷VÁG2"ê¢ÁW∆ˆBá6fTfñ∆TÊ÷R¬'VffW"¬∞¢6ˆÁFVÁEGóS¢fñ∆UGóR«¬VÊFVfñÊVB¿¢W6W'C¢f«6R¿¢“ì∞†¢ñbáW∆ˆDW'&˜"í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W∆ˆDW'&˜"Ê÷W76vR“ì∞¢–†¢6ˆÁ7BW&ƒFF“≤V&∆ñ5W&√¢6ˆÊfñFVÁFñ≈&VfW&VÊ6RÇ'GWF˜"÷Fˆ7V÷VÁG2"¬6fTfñ∆TÊ÷Rí”∞¢ñbÇW&ƒFFÚÁV&∆ñ5W&¬í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢%W∆ˆB7V66VVFVB'WBfñ∆RU$¬6˜V∆BÊ˜B&RvVÊW&FVB‚"“ì∞¢–†¢Fˆ7V÷VÁG57FGW5≤#r%““'VÊFñÊu˜&WfñWr#∞†¢6ˆÁ7B≤W'&˜#¢WFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'FEˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜W&√¢W&ƒFFÁV&∆ñ5W&¬¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜W∆ˆFVEˆC¢ÊWrFFRÇí¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜&WfñWvVEˆC¢ÁV∆¬¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜&WfñWvVEˆ'ì¢ÁV∆¬¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜&V¶V7FñˆÂ˜&V6ˆ„¢ÁV∆¬¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW¢r¿¢Fˆ7V÷VÁG5˜7FGW3¢Fˆ7V÷VÁG57FGW2¿¢ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆC¢ÁV∆¬¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬∆ñ6Fñˆ‰ñBê¢ÊWÇ'W6W%ˆñB"¬W6W$ñBì∞†¢ñbáWFFTW'&˜"í∞¢Fá&˜rÊWrW'&˜"áWFFTW'&˜"Ê÷W76vRì∞¢–†¢6ˆÁ7B&Vg&W6ÜVD∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B&Vg&W6ÜVD∆ñ6Fñˆ‚–¢&Vg&W6ÜVD∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí«¿¢6V∆V7D6ÊˆÊñ6≈FD∆ñ6Fñˆ‚á&Vg&W6ÜVD∆ñ6FñˆÁ2ì∞†¢&W2Êß6ˆ‚á≤7V66W73¢G'VR¬∆ñ6Fñˆ„¢&Vg&W6ÜVD∆ñ6Fñˆ‚¬V&∆ñ5W&√¢W&ƒFFÁV&∆ñ5W&¬“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"W∆ˆFñÊrDBˆÊ&ˆ&FñÊrñFVÁFñfñ6Fñˆ„¢"¬W'&˜"ì∞¢ñbÄ¢W'&˜"ñÁ7FÊ6VˆbW'&˜"b`¢ÚÜ&∆ˆ6∂VBVÁFñ«∆«&VGó«&WVó&VG«VÊFñÊr&WfñWríˆíÁFW7BÜW'&˜"Ê÷W76vRê¢í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"Ê÷W76vR“ì∞¢–¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚW∆ˆB6W'FñfñVBñFVÁFñfñ6Fñˆ‚6˜í"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆí˜FBˆ6ˆ◊∆WFR÷ˆÊ&ˆ&FñÊr"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'FB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B≤∆ñ6Fñˆ‰ñB““&WÊ&ˆGíÛÚ∑”∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B∆ñ6Fñˆ‚–¢∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí«¬6V∆V7D6ÊˆÊñ6≈FD∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞†¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG57FGW2“'Vñ∆EFDˆÊ&ˆ&FñÊu7FGW6W2Ü∆ñ6Fñˆ‚ÊFˆ7V÷VÁG57FGW2«¬∆ñ6Fñˆ‚ÊFˆ7V÷VÁG5˜7FGW2ì∞¢6ˆÁ7B∆ƒ&˜fVB“≤#"¬#""¬#2"¬#B"¬#R"¬#b"¬#r%“ÊWfW'íÇá7FWí”‚7G&ñÊrÜFˆ7V÷VÁG57FGW5∑7FW“«¬""í””“&&˜fVB"ì∞¢ñbÇ∆ƒ&˜fVBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$∆¬DBˆÊ&ˆ&FñÊr7FW2◊W7B&R&˜fVB&Vf˜&RˆÊ&ˆ&FñÊr6‚&R6ˆ◊∆WFVB‚"“ì∞¢–†¢6ˆÁ7B≤W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'FEˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá≤ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆC¢ÊWrFFRÇí¬WFFVEˆC¢ÊWrFFRÇí“ê¢ÊWÇ&ñB"¬∆ñ6Fñˆ‰ñBê¢ÊWÇ'W6W%ˆñB"¬W6W$ñBì∞†¢ñbÜW'&˜"í∞¢Fá&˜rÊWrW'&˜"ÜW'&˜"Ê÷W76vRì∞¢–†¢6ˆÁ7B76ñvÊVEˆG2“vóB7F˜&vRÊvWEˆG4'ïDBáW6W$ñBì∞¢&W2Êß6ˆ‚á≤7V66W73¢G'VR¬&VFó&V7EFÛ¢76ñvÊVEˆG2Ê∆VÊwFÇ‚Ú"ˆ˜W&FñˆÊ¬˜FBˆF6Ü&ˆ&B"¢"ˆ˜W&FñˆÊ¬˜FBˆÊÚ◊ˆB"“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6ˆ◊∆WFñÊrDBˆÊ&ˆ&FñÊs¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ6ˆ◊∆WFRDBˆÊ&ˆ&FñÊr"“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆíˆ6ˆÚ˜FB÷∆ñ6FñˆÁ2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7FGW2“GóVˆb&WÁVW'ìÚÁ7FGW2””“'7G&ñÊr"Ú&WÁVW'íÁ7FGW2¢VÊFVfñÊVC∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá≤7FGW2“ì∞¢&W2Êß6ˆ‚Ü∆ñ6FñˆÁ2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrDB∆ñ6FñˆÁ3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇDB∆ñ6FñˆÁ2"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜FB÷∆ñ6FñˆÁ2Û¶ñBˆ&˜fR"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&WfñWvW$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'FEˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢7FGW3¢&&˜fVB"¿¢&WfñWvVEˆ'ì¢&WfñWvW$ñB¿¢&WfñWvVEˆC¢ÊWrFFRÇí¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW¢¿¢Fˆ7V÷VÁG5˜7FGW3¢î‰ïDî≈ıDEÙDÙ5T‘TÂEı5DEU4U2¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"«¬FFí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%DB∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢vóB6fU6VÊEW6ÇÄ¢FFÁW6W%ˆñB¿¢∞¢FóF∆S¢%DB∆ñ6Fñˆ‚&˜fVB"¿¢&ˆGì¢%ñ˜W"FW'&óF˜'íFó&V7F˜"∆ñ6Fñˆ‚v2&˜fVB‚˜V‚&W7ˆÁ6RñÁFVw&óGíFÚ6ˆ◊∆WFRˆÊ&ˆ&FñÊr‚"¿¢W&√¢"ˆ˜W&FñˆÊ¬˜FBˆvFWví"¿¢Fs¢FB÷∆ñ6Fñˆ‚÷&˜fVB“G∂FFÊñG÷¿¢“¿¢'FB∆ñ6Fñˆ‚&˜fVB"¿¢ì∞†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&˜fñÊrDB∆ñ6Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&˜fRDB∆ñ6Fñˆ‚"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜FB÷∆ñ6FñˆÁ2Û¶ñB˜&V¶V7B"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&WfñWvW$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B&V6ˆ‚“7G&ñÊrá&WÊ&ˆGìÚÁ&V6ˆ‚«¬""íÁG&ñ“Çí«¬$∆ñ6Fñˆ‚Ê˜B66WFVB#∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'FEˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢7FGW3¢'&V¶V7FVB"¿¢&WfñWvVEˆ'ì¢&WfñWvW$ñB¿¢&WfñWvVEˆC¢ÊWrFFRÇí¿¢&V¶V7FñˆÂ˜&V6ˆ„¢&V6ˆ‚¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"«¬FFí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%DB∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢vóB6fU6VÊEW6ÇÄ¢FFÁW6W%ˆñB¿¢∞¢FóF∆S¢%DB∆ñ6Fñˆ‚WFFR"¿¢&ˆGì¢%ñ˜W"FW'&óF˜'íFó&V7F˜"∆ñ6Fñˆ‚v2Ê˜B66WFVB‚˜V‚&W7ˆÁ6RñÁFVw&óGíFÚ&WfñWrFÜRWFFR‚"¿¢W&√¢"ˆ˜W&FñˆÊ¬˜FBˆvFWví"¿¢Fs¢FB÷∆ñ6Fñˆ‚◊&V¶V7FVB“G∂FFÊñG÷¿¢“¿¢'FB∆ñ6Fñˆ‚&V¶V7FVB"¿¢ì∞†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&V¶V7FñÊrDB∆ñ6Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&V¶V7BDB∆ñ6Fñˆ‚"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜FB÷∆ñ6FñˆÁ2Û¶ñBˆFˆ7V÷VÁBÛr˜&WfñWr"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&WfñWvW$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢ñbáGóVˆb&WÊ&ˆGìÚÊ&˜fVB”“&&ˆˆ∆V‚"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$÷ó76ñÊr&˜f¬FV6ó6ñˆ‚"“ì∞¢–¢6ˆÁ7B&˜fVB“&WÊ&ˆGíÊ&˜fVB2&ˆˆ∆V„∞¢6ˆÁ7B&V¶V7FñˆÂ&V6ˆ‚“7G&ñÊrá&WÊ&ˆGìÚÁ&V¶V7FñˆÂ&V6ˆ‚«¬""íÁG&ñ“Çì∞†¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWEFD∆ñ6FñˆÁ4'ïVW'íá∑“ì∞¢6ˆÁ7B∆ñ6Fñˆ‚“∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“ñBì∞¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%DB∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG57FGW2“'Vñ∆EFDˆÊ&ˆ&FñÊu7FGW6W2Ü∆ñ6Fñˆ‚ÊFˆ7V÷VÁG57FGW2«¬∆ñ6Fñˆ‚ÊFˆ7V÷VÁG5˜7FGW2ì∞¢ñbÖ7G&ñÊrÜFˆ7V÷VÁG57FGW5≤#r%“«¬""í”“'VÊFñÊu˜&WfñWr"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%DBñFVÁFñfñ6Fñˆ‚ó2Ê˜BvóFñÊr4ÙÚ&WfñWr‚"“ì∞¢–†¢Fˆ7V÷VÁG57FGW5≤#r%““&˜fVBÚ&&˜fVB"¢'&V¶V7FVB#∞¢6ˆÁ7B∆ƒ&˜fVB“≤#"¬#""¬#2"¬#B"¬#R"¬#b"¬#r%“ÊWfW'íÇá7FWí”‚7G&ñÊrÜFˆ7V÷VÁG57FGW5∑7FW“«¬""í””“&&˜fVB"ì∞†¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'FEˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢Fˆ7V÷VÁG5˜7FGW3¢Fˆ7V÷VÁG57FGW2¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW¢r¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜&WfñWvVEˆC¢ÊWrFFRÇí¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜&WfñWvVEˆ'ì¢&WfñWvW$ñB¿¢Fˆ5Ûu˜7V&÷ó76ñˆÂ˜&V¶V7FñˆÂ˜&V6ˆ„¢&˜fVBÚÁV∆¬¢á&V¶V7FñˆÂ&V6ˆ‚«¬$ñFVÁFñfñ6Fñˆ‚6˜í&V¶V7FVB"í¿¢ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆC¢∆ƒ&˜fVBÚÊWrFFRÇí¢ÁV∆¬¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"«¬FFí∞¢Fá&˜rÊWrW'&˜"ÜW'&˜#ÚÊ÷W76vR«¬$fñ∆VBFÚ&WfñWrDBñFVÁFñfñ6Fñˆ‚"ì∞¢–†¢vóB6fU6VÊEW6ÇÄ¢FFÁW6W%ˆñB¿¢∞¢FóF∆S¢&˜fVBÚ%DBñFVÁFñfñ6Fñˆ‚&˜fVB"¢%DBñFVÁFñfñ6Fñˆ‚&V¶V7FVB"¿¢&ˆGì¢&˜fV@¢Ú%ñ˜W"6W'FñfñVBñFVÁFñfñ6Fñˆ‚6˜ív2&˜fVB‚ ¢¢%ñ˜W"6W'FñfñVBñFVÁFñfñ6Fñˆ‚6˜ív2&V¶V7FVBÊBÊVVG2&W7V&÷ó76ñˆ‚‚"¿¢W&√¢"ˆ˜W&FñˆÊ¬˜FBˆvFWví"¿¢Fs¢FB÷Fˆ7V÷VÁB◊&WfñWr“G∂FFÊñG“”r“G∂&˜fVBÚ&&˜fVB"¢'&V¶V7FVB'÷¿¢“¿¢'FBFˆ7V÷VÁB&WfñWr&W7V«B"¿¢ì∞†¢&W2Êß6ˆ‚á∞¢7V66W73¢G'VR¿¢∆ñ6Fñˆ„¢FF¿¢÷W76vS¢&˜fVBÚ%DBñFVÁFñfñ6Fñˆ‚&˜fVB‚"¢%DBñFVÁFñfñ6Fñˆ‚&V¶V7FVB‚"¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&WfñWvñÊrDBñFVÁFñfñ6Fñˆ‚Fˆ7V÷VÁC¢"¬W'&˜"ì∞¢ñbÜW'&˜"ñÁ7FÊ6VˆbW'&˜"bbÚÜvóFñÊr4ÙÚ&WfñWw«&WVó&VBíˆíÁFW7BÜW'&˜"Ê÷W76vRíí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"Ê÷W76vR“ì∞¢–¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ&WfñWrDBñFVÁFñfñ6Fñˆ‚"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆffñ∆ñFRˆ∆ñ6Fñˆ‚"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B&ˆGV7Fñˆ‰∆ñÊ¥6ˆFR“7G&ñÊrÇá&WÊ&ˆGìÚÁ&ˆGV7Fñˆ‰∆ñÊ¥6ˆFR«¬á&WÁ6W76ñˆ‚2ÁíìÚÁ&ˆGV7Fñˆ‰∆ñÊ¥6ˆFR«¬""ííÁG&ñ“ÇíÁFıWW$66RÇí«¬ÁV∆√∞¢6ˆÁ7Bñ∆ˆB“∞¢W6W%ˆñC¢W6W$ñB¿¢&ˆGV7FñˆÂˆ∆ñÊµˆ6ˆFS¢&ˆGV7Fñˆ‰∆ñÊ¥6ˆFR¿¢gV∆≈ˆÊ÷S¢7G&ñÊrá&WÊ&ˆGìÚÊgV∆ƒÊ÷R«¬""íÁG&ñ“Çí¿¢ñEˆÁV÷&W#¢7G&ñÊrá&WÊ&ˆGìÚÊñDÁV÷&W"«¬""íÁG&ñ“Çí¿¢ÜˆÊS¢7G&ñÊrá&WÊ&ˆGìÚÁÜˆÊR«¬""íÁG&ñ“Çí¿¢V÷ñ√¢7G&ñÊrá&WÊ&ˆGìÚÊV÷ñ¬«¬""íÁG&ñ“Çí¿¢&V6ÖˆñÂÛuˆFó3¢7G&ñÊrá&WÊ&ˆGìÚÁ&V6Ññ„tFó2«¬""íÁG&ñ“Çí¿¢fó'7E˜&VÁG3¢7G&ñÊrá&WÊ&ˆGìÚÊfó'7E&VÁG2«¬""íÁG&ñ“Çí¿¢7GVFVÁEˆ'&V∂F˜vÂˆ66S¢7G&ñÊrá&WÊ&ˆGìÚÁ7GVFVÁD'&V∂F˜v‰66R«¬""íÁG&ñ“Çí¿¢÷&∑5˜6ñvÊ√¢7G&ñÊrá&WÊ&ˆGìÚÊ÷&∑56ñvÊ¬«¬""íÁG&ñ“Çí¿¢WáG&ˆ∆W76ˆÁ5˜&W7ˆÁ6S¢7G&ñÊrá&WÊ&ˆGìÚÊWáG&∆W76ˆÁ5&W7ˆÁ6R«¬""íÁG&ñ“Çí¿¢Ê˜E˜&V6ˆ÷÷VÊEˆ66W3¢7G&ñÊrá&WÊ&ˆGìÚÊÊ˜E&V6ˆ÷÷VÊD66W2«¬""íÁG&ñ“Çí¿¢VÊ6∆V%˜&ˆ&∆V’˜&W7ˆÁ6S¢7G&ñÊrá&WÊ&ˆGìÚÁVÊ6∆V%&ˆ&∆V’&W7ˆÁ6R«¬""íÁG&ñ“Çí¿¢FVÂ˜&VÁG5ˆfñ«FW#¢7G&ñÊrá&WÊ&ˆGìÚÁFVÂ&VÁG4fñ«FW"«¬""íÁG&ñ“Çí¿¢fó'7Eˆ6FV÷ñ5˜VW7Fñˆ„¢7G&ñÊrá&WÊ&ˆGìÚÊfó'7D6FV÷ñ5VW7Fñˆ‚«¬""íÁG&ñ“Çí¿¢ÊıˆV&ÊñÊw5˜&W7ˆÁ6S¢7G&ñÊrá&WÊ&ˆGìÚÊÊÙV&ÊñÊw5&W7ˆÁ6R«¬""íÁG&ñ“Çí¿¢ÊWáEˆfófUˆFó5˜∆„¢7G&ñÊrá&WÊ&ˆGìÚÊÊWáDfófTFó5∆‚«¬""íÁG&ñ“Çí¿¢&ˆ6VVE˜&V6ˆ„¢7G&ñÊrá&WÊ&ˆGìÚÁ&ˆ6VVE&V6ˆ‚«¬""íÁG&ñ“Çí¿¢G'W7E˜&V6ˆ„¢7G&ñÊrá&WÊ&ˆGìÚÁG'W7E&V6ˆ‚«¬""íÁG&ñ“Çí¿¢”∞†¢6ˆÁ7B&WVó&VDfñV∆G2“∞¢&gV∆≈ˆÊ÷R"¿¢&ñEˆÁV÷&W""¿¢'ÜˆÊR"¿¢&V÷ñ¬"¿¢'&V6ÖˆñÂÛuˆFó2"¿¢&fó'7E˜&VÁG2"¿¢'7GVFVÁEˆ'&V∂F˜vÂˆ66R"¿¢&÷&∑5˜6ñvÊ¬"¿¢&WáG&ˆ∆W76ˆÁ5˜&W7ˆÁ6R"¿¢&Ê˜E˜&V6ˆ÷÷VÊEˆ66W2"¿¢'VÊ6∆V%˜&ˆ&∆V’˜&W7ˆÁ6R"¿¢'FVÂ˜&VÁG5ˆfñ«FW""¿¢&fó'7Eˆ6FV÷ñ5˜VW7Fñˆ‚"¿¢&ÊıˆV&ÊñÊw5˜&W7ˆÁ6R"¿¢&ÊWáEˆfófUˆFó5˜∆‚"¿¢'&ˆ6VVE˜&V6ˆ‚"¿¢'G'W7E˜&V6ˆ‚"¿¢”∞†¢6ˆÁ7B÷ó76ñÊtfñV∆B“&WVó&VDfñV∆G2ÊfñÊBÇÜfñV∆Bí”‚7G&ñÊrÇáñ∆ˆB2Áíï∂fñV∆E“«¬""íÁG&ñ“Çíì∞¢ñbÜ÷ó76ñÊtfñV∆Bí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$∆¬Tu∆ñ6Fñˆ‚fñV∆G2&R&WVó&VB‚"“ì∞¢–†¢6ˆÁ7BWÜó7FñÊt∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B&WW6&∆T∆ñ6Fñˆ‚“WÜó7FñÊt∆ñ6FñˆÁ2ÊfñÊBÇÜ∆ñ6Fñˆ„¢Áíí”‡¢≤'VÊFñÊr"¬'&V¶V7FVB%“ÊñÊ6«VFW2Ö7G&ñÊrÜ∆ñ6Fñˆ‚Á7FGW2«¬""íÁFÙ∆˜vW$66RÇíê¢ì∞†¢∆WBFF¢Áí“ÁV∆√∞¢∆WBW'&˜#¢Áí“ÁV∆√∞†¢ñbá&WW6&∆T∆ñ6Fñˆ‚í∞¢6ˆÁ7B&W7V«B“vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢‚‚Áñ∆ˆB¿¢7FGW3¢'VÊFñÊr"¿¢&WfñWvVEˆ'ì¢ÁV∆¬¿¢&WfñWvVEˆC¢ÁV∆¬¿¢&V¶V7FñˆÂ˜&V6ˆ„¢ÁV∆¬¿¢ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆC¢ÁV∆¬¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW¢¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜W&√¢ÁV∆¬¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜W∆ˆFVEˆC¢ÁV∆¬¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&WfñWvVEˆC¢ÁV∆¬¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&WfñWvVEˆ'ì¢ÁV∆¬¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&V¶V7FñˆÂ˜&V6ˆ„¢ÁV∆¬¿¢Fˆ7V÷VÁG5˜7FGW3¢≤‚‚‰î‰ïDî≈ÙTuÙDÙ5T‘TÂEı5DEU4U2¬##¢&Ê˜E˜7F'FVB"“¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬&WW6&∆T∆ñ6Fñˆ‚ÊñBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢FF“&W7V«BÊFF∞¢W'&˜"“&W7V«BÊW'&˜#∞¢“V«6R∞¢6ˆÁ7B&W7V«B“vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆ∆ñ6FñˆÁ2"ê¢ÊñÁ6W'Báñ∆ˆBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢FF“&W7V«BÊFF∞¢W'&˜"“&W7V«BÊW'&˜#∞¢–†¢ñbÜW'&˜"«¬FFí∞¢Fá&˜rÊWrW'&˜"ÜW'&˜#ÚÊ÷W76vR«¬$fñ∆VBFÚ7V&÷óBffñ∆ñFR∆ñ6Fñˆ‚"ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7V&÷óGFñÊrffñ∆ñFR∆ñ6Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ7V&÷óBffñ∆ñFR∆ñ6Fñˆ‚"“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆíˆffñ∆ñFRˆ∆ñ6Fñˆ‚◊7FGW2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B6ÊˆÊñ6ƒ∆ñ6Fñˆ‚“6V∆V7D6ÊˆÊñ6ƒffñ∆ñFT∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞¢ñbÇ6ÊˆÊñ6ƒ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Êß6ˆ‚á≤7FGW3¢&Ê˜Eˆ∆ñVB"“ì∞¢–†¢&W2Êß6ˆ‚ÜFW&ófTVwvFWvî∆ñ6FñˆÂ7FGW2Ü6ÊˆÊñ6ƒ∆ñ6Fñˆ‚íì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrffñ∆ñFR∆ñ6Fñˆ‚7FGW3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Çffñ∆ñFR∆ñ6Fñˆ‚7FGW2"“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆíˆffñ∆ñFRˆvFWví◊6W76ñˆ‚"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B∆FW7D“6V∆V7D6ÊˆÊñ6ƒffñ∆ñFT∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞†¢&W2Êß6ˆ‚á∞¢&ˆ∆S¢á&W2ÁííÊF%W6W#ÚÁ&ˆ∆R«¬&ffñ∆ñFR"¿¢∆ñ6FñˆÂ7FGW3¢∆FW7DÚFW&ófTVwvFWvî∆ñ6FñˆÂ7FGW2Ü∆FW7Dí¢ÁV∆¬¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrffñ∆ñFRvFWví6W76ñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Çffñ∆ñFRvFWví6W76ñˆ‚"“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆíˆffñ∆ñFRˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B∆FW7D“6V∆V7D6ÊˆÊñ6ƒffñ∆ñFT∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞†¢ñbÇ∆FW7Dí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ffñ∆ñFR∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG2“vóB&ˆ÷ó6RÊ∆¬Ä¢TuÙÙ‰$Ù$Dî‰uÙDÙ5T‘TÂE2Ê÷Ü7ñÊ2ÜFˆ7V÷VÁBí”‚∞¢6ˆÁ7B∆ˆFVB“vóB∆ˆDVwˆÊ&ˆ&FñÊtFˆ7V÷VÁBÜFˆ7V÷VÁBÁ7FWì∞¢&WGW&‚∞¢7FW¢∆ˆFVBÁ7FW¿¢6ˆFS¢∆ˆFVBÊ6ˆFR¿¢FóF∆S¢∆ˆFVBÁFóF∆R¿¢fW'6ñˆ„¢∆ˆFVBÁfW'6ñˆ‚¿¢&WVó&W466WFÊ6S¢∆ˆFVBÁ&WVó&W466WFÊ6R¿¢&WVó&W5W∆ˆC¢∆ˆFVBÁ&WVó&W5W∆ˆB¿¢W∆ˆEFóF∆S¢∆ˆFVBÁW∆ˆEFóF∆R¿¢W∆ˆDFW67&óFñˆ„¢∆ˆFVBÁW∆ˆDFW67&óFñˆ‚¿¢÷ÊFF˜'î6∆W6W3¢∆ˆFVBÊ÷ÊFF˜'î6∆W6W2¿¢6ˆÁFVÁC¢∆ˆFVBÊ6ˆÁFVÁB¿¢6ˆÁFVÁDÜ6É¢∆ˆFVBÊ6ˆÁFVÁDÜ6Ç¿¢”∞¢“ê¢ì∞†¢&W2Êß6ˆ‚á∞¢∆ñ6Fñˆ‰ñC¢∆FW7DÊñB¿¢Fˆ7V÷VÁG2¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrffñ∆ñFRˆÊ&ˆ&FñÊrFˆ7V÷VÁG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Çffñ∆ñFRˆÊ&ˆ&FñÊrFˆ7V÷VÁG2"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆffñ∆ñFRˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2Û¶Fˆ57FWˆ66WB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7BFˆ57FW“ÁV÷&W"á&WÁ&◊2ÊFˆ57FWì∞¢6ˆÁ7B∞¢∆ñ6Fñˆ‰ñB¿¢Fˆ7V÷VÁEfW'6ñˆ‚¿¢Fˆ7V÷VÁDÜ6Ç¿¢GóVDgV∆ƒÊ÷R¿¢66WFVEFñ÷W¶ˆÊR¿¢∆ˆ6∆R¿¢∆Ff˜&“¿¢6˜W&6Tf∆˜r¿¢f˜&‘FF¿¢66WFVD6∆W6T∂Wó2¿¢67&ˆ∆ƒ6ˆ◊∆WFñˆÂW&6VÁB¿¢fñWu7F'FVDB¿¢fñWt6ˆ◊∆WFVDB¿¢66WD6∆ñ6∂VDB¿¢““&WÊ&ˆGíÛÚ∑”∞†¢ñbÇ∆ñ6Fñˆ‰ñB«¬ÁV÷&W"Êó4ñÁFVvW"ÜFˆ57FWí«¬Fˆ57FW¬«¬Fˆ57FW‚Bí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ñÁf∆ñBTuˆÊ&ˆ&FñÊr66WFÊ6R&WVW7B"“ì∞¢–¢ñbÇ7G&ñÊráGóVDgV∆ƒÊ÷R«¬""íÁG&ñ“Çíí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%GóVBgV∆¬Ê÷Ró2&WVó&VB"“ì∞¢–†¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B∆ñ6Fñˆ‚“∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí«¬6V∆V7D6ÊˆÊñ6ƒffñ∆ñFT∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"“ì∞¢–†¢6ˆÁ7BFVfñÊóFñˆ‚“vWDVwˆÊ&ˆ&FñÊtFˆ7V÷VÁDFVfñÊóFñˆ‚ÜFˆ57FWì∞¢6ˆÁ7B∆ˆFVB“vóB∆ˆDVwˆÊ&ˆ&FñÊtFˆ7V÷VÁBÜFˆ57FWì∞¢ñbÜFˆ7V÷VÁEfW'6ñˆ‚bbFˆ7V÷VÁEfW'6ñˆ‚”“∆ˆFVBÁfW'6ñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢$Fˆ7V÷VÁBfW'6ñˆ‚÷ó6÷F6Ç"“ì∞¢–¢ñbÜFˆ7V÷VÁDÜ6ÇbbFˆ7V÷VÁDÜ6Ç”“∆ˆFVBÊ6ˆÁFVÁDÜ6Çí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢$Fˆ7V÷VÁB6ˆÁFVÁBÜ6Ç÷ó6÷F6Ç"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG57FGW2“'Vñ∆DVwˆÊ&ˆ&FñÊu7FGW6W2Ü∆ñ6Fñˆ‚ÊFˆ7V÷VÁG57FGW2«¬∆ñ6Fñˆ‚ÊFˆ7V÷VÁG5˜7FGW2ì∞¢6ˆÁ7B7W'&VÁE7FW“vWD7W'&VÁDVw7FWg&ˆ’7FGW6W2ÜFˆ7V÷VÁG57FGW2ì∞¢ñbÜFˆ57FW”“7W'&VÁE7FWí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢6WVVÁFñ¬7FW˜&FW"fñˆ∆Fñˆ„¢7W'&VÁB66WFÊ6R7FWó2G∂7W'&VÁE7FW“Ê“ì∞¢–†¢6ˆÁ7B66WFVD6∆W6T∂Wï6WB“ÊWr6WBÄ¢'&íÊó4'&íÜ66WFVD6∆W6T∂Wó2íÚ66WFVD6∆W6T∂Wó2Ê÷Çáf«VS¢VÊ∂Ê˜v‚í”‚7G&ñÊráf«VRíí¢µ–¢ì∞¢6ˆÁ7B÷ó76ñÊt6∆W6R“FVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W2ÊfñÊBÇÜ6∆W6Rí”‚66WFVD6∆W6T∂Wï6WBÊÜ2Ü6∆W6RÊ∂Wííì∞¢ñbÜ÷ó76ñÊt6∆W6Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢÷ÊFF˜'í6∆W6RÊ˜B6∂Ê˜v∆VFvVC¢G∂÷ó76ñÊt6∆W6RÊ∆&V«÷“ì∞¢–†¢6ˆÁ7B≤FF¢66WFÊ6U&˜r¬W'&˜#¢66WFÊ6TW'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆˆÊ&ˆ&FñÊuˆ66WFÊ6W2"ê¢ÊñÁ6W'Bá∞¢∆ñ6FñˆÂˆñC¢∆ñ6Fñˆ‰ñB¿¢W6W%ˆñC¢W6W$ñB¿¢Fˆ7V÷VÁE˜7FW¢Fˆ57FW¿¢Fˆ7V÷VÁEˆ6ˆFS¢∆ˆFVBÊ6ˆFR¿¢Fˆ7V÷VÁE˜FóF∆S¢∆ˆFVBÁFóF∆R¿¢Fˆ7V÷VÁE˜fW'6ñˆ„¢∆ˆFVBÁfW'6ñˆ‚¿¢Fˆ7V÷VÁE˜6Ê6Ü˜C¢∆ˆFVBÊ6ˆÁFVÁB¿¢Fˆ7V÷VÁEˆ6ÜV6∑7V”¢∆ˆFVBÊ6ˆÁFVÁDÜ6Ç¿¢GóVEˆgV∆≈ˆÊ÷S¢7G&ñÊráGóVDgV∆ƒÊ÷RíÁG&ñ“Çí¿¢66˜VÁEˆV÷ñ√¢∆ñ6Fñˆ‚ÊV÷ñ¬¿¢ÜˆÊUˆÁV÷&W%˜6Ê6Ü˜C¢∆ñ6Fñˆ‚ÁÜˆÊR«¬ÁV∆¬¿¢66WFVE˜Fñ÷W¶ˆÊS¢66WFVEFñ÷W¶ˆÊRÚ7G&ñÊrÜ66WFVEFñ÷W¶ˆÊRí¢ÁV∆¬¿¢66WFÊ6Uˆ÷WFÜˆC¢&6ÜV6∂&˜Ö˜GóVEˆÊ÷R"¿¢óˆFG&W73¢WáG&7E&WVW7Dóá&Wí¿¢W6W%ˆvVÁC¢&WÊÜVFW'5≤'W6W"÷vVÁB%“«¬ÁV∆¬¿¢FWfñ6U˜GóS¢ñÊfW$FWfñ6UGóRá&WÊÜVFW'5≤'W6W"÷vVÁB%“í¿¢∆Ff˜&”¢∆Ff˜&“Ú7G&ñÊrá∆Ff˜&“í¢'vV""¿¢6W76ñˆÂˆñC¢&WÁ6W76ñˆ‰îB«¬ÁV∆¬¿¢∆ˆ6∆S¢∆ˆ6∆RÚ7G&ñÊrÜ∆ˆ6∆Rí¢ÁV∆¬¿¢6˜W&6Uˆf∆˜s¢6˜W&6Tf∆˜rÚ7G&ñÊrá6˜W&6Tf∆˜rí¢ffñ∆ñFUˆˆÊ&ˆ&FñÊu˜7FWÚG∂Fˆ57FW÷¿¢f˜&’˜6Ê6Ü˜Eˆß6ˆ„†¢f˜&‘FFbbGóVˆbf˜&‘FF””“&ˆ&¶V7B ¢Úˆ&¶V7BÊg&ˆ‘VÁG&ñW2Ñˆ&¶V7BÊVÁG&ñW2Üf˜&‘FFíÊ÷ÇÖ∂∂Wí¬f«VU“í”‚µ7G&ñÊrÜ∂Wíí¬7G&ñÊráf«VRÛÚ""íÁG&ñ“Çï“íê¢¢ÁV∆¬¿¢66WFVEˆ6∆W6W5ˆß6ˆ„¢FVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W0¢Êfñ«FW"ÇÜ6∆W6Rí”‚66WFVD6∆W6T∂Wï6WBÊÜ2Ü6∆W6RÊ∂Wííê¢Ê÷ÇÜ6∆W6Rí”‚6∆W6RÊ∂Wíí¿¢67&ˆ∆≈ˆ6ˆ◊∆WFñˆÂ˜W&6VÁC†¢GóVˆb67&ˆ∆ƒ6ˆ◊∆WFñˆÂW&6VÁB””“&ÁV÷&W" ¢Ú÷FÇÊ÷ÇÉ¬÷FÇÊ÷ñ‚É¬÷FÇÁ&˜VÊBá67&ˆ∆ƒ6ˆ◊∆WFñˆÂW&6VÁBííê¢¢ÁV∆¬¿¢fñWu˜7F'FVEˆC¢fñWu7F'FVDBÚÊWrFFRáfñWu7F'FVDBí¢ÁV∆¬¿¢fñWuˆ6ˆ◊∆WFVEˆC¢fñWt6ˆ◊∆WFVDBÚÊWrFFRáfñWt6ˆ◊∆WFVDBí¢ÁV∆¬¿¢66WEˆ6∆ñ6∂VEˆC¢66WD6∆ñ6∂VDBÚÊWrFFRÜ66WD6∆ñ6∂VDBí¢ÊWrFFRÇí¿¢“ê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbÜ66WFÊ6TW'&˜"«¬66WFÊ6U&˜rí∞¢Fá&˜rÊWrW'&˜"Ü66WFÊ6TW'&˜#ÚÊ÷W76vR«¬$fñ∆VBFÚ7&VFRffñ∆ñFRˆÊ&ˆ&FñÊr66WFÊ6R"ì∞¢–†¢ñbÜFVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W2Ê∆VÊwFÇí∞¢6ˆÁ7B≤W'&˜#¢6∆W6TW'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆˆÊ&ˆ&FñÊuˆ6∆W6Uˆ6∂Ê˜v∆VFvV÷VÁG2"ê¢ÊñÁ6W'BÄ¢FVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W0¢Êfñ«FW"ÇÜ6∆W6Rí”‚66WFVD6∆W6T∂Wï6WBÊÜ2Ü6∆W6RÊ∂Wííê¢Ê÷ÇÜ6∆W6Rí”‚á∞¢66WFÊ6UˆñC¢66WFÊ6U&˜rÊñB¿¢6∆W6Uˆ∂Wì¢6∆W6RÊ∂Wí¿¢6∆W6Uˆ∆&V√¢6∆W6RÊ∆&V¬¿¢“íê¢ì∞†¢ñbÜ6∆W6TW'&˜"í∞¢Fá&˜rÊWrW'&˜"Ü6∆W6TW'&˜"Ê÷W76vRì∞¢–¢–†¢6ˆÁ7B≤W'&˜#¢WfVÁDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆˆÊ&ˆ&FñÊuˆ66WFÊ6UˆWfVÁG2"ê¢ÊñÁ6W'BÖ∞¢∞¢66WFÊ6UˆñC¢66WFÊ6U&˜rÊñB¿¢∆ñ6FñˆÂˆñC¢∆ñ6Fñˆ‰ñB¿¢W6W%ˆñC¢W6W$ñB¿¢Fˆ7V÷VÁE˜7FW¢Fˆ57FW¿¢WfVÁE˜GóS¢&66WFVB"¿¢ñ∆ˆC¢∞¢6∆W6W3¢FVfñÊóFñˆ‚Ê÷ÊFF˜'î6∆W6W2Êfñ«FW"ÇÜ6∆W6Rí”‚66WFVD6∆W6T∂Wï6WBÊÜ2Ü6∆W6RÊ∂WíííÊ÷ÇÜ6∆W6Rí”‚6∆W6RÊ∂Wíí¿¢66WFVDC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“¿¢“¿¢“ì∞†¢ñbÜWfVÁDW'&˜"í∞¢Fá&˜rÊWrW'&˜"ÜWfVÁDW'&˜"Ê÷W76vRì∞¢–†¢Fˆ7V÷VÁG57FGW5µ7G&ñÊrÜFˆ57FWï““&&˜fVB#∞¢ñbÜFˆ57FW¬RbbFˆ7V÷VÁG57FGW5µ7G&ñÊrÜFˆ57FW≤ï“”“&&˜fVB"í∞¢Fˆ7V÷VÁG57FGW5µ7G&ñÊrÜFˆ57FW≤ï““'VÊFñÊu˜W∆ˆB#∞¢–†¢6ˆÁ7B∆ƒ&˜fVB“≤#"¬#""¬#2"¬#B"¬#R%“ÊWfW'íÇá7FWí”‚7G&ñÊrÜFˆ7V÷VÁG57FGW5∑7FW“«¬""í””“&&˜fVB"ì∞¢6ˆÁ7B≤W'&˜#¢WFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢Fˆ7V÷VÁG5˜7FGW3¢Fˆ7V÷VÁG57FGW2¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW¢Fˆ57FW¬RÚFˆ57FW≤¢R¿¢ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆC¢∆ƒ&˜fVBÚÊWrFFRÇí¢ÁV∆¬¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬∆ñ6Fñˆ‰ñBì∞†¢ñbáWFFTW'&˜"í∞¢Fá&˜rÊWrW'&˜"áWFFTW'&˜"Ê÷W76vRì∞¢–†¢6ˆÁ7BWFFVD∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7BWFFVD∆ñ6Fñˆ‚–¢WFFVD∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí«¿¢6V∆V7D6ÊˆÊñ6ƒffñ∆ñFT∆ñ6Fñˆ‚áWFFVD∆ñ6FñˆÁ2ì∞†¢&W2Êß6ˆ‚á∞¢7V66W73¢G'VR¿¢∆ñ6Fñˆ„¢WFFVD∆ñ6Fñˆ‚¿¢66WFÊ6S¢66WFÊ6U&˜r¿¢&V6VóC¢∞¢66WFVDC¢66WFÊ6U&˜rÊ66WFVEˆB¿¢Fˆ7V÷VÁD6ˆFS¢66WFÊ6U&˜rÊFˆ7V÷VÁEˆ6ˆFR¿¢Fˆ7V÷VÁEfW'6ñˆ„¢66WFÊ6U&˜rÊFˆ7V÷VÁE˜fW'6ñˆ‚¿¢Fˆ7V÷VÁD6ÜV6∑7V”¢66WFÊ6U&˜rÊFˆ7V÷VÁEˆ6ÜV6∑7V“¿¢“¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"66WFñÊrffñ∆ñFRˆÊ&ˆ&FñÊrFˆ7V÷VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ66WBˆÊ&ˆ&FñÊrFˆ7V÷VÁB"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆffñ∆ñFRˆˆÊ&ˆ&FñÊr÷Fˆ7V÷VÁG2˜W∆ˆB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B≤∆ñ6Fñˆ‰ñB¬Fˆ57FW¬fñ∆TÊ÷R¬fñ∆TFF¬fñ∆UGóR““&WÊ&ˆGíÛÚ∑”∞¢6ˆÁ7B'6VDFˆ57FW“GóVˆbFˆ57FW””“&ÁV÷&W""ÚFˆ57FW¢ÁV÷&W"ÜFˆ57FWì∞†¢ñbÇ∆ñ6Fñˆ‰ñB«¬'6VDFˆ57FW”“R«¬fñ∆TÊ÷R«¬fñ∆TFFí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ˆÊ«í&W7ˆÁ6RñÁFVw&óGí‘Tu”R66WG26W'FñfñVBîBW∆ˆB‚"“ì∞¢–†¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B∆ñ6Fñˆ‚–¢∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí«¬6V∆V7D6ÊˆÊñ6ƒffñ∆ñFT∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞†¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG57FGW2“'Vñ∆DVwˆÊ&ˆ&FñÊu7FGW6W2Ü∆ñ6Fñˆ‚ÊFˆ7V÷VÁG57FGW2«¬∆ñ6Fñˆ‚ÊFˆ7V÷VÁG5˜7FGW2ì∞¢6ˆÁ7B7W'&VÁE7FW“vWD7W'&VÁDVw7FWg&ˆ’7FGW6W2ÜFˆ7V÷VÁG57FGW2ì∞¢ñbÜ7W'&VÁE7FW”“Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$6W'FñfñVBîBW∆ˆBó2&∆ˆ6∂VBVÁFñ¬FÜRfó'7Bf˜W"Tuw&VV÷VÁG2&R&˜fVB‚"“ì∞¢–†¢6ˆÁ7B7FW7FGW2“7G&ñÊrÜFˆ7V÷VÁG57FGW5≤#R%“«¬&Ê˜E˜7F'FVB"ì∞¢ñbá7FW7FGW2””“'VÊFñÊu˜&WfñWr"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%ñ˜W"6W'FñfñVBîB6˜íó2«&VGívóFÇ4ÙÚf˜"&WfñWr‚"“ì∞¢–¢ñbá7FW7FGW2””“&&˜fVB"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%ñ˜W"6W'FñfñVBîB6˜íÜ2«&VGí&VV‚&˜fVB‚"“ì∞¢–†¢6ˆÁ7B'VffW"“'VffW"Êg&ˆ“Üfñ∆TFF¬&&6ScB"ì∞¢6ˆÁ7B6ÊóFó¶VDÊ÷R“7G&ñÊrÜfñ∆TÊ÷RíÁ&W∆6RÇıµÊ◊§’£”íÂÚ’“ˆr¬%Ú"ì∞¢6ˆÁ7B6fTfñ∆TÊ÷R“ffñ∆ñFR÷Fˆ7V÷VÁG2ÚG∑W6W$ñG“ˆVw÷6W'FñfñVB÷ñB“G∂∆ñ6Fñˆ‰ñG““G¥FFRÊÊ˜rÇó““G∑6ÊóFó¶VDÊ÷W÷∞†¢vóBVÁ7W&U&ófFT'V6∂WBá7W&6R¬'GWF˜"÷Fˆ7V÷VÁG2"ì∞¢6ˆÁ7B≤W'&˜#¢W∆ˆDW'&˜"““vóB7W&6RÁ7F˜&vP¢Êg&ˆ“Ç'GWF˜"÷Fˆ7V÷VÁG2"ê¢ÁW∆ˆBá6fTfñ∆TÊ÷R¬'VffW"¬∞¢6ˆÁFVÁEGóS¢fñ∆UGóR«¬VÊFVfñÊVB¿¢W6W'C¢f«6R¿¢“ì∞†¢ñbáW∆ˆDW'&˜"í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W∆ˆDW'&˜"Ê÷W76vR“ì∞¢–†¢6ˆÁ7BW&ƒFF“≤V&∆ñ5W&√¢6ˆÊfñFVÁFñ≈&VfW&VÊ6RÇ'GWF˜"÷Fˆ7V÷VÁG2"¬6fTfñ∆TÊ÷Rí”∞¢ñbÇW&ƒFFÚÁV&∆ñ5W&¬í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢%W∆ˆB7V66VVFVB'WBfñ∆RU$¬6˜V∆BÊ˜B&RvVÊW&FVB‚"“ì∞¢–†¢Fˆ7V÷VÁG57FGW5≤#R%““'VÊFñÊu˜&WfñWr#∞†¢6ˆÁ7B≤W'&˜#¢WFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜W&√¢W&ƒFFÁV&∆ñ5W&¬¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜W∆ˆFVEˆC¢ÊWrFFRÇí¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&WfñWvVEˆC¢ÁV∆¬¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&WfñWvVEˆ'ì¢ÁV∆¬¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&V¶V7FñˆÂ˜&V6ˆ„¢ÁV∆¬¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW¢R¿¢Fˆ7V÷VÁG5˜7FGW3¢Fˆ7V÷VÁG57FGW2¿¢ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆC¢ÁV∆¬¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬∆ñ6Fñˆ‰ñBê¢ÊWÇ'W6W%ˆñB"¬W6W$ñBì∞†¢ñbáWFFTW'&˜"í∞¢Fá&˜rÊWrW'&˜"áWFFTW'&˜"Ê÷W76vRì∞¢–†¢6ˆÁ7B&Vg&W6ÜVD∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B&Vg&W6ÜVD∆ñ6Fñˆ‚–¢&Vg&W6ÜVD∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí«¿¢6V∆V7D6ÊˆÊñ6ƒffñ∆ñFT∆ñ6Fñˆ‚á&Vg&W6ÜVD∆ñ6FñˆÁ2ì∞†¢&W2Êß6ˆ‚á≤7V66W73¢G'VR¬∆ñ6Fñˆ„¢&Vg&W6ÜVD∆ñ6Fñˆ‚¬V&∆ñ5W&√¢W&ƒFFÁV&∆ñ5W&¬“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"W∆ˆFñÊrffñ∆ñFRˆÊ&ˆ&FñÊrFˆ7V÷VÁC¢"¬W'&˜"ì∞¢ñbÄ¢W'&˜"ñÁ7FÊ6VˆbW'&˜"b`¢ÚÜ&∆ˆ6∂VBVÁFñ«∆«&VGó«&WVó&VG«VÊFñÊr&WfñWríˆíÁFW7BÜW'&˜"Ê÷W76vRê¢í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"Ê÷W76vR“ì∞¢–¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚW∆ˆB6W'FñfñVBîB6˜í"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆffñ∆ñFRˆ6ˆ◊∆WFR÷ˆÊ&ˆ&FñÊr"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B≤∆ñ6Fñˆ‰ñB““&WÊ&ˆGíÛÚ∑”∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íá≤W6W$ñB“ì∞¢6ˆÁ7B∆ñ6Fñˆ‚“∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“∆ñ6Fñˆ‰ñBí«¬6V∆V7D6ÊˆÊñ6ƒffñ∆ñFT∆ñ6Fñˆ‚Ü∆ñ6FñˆÁ2ì∞†¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚Ê˜Bf˜VÊB˜"66W72FVÊñVB"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG57FGW2“'Vñ∆DVwˆÊ&ˆ&FñÊu7FGW6W2Ü∆ñ6Fñˆ‚ÊFˆ7V÷VÁG57FGW2«¬∆ñ6Fñˆ‚ÊFˆ7V÷VÁG5˜7FGW2ì∞¢6ˆÁ7B∆ƒ&˜fVB“≤#"¬#""¬#2"¬#B"¬#R%“ÊWfW'íÇá7FWí”‚7G&ñÊrÜFˆ7V÷VÁG57FGW5∑7FW“«¬""í””“&&˜fVB"ì∞¢ñbÇ∆ƒ&˜fVBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$∆¬TuˆÊ&ˆ&FñÊr7FW2◊W7B&R&˜fVB&Vf˜&RˆÊ&ˆ&FñÊr6‚&R6ˆ◊∆WFVB‚"“ì∞¢–†¢6ˆÁ7B≤W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá≤ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆC¢ÊWrFFRÇí¬WFFVEˆC¢ÊWrFFRÇí“ê¢ÊWÇ&ñB"¬∆ñ6Fñˆ‰ñBê¢ÊWÇ'W6W%ˆñB"¬W6W$ñBì∞†¢ñbÜW'&˜"í∞¢Fá&˜rÊWrW'&˜"ÜW'&˜"Ê÷W76vRì∞¢–†¢&W2Êß6ˆ‚á≤7V66W73¢G'VR“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6ˆ◊∆WFñÊrffñ∆ñFRˆÊ&ˆ&FñÊs¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ6ˆ◊∆WFRˆÊ&ˆ&FñÊr"“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆíˆ6ˆÚˆffñ∆ñFR÷∆ñ6FñˆÁ2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7FGW2“GóVˆb&WÁVW'ìÚÁ7FGW2””“'7G&ñÊr"Ú&WÁVW'íÁ7FGW2¢VÊFVfñÊVC∞¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íá≤7FGW2“ì∞¢&W2Êß6ˆ‚Ü∆ñ6FñˆÁ2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrffñ∆ñFR∆ñ6FñˆÁ3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Çffñ∆ñFR∆ñ6FñˆÁ2"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚˆffñ∆ñFR÷∆ñ6FñˆÁ2Û¶ñBˆ&˜fR"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&WfñWvW$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢7FGW3¢&&˜fVB"¿¢&WfñWvVEˆ'ì¢&WfñWvW$ñB¿¢&WfñWvVEˆC¢ÊWrFFRÇí¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW¢¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&WfñWvVEˆC¢ÁV∆¬¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&WfñWvVEˆ'ì¢ÁV∆¬¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&V¶V7FñˆÂ˜&V6ˆ„¢ÁV∆¬¿¢Fˆ7V÷VÁG5˜7FGW3¢î‰ïDî≈ÙTuÙDÙ5T‘TÂEı5DEU4U2¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"«¬FFí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ffñ∆ñFR∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢vóB6fU6VÊEW6ÇÄ¢FFÁW6W%ˆñB¿¢∞¢FóF∆S¢$Tu∆ñ6Fñˆ‚&˜fVB"¿¢&ˆGì¢%ñ˜W"∆ñ6Fñˆ‚v2&˜fVB‚˜V‚&W7ˆÁ6RñÁFVw&óGíFÚ6ˆ◊∆WFRFÜRTuw&VV÷VÁG2‚"¿¢W&√¢"ˆffñ∆ñFRˆvFWví"¿¢Fs¢ffñ∆ñFR÷∆ñ6Fñˆ‚÷&˜fVB“G∂FFÊñG÷¿¢“¿¢&ffñ∆ñFR∆ñ6Fñˆ‚&˜fVB"¿¢ì∞†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&˜fñÊrffñ∆ñFR∆ñ6Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&˜fRffñ∆ñFR∆ñ6Fñˆ‚"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚˆffñ∆ñFR÷∆ñ6FñˆÁ2Û¶ñB˜&V¶V7B"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&WfñWvW$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B&V6ˆ‚“7G&ñÊrá&WÊ&ˆGìÚÁ&V6ˆ‚«¬""íÁG&ñ“Çì∞†¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢7FGW3¢'&V¶V7FVB"¿¢&WfñWvVEˆ'ì¢&WfñWvW$ñB¿¢&WfñWvVEˆC¢ÊWrFFRÇí¿¢&V¶V7FñˆÂ˜&V6ˆ„¢&V6ˆ‚¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"«¬FFí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ffñ∆ñFR∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢vóB6fU6VÊEW6ÇÄ¢FFÁW6W%ˆñB¿¢∞¢FóF∆S¢$Tu∆ñ6Fñˆ‚WFFR"¿¢&ˆGì¢&V6ˆ‚«¬%ñ˜W"Tu∆ñ6Fñˆ‚v2&WfñWvVBÊBv2Ê˜B66WFVB‚"¿¢W&√¢"ˆffñ∆ñFRˆvFWví"¿¢Fs¢ffñ∆ñFR÷∆ñ6Fñˆ‚◊&V¶V7FVB“G∂FFÊñG÷¿¢“¿¢&ffñ∆ñFR∆ñ6Fñˆ‚&V¶V7FVB"¿¢ì∞†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&V¶V7FñÊrffñ∆ñFR∆ñ6Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&V¶V7Bffñ∆ñFR∆ñ6Fñˆ‚"“ì∞¢–¢–¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚˆffñ∆ñFR÷∆ñ6FñˆÁ2Û¶ñBˆFˆ7V÷VÁBÛ¶Fˆ57FW˜&WfñWr"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7BFˆ57FW“ÁV÷&W"á&WÁ&◊2ÊFˆ57FWì∞¢6ˆÁ7B&WfñWvW$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B&˜fVB“&ˆˆ∆V‚á&WÊ&ˆGìÚÊ&˜fVBì∞¢6ˆÁ7B&V¶V7FñˆÂ&V6ˆ‚“7G&ñÊrá&WÊ&ˆGìÚÁ&V¶V7FñˆÂ&V6ˆ‚«¬""íÁG&ñ“Çì∞†¢ñbÜFˆ57FW”“Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ˆÊ«í&W7ˆÁ6RñÁFVw&óGí‘Tu”R&WVó&W24ÙÚW∆ˆB&WfñWr‚"“ì∞¢–¢ñbáGóVˆb&WÊ&ˆGìÚÊ&˜fVB”“&&ˆˆ∆V‚"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$÷ó76ñÊr&˜f¬FV6ó6ñˆ‚"“ì∞¢–†¢6ˆÁ7B∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íÇì∞¢6ˆÁ7B∆ñ6Fñˆ‚“∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“ñBì∞¢ñbÇ∆ñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ffñ∆ñFR∆ñ6Fñˆ‚Ê˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BFˆ7V÷VÁG57FGW2“'Vñ∆DVwˆÊ&ˆ&FñÊu7FGW6W2Ü∆ñ6Fñˆ‚ÊFˆ7V÷VÁG57FGW2«¬∆ñ6Fñˆ‚ÊFˆ7V÷VÁG5˜7FGW2ì∞¢ñbÖ7G&ñÊrÜFˆ7V÷VÁG57FGW5≤#R%“«¬&Ê˜E˜7F'FVB"í”“'VÊFñÊu˜&WfñWr"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%&W7ˆÁ6RñÁFVw&óGí‘Tu”Ró2Ê˜B7W'&VÁF«íVÊFñÊr4ÙÚ&WfñWr‚"“ì∞¢–†¢Fˆ7V÷VÁG57FGW5≤#R%““&˜fVBÚ&&˜fVB"¢'&V¶V7FVB#∞¢6ˆÁ7B∆ƒ&˜fVB“≤#"¬#""¬#2"¬#B"¬#R%“ÊWfW'íÇá7FWí”‚7G&ñÊrÜFˆ7V÷VÁG57FGW5∑7FW“«¬""í””“&&˜fVB"ì∞†¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆ∆ñ6FñˆÁ2"ê¢ÁWFFRá∞¢Fˆ7V÷VÁG5˜7FGW3¢Fˆ7V÷VÁG57FGW2¿¢Fˆ7V÷VÁE˜7V&÷ó76ñˆÂ˜7FW¢&˜fVBÚR¢R¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&WfñWvVEˆC¢ÊWrFFRÇí¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&WfñWvVEˆ'ì¢&WfñWvW$ñB¿¢Fˆ5ÛU˜7V&÷ó76ñˆÂ˜&V¶V7FñˆÂ˜&V6ˆ„¢&˜fVBÚÁV∆¬¢&V¶V7FñˆÂ&V6ˆ‚«¬$6W'FñfñVBîB6˜í&V¶V7FVB‚∆V6RW∆ˆB6˜'&V7FVB6W'FñfñVB6˜í‚"¿¢ˆÊ&ˆ&FñÊuˆ6ˆ◊∆WFVEˆC¢&˜fVBbb∆ƒ&˜fVBÚÊWrFFRÇí¢ÁV∆¬¿¢WFFVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"«¬FFí∞¢Fá&˜rÊWrW'&˜"ÜW'&˜#ÚÊ÷W76vR«¬$fñ∆VBFÚ&WfñWrTu6W'FñfñVBîB6˜í"ì∞¢–†¢vóB6fU6VÊEW6ÇÄ¢FFÁW6W%ˆñB¿¢∞¢FóF∆S¢&˜fVBÚ$6W'FñfñVBîB6˜í&˜fVB"¢$6W'FñfñVBîB6˜í&V¶V7FVB"¿¢&ˆGì¢&˜fV@¢Ú%ñ˜W"6W'FñfñVBîB6˜ív2&˜fVB‚ñ˜W"TuˆÊ&ˆ&FñÊró2Ê˜r6ˆ◊∆WFR‚ ¢¢%ñ˜W"6W'FñfñVBîB6˜ív2&V¶V7FVB‚˜V‚FÜRvFWvíFÚ&WfñWrFÜR&V6ˆ‚ÊBW∆ˆBvñ‚‚"¿¢W&√¢"ˆffñ∆ñFRˆvFWví"¿¢Fs¢ffñ∆ñFR÷Fˆ7V÷VÁB◊&WfñWr“G∂ñG“”R“G∂&˜fVBÚ&&˜fVB"¢'&V¶V7FVB'÷¿¢“¿¢&ffñ∆ñFRFˆ7V÷VÁB&WfñWr&W7V«B"¿¢ì∞†¢6ˆÁ7B&Vg&W6ÜVD∆ñ6FñˆÁ2“vóBvWDffñ∆ñFT∆ñ6FñˆÁ4'ïVW'íÇì∞¢6ˆÁ7B&Vg&W6ÜVD∆ñ6Fñˆ‚“&Vg&W6ÜVD∆ñ6FñˆÁ2ÊfñÊBÇÜVÁG'ì¢Áíí”‚VÁG'íÊñB””“ñBí«¬FF∞†¢&W2Êß6ˆ‚á∞¢7V66W73¢G'VR¿¢∆ñ6Fñˆ„¢&Vg&W6ÜVD∆ñ6Fñˆ‚¿¢÷W76vS¢&˜fV@¢Ú$6W'FñfñVBîB6˜í&˜fVB‚FÜRTuˆÊ&ˆ&FñÊrf∆˜ró26ˆ◊∆WFR‚ ¢¢$6W'FñfñVBîB6˜í&V¶V7FVB‚FÜRTu◊W7BW∆ˆB6˜'&V7FVB6W'FñfñVB6˜í‚"¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&WfñWvñÊrffñ∆ñFRˆÊ&ˆ&FñÊrFˆ7V÷VÁC¢"¬W'&˜"ì∞¢ñbÄ¢W'&˜"ñÁ7FÊ6VˆbW'&˜"b`¢ÚáVÊFñÊr&WfñWw«&WVó&VG∆&˜f¬FV6ó6ñˆ‚íˆíÁFW7BÜW'&˜"Ê÷W76vRê¢í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"Ê÷W76vR“ì∞¢–¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ&WfñWr6W'FñfñVBîB6˜í"“ì∞¢–¢–¢ì∞†¢ÚÚ”””””””””””””””””””””””””””””””””””””””–¢ÚÚÖ"$ıUDU0¢ÚÚ”””””””””””””””””””””””””””””””””””””””–†¢ÚÚvWBÖ"F6Ü&ˆ&B7FG0¢ÊvWBÄ¢"ˆíˆá"˜7FG2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢ÚÚvWB∆¬GWF˜"∆ñ6FñˆÁ0¢6ˆÁ7B∆ƒ∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ2Çì∞¢ ¢ÚÚvWBVÊFñÊrGWF˜"∆ñ6FñˆÁ2g&ˆ“GWF˜%ˆ∆ñ6FñˆÁ2F&∆P¢6ˆÁ7BVÊFñÊt∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ4'ï7FGW2Ç'VÊFñÊr"ì∞¢ ¢ÚÚvWB&˜fVBGWF˜'2Üg&ˆ“GWF˜%ˆ∆ñ6FñˆÁ2F&∆Rê¢6ˆÁ7B&˜fVD∆ñ6FñˆÁ2“vóB7F˜&vRÊvWEGWF˜$∆ñ6FñˆÁ4'ï7FGW2Ç&&˜fVB"ì∞†¢ÚÚvWBGWF˜'2vÜÚ&R&˜fVB'WBÊ˜BñWB76ñvÊVBFÚˆ@¢∆WBfñ∆&∆Tf˜%ˆG2“∞¢G'í∞¢ÚÚvWB∆¬GWF˜"76ñvÊ÷VÁG0¢6ˆÁ7B≤FF¢76ñvÊ÷VÁG2““vóB7W&6P¢Êg&ˆ“Ç'GWF˜%ˆ76ñvÊ÷VÁG2"ê¢Á6V∆V7BÇ'GWF˜%ˆñB"ì∞¢ ¢6ˆÁ7B76ñvÊVEGWF˜$ñG2“ÊWr6WBÜ76ñvÊ÷VÁG3ÚÊ÷Ü”‚ÁGWF˜%ˆñBí«¬µ“ì∞¢ ¢ÚÚ6˜VÁB&˜fVBGWF˜'2vÜÚ&RÊ˜Bñ‚FÜR76ñvÊ÷VÁG2∆ó7@¢fñ∆&∆Tf˜%ˆG2“&˜fVD∆ñ6FñˆÁ2Êfñ«FW"Ä¢”‚76ñvÊVEGWF˜$ñG2ÊÜ2ÜÁW6W$ñBê¢íÊ∆VÊwFÉ∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÁv&‚Ç$6˜V∆BÊ˜BfWF6ÇGWF˜"76ñvÊ÷VÁG3¢"¬Rì∞¢fñ∆&∆Tf˜%ˆG2“&˜fVD∆ñ6FñˆÁ2Ê∆VÊwFÉ≤ÚÚf∆∆&6≤FÚ∆¬&˜fV@¢–†¢ÚÚvWB7GVFVÁBVÁ&ˆ∆∆÷VÁG2“F˜F¬ÊBFÜó2÷ˆÁFÄ¢∆WBF˜FƒVÁ&ˆ∆∆÷VÁG2“∞¢∆WB7GVFVÁDVÁ&ˆ∆∆÷VÁG2“∞¢G'í∞¢6ˆÁ7B7W'&VÁD÷ˆÁFÇ“ÊWrFFRÇì∞¢6ˆÁ7Bfó'7DFí“ÊWrFFRÜ7W'&VÁD÷ˆÁFÇÊvWDgV∆≈ñV"Çí¬7W'&VÁD÷ˆÁFÇÊvWD÷ˆÁFÇÇí¬ì∞†¢∆WB≤FF¢G&ffñ4VÁ&ˆ∆∆÷VÁG2¬W'&˜#¢VÁ&ˆ∆ƒW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬7&VFVEˆB¬76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬¬&VÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆgV∆≈ˆÊ÷R¬ó5˜6ÊF&˜Öˆ66˜VÁB¬7W'&VÁE˜7FW"ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜVÁ&ˆ∆ƒW'&˜"í∞¢6ˆÁ7B÷W76vR“7G&ñÊrÇÜVÁ&ˆ∆ƒW'&˜"2ÁíìÚÊ÷W76vR«¬""íÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7B÷ó76ñÊt˜FñˆÊƒ6ˆ«V÷‚–¢÷W76vRÊñÊ6«VFW2Ç&ó5˜6ÊF&˜Öˆ66˜VÁB"í«¬÷W76vRÊñÊ6«VFW2Ç&7W'&VÁE˜7FW"ì∞†¢ñbÜ÷ó76ñÊt˜FñˆÊƒ6ˆ«V÷‚í∞¢6ˆÁ7Bf∆∆&6≤“vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬7&VFVEˆB¬76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬¬&VÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆgV∆≈ˆÊ÷R"ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢G&ffñ4VÁ&ˆ∆∆÷VÁG2“f∆∆&6≤ÊFF2Áì∞¢VÁ&ˆ∆ƒW'&˜"“f∆∆&6≤ÊW'&˜"2Áì∞¢–¢–†¢ñbÜVÁ&ˆ∆ƒW'&˜"í∞¢6ˆÁ6ˆ∆RÁv&‚Ç$W'&˜"fWF6ÜñÊrG&ffñ2VÁ&ˆ∆∆÷VÁG3¢"¬VÁ&ˆ∆ƒW'&˜"ì∞¢“V«6R∞¢6ˆÁ7B∆ófUG&ffñ4VÁ&ˆ∆∆÷VÁG2“áG&ffñ4VÁ&ˆ∆∆÷VÁG2«¬µ“íÊfñ«FW"ÇÜVÁ&ˆ∆∆÷VÁC¢Áíí”‡¢ó5G&ffñ5fó6ñ&∆TVÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBê¢ì∞†¢F˜FƒVÁ&ˆ∆∆÷VÁG2“∆ófUG&ffñ4VÁ&ˆ∆∆÷VÁG2Ê∆VÊwFÉ∞¢7GVFVÁDVÁ&ˆ∆∆÷VÁG2“∆ófUG&ffñ4VÁ&ˆ∆∆÷VÁG2Êfñ«FW"ÇÜVÁ&ˆ∆∆÷VÁC¢Áíí”‚∞¢6ˆÁ7B7&VFVDB“VÁ&ˆ∆∆÷VÁCÚÊ7&VFVEˆBÚÊWrFFRÜVÁ&ˆ∆∆÷VÁBÊ7&VFVEˆBí¢ÁV∆√∞¢&WGW&‚7&VFVDBñÁ7FÊ6VˆbFFRbbÁV÷&W"Êó4Ê‚Ü7&VFVDBÊvWEFñ÷RÇííbb7&VFVDB„“fó'7DFì∞¢“íÊ∆VÊwFÉ∞¢–¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÁv&‚Ç$6˜V∆BÊ˜BfWF6Ç&VÁBVÁ&ˆ∆∆÷VÁG3¢"¬Rì∞¢ÚÚ6ˆÁFñÁVRvóFÇVÁ&ˆ∆∆÷VÁG2ñbF&∆RFˆW6‚wBWÜó7@¢–†¢ÚÚvWBV˜∆R6˜VÁBg&ˆ“&Vvó7G'ê¢∆WBV˜∆T6˜VÁB“∞¢G'í∞¢6ˆÁ7B≤6˜VÁC¢6˜VÁB““vóB7W&6P¢Êg&ˆ“Ç'V˜∆U˜&Vvó7G'í"ê¢Á6V∆V7BÇ"¢"¬≤6˜VÁC¢&WÜ7B"¬ÜVC¢G'VR“ê¢ÊWÇ'7FGW2"¬&7FófR"ì∞¢V˜∆T6˜VÁB“6˜VÁB«¬∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÁv&‚Ç$6˜V∆BÊ˜BfWF6ÇV˜∆R6˜VÁC¢"¬Rì∞¢–†¢ÚÚvWB˜V‚Fó7WFW26˜VÁ@¢∆WB˜V‰Fó7WFW2“∞¢G'í∞¢6ˆÁ7B≤6˜VÁC¢D6˜VÁB““vóB7W&6P¢Êg&ˆ“Ç&Fó7WFW2"ê¢Á6V∆V7BÇ"¢"¬≤6˜VÁC¢&WÜ7B"¬ÜVC¢G'VR“ê¢Êñ‚Ç'7FGW2"¬≤&˜V‚"¬'VÊFW%˜&WfñWr"¬&W66∆FVB%“ì∞¢˜V‰Fó7WFW2“D6˜VÁB«¬∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÁv&‚Ç$6˜V∆BÊ˜BfWF6ÇFó7WFW26˜VÁC¢"¬Rì∞¢–†¢&W2Êß6ˆ‚á∞¢F˜Fƒ∆ñ6FñˆÁ3¢∆ƒ∆ñ6FñˆÁ2Ê∆VÊwFÇ¿¢VÊFñÊt∆ñ6FñˆÁ3¢VÊFñÊt∆ñ6FñˆÁ2Ê∆VÊwFÇ¿¢&˜fVEGWF˜'3¢&˜fVD∆ñ6FñˆÁ2Ê∆VÊwFÇ¿¢fñ∆&∆Tf˜%ˆG2¿¢F˜FƒVÁ&ˆ∆∆÷VÁG2¿¢7GVFVÁDVÁ&ˆ∆∆÷VÁG2¿¢V˜∆T6˜VÁB¿¢˜V‰Fó7WFW2¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrÖ"7FG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤ ¢F˜Fƒ∆ñ6FñˆÁ3¢¿¢VÊFñÊt∆ñ6FñˆÁ3¢¿¢&˜fVEGWF˜'3¢¿¢fñ∆&∆Tf˜%ˆG3¢¿¢F˜FƒVÁ&ˆ∆∆÷VÁG3¢¿¢7GVFVÁDVÁ&ˆ∆∆÷VÁG3¢¿¢V˜∆T6˜VÁC¢¿¢˜V‰Fó7WFW3¢¿¢W'&˜#¢$fñ∆VBFÚfWF6Ç7FG2" ¢“ì∞¢–¢–¢ì∞†¢ÚÚvWB∆¬&VÁBVÁ&ˆ∆∆÷VÁG2f˜"4ÙÚG&ffñ2vP¢ÊvWBÄ¢"ˆíˆá"ˆVÁ&ˆ∆∆÷VÁG2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢ÚÚG'ígV∆¬&ˆ¶V7Fñˆ‚fó'7C≤f∆¬&6≤ñb6ˆ÷R˜FñˆÊ¬6ˆ«V÷Á2&RÊ˜B&W6VÁBñ‚ˆ∆FW"D'2‡¢∆WB≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬W6W%ˆñB¬&VÁEˆgV∆≈ˆÊ÷R¬&VÁE˜ÜˆÊR¬&VÁEˆV÷ñ¬¬&VÁEˆ6óGí¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬66Üˆˆ≈ˆÊ÷R¬&W7ˆÁ6U˜7ñ◊Fˆ◊2¬F˜ñ5˜&W7ˆÁ6U˜7ñ◊Fˆ◊2¬&W7ˆÁ6U˜6ñvÊ≈˜66˜&W2¬F˜ñ5˜&W7ˆÁ6U˜6ñvÊ≈˜66˜&W2¬&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6R¬F˜ñ5˜&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6W2¬&Wfñ˜W5˜GWF˜&ñÊr¬ñÁFW&ÊWEˆ66W72¬&VÁEˆ÷˜FófFñˆ‚¬7FGW2¬7W'&VÁE˜7FW¬76ñvÊVE˜GWF˜%ˆñB¬76ñvÊVE˜7GVFVÁEˆñB¬7&VFVEˆB¬WFFVEˆB"ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ7B÷W76vR“7G&ñÊrÇÜW'&˜"2ÁíìÚÊ÷W76vR«¬""íÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7B÷ó76ñÊt˜FñˆÊƒ6ˆ«V÷‚–¢÷W76vRÊñÊ6«VFW2Ç&76ñvÊVE˜7GVFVÁEˆñB"í«¿¢÷W76vRÊñÊ6«VFW2Ç&7W'&VÁE˜7FW"í«¿¢÷W76vRÊñÊ6«VFW2Ç'&W7ˆÁ6U˜7ñ◊Fˆ◊2"í«¿¢÷W76vRÊñÊ6«VFW2Ç'F˜ñ5˜&W7ˆÁ6U˜7ñ◊Fˆ◊2"í«¿¢÷W76vRÊñÊ6«VFW2Ç'&W7ˆÁ6U˜6ñvÊ≈˜66˜&W2"í«¿¢÷W76vRÊñÊ6«VFW2Ç'F˜ñ5˜&W7ˆÁ6U˜6ñvÊ≈˜66˜&W2"í«¿¢÷W76vRÊñÊ6«VFW2Ç'&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6R"í«¿¢÷W76vRÊñÊ6«VFW2Ç'F˜ñ5˜&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6W2"ì∞†¢ñbÜ÷ó76ñÊt˜FñˆÊƒ6ˆ«V÷‚í∞¢6ˆÁ7Bf∆∆&6≤“vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬W6W%ˆñB¬&VÁEˆgV∆≈ˆÊ÷R¬&VÁE˜ÜˆÊR¬&VÁEˆV÷ñ¬¬&VÁEˆ6óGí¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬66Üˆˆ≈ˆÊ÷R¬&Wfñ˜W5˜GWF˜&ñÊr¬ñÁFW&ÊWEˆ66W72¬&VÁEˆ÷˜FófFñˆ‚¬7FGW2¬76ñvÊVE˜GWF˜%ˆñB¬7&VFVEˆB¬WFFVEˆB"ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢FF“f∆∆&6≤ÊFF2Áì∞¢W'&˜"“f∆∆&6≤ÊW'&˜"2Áì∞¢–¢–†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6V∆V7FñÊr&VÁEˆVÁ&ˆ∆∆÷VÁG3¢"¬W'&˜"Ê÷W76vRì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚Öµ“ì∞¢–†¢FF“ÜFF«¬µ“íÊfñ«FW"ÇÜVÁ&ˆ∆∆÷VÁC¢Áíí”‚ó5G&ffñ5fó6ñ&∆TVÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBíì∞†¢6ˆÁ7BGWF˜$ñG2“'&íÊg&ˆ“Ä¢ÊWr6WBÄ¢ÜFF«¬µ“ê¢Ê÷ÇÜS¢Áíí”‚RÊ76ñvÊVE˜GWF˜%ˆñBê¢Êfñ«FW"ÇÜñC¢Áíí”‚ñBê¢ê¢ì∞†¢∆WBGWF˜$÷“ÊWr÷«7G&ñÊr¬≤Ê÷S¢7G&ñÊr¬ÁV∆√≤V÷ñ√¢7G&ñÊr¬ÁV∆¬”‚Çì∞¢∆WB76ñvÊ÷VÁD÷“ÊWr÷«7G&ñÊr¬≤ˆDñC¢7G&ñÊr¬ÁV∆¬”‚Çì∞¢∆WBˆD÷“ÊWr÷«7G&ñÊr¬≤ˆDÊ÷S¢7G&ñÊr¬ÁV∆√≤7FGW3¢7G&ñÊr¬ÁV∆¬”‚Çì∞†¢ñbáGWF˜$ñG2Ê∆VÊwFÇ‚í∞¢6ˆÁ7B≤FF¢GWF˜'4FF““vóB7W&6P¢Êg&ˆ“Ç'W6W'2"ê¢Á6V∆V7BÇ&ñB¬Ê÷R¬V÷ñ¬"ê¢Êñ‚Ç&ñB"¬GWF˜$ñG2ì∞†¢GWF˜$÷“ÊWr÷Ä¢áGWF˜'4FF«¬µ“íÊ÷ÇáC¢Áíí”‚∞¢BÊñB¿¢∞¢Ê÷S¢BÊÊ÷R«¬ÁV∆¬¿¢V÷ñ√¢BÊV÷ñ¬«¬ÁV∆¬¿¢“¿¢“ê¢ì∞†¢6ˆÁ7B≤FF¢GWF˜$76ñvÊ÷VÁG4FF““vóB7W&6P¢Êg&ˆ“Ç'GWF˜%ˆ76ñvÊ÷VÁG2"ê¢Á6V∆V7BÇ'GWF˜%ˆñB¬ˆEˆñB"ê¢Êñ‚Ç'GWF˜%ˆñB"¬GWF˜$ñG2ì∞†¢76ñvÊ÷VÁD÷“ÊWr÷Ä¢áGWF˜$76ñvÊ÷VÁG4FF«¬µ“íÊ÷ÇÜ¢Áíí”‚∞¢ÁGWF˜%ˆñB¿¢∞¢ˆDñC¢ÁˆEˆñB«¬ÁV∆¬¿¢“¿¢“ê¢ì∞†¢6ˆÁ7BˆDñG2“'&íÊg&ˆ“Ä¢ÊWr6WBÄ¢áGWF˜$76ñvÊ÷VÁG4FF«¬µ“ê¢Ê÷ÇÜ¢Áíí”‚ÁˆEˆñBê¢Êfñ«FW"ÇÜñC¢Áíí”‚ñBê¢ê¢ì∞†¢ñbáˆDñG2Ê∆VÊwFÇ‚í∞¢6ˆÁ7B≤FF¢ˆG4FF““vóB7W&6P¢Êg&ˆ“Ç'ˆG2"ê¢Á6V∆V7BÇ&ñB¬ˆEˆÊ÷R¬7FGW2"ê¢Êñ‚Ç&ñB"¬ˆDñG2ì∞†¢ˆD÷“ÊWr÷Ä¢áˆG4FF«¬µ“íÊ÷Çá¢Áíí”‚∞¢ÊñB¿¢∞¢ˆDÊ÷S¢ÁˆEˆÊ÷R«¬ÁV∆¬¿¢7FGW3¢Á7FGW2«¬ÁV∆¬¿¢“¿¢“ê¢ì∞¢–¢–†¢ÚÚÊ˜&÷∆ó¶RÊB&WGW&‡¢6ˆÁ7BG&Á6f˜&÷VB“ÜFF«¬µ“íÊ÷ÇÜS¢Áíí”‚∞¢6ˆÁ7BGWF˜"“RÊ76ñvÊVE˜GWF˜%ˆñBÚGWF˜$÷ÊvWBÜRÊ76ñvÊVE˜GWF˜%ˆñBí¢ÁV∆√∞¢6ˆÁ7B76ñvÊ÷VÁB“RÊ76ñvÊVE˜GWF˜%ˆñBÚ76ñvÊ÷VÁD÷ÊvWBÜRÊ76ñvÊVE˜GWF˜%ˆñBí¢ÁV∆√∞¢6ˆÁ7BˆB“76ñvÊ÷VÁCÚÁˆDñBÚˆD÷ÊvWBÜ76ñvÊ÷VÁBÁˆDñBí¢ÁV∆√∞†¢&WGW&‚∞¢‚‚ÊR¿¢&VÁDñÊfÛ¢'Vñ∆DñÁF∂U6ñvÊ«2ÜRí¿¢76ñvÊVE˜GWF˜%ˆÊ÷S¢GWF˜#ÚÊÊ÷R«¬ÁV∆¬¿¢76ñvÊVE˜GWF˜%ˆV÷ñ√¢GWF˜#ÚÊV÷ñ¬«¬ÁV∆¬¿¢76ñvÊVE˜ˆEˆñC¢76ñvÊ÷VÁCÚÁˆDñB«¬ÁV∆¬¿¢76ñvÊVE˜ˆEˆÊ÷S¢ˆCÚÁˆDÊ÷R«¬ÁV∆¬¿¢7FófUˆñÂ˜ˆC¢ÜRÊ76ñvÊVE˜GWF˜%ˆñBbb76ñvÊ÷VÁCÚÁˆDñBbbˆCÚÁ7FGW2””“&7FófR"í¿¢7FGW4∆&V√¢RÁ7FGW2””“&vóFñÊuˆ76ñvÊ÷VÁB"Ú$vóFñÊr76ñvÊ÷VÁB"¢ ¢RÁ7FGW2””“&76ñvÊVB"Ú$76ñvÊVB"†¢RÁ7FGW2””“&vóFñÊu˜GWF˜%ˆ66WFÊ6R"Ú$vóFñÊrGWF˜"66WFÊ6R"†¢RÁ7FGW2””“&6ˆÊfó&÷VB"Ú$6ˆÊfó&÷VB"†¢RÁ7FGW0¢”∞¢“ì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÜˆíˆá"ˆVÁ&ˆ∆∆÷VÁG2&WGW&ÊVBG∑G&Á6f˜&÷VBÊ∆VÊwFá“∆ófR&˜w6ì∞¢&W2Êß6ˆ‚áG&Á6f˜&÷VBì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚ˆíˆá"ˆVÁ&ˆ∆∆÷VÁG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚Öµ“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆí˜GWF˜"ˆFWfV∆˜÷VÁB◊Fáví"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'GWF˜"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BGWF˜$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7BFáví“vóBvWE7V6ñ∆ó7DFWfV∆˜÷VÁEFávíáGWF˜$ñBì∞¢&W2Êß6ˆ‚á≤Fáví“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"∆ˆFñÊr7V6ñ∆ó7BFWfV∆˜÷VÁBFávì¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ∆ˆB7V6ñ∆ó7BFWfV∆˜÷VÁBFáví"“ì∞¢–¢“¿¢ì∞†¢ÊvWBÄ¢"ˆí˜FB˜GWF˜'2ÛßGWF˜$ñB˜6ÊF&˜Ç◊&VFñÊW72"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'FB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BFDñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7BGWF˜$ñB“7G&ñÊrá&WÁ&◊2ÁGWF˜$ñB«¬""íÁG&ñ“Çì∞¢6ˆÁ7BGWF˜$ñG2“vóBvWEDD66W76ñ&∆UGWF˜$ñG2áFDñBì∞¢ñbÇGWF˜$ñG2ÊÜ2áGWF˜$ñBíí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢%VÊWFÜ˜&ó¶VBGWF˜"66W72"“ì∞¢–¢&W2Êß6ˆ‚ÜvóBvWEGWF˜%6ÊF&˜Ö&VFñÊW72áGWF˜$ñBíì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"∆ˆFñÊrDB6ÊF&˜Ç&VFñÊW73¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á∞¢÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ∆ˆB6ÊF&˜Ç&VFñÊW72"¿¢“ì∞¢–¢“¿¢ì∞†¢Á˜7BÄ¢"ˆí˜FB˜GWF˜'2ÛßGWF˜$ñB˜6ÊF&˜Ç◊&VFñÊW72÷76W76÷VÁB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'FB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BFDñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7BGWF˜$ñB“7G&ñÊrá&WÁ&◊2ÁGWF˜$ñB«¬""íÁG&ñ“Çì∞¢6ˆÁ7BGWF˜$ñG2“vóBvWEDD66W76ñ&∆UGWF˜$ñG2áFDñBì∞¢ñbÇGWF˜$ñG2ÊÜ2áGWF˜$ñBíí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢%VÊWFÜ˜&ó¶VBGWF˜"66W72"“ì∞¢–†¢6ˆÁ7B&Vf˜&R“vóBvWEGWF˜%6ÊF&˜Ö&VFñÊW72áGWF˜$ñBì∞¢ñbÜ&Vf˜&RÊ÷ˆFR”“'6ÊF&˜Ç"í∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS¢6ÊF&˜Ç&VFñÊW726‚&R76W76VBˆÊ«íñ‚6ÊF&˜Ç‚7W'&VÁB∆ñfV7ñ6∆S¢G∂&Vf˜&RÊ÷ˆFW“Ê¿¢“ì∞¢–¢ñbÇ&Vf˜&RÁFávìÚÁFñ÷V∆ñÊSÚÊ6‰6ˆÁFñÁVRí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS†¢&Vf˜&RÁFávìÚÁFñ÷V∆ñÊSÚÁ7FFR””“&WáFVÁ6ñˆÂ˜&WVó&VB ¢Ú%FÜRsR÷FíFávívñÊF˜rÜ2VÊFVB‚4ÙÚ&˜f¬ó2&WVó&VBf˜"Fˆ7V÷VÁFVBWáFVÁ6ñˆ‚&Vf˜&R&VFñÊW726‚&R6ñvÊVBˆfb‚ ¢¢%FÜR7V6ñ∆ó7BFWfV∆˜÷VÁBFávíó2÷ó76ñÊr˜"Ü2Wáó&VB‚"¿¢“ì∞¢–†¢6ˆÁ7BFV6ó6ñˆ‚“7G&ñÊrá&WÊ&ˆGìÚÊFV6ó6ñˆ‚«¬""íÁG&ñ“Çì∞¢ñbÇÖ≤'76VB"¬'&V÷VFñFñˆÂ˜&WVó&VB%“27G&ñÊuµ“íÊñÊ6«VFW2ÜFV6ó6ñˆ‚íí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$6Üˆ˜6R&VGíf˜"&7Fñ6«2˜"&V÷VFñFñˆ‚&WVó&VB‚"“ì∞¢–†¢ñbÄ¢FV6ó6ñˆ‚””“'76VB"b`¢Ä¢&Vf˜&RÊvFRÁ&W&Fñˆ‰&∆ˆ6∂W'2Ê∆VÊwFÇ‚«¿¢&Vf˜&RÊ6&ñ∆óGï&VFñÊW72Á&7Fñ6«5&VGí”“G'VP¢ê¢í∞¢6ˆÁ7B&∆ˆ6∂W'2“∞¢‚‚Ê&Vf˜&RÊvFRÁ&W&Fñˆ‰&∆ˆ6∂W'2¿¢‚‚‚Ü&Vf˜&RÊ6&ñ∆óGï&VFñÊW72Á&7Fñ6«5&VGê¢Úµ–¢¢∂&Vf˜&RÊ6&ñ∆óGï&VFñÊW72Á&V6ˆÂ“í¿¢”∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢&∆ˆ6∂W'2Ê¶ˆñ‚Ç""í“ì∞¢–†¢vóB&V6˜&E6ÊF&˜Ö&VFñÊW7476W76÷VÁBá∞¢GWF˜$ñB¿¢GWF˜$76ñvÊ÷VÁDñC¢&Vf˜&RÁGWF˜$76ñvÊ÷VÁDñB¿¢FV6ó6ñˆ„¢FV6ó6ñˆ‚2'76VB"¬'&V÷VFñFñˆÂ˜&WVó&VB"¿¢WfñFVÊ6TÊ˜FS¢7G&ñÊrá&WÊ&ˆGìÚÊWfñFVÊ6TÊ˜FR«¬""í¿¢76W76VD'ïW6W$ñC¢FDñB¿¢6&ñ∆óGï6Ê6Ü˜C¢&Vf˜&RÊ6&ñ∆óGï&VFñÊW722&V6˜&C«7G&ñÊr¬VÊ∂Ê˜v„‚¿¢“ì∞†¢&W2Êß6ˆ‚ÜvóBvWEGWF˜%6ÊF&˜Ö&VFñÊW72áGWF˜$ñBíì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&V6˜&FñÊrDB6ÊF&˜Ç&VFñÊW7276W76÷VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS†¢W'&˜"ñÁ7FÊ6VˆbW'&˜ ¢ÚW'&˜"Ê÷W76vP¢¢$fñ∆VBFÚ&V6˜&B6ÊF&˜Ç&VFñÊW7276W76÷VÁB"¿¢“ì∞¢–¢“¿¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜GWF˜'2ÛßGWF˜$ñB˜Fáví÷WáFVÁ6ñˆ‚"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BFáví“vóB&˜fU7V6ñ∆ó7EFávîWáFVÁ6ñˆ‚á∞¢GWF˜$ñC¢7G&ñÊrá&WÁ&◊2ÁGWF˜$ñB«¬""íÁG&ñ“Çí¿¢&˜fVD'ïW6W$ñC¢á&W2ÁííÊF%W6W"ÊñB¿¢&V6ˆ„¢7G&ñÊrá&WÊ&ˆGìÚÁ&V6ˆ‚«¬""í¿¢“ì∞¢&W2Êß6ˆ‚á≤Fáví“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"WáFVÊFñÊr7V6ñ∆ó7BFWfV∆˜÷VÁBFávì¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚWáFVÊB7V6ñ∆ó7BFáví"“ì∞¢–¢“¿¢ì∞†¢ÊvWBÄ¢"ˆí˜GWF˜"˜G&ñ¬÷66R"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'GWF˜"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BGWF˜$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢&WGW&‚&W2Êß6ˆ‚á∞¢VÊfñ∆&∆S¢G'VR¿¢&V6ˆ„¢'FV◊˜&&ñ«ï˜VÊfñ∆&∆R"¿¢÷ˆFS¢ÁV∆¬¿¢66S¢ÁV∆¬¿¢Fávì¢ÁV∆¬¿¢“ì∞¢–¢6ˆÁ7B∂÷ˆFR¬G&ñƒ66R¬Fávï““vóB&ˆ÷ó6RÊ∆¬Ö∞¢vWEGWF˜$6W'Fñfñ6Fñˆ‰÷ˆFRáGWF˜$ñBí¿¢vWD˜VÂG&ñƒ66Tf˜%GWF˜"áGWF˜$ñBí¿¢vWE7V6ñ∆ó7DFWfV∆˜÷VÁEFávíáGWF˜$ñBí¿¢“ì∞¢&W2Êß6ˆ‚á≤÷ˆFR¬66S¢G&ñƒ66R¬Fáví“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"∆ˆFñÊrGWF˜"G&ñ¬66S¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ∆ˆBG&ñ¬f∆ñFFñˆ‚&ˆw&W72"“ì∞¢–¢“¿¢ì∞†¢ÊvWBÄ¢"ˆíˆ6ˆÚ˜GWF˜'2ÛßGWF˜$ñB˜G&ñ¬÷66R"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BGWF˜$ñB“7G&ñÊrá&WÁ&◊2ÁGWF˜$ñB«¬""íÁG&ñ“Çì∞¢6ˆÁ7B∂÷ˆFR¬G&ñƒ66R¬Fávï““vóB&ˆ÷ó6RÊ∆¬Ö∞¢vWEGWF˜$6W'Fñfñ6Fñˆ‰÷ˆFRáGWF˜$ñBí¿¢vWD˜VÂG&ñƒ66Tf˜%GWF˜"áGWF˜$ñBí¿¢vWE7V6ñ∆ó7DFWfV∆˜÷VÁEFávíáGWF˜$ñBí¿¢“ì∞¢&W2Êß6ˆ‚á≤÷ˆFR¬66S¢G&ñƒ66R¬Fáví“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"∆ˆFñÊr4ÙÚGWF˜"G&ñ¬66S¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ∆ˆBG&ñ¬f∆ñFFñˆ‚&ˆw&W72"“ì∞¢–¢“¿¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜GWF˜'2ÛßGWF˜$ñB˜G&ñ¬÷66R"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BGWF˜$ñB“7G&ñÊrá&WÁ&◊2ÁGWF˜$ñB«¬""íÁG&ñ“Çì∞¢6ˆÁ7B÷ˆFR“vóBvWEGWF˜$6W'Fñfñ6Fñˆ‰÷ˆFRáGWF˜$ñBì∞¢ñbÜ÷ˆFR”“'G&ñ¬"í∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS¢G&ñ¬66R6‚˜V‚ˆÊ«ígFW"&W&Fñˆ‚ó26ˆ◊∆WFR‚7W'&VÁB∆ñfV7ñ6∆S¢G∂÷ˆFW“Ê¿¢“ì∞¢–†¢6ˆÁ7BGWF˜$76ñvÊ÷VÁB“vóB7F˜&vRÊvWEGWF˜$76ñvÊ÷VÁBáGWF˜$ñBì∞¢ñbÇGWF˜$76ñvÊ÷VÁCÚÊñBí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢%GWF˜"◊W7BÜfR‚7FófRˆB76ñvÊ÷VÁB&Vf˜&RG&ñ¬˜VÁ2"“ì∞¢–†¢6ˆÁ7BG&ñƒ66R“vóB7&VFUG&ñƒ66Rá∞¢GWF˜$ñB¿¢GWF˜$76ñvÊ÷VÁDñC¢GWF˜$76ñvÊ÷VÁBÊñB¿¢7&VFVD'ïW6W$ñC¢á&W2ÁííÊF%W6W"ÊñB¿¢“ì∞¢&W2Á7FGW2É#íÊß6ˆ‚á≤÷ˆFR¬66S¢G&ñƒ66R“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"˜VÊñÊrGWF˜"G&ñ¬66S¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ˜V‚G&ñ¬66R"“ì∞¢–¢“¿¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜G&ñ¬÷66W2Û¶66TñBˆWáFVÁ6ñˆ‚"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BG&ñƒ66R“vóBWáFVÊEG&ñƒ66Rá∞¢66TñC¢7G&ñÊrá&WÁ&◊2Ê66TñB«¬""íÁG&ñ“Çí¿¢WáFVÁ6ñˆ‰VÊG4C¢7G&ñÊrá&WÊ&ˆGìÚÊWáFVÁ6ñˆ‰VÊG4B«¬""íÁG&ñ“Çí¿¢&V6ˆ„¢7G&ñÊrá&WÊ&ˆGìÚÁ&V6ˆ‚«¬""íÁG&ñ“Çí¿¢&˜fVD'ïW6W$ñC¢á&W2ÁííÊF%W6W"ÊñB¿¢“ì∞¢&W2Êß6ˆ‚á≤66S¢G&ñƒ66R“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"WáFVÊFñÊrG&ñ¬vñÊF˜s¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚWáFVÊBG&ñ¬vñÊF˜r"“ì∞¢–¢“¿¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜G&ñ¬◊∆6V÷VÁG2Ûß∆6V÷VÁDñB˜&WfñWr"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B˜WF6ˆ÷T6∆76ñfñ6Fñˆ‚“7G&ñÊrá&WÊ&ˆGìÚÊ˜WF6ˆ÷T6∆76ñfñ6Fñˆ‚«¬""íÁG&ñ“Çì∞¢6ˆÁ7BFV6ó6ñˆ‚“7G&ñÊrá&WÊ&ˆGìÚÊFV6ó6ñˆ‚«¬""íÁG&ñ“Çì∞¢6ˆÁ7BWfñFVÊ6TÊ˜FR“7G&ñÊrá&WÊ&ˆGìÚÊWfñFVÊ6TÊ˜FR«¬""íÁG&ñ“Çì∞¢ñbÇ≤'˜6óFófR"¬&÷óÜVB"¬&ÊVvFófR%“ÊñÊ6«VFW2Ü˜WF6ˆ÷T6∆76ñfñ6Fñˆ‚íí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$f∆ñBf÷ñ«í˜WF6ˆ÷R6∆76ñfñ6Fñˆ‚ó2&WVó&VB"“ì∞¢–¢ñbÇ≤'˜6óFófR"¬'&V÷VFñFñˆÂ˜&WVó&VB"¬'VÁ7V66W76gV¬%“ÊñÊ6«VFW2ÜFV6ó6ñˆ‚íí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$f∆ñB˜W&FñˆÊ¬&WfñWrFV6ó6ñˆ‚ó2&WVó&VB"“ì∞¢–¢ñbÇWfñFVÊ6TÊ˜FRí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$‚WfñFVÊ6RÊ˜FRó2&WVó&VBf˜"FÜRf÷ñ«í˜WF6ˆ÷R&WfñWr"“ì∞¢–†¢6ˆÁ7BG&ñƒ66R“vóB&V6˜&EG&ñ≈&WfñWrá∞¢∆6V÷VÁDñC¢7G&ñÊrá&WÁ&◊2Á∆6V÷VÁDñBí¿¢˜WF6ˆ÷T6∆76ñfñ6Fñˆ„¢˜WF6ˆ÷T6∆76ñfñ6Fñˆ‚2Áí¿¢FV6ó6ñˆ„¢FV6ó6ñˆ‚2Áí¿¢WfñFVÊ6TÊ˜FR¿¢&WfñWvVD'ïW6W$ñC¢á&W2ÁííÊF%W6W"ÊñB¿¢“ì∞¢&W2Êß6ˆ‚á≤66S¢G&ñƒ66R“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&V6˜&FñÊrG&ñ¬˜WF6ˆ÷R&WfñWs¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ&V6˜&BG&ñ¬&WfñWr"“ì∞¢–¢“¿¢ì∞†¢Á˜7BÄ¢"ˆíˆ6ˆÚ˜G&ñ¬÷66W2Û¶66TñBˆFV6ó6ñˆ‚"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BFV6ó6ñˆ‚“7G&ñÊrá&WÊ&ˆGìÚÊFV6ó6ñˆ‚«¬""íÁG&ñ“Çì∞¢6ˆÁ7B&FñˆÊ∆R“7G&ñÊrá&WÊ&ˆGìÚÁ&FñˆÊ∆R«¬""íÁG&ñ“Çì∞¢6ˆÁ7BñFV◊˜FVÊ7î∂Wí“7G&ñÊrá&WÊ&ˆGìÚÊñFV◊˜FVÊ7î∂Wí«¬""íÁG&ñ“Çì∞¢ñbÇ≤&6W'FñfñVB"¬'&V÷VFñFñˆÂ˜&WVó&VB"¬'VÁ7V66W76gV¬%“ÊñÊ6«VFW2ÜFV6ó6ñˆ‚íí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$f∆ñB6W'Fñfñ6Fñˆ‚FV6ó6ñˆ‚ó2&WVó&VB"“ì∞¢–¢ñbÇ&FñˆÊ∆Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$6W'Fñfñ6Fñˆ‚&FñˆÊ∆Ró2&WVó&VB"“ì∞¢–¢ñbÇñFV◊˜FVÊ7î∂Wíí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$‚ñFV◊˜FVÊ7í∂Wíó2&WVó&VB"“ì∞¢–†¢6ˆÁ7B&W7V«B“vóBFV6ñFUG&ñƒ66Rá∞¢66TñC¢7G&ñÊrá&WÁ&◊2Ê66TñBí¿¢FV6ó6ñˆ„¢FV6ó6ñˆ‚2Áí¿¢&FñˆÊ∆R¿¢ñFV◊˜FVÊ7î∂Wí¿¢FV6ñFVD'ïW6W$ñC¢á&W2ÁííÊF%W6W"ÊñB¿¢“ì∞¢&W2Êß6ˆ‚á&W7V«Bì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"FV6ñFñÊrGWF˜"G&ñ¬66S¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚFV6ñFRG&ñ¬66R"“ì∞¢–¢“¿¢ì∞†¢ÊvWBÄ¢"ˆí˜&VÁB˜G&ñ¬÷66R"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'&VÁB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&76ñvÊ÷VÁEˆ∆ÊR"ê¢ÊWÇ'W6W%ˆñB"¬á&W2ÁííÊF%W6W"ÊñBê¢Ê˜&FW"Ç'WFFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢&WGW&‚&W2Á7FGW2É#íÊß6ˆ‚Ü'Vñ∆DV÷W&vVÊ7ï&VÁEG&ñƒ66T6ˆÁG&7Bá≤76ñvÊ÷VÁEˆ∆ÊS¢ÁV∆¬“íì∞¢–†¢&WGW&‚&W2Á7FGW2É#íÊß6ˆ‚Ü'Vñ∆DV÷W&vVÊ7ï&VÁEG&ñƒ66T6ˆÁG&7Bá≤76ñvÊ÷VÁEˆ∆ÊS¢VÁ&ˆ∆∆÷VÁCÚÊ76ñvÊ÷VÁEˆ∆ÊRÛÚÁV∆¬“íì∞¢–†¢6ˆÁ7BG&ñƒ66R“vóBvWE&VÁEG&ñƒ66RÇá&W2ÁííÊF%W6W"ÊñBì∞¢&W2Êß6ˆ‚á≤66S¢G&ñƒ66R¬VÊfñ∆&∆S¢f«6R“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"∆ˆFñÊrf÷ñ«íG&ñ¬66S¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ∆ˆBf÷ñ«íG&ñ¬&ˆw&W72"“ì∞¢–¢“¿¢ì∞†¢Á˜7BÄ¢"ˆí˜&VÁB˜G&ñ¬◊∆6V÷VÁG2Ûß∆6V÷VÁDñBˆfVVF&6≤"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'&VÁB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BfVVF&6µ7FFR“7G&ñÊrá&WÊ&ˆGìÚÊfVVF&6µ7FFR«¬""íÁG&ñ“Çì∞¢6ˆÁ7BFW7Fñ÷ˆÊñ≈W&÷ó76ñˆ‚“7G&ñÊrá&WÊ&ˆGìÚÁFW7Fñ÷ˆÊñ≈W&÷ó76ñˆ‚«¬&Ê˜E˜&WVW7FVB"íÁG&ñ“Çì∞¢ñbÇ≤'&V6VófVB"¬&FV6∆ñÊVB%“ÊñÊ6«VFW2ÜfVVF&6µ7FFRíí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$fVVF&6≤◊W7B&R7V&÷óGFVB˜"f˜&÷∆«íFV6∆ñÊVB"“ì∞¢–¢ñbÇ≤&Ê˜E˜&WVW7FVB"¬&w&ÁFVB"¬&FV6∆ñÊVB%“ÊñÊ6«VFW2áFW7Fñ÷ˆÊñ≈W&÷ó76ñˆ‚íí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ñÁf∆ñBFW7Fñ÷ˆÊñ¬W&÷ó76ñˆ‚"“ì∞¢–†¢6ˆÁ7BG&ñƒ66R“vóB&V6˜&EG&ñƒfVVF&6≤á∞¢∆6V÷VÁDñC¢7G&ñÊrá&WÁ&◊2Á∆6V÷VÁDñBí¿¢&VÁDñC¢á&W2ÁííÊF%W6W"ÊñB¿¢fVVF&6µ7FFS¢fVVF&6µ7FFR2'&V6VófVB"¬&FV6∆ñÊVB"¿¢fVVF&6¥Ê˜FS¢7G&ñÊrá&WÊ&ˆGìÚÊfVVF&6¥Ê˜FR«¬""íÁG&ñ“Çí«¬ÁV∆¬¿¢FW7Fñ÷ˆÊñ≈W&÷ó76ñˆ„¢FW7Fñ÷ˆÊñ≈W&÷ó76ñˆ‚2Áí¿¢“ì∞¢&W2Êß6ˆ‚á≤66S¢G&ñƒ66R“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&V6˜&FñÊrf÷ñ«íG&ñ¬fVVF&6≥¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ&V6˜&BG&ñ¬fVVF&6≤"“ì∞¢–¢“¿¢ì∞†¢ÚÚ76ñv‚ˆÊRˆbWÜ7F«íGvÚv˜fW&ÊVBG&ñ¬f÷ñ∆ñW2Ñ4ÙÚ÷6ˆÁG&ˆ∆∆VBí‡¢Á˜7BÄ¢"ˆíˆá"ˆVÁ&ˆ∆∆÷VÁG2Û¶VÁ&ˆ∆∆÷VÁDñBˆ76ñv‚◊G&ñ¬◊GWF˜""¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁDñB“7G&ñÊrá&WÁ&◊2ÊVÁ&ˆ∆∆÷VÁDñB«¬""íÁG&ñ“Çì∞¢6ˆÁ7BGWF˜$ñB“7G&ñÊrá&WÊ&ˆGìÚÁGWF˜$ñB«¬""íÁG&ñ“Çì∞¢∆WB7&VFVD66TñC¢7G&ñÊr¬ÁV∆¬“ÁV∆√∞¢∆WB∆6V÷VÁD7&VFVB“f«6S∞¢∆WB76ñvÊ÷VÁD6ˆ÷÷óGFVB“f«6S∞†¢G'í∞¢ñbÇGWF˜$ñBí&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%GWF˜"îBó2&WVó&VB"“ì∞†¢6ˆÁ7BGWF˜$76ñvÊ÷VÁB“vóB7F˜&vRÊvWEGWF˜$76ñvÊ÷VÁBáGWF˜$ñBì∞¢ñbÇGWF˜$76ñvÊ÷VÁBí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢%GWF˜"◊W7B&R76ñvÊVBFÚˆB&Vf˜&R&V6VófñÊrG&ñ¬f÷ñ∆ñW2"“ì∞¢–¢ñbá&WÊ&ˆGìÚÁˆDñBbbGWF˜$76ñvÊ÷VÁBÁˆDñB”“&WÊ&ˆGíÁˆDñBí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢%GWF˜"ó2Ê˜B76ñvÊVBFÚFÜR6V∆V7FVBˆB"“ì∞¢–†¢6ˆÁ7B÷ˆFR“vóBvWEGWF˜$6W'Fñfñ6Fñˆ‰÷ˆFRáGWF˜$ñBì∞¢ñbÜ÷ˆFR”“'G&ñ¬"í∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS¢G&ñ¬f÷ñ«í76ñvÊ÷VÁB&WVó&W2G&ñ¬∆ñfV7ñ6∆R‚7W'&VÁB∆ñfV7ñ6∆S¢G∂÷ˆFW“Ê¿¢“ì∞¢–†¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜#¢VÁ&ˆ∆∆÷VÁDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁDñBê¢Ê÷ñ&U6ñÊv∆RÇì∞¢ñbÜVÁ&ˆ∆∆÷VÁDW'&˜"«¬VÁ&ˆ∆∆÷VÁBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$VÁ&ˆ∆∆÷VÁBÊ˜Bf˜VÊB"“ì∞¢–¢6ˆÁ7BFV÷ÊD&∆ˆ6≤“FV÷ÊD76ñvÊ÷VÁD&∆ˆ6≤ÜVÁ&ˆ∆∆÷VÁBì∞¢ñbÜFV÷ÊD&∆ˆ6≤í&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢FV÷ÊD&∆ˆ6≤“ì∞¢ñbÜó56ÊF&˜ÑVÁ&ˆ∆∆÷VÁDf˜%GWF˜"ÜVÁ&ˆ∆∆÷VÁB¬GWF˜$ñBíí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢$6ÊF&˜Ç66˜VÁB6ÊÊ˜B&RW6VB2G&ñ¬WfñFVÊ6R"“ì∞¢–¢ñbÜVÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñBbb7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñBí”“GWF˜$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢$VÁ&ˆ∆∆÷VÁBó2«&VGí76ñvÊVBFÚÊ˜FÜW"GWF˜""“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóBVÁ7W&U7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁB¬GWF˜$ñBì∞¢ñbÇ7GVFVÁCÚÊñBí∞¢Fá&˜rÊWrW'&˜"Ç$6ÊˆÊñ6¬7GVFVÁB&V6˜&Bó2&WVó&VBf˜"FÜRG&ñ¬∆6V÷VÁB"ì∞¢–†¢6ˆÁ7BG&ñƒ66R“vóB7&VFUG&ñƒ66Rá∞¢GWF˜$ñB¿¢GWF˜$76ñvÊ÷VÁDñC¢GWF˜$76ñvÊ÷VÁBÊñB¿¢7&VFVD'ïW6W$ñC¢á&W2ÁííÊF%W6W"ÊñB¿¢“ì∞¢7&VFVD66TñB“G&ñƒ66RÊñC∞¢6ˆÁ7B∆6V÷VÁE&W7V«B“vóB7&VFUG&ñ≈∆6V÷VÁBá∞¢66TñC¢G&ñƒ66RÊñB¿¢VÁ&ˆ∆∆÷VÁDñB¿¢&VÁDñC¢7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÁW6W%ˆñBí¿¢7GVFVÁDñC¢7G&ñÊrá7GVFVÁBÊñBí¿¢f÷ñ«î∂Wì¢7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÁW6W%ˆñB«¬VÁ&ˆ∆∆÷VÁBÁ&VÁEˆV÷ñ¬íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí¿¢7&VFVD'ïW6W$ñC¢á&W2ÁííÊF%W6W"ÊñB¿¢“ì∞¢∆6V÷VÁD7&VFVB“∆6V÷VÁE&W7V«BÊ7&VFVC∞†¢6ˆÁ7B≤FF¢WFFVDVÁ&ˆ∆∆÷VÁB¬W'&˜#¢WFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢ÁWFFRá∞¢76ñvÊVE˜GWF˜%ˆñC¢GWF˜$ñB¿¢76ñvÊVE˜7GVFVÁEˆñC¢7GVFVÁBÊñB¿¢76ñvÊ÷VÁEˆ∆ÊS¢'G&ñ¬"¿¢7FGW3¢&vóFñÊu˜GWF˜%ˆ66WFÊ6R"¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁDñBê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞¢ñbáWFFTW'&˜"«¬WFFVDVÁ&ˆ∆∆÷VÁBí∞¢vóB&V÷˜fUG&ñ≈∆6V÷VÁD7&VFVDGW&ñÊtfñ∆VD76ñvÊ÷VÁBáG&ñƒ66RÊñB¬VÁ&ˆ∆∆÷VÁDñBì∞¢∆6V÷VÁD7&VFVB“f«6S∞¢Fá&˜rÊWrW'&˜"Üfñ∆VBFÚ76ñv‚G&ñ¬f÷ñ«ì¢G∑WFFTW'&˜#ÚÊ÷W76vR«¬$VÁ&ˆ∆∆÷VÁBWFFRfñ∆VB'÷ì∞¢–¢76ñvÊ÷VÁD6ˆ÷÷óGFVB“G'VS∞†¢G'í∞¢vóB6∆VÁW∆Vv7î∆ófTVÁ&ˆ∆∆÷VÁG4f˜$Êˆ‰∆ófUGWF˜"áGWF˜$ñB¬'G&ñ¬"ì∞¢“6F6ÇÜ6∆VÁWW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$fñ∆VBFÚ6∆V‚Êˆ‚’G&ñ¬76ñvÊ÷VÁG2gFW"v˜fW&ÊVBG&ñ¬∆6V÷VÁC¢"¬6∆VÁWW'&˜"ì∞¢–¢vóB6fU6VÊEW6ÇÄ¢7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÁW6W%ˆñBí¿¢∞¢FóF∆S¢%G&ñ¬7V6ñ∆ó7B76ñvÊVB"¿¢&ˆGì¢$7WW'fó6VB&W7ˆÁ6RñÁFVw&óGíG&ñ¬7V6ñ∆ó7BÜ2&VV‚76ñvÊVBf˜"FÜRÊñÊR◊6W76ñˆ‚f∆ñFFñˆ‚Ü6R‚"¿¢W&√¢"ˆ6∆ñVÁB˜&VÁBˆvFWví"¿¢Fs¢&VÁB◊G&ñ¬◊GWF˜"÷76ñvÊVB“G∂VÁ&ˆ∆∆÷VÁDñG÷¿¢“¿¢'&VÁBG&ñ¬GWF˜"76ñvÊVB"¿¢ì∞¢vóB6fU6VÊEW6ÇÄ¢GWF˜$ñB¿¢∞¢FóF∆S¢%G&ñ¬f÷ñ«í∆6V÷VÁB"¿¢&ˆGì¢$v˜fW&ÊVBG&ñ¬f÷ñ«íó2vóFñÊrf˜"ñ˜W"66WFÊ6R‚FÜó2∆6V÷VÁB6˜VÁG2F˜v&Bñ˜W"GvÚ÷f÷ñ«íf∆ñFFñˆ‚66R‚"¿¢W&√¢"ˆ˜W&FñˆÊ¬˜GWF˜"˜ˆB"¿¢Fs¢GWF˜"◊G&ñ¬÷76ñvÊ÷VÁB“G∂VÁ&ˆ∆∆÷VÁDñG÷¿¢“¿¢'GWF˜"G&ñ¬f÷ñ«í76ñvÊVB"¿¢ì∞†¢&W2Êß6ˆ‚á∞¢÷W76vS¢%G&ñ¬f÷ñ«í76ñvÊVB7V66W76gV∆«í"¿¢VÁ&ˆ∆∆÷VÁC¢WFFVDVÁ&ˆ∆∆÷VÁB¿¢66S¢vóBvWEG&ñƒ66T'îñBáG&ñƒ66RÊñBí¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢ñbá∆6V÷VÁD7&VFVBbb7&VFVD66TñBbb76ñvÊ÷VÁD6ˆ÷÷óGFVBí∞¢vóB&V÷˜fUG&ñ≈∆6V÷VÁD7&VFVDGW&ñÊtfñ∆VD76ñvÊ÷VÁBÜ7&VFVD66TñB¬VÁ&ˆ∆∆÷VÁDñBì∞¢–¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"76ñvÊñÊrG&ñ¬f÷ñ«ì¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ76ñv‚G&ñ¬f÷ñ«í"“ì∞¢–¢“¿¢ì∞†¢ÚÚ76ñv‚GWF˜"FÚ‚˜&FñÊ'í6ˆ÷÷W&6ñ¬&VÁBVÁ&ˆ∆∆÷VÁBÑ4ÙÚ÷6ˆÁG&ˆ∆∆VBí‡¢Á˜7BÄ¢"ˆíˆá"ˆVÁ&ˆ∆∆÷VÁG2Û¶VÁ&ˆ∆∆÷VÁDñBˆ76ñv‚◊GWF˜""¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤VÁ&ˆ∆∆÷VÁDñB““&WÁ&◊3∞¢6ˆÁ7B≤GWF˜$ñB¬ˆDñB““&WÊ&ˆGì∞†¢ñbÇGWF˜$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%GWF˜"îBó2&WVó&VB"“ì∞¢–†¢6ˆÁ7B≤FF¢FV÷ÊDVÁ&ˆ∆∆÷VÁB¬W'&˜#¢FV÷ÊDW'&˜"““vóB7W&6RÊg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"íÁ6V∆V7BÇ"¢"íÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁDñBíÊ÷ñ&U6ñÊv∆RÇì∞¢ñbÜFV÷ÊDW'&˜"í&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfW&ñgíFV÷ÊB&ˆGV7Fñˆ‚vFR"“ì∞¢6ˆÁ7BFV÷ÊD&∆ˆ6≤“FV÷ÊD76ñvÊ÷VÁD&∆ˆ6≤ÜFV÷ÊDVÁ&ˆ∆∆÷VÁBì∞¢ñbÜFV÷ÊD&∆ˆ6≤í&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢FV÷ÊD&∆ˆ6≤“ì∞†¢6ˆÁ7BGWF˜$76ñvÊ÷VÁB“vóB7F˜&vRÊvWEGWF˜$76ñvÊ÷VÁBáGWF˜$ñBì∞¢ñbÇGWF˜$76ñvÊ÷VÁBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%GWF˜"◊W7B&R76ñvÊVBFÚˆB&Vf˜&R&V6VófñÊr7GVFVÁG2"“ì∞¢–†¢ñbáˆDñBbbGWF˜$76ñvÊ÷VÁBÁˆDñB”“ˆDñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%GWF˜"ó2Ê˜B76ñvÊVBFÚFÜR6V∆V7FVBˆB"“ì∞¢–†¢ÚÚ6ˆ÷÷W&6ñ¬&W7ˆÁ6ñ&ñ∆óGíó26W&FRg&ˆ“v˜fW&ÊVBG&ñ¬∆6V÷VÁB‡¢6ˆÁ7B≤FF¢GWF˜%7FGW2¬W'&˜#¢7FGW4W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'GWF˜%ˆ&GF∆U˜FW7E˜7FGW6W2"ê¢Á6V∆V7BÇ&÷ˆFR"ê¢ÊWÇ'GWF˜%ˆñB"¬GWF˜$ñBê¢Á6ñÊv∆RÇì∞†¢ñbá7FGW4W'&˜"«¬GWF˜%7FGW2í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%GWF˜"6W'Fñfñ6Fñˆ‚7FGW2Ê˜Bf˜VÊB‚6ˆ◊∆WFR&GF∆RFW7FñÊrfó'7B‚"“ì∞¢–†¢ñbáGWF˜%7FGW2Ê÷ˆFR”“&6W'FñfñVEˆ∆ófR"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á∞¢÷W76vS¢6ˆ÷÷W&6ñ¬76ñvÊ÷VÁG2&WVó&R6W'FñfñVB∆ófR7FGW2‚7W'&VÁB∆ñfV7ñ6∆S¢G∑GWF˜%7FGW2Ê÷ˆFW“‚W6RFÜRG&ñ¬∆6V÷VÁB7Fñˆ‚f˜"G&ñ¬GWF˜'2Ê ¢“ì∞¢–†¢6ˆÁ7B÷Ö7GVFVÁG5W%GWF˜"“vWD÷Ö7GVFVÁG5W%GWF˜$f˜%fVÜñ6∆RáGWF˜$76ñvÊ÷VÁBÁˆBÁfVÜñ6∆Rì∞¢6ˆÁ7B7FófTVÁ&ˆ∆∆÷VÁE7FGW6W2“∞¢&vóFñÊu˜GWF˜%ˆ66WFÊ6R"¿¢&76ñvÊVB"¿¢'&˜˜6≈˜6VÁB"¿¢'6W76ñˆÂˆ&ˆˆ∂VB"¿¢'&W˜'E˜&V6VófVB"¿¢&6ˆÊfó&÷VB"¿¢”∞†¢6ˆÁ7B≤6˜VÁC¢7W'&VÁD76ñvÊVE7GVFVÁD6˜VÁB¬W'&˜#¢76ñvÊ÷VÁD6˜VÁDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB"¬≤6˜VÁC¢&WÜ7B"¬ÜVC¢G'VR“ê¢ÊWÇ&76ñvÊVE˜GWF˜%ˆñB"¬GWF˜$ñBê¢Êñ‚Ç'7FGW2"¬7FófTVÁ&ˆ∆∆÷VÁE7FGW6W2ì∞†¢ñbÜ76ñvÊ÷VÁD6˜VÁDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6ÜV6∂ñÊrGWF˜"7GVFVÁB66óGì¢"¬76ñvÊ÷VÁD6˜VÁDW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚf∆ñFFRGWF˜"66óGí"“ì∞¢–†¢ñbÇÜ7W'&VÁD76ñvÊVE7GVFVÁD6˜VÁB«¬í„“÷Ö7GVFVÁG5W%GWF˜"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á∞¢÷W76vS¢GWF˜"ó2«&VGíB66óGíf˜"FÜó2ˆBfVÜñ6∆RÇG∂÷Ö7GVFVÁG5W%GWF˜'“7GVFVÁG2÷Çñ¿¢“ì∞¢–†¢ÚÚWFFRFÜR&VÁBVÁ&ˆ∆∆÷VÁBvóFÇFÜR76ñvÊVBGWF˜"¬'WBFÚÊ˜B6WBFÚv76ñvÊVBrVÁFñ¬GWF˜"66WG0¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢ÁWFFRá∞¢76ñvÊVE˜GWF˜%ˆñC¢GWF˜$ñB¿¢76ñvÊ÷VÁEˆ∆ÊS¢&6ˆ÷÷W&6ñ¬"¿¢7FGW3¢&vóFñÊu˜GWF˜%ˆ66WFÊ6R"¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁDñBê¢Á6V∆V7BÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"WFFñÊrVÁ&ˆ∆∆÷VÁC¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ76ñv‚GWF˜""“ì∞¢–†¢ñbÇFF«¬FFÊ∆VÊwFÇ””“í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$VÁ&ˆ∆∆÷VÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BVÁ&ˆ∆∆÷VÁB“FF≥”∞†¢vóB6fU6VÊEW6ÇÄ¢VÁ&ˆ∆∆÷VÁBÁW6W%ˆñB¿¢∞¢FóF∆S¢%GWF˜"76ñvÊVB"¿¢&ˆGì¢$GWF˜"Ü2&VV‚76ñvÊVBFÚñ˜W"6Üñ∆B‚&W7ˆÁ6RñÁFVw&óGívñ∆¬Ê˜Fñgíñ˜RvÜV‚FÜWí66WBÊBˆÊ&ˆ&FñÊr÷˜fW2f˜'v&B‚"¿¢W&√¢"ˆ6∆ñVÁB˜&VÁBˆvFWví"¿¢Fs¢&VÁB◊GWF˜"÷76ñvÊVB“G∂VÁ&ˆ∆∆÷VÁBÊñG÷¿¢“¿¢'&VÁBGWF˜"76ñvÊVB"¿¢ì∞†¢vóB6fU6VÊEW6ÇÄ¢GWF˜$ñB¿¢∞¢FóF∆S¢$ÊWr&VÁB76ñvÊ÷VÁB"¿¢&ˆGì¢ñ˜RÜfRÊWr&VÁB76ñvÊ÷VÁBvóFñÊrf˜"ñ˜W"66WFÊ6RÊ¿¢W&√¢"ˆ˜W&FñˆÊ¬˜GWF˜"˜ˆB"¿¢Fs¢GWF˜"÷ÊWr÷76ñvÊ÷VÁB“G∂VÁ&ˆ∆∆÷VÁBÊñG÷¿¢“¿¢'GWF˜"ÊWr76ñvÊ÷VÁB"¿¢ì∞†¢ÚÚ7&VFR˜"&Wó"7GVFVÁB&V6˜&Bf˜"FÜR76ñvÊVBGWF˜ ¢G'í∞¢6ˆÁ7B7GVFVÁB“vóBVÁ7W&U7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁB¬GWF˜$ñBì∞†¢ñbá7GVFVÁBí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%7GVFVÁBVÁ7W&VB7V66W76gV∆«íf˜#¢"¬VÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷Rì∞¢–¢“6F6Çá7GVFVÁDW'"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚7GVFVÁB7&VFñˆ‚f∆˜s¢"¬7GVFVÁDW'"ì∞¢ÚÚFˆ‚wBfñ¬FÜRGWF˜"76ñvÊ÷VÁ@¢–†¢&W2Êß6ˆ‚á∞¢÷W76vS¢%GWF˜"76ñvÊVB7V66W76gV∆«í"¿¢VÁ&ˆ∆∆÷VÁC¢FF≥“¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"76ñvÊñÊrGWF˜#¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ76ñv‚GWF˜""“ì∞¢–¢–¢ì∞†¢ÚÚ6fV«íVÊ76ñv‚GWF˜"g&ˆ“&VÁBVÁ&ˆ∆∆÷VÁBvÜñ∆R&W6W'fñÊr7GVFVÁBFFf˜"&V76ñvÊ÷VÁ@¢Á˜7BÄ¢"ˆíˆá"ˆVÁ&ˆ∆∆÷VÁG2Û¶VÁ&ˆ∆∆÷VÁDñB˜VÊ76ñv‚◊GWF˜""¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤VÁ&ˆ∆∆÷VÁDñB““&WÁ&◊3∞†¢∆WB≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜#¢VÁ&ˆ∆∆÷VÁDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬W6W%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬76ñvÊVE˜GWF˜%ˆñB¬76ñvÊVE˜7GVFVÁEˆñB¬7FGW2¬&˜˜6≈ˆñB¬7W'&VÁE˜7FW"ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁDñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÜVÁ&ˆ∆∆÷VÁDW'&˜"í∞¢6ˆÁ7B÷W76vR“7G&ñÊrÇÜVÁ&ˆ∆∆÷VÁDW'&˜"2ÁíìÚÊ÷W76vR«¬""íÁFÙ∆˜vW$66RÇì∞¢ñbÜ÷W76vRÊñÊ6«VFW2Ç&76ñvÊVE˜7GVFVÁEˆñB"íí∞¢6ˆÁ7Bf∆∆&6≤“vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬W6W%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬76ñvÊVE˜GWF˜%ˆñB¬7FGW2¬&˜˜6≈ˆñB¬7W'&VÁE˜7FW"ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁDñBê¢Ê÷ñ&U6ñÊv∆RÇì∞¢VÁ&ˆ∆∆÷VÁB“f∆∆&6≤ÊFF2Áì∞¢VÁ&ˆ∆∆÷VÁDW'&˜"“f∆∆&6≤ÊW'&˜"2Áì∞¢–¢–†¢ñbÜVÁ&ˆ∆∆÷VÁDW'&˜"í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇVÁ&ˆ∆∆÷VÁB"“ì∞¢–†¢ñbÇVÁ&ˆ∆∆÷VÁBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$VÁ&ˆ∆∆÷VÁBÊ˜Bf˜VÊB"“ì∞¢–†¢ñbÇVÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$VÁ&ˆ∆∆÷VÁBó2Ê˜B7W'&VÁF«í76ñvÊVBFÚGWF˜""“ì∞¢–†¢6ˆÁ7B&Wfñ˜W5GWF˜$ñB“VÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñC∞¢vóB6fV«ïVÊ76ñv‰VÁ&ˆ∆∆÷VÁDg&ˆ’GWF˜"ÜVÁ&ˆ∆∆÷VÁB¬&Wfñ˜W5GWF˜$ñBì∞†¢&W2Êß6ˆ‚á∞¢÷W76vS¢%GWF˜"VÊ76ñvÊVB6fV«í‚7GVFVÁBFFÜ2&VV‚&W6W'fVBf˜"&V76ñvÊ÷VÁB‚"¿¢VÁ&ˆ∆∆÷VÁDñC¢VÁ&ˆ∆∆÷VÁBÊñB¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"VÊ76ñvÊñÊrGWF˜#¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚVÊ76ñv‚GWF˜""“ì∞¢–¢–¢ì∞†¢ÚÚvWB7FófRˆG2f˜"4ÙÚFÚ76ñv‚GWF˜'0¢ÊvWBÄ¢"ˆíˆá"ˆ7FófR◊ˆG2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BˆG2“vóB7F˜&vRÊvWEˆG2Çì∞¢6ˆÁ7B7FófUˆG2“ˆG2Êfñ«FW"Çáí”‚Á7FGW2””“&7FófR"ì∞¢&W2Êß6ˆ‚Ü7FófUˆG2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7FófRˆG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç7FófRˆG2"“ì∞¢–¢–¢ì∞†¢ÚÚvWBGWF˜'2ñ‚ˆBf˜"4ÙÚ76ñvÊ÷VÁBf∆˜p¢ÊvWBÄ¢"ˆíˆá"˜ˆG2ÛßˆDñB˜GWF˜'2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ˆDñB““&WÁ&◊3∞¢6ˆÁ7B76ñvÊ÷VÁG2“vóB7F˜&vRÊvWEGWF˜$76ñvÊ÷VÁG4'ïˆBáˆDñBì∞¢ ¢ÚÚfWF6ÇGWF˜"FWFñ«2f˜"V6Ç76ñvÊ÷VÁ@¢6ˆÁ7BGWF˜'4FF“vóB&ˆ÷ó6RÊ∆¬Ä¢76ñvÊ÷VÁG2Ê÷Ü7ñÊ2Ü76ñvÊ÷VÁC¢Áíí”‚∞¢6ˆÁ7BGWF˜"“vóB7F˜&vRÊvWEW6W"Ü76ñvÊ÷VÁBÁGWF˜$ñBì∞¢&WGW&‚∞¢‚‚Ê76ñvÊ÷VÁB¿¢GWF˜$Ê÷S¢GWF˜#ÚÊÊ÷R«¬%VÊ∂Ê˜v‚"¿¢GWF˜$V÷ñ√¢GWF˜#ÚÊV÷ñ¬«¬""¿¢”∞¢“ê¢ì∞¢ ¢&W2Êß6ˆ‚áGWF˜'4FFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrˆBGWF˜'3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇˆBGWF˜'2"“ì∞¢–¢–¢ì∞†¢ÚÚvWBGWF˜"&ˆfñ∆R'íîBáV&∆ñ2VÊGˆñÁBf˜"Ö"ê¢ÊvWBÄ¢"ˆí˜GWF˜'2ÛßGWF˜$ñB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤GWF˜$ñB““&WÁ&◊3∞†¢6ˆÁ7BGWF˜"“vóB7F˜&vRÊvWEW6W"áGWF˜$ñBì∞¢ñbÇGWF˜"í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%GWF˜"Ê˜Bf˜VÊB"“ì∞¢–†¢&W2Êß6ˆ‚áGWF˜"ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrGWF˜"&ˆfñ∆S¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇGWF˜"&ˆfñ∆R"“ì∞¢–¢–¢ì∞†¢ÚÚ”””””””””””””””””””””””””””””””””””””””–¢ÚÚ%$î‚‘ÙETƒR$ıUDU2ÑÖ"ê¢ÚÚ”””””””””””””””””””””””””””””””””””””””–†¢ÚÚvWB∆¬V˜∆Rñ‚&Vvó7G'ê¢ÊvWBÄ¢"ˆíˆá"ˆ'&ñ‚˜V˜∆R"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'V˜∆U˜&Vvó7G'í"ê¢Á6V∆V7BÇ"¢"ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrV˜∆R&Vvó7G'ì¢"¬W'&˜"ì∞¢&WGW&‚&W2Êß6ˆ‚Öµ“ì∞¢–†¢&W2Êß6ˆ‚ÜFF«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚V˜∆R&Vvó7G'ì¢"¬W'&˜"ì∞¢&W2Êß6ˆ‚Öµ“ì∞¢–¢–¢ì∞†¢ÚÚFBW'6ˆ‚FÚ&Vvó7G'ê¢Á˜7BÄ¢"ˆíˆá"ˆ'&ñ‚˜V˜∆R"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'V˜∆U˜&Vvó7G'í"ê¢ÊñÁ6W'Bá∞¢gV∆≈ˆÊ÷S¢&WÊ&ˆGíÊgV∆ƒÊ÷R¿¢&ˆ∆U˜FóF∆S¢&WÊ&ˆGíÁ&ˆ∆UFóF∆R¿¢&ˆ∆UˆFW67&óFñˆ„¢&WÊ&ˆGíÁ&ˆ∆TFW67&óFñˆ‚¿¢6Ü˜'Eˆ&ñÛ¢&WÊ&ˆGíÁ6Ü˜'D&ñÚ¿¢FV’ˆÊ÷S¢&WÊ&ˆGíÁFV‘Ê÷R¿¢V÷ñ√¢&WÊ&ˆGíÊV÷ñ¬¿¢ÜˆÊS¢&WÊ&ˆGíÁÜˆÊR¿¢7FGW3¢&WÊ&ˆGíÁ7FGW2«¬&7FófR"¿¢7F'EˆFFS¢&WÊ&ˆGíÁ7F'DFFRÚÊWrFFRá&WÊ&ˆGíÁ7F'DFFRí¢ÊWrFFRÇí¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"FFñÊrW'6ˆ„¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚFBW'6ˆ‚"“ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚FBW'6ˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚFBW'6ˆ‚"“ì∞¢–¢–¢ì∞†¢ÚÚvWB∆¬FWFñ«2ávVV∂«íFV∆ófW&&∆W2ê¢ÊvWBÄ¢"ˆíˆá"ˆ'&ñ‚ˆFWFñ«2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&FWFñ«2"ê¢Á6V∆V7BÜ ¢¢¿¢W'6ˆ„ßV˜∆U˜&Vvó7G'íÇ¢ê¢ê¢Ê˜&FW"Ç&GVUˆFFR"¬≤66VÊFñÊs¢G'VR“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrFWFñ«3¢"¬W'&˜"ì∞¢&WGW&‚&W2Êß6ˆ‚Öµ“ì∞¢–†¢&W2Êß6ˆ‚ÜFF«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚FWFñ«3¢"¬W'&˜"ì∞¢&W2Êß6ˆ‚Öµ“ì∞¢–¢–¢ì∞†¢ÚÚ7&VFRFWFñ¿¢Á˜7BÄ¢"ˆíˆá"ˆ'&ñ‚ˆFWFñ«2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&FWFñ«2"ê¢ÊñÁ6W'Bá∞¢W'6ˆÂˆñC¢&WÊ&ˆGíÁW'6ˆ‰ñB¿¢FW67&óFñˆ„¢&WÊ&ˆGíÊFW67&óFñˆ‚¿¢GVUˆFFS¢ÊWrFFRá&WÊ&ˆGíÊGVTFFRí¿¢7FGW3¢'VÊFñÊr"¿¢7&VFVEˆ'ì¢W6W$ñB¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7&VFñÊrFWFñ√¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFRFWFñ¬"“ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚7&VFRFWFñ√¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFRFWFñ¬"“ì∞¢–¢–¢ì∞†¢ÚÚ÷&≤FWFñ¬2FˆÊP¢ÁF6ÇÄ¢"ˆíˆá"ˆ'&ñ‚ˆFWFñ«2Û¶ñBˆFˆÊR"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&FWFñ«2"ê¢ÁWFFRá∞¢7FGW3¢&FˆÊR"¿¢gV∆fñ∆∆VEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"÷&∂ñÊrFWFñ¬FˆÊS¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ÷&≤FWFñ¬FˆÊR"“ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚÷&≤FWFñ¬FˆÊS¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ÷&≤FWFñ¬FˆÊR"“ì∞¢–¢–¢ì∞†¢ÚÚvWB∆¬&ˆ¶V7G0¢ÊvWBÄ¢"ˆíˆá"ˆ'&ñ‚˜&ˆ¶V7G2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&ˆ¶V7G2"ê¢Á6V∆V7BÜ ¢¢¿¢˜vÊW#ßV˜∆U˜&Vvó7G'íÇ¢ê¢ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&ˆ¶V7G3¢"¬W'&˜"ì∞¢&WGW&‚&W2Êß6ˆ‚Öµ“ì∞¢–†¢&W2Êß6ˆ‚ÜFF«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚&ˆ¶V7G3¢"¬W'&˜"ì∞¢&W2Êß6ˆ‚Öµ“ì∞¢–¢–¢ì∞†¢ÚÚ7&VFR&ˆ¶V7@¢Á˜7BÄ¢"ˆíˆá"ˆ'&ñ‚˜&ˆ¶V7G2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&ˆ¶V7G2"ê¢ÊñÁ6W'Bá∞¢Ê÷S¢&WÊ&ˆGíÊÊ÷R¿¢˜vÊW%ˆñC¢&WÊ&ˆGíÊ˜vÊW$ñB¿¢Ü˜&ó¶ˆ„¢&WÊ&ˆGíÊÜ˜&ó¶ˆ‚¿¢ˆ&¶V7FófS¢&WÊ&ˆGíÊˆ&¶V7FófR¿¢7FGW3¢&7FófR"¿¢7F'EˆFFS¢ÊWrFFRÇí¿¢7&VFVEˆ'ì¢W6W$ñB¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7&VFñÊr&ˆ¶V7C¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFR&ˆ¶V7B"“ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚7&VFR&ˆ¶V7C¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFR&ˆ¶V7B"“ì∞¢–¢–¢ì∞†¢ÚÚvWB∆¬ñFV0¢ÊvWBÄ¢"ˆíˆá"ˆ'&ñ‚ˆñFV2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ñFV2"ê¢Á6V∆V7BÇ"¢"ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrñFV3¢"¬W'&˜"ì∞¢&WGW&‚&W2Êß6ˆ‚Öµ“ì∞¢–†¢&W2Êß6ˆ‚ÜFF«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚ñFV3¢"¬W'&˜"ì∞¢&W2Êß6ˆ‚Öµ“ì∞¢–¢–¢ì∞†¢ÚÚWFFRñFV7FGW0¢ÁF6ÇÄ¢"ˆíˆá"ˆ'&ñ‚ˆñFV2Û¶ñB˜7FGW2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7BW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ñFV2"ê¢ÁWFFRá∞¢7FGW3¢&WÊ&ˆGíÁ7FGW2¿¢&WfñWuˆÊ˜FW3¢&WÊ&ˆGíÊÊ˜FW2¿¢&WfñWvVEˆ'ì¢W6W$ñB¿¢&WfñWvVEˆC¢ÊWrFFRÇí¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"WFFñÊrñFV7FGW3¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚWFFRñFV7FGW2"“ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚WFFRñFV7FGW3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚWFFRñFV7FGW2"“ì∞¢–¢–¢ì∞†¢ÚÚ6ˆÁfW'BñFVFÚ&ˆ¶V7@¢Á˜7BÄ¢"ˆíˆá"ˆ'&ñ‚ˆñFV2Û¶ñBˆ6ˆÁfW'B"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7BW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞†¢ÚÚvWBFÜRñFV¢6ˆÁ7B≤FF¢ñFV¬W'&˜#¢ñFVW'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ñFV2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ&ñB"¬ñBê¢Á6ñÊv∆RÇì∞†¢ñbÜñFVW'&˜"«¬ñFVí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ñFVÊ˜Bf˜VÊB"“ì∞¢–†¢ÚÚ7&VFR&ˆ¶V7Bg&ˆ“ñFVÜ˜vÊW"ÊVVG2FÚ&R6WB÷ÁV∆«ígFW"ê¢6ˆÁ7B≤FF¢&ˆ¶V7B¬W'&˜#¢&ˆ¶V7DW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&ˆ¶V7G2"ê¢ÊñÁ6W'Bá∞¢Ê÷S¢ñFVÁFóF∆R¿¢ˆ&¶V7FófS¢ñFVÊFW67&óFñˆ‚¿¢Ü˜&ó¶ˆ„¢#3"¿¢7FGW3¢&7FófR"¿¢7F'EˆFFS¢ÊWrFFRÇí¿¢7&VFVEˆ'ì¢W6W$ñB¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbá&ˆ¶V7DW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7&VFñÊr&ˆ¶V7Bg&ˆ“ñFV¢"¬&ˆ¶V7DW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFR&ˆ¶V7B"“ì∞¢–†¢ÚÚWFFRñFVvóFÇ&ˆ¶V7B&VfW&VÊ6P¢vóB7W&6P¢Êg&ˆ“Ç&ñFV2"ê¢ÁWFFRá∞¢7FGW3¢&&˜fVB"¿¢6ˆÁfW'FVE˜Fı˜&ˆ¶V7EˆñC¢&ˆ¶V7BÊñB¿¢“ê¢ÊWÇ&ñB"¬ñBì∞†¢&W2Êß6ˆ‚á≤&ˆ¶V7B¬ñFV“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6ˆÁfW'FñÊrñFVFÚ&ˆ¶V7C¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6ˆÁfW'BñFV"“ì∞¢–¢–¢ì∞†¢ÚÚ7V&÷óBÜñvÇ66Üˆˆ¬∆VFW'6Üóñ∆˜B&WVW7BÜ∆∆˜rV&∆ñ27V&÷ó76ñˆÁ2ê¢Á˜7BÄ¢"ˆí˜ñ∆˜G2ˆÜñvá66Üˆˆ¬˜7V&÷óB"¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñB«¬ÁV∆√∞¢6ˆÁ7BñÁ6W'Dˆ&£¢Áí“∞¢66Üˆˆ≈ˆÊ÷S¢&WÊ&ˆGíÁ66ÜˆˆƒÊ÷R¿¢6ˆÁF7E˜W'6ˆÂˆÊ÷S¢&WÊ&ˆGíÊ6ˆÁF7EW'6ˆ‰Ê÷R«¬ÁV∆¬¿¢6ˆÁF7E˜W'6ˆÂ˜ÜˆÊS¢&WÊ&ˆGíÁÜˆÊR«¬ÁV∆¬¿¢6ˆÁF7E˜W'6ˆÂ˜&ˆ∆S¢&WÊ&ˆGíÊ6ˆÁF7EW'6ˆÂ&ˆ∆R¿¢V÷ñ√¢&WÊ&ˆGíÊV÷ñ¬¿¢7V&÷óGFW%ˆÊ÷S¢&WÊ&ˆGíÁ7V&÷óGFW$Ê÷R«¬ÁV∆¬¿¢7V&÷óGFW%˜&ˆ∆S¢&WÊ&ˆGíÁ7V&÷óGFW%&ˆ∆R«¬ÁV∆¬¿¢”∞¢ñbáW6W$ñBíñÁ6W'Dˆ&¢Á7V&÷óGFVEˆ'í“W6W$ñC∞†¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&∆VFW'6Üó˜ñ∆˜E˜&WVW7G2"ê¢ÊñÁ6W'BÜñÁ6W'Dˆ&¢ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7V&÷óGFñÊr∆VFW'6Üóñ∆˜B&WVW7C¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7V&÷óB&WVW7B"“ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚7V&÷óB∆VFW'6Üóñ∆˜B&WVW7C¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7V&÷óB&WVW7B"“ì∞¢–¢–¢ì∞†¢ÚÚ7V&÷óBV&«íñÁFW'fVÁFñˆ‚ñ∆˜B&WVW7BÜ∆∆˜rV&∆ñ27V&÷ó76ñˆÁ2ê¢Á˜7BÄ¢"ˆí˜ñ∆˜G2ˆV&«ññÁFW'fVÁFñˆ‚˜7V&÷óB"¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñB«¬ÁV∆√∞¢6ˆÁ7BñÁ6W'Dˆ&£¢Áí“∞¢66Üˆˆ≈ˆÊ÷S¢&WÊ&ˆGíÁ66ÜˆˆƒÊ÷R¿¢6ˆÁF7E˜W'6ˆÂˆÊ÷S¢&WÊ&ˆGíÊ6ˆÁF7EW'6ˆ‰Ê÷R«¬ÁV∆¬¿¢6ˆÁF7E˜W'6ˆÂ˜ÜˆÊS¢&WÊ&ˆGíÁÜˆÊR«¬ÁV∆¬¿¢6ˆÁF7E˜W'6ˆÂ˜&ˆ∆S¢&WÊ&ˆGíÊ6ˆÁF7EW'6ˆÂ&ˆ∆R¿¢V÷ñ√¢&WÊ&ˆGíÊV÷ñ¬¿¢7V&÷óGFW%ˆÊ÷S¢&WÊ&ˆGíÁ7V&÷óGFW$Ê÷R«¬ÁV∆¬¿¢7V&÷óGFW%˜&ˆ∆S¢&WÊ&ˆGíÁ7V&÷óGFW%&ˆ∆R«¬ÁV∆¬¿¢”∞¢ñbáW6W$ñBíñÁ6W'Dˆ&¢Á7V&÷óGFVEˆ'í“W6W$ñC∞†¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&V&«ïˆñÁFW'fVÁFñˆÂ˜&WVW7G2"ê¢ÊñÁ6W'BÜñÁ6W'Dˆ&¢ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7V&÷óGFñÊrV&«íñÁFW'fVÁFñˆ‚ñ∆˜B&WVW7C¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7V&÷óB&WVW7B"“ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚7V&÷óBV&«íñÁFW'fVÁFñˆ‚ñ∆˜B&WVW7C¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7V&÷óB&WVW7B"“ì∞¢–¢–¢ì∞†¢ÚÚ4ÙÛ¢fWF6Ç∆VFW'6Üóñ∆˜B&WVW7G0¢ÚÚ4ÙÛ¢FV∆WFR∆VFW'6Üóñ∆˜B&WVW7@¢ÊFV∆WFRÄ¢"ˆíˆ6ˆÚˆ∆VFW'6Üó◊ñ∆˜B◊&WVW7G2Û¶ñB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B≤W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&∆VFW'6Üó˜ñ∆˜E˜&WVW7G2"ê¢ÊFV∆WFRÇê¢ÊWÇ&ñB"¬ñBì∞¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"FV∆WFñÊr∆VFW'6Üóñ∆˜B&WVW7C¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚFV∆WFRñ∆˜B&WVW7B"“ì∞¢–¢&W2Êß6ˆ‚á≤÷W76vS¢%ñ∆˜B&WVW7BFV∆WFVB"“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚FV∆WFñÊr∆VFW'6Üóñ∆˜B&WVW7C¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚFV∆WFRñ∆˜B&WVW7B"“ì∞¢–¢–¢ì∞¢ÊvWBÄ¢"ˆíˆ6ˆÚˆ∆VFW'6Üó◊ñ∆˜B◊&WVW7G2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&∆VFW'6Üó˜ñ∆˜E˜&WVW7G2"ê¢Á6V∆V7BÇ"¢"ê¢Ê˜&FW"Ç'7V&÷óGFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr∆VFW'6Üóñ∆˜B&WVW7G3¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&WVW7G2"“ì∞¢–†¢&W2Êß6ˆ‚ÜFF«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚fWF6ÜñÊr∆VFW'6Üóñ∆˜B&WVW7G3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&WVW7G2"“ì∞¢–¢–¢ì∞†¢ÚÚÖ#¢fWF6Ç∆VFW'6Üóñ∆˜B&WVW7G0¢ÊvWBÄ¢"ˆíˆá"ˆ∆VFW'6Üó◊ñ∆˜B◊&WVW7G2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&∆VFW'6Üó˜ñ∆˜E˜&WVW7G2"ê¢Á6V∆V7BÇ"¢"ê¢Ê˜&FW"Ç'7V&÷óGFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr∆VFW'6Üóñ∆˜B&WVW7G3¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&WVW7G2"“ì∞¢–†¢&W2Êß6ˆ‚ÜFF«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚fWF6ÜñÊr∆VFW'6Üóñ∆˜B&WVW7G3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&WVW7G2"“ì∞¢–¢–¢ì∞†¢ÚÚ4ÙÛ¢fWF6ÇV&«íñÁFW'fVÁFñˆ‚ñ∆˜B&WVW7G0¢ÚÚ4ÙÛ¢FV∆WFRV&«íñÁFW'fVÁFñˆ‚ñ∆˜B&WVW7@¢ÊFV∆WFRÄ¢"ˆíˆ6ˆÚˆV&«ññÁFW'fVÁFñˆ‚◊&WVW7G2Û¶ñB"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B≤W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&V&«ïˆñÁFW'fVÁFñˆÂ˜&WVW7G2"ê¢ÊFV∆WFRÇê¢ÊWÇ&ñB"¬ñBì∞¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"FV∆WFñÊrV&«íñÁFW'fVÁFñˆ‚ñ∆˜B&WVW7C¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚFV∆WFRñ∆˜B&WVW7B"“ì∞¢–¢&W2Êß6ˆ‚á≤÷W76vS¢%ñ∆˜B&WVW7BFV∆WFVB"“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚FV∆WFñÊrV&«íñÁFW'fVÁFñˆ‚ñ∆˜B&WVW7C¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚFV∆WFRñ∆˜B&WVW7B"“ì∞¢–¢–¢ì∞¢ÊvWBÄ¢"ˆíˆ6ˆÚˆV&«ññÁFW'fVÁFñˆ‚◊&WVW7G2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&6ˆÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&V&«ïˆñÁFW'fVÁFñˆÂ˜&WVW7G2"ê¢Á6V∆V7BÇ"¢"ê¢Ê˜&FW"Ç'7V&÷óGFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrV&«íñÁFW'fVÁFñˆ‚&WVW7G3¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&WVW7G2"“ì∞¢–†¢&W2Êß6ˆ‚ÜFF«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚fWF6ÜñÊrV&«íñÁFW'fVÁFñˆ‚&WVW7G3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&WVW7G2"“ì∞¢–¢–¢ì∞†¢ÚÚÖ#¢fWF6ÇV&«íñÁFW'fVÁFñˆ‚ñ∆˜B&WVW7G0¢ÊvWBÄ¢"ˆíˆá"ˆV&«ññÁFW'fVÁFñˆ‚◊&WVW7G2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á"%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&V&«ïˆñÁFW'fVÁFñˆÂ˜&WVW7G2"ê¢Á6V∆V7BÇ"¢"ê¢Ê˜&FW"Ç'7V&÷óGFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrV&«íñÁFW'fVÁFñˆ‚&WVW7G3¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&WVW7G2"“ì∞¢–†¢&W2Êß6ˆ‚ÜFF«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚fWF6ÜñÊrV&«íñÁFW'fVÁFñˆ‚&WVW7G3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&WVW7G2"“ì∞¢–¢–¢ì∞†¢ÚÚvWBV˜∆R&Vvó7G'í∆ó7BÜf˜"Áí∆ˆvvVBñ‚W6W"“f˜"Fó7WFR∆ˆvvñÊrê¢ÊvWBÄ¢"ˆí˜V˜∆R◊&Vvó7G'íˆ∆ó7B"¿¢ó4WFÜVÁFñ6FVB¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'V˜∆U˜&Vvó7G'í"ê¢Á6V∆V7BÇ&ñB¬gV∆≈ˆÊ÷R¬&ˆ∆U˜FóF∆R¬7FGW2"ê¢ÊWÇ'7FGW2"¬&7FófR"ê¢Ê˜&FW"Ç&gV∆≈ˆÊ÷R"¬≤66VÊFñÊs¢G'VR“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrV˜∆R∆ó7C¢"¬W'&˜"ì∞¢&WGW&‚&W2Êß6ˆ‚Öµ“ì∞¢–†¢ÚÚG&Á6f˜&“FÚ6÷Vƒ66Rf˜"g&ˆÁFVÊ@¢6ˆÁ7BG&Á6f˜&÷VB“ÜFF«¬µ“íÊ÷Çá¢Áíí”‚á∞¢ñC¢ÊñB¿¢gV∆ƒÊ÷S¢ÊgV∆≈ˆÊ÷R¿¢&ˆ∆UFóF∆S¢Á&ˆ∆U˜FóF∆R¿¢7FGW3¢Á7FGW2¿¢“íì∞†¢&W2Êß6ˆ‚áG&Á6f˜&÷VBì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚V˜∆R∆ó7C¢"¬W'&˜"ì∞¢&W2Êß6ˆ‚Öµ“ì∞¢–¢–¢ì∞†¢ÚÚ”””””””””””””””””””””””””””””””””””””””–¢ÚÚDï5UDU2‘ÙETƒR$ıUDU2ÑÖ"ê¢ÚÚ”””””””””””””””””””””””””””””””””””””””–†¢ÚÚvWB∆¬Fó7WFW0¢ÊvWBÄ¢"ˆíˆá"ˆFó7WFW2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¢Fó7WFW2¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&Fó7WFW2"ê¢Á6V∆V7BÇ"¢"ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrFó7WFW3¢"¬W'&˜"ì∞¢&WGW&‚&W2Êß6ˆ‚Öµ“ì∞¢–†¢ÚÚfWF6Ç&W6ˆ«WFñˆÁ2f˜"V6ÇFó7WFP¢6ˆÁ7BFó7WFW5vóFÖ&W6ˆ«WFñˆÁ2“vóB&ˆ÷ó6RÊ∆¬Ä¢ÜFó7WFW2«¬µ“íÊ÷Ü7ñÊ2ÜFó7WFS¢Áíí”‚∞¢6ˆÁ7B≤FF¢&W6ˆ«WFñˆÁ2““vóB7W&6P¢Êg&ˆ“Ç&Fó7WFU˜&W6ˆ«WFñˆÁ2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ&Fó7WFUˆñB"¬Fó7WFRÊñBê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢G'VR“ì∞†¢&WGW&‚∞¢‚‚ÊFó7WFR¿¢&W6ˆ«WFñˆÁ3¢&W6ˆ«WFñˆÁ2«¬µ“¿¢”∞¢“ê¢ì∞†¢&W2Êß6ˆ‚ÜFó7WFW5vóFÖ&W6ˆ«WFñˆÁ2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚Fó7WFW3¢"¬W'&˜"ì∞¢&W2Êß6ˆ‚Öµ“ì∞¢–¢–¢ì∞†¢ÚÚ∆ˆrFó7WFRÜÁí∆ˆvvVBñ‚W6W"ê¢Á˜7BÄ¢"ˆíˆFó7WFW2ˆ∆ˆr"¿¢ó4WFÜVÁFñ6FVB¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&Fó7WFW2"ê¢ÊñÁ6W'Bá∞¢∆ˆvvVEˆ'ì¢W6W$ñB¿¢∆ˆvvVEˆ'ïˆÊ÷S¢&WÊ&ˆGíÊ∆ˆvvVD'îÊ÷R¿¢ñÁfˆ«fVE˜'FñW3¢&WÊ&ˆGíÊñÁfˆ«fVE'FñW2¿¢ñÁfˆ«fVE˜'GïˆÊ÷W3¢&WÊ&ˆGíÊñÁfˆ«fVE'GîÊ÷W2¿¢Fó7WFU˜GóS¢&WÊ&ˆGíÊFó7WFUGóR¿¢FW67&óFñˆ„¢&WÊ&ˆGíÊFW67&óFñˆ‚¿¢FW6ó&VEˆ˜WF6ˆ÷S¢&WÊ&ˆGíÊFW6ó&VD˜WF6ˆ÷R¿¢7FGW3¢&˜V‚"¿¢fó6ñ&∆U˜FÛ¢≤&á""¬&6VÚ%“¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"∆ˆvvñÊrFó7WFS¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ∆ˆrFó7WFR"“ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚∆ˆrFó7WFS¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ∆ˆrFó7WFR"“ì∞¢–¢–¢ì∞†¢ÚÚWFFRFó7WFR7FGW0¢ÁF6ÇÄ¢"ˆíˆá"ˆFó7WFW2Û¶ñB˜7FGW2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&Fó7WFW2"ê¢ÁWFFRá∞¢7FGW3¢&WÊ&ˆGíÁ7FGW2¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"WFFñÊrFó7WFR7FGW3¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚWFFRFó7WFR7FGW2"“ì∞¢–†¢&W2Êß6ˆ‚ÜFFì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚WFFRFó7WFR7FGW3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚWFFRFó7WFR7FGW2"“ì∞¢–¢–¢ì∞†¢ÚÚ&W6ˆ«fRFó7WFP¢Á˜7BÄ¢"ˆíˆá"ˆFó7WFW2Û¶Fó7WFTñB˜&W6ˆ«fR"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤Fó7WFTñB““&WÁ&◊3∞¢6ˆÁ7BW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞†¢ÚÚ7&VFR&W6ˆ«WFñˆ‚&V6˜&@¢6ˆÁ7B≤FF¢&W6ˆ«WFñˆ‚¬W'&˜#¢&W4W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&Fó7WFU˜&W6ˆ«WFñˆÁ2"ê¢ÊñÁ6W'Bá∞¢Fó7WFUˆñC¢Fó7WFTñB¿¢7Fñˆ„¢&WÊ&ˆGíÊ7Fñˆ‚¿¢7V÷÷'ì¢&WÊ&ˆGíÁ7V÷÷'í¿¢FV6ó6ñˆ„¢&WÊ&ˆGíÊFV6ó6ñˆ‚¿¢fˆ∆∆˜u˜WˆFFS¢&WÊ&ˆGíÊfˆ∆∆˜uWFFRÚÊWrFFRá&WÊ&ˆGíÊfˆ∆∆˜uWFFRí¢ÁV∆¬¿¢&W6ˆ«fVEˆ'ì¢W6W$ñB¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbá&W4W'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7&VFñÊr&W6ˆ«WFñˆ„¢"¬&W4W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFR&W6ˆ«WFñˆ‚"“ì∞¢–†¢ÚÚWFFRFó7WFR7FGW2FÚ&W6ˆ«fV@¢vóB7W&6P¢Êg&ˆ“Ç&Fó7WFW2"ê¢ÁWFFRá≤7FGW3¢'&W6ˆ«fVB"“ê¢ÊWÇ&ñB"¬Fó7WFTñBì∞†¢&W2Êß6ˆ‚á&W6ˆ«WFñˆ‚ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚&W6ˆ«fRFó7WFS¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&W6ˆ«fRFó7WFR"“ì∞¢–¢–¢ì∞†¢ÚÚvWBFó7WFRGFW&Á0¢ÊvWBÄ¢"ˆíˆá"ˆFó7WFW2˜GFW&Á2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&á""¬&6VÚ%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤FF¢Fó7WFW2¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&Fó7WFW2"ê¢Á6V∆V7BÇ&ñÁfˆ«fVE˜'GïˆÊ÷W2¬Fó7WFU˜GóR"ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrFó7WFW2f˜"GFW&Á3¢"¬W'&˜"ì∞¢&WGW&‚&W2Êß6ˆ‚Öµ“ì∞¢–†¢ÚÚ&WGW&‚&rFF¬∆WBg&ˆÁFVÊB&ˆ6W72GFW&Á0¢&W2Êß6ˆ‚ÜFó7WFW2«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚Fó7WFW2GFW&Á3¢"¬W'&˜"ì∞¢&W2Êß6ˆ‚Öµ“ì∞¢–¢–¢ì∞†¢ÚÚ”””””””””””””””””””””””””””””””””””””””–¢ÚÚddîƒîDR$ı5T5Dî‰r$ıUDU0¢ÚÚ”””””””””””””””””””””””””””””””””””””””–†¢ÚÚvWB˜"7&VFRffñ∆ñFR6ˆFP¢ÊvWBÄ¢"ˆíˆffñ∆ñFRˆ6ˆFR"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bffñ∆ñFTñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤vWGFñÊrffñ∆ñFR6ˆFRf˜#¢"¬ffñ∆ñFTñBì∞¢ ¢6ˆÁ7BóV∆ñÊUGóR“Ê˜&÷∆ó¶U&ˆGV7FñˆÂóV∆ñÊRá&WÁVW'ìÚÁóV∆ñÊRì∞¢6ˆÁ7B6ˆFU&V6˜&B“vóB7F˜&vRÊvWD˜$7&VFTffñ∆ñFT6ˆFRÜffñ∆ñFTñB¬óV∆ñÊUGóRì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)»Rv˜B6ˆFR&V6˜&C¢"¬6ˆFU&V6˜&Bì∞¢ ¢ÚÚ&WGW&‚ßW7BFÜR6ˆFRfñV∆BFÚ÷F6Çg&ˆÁFVÊBWáV7FFñˆÁ0¢&W2Êß6ˆ‚á∞¢6ˆFS¢6ˆFU&V6˜&BÊ6ˆFR¿¢óV∆ñÊUGóS¢6ˆFU&V6˜&BÁóV∆ñÊU˜GóR«¬óV∆ñÊUGóR¿¢6◊ñv‰Ê÷S¢6ˆFU&V6˜&BÊ6◊ñvÂˆÊ÷R«¬ÁV∆¬¿¢∆ñÊ≥¢'Vñ∆D6ÊˆÊñ6≈&ˆGV7Fñˆ‰∆ñÊµW&¬Ü6ˆFU&V6˜&BÊ6ˆFR¬6ˆFU&V6˜&BÁóV∆ñÊU˜GóR«¬óV∆ñÊUGóRí¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"vWGFñÊrffñ∆ñFR6ˆFS¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚvWBffñ∆ñFR6ˆFR"“ì∞¢–¢–¢ì∞†¢ÊvWBÄ¢"ˆíˆffñ∆ñFR˜&ˆGV7Fñˆ‚÷∆ñÊ∑2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bffñ∆ñFTñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ffñ∆ñFUˆ6ˆFW2"ê¢Á6V∆V7BÇ&6ˆFR¬óV∆ñÊU˜GóR¬6◊ñvÂˆÊ÷R¬7FGW2¬7&VFVEˆB"ê¢ÊWÇ&ffñ∆ñFUˆñB"¬ffñ∆ñFTñBê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚ÇÜFF«¬µ“íÊ÷ÇÜ∆ñÊ≥¢Áíí”‚á∞¢‚‚Ê∆ñÊ≤¿¢∆ñÊ≥¢'Vñ∆D6ÊˆÊñ6≈&ˆGV7Fñˆ‰∆ñÊµW&¬Ü∆ñÊ≤Ê6ˆFR¬∆ñÊ≤ÁóV∆ñÊU˜GóRí¿¢“ííì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"vWGFñÊr&ˆGV7Fñˆ‚∆ñÊ∑3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚvWB&ˆGV7Fñˆ‚∆ñÊ∑2"“ì∞¢–¢–¢ì∞†¢ÚÚ∆ˆrVÊ6˜VÁFW ¢Á˜7BÄ¢"ˆíˆffñ∆ñFRˆVÊ6˜VÁFW'2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bffñ∆ñFTñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘9“∆ˆvvñÊrVÊ6˜VÁFW"f˜"ffñ∆ñFS¢"¬ffñ∆ñFTñBì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤VÊ6˜VÁFW"FF&V6VófVC¢"¬•4Ù‚Á7G&ñÊvñgíá&WÊ&ˆGí¬ÁV∆¬¬"íì∞¢ ¢6ˆÁ7BVÊ6˜VÁFW"“ñÁ6W'DVÊ6˜VÁFW%66ÜV÷Á'6Rá&WÊ&ˆGíì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)»RVÊ6˜VÁFW"f∆ñFFVC¢"¬•4Ù‚Á7G&ñÊvñgíÜVÊ6˜VÁFW"¬ÁV∆¬¬"íì∞¢ ¢6ˆÁ7B&W7V«B“vóB7F˜&vRÊ∆ˆtVÊ6˜VÁFW"Üffñ∆ñFTñB¬VÊ6˜VÁFW"ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)»RVÊ6˜VÁFW"∆ˆvvVB7V66W76gV∆«ì¢"¬&W7V«Bì∞¢ ¢&W2Êß6ˆ‚á&W7V«Bì∞¢“6F6ÇÜW'&˜#¢Áíí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç.)ÿ¬W'&˜"∆ˆvvñÊrVÊ6˜VÁFW#¢"¬W'&˜"Ê÷W76vRì∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç"gV∆¬W'&˜#¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"Ê÷W76vR«¬$fñ∆VBFÚ∆ˆrVÊ6˜VÁFW""“ì∞¢–¢–¢ì∞†¢ÚÚvWB∆¬VÊ6˜VÁFW'2f˜"ffñ∆ñFP¢ÊvWBÄ¢"ˆíˆffñ∆ñFRˆVÊ6˜VÁFW'2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bffñ∆ñFTñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7BVÊ6˜VÁFW'2“vóB7F˜&vRÊvWDVÊ6˜VÁFW'2Üffñ∆ñFTñBì∞¢&W2Êß6ˆ‚ÜVÊ6˜VÁFW'2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"vWGFñÊrVÊ6˜VÁFW'3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚvWBVÊ6˜VÁFW'2"“ì∞¢–¢–¢ì∞†¢ÚÚ÷&≤VÊ6˜VÁFW"2ˆ&¶V7FV@¢ÁF6ÇÄ¢"ˆíˆffñ∆ñFRˆVÊ6˜VÁFW'2Û¶ñBˆˆ&¶V7B"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢vóB7F˜&vRÁWFFTVÊ6˜VÁFW%7FGW2ÜñB¬&ˆ&¶V7FVB"ì∞¢&W2Êß6ˆ‚á≤7V66W73¢G'VR“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"WFFñÊrVÊ6˜VÁFW#¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚWFFRVÊ6˜VÁFW""“ì∞¢–¢–¢ì∞†¢ÚÚvWBffñ∆ñFR∆VG0¢ÊvWBÄ¢"ˆíˆffñ∆ñFRˆ∆VG2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bffñ∆ñFTñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B∆VG2“vóB7F˜&vRÊvWD∆VG2Üffñ∆ñFTñBì∞¢&W2Êß6ˆ‚Ü∆VG2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"vWGFñÊr∆VG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚvWB∆VG2"“ì∞¢–¢–¢ì∞†¢ÚÚvWBffñ∆ñFR6∆˜6W0¢ÊvWBÄ¢"ˆíˆffñ∆ñFRˆ6∆˜6W2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bffñ∆ñFTñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B6∆˜6W2“vóB7F˜&vRÊvWD6∆˜6W2Üffñ∆ñFTñBì∞¢&W2Êß6ˆ‚Ü6∆˜6W2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"vWGFñÊr6∆˜6W3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚvWB6∆˜6W2"“ì∞¢–¢–¢ì∞†¢ÚÚvWBffñ∆ñFR7FG0¢ÊvWBÄ¢"ˆíˆffñ∆ñFR˜7FG2"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bffñ∆ñFTñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B7FG2“vóB7F˜&vRÊvWDffñ∆ñFU7FG2Üffñ∆ñFTñBì∞¢&W2Êß6ˆ‚á7FG2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"vWGFñÊr7FG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚvWB7FG2"“ì∞¢–¢–¢ì∞†¢ÚÚvWBffñ∆ñFR∆VBˆ6∆˜6Rˆˆ&¶V7FVB'&V∂F˜v‡¢ÊvWBÄ¢"ˆíˆffñ∆ñFRˆ'&V∂F˜v‚"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bffñ∆ñFTñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B'&V∂F˜v‚“vóB7F˜&vRÊvWDffñ∆ñFT∆VG4'ï7FGW2Üffñ∆ñFTñBì∞¢&W2Êß6ˆ‚Ü'&V∂F˜v‚ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"vWGFñÊr'&V∂F˜v„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚvWB'&V∂F˜v‚"“ì∞¢–¢–¢ì∞†¢ÚÚ6fRffñ∆ñFR&Vf∆V7Fñˆ‚Üg&ˆ“Fó66˜fW"÷FV∆ófW"&«VW&ñÁBê¢Á˜7BÄ¢"ˆíˆffñ∆ñFR˜&Vf∆V7Fñˆ‚"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bffñ∆ñFTñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B'6VB“ñÁ6W'Dffñ∆ñFU&Vf∆V7FñˆÂ66ÜV÷Á'6Rá&WÊ&ˆGíí2Áì∞¢6ˆÁ7B&Vf∆V7FñˆÂFWáB“'6VBÁ&Vf∆V7FñˆÂFWáB«¬'6VBÁ&Vf∆V7FñˆÂ˜FWáC∞¢6ˆÁ7B&W7V«B“vóB7F˜&vRÁ6fTffñ∆ñFU&Vf∆V7Fñˆ‚Üffñ∆ñFTñB¬&Vf∆V7FñˆÂFWáBì∞¢&W2Êß6ˆ‚á&W7V«Bì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6fñÊr&Vf∆V7Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6fR&Vf∆V7Fñˆ‚"“ì∞¢–¢–¢ì∞†¢ÚÚvWBffñ∆ñFR&Vf∆V7Fñˆ‡¢ÊvWBÄ¢"ˆíˆffñ∆ñFR˜&Vf∆V7Fñˆ‚"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤&ffñ∆ñFR%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bffñ∆ñFTñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B&Vf∆V7Fñˆ‚“vóB7F˜&vRÊvWDffñ∆ñFU&Vf∆V7Fñˆ‚Üffñ∆ñFTñBì∞¢&W2Êß6ˆ‚á&Vf∆V7Fñˆ‚ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"vWGFñÊr&Vf∆V7Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚvWB&Vf∆V7Fñˆ‚"“ì∞¢–¢–¢ì∞†¢ÚÚ&V6˜&B6∆˜6Rá&VÁB6ˆ÷÷óGFVBFÚGWF˜&ñÊr¶˜W&ÊWíê¢Á˜7BÄ¢"ˆí˜&VÁB˜&V6˜&B÷6∆˜6R"¿¢ó4WFÜVÁFñ6FVB¿¢&WVó&U&ˆ∆RÖ≤'&VÁB%“í¿¢7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&WÁ6W76ñˆ‚2ÁííÁW6W$ñC∞¢6ˆÁ7B≤7GVFVÁDñB¬ˆDñB““&WÊ&ˆGì∞†¢ñbÇ7GVFVÁDñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢'7GVFVÁDñBó2&WVó&VB"“ì∞¢–†¢ÚÚ&W6ˆ«fRFÜRFWFW&÷ñÊó7Fñ26ÊˆÊñ6¬∆VC≤ffñ∆ñFUˆñB÷í&RÁV∆¬f˜"6◊ñv‚6˜W&6W2‡¢6ˆÁ7B∆VB“vóB7F˜&vRÊvWD6ÊˆÊñ6ƒ∆VD'ïW6W"á&VÁDñBì∞†¢ñbÇ∆VBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ÊÚ7Vó6óFñˆ‚∆VBf˜VÊBf˜"FÜó2&VÁB"“ì∞¢–†¢ÚÚ&V6˜&BFÜR6∆˜6P¢6ˆÁ7B6∆˜6R“vóB7F˜&vRÁ&V6˜&D6∆˜6RÜ∆VBÊffñ∆ñFUˆñB«¬ÁV∆¬¬&VÁDñB¬7GVFVÁDñB¬ˆDñBì∞¢&W2Êß6ˆ‚Ü6∆˜6Rì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&V6˜&FñÊr6∆˜6S¢"¬W'&˜"ì∞¢6ˆÁ7B÷W76vR“W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ&V6˜&B6∆˜6R#∞¢6ˆÁ7Bó5fW&ñfñ6Fñˆ‰fñ«W&R“˜&WVó&VB&Vf˜&W∆«&VGí&VV‚&V6˜&FVBˆíÁFW7BÜ÷W76vRì∞¢&W2Á7FGW2Üó5fW&ñfñ6Fñˆ‰fñ«W&RÚCí¢SíÊß6ˆ‚á≤÷W76vR“ì∞¢–¢–¢ì∞†¢ÚÚ”””””””””””””””””””””””””””””””””””””””–¢ÚÚ$TÂBTÂ$Ùƒƒ‘TÂB$ıUDU0¢ÚÚ”””””””””””””””””””””””””””””””””””””””–†¢ÚÚvWB&VÁBVÁ&ˆ∆∆÷VÁB7FGW0¢ÊvWBÇ"ˆí˜&VÁBˆVÁ&ˆ∆∆÷VÁB◊7FGW2"¬ó4WFÜVÁFñ6FVB¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7BF%W6W"“á&W2ÁííÊF%W6W#∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5B¢e$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$RW6W%ˆñB“C¢ı$DU"%íWFFVEˆBDU40¢ƒî‘ïB¿¢∑W6W$ñE“¿¢ì∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁB“VÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢6ˆÁ7BFV'Vs¢&V6˜&C«7G&ñÊr¬VÊ∂Ê˜v„‚“∞¢W6W$ñB¿¢F%W6W$V÷ñ√¢F%W6W#ÚÊV÷ñ¬«¬ÁV∆¬¿¢VÁ&ˆ∆∆÷VÁDñC¢VÁ&ˆ∆∆÷VÁCÚÊñB«¬ÁV∆¬¿¢VÁ&ˆ∆∆÷VÁE7FGW3¢VÁ&ˆ∆∆÷VÁCÚÁ7FGW2«¬ÁV∆¬¿¢VÁ&ˆ∆∆÷VÁE7FW¢VÁ&ˆ∆∆÷VÁCÚÊ7W'&VÁE˜7FW«¬ÁV∆¬¿¢V÷W&vVÊ7îF$÷ˆFS¢G'VR¿¢”∞¢ñbÇVÁ&ˆ∆∆÷VÁBí&WGW&‚&W2Êß6ˆ‚á≤7FGW3¢&Ê˜EˆVÁ&ˆ∆∆VB"¬FV'Vr“ì∞†¢∆WB7FGW2“7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÁ7FGW2«¬&Ê˜EˆVÁ&ˆ∆∆VB"ì∞¢∆WB7FW“VÁ&ˆ∆∆÷VÁBÊ7W'&VÁE˜7FW«¬ÁV∆√∞†¢6ˆÁ7B∆FW7Eñ÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬∆‚¬ñ÷VÁE˜7FGW2¬ñ÷VÁEˆFFR¬ñEˆB¬7&VFVEˆ@¢e$Ù“V&∆ñ2Áñ÷VÁE˜G&Á67FñˆÁ0¢tÑU$RVÁ&ˆ∆∆÷VÁEˆñB“C£ßFWá@¢‰B&˜fñFW"“C ¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïB¿¢µ7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÊñBí¬î‘TÂEı$ıdîDU%ıîd5E“¿¢ì∞¢6ˆÁ7B∆FW7Eñ÷VÁB“∆FW7Eñ÷VÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢6ˆÁ7BñEVÊ∆ˆ6∂VDVÁ&ˆ∆∆÷VÁB–¢7FGW2””“'6W76ñˆÂˆ&ˆˆ∂VB"b`¢7G&ñÊrÜ∆FW7Eñ÷VÁCÚÁñ÷VÁE˜7FGW2«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí””“'ñB#∞†¢FV'VrÊ∆FW7Eñ÷VÁDñB“∆FW7Eñ÷VÁCÚÊñB«¬ÁV∆√∞¢FV'VrÊ∆FW7Eñ÷VÁE7FGW2“∆FW7Eñ÷VÁCÚÁñ÷VÁE˜7FGW2«¬ÁV∆√∞†¢∆WBÜ5G&ñÊñÊt7FófóGí“f«6S∞¢ñbÜVÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜7GVFVÁEˆñBí∞¢6ˆÁ7BG&ñÊñÊt7FófóGï&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BUÑï5E2Ä¢4TƒT5B¢e$Ù“V&∆ñ2ÁG&ñÊñÊu˜6W76ñˆÂ˜'VÁ0¢tÑU$R7GVFVÁEˆñB“C¢‰B7FGW2î‚Çw7V&÷óGFVBr¬v6ˆ◊∆WFVBrê¢í2Ü5˜G&ñÊñÊuˆ7FófóGñ¿¢∂VÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜7GVFVÁEˆñE“¿¢ì∞¢Ü5G&ñÊñÊt7FófóGí“&ˆˆ∆V‚áG&ñÊñÊt7FófóGï&W7V«BÁ&˜w5≥”ÚÊÜ5˜G&ñÊñÊuˆ7FófóGíì∞¢–†¢ñbÜÜ5G&ñÊñÊt7FófóGíí∞¢7FGW2“&6ˆÊfó&÷VB#∞¢7FW“&7FófU˜G&ñÊñÊr#∞¢“V«6RñbáñEVÊ∆ˆ6∂VDVÁ&ˆ∆∆÷VÁBí∞¢ÚÚV÷W&vVÊ7íˆFó&V7B‘D"÷ˆFR◊W7BÜˆÊ˜"FÜR6÷R˜7B◊ñ÷VÁB∆ñfV7ñ6∆P¢ÚÚG'WFÇ2FÜRÊ˜&÷¬7W&6RFÇ‚FÜRV6ˆÊˆ÷ñ27FGW2&V÷ñÁ0¢ÚÚ6W76ñˆÂˆ&ˆˆ∂VB¬vÜñ∆R7W'&VÁE˜7FW÷&∑2FÜBˆÊ&ˆ&FñÊró2˜fW"‡¢7FW“&7FófU˜G&ñÊñÊr#∞¢FV'VrÁ&V6ˆÊ6ñ∆VD7FófUG&ñÊñÊtg&ˆ’ñD66W72“G'VS∞†¢ñbÖ7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÊ7W'&VÁE˜7FW«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí”“&7FófU˜G&ñÊñÊr"í∞¢vóBˆˆ¬ÁVW'íÄ¢UDDRV&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢4UB7W'&VÁE˜7FW“v7FófU˜G&ñÊñÊrr¿¢WFFVEˆB“‰ırÇê¢tÑU$RñB“C¿¢∂VÁ&ˆ∆∆÷VÁBÊñE“¿¢ì∞¢FV'VrÊ7FófU7FW&Wó&VB“G'VS∞¢–¢“V«6RñbÄ¢VÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñBb`¢≤'&˜˜6≈˜6VÁB"¬'6W76ñˆÂˆ&ˆˆ∂VB"¬'&W˜'E˜&V6VófVB"¬&6ˆÊfó&÷VB%“ÊñÊ6«VFW2á7FGW2ê¢í∞¢6ˆÁ7B6W76ñˆÂ&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5B7FGW2¬GóP¢e$Ù“V&∆ñ2Á66ÜVGV∆VE˜6W76ñˆÁ0¢tÑU$Rá&VÁEˆñB“Cı"7GVFVÁEˆñB“C"ê¢‰BGWF˜%ˆñB“C0¢‰BGóRî‚ÇvñÁG&Úr¬wG&ñÊñÊrrê¢ı$DU"%íWFFVEˆBDU42¬7&VFVEˆBDU40¢ƒî‘ïB¿¢∑W6W$ñB¬VÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜7GVFVÁEˆñB¬VÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñE“¿¢ì∞¢6ˆÁ7B6W76ñˆ‚“6W76ñˆÂ&W7V«BÁ&˜w5≥”∞¢ñbÇ6W76ñˆ‚«¬≤&6ˆÊfó&÷VB"¬'&VGí"¬&∆ófR"¬&6ˆ◊∆WFVB%“ÊñÊ6«VFW2Ö7G&ñÊrá6W76ñˆ‚Á7FGW2«¬""ííí∞¢7FGW2“&76ñvÊVB#∞¢7FW“&76ñvÊVB#∞¢–¢–¢FV'VrÊVffV7FófU7FGW2“7FGW3∞¢FV'VrÊVffV7FófU7FW“7FW∞¢&WGW&‚&W2Êß6ˆ‚á∞¢7FGW2¿¢7FW¿¢ˆÊ&ˆ&FñÊuGóS¢ÁV∆¬¿¢g&VU6W76ñˆÁ5&V÷ñÊñÊs¢¿¢∆„¢∆FW7Eñ÷VÁCÚÁ∆‚«¬ÁV∆¬¿¢ñ÷VÁE7FGW3¢∆FW7Eñ÷VÁ@¢Ú7G&ñÊrÜ∆FW7Eñ÷VÁBÁñ÷VÁE˜7FGW2«¬""íÁFıWW$66RÇê¢¢ÁV∆¬¿¢ñ÷VÁDFFS¢∆FW7Eñ÷VÁCÚÁñ÷VÁEˆFFR«¬∆FW7Eñ÷VÁCÚÁñEˆB«¬ÁV∆¬¿¢FV'Vr¿¢“ì∞¢–¢6ˆÁ7BVÁ&ˆ∆∆÷VÁDFV'Vs¢&V6˜&C«7G&ñÊr¬Áì‚“∞¢W6W$ñB¿¢F%W6W$V÷ñ√¢F%W6W#ÚÊV÷ñ¬«¬ÁV∆¬¿¢”∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8“VÁ&ˆ∆∆÷VÁB7FGW26ÜV6≤f˜"W6W#¢"¬W6W$ñB¬'&ˆ∆S¢"¬F%W6W#ÚÁ&ˆ∆Rì∞†¢ÚÚ∆∆˜r∆¬WFÜVÁFñ6FVBW6W'2FÚ6ÜV6≤FÜVó"VÁ&ˆ∆∆÷VÁB7FGW0¢ÚÚÜ÷ñÊ«í&VÁG2¬'WB&R∆VÊñVÁBê¢ ¢ÚÚ6ÜV6≤ñb&VÁBÜ26ˆ◊∆WFVBVÁ&ˆ∆∆÷VÁBW6ñÊr6ÊˆÊñ6¬∆FW7B÷VÁ&ˆ∆∆÷VÁB∆ˆˆ∑W‡¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁDFF¬W'&˜"““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñC¢W6W$ñB¿¢&ñ÷'ï6V∆V7C¢"¢"¿¢&VfW%ñDVÁ&ˆ∆∆÷VÁC¢G'VR¿¢“ì∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊ∆ˆˆ∑WW'&˜"“W'&˜"Ú7G&ñÊrÜW'&˜"Ê÷W76vR«¬W'&˜"í¢ÁV∆√∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊVÁ&ˆ∆∆÷VÁDñB“VÁ&ˆ∆∆÷VÁDFFÚÊñB«¬ÁV∆√∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊVÁ&ˆ∆∆÷VÁE7FGW2“VÁ&ˆ∆∆÷VÁDFFÚÁ7FGW2«¬ÁV∆√∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊVÁ&ˆ∆∆÷VÁE7FW“VÁ&ˆ∆∆÷VÁDFFÚÊ7W'&VÁE˜7FW«¬ÁV∆√∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÁv&‚Ç.)™˚àÚW'&˜"fWF6ÜñÊrVÁ&ˆ∆∆÷VÁB7FGW2áF&∆R÷íÊ˜BWÜó7BñWBì¢"¬W'&˜"Ê÷W76vRì∞¢ÚÚñbF&∆RFˆW6‚wBWÜó7B˜"FÜW&Rw2‚W'&˜"¬ßW7B&WGW&‚Ê˜EˆVÁ&ˆ∆∆V@¢ÚÚFÜó2∆∆˜w2FÜRvFWvíFÚ∆ˆBÊBW6W"6‚7V&÷óBFÜVó"VÁ&ˆ∆∆÷VÁ@¢&WGW&‚&W2Êß6ˆ‚á≤7FGW3¢&Ê˜EˆVÁ&ˆ∆∆VB"¬FV'Vs¢VÁ&ˆ∆∆÷VÁDFV'Vr“ì∞¢–†¢ñbÇVÁ&ˆ∆∆÷VÁDFFí∞¢&WGW&‚&W2Êß6ˆ‚á≤7FGW3¢&Ê˜EˆVÁ&ˆ∆∆VB"¬FV'Vs¢VÁ&ˆ∆∆÷VÁDFV'Vr“ì∞¢–†¢ñbÜVÁ&ˆ∆∆÷VÁDFFÊFV÷ÊEˆf∆˜u˜fW'6ñˆ‚””“bbVÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜GWF˜%ˆñBí∞¢6ˆÁ7B&ñ∆∆ñÊr“vóBvWE&VÁD&ñ∆∆ñÊt÷ˆFV¬áW6W$ñBì∞¢ñbÜ&ñ∆∆ñÊrÊW'&˜"í&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ∆ˆB∆ñ6Fñˆ‚7FGW2"“ì∞¢&WGW&‚&W2Êß6ˆ‚á≤7FGW3¢&vóFñÊuˆ76ñvÊ÷VÁB"¬7FW¢&∆ñ6Fñˆ‚◊&WfñWr"¬ˆÊ&ˆ&FñÊuGóS¢&ñ∆∆ñÊrÊFFÊˆÊ&ˆ&FñÊuGóR¿¢g&VU6W76ñˆÁ5&V÷ñÊñÊs¢¬∆„¢ÁV∆¬¬ñ÷VÁE7FGW3¢ÁV∆¬¬ñ÷VÁDFFS¢ÁV∆¬“ì∞¢–†¢∆WB7FGW2“VÁ&ˆ∆∆÷VÁDFFÁ7FGW2«¬&Ê˜EˆVÁ&ˆ∆∆VB#∞¢∆WBVffV7FófU7FW“VÁ&ˆ∆∆÷VÁDFFÊ7W'&VÁE˜7FW∞¢6ˆÁ7B˜W&FñˆÊƒ÷ˆFR“vóBvWE&VÁD76ñvÊVEGWF˜$˜W&FñˆÊƒ÷ˆFRáW6W$ñBì∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊ˜W&FñˆÊƒ÷ˆFR“˜W&FñˆÊƒ÷ˆFS∞¢6ˆÁ7B6W76ñˆÂGóR“vWDVÁ&ˆ∆∆÷VÁE6W76ñˆÂGóRÜVÁ&ˆ∆∆÷VÁDFFì∞¢VÁ&ˆ∆∆÷VÁDFV'VrÁ6W76ñˆÂGóR“6W76ñˆÂGóS∞¢6ˆÁ7B&ñ∆∆ñÊt÷ˆFV¬“vóBvWE&VÁD&ñ∆∆ñÊt÷ˆFV¬áW6W$ñBì∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊ&ñ∆∆ñÊt÷ˆFVƒW'&˜"“&ñ∆∆ñÊt÷ˆFV¬ÊW'&˜"Ú7G&ñÊrÜ&ñ∆∆ñÊt÷ˆFV¬ÊW'&˜"Ê÷W76vR«¬&ñ∆∆ñÊt÷ˆFV¬ÊW'&˜"í¢ÁV∆√∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊˆÊ&ˆ&FñÊuGóR“&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóS∞¢∆WB6ÊˆÊñ6ƒVÁ&ˆ∆∆÷VÁE7GVFVÁC¢Áí“ÁV∆√∞¢ñbÜVÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜GWF˜%ˆñBí∞¢G'í∞¢6ÊˆÊñ6ƒVÁ&ˆ∆∆÷VÁE7GVFVÁB“vóB&W6ˆ«fT6ÊˆÊñ6≈7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁDFFì∞¢“6F6ÇÜ6ÊˆÊñ6≈7GVFVÁDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$fñ∆VBFÚ&W6ˆ«fR6ÊˆÊñ6¬VÁ&ˆ∆∆÷VÁB7GVFVÁBf˜"&VÁB7FGW3¢"¬6ÊˆÊñ6≈7GVFVÁDW'&˜"ì∞¢–¢–†¢6ˆÁ7B6W76ñˆÂ&ˆw&W72“6ÊˆÊñ6ƒVÁ&ˆ∆∆÷VÁE7GVFVÁCÚÊñ@¢ÚvóBvWD6ˆ◊∆WFVE6W76ñˆ‰6˜VÁDf˜%7GVFVÁBÖ7G&ñÊrÜ6ÊˆÊñ6ƒVÁ&ˆ∆∆÷VÁE7GVFVÁBÊñBíê¢¢VÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜7GVFVÁEˆñ@¢ÚvóBvWD6ˆ◊∆WFVE6W76ñˆ‰6˜VÁDf˜%7GVFVÁBÖ7G&ñÊrÜVÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜7GVFVÁEˆñBíê¢¢≤6˜VÁC¢¬W'&˜#¢ÁV∆¬2Áí”∞¢VÁ&ˆ∆∆÷VÁDFV'VrÁ6W76ñˆÂ&ˆw&W74W'&˜"“6W76ñˆÂ&ˆw&W72ÊW'&˜"Ú7G&ñÊrá6W76ñˆÂ&ˆw&W72ÊW'&˜"Ê÷W76vR«¬6W76ñˆÂ&ˆw&W72ÊW'&˜"í¢ÁV∆√∞¢VÁ&ˆ∆∆÷VÁDFV'VrÁ6W76ñˆÂ&ˆw&W746˜VÁB“6W76ñˆÂ&ˆw&W72Ê6˜VÁB«¬∞†¢∆WB76ñvÊ÷VÁD66WFVB“f«6S∞¢6ˆÁ7B6ÊF&˜ÑVÁ&ˆ∆∆÷VÁD∆ñ∂V«í–¢&ˆˆ∆V‚ÇÜVÁ&ˆ∆∆÷VÁDFF2ÁííÊó5˜6ÊF&˜Öˆ66˜VÁBí«¿¢ó4ÜWW&ó7Fñ56ÊF&˜ÑVÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁDFF¬VÁ&ˆ∆∆÷VÁDFFÚÊ76ñvÊVE˜GWF˜%ˆñBí«¿¢7G&ñÊrÜVffV7FófU7FW«¬""íÁ7F'G5vóFÇÇ'6ÊF&˜Ç“"ì∞†¢ÚÚWFÚ÷6˜'&V7C¢ñb7FGW2ó2vvóFñÊu˜GWF˜%ˆ66WFÊ6Rr¬6ÜV6≤ñbGWF˜"Ü266WFV@¢ñbÄ¢VÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜GWF˜%ˆñBb`¢á7FGW2””“&vóFñÊu˜GWF˜%ˆ66WFÊ6R"«¿¢á6ÊF&˜ÑVÁ&ˆ∆∆÷VÁD∆ñ∂V«íbb7FGW2””“&76ñvÊVB"íê¢í∞¢∆WB66WFVDVÁ&ˆ∆∆÷VÁE7GVFVÁB“6ÊˆÊñ6ƒVÁ&ˆ∆∆÷VÁE7GVFVÁC∞¢∆WB76ñvÊVEv˜&∂f∆˜r“ÇÜ66WFVDVÁ&ˆ∆∆÷VÁE7GVFVÁCÚÁW'6ˆÊ≈&ˆfñ∆R2Áíí«¬∑“íÁv˜&∂f∆˜r«¬∑”∞†¢ñbÇ76ñvÊVEv˜&∂f∆˜rÊ76ñvÊ÷VÁD66WFVDBí∞¢G'í∞¢6ˆÁ7B&V6ˆÊ6ñ∆VD66WFVE7GVFVÁB“vóB&W6ˆ«fT66WFVE7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁDFFì∞¢ñbá&V6ˆÊ6ñ∆VD66WFVE7GVFVÁBí∞¢66WFVDVÁ&ˆ∆∆÷VÁE7GVFVÁB“&V6ˆÊ6ñ∆VD66WFVE7GVFVÁC∞¢6ÊˆÊñ6ƒVÁ&ˆ∆∆÷VÁE7GVFVÁB“&V6ˆÊ6ñ∆VD66WFVE7GVFVÁC∞¢76ñvÊVEv˜&∂f∆˜r“Çá&V6ˆÊ6ñ∆VD66WFVE7GVFVÁCÚÁW'6ˆÊ≈&ˆfñ∆R2Áíí«¬∑“íÁv˜&∂f∆˜r«¬∑”∞†¢ñbÄ¢VÁ&ˆ∆∆÷VÁDFFÊñBb`¢Ö7G&ñÊrÜVÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜7GVFVÁEˆñB«¬""íÁG&ñ“Çí”“7G&ñÊrá&V6ˆÊ6ñ∆VD66WFVE7GVFVÁBÊñB«¬""íÁG&ñ“Çí«¿¢7FGW2”“&76ñvÊVB"«¿¢VffV7FófU7FW”“&76ñvÊVB"ê¢í∞¢vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢ÁWFFRá∞¢76ñvÊVE˜7GVFVÁEˆñC¢&V6ˆÊ6ñ∆VD66WFVE7GVFVÁBÊñB¿¢7FGW3¢&76ñvÊVB"¿¢7W'&VÁE˜7FW¢&76ñvÊVB"¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁDFFÊñBì∞¢–¢–¢“6F6ÇÜ66WFVE7GVFVÁE&W6ˆ«WFñˆ‰W'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$fñ∆VBFÚ&W6ˆ«fR66WFVB7GVFVÁBf˜"VÁ&ˆ∆∆÷VÁC¢"¬66WFVE7GVFVÁE&W6ˆ«WFñˆ‰W'&˜"ì∞¢–¢–†¢76ñvÊ÷VÁD66WFVB“76ñvÊVEv˜&∂f∆˜rÊ76ñvÊ÷VÁD66WFVDC∞¢6ˆÁ7B6ÊF&˜Ñ76ñvÊVD66WFÊ6T∆ñ∂V«í–¢6ÊF&˜ÑVÁ&ˆ∆∆÷VÁD∆ñ∂V«íb`¢7FGW2””“&76ñvÊVB"b`¢Ä¢Ü5˜7E&˜fó6ñˆ‰76ñvÊ÷VÁEWFFRÜVÁ&ˆ∆∆÷VÁDFFí«¿¢7G&ñÊrÜVffV7FófU7FW«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí””“'6ÊF&˜Ç÷76ñvÊVB ¢ì∞†¢ÚÚ∆Vv7í6ÊF&˜Ç&˜w2vW&R&˜fó6ñˆÊVB276ñvÊVB&Vf˜&R66WFÊ6R‚Ê˜&÷∆ó¶RFÜV“&6∞¢ÚÚFÚFÜR∆ófR÷WVóf∆VÁB66WFÊ6R7FFRVÁFñ¬FÜRGWF˜"7GV∆«í66WG2‡¢ñbÄ¢6ÊF&˜ÑVÁ&ˆ∆∆÷VÁD∆ñ∂V«íb`¢7FGW2””“&76ñvÊVB"b`¢76ñvÊ÷VÁD66WFVBb`¢6ÊF&˜Ñ76ñvÊVD66WFÊ6T∆ñ∂V«ê¢í∞¢7FGW2“&vóFñÊu˜GWF˜%ˆ66WFÊ6R#∞¢VffV7FófU7FW“&vóFñÊu˜GWF˜%ˆ66WFÊ6R#∞¢“V«6RñbÜ76ñvÊ÷VÁD66WFVB«¬6ÊF&˜Ñ76ñvÊVD66WFÊ6T∆ñ∂V«íí∞¢7FGW2“&76ñvÊVB#∞¢VffV7FófU7FW“&76ñvÊVB#∞¢–¢–†¢ñbÄ¢ó4∆ófU66ÜVGV∆ñÊt÷ˆFRÜ˜W&FñˆÊƒ÷ˆFRíb`¢VÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜GWF˜%ˆñBb`¢≤'&˜˜6≈˜6VÁB"¬'6W76ñˆÂˆ&ˆˆ∂VB"¬'&W˜'E˜&V6VófVB"¬&6ˆÊfó&÷VB%“ÊñÊ6«VFW2Ö7G&ñÊrá7FGW2íê¢í∞¢∆WB∆FW7E6W76ñˆ„¢Áí“ÁV∆√∞†¢6ˆÁ7BFó&V7E6W76ñˆ‰∆ˆˆ∑W“vóB7W&6P¢Êg&ˆ“Ç'66ÜVGV∆VE˜6W76ñˆÁ2"ê¢Á6V∆V7BÇ&ñB¬7FGW2¬&VÁEˆ6ˆÊfó&÷VB¬GWF˜%ˆ6ˆÊfó&÷VB¬7&VFVEˆB¬WFFVEˆB¬GóR"ê¢ÊWÇ'&VÁEˆñB"¬W6W$ñBê¢ÊWÇ'GWF˜%ˆñB"¬VÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜GWF˜%ˆñBê¢ÊWÇ'GóR"¬6W76ñˆÂGóRê¢Ê˜&FW"Ç'WFFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉì∞†¢∆FW7E6W76ñˆ‚“Fó&V7E6W76ñˆ‰∆ˆˆ∑WÊFFÚÂ≥“«¬ÁV∆√∞†¢ñbÇ∆FW7E6W76ñˆ‚bbVÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜7GVFVÁEˆñBí∞¢6ˆÁ7Bf∆∆&6µ6W76ñˆ‰∆ˆˆ∑W“vóB7W&6P¢Êg&ˆ“Ç'66ÜVGV∆VE˜6W76ñˆÁ2"ê¢Á6V∆V7BÇ&ñB¬7FGW2¬&VÁEˆ6ˆÊfó&÷VB¬GWF˜%ˆ6ˆÊfó&÷VB¬7&VFVEˆB¬WFFVEˆB¬GóR"ê¢ÊWÇ'7GVFVÁEˆñB"¬VÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜7GVFVÁEˆñBê¢ÊWÇ'GWF˜%ˆñB"¬VÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜GWF˜%ˆñBê¢ÊWÇ'GóR"¬6W76ñˆÂGóRê¢Ê˜&FW"Ç'WFFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉì∞†¢∆FW7E6W76ñˆ‚“f∆∆&6µ6W76ñˆ‰∆ˆˆ∑WÊFFÚÂ≥“«¬ÁV∆√∞¢–†¢6ˆÁ7B&ˆˆ∂ñÊu&W&WVó6óFU6Fó6fñVB“∆FW7E6W76ñˆ‡¢Ú≤&6ˆÊfó&÷VB"¬'&VGí"¬&∆ófR"¬&6ˆ◊∆WFVB%“ÊñÊ6«VFW2ÜvWDVffV7FófU66ÜVGV∆VE6W76ñˆÂ7FGW2Ü∆FW7E6W76ñˆ‚íê¢¢f«6S∞†¢ñbÇ&ˆˆ∂ñÊu&W&WVó6óFU6Fó6fñVBí∞¢7FGW2“&76ñvÊVB#∞¢–¢–†¢∆WB≤FF¢∆FW7Eñ÷VÁB““vóBvWD∆FW7Eñ÷VÁDf˜$VÁ&ˆ∆∆÷VÁBÖ7G&ñÊrÜVÁ&ˆ∆∆÷VÁDFFÊñBíì∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊ∆FW7Eñ÷VÁDñB“∆FW7Eñ÷VÁCÚÊñB«¬ÁV∆√∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊ∆FW7Eñ÷VÁE7FGW2“∆FW7Eñ÷VÁCÚÁñ÷VÁE˜7FGW2«¬ÁV∆√∞†¢6ˆÁ7BñEVÊ∆ˆ6∂VDVÁ&ˆ∆∆÷VÁB–¢7G&ñÊrá7FGW2í””“'6W76ñˆÂˆ&ˆˆ∂VB"b`¢7G&ñÊrÜ∆FW7Eñ÷VÁCÚÁñ÷VÁE˜7FGW2«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí””“'ñB#∞†¢ñbáñEVÊ∆ˆ6∂VDVÁ&ˆ∆∆÷VÁBí∞¢VffV7FófU7FW“&7FófU˜G&ñÊñÊr#∞¢VÁ&ˆ∆∆÷VÁDFV'VrÁ&V6ˆÊ6ñ∆VD7FófUG&ñÊñÊtg&ˆ’ñD66W72“G'VS∞†¢ñbÖ7G&ñÊrÜVÁ&ˆ∆∆÷VÁDFFÊ7W'&VÁE˜7FW«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí”“&7FófU˜G&ñÊñÊr"í∞¢6ˆÁ7B≤W'&˜#¢7FófU7FW&Wó$W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢ÁWFFRá∞¢7W'&VÁE˜7FW¢&7FófU˜G&ñÊñÊr"¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁDFFÊñBì∞†¢ñbÜ7FófU7FW&Wó$W'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$fñ∆VBFÚW'6ó7B7FófR◊G&ñÊñÊr&V6ˆÊ6ñ∆ñFñˆ„¢"¬7FófU7FW&Wó$W'&˜"ì∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊ7FófU7FW&Wó$W'&˜"“7G&ñÊrÄ¢7FófU7FW&Wó$W'&˜"Ê÷W76vR«¬7FófU7FW&Wó$W'&˜"¿¢ì∞¢“V«6R∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊ7FófU7FW&Wó&VB“G'VS∞¢–¢–¢–†¢ñbÖ7G&ñÊrá7FGW2í””“'&˜˜6≈˜6VÁB"í∞¢6ˆÁ7B≤FF¢∆FW7EñEñ÷VÁB¬W'&˜#¢∆FW7EñEñ÷VÁDW'&˜"““vóBvWD∆FW7EñEñ÷VÁDf˜$VÁ&ˆ∆∆÷VÁBÄ¢7G&ñÊrÜVÁ&ˆ∆∆÷VÁDFFÊñBí¿¢ì∞†¢ñbÜ∆FW7EñEñ÷VÁDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$fñ∆VBFÚ&W6ˆ«fRñBñ÷VÁBf˜"&˜˜6¬fñÊ∆ó¶Fñˆ„¢"¬∆FW7EñEñ÷VÁDW'&˜"ì∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊ∆FW7EñEñ÷VÁDW'&˜"“7G&ñÊrÜ∆FW7EñEñ÷VÁDW'&˜"Ê÷W76vR«¬∆FW7EñEñ÷VÁDW'&˜"ì∞¢“V«6RñbÜ∆FW7EñEñ÷VÁBí∞¢G'í∞¢6ˆÁ7BfñÊ∆ó¶VB“vóBfñÊ∆ó¶T66WFVE&˜˜6ƒg&ˆ’ñ÷VÁBÜ∆FW7EñEñ÷VÁBì∞¢∆FW7Eñ÷VÁB“∆FW7EñEñ÷VÁC∞¢7FGW2“fñÊ∆ó¶VBÁ7FGW3∞¢VffV7FófU7FW“fñÊ∆ó¶VBÁ7FGW3∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊWFÙfñÊ∆ó¶VDg&ˆ’ñEñ÷VÁB“G'VS∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊ∆FW7Eñ÷VÁDñB“∆FW7EñEñ÷VÁBÊñB«¬VÁ&ˆ∆∆÷VÁDFV'VrÊ∆FW7Eñ÷VÁDñC∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊ∆FW7Eñ÷VÁE7FGW2“∆FW7EñEñ÷VÁBÁñ÷VÁE˜7FGW2«¬VÁ&ˆ∆∆÷VÁDFV'VrÊ∆FW7Eñ÷VÁE7FGW3∞¢“6F6ÇÜfñÊ∆ó¶Fñˆ‰W'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$fñ∆VBFÚWFÚ÷fñÊ∆ó¶RñB&˜˜6¬g&ˆ“VÁ&ˆ∆∆÷VÁB7FGW3¢"¬fñÊ∆ó¶Fñˆ‰W'&˜"ì∞¢VÁ&ˆ∆∆÷VÁDFV'VrÊWFÙfñÊ∆ó¶Fñˆ‰W'&˜"–¢fñÊ∆ó¶Fñˆ‰W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚfñÊ∆ó¶Fñˆ‰W'&˜"Ê÷W76vR¢7G&ñÊrÜfñÊ∆ó¶Fñˆ‰W'&˜"ì∞¢–¢–¢–†¢&W2Êß6ˆ‚á∞¢7FGW2¿¢7FW¢VffV7FófU7FW¿¢ˆÊ&ˆ&FñÊuGóS¢&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóR¿¢g&VU6W76ñˆÁ5&V÷ñÊñÊs†¢&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóR””“'ñ∆˜B ¢Ú÷FÇÊ÷ÇÉ¬í“á6W76ñˆÂ&ˆw&W72Ê6˜VÁB«¬íê¢¢¿¢∆„¢∆FW7Eñ÷VÁCÚÁ∆‚«¬DTdT≈Eı4U%dî4Uı4¥tRÊ∆&V¬¿¢ñ÷VÁE7FGW3¢∆FW7Eñ÷VÁ@¢Ú7G&ñÊrÜ∆FW7Eñ÷VÁBÁñ÷VÁE˜7FGW2«¬""íÁFıWW$66RÇê¢¢&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóR””“'ñ∆˜B"bbá6W76ñˆÂ&ˆw&W72Ê6˜VÁB«¬í¬ê¢Ú$e$TUÙ44U52 ¢¢%TÂîB"¿¢ñ÷VÁDFFS¢∆FW7Eñ÷VÁCÚÁñ÷VÁEˆFFR«¬∆FW7Eñ÷VÁCÚÁñEˆB«¬ÁV∆¬¿¢FV'Vs¢VÁ&ˆ∆∆÷VÁDFV'Vr¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚VÁ&ˆ∆∆÷VÁB◊7FGW3¢"¬W'&˜"ì∞¢ÚÚˆ‚W'&˜"¬77V÷RÊ˜EˆVÁ&ˆ∆∆VB6ÚvFWví6‚&ˆ6VV@¢&W2Êß6ˆ‚á∞¢7FGW3¢&Ê˜EˆVÁ&ˆ∆∆VB"¿¢FV'Vs¢∞¢&˜WFTW'&˜#¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢7G&ñÊrÜW'&˜"í¿¢“¿¢“ì∞¢–¢“ì∞†¢ÚÚvWBGWF˜"&ˆfñ∆Rf˜"&VÁ@¢ÊvWBÇ"ˆí˜&VÁBˆ76ñvÊVB◊GWF˜""¬ó4WFÜVÁFñ6FVB¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤fWF6ÜñÊr76ñvÊVBGWF˜"f˜"&VÁC¢"¬W6W$ñBì∞†¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁDFF¬W'&˜"““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñC¢W6W$ñB¿¢&ñ÷'ï6V∆V7C¢&76ñvÊVE˜GWF˜%ˆñB"¿¢“ì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤VÁ&ˆ∆∆÷VÁBFF¢"¬VÁ&ˆ∆∆÷VÁDFF¬$W'&˜#¢"¬W'&˜"ì∞†¢ñbÜW'&˜"«¬VÁ&ˆ∆∆÷VÁDFF«¬VÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜GWF˜%ˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚGWF˜"76ñvÊVB"“ì∞¢–†¢ÚÚfWF6ÇGWF˜"ñÊfÚg&ˆ“V&∆ñ2ÁW6W'0¢6ˆÁ7BGWF˜"“vóB7F˜&vRÊvWEW6W"ÜVÁ&ˆ∆∆÷VÁDFFÊ76ñvÊVE˜GWF˜%ˆñBì∞¢ñbÇGWF˜"í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%GWF˜"Ê˜Bf˜VÊB"“ì∞¢–¢6ˆÁ7BGWF˜%&ˆfñ∆R“∞¢ñC¢GWF˜"ÊñB¿¢Ê÷S¢GWF˜"ÊÊ÷R¿¢V÷ñ√¢GWF˜"ÊV÷ñ¬¿¢&ñÛ¢GWF˜"Ê&ñÚ«¬VÊFVfñÊVB¿¢ÜˆÊS¢GWF˜"ÁÜˆÊR«¬VÊFVfñÊVB¿¢&ˆfñ∆Uˆñ÷vU˜W&√¢GWF˜"Á&ˆfñ∆Tñ÷vUW&¬«¬VÊFVfñÊVB¿¢”∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤&WGW&ÊñÊrGWF˜"&ˆfñ∆RáV&∆ñ2ÁW6W'2ì¢"¬GWF˜%&ˆfñ∆Rì∞¢&W2Êß6ˆ‚áGWF˜%&ˆfñ∆Rì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr76ñvÊVBGWF˜"ÜF÷ñ‚íì¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇGWF˜"&ˆfñ∆R"“ì∞¢–¢“ì∞†¢ÚÚ7V&÷óB&VÁBVÁ&ˆ∆∆÷VÁBf˜&–¢Á˜7BÇ"ˆí˜&VÁBˆVÁ&ˆ∆¬"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W#ÚÊñB«¬á&WÁ6W76ñˆ‚2ÁíìÚÁW6W$ñC∞¢6ˆÁ7BF%W6W"“á&W2ÁííÊF%W6W#∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8“VÁ&ˆ∆∆÷VÁB7V&÷ó76ñˆ‚f˜"W6W#¢"¬W6W$ñB¬'&ˆ∆S¢"¬F%W6W#ÚÁ&ˆ∆Rì∞†¢ÚÚ∆∆˜r∆¬WFÜVÁFñ6FVBW6W'2FÚ7V&÷óBVÁ&ˆ∆∆÷VÁ@¢ÚÚÜ÷ñÊ«í&VÁG2¬'WB&R∆VÊñVÁBGW&ñÊrFWfV∆˜÷VÁBê¢ ¢6ˆÁ7B∞¢&VÁDgV∆ƒÊ÷R¿¢&VÁEÜˆÊR¿¢&VÁDV÷ñ¬¿¢&VÁD6óGí¿¢7GVFVÁDgV∆ƒÊ÷R¿¢7GVFVÁDw&FR¿¢7GVFVÁDvVÊFW"¿¢66ÜˆˆƒÊ÷R¿¢7GV6¥&V2¿¢&W˜'FVEF˜ñ73¢&u&W˜'FVEF˜ñ72¿¢&Wfñ˜W5GWF˜&ñÊr¿¢ñÁFW&ÊWD66W72¿¢&W7ˆÁ6U7ñ◊Fˆ◊3¢&u&W7ˆÁ6U7ñ◊Fˆ◊2¿¢F˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊3¢&uF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2¿¢&VÁD÷˜FófFñˆ‚¿¢&ˆ6W74∆ñvÊ÷VÁB¿¢w&VVEFıFW&◊2¿¢ffñ∆ñFT6ˆFS¢&ˆGîffñ∆ñFT6ˆFP¢““&WÊ&ˆGì∞†¢6ˆÁ7B&W˜'FVEF˜ñ72“'Vñ∆E&W˜'FVEF˜ñ72Ä¢&uF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2¿¢&u&W˜'FVEF˜ñ70¢ì∞¢6ˆÁ7BÊ˜&÷∆ó¶VEF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2“&W˜'FVEF˜ñ72Á&VGV6S≈&V6˜&C«7G&ñÊr¬7G&ñÊuµ”„‚ÇÜ62¬F˜ñ2í”‚∞¢6ˆÁ7B&uF˜ñ57ñ◊Fˆ◊2–¢&uF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2bbGóVˆb&uF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2””“&ˆ&¶V7B ¢Úá&uF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊22&V6˜&C«7G&ñÊr¬VÊ∂Ê˜v„‚ï∑F˜ñ5–¢¢µ”∞¢65∑F˜ñ5““Ê˜&÷∆ó¶U&W7ˆÁ6U7ñ◊Fˆ◊2á&uF˜ñ57ñ◊Fˆ◊2ì∞¢&WGW&‚63∞¢“¬∑“ì∞¢6ˆÁ7BÊ˜&÷∆ó¶VE&W7ˆÁ6U7ñ◊Fˆ◊2“Ê˜&÷∆ó¶U&W7ˆÁ6U7ñ◊Fˆ◊2á&u&W7ˆÁ6U7ñ◊Fˆ◊2ì∞¢6ˆÁ7Bf∆GFVÊVEF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2“'&íÊg&ˆ“Ä¢ÊWr6WBÑˆ&¶V7BÁf«VW2ÜÊ˜&÷∆ó¶VEF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2íÊf∆BÇíê¢ì∞¢6ˆÁ7BVffV7FófU&W7ˆÁ6U7ñ◊Fˆ◊2–¢f∆GFVÊVEF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2Ê∆VÊwFÇ‚Úf∆GFVÊVEF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2¢Ê˜&÷∆ó¶VE&W7ˆÁ6U7ñ◊Fˆ◊3∞¢6ˆÁ7BF˜ñ5&W7ˆÁ6U&V6ˆ÷÷VÊFFñˆÁ2“ˆ&¶V7BÊg&ˆ‘VÁG&ñW2Ä¢ˆ&¶V7BÊVÁG&ñW2ÜÊ˜&÷∆ó¶VEF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2íÊ÷ÇÖ∑F˜ñ2¬7ñ◊Fˆ‘ñG5“í”‚∞¢6ˆÁ7B&V6ˆ÷÷VÊFFñˆ‚“&V6ˆ÷÷VÊE7F'FñÊuÜ6Tg&ˆ’7ñ◊Fˆ◊2á7ñ◊Fˆ‘ñG2ì∞¢&WGW&‚∞¢F˜ñ2¿¢∞¢Ü6S¢&V6ˆ÷÷VÊFFñˆ‚ÁÜ6R¿¢66˜&W3¢&V6ˆ÷÷VÊFFñˆ‚Á66˜&W2¿¢7W˜'FñÊu7ñ◊Fˆ◊3¢&V6ˆ÷÷VÊFFñˆ‚Á7W˜'FñÊu7ñ◊Fˆ◊2¿¢&FñˆÊ∆S¢'Vñ∆E7F'FñÊuÜ6U&FñˆÊ∆Rá&V6ˆ÷÷VÊFFñˆ‚ÁÜ6R¬&V6ˆ÷÷VÊFFñˆ‚Á7W˜'FñÊu7ñ◊Fˆ◊2í¿¢“¿¢”∞¢“ê¢ì∞¢6ˆÁ7B&W7ˆÁ6U&V6ˆ÷÷VÊFFñˆ‚“&V6ˆ÷÷VÊE7F'FñÊuÜ6Tg&ˆ’7ñ◊Fˆ◊2ÜVffV7FófU&W7ˆÁ6U7ñ◊Fˆ◊2ì∞¢6ˆÁ7B&W7ˆÁ6U7ñ◊Fˆ◊2“vWE&W7ˆÁ6U7ñ◊Fˆ‘∆&V«2ÜVffV7FófU&W7ˆÁ6U7ñ◊Fˆ◊2ì∞†¢6ˆÁ7BÊ˜&÷∆ó¶VE&VÁD÷˜FófFñˆ‚“∞¢&VÁD÷˜FófFñˆ‚¿¢&ˆ6W74∆ñvÊ÷VÁBÚ&ˆ6W72∆ñvÊ÷VÁC¢G∑&ˆ6W74∆ñvÊ÷VÁG÷¢""¿¢&W7ˆÁ6U7ñ◊Fˆ◊2Ê∆VÊwFÇ‚ ¢Úˆ'6W'fVB&W7ˆÁ6R7ñ◊Fˆ◊3¢G∑&W7ˆÁ6U7ñ◊Fˆ◊2Ê¶ˆñ‚Ç"¬"ó÷ ¢¢""¿¢–¢Êfñ«FW"Ñ&ˆˆ∆V‚ê¢Ê¶ˆñ‚Ç%∆‚"ì∞¢ÚÚW6Rffñ∆ñFR6ˆFRg&ˆ“6W76ñˆ‚ñbÊ˜B&W6VÁBñ‚&ˆGê¢∆WBffñ∆ñFT6ˆFR“&ˆGîffñ∆ñFT6ˆFR«¬&WÁ6W76ñˆ‚Êffñ∆ñFT6ˆFR«¬ÁV∆√∞¢ñbÜffñ∆ñFT6ˆFRí∞¢ÚÚ&V÷˜fRg&ˆ“6W76ñˆ‚gFW"W6P¢&WÁ6W76ñˆ‚Êffñ∆ñFT6ˆFR“VÊFVfñÊVC∞¢–†¢ÚÚf∆ñFFR&WVó&VBfñV∆G0¢ñbÄ¢&VÁDgV∆ƒÊ÷R«¿¢&VÁEÜˆÊR«¿¢7GVFVÁDgV∆ƒÊ÷R«¿¢7GVFVÁDw&FR«¿¢7GVFVÁDvVÊFW"«¿¢66ÜˆˆƒÊ÷R«¿¢&W˜'FVEF˜ñ72Ê∆VÊwFÇ””“«¿¢&W˜'FVEF˜ñ72Á6ˆ÷RÇáF˜ñ2í”‚ÜÊ˜&÷∆ó¶VEF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊5∑F˜ñ5“«¬µ“íÊ∆VÊwFÇ””“í«¿¢&Wfñ˜W5GWF˜&ñÊr«¿¢ñÁFW&ÊWD66W72«¿¢w&VVEFıFW&◊0¢í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$÷ó76ñÊr&WVó&VBfñV∆G2"“ì∞¢–††¢ñbá&ˆ6W72ÊVÁbÂdU$4T≈ÙTÂb””“'&WfñWr"í∞¢6ˆÁ7BWÜó7FñÊtVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5Bñ@¢e$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$RW6W%ˆñB“C¢ı$DU"%íWFFVEˆBDU40¢ƒî‘ïB¿¢∑W6W$ñE“¿¢ì∞¢ñbÜWÜó7FñÊtVÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥“í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$VÁ&ˆ∆∆÷VÁB«&VGí7V&÷óGFVB"“ì∞¢–¢“V«6R∞¢ÚÚ6ÜV6≤ñbVÁ&ˆ∆∆÷VÁB«&VGíWÜó7G0¢6ˆÁ7B≤FF¢WÜó7FñÊr““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ'W6W%ˆñB"¬W6W$ñBê¢Ê÷ñ&U6ñÊv∆RÇì∞¢ ¢ñbÜWÜó7FñÊrí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$VÁ&ˆ∆∆÷VÁB«&VGí7V&÷óGFVB"“ì∞¢–¢ ¢ ¢ ¢ ¢–†¢ÚÚ&W6ˆ«fRFÜRGW&&∆R6ñvÁW∆ñÊVvS≤ÊWfW"FW&ófRVÁG'íGóRg&ˆ“∆ñÊ≤˜"&VÁBñÁWB‡¢G'í∞¢vóB6GW&TFV÷ÊE&VÁBá7W&6R¬7F˜&vR¬∞¢W6W$ñB¬gV∆ƒÊ÷S¢&VÁDgV∆ƒÊ÷R¬V÷ñ√¢&VÁDV÷ñ¬¿¢6ˆFS¢ffñ∆ñFT6ˆFR¬6˜W&6S¢á&WÁ6W76ñˆ‚2ÁííÁG&6∂ñÊu6˜W&6R¿¢6◊ñv„¢á&WÁ6W76ñˆ‚2ÁííÁG&6∂ñÊt6◊ñv‚¿¢“ì∞¢“6F6ÇÜ6GW&TW'&˜"í∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢6GW&TW'&˜"ñÁ7FÊ6VˆbW'&˜"Ú6GW&TW'&˜"Ê÷W76vR¢$6˜V∆BÊ˜B&W6W'fR∆ñ6Fñˆ‚6˜W&6R"“ì∞¢–†¢ÚÚ∆VB7&VFñˆ‚ó2Ê˜rÜÊF∆VBgFW"6ñvÁW¬Ê˜BVÁ&ˆ∆∆÷VÁB‡†¢ñbá&ˆ6W72ÊVÁbÂdU$4T≈ÙTÂb””“'&WfñWr"í∞¢ÚÚ&WfñWrW6W2FÜRWFÜ˜&óFFófR˜7Fw&U5¬FÇ&V6W6R&ˆˆbÜ2ÊÚ6W'fñ6R◊&ˆ∆R∂Wí‡¢6ˆÁ7BF˜ñ56ñvÊ≈66˜&W2“ˆ&¶V7BÊg&ˆ‘VÁG&ñW2Ä¢ˆ&¶V7BÊVÁG&ñW2áF˜ñ5&W7ˆÁ6U&V6ˆ÷÷VÊFFñˆÁ2íÊ÷ÇÖ∑F˜ñ2¬f«VU“í”‚∑F˜ñ2¬áf«VR2ÁííÁ66˜&W5“ê¢ì∞¢6ˆÁ7BF˜ñ57F'FñÊuÜ6W2“ˆ&¶V7BÊg&ˆ‘VÁG&ñW2Ä¢ˆ&¶V7BÊVÁG&ñW2áF˜ñ5&W7ˆÁ6U&V6ˆ÷÷VÊFFñˆÁ2íÊ÷ÇÖ∑F˜ñ2¬f«VU“í”‚∞¢F˜ñ2¿¢∞¢Ü6S¢áf«VR2ÁííÁÜ6R¿¢7W˜'FñÊu7ñ◊Fˆ◊3¢áf«VR2ÁííÁ7W˜'FñÊu7ñ◊Fˆ◊2¿¢&FñˆÊ∆S¢áf«VR2ÁííÁ&FñˆÊ∆R¿¢“¿¢“ê¢ì∞¢ ¢6ˆÁ7BVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢îÂ4U%BîÂDÚV&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG2Ä¢W6W%ˆñB¬&VÁEˆgV∆≈ˆÊ÷R¬&VÁE˜ÜˆÊR¬&VÁEˆV÷ñ¬¬&VÁEˆ6óGí¿¢7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬7GVFVÁEˆvVÊFW"¬66Üˆˆ≈ˆÊ÷R¿¢&W7ˆÁ6U˜7ñ◊Fˆ◊2¬F˜ñ5˜&W7ˆÁ6U˜7ñ◊Fˆ◊2¬&W7ˆÁ6U˜6ñvÊ≈˜66˜&W2¿¢F˜ñ5˜&W7ˆÁ6U˜6ñvÊ≈˜66˜&W2¬&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6R¿¢F˜ñ5˜&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6W2¬&Wfñ˜W5˜GWF˜&ñÊr¬ñÁFW&ÊWEˆ66W72¿¢&VÁEˆ÷˜FófFñˆ‚¬7FGW2¬7W'&VÁE˜7FW¬FV÷ÊEˆf∆˜u˜fW'6ñˆ‚¿¢V∆ñfñ6FñˆÂ˜7FGW2¬7&VFVEˆB¬WFFVEˆ@¢íd≈TU2Ä¢C¬C"¬C2¬CB¬CR¬Cb¬Cr¬CÇ¬Cí¿¢C£¶ß6ˆÊ"¬C£¶ß6ˆÊ"¬C#£¶ß6ˆÊ"¬C3£¶ß6ˆÊ"¬CB¬CS£¶ß6ˆÊ"¿¢Cb¬Cr¬CÇ¬vvóFñÊuˆ76ñvÊ÷VÁBr¬wV∆ñfñ6Fñˆ‚◊VÊFñÊrr√¬wVÊFñÊrrƒ‰ırÇíƒ‰ırÇê¢ê¢$UEU$‰î‰r¶¿¢∞¢W6W$ñB¿¢&VÁDgV∆ƒÊ÷R¿¢&VÁEÜˆÊR¿¢&VÁDV÷ñ¬¿¢&VÁD6óGí«¬ÁV∆¬¿¢7GVFVÁDgV∆ƒÊ÷R¿¢7GVFVÁDw&FR¿¢7GVFVÁDvVÊFW"¿¢66ÜˆˆƒÊ÷R¿¢•4Ù‚Á7G&ñÊvñgíÜVffV7FófU&W7ˆÁ6U7ñ◊Fˆ◊2í¿¢•4Ù‚Á7G&ñÊvñgíÜÊ˜&÷∆ó¶VEF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2í¿¢•4Ù‚Á7G&ñÊvñgíá&W7ˆÁ6U&V6ˆ÷÷VÊFFñˆ‚Á66˜&W2í¿¢•4Ù‚Á7G&ñÊvñgíáF˜ñ56ñvÊ≈66˜&W2í¿¢&W7ˆÁ6U&V6ˆ÷÷VÊFFñˆ‚ÁÜ6R¿¢•4Ù‚Á7G&ñÊvñgíáF˜ñ57F'FñÊuÜ6W2í¿¢&Wfñ˜W5GWF˜&ñÊr¿¢ñÁFW&ÊWD66W72¿¢Ê˜&÷∆ó¶VE&VÁD÷˜FófFñˆ‚¿¢“¿¢ì∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁDFF“VÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w3∞¢ ¢&W2Êß6ˆ‚á∞¢÷W76vS¢$VÁ&ˆ∆∆÷VÁB7V&÷óGFVB7V66W76gV∆«í"¿¢VÁ&ˆ∆∆÷VÁC¢VÁ&ˆ∆∆÷VÁDFFÚÂ≥“¿¢“ì∞¢ ¢“V«6R∞¢ÚÚ7&VFRVÁ&ˆ∆∆÷VÁB&V6˜&@¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁDFF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢ÊñÁ6W'Bá∞¢W6W%ˆñC¢W6W$ñB¿¢&VÁEˆgV∆≈ˆÊ÷S¢&VÁDgV∆ƒÊ÷R¿¢&VÁE˜ÜˆÊS¢&VÁEÜˆÊR¿¢&VÁEˆV÷ñ√¢&VÁDV÷ñ¬¿¢&VÁEˆ6óGì¢&VÁD6óGí¿¢7GVFVÁEˆgV∆≈ˆÊ÷S¢7GVFVÁDgV∆ƒÊ÷R¿¢7GVFVÁEˆw&FS¢7GVFVÁDw&FR¿¢7GVFVÁEˆvVÊFW#¢7GVFVÁDvVÊFW"¿¢66Üˆˆ≈ˆÊ÷S¢66ÜˆˆƒÊ÷R¿¢&W7ˆÁ6U˜7ñ◊Fˆ◊3¢VffV7FófU&W7ˆÁ6U7ñ◊Fˆ◊2¿¢F˜ñ5˜&W7ˆÁ6U˜7ñ◊Fˆ◊3¢Ê˜&÷∆ó¶VEF˜ñ5&W7ˆÁ6U7ñ◊Fˆ◊2¿¢&W7ˆÁ6U˜6ñvÊ≈˜66˜&W3¢&W7ˆÁ6U&V6ˆ÷÷VÊFFñˆ‚Á66˜&W2¿¢F˜ñ5˜&W7ˆÁ6U˜6ñvÊ≈˜66˜&W3¢ˆ&¶V7BÊg&ˆ‘VÁG&ñW2Ä¢ˆ&¶V7BÊVÁG&ñW2áF˜ñ5&W7ˆÁ6U&V6ˆ÷÷VÊFFñˆÁ2íÊ÷ÇÖ∑F˜ñ2¬f«VU“í”‚∑F˜ñ2¬áf«VR2ÁííÁ66˜&W5“ê¢í¿¢&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6S¢&W7ˆÁ6U&V6ˆ÷÷VÊFFñˆ‚ÁÜ6R¿¢F˜ñ5˜&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6W3¢ˆ&¶V7BÊg&ˆ‘VÁG&ñW2Ä¢ˆ&¶V7BÊVÁG&ñW2áF˜ñ5&W7ˆÁ6U&V6ˆ÷÷VÊFFñˆÁ2íÊ÷ÇÖ∑F˜ñ2¬f«VU“í”‚∞¢F˜ñ2¿¢∞¢Ü6S¢áf«VR2ÁííÁÜ6R¿¢7W˜'FñÊu7ñ◊Fˆ◊3¢áf«VR2ÁííÁ7W˜'FñÊu7ñ◊Fˆ◊2¿¢&FñˆÊ∆S¢áf«VR2ÁííÁ&FñˆÊ∆R¿¢“¿¢“ê¢í¿¢&Wfñ˜W5˜GWF˜&ñÊs¢&Wfñ˜W5GWF˜&ñÊr¿¢ñÁFW&ÊWEˆ66W73¢ñÁFW&ÊWD66W72¿¢&VÁEˆ÷˜FófFñˆ„¢Ê˜&÷∆ó¶VE&VÁD÷˜FófFñˆ‚¿¢7FGW3¢&vóFñÊuˆ76ñvÊ÷VÁB"¿¢7W'&VÁE˜7FW¢'V∆ñfñ6Fñˆ‚◊VÊFñÊr"¿¢FV÷ÊEˆf∆˜u˜fW'6ñˆ„¢¿¢V∆ñfñ6FñˆÂ˜7FGW3¢'VÊFñÊr"¿¢7&VFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢Á6V∆V7BÇì∞¢ ¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$fñ∆VBFÚ7&VFR&VÁBVÁ&ˆ∆∆÷VÁC¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á∞¢÷W76vS¢$fñ∆VBFÚ6fRVÁ&ˆ∆∆÷VÁB"¿¢FWFñ√¢W'&˜"Ê÷W76vR¿¢“ì∞¢–¢ ¢&W2Êß6ˆ‚á∞¢÷W76vS¢$VÁ&ˆ∆∆÷VÁB7V&÷óGFVB7V66W76gV∆«í"¿¢VÁ&ˆ∆∆÷VÁC¢VÁ&ˆ∆∆÷VÁDFFÚÂ≥“¿¢“ì∞¢ ¢–¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚VÁ&ˆ∆√¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á∞¢÷W76vS¢$fñ∆VBFÚ6fRVÁ&ˆ∆∆÷VÁB"¿¢“ì∞¢–¢“ì∞†¢ÚÚ”””””””””””””””””””””””””””””””””””””””–¢ÚÚÙ‰$Ù$Dî‰r$ıı4¬$ıUDU0¢ÚÚ”””””””””””””””””””””””””””””””””””””””–†¢ÚÚ7&VFRı6VÊB&˜˜6¬ÖGWF˜"ê¢Á˜7BÇ"ˆí˜GWF˜"˜&˜˜6¬"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'GWF˜""¬'FB"¬&á""¬&6ˆÚ"¬&6VÚ%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BGWF˜$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B∞¢7GVFVÁDñB¿¢VÁ&ˆ∆∆÷VÁDñB¿¢ñÁG&ÙG&ñ∆ƒñB¿¢&ñ÷'îñFVÁFóGí¿¢÷FÖ&V∆FñˆÁ6Üó¿¢6ˆÊfñFVÊ6UG&ñvvW'2¿¢6ˆÊfñFVÊ6T∂ñ∆∆W'2¿¢&W77W&U&W7ˆÁ6R¿¢w&˜wFÑG&ófW'2¿¢7W'&VÁEF˜ñ72¿¢ñ÷÷VFñFU7G'Vvv∆W2¿¢v4ñFVÁFñfñVB¿¢GWF˜$Ê˜FW2¿¢F˜ñ46ˆÊFóFñˆÊñÊuF˜ñ2¿¢F˜ñ46ˆÊFóFñˆÊñÊtVÁG'ïÜ6R¿¢F˜ñ46ˆÊFóFñˆÊñÊu7F&ñ∆óGí¿¢gWGW&TñFVÁFóGí¿¢vÁEFı&V÷V÷&W&VB¿¢ÜñFFV‰÷˜FófFñˆÁ2¿¢ñÁFW&Êƒ6ˆÊf∆ñ7B¿¢&V6ˆ÷÷VÊFVE∆‚¿¢ßW7Fñfñ6Fñˆ‚¿¢6Üñ∆Evñ∆≈vñ‚¿¢6∂vT∂Wí¿¢““&WÊ&ˆGì∞†¢ÚÚf∆ñFFR&WVó&VBfñV∆G0¢ñbÇ7GVFVÁDñB«¬&V6ˆ÷÷VÊFVE∆‚«¬ßW7Fñfñ6Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$÷ó76ñÊr&WVó&VBfñV∆G2"“ì∞¢–¢ñbá6∂vT∂Wí“ÁV∆¬bbó4÷ˆÁFÜ«ï6∂vT∂Wíá6∂vT∂Wííí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$6Üˆ˜6Rf∆ñBÇ¬"¬˜"b◊6W76ñˆ‚÷ˆÁFÜ«í6∂vR‚"“ì∞¢–¢6ˆÁ7B6W'fñ6U6∂vR“vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRá6∂vT∂Wí«¬DTdT≈EÙ‘ÙÂDÑ≈ïı4¥tUÙ¥Uíì∞†¢6ˆÁ7B7GVFVÁB“vóB7F˜&vRÊvWE7GVFVÁBá7GVFVÁDñBì∞¢ñbÇ7GVFVÁBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢ñbá7GVFVÁCÚÁGWF˜$ñBbb7GVFVÁBÁGWF˜$ñB”“GWF˜$ñBí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢%VÊWFÜ˜&ó¶VC¢7GVFVÁBFˆW2Ê˜B&V∆ˆÊrFÚFÜó2GWF˜""“ì∞¢–†¢6ˆÁ7BWÜó7FñÊu&ˆfñ∆R“á7GVFVÁBÁW'6ˆÊ≈&ˆfñ∆R2Áíí«¬∑”∞¢6ˆÁ7Bv˜&∂f∆˜r“WÜó7FñÊu&ˆfñ∆RÁv˜&∂f∆˜r«¬∑”∞¢6ˆÁ7B76ñvÊ÷VÁD66WFVB“v˜&∂f∆˜rÊ76ñvÊ÷VÁD66WFVDC∞¢ñbÇ76ñvÊ÷VÁD66WFVBí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$66WBFÜó276ñvÊ÷VÁB&Vf˜&R6VÊFñÊr&˜˜6¬‚"“ì∞¢–†¢6ˆÁ7B≤FF¢6ˆÊfó&÷VDñÁG&ı6W76ñˆ‚¬W'&˜#¢6ˆÊfó&÷VDñÁG&ı6W76ñˆ‰W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'66ÜVGV∆VE˜6W76ñˆÁ2"ê¢Á6V∆V7BÇ&ñB¬7FGW2¬GóR¬GWF˜%ˆñB¬7GVFVÁEˆñB¬7&VFVEˆB"ê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁDñBê¢ÊWÇ'GWF˜%ˆñB"¬GWF˜$ñBê¢ÊWÇ'GóR"¬&ñÁG&Ú"ê¢Êñ‚Ç'7FGW2"¬≤&6ˆÊfó&÷VB"¬'&VGí"¬&∆ófR"¬&6ˆ◊∆WFVB%“ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÜ6ˆÊfó&÷VDñÁG&ı6W76ñˆ‰W'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"f∆ñFFñÊr6ˆÊfó&÷VBñÁG&Ú6W76ñˆ‚&Vf˜&R&˜˜6√¢"¬6ˆÊfó&÷VDñÁG&ı6W76ñˆ‰W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚf∆ñFFR6ˆÊfó&÷VBñÁG&Ú6W76ñˆ‚&Vf˜&R&˜˜6¬"“ì∞¢–†¢ñbÇ6ˆÊfó&÷VDñÁG&ı6W76ñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$6ˆÊfó&“FÜRñÁG&Ú6W76ñˆ‚&Vf˜&R6VÊFñÊr&˜˜6¬‚"“ì∞¢–†¢ÚÚFñR&˜˜6¬vVÊW&Fñˆ‚FÚ∆FW7BñÁG&ÚG&ñ∆¬&W7V«Bf˜"FÜó2GWF˜"∑7GVFVÁB‡¢6ˆÁ7B≤FF¢∆FW7DñÁG&ÙG&ñ∆«2¬W'&˜#¢ñÁG&ÙG&ñ∆ƒW'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ñÁG&ı˜6W76ñˆÂˆG&ñ∆«2"ê¢Á6V∆V7BÇ&ñB¬G&ñ∆¬¬7V&÷óGFVEˆB¬66ÜVGV∆VE˜6W76ñˆÂˆñB"ê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁDñBê¢ÊWÇ'GWF˜%ˆñB"¬GWF˜$ñBê¢Ê˜&FW"Ç'7V&÷óGFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉ#ì∞†¢ñbÜñÁG&ÙG&ñ∆ƒW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr∆FW7BñÁG&ÚG&ñ∆¬f˜"&˜˜6√¢"¬ñÁG&ÙG&ñ∆ƒW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚf∆ñFFRñÁG&ÚG&ñ∆¬&Vf˜&R&˜˜6¬"“ì∞¢–†¢ñbÇ∆FW7DñÁG&ÙG&ñ∆«2«¬∆FW7DñÁG&ÙG&ñ∆«2Ê∆VÊwFÇ””“í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$6ˆ◊∆WFRñÁG&ÚG&ñ∆¬&Vf˜&RvVÊW&FñÊr&˜˜6¬"“ì∞¢–†¢∆WB∆FW7DñÁG&ÙG&ñ∆√¢Áí“ÁV∆√∞¢∆WB'6VDñÁG&Û¢Áí“ÁV∆√∞¢∆WBf∆∆&6¥ñÁG&ÙFñvÊ˜6ó3¢Áí“ÁV∆√∞¢∆WBf∆∆&6µ'6VDñÁG&Û¢Áí“ÁV∆√∞¢f˜"Ü6ˆÁ7B&˜rˆb∆FW7DñÁG&ÙG&ñ∆«2í∞¢∆WB'6VC¢Áí“ÁV∆√∞¢G'í∞¢'6VB“GóVˆb&˜rÊG&ñ∆¬””“'7G&ñÊr"Ú•4Ù‚Á'6Rá&˜rÊG&ñ∆¬í¢&˜rÊG&ñ∆√∞¢“6F6Ç∞¢'6VB“ÁV∆√∞¢–¢6ˆÁ7Bó4FñvÊ˜6ó2“á'6VCÚÊG&ñ∆≈GóR«¬&FñvÊ˜6ó2"í””“&FñvÊ˜6ó2#∞¢6ˆÁ7B&W6ˆ«fVE66ÜVGV∆VE6W76ñˆ‰ñB“7G&ñÊrÄ¢&˜rÁ66ÜVGV∆VE˜6W76ñˆÂˆñB«¬'6VCÚÁ66ÜVGV∆VE6W76ñˆ‰ñB«¬" ¢íÁG&ñ“Çì∞¢6ˆÁ7B66ÜVGV∆VE6W76ñˆ‰÷F6Ç–¢&W6ˆ«fVE66ÜVGV∆VE6W76ñˆ‰ñB””“7G&ñÊrÜ6ˆÊfó&÷VDñÁG&ı6W76ñˆ‚ÊñBì∞¢6ˆÁ7B6W76ñˆ‰6ˆÁFWáD∂ñÊB“7G&ñÊrá'6VCÚÁ6W76ñˆ‰6ˆÁFWáD∂ñÊB«¬&ñÁG&Ú"íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7Bó466WFVE&˜˜6ƒ6ˆÁFWáB“6W76ñˆ‰6ˆÁFWáD∂ñÊB””“&ñÁG&Ú#∞¢6ˆÁ7BWá∆ñ6óDG&ñ∆ƒ÷F6Ç“ñÁG&ÙG&ñ∆ƒñBbb7G&ñÊrá&˜rÊñBí””“7G&ñÊrÜñÁG&ÙG&ñ∆ƒñBì∞¢6ˆÁ7Bó4∆Vv7îFó&V7DñÁG&Ù6ˆÁFWáB–¢6W76ñˆ‰6ˆÁFWáD∂ñÊB””“'G&ñÊñÊr"b`¢&W6ˆ«fVE66ÜVGV∆VE6W76ñˆ‰ñBb`¢Ä¢Wá∆ñ6óDG&ñ∆ƒ÷F6Ç«¿¢7G&ñÊrÇáv˜&∂f∆˜r2ÁíìÚÊñÁG&Ù6ˆ◊∆WFVDB«¬""íÁG&ñ“ÇíÊ∆VÊwFÇ‚ ¢ì∞†¢ñbÜó4FñvÊ˜6ó2bbÜó466WFVE&˜˜6ƒ6ˆÁFWáB«¬ó4∆Vv7îFó&V7DñÁG&Ù6ˆÁFWáBíbbWá∆ñ6óDG&ñ∆ƒ÷F6Çí∞¢∆FW7DñÁG&ÙG&ñ∆¬“&˜s∞¢'6VDñÁG&Ú“'6VC∞¢'&V≥∞¢–†¢ñbÄ¢ó4FñvÊ˜6ó2b`¢66ÜVGV∆VE6W76ñˆ‰÷F6Çb`¢Üó466WFVE&˜˜6ƒ6ˆÁFWáB«¬ó4∆Vv7îFó&V7DñÁG&Ù6ˆÁFWáBê¢í∞¢∆FW7DñÁG&ÙG&ñ∆¬“&˜s∞¢'6VDñÁG&Ú“'6VC∞¢'&V≥∞¢–†¢ñbÇf∆∆&6¥ñÁG&ÙFñvÊ˜6ó2bbó4FñvÊ˜6ó2bbÜó466WFVE&˜˜6ƒ6ˆÁFWáB«¬ó4∆Vv7îFó&V7DñÁG&Ù6ˆÁFWáBíí∞¢f∆∆&6¥ñÁG&ÙFñvÊ˜6ó2“&˜s∞¢f∆∆&6µ'6VDñÁG&Ú“'6VC∞¢–¢–†¢ñbÇÇ∆FW7DñÁG&ÙG&ñ∆¬«¬'6VDñÁG&Úíbbf∆∆&6¥ñÁG&ÙFñvÊ˜6ó2bbf∆∆&6µ'6VDñÁG&Úí∞¢∆FW7DñÁG&ÙG&ñ∆¬“f∆∆&6¥ñÁG&ÙFñvÊ˜6ó3∞¢'6VDñÁG&Ú“f∆∆&6µ'6VDñÁG&Û∞¢–†¢ñbÇ∆FW7DñÁG&ÙG&ñ∆¬«¬'6VDñÁG&Úí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á∞¢÷W76vS¢$6ˆ◊∆WFRFÜRFñvÊ˜6ó2G&ñ∆¬g&ˆ“FÜR6ˆÊfó&÷VBñÁG&Ú6W76ñˆ‚&Vf˜&RvVÊW&FñÊr&˜˜6¬"¿¢“ì∞¢–†¢∆WBFñvÊ˜6ó4fñÊ∆ó¶VB“f«6S∞¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7BFñvÊ˜6ó5'VÂ&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5Bñ@¢e$Ù“V&∆ñ2Á&W7ˆÁ6UˆñÁFVw&óGïˆFñvÊ˜6ó5˜'VÁ0¢tÑU$RñC£ßFWáB“C¢‰B7GVFVÁEˆñB“C ¢‰BGWF˜%ˆñB“C0¢‰B7FGW2“v6ˆ◊∆WFVBp¢‰B6˜W&6UˆG&ñ∆≈ˆñC£ßFWáB“ñC£ßFWá@¢ƒî‘ïB¿¢µ7G&ñÊrÜ∆FW7DñÁG&ÙG&ñ∆¬ÊñBí¬7GVFVÁDñB¬GWF˜$ñE“¿¢ì∞¢FñvÊ˜6ó4fñÊ∆ó¶VB“FñvÊ˜6ó5'VÂ&W7V«BÁ&˜w5≥”∞¢“V«6R∞¢6ˆÁ7B≤FF¢6ˆ◊∆WFVDFñvÊ˜6ó5'V‚¬W'&˜#¢6ˆ◊∆WFVDFñvÊ˜6ó5'V‰W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&W7ˆÁ6UˆñÁFVw&óGïˆFñvÊ˜6ó5˜'VÁ2"ê¢Á6V∆V7BÇ&ñB¬7FGW2¬6˜W&6UˆG&ñ∆≈ˆñB"ê¢ÊWÇ&ñB"¬7G&ñÊrÜ∆FW7DñÁG&ÙG&ñ∆¬ÊñBíê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁDñBê¢ÊWÇ'GWF˜%ˆñB"¬GWF˜$ñBê¢ÊWÇ'7FGW2"¬&6ˆ◊∆WFVB"ê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÜ6ˆ◊∆WFVDFñvÊ˜6ó5'V‰W'&˜"í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚf∆ñFFRFñvÊ˜6ó2fñÊ∆ó¶Fñˆ‚&Vf˜&R&˜˜6¬"“ì∞¢–†¢FñvÊ˜6ó4fñÊ∆ó¶VB–¢6ˆ◊∆WFVDFñvÊ˜6ó5'V‚b`¢7G&ñÊrÜ6ˆ◊∆WFVDFñvÊ˜6ó5'V‚Á6˜W&6UˆG&ñ∆≈ˆñB«¬""í””“7G&ñÊrÜ6ˆ◊∆WFVDFñvÊ˜6ó5'V‚ÊñB«¬""ì∞¢–†¢ñbÇFñvÊ˜6ó4fñÊ∆ó¶VBí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS¢$FñvÊ˜6ó2fñÊ∆ó¶Fñˆ‚ó2ñÊ6ˆ◊∆WFR‚&V˜V‚FÜRñÁG&ÚG&ñ∆¬ÊB∆WBFÜR7F˜&VBWfñFVÊ6RfñÊó6Ç&ˆ6W76ñÊr&Vf˜&RvVÊW&FñÊr&˜˜6¬‚"¿¢“ì∞¢–†¢6ˆÁ7BñÁG&ıF˜ñ4g&ˆ‘G&ñ∆¬“7G&ñÊrá'6VDñÁG&ÛÚÊñÁG&ıF˜ñ2«¬""íÁG&ñ“Çì∞¢6ˆÁ7BñÁG&ı7V÷÷'í“'6VDñÁG&ÛÚÁ7V÷÷'í«¬ÁV∆√∞¢6ˆÁ7BG&ñ∆≈Ü6R“Ê˜&÷∆ó¶UÜ6RÜñÁG&ı7V÷÷'ìÚÁÜ6R«¬'6VDñÁG&ÛÚÁÜ6R«¬$6∆&óGí"ì∞¢6ˆÁ7BG&ñ∆≈7F&ñ∆óGí“Ê˜&÷∆ó¶U7F&ñ∆óGíÜñÁG&ı7V÷÷'ìÚÁ7F&ñ∆óGí«¬$∆˜r"ì∞¢6ˆÁ7BG&ñÊñÊtVÁG'ïÜ6R“FW&ófUG&ñÊñÊtVÁG'ïÜ6RÜG&ñ∆≈Ü6R¬G&ñ∆≈7F&ñ∆óGíì∞¢6ˆÁ7BG&ñ∆ƒÊWáD7Fñˆ‚“ñÁG&ı7V÷÷'ìÚÊÊWáD7Fñˆ‚«¬‰UÖEÙ5DîÙÂÙT‰tî‰U∂G&ñ∆≈Ü6U’∂G&ñ∆≈7F&ñ∆óGï“Á&ñ÷'î7Fñˆ„∞¢6ˆÁ7BG&ñ∆ƒ6ˆÁ7G&ñÁB“ñÁG&ı7V÷÷'ìÚÊ6ˆÁ7G&ñÁB«¬‰UÖEÙ5DîÙÂÙT‰tî‰U∂G&ñ∆≈Ü6U’∂G&ñ∆≈7F&ñ∆óGï“Á'V∆W5≥“«¬ÁV∆√∞†¢ñbÇñÁG&ıF˜ñ4g&ˆ‘G&ñ∆¬í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á∞¢÷W76vS¢$ñÁG&ÚG&ñ∆¬FñvÊ˜7Fñ2F˜ñ2ó2÷ó76ñÊr‚&R◊'V‚ñÁG&Ú6W76ñˆ‚vóFÇFBFñvÊ˜7Fñ2F˜ñ2&Vf˜&RvVÊW&FñÊr&˜˜6¬"¿¢“ì∞¢–†¢6ˆÁ7B&W6ˆ«fVD7W'&VÁEF˜ñ72“'&íÊg&ˆ“Ä¢ÊWr6WBÖ∞¢‚‚‚Ñ'&íÊó4'&íÜ7W'&VÁEF˜ñ72íÚ7W'&VÁEF˜ñ72¢µ“í¿¢ñÁG&ıF˜ñ4g&ˆ‘G&ñ∆¬¿¢“Ê÷ÇÜóFV“í”‚7G&ñÊrÜóFV“«¬""íÁG&ñ“ÇííÊfñ«FW"Ñ&ˆˆ∆V‚íê¢ì∞†¢6ˆÁ7B7ó7FV‘∆ñÊ∂VEGWF˜$Ê˜FW2“∞¢7G&ñÊráGWF˜$Ê˜FW2«¬""íÁG&ñ“Çí¿¢""¿¢%µ7ó7FV“ñÁG&ÚG&ñ∆¬∆ñÊµ“"¿¢ñÁG&ÚF˜ñ3¢G∂ñÁG&ıF˜ñ4g&ˆ‘G&ñ∆«÷¿¢FñvÊ˜6ó2Ü6S¢G∂G&ñ∆≈Ü6W÷¿¢G&ñÊñÊrVÁG'íÜ6S¢G∑G&ñÊñÊtVÁG'ïÜ6W÷¿¢7F&ñ∆óGì¢G∂G&ñ∆≈7F&ñ∆óGó÷¿¢ÊWáB7Fñˆ„¢G∂G&ñ∆ƒÊWáD7FñˆÁ÷¿¢G&ñ∆ƒ6ˆÁ7G&ñÁBÚ6ˆÁ7G&ñÁC¢G∂G&ñ∆ƒ6ˆÁ7G&ñÁG÷¢ÁV∆¬¿¢–¢Êfñ«FW"Ñ&ˆˆ∆V‚ê¢Ê¶ˆñ‚Ç%∆‚"ì∞†¢ÚÚfñÊBFÜR6ÊˆÊñ6¬VÁ&ˆ∆∆÷VÁB&V6˜&Bf˜"FÜó27GVFVÁB∑GWF˜ ¢6ˆÁ7BÊ˜&÷∆ó¶VE7GVFVÁB“Ê˜&÷∆ó¶U7GVFVÁE&V6˜&Bá7GVFVÁBì∞¢∆WB7GVƒVÁ&ˆ∆∆÷VÁDñB–¢VÁ&ˆ∆∆÷VÁDñB«¿¢Ê˜&÷∆ó¶VE7GVFVÁCÚÁ&VÁDVÁ&ˆ∆∆÷VÁDñB«¿¢ÁV∆√∞†¢ñbÇ7GVƒVÁ&ˆ∆∆÷VÁDñBbbÊ˜&÷∆ó¶VE7GVFVÁCÚÁ&VÁDñBí∞¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁD'ï&VÁDÊEGWF˜"¬W'&˜#¢&VÁEGWF˜$∆ˆˆ∑WW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬76ñvÊVE˜GWF˜%ˆñB¬W6W%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR"ê¢ÊWÇ'W6W%ˆñB"¬Ê˜&÷∆ó¶VE7GVFVÁBÁ&VÁDñBê¢ÊWÇ&76ñvÊVE˜GWF˜%ˆñB"¬GWF˜$ñBê¢Ê˜&FW"Ç'WFFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉRì∞†¢ñbá&VÁEGWF˜$∆ˆˆ∑WW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"∆ˆˆ∂ñÊrWVÁ&ˆ∆∆÷VÁB'í&VÁB∑GWF˜#¢"¬&VÁEGWF˜$∆ˆˆ∑WW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&W6ˆ«fRVÁ&ˆ∆∆÷VÁBf˜"&˜˜6¬"“ì∞¢–†¢6ˆÁ7BVÁ&ˆ∆∆÷VÁE&˜w2“VÁ&ˆ∆∆÷VÁD'ï&VÁDÊEGWF˜"«¬µ”∞¢6ˆÁ7BWÜ7DÊ÷T÷F6Ç“VÁ&ˆ∆∆÷VÁE&˜w2ÊfñÊBÄ¢á&˜s¢Áíí”‚7G&ñÊrá&˜rÁ7GVFVÁEˆgV∆≈ˆÊ÷R«¬""íÁG&ñ“Çí””“7G&ñÊrÜÊ˜&÷∆ó¶VE7GVFVÁBÊÊ÷R«¬7GVFVÁBÊÊ÷R«¬""íÁG&ñ“Çê¢ì∞¢6ˆÁ7B6ÊFñFFTVÁ&ˆ∆∆÷VÁB“WÜ7DÊ÷T÷F6Ç«¬VÁ&ˆ∆∆÷VÁE&˜w5≥“«¬ÁV∆√∞†¢ñbÜ6ÊFñFFTVÁ&ˆ∆∆÷VÁBí∞¢7GVƒVÁ&ˆ∆∆÷VÁDñB“6ÊFñFFTVÁ&ˆ∆∆÷VÁBÊñC∞¢G'í∞¢vóBVÁ7W&U7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜ6ÊFñFFTVÁ&ˆ∆∆÷VÁB¬GWF˜$ñBì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$fñ∆VBFÚ&6∂fñ∆¬6ÊˆÊñ6¬VÁ&ˆ∆∆÷VÁB∆ñÊ≤f˜"&˜˜6√¢"¬W'&˜"ì∞¢–¢–¢–†¢ñbÇ7GVƒVÁ&ˆ∆∆÷VÁDñBí∞¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁD'î76ñvÊVE7GVFVÁB¬W'&˜#¢76ñvÊVE7GVFVÁD∆ˆˆ∑WW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬7FGW2¬7W'&VÁE˜7FW¬76ñvÊVE˜GWF˜%ˆñB¬76ñvÊVE˜7GVFVÁEˆñB¬W6W%ˆñB"ê¢ÊWÇ&76ñvÊVE˜7GVFVÁEˆñB"¬7GVFVÁDñBê¢ÊWÇ&76ñvÊVE˜GWF˜%ˆñB"¬GWF˜$ñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÄ¢76ñvÊVE7GVFVÁD∆ˆˆ∑WW'&˜"b`¢7G&ñÊrÜ76ñvÊVE7GVFVÁD∆ˆˆ∑WW'&˜"Ê÷W76vR«¬""íÊñÊ6«VFW2Ç&76ñvÊVE˜7GVFVÁEˆñB"ê¢í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"∆ˆˆ∂ñÊrWVÁ&ˆ∆∆÷VÁB'í76ñvÊVE˜7GVFVÁEˆñC¢"¬76ñvÊVE7GVFVÁD∆ˆˆ∑WW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&W6ˆ«fRVÁ&ˆ∆∆÷VÁBf˜"&˜˜6¬"“ì∞¢–†¢7GVƒVÁ&ˆ∆∆÷VÁDñB“VÁ&ˆ∆∆÷VÁD'î76ñvÊVE7GVFVÁCÚÊñB«¬ÁV∆√∞¢–†¢ñbÇ7GVƒVÁ&ˆ∆∆÷VÁDñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á∞¢÷W76vS¢$ÊÚ6ÊˆÊñ6¬VÁ&ˆ∆∆÷VÁB∆ñÊ∂VBFÚFÜó276ñvÊVB7GVFVÁB∑GWF˜"‚6ˆÊfó&“76ñvÊ÷VÁBÊBñÁG&Úf∆˜r&Vf˜&R6VÊFñÊr&˜˜6¬‚"¿¢“ì∞¢–†¢ÚÚ7&VFR&˜˜6¿¢6ˆÁ7B≤FF¢&˜˜6ƒFF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢ÊñÁ6W'Bá∞¢VÁ&ˆ∆∆÷VÁEˆñC¢7GVƒVÁ&ˆ∆∆÷VÁDñB¿¢GWF˜%ˆñC¢GWF˜$ñB¿¢7GVFVÁEˆñC¢7GVFVÁDñB¿¢&ñ÷'ïˆñFVÁFóGì¢&ñ÷'îñFVÁFóGí¿¢÷FÖ˜&V∆FñˆÁ6Üó¢÷FÖ&V∆FñˆÁ6Üó¿¢6ˆÊfñFVÊ6U˜G&ñvvW'3¢6ˆÊfñFVÊ6UG&ñvvW'2¿¢6ˆÊfñFVÊ6Uˆ∂ñ∆∆W'3¢6ˆÊfñFVÊ6T∂ñ∆∆W'2¿¢&W77W&U˜&W7ˆÁ6S¢&W77W&U&W7ˆÁ6R¿¢w&˜wFÖˆG&ófW'3¢w&˜wFÑG&ófW'2¿¢7W'&VÁE˜F˜ñ73¢&W6ˆ«fVD7W'&VÁEF˜ñ72¿¢F˜ñ5ˆ6ˆÊFóFñˆÊñÊu˜F˜ñ3¢ñÁG&ıF˜ñ4g&ˆ‘G&ñ∆¬¿¢F˜ñ5ˆ6ˆÊFóFñˆÊñÊuˆVÁG'ï˜Ü6S¢G&ñÊñÊtVÁG'ïÜ6R¿¢F˜ñ5ˆ6ˆÊFóFñˆÊñÊu˜7F&ñ∆óGì¢G&ñ∆≈7F&ñ∆óGí¿¢ñ÷÷VFñFU˜7G'Vvv∆W3¢ñ÷÷VFñFU7G'Vvv∆W2¿¢v5ˆñFVÁFñfñVC¢v4ñFVÁFñfñVB¿¢GWF˜%ˆÊ˜FW3¢7ó7FV‘∆ñÊ∂VEGWF˜$Ê˜FW2¿¢gWGW&UˆñFVÁFóGì¢gWGW&TñFVÁFóGí¿¢vÁE˜Fı˜&V÷V÷&W&VC¢vÁEFı&V÷V÷&W&VB¿¢ÜñFFVÂˆ÷˜FófFñˆÁ3¢ÜñFFV‰÷˜FófFñˆÁ2¿¢ñÁFW&Ê≈ˆ6ˆÊf∆ñ7C¢ñÁFW&Êƒ6ˆÊf∆ñ7B¿¢&V6ˆ÷÷VÊFVE˜∆„¢&V6ˆ÷÷VÊFVE∆‚¿¢ßW7Fñfñ6Fñˆ„¢ßW7Fñfñ6Fñˆ‚¿¢6Üñ∆E˜vñ∆≈˜vñ„¢6Üñ∆Evñ∆≈vñ‚¿¢6∂vUˆ∂Wì¢6W'fñ6U6∂vRÊ∂Wí¿¢6∂vU˜6W76ñˆÁ3¢6W'fñ6U6∂vRÁ6W76ñˆÁ5W$÷ˆÁFÇ¿¢∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≥¢6W'fñ6U6∂vRÁ∆ÊÊVE6W76ñˆÁ5W%vVV≤¿¢6∂vUˆ÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"¿¢7V6ñ∆ó7E˜W%˜6W76ñˆÂˆ÷˜VÁC¢5T4îƒï5Eı4U54îÙÂı4Ñ$Uı§"¿¢∆Ff˜&’˜W%˜6W76ñˆÂˆ÷˜VÁC¢$U5ÙÂ4UÙîÂDTu$ïEïı4U54îÙÂı4Ñ$Uı§"¿¢6VÁEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢7&VFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7&VFñÊr&˜˜6√¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFR&˜˜6¬"“ì∞¢–†¢ÚÚ∆ñÊ≤FÜR&˜˜6¬FÚFÜR6ÊˆÊñ6¬VÁ&ˆ∆∆÷VÁBFá&˜VvÇFÜR6W'fW"◊6ñFP¢ÚÚ˜7Fw&W26ˆÊÊV7Fñˆ‚‚FÜR6Ü&VB7W&6R6∆ñVÁB6‚∆VvóFñ÷FV«íf∆¿¢ÚÚ&6≤FÚFÜRÊˆ‚∂Wíñ‚∆ˆ6¬˜&ˆˆbVÁfó&ˆÊ÷VÁG2¬vÜW&RGWF˜"$≈2FˆW0¢ÚÚÊ˜BW&÷óB&VÁEˆVÁ&ˆ∆∆÷VÁG2WFFW2‚G&VFñÊrFÜB¶W&Ú◊&˜rWFFR0¢ÚÚ7V66W72∆VfW2FÜRv˜&∂f∆˜r7GV6≤ˆ‚$7&VFRb6VÊB&˜˜6¬"‡¢6ˆÁ7B&˜˜6≈6VÁDB“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇì∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁEWFFR“vóBˆˆ¬ÁVW'íÄ¢UDDRV&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢4UB7FGW2“w&˜˜6≈˜6VÁBr¿¢&˜˜6≈ˆñB“C¿¢&˜˜6≈˜6VÁEˆB“C"¿¢WFFVEˆB“‰ırÇê¢tÑU$RñB“C0¢‰B76ñvÊVE˜GWF˜%ˆñB“C@¢$UEU$‰î‰rñB¬W6W%ˆñB¬7FGW2¬&˜˜6≈ˆñB¬&˜˜6≈˜6VÁEˆF¿¢∑&˜˜6ƒFFÊñB¬&˜˜6≈6VÁDB¬7GVƒVÁ&ˆ∆∆÷VÁDñB¬GWF˜$ñE“¿¢ì∞¢6ˆÁ7BWFFVDVÁ&ˆ∆∆÷VÁB“VÁ&ˆ∆∆÷VÁEWFFRÁ&˜w5≥“«¬ÁV∆√∞†¢ñbÇWFFVDVÁ&ˆ∆∆÷VÁBí∞¢ÚÚFÚÊ˜B∆VfR‚˜'Ü‚&˜˜6¬ñbFÜRVÁ&ˆ∆∆÷VÁBG&Á6óFñˆ‚FñBÊ˜BÜV‚‡¢vóBˆˆ¬ÁVW'íÄ¢DTƒUDRe$Ù“V&∆ñ2ÊˆÊ&ˆ&FñÊu˜&˜˜6«0¢tÑU$RñB“C¢‰BVÁ&ˆ∆∆÷VÁEˆñB“C&¿¢∑&˜˜6ƒFFÊñB¬7GVƒVÁ&ˆ∆∆÷VÁDñE“¿¢ì∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS¢%&˜˜6¬6˜V∆BÊ˜B&R∆ñÊ∂VBFÚFÜR7FófR&VÁBVÁ&ˆ∆∆÷VÁB‚&Vg&W6ÇFÜR76ñvÊ÷VÁBÊBG'ívñ‚‚"¿¢“ì∞¢–†¢vóB6fU6VÊEW6ÇÄ¢WFFVDVÁ&ˆ∆∆÷VÁBÁW6W%ˆñB¿¢∞¢FóF∆S¢%&˜˜6¬&VGí"¿¢&ˆGì¢%ñ˜W"GWF˜"Ü26VÁB&˜˜6¬‚˜V‚&W7ˆÁ6RñÁFVw&óGíFÚ&WfñWrÊB&W7ˆÊB‚"¿¢W&√¢"ˆ6∆ñVÁB˜&VÁBˆvFWví"¿¢Fs¢&VÁB◊&˜˜6¬◊6VÁB“G∑&˜˜6ƒFFÊñG÷¿¢“¿¢'&VÁB&˜˜6¬6VÁB"¿¢ì∞†¢&W2Êß6ˆ‚á∞¢÷W76vS¢%&˜˜6¬6VÁB7V66W76gV∆«í"¿¢&˜˜6√¢&˜˜6ƒFF¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"ñ‚7&VFR&˜˜6√¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFR&˜˜6¬"“ì∞¢–¢“ì∞†¢ÚÚvWB&˜˜6¬'íîBÖ&VÁB˜"GWF˜"ê¢ÊvWBÇ"ˆí˜&˜˜6¬Û¶ñB"¬ó4WFÜVÁFñ6FVB¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&˜˜6ƒñB“&WÁ&◊2ÊñC∞¢6ˆÁ7BW6W$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7BW6W%&ˆ∆R“á&W2ÁííÊF%W6W"Á&ˆ∆S∞†¢ÚÚfWF6Ç&˜˜6¬vóFÇVÁ&ˆ∆∆÷VÁBÊB7GVFVÁBñÊf¢6ˆÁ7B≤FF¢&˜˜6¬¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢Á6V∆V7BÜ ¢¢¿¢VÁ&ˆ∆∆÷VÁCß&VÁEˆVÁ&ˆ∆∆÷VÁG2á&VÁEˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FRí¿¢7GVFVÁCß7GVFVÁG2ÜÊ÷R¬w&FRí¿¢GWF˜#ßW6W'2ˆÊ&ˆ&FñÊu˜&˜˜6«5˜GWF˜%ˆñEˆf∂WíÜÊ÷R¬&ñÚ¬ÜˆÊR¬V÷ñ¬ê¢ê¢ÊWÇ&ñB"¬&˜˜6ƒñBê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"«¬&˜˜6¬í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%&˜˜6¬Ê˜Bf˜VÊB"“ì∞¢–†¢ÚÚWFÜ˜&ó¶Fñˆ„¢ˆÊ«íFÜR&VÁB¬GWF˜"¬˜"F÷ñ‚&ˆ∆W26‚fñWp¢6ˆÁ7Bó5&VÁB“W6W%&ˆ∆R””“'&VÁB"bb&˜˜6¬ÊVÁ&ˆ∆∆÷VÁCÚÁ&VÁEˆñB””“W6W$ñC∞¢6ˆÁ7Bó5GWF˜"“&˜˜6¬ÁGWF˜%ˆñB””“W6W$ñC∞¢6ˆÁ7Bó4F÷ñ‚“≤&á""¬&6ˆÚ"¬&6VÚ"¬'FB%“ÊñÊ6«VFW2áW6W%&ˆ∆Rì∞†¢ñbÇó5&VÁBbbó5GWF˜"bbó4F÷ñ‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜ˜&ó¶VBFÚfñWrFÜó2&˜˜6¬"“ì∞¢–†¢ÚÚG&6≤fñWr6˜VÁBf˜"&VÁG0¢ñbÜó5&VÁBí∞¢vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢ÁWFFRá∞¢fñWvVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢fñWvVEˆ6˜VÁC¢á&˜˜6¬ÁfñWvVEˆ6˜VÁB«¬í≤¿¢“ê¢ÊWÇ&ñB"¬&˜˜6ƒñBì∞¢–†¢&W2Êß6ˆ‚á&˜˜6¬ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&˜˜6√¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&˜˜6¬"“ì∞¢–¢“ì∞†¢ÚÚvWB&VÁBw2&˜˜6¬Üf˜"vFWvíˆF6Ü&ˆ&Bê¢ÊvWBÇ"ˆí˜&VÁB˜&˜˜6¬"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5B¢e$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$RW6W%ˆñB“C¢ı$DU"%íWFFVEˆBDU40¢ƒî‘ïB¿¢∑&VÁDñE“¿¢ì∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁB“VÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢∆WB&˜˜6¬“ÁV∆√∞¢ñbÜVÁ&ˆ∆∆÷VÁCÚÁ&˜˜6≈ˆñBí∞¢6ˆÁ7B&˜˜6≈&W7V«B“vóBˆˆ¬ÁVW'íÄ¢%4TƒT5B¢e$Ù“V&∆ñ2ÊˆÊ&ˆ&FñÊu˜&˜˜6«2tÑU$RñB“Cƒî‘ïB"¿¢∂VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñE“¿¢ì∞¢&˜˜6¬“&˜˜6≈&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢–¢ñbÇ&˜˜6¬bbVÁ&ˆ∆∆÷VÁCÚÊñBí∞¢6ˆÁ7B&˜˜6≈&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5B¢e$Ù“V&∆ñ2ÊˆÊ&ˆ&FñÊu˜&˜˜6«0¢tÑU$RVÁ&ˆ∆∆÷VÁEˆñB“C¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïB¿¢∂VÁ&ˆ∆∆÷VÁBÊñE“¿¢ì∞¢&˜˜6¬“&˜˜6≈&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢–¢ñbÇ&˜˜6¬í&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%&˜˜6¬Ê˜Bf˜VÊB"“ì∞†¢6ˆÁ7B7GVFVÁE&W7V«B“&˜˜6¬Á7GVFVÁEˆñ@¢ÚvóBˆˆ¬ÁVW'íÇ%4TƒT5BÊ÷R¬w&FR¬6ˆÊ6WEˆ÷7FW'í¬W'6ˆÊ≈˜&ˆfñ∆Re$Ù“V&∆ñ2Á7GVFVÁG2tÑU$RñB“Cƒî‘ïB"¬∑&˜˜6¬Á7GVFVÁEˆñE“ê¢¢≤&˜w3¢µ“”∞¢6ˆÁ7B7GVFVÁB“7GVFVÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢6ˆÁ7BGWF˜%&W7V«B“&˜˜6¬ÁGWF˜%ˆñ@¢ÚvóBˆˆ¬ÁVW'íÇ%4TƒT5BV÷ñ¬¬Ê÷R¬&ñÚ¬ÜˆÊRe$Ù“V&∆ñ2ÁW6W'2tÑU$RñB“Cƒî‘ïB"¬µ7G&ñÊrá&˜˜6¬ÁGWF˜%ˆñBï“ê¢¢≤&˜w3¢µ“”∞¢6ˆÁ7BGWF˜"“GWF˜%&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢6ˆÁ7BF˜ñ46ˆÊFóFñˆÊñÊr“'Vñ∆EF˜ñ46ˆÊFóFñˆÊñÊt÷á&˜˜6¬ì∞¢6ˆÁ7B&W˜'FVEF˜ñ72“'Vñ∆E&W˜'FVEF˜ñ72Ä¢VÁ&ˆ∆∆÷VÁBÁF˜ñ5˜&W7ˆÁ6U˜7ñ◊Fˆ◊2¿¢VÁ&ˆ∆∆÷VÁBÁ&W˜'FVE˜F˜ñ72¿¢VÁ&ˆ∆∆÷VÁBÁF˜ñ5˜&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6W2¿¢ì∞†¢&WGW&‚&W2Êß6ˆ‚á∞¢ñC¢&˜˜6¬ÊñB¿¢&ñ÷'îñFVÁFóGì¢&˜˜6¬Á&ñ÷'ïˆñFVÁFóGí¿¢÷FÖ&V∆FñˆÁ6Üó¢&˜˜6¬Ê÷FÖ˜&V∆FñˆÁ6Üó¿¢6ˆÊfñFVÊ6UG&ñvvW'3¢&˜˜6¬Ê6ˆÊfñFVÊ6U˜G&ñvvW'2¿¢6ˆÊfñFVÊ6T∂ñ∆∆W'3¢&˜˜6¬Ê6ˆÊfñFVÊ6Uˆ∂ñ∆∆W'2¿¢&W77W&U&W7ˆÁ6S¢&˜˜6¬Á&W77W&U˜&W7ˆÁ6R¿¢w&˜wFÑG&ófW'3¢&˜˜6¬Êw&˜wFÖˆG&ófW'2¿¢&W˜'FVEF˜ñ72¿¢7W'&VÁEF˜ñ73¢&˜˜6¬Ê7W'&VÁE˜F˜ñ72«¬&W˜'FVEF˜ñ72Ê¶ˆñ‚Ç"¬"í¿¢F˜ñ46ˆÊFóFñˆÊñÊr¿¢ñ÷÷VFñFU7G'Vvv∆W3¢&˜˜6¬Êñ÷÷VFñFU˜7G'Vvv∆W2¿¢v4ñFVÁFñfñVC¢&˜˜6¬Êv5ˆñFVÁFñfñVB¿¢GWF˜$Ê˜FW3¢&˜˜6¬ÁGWF˜%ˆÊ˜FW2¿¢gWGW&TñFVÁFóGì¢&˜˜6¬ÊgWGW&UˆñFVÁFóGí¿¢vÁEFı&V÷V÷&W&VC¢&˜˜6¬ÁvÁE˜Fı˜&V÷V÷&W&VB¿¢ÜñFFV‰÷˜FófFñˆÁ3¢&˜˜6¬ÊÜñFFVÂˆ÷˜FófFñˆÁ2¿¢ñÁFW&Êƒ6ˆÊf∆ñ7C¢&˜˜6¬ÊñÁFW&Ê≈ˆ6ˆÊf∆ñ7B¿¢&V6ˆ÷÷VÊFVE∆„¢&˜˜6¬Á&V6ˆ÷÷VÊFVE˜∆‚¿¢ßW7Fñfñ6Fñˆ„¢&˜˜6¬ÊßW7Fñfñ6Fñˆ‚¿¢6Üñ∆Evñ∆≈vñ„¢&˜˜6¬Ê6Üñ∆E˜vñ∆≈˜vñ‚¿¢6∂vT∂Wì¢vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRá&˜˜6¬Á6∂vUˆ∂WííÊ∂Wí¿¢6∂vU6W76ñˆÁ3¢vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRá&˜˜6¬Á6∂vUˆ∂WííÁ6W76ñˆÁ5W$÷ˆÁFÇ¿¢∆ÊÊVE6W76ñˆÁ5W%vVV≥¢vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRá&˜˜6¬Á6∂vUˆ∂WííÁ∆ÊÊVE6W76ñˆÁ5W%vVV≤¿¢6∂vT÷˜VÁC¢vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRá&˜˜6¬Á6∂vUˆ∂WííÊ÷˜VÁE¶"¿¢6W76ñˆÂ&ñ6S¢4U54îÙÂı$î4Uı§"¿¢&VÁD6ˆFS¢&˜˜6¬Á&VÁEˆ6ˆFR¿¢6VÁDC¢&˜˜6¬Á6VÁEˆB¿¢66WFVDC¢&˜˜6¬Ê66WFVEˆB¿¢7&VFVDC¢&˜˜6¬Ê7&VFVEˆB¿¢7GVFVÁC¢∞¢Ê÷S¢7GVFVÁCÚÊÊ÷R«¬VÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R«¬%ñ˜W"6Üñ∆B"¿¢w&FS¢7GVFVÁCÚÊw&FR«¬VÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆw&FR«¬""¿¢vVÊFW#¢VÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆvVÊFW"«¬ÁV∆¬¿¢“¿¢GWF˜#¢GWF˜"Ú≤Ê÷S¢GWF˜"ÊÊ÷R«¬GWF˜"ÊV÷ñ¬¬V÷ñ√¢GWF˜"ÊV÷ñ¬¬&ñÛ¢GWF˜"Ê&ñÚ¬ÜˆÊS¢GWF˜"ÁÜˆÊR“¢ÁV∆¬¿¢ñ÷VÁC¢ÁV∆¬¿¢ˆÊ&ˆ&FñÊuGóS¢ÁV∆¬¿¢g&VU6W76ñˆÁ5&V÷ñÊñÊs¢¿¢“ì∞¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤fWF6ÜñÊr&˜˜6¬f˜"&VÁC¢"¬&VÁDñBì∞†¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜#¢VÁ&ˆ∆∆÷VÁDW'&˜"““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñB¿¢&ñ÷'ï6V∆V7C¢&ñB¬&˜˜6≈ˆñB¬7FGW2¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR"¿¢&VfW%ñDVÁ&ˆ∆∆÷VÁC¢G'VR¿¢“ì∞†¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁDgV∆¬““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñB¿¢&ñ÷'ï6V∆V7C¢'7GVFVÁEˆvVÊFW"¬&W7ˆÁ6U˜7ñ◊Fˆ◊2¬F˜ñ5˜&W7ˆÁ6U˜7ñ◊Fˆ◊2¬F˜ñ5˜&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6W2"¿¢f∆∆&6µ6V∆V7C¢'&W7ˆÁ6U˜7ñ◊Fˆ◊2¬F˜ñ5˜&W7ˆÁ6U˜7ñ◊Fˆ◊2¬F˜ñ5˜&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6W2"¿¢&VfW%ñDVÁ&ˆ∆∆÷VÁC¢G'VR¿¢“ì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤VÁ&ˆ∆∆÷VÁBFF¢"¬VÁ&ˆ∆∆÷VÁB¬$W'&˜#¢"¬VÁ&ˆ∆∆÷VÁDW'&˜"ì∞†¢ñbÜVÁ&ˆ∆∆÷VÁDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrVÁ&ˆ∆∆÷VÁC¢"¬VÁ&ˆ∆∆÷VÁDW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇVÁ&ˆ∆∆÷VÁB"“ì∞¢–†¢ñbÇVÁ&ˆ∆∆÷VÁBí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ$ÊÚVÁ&ˆ∆∆÷VÁBf˜VÊBf˜"&VÁB"ì∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÁ&ˆ∆∆÷VÁBf˜VÊB"“ì∞¢–†¢ñbÇVÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ$ÊÚ&˜˜6≈ˆñBñ‚VÁ&ˆ∆∆÷VÁB"ì∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚ&˜˜6¬f˜VÊB"“ì∞¢–†¢ÚÚvWBFÜR&˜˜6¿¢6ˆÁ7B≤FF¢&˜˜6¬¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBê¢Á6ñÊv∆RÇì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤&˜˜6¬FF¢"¬&˜˜6¬¬$W'&˜#¢"¬W'&˜"ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&˜˜6√¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&˜˜6¬"¬W'&˜#¢W'&˜"Ê÷W76vR“ì∞¢–†¢ñbÇ&˜˜6¬í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%&˜˜6¬Ê˜Bf˜VÊB"“ì∞¢–†¢ÚÚvWB7GVFVÁBñÊfÚ6W&FV«ê¢6ˆÁ7B≤FF¢7GVFVÁB““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁG2"ê¢Á6V∆V7BÇ&Ê÷R¬w&FR¬6ˆÊ6WEˆ÷7FW'í¬W'6ˆÊ≈˜&ˆfñ∆R"ê¢ÊWÇ&ñB"¬&˜˜6¬Á7GVFVÁEˆñBê¢Á6ñÊv∆RÇì∞†¢ÚÚvWBGWF˜"ñÊfÚ6W&FV«ê¢6ˆÁ7B≤FF¢GWF˜"““vóB7W&6P¢Êg&ˆ“Ç&WFÇÁW6W'2"ê¢Á6V∆V7BÇ&ñB¬V÷ñ¬¬W6W%ˆ÷WFFF"ê¢ÊWÇ&ñB"¬&˜˜6¬ÁGWF˜%ˆñBê¢Á6ñÊv∆RÇì∞†¢6ˆÁ7BÊ˜&÷∆ó¶UF˜ñ46ˆÊFóFñˆÊñÊuÜ6R“áf«VSÛ¢7G&ñÊr¬ÁV∆¬í”‚∞¢6ˆÁ7Bb“7G&ñÊráf«VR«¬""íÁFÙ∆˜vW$66RÇì∞¢ñbábÊñÊ6«VFW2Ç&6∆&óGí"íí&WGW&‚$6∆&óGí#∞¢ñbábÊñÊ6«VFW2Ç'7G'V7GW&VB"íí&WGW&‚%7G'V7GW&VBWÜV7WFñˆ‚#∞¢ñbábÊñÊ6«VFW2Ç&Fó66ˆ÷f˜'B"íí&WGW&‚$6ˆÁG&ˆ∆∆VBFó66ˆ÷f˜'B#∞¢ñbábÊñÊ6«VFW2Ç'Fñ÷R"í«¬bÊñÊ6«VFW2Ç'&W77W&R"íí&WGW&‚%Fñ÷R&W77W&R7F&ñ∆óGí#∞¢&WGW&‚$6∆&óGí#∞¢”∞†¢6ˆÁ7BÊ˜&÷∆ó¶UF˜ñ46ˆÊFóFñˆÊñÊu7F&ñ∆óGí“áf«VSÛ¢7G&ñÊr¬ÁV∆¬í”‚∞¢6ˆÁ7Bb“7G&ñÊráf«VR«¬""íÁFÙ∆˜vW$66RÇì∞¢ñbábÊñÊ6«VFW2Ç&ÜñvÇ÷ñÁFVÊÊ6R"íí&WGW&‚$ÜñvÇ÷ñÁFVÊÊ6R#∞¢ñbábÊñÊ6«VFW2Ç&ÜñvÇ"íí&WGW&‚$ÜñvÇ#∞¢ñbábÊñÊ6«VFW2Ç&÷VFóV“"íí&WGW&‚$÷VFóV“#∞¢&WGW&‚$∆˜r#∞¢”∞†¢6ˆÁ7B∆ófUF˜ñ46ˆÊFóFñˆÊñÊr“ÇÇí”‚∞¢6ˆÁ7B6ˆÊ6WD÷7FW'í–¢7GVFVÁCÚÊ6ˆÊ6WEˆ÷7FW'íbbGóVˆb7GVFVÁBÊ6ˆÊ6WEˆ÷7FW'í””“&ˆ&¶V7B ¢Ú7GVFVÁBÊ6ˆÊ6WEˆ÷7FW'ê¢¢∑”∞¢6ˆÁ7BF˜ñ46ˆÊFóFñˆÊñÊu7F˜&R–¢6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊrbbGóVˆb6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊr””“&ˆ&¶V7B ¢Ú6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊp¢¢∑”∞¢6ˆÁ7BF˜ñ757F˜&R–¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72bbGóVˆbF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72””“&ˆ&¶V7B ¢ÚF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ70¢¢∑”∞†¢6ˆÁ7B∆FW7EF˜ñ2“ˆ&¶V7BÊVÁG&ñW2áF˜ñ757F˜&R2&V6˜&C«7G&ñÊr¬Áì‚ê¢Ê÷ÇÖ∑F˜ñ4∂Wí¬VÁG'ï“í”‚∞¢6ˆÁ7BF˜ñ2“7G&ñÊráF˜ñ4∂Wí«¬VÁG'ìÚÁF˜ñ2«¬""íÁG&ñ“Çì∞¢ñbÇF˜ñ2í&WGW&‚ÁV∆√∞†¢6ˆÁ7BVÁG'ïÜ6R“Ê˜&÷∆ó¶UF˜ñ46ˆÊFóFñˆÊñÊuÜ6RÄ¢VÁG'ìÚÁÜ6R«¬F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊVÁG'ï˜Ü6R«¬$6∆&óGí ¢ì∞¢6ˆÁ7BVÁG'ï7F&ñ∆óGí“Ê˜&÷∆ó¶UF˜ñ46ˆÊFóFñˆÊñÊu7F&ñ∆óGíÄ¢VÁG'ìÚÁ7F&ñ∆óGí«¬F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁ7F&ñ∆óGí«¬$∆˜r ¢ì∞†¢6ˆÁ7BÊ˜&÷∆ó¶VDÜó7F˜'í“'&íÊó4'&íÜVÁG'ìÚÊÜó7F˜'íê¢ÚVÁG'íÊÜó7F˜'ê¢Ê÷ÇÜóFV”¢Áíí”‚á∞¢Ü6S¢Ê˜&÷∆ó¶UF˜ñ46ˆÊFóFñˆÊñÊuÜ6RÜóFV”ÚÁÜ6R«¬VÁG'ïÜ6Rí¿¢7F&ñ∆óGì¢Ê˜&÷∆ó¶UF˜ñ46ˆÊFóFñˆÊñÊu7F&ñ∆óGíÜóFV”ÚÁ7F&ñ∆óGí«¬VÁG'ï7F&ñ∆óGíí¿¢FFS¢7G&ñÊrÜóFV”ÚÊFFR«¬""íÁG&ñ“Çí¿¢“íê¢Êfñ«FW"ÇÜóFV”¢Áíí”‚óFV“ÊFFRê¢Á6˜'BÇÜ¢Áí¬#¢Áíí”‚ÊWrFFRÜÊFFRíÊvWEFñ÷RÇí“ÊWrFFRÜ"ÊFFRíÊvWEFñ÷RÇíê¢¢µ”∞†¢6ˆÁ7B∆FW7B“Ê˜&÷∆ó¶VDÜó7F˜'ï∂Ê˜&÷∆ó¶VDÜó7F˜'íÊ∆VÊwFÇ““«¬∞¢Ü6S¢VÁG'ïÜ6R¿¢7F&ñ∆óGì¢VÁG'ï7F&ñ∆óGí¿¢FFS†¢7G&ñÊrÄ¢VÁG'ìÚÊ∆7EWFFVB«¿¢VÁG'ìÚÊ∆7EWFFVDB«¿¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊ∆7EWFFVB«¿¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊ∆7EWFFVDB«¿¢" ¢íÁG&ñ“Çí«¬ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢”∞†¢&WGW&‚∞¢F˜ñ2¿¢VÁG'ïÜ6S¢∆FW7BÁÜ6R¿¢7F&ñ∆óGì¢∆FW7BÁ7F&ñ∆óGí¿¢∆7EWFFVC¢∆FW7BÊFFR¿¢”∞¢“ê¢Êfñ«FW"ÇÜóFV“ì¢óFV“ó2Êˆ‰ÁV∆∆&∆S«GóVˆbóFV”‚”‚óFV“ê¢Á6˜'BÇÜ¬"í”‚ÊWrFFRÜÊ∆7EWFFVBíÊvWEFñ÷RÇí“ÊWrFFRÜ"Ê∆7EWFFVBíÊvWEFñ÷RÇíê¢Á˜Çì∞†¢&WGW&‚∆FW7EF˜ñ2«¬ÁV∆√∞¢“íÇì∞†¢6ˆÁ7B&W6ˆ«fVE7GVFVÁDvVÊFW"–¢7G&ñÊrÄ¢á7GVFVÁCÚÁW'6ˆÊ≈˜&ˆfñ∆Rb`¢GóVˆb7GVFVÁBÁW'6ˆÊ≈˜&ˆfñ∆R””“&ˆ&¶V7B"b`¢Çá7GVFVÁBÁW'6ˆÊ≈˜&ˆfñ∆R2ÁííÊvVÊFW"«¬á7GVFVÁBÁW'6ˆÊ≈˜&ˆfñ∆R2ÁííÁ&ˆÊ˜VÁ2íí«¿¢VÁ&ˆ∆∆÷VÁDgV∆√ÚÁ7GVFVÁEˆvVÊFW"«¿¢" ¢íÁG&ñ“Çí«¬ÁV∆√∞†¢ÚÚ6ˆ÷&ñÊRFFÊB6ˆÁfW'BFÚ6÷Vƒ66P¢6ˆÁ7BVÁ&ñ6ÜVE&˜˜6¬“∞¢ñC¢&˜˜6¬ÊñB¿¢&ñ÷'îñFVÁFóGì¢&˜˜6¬Á&ñ÷'ïˆñFVÁFóGí¿¢÷FÖ&V∆FñˆÁ6Üó¢&˜˜6¬Ê÷FÖ˜&V∆FñˆÁ6Üó¿¢6ˆÊfñFVÊ6UG&ñvvW'3¢&˜˜6¬Ê6ˆÊfñFVÊ6U˜G&ñvvW'2¿¢6ˆÊfñFVÊ6T∂ñ∆∆W'3¢&˜˜6¬Ê6ˆÊfñFVÊ6Uˆ∂ñ∆∆W'2¿¢&W77W&U&W7ˆÁ6S¢&˜˜6¬Á&W77W&U˜&W7ˆÁ6R¿¢w&˜wFÑG&ófW'3¢&˜˜6¬Êw&˜wFÖˆG&ófW'2¿¢&W˜'FVEF˜ñ73¢'Vñ∆E&W˜'FVEF˜ñ72Ä¢VÁ&ˆ∆∆÷VÁDgV∆√ÚÁF˜ñ5˜&W7ˆÁ6U˜7ñ◊Fˆ◊2¿¢VÁ&ˆ∆∆÷VÁDgV∆√ÚÁ&W˜'FVE˜F˜ñ72¿¢VÁ&ˆ∆∆÷VÁDgV∆√ÚÁF˜ñ5˜&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6W0¢í¿¢7W'&VÁEF˜ñ73¢á&˜˜6¬Ê7W'&VÁE˜F˜ñ72bb&˜˜6¬Ê7W'&VÁE˜F˜ñ72”“$ˆÊ&ˆ&FñÊr&6V∆ñÊRFñvÊ˜7Fñ2"ê¢Ú&˜˜6¬Ê7W'&VÁE˜F˜ñ70¢¢Ä¢'Vñ∆E&W˜'FVEF˜ñ72Ä¢VÁ&ˆ∆∆÷VÁDgV∆√ÚÁF˜ñ5˜&W7ˆÁ6U˜7ñ◊Fˆ◊2¿¢VÁ&ˆ∆∆÷VÁDgV∆√ÚÁ&W˜'FVE˜F˜ñ72¿¢VÁ&ˆ∆∆÷VÁDgV∆√ÚÁF˜ñ5˜&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6W0¢íÊ¶ˆñ‚Ç"¬"í«¬&˜˜6¬Ê7W'&VÁE˜F˜ñ70¢í¿¢F˜ñ46ˆÊFóFñˆÊñÊs†¢∆ófUF˜ñ46ˆÊFóFñˆÊñÊr«¿¢'Vñ∆EF˜ñ46ˆÊFóFñˆÊñÊt÷á∞¢‚‚Á&˜˜6¬¿¢7W'&VÁE˜F˜ñ73¢á&˜˜6¬Ê7W'&VÁE˜F˜ñ72bb&˜˜6¬Ê7W'&VÁE˜F˜ñ72”“$ˆÊ&ˆ&FñÊr&6V∆ñÊRFñvÊ˜7Fñ2"ê¢Ú&˜˜6¬Ê7W'&VÁE˜F˜ñ70¢¢Ä¢'Vñ∆E&W˜'FVEF˜ñ72Ä¢VÁ&ˆ∆∆÷VÁDgV∆√ÚÁF˜ñ5˜&W7ˆÁ6U˜7ñ◊Fˆ◊2¿¢VÁ&ˆ∆∆÷VÁDgV∆√ÚÁ&W˜'FVE˜F˜ñ72¿¢VÁ&ˆ∆∆÷VÁDgV∆√ÚÁF˜ñ5˜&V6ˆ÷÷VÊFVE˜7F'FñÊu˜Ü6W0¢íÊ¶ˆñ‚Ç"¬"í«¬&˜˜6¬Ê7W'&VÁE˜F˜ñ70¢í¿¢“í¿¢ñ÷÷VFñFU7G'Vvv∆W3¢&˜˜6¬Êñ÷÷VFñFU˜7G'Vvv∆W2¿¢v4ñFVÁFñfñVC¢&˜˜6¬Êv5ˆñFVÁFñfñVB¿¢GWF˜$Ê˜FW3¢&˜˜6¬ÁGWF˜%ˆÊ˜FW2¿¢gWGW&TñFVÁFóGì¢&˜˜6¬ÊgWGW&UˆñFVÁFóGí¿¢vÁEFı&V÷V÷&W&VC¢&˜˜6¬ÁvÁE˜Fı˜&V÷V÷&W&VB¿¢ÜñFFV‰÷˜FófFñˆÁ3¢&˜˜6¬ÊÜñFFVÂˆ÷˜FófFñˆÁ2¿¢ñÁFW&Êƒ6ˆÊf∆ñ7C¢&˜˜6¬ÊñÁFW&Ê≈ˆ6ˆÊf∆ñ7B¿¢&V6ˆ÷÷VÊFVE∆„¢&˜˜6¬Á&V6ˆ÷÷VÊFVE˜∆‚¿¢ßW7Fñfñ6Fñˆ„¢&˜˜6¬ÊßW7Fñfñ6Fñˆ‚¿¢6Üñ∆Evñ∆≈vñ„¢&˜˜6¬Ê6Üñ∆E˜vñ∆≈˜vñ‚¿¢6∂vT∂Wì¢vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRá&˜˜6¬Á6∂vUˆ∂WííÊ∂Wí¿¢6∂vU6W76ñˆÁ3¢vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRá&˜˜6¬Á6∂vUˆ∂WííÁ6W76ñˆÁ5W$÷ˆÁFÇ¿¢∆ÊÊVE6W76ñˆÁ5W%vVV≥¢vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRá&˜˜6¬Á6∂vUˆ∂WííÁ∆ÊÊVE6W76ñˆÁ5W%vVV≤¿¢6∂vT÷˜VÁC¢vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRá&˜˜6¬Á6∂vUˆ∂WííÊ÷˜VÁE¶"¿¢6W76ñˆÂ&ñ6S¢4U54îÙÂı$î4Uı§"¿¢&VÁD6ˆFS¢&˜˜6¬Á&VÁEˆ6ˆFR¿¢7&VFVDC¢&˜˜6¬Ê7&VFVEˆB¿¢7GVFVÁC¢∞¢Ê÷S¢7GVFVÁCÚÊÊ÷R«¬VÁ&ˆ∆∆÷VÁCÚÁ7GVFVÁEˆgV∆≈ˆÊ÷R«¬%ñ˜W"6Üñ∆B"¿¢w&FS¢7GVFVÁCÚÊw&FR«¬VÁ&ˆ∆∆÷VÁCÚÁ7GVFVÁEˆw&FR«¬""¿¢vVÊFW#¢&W6ˆ«fVE7GVFVÁDvVÊFW"¿¢“¿¢GWF˜#¢GWF˜"Ú∞¢Ê÷S¢GWF˜"ÁW6W%ˆ÷WFFFÚÊÊ÷R«¬GWF˜"ÊV÷ñ¬¿¢V÷ñ√¢GWF˜"ÊV÷ñ¬¿¢&ñÛ¢GWF˜"ÁW6W%ˆ÷WFFFÚÊ&ñÚ¿¢ÜˆÊS¢GWF˜"ÁW6W%ˆ÷WFFFÚÁÜˆÊR¿¢“¢ÁV∆¬¿¢ñ÷VÁC¢ÁV∆¬2Áí¿¢”∞†¢6ˆÁ7B≤FF¢∆FW7Eñ÷VÁB““vóBvWD∆FW7Eñ÷VÁDf˜$VÁ&ˆ∆∆÷VÁBÖ7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÊñBíì∞¢6ˆÁ7B&ñ∆∆ñÊt÷ˆFV¬“vóBvWE&VÁD&ñ∆∆ñÊt÷ˆFV¬á&VÁDñBì∞¢6ˆÁ7B6W76ñˆÂ&ˆw&W72“&˜˜6√ÚÁ7GVFVÁEˆñ@¢ÚvóBvWD6ˆ◊∆WFVE6W76ñˆ‰6˜VÁDf˜%7GVFVÁBÖ7G&ñÊrá&˜˜6¬Á7GVFVÁEˆñBíê¢¢≤6˜VÁC¢¬W'&˜#¢ÁV∆¬2Áí”∞¢ñbÜ∆FW7Eñ÷VÁBí∞¢VÁ&ñ6ÜVE&˜˜6¬Áñ÷VÁB“∞¢&˜fñFW#¢∆FW7Eñ÷VÁBÁ&˜fñFW"¿¢7FGW3¢7G&ñÊrÜ∆FW7Eñ÷VÁBÁñ÷VÁE˜7FGW2«¬""íÁFıWW$66RÇí¿¢÷˜VÁC¢ÁV÷&W"Ü∆FW7Eñ÷VÁBÊ÷˜VÁB«¬í¿¢∆„¢∆FW7Eñ÷VÁBÁ∆‚¿¢ñ÷VÁDFFS¢∆FW7Eñ÷VÁBÁñ÷VÁEˆFFR«¬∆FW7Eñ÷VÁBÁñEˆB«¬ÁV∆¬¿¢”∞¢“V«6RñbÜ&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóR””“'ñ∆˜B"í∞¢6ˆÁ7Bñ∆˜Dg&VU6W76ñˆÁ5&V÷ñÊñÊr“÷FÇÊ÷ÇÉ¬í“á6W76ñˆÂ&ˆw&W72Ê6˜VÁB«¬íì∞¢VÁ&ñ6ÜVE&˜˜6¬Áñ÷VÁB“∞¢&˜fñFW#¢'ñ∆˜B"¿¢7FGW3¢ñ∆˜Dg&VU6W76ñˆÁ5&V÷ñÊñÊr‚Ú$e$TUÙ44U52"¢%TÂîB"¿¢÷˜VÁC¢¿¢∆„¢%ñ∆˜B"¿¢ñ÷VÁDFFS¢ÁV∆¬¿¢”∞¢–†¢ÜVÁ&ñ6ÜVE&˜˜6¬2ÁííÊˆÊ&ˆ&FñÊuGóR“&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóS∞¢ÜVÁ&ñ6ÜVE&˜˜6¬2ÁííÊg&VU6W76ñˆÁ5&V÷ñÊñÊr–¢&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóR””“'ñ∆˜B ¢Ú÷FÇÊ÷ÇÉ¬í“á6W76ñˆÂ&ˆw&W72Ê6˜VÁB«¬íê¢¢∞†¢ÚÚG&6≤fñWp¢vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢ÁWFFRá∞¢fñWvVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢fñWvVEˆ6˜VÁC¢á&˜˜6¬ÁfñWvVEˆ6˜VÁB«¬í≤¿¢“ê¢ÊWÇ&ñB"¬&˜˜6¬ÊñBì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤&WGW&ÊñÊrVÁ&ñ6ÜVB&˜˜6¬"ì∞¢&W2Êß6ˆ‚ÜVÁ&ñ6ÜVE&˜˜6¬ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&VÁB&˜˜6√¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&˜˜6¬"“ì∞¢–¢“ì∞†¢ÚÚ66WB&˜˜6¬Ö&VÁBê¢Á˜7BÇ"ˆí˜&VÁB˜&˜˜6¬ˆ66WB"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢∆WBñ÷VÁDVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬W6W%ˆñB¬7FGW2¬&˜˜6≈ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7W'&VÁE˜7FW¿¢76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬¬ó5˜6ÊF&˜Öˆ66˜VÁ@¢e$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$RW6W%ˆñB“C¢‰B7FGW2î‚Çw&˜˜6≈˜6VÁBr¬w6W76ñˆÂˆ&ˆˆ∂VBrê¢‰B&˜˜6≈ˆñBï2‰ıBÂTƒ¿¢ı$DU"%íWFFVEˆBDU40¢ƒî‘ïB¿¢∑&VÁDñE“¿¢ì∞¢∆WBñ÷VÁDVÁ&ˆ∆∆÷VÁB“ñ÷VÁDVÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞†¢ñbÇñ÷VÁDVÁ&ˆ∆∆÷VÁBí∞¢6ˆÁ7BW6W%&W7V«B“vóBˆˆ¬ÁVW'íÄ¢%4TƒT5BV÷ñ¬e$Ù“V&∆ñ2ÁW6W'2tÑU$RñB“Cƒî‘ïB"¿¢∑&VÁDñE“¿¢ì∞¢6ˆÁ7B&VÁDV÷ñ¬“Ê˜&÷∆ó¶TV÷ñ¬áW6W%&W7V«BÁ&˜w5≥”ÚÊV÷ñ¬ì∞¢ñbá&VÁDV÷ñ¬í∞¢ñ÷VÁDVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬W6W%ˆñB¬7FGW2¬&˜˜6≈ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7W'&VÁE˜7FW¿¢76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬¬ó5˜6ÊF&˜Öˆ66˜VÁ@¢e$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$R∆˜vW"á&VÁEˆV÷ñ¬í“C¢‰B7FGW2î‚Çw&˜˜6≈˜6VÁBr¬w6W76ñˆÂˆ&ˆˆ∂VBrê¢‰B&˜˜6≈ˆñBï2‰ıBÂTƒ¿¢ı$DU"%íWFFVEˆBDU40¢ƒî‘ïB¿¢∑&VÁDV÷ñ≈“¿¢ì∞¢ñ÷VÁDVÁ&ˆ∆∆÷VÁB“ñ÷VÁDVÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢–¢–†¢ñbÇñ÷VÁDVÁ&ˆ∆∆÷VÁCÚÁ&˜˜6≈ˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÊFñÊr&˜˜6¬f˜VÊB"“ì∞¢–†¢6ˆÁ7Bñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁB“ó56ÊF&˜Öñ÷VÁDVÁ&ˆ∆∆÷VÁBáñ÷VÁDVÁ&ˆ∆∆÷VÁBì∞¢ñbÄ¢7G&ñÊráñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ7FGW2«¬""í””“'6W76ñˆÂˆ&ˆˆ∂VB"b`¢ñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁ@¢í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÊFñÊr&˜˜6¬f˜VÊB"“ì∞¢–†¢6ˆÁ7B&ñ∆∆ñÊu&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BˆÊ&ˆ&FñÊu˜GóR¬ffñ∆ñFUˆ6ˆFR¬ffñ∆ñFU˜GóP¢e$Ù“V&∆ñ2Á&VÁG0¢tÑU$RW6W%ˆñB“C¢ƒî‘ïB¿¢µ7G&ñÊráñ÷VÁDVÁ&ˆ∆∆÷VÁBÁW6W%ˆñB«¬&VÁDñBï“¿¢ì∞¢6ˆÁ7B&ñ∆∆ñÊu&˜r“&ñ∆∆ñÊu&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢6ˆÁ7BˆÊ&ˆ&FñÊuGóR–¢7G&ñÊrÜ&ñ∆∆ñÊu&˜sÚÊˆÊ&ˆ&FñÊu˜GóR«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí””“'ñ∆˜B ¢Ú'ñ∆˜B ¢¢&6ˆ÷÷W&6ñ¬#∞†¢ñbÜˆÊ&ˆ&FñÊuGóR””“&6ˆ÷÷W&6ñ¬"bbó4÷ˆÁFÜ«ï6∂vUñ÷VÁE&VGíáñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁBíí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢%îf7Bó2Ê˜B6ˆÊfñwW&VBˆ‚FÜó2FW∆˜ñ÷VÁB‚"“ì∞¢–†¢6ˆÁ7BWÜó7FñÊuñ÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5B†¢e$Ù“V&∆ñ2Áñ÷VÁE˜G&Á67FñˆÁ0¢tÑU$RVÁ&ˆ∆∆÷VÁEˆñB“C¢‰B&˜fñFW"“C ¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïB¿¢µ7G&ñÊráñ÷VÁDVÁ&ˆ∆∆÷VÁBÊñBí¬î‘TÂEı$ıdîDU%ıîd5E“¿¢ì∞¢6ˆÁ7BWÜó7FñÊuñ÷VÁB“WÜó7FñÊuñ÷VÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞†¢ñbÖ7G&ñÊrÜWÜó7FñÊuñ÷VÁCÚÁñ÷VÁE˜7FGW2«¬""íÁFÙ∆˜vW$66RÇí””“'ñB"í∞¢6ˆÁ7BfñÊ∆ó¶VB“vóBfñÊ∆ó¶T66WFVE&˜˜6ƒg&ˆ’ñ÷VÁBÜWÜó7FñÊuñ÷VÁBì∞¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢$÷ˆÁFÜ«í6∂vRñ÷VÁB«&VGí6ˆÊfó&÷VB‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢7FGW3¢fñÊ∆ó¶VBÁ7FGW2¿¢&VÁD6ˆFS¢fñÊ∆ó¶VBÁ&VÁD6ˆFR¿¢“ì∞¢–†¢6ˆÁ7Bñ÷VÁE&˜˜6≈&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬7GVFVÁEˆñB¬GWF˜%ˆñB¬6∂vUˆ∂Wí¬6∂vU˜6W76ñˆÁ2¿¢∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≤¬6∂vUˆ÷˜VÁ@¢e$Ù“V&∆ñ2ÊˆÊ&ˆ&FñÊu˜&˜˜6«0¢tÑU$RñB“C¢ƒî‘ïB¿¢∑ñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñE“¿¢ì∞¢6ˆÁ7Bñ÷VÁE&˜˜6¬“ñ÷VÁE&˜˜6≈&W7V«BÁ&˜w5≥“«¬ÁV∆√∞†¢ñbÇñ÷VÁE&˜˜6√ÚÁ7GVFVÁEˆñB«¬ñ÷VÁE&˜˜6√ÚÁGWF˜%ˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%&˜˜6¬ó2÷ó76ñÊr7GVFVÁB˜"GWF˜"∆ñÊ∂vR‚"“ì∞¢–†¢6ˆÁ7B6W'fñ6U6∂vR“vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRáñ÷VÁE&˜˜6¬Á6∂vUˆ∂Wíì∞†¢ñbÜˆÊ&ˆ&FñÊuGóR””“'ñ∆˜B"í∞¢6ˆÁ7BfñÊ∆ó¶FñˆÂ6VVB“WÜó7FñÊuñ÷VÁB«¬∞¢&VÁEˆñC¢7G&ñÊráñ÷VÁDVÁ&ˆ∆∆÷VÁBÁW6W%ˆñB«¬&VÁDñBí¿¢VÁ&ˆ∆∆÷VÁEˆñC¢ñ÷VÁDVÁ&ˆ∆∆÷VÁBÊñB¿¢&˜˜6≈ˆñC¢ñ÷VÁE&˜˜6¬ÊñB¿¢”∞¢6ˆÁ7BfñÊ∆ó¶VB“vóBfñÊ∆ó¶T66WFVE&˜˜6ƒg&ˆ’ñ÷VÁBÜfñÊ∆ó¶FñˆÂ6VVBì∞†¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%ñ∆˜B&˜˜6¬66WFVB‚g&VR66W72ó27FófR‚"¿¢ˆÊ&ˆ&FñÊuGóS¢'ñ∆˜B"¿¢ñ÷VÁE7FGW3¢$e$TUÙ44U52"¿¢7FGW3¢fñÊ∆ó¶VBÁ7FGW2¿¢&VÁD6ˆFS¢fñÊ∆ó¶VBÁ&VÁD6ˆFR¿¢g&VU6W76ñˆÁ5&V÷ñÊñÊs¢í¿¢“ì∞¢–†¢6ˆÁ7B÷W&6ÜÁE&VfW&VÊ6R“7G&ñÊrÄ¢WÜó7FñÊuñ÷VÁCÚÊ÷W&6ÜÁE˜&VfW&VÊ6R«¬&W7ˆÁ6R÷ñÁFVw&óGí◊6∂vR“G∑WVñGcBÇó÷¿¢ì∞¢6ˆÁ7Bñf7D6ˆÊfñr“vWEñf7D6ˆÊfñráñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁBì∞¢6ˆÁ7BÊ˜tó6Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇì∞¢6ˆÁ7Bñ÷VÁE&uñ∆ˆB“∞¢‚‚‚ÜWÜó7FñÊuñ÷VÁCÚÁ&u˜ñ∆ˆBbbGóVˆbWÜó7FñÊuñ÷VÁBÁ&u˜ñ∆ˆB””“&ˆ&¶V7B ¢ÚWÜó7FñÊuñ÷VÁBÁ&u˜ñ∆ˆ@¢¢∑“í¿¢ñf7Eˆ÷ˆFS¢ñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁBÚ'6ÊF&˜Ç"¢&∆ófR"¿¢6ÊF&˜Öˆ6ÜV6∂˜WC¢ñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁB¿¢6∂vUˆ∂Wì¢6W'fñ6U6∂vRÊ∂Wí¿¢”∞†¢6ˆÁ7B6fVEñ÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢îÂ4U%BîÂDÚV&∆ñ2Áñ÷VÁE˜G&Á67FñˆÁ2Ä¢&VÁEˆñB¬VÁ&ˆ∆∆÷VÁEˆñB¬&˜˜6≈ˆñB¬7GVFVÁEˆñB¬GWF˜%ˆñB¬&˜fñFW"¿¢ñ÷VÁE˜7FGW2¬∆‚¬÷˜VÁB¬7W'&VÊ7í¬GWF˜%˜6Ü&R¬∆Ff˜&’˜6Ü&R¿¢6∂vUˆ∂Wí¬6∂vU˜6W76ñˆÁ2¬∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≤¬6W76ñˆÂ˜&ñ6R¿¢÷W&6ÜÁE˜&VfW&VÊ6R¬óFV’ˆÊ÷R¬óFV’ˆFW67&óFñˆ‚¬&u˜ñ∆ˆB¬7&VFVEˆB¬WFFVEˆ@¢ê¢d≈TU2Ä¢C¬C"¬C2¬CB¬CR¬Cb¿¢wVÊFñÊrr¬Cr¬CÇ¬u§"r¬Cí¬C¿¢C¬C"¬C2¬CB¿¢CR¬Cb¬Cr¬CÉ£¶ß6ˆÊ"¬Cí¬Cê¢ê¢Ù‚4Ù‰dƒî5BÜ÷W&6ÜÁE˜&VfW&VÊ6Rê¢DÚUDDR4U@¢&VÁEˆñB“UÑ4≈TDTBÁ&VÁEˆñB¿¢VÁ&ˆ∆∆÷VÁEˆñB“UÑ4≈TDTBÊVÁ&ˆ∆∆÷VÁEˆñB¿¢&˜˜6≈ˆñB“UÑ4≈TDTBÁ&˜˜6≈ˆñB¿¢7GVFVÁEˆñB“UÑ4≈TDTBÁ7GVFVÁEˆñB¿¢GWF˜%ˆñB“UÑ4≈TDTBÁGWF˜%ˆñB¿¢&˜fñFW"“UÑ4≈TDTBÁ&˜fñFW"¿¢ñ÷VÁE˜7FGW2“wVÊFñÊrr¿¢∆‚“UÑ4≈TDTBÁ∆‚¿¢÷˜VÁB“UÑ4≈TDTBÊ÷˜VÁB¿¢7W'&VÊ7í“UÑ4≈TDTBÊ7W'&VÊ7í¿¢GWF˜%˜6Ü&R“UÑ4≈TDTBÁGWF˜%˜6Ü&R¿¢∆Ff˜&’˜6Ü&R“UÑ4≈TDTBÁ∆Ff˜&’˜6Ü&R¿¢6∂vUˆ∂Wí“UÑ4≈TDTBÁ6∂vUˆ∂Wí¿¢6∂vU˜6W76ñˆÁ2“UÑ4≈TDTBÁ6∂vU˜6W76ñˆÁ2¿¢∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≤“UÑ4≈TDTBÁ∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≤¿¢6W76ñˆÂ˜&ñ6R“UÑ4≈TDTBÁ6W76ñˆÂ˜&ñ6R¿¢óFV’ˆÊ÷R“UÑ4≈TDTBÊóFV’ˆÊ÷R¿¢óFV’ˆFW67&óFñˆ‚“UÑ4≈TDTBÊóFV’ˆFW67&óFñˆ‚¿¢&u˜ñ∆ˆB“UÑ4≈TDTBÁ&u˜ñ∆ˆB¿¢WFFVEˆB“UÑ4≈TDTBÁWFFVEˆ@¢$UEU$‰î‰r¶¿¢∞¢7G&ñÊráñ÷VÁDVÁ&ˆ∆∆÷VÁBÁW6W%ˆñB«¬&VÁDñBí¿¢7G&ñÊráñ÷VÁDVÁ&ˆ∆∆÷VÁBÊñBí¿¢7G&ñÊráñ÷VÁE&˜˜6¬ÊñBí¿¢7G&ñÊráñ÷VÁE&˜˜6¬Á7GVFVÁEˆñBí¿¢7G&ñÊráñ÷VÁE&˜˜6¬ÁGWF˜%ˆñBí¿¢î‘TÂEı$ıdîDU%ıîd5B¿¢6W'fñ6U6∂vRÊ∆&V¬¿¢6W'fñ6U6∂vRÊ÷˜VÁE¶"ÁFÙfóÜVBÉ"í¿¢6W'fñ6U6∂vRÁ7V6ñ∆ó7D∆∆ˆ6FñˆÂ¶"ÁFÙfóÜVBÉ"í¿¢6W'fñ6U6∂vRÁ&W7ˆÁ6TñÁFVw&óGî∆∆ˆ6FñˆÂ¶"ÁFÙfóÜVBÉ"í¿¢6W'fñ6U6∂vRÊ∂Wí¿¢6W'fñ6U6∂vRÁ6W76ñˆÁ5W$÷ˆÁFÇ¿¢6W'fñ6U6∂vRÁ∆ÊÊVE6W76ñˆÁ5W%vVV≤¿¢4U54îÙÂı$î4Uı§"¿¢÷W&6ÜÁE&VfW&VÊ6R¿¢6W'fñ6U6∂vRÊ∆&V¬¿¢'Vñ∆E6∂vUñ÷VÁDFW67&óFñˆ‚áñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R¬6W'fñ6U6∂vRÊ∂Wíí¿¢•4Ù‚Á7G&ñÊvñgíáñ÷VÁE&uñ∆ˆBí¿¢Ê˜tó6Ú¿¢“¿¢ì∞¢6ˆÁ7B6fVEñ÷VÁB“6fVEñ÷VÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞†¢ñbÇ6fVEñ÷VÁBí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&W&Rñ÷VÁBG&Á67Fñˆ‚"“ì∞¢–†¢6ˆÁ7Bñf7DfñV∆G2“ñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁ@¢ÚvóFÖñf7E6ñvÊGW&RÄ¢∞¢÷W&6ÜÁEˆñC¢ñf7D6ˆÊfñrÊ÷W&6ÜÁDñB¿¢÷W&6ÜÁEˆ∂Wì¢ñf7D6ˆÊfñrÊ÷W&6ÜÁD∂Wí¿¢&WGW&Â˜W&√¢'Vñ∆Eñf7E6ÊF&˜Ö&WGW&ÂW&¬á&W¬'&WGW&‚"¬÷W&6ÜÁE&VfW&VÊ6Rí¿¢6Ê6V≈˜W&√¢'Vñ∆Eñf7E6ÊF&˜Ö&WGW&ÂW&¬á&W¬&6Ê6V∆∆VB"¬÷W&6ÜÁE&VfW&VÊ6Rí¿¢’˜ñ÷VÁEˆñC¢÷W&6ÜÁE&VfW&VÊ6R¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"ÁFÙfóÜVBÉ"í¿¢óFV’ˆÊ÷S¢6W'fñ6U6∂vRÊ∆&V¬¿¢“¿¢ñf7D6ˆÊfñrÁ77á&6R¿¢ê¢¢vóFÖñf7E6ñvÊGW&RÄ¢∞¢÷W&6ÜÁEˆñC¢ñf7D6ˆÊfñrÊ÷W&6ÜÁDñB¿¢÷W&6ÜÁEˆ∂Wì¢ñf7D6ˆÊfñrÊ÷W&6ÜÁD∂Wí¿¢&WGW&Â˜W&√¢G∂vWD&6UW&¬Çó“ˆ6∆ñVÁB˜&VÁBˆvFWvì˜ñf7C◊&WGW&‚f÷W&6ÜÁE&VfW&VÊ6S“G∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÜ÷W&6ÜÁE&VfW&VÊ6Ró÷¿¢6Ê6V≈˜W&√¢G∂vWD&6UW&¬Çó“ˆ6∆ñVÁB˜&VÁBˆvFWvì˜ñf7C÷6Ê6V∆∆VBf÷W&6ÜÁE&VfW&VÊ6S“G∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÜ÷W&6ÜÁE&VfW&VÊ6Ró÷¿¢Ê˜Fñgï˜W&√¢G∂vWDïV&∆ñ5W&¬Çó“ˆí˜ñ÷VÁG2˜ñf7BˆÊ˜Fñgñ¿¢Ê÷Uˆfó'7C¢7G&ñÊrÇá&W2ÁííÊF%W6W#ÚÊfó'7DÊ÷R«¬""íÁG&ñ“Çí¿¢Ê÷Uˆ∆7C¢7G&ñÊrÇá&W2ÁííÊF%W6W#ÚÊ∆7DÊ÷R«¬""íÁG&ñ“Çí¿¢V÷ñ≈ˆFG&W73¢&W6ˆ«fUñf7DV÷ñƒFG&W72á∞¢F%W6W$V÷ñ√¢á&W2ÁííÊF%W6W#ÚÊV÷ñ¬¿¢VÁ&ˆ∆∆÷VÁDV÷ñ√¢ñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ&VÁEˆV÷ñ¬¿¢&VÁDñC¢7G&ñÊráñ÷VÁDVÁ&ˆ∆∆÷VÁBÁW6W%ˆñB«¬&VÁDñBí¿¢W6U6ÊF&˜É¢f«6R¿¢“í¿¢’˜ñ÷VÁEˆñC¢÷W&6ÜÁE&VfW&VÊ6R¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"ÁFÙfóÜVBÉ"í¿¢óFV’ˆÊ÷S¢6W'fñ6U6∂vRÊ∆&V¬¿¢óFV’ˆFW67&óFñˆ„¢'Vñ∆E6∂vUñ÷VÁDFW67&óFñˆ‚áñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R¬6W'fñ6U6∂vRÊ∂Wíí¿¢7W7Fˆ’˜7G#¢7G&ñÊráñ÷VÁDVÁ&ˆ∆∆÷VÁBÊñBí¿¢7W7Fˆ’˜7G##¢7G&ñÊráñ÷VÁE&˜˜6¬ÊñBí¿¢7W7Fˆ’˜7G#3¢7G&ñÊráñ÷VÁE&˜˜6¬Á7GVFVÁEˆñBí¿¢7W7Fˆ’˜7G#C¢7G&ñÊráñ÷VÁE&˜˜6¬ÁGWF˜%ˆñBí¿¢7W7Fˆ’˜7G#S¢6W'fñ6U6∂vRÊ∂Wí¿¢“¿¢ñf7D6ˆÊfñrÁ77á&6R¿¢ì∞†¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%îf7Bñ÷VÁB&W&VB‚"¿¢ˆÊ&ˆ&FñÊuGóS¢&6ˆ÷÷W&6ñ¬"¿¢ñ÷VÁE7FGW3¢%TÂîB"¿¢ñ÷VÁE&˜fñFW#¢î‘TÂEı$ıdîDU%ıîd5B¿¢∆„¢6W'fñ6U6∂vRÊ∆&V¬¿¢6∂vT∂Wì¢6W'fñ6U6∂vRÊ∂Wí¿¢6W76ñˆÁ5W$÷ˆÁFÉ¢6W'fñ6U6∂vRÁ6W76ñˆÁ5W$÷ˆÁFÇ¿¢∆ÊÊVE6W76ñˆÁ5W%vVV≥¢6W'fñ6U6∂vRÁ∆ÊÊVE6W76ñˆÁ5W%vVV≤¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"¿¢GWF˜%6Ü&S¢6W'fñ6U6∂vRÁ7V6ñ∆ó7D∆∆ˆ6FñˆÂ¶"¿¢∆Ff˜&’6Ü&S¢6W'fñ6U6∂vRÁ&W7ˆÁ6TñÁFVw&óGî∆∆ˆ6FñˆÂ¶"¿¢GE6Ü&S¢6W'fñ6U6∂vRÁ&W7ˆÁ6TñÁFVw&óGî∆∆ˆ6FñˆÂ¶"¿¢÷W&6ÜÁE&VfW&VÊ6R¿¢6ÜV6∂˜WEW&√¢ñf7D6ˆÊfñrÁ&ˆ6W75W&¬¿¢6ÊF&˜É¢ñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁB¿¢f˜&‘fñV∆G3¢ñf7DfñV∆G2¿¢“ì∞¢–†¢6ˆÁ7B&ñ∆∆ñÊt÷ˆFV¬“vóBvWE&VÁD&ñ∆∆ñÊt÷ˆFV¬á&VÁDñBì∞¢ñbÜ&ñ∆∆ñÊt÷ˆFV¬ÊW'&˜"í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&W6ˆ«fRˆÊ&ˆ&FñÊrGóRf˜"&ñ∆∆ñÊr‚"“ì∞¢–†¢ñbÇ&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóR«¬&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóR””“'VÊFñÊr"í∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á≤÷W76vS¢$∆ñ6Fñˆ‚&WfñWrÊBVÁG'í6V∆V7Fñˆ‚◊W7B&R6ˆ◊∆WFVB&Vf˜&R&˜˜6¬66WFÊ6R‚"“ì∞¢–†¢6ˆÁ7B≤FF¢ñ÷VÁDVÁ&ˆ∆∆÷VÁB¬W'&˜#¢ñ÷VÁDVÁ&ˆ∆∆÷VÁDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬7FGW2¬&˜˜6≈ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7W'&VÁE˜7FW¬76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬¬ó5˜6ÊF&˜Öˆ66˜VÁB"ê¢ÊWÇ'W6W%ˆñB"¬&VÁDñBê¢Êñ‚Ç'7FGW2"¬≤'&˜˜6≈˜6VÁB"¬'6W76ñˆÂˆ&ˆˆ∂VB%“ê¢ÊÊ˜BÇ'&˜˜6≈ˆñB"¬&ó2"¬ÁV∆¬ê¢Ê˜&FW"Ç'WFFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbáñ÷VÁDVÁ&ˆ∆∆÷VÁDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrVÊFñÊrVÁ&ˆ∆∆÷VÁBf˜"ñ÷VÁC¢"¬ñ÷VÁDVÁ&ˆ∆∆÷VÁDW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfñÊBVÊFñÊr&˜˜6¬"“ì∞¢–†¢ñbÇñ÷VÁDVÁ&ˆ∆∆÷VÁCÚÁ&˜˜6≈ˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÊFñÊr&˜˜6¬f˜VÊB"“ì∞¢–†¢6ˆÁ7Bñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁB“ó56ÊF&˜Öñ÷VÁDVÁ&ˆ∆∆÷VÁBáñ÷VÁDVÁ&ˆ∆∆÷VÁBì∞¢ñbÄ¢7G&ñÊráñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ7FGW2«¬""í””“'6W76ñˆÂˆ&ˆˆ∂VB"b`¢ñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁ@¢í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÊFñÊr&˜˜6¬f˜VÊB"“ì∞¢–¢ñbÜ&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóR””“&6ˆ÷÷W&6ñ¬"bbó4÷ˆÁFÜ«ï6∂vUñ÷VÁE&VGíáñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁBíí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢%îf7Bó2Ê˜B6ˆÊfñwW&VBˆ‚FÜó2FW∆˜ñ÷VÁB‚"“ì∞¢–†¢6ˆÁ7B≤FF¢WÜó7FñÊuñ÷VÁB¬W'&˜#¢∆FW7Eñ÷VÁDW'&˜"““vóBvWD∆FW7Eñ÷VÁDf˜$VÁ&ˆ∆∆÷VÁBáñ÷VÁDVÁ&ˆ∆∆÷VÁBÊñBì∞¢ñbÜ∆FW7Eñ÷VÁDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr∆FW7Bñ÷VÁBG&Á67Fñˆ„¢"¬∆FW7Eñ÷VÁDW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&W&Rñ÷VÁB"“ì∞¢–†¢ñbÜWÜó7FñÊuñ÷VÁCÚÁñ÷VÁE˜7FGW2””“'ñB"í∞¢6ˆÁ7BfñÊ∆ó¶VB“vóBfñÊ∆ó¶T66WFVE&˜˜6ƒg&ˆ’ñ÷VÁBÜWÜó7FñÊuñ÷VÁBì∞¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢$÷ˆÁFÜ«í6∂vRñ÷VÁB«&VGí6ˆÊfó&÷VB‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢7FGW3¢fñÊ∆ó¶VBÁ7FGW2¿¢&VÁD6ˆFS¢fñÊ∆ó¶VBÁ&VÁD6ˆFR¿¢“ì∞¢–†¢6ˆÁ7B≤FF¢ñ÷VÁE&˜˜6¬““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢Á6V∆V7BÇ&ñB¬7GVFVÁEˆñB¬GWF˜%ˆñB¬6∂vUˆ∂Wí¬6∂vU˜6W76ñˆÁ2¬∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≤¬6∂vUˆ÷˜VÁB"ê¢ÊWÇ&ñB"¬ñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÇñ÷VÁE&˜˜6√ÚÁ7GVFVÁEˆñB«¬ñ÷VÁE&˜˜6√ÚÁGWF˜%ˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%&˜˜6¬ó2÷ó76ñÊr7GVFVÁB˜"GWF˜"∆ñÊ∂vR‚"“ì∞¢–¢6ˆÁ7B6W'fñ6U6∂vR“vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRáñ÷VÁE&˜˜6¬Á6∂vUˆ∂Wíì∞†¢ñbÜ&ñ∆∆ñÊt÷ˆFV¬ÊFFÊˆÊ&ˆ&FñÊuGóR””“'ñ∆˜B"í∞¢6ˆÁ7BfñÊ∆ó¶FñˆÂ6VVB“WÜó7FñÊuñ÷VÁB«¬∞¢&VÁEˆñC¢&VÁDñB¿¢VÁ&ˆ∆∆÷VÁEˆñC¢ñ÷VÁDVÁ&ˆ∆∆÷VÁBÊñB¿¢&˜˜6≈ˆñC¢ñ÷VÁE&˜˜6¬ÊñB¿¢”∞¢6ˆÁ7BfñÊ∆ó¶VB“vóBfñÊ∆ó¶T66WFVE&˜˜6ƒg&ˆ’ñ÷VÁBÜfñÊ∆ó¶FñˆÂ6VVBì∞¢6ˆÁ7B6W76ñˆÂ&ˆw&W72“vóBvWD6ˆ◊∆WFVE6W76ñˆ‰6˜VÁDf˜%7GVFVÁBÖ7G&ñÊráñ÷VÁE&˜˜6¬Á7GVFVÁEˆñBíì∞†¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%ñ∆˜B&˜˜6¬66WFVB‚g&VR66W72ó27FófR‚"¿¢ˆÊ&ˆ&FñÊuGóS¢'ñ∆˜B"¿¢ñ÷VÁE7FGW3¢$e$TUÙ44U52"¿¢7FGW3¢fñÊ∆ó¶VBÁ7FGW2¿¢&VÁD6ˆFS¢fñÊ∆ó¶VBÁ&VÁD6ˆFR¿¢g&VU6W76ñˆÁ5&V÷ñÊñÊs¢÷FÇÊ÷ÇÉ¬í“á6W76ñˆÂ&ˆw&W72Ê6˜VÁB«¬íí¿¢“ì∞¢–†¢6ˆÁ7B÷W&6ÜÁE&VfW&VÊ6R“7G&ñÊrÜWÜó7FñÊuñ÷VÁCÚÊ÷W&6ÜÁE˜&VfW&VÊ6R«¬&W7ˆÁ6R÷ñÁFVw&óGí◊6∂vR“G∑WVñGcBÇó÷ì∞¢6ˆÁ7Bñf7D6ˆÊfñr“vWEñf7D6ˆÊfñráñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁBì∞¢6ˆÁ7BÊ˜tó6Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇì∞¢6ˆÁ7Bñ÷VÁE&uñ∆ˆB“∞¢‚‚‚ÜWÜó7FñÊuñ÷VÁCÚÁ&u˜ñ∆ˆBbbGóVˆbWÜó7FñÊuñ÷VÁBÁ&u˜ñ∆ˆB””“&ˆ&¶V7B"ÚWÜó7FñÊuñ÷VÁBÁ&u˜ñ∆ˆB¢∑“í¿¢ñf7Eˆ÷ˆFS¢ñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁBÚ'6ÊF&˜Ç"¢&∆ófR"¿¢6ÊF&˜Öˆ6ÜV6∂˜WC¢ñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁB¿¢6∂vUˆ∂Wì¢6W'fñ6U6∂vRÊ∂Wí¿¢”∞¢6ˆÁ7Bñ÷VÁE&V6˜&B“WÜó7FñÊuñ÷VÁ@¢Ú∞¢ñC¢WÜó7FñÊuñ÷VÁBÊñB¿¢&VÁEˆñC¢&VÁDñB¿¢VÁ&ˆ∆∆÷VÁEˆñC¢ñ÷VÁDVÁ&ˆ∆∆÷VÁBÊñB¿¢&˜˜6≈ˆñC¢ñ÷VÁE&˜˜6¬ÊñB¿¢7GVFVÁEˆñC¢ñ÷VÁE&˜˜6¬Á7GVFVÁEˆñB¿¢GWF˜%ˆñC¢ñ÷VÁE&˜˜6¬ÁGWF˜%ˆñB¿¢&˜fñFW#¢î‘TÂEı$ıdîDU%ıîd5B¿¢ñ÷VÁE˜7FGW3¢'VÊFñÊr"¿¢∆„¢6W'fñ6U6∂vRÊ∆&V¬¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"ÁFÙfóÜVBÉ"í¿¢7W'&VÊ7ì¢%§""¿¢GWF˜%˜6Ü&S¢6W'fñ6U6∂vRÁ7V6ñ∆ó7D∆∆ˆ6FñˆÂ¶"ÁFÙfóÜVBÉ"í¿¢∆Ff˜&’˜6Ü&S¢6W'fñ6U6∂vRÁ&W7ˆÁ6TñÁFVw&óGî∆∆ˆ6FñˆÂ¶"ÁFÙfóÜVBÉ"í¿¢6∂vUˆ∂Wì¢6W'fñ6U6∂vRÊ∂Wí¿¢6∂vU˜6W76ñˆÁ3¢6W'fñ6U6∂vRÁ6W76ñˆÁ5W$÷ˆÁFÇ¿¢∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≥¢6W'fñ6U6∂vRÁ∆ÊÊVE6W76ñˆÁ5W%vVV≤¿¢6W76ñˆÂ˜&ñ6S¢4U54îÙÂı$î4Uı§"¿¢÷W&6ÜÁE˜&VfW&VÊ6S¢÷W&6ÜÁE&VfW&VÊ6R¿¢óFV’ˆÊ÷S¢6W'fñ6U6∂vRÊ∆&V¬¿¢óFV’ˆFW67&óFñˆ„¢'Vñ∆E6∂vUñ÷VÁDFW67&óFñˆ‚áñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R¬6W'fñ6U6∂vRÊ∂Wíí¿¢&u˜ñ∆ˆC¢ñ÷VÁE&uñ∆ˆB¿¢WFFVEˆC¢Ê˜tó6Ú¿¢–¢¢∞¢&VÁEˆñC¢&VÁDñB¿¢VÁ&ˆ∆∆÷VÁEˆñC¢ñ÷VÁDVÁ&ˆ∆∆÷VÁBÊñB¿¢&˜˜6≈ˆñC¢ñ÷VÁE&˜˜6¬ÊñB¿¢7GVFVÁEˆñC¢ñ÷VÁE&˜˜6¬Á7GVFVÁEˆñB¿¢GWF˜%ˆñC¢ñ÷VÁE&˜˜6¬ÁGWF˜%ˆñB¿¢&˜fñFW#¢î‘TÂEı$ıdîDU%ıîd5B¿¢ñ÷VÁE˜7FGW3¢'VÊFñÊr"¿¢∆„¢6W'fñ6U6∂vRÊ∆&V¬¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"ÁFÙfóÜVBÉ"í¿¢7W'&VÊ7ì¢%§""¿¢GWF˜%˜6Ü&S¢6W'fñ6U6∂vRÁ7V6ñ∆ó7D∆∆ˆ6FñˆÂ¶"ÁFÙfóÜVBÉ"í¿¢∆Ff˜&’˜6Ü&S¢6W'fñ6U6∂vRÁ&W7ˆÁ6TñÁFVw&óGî∆∆ˆ6FñˆÂ¶"ÁFÙfóÜVBÉ"í¿¢6∂vUˆ∂Wì¢6W'fñ6U6∂vRÊ∂Wí¿¢6∂vU˜6W76ñˆÁ3¢6W'fñ6U6∂vRÁ6W76ñˆÁ5W$÷ˆÁFÇ¿¢∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≥¢6W'fñ6U6∂vRÁ∆ÊÊVE6W76ñˆÁ5W%vVV≤¿¢6W76ñˆÂ˜&ñ6S¢4U54îÙÂı$î4Uı§"¿¢÷W&6ÜÁE˜&VfW&VÊ6S¢÷W&6ÜÁE&VfW&VÊ6R¿¢óFV’ˆÊ÷S¢6W'fñ6U6∂vRÊ∆&V¬¿¢óFV’ˆFW67&óFñˆ„¢'Vñ∆E6∂vUñ÷VÁDFW67&óFñˆ‚áñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R¬6W'fñ6U6∂vRÊ∂Wíí¿¢&u˜ñ∆ˆC¢ñ÷VÁE&uñ∆ˆB¿¢7&VFVEˆC¢Ê˜tó6Ú¿¢WFFVEˆC¢Ê˜tó6Ú¿¢”∞†¢6ˆÁ7B≤FF¢6fVEñ÷VÁB¬W'&˜#¢ñ÷VÁE6fTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'ñ÷VÁE˜G&Á67FñˆÁ2"ê¢ÁW6W'Báñ÷VÁE&V6˜&B¬≤ˆ‰6ˆÊf∆ñ7C¢&÷W&6ÜÁE˜&VfW&VÊ6R"“ê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbáñ÷VÁE6fTW'&˜"«¬6fVEñ÷VÁBí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6fñÊrñ÷VÁBG&Á67Fñˆ„¢"¬ñ÷VÁE6fTW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&W&Rñ÷VÁBG&Á67Fñˆ‚"“ì∞¢–†¢6ˆÁ7Bñf7DfñV∆G2“ñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁ@¢ÚvóFÖñf7E6ñvÊGW&RÄ¢∞¢÷W&6ÜÁEˆñC¢ñf7D6ˆÊfñrÊ÷W&6ÜÁDñB¿¢÷W&6ÜÁEˆ∂Wì¢ñf7D6ˆÊfñrÊ÷W&6ÜÁD∂Wí¿¢&WGW&Â˜W&√¢'Vñ∆Eñf7E6ÊF&˜Ö&WGW&ÂW&¬á&W¬'&WGW&‚"¬÷W&6ÜÁE&VfW&VÊ6Rí¿¢6Ê6V≈˜W&√¢'Vñ∆Eñf7E6ÊF&˜Ö&WGW&ÂW&¬á&W¬&6Ê6V∆∆VB"¬÷W&6ÜÁE&VfW&VÊ6Rí¿¢’˜ñ÷VÁEˆñC¢÷W&6ÜÁE&VfW&VÊ6R¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"ÁFÙfóÜVBÉ"í¿¢óFV’ˆÊ÷S¢6W'fñ6U6∂vRÊ∆&V¬¿¢“¿¢ñf7D6ˆÊfñrÁ77á&6R¿¢ê¢¢vóFÖñf7E6ñvÊGW&RÄ¢∞¢÷W&6ÜÁEˆñC¢ñf7D6ˆÊfñrÊ÷W&6ÜÁDñB¿¢÷W&6ÜÁEˆ∂Wì¢ñf7D6ˆÊfñrÊ÷W&6ÜÁD∂Wí¿¢&WGW&Â˜W&√¢G∂vWD&6UW&¬Çó“ˆ6∆ñVÁB˜&VÁBˆvFWvì˜ñf7C◊&WGW&‚f÷W&6ÜÁE&VfW&VÊ6S“G∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÜ÷W&6ÜÁE&VfW&VÊ6Ró÷¿¢6Ê6V≈˜W&√¢G∂vWD&6UW&¬Çó“ˆ6∆ñVÁB˜&VÁBˆvFWvì˜ñf7C÷6Ê6V∆∆VBf÷W&6ÜÁE&VfW&VÊ6S“G∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÜ÷W&6ÜÁE&VfW&VÊ6Ró÷¿¢Ê˜Fñgï˜W&√¢G∂vWDïV&∆ñ5W&¬Çó“ˆí˜ñ÷VÁG2˜ñf7BˆÊ˜Fñgñ¿¢Ê÷Uˆfó'7C¢7G&ñÊrÇá&W2ÁííÊF%W6W#ÚÊfó'7DÊ÷R«¬""íÁG&ñ“Çí¿¢Ê÷Uˆ∆7C¢7G&ñÊrÇá&W2ÁííÊF%W6W#ÚÊ∆7DÊ÷R«¬""íÁG&ñ“Çí¿¢V÷ñ≈ˆFG&W73¢&W6ˆ«fUñf7DV÷ñƒFG&W72á∞¢F%W6W$V÷ñ√¢á&W2ÁííÊF%W6W#ÚÊV÷ñ¬¿¢VÁ&ˆ∆∆÷VÁDV÷ñ√¢ñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ&VÁEˆV÷ñ¬¿¢&VÁDñB¿¢W6U6ÊF&˜É¢f«6R¿¢“í¿¢’˜ñ÷VÁEˆñC¢÷W&6ÜÁE&VfW&VÊ6R¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"ÁFÙfóÜVBÉ"í¿¢óFV’ˆÊ÷S¢6W'fñ6U6∂vRÊ∆&V¬¿¢óFV’ˆFW67&óFñˆ„¢'Vñ∆E6∂vUñ÷VÁDFW67&óFñˆ‚áñ÷VÁDVÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R¬6W'fñ6U6∂vRÊ∂Wíí¿¢7W7Fˆ’˜7G#¢7G&ñÊráñ÷VÁDVÁ&ˆ∆∆÷VÁBÊñBí¿¢7W7Fˆ’˜7G##¢7G&ñÊráñ÷VÁE&˜˜6¬ÊñBí¿¢7W7Fˆ’˜7G#3¢7G&ñÊráñ÷VÁE&˜˜6¬Á7GVFVÁEˆñBí¿¢7W7Fˆ’˜7G#C¢7G&ñÊráñ÷VÁE&˜˜6¬ÁGWF˜%ˆñBí¿¢7W7Fˆ’˜7G#S¢6W'fñ6U6∂vRÊ∂Wí¿¢“¿¢ñf7D6ˆÊfñrÁ77á&6R¿¢ì∞†¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%îf7Bñ÷VÁB&W&VB‚"¿¢ˆÊ&ˆ&FñÊuGóS¢&6ˆ÷÷W&6ñ¬"¿¢ñ÷VÁE7FGW3¢%TÂîB"¿¢ñ÷VÁE&˜fñFW#¢î‘TÂEı$ıdîDU%ıîd5B¿¢∆„¢6W'fñ6U6∂vRÊ∆&V¬¿¢6∂vT∂Wì¢6W'fñ6U6∂vRÊ∂Wí¿¢6W76ñˆÁ5W$÷ˆÁFÉ¢6W'fñ6U6∂vRÁ6W76ñˆÁ5W$÷ˆÁFÇ¿¢∆ÊÊVE6W76ñˆÁ5W%vVV≥¢6W'fñ6U6∂vRÁ∆ÊÊVE6W76ñˆÁ5W%vVV≤¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"¿¢GWF˜%6Ü&S¢6W'fñ6U6∂vRÁ7V6ñ∆ó7D∆∆ˆ6FñˆÂ¶"¿¢∆Ff˜&’6Ü&S¢6W'fñ6U6∂vRÁ&W7ˆÁ6TñÁFVw&óGî∆∆ˆ6FñˆÂ¶"¿¢GE6Ü&S¢6W'fñ6U6∂vRÁ&W7ˆÁ6TñÁFVw&óGî∆∆ˆ6FñˆÂ¶"¿¢÷W&6ÜÁE&VfW&VÊ6R¿¢6ÜV6∂˜WEW&√¢ñf7D6ˆÊfñrÁ&ˆ6W75W&¬¿¢6ÊF&˜É¢ñf7E6ÊF&˜Ñf˜$VÁ&ˆ∆∆÷VÁB¿¢f˜&‘fñV∆G3¢ñf7DfñV∆G2¿¢“ì∞†¢ÚÚvWB∆FW7BVÊFñÊr&˜˜6¬VÁ&ˆ∆∆÷VÁBf˜"FÜó2&VÁB‡¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜#¢VÁ&ˆ∆∆÷VÁDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬7FGW2¬&˜˜6≈ˆñB"ê¢ÊWÇ'W6W%ˆñB"¬&VÁDñBê¢ÊWÇ'7FGW2"¬'&˜˜6≈˜6VÁB"ê¢ÊÊ˜BÇ'&˜˜6≈ˆñB"¬&ó2"¬ÁV∆¬ê¢Ê˜&FW"Ç'WFFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÜVÁ&ˆ∆∆÷VÁDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrVÊFñÊrVÁ&ˆ∆∆÷VÁBf˜"66WC¢"¬VÁ&ˆ∆∆÷VÁDW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfñÊBVÊFñÊr&˜˜6¬"“ì∞¢–†¢ñbÇVÁ&ˆ∆∆÷VÁB«¬VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÊFñÊr&˜˜6¬f˜VÊB"“ì∞¢–†¢ÚÚvWB&˜˜6¬FWFñ«2FÚvWB7GVFVÁBÊBF˜ñ26ˆÊFóFñˆÊñÊrñÊf¢6ˆÁ7B≤FF¢&˜˜6¬““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB¬GWF˜%ˆñB¬F˜ñ5ˆ6ˆÊFóFñˆÊñÊu˜F˜ñ2¬F˜ñ5ˆ6ˆÊFóFñˆÊñÊuˆVÁG'ï˜Ü6R¬F˜ñ5ˆ6ˆÊFóFñˆÊñÊu˜7F&ñ∆óGí"ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ÚÚvVÊW&FRVÊóVR&VÁB6ˆFRÉÇ6Ü&7FW'3¢∆WGFW'2ÊBÁV÷&W'2ê¢6ˆÁ7BvVÊW&FU&VÁD6ˆFR“Çí”‚∞¢6ˆÁ7B6Ü'2“t$4DTdtÑ§¥ƒ‘Â%5EUeuÖï£#3CScsÉís≤ÚÚWÜ6«VFñÊr6ñ÷ñ∆"∆ˆˆ∂ñÊr6Ü'0¢∆WB6ˆFR“rs∞¢f˜"Ü∆WBí“≤í¬É≤í≤≤í∞¢6ˆFR≥“6Ü'2Ê6Ü$BÑ÷FÇÊf∆ˆ˜"Ñ÷FÇÁ&ÊFˆ“Çí¢6Ü'2Ê∆VÊwFÇíì∞¢–¢&WGW&‚6ˆFS∞¢”∞†¢∆WB&VÁD6ˆFR“vVÊW&FU&VÁD6ˆFRÇì∞¢∆WB6ˆFTó5VÊóVR“f«6S∞¢∆WBGFV◊G2“∞†¢ÚÚVÁ7W&R6ˆFRó2VÊóVP¢vÜñ∆RÇ6ˆFTó5VÊóVRbbGFV◊G2¬í∞¢6ˆÁ7B≤FF¢WÜó7FñÊr““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ'&VÁEˆ6ˆFR"¬&VÁD6ˆFRê¢Ê÷ñ&U6ñÊv∆RÇì∞¢ ¢ñbÇWÜó7FñÊrí∞¢6ˆFTó5VÊóVR“G'VS∞¢“V«6R∞¢&VÁD6ˆFR“vVÊW&FU&VÁD6ˆFRÇì∞¢GFV◊G2≤≥∞¢–¢–†¢ÚÚ÷˜fRFÚ˜7B÷66WB7FFR6Ú&VÁB6ˆFRÊBÊWáB◊7FWTíVÊ∆ˆ6≤ñ÷÷VFñFV«í‡¢6ˆÁ7B≤W'&˜#¢WFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢ÁWFFRá∞¢7FGW3¢'6W76ñˆÂˆ&ˆˆ∂VB"¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁBÊñBì∞†¢ñbáWFFTW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"66WFñÊr&˜˜6√¢"¬WFFTW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ66WB&˜˜6¬"“ì∞¢–†¢ÚÚ÷&≤&˜˜6¬266WFVBÊBFB&VÁB6ˆFP¢vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢ÁWFFRá∞¢VÁ&ˆ∆∆÷VÁEˆñC¢VÁ&ˆ∆∆÷VÁBÊñB¿¢66WFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢&VÁEˆ6ˆFS¢&VÁD6ˆFR¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBì∞†¢ÚÚWFÚ÷7FófFRFÜR&˜˜6¬F˜ñ2f˜"F˜ñ2÷ÊvV÷VÁBÙ÷ˆÊ«ígFW"&VÁB66WG2‡¢6ˆÁ7B66WFVEF˜ñ2“7G&ñÊrá&˜˜6√ÚÁF˜ñ5ˆ6ˆÊFóFñˆÊñÊu˜F˜ñ2«¬""íÁG&ñ“Çì∞¢6ˆÁ7B66WFVEÜ6R“G'ï'6UÜ6Rá&˜˜6√ÚÁF˜ñ5ˆ6ˆÊFóFñˆÊñÊuˆVÁG'ï˜Ü6Rí«¬$6∆&óGí#∞¢6ˆÁ7B66WFVE7F&ñ∆óGí“Ê˜&÷∆ó¶U7F&ñ∆óGíá&˜˜6√ÚÁF˜ñ5ˆ6ˆÊFóFñˆÊñÊu˜7F&ñ∆óGí«¬$∆˜r"ì∞†¢ñbá&˜˜6√ÚÁ7GVFVÁEˆñBbb&˜˜6√ÚÁGWF˜%ˆñBbb66WFVEF˜ñ2í∞¢6ˆÁ7B7FófFñˆÂ&V6ˆ‚“∞¢$WFÚ÷7FófFVBg&ˆ“66WFVB&˜˜6¬"¿¢Ü6RG∂66WFVEÜ6W÷¿¢7F&ñ∆óGíG∂66WFVE7F&ñ∆óGó÷¿¢“Ê¶ˆñ‚Ç"¬"ì∞†¢6ˆÁ7B≤FF¢WÜó7FñÊt7FófFñˆ‚““vóB7W&6P¢Êg&ˆ“Ç'F˜ñ5ˆ6ˆÊFóFñˆÊñÊuˆ7FófFñˆÁ2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ'7GVFVÁEˆñB"¬&˜˜6¬Á7GVFVÁEˆñBê¢ÊWÇ'F˜ñ2"¬66WFVEF˜ñ2ê¢Ê∆ñ÷óBÉê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÇWÜó7FñÊt7FófFñˆ‚í∞¢6ˆÁ7B≤W'&˜#¢7FófFñˆ‰ñÁ6W'DW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'F˜ñ5ˆ6ˆÊFóFñˆÊñÊuˆ7FófFñˆÁ2"ê¢ÊñÁ6W'Bá∞¢7GVFVÁEˆñC¢&˜˜6¬Á7GVFVÁEˆñB¿¢GWF˜%ˆñC¢&˜˜6¬ÁGWF˜%ˆñB¿¢F˜ñ3¢66WFVEF˜ñ2¿¢&V6ˆ„¢7FófFñˆÂ&V6ˆ‚¿¢“ì∞†¢ñbÜ7FófFñˆ‰ñÁ6W'DW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"WFÚ÷7FófFñÊr66WFVB&˜˜6¬F˜ñ3¢"¬7FófFñˆ‰ñÁ6W'DW'&˜"ì∞¢–¢–†¢6ˆÁ7B≤FF¢7GVFVÁDf˜$6ˆÊ6WB““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁG2"ê¢Á6V∆V7BÇ&ñB¬6ˆÊ6WEˆ÷7FW'í"ê¢ÊWÇ&ñB"¬&˜˜6¬Á7GVFVÁEˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbá7GVFVÁDf˜$6ˆÊ6WBí∞¢6ˆÁ7BÊ˜tó6Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇì∞¢6ˆÁ7B7W'&VÁD6ˆÊ6WD÷7FW'í–¢7GVFVÁDf˜$6ˆÊ6WBÊ6ˆÊ6WEˆ÷7FW'íbbGóVˆb7GVFVÁDf˜$6ˆÊ6WBÊ6ˆÊ6WEˆ÷7FW'í””“&ˆ&¶V7B ¢Ú7GVFVÁDf˜$6ˆÊ6WBÊ6ˆÊ6WEˆ÷7FW'ê¢¢∑”∞†¢6ˆÁ7BF˜ñ46ˆÊFóFñˆÊñÊr–¢7W'&VÁD6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊrbbGóVˆb7W'&VÁD6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊr””“&ˆ&¶V7B ¢Ú7W'&VÁD6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊp¢¢∑”∞†¢6ˆÁ7BF˜ñ72–¢F˜ñ46ˆÊFóFñˆÊñÊrÁF˜ñ72bbGóVˆbF˜ñ46ˆÊFóFñˆÊñÊrÁF˜ñ72””“&ˆ&¶V7B ¢Ú≤‚‚ÁF˜ñ46ˆÊFóFñˆÊñÊrÁF˜ñ72–¢¢∑”∞†¢6ˆÁ7B∂Wí“66WFVEF˜ñ3∞¢6ˆÁ7BWÜó7FñÊuF˜ñ57FFR“F˜ñ75∂∂Wï“bbGóVˆbF˜ñ75∂∂Wï“””“&ˆ&¶V7B"ÚF˜ñ75∂∂Wï“¢∑”∞¢6ˆÁ7BWÜó7FñÊtÜó7F˜'í“'&íÊó4'&íÜWÜó7FñÊuF˜ñ57FFRÊÜó7F˜'ííÚWÜó7FñÊuF˜ñ57FFRÊÜó7F˜'í¢µ”∞†¢F˜ñ75∂∂Wï““∞¢‚‚ÊWÜó7FñÊuF˜ñ57FFR¿¢F˜ñ3¢66WFVEF˜ñ2¿¢Ü6S¢66WFVEÜ6R¿¢7F&ñ∆óGì¢66WFVE7F&ñ∆óGí¿¢∆7EWFFVC¢Ê˜tó6Ú¿¢ˆ'6W'fFñˆ‰Ê˜FW3¢$WFÚ÷7FófFVBg&ˆ“66WFVB&˜˜6¬gFW"ñÁG&ÚG&ñ∆¬FñvÊ˜6ó2‚"¿¢Üó7F˜'ì¢∞¢‚‚ÊWÜó7FñÊtÜó7F˜'í¿¢∞¢FFS¢Ê˜tó6Ú¿¢Ü6S¢66WFVEÜ6R¿¢7F&ñ∆óGì¢66WFVE7F&ñ∆óGí¿¢ÊWáD7Fñˆ„¢‰UÖEÙ5DîÙÂÙT‰tî‰U∂66WFVEÜ6U’∂66WFVE7F&ñ∆óGï“Á&ñ÷'î7Fñˆ‚¿¢ˆ'6W'fFñˆ‰Ê˜FW3¢$WFÚ÷7FófFVBg&ˆ“66WFVB&˜˜6¬‚"¿¢“¿¢“¿¢”∞†¢6ˆÁ7B÷W&vVD6ˆÊ6WD÷7FW'í“∞¢‚‚Ê7W'&VÁD6ˆÊ6WD÷7FW'í¿¢F˜ñ46ˆÊFóFñˆÊñÊs¢∞¢‚‚ÁF˜ñ46ˆÊFóFñˆÊñÊr¿¢F˜ñ3¢66WFVEF˜ñ2¿¢VÁG'ï˜Ü6S¢66WFVEÜ6R¿¢7F&ñ∆óGì¢66WFVE7F&ñ∆óGí¿¢∆7EWFFVC¢Ê˜tó6Ú¿¢F˜ñ72¿¢“¿¢”∞†¢6ˆÁ7B≤W'&˜#¢6ˆÊ6WEWFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁG2"ê¢ÁWFFRá≤6ˆÊ6WEˆ÷7FW'ì¢÷W&vVD6ˆÊ6WD÷7FW'í“ê¢ÊWÇ&ñB"¬&˜˜6¬Á7GVFVÁEˆñBì∞†¢ñbÜ6ˆÊ6WEWFFTW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"WFFñÊr6ˆÊ6WB÷7FW'ígFW"&˜˜6¬66WFÊ6S¢"¬6ˆÊ6WEWFFTW'&˜"ì∞¢–¢–¢–†¢ÚÚ6ÜV6≤ñbFÜó2&VÁB6÷Rg&ˆ“‚ffñ∆ñFRÜÜ2∆VB&V6˜&Bê¢6ˆÁ7B≤FF¢∆VB““vóB7W&6P¢Êg&ˆ“Ç&∆VG2"ê¢Á6V∆V7BÇ&ñB¬ffñ∆ñFUˆñB"ê¢ÊWÇ'W6W%ˆñB"¬&VÁDñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÜ∆VBbb&˜˜6√ÚÁ7GVFVÁEˆñBí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8¢7&VFñÊrffñ∆ñFR6∆˜6R&V6˜&Bf˜"∆VC¢"¬∆VBÊñBì∞¢ ¢ÚÚvWBGWF˜"w276ñvÊ÷VÁ@¢6ˆÁ7B≤FF¢GWF˜$76ñvÊ÷VÁB““vóB7W&6P¢Êg&ˆ“Ç'GWF˜%ˆ76ñvÊ÷VÁG2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ'GWF˜%ˆñB"¬&˜˜6¬ÁGWF˜%ˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ÚÚ7&VFR6∆˜6R&V6˜&Bf˜"ffñ∆ñFP¢6ˆÁ7B≤W'&˜#¢6∆˜6TW'&˜"““vóB7W&6P¢Êg&ˆ“Ç&6∆˜6W2"ê¢ÊñÁ6W'Bá∞¢ffñ∆ñFUˆñC¢∆VBÊffñ∆ñFUˆñB¿¢&VÁEˆñC¢&VÁDñB¿¢∆VEˆñC¢∆VBÊñB¿¢6Üñ∆EˆñC¢&˜˜6¬Á7GVFVÁEˆñB¿¢ˆEˆ76ñvÊ÷VÁEˆñC¢GWF˜$76ñvÊ÷VÁCÚÊñB«¬ÁV∆¬¿¢6∆˜6VEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ì∞†¢ñbÜ6∆˜6TW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7&VFñÊrffñ∆ñFR6∆˜6S¢"¬6∆˜6TW'&˜"ì∞¢ÚÚFˆ‚wBfñ¬FÜRvÜˆ∆R&WVW7Bñb6∆˜6R7&VFñˆ‚fñ«0¢“V«6R∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)»Rffñ∆ñFR6∆˜6R7&VFVB7V66W76gV∆«í"ì∞¢–¢–†¢vóB6fU6VÊEW6ÇÄ¢&˜˜6√ÚÁGWF˜%ˆñB¿¢∞¢FóF∆S¢%&˜˜6¬66WFVB"¿¢&ˆGì¢$&VÁB66WFVBñ˜W"ˆÊ&ˆ&FñÊr&˜˜6¬‚6ˆÁFñÁVRvóFÇFÜR66ÜVGV∆VB6W76ñˆ‚f∆˜r‚"¿¢W&√¢"ˆ˜W&FñˆÊ¬˜GWF˜"˜ˆB"¿¢Fs¢GWF˜"◊&˜˜6¬÷66WFVB“G∂VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñG÷¿¢“¿¢'GWF˜"&˜˜6¬66WFVB"¿¢ì∞†¢&W2Êß6ˆ‚á≤ ¢÷W76vS¢%&˜˜6¬66WFVB7V66W76gV∆«í"¬ ¢7FGW3¢'6W76ñˆÂˆ&ˆˆ∂VB"¿¢&VÁD6ˆFS¢&VÁD6ˆFR ¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"66WFñÊr&˜˜6√¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ66WB&˜˜6¬"“ì∞¢–¢“ì∞†¢Á˜7BÇ"ˆí˜ñ÷VÁG2˜ñf7BˆÊ˜Fñgí"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7Bñ∆ˆB“&WÊ&ˆGíbbGóVˆb&WÊ&ˆGí””“&ˆ&¶V7B"Ú&WÊ&ˆGí2&V6˜&C«7G&ñÊr¬VÊ∂Ê˜v„‚¢∑”∞¢6ˆÁ7B÷W&6ÜÁE&VfW&VÊ6R“7G&ñÊráñ∆ˆBÊ’˜ñ÷VÁEˆñB«¬""íÁG&ñ“Çì∞†¢ñbÇ÷W&6ÜÁE&VfW&VÊ6Rí∞¢&WGW&‚&W2Á7FGW2ÉCíÁ6VÊBÇ$÷ó76ñÊr’˜ñ÷VÁEˆñB"ì∞¢–†¢6ˆÁ7B≤FF¢G&Á67Fñˆ‚¬W'&˜#¢G&Á67Fñˆ‰W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'ñ÷VÁE˜G&Á67FñˆÁ2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ&÷W&6ÜÁE˜&VfW&VÊ6R"¬÷W&6ÜÁE&VfW&VÊ6Rê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbáG&Á67Fñˆ‰W'&˜"«¬G&Á67Fñˆ‚í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%îf7BïD‚G&Á67Fñˆ‚∆ˆˆ∑Wfñ∆VC¢"¬G&Á67Fñˆ‰W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉCBíÁ6VÊBÇ%VÊ∂Ê˜v‚G&Á67Fñˆ‚"ì∞¢–†¢6ˆÁ7BG&Á67Fñˆ‰÷ˆFR“vóBó56ÊF&˜Öñ÷VÁEG&Á67Fñˆ‚áG&Á67Fñˆ‚ì∞¢6ˆÁ7Bñf7D6ˆÊfñr“vWEñf7D6ˆÊfñráG&Á67Fñˆ‰÷ˆFRì∞¢6ˆÁ7B6ñvÊGW&Uf∆ñB“fW&ñgïñf7E6ñvÊGW&Ráñ∆ˆB2Áí¬ñf7D6ˆÊfñrÁ77á&6Rì∞¢6ˆÁ7B÷W&6ÜÁDñD÷F6ÜW2–¢7G&ñÊráñ∆ˆBÊ÷W&6ÜÁEˆñB«¬""íÁG&ñ“Çí””“ñf7D6ˆÊfñrÊ÷W&6ÜÁDñC∞¢6ˆÁ7B÷˜VÁD÷F6ÜW2–¢f˜&÷D÷˜VÁDf˜%ñf7BÇáñ∆ˆB2ÁííÊ÷˜VÁEˆw&˜72«¬áñ∆ˆB2ÁííÊ÷˜VÁEˆfVR«¬áñ∆ˆB2ÁííÊ÷˜VÁBí””–¢f˜&÷D÷˜VÁDf˜%ñf7BáG&Á67Fñˆ‚Ê÷˜VÁBì∞¢6ˆÁ7B6ÊF&˜Öf∆ñFFñˆ‰66WFVB“G&Á67Fñˆ‰÷ˆFRbb÷˜VÁD÷F6ÜW3∞†¢ñbÇÇ6ñvÊGW&Uf∆ñB«¬÷W&6ÜÁDñD÷F6ÜW2«¬÷˜VÁD÷F6ÜW2íbb6ÊF&˜Öf∆ñFFñˆ‰66WFVBí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%îf7BïD‚f∆ñFFñˆ‚fñ∆VC¢"¬∞¢÷W&6ÜÁE&VfW&VÊ6R¿¢G&Á67Fñˆ‰÷ˆFR¿¢6ñvÊGW&Uf∆ñB¿¢÷W&6ÜÁDñD÷F6ÜW2¿¢÷˜VÁD÷F6ÜW2¿¢“ì∞†¢6ˆÁ7BWÜó7FñÊu&uñ∆ˆB–¢G&Á67Fñˆ‚Á&u˜ñ∆ˆBbbGóVˆbG&Á67Fñˆ‚Á&u˜ñ∆ˆB””“&ˆ&¶V7B ¢ÚG&Á67Fñˆ‚Á&u˜ñ∆ˆ@¢¢∑”∞†¢vóB7W&6P¢Êg&ˆ“Ç'ñ÷VÁE˜G&Á67FñˆÁ2"ê¢ÁWFFRá∞¢ñ÷VÁE˜7FGW3¢&fñ∆VB"¿¢&u˜ñ∆ˆC¢∞¢‚‚ÊWÜó7FñÊu&uñ∆ˆB¿¢‚‚Áñ∆ˆB¿¢“¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬G&Á67Fñˆ‚ÊñBì∞†¢&WGW&‚&W2Á7FGW2ÉCíÁ6VÊBÇ$ñÁf∆ñBïD‚"ì∞¢–†¢6ˆÁ7BñÁFW&Ê≈7FGW2“Ê˜&÷∆ó¶Uñf7Eñ÷VÁE7FGW2áñ∆ˆBÁñ÷VÁE˜7FGW2ì∞¢6ˆÁ7BÊ˜tó6Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇì∞¢6ˆÁ7BWÜó7FñÊu&uñ∆ˆB–¢G&Á67Fñˆ‚Á&u˜ñ∆ˆBbbGóVˆbG&Á67Fñˆ‚Á&u˜ñ∆ˆB””“&ˆ&¶V7B ¢ÚG&Á67Fñˆ‚Á&u˜ñ∆ˆ@¢¢∑”∞¢6ˆÁ7B÷W&vVEñ∆ˆB“∞¢‚‚ÊWÜó7FñÊu&uñ∆ˆB¿¢‚‚Áñ∆ˆB¿¢ñf7Eˆ÷ˆFS¢G&Á67Fñˆ‰÷ˆFRÚ'6ÊF&˜Ç"¢WÜó7FñÊu&uñ∆ˆBÁñf7Eˆ÷ˆFR¿¢6ÊF&˜Öˆ6ÜV6∂˜WC¢G&Á67Fñˆ‰÷ˆFRÚG'VR¢WÜó7FñÊu&uñ∆ˆBÁ6ÊF&˜Öˆ6ÜV6∂˜WB¿¢6ÊF&˜Ö˜f∆ñFFñˆÂ˜&V∆ÜVC¢6ÊF&˜Öf∆ñFFñˆ‰66WFVBÚG'VR¢WÜó7FñÊu&uñ∆ˆBÁ6ÊF&˜Ö˜f∆ñFFñˆÂ˜&V∆ÜVB¿¢”∞†¢6ˆÁ7B≤FF¢WFFVEG&Á67Fñˆ‚¬W'&˜#¢WFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'ñ÷VÁE˜G&Á67FñˆÁ2"ê¢ÁWFFRá∞¢ñ÷VÁE˜7FGW3¢ñÁFW&Ê≈7FGW2¿¢ñ÷VÁEˆFFS¢ñÁFW&Ê≈7FGW2””“'ñB"ÚÊ˜tó6Ú¢G&Á67Fñˆ‚Áñ÷VÁEˆFFR¿¢ñEˆC¢ñÁFW&Ê≈7FGW2””“'ñB"ÚÊ˜tó6Ú¢G&Á67Fñˆ‚ÁñEˆB¿¢6Ê6V∆∆VEˆC¢ñÁFW&Ê≈7FGW2””“&6Ê6V∆∆VB"ÚÊ˜tó6Ú¢G&Á67Fñˆ‚Ê6Ê6V∆∆VEˆB¿¢ñf7E˜ñ÷VÁEˆñC¢7G&ñÊráñ∆ˆBÁe˜ñ÷VÁEˆñB«¬G&Á67Fñˆ‚Áñf7E˜ñ÷VÁEˆñB«¬""íÁG&ñ“Çí«¬ÁV∆¬¿¢&u˜ñ∆ˆC¢÷W&vVEñ∆ˆB¿¢óFÂ˜&V6VófVEˆC¢Ê˜tó6Ú¿¢WFFVEˆC¢Ê˜tó6Ú¿¢“ê¢ÊWÇ&ñB"¬G&Á67Fñˆ‚ÊñBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbáWFFTW'&˜"«¬WFFVEG&Á67Fñˆ‚í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%îf7BïD‚WFFRfñ∆VC¢"¬WFFTW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÁ6VÊBÇ$fñ∆VBFÚWFFRG&Á67Fñˆ‚"ì∞¢–†¢ñbÜñÁFW&Ê≈7FGW2””“'ñB"í∞¢vóB«ï&VÊWv≈G&Á67FñˆÂFÙ÷V÷&W'6Üó÷ˆÁFÇáWFFVEG&Á67Fñˆ‚ì∞¢ñbÇó5&VÊWv≈ñ÷VÁEG&Á67Fñˆ‚áWFFVEG&Á67Fñˆ‚íí∞¢vóBfñÊ∆ó¶T66WFVE&˜˜6ƒg&ˆ’ñ÷VÁBáWFFVEG&Á67Fñˆ‚ì∞¢–¢–†¢&WGW&‚&W2Á7FGW2É#íÁ6VÊBÇ$Ù≤"ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%îf7BïD‚W'&˜#¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÁ6VÊBÇ$ïD‚W'&˜""ì∞¢–¢“ì∞†¢Á˜7BÇ"ˆí˜&VÁB˜ñ÷VÁG2˜ñf7B˜6ÊF&˜Ç÷6ˆÊfó&“"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“7G&ñÊrÇá&W2ÁííÊF%W6W#ÚÊñB«¬""íÁG&ñ“Çì∞¢ñbÇ&VÁDñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%VÊWFÜ˜&ó¶VB"“ì∞¢–†¢6ˆÁ7B÷W&6ÜÁE&VfW&VÊ6R“7G&ñÊrá&WÊ&ˆGìÚÊ÷W&6ÜÁE&VfW&VÊ6R«¬""íÁG&ñ“Çì∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢∆WB6ÊˆÊñ6≈&VÁDñB“&VÁDñC∞¢∆WBG&Á67FñˆÂ&W7V«B“÷W&6ÜÁE&VfW&VÊ6P¢ÚvóBˆˆ¬ÁVW'íÄ¢4TƒT5B†¢e$Ù“V&∆ñ2Áñ÷VÁE˜G&Á67FñˆÁ0¢tÑU$R&VÁEˆñB“C¢‰B&˜fñFW"“C ¢‰B÷W&6ÜÁE˜&VfW&VÊ6R“C0¢ƒî‘ïB¿¢∂6ÊˆÊñ6≈&VÁDñB¬î‘TÂEı$ıdîDU%ıîd5B¬÷W&6ÜÁE&VfW&VÊ6U“¿¢ê¢¢vóBˆˆ¬ÁVW'íÄ¢4TƒT5B†¢e$Ù“V&∆ñ2Áñ÷VÁE˜G&Á67FñˆÁ0¢tÑU$R&VÁEˆñB“C¢‰B&˜fñFW"“C ¢‰Bñ÷VÁE˜7FGW2“wVÊFñÊrp¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïB¿¢∂6ÊˆÊñ6≈&VÁDñB¬î‘TÂEı$ıdîDU%ıîd5E“¿¢ì∞†¢∆WBG&Á67Fñˆ‚“G&Á67FñˆÂ&W7V«BÁ&˜w5≥“«¬ÁV∆√∞†¢ñbÇG&Á67Fñˆ‚í∞¢6ˆÁ7BW6W%&W7V«B“vóBˆˆ¬ÁVW'íÄ¢%4TƒT5BV÷ñ¬e$Ù“V&∆ñ2ÁW6W'2tÑU$RñB“Cƒî‘ïB"¿¢∑&VÁDñE“¿¢ì∞¢6ˆÁ7B&VÁDV÷ñ¬“Ê˜&÷∆ó¶TV÷ñ¬áW6W%&W7V«BÁ&˜w5≥”ÚÊV÷ñ¬ì∞¢ñbá&VÁDV÷ñ¬í∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BW6W%ˆñ@¢e$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$R∆˜vW"á&VÁEˆV÷ñ¬í“C¢ı$DU"%íWFFVEˆBDU40¢ƒî‘ïB¿¢∑&VÁDV÷ñ≈“¿¢ì∞¢6ÊˆÊñ6≈&VÁDñB“7G&ñÊrÜVÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥”ÚÁW6W%ˆñB«¬&VÁDñBì∞¢G&Á67FñˆÂ&W7V«B“÷W&6ÜÁE&VfW&VÊ6P¢ÚvóBˆˆ¬ÁVW'íÄ¢4TƒT5B†¢e$Ù“V&∆ñ2Áñ÷VÁE˜G&Á67FñˆÁ0¢tÑU$R&VÁEˆñB“C¢‰B&˜fñFW"“C ¢‰B÷W&6ÜÁE˜&VfW&VÊ6R“C0¢ƒî‘ïB¿¢∂6ÊˆÊñ6≈&VÁDñB¬î‘TÂEı$ıdîDU%ıîd5B¬÷W&6ÜÁE&VfW&VÊ6U“¿¢ê¢¢vóBˆˆ¬ÁVW'íÄ¢4TƒT5B†¢e$Ù“V&∆ñ2Áñ÷VÁE˜G&Á67FñˆÁ0¢tÑU$R&VÁEˆñB“C¢‰B&˜fñFW"“C ¢‰Bñ÷VÁE˜7FGW2“wVÊFñÊrp¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïB¿¢∂6ÊˆÊñ6≈&VÁDñB¬î‘TÂEı$ıdîDU%ıîd5E“¿¢ì∞¢G&Á67Fñˆ‚“G&Á67FñˆÂ&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢–¢–†¢ñbÇG&Á67Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÊFñÊr6ÊF&˜Çîf7Bñ÷VÁBf˜VÊB"“ì∞¢–†¢∆WBG&Á67FñˆÂ6ÊF&˜Ñ÷ˆFR–¢7G&ñÊrÄ¢áG&Á67Fñˆ‚Á&u˜ñ∆ˆBbbGóVˆbG&Á67Fñˆ‚Á&u˜ñ∆ˆB””“&ˆ&¶V7B ¢ÚG&Á67Fñˆ‚Á&u˜ñ∆ˆBÁñf7Eˆ÷ˆFP¢¢""í«¬" ¢íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí””“'6ÊF&˜Ç#∞†¢ñbÇG&Á67FñˆÂ6ÊF&˜Ñ÷ˆFRí∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁDñB“7G&ñÊráG&Á67Fñˆ‚ÊVÁ&ˆ∆∆÷VÁEˆñB«¬""íÁG&ñ“Çì∞¢ñbÜVÁ&ˆ∆∆÷VÁDñBí∞¢6ˆÁ7B∆ñÊ∂VDVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬7W'&VÁE˜7FW¬76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬¿¢ó5˜6ÊF&˜Öˆ66˜VÁB¬7GVFVÁEˆgV∆≈ˆÊ÷P¢e$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$RñB“C¢ƒî‘ïB¿¢∂VÁ&ˆ∆∆÷VÁDñE“¿¢ì∞¢G&Á67FñˆÂ6ÊF&˜Ñ÷ˆFR“ó56ÊF&˜Öñ÷VÁDVÁ&ˆ∆∆÷VÁBÄ¢∆ñÊ∂VDVÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥“«¬ÁV∆¬¿¢ì∞¢–¢–†¢ñbÇG&Á67FñˆÂ6ÊF&˜Ñ÷ˆFRí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Ç6ˆÊfó&÷Fñˆ‚ó2ˆÊ«ífñ∆&∆Rf˜"6ÊF&˜Çñ÷VÁBG&Á67FñˆÁ2‚"¿¢“ì∞¢–†¢ñbÖ7G&ñÊráG&Á67Fñˆ‚Áñ÷VÁE˜7FGW2«¬""íÁFÙ∆˜vW$66RÇí””“'ñB"í∞¢ñbÜó5&VÊWv≈ñ÷VÁEG&Á67Fñˆ‚áG&Á67Fñˆ‚íí∞¢6ˆÁ7B&VÊWvVD÷ˆÁFÇ“vóB«ï&VÊWv≈G&Á67FñˆÂFÙ÷V÷&W'6Üó÷ˆÁFÇáG&Á67Fñˆ‚ì∞¢ñbÇ&VÊWvVD÷ˆÁFÇí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7FófFR6ÊF&˜Ç&VÊWv¬6∂vR"“ì∞¢–¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Ç&VÊWv¬6∂vR7FófFVB‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢÷V÷&W'6Üó÷ˆÁFÉ¢&VÊWvVD÷ˆÁFÇ¿¢6ÊF&˜É¢G'VR¿¢“ì∞¢–¢6ˆÁ7BfñÊ∆ó¶VB“vóBfñÊ∆ó¶T66WFVE&˜˜6ƒg&ˆ’ñ÷VÁBáG&Á67Fñˆ‚ì∞¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Çîf7Bñ÷VÁB«&VGí6ˆÊfó&÷VB‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢7FGW3¢fñÊ∆ó¶VBÁ7FGW2¿¢&VÁD6ˆFS¢fñÊ∆ó¶VBÁ&VÁD6ˆFR¿¢6ÊF&˜É¢G'VR¿¢“ì∞¢–†¢ñbÇ≤'VÊFñÊr"¬&fñ∆VB"¬&6Ê6V∆∆VB%“ÊñÊ6«VFW2Ö7G&ñÊráG&Á67Fñˆ‚Áñ÷VÁE˜7FGW2«¬""íÁFÙ∆˜vW$66RÇííí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS¢6ÊF&˜Çñ÷VÁB6ÊÊ˜B&R6ˆÊfó&÷VBg&ˆ“7FGW2G∑G&Á67Fñˆ‚Áñ÷VÁE˜7FGW7“Ê¿¢“ì∞¢–†¢ñbÜó5&VÊWv≈ñ÷VÁEG&Á67Fñˆ‚áG&Á67Fñˆ‚íí∞¢6ˆÁ7B&VÊWvVD÷ˆÁFÇ“vóB«ï&VÊWv≈G&Á67FñˆÂFÙ÷V÷&W'6Üó÷ˆÁFÇáG&Á67Fñˆ‚ì∞¢ñbÇ&VÊWvVD÷ˆÁFÇí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7FófFR6ÊF&˜Ç&VÊWv¬6∂vR"“ì∞¢–¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Ç&VÊWv¬6∂vR7FófFVB‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢÷V÷&W'6Üó÷ˆÁFÉ¢&VÊWvVD÷ˆÁFÇ¿¢6ÊF&˜É¢G'VR¿¢“ì∞¢–†¢6ˆÁ7BÊ˜tó6Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇì∞¢6ˆÁ7B&uñ∆ˆB–¢G&Á67Fñˆ‚Á&u˜ñ∆ˆBbbGóVˆbG&Á67Fñˆ‚Á&u˜ñ∆ˆB””“&ˆ&¶V7B ¢ÚG&Á67Fñˆ‚Á&u˜ñ∆ˆ@¢¢∑”∞¢6ˆÁ7B÷W&vVEñ∆ˆB“∞¢‚‚Á&uñ∆ˆB¿¢ñf7Eˆ÷ˆFS¢'6ÊF&˜Ç"¿¢6ÊF&˜Öˆ6ÜV6∂˜WC¢G'VR¿¢6ÊF&˜Öˆ÷ÁV≈ˆ6ˆÊfó&÷Fñˆ„¢G'VR¿¢6ÊF&˜Öˆ÷ÁV≈ˆ6ˆÊfó&÷FñˆÂˆC¢Ê˜tó6Ú¿¢”∞†¢6ˆÁ7BWFFVE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢UDDRV&∆ñ2Áñ÷VÁE˜G&Á67FñˆÁ0¢4UBñ÷VÁE˜7FGW2“wñBr¿¢ñ÷VÁEˆFFR“C¿¢ñEˆB“C¿¢óFÂ˜&V6VófVEˆB“4ÙƒU44RÜóFÂ˜&V6VófVEˆB¬Cí¿¢&u˜ñ∆ˆB“C#£¶ß6ˆÊ"¿¢WFFVEˆB“C¢tÑU$RñB“C0¢$UEU$‰î‰r¶¿¢∂Ê˜tó6Ú¬•4Ù‚Á7G&ñÊvñgíÜ÷W&vVEñ∆ˆBí¬G&Á67Fñˆ‚ÊñE“¿¢ì∞¢6ˆÁ7BWFFVEG&Á67Fñˆ‚“WFFVE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢ñbÇWFFVEG&Á67Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6ˆÊfó&“6ÊF&˜Çñ÷VÁB"“ì∞¢–†¢6ˆÁ7BfñÊ∆ó¶VB“vóBfñÊ∆ó¶T66WFVE&˜˜6ƒg&ˆ’ñ÷VÁBáWFFVEG&Á67Fñˆ‚ì∞¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Çîf7Bñ÷VÁB6ˆÊfó&÷VB‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢7FGW3¢fñÊ∆ó¶VBÁ7FGW2¿¢&VÁD6ˆFS¢fñÊ∆ó¶VBÁ&VÁD6ˆFR¿¢6ÊF&˜É¢G'VR¿¢“ì∞¢–¢∆WBG&Á67FñˆÂVW'í“7W&6P¢Êg&ˆ“Ç'ñ÷VÁE˜G&Á67FñˆÁ2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ'&VÁEˆñB"¬&VÁDñBê¢ÊWÇ'&˜fñFW""¬î‘TÂEı$ıdîDU%ıîd5Bì∞†¢ñbÜ÷W&6ÜÁE&VfW&VÊ6Rí∞¢G&Á67FñˆÂVW'í“G&Á67FñˆÂVW'íÊWÇ&÷W&6ÜÁE˜&VfW&VÊ6R"¬÷W&6ÜÁE&VfW&VÊ6Rì∞¢“V«6R∞¢G&Á67FñˆÂVW'í“G&Á67FñˆÂVW'ê¢Êñ‚Ç'ñ÷VÁE˜7FGW2"¬≤'VÊFñÊr%“ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉì∞¢–†¢6ˆÁ7B≤FF¢G&Á67Fñˆ‚¬W'&˜#¢G&Á67Fñˆ‰W'&˜"““vóBG&Á67FñˆÂVW'íÊ÷ñ&U6ñÊv∆RÇì∞†¢ñbáG&Á67Fñˆ‰W'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%6ÊF&˜Çîf7B6ˆÊfó&÷Fñˆ‚∆ˆˆ∑Wfñ∆VC¢"¬G&Á67Fñˆ‰W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ∆ˆˆ≤W6ÊF&˜Çñ÷VÁB"“ì∞¢–†¢ñbÇG&Á67Fñˆ‚í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÊFñÊr6ÊF&˜Çîf7Bñ÷VÁBf˜VÊB"“ì∞¢–†¢∆WBG&Á67FñˆÂ6ÊF&˜Ñ÷ˆFR–¢7G&ñÊrÄ¢áG&Á67Fñˆ‚Á&u˜ñ∆ˆBbbGóVˆbG&Á67Fñˆ‚Á&u˜ñ∆ˆB””“&ˆ&¶V7B ¢ÚáG&Á67Fñˆ‚Á&u˜ñ∆ˆB2&V6˜&C«7G&ñÊr¬VÊ∂Ê˜v„‚íÁñf7Eˆ÷ˆFP¢¢""í«¬" ¢íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí””“'6ÊF&˜Ç#∞†¢ñbÇG&Á67FñˆÂ6ÊF&˜Ñ÷ˆFRí∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁDñB“7G&ñÊráG&Á67Fñˆ‚ÊVÁ&ˆ∆∆÷VÁEˆñB«¬""íÁG&ñ“Çì∞¢ñbÜVÁ&ˆ∆∆÷VÁDñBí∞¢6ˆÁ7B≤FF¢∆ñÊ∂VDVÁ&ˆ∆∆÷VÁB““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬7W'&VÁE˜7FW¬76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬¬ó5˜6ÊF&˜Öˆ66˜VÁB¬7GVFVÁEˆgV∆≈ˆÊ÷R"ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁDñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢G&Á67FñˆÂ6ÊF&˜Ñ÷ˆFR“ó56ÊF&˜Öñ÷VÁDVÁ&ˆ∆∆÷VÁBÜ∆ñÊ∂VDVÁ&ˆ∆∆÷VÁBì∞¢–¢–†¢ñbÇG&Á67FñˆÂ6ÊF&˜Ñ÷ˆFRí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢%6ÊF&˜Ç6ˆÊfó&÷Fñˆ‚ó2ˆÊ«ífñ∆&∆Rf˜"6ÊF&˜Çñ÷VÁBG&Á67FñˆÁ2‚"“ì∞¢–†¢ñbáG&Á67Fñˆ‚Áñ÷VÁE˜7FGW2””“'ñB"í∞¢vóB«ï&VÊWv≈G&Á67FñˆÂFÙ÷V÷&W'6Üó÷ˆÁFÇáG&Á67Fñˆ‚ì∞¢ñbÇó5&VÊWv≈ñ÷VÁEG&Á67Fñˆ‚áG&Á67Fñˆ‚íí∞¢6ˆÁ7BfñÊ∆ó¶VB“vóBfñÊ∆ó¶T66WFVE&˜˜6ƒg&ˆ’ñ÷VÁBáG&Á67Fñˆ‚ì∞¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Çîf7Bñ÷VÁB«&VGí6ˆÊfó&÷VB‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢7FGW3¢fñÊ∆ó¶VBÁ7FGW2¿¢&VÁD6ˆFS¢fñÊ∆ó¶VBÁ&VÁD6ˆFR¿¢6ÊF&˜É¢G'VR¿¢“ì∞¢–†¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Çîf7Bñ÷VÁB«&VGí6ˆÊfó&÷VB‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢6ÊF&˜É¢G'VR¿¢“ì∞¢–†¢ñbÇ≤'VÊFñÊr"¬&fñ∆VB"¬&6Ê6V∆∆VB%“ÊñÊ6«VFW2Ö7G&ñÊráG&Á67Fñˆ‚Áñ÷VÁE˜7FGW2«¬""íÁFÙ∆˜vW$66RÇííí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS¢6ÊF&˜Çñ÷VÁB6ÊÊ˜B&R6ˆÊfó&÷VBg&ˆ“7FGW2G∑G&Á67Fñˆ‚Áñ÷VÁE˜7FGW7“Ê¿¢“ì∞¢–†¢6ˆÁ7BÊ˜tó6Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇì∞¢6ˆÁ7B&uñ∆ˆB–¢G&Á67Fñˆ‚Á&u˜ñ∆ˆBbbGóVˆbG&Á67Fñˆ‚Á&u˜ñ∆ˆB””“&ˆ&¶V7B ¢ÚG&Á67Fñˆ‚Á&u˜ñ∆ˆ@¢¢∑”∞†¢6ˆÁ7B÷W&vVEñ∆ˆB“∞¢‚‚Á&uñ∆ˆB¿¢ñf7Eˆ÷ˆFS¢'6ÊF&˜Ç"¿¢6ÊF&˜Öˆ6ÜV6∂˜WC¢G'VR¿¢6ÊF&˜Öˆ÷ÁV≈ˆ6ˆÊfó&÷Fñˆ„¢G'VR¿¢6ÊF&˜Öˆ÷ÁV≈ˆ6ˆÊfó&÷FñˆÂˆC¢Ê˜tó6Ú¿¢”∞†¢6ˆÁ7B≤FF¢WFFVEG&Á67Fñˆ‚¬W'&˜#¢WFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'ñ÷VÁE˜G&Á67FñˆÁ2"ê¢ÁWFFRá∞¢ñ÷VÁE˜7FGW3¢'ñB"¿¢ñ÷VÁEˆFFS¢Ê˜tó6Ú¿¢ñEˆC¢Ê˜tó6Ú¿¢óFÂ˜&V6VófVEˆC¢G&Á67Fñˆ‚ÊóFÂ˜&V6VófVEˆB«¬Ê˜tó6Ú¿¢&u˜ñ∆ˆC¢÷W&vVEñ∆ˆB¿¢WFFVEˆC¢Ê˜tó6Ú¿¢“ê¢ÊWÇ&ñB"¬G&Á67Fñˆ‚ÊñBê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbáWFFTW'&˜"«¬WFFVEG&Á67Fñˆ‚í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%6ÊF&˜Çîf7B6ˆÊfó&÷Fñˆ‚WFFRfñ∆VC¢"¬WFFTW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6ˆÊfó&“6ÊF&˜Çñ÷VÁB"“ì∞¢–†¢vóB«ï&VÊWv≈G&Á67FñˆÂFÙ÷V÷&W'6Üó÷ˆÁFÇáWFFVEG&Á67Fñˆ‚ì∞¢ñbÇó5&VÊWv≈ñ÷VÁEG&Á67Fñˆ‚áWFFVEG&Á67Fñˆ‚íí∞¢6ˆÁ7BfñÊ∆ó¶VB“vóBfñÊ∆ó¶T66WFVE&˜˜6ƒg&ˆ’ñ÷VÁBáWFFVEG&Á67Fñˆ‚ì∞¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Çîf7Bñ÷VÁB6ˆÊfó&÷VB‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢7FGW3¢fñÊ∆ó¶VBÁ7FGW2¿¢&VÁD6ˆFS¢fñÊ∆ó¶VBÁ&VÁD6ˆFR¿¢6ÊF&˜É¢G'VR¿¢“ì∞¢–†¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Çîf7Bñ÷VÁB6ˆÊfó&÷VB‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢6ÊF&˜É¢G'VR¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%6ÊF&˜Çîf7B6ˆÊfó&÷Fñˆ‚W'&˜#¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6ˆÊfó&“6ÊF&˜Çñ÷VÁB"“ì∞¢–¢“ì∞†¢ÚÚvVÊW&FR7GVFVÁB6ˆFRf˜"66WFVB&˜˜6¬Ö&VÁBê¢Á˜7BÇ"ˆí˜&VÁBˆvVÊW&FR◊7GVFVÁB÷6ˆFR"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	¯È2vVÊW&FR7GVFVÁB6ˆFR&WVW7Bg&ˆ“&VÁC¢"¬&VÁDñBì∞†¢ÚÚvWBFÜR∆FW7BVÁ&ˆ∆∆÷VÁBFÜBÜ2∆ñÊ∂VB&˜˜6¬‡¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜#¢VÁ&ˆ∆∆÷VÁDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬7FGW2¬&˜˜6≈ˆñB"ê¢ÊWÇ'W6W%ˆñB"¬&VÁDñBê¢ÊÊ˜BÇ'&˜˜6≈ˆñB"¬&ó2"¬ÁV∆¬ê¢Ê˜&FW"Ç'WFFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤VÁ&ˆ∆∆÷VÁC¢"¬VÁ&ˆ∆∆÷VÁB¬$W'&˜#¢"¬VÁ&ˆ∆∆÷VÁDW'&˜"ì∞†¢ñbÇVÁ&ˆ∆∆÷VÁB«¬VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)ÿ¬ÊÚ&˜˜6¬f˜VÊBf˜"&VÁB"ì∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚ&˜˜6¬f˜VÊB"“ì∞¢–†¢ÚÚ6ÜV6≤ñb&˜˜6¬ó266WFV@¢6ˆÁ7B≤FF¢&˜˜6¬¬W'&˜#¢&˜˜6ƒW'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢Á6V∆V7BÇ&ñB¬66WFVEˆB¬&VÁEˆ6ˆFR"ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBê¢Á6ñÊv∆RÇì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8B&˜˜6√¢"¬&˜˜6¬¬$W'&˜#¢"¬&˜˜6ƒW'&˜"ì∞†¢ñbÇ&˜˜6¬«¬&˜˜6¬Ê66WFVEˆBí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)ÿ¬&˜˜6¬Ê˜BñWB66WFVB"ì∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%&˜˜6¬Ê˜BñWB66WFVB"“ì∞¢–†¢ÚÚñb6ˆFR«&VGíWÜó7G2¬&WGW&‚ó@¢ñbá&˜˜6¬Á&VÁEˆ6ˆFRí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)»R6ˆFR«&VGíWÜó7G3¢"¬&˜˜6¬Á&VÁEˆ6ˆFRì∞¢&WGW&‚&W2Êß6ˆ‚á≤&VÁD6ˆFS¢&˜˜6¬Á&VÁEˆ6ˆFR“ì∞¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	¯Î"vVÊW&FñÊrÊWr&VÁB6ˆFR‚‚‚"ì∞†¢ÚÚvVÊW&FRVÊóVR&VÁB6ˆFP¢6ˆÁ7BvVÊW&FU&VÁD6ˆFR“Çí”‚∞¢6ˆÁ7B6Ü'2“t$4DTdtÑ§¥ƒ‘Â%5EUeuÖï£#3CScsÉís∞¢∆WB6ˆFR“rs∞¢f˜"Ü∆WBí“≤í¬É≤í≤≤í∞¢6ˆFR≥“6Ü'2Ê6Ü$BÑ÷FÇÊf∆ˆ˜"Ñ÷FÇÁ&ÊFˆ“Çí¢6Ü'2Ê∆VÊwFÇíì∞¢–¢&WGW&‚6ˆFS∞¢”∞†¢∆WB&VÁD6ˆFR“vVÊW&FU&VÁD6ˆFRÇì∞¢∆WB6ˆFTó5VÊóVR“f«6S∞¢∆WBGFV◊G2“∞†¢vÜñ∆RÇ6ˆFTó5VÊóVRbbGFV◊G2¬í∞¢6ˆÁ7B≤FF¢WÜó7FñÊr““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ'&VÁEˆ6ˆFR"¬&VÁD6ˆFRê¢Ê÷ñ&U6ñÊv∆RÇì∞¢ ¢ñbÇWÜó7FñÊrí∞¢6ˆFTó5VÊóVR“G'VS∞¢“V«6R∞¢&VÁD6ˆFR“vVÊW&FU&VÁD6ˆFRÇì∞¢GFV◊G2≤≥∞¢–¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	¯Î"vVÊW&FVBVÊóVR6ˆFS¢"¬&VÁD6ˆFRì∞†¢ÚÚ6fR6ˆFRFÚ&˜˜6¿¢6ˆÁ7B≤W'&˜#¢WFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢ÁWFFRá∞¢&VÁEˆ6ˆFS¢&VÁD6ˆFR¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬&˜˜6¬ÊñBì∞†¢ñbáWFFTW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç.)ÿ¬W'&˜"WFFñÊr&˜˜6¬vóFÇ&VÁB6ˆFS¢"¬WFFTW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚvVÊW&FR7GVFVÁB6ˆFR"“ì∞¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)»R7V66W76gV∆«í6fVB&VÁB6ˆFRFÚFF&6R"ì∞¢&W2Êß6ˆ‚á≤&VÁD6ˆFS¢&VÁD6ˆFR“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"vVÊW&FñÊr7GVFVÁB6ˆFS¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚvVÊW&FR7GVFVÁB6ˆFR"“ì∞¢–¢“ì∞†¢ÚÚFV6∆ñÊR&˜˜6¬Ö&VÁBê¢Á˜7BÇ"ˆí˜&VÁB˜&˜˜6¬ˆFV6∆ñÊR"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B≤&V6ˆ‚““&WÊ&ˆGì≤ÚÚ˜FñˆÊ¬FV6∆ñÊR&V6ˆ‡†¢ÚÚvWB∆FW7BVÊFñÊr&˜˜6¬VÁ&ˆ∆∆÷VÁBf˜"FÜó2&VÁB‡¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜#¢VÁ&ˆ∆∆÷VÁDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ&ñB¬7FGW2¬&˜˜6≈ˆñB"ê¢ÊWÇ'W6W%ˆñB"¬&VÁDñBê¢ÊWÇ'7FGW2"¬'&˜˜6≈˜6VÁB"ê¢ÊÊ˜BÇ'&˜˜6≈ˆñB"¬&ó2"¬ÁV∆¬ê¢Ê˜&FW"Ç'WFFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÜVÁ&ˆ∆∆÷VÁDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrVÊFñÊrVÁ&ˆ∆∆÷VÁBf˜"FV6∆ñÊS¢"¬VÁ&ˆ∆∆÷VÁDW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfñÊBVÊFñÊr&˜˜6¬"“ì∞¢–†¢ñbÇVÁ&ˆ∆∆÷VÁB«¬VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÊFñÊr&˜˜6¬f˜VÊB"“ì∞¢–†¢ÚÚWFFRVÁ&ˆ∆∆÷VÁB7FGW2&6≤FÚ76ñvÊVBáGWF˜"6‚&Wfó6R&˜˜6¬ê¢6ˆÁ7B≤W'&˜#¢WFFTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢ÁWFFRá∞¢7FGW3¢&76ñvÊVB"¬ÚÚ&6≤FÚ76ñvÊVB“GWF˜"ÊVVG2FÚ&Wfó6P¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁBÊñBì∞†¢ñbáWFFTW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"FV6∆ñÊñÊr&˜˜6√¢"¬WFFTW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚFV6∆ñÊR&˜˜6¬"“ì∞¢–†¢6ˆÁ7B≤FF¢FV6∆ñÊVE&˜˜6¬““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢Á6V∆V7BÇ'GWF˜%ˆñB"ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ÚÚ÷&≤&˜˜6¬2FV6∆ñÊV@¢vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢ÁWFFRá∞¢FV6∆ñÊVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢FV6∆ñÊU˜&V6ˆ„¢&V6ˆ‚«¬ÁV∆¬¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBì∞†¢vóB6fU6VÊEW6ÇÄ¢FV6∆ñÊVE&˜˜6√ÚÁGWF˜%ˆñB¿¢∞¢FóF∆S¢%&˜˜6¬FV6∆ñÊVB"¿¢&ˆGì¢$&VÁBFV6∆ñÊVBñ˜W"ˆÊ&ˆ&FñÊr&˜˜6¬‚˜V‚&W7ˆÁ6RñÁFVw&óGíFÚ&Wfó6RFÜRÊWáB7FW‚"¿¢W&√¢"ˆ˜W&FñˆÊ¬˜GWF˜"˜ˆB"¿¢Fs¢GWF˜"◊&˜˜6¬÷FV6∆ñÊVB“G∂VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñG÷¿¢“¿¢'GWF˜"&˜˜6¬FV6∆ñÊVB"¿¢ì∞†¢&W2Êß6ˆ‚á≤÷W76vS¢%&˜˜6¬FV6∆ñÊVB‚ñ˜W"GWF˜"vñ∆¬&RÊ˜FñfñVB‚"¬7FGW3¢&76ñvÊVB"“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"FV6∆ñÊñÊr&˜˜6√¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚFV6∆ñÊR&˜˜6¬"“ì∞¢–¢“ì∞†¢ÚÚ÷ˆÁFÜ«í7V'67&óFñˆ‚&VÊWv¬(	B7&VFW2ÊWrîf7B6ÜV6∂˜WBf˜"FÜR7W'&VÁB÷ˆÁFÄ¢ÊvWBÇ"ˆí˜&VÁB˜ñ÷VÁB÷Üó7F˜'í"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“7G&ñÊrÇá&W2ÁííÊF%W6W"ÊñB«¬""íÁG&ñ“Çì∞¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7B&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬&˜fñFW"¬÷W&6ÜÁE˜&VfW&VÊ6R¬∆‚¬÷˜VÁB¬7W'&VÊ7í¬ñ÷VÁE˜7FGW2¬ñ÷VÁEˆFFR¬ñEˆB¬7&VFVEˆB¬&u˜ñ∆ˆ@¢e$Ù“V&∆ñ2Áñ÷VÁE˜G&Á67FñˆÁ0¢tÑU$R&VÁEˆñB“C¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïBS¿¢∑&VÁDñE“¿¢ì∞¢&WGW&‚&W2Êß6ˆ‚á∞¢ñ÷VÁG3¢&W7V«BÁ&˜w2Ê÷Çáñ÷VÁC¢Áíí”‚∞¢6ˆÁ7B&uñ∆ˆB“ñ÷VÁCÚÁ&u˜ñ∆ˆBbbGóVˆbñ÷VÁBÁ&u˜ñ∆ˆB””“&ˆ&¶V7B ¢Úñ÷VÁBÁ&u˜ñ∆ˆ@¢¢∑”∞¢&WGW&‚∞¢ñC¢ñ÷VÁBÊñB¿¢&˜fñFW#¢ñ÷VÁBÁ&˜fñFW"¿¢&VfW&VÊ6S¢ñ÷VÁBÊ÷W&6ÜÁE˜&VfW&VÊ6R¿¢∆„¢ñ÷VÁBÁ∆‚¿¢÷˜VÁC¢ÁV÷&W"áñ÷VÁBÊ÷˜VÁB«¬í¿¢7W'&VÊ7ì¢ñ÷VÁBÊ7W'&VÊ7í¿¢7FGW3¢7G&ñÊráñ÷VÁBÁñ÷VÁE˜7FGW2«¬'VÊFñÊr"íÁFıWW$66RÇí¿¢GóS¢&uñ∆ˆBÁ&VÊWv¬Ú$÷ˆÁFÜ«í&VÊWv¬"¢$÷ˆÁFÜ«í6∂vR"¿¢ñ÷VÁDFFS¢ñ÷VÁBÁñ÷VÁEˆFFR«¬ñ÷VÁBÁñEˆB«¬ñ÷VÁBÊ7&VFVEˆB¿¢7&VFVDC¢ñ÷VÁBÊ7&VFVEˆB¿¢”∞¢“í¿¢“ì∞¢–¢6ˆÁ7B≤FF¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'ñ÷VÁE˜G&Á67FñˆÁ2"ê¢Á6V∆V7BÇ&ñB¬&˜fñFW"¬÷W&6ÜÁE˜&VfW&VÊ6R¬∆‚¬÷˜VÁB¬7W'&VÊ7í¬ñ÷VÁE˜7FGW2¬ñ÷VÁEˆFFR¬ñEˆB¬7&VFVEˆB¬&u˜ñ∆ˆB"ê¢ÊWÇ'&VÁEˆñB"¬&VÁDñBê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ê¢Ê∆ñ÷óBÉSì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&VÁBñ÷VÁBÜó7F˜'ì¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Çñ÷VÁBÜó7F˜'í"“ì∞¢–†¢&W2Êß6ˆ‚á∞¢ñ÷VÁG3¢ÜFF«¬µ“íÊ÷Çáñ÷VÁC¢Áíí”‚∞¢6ˆÁ7B&uñ∆ˆB“ñ÷VÁCÚÁ&u˜ñ∆ˆBbbGóVˆbñ÷VÁBÁ&u˜ñ∆ˆB””“&ˆ&¶V7B ¢Úñ÷VÁBÁ&u˜ñ∆ˆ@¢¢∑”∞†¢&WGW&‚∞¢ñC¢ñ÷VÁBÊñB¿¢&˜fñFW#¢ñ÷VÁBÁ&˜fñFW"¿¢&VfW&VÊ6S¢ñ÷VÁBÊ÷W&6ÜÁE˜&VfW&VÊ6R¿¢∆„¢ñ÷VÁBÁ∆‚¿¢÷˜VÁC¢ÁV÷&W"áñ÷VÁBÊ÷˜VÁB«¬í¿¢7W'&VÊ7ì¢ñ÷VÁBÊ7W'&VÊ7í¿¢7FGW3¢7G&ñÊráñ÷VÁBÁñ÷VÁE˜7FGW2«¬'VÊFñÊr"íÁFıWW$66RÇí¿¢GóS¢&uñ∆ˆBÁ&VÊWv¬Ú$÷ˆÁFÜ«í&VÊWv¬"¢$÷ˆÁFÜ«í6∂vR"¿¢ñ÷VÁDFFS¢ñ÷VÁBÁñ÷VÁEˆFFR«¬ñ÷VÁBÁñEˆB«¬ñ÷VÁBÊ7&VFVEˆB¿¢7&VFVDC¢ñ÷VÁBÊ7&VFVEˆB¿¢”∞¢“í¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$WÜ6WFñˆ‚fWF6ÜñÊr&VÁBñ÷VÁBÜó7F˜'ì¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Çñ÷VÁBÜó7F˜'í"“ì∞¢–¢“ì∞†¢Á˜7BÇ"ˆí˜&VÁB˜ñ÷VÁG2˜&VÊWr"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞†¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜#¢VÁ&ˆ∆∆÷VÁDW'&˜"““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñB¿¢&ñ÷'ï6V∆V7C¢&ñB¬7FGW2¬7GVFVÁEˆgV∆≈ˆÊ÷R¬76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬¬ó5˜6ÊF&˜Öˆ66˜VÁB¬76ñvÊVE˜7GVFVÁEˆñB¬7W'&VÁE˜7FW¬6∂vUˆ∂Wí¬6∂vU˜6W76ñˆÁ2¬∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≤"¿¢f∆∆&6µ6V∆V7C¢&ñB¬7FGW2¬7GVFVÁEˆgV∆≈ˆÊ÷R¬76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬¬ó5˜6ÊF&˜Öˆ66˜VÁB¬7W'&VÁE˜7FW¬6∂vUˆ∂Wí¬6∂vU˜6W76ñˆÁ2¬∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≤"¿¢“ì∞†¢6ˆÁ7B7FófU7FGW6W2“≤&6ˆÊfó&÷VB"¬'6W76ñˆÂˆ&ˆˆ∂VB"¬'&W˜'E˜&V6VófVB%”∞¢ñbÜVÁ&ˆ∆∆÷VÁDW'&˜"«¬VÁ&ˆ∆∆÷VÁB«¬7FófU7FGW6W2ÊñÊ6«VFW2ÜVÁ&ˆ∆∆÷VÁBÁ7FGW2íí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚ7FófRVÁ&ˆ∆∆÷VÁBf˜VÊBf˜"&VÊWv¬‚"“ì∞¢–†¢6ˆÁ7BW6U6ÊF&˜Ç“ó56ÊF&˜Öñ÷VÁDVÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBì∞¢ñbÇó4÷ˆÁFÜ«ï6∂vUñ÷VÁE&VGíáW6U6ÊF&˜Çíí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢%îf7Bó2Ê˜B6ˆÊfñwW&VBˆ‚FÜó2FW∆˜ñ÷VÁB‚"“ì∞¢–¢6ˆÁ7B6W'fñ6U6∂vR“vWD÷ˆÁFÜ«ï6W'fñ6U6∂vRÜVÁ&ˆ∆∆÷VÁBÁ6∂vUˆ∂Wíì∞†¢∆WB÷ˆÁFÑ∂Wí“FÙ÷ˆÁFÑ∂WíÜvWD÷ˆÁFÖ7F'Dó6ÚÜÊWrFFRÇíÁFÙï4ı7G&ñÊrÇííì∞¢6ˆÁ7B6ÊˆÊñ6≈7GVFVÁB“vóB&W6ˆ«fT6ÊˆÊñ6≈7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBì∞¢6ˆÁ7B7GVFVÁDñB“6ÊˆÊñ6≈7GVFVÁCÚÊñB«¬VÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜7GVFVÁEˆñB«¬ÁV∆√∞¢6ˆÁ7Bó56ÊF&˜Ñ6ˆÁFWáB“ó56ÊF&˜Öñ÷VÁDVÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBì∞†¢∆WB÷ˆÁFÜ«ïV˜F“ÁV∆√∞¢ñbá7GVFVÁDñBí∞¢÷ˆÁFÜ«ïV˜F“vóBvWD÷ˆÁFÜ«ï6W76ñˆÂV˜F6Ê6Ü˜Bá∞¢&VÁDñB¿¢7GVFVÁDñC¢7G&ñÊrá7GVFVÁDñBí¿¢ó56ÊF&˜Ñ6ˆÁFWáB¿¢“ì∞¢–†¢ñbÜ÷ˆÁFÜ«ïV˜FbbÁV÷&W"Ü÷ˆÁFÜ«ïV˜FÁ6W76ñˆÁ5˜&V÷ñÊñÊr«¬í‚í∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS¢ñ˜W"7W'&VÁBG∑6W'fñ6U6∂vRÁ6W76ñˆÁ5W$÷ˆÁFá“◊6W76ñˆ‚÷ˆÁFÜ«í6∂vRó2Ê˜B6ˆ◊∆WFRñWB‚&VÊWv¬˜VÁ2gFW"∆¬6∂vR6W76ñˆÁ2&RW6VBÊ¿¢“ì∞¢–†¢ñbáW6U6ÊF&˜Çí∞¢ñbÇ÷ˆÁFÜ«ïV˜Fí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Ç6∂vR÷7ñ6∆RWFÜ˜&óGíó2VÊfñ∆&∆R‚&VÊWv¬6ÊÊ˜B7&VFR‚VÁfW&ñfñVBVÁFóF∆V÷VÁB‚"¿¢“ì∞¢–¢6ˆÁ7BÊWáD7ñ6∆T∂Wí“ÊWáE6ÊF&˜Ñ7ñ6∆T∂WíÜ÷ˆÁFÜ«ïV˜FÊ÷ˆÁFÖˆ∂Wíì∞¢ñbÇÊWáD7ñ6∆T∂Wíí∞¢&WGW&‚&W2Á7FGW2ÉCííÊß6ˆ‚á∞¢÷W76vS¢%6ÊF&˜Ç6∂vR÷7ñ6∆R∆ñÊVvRó2ñÁf∆ñB‚&VÊWv¬&V÷ñÁ2&∆ˆ6∂VB‚"¿¢“ì∞¢–¢ÚÚˆÊ«í‚Wá∆ñ6óBñB6ÊF&˜Ç&VÊWv¬GfÊ6W2FÜR6ñ◊V∆FVB7ñ6∆R‡¢ÚÚFÜR6∆VÊF"FFRÜ2ÊÚWFÜ˜&óGí˜fW"6ÊF&˜Ç6∂vR66óGí‡¢÷ˆÁFÑ∂Wí“ÊWáD7ñ6∆T∂Wì∞¢–†¢∆WBWÜó7FñÊu&VÊWv≈ñ÷VÁEVW'í“7W&6P¢Êg&ˆ“Ç'ñ÷VÁE˜G&Á67FñˆÁ2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ'&VÁEˆñB"¬&VÁDñBê¢ÊWÇ'&˜fñFW""¬î‘TÂEı$ıdîDU%ıîd5Bê¢ÊWÇ'ñ÷VÁE˜7FGW2"¬'ñB"ê¢ÊWÇ&VÁ&ˆ∆∆÷VÁEˆñB"¬VÁ&ˆ∆∆÷VÁBÊñBê¢Ê6ˆÁFñÁ2Ç'&u˜ñ∆ˆB"¬≤&VÊWv√¢G'VR¬÷ˆÁFÖˆ∂Wì¢÷ˆÁFÑ∂Wí“ì∞†¢6ˆÁ7B≤FF¢WÜó7FñÊu&VÊWv≈ñ÷VÁB““vóBWÜó7FñÊu&VÊWv≈ñ÷VÁEVW'ê¢Ê∆ñ÷óBÉê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÜWÜó7FñÊu&VÊWv≈ñ÷VÁBí∞¢vóB«ï&VÊWv≈G&Á67FñˆÂFÙ÷V÷&W'6Üó÷ˆÁFÇÜWÜó7FñÊu&VÊWv≈ñ÷VÁBì∞¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%FÜó2÷ˆÁFÇw2&VÊWv¬ñ÷VÁBÜ2«&VGí&VV‚÷FR‚"¿¢ñ÷VÁE7FGW3¢%îB"¿¢«&VGïñC¢G'VR¿¢“ì∞¢–†¢6ˆÁ7B÷W&6ÜÁE&VfW&VÊ6R“&W7ˆÁ6R÷ñÁFVw&óGí◊&VÊWv¬“G∂÷ˆÁFÑ∂Wó““G∑WVñGcBÇó÷∞¢6ˆÁ7Bñf7D6ˆÊfñr“vWEñf7D6ˆÊfñráW6U6ÊF&˜Çì∞¢6ˆÁ7BÊ˜tó6Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇì∞†¢6ˆÁ7B≤FF¢6fVEñ÷VÁB¬W'&˜#¢ñ÷VÁE6fTW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'ñ÷VÁE˜G&Á67FñˆÁ2"ê¢ÊñÁ6W'Bá∞¢&VÁEˆñC¢&VÁDñB¿¢VÁ&ˆ∆∆÷VÁEˆñC¢VÁ&ˆ∆∆÷VÁBÊñB¿¢7GVFVÁEˆñC¢7GVFVÁDñB¿¢&˜fñFW#¢î‘TÂEı$ıdîDU%ıîd5B¿¢ñ÷VÁE˜7FGW3¢'VÊFñÊr"¿¢∆„¢6W'fñ6U6∂vRÊ∆&V¬¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"ÁFÙfóÜVBÉ"í¿¢7W'&VÊ7ì¢%§""¿¢GWF˜%˜6Ü&S¢6W'fñ6U6∂vRÁ7V6ñ∆ó7D∆∆ˆ6FñˆÂ¶"ÁFÙfóÜVBÉ"í¿¢∆Ff˜&’˜6Ü&S¢6W'fñ6U6∂vRÁ&W7ˆÁ6TñÁFVw&óGî∆∆ˆ6FñˆÂ¶"ÁFÙfóÜVBÉ"í¿¢6∂vUˆ∂Wì¢6W'fñ6U6∂vRÊ∂Wí¿¢6∂vU˜6W76ñˆÁ3¢6W'fñ6U6∂vRÁ6W76ñˆÁ5W$÷ˆÁFÇ¿¢∆ÊÊVE˜6W76ñˆÁ5˜W%˜vVV≥¢6W'fñ6U6∂vRÁ∆ÊÊVE6W76ñˆÁ5W%vVV≤¿¢6W76ñˆÂ˜&ñ6S¢4U54îÙÂı$î4Uı§"¿¢÷W&6ÜÁE˜&VfW&VÊ6S¢÷W&6ÜÁE&VfW&VÊ6R¿¢óFV’ˆÊ÷S¢G∑6W'fñ6U6∂vRÊ∆&V«“&VÊWv∆¿¢óFV’ˆFW67&óFñˆ„¢'Vñ∆E6∂vUñ÷VÁDFW67&óFñˆ‚ÜVÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R¬6W'fñ6U6∂vRÊ∂Wíí¿¢&u˜ñ∆ˆC¢∞¢ñf7Eˆ÷ˆFS¢W6U6ÊF&˜ÇÚ'6ÊF&˜Ç"¢&∆ófR"¿¢&VÊWv√¢G'VR¿¢÷ˆÁFÖˆ∂Wì¢÷ˆÁFÑ∂Wí¿¢6∂vUˆ∂Wì¢6W'fñ6U6∂vRÊ∂Wí¿¢“¿¢7&VFVEˆC¢Ê˜tó6Ú¿¢WFFVEˆC¢Ê˜tó6Ú¿¢“ê¢Á6V∆V7BÇ"¢"ê¢Á6ñÊv∆RÇì∞†¢ñbáñ÷VÁE6fTW'&˜"«¬6fVEñ÷VÁBí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6fñÊr&VÊWv¬ñ÷VÁBG&Á67Fñˆ„¢"¬ñ÷VÁE6fTW'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&W&R&VÊWv¬ñ÷VÁB‚"“ì∞¢–†¢6ˆÁ7Bñf7DfñV∆G2“vóFÖñf7E6ñvÊGW&RÄ¢∞¢÷W&6ÜÁEˆñC¢ñf7D6ˆÊfñrÊ÷W&6ÜÁDñB¿¢÷W&6ÜÁEˆ∂Wì¢ñf7D6ˆÊfñrÊ÷W&6ÜÁD∂Wí¿¢&WGW&Â˜W&√¢W6U6ÊF&˜ÇÚ'Vñ∆Eñf7E6ÊF&˜Ö&WGW&ÂW&¬á&W¬'&WGW&‚"¬÷W&6ÜÁE&VfW&VÊ6Rí¢G∂vWD&6UW&¬Çó“ˆ6∆ñVÁB˜&VÁBˆvFWvì˜ñf7C◊&WGW&‚f÷W&6ÜÁE&VfW&VÊ6S“G∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÜ÷W&6ÜÁE&VfW&VÊ6Ró“g&VÊWv√◊G'VV¿¢6Ê6V≈˜W&√¢W6U6ÊF&˜ÇÚ'Vñ∆Eñf7E6ÊF&˜Ö&WGW&ÂW&¬á&W¬&6Ê6V∆∆VB"¬÷W&6ÜÁE&VfW&VÊ6Rí¢G∂vWD&6UW&¬Çó“ˆ6∆ñVÁB˜&VÁBˆvFWvì˜ñf7C÷6Ê6V∆∆VBf÷W&6ÜÁE&VfW&VÊ6S“G∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÜ÷W&6ÜÁE&VfW&VÊ6Ró“g&VÊWv√◊G'VV¿¢Ê˜Fñgï˜W&√¢G∂vWDïV&∆ñ5W&¬Çó“ˆí˜ñ÷VÁG2˜ñf7BˆÊ˜Fñgñ¿¢Ê÷Uˆfó'7C¢7G&ñÊrÇá&W2ÁííÊF%W6W#ÚÊfó'7DÊ÷R«¬""íÁG&ñ“Çí¿¢Ê÷Uˆ∆7C¢7G&ñÊrÇá&W2ÁííÊF%W6W#ÚÊ∆7DÊ÷R«¬""íÁG&ñ“Çí¿¢V÷ñ≈ˆFG&W73¢&W6ˆ«fUñf7DV÷ñƒFG&W72á∞¢F%W6W$V÷ñ√¢á&W2ÁííÊF%W6W#ÚÊV÷ñ¬¿¢VÁ&ˆ∆∆÷VÁDV÷ñ√¢VÁ&ˆ∆∆÷VÁBÁ&VÁEˆV÷ñ¬¿¢&VÁDñB¿¢W6U6ÊF&˜Ç¿¢“í¿¢’˜ñ÷VÁEˆñC¢÷W&6ÜÁE&VfW&VÊ6R¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"ÁFÙfóÜVBÉ"í¿¢óFV’ˆÊ÷S¢G∑6W'fñ6U6∂vRÊ∆&V«“&VÊWv∆¿¢óFV’ˆFW67&óFñˆ„¢'Vñ∆E6∂vUñ÷VÁDFW67&óFñˆ‚ÜVÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R¬6W'fñ6U6∂vRÊ∂Wíí¿¢7W7Fˆ’˜7G#¢7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÊñBí¿¢7W7Fˆ’˜7G#S¢6W'fñ6U6∂vRÊ∂Wí¿¢“¿¢ñf7D6ˆÊfñrÁ77á&6R¿¢ì∞†¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%&VÊWv¬ñ÷VÁB&W&VB‚"¿¢6∂vT∂Wì¢6W'fñ6U6∂vRÊ∂Wí¿¢6W76ñˆÁ5W$÷ˆÁFÉ¢6W'fñ6U6∂vRÁ6W76ñˆÁ5W$÷ˆÁFÇ¿¢÷˜VÁC¢6W'fñ6U6∂vRÊ÷˜VÁE¶"¿¢÷W&6ÜÁE&VfW&VÊ6R¿¢6ÜV6∂˜WEW&√¢ñf7D6ˆÊfñrÁ&ˆ6W75W&¬¿¢6ÊF&˜É¢W6U6ÊF&˜Ç¿¢f˜&‘fñV∆G3¢ñf7DfñV∆G2¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"&W&ñÊr&VÊWv¬ñ÷VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ&W&R&VÊWv¬ñ÷VÁB‚"“ì∞¢–¢“ì∞†¢ÚÚ”””””””””””””””””””””””””””””””””””””””–¢ÚÚ5ETDTÂBUDÇ$ıUDU0¢ÚÚ”””””””””””””””””””””””””””””””””””””””–†¢ÚÚ7GVFVÁB6ñvÁWvóFÇ&VÁB6ˆFRf∆ñFFñˆ‡¢Á˜7BÇ"ˆí˜7GVFVÁB˜6ñvÁW"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤V÷ñ¬¬77v˜&B¬fó'7DÊ÷R¬∆7DÊ÷R¬&VÁD6ˆFR““&WÊ&ˆGì∞¢6ˆÁ7BÊ˜&÷∆ó¶VDV÷ñ¬“7G&ñÊrÜV÷ñ¬«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7BÊ˜&÷∆ó¶VE&VÁD6ˆFR“7G&ñÊrá&VÁD6ˆFR«¬""íÁG&ñ“ÇíÁFıWW$66RÇì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	¯È27GVFVÁB6ñvÁW&WVW7C¢"¬∞¢V÷ñ√¢Ê˜&÷∆ó¶VDV÷ñ¬¿¢fó'7DÊ÷R¿¢∆7DÊ÷R¿¢&VÁD6ˆFS¢Ê˜&÷∆ó¶VE&VÁD6ˆFR¿¢“ì∞†¢ñbÇÊ˜&÷∆ó¶VDV÷ñ¬«¬77v˜&B«¬Ê˜&÷∆ó¶VE&VÁD6ˆFRí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$V÷ñ¬¬77v˜&B¬ÊB&VÁB6ˆFR&R&WVó&VB"“ì∞¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘H“f∆ñFFñÊr&VÁB6ˆFS¢"¬Ê˜&÷∆ó¶VE&VÁD6ˆFRì∞†¢∆WB&˜˜6√¢Áí“ÁV∆√∞¢∆WB&˜˜6ƒW'&˜#¢Áí“ÁV∆√∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢G'í∞¢6ˆÁ7B&˜˜6≈&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5@¢ñC£ßFWáB¿¢7GVFVÁEˆñC£ßFWáB¿¢66WFVEˆB¿¢&VÁEˆ6ˆFR¿¢GWF˜%ˆñC£ßFWáB¿¢VÁ&ˆ∆∆÷VÁEˆñC£ßFWá@¢e$Ù“V&∆ñ2ÊˆÊ&ˆ&FñÊu˜&˜˜6«0¢tÑU$RWW"á&VÁEˆ6ˆFRí“C¢ƒî‘ïB¿¢∂Ê˜&÷∆ó¶VE&VÁD6ˆFU“¿¢ì∞¢&˜˜6¬“&˜˜6≈&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢“6F6ÇÜW'&˜"í∞¢&˜˜6ƒW'&˜"“W'&˜#∞¢–¢“V«6R∞¢6ˆÁ7B&˜˜6≈&W7V«B“vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢Á6V∆V7BÇ&ñB¬7GVFVÁEˆñB¬66WFVEˆB¬&VÁEˆ6ˆFR¬GWF˜%ˆñB¬VÁ&ˆ∆∆÷VÁEˆñB"ê¢ÊWÇ'&VÁEˆ6ˆFR"¬Ê˜&÷∆ó¶VE&VÁD6ˆFRê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢&˜˜6¬“&˜˜6≈&W7V«BÊFF∞¢&˜˜6ƒW'&˜"“&˜˜6≈&W7V«BÊW'&˜#∞¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8≤&˜˜6¬f˜VÊC¢"¬&˜˜6¬¬$W'&˜#¢"¬&˜˜6ƒW'&˜"ì∞†¢ñbá&˜˜6ƒW'&˜"«¬&˜˜6¬í∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)ÿ¬ñÁf∆ñB&VÁB6ˆFR"ì∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ñÁf∆ñB&VÁB6ˆFR"“ì∞¢–†¢ñbÇ&˜˜6¬Ê66WFVEˆBí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)ÿ¬&˜˜6¬Ê˜B66WFVBñWB"ì∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%&VÁBÜ2Ê˜BñWB66WFVBFÜR&˜˜6¬f˜"FÜó26ˆFR"“ì∞¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘H“6ÜV6∂ñÊrñb6ˆFR«&VGíW6VB‚‚‚"ì∞¢∆WBWÜó7FñÊu7GVFVÁC¢Áí“ÁV∆√∞¢∆WB6ÜV6¥W'&˜#¢Áí“ÁV∆√∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢G'í∞¢6ˆÁ7BWÜó7FñÊu&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñC£ßFWá@¢e$Ù“V&∆ñ2Á7GVFVÁE˜W6W'0¢tÑU$RWW"á&VÁEˆ6ˆFRí“C¢ƒî‘ïB¿¢∂Ê˜&÷∆ó¶VE&VÁD6ˆFU“¿¢ì∞¢WÜó7FñÊu7GVFVÁB“WÜó7FñÊu&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢“6F6ÇÜW'&˜"í∞¢6ÜV6¥W'&˜"“W'&˜#∞¢–¢“V«6R∞¢6ˆÁ7BWÜó7FñÊu&W7V«B“vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ'&VÁEˆ6ˆFR"¬Ê˜&÷∆ó¶VE&VÁD6ˆFRê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢WÜó7FñÊu7GVFVÁB“WÜó7FñÊu&W7V«BÊFF∞¢6ÜV6¥W'&˜"“WÜó7FñÊu&W7V«BÊW'&˜#∞¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘RWÜó7FñÊr7GVFVÁC¢"¬WÜó7FñÊu7GVFVÁB¬$6ÜV6≤W'&˜#¢"¬6ÜV6¥W'&˜"ì∞†¢ñbÜ6ÜV6¥W'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç.)ÿ¬fñ∆VBFÚfW&ñgí&VÁB6ˆFRW6vS¢"¬6ÜV6¥W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfW&ñgí&VÁB6ˆFR"“ì∞¢–†¢ñbÜWÜó7FñÊu7GVFVÁBí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)ÿ¬6ˆFR«&VGíW6VB"ì∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%FÜó2&VÁB6ˆFRÜ2«&VGí&VV‚W6VB"“ì∞¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘IÜ6ÜñÊr77v˜&B‚‚‚"ì∞¢6ˆÁ7B≤Ü6Ç““vóBñ◊˜'BÇ&&7'óFß2"ì∞¢6ˆÁ7BÜ6ÜVE77v˜&B“vóBÜ6Çá77v˜&B¬ì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘+‚7&VFñÊr7GVFVÁBW6W"ñ‚FF&6R‚‚‚"ì∞¢∆WB7GVFVÁEW6W#¢Áí“ÁV∆√∞¢∆WBñÁ6W'DW'&˜#¢Áí“ÁV∆√∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢G'í∞¢6ˆÁ7BñÁ6W'E&W7V«B“vóBˆˆ¬ÁVW'íÄ¢îÂ4U%BîÂDÚV&∆ñ2Á7GVFVÁE˜W6W'2Ä¢V÷ñ¬¿¢77v˜&B¿¢fó'7EˆÊ÷R¿¢∆7EˆÊ÷R¿¢7GVFVÁEˆñB¿¢&VÁEˆ6ˆFP¢ê¢d≈TU2ÇC¬C"¬C2¬CB¬CR¬Cbê¢$UEU$‰î‰p¢ñC£ßFWáB¿¢V÷ñ¬¿¢fó'7EˆÊ÷R¿¢∆7EˆÊ÷R¿¢7GVFVÁEˆñC£ßFWáB¿¢&VÁEˆ6ˆFR¿¢7&VFVEˆB¿¢∆7Eˆ∆ˆvñÊ¿¢∞¢Ê˜&÷∆ó¶VDV÷ñ¬¿¢Ü6ÜVE77v˜&B¿¢fó'7DÊ÷R«¬ÁV∆¬¿¢∆7DÊ÷R«¬ÁV∆¬¿¢&˜˜6¬Á7GVFVÁEˆñB«¬ÁV∆¬¿¢Ê˜&÷∆ó¶VE&VÁD6ˆFR¿¢“¿¢ì∞¢7GVFVÁEW6W"“ñÁ6W'E&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢“6F6ÇÜW'&˜#¢Áíí∞¢ñÁ6W'DW'&˜"“W'&˜#∞¢–¢“V«6R∞¢6ˆÁ7BñÁ6W'E&W7V«B“vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢ÊñÁ6W'Bá∞¢V÷ñ√¢Ê˜&÷∆ó¶VDV÷ñ¬¿¢77v˜&C¢Ü6ÜVE77v˜&B¿¢fó'7EˆÊ÷S¢fó'7DÊ÷R¿¢∆7EˆÊ÷S¢∆7DÊ÷R¿¢7GVFVÁEˆñC¢&˜˜6¬Á7GVFVÁEˆñB¿¢&VÁEˆ6ˆFS¢Ê˜&÷∆ó¶VE&VÁD6ˆFR¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢7GVFVÁEW6W"“ñÁ6W'E&W7V«BÊFF∞¢ñÁ6W'DW'&˜"“ñÁ6W'E&W7V«BÊW'&˜#∞¢–†¢ñbÜñÁ6W'DW'&˜"«¬7GVFVÁEW6W"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç.)ÿ¬W'&˜"7&VFñÊr7GVFVÁBW6W#¢"¬ñÁ6W'DW'&˜"ì∞¢ñbÜñÁ6W'DW'&˜#ÚÊ6ˆFR””“##3SR"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$7GVFVÁB66˜VÁB«&VGíWÜó7G2f˜"FÜó2V÷ñ¬˜"&VÁB6ˆFR"“ì∞¢–¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á∞¢÷W76vS¢$fñ∆VBFÚ7&VFR7GVFVÁB66˜VÁB"¿¢W'&˜#¢ñÁ6W'DW'&˜#ÚÊ÷W76vR«¬%7GVFVÁB66˜VÁBv2Ê˜B7&VFVB"¿¢“ì∞¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)»R7GVFVÁBW6W"7&VFVC¢"¬∞¢ñC¢7GVFVÁEW6W"ÊñB¿¢V÷ñ√¢7GVFVÁEW6W"ÊV÷ñ¬¿¢7GVFVÁDñC¢7GVFVÁEW6W"Á7GVFVÁEˆñB¿¢“ì∞†¢ÚÚ∂VWÁíVÊ∆ñÊ∂VBñÁG&Ú6W76ñˆ‚GF6ÜVBFÚFÜR6ÊˆÊñ6¬7GVFVÁB‡¢ñbá&˜˜6¬Á7GVFVÁEˆñBbb&˜˜6¬ÁGWF˜%ˆñBí∞¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢G'í∞¢∆WB&VÁDñC¢7G&ñÊr¬ÁV∆¬“ÁV∆√∞¢ñbá&˜˜6¬ÊVÁ&ˆ∆∆÷VÁEˆñBí∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BW6W%ˆñC£ßFWá@¢e$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$RñB“C¢ƒî‘ïB¿¢∑&˜˜6¬ÊVÁ&ˆ∆∆÷VÁEˆñE“¿¢ì∞¢&VÁDñB“VÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥”ÚÁW6W%ˆñB«¬ÁV∆√∞¢–†¢ñbá&VÁDñBí∞¢6ˆÁ7B∆ñÊµ&W7V«B“vóBˆˆ¬ÁVW'íÄ¢UDDRV&∆ñ2Á66ÜVGV∆VE˜6W76ñˆÁ0¢4UB7GVFVÁEˆñB“C£ßWVñB¿¢WFFVEˆB“‰ırÇê¢tÑU$R&VÁEˆñB“C ¢‰BGWF˜%ˆñB“C0¢‰B7GVFVÁEˆñBï2ÂTƒ¿¢‰BGóR“vñÁG&Úp¢$UEU$‰î‰rñC£ßFWáF¿¢∑&˜˜6¬Á7GVFVÁEˆñB¬&VÁDñB¬&˜˜6¬ÁGWF˜%ˆñE“¿¢ì∞¢ñbÜ∆ñÊµ&W7V«BÁ&˜w2Ê∆VÊwFÇ‚í∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)»R∆ñÊ∂VBñÁG&Ú6W76ñˆÁ2FÚ7GVFVÁEˆñC¢"¬∆ñÊµ&W7V«BÁ&˜w2Ê÷Çá&˜s¢Áíí”‚&˜rÊñBíì∞¢–¢–¢“6F6ÇÜ∆ñÊ¥W'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç.)ÿ¬W'&˜"∆ñÊ∂ñÊrñÁG&Ú6W76ñˆÁ2FÚ7GVFVÁEˆñC¢"¬∆ñÊ¥W'&˜"ì∞¢–¢“V«6R∞¢∆WB&VÁDñB“7G&ñÊrá&WÊ&ˆGíÁ&VÁDñB«¬""íÁG&ñ“Çí«¬ÁV∆√∞†¢ñbÇ&VÁDñBbb&˜˜6¬ÊVÁ&ˆ∆∆÷VÁEˆñBí∞¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB““vóB7W&6P¢Êg&ˆ“Ç'&VÁEˆVÁ&ˆ∆∆÷VÁG2"ê¢Á6V∆V7BÇ'W6W%ˆñB"ê¢ÊWÇ&ñB"¬&˜˜6¬ÊVÁ&ˆ∆∆÷VÁEˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞¢&VÁDñB“7G&ñÊrÜVÁ&ˆ∆∆÷VÁCÚÁW6W%ˆñB«¬""íÁG&ñ“Çí«¬ÁV∆√∞¢–†¢ñbá&VÁDñBí∞¢6ˆÁ7B≤FF¢ñÁG&ı6W76ñˆÁ2¬W'&˜#¢6W76ñˆ‰fWF6ÑW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'66ÜVGV∆VE˜6W76ñˆÁ2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ'&VÁEˆñB"¬&VÁDñBê¢ÊWÇ'GWF˜%ˆñB"¬&˜˜6¬ÁGWF˜%ˆñBê¢Êó2Ç'7GVFVÁEˆñB"¬ÁV∆¬ê¢ÊWÇ'GóR"¬&ñÁG&Ú"ì∞†¢ñbá6W76ñˆ‰fWF6ÑW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç.)ÿ¬W'&˜"fWF6ÜñÊrñÁG&Ú6W76ñˆÁ2f˜"7GVFVÁB∆ñÊ∂vS¢"¬6W76ñˆ‰fWF6ÑW'&˜"ì∞¢“V«6RñbÜñÁG&ı6W76ñˆÁ2bbñÁG&ı6W76ñˆÁ2Ê∆VÊwFÇ‚í∞¢6ˆÁ7B6W76ñˆ‰ñG2“ñÁG&ı6W76ñˆÁ2Ê÷Çá6W76ñˆ„¢Áíí”‚6W76ñˆ‚ÊñBì∞¢6ˆÁ7B≤W'&˜#¢WFFU6W76ñˆ‰W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'66ÜVGV∆VE˜6W76ñˆÁ2"ê¢ÁWFFRá≤7GVFVÁEˆñC¢&˜˜6¬Á7GVFVÁEˆñB¬WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí“ê¢Êñ‚Ç&ñB"¬6W76ñˆ‰ñG2ì∞†¢ñbáWFFU6W76ñˆ‰W'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç.)ÿ¬W'&˜"WFFñÊrñÁG&Ú6W76ñˆÁ2vóFÇ7GVFVÁEˆñC¢"¬WFFU6W76ñˆ‰W'&˜"ì∞¢“V«6R∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)»R∆ñÊ∂VBñÁG&Ú6W76ñˆÁ2FÚ7GVFVÁEˆñC¢"¬6W76ñˆ‰ñG2ì∞¢–¢–¢–¢–¢–†¢á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñB“7GVFVÁEW6W"ÊñC∞¢á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁDV÷ñ¬“7GVFVÁEW6W"ÊV÷ñ√∞¢&WÁ6W76ñˆ‚ÁF˜V6ÇÇì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ.)»R7GVFVÁB6ñvÁW7V66W76gV¬"ì∞¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%7GVFVÁB66˜VÁB7&VFVB7V66W76gV∆«í"¿¢W6W#¢∞¢ñC¢7GVFVÁEW6W"ÊñB¿¢V÷ñ√¢7GVFVÁEW6W"ÊV÷ñ¬¿¢fó'7DÊ÷S¢7GVFVÁEW6W"Êfó'7EˆÊ÷R¿¢∆7DÊ÷S¢7GVFVÁEW6W"Ê∆7EˆÊ÷R¿¢7GVFVÁDñC¢7GVFVÁEW6W"Á7GVFVÁEˆñB¿¢“¿¢“ì∞¢“6F6ÇÜW'&˜#¢Áíí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç.)ÿ¬7GVFVÁB6ñvÁWW'&˜#¢"¬W'&˜"ì∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç.)ÿ¬W'&˜"7F6≥¢"¬W'&˜"Á7F6≤ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFR7GVFVÁB66˜VÁB"¬W'&˜#¢W'&˜"Ê÷W76vR“ì∞¢–¢“ì∞†¢ÚÚ7GVFVÁB6ñvÊñ‡¢Á˜7BÇ"ˆí˜7GVFVÁB˜6ñvÊñ‚"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤V÷ñ¬¬77v˜&B““&WÊ&ˆGì∞¢6ˆÁ7BÊ˜&÷∆ó¶VDV÷ñ¬“7G&ñÊrÜV÷ñ¬«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞†¢ñbÇÊ˜&÷∆ó¶VDV÷ñ¬«¬77v˜&Bí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$V÷ñ¬ÊB77v˜&B&R&WVó&VB"“ì∞¢–†¢∆WB7GVFVÁEW6W#¢Áí“ÁV∆√∞¢∆WB∆ˆˆ∑WW'&˜#¢Áí“ÁV∆√∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢G'í∞¢6ˆÁ7BW6W%&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5@¢ñC£ßFWáB¿¢V÷ñ¬¿¢77v˜&B¿¢fó'7EˆÊ÷R¿¢∆7EˆÊ÷R¿¢7GVFVÁEˆñC£ßFWáB¿¢7&VFVEˆB¿¢∆7Eˆ∆ˆvñ‡¢e$Ù“V&∆ñ2Á7GVFVÁE˜W6W'0¢tÑU$R∆˜vW"ÜV÷ñ¬í“C¢ƒî‘ïB¿¢∂Ê˜&÷∆ó¶VDV÷ñ≈“¿¢ì∞¢7GVFVÁEW6W"“W6W%&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢“6F6ÇÜW'&˜"í∞¢∆ˆˆ∑WW'&˜"“W'&˜#∞¢–¢“V«6R∞¢6ˆÁ7BW6W%&W7V«B“vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ&V÷ñ¬"¬Ê˜&÷∆ó¶VDV÷ñ¬ê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢7GVFVÁEW6W"“W6W%&W7V«BÊFF∞¢∆ˆˆ∑WW'&˜"“W6W%&W7V«BÊW'&˜#∞¢–†¢ñbÜ∆ˆˆ∑WW'&˜"«¬7GVFVÁEW6W"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ñÁf∆ñB7&VFVÁFñ«2"“ì∞¢–†¢6ˆÁ7B≤6ˆ◊&R““vóBñ◊˜'BÇ&&7'óFß2"ì∞¢6ˆÁ7B77v˜&D÷F6Ç“vóB6ˆ◊&Rá77v˜&B¬7GVFVÁEW6W"Á77v˜&Bì∞†¢ñbÇ77v˜&D÷F6Çí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$ñÁf∆ñB7&VFVÁFñ«2"“ì∞¢–†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢vóBˆˆ¬ÁVW'íÄ¢UDDRV&∆ñ2Á7GVFVÁE˜W6W'0¢4UB∆7Eˆ∆ˆvñ‚“‰ırÇê¢tÑU$RñB“C¿¢∑7GVFVÁEW6W"ÊñE“¿¢ì∞¢“V«6R∞¢vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢ÁWFFRá≤∆7Eˆ∆ˆvñ„¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí“ê¢ÊWÇ&ñB"¬7GVFVÁEW6W"ÊñBì∞¢–†¢á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñB“7GVFVÁEW6W"ÊñC∞¢á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁDV÷ñ¬“7GVFVÁEW6W"ÊV÷ñ√∞¢&WÁ6W76ñˆ‚ÁF˜V6ÇÇì∞†¢&WGW&‚&W2Êß6ˆ‚á∞¢÷W76vS¢%6ñvÊVBñ‚7V66W76gV∆«í"¿¢W6W#¢∞¢ñC¢7GVFVÁEW6W"ÊñB¿¢V÷ñ√¢7GVFVÁEW6W"ÊV÷ñ¬¿¢fó'7DÊ÷S¢7GVFVÁEW6W"Êfó'7EˆÊ÷R¿¢∆7DÊ÷S¢7GVFVÁEW6W"Ê∆7EˆÊ÷R¿¢7GVFVÁDñC¢7GVFVÁEW6W"Á7GVFVÁEˆñB¿¢“¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%7GVFVÁB6ñvÊñ‚W'&˜#¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6ñv‚ñ‚"“ì∞¢–¢“ì∞†¢ÚÚvWB7W'&VÁB7GVFVÁBW6W ¢ÊvWBÇ"ˆí˜7GVFVÁBˆ÷R"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞†¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢∆WB7GVFVÁEW6W#¢Áí“ÁV∆√∞¢∆WB∆ˆˆ∑WW'&˜#¢Áí“ÁV∆√∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢G'í∞¢6ˆÁ7BW6W%&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5@¢ñC£ßFWáB¿¢V÷ñ¬¿¢fó'7EˆÊ÷R¿¢∆7EˆÊ÷R¿¢7GVFVÁEˆñC£ßFWáB¿¢7&VFVEˆB¿¢∆7Eˆ∆ˆvñ‡¢e$Ù“V&∆ñ2Á7GVFVÁE˜W6W'0¢tÑU$RñB“C¢ƒî‘ïB¿¢∑7GVFVÁEW6W$ñE“¿¢ì∞¢7GVFVÁEW6W"“W6W%&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢“6F6ÇÜW'&˜"í∞¢∆ˆˆ∑WW'&˜"“W'&˜#∞¢–¢“V«6R∞¢6ˆÁ7BW6W%&W7V«B“vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ&ñB¬V÷ñ¬¬fó'7EˆÊ÷R¬∆7EˆÊ÷R¬7GVFVÁEˆñB¬7&VFVEˆB¬∆7Eˆ∆ˆvñ‚"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢7GVFVÁEW6W"“W6W%&W7V«BÊFF∞¢∆ˆˆ∑WW'&˜"“W6W%&W7V«BÊW'&˜#∞¢–†¢ñbÜ∆ˆˆ∑WW'&˜"«¬7GVFVÁEW6W"í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBW6W"Ê˜Bf˜VÊB"“ì∞¢–†¢∆WBˆDÊ÷R“ÁV∆√∞†¢ñbá7GVFVÁEW6W"Á7GVFVÁEˆñBí∞¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7BˆE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BÁˆEˆÊ÷P¢e$Ù“V&∆ñ2Á7GVFVÁG20¢ƒTeB§Ùî‚V&∆ñ2ÁGWF˜%ˆ76ñvÊ÷VÁG2F¢Ù‚FÁGWF˜%ˆñB“2ÁGWF˜%ˆñ@¢ƒTeB§Ùî‚V&∆ñ2ÁˆG2 ¢Ù‚ÊñB“FÁˆEˆñ@¢tÑU$R2ÊñB“C¢ƒî‘ïB¿¢∑7GVFVÁEW6W"Á7GVFVÁEˆñE“¿¢ì∞¢ˆDÊ÷R“ˆE&W7V«BÁ&˜w5≥”ÚÁˆEˆÊ÷R«¬ÁV∆√∞¢“V«6R∞¢6ˆÁ7B≤FF¢7GVFVÁB““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁG2"ê¢Á6V∆V7BÇ'GWF˜%ˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W"Á7GVFVÁEˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbá7GVFVÁCÚÁGWF˜%ˆñBí∞¢6ˆÁ7B≤FF¢GWF˜$76ñvÊ÷VÁB““vóB7W&6P¢Êg&ˆ“Ç'GWF˜%ˆ76ñvÊ÷VÁG2"ê¢Á6V∆V7BÇ'ˆCßˆG2áˆEˆÊ÷Rí"ê¢ÊWÇ'GWF˜%ˆñB"¬7GVFVÁBÁGWF˜%ˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢6ˆÁ7BˆB“GWF˜$76ñvÊ÷VÁCÚÁˆB2≤ˆEˆÊ÷SÛ¢7G&ñÊr“¬ÁV∆√∞¢ñbáˆBí∞¢ˆDÊ÷R“ˆBÁˆEˆÊ÷R«¬ÁV∆√∞¢–¢–¢–¢–†¢&WGW&‚&W2Êß6ˆ‚á∞¢ñC¢7GVFVÁEW6W"ÊñB¿¢V÷ñ√¢7GVFVÁEW6W"ÊV÷ñ¬¿¢fó'7DÊ÷S¢7GVFVÁEW6W"Êfó'7EˆÊ÷R¿¢∆7DÊ÷S¢7GVFVÁEW6W"Ê∆7EˆÊ÷R¿¢7GVFVÁDñC¢7GVFVÁEW6W"Á7GVFVÁEˆñB¿¢7&VFVDC¢7GVFVÁEW6W"Ê7&VFVEˆB¿¢∆7D∆ˆvñ„¢7GVFVÁEW6W"Ê∆7Eˆ∆ˆvñ‚¿¢ˆDÊ÷R¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁBW6W#¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç7GVFVÁBW6W""“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜7GVFVÁBˆ6ˆ÷◊VÊñ6FñˆÁ2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ&ñB¬7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"«¬7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóB7F˜&vRÊvWE7GVFVÁBá7GVFVÁEW6W"Á7GVFVÁEˆñBì∞¢ñbÇ7GVFVÁB«¬7GVFVÁBÁGWF˜$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B&VÁDñB“vóB&W6ˆ«fU&VÁDñDf˜%7GVFVÁBá7GVFVÁB¬7GVFVÁBÁGWF˜$ñBì∞¢6ˆÁ7B'VÊF∆R“vóB'Vñ∆E7GVFVÁD6ˆ÷◊VÊñ6Fñˆ‰'VÊF∆Rá≤7GVFVÁB¬&VÁDñB“ì∞¢vóB÷&¥6ˆ÷◊VÊñ6FñˆÂFá&VE&VBá≤7GVFVÁDñC¢7GVFVÁBÊñB¬VFñVÊ6S¢'7GVFVÁB"¬fñWvW%&ˆ∆S¢'7GVFVÁB"“ì∞¢&W2Êß6ˆ‚á∞¢7GVFVÁC¢'VÊF∆RÁ7GVFVÁB¿¢GWF˜#¢'VÊF∆RÁGWF˜"¿¢&VÁC¢'VÊF∆RÁ&VÁB¿¢Fá&VC¢'VÊF∆RÁFá&VG2Á7GVFVÁB¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁB6ˆ÷◊VÊñ6FñˆÁ3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç6ˆ÷◊VÊñ6FñˆÁ2"“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜7GVFVÁBˆ6ˆ÷◊VÊñ6FñˆÁ2˜VÁ&VB÷6˜VÁB"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ&ñB¬7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"«¬7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Êß6ˆ‚á≤VÁ&VD6˜VÁC¢“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóB7F˜&vRÊvWE7GVFVÁBá7GVFVÁEW6W"Á7GVFVÁEˆñBì∞¢ñbÇ7GVFVÁB«¬7GVFVÁBÁGWF˜$ñBí∞¢&WGW&‚&W2Êß6ˆ‚á≤VÁ&VD6˜VÁC¢“ì∞¢–†¢6ˆÁ7BFá&VB“vóBVÁ7W&U7GVFVÁD6ˆ÷◊VÊñ6FñˆÂFá&VBá∞¢7GVFVÁDñC¢7GVFVÁBÊñB¿¢GWF˜$ñC¢7GVFVÁBÁGWF˜$ñB¿¢&VÁDñC¢vóB&W6ˆ«fU&VÁDñDf˜%7GVFVÁBá7GVFVÁB¬7GVFVÁBÁGWF˜$ñBí¿¢VFñVÊ6S¢'7GVFVÁB"¿¢“ì∞†¢6ˆÁ7B≤FF¬W'&˜#¢VÁ&VDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁEˆ6ˆ÷◊VÊñ6FñˆÂˆ÷W76vW2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ'Fá&VEˆñB"¬Fá&VBÊñBê¢ÊÊWÇ'6VÊFW%˜&ˆ∆R"¬'7GVFVÁB"ê¢Êó2Ç'&VEˆ'ï˜7GVFVÁEˆB"¬ÁV∆¬ì∞†¢ñbáVÁ&VDW'&˜"íFá&˜rVÁ&VDW'&˜#∞†¢&W2Êß6ˆ‚á≤VÁ&VD6˜VÁC¢ÜFF«¬µ“íÊ∆VÊwFÇ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁB6ˆ÷◊VÊñ6Fñˆ‚VÁ&VB6˜VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇVÁ&VB6˜VÁB"“ì∞¢–¢“ì∞†¢Á˜7BÇ"ˆí˜7GVFVÁBˆ6ˆ÷◊VÊñ6FñˆÁ2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B'6VB“ñÁ6W'E7GVFVÁD6ˆ÷◊VÊñ6Fñˆ‰÷W76vU66ÜV÷Á'6Rá≤‚‚‚á&WÊ&ˆGí«¬∑“í¬VFñVÊ6S¢'7GVFVÁB"“ì∞¢6ˆÁ7B≤FF¢7GVFVÁEW6W"¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ&ñB¬7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"«¬7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóB7F˜&vRÊvWE7GVFVÁBá7GVFVÁEW6W"Á7GVFVÁEˆñBì∞¢ñbÇ7GVFVÁB«¬7GVFVÁBÁGWF˜$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B&VÁDñB“vóB&W6ˆ«fU&VÁDñDf˜%7GVFVÁBá7GVFVÁB¬7GVFVÁBÁGWF˜$ñBì∞¢6ˆÁ7BñÁ6W'FVB“vóB7&VFU7GVFVÁD6ˆ÷◊VÊñ6Fñˆ‰÷W76vRá∞¢7GVFVÁB¿¢&VÁDñB¿¢VFñVÊ6S¢'7GVFVÁB"¿¢6VÊFW%&ˆ∆S¢'7GVFVÁB"¿¢6VÊFW%7GVFVÁEW6W$ñC¢7GVFVÁEW6W"ÊñB¿¢&W«ïFÙ÷W76vTñC¢'6VBÁ&W«ïFÙ÷W76vTñB¿¢÷W76vS¢'6VBÊ÷W76vR¿¢“ì∞†¢&W2Êß6ˆ‚á∞¢ñC¢ñÁ6W'FVBÊñB¿¢VFñVÊ6S¢ñÁ6W'FVBÊVFñVÊ6R¿¢7&VFVDC¢ñÁ6W'FVBÊ7&VFVEˆB¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6VÊFñÊr7GVFVÁB6ˆ÷◊VÊñ6Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ6VÊB÷W76vR"“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜7GVFVÁB˜6W76ñˆÁ2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B˜W&FñˆÊƒ÷ˆFR“vóBvWE7GVFVÁD˜W&FñˆÊƒ÷ˆFRá7GVFVÁEW6W"Á7GVFVÁEˆñBì∞¢ñbÇó4∆ófU66ÜVGV∆ñÊt÷ˆFRÜ˜W&FñˆÊƒ÷ˆFRíí∞¢&WGW&‚&W2Êß6ˆ‚á∞¢6W76ñˆÁ3¢µ“¿¢˜W&FñˆÊƒ÷ˆFR¿¢6W76ñˆÂ66ÜVGV∆ñÊtVÊ&∆VC¢f«6R¿¢“ì∞¢–†¢6ˆÁ7B≤FF¢6W76ñˆÁ2¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'66ÜVGV∆VE˜6W76ñˆÁ2"ê¢Á6V∆V7BÇ&ñB¬66ÜVGV∆VE˜Fñ÷R¬66ÜVGV∆VEˆVÊB¬Fñ÷W¶ˆÊR¬7FGW2¬GóR¬v˜&∂f∆˜u˜7FvR¬&VÁEˆ6ˆÊfó&÷VB¬GWF˜%ˆ6ˆÊfó&÷VB¬vˆˆv∆Uˆ÷VWE˜W&¬¬7&VFVEˆB¬WFFVEˆB"ê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁEW6W"Á7GVFVÁEˆñBê¢ÊÊ˜BÇ'7FGW2"¬&ñ‚"¬rÇ&6Ê6V∆∆VB"¬&f∆vvVB"írê¢Ê˜&FW"Ç'66ÜVGV∆VE˜Fñ÷R"¬≤66VÊFñÊs¢G'VR“ì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁB6W76ñˆÁ3¢"¬W'&˜"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç7GVFVÁB6W76ñˆÁ2"“ì∞¢–†¢&W2Êß6ˆ‚á∞¢6W76ñˆÁ3¢6W76ñˆÁ2«¬µ“¿¢˜W&FñˆÊƒ÷ˆFR¿¢6W76ñˆÂ66ÜVGV∆ñÊtVÊ&∆VC¢G'VR¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁB6W76ñˆÁ3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç7GVFVÁB6W76ñˆÁ2"“ì∞¢–¢“ì∞†¢ÚÚ7GVFVÁB∆ˆv˜W@¢Á˜7BÇ"ˆí˜7GVFVÁBˆ∆ˆv˜WB"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢&WÁ6W76ñˆ‚ÊFW7G&˜íÇÜW'"í”‚∞¢ñbÜW'"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"FW7G&˜ññÊr6W76ñˆ„¢"¬W'"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ∆ˆv˜WB"“ì∞¢–¢&W2Ê6∆V$6ˆˆ∂ñRÇ&6ˆÊÊV7BÁ6ñB"ì∞¢&W2Êß6ˆ‚á≤÷W76vS¢$∆ˆvvVB˜WB7V66W76gV∆«í"“ì∞¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$∆ˆv˜WBW'&˜#¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ∆ˆv˜WB"“ì∞¢–¢“ì∞†¢ÚÚ”””””””””””””””””””””””””””””””””””””””–¢ÚÚ5ETDTÂBı%D¬$ıUDU0¢ÚÚ”””””””””””””””””””””””””””””””””””””””–†¢ÚÚvWB7GVFVÁB7FG2Üv÷ñfñVBF6Ü&ˆ&Bê¢6ˆÁ7B&W6ˆ«fU7GVFVÁDñDf˜%˜'F≈6W76ñˆ‚“7ñÊ2á7GVFVÁEW6W$ñC¢7G&ñÊrí”‚∞¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7B&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5B7GVFVÁEˆñC£ßFWá@¢e$Ù“V&∆ñ2Á7GVFVÁE˜W6W'0¢tÑU$RñB“C¢ƒî‘ïB¿¢∑7GVFVÁEW6W$ñE“¿¢ì∞¢&WGW&‚7G&ñÊrá&W7V«BÁ&˜w5≥”ÚÁ7GVFVÁEˆñB«¬""íÁG&ñ“Çí«¬ÁV∆√∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢&WGW&‚7G&ñÊrá7GVFVÁEW6W#ÚÁ7GVFVÁEˆñB«¬""íÁG&ñ“Çí«¬ÁV∆√∞¢”∞†¢ÊvWBÇ"ˆí˜7GVFVÁB˜7FG2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B7GVFVÁDñB“vóB&W6ˆ«fU7GVFVÁDñDf˜%˜'F≈6W76ñˆ‚á7GVFVÁEW6W$ñBì∞†¢ñbÇ7GVFVÁDñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B7FG2“vóBvWE7GVFVÁDF6Ü&ˆ&E7FG2á7GVFVÁDñBì∞¢&W2Êß6ˆ‚á7FG2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁB7FG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç7FG2"“ì∞¢–¢“ì∞†¢ÚÚvWB7GVFVÁB6ˆ÷÷óF÷VÁG0¢ÊvWBÇ"ˆí˜7GVFVÁBˆ6ˆ÷÷óF÷VÁG2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B≤FF¢6ˆ÷÷óF÷VÁG2¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁEˆ6ˆ÷÷óF÷VÁG2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁEW6W"Á7GVFVÁEˆñBê¢ÊWÇ&ó5ˆ7FófR"¬G'VRê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚Ü6ˆ÷÷óF÷VÁG2«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr6ˆ÷÷óF÷VÁG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç6ˆ÷÷óF÷VÁG2"“ì∞¢–¢“ì∞†¢ÚÚ7&VFR7GVFVÁB6ˆ÷÷óF÷VÁ@¢Á˜7BÇ"ˆí˜7GVFVÁBˆ6ˆ÷÷óF÷VÁG2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B≤Ê÷R¬FW67&óFñˆ‚¬váïˆñ◊˜'FÁB¬Fñ«ïˆ7Fñˆ‚““&WÊ&ˆGì∞†¢6ˆÁ7B≤FF¢6ˆ÷÷óF÷VÁB¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁEˆ6ˆ÷÷óF÷VÁG2"ê¢ÊñÁ6W'Bá∞¢7GVFVÁEˆñC¢7GVFVÁEW6W"Á7GVFVÁEˆñB¿¢Ê÷R¿¢FW67&óFñˆ‚¿¢váïˆñ◊˜'FÁB¿¢Fñ«ïˆ7Fñˆ‚¿¢7G&Vµˆ6˜VÁC¢¿¢ó5ˆ7FófS¢G'VR¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚Ü6ˆ÷÷óF÷VÁBì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7&VFñÊr6ˆ÷÷óF÷VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFR6ˆ÷÷óF÷VÁB"“ì∞¢–¢“ì∞†¢ÚÚWFFR7GVFVÁB6ˆ÷÷óF÷VÁ@¢ÁWBÇ"ˆí˜7GVFVÁBˆ6ˆ÷÷óF÷VÁG2Û¶ñB"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B≤Ê÷R¬FW67&óFñˆ‚¬váïˆñ◊˜'FÁB¬Fñ«ïˆ7Fñˆ‚““&WÊ&ˆGì∞†¢6ˆÁ7B≤FF¢6ˆ÷÷óF÷VÁB¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁEˆ6ˆ÷÷óF÷VÁG2"ê¢ÁWFFRá∞¢Ê÷R¿¢FW67&óFñˆ‚¿¢váïˆñ◊˜'FÁB¿¢Fñ«ïˆ7Fñˆ‚¿¢WFFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚Ü6ˆ÷÷óF÷VÁBì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"WFFñÊr6ˆ÷÷óF÷VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚWFFR6ˆ÷÷óF÷VÁB"“ì∞¢–¢“ì∞†¢ÚÚFV∆WFR7GVFVÁB6ˆ÷÷óF÷VÁ@¢ÊFV∆WFRÇ"ˆí˜7GVFVÁBˆ6ˆ÷÷óF÷VÁG2Û¶ñB"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤ñB““&WÁ&◊3∞†¢6ˆÁ7B≤W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁEˆ6ˆ÷÷óF÷VÁG2"ê¢ÁWFFRá≤ó5ˆ7FófS¢f«6R“ê¢ÊWÇ&ñB"¬ñBì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚á≤7V66W73¢G'VR“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"FV∆WFñÊr6ˆ÷÷óF÷VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚFV∆WFR6ˆ÷÷óF÷VÁB"“ì∞¢–¢“ì∞†¢ÚÚ6ˆ◊∆WFR6ˆ÷÷óF÷VÁBf˜"FˆFê¢Á˜7BÇ"ˆí˜7GVFVÁBˆ6ˆ÷÷óF÷VÁG2Û¶ñBˆ6ˆ◊∆WFR"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7BFˆFí“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ7∆óBÇ%B"ï≥”∞†¢ÚÚ6ÜV6≤ñb«&VGí6ˆ◊∆WFVBFˆFê¢6ˆÁ7B≤FF¢WÜó7FñÊt∆ˆr““vóB7W&6P¢Êg&ˆ“Ç&6ˆ÷÷óF÷VÁEˆ∆ˆw2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ&6ˆ÷÷óF÷VÁEˆñB"¬ñBê¢ÊwFRÇ&6ˆ◊∆WFVEˆFFR"¬FˆFíê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÜWÜó7FñÊt∆ˆrí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$«&VGí6ˆ◊∆WFVBFˆFí"“ì∞¢–†¢ÚÚ∆ˆrFÜR6ˆ◊∆WFñˆ‡¢6ˆÁ7B≤FF¢∆ˆr¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&6ˆ÷÷óF÷VÁEˆ∆ˆw2"ê¢ÊñÁ6W'Bá∞¢6ˆ÷÷óF÷VÁEˆñC¢ñB¿¢6ˆ◊∆WFVEˆFFS¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞†¢ÚÚG&ñvvW"vñ∆¬WFÚ◊WFFR7G&V∞¢&W2Êß6ˆ‚Ü∆ˆrì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6ˆ◊∆WFñÊr6ˆ÷÷óF÷VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6ˆ◊∆WFR6ˆ÷÷óF÷VÁB"“ì∞¢–¢“ì∞†¢ÚÚvWB7GVFVÁB&Vf∆V7FñˆÁ0¢ÊvWBÇ"ˆí˜7GVFVÁB˜&Vf∆V7FñˆÁ2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B≤FF¢&Vf∆V7FñˆÁ2¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜&Vf∆V7FñˆÁ2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁEW6W"Á7GVFVÁEˆñBê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚á&Vf∆V7FñˆÁ2«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&Vf∆V7FñˆÁ3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&Vf∆V7FñˆÁ2"“ì∞¢–¢“ì∞†¢ÚÚ7&VFR7GVFVÁB&Vf∆V7Fñˆ‡¢Á˜7BÇ"ˆí˜7GVFVÁB˜&Vf∆V7FñˆÁ2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B≤&Vf∆V7FñˆÂ˜FWáB¬÷ˆˆB¬FFR““&WÊ&ˆGì∞¢ ¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘9“7&VFñÊr&Vf∆V7Fñˆ‚vóFÇFF¢"¬≤ ¢7GVFVÁEˆñC¢7GVFVÁEW6W"Á7GVFVÁEˆñB¬ ¢&Vf∆V7FñˆÂ˜FWáB¬ ¢÷ˆˆB¬ ¢FFR¿¢FFU&˜fñFVC¢FFR¿¢fñÊƒFFS¢FFR«¬ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇê¢“ì∞†¢6ˆÁ7B≤FF¢&Vf∆V7Fñˆ‚¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜&Vf∆V7FñˆÁ2"ê¢ÊñÁ6W'Bá∞¢7GVFVÁEˆñC¢7GVFVÁEW6W"Á7GVFVÁEˆñB¿¢&Vf∆V7FñˆÂ˜FWáB¿¢÷ˆˆB¿¢FFS¢FFR«¬ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7&VFñÊr&Vf∆V7Fñˆ„¢"¬W'&˜"ì∞¢Fá&˜rW'&˜#∞¢–¢&W2Êß6ˆ‚á&Vf∆V7Fñˆ‚ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7&VFñÊr&Vf∆V7Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFR&Vf∆V7Fñˆ‚"“ì∞¢–¢“ì∞†¢ÚÚvWB7GVFVÁB76ñvÊ÷VÁG0¢ÊvWBÇ"ˆí˜7GVFVÁBˆ76ñvÊ÷VÁG2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B≤FF¢76ñvÊ÷VÁG2¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&76ñvÊ÷VÁG2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁEW6W"Á7GVFVÁEˆñBê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚Ü76ñvÊ÷VÁG2«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr76ñvÊ÷VÁG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç76ñvÊ÷VÁG2"“ì∞¢–¢“ì∞†¢ÚÚ7V&÷óB76ñvÊ÷VÁ@¢Á˜7BÇ"ˆí˜7GVFVÁBˆ76ñvÊ÷VÁG2Û¶ñB˜7V&÷óB"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B≤7GVFVÁE˜&W7V«B¬7GVFVÁE˜v˜&≤““&WÊ&ˆGì∞†¢6ˆÁ7B≤FF¢76ñvÊ÷VÁB¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&76ñvÊ÷VÁG2"ê¢ÁWFFRá∞¢7GVFVÁE˜&W7V«B¿¢7GVFVÁE˜v˜&≤¿¢6ˆ◊∆WFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢7FGW3¢&6ˆ◊∆WFVB"¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚Ü76ñvÊ÷VÁBì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7V&÷óGFñÊr76ñvÊ÷VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7V&÷óB76ñvÊ÷VÁB"“ì∞¢–¢“ì∞†¢ÚÚvWB7GVFVÁB6FV÷ñ2&ˆfñ∆P¢ÊvWBÇ"ˆí˜7GVFVÁB˜&ˆfñ∆R"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B&ˆfñ∆R“vóB7F˜&vRÊvWD6FV÷ñ5&ˆfñ∆Rá7GVFVÁEW6W"Á7GVFVÁEˆñBì∞¢&W2Êß6ˆ‚á&ˆfñ∆R«¬∑“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁB&ˆfñ∆S¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç7GVFVÁB&ˆfñ∆R"“ì∞¢–¢“ì∞†¢Á˜7BÇ"ˆí˜7GVFVÁB˜&ˆfñ∆R"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B&ˆfñ∆R“vóB7F˜&vRÁW6W'D6FV÷ñ5&ˆfñ∆Rá∞¢7GVFVÁDñC¢7GVFVÁEW6W"Á7GVFVÁEˆñB¿¢gV∆ƒÊ÷S¢&WÊ&ˆGìÚÊgV∆ƒÊ÷R¿¢w&FS¢&WÊ&ˆGìÚÊw&FR¿¢66Üˆˆ√¢&WÊ&ˆGìÚÁ66Üˆˆ¬¿¢∆FW7EFW&’&W˜'C¢&WÊ&ˆGìÚÊ∆FW7EFW&’&W˜'B¿¢◊ïFÜ˜VváG3¢&WÊ&ˆGìÚÊ◊ïFÜ˜VváG2¿¢7W'&VÁD6Ü∆∆VÊvW3¢&WÊ&ˆGìÚÊ7W'&VÁD6Ü∆∆VÊvW2¿¢&V6VÁEvñÁ3¢&WÊ&ˆGìÚÁ&V6VÁEvñÁ2¿¢W6ˆ÷ñÊtWÜ◊5&ˆ¶V7G3¢&WÊ&ˆGìÚÁW6ˆ÷ñÊtWÜ◊5&ˆ¶V7G2¿¢“ì∞†¢&W2Êß6ˆ‚á&ˆfñ∆Rì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6fñÊr7GVFVÁB&ˆfñ∆S¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6fR7GVFVÁB&ˆfñ∆R"“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜7GVFVÁBˆ6FV÷ñ2◊&ˆfñ∆R"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B≤FF¢&ˆfñ∆R¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç&6FV÷ñ5˜&ˆfñ∆W2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁEW6W"Á7GVFVÁEˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚á&ˆfñ∆R«¬∑“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr6FV÷ñ2&ˆfñ∆S¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç6FV÷ñ2&ˆfñ∆R"“ì∞¢–¢“ì∞†¢ÚÚvWB7GVFVÁB7G'Vvv∆RF&vWG0¢ÊvWBÇ"ˆí˜7GVFVÁB˜F&vWG2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BF&vWG2“vóB7F˜&vRÊvWE7G'Vvv∆UF&vWG2á7GVFVÁEW6W"Á7GVFVÁEˆñBì∞¢&W2Êß6ˆ‚áF&vWG2«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁBF&vWG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç7GVFVÁBF&vWG2"“ì∞¢–¢“ì∞†¢Á˜7BÇ"ˆí˜7GVFVÁB˜F&vWG2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BF&vWB“vóB7F˜&vRÊ7&VFU7G'Vvv∆UF&vWBá∞¢7GVFVÁDñC¢7GVFVÁEW6W"Á7GVFVÁEˆñB¿¢7V&¶V7C¢&WÊ&ˆGìÚÁ7V&¶V7B¿¢F˜ñ46ˆÊ6WC¢&WÊ&ˆGìÚÁF˜ñ46ˆÊ6WB¿¢◊ï7G'Vvv∆S¢&WÊ&ˆGìÚÊ◊ï7G'Vvv∆R¿¢7G&FVwì¢&WÊ&ˆGìÚÁ7G&FVwí¿¢6ˆÁ6ˆ∆ñFFñˆ‰FFS¢&WÊ&ˆGìÚÊ6ˆÁ6ˆ∆ñFFñˆ‰FFR¿¢“ì∞†¢&W2Êß6ˆ‚áF&vWBì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7&VFñÊr7GVFVÁBF&vWC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7&VFR7GVFVÁBF&vWB"“ì∞¢–¢“ì∞†¢ÁWBÇ"ˆí˜7GVFVÁB˜F&vWG2Û¶ñB"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BWÜó7FñÊuF&vWG2“vóB7F˜&vRÊvWE7G'Vvv∆UF&vWG2á7GVFVÁEW6W"Á7GVFVÁEˆñBì∞¢ñbÇWÜó7FñÊuF&vWG2Á6ˆ÷RÇáF&vWBí”‚7G&ñÊráF&vWBÊñBí””“7G&ñÊrá&WÁ&◊2ÊñBííí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%F&vWBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BWFFVEF&vWB“vóB7F˜&vRÁWFFU7G'Vvv∆UF&vWBá&WÁ&◊2ÊñB¬∞¢7V&¶V7C¢&WÊ&ˆGìÚÁ7V&¶V7B¿¢F˜ñ46ˆÊ6WC¢&WÊ&ˆGìÚÁF˜ñ46ˆÊ6WB¿¢◊ï7G'Vvv∆S¢&WÊ&ˆGìÚÊ◊ï7G'Vvv∆R¿¢7G&FVwì¢&WÊ&ˆGìÚÁ7G&FVwí¿¢6ˆÁ6ˆ∆ñFFñˆ‰FFS¢&WÊ&ˆGìÚÊ6ˆÁ6ˆ∆ñFFñˆ‰FFR¿¢˜fW&6÷S¢&WÊ&ˆGìÚÊ˜fW&6÷R¿¢“ì∞†¢&W2Êß6ˆ‚áWFFVEF&vWB«¬ÁV∆¬ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"WFFñÊr7GVFVÁBF&vWC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚWFFR7GVFVÁBF&vWB"“ì∞¢–¢“ì∞†¢ÊFV∆WFRÇ"ˆí˜7GVFVÁB˜F&vWG2Û¶ñB"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BWÜó7FñÊuF&vWG2“vóB7F˜&vRÊvWE7G'Vvv∆UF&vWG2á7GVFVÁEW6W"Á7GVFVÁEˆñBì∞¢ñbÇWÜó7FñÊuF&vWG2Á6ˆ÷RÇáF&vWBí”‚7G&ñÊráF&vWBÊñBí””“7G&ñÊrá&WÁ&◊2ÊñBííí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%F&vWBÊ˜Bf˜VÊB"“ì∞¢–†¢vóB7F˜&vRÊFV∆WFU7G'Vvv∆UF&vWBá&WÁ&◊2ÊñBì∞¢&W2Êß6ˆ‚á≤7V66W73¢G'VR“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"FV∆WFñÊr7GVFVÁBF&vWC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚFV∆WFR7GVFVÁBF&vWB"“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜7GVFVÁB˜7G'Vvv∆R◊F&vWG2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B≤FF¢7GVFVÁEW6W"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁE˜W6W'2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬7GVFVÁEW6W$ñBê¢Á6ñÊv∆RÇì∞†¢ñbÇ7GVFVÁEW6W#ÚÁ7GVFVÁEˆñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B≤FF¢F&vWG2¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7G'Vvv∆U˜F&vWG2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁEW6W"Á7GVFVÁEˆñBê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚áF&vWG2«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7G'Vvv∆RF&vWG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç7G'Vvv∆RF&vWG2"“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜7GVFVÁB˜F˜ñ2÷6ˆÊFóFñˆÊñÊr◊7FFR"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B7GVFVÁDñB“vóB&W6ˆ«fU7GVFVÁDñDf˜%˜'F≈6W76ñˆ‚á7GVFVÁEW6W$ñBì∞†¢ñbÇ7GVFVÁDñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóB7F˜&vRÊvWE7GVFVÁBá7GVFVÁDñBì∞†¢ñbÇ7GVFVÁCÚÁGWF˜$ñBí∞¢&WGW&‚&W2Êß6ˆ‚á∞¢F˜ñ3¢ÁV∆¬¿¢Ü6S¢ÁV∆¬¿¢7F&ñ∆óGì¢ÁV∆¬¿¢7FvS¢$f˜VÊFFñˆ‚"¿¢∆7EWFFVC¢ÁV∆¬¿¢“ì∞¢–†¢6ˆÁ7BÊ˜&÷∆ó¶UÜ6R“áf«VSÛ¢7G&ñÊr¬ÁV∆¬í”‚∞¢6ˆÁ7Bb“7G&ñÊráf«VR«¬""íÁFÙ∆˜vW$66RÇì∞¢ñbábÊñÊ6«VFW2Ç&6∆&óGí"íí&WGW&‚$6∆&óGí#∞¢ñbábÊñÊ6«VFW2Ç'7G'V7GW&VB"íí&WGW&‚%7G'V7GW&VBWÜV7WFñˆ‚#∞¢ñbábÊñÊ6«VFW2Ç&Fó66ˆ÷f˜'B"íí&WGW&‚$6ˆÁG&ˆ∆∆VBFó66ˆ÷f˜'B#∞¢ñbábÊñÊ6«VFW2Ç'Fñ÷R"í«¬bÊñÊ6«VFW2Ç'&W77W&R"íí&WGW&‚%Fñ÷R&W77W&R7F&ñ∆óGí#∞¢&WGW&‚%7G'V7GW&VBWÜV7WFñˆ‚#∞¢”∞†¢6ˆÁ7BÊ˜&÷∆ó¶U7F&ñ∆óGí“áf«VSÛ¢7G&ñÊr¬ÁV∆¬í”‚∞¢6ˆÁ7Bb“7G&ñÊráf«VR«¬""íÁFÙ∆˜vW$66RÇì∞¢ñbábÊñÊ6«VFW2Ç&ÜñvÇ÷ñÁFVÊÊ6R"íí&WGW&‚$ÜñvÇ÷ñÁFVÊÊ6R#∞¢ñbábÊñÊ6«VFW2Ç&ÜñvÇ"íí&WGW&‚$ÜñvÇ#∞¢ñbábÊñÊ6«VFW2Ç&÷VFóV“"íí&WGW&‚$÷VFóV“#∞¢&WGW&‚$∆˜r#∞¢”∞†¢6ˆÁ7B6ÊóFó¶UF˜ñ2“áf«VSÛ¢7G&ñÊr¬ÁV∆¬í”‚∞¢6ˆÁ7B6∆VÊVB“7G&ñÊráf«VR«¬""íÁG&ñ“Çì∞¢ñbÇ6∆VÊVBí&WGW&‚ÁV∆√∞¢ñbÜ6∆VÊVBÁFÙ∆˜vW$66RÇí””“&ˆÊ&ˆ&FñÊr&6V∆ñÊRFñvÊ˜7Fñ2"í&WGW&‚ÁV∆√∞¢ñbÜ6∆VÊVBÁ7F'G5vóFÇÇ%≤"íbb6∆VÊVBÊVÊG5vóFÇÇ%“"íí∞¢G'í∞¢6ˆÁ7B'6VB“•4Ù‚Á'6RÜ6∆VÊVBì∞¢ñbÑ'&íÊó4'&íá'6VBíí∞¢6ˆÁ7Bfó'7B“7G&ñÊrá'6VE≥“«¬""íÁG&ñ“Çì∞¢ñbÇfó'7Bí&WGW&‚ÁV∆√∞¢ñbÜfó'7BÁFÙ∆˜vW$66RÇí””“&ˆÊ&ˆ&FñÊr&6V∆ñÊRFñvÊ˜7Fñ2"í&WGW&‚ÁV∆√∞¢&WGW&‚fó'7C∞¢–¢“6F6Ç∞¢ÚÚf∆¬&6≤FÚFÜR&r6∆VÊVB7G&ñÊr‡¢–¢–¢&WGW&‚6∆VÊVC∞¢”∞†¢6ˆÁ7BÜ6UFı7FvS¢&V6˜&C«7G&ñÊr¬7G&ñÊs‚“∞¢6∆&óGì¢$f˜VÊFFñˆ‚"¿¢%7G'V7GW&VBWÜV7WFñˆ‚#¢$÷WFÜˆB"¿¢$6ˆÁG&ˆ∆∆VBFó66ˆ÷f˜'B#¢$6Ü∆∆VÊvR"¿¢%Fñ÷R&W77W&R7F&ñ∆óGí#¢%Fñ÷VB7F&ñ∆óGí"¿¢”∞¢6ˆÁ7B6ˆÊ6WD÷7FW'ì¢Áí–¢7GVFVÁBÊ6ˆÊ6WD÷7FW'íbbGóVˆb7GVFVÁBÊ6ˆÊ6WD÷7FW'í””“&ˆ&¶V7B ¢Ú7GVFVÁBÊ6ˆÊ6WD÷7FW'ê¢¢∑”∞¢6ˆÁ7BF˜ñ46ˆÊFóFñˆÊñÊu7F˜&S¢Áí–¢6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊrbbGóVˆb6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊr””“&ˆ&¶V7B ¢Ú6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊp¢¢∑”∞¢6ˆÁ7BF˜ñ757F˜&S¢&V6˜&C«7G&ñÊr¬Áì‚–¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72bbGóVˆbF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72””“&ˆ&¶V7B ¢ÚF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ70¢¢∑”∞†¢∆WB∆FW7B“ˆ&¶V7BÊVÁG&ñW2áF˜ñ757F˜&Rê¢Ê÷ÇÖ∑F˜ñ4∂Wí¬VÁG'ï“í”‚∞¢6ˆÁ7BF˜ñ2“6ÊóFó¶UF˜ñ2áF˜ñ4∂Wíí«¬6ÊóFó¶UF˜ñ2ÇÜVÁG'í2ÁíìÚÁF˜ñ2í«¬ÁV∆√∞¢ñbÇF˜ñ2í&WGW&‚ÁV∆√∞†¢6ˆÁ7B∆FW7EÜ6R“G'ï'6UÜ6RÇÜVÁG'í2ÁíìÚÁÜ6Rí«¬G'ï'6UÜ6RáF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊVÁG'ï˜Ü6Rì∞¢ñbÇ∆FW7EÜ6Rí&WGW&‚ÁV∆√∞¢6ˆÁ7B∆FW7E7F&ñ∆óGí“Ê˜&÷∆ó¶U7F&ñ∆óGíÇÜVÁG'í2ÁíìÚÁ7F&ñ∆óGí«¬F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁ7F&ñ∆óGí«¬$∆˜r"ì∞¢6ˆÁ7BÊ˜&÷∆ó¶VDÜó7F˜'í“'&íÊó4'&íÇÜVÁG'í2ÁíìÚÊÜó7F˜'íê¢ÚÜVÁG'í2ÁííÊÜó7F˜'ê¢Ê÷ÇÜóFV”¢Áíí”‚á∞¢Ü6S¢G'ï'6UÜ6RÜóFV”ÚÁÜ6Rí«¬∆FW7EÜ6R¿¢7F&ñ∆óGì¢Ê˜&÷∆ó¶U7F&ñ∆óGíÜóFV”ÚÁ7F&ñ∆óGí«¬∆FW7E7F&ñ∆óGíí¿¢FFS¢7G&ñÊrÜóFV”ÚÊFFR«¬""íÁG&ñ“Çí¿¢“íê¢Êfñ«FW"ÇÜóFV”¢Áíí”‚óFV“ÊFFRê¢Á6˜'BÇÜ¢Áí¬#¢Áíí”‚ÊWrFFRÜÊFFRíÊvWEFñ÷RÇí“ÊWrFFRÜ"ÊFFRíÊvWEFñ÷RÇíê¢¢µ”∞†¢6ˆÁ7B&W6ˆ«fVD∆FW7B“Ê˜&÷∆ó¶VDÜó7F˜'ï∂Ê˜&÷∆ó¶VDÜó7F˜'íÊ∆VÊwFÇ““«¬∞¢Ü6S¢∆FW7EÜ6R¿¢7F&ñ∆óGì¢∆FW7E7F&ñ∆óGí¿¢FFS†¢7G&ñÊrÄ¢ÜVÁG'í2ÁíìÚÊ∆7EWFFVB«¿¢ÜVÁG'í2ÁíìÚÊ∆7EWFFVDB«¿¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊ∆7EWFFVB«¿¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊ∆7EWFFVDB«¿¢" ¢íÁG&ñ“Çí«¬ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢”∞†¢&WGW&‚∞¢F˜ñ2¿¢Ü6S¢&W6ˆ«fVD∆FW7BÁÜ6R¿¢7F&ñ∆óGì¢&W6ˆ«fVD∆FW7BÁ7F&ñ∆óGí¿¢FFS¢&W6ˆ«fVD∆FW7BÊFFR¿¢”∞¢“ê¢Êfñ«FW"ÇÜóFV“ì¢óFV“ó2Êˆ‰ÁV∆∆&∆S«GóVˆbóFV”‚”‚óFV“ê¢Á6˜'BÇÜ¬"í”‚ÊWrFFRÜÊFFRíÊvWEFñ÷RÇí“ÊWrFFRÜ"ÊFFRíÊvWEFñ÷RÇíê¢Á˜Çí«¬ÁV∆√∞†¢ñbÇ∆FW7Bí∞¢∆WB7FófFñˆÁ3¢Áïµ““µ”∞¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7B7FófFñˆÂ&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BF˜ñ2¬7&VFVEˆ@¢e$Ù“V&∆ñ2ÁF˜ñ5ˆ6ˆÊFóFñˆÊñÊuˆ7FófFñˆÁ0¢tÑU$R7GVFVÁEˆñB“C¢ı$DU"%í7&VFVEˆB46¿¢∑7GVFVÁBÊñE“¿¢ì∞¢7FófFñˆÁ2“7FófFñˆÂ&W7V«BÁ&˜w3∞¢“V«6R∞¢6ˆÁ7B≤FF““vóB7W&6P¢Êg&ˆ“Ç'F˜ñ5ˆ6ˆÊFóFñˆÊñÊuˆ7FófFñˆÁ2"ê¢Á6V∆V7BÇ'F˜ñ2¬7&VFVEˆB"ê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁBÊñBê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢G'VR“ì∞¢7FófFñˆÁ2“FF«¬µ”∞¢–†¢6ˆÁ7B7FófFñˆ‚“7FófFñˆÁ0¢Ê÷Çá&˜s¢Áíí”‚á∞¢F˜ñ3¢6ÊóFó¶UF˜ñ2á&˜sÚÁF˜ñ2í¿¢FFS¢7G&ñÊrá&˜sÚÊ7&VFVEˆB«¬""íÁG&ñ“Çí¿¢“íê¢Êfñ«FW"Çá&˜s¢Áíí”‚&˜rÁF˜ñ2bb&˜rÊFFRê¢Á˜Çì∞†¢ñbÜ7FófFñˆ‚í∞¢6ˆÁ7B7FófFñˆÂÜ6R“G'ï'6UÜ6RáF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊVÁG'ï˜Ü6Rì∞¢ñbÜ7FófFñˆÂÜ6Rí∞¢∆FW7B“∞¢F˜ñ3¢7FófFñˆ‚ÁF˜ñ2¿¢Ü6S¢7FófFñˆÂÜ6R¿¢7F&ñ∆óGì¢Ê˜&÷∆ó¶U7F&ñ∆óGíáF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁ7F&ñ∆óGí«¬$∆˜r"í¿¢FFS¢7FófFñˆ‚ÊFFR¿¢”∞¢–¢–¢–†¢ñbÇ∆FW7Bí∞¢&WGW&‚&W2Êß6ˆ‚á∞¢F˜ñ3¢ÁV∆¬¿¢Ü6S¢ÁV∆¬¿¢7F&ñ∆óGì¢ÁV∆¬¿¢7FvS¢$f˜VÊFFñˆ‚"¿¢∆7EWFFVC¢ÁV∆¬¿¢“ì∞¢–†¢&W2Êß6ˆ‚á∞¢F˜ñ3¢∆FW7BÁF˜ñ2¿¢Ü6S¢∆FW7BÁÜ6R¿¢7F&ñ∆óGì¢∆FW7BÁ7F&ñ∆óGí¿¢7FvS¢Ü6UFı7FvU∂∆FW7BÁÜ6U“«¬$f˜VÊFFñˆ‚"¿¢∆7EWFFVC¢∆FW7BÊFFR¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁBF˜ñ26ˆÊFóFñˆÊñÊr7FFS¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇF˜ñ26ˆÊFóFñˆÊñÊr7FFR"“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜7GVFVÁB˜F˜ñ2÷6ˆÊFóFñˆÊñÊr◊7FFW2"¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B7GVFVÁEW6W$ñB“á&WÁ6W76ñˆ‚2ÁííÁ7GVFVÁEW6W$ñC∞¢ñbÇ7GVFVÁEW6W$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$Ê˜BWFÜVÁFñ6FVB"“ì∞¢–†¢6ˆÁ7B7GVFVÁDñB“vóB&W6ˆ«fU7GVFVÁDñDf˜%˜'F≈6W76ñˆ‚á7GVFVÁEW6W$ñBì∞†¢ñbÇ7GVFVÁDñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóB7F˜&vRÊvWE7GVFVÁBá7GVFVÁDñBì∞¢ñbÇ7GVFVÁCÚÁGWF˜$ñBí∞¢&WGW&‚&W2Êß6ˆ‚Öµ“ì∞¢–†¢6ˆÁ7B6ÊóFó¶UF˜ñ2“áf«VSÛ¢7G&ñÊr¬ÁV∆¬í”‚∞¢6ˆÁ7B6∆VÊVB“7G&ñÊráf«VR«¬""íÁG&ñ“Çì∞¢ñbÇ6∆VÊVBí&WGW&‚ÁV∆√∞¢ñbÜ6∆VÊVBÁFÙ∆˜vW$66RÇí””“&ˆÊ&ˆ&FñÊr&6V∆ñÊRFñvÊ˜7Fñ2"í&WGW&‚ÁV∆√∞¢ñbÜ6∆VÊVBÁ7F'G5vóFÇÇ%≤"íbb6∆VÊVBÊVÊG5vóFÇÇ%“"íí∞¢G'í∞¢6ˆÁ7B'6VB“•4Ù‚Á'6RÜ6∆VÊVBì∞¢ñbÑ'&íÊó4'&íá'6VBíí∞¢6ˆÁ7Bfó'7B“7G&ñÊrá'6VE≥“«¬""íÁG&ñ“Çì∞¢ñbÇfó'7B«¬fó'7BÁFÙ∆˜vW$66RÇí””“&ˆÊ&ˆ&FñÊr&6V∆ñÊRFñvÊ˜7Fñ2"í&WGW&‚ÁV∆√∞¢&WGW&‚fó'7C∞¢–¢“6F6Ç∞¢&WGW&‚6∆VÊVC∞¢–¢–¢&WGW&‚6∆VÊVC∞¢”∞†¢6ˆÁ7B6ˆÊ6WD÷7FW'ì¢Áí–¢7GVFVÁBÊ6ˆÊ6WD÷7FW'íbbGóVˆb7GVFVÁBÊ6ˆÊ6WD÷7FW'í””“&ˆ&¶V7B ¢Ú7GVFVÁBÊ6ˆÊ6WD÷7FW'ê¢¢∑”∞¢6ˆÁ7BF˜ñ46ˆÊFóFñˆÊñÊu7F˜&S¢Áí–¢6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊrbbGóVˆb6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊr””“&ˆ&¶V7B ¢Ú6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊp¢¢∑”∞¢6ˆÁ7BF˜ñ757F˜&S¢&V6˜&C«7G&ñÊr¬Áì‚–¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72bbGóVˆbF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72””“&ˆ&¶V7B ¢ÚF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ70¢¢∑”∞†¢6ˆÁ7BÊ˜r“FFRÊÊ˜rÇì∞¢6ˆÁ7B&˜w2“ˆ&¶V7BÊVÁG&ñW2áF˜ñ757F˜&Rê¢Ê÷ÇÖ∑F˜ñ4∂Wí¬VÁG'ï“í”‚∞¢6ˆÁ7BF˜ñ2“6ÊóFó¶UF˜ñ2áF˜ñ4∂Wíí«¬6ÊóFó¶UF˜ñ2ÜVÁG'ìÚÁF˜ñ2í«¬ÁV∆√∞¢ñbÇF˜ñ2í&WGW&‚ÁV∆√∞†¢6ˆÁ7B∆FW7EÜ6R“G'ï'6UÜ6RÜVÁG'ìÚÁÜ6Rí«¬G'ï'6UÜ6RáF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊVÁG'ï˜Ü6Rì∞¢ñbÇ∆FW7EÜ6Rí&WGW&‚ÁV∆√∞¢6ˆÁ7B∆FW7E7F&ñ∆óGí“Ê˜&÷∆ó¶U7F&ñ∆óGíÜVÁG'ìÚÁ7F&ñ∆óGí«¬F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁ7F&ñ∆óGí«¬$∆˜r"ì∞†¢6ˆÁ7BÊ˜&÷∆ó¶VDÜó7F˜'í“'&íÊó4'&íÜVÁG'ìÚÊÜó7F˜'íê¢ÚVÁG'íÊÜó7F˜'ê¢Ê÷ÇÜóFV”¢Áíí”‚á∞¢Ü6S¢G'ï'6UÜ6RÜóFV”ÚÁÜ6Rí«¬∆FW7EÜ6R¿¢7F&ñ∆óGì¢Ê˜&÷∆ó¶U7F&ñ∆óGíÜóFV”ÚÁ7F&ñ∆óGí«¬∆FW7E7F&ñ∆óGíí¿¢FFS¢7G&ñÊrÜóFV”ÚÊFFR«¬""íÁG&ñ“Çí¿¢“íê¢Êfñ«FW"ÇÜóFV”¢Áíí”‚óFV“ÊFFRê¢Á6˜'BÇÜ¢Áí¬#¢Áíí”‚ÊWrFFRÜÊFFRíÊvWEFñ÷RÇí“ÊWrFFRÜ"ÊFFRíÊvWEFñ÷RÇíê¢¢µ”∞†¢6ˆÁ7B∆FW7B“Ê˜&÷∆ó¶VDÜó7F˜'ï∂Ê˜&÷∆ó¶VDÜó7F˜'íÊ∆VÊwFÇ““«¬∞¢Ü6S¢∆FW7EÜ6R¿¢7F&ñ∆óGì¢∆FW7E7F&ñ∆óGí¿¢FFS¢VÁG'ìÚÊ∆7EWFFVB«¬F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊ∆7EWFFVDB«¬ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢”∞¢6ˆÁ7B&Wfñ˜W2“Ê˜&÷∆ó¶VDÜó7F˜'íÊ∆VÊwFÇ‚ÚÊ˜&÷∆ó¶VDÜó7F˜'ï∂Ê˜&÷∆ó¶VDÜó7F˜'íÊ∆VÊwFÇ“%“¢ÁV∆√∞†¢6ˆÁ7B∆FW7EÜ6TñGÇ“Ñ4UÙı$DU"ÊñÊFWÑˆbÜ∆FW7BÁÜ6Rì∞¢6ˆÁ7B&Wfñ˜W5Ü6TñGÇ“&Wfñ˜W2ÚÑ4UÙı$DU"ÊñÊFWÑˆbá&Wfñ˜W2ÁÜ6Rí¢”∞¢6ˆÁ7B∆FW7E7F&ñ∆óGï66˜&R“7F&ñ∆óGïFı66˜&RÜ∆FW7BÁ7F&ñ∆óGíì∞¢6ˆÁ7B&Wfñ˜W57F&ñ∆óGï66˜&R“&Wfñ˜W2Ú7F&ñ∆óGïFı66˜&Rá&Wfñ˜W2Á7F&ñ∆óGíí¢∞†¢∆WB÷˜fV÷VÁC¢&ÊˆÊR"¬&ñ◊&˜fVB"¬'&Vw&W76VB"¬&6ÜÊvVB"“&ÊˆÊR#∞¢ñbá&Wfñ˜W2í∞¢ñbÜ∆FW7EÜ6TñGÇ‚&Wfñ˜W5Ü6TñGÇ«¬Ü∆FW7EÜ6TñGÇ””“&Wfñ˜W5Ü6TñGÇbb∆FW7E7F&ñ∆óGï66˜&R‚&Wfñ˜W57F&ñ∆óGï66˜&Ríí∞¢÷˜fV÷VÁB“&ñ◊&˜fVB#∞¢“V«6RñbÜ∆FW7EÜ6TñGÇ¬&Wfñ˜W5Ü6TñGÇ«¬Ü∆FW7EÜ6TñGÇ””“&Wfñ˜W5Ü6TñGÇbb∆FW7E7F&ñ∆óGï66˜&R¬&Wfñ˜W57F&ñ∆óGï66˜&Ríí∞¢÷˜fV÷VÁB“'&Vw&W76VB#∞¢“V«6RñbÜ∆FW7BÁÜ6R”“&Wfñ˜W2ÁÜ6R«¬∆FW7BÁ7F&ñ∆óGí”“&Wfñ˜W2Á7F&ñ∆óGíí∞¢÷˜fV÷VÁB“&6ÜÊvVB#∞¢–¢–†¢6ˆÁ7BFó56ñÊ6UWFFR“÷FÇÊf∆ˆ˜"ÇÜÊ˜r“ÊWrFFRÜ∆FW7BÊFFRíÊvWEFñ÷RÇííÚÉ¢c¢c¢#Bíì∞¢6ˆÁ7B'V6∂WB“Fó56ñÊ6UWFFR√“BÚ&7FófR"¢Fó56ñÊ6UWFFR√“CRÚ'&V6VÁB"¢&ˆ∆FW"#∞†¢&WGW&‚∞¢F˜ñ2¿¢Ü6S¢∆FW7BÁÜ6R¿¢7F&ñ∆óGì¢∆FW7BÁ7F&ñ∆óGí¿¢∆7EWFFVC¢∆FW7BÊFFR¿¢&Wfñ˜W5Ü6S¢&Wfñ˜W3ÚÁÜ6R«¬ÁV∆¬¿¢&Wfñ˜W57F&ñ∆óGì¢&Wfñ˜W3ÚÁ7F&ñ∆óGí«¬ÁV∆¬¿¢÷˜fV÷VÁB¿¢'V6∂WB¿¢”∞¢“ê¢Êfñ«FW"Çá&˜rì¢&˜ró2Êˆ‰ÁV∆∆&∆S«GóVˆb&˜s‚”‚&˜rê¢ÚÚFÜR&VÁBfñWr◊W7B&Vf∆V7BFÜR7V6ñ∆ó7Bw26ˆ◊∆WFR7W'&VÁ@¢ÚÚF˜ñ2÷‚vRó2&W6VÁFFñˆ‚÷WFFF¬Ê˜BW&÷ó76ñˆ‚FÚÜñFR¢ÚÚF˜ñ2FÜBó27Fñ∆¬7FófRñ‚FÜR7GVFVÁBw26ˆÊFóFñˆÊñÊr&V6˜&B‡¢Á6˜'BÇÜ¬"í”‚∞¢ñbÜÊ'V6∂WB”“"Ê'V6∂WBí&WGW&‚Ê'V6∂WB””“&7FófR"Ú”¢∞¢&WGW&‚ÊWrFFRÜ"Ê∆7EWFFVBíÊvWEFñ÷RÇí“ÊWrFFRÜÊ∆7EWFFVBíÊvWEFñ÷RÇì∞¢“ì∞†¢6ˆÁ7BFVGWVE&˜w2“'&íÊg&ˆ“Ä¢&˜w2Á&VGV6RÇÜ÷¬&˜rí”‚∞¢6ˆÁ7B∂Wí“7G&ñÊrá&˜rÁF˜ñ2«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7BWÜó7FñÊr“÷ÊvWBÜ∂Wíì∞†¢ñbÇWÜó7FñÊrí∞¢÷Á6WBÜ∂Wí¬&˜rì∞¢&WGW&‚÷∞¢–†¢6ˆÁ7BWÜó7FñÊtFFR“ÊWrFFRÜWÜó7FñÊrÊ∆7EWFFVB«¬íÊvWEFñ÷RÇì∞¢6ˆÁ7B&˜tFFR“ÊWrFFRá&˜rÊ∆7EWFFVB«¬íÊvWEFñ÷RÇì∞†¢ñbá&˜tFFR„“WÜó7FñÊtFFRí∞¢÷Á6WBÜ∂Wí¬&˜rì∞¢–†¢&WGW&‚÷∞¢“¬ÊWr÷«7G&ñÊr¬Áì‚Çíê¢Áf«VW2Çê¢íÁ6˜'BÇÜ¬"í”‚∞¢ñbÜÊ'V6∂WB”“"Ê'V6∂WBí&WGW&‚Ê'V6∂WB””“&7FófR"Ú”¢∞¢&WGW&‚ÊWrFFRÜ"Ê∆7EWFFVBíÊvWEFñ÷RÇí“ÊWrFFRÜÊ∆7EWFFVBíÊvWEFñ÷RÇì∞¢“ì∞†¢&W2Êß6ˆ‚ÜFVGWVE&˜w2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁBF˜ñ26ˆÊFóFñˆÊñÊr7FFW3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇF˜ñ26ˆÊFóFñˆÊñÊr7FFW2"“ì∞¢–¢“ì∞†¢ÚÚ”””””””””””””””””””””””””””””””””””””””–¢ÚÚ$TÂBı%D¬$ıUDU0¢ÚÚ”””””””””””””””””””””””””””””””””””””””–†¢ÚÚvWB&VÁBw27GVFVÁB7FG0¢ÊvWBÇ"ˆí˜&VÁB˜7GVFVÁB◊7FG2"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬76ñvÊVE˜GWF˜%ˆñB¬W6W%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷Re$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$RW6W%ˆñB“C¢ı$DU"%íWFFVEˆBDU40¢ƒî‘ïB¿¢∑&VÁDñE“¿¢ì∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁB“VÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥”∞¢6ˆÁ7B7GVFVÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5Bñ@¢e$Ù“V&∆ñ2Á7GVFVÁG0¢tÑU$R&VÁEˆVÁ&ˆ∆∆÷VÁEˆñB“C¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïB¿¢∂VÁ&ˆ∆∆÷VÁCÚÊñB«¬ÁV∆≈“¿¢ì∞¢6ˆÁ7B7GVFVÁDñB“7GVFVÁE&W7V«BÁ&˜w5≥”ÚÊñB«¬ÁV∆√∞¢ñbÇ7GVFVÁDñBí∞¢&WGW&‚&W2Êß6ˆ‚Ü'Vñ∆DV÷W&vVÊ7ï&VÁE7GVFVÁE7FG2Çíì∞¢–¢6ˆÁ7B∑66ÜVGV∆VE6W76ñˆÂ&W7V«B¬G&ñ∆≈&W7V«B¬G&ñÊñÊu'VÂ&W7V«B¬6ˆ÷÷óF÷VÁE&W7V«B¬7G&Vµ&W7V«E““vóB&ˆ÷ó6RÊ∆¬Ö∞¢ˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬GóR¬7FGW2¬&VÁEˆ6ˆÊfó&÷VB¬GWF˜%ˆ6ˆÊfó&÷V@¢e$Ù“V&∆ñ2Á66ÜVGV∆VE˜6W76ñˆÁ0¢tÑU$R7GVFVÁEˆñB“C‰BGóRî‚ÇvñÁG&Úr¬wG&ñÊñÊrrñ¿¢∑7GVFVÁDñE“¿¢í¿¢ˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬66ÜVGV∆VE˜6W76ñˆÂˆñB¬G&ñÊñÊu˜6W76ñˆÂ˜'VÂˆñB¬G&ñ∆¿¢e$Ù“V&∆ñ2ÊñÁG&ı˜6W76ñˆÂˆG&ñ∆«0¢tÑU$R7GVFVÁEˆñB“C¢ı$DU"%í7V&÷óGFVEˆBDU46¿¢∑7GVFVÁDñE“¿¢í¿¢ˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬66ÜVGV∆VE˜6W76ñˆÂˆñB¬F˜ñ5ˆ6˜VÁB¬7FGW0¢e$Ù“V&∆ñ2ÁG&ñÊñÊu˜6W76ñˆÂ˜'VÁ0¢tÑU$R7GVFVÁEˆñB“C¢ı$DU"%í7V&÷óGFVEˆBDU46¿¢∑7GVFVÁDñE“¿¢í¿¢ˆˆ¬ÁVW'íÇ%4TƒT5B6˜VÁBÇ¢ì£¶ñÁB26˜VÁBe$Ù“V&∆ñ2Á7GVFVÁEˆ6ˆ÷÷óF÷VÁG2tÑU$R7GVFVÁEˆñB“C‰Bó5ˆ7FófR“G'VR"¬∑7GVFVÁDñE“í¿¢ˆˆ¬ÁVW'íÇ%4TƒT5B4ÙƒU44RÑ‘Çá7G&Vµˆ6˜VÁBí¬ì£¶ñÁB27G&Vµˆ6˜VÁBe$Ù“V&∆ñ2Á7GVFVÁEˆ6ˆ÷÷óF÷VÁG2tÑU$R7GVFVÁEˆñB“C‰Bó5ˆ7FófR“G'VR"¬∑7GVFVÁDñE“í¿¢“ì∞†¢6ˆÁ7B'6TG&ñ∆≈ñ∆ˆB“áf«VS¢VÊ∂Ê˜v‚í”‚∞¢ñbáGóVˆbf«VR”“'7G&ñÊr"í&WGW&‚ÁV∆√∞¢G'í∞¢&WGW&‚•4Ù‚Á'6Ráf«VRì∞¢“6F6Ç∞¢&WGW&‚ÁV∆√∞¢–¢”∞¢6ˆÁ7BG&ñÊñÊu'VÁ2“G&ñÊñÊu'VÂ&W7V«BÁ&˜w2Êfñ«FW"Çá&˜s¢Áíí”‡¢≤'7V&÷óGFVB"¬&6ˆ◊∆WFVB%“ÊñÊ6«VFW2Ö7G&ñÊrá&˜sÚÁ7FGW2«¬""íÁFÙ∆˜vW$66RÇíê¢ì∞¢6ˆÁ7BñÁG&ÙG&ñ∆«2“G&ñ∆≈&W7V«BÁ&˜w2Êfñ«FW"Çá&˜s¢Áíí”‚∞¢6ˆÁ7Bñ∆ˆB“'6TG&ñ∆≈ñ∆ˆBá&˜sÚÊG&ñ∆¬ì∞¢6ˆÁ7BG&ñ∆≈GóR“ñ∆ˆCÚÊG&ñ∆≈GóR«¬á&˜sÚÁG&ñÊñÊu˜6W76ñˆÂ˜'VÂˆñBÚ'G&ñÊñÊr"¢&FñvÊ˜6ó2"ì∞¢&WGW&‚7G&ñÊrÜG&ñ∆≈GóRíÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí””“&FñvÊ˜6ó2#∞¢“ì∞¢6ˆÁ7B6ˆ◊∆WFVE6W76ñˆ‰∂Wó2“ÊWr6WC«7G&ñÊs‚Çì∞¢ñÁG&ÙG&ñ∆«2Êf˜$V6ÇÇá&˜s¢Áíí”‚∞¢6ˆ◊∆WFVE6W76ñˆ‰∂Wó2ÊFBá&˜rÁ66ÜVGV∆VE˜6W76ñˆÂˆñBÚñÁG&Û¢G∑&˜rÁ66ÜVGV∆VE˜6W76ñˆÂˆñG÷¢ñÁG&Û¢G∑&˜rÊñG÷ì∞¢“ì∞¢G&ñÊñÊu'VÁ2Êf˜$V6ÇÇá&˜s¢Áíí”‚∞¢6ˆÁ7B6W76ñˆ‰ñB“7G&ñÊrá&˜rÁ66ÜVGV∆VE˜6W76ñˆÂˆñB«¬""íÁG&ñ“Çì∞¢6ˆÁ7B'V‰ñB“7G&ñÊrá&˜rÊñB«¬""íÁG&ñ“Çì∞¢6ˆ◊∆WFVE6W76ñˆ‰∂Wó2ÊFBÜG&ñÊñÊs¢G∑6W76ñˆ‰ñB«¬'V‰ñG÷ì∞¢“ì∞¢6ˆÁ7B6ˆ◊∆WFVEG&ñÊñÊu6W76ñˆÁ2“66ÜVGV∆VE6W76ñˆÂ&W7V«BÁ&˜w2Êfñ«FW"Çá&˜s¢Áíí”‡¢7G&ñÊrá&˜rÁGóR«¬""íÁFÙ∆˜vW$66RÇí””“'G&ñÊñÊr"b`¢vWDVffV7FófU66ÜVGV∆VE6W76ñˆÂ7FGW2á&˜rí””“&6ˆ◊∆WFVB ¢ì∞¢ñbáG&ñÊñÊu'VÁ2Ê∆VÊwFÇ””“í∞¢6ˆ◊∆WFVEG&ñÊñÊu6W76ñˆÁ2Êf˜$V6ÇÇá&˜s¢Áíí”‚6ˆ◊∆WFVE6W76ñˆ‰∂Wó2ÊFBÜG&ñÊñÊs¢G∑&˜rÊñG÷íì∞¢–¢6ˆÁ7BFW&ófVD&˜74&GF∆W2“G&ñÊñÊu'VÁ2Á&VGV6RÇá7V”¢ÁV÷&W"¬&˜s¢Áíí”‚7V“≤ÁV÷&W"á&˜rÁF˜ñ5ˆ6˜VÁB«¬í¬ì∞¢6ˆÁ7BFW&ófVE6ˆ«WFñˆÁ5VÊ∆ˆ6∂VB“G&ñÊñÊu'VÁ2Ê∆VÊwFÉ∞¢&WGW&‚&W2Êß6ˆ‚Ü'Vñ∆DV÷W&vVÊ7ï&VÁE7GVFVÁE7FG2á∞¢6W76ñˆ‰6˜VÁC¢6ˆ◊∆WFVE6W76ñˆ‰∂Wó2Á6ó¶R¿¢6ˆ÷÷óF÷VÁD6˜VÁC¢ÁV÷&W"Ü6ˆ÷÷óF÷VÁE&W7V«BÁ&˜w5≥”ÚÊ6˜VÁB«¬í¿¢7W'&VÁE7G&V≥¢ÁV÷&W"á7G&Vµ&W7V«BÁ&˜w5≥”ÚÁ7G&Vµˆ6˜VÁB«¬í¿¢ñÁG&ÙFñvÊ˜6ó46˜VÁC¢ñÁG&ÙG&ñ∆«2Ê∆VÊwFÇ¿¢G&ñÊñÊu6W76ñˆ‰6˜VÁC¢6ˆ◊∆WFVEG&ñÊñÊu6W76ñˆÁ2Ê∆VÊwFÇ«¬G&ñÊñÊu'VÁ2Ê∆VÊwFÇ¿¢&˜74&GF∆W46ˆ◊∆WFVC¢FW&ófVD&˜74&GF∆W2¿¢6ˆ«WFñˆÁ5VÊ∆ˆ6∂VC¢FW&ófVE6ˆ«WFñˆÁ5VÊ∆ˆ6∂VB¿¢“íì∞¢–†¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜#¢VÁ&ˆ∆∆÷VÁDW'&˜"““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñB¿¢&ñ÷'ï6V∆V7C¢&ñB¬W6W%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬76ñvÊVE˜GWF˜%ˆñB¬76ñvÊVE˜7GVFVÁEˆñB¬&VÁEˆV÷ñ¬¬&˜˜6≈ˆñB"¿¢f∆∆&6µ6V∆V7C¢&ñB¬W6W%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬¬&˜˜6≈ˆñB"¿¢“ì∞†¢ñbÜVÁ&ˆ∆∆÷VÁDW'&˜"í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇVÁ&ˆ∆∆÷VÁB"“ì∞¢–†¢ñbÇVÁ&ˆ∆∆÷VÁCÚÊ76ñvÊVE˜GWF˜%ˆñBí∞¢&WGW&‚&W2Êß6ˆ‚á∞¢ñÁG&ÙFñvÊ˜6ó46ˆ◊∆WFVC¢¿¢&˜74&GF∆W46ˆ◊∆WFVC¢¿¢6ˆ«WFñˆÁ5VÊ∆ˆ6∂VC¢¿¢6ˆÊfñFVÊ6Tw&˜wFÉ¢¿¢6W76ñˆÁ46ˆ◊∆WFVC¢¿¢G&ñÊñÊu6W76ñˆÁ46ˆ◊∆WFVC¢¿¢7W'&VÁE7G&V≥¢¿¢F˜Fƒ6ˆ÷÷óF÷VÁG3¢¿¢“ì∞¢–†¢6ˆÁ7B7GVFVÁE&V6˜&B“vóB&W6ˆ«fT6ÊˆÊñ6≈7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBì∞¢6ˆÁ7B7GVFVÁDñB“7GVFVÁE&V6˜&CÚÊñB«¬VÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜7GVFVÁEˆñB«¬ÁV∆√∞†¢6ˆÁ7B7FG2“7GVFVÁDñ@¢ÚvóBvWE7GVFVÁDF6Ü&ˆ&E7FG2á7GVFVÁDñBê¢¢∞¢&˜74&GF∆W46ˆ◊∆WFVC¢¿¢6ˆ«WFñˆÁ5VÊ∆ˆ6∂VC¢¿¢7W'&VÁE7G&V≥¢¿¢F˜F≈6W76ñˆÁ3¢¿¢G&ñÊñÊu6W76ñˆÁ46ˆ◊∆WFVC¢¿¢6ˆÊfñFVÊ6T∆WfV√¢S¿¢”∞†¢ÚÚvWB6ˆ÷÷óF÷VÁG26˜VÁ@¢∆WB6ˆ÷÷óF÷VÁG3¢Áïµ“¬ÁV∆¬“ÁV∆√∞¢ñbá7GVFVÁDñBí∞¢6ˆÁ7B≤FF““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁEˆ6ˆ÷÷óF÷VÁG2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ'7GVFVÁEˆñB"¬7GVFVÁDñBê¢ÊWÇ&ó5ˆ7FófR"¬G'VRì∞¢6ˆ÷÷óF÷VÁG2“FF«¬µ”∞¢–†¢&W2Êß6ˆ‚á∞¢ñÁG&ÙFñvÊ˜6ó46ˆ◊∆WFVC¢á7FG22ÁííÊñÁG&ÙFñvÊ˜6ó46ˆ◊∆WFVBÛÚ¿¢&˜74&GF∆W46ˆ◊∆WFVC¢7FG2Ê&˜74&GF∆W46ˆ◊∆WFVB¿¢6ˆ«WFñˆÁ5VÊ∆ˆ6∂VC¢7FG2Á6ˆ«WFñˆÁ5VÊ∆ˆ6∂VB¿¢6ˆÊfñFVÊ6Tw&˜wFÉ¢S¿¢6W76ñˆÁ46ˆ◊∆WFVC¢7FG2ÁF˜F≈6W76ñˆÁ2¿¢G&ñÊñÊu6W76ñˆÁ46ˆ◊∆WFVC¢7FG2ÁG&ñÊñÊu6W76ñˆÁ46ˆ◊∆WFVB¿¢7W'&VÁE7G&V≥¢7FG2Ê7W'&VÁE7G&V≤¿¢F˜Fƒ6ˆ÷÷óF÷VÁG3¢6ˆ÷÷óF÷VÁG3ÚÊ∆VÊwFÇ«¬¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&VÁB7GVFVÁB7FG3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç7FG2"“ì∞¢–¢“ì∞†¢ÚÚvWB&VÁBw27GVFVÁBñÊf¢ÊvWBÇ"ˆí˜&VÁB˜7GVFVÁB÷ñÊfÚ"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñB¿¢&ñ÷'ï6V∆V7C¢"¢"¿¢“ì∞¢ñbÇVÁ&ˆ∆∆÷VÁBí&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÁ&ˆ∆∆÷VÁBf˜VÊB"“ì∞¢6ˆÁ7B7GVFVÁB“vóB&W6ˆ«fT6ÊˆÊñ6≈7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBì∞¢∆WBˆDÊ÷S¢7G&ñÊr¬ÁV∆¬“ÁV∆√∞¢ñbÜVÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñBí∞¢6ˆÁ7BˆE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BÁˆEˆÊ÷P¢e$Ù“V&∆ñ2ÁGWF˜%ˆ76ñvÊ÷VÁG2F¢§Ùî‚V&∆ñ2ÁˆG2Ù‚ÊñB“FÁˆEˆñ@¢tÑU$RFÁGWF˜%ˆñB“C‰BÊFV∆WFVEˆBï2ÂTƒ¿¢ƒî‘ïB¿¢∂VÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñE“¿¢ì∞¢ˆDÊ÷R“ˆE&W7V«BÁ&˜w5≥”ÚÁˆEˆÊ÷R«¬ÁV∆√∞¢–¢&WGW&‚&W2Êß6ˆ‚á∞¢Ê÷S¢7GVFVÁCÚÊÊ÷R«¬VÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R¿¢w&FS¢7GVFVÁCÚÊw&FR«¬VÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆw&FR¿¢ˆDÊ÷R¿¢“ì∞¢–†¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜#¢VÁ&ˆ∆∆÷VÁDW'&˜"““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñB¿¢&ñ÷'ï6V∆V7C¢&ñB¬W6W%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬76ñvÊVE˜GWF˜%ˆñB¬76ñvÊVE˜7GVFVÁEˆñB¬&VÁEˆV÷ñ¬"¿¢f∆∆&6µ6V∆V7C¢&ñB¬W6W%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬"¿¢“ì∞†¢ñbÜVÁ&ˆ∆∆÷VÁDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&VÁBVÁ&ˆ∆∆÷VÁC¢"¬VÁ&ˆ∆∆÷VÁDW'&˜"ì∞¢–†¢ñbÇVÁ&ˆ∆∆÷VÁBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚVÁ&ˆ∆∆÷VÁBf˜VÊB"“ì∞¢–†¢6ˆÁ7B7GVFVÁE&V6˜&B“vóB&W6ˆ«fT6ÊˆÊñ6≈7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBì∞†¢ÚÚvWBGWF˜"w2ˆBñb76ñvÊV@¢∆WBˆDÊ÷R“ÁV∆√∞¢ñbÜVÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñBí∞¢6ˆÁ7B≤FF¢GWF˜$76ñvÊ÷VÁB¬W'&˜#¢ˆDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'GWF˜%ˆ76ñvÊ÷VÁG2"ê¢Á6V∆V7BÇ'ˆCßˆG2áˆEˆÊ÷Rí"ê¢ÊWÇ'GWF˜%ˆñB"¬VÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbáˆDW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrGWF˜"ˆC¢"¬ˆDW'&˜"ì∞¢–†¢6ˆÁ7BˆB“GWF˜$76ñvÊ÷VÁCÚÁˆB2≤ˆEˆÊ÷SÛ¢7G&ñÊr“¬ÁV∆√∞¢ñbáˆBí∞¢ˆDÊ÷R“ˆBÁˆEˆÊ÷R«¬ÁV∆√∞¢–¢–†¢6ˆÁ6ˆ∆RÊ∆ˆrÇ/	˘8¢&VÁB7GVFVÁBñÊfÚ&W7ˆÁ6S¢"¬∞¢Ê÷S¢7GVFVÁE&V6˜&CÚÊÊ÷R«¬VÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R¿¢w&FS¢7GVFVÁE&V6˜&CÚÊw&FR«¬VÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆw&FR¿¢ˆDÊ÷S¢ˆDÊ÷R¿¢“ì∞†¢&W2Êß6ˆ‚á∞¢Ê÷S¢7GVFVÁE&V6˜&CÚÊÊ÷R«¬VÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆgV∆≈ˆÊ÷R¿¢w&FS¢7GVFVÁE&V6˜&CÚÊw&FR«¬VÁ&ˆ∆∆÷VÁBÁ7GVFVÁEˆw&FR¿¢ˆDÊ÷S¢ˆDÊ÷R¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr7GVFVÁBñÊfÛ¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç7GVFVÁBñÊfÚ"“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜&VÁB˜F˜ñ2÷6ˆÊFóFñˆÊñÊr◊7FFW2"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞†¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜#¢VÁ&ˆ∆∆÷VÁDW'&˜"““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñB¿¢&ñ÷'ï6V∆V7C¢&ñB¬W6W%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬76ñvÊVE˜GWF˜%ˆñB¬76ñvÊVE˜7GVFVÁEˆñB¬&VÁEˆV÷ñ¬"¿¢f∆∆&6µ6V∆V7C¢&ñB¬W6W%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬76ñvÊVE˜GWF˜%ˆñB¬&VÁEˆV÷ñ¬"¿¢“ì∞†¢ñbÜVÁ&ˆ∆∆÷VÁDW'&˜"í∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇVÁ&ˆ∆∆÷VÁB"“ì∞¢–†¢ñbÇVÁ&ˆ∆∆÷VÁCÚÊ76ñvÊVE˜GWF˜%ˆñB«¬VÁ&ˆ∆∆÷VÁCÚÁ7GVFVÁEˆgV∆≈ˆÊ÷Rí∞¢&WGW&‚&W2Êß6ˆ‚Öµ“ì∞¢–†¢6ˆÁ7B6ÊóFó¶UF˜ñ2“áf«VSÛ¢7G&ñÊr¬ÁV∆¬í”‚∞¢6ˆÁ7B6∆VÊVB“7G&ñÊráf«VR«¬""íÁG&ñ“Çì∞¢ñbÇ6∆VÊVBí&WGW&‚ÁV∆√∞¢ñbÜ6∆VÊVBÁFÙ∆˜vW$66RÇí””“&ˆÊ&ˆ&FñÊr&6V∆ñÊRFñvÊ˜7Fñ2"í&WGW&‚ÁV∆√∞¢&WGW&‚6∆VÊVC∞¢”∞†¢∆WB7GVFVÁE&V6˜&B“vóB&W6ˆ«fT6ÊˆÊñ6≈7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBì∞†¢ñbÇ7GVFVÁE&V6˜&BbbVÁ&ˆ∆∆÷VÁCÚÁ&˜˜6≈ˆñBí∞¢6ˆÁ7B≤FF¢&˜˜6≈7GVFVÁB““vóB7W&6P¢Êg&ˆ“Ç&ˆÊ&ˆ&FñÊu˜&˜˜6«2"ê¢Á6V∆V7BÇ'7GVFVÁEˆñB"ê¢ÊWÇ&ñB"¬VÁ&ˆ∆∆÷VÁBÁ&˜˜6≈ˆñBê¢Ê÷ñ&U6ñÊv∆RÇì∞†¢ñbá&˜˜6≈7GVFVÁCÚÁ7GVFVÁEˆñBí∞¢6ˆÁ7B&˜˜6ƒ∆ñÊ∂VE7GVFVÁB“vóB7F˜&vRÊvWE7GVFVÁBÖ7G&ñÊrá&˜˜6≈7GVFVÁBÁ7GVFVÁEˆñBíì∞¢ñbá&˜˜6ƒ∆ñÊ∂VE7GVFVÁBí∞¢7GVFVÁE&V6˜&B“Ê˜&÷∆ó¶U7GVFVÁE&V6˜&Bá&˜˜6ƒ∆ñÊ∂VE7GVFVÁBì∞¢–¢–¢–†¢ñbÇ7GVFVÁE&V6˜&Bí&WGW&‚&W2Êß6ˆ‚Öµ“ì∞†¢6ˆÁ7B6ˆÊ6WD÷7FW'ì¢Áí–¢7GVFVÁE&V6˜&BÊ6ˆÊ6WD÷7FW'íbbGóVˆb7GVFVÁE&V6˜&BÊ6ˆÊ6WD÷7FW'í””“&ˆ&¶V7B ¢Ú7GVFVÁE&V6˜&BÊ6ˆÊ6WD÷7FW'ê¢¢∑”∞¢6ˆÁ7BF˜ñ46ˆÊFóFñˆÊñÊu7F˜&S¢Áí–¢6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊrbbGóVˆb6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊr””“&ˆ&¶V7B ¢Ú6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊp¢¢∑”∞¢6ˆÁ7BF˜ñ757F˜&S¢&V6˜&C«7G&ñÊr¬Áì‚–¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72bbGóVˆbF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72””“&ˆ&¶V7B ¢ÚF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ70¢¢∑”∞†¢6ˆÁ7BÊ˜r“FFRÊÊ˜rÇì∞¢6ˆÁ7B&˜w2“ˆ&¶V7BÊVÁG&ñW2áF˜ñ757F˜&Rê¢Ê÷ÇÖ∑F˜ñ4∂Wí¬VÁG'ï“í”‚∞¢6ˆÁ7BF˜ñ2“6ÊóFó¶UF˜ñ2áF˜ñ4∂Wíí«¬6ÊóFó¶UF˜ñ2ÜVÁG'ìÚÁF˜ñ2í«¬ÁV∆√∞¢ñbÇF˜ñ2í&WGW&‚ÁV∆√∞†¢6ˆÁ7B∆FW7EÜ6R“G'ï'6UÜ6RÜVÁG'ìÚÁÜ6Rí«¬G'ï'6UÜ6RáF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊVÁG'ï˜Ü6Rì∞¢ñbÇ∆FW7EÜ6Rí&WGW&‚ÁV∆√∞¢6ˆÁ7B∆FW7E7F&ñ∆óGí“Ê˜&÷∆ó¶U7F&ñ∆óGíÜVÁG'ìÚÁ7F&ñ∆óGí«¬F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁ7F&ñ∆óGí«¬$∆˜r"ì∞†¢6ˆÁ7BÊ˜&÷∆ó¶VDÜó7F˜'í“'&íÊó4'&íÜVÁG'ìÚÊÜó7F˜'íê¢ÚVÁG'íÊÜó7F˜'ê¢Ê÷ÇÜóFV”¢Áíí”‚á∞¢Ü6S¢G'ï'6UÜ6RÜóFV”ÚÁÜ6Rí«¬∆FW7EÜ6R¿¢7F&ñ∆óGì¢Ê˜&÷∆ó¶U7F&ñ∆óGíÜóFV”ÚÁ7F&ñ∆óGí«¬∆FW7E7F&ñ∆óGíí¿¢FFS¢7G&ñÊrÜóFV”ÚÊFFR«¬""íÁG&ñ“Çí¿¢“íê¢Êfñ«FW"ÇÜóFV”¢Áíí”‚óFV“ÊFFRê¢Á6˜'BÇÜ¢Áí¬#¢Áíí”‚ÊWrFFRÜÊFFRíÊvWEFñ÷RÇí“ÊWrFFRÜ"ÊFFRíÊvWEFñ÷RÇíê¢¢µ”∞†¢6ˆÁ7B∆FW7B“Ê˜&÷∆ó¶VDÜó7F˜'ï∂Ê˜&÷∆ó¶VDÜó7F˜'íÊ∆VÊwFÇ““«¬∞¢Ü6S¢∆FW7EÜ6R¿¢7F&ñ∆óGì¢∆FW7E7F&ñ∆óGí¿¢FFS¢VÁG'ìÚÊ∆7EWFFVB«¬F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊ∆7EWFFVDB«¬ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢”∞¢6ˆÁ7B&Wfñ˜W2“Ê˜&÷∆ó¶VDÜó7F˜'íÊ∆VÊwFÇ‚ÚÊ˜&÷∆ó¶VDÜó7F˜'ï∂Ê˜&÷∆ó¶VDÜó7F˜'íÊ∆VÊwFÇ“%“¢ÁV∆√∞†¢6ˆÁ7B∆FW7EÜ6TñGÇ“Ñ4UÙı$DU"ÊñÊFWÑˆbÜ∆FW7BÁÜ6Rì∞¢6ˆÁ7B&Wfñ˜W5Ü6TñGÇ“&Wfñ˜W2ÚÑ4UÙı$DU"ÊñÊFWÑˆbá&Wfñ˜W2ÁÜ6Rí¢”∞¢6ˆÁ7B∆FW7E7F&ñ∆óGï66˜&R“7F&ñ∆óGïFı66˜&RÜ∆FW7BÁ7F&ñ∆óGíì∞¢6ˆÁ7B&Wfñ˜W57F&ñ∆óGï66˜&R“&Wfñ˜W2Ú7F&ñ∆óGïFı66˜&Rá&Wfñ˜W2Á7F&ñ∆óGíí¢∞†¢∆WB÷˜fV÷VÁC¢&ÊˆÊR"¬&ñ◊&˜fVB"¬'&Vw&W76VB"¬&6ÜÊvVB"“&ÊˆÊR#∞¢ñbá&Wfñ˜W2í∞¢ñbÜ∆FW7EÜ6TñGÇ‚&Wfñ˜W5Ü6TñGÇ«¬Ü∆FW7EÜ6TñGÇ””“&Wfñ˜W5Ü6TñGÇbb∆FW7E7F&ñ∆óGï66˜&R‚&Wfñ˜W57F&ñ∆óGï66˜&Ríí∞¢÷˜fV÷VÁB“&ñ◊&˜fVB#∞¢“V«6RñbÜ∆FW7EÜ6TñGÇ¬&Wfñ˜W5Ü6TñGÇ«¬Ü∆FW7EÜ6TñGÇ””“&Wfñ˜W5Ü6TñGÇbb∆FW7E7F&ñ∆óGï66˜&R¬&Wfñ˜W57F&ñ∆óGï66˜&Ríí∞¢÷˜fV÷VÁB“'&Vw&W76VB#∞¢“V«6RñbÜ∆FW7BÁÜ6R”“&Wfñ˜W2ÁÜ6R«¬∆FW7BÁ7F&ñ∆óGí”“&Wfñ˜W2Á7F&ñ∆óGíí∞¢÷˜fV÷VÁB“&6ÜÊvVB#∞¢–¢–†¢6ˆÁ7BFó56ñÊ6UWFFR“÷FÇÊf∆ˆ˜"ÇÜÊ˜r“ÊWrFFRÜ∆FW7BÊFFRíÊvWEFñ÷RÇííÚÉ¢c¢c¢#Bíì∞¢6ˆÁ7B'V6∂WB“Fó56ñÊ6UWFFR√“BÚ&7FófR"¢Fó56ñÊ6UWFFR√“CRÚ'&V6VÁB"¢&ˆ∆FW"#∞†¢ÚÚG&Á6∆FRñÁFW&Ê¬7FFW2FÚ&VÁB÷g&ñVÊF«í∆ÊwVvRW"&W7ˆÁ6RñÁFVw&óGíG&ñgB6˜'&V7Fñˆ‚7V0¢6ˆÁ7BG&Á6∆FVE7FFR“vWE&VÁDF6Ü&ˆ&D6˜î'ï7FFRÜ∆FW7BÁÜ6R¬∆FW7BÁ7F&ñ∆óGíì∞†¢&WGW&‚∞¢F˜ñ2¿¢Ü6S¢∆FW7BÁÜ6R¿¢7F&ñ∆óGì¢∆FW7BÁ7F&ñ∆óGí¿¢ÚÚ&VÁB÷f6ñÊrG&Á6∆FñˆÁ2ÜÊWfW"Wá˜6R$ÜñvÇ÷ñÁFVÊÊ6R"¬WF2‚ê¢&VÁE7FGW3¢G&Á6∆FVE7FFRÁ7FGW2¿¢&VÁD÷VÊñÊs¢G&Á6∆FVE7FFRÊ÷VÊñÊr¿¢&VÁDfˆ7W3¢G&Á6∆FVE7FFRÊfˆ7W2¿¢∆7EWFFVC¢∆FW7BÊFFR¿¢&Wfñ˜W5Ü6S¢&Wfñ˜W3ÚÁÜ6R«¬ÁV∆¬¿¢&Wfñ˜W57F&ñ∆óGì¢&Wfñ˜W3ÚÁ7F&ñ∆óGí«¬ÁV∆¬¿¢÷˜fV÷VÁB¿¢'V6∂WB¿¢”∞¢“ê¢Êfñ«FW"Çá&˜rì¢&˜ró2Êˆ‰ÁV∆∆&∆S«GóVˆb&˜s‚”‚&˜rê¢ÚÚFÜR&VÁBfñWr◊W7B&Vf∆V7BFÜR7V6ñ∆ó7Bw26ˆ◊∆WFR7W'&VÁ@¢ÚÚF˜ñ2÷‚vRó2&W6VÁFFñˆ‚÷WFFF¬Ê˜BW&÷ó76ñˆ‚FÚÜñFR¢ÚÚF˜ñ2FÜBó27Fñ∆¬7FófRñ‚FÜR7GVFVÁBw26ˆÊFóFñˆÊñÊr&V6˜&B‡¢Á6˜'BÇÜ¬"í”‚∞¢ñbÜÊ'V6∂WB”“"Ê'V6∂WBí&WGW&‚Ê'V6∂WB””“&7FófR"Ú”¢∞¢&WGW&‚ÊWrFFRÜ"Ê∆7EWFFVBíÊvWEFñ÷RÇí“ÊWrFFRÜÊ∆7EWFFVBíÊvWEFñ÷RÇì∞¢“ì∞†¢6ˆÁ7BFVGWVE&˜w2“'&íÊg&ˆ“Ä¢&˜w2Á&VGV6RÇÜ÷¬&˜rí”‚∞¢6ˆÁ7B∂Wí“7G&ñÊrá&˜rÁF˜ñ2«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7BWÜó7FñÊr“÷ÊvWBÜ∂Wíì∞†¢ñbÇWÜó7FñÊrí∞¢÷Á6WBÜ∂Wí¬&˜rì∞¢&WGW&‚÷∞¢–†¢6ˆÁ7BWÜó7FñÊtFFR“ÊWrFFRÜWÜó7FñÊrÊ∆7EWFFVB«¬íÊvWEFñ÷RÇì∞¢6ˆÁ7B&˜tFFR“ÊWrFFRá&˜rÊ∆7EWFFVB«¬íÊvWEFñ÷RÇì∞†¢ñbá&˜tFFR„“WÜó7FñÊtFFRí∞¢÷Á6WBÜ∂Wí¬&˜rì∞¢–†¢&WGW&‚÷∞¢“¬ÊWr÷«7G&ñÊr¬Áì‚Çíê¢Áf«VW2Çê¢íÁ6˜'BÇÜ¬"í”‚∞¢ñbÜÊ'V6∂WB”“"Ê'V6∂WBí&WGW&‚Ê'V6∂WB””“&7FófR"Ú”¢∞¢&WGW&‚ÊWrFFRÜ"Ê∆7EWFFVBíÊvWEFñ÷RÇí“ÊWrFFRÜÊ∆7EWFFVBíÊvWEFñ÷RÇì∞¢“ì∞†¢&W2Êß6ˆ‚ÜFVGWVE&˜w2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&VÁBF˜ñ26ˆÊFóFñˆÊñÊr7FFW3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇF˜ñ26ˆÊFóFñˆÊñÊr7FFW2"“ì∞¢–¢“ì∞†¢ÁWBÇ"ˆí˜GWF˜"˜F˜ñ2÷6ˆÊFóFñˆÊñÊrÛß7GVFVÁDñB˜F˜ñ2◊&VfW&VÊ6R"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'GWF˜"%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BGWF˜$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B≤7GVFVÁDñB““&WÁ&◊3∞¢6ˆÁ7BF˜ñ2“7G&ñÊrá&WÊ&ˆGìÚÁF˜ñ2«¬""íÁG&ñ“Çì∞¢6ˆÁ7BF˜ñ5&VfW&VÊ6T6ˆÁFVÁB“Ê˜&÷∆ó¶UF˜ñ5&VfW&VÊ6T6ˆÁFVÁBá&WÊ&ˆGìÚÁF˜ñ5&VfW&VÊ6Rì∞†¢ñbÇ7GVFVÁDñB«¬F˜ñ2í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊBF˜ñ2&R&WVó&VB‚"“ì∞¢–¢ñbÇF˜ñ5&VfW&VÊ6T6ˆÁFVÁBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á∞¢÷W76vS¢$6ˆ◊∆WFRfˆ6'V∆'í¬&V6ˆvÊóFñˆ‚Ú÷WFÜˆB¬˜&FW&VB7FW2¬ÊB&V6ˆ‚&Vf˜&R6fñÊr‚"¿¢“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóB7F˜&vRÊvWE7GVFVÁBá7GVFVÁDñBì∞¢ñbÇ7GVFVÁB«¬7GVFVÁBÁGWF˜$ñB”“GWF˜$ñBí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢%VÊWFÜ˜&ó¶VC¢7GVFVÁBFˆW2Ê˜B&V∆ˆÊrFÚFÜó27V6ñ∆ó7B‚"“ì∞¢–†¢6ˆÁ7B6ˆÊ6WD÷7FW'ì¢Áí–¢7GVFVÁBÊ6ˆÊ6WD÷7FW'íbbGóVˆb7GVFVÁBÊ6ˆÊ6WD÷7FW'í””“&ˆ&¶V7B ¢Ú≤‚‚‚á7GVFVÁBÊ6ˆÊ6WD÷7FW'í2Áíí–¢¢∑”∞¢6ˆÁ7BF˜ñ46ˆÊFóFñˆÊñÊu7F˜&S¢Áí–¢6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊrbbGóVˆb6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊr””“&ˆ&¶V7B ¢Ú≤‚‚Ê6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊr–¢¢∑”∞¢6ˆÁ7BF˜ñ757F˜&S¢&V6˜&C«7G&ñÊr¬Áì‚–¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72bbGóVˆbF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72””“&ˆ&¶V7B ¢Ú≤‚‚ÁF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72–¢¢∑”∞¢6ˆÁ7BF˜ñ4∂Wí“ˆ&¶V7BÊ∂Wó2áF˜ñ757F˜&RíÊfñÊBÄ¢Ü6ÊFñFFRí”‚6ÊFñFFRÁG&ñ“ÇíÁFÙ∆˜vW$66RÇí””“F˜ñ2ÁFÙ∆˜vW$66RÇí¿¢ì∞†¢ñbÇF˜ñ4∂Wí«¬F˜ñ757F˜&U∑F˜ñ4∂Wï“«¬GóVˆbF˜ñ757F˜&U∑F˜ñ4∂Wï“”“&ˆ&¶V7B"í∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%FÜó2F˜ñ2ó2Ê˜B7FófRf˜"FÜR7GVFVÁB‚"“ì∞¢–†¢6ˆÁ7BWÜó7FñÊu&VfW&VÊ6R“'6U7F˜&VEF˜ñ5&VfW&VÊ6RáF˜ñ757F˜&U∑F˜ñ4∂Wï“ÁF˜ñ5&VfW&VÊ6Rì∞¢ñbÜWÜó7FñÊu&VfW&VÊ6Rí∞¢&WGW&‚&W2Êß6ˆ‚á≤7V66W73¢G'VR¬7&VFVC¢f«6R¬F˜ñ5&VfW&VÊ6S¢WÜó7FñÊu&VfW&VÊ6R“ì∞¢–†¢6ˆÁ7BF˜ñ5&VfW&VÊ6R“∞¢‚‚ÁF˜ñ5&VfW&VÊ6T6ˆÁFVÁB¿¢66ÜV÷fW'6ñˆ„¢Dıî5ı$TdU$T‰4Uı44ÑT‘ıdU%4îÙ‚¿¢7&VFVDC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢7&VFVD'ïGWF˜$ñC¢GWF˜$ñB¿¢”∞¢F˜ñ757F˜&U∑F˜ñ4∂Wï““∞¢‚‚ÁF˜ñ757F˜&U∑F˜ñ4∂Wï“¿¢F˜ñ5&VfW&VÊ6R¿¢”∞¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72“F˜ñ757F˜&S∞¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊ∆7EWFFVDB“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇì∞¢6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊr“F˜ñ46ˆÊFóFñˆÊñÊu7F˜&S∞†¢6ˆÁ7BWFFVE7GVFVÁB“vóB7F˜&vRÁWFFU7GVFVÁBá7GVFVÁDñB¬≤6ˆÊ6WD÷7FW'í“ì∞¢ñbÇWFFVE7GVFVÁBí∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6fRFÜRF˜ñ2&VfW&VÊ6R‚"“ì∞¢–†¢&W2Á7FGW2É#íÊß6ˆ‚á≤7V66W73¢G'VR¬7&VFVC¢G'VR¬F˜ñ5&VfW&VÊ6R“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6fñÊrGWF˜"F˜ñ2&VfW&VÊ6S¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ6fRFÜRF˜ñ2&VfW&VÊ6R‚"“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜GWF˜"˜F˜ñ2÷6ˆÊFóFñˆÊñÊrÛß7GVFVÁDñB"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'GWF˜"%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BGWF˜$ñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B≤7GVFVÁDñB““&WÁ&◊3∞†¢ñbÇ7GVFVÁDñBí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$÷ó76ñÊr7GVFVÁDñB"“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóB7F˜&vRÊvWE7GVFVÁBá7GVFVÁDñBì∞¢ñbÇ7GVFVÁB«¬7GVFVÁBÁGWF˜$ñB”“GWF˜$ñBí∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤÷W76vS¢%VÊWFÜ˜&ó¶VC¢7GVFVÁBFˆW2Ê˜B&V∆ˆÊrFÚFÜó2GWF˜""“ì∞¢–†¢6ˆÁ7B6ÊóFó¶UF˜ñ2“áf«VSÛ¢7G&ñÊr¬ÁV∆¬í”‚∞¢6ˆÁ7B6∆VÊVB“7G&ñÊráf«VR«¬""íÁG&ñ“Çì∞¢ñbÇ6∆VÊVBí&WGW&‚ÁV∆√∞¢ñbÜ6∆VÊVBÁFÙ∆˜vW$66RÇí””“&ˆÊ&ˆ&FñÊr&6V∆ñÊRFñvÊ˜7Fñ2"í&WGW&‚ÁV∆√∞¢&WGW&‚6∆VÊVC∞¢”∞†¢6ˆÁ7B6ˆÊ6WD÷7FW'ì¢Áí–¢7GVFVÁBÊ6ˆÊ6WD÷7FW'íbbGóVˆb7GVFVÁBÊ6ˆÊ6WD÷7FW'í””“&ˆ&¶V7B ¢Ú7GVFVÁBÊ6ˆÊ6WD÷7FW'ê¢¢∑”∞¢6ˆÁ7BF˜ñ46ˆÊFóFñˆÊñÊu7F˜&S¢Áí–¢6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊrbbGóVˆb6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊr””“&ˆ&¶V7B ¢Ú6ˆÊ6WD÷7FW'íÁF˜ñ46ˆÊFóFñˆÊñÊp¢¢∑”∞¢6ˆÁ7BF˜ñ757F˜&S¢&V6˜&C«7G&ñÊr¬Áì‚–¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72bbGóVˆbF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ72””“&ˆ&¶V7B ¢ÚF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁF˜ñ70¢¢∑”∞†¢6ˆÁ7BF˜ñ72“Ä¢vóB&ˆ÷ó6RÊ∆¬Ä¢ˆ&¶V7BÊVÁG&ñW2áF˜ñ757F˜&RíÊ÷Ü7ñÊ2Ö∑F˜ñ4∂Wí¬VÁG'ï“í”‚∞¢6ˆÁ7BF˜ñ2“6ÊóFó¶UF˜ñ2áF˜ñ4∂Wíí«¬6ÊóFó¶UF˜ñ2ÜVÁG'ìÚÁF˜ñ2í«¬ÁV∆√∞¢ñbÇF˜ñ2í&WGW&‚ÁV∆√∞†¢6ˆÁ7B∆FW7EÜ6R–¢G'ï'6UÜ6RÜVÁG'ìÚÁÜ6Rí«¿¢G'ï'6UÜ6RáF˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊVÁG'ï˜Ü6Rì∞¢ñbÇ∆FW7EÜ6Rí&WGW&‚ÁV∆√∞¢6ˆÁ7B∆FW7E7F&ñ∆óGí“Ê˜&÷∆ó¶U7F&ñ∆óGíÄ¢VÁG'ìÚÁ7F&ñ∆óGí«¬F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÁ7F&ñ∆óGí«¬$∆˜r"¿¢ì∞¢6ˆÁ7B&ˆw&W76ñˆ‰WFÜ˜&óGí“∞¢&'Vñ∆FñÊr"¿¢&WÜóEˆ6ˆÊfó&÷FñˆÂˆV∆ñvñ&∆R"¿¢'G&Á6fW%ˆ÷ñÁFVÊÊ6R"¿¢“ÊñÊ6«VFW2Ö7G&ñÊrÜVÁG'ìÚÁ&ˆw&W76ñˆ‰WFÜ˜&óGí«¬""íê¢Ú7G&ñÊrÜVÁG'íÁ&ˆw&W76ñˆ‰WFÜ˜&óGíê¢¢∆FW7E7F&ñ∆óGí””“$ÜñvÇ÷ñÁFVÊÊ6R ¢Ú&WÜóEˆ6ˆÊfó&÷FñˆÂˆV∆ñvñ&∆R ¢¢ÁV∆√∞†¢6ˆÁ7BÊ˜&÷∆ó¶VDÜó7F˜'í“'&íÊó4'&íÜVÁG'ìÚÊÜó7F˜'íê¢ÚVÁG'íÊÜó7F˜'ê¢Ê÷ÇÜóFV”¢Áíí”‚á∞¢Ü6S¢G'ï'6UÜ6RÜóFV”ÚÁÜ6Rí«¬∆FW7EÜ6R¿¢7F&ñ∆óGì¢Ê˜&÷∆ó¶U7F&ñ∆óGíÜóFV”ÚÁ7F&ñ∆óGí«¬∆FW7E7F&ñ∆óGíí¿¢FFS¢7G&ñÊrÜóFV”ÚÊFFR«¬""íÁG&ñ“Çí¿¢“íê¢Êfñ«FW"ÇÜóFV”¢Áíí”‚óFV“ÊFFRê¢Á6˜'BÄ¢Ü¢Áí¬#¢Áíí”‡¢ÊWrFFRÜÊFFRíÊvWEFñ÷RÇí“ÊWrFFRÜ"ÊFFRíÊvWEFñ÷RÇí¿¢ê¢¢µ”∞†¢6ˆÁ7B∆FW7B“Ê˜&÷∆ó¶VDÜó7F˜'ï∂Ê˜&÷∆ó¶VDÜó7F˜'íÊ∆VÊwFÇ““«¬∞¢Ü6S¢∆FW7EÜ6R¿¢7F&ñ∆óGì¢∆FW7E7F&ñ∆óGí¿¢FFS†¢VÁG'ìÚÊ∆7EWFFVB«¿¢F˜ñ46ˆÊFóFñˆÊñÊu7F˜&RÊ∆7EWFFVDB«¿¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢”∞†¢6ˆÁ7B&˜fU7G'V7GW&VDWÜV7WFñˆ‚–¢∆FW7BÁÜ6R””“$6ˆÁG&ˆ∆∆VBFó66ˆ÷f˜'B"«¿¢∆FW7BÁÜ6R””“%Fñ÷R&W77W&R7F&ñ∆óGí#∞¢6ˆÁ7BFñ÷W$6ˆÁG&7B“&˜fU7G'V7GW&VDWÜV7WFñˆ‡¢ÚvóB∆ˆD∆FW7EG5Fñ÷W$6ˆÁG&7Bá≤7GVFVÁDñB¬F˜ñ2“ê¢¢ÁV∆√∞¢6ˆÁ7BFñ÷ñÊt&6V∆ñÊTñÊ6ˆ◊∆WFR–¢&˜fU7G'V7GW&VDWÜV7WFñˆ‚bbFñ÷W$6ˆÁG&7C∞†¢6ˆÁ7BW'6ó7FVE&WVó&W5F&vWFVE&VFñvÊ˜6ó2–¢VÁG'ìÚÁ&WVó&W5F&vWFVE&VFñvÊ˜6ó2””“G'VS∞¢6ˆÁ7B&WVó&W5F&vWFVE&VFñvÊ˜6ó2–¢W'6ó7FVE&WVó&W5F&vWFVE&VFñvÊ˜6ó2«¬Fñ÷ñÊt&6V∆ñÊTñÊ6ˆ◊∆WFS∞¢6ˆÁ7BF&vWFVE&VFñvÊ˜6ó57F'EÜ6R–¢W'6ó7FVE&WVó&W5F&vWFVE&VFñvÊ˜6ó0¢ÚG'ï'6UÜ6RÜVÁG'ìÚÁF&vWFVE&VFñvÊ˜6ó57F'EÜ6Rê¢¢Fñ÷ñÊt&6V∆ñÊTñÊ6ˆ◊∆WFP¢Ú%7G'V7GW&VBWÜV7WFñˆ‚ ¢¢ÁV∆√∞¢6ˆÁ7B&W&WVó6óFT6ˆÁG&Fñ7FñˆÂ7FGW2–¢GóVˆbVÁG'ìÚÁ&W&WVó6óFT6ˆÁG&Fñ7FñˆÂ7FGW2””“'7G&ñÊr ¢ÚVÁG'íÁ&W&WVó6óFT6ˆÁG&Fñ7FñˆÂ7FGW0¢¢ÁV∆√∞¢6ˆÁ7B&W&WVó6óFT6ˆÁG&Fñ7FñˆÂ&V6ˆ‚–¢GóVˆbVÁG'ìÚÁ&W&WVó6óFT6ˆÁG&Fñ7FñˆÂ&V6ˆ‚””“'7G&ñÊr ¢ÚVÁG'íÁ&W&WVó6óFT6ˆÁG&Fñ7FñˆÂ&V6ˆ‡¢¢ÁV∆√∞†¢&WGW&‚∞¢F˜ñ2¿¢Ü6S¢∆FW7BÁÜ6R¿¢7F&ñ∆óGì¢∆FW7BÁ7F&ñ∆óGí¿¢&ˆw&W76ñˆ‰WFÜ˜&óGí¿¢∆7EWFFVC¢∆FW7BÊFFR¿¢F˜ñ5&VfW&VÊ6S¢'6U7F˜&VEF˜ñ5&VfW&VÊ6RÜVÁG'ìÚÁF˜ñ5&VfW&VÊ6Rí¿¢&WVó&W5F&vWFVE&VFñvÊ˜6ó2¿¢F&vWFVE&VFñvÊ˜6ó57F'EÜ6R¿¢&W&WVó6óFT6ˆÁG&Fñ7FñˆÂ7FGW2¿¢&W&WVó6óFT6ˆÁG&Fñ7FñˆÂ&V6ˆ‚¿¢Fñ÷ñÊu&VFñÊW73¢∞¢7FGW3¢&˜fU7G'V7GW&VDWÜV7WFñˆ‡¢Ú&Ê˜E˜&WVó&VB ¢¢Fñ÷W$6ˆÁG&7@¢Ú'&VGí ¢¢'F&vWFVE˜&VFñvÊ˜6ó2"¿¢ó77VT6ˆFS¢Fñ÷ñÊt&6V∆ñÊTñÊ6ˆ◊∆WFP¢ÚE5ıDî‘U%Ù$4Tƒî‰UÙî‰4Ù’ƒUDP¢¢ÁV∆¬¿¢6ˆÁG&7DñC¢Fñ÷W$6ˆÁG&7CÚÊ6ˆÁG&7DñB«¬ÁV∆¬¿¢&6V∆ñÊU6V6ˆÊG3¢Fñ÷W$6ˆÁG&7CÚÊ&6V∆ñÊU6V6ˆÊG2«¬ÁV∆¬¿¢&V6ˆ„¢Fñ÷ñÊt&6V∆ñÊTñÊ6ˆ◊∆WFP¢Ú%FÜó2&˜fR’7G'V7GW&VB‘WÜV7WFñˆ‚F˜ñ2&VFFW2˜"∆6∑2f∆ñBñÊFófñGV∆ó¶VBFñ÷ñÊrWFÜ˜&óGí‚˜&FñÊ'íG&ñÊñÊró2ÜV∆BVÁFñ¬F&vWFVBWfñFVÊ6R÷ÊFófR&R÷FñvÊ˜6ó2W7F&∆ó6ÜW2FÜR÷ó76ñÊr&6V∆ñÊR‚ ¢¢ÁV∆¬¿¢“¿¢”∞¢“í¿¢ê¢ê¢Êfñ«FW"Çá&˜rì¢&˜ró2Êˆ‰ÁV∆∆&∆S«GóVˆb&˜s‚”‚&˜rê¢Á6˜'BÄ¢Ü¬"í”‡¢ÊWrFFRÜ"Ê∆7EWFFVBíÊvWEFñ÷RÇí“ÊWrFFRÜÊ∆7EWFFVBíÊvWEFñ÷RÇí¿¢ì∞†¢&W2Êß6ˆ‚á≤F˜ñ72“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrGWF˜"F˜ñ26ˆÊFóFñˆÊñÊr7FFW3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇF˜ñ26ˆÊFóFñˆÊñÊr7FFW2"“ì∞¢–¢“ì∞†¢ÚÚvWB&VÁB&W˜'G0¢ÊvWBÇ"ˆí˜&VÁB˜&W˜'G2"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7B&W˜'E&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5B"‚¢¬RÊÊ÷R2GWF˜%ˆÊ÷P¢e$Ù“V&∆ñ2Á&VÁE˜&W˜'G2 ¢ƒTeB§Ùî‚V&∆ñ2ÁW6W'2RÙ‚RÊñB“"ÁGWF˜%ˆñ@¢tÑU$R"Á&VÁEˆñB“C¢ı$DU"%í"Á6VÁEˆBDU46¿¢∑&VÁDñE“¿¢ì∞¢&WGW&‚&W2Êß6ˆ‚á&W˜'E&W7V«BÁ&˜w2Ê÷Çá&W˜'C¢Áíí”‚÷&VÁDf6ñÊu&W˜'Bá&W˜'B¬&W˜'BÁGWF˜%ˆÊ÷Rííì∞¢–†¢6ˆÁ7B≤FF¢&W˜'G2¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁE˜&W˜'G2"ê¢Á6V∆V7BÇ"¢"ê¢ÊWÇ'&VÁEˆñB"¬&VÁDñBê¢Ê˜&FW"Ç'6VÁEˆB"¬≤66VÊFñÊs¢f«6R“ì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞†¢6ˆÁ7BGWF˜$ñG2“'&íÊg&ˆ“ÜÊWr6WBÇá&W˜'G2«¬µ“íÊ÷Çá&W˜'C¢Áíí”‚&W˜'BÁGWF˜%ˆñBíÊfñ«FW"Ñ&ˆˆ∆V‚ííì∞¢∆WBGWF˜$Ê÷T÷¢&V6˜&C«7G&ñÊr¬7G&ñÊs‚“∑”∞†¢ñbáGWF˜$ñG2Ê∆VÊwFÇ‚í∞¢6ˆÁ7B≤FF¢GWF˜'2¬W'&˜#¢GWF˜$W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'W6W'2"ê¢Á6V∆V7BÇ&ñB¬Ê÷R"ê¢Êñ‚Ç&ñB"¬GWF˜$ñG2ì∞†¢ñbáGWF˜$W'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊrGWF˜"Ê÷W2f˜"&VÁB&W˜'G3¢"¬GWF˜$W'&˜"ì∞¢“V«6R∞¢GWF˜$Ê÷T÷“áGWF˜'2«¬µ“íÁ&VGV6RÇÜ63¢&V6˜&C«7G&ñÊr¬7G&ñÊs‚¬GWF˜#¢Áíí”‚∞¢65∑GWF˜"ÊñE““GWF˜"ÊÊ÷R«¬%GWF˜"#∞¢&WGW&‚63∞¢“¬∑“ì∞¢–¢–†¢6ˆÁ7B&VÁDf6ñÊu&W˜'G2“á&W˜'G2«¬µ“íÊ÷Çá&W˜'C¢Áíí”‡¢÷&VÁDf6ñÊu&W˜'Bá&W˜'B¬GWF˜$Ê÷T÷∑&W˜'BÁGWF˜%ˆñE“ê¢ì∞†¢&W2Êß6ˆ‚á&VÁDf6ñÊu&W˜'G2ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&W˜'G3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç&W˜'G2"“ì∞¢–¢“ì∞†¢ÚÚ7V&÷óB&VÁBfVVF&6≤ˆ‚&W˜'@¢Á˜7BÇ"ˆí˜&VÁB˜&W˜'G2Û¶ñBˆfVVF&6≤"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B≤ñB““&WÁ&◊3∞¢6ˆÁ7B≤fVVF&6≤““&WÊ&ˆGì∞†¢6ˆÁ7B≤FF¢WÜó7FñÊu&W˜'B¬W'&˜#¢WÜó7FñÊu&W˜'DW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁE˜&W˜'G2"ê¢Á6V∆V7BÇ&ñB¬&VÁEˆñB¬&W˜'E˜GóR"ê¢ÊWÇ&ñB"¬ñBê¢Á6ñÊv∆RÇì∞†¢ñbÜWÜó7FñÊu&W˜'DW'&˜"íFá&˜rWÜó7FñÊu&W˜'DW'&˜#∞¢ñbÇWÜó7FñÊu&W˜'B«¬WÜó7FñÊu&W˜'BÁ&VÁEˆñB”“á&W2ÁííÊF%W6W"ÊñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%&W˜'BÊ˜Bf˜VÊB"“ì∞¢–¢ñbÜWÜó7FñÊu&W˜'BÁ&W˜'E˜GóR”“&÷ˆÁFÜ«í"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢$fVVF&6≤ó2ˆÊ«ífñ∆&∆Rf˜"÷ˆÁFÜ«í&W˜'G2"“ì∞¢–†¢6ˆÁ7B≤FF¢&W˜'B¬W'&˜"““vóB7W&6P¢Êg&ˆ“Ç'&VÁE˜&W˜'G2"ê¢ÁWFFRá∞¢&VÁEˆfVVF&6≥¢fVVF&6≤¿¢&VÁEˆfVVF&6µˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“ê¢ÊWÇ&ñB"¬ñBê¢Á6V∆V7BÇê¢Á6ñÊv∆RÇì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚á&W˜'Bì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"7V&÷óGFñÊrfVVF&6≥¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚ7V&÷óBfVVF&6≤"“ì∞¢–¢“ì∞†¢ÚÚvWB&VÁB'&ˆF67G2Üfñ«FW"f˜"&VÁG2ê¢ÊvWBÇ"ˆí˜&VÁBˆ'&ˆF67G2"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7BW6W$7&VFVDB“á&W2ÁííÊF%W6W#ÚÊ7&VFVDC∞¢∆WBVW'í“7W&6P¢Êg&ˆ“Ç&'&ˆF67G2"ê¢Á6V∆V7BÇ"¢"ê¢Ê6ˆÁFñÁ2Ç'F&vWE˜&ˆ∆W2"¬≤'&VÁB%“ê¢Ê˜&FW"Ç&7&VFVEˆB"¬≤66VÊFñÊs¢f«6R“ì∞¢ ¢ÚÚˆÊ«í6Ü˜r'&ˆF67G27&VFVBgFW"W6W"w266˜VÁBv27&VFV@¢ñbáW6W$7&VFVDBí∞¢VW'í“VW'íÊwFRÇ&7&VFVEˆB"¬W6W$7&VFVDBì∞¢–¢ ¢6ˆÁ7B≤FF¢'&ˆF67G2¬W'&˜"““vóBVW'ì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢&W2Êß6ˆ‚Ü'&ˆF67G2«¬µ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr'&ˆF67G3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç'&ˆF67G2"“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜&VÁBˆ6ˆ÷◊VÊñ6FñˆÁ2"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬76ñvÊVE˜GWF˜%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FP¢e$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$RW6W%ˆñB“C¢ı$DU"%íWFFVEˆBDU40¢ƒî‘ïB¿¢∑&VÁDñE“¿¢ì∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁB“VÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢ñbÇVÁ&ˆ∆∆÷VÁBí&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚ7FófRVÁ&ˆ∆∆÷VÁBf˜VÊB"“ì∞†¢6ˆÁ7B7GVFVÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬Ê÷R¬w&FR¬GWF˜%ˆñ@¢e$Ù“V&∆ñ2Á7GVFVÁG0¢tÑU$R&VÁEˆVÁ&ˆ∆∆÷VÁEˆñB“C¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïB¿¢∂VÁ&ˆ∆∆÷VÁBÊñE“¿¢ì∞¢6ˆÁ7B7GVFVÁB“7GVFVÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢ñbÇ7GVFVÁB«¬7G&ñÊrá7GVFVÁBÁGWF˜%ˆñB«¬""í”“7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñB«¬""íí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B∑GWF˜%&W7V«B¬&VÁE&W7V«B¬Fá&VE&W7V«E““vóB&ˆ÷ó6RÊ∆¬Ö∞¢ˆˆ¬ÁVW'íÇ%4TƒT5BñB¬Ê÷Re$Ù“V&∆ñ2ÁW6W'2tÑU$RñB“Cƒî‘ïB"¬∑7GVFVÁBÁGWF˜%ˆñE“í¿¢ˆˆ¬ÁVW'íÇ%4TƒT5BñB¬Ê÷Re$Ù“V&∆ñ2ÁW6W'2tÑU$RñB“Cƒî‘ïB"¬∑&VÁDñE“í¿¢ˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬7GVFVÁEˆñB¬GWF˜%ˆñB¬&VÁEˆñB¬VFñVÊ6P¢e$Ù“V&∆ñ2Á7GVFVÁEˆ6ˆ÷◊VÊñ6FñˆÂ˜Fá&VG0¢tÑU$R7GVFVÁEˆñB“C‰B&VÁEˆñB“C"‰BVFñVÊ6R“w&VÁBp¢ƒî‘ïB¿¢∑7GVFVÁBÊñB¬&VÁDñE“¿¢í¿¢“ì∞¢∆WBFá&VB“Fá&VE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢ñbÇFá&VBí∞¢6ˆÁ7BñÁ6W'FVEFá&VB“vóBˆˆ¬ÁVW'íÄ¢îÂ4U%BîÂDÚV&∆ñ2Á7GVFVÁEˆ6ˆ÷◊VÊñ6FñˆÂ˜Fá&VG2á7GVFVÁEˆñB¬GWF˜%ˆñB¬&VÁEˆñB¬VFñVÊ6Rê¢d≈TU2ÇC¬C"¬C2¬w&VÁBrê¢$UEU$‰î‰rñB¬7GVFVÁEˆñB¬GWF˜%ˆñB¬&VÁEˆñB¬VFñVÊ6V¿¢∑7GVFVÁBÊñB¬7GVFVÁBÁGWF˜%ˆñB¬&VÁDñE“¿¢ì∞¢Fá&VB“ñÁ6W'FVEFá&VBÁ&˜w5≥“«¬ÁV∆√∞¢–¢ñbÇFá&VBí&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$6ˆ÷◊VÊñ6Fñˆ‚Fá&VBVÊfñ∆&∆R"“ì∞†¢6ˆÁ7B÷W76vU&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬Fá&VEˆñB¬7GVFVÁEˆñB¬GWF˜%ˆñB¬&VÁEˆñB¬VFñVÊ6R¬6VÊFW%˜&ˆ∆R¿¢6VÊFW%˜W6W%ˆñB¬6VÊFW%˜7GVFVÁE˜W6W%ˆñB¬&W«ï˜Fıˆ÷W76vUˆñB¬÷W76vR¿¢7&VFVEˆB¬&VEˆ'ï˜GWF˜%ˆB¬&VEˆ'ï˜&VÁEˆB¬&VEˆ'ï˜7GVFVÁEˆ@¢e$Ù“V&∆ñ2Á7GVFVÁEˆ6ˆ÷◊VÊñ6FñˆÂˆ÷W76vW0¢tÑU$RFá&VEˆñB“C‰B7GVFVÁEˆñB“C"‰B&VÁEˆñB“C2‰BVFñVÊ6R“w&VÁBp¢ı$DU"%í7&VFVEˆB46¿¢∑Fá&VBÊñB¬7GVFVÁBÊñB¬&VÁDñE“¿¢ì∞¢6ˆÁ7B÷W76vW4'îñB“ÊWr÷«7G&ñÊr¬Áì‚Ü÷W76vU&W7V«BÁ&˜w2Ê÷Çá&˜s¢Áíí”‚µ7G&ñÊrá&˜rÊñBí¬&˜u“íì∞¢6ˆÁ7BGWF˜$Ê÷R“GWF˜%&W7V«BÁ&˜w5≥”ÚÊÊ÷R«¬%GWF˜"#∞¢6ˆÁ7B&VÁDÊ÷R“&VÁE&W7V«BÁ&˜w5≥”ÚÊÊ÷R«¬%&VÁB#∞¢6ˆÁ7B6VÊFW$Ê÷R“á&˜s¢Áíí”‚&˜rÁ6VÊFW%˜&ˆ∆R””“'GWF˜" ¢ÚGWF˜$Ê÷P¢¢&˜rÁ6VÊFW%˜&ˆ∆R””“'&VÁB ¢Ú&VÁDÊ÷P¢¢7G&ñÊrá7GVFVÁBÊÊ÷R«¬%7GVFVÁB"íÁG&ñ“Çí«¬%7GVFVÁB#∞¢6ˆÁ7B÷W76vW2“÷W76vU&W7V«BÁ&˜w2Ê÷Çá&˜s¢Áíí”‚∞¢6ˆÁ7B&W«ïF&vWB“&˜rÁ&W«ï˜Fıˆ÷W76vUˆñBÚ÷W76vW4'îñBÊvWBÖ7G&ñÊrá&˜rÁ&W«ï˜Fıˆ÷W76vUˆñBíí¢ÁV∆√∞¢&WGW&‚∞¢ñC¢&˜rÊñB¿¢Fá&VDñC¢&˜rÁFá&VEˆñB¿¢7GVFVÁDñC¢&˜rÁ7GVFVÁEˆñB¿¢GWF˜$ñC¢&˜rÁGWF˜%ˆñB¿¢&VÁDñC¢&˜rÁ&VÁEˆñB¿¢VFñVÊ6S¢&˜rÊVFñVÊ6R¿¢6VÊFW%&ˆ∆S¢&˜rÁ6VÊFW%˜&ˆ∆R¿¢6VÊFW%W6W$ñC¢&˜rÁ6VÊFW%˜W6W%ˆñB¿¢6VÊFW%7GVFVÁEW6W$ñC¢&˜rÁ6VÊFW%˜7GVFVÁE˜W6W%ˆñB¿¢6VÊFW$Ê÷S¢6VÊFW$Ê÷Rá&˜rí¿¢&W«ïFÙ÷W76vTñC¢&˜rÁ&W«ï˜Fıˆ÷W76vUˆñB«¬ÁV∆¬¿¢&W«ïFÛ¢&W«ïF&vWBÚ∞¢ñC¢&W«ïF&vWBÊñB¿¢6VÊFW$Ê÷S¢6VÊFW$Ê÷Rá&W«ïF&vWBí¿¢÷W76vS¢&W«ïF&vWBÊ÷W76vR¿¢“¢ÁV∆¬¿¢÷W76vS¢&˜rÊ÷W76vR¿¢7&VFVDC¢&˜rÊ7&VFVEˆB¿¢&VD'ïGWF˜$C¢&˜rÁ&VEˆ'ï˜GWF˜%ˆB¿¢&VD'ï&VÁDC¢&˜rÁ&VEˆ'ï˜&VÁEˆB¿¢&VD'ï7GVFVÁDC¢&˜rÁ&VEˆ'ï˜7GVFVÁEˆB¿¢”∞¢“ì∞†¢vóBˆˆ¬ÁVW'íÄ¢UDDRV&∆ñ2Á7GVFVÁEˆ6ˆ÷◊VÊñ6FñˆÂˆ÷W76vW0¢4UB&VEˆ'ï˜&VÁEˆB“‰ırÇê¢tÑU$RFá&VEˆñB“C‰B7GVFVÁEˆñB“C"‰B&VÁEˆñB“C0¢‰BVFñVÊ6R“w&VÁBr‰B&VEˆ'ï˜&VÁEˆBï2ÂTƒ∆¿¢∑Fá&VBÊñB¬7GVFVÁBÊñB¬&VÁDñE“¿¢ì∞†¢&WGW&‚&W2Êß6ˆ‚á∞¢7GVFVÁC¢≤ñC¢7GVFVÁBÊñB¬Ê÷S¢7GVFVÁBÊÊ÷R¬w&FS¢7GVFVÁBÊw&FR«¬ÁV∆¬“¿¢GWF˜#¢≤ñC¢7GVFVÁBÁGWF˜%ˆñB¬Ê÷S¢GWF˜$Ê÷R“¿¢&VÁC¢≤ñC¢&VÁDñB¬Ê÷S¢&VÁDÊ÷R¬fñ∆&∆S¢&VÁE&W7V«BÁ&˜w5≥““¿¢Fá&VC¢≤Fá&VDñC¢Fá&VBÊñB¬VFñVÊ6S¢'&VÁB"¬÷W76vW2“¿¢“ì∞¢–†¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜"““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñB¿¢&ñ÷'ï6V∆V7C¢&ñB¬W6W%ˆñB¬76ñvÊVE˜GWF˜%ˆñB¬76ñvÊVE˜7GVFVÁEˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬&VÁEˆV÷ñ¬"¿¢f∆∆&6µ6V∆V7C¢&ñB¬W6W%ˆñB¬76ñvÊVE˜GWF˜%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬&VÁEˆV÷ñ¬"¿¢“ì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢ñbÇVÁ&ˆ∆∆÷VÁBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚ7FófRVÁ&ˆ∆∆÷VÁBf˜VÊB"“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóB&W6ˆ«fT6ÊˆÊñ6≈7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBì∞¢ñbÇ7GVFVÁB«¬7GVFVÁBÁGWF˜$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7B'VÊF∆R“vóB'Vñ∆E7GVFVÁD6ˆ÷◊VÊñ6Fñˆ‰'VÊF∆Rá≤7GVFVÁB¬&VÁDñB“ì∞¢vóB÷&¥6ˆ÷◊VÊñ6FñˆÂFá&VE&VBá≤7GVFVÁDñC¢7GVFVÁBÊñB¬VFñVÊ6S¢'&VÁB"¬fñWvW%&ˆ∆S¢'&VÁB"“ì∞¢&W2Êß6ˆ‚á∞¢7GVFVÁC¢'VÊF∆RÁ7GVFVÁB¿¢GWF˜#¢'VÊF∆RÁGWF˜"¿¢&VÁC¢'VÊF∆RÁ&VÁB¿¢Fá&VC¢'VÊF∆RÁFá&VG2Á&VÁB¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&VÁB6ˆ÷◊VÊñ6FñˆÁ3¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6Ç6ˆ÷◊VÊñ6FñˆÁ2"“ì∞¢–¢“ì∞†¢ÊvWBÇ"ˆí˜&VÁBˆ6ˆ÷◊VÊñ6FñˆÁ2˜VÁ&VB÷6˜VÁB"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞†¢ñbÜó4V÷W&vVÊ7îF$÷ˆFRÇíí∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬76ñvÊVE˜GWF˜%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷P¢e$Ù“V&∆ñ2Á&VÁEˆVÁ&ˆ∆∆÷VÁG0¢tÑU$RW6W%ˆñB“C¢ı$DU"%íWFFVEˆBDU40¢ƒî‘ïB¿¢∑&VÁDñE“¿¢ì∞¢6ˆÁ7BVÁ&ˆ∆∆÷VÁB“VÁ&ˆ∆∆÷VÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢ñbÇVÁ&ˆ∆∆÷VÁCÚÊ76ñvÊVE˜GWF˜%ˆñBí&WGW&‚&W2Êß6ˆ‚á≤VÁ&VD6˜VÁC¢“ì∞†¢6ˆÁ7B7GVFVÁE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5BñB¬GWF˜%ˆñ@¢e$Ù“V&∆ñ2Á7GVFVÁG0¢tÑU$R&VÁEˆVÁ&ˆ∆∆÷VÁEˆñB“C¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïB¿¢∂VÁ&ˆ∆∆÷VÁBÊñE“¿¢ì∞¢6ˆÁ7B7GVFVÁB“7GVFVÁE&W7V«BÁ&˜w5≥“«¬ÁV∆√∞¢ñbÇ7GVFVÁB«¬7G&ñÊrá7GVFVÁBÁGWF˜%ˆñBí”“7G&ñÊrÜVÁ&ˆ∆∆÷VÁBÊ76ñvÊVE˜GWF˜%ˆñBíí∞¢&WGW&‚&W2Êß6ˆ‚á≤VÁ&VD6˜VÁC¢“ì∞¢–†¢6ˆÁ7BVÁ&VE&W7V«B“vóBˆˆ¬ÁVW'íÄ¢4TƒT5B6˜VÁBÇ¢ì£¶ñÁB26˜VÁ@¢e$Ù“V&∆ñ2Á7GVFVÁEˆ6ˆ÷◊VÊñ6FñˆÂˆ÷W76vW0¢tÑU$R7GVFVÁEˆñB“C¢‰B&VÁEˆñB“C ¢‰BVFñVÊ6R“w&VÁBp¢‰B&VEˆ'ï˜&VÁEˆBï2ÂTƒ¿¢‰B6VÊFW%˜&ˆ∆R√‚w&VÁBv¿¢∑7GVFVÁBÊñB¬&VÁDñE“¿¢ì∞¢&WGW&‚&W2Êß6ˆ‚á≤VÁ&VD6˜VÁC¢ÁV÷&W"áVÁ&VE&W7V«BÁ&˜w5≥”ÚÊ6˜VÁB«¬í“ì∞¢–†¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜"““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñB¿¢&ñ÷'ï6V∆V7C¢&ñB¬W6W%ˆñB¬76ñvÊVE˜GWF˜%ˆñB¬76ñvÊVE˜7GVFVÁEˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬&VÁEˆV÷ñ¬"¿¢f∆∆&6µ6V∆V7C¢&ñB¬W6W%ˆñB¬76ñvÊVE˜GWF˜%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬&VÁEˆV÷ñ¬"¿¢“ì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢ñbÇVÁ&ˆ∆∆÷VÁBí∞¢&WGW&‚&W2Êß6ˆ‚á≤VÁ&VD6˜VÁC¢“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóB&W6ˆ«fT6ÊˆÊñ6≈7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBì∞¢ñbÇ7GVFVÁB«¬7GVFVÁBÁGWF˜$ñBí∞¢&WGW&‚&W2Êß6ˆ‚á≤VÁ&VD6˜VÁC¢“ì∞¢–†¢6ˆÁ7BFá&VB“vóBVÁ7W&U7GVFVÁD6ˆ÷◊VÊñ6FñˆÂFá&VBá∞¢7GVFVÁDñC¢7GVFVÁBÊñB¿¢GWF˜$ñC¢7GVFVÁBÁGWF˜$ñB¿¢&VÁDñB¿¢VFñVÊ6S¢'&VÁB"¿¢“ì∞†¢6ˆÁ7B≤FF¬W'&˜#¢VÁ&VDW'&˜"““vóB7W&6P¢Êg&ˆ“Ç'7GVFVÁEˆ6ˆ÷◊VÊñ6FñˆÂˆ÷W76vW2"ê¢Á6V∆V7BÇ&ñB"ê¢ÊWÇ'Fá&VEˆñB"¬Fá&VBÊñBê¢ÊÊWÇ'6VÊFW%˜&ˆ∆R"¬'&VÁB"ê¢Êó2Ç'&VEˆ'ï˜&VÁEˆB"¬ÁV∆¬ì∞†¢ñbáVÁ&VDW'&˜"íFá&˜rVÁ&VDW'&˜#∞†¢&W2Êß6ˆ‚á≤VÁ&VD6˜VÁC¢ÜFF«¬µ“íÊ∆VÊwFÇ“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"fWF6ÜñÊr&VÁB6ˆ÷◊VÊñ6Fñˆ‚VÁ&VB6˜VÁC¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤÷W76vS¢$fñ∆VBFÚfWF6ÇVÁ&VB6˜VÁB"“ì∞¢–¢“ì∞†¢Á˜7BÇ"ˆí˜&VÁBˆ6ˆ÷◊VÊñ6FñˆÁ2"¬ó4WFÜVÁFñ6FVB¬&WVó&U&ˆ∆RÖ≤'&VÁB%“í¬7ñÊ2á&W¢&WVW7B¬&W3¢&W7ˆÁ6Rí”‚∞¢G'í∞¢6ˆÁ7B&VÁDñB“á&W2ÁííÊF%W6W"ÊñC∞¢6ˆÁ7B'6VB“ñÁ6W'E7GVFVÁD6ˆ÷◊VÊñ6Fñˆ‰÷W76vU66ÜV÷Á'6Rá≤‚‚‚á&WÊ&ˆGí«¬∑“í¬VFñVÊ6S¢'&VÁB"“ì∞¢6ˆÁ7B≤FF¢VÁ&ˆ∆∆÷VÁB¬W'&˜"““vóB6V∆V7D∆FW7E&VÁDVÁ&ˆ∆∆÷VÁBá∞¢&VÁDñB¿¢&ñ÷'ï6V∆V7C¢&ñB¬W6W%ˆñB¬76ñvÊVE˜GWF˜%ˆñB¬76ñvÊVE˜7GVFVÁEˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬&VÁEˆV÷ñ¬"¿¢f∆∆&6µ6V∆V7C¢&ñB¬W6W%ˆñB¬76ñvÊVE˜GWF˜%ˆñB¬7GVFVÁEˆgV∆≈ˆÊ÷R¬7GVFVÁEˆw&FR¬&VÁEˆV÷ñ¬"¿¢“ì∞†¢ñbÜW'&˜"íFá&˜rW'&˜#∞¢ñbÇVÁ&ˆ∆∆÷VÁBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢$ÊÚ7FófRVÁ&ˆ∆∆÷VÁBf˜VÊB"“ì∞¢–†¢6ˆÁ7B7GVFVÁB“vóB&W6ˆ«fT6ÊˆÊñ6≈7GVFVÁDf˜$VÁ&ˆ∆∆÷VÁBÜVÁ&ˆ∆∆÷VÁBì∞¢ñbÇ7GVFVÁB«¬7GVFVÁBÁGWF˜$ñBí∞¢&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤÷W76vS¢%7GVFVÁBÊ˜Bf˜VÊB"“ì∞¢–†¢6ˆÁ7BñÁ6W'FVB“vóB7&VFU7GVFVÁD6ˆ÷◊VÊñ6Fñˆ‰÷W76vRá∞¢7GVFVÁB¿¢&VÁDñB¿¢VFñVÊ6S¢'&VÁB"¿¢6VÊFW%&ˆ∆S¢'&VÁB"¿¢6VÊFW%W6W$ñC¢&VÁDñB¿¢&W«ïFÙ÷W76vTñC¢'6VBÁ&W«ïFÙ÷W76vTñB¿¢÷W76vS¢'6VBÊ÷W76vR¿¢“ì∞†¢&W2Êß6ˆ‚á∞¢ñC¢ñÁ6W'FVBÊñB¿¢VFñVÊ6S¢ñÁ6W'FVBÊVFñVÊ6R¿¢7&VFVDC¢ñÁ6W'FVBÊ7&VFVEˆB¿¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç$W'&˜"6VÊFñÊr&VÁB6ˆ÷◊VÊñ6Fñˆ„¢"¬W'&˜"ì∞¢&W2Á7FGW2ÉCíÊß6ˆ‚á≤÷W76vS¢W'&˜"ñÁ7FÊ6VˆbW'&˜"ÚW'&˜"Ê÷W76vR¢$fñ∆VBFÚ6VÊB÷W76vR"“ì∞¢–¢“ì∞†¢&Vvó7FW$WÜV7WFófT6ˆ÷÷ÊE&áóFÜ’&˜WFW2Ü¬ó4WFÜVÁFñ6FVBì∞†¢6ˆÁ7BáGG6W'fW"“7&VFU6W'fW"Üì∞¢&WGW&‚áGG6W'fW#∞ß–