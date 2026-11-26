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
      hostname === "responseintegrit