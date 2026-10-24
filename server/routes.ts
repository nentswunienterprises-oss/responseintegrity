Warning: truncated output (original token count: 101722)
Total output lines: 9999

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
    return resolveEmergencyTutorMode({ assignmentMode, certificationMode });
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
      return persistedMode;
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
  const hasActiveFailHealth =
    specialistSummary?.state === "fail" ||
    specialistSummary?.hasCriticalFail === true ||
    (specialistSummary?.deepDiveProgress || []).some(
      (entry) => entry.currentHealthState === "drift" || entry.criticalFlag,
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
…71722 tokens truncated…          ...existingHistory,
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
                      });
                }

                const ledgerInput: EvidenceLedgerProjectionInput = {
                  sourceDrillId: String(inserted?.id || drillId),
                  studentId: String(studentId),
                  tutorId: String(tutorId),
                  topic: normalizedTopic,
                  scheduledSessionId: scheduledSessionRecordId,
                  trainingSessionRunId: String(trainingRun?.id || sessionId),
                  sessionGroupId: String(scheduledSessionRecordId || trainingRun?.id || sessionId),
                  sessionContext: "active_training",
                  drillType: "training",
                  observedPhase: effectivePhase,
                  statePhaseBefore: effectivePhase,
                  stabilityBefore: previousStability,
                  statePhaseAfter: trainingSummary.phase,
                  stabilityAfter: trainingSummary.stability,
                  transitionReason: trainingSummary.transitionReason,
                  observedAt: String(inserted?.submitted_at || sessionStartTime),
                  sets: drillSets as any,
                };
                if (isEmergencyDbMode()) {
                  pendingEmergencyLedgerInputs.push(ledgerInput);
                } else {
                  await persistEvidenceLedgerShadow(ledgerInput);
                }

                const shadowComparisonInput: TrainingEvidenceShadowDatasetInput = {
                  sourceDrillId: String(inserted?.id || drillId),
                  studentId: String(studentId),
                  tutorId: String(tutorId),
                  topic: normalizedTopic,
                  scheduledSessionId: scheduledSessionRecordId,
                  trainingSessionRunId: String(trainingRun?.id || sessionId),
                  phase: effectivePhase,
                  previousStability,
                  observedAt: String(inserted?.submitted_at || sessionStartTime),
                  evidenceShadow: trainingSummary.evidenceShadow,
                  comparison: trainingSummary.evidenceShadowComparison,
                };
                if (isEmergencyDbMode()) {
                  pendingEmergencyShadowComparisons.push(shadowComparisonInput);
                } else {
                  await persistTrainingShadowComparison(shadowComparisonInput);
                }

                // Update topic state
                const nowIso = new Date().toISOString();
                const updatedEntry = {
                  ...existing,
                  topic: normalizedTopic,
                  phase: trainingSummary.phase,
                  stability: trainingSummary.stability,
                  lastUpdated: nowIso,
                  nextAction: trainingSummary.nextAction,
                  requiresTargetedRediagnosis: trainingSummary.requiresTargetedRediagnosis,
                  targetedRediagnosisStartPhase: trainingSummary.targetedRediagnosisStartPhase,
                  prerequisiteContradictionStatus: trainingSummary.prerequisiteContradiction.status,
                  prerequisiteContradictionReason: trainingSummary.prerequisiteContradiction.reason,
                  tpsTimerContractId:
                    persistedTimerContract?.contractId ||
                    existing?.tpsTimerContractId ||
                    null,
                  tpsTimerBaselineSeconds:
                    persistedTimerContract?.baselineSeconds ||
                    existing?.tpsTimerBaselineSeconds ||
                    null,
                  observationNotes: [
                    `Training evidence decision: ${trainingSummary.observedStability} observed stability`,
                    `Decision: ${trainingSummary.transitionReason.toUpperCase()}`,
                    trainingSummary.requiresTargetedRediagnosis
                      ? `Targeted re-diagnosis start: ${trainingSummary.targetedRediagnosisStartPhase || trainingSummary.observedPhase}`
                      : null,
                    `Compatibility score (non-authoritative): ${trainingSummary.sessionScore}`,
                    trainingSummary.constraint ? `Constraint: ${trainingSummary.constraint}` : null,
                  ]
                    .filter(Boolean)
                    .join(" | "),
                  history: [
                    ...existingHistory,
                    {
                      date: nowIso,
                      phase: trainingSummary.phase,
                      stability: trainingSummary.stability,
                      nextAction: trainingSummary.nextAction,
                      observationNotes: `Training drill update. Evidence decision ${trainingSummary.transitionReason}; compatibility score ${trainingSummary.sessionScore} (non-authoritative).`,
                      structuredObservation: {
                        drillType: "training",
                        observedPhase: trainingSummary.observedPhase,
                        observedStability: trainingSummary.observedStability,
                        previousStability: trainingSummary.previousStability,
                        transitionReason: trainingSummary.transitionReason,
                        phaseDecision: trainingSummary.phaseDecision,
                        decisionAuthority: trainingSummary.decisionAuthority,
                        sessionScore: trainingSummary.sessionScore,
                        nextAction: trainingSummary.nextAction,
                        constraint: trainingSummary.constraint,
                        requiresTargetedRediagnosis: trainingSummary.requiresTargetedRediagnosis,
                        targetedRediagnosisStartPhase: trainingSummary.targetedRediagnosisStartPhase,
                        prerequisiteContradiction: trainingSummary.prerequisiteContradiction,
                      },
                      drillId: inserted.id,
                      sessionId: sessionId,
                    },
                  ].slice(-60),
                };

                topicsStore[normalizedTopic] = updatedEntry;

                drillResults.push({
                  drillId: inserted.id,
                  topic: normalizedTopic,
                  responseSnapshot,
                  scoring: trainingSummary.repRows.map((row) => {
                    const setIndex = trainingSummary.repRows.findIndex(
                      (candidate) => candidate.set === row.set && candidate.rep === row.rep
                    );
                    const scoredSetIndex = Math.max(0, Math.floor(setIndex / 3));
                    const setScore = trainingSummary.setScores[scoredSetIndex] ?? row.repScore;

                    return {
                      set: row.set,
                      rep: row.rep,
                      score: row.repScore,
                      setScore,
                      setPoints: setScore,
                      setMaxPoints: 100,
                      sessionScore: trainingSummary.sessionScore,
                      decisionAuthority: trainingSummary.decisionAuthority,
                      scoreAuthority: false,
                      observedStability: trainingSummary.observedStability,
                      phaseBefore: trainingSummary.observedPhase,
                      phase: trainingSummary.phase,
                      stabilityBefore: trainingSummary.previousStability,
                      stability: trainingSummary.stability,
                      transitionReason: trainingSummary.transitionReason,
                      phaseDecision: trainingSummary.phaseDecision,
                      nextAction: trainingSummary.nextAction,
                      constraint: trainingSummary.constraint,
                      requiresTargetedRediagnosis: trainingSummary.requiresTargetedRediagnosis,
                      targetedRediagnosisStartPhase: trainingSummary.targetedRediagnosisStartPhase,
                      prerequisiteContradictionStatus: trainingSummary.prerequisiteContradiction.status,
                    };
                  }),
                  summary: trainingSummary,
                  timingAuthority: persistedTimerContract
                    ? {
                        contractId: persistedTimerContract.contractId,
                        baselineSeconds: persistedTimerContract.baselineSeconds,
                        source: persistedTimerContract.baselineSource,
                      }
                    : null,
                });
              }

              // Update student concept mastery with all topic changes
              topicConditioningStore.topics = topicsStore;
              topicConditioningStore.lastUpdatedAt = new Date().toISOString();
              conceptMastery.topicConditioning = topicConditioningStore;

              if (isEmergencyDbMode()) {
                await emergencyDbClient!.query(
                  `UPDATE public.students
                      SET concept_mastery = $1
                    WHERE id = $2 AND tutor_id = $3`,
                  [JSON.stringify(conceptMastery), studentId, tutorId],
                );
              } else {
                await storage.updateStudent(studentId, { conceptMastery });
              }

              // Store session summary
              const sessionDuration = 0; // Could be calculated if start/end times provided
              const topicsTouched = Array.from(new Set(sessionDrills.map(d => d.trainingTopic)));

              const scoring = drillResults.flatMap((result) =>
                Array.isArray(result.scoring)
                  ? result.scoring.map((row) => ({ ...row, topic: result.topic }))
                  : []
              );

              if (scheduledSession) {
                if (isEmergencyDbMode()) {
                  await emergencyDbClient!.query(
                    `UPDATE public.scheduled_sessions
                        SET status = 'completed', attendance_status = 'both_joined',
                            recording_status = 'manual_not_tracked', transcript_status = 'manual_not_tracked', updated_at = NOW()
                      WHERE id = $1 AND tutor_id = $2 AND student_id = $3`,
                    [scheduledSession.id, tutorId, studentId],
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

              if (isEmergencyDbMode()) {
                await emergencyDbClient!.query(
                  `UPDATE public.training_session_runs
                      SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
                    WHERE id = $1 AND student_id = $2 AND tutor_id = $3`,
                  [trainingRun?.id || sessionId, studentId, tutorId],
                );
              } else {
                await supabase
                  .from("training_session_runs")
                  .update({
                    status: "submitted",
                    submitted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", trainingRun?.id || sessionId);
              }

              let parentId = String(
                scheduledSession?.parent_id ||
                  (student as any)?.parentId ||
                  (student as any)?.parent_id ||
                  "",
              ).trim();
              if (!parentId && !isEmergencyDbMode()) {
                const { data: linkedStudent } = await supabase
                  .from("students")
                  .select("parent_id")
                  .eq("id", studentId)
                  .maybeSingle();
                parentId = String(linkedStudent?.parent_id || "").trim();
              }

              if (emergencyDbClient) {
                await emergencyDbClient.query("COMMIT");
                emergencyDbClient.release();
                emergencyDbClient = null;

                for (const ledgerInput of pendingEmergencyLedgerInputs) {
                  const projection = await persistEvidenceLedgerShadow(ledgerInput);
                  if (projection.status === "persistence_failed" || projection.status === "projection_invalid") {
                    console.warn("[RI_EVIDENCE_LEDGER_SHADOW_DEGRADED]", {
                      sourceDrillId: ledgerInput.sourceDrillId,
                      sessionGroupId: ledgerInput.sessionGroupId,
                      status: projection.status,
                    });
                  }
                }

                for (const comparisonInput of pendingEmergencyShadowComparisons) {
                  const comparisonResult = await persistTrainingShadowComparison(comparisonInput);
                  if (comparisonResult.status === "persistence_failed") {
                    console.warn("[RI_TRAINING_EVIDENCE_SHADOW_DEGRADED]", {
                      sourceDrillId: comparisonInput.sourceDrillId,
                      comparisonId: comparisonResult.comparisonId,
                    });
                  }
                }
              }

              try {
                await maybeAutoSendDeterministicReports(studentId, tutorId);
              } catch (autoReportError) {
                console.error("Auto report generation failed after training session:", autoReportError);
              }

              let monthlyQuota = null;
              if (parentId) {
                try {
                  monthlyQuota = await getMonthlySessionQuotaSnapshot({
                    parentId,
                    studentId: String(studentId),
                    referenceIso: new Date().toISOString(),
                    isSandboxContext: operationalMode === "sandbox" ? true : undefined,
                  });
                } catch (quotaError) {
                  console.error("Failed to reconcile monthly quota after training completion:", quotaError);
                }
              }

              res.json({
                success: true,
                sessionId,
                scheduledSessionId: scheduledSessionRecordId,
                sessionDuration,
                topicsTouched,
                monthlyQuota,
                drillResults,
                scoring,
              });
            } catch (err) {
              if (emergencyDbClient) {
                try {
                  await emergencyDbClient.query("ROLLBACK");
                } finally {
                  emergencyDbClient.release();
                  emergencyDbClient = null;
                }
              }
              console.error("Exception in training session drill submission:", err);
              const statusCode = Number((err as any)?.statusCode);
              const safeStatus =
                Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600
                  ? statusCode
                  : 500;
              res.status(safeStatus).json({
                message:
                  safeStatus === 500
                    ? "Internal server error"
                    : err instanceof Error
                      ? err.message
                      : "Training submission could not continue.",
                code: String((err as any)?.code || "").trim() || undefined,
                targetedRediagnosisStartPhase:
                  (err as any)?.targetedRediagnosisStartPhase || undefined,
              });
