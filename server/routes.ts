import type { Express, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { existsSync } from "fs";
import { createServer, type Server } from "http";
import { join, resolve } from "path";
import { storage, supabase, createAffiliateCode } from "./storage";
import { getTutorOnboardingDocumentDefinition, loadTutorOnboardingDocument, TUTOR_ONBOARDING_DOCUMENTS } from "./tutorOnboardingDocuments";
import { EGP_ONBOARDING_DOCUMENTS, getEgpOnboardingDocumentDefinition, loadEgpOnboardingDocument } from "./egpOnboardingDocuments";
import { TD_ONBOARDING_DOCUMENTS, getTdOnboardingDocumentDefinition, loadTdOnboardingDocument } from "./tdOnboardingDocuments";
import { setupAuth, isAuthenticated } from "./supabaseAuth";
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
  type BattleTestResponseInput,
  type TutorTrainingMode,
} from "@shared/battleTesting";
import {
  buildBattleTestSuccessPayload,
  buildPodBattleTestingSummary,
  clearTutorAssignmentCertificationState,
  getBattleTestRunDetail,
  getBattleTestRunHistoryForPod,
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

const PREMIUM_PLAN_NAME = "Premium";
const PREMIUM_PLAN_AMOUNT = "1000.00";
const PREMIUM_TUTOR_SHARE = "750.00";
const PREMIUM_PLATFORM_SHARE = "250.00";
const PAYMENT_PROVIDER_PAYFAST = "payfast";

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

function getAppBaseUrl() {
  return (
    String(process.env.APP_BASE_URL || "").trim() ||
    "https://app.responseintegrity.co.za"
  );
}

function getApiPublicUrl() {
  return (
    String(process.env.API_PUBLIC_URL || "").trim() ||
    "https://tt-confidence-hub-api.onrender.com"
  );
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

function getPayfastConfig(useSandbox: boolean) {
  // PayFast can use separate sandbox credentials when needed.
  const merchantId = String(
    useSandbox ? process.env.PAYFAST_SANDBOX_MERCHANT_ID || process.env.PAYFAST_MERCHANT_ID : process.env.PAYFAST_MERCHANT_ID || ""
  ).trim();
  const merchantKey = String(
    useSandbox ? process.env.PAYFAST_SANDBOX_MERCHANT_KEY || process.env.PAYFAST_MERCHANT_KEY : process.env.PAYFAST_MERCHANT_KEY || ""
  ).trim();
  const passphrase = String(
    useSandbox ? process.env.PAYFAST_SANDBOX_PASSPHRASE || process.env.PAYFAST_PASSPHRASE : process.env.PAYFAST_PASSPHRASE || ""
  ).trim();

  return {
    merchantId,
    merchantKey,
    passphrase,
    processUrl: getPayfastProcessUrl(useSandbox),
  };
}

function isPremiumPlanPaymentReady(useSandbox = usePayfastSandbox()) {
  const config = getPayfastConfig(useSandbox);
  return !!(config.merchantId && config.merchantKey);
}

function buildPremiumPaymentDescription(studentName: string | null | undefined) {
  const label = String(studentName || "student").trim() || "student";
  return `Response Integrity Premium monthly plan for ${label}`;
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
  note: z.string().optional(),
  isCriticalFail: z.boolean().optional(),
});

const tutorBattleTestSubmissionSchema = z.object({
  tutorAssignmentId: z.string().min(1),
  tutorId: z.string().min(1),
  phaseKeys: z.array(z.string().min(1)).min(1),
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

async function getTutorOperationalMode(tutorId: string): Promise<"training" | "certified_live"> {
  const mode = await getTutorCertificationMode(tutorId);
  return mode === "certified_live" ? "certified_live" : "training";
}

async function getTutorCertificationMode(tutorId: string): Promise<TutorTrainingMode> {
  const assignment = await storage.getTutorAssignment(tutorId);
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

  return (assignment?.operationalMode as "training" | "certified_live" | undefined) === "certified_live"
    ? "certified_live"
    : "training";
}

async function createPortableTutorAssignment(tutorId: string, podId: string) {
  const assignment = await storage.createTutorAssignment({
    tutorId,
    podId,
    certificationStatus: "pending",
  });

  try {
    await hydrateTutorAssignmentFromPortableSnapshot(assignment.id, tutorId);
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

async function getParentAssignedTutorOperationalMode(parentId: string): Promise<"training" | "certified_live"> {
  let assignedTutorId: string | null = null;

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

async function getStudentOperationalMode(studentId: string): Promise<"training" | "certified_live"> {
  const student = await storage.getStudent(studentId);
  if (!student?.tutorId) return "training";
  return getTutorOperationalMode(student.tutorId);
}

function isMissingSandboxAccountColumnError(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("is_sandbox_account") || message.includes("student_gender");
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

async function autoProvisionSandboxAccountsForTutor(tutorId: string, minimumCount = 3) {
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

async function ensureVisibleSandboxStudentsForTutor(tutorId: string, minimumCount = 3) {
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
      .select("id, status, current_step, is_sandbox_account, parent_full_name, parent_email, student_full_name")
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
  const liveEnrollments = enrollments.filter(
    (enrollment: any) => !isSandboxEnrollmentForTutor(enrollment, tutorId)
  );

  return {
    activeAssignmentCount: enrollments.length,
    sandboxParentCount: sandboxEnrollments.length,
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
  const certifiedLive = modeCounts.certified_live || 0;
  const watchlist = modeCounts.watchlist || 0;
  const suspended = modeCounts.suspended || 0;
  const trainingSideCount = applicant + training + watchlist + suspended;
  const activeStateBuckets = [
    certifiedLive > 0 ? "certified_live" : null,
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
      certified_live: modeCounts.certified_live || 0,
      watchlist: modeCounts.watchlist || 0,
      suspended: modeCounts.suspended || 0,
    },
    assignmentCounts: tutorLoadStats.reduce(
      (acc, stats) => {
        acc.liveParents += stats.liveParentCount;
        acc.sandboxParents += stats.sandboxParentCount;
        acc.awaitingTutorAcceptance += stats.awaitingTutorAcceptanceCount;
        return acc;
      },
      { liveParents: 0, sandboxParents: 0, awaitingTutorAcceptance: 0 }
    ),
    operatingState,
  };
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

const MONTHLY_SESSION_QUOTA = 8;
const RESCHEDULE_LIMIT_PER_SESSION_PER_MONTH = 3;
const CANCELLATION_CUTOFF_HOURS = 12;

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

  const { data: inserted, error } = await supabase
    .from("membership_months")
    .insert({
      parent_id: options.parentId,
      student_id: options.studentId,
      enrollment_id: options.enrollmentId || null,
      month_start: monthKey,
      month_key: monthKey,
      session_quota: MONTHLY_SESSION_QUOTA,
      sessions_used: 0,
      sessions_remaining: MONTHLY_SESSION_QUOTA,
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
    .select("id")
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .eq("type", "training")
    .eq("status", "completed")
    .gte("scheduled_time", usageWindowStart)
    .lt("scheduled_time", nowIso);

  const completedSessionKeys = new Set<string>();
  // Filter sessions by sandbox flag (resolve enrollment per session)
  for (const row of (completedSessions || [])) {
    try {
      const sessionEnrollmentId = await resolveEnrollmentIdForSession({ parent_id: options.parentId, student_id: options.studentId, id: row.id });
      if (!sessionEnrollmentId) {
        // No enrollment, count as production
        completedSessionKeys.add(`training:${row.id}`);
        continue;
      }
      const { data: linkedEnrollment } = await supabase
        .from("parent_enrollments")
        .select("id, is_sandbox_account, parent_email, current_step")
        .eq("id", sessionEnrollmentId)
        .maybeSingle();

      const isSandbox = isSandboxPaymentEnrollment(linkedEnrollment);
      if (!!options.isSandbox) {
        if (isSandbox) completedSessionKeys.add(`training:${row.id}`);
      } else {
        if (!isSandbox) completedSessionKeys.add(`training:${row.id}`);
      }
    } catch (err) {
      // On error, be conservative and count the session
      completedSessionKeys.add(`training:${row.id}`);
    }
  }

  const { data: trainingRuns } = await supabase
    .from("training_session_runs")
    .select("id, scheduled_session_id")
    .eq("student_id", options.studentId)
    .in("status", ["submitted", "completed"])
    .gte("submitted_at", usageWindowStart)
    .lt("submitted_at", nowIso);

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
    .lt("submitted_at", nowIso);

  for (const row of (drills || [])) {
    if (!isTrainingDrillRecord(row)) continue;
    const scheduledId = String(row?.scheduled_session_id || "").trim();
    const runId = String(row?.training_session_run_id || "").trim();
    const drillId = String(row?.id || "").trim();

    if (scheduledId) {
      completedSessionKeys.add(`training:${scheduledId}`);
    } else if (runId) {
      completedSessionKeys.add(`training:${runId}`);
    } else if (drillId) {
      completedSessionKeys.add(`training-drill:${drillId}`);
    }
  }

  const completedUsed = completedSessionKeys.size;

  const { data: eventRows } = await supabase
    .from("session_billing_events")
    .select("credits_delta, billing_impact")
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .gte("effective_at", usageWindowStart)
    .lt("effective_at", nowIso)
    .eq("is_sandbox", !!options.isSandbox);

  const eventUsed = (eventRows || []).reduce((sum: number, row: any) => {
    const delta = Number(row?.credits_delta || 0);
    const impact = String(row?.billing_impact || "").trim().toLowerCase();
    if (impact === "restore") {
      return sum - delta;
    }
    if (impact === "consume") {
      return sum + delta;
    }
    return sum;
  }, 0);

  const used = Math.max(0, Math.min(MONTHLY_SESSION_QUOTA, completedUsed + eventUsed));
  const remaining = Math.max(0, MONTHLY_SESSION_QUOTA - used);
  const snapshot = {
    ...(row || {}),
    session_quota: MONTHLY_SESSION_QUOTA,
    sessions_used: used,
    sessions_remaining: remaining,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  const { data: updated } = await supabase
    .from("membership_months")
    .update({
      sessions_used: used,
      sessions_remaining: remaining,
      updated_at: new Date().toISOString(),
    })
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .eq("month_key", toMonthKey(options.monthStartIso))
    .eq("is_sandbox", !!options.isSandbox)
    .select("*")
    .maybeSingle();

  return {
    ...snapshot,
    ...(updated || {}),
    session_quota: MONTHLY_SESSION_QUOTA,
    sessions_used: used,
    sessions_remaining: remaining,
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

  let { data: row } = await supabase
    .from("membership_months")
    .select("*")
    .eq("parent_id", options.parentId)
    .eq("student_id", options.studentId)
    .eq("month_key", monthKey)
    .eq("is_sandbox", isSandboxContext)
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

  const updated = await recalculateMembershipMonthUsage({
    parentId: options.parentId,
    studentId: options.studentId,
    monthStartIso,
    isSandbox: isSandboxContext,
  });

  return updated || row;
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

  if (!renewal || !monthKey || !parentId) {
    return null;
  }

  const enrollmentId = String(transaction?.enrollment_id || "").trim();
  if (enrollmentId) {
    try {
      const { data: enrollment } = await supabase
        .from("parent_enrollments")
        .select("id, user_id, assigned_tutor_id, assigned_student_id, student_full_name, student_grade, parent_email, is_sandbox_account, current_step")
        .eq("id", enrollmentId)
        .maybeSingle();

      if (enrollment) {
        let canonicalStudentId = "";

        if (enrollment.assigned_student_id) {
          const { data: assignedStudent } = await supabase
            .from("students")
            .select("id")
            .eq("id", enrollment.assigned_student_id)
            .maybeSingle();

          canonicalStudentId = String(assignedStudent?.id || "").trim();
        }

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

        if (!canonicalStudentId) {
          canonicalStudentId = String(enrollment.assigned_student_id || "").trim();
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
      creditsDelta: MONTHLY_SESSION_QUOTA,
      reasonCodes: ["renewal"],
      reasonNote: "Monthly renewal payment applied",
      metadata: {
        monthKey,
        renewal: true,
        transactionId: String(transaction?.id || ""),
      },
      effectiveAtIso: String(transaction?.paid_at || new Date().toISOString()),
    });

    const { data: resetMonth, error: resetError } = await supabase
      .from("membership_months")
      .update({
        sessions_used: 0,
        sessions_remaining: MONTHLY_SESSION_QUOTA,
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
    creditsDelta: MONTHLY_SESSION_QUOTA,
    reasonCodes: ["renewal"],
    reasonNote: "Monthly renewal payment applied",
    metadata: {
      monthKey,
      renewal: true,
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
      sessions_remaining: MONTHLY_SESSION_QUOTA,
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
  const { data, error } = await supabase
    .from("parents")
    .select("onboarding_type, affiliate_code, affiliate_type")
    .eq("user_id", parentId)
    .maybeSingle();

  const onboardingType = String(data?.onboarding_type || "").trim().toLowerCase() === "pilot"
    ? "pilot"
    : "commercial";

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
  const billingModel = await getParentBillingModel(parentId);
  if (billingModel.error) {
    return {
      allowed: false,
      status: 500,
      message: "Failed to resolve onboarding type for payment rules.",
    };
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
          ? "Pilot access is exhausted. Premium payment is now required before more training sessions can be accessed."
          : "Premium payment is required before training sessions can be accessed.",
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

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("parent_enrollments")
    .select("id, status, proposal_id")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    throw new Error("Failed to resolve parent enrollment for paid transaction.");
  }

  const { data: proposal } = await supabase
    .from("onboarding_proposals")
    .select("id, accepted_at, parent_code, student_id, tutor_id, topic_conditioning_topic, topic_conditioning_entry_phase, topic_conditioning_stability")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) {
    throw new Error("Failed to resolve onboarding proposal for paid transaction.");
  }

  if (proposal.accepted_at && proposal.parent_code && enrollment.status === "session_booked") {
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

  const { error: updateError } = await supabase
    .from("parent_enrollments")
    .update({
      status: "session_booked",
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
  const { data: lead } = await supabase
    .from("leads")
    .select("id, affiliate_id")
    .eq("user_id", parentId)
    .maybeSingle();

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

      const { error: closeError } = await supabase
        .from("closes")
        .insert({
          affiliate_id: lead.affiliate_id,
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
      body: "A parent completed Premium payment. Continue with the scheduled session flow.",
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
          const parseAuthoritativePhase = (value: unknown): TopicPhase | null => {
            return tryParsePhase(value);
          };

          const normalizeIntroDrillSets = (raw: any): Array<{ setName: string; observations: Array<Record<string, string>> }> => {
            if (Array.isArray(raw)) {
              return raw.map((set: any) => ({
                setName: String(set?.setName || "Set"),
                observations: Array.isArray(set?.observations) ? set.observations : [],
              }));
            }
            if (raw && Array.isArray(raw.sets)) {
              return raw.sets.map((set: any) => ({
                setName: String(set?.setName || "Set"),
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
                  observations: Array.isArray(block?.observations) ? block.observations : [],
                };
              })
              .filter(Boolean) as Array<{
              phase: TopicPhase;
              setName: string;
              observations: Array<Record<string, string>>;
            }>;
          };

          const EXACT_SET_LIBRARY: Record<
            "diagnosis" | "training",
            Record<
              "Clarity" | "Structured Execution" | "Controlled Discomfort" | "Time Pressure Stability",
              Array<{ setName: string; reps: number; modelingOnly?: boolean }>
            >
          > = {
            diagnosis: {
              Clarity: [
                { setName: "Recognition Probe", reps: 3 },
                { setName: "Light Apply Probe", reps: 3 },
              ],
              "Structured Execution": [
                { setName: "Start + Structure", reps: 3 },
                { setName: "Repeatability", reps: 3 },
              ],
              "Controlled Discomfort": [
                { setName: "First Contact", reps: 3 },
                { setName: "Pressure Hold", reps: 3 },
              ],
              "Time Pressure Stability": [
                { setName: "Light Timer", reps: 3 },
                { setName: "Consistency", reps: 3 },
              ],
            },
            training: {
              Clarity: [
                { setName: "Modeling", reps: 1, modelingOnly: true },
                { setName: "Identification", reps: 3 },
                { setName: "Light Apply", reps: 3 },
              ],
              "Structured Execution": [
                { setName: "Required Structure", reps: 3 },
                { setName: "Independent Execution", reps: 3 },
                { setName: "Variation Control", reps: 3 },
              ],
              "Controlled Discomfort": [
                { setName: "Controlled Entry", reps: 3 },
                { setName: "No Rescue", reps: 3 },
                { setName: "Repeat Exposure", reps: 3 },
              ],
              "Time Pressure Stability": [
                { setName: "Structure Under Timer", reps: 3 },
                { setName: "Repeated Timed Execution", reps: 3 },
                { setName: "Full Constraint", reps: 3 },
              ],
            },
          };

          const ADAPTIVE_DIAGNOSIS_SET_LIBRARY: Record<TopicPhase, { setName: string; reps: number }> = {
            Clarity: { setName: "Recognition Probe", reps: 3 },
            "Structured Execution": { setName: "Start + Structure", reps: 3 },
            "Controlled Discomfort": { setName: "First Contact", reps: 3 },
            "Time Pressure Stability": { setName: "Light Timer", reps: 3 },
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
              observations: Array<Record<string, string>>;
            }>
          ): string | null => {
            if (!blocks.length) {
              return "Adaptive diagnosis must include at least one phase verification block";
            }

            for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
              const block = blocks[blockIndex];
              const expectedSet = ADAPTIVE_DIAGNOSIS_SET_LIBRARY[block.phase];
              const observations = Array.isArray(block.observations) ? block.observations : [];
              const phaseFields = INTRO_PHASE_WEIGHTS[block.phase] || [];

              if (!expectedSet) {
                return `Adaptive diagnosis block ${blockIndex + 1} has an invalid phase`;
              }

              if (String(block.setName || "").trim() !== expectedSet.setName) {
                return `Adaptive diagnosis block ${blockIndex + 1} must be "${expectedSet.setName}"`;
              }

              if (observations.length !== expectedSet.reps) {
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

          const reduceHandoverStability = (stability: TopicStability): TopicStability => {
            if (stability === "High Maintenance") return "High";
            if (stability === "High") return "Medium";
            if (stability === "Medium") return "Low";
            return "Low";
          };

          const computeHandoverVerificationSummary = (
            phase: TopicPhase,
            previousStability: TopicStability,
            observations: Array<Record<string, string>>
          ) => {
            const phaseSummary = computeAdaptiveDiagnosisPhaseSummary(phase, observations);
            const verificationScore = phaseSummary.phaseScore;

            let verificationOutcome:
              | "hold"
              | "stability_adjust"
              | "targeted_re_diagnosis_required" = "hold";
            let confidence: "low" | "normal" | "strong" = "normal";
            let resultingPhase: TopicPhase = phase;
            let resultingStability: TopicStability = previousStability;

            if (verificationScore <= 39) {
              verificationOutcome = "targeted_re_diagnosis_required";
              confidence = "low";
            } else if (verificationScore <= 59) {
              verificationOutcome = "stability_adjust";
              resultingStability = reduceHandoverStability(previousStability);
            } else if (verificationScore <= 84) {
              verificationOutcome = "hold";
              confidence = "normal";
            } else {
              verificationOutcome = "hold";
              confidence = "strong";
            }

            const nextActionConfig =
              verificationOutcome === "targeted_re_diagnosis_required"
                ? null
                : (NEXT_ACTION_ENGINE as any)?.[resultingPhase]?.[resultingStability] || null;

            const verificationOutcomeLabel =
              verificationOutcome === "targeted_re_diagnosis_required"
                ? "Targeted re-diagnosis required"
                : verificationOutcome === "stability_adjust"
                  ? "Stability adjust"
                  : confidence === "strong"
                    ? "Hold with strong confidence"
                    : "Hold";

            const nextAction =
              verificationOutcome === "targeted_re_diagnosis_required"
                ? "Run targeted re-diagnosis on this topic before standard training resumes."
                : verificationOutcome === "stability_adjust"
                  ? `Adjust stability to ${resultingStability} and continue with reinforcement from the current phase.`
                  : nextActionConfig?.primaryAction || "Continue training from the inherited state.";

            const constraint =
              verificationOutcome === "targeted_re_diagnosis_required"
                ? "Do not resume normal training until targeted re-diagnosis is completed."
                : nextActionConfig?.rules?.[0] || null;

            return {
              phase,
              previousStability,
              verificationScore,
              verificationOutcome,
              verificationOutcomeLabel,
              confidence,
              resultingPhase,
              resultingStability,
              reDiagnosisRequired: verificationOutcome === "targeted_re_diagnosis_required",
              nextAction,
              constraint,
              repRows: phaseSummary.repRows,
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

            // Use the locked transition engine from Response Integrity Drift Correction Spec
            const transition = computeTransition(observedPhase, previousStability, sessionScore);

            const nextActionConfig = (NEXT_ACTION_ENGINE as any)?.[transition.next_phase]?.[transition.next_stability] || null;

            return {
              observedPhase,
              previousStability,
              phase: transition.next_phase,
              stability: transition.next_stability,
              transitionReason: normalizeTransitionReason(transition.transition_reason),
              phaseDecision: transition.transition_reason === "phase progress" ? "advance" :
                           transition.transition_reason === "stability regress" ? "regress" : "remain",
              sessionScore,
              nextAction: nextActionConfig?.primaryAction || null,
              constraint: nextActionConfig?.rules?.[0] || null,
              repRows,
              setScores,
              highGuardPasses,
              lowStreakAfterSession: 0, // No longer used in new transition engine
            };
          };

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
              const transitionReason: TransitionReason = "remain";

              return {
                id: row.id,
                date: row.submitted_at,
                duration: 0,
                sessionGroupId: String(parsed.sessionId || row.id),
                topic,
                drillType: "diagnosis",
                behaviorPatterns: rawBehaviorPatterns(observationSignals),
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
                  behaviorSummary: buildBehaviorSummary(observationSignals, "diagnosis", stability),
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

            return {
              id: row.id,
              date: row.submitted_at,
              duration: 0,
              sessionGroupId: String(parsed.sessionId || row.id),
              topic,
              drillType: "training",
                behaviorPatterns: rawBehaviorPatterns(observationSignals),
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
                  behaviorSummary: buildBehaviorSummary(observationSignals, "the drill", stability),
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
              .map(mapDrillRowToDeterministicSession)
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
                const behaviorLines = sortedEntries.map((entry) => {
                  const behaviors = Array.isArray(entry.behaviorPatterns) && entry.behaviorPatterns.length > 0
                    ? naturalJoin(entry.behaviorPatterns)
                    : "no mapped observation pattern detected";
                  return `${entry.topic}: ${behaviors}`;
                });
                const performanceLines = sortedEntries.map((entry) =>
                  `${entry.topic}: ${entry.score}/100, ${entry.stabilityBefore} -> ${entry.stabilityAfter}`
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
                  drillType: "training",
                  deterministicLog: {
                    topicFocus: `This session covered: ${naturalJoin(topics)}.`,
                    whatWasTrained: `Drills were run to train:\n- ${trainedLines.join("\n- ")}`,
                    behaviorSummary: `Across ${topicCount} ${topicCount === 1 ? "topic" : "topics"}:\n- ${behaviorLines.join("\n- ")}`,
                    performanceResult: `Performance by topic:\n- ${performanceLines.join("\n- ")}`,
                    stateMovement: `State movement by topic:\n- ${stateMovementLines.join("\n- ")}`,
                    whatThisMeans: `Interpretation by topic:\n- ${meaningLines.join("\n- ")}`,
                    nextMove: `Next moves:\n- ${nextMoveLines.join("\n- ")}`,
                    summaryText: `This session covered ${naturalJoin(topics)} across ${sortedEntries.length} drills.`,
                    drillLabel: `Training Session (${topicCount} ${topicCount === 1 ? "topic" : "topics"})`,
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

            const { data: scheduledSessions, error: scheduledSessionsError } = await supabase
              .from("scheduled_sessions")
              .select("id, scheduled_time")
              .in("id", scheduledSessionIds);

            if (scheduledSessionsError || !scheduledSessions?.length) {
              return rows;
            }

            const scheduledTimeById = new Map<string, string>();
            for (const session of scheduledSessions || []) {
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
              if (mappedSession.drillType !== "training") return acc;

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
              if (mappedSession.drillType !== "training") return acc;

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
            score,
            transitionReason,
          }: {
            phaseBefore: string;
            phaseAfter: string;
            stabilityAfter: string;
            score: number;
            transitionReason: TransitionReason;
          }) => {
            if (didPhaseProgress({ phaseBefore, phaseAfter, transitionReason })) {
              return `Based on performance, phase is now ${phaseAfter} and stability is ${stabilityAfter} (${score}/100).`;
            }
            if (isFinalPhaseMaintenanceState(phaseAfter, stabilityAfter)) {
              return `Based on performance, phase remains ${phaseAfter} at ${stabilityAfter} (${score}/100).`;
            }
            return `Based on performance, stability is now ${stabilityAfter} in ${phaseAfter} (${score}/100).`;
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
          }: {
            topic: string;
            firstDrillState: { phase: string; stability: string };
            lastDrillState: { phase: string; stability: string };
            transitionReasons: TransitionReason[];
            drillBehaviors: string[][];
          }) => {
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
          }: {
            topic: string;
            firstDrillState: { phase: string; stability: string };
            lastDrillState: { phase: string; stability: string };
            transitionReasons: TransitionReason[];
          }) => {
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

            return {
              version: "weekly-v2-auto",
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
              });
              return includeTopicLabels ? line : formatSingleTopicMovementLine(line);
            });

            const whatBecameStronger = topics
              .map(topic => {
                const strongSignals = buildTopicStrongSignals(topicSnapshots[topic].allBehaviors);
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

            return {
              version: "monthly-v2-auto",
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
            };
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

            const { data, error } = await supabase
              .from("parent_reports")
              .insert({
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
              })
              .select("id")
              .single();

            if (error) throw error;
            return data;
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

            const { data, error } = await supabase
              .from("parent_reports")
              .insert({
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
              })
              .select("id")
              .single();

            if (error) throw error;
            return data;
          };

          const maybeAutoSendDeterministicReports = async (studentId: string, tutorId: string) => {
            const student = await storage.getStudent(studentId);
            if (!student || student.tutorId !== tutorId) return;

            const parentId = await resolveParentIdForStudent(student, tutorId);
            if (!parentId) return;

            const { data: drillRows, error: drillRowsError } = await supabase
              .from("intro_session_drills")
              .select("id, drill, submitted_at, scheduled_session_id")
              .eq("student_id", studentId)
              .eq("tutor_id", tutorId)
              .order("submitted_at", { ascending: true });

            if (drillRowsError || !drillRows || drillRows.length === 0) return;
            const anchoredDrillRows = await attachReportAnchorTimes(drillRows || []);

            const { data: latestWeekly } = await supabase
              .from("parent_reports")
              .select("sent_at")
              .eq("student_id", studentId)
              .eq("tutor_id", tutorId)
              .eq("report_type", "weekly")
              .order("sent_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const { data: latestMonthly } = await supabase
              .from("parent_reports")
              .select("sent_at")
              .eq("student_id", studentId)
              .eq("tutor_id", tutorId)
              .eq("report_type", "monthly")
              .order("sent_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const weeklyBaseline = latestWeekly?.sent_at ? new Date(latestWeekly.sent_at).getTime() : 0;
            const monthlyBaseline = latestMonthly?.sent_at ? new Date(latestMonthly.sent_at).getTime() : 0;

            const weeklyPending = anchoredDrillRows.filter(
              (row: any) => new Date(row.submitted_at).getTime() > weeklyBaseline
            );
            const monthlyPending = anchoredDrillRows.filter(
              (row: any) => new Date(row.submitted_at).getTime() > monthlyBaseline
            );

            const weeklyWindows = buildSessionAwareWeeklyWindows(weeklyPending);
            if (weeklyWindows.length > 0) {
              for (const weeklyWindow of weeklyWindows) {
                const structuredData = createWeeklyStructuredDataFromDrills(weeklyWindow);
                if (structuredData) {
                  const weeklyReport = await insertWeeklyReport({ tutorId, studentId, parentId, structuredData });
                  await safeSendPush(
                    parentId,
                    {
                      title: "Weekly report sent",
                      body: "A new weekly report is available for your child. Open Response Integrity to review it.",
                      url: "/client/parent/progress",
                      tag: `parent-weekly-report-${weeklyReport.id}`,
                    },
                    "parent weekly report sent",
                  );
                }
              }
            }

            const monthlyWindows = buildSessionAwareMonthlyWindows(monthlyPending);
            if (monthlyWindows.length > 0) {
              for (const monthlyWindow of monthlyWindows) {
                const structuredData = createMonthlyStructuredDataFromDrills(monthlyWindow);
                if (structuredData) {
                  const monthlyReport = await insertMonthlyReport({ tutorId, studentId, parentId, structuredData });
                  await safeSendPush(
                    parentId,
                    {
                      title: "Monthly report sent",
                      body: "A new monthly report is available for your child. Open Response Integrity to review it.",
                      url: "/client/parent/progress",
                      tag: `parent-monthly-report-${monthlyReport.id}`,
                    },
                    "parent monthly report sent",
                  );
                }
              }
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
                const explicitScheduledSessionResult: any = await supabase
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
                if (operationalMode !== "training") {
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

              // Store drill results in intro_session_drills table
              const id = uuidv4();
              const { data: inserted, error } = await supabase
                .from("intro_session_drills")
                .insert({
                  id,
                  student_id: studentId,
                  tutor_id: tutorId,
                  drill: JSON.stringify({
                    introTopic: normalizedIntroTopic,
                    phase: diagnosisSummary.phase,
                    startingPhase: isAdaptiveDiagnosis ? startingPhase : drillPhase,
                    drillType: "diagnosis",
                    diagnosisMode: isAdaptiveDiagnosis ? "adaptive" : "legacy",
                    scheduledSessionId: diagnosisScheduledSessionId,
                    sessionContextKind: diagnosisSessionKind,
                    sets: isAdaptiveDiagnosis ? adaptiveBlocks : drillSets,
                    summary: diagnosisSummary,
                  }),
                  scheduled_session_id: diagnosisScheduledSessionId,
                  submitted_at: new Date().toISOString(),
                })
                .select()
                .single();
              if (error) {
                console.error("Error inserting intro session drill:", error);
                return res.status(500).json({ message: "Failed to store drill results" });
              }

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

              res.json({
                success: true,
                id: inserted.id,
                introTopic: normalizedIntroTopic,
                scoring: scoringResults,
                summary: diagnosisSummary,
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
                      phase: rawPhase,
                      setName: set?.setName,
                      observations: set?.observations,
                    }))
                  : []
              );
              const adaptiveBlocks = normalizeAdaptiveDiagnosisBlocks(rawAdaptiveBlocks);
              const isTargetedRediagnosis = !!rediagnosis || adaptiveBlocks.length > 0;
              const verificationBlocks = isTargetedRediagnosis ? adaptiveBlocks : handoverBlocks;
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
                ? validateAdaptiveDiagnosisBlocks(verificationBlocks)
                : validateAdaptiveDiagnosisBlocks(verificationBlocks);
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
                handoverSummary = computeHandoverVerificationSummary(
                  verificationPhase,
                  previousStability,
                  verificationBlock.observations
                );
              }

              const id = uuidv4();
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
                  `Handover Verification Score: ${handoverSummary.verificationScore}`,
                  `Outcome: ${handoverSummary.verificationOutcomeLabel}`,
                  handoverSummary.constraint ? `Constraint: ${handoverSummary.constraint}` : null,
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
                    observationNotes: `Handover verification update. Score ${handoverSummary.verificationScore}.`,
                    structuredObservation: {
                      drillType: "handover_verification",
                      handoverMode: isTargetedRediagnosis ? "targeted_re_diagnosis" : "verification",
                      observedPhase: handoverSummary.phase,
                      previousStability: handoverSummary.previousStability,
                      verificationScore: handoverSummary.verificationScore,
                      verificationOutcome: handoverSummary.verificationOutcome,
                      verificationOutcomeLabel: handoverSummary.verificationOutcomeLabel,
                      verificationConfidence: handoverSummary.confidence,
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
              });
            } catch (err) {
              console.error("Exception in handover verification submission:", err);
              res.status(500).json({ message: "Internal server error" });
            }
          });

          app.post("/api/tutor/training-session-drill", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
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

              if (operationalMode === "certified_live" || operationalMode === "training") {
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

                if (operationalMode === "training") {
                  const status = String(resolvedScheduledSession.status || "").trim();
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
                  const trainingLaunch = getSessionLaunchState(resolvedScheduledSession, "training");
                  if (!trainingLaunch.canLaunch) {
                    return res.status(400).json({ message: "Training drills must submit from an active or imminently scheduled Response Integrity lesson." });
                  }
                }

                scheduledSession = resolvedScheduledSession;
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

              const sessionId = uuidv4();
              const sessionStartTime = new Date().toISOString();
              const drillResults = [];
              const scheduledSessionRecordId = scheduledSession?.id || null;

              const { data: trainingRun } = await supabase
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
                .single();

              // Process each drill in the session
              for (const drillData of sessionDrills) {
                const { trainingTopic, drill, phase: rawPhase, previousStability: rawPreviousStability } = drillData;
                const drillSets = normalizeIntroDrillSets(drill);
                const observedPhase = parseAuthoritativePhase(rawPhase);
                const normalizedTopic = String(trainingTopic || "").trim();

                if (drillSets.length === 0) {
                  return res.status(400).json({ message: `Missing drill data for topic ${normalizedTopic}` });
                }
                if (!observedPhase) {
                  return res.status(400).json({ message: `Invalid or missing phase for topic ${normalizedTopic}` });
                }
                if (!normalizedTopic) {
                  return res.status(400).json({ message: "Training topic is required for each drill" });
                }

                const drillValidationError = validateDrillStructure("training", observedPhase, drillSets);
                if (drillValidationError) {
                  return res.status(400).json({ message: `Validation error for ${normalizedTopic}: ${drillValidationError}` });
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

                const trainingSummary = computeTrainingSessionSummary(
                  effectivePhase,
                  previousStability,
                  drillSets,
                  priorConsecutiveLows
                );

                const drillId = uuidv4();
                const { data: inserted, error } = await supabase
                  .from("intro_session_drills")
                  .insert({
                    id: drillId,
                    student_id: studentId,
                    tutor_id: tutorId,
                    drill: JSON.stringify({
                      trainingTopic: normalizedTopic,
                      phase: trainingSummary.observedPhase,
                      previousStability: trainingSummary.previousStability,
                      drillType: "training",
                      sets: drillSets,
                      summary: trainingSummary,
                      sessionId: sessionId,
                      scheduledSessionId: scheduledSessionRecordId,
                    }),
                    scheduled_session_id: scheduledSessionRecordId,
                    training_session_run_id: trainingRun?.id || sessionId,
                    submitted_at: sessionStartTime,
                  })
                  .select()
                  .single();

                if (error) {
                  console.error("Error inserting training session drill:", error);
                  return res.status(500).json({ message: `Failed to store drill for ${normalizedTopic}` });
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
                  observationNotes: [
                    `Training Drill Session Score: ${trainingSummary.sessionScore}`,
                    `Decision: ${trainingSummary.transitionReason.toUpperCase()}`,
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
                      observationNotes: `Training drill update. Session Score ${trainingSummary.sessionScore}.`,
                      structuredObservation: {
                        drillType: "training",
                        observedPhase: trainingSummary.observedPhase,
                        previousStability: trainingSummary.previousStability,
                        transitionReason: trainingSummary.transitionReason,
                        phaseDecision: trainingSummary.phaseDecision,
                        sessionScore: trainingSummary.sessionScore,
                        nextAction: trainingSummary.nextAction,
                        constraint: trainingSummary.constraint,
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
                      phaseBefore: trainingSummary.observedPhase,
                      phase: trainingSummary.phase,
                      stabilityBefore: trainingSummary.previousStability,
                      stability: trainingSummary.stability,
                      transitionReason: trainingSummary.transitionReason,
                      phaseDecision: trainingSummary.phaseDecision,
                      nextAction: trainingSummary.nextAction,
                      constraint: trainingSummary.constraint,
                    };
                  }),
                  summary: trainingSummary,
                });
              }

              // Update student concept mastery with all topic changes
              topicConditioningStore.topics = topicsStore;
              topicConditioningStore.lastUpdatedAt = new Date().toISOString();
              conceptMastery.topicConditioning = topicConditioningStore;

              await storage.updateStudent(studentId, { conceptMastery });

              // Store session summary
              const sessionDuration = 0; // Could be calculated if start/end times provided
              const topicsTouched = Array.from(new Set(sessionDrills.map(d => d.trainingTopic)));

              try {
                await maybeAutoSendDeterministicReports(studentId, tutorId);
              } catch (autoReportError) {
                console.error("Auto report generation failed after training session:", autoReportError);
              }

              const scoring = drillResults.flatMap((result) =>
                Array.isArray(result.scoring)
                  ? result.scoring.map((row) => ({ ...row, topic: result.topic }))
                  : []
              );

              if (scheduledSession) {
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

              await supabase
                .from("training_session_runs")
                .update({
                  status: "submitted",
                  submitted_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", trainingRun?.id || sessionId);

              res.json({
                success: true,
                sessionId,
                scheduledSessionId: scheduledSessionRecordId,
                sessionDuration,
                topicsTouched,
                drillResults,
                scoring,
              });
            } catch (err) {
              console.error("Exception in training session drill submission:", err);
              res.status(500).json({ message: "Internal server error" });
            }
          });
        // Tutor: Get all topic activations for a student
        app.get("/api/tutor/students/:studentId/topic-conditioning-activations", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
          try {
            const { studentId } = req.params;
            if (!studentId) {
              return res.status(400).json({ message: "Missing studentId" });
            }
            const { data, error } = await supabase
              .from("topic_conditioning_activations")
              .select("id, student_id, tutor_id, topic, reason, created_at")
              .eq("student_id", studentId)
              .order("created_at", { ascending: false });
            if (error) {
              console.error("Error fetching topic activations:", error);
              return res.status(500).json({ message: "Failed to fetch topic activations" });
            }
            res.json({ activations: data });
          } catch (err) {
            console.error("Exception in topic activations fetch:", err);
            res.status(500).json({ message: "Internal server error" });
          }
        });

          app.get("/api/tutor/students/:studentId/latest-intro-drill", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
            try {
              const { studentId } = req.params;
              const tutorId = (req as any).dbUser.id;
              if (!studentId) {
                return res.status(400).json({ message: "Missing studentId" });
              }
              const student = await storage.getStudent(studentId);
              if (!student || student.tutorId !== tutorId) {
                return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
              }

              const { data, error } = await supabase
                .from("intro_session_drills")
                .select("id, drill, submitted_at")
                .eq("student_id", studentId)
                .order("submitted_at", { ascending: false })
                .limit(20);

              if (error || !data || data.length === 0) {
                return res.status(404).json({ message: "No intro drill found for this student" });
              }

              let latestDiagnosis: any = null;
              for (const row of data) {
                let parsed: any = null;
                try {
                  parsed = row.drill && typeof row.drill === "object"
                    ? row.drill
                    : JSON.parse(typeof row.drill === "string" ? row.drill : "{}");
                } catch {
                  parsed = null;
                }
                if ((parsed?.drillType || "diagnosis") === "diagnosis") {
                  latestDiagnosis = { row, parsed };
                  break;
                }
              }

              if (!latestDiagnosis) {
                return res.status(404).json({ message: "No intro diagnosis drill found for this student" });
              }

              const drillObj = latestDiagnosis.parsed;
              res.json({
                id: latestDiagnosis.row.id,
                topic: drillObj.introTopic || drillObj.topic,
                entry_phase: drillObj.phase || drillObj.summary?.phase,
                phaseObserved: drillObj.phase || drillObj.summary?.phase,
                stability: drillObj.summary?.stability || "Low",
                stabilityObserved: drillObj.summary?.stability || "Low",
                drillType: drillObj.drillType,
                summary: drillObj.summary,
                submitted_at: latestDiagnosis.row.submitted_at,
              });
            } catch (err) {
              console.error("Exception in latest intro drill fetch:", err);
              res.status(500).json({ message: "Internal server error" });
            }
          });

      // Tutor: Activate a topic for a student
    app.post("/api/tutor/students/:studentId/topic-conditioning", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const { topic, reason } = req.body;
        const tutorId = (req as any).dbUser?.id;
        if (!studentId || !topic || !reason || !tutorId) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const normalizedTopic = String(topic || "").trim().toLowerCase();
        if (!normalizedTopic) {
          return res.status(400).json({ message: "Topic is required" });
        }

        const { data: existingActivations, error: existingError } = await supabase
          .from("topic_conditioning_activations")
          .select("id, student_id, tutor_id, topic, reason, created_at")
          .eq("student_id", studentId)
          .eq("tutor_id", tutorId)
          .order("created_at", { ascending: false });

        if (existingError) {
          console.error("Error checking existing topic activations:", existingError);
          return res.status(500).json({ message: "Failed to activate topic" });
        }

        const existingActivation = (existingActivations || []).find(
          (entry: any) => String(entry?.topic || "").trim().toLowerCase() === normalizedTopic
        );

        if (existingActivation) {
          return res.json({ activation: existingActivation, duplicate: true });
        }

        const { data, error } = await supabase
          .from("topic_conditioning_activations")
          .insert({
            student_id: studentId,
            tutor_id: tutorId,
            topic: String(topic).trim(),
            reason,
          })
          .select()
          .single();
        if (error) {
          console.error("Error inserting topic activation:", error);
          return res.status(500).json({ message: "Failed to activate topic" });
        }
        res.json({ activation: data });
      } catch (err) {
        console.error("Exception in topic activation:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });
  ensureStudentForEnrollment = async (enrollment: any, tutorIdOverride?: string) => {
    const tutorId = tutorIdOverride || enrollment?.assigned_tutor_id;
    if (!enrollment || !tutorId || !enrollment.user_id || !enrollment.student_full_name || !enrollment.student_grade) {
      return null;
    }

    let existingStudent: any = null;

    if (enrollment.assigned_student_id) {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("id", enrollment.assigned_student_id)
        .maybeSingle();
      existingStudent = data;
    }

    if (!existingStudent && enrollment.id) {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("parent_enrollment_id", enrollment.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      existingStudent =
        (data || []).find((student: any) =>
          studentMatchesEnrollmentSandboxBoundary(enrollment, student, tutorId)
        ) || null;
    }

    if (!existingStudent) {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("parent_id", enrollment.user_id)
        .eq("tutor_id", tutorId)
        .eq("name", enrollment.student_full_name)
        .order("updated_at", { ascending: false })
        .limit(1);
      existingStudent =
        (data || []).find((student: any) =>
          studentMatchesEnrollmentSandboxBoundary(enrollment, student, tutorId)
        ) || null;
    }

    if (!existingStudent && enrollment.parent_email) {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("parent_contact", enrollment.parent_email)
        .eq("tutor_id", tutorId)
        .eq("name", enrollment.student_full_name)
        .order("updated_at", { ascending: false })
        .limit(1);
      existingStudent =
        (data || []).find((student: any) =>
          studentMatchesEnrollmentSandboxBoundary(enrollment, student, tutorId)
        ) || null;
    }

    if (!existingStudent) {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("parent_id", enrollment.user_id)
        .eq("tutor_id", tutorId)
        .limit(2);

      const compatibleStudents = (data || []).filter((student: any) =>
        studentMatchesEnrollmentSandboxBoundary(enrollment, student, tutorId)
      );

      if (compatibleStudents.length === 1) {
        existingStudent = compatibleStudents[0] || null;
      }
    }

    const studentPayload = {
      name: enrollment.student_full_name,
      grade: enrollment.student_grade,
      parent_contact: enrollment.parent_email,
      tutor_id: tutorId,
      parent_id: enrollment.user_id,
      parent_enrollment_id: enrollment.id,
    };

    const existingEnrollmentLink = String(existingStudent?.parent_enrollment_id || "").trim();
    const targetEnrollmentLink = String(enrollment?.id || "").trim();
    const hasConflictingEnrollmentLink =
      !!existingStudent?.id &&
      !!existingEnrollmentLink &&
      !!targetEnrollmentLink &&
      existingEnrollmentLink !== targetEnrollmentLink;

    if (hasConflictingEnrollmentLink) {
      existingStudent = null;
    }

    if (existingStudent) {
      const needsUpdate =
        existingStudent.name !== studentPayload.name ||
        existingStudent.grade !== studentPayload.grade ||
        existingStudent.parent_contact !== studentPayload.parent_contact ||
        existingStudent.tutor_id !== studentPayload.tutor_id ||
        existingStudent.parent_id !== studentPayload.parent_id ||
        existingStudent.parent_enrollment_id !== studentPayload.parent_enrollment_id;

      if (needsUpdate) {
        const { data: updatedStudent, error: updateError } = await supabase
          .from("students")
          .update(studentPayload)
          .eq("id", existingStudent.id)
          .select("*")
          .maybeSingle();

        if (updateError) {
          throw updateError;
        }

        existingStudent = updatedStudent || existingStudent;
      }
    } else {
      const createdStudent = await storage.createStudent({
        name: enrollment.student_full_name,
        grade: enrollment.student_grade,
        tutorId,
        sessionProgress: 0,
        parentContact: enrollment.parent_email,
        parent_id: enrollment.user_id,
        parent_enrollment_id: enrollment.id,
      } as any);

      existingStudent = createdStudent;
    }

    if (existingStudent?.id && enrollment.id && enrollment.assigned_student_id !== existingStudent.id) {
      const { error: linkError } = await supabase
        .from("parent_enrollments")
        .update({ assigned_student_id: existingStudent.id, updated_at: new Date().toISOString() })
        .eq("id", enrollment.id);

      if (linkError) {
        // Some deployments don't yet have assigned_student_id on parent_enrollments.
        // In that case we continue using canonical session matching fallbacks.
        if (String(linkError?.message || "").includes("assigned_student_id")) {
          console.warn("parent_enrollments.assigned_student_id missing; skipping enrollment-student linking");
        } else {
          console.error("Failed to link enrollment to student:", linkError);
        }
      }
    }

    return existingStudent;
  };
      // Revoke (delete) an affiliate code by ID
      app.delete("/api/coo/affiliate-codes/:id", isAuthenticated, requireRole(["coo"]), async (req: Request, res: Response) => {
        try {
          const { pool } = await import('./db.js');
          const dbUser = (req as any).dbUser;
          const { id } = req.params;
          // Only allow deleting codes created by this COO
          const result = await pool.query(
            `DELETE FROM affiliate_codes WHERE id = $1 AND affiliate_id = $2 RETURNING *`,
            [id, dbUser.id]
          );
          if (result.rowCount === 0) {
            return res.status(404).json({ message: "Code not found or not authorized" });
          }
          res.json({ success: true });
        } catch (err) {
          console.error("[affiliate-codes:delete] Error:", err);
          res.status(500).json({ message: err.message || "Failed to revoke code" });
        }
      });
    // List all affiliate codes for the current COO
    app.get("/api/coo/affiliate-codes", isAuthenticated, requireRole(["coo"]), async (req: Request, res: Response) => {
      try {
        const { pool } = await import('./db.js');
        const { transformSnakeToCamel } = await import('./storage');
        const dbUser = (req as any).dbUser;
        // Only show codes created by this COO
        const result = await pool.query(
          `SELECT * FROM affiliate_codes WHERE affiliate_id = $1 ORDER BY created_at DESC`,
          [dbUser.id]
        );
        const camelRows = transformSnakeToCamel(result.rows);
        res.json(camelRows);
      } catch (err) {
        console.error("[affiliate-codes] Error:", err);
        res.status(500).json({ message: err.message || "Failed to fetch codes" });
      }
    });
  // Debug: Test DB connectivity (single endpoint, uses pool)
  app.get("/api/debug/db-test", async (req: Request, res: Response) => {
    try {
      // Log the DATABASE_URL being used
      console.log("[DEBUG] DATABASE_URL:", process.env.DATABASE_URL);
      const { pool } = await import('./db.js');
      const result = await pool.query("SELECT 1 AS test");
      res.json({ success: true, result: result.rows });
    } catch (err) {
      console.error("[DEBUG] REAL ERROR:", err);
      res.status(500).json({ success: false, error: err.message || String(err), details: err });
    }
  });
  // COO: Create affiliate code/link
  app.post("/api/coo/create-affiliate-code", isAuthenticated, requireRole(["coo"]), async (req: Request, res: Response) => {
    console.log("[DEBUG] Session on POST /api/coo/create-affiliate-code:", req.session);
    try {
      const { type, personName, entityName, schoolType } = req.body;
      // Generate unique code (simple example)
      const code = "AFIX" + Math.random().toString(36).substring(2, 8).toUpperCase();
      // Insert into DB
      const affiliateCode = await createAffiliateCode({
        affiliateId: (req as any).dbUser?.id,
        code,
        type,
        personName,
        entityName,
        schoolType,
      });
      res.json({ code });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to create affiliate code" });
    }
  });

  // Debug endpoint for remote header/session inspection
  app.get("/api/debug/auth-info", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || null;
    const sessionId = req.sessionID || null;
    const session = req.session || null;
    console.log("[DEBUG] /api/debug/auth-info");
    console.log("  Authorization header:", authHeader);
    console.log("  Session ID:", sessionId);
    console.log("  Session:", session);
    console.log("  Cookies:", req.headers.cookie || null);
    console.log("  User-Agent:", req.headers["user-agent"] || null);
    console.log("  Origin:", req.headers.origin || null);
    console.log("  Referer:", req.headers.referer || null);
    res.json({
          authorization: authHeader,
          sessionId,
          session,
          cookies: req.headers.cookie || null,
          userAgent: req.headers["user-agent"] || null,
          origin: req.headers.origin || null,
          referer: req.headers.referer || null
        });
      });
    // Get intro session details for a student (for tutors)
    app.get(
      "/api/tutor/students/:studentId/intro-session-details",
      isAuthenticated,
      requireRole(["tutor"]),
      async (req: Request, res: Response) => {
        try {
          console.log('TEST LOG: intro-session-details route hit');
          const { studentId } = req.params;
          const dbUser = (req as any).dbUser;
          // Verify student exists and belongs to this tutor
          const student = await storage.getStudent(studentId);
          if (!student) {
            return res.status(404).json({ message: "Student not found" });
          }
          if (student.tutorId !== dbUser.id) {
            return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
          }
          const studentWorkflow = ((student.personalProfile as any) || {}).workflow || {};
          const sessionType = studentWorkflow.handoverRequiredAt && !studentWorkflow.handoverCompletedAt
            ? "handover"
            : "intro";
          // DEBUG: Print all scheduled_sessions for this tutor and student
          const { data: debugSessions, error: debugSessionsError } = await supabase
            .from("scheduled_sessions")
            .select(SCHEDULED_SESSION_SELECT)
            .eq("tutor_id", dbUser.id)
            .eq("student_id", studentId);
          console.log("[DEBUG] All scheduled_sessions for tutor and student:", { debugSessions, debugSessionsError, tutorId: dbUser.id, studentId });
          // Find latest intro session for this student/tutor
          const sessionLookupResult: any = await supabase
            .from("scheduled_sessions")
            .select(SCHEDULED_SESSION_SELECT)
            .eq("tutor_id", dbUser.id)
            .eq("student_id", studentId)
            .eq("type", sessionType)
            .order("created_at", { ascending: false })
            .maybeSingle();
          const { data: session, error: sessionError } = sessionLookupResult;

          let resolvedSession = session;
          let resolvedSessionError = sessionError;

          if (!resolvedSession) {
            const parentId = (student as any).parentId || null;
            if (parentId) {
              const fallbackSessionResult: any = await supabase
                .from("scheduled_sessions")
                .select(SCHEDULED_SESSION_SELECT)
                .eq("tutor_id", dbUser.id)
                .eq("parent_id", parentId)
                .eq("type", sessionType)
                .order("created_at", { ascending: false })
                .maybeSingle();
              const { data: fallbackSession, error: fallbackError } = fallbackSessionResult;

              if (fallbackSession) {
                resolvedSession = fallbackSession;
                resolvedSessionError = fallbackError;
              }
            }
          }

          console.log("[DEBUG] intro-session-details query result:", { session: resolvedSession, sessionError: resolvedSessionError, tutorId: dbUser.id, studentId });
          if (resolvedSessionError) {
            console.error("[DEBUG] intro-session-details sessionError:", resolvedSessionError);
            return res.status(500).json({ message: "Failed to fetch intro session details", details: resolvedSessionError });
          }
          if (!resolvedSession) {
            return res.json({ status: "not_scheduled" });
          }
          if (shouldReconcileSessionArtifacts(resolvedSession)) {
            await reconcileArtifactsForScheduledSession(resolvedSession);
            const refreshedSessionResult: any = await supabase
              .from("scheduled_sessions")
              .select(SCHEDULED_SESSION_SELECT)
              .eq("id", resolvedSession.id)
              .maybeSingle();
            const { data: refreshedSession } = refreshedSessionResult;
            if (refreshedSession) {
              resolvedSession = refreshedSession;
            }
          }
          let latestHandoverVerification: any = null;
          if (sessionType === "handover") {
            const { data: handoverDrillRows } = await supabase
              .from("intro_session_drills")
              .select("id, drill, submitted_at")
              .eq("student_id", studentId)
              .eq("tutor_id", dbUser.id)
              .eq("scheduled_session_id", resolvedSession.id)
              .order("submitted_at", { ascending: false })
              .limit(5);

            const parsedLatest = (handoverDrillRows || [])
              .map((row: any) => {
                try {
                  const parsed = row?.drill && typeof row.drill === "object"
                    ? row.drill
                    : JSON.parse(typeof row?.drill === "string" ? row.drill : "{}");
                  if (String(parsed?.drillType || "").trim().toLowerCase() !== "handover_verification") {
                    return null;
                  }
                  return {
                    id: row.id,
                    submitted_at: row.submitted_at,
                    topic: parsed?.handoverTopic || null,
                    phase: parsed?.phase || null,
                    startingPhase: parsed?.startingPhase || null,
                    handoverMode: parsed?.handoverMode || "verification",
                    summary: parsed?.summary || null,
                  };
                } catch {
                  return null;
                }
              })
              .filter(Boolean)[0] || null;

            latestHandoverVerification = parsedLatest;
          }
          res.json({
            id: resolvedSession.id,
            scheduled_time: resolvedSession.scheduled_time,
            scheduled_end: resolvedSession.scheduled_end,
            timezone: resolvedSession.timezone,
            status: getEffectiveScheduledSessionStatus(resolvedSession),
            type: resolvedSession.type,
            parent_confirmed: resolvedSession.parent_confirmed,
            tutor_confirmed: resolvedSession.tutor_confirmed,
            recording_status: resolvedSession.recording_status,
            transcript_status: resolvedSession.transcript_status,
            created_at: resolvedSession.created_at,
            updated_at: resolvedSession.updated_at,
            latestHandoverVerification,
            debug: {
              tutor_id: resolvedSession.tutor_id,
              student_id: resolvedSession.student_id,
              parent_id: (resolvedSession as any).parent_id,
              type: resolvedSession.type
            }
          });
        } catch (error) {
          console.error("[DEBUG] Error fetching intro session details:", error);
          res.status(500).json({ message: "Failed to fetch intro session details", details: error });
        }
      }
    );
  // ...existing code...
  await setupAuth(app);

  // Parent proposes an intro session (after auth setup)
  app.post("/api/parent/intro-session/propose", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser.id;
      const operationalMode = await getParentAssignedTutorOperationalMode(userId);
      const { proposedDate, proposedTime } = req.body;
      if (!proposedDate || !proposedTime) {
        return res.status(400).json({ message: "Missing date or time" });
      }

      // Get parent's enrollment to find assigned tutor
      const activeEnrollmentStatuses = [
        "assigned",
        "awaiting_tutor_acceptance",
        "proposal_sent",
        "session_booked",
        "report_received",
        "confirmed",
      ];

      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from("parent_enrollments")
        .select("*")
        .eq("user_id", userId)
        .in("status", activeEnrollmentStatuses)
        .order("updated_at", { ascending: false })
        .limit(1);

      const enrollmentData = enrollmentRows?.[0] || null;

      if (enrollmentError || !enrollmentData) {
        return res.status(400).json({ message: "Failed to fetch enrollment" });
      }
      const sessionType = getEnrollmentSessionType(enrollmentData);
      const sessionLabel = getSessionDisplayLabel(sessionType);
      const allowHandoverBooking = sessionType === "handover" && !!enrollmentData.assigned_tutor_id;
      if (!enrollmentData.assigned_tutor_id || ((enrollmentData.status !== "assigned" && enrollmentData.status !== "awaiting_tutor_acceptance") && !allowHandoverBooking)) {
        return res.status(400).json({ message: "You must be assigned a tutor before booking a session." });
      }

      let assignedStudent = enrollmentData.assigned_student_id
        ? await storage.getStudent(enrollmentData.assigned_student_id)
        : null;

      if (!assignedStudent) {
        assignedStudent = await ensureStudentForEnrollment(
          enrollmentData,
          enrollmentData.assigned_tutor_id
        );
      }

      // Removed check for assignedWorkflow.assignmentAcceptedAt; only enrollment status and assigned tutor are required


      // Check for existing pending intro session for this parent/tutor
      const { data: existingSessions, error: existingSessionError } = await supabase
        .from("scheduled_sessions")
        .select("id, scheduled_time, status, parent_confirmed, tutor_confirmed, created_at, updated_at")
        .eq("parent_id", userId)
        .eq("tutor_id", enrollmentData.assigned_tutor_id)
        .eq("type", sessionType)
        .in("status", ["pending_tutor_confirmation", "pending_parent_confirmation"])
        .order("created_at", { ascending: false })
        .limit(1);

      const existingSession = existingSessions?.[0] || null;

      if (existingSessionError) {
        console.error("Error fetching existing intro session:", existingSessionError);
        return res.status(500).json({
          message: "Failed to propose session",
          debug: {
            stage: "fetch_existing_session",
            error: String(existingSessionError?.message || existingSessionError),
          },
        });
      }

      if (existingSession) {
        // If a pending session exists, update it with the new proposed time and confirmation flags
        const { error: updateError } = await supabase
          .from("scheduled_sessions")
          .update({
            student_id: assignedStudent?.id || null,
            scheduled_time: `${proposedDate}T${proposedTime}`,
            parent_confirmed: true,
            tutor_confirmed: false,
            status: "pending_tutor_confirmation",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSession.id);
        if (updateError) {
          console.error("Error updating existing intro session:", updateError);
          return res.status(500).json({
            message: "Failed to update session",
            debug: {
              stage: "update_existing_session",
              error: String(updateError?.message || updateError),
            },
          });
        }

        // Update enrollment current_step to intro_session_booked
        await supabase
          .from("parent_enrollments")
          .update({ current_step: sessionType === "handover" ? "handover_session_booked" : "intro_session_booked", updated_at: new Date().toISOString() })
          .eq("id", enrollmentData.id);

        return res.status(200).json({
          id: existingSession.id,
          student_id: assignedStudent?.id || null,
          status: "pending_tutor_confirmation",
          operationalMode,
          type: sessionType,
          scheduled_time: `${proposedDate}T${proposedTime}`,
          parent_confirmed: true,
          tutor_confirmed: false,
        });
      }

      // Insert new intro session if none exists
      const { data: sessionInsert, error: sessionError } = await supabase
        .from("scheduled_sessions")
        .insert([
          {
            parent_id: userId,
            tutor_id: enrollmentData.assigned_tutor_id,
            student_id: assignedStudent?.id || null,
            scheduled_time: `${proposedDate}T${proposedTime}`,
            type: sessionType,
            status: "pending_tutor_confirmation",
            parent_confirmed: true,
            tutor_confirmed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select();

      if (sessionError) {
        console.error("Error inserting intro session:", sessionError);
        return res.status(500).json({
          message: "Failed to propose session",
          debug: {
            stage: "insert_session",
            error: String(sessionError?.message || sessionError),
          },
        });
      }

      try {
        await ensureStudentForEnrollment(enrollmentData, enrollmentData.assigned_tutor_id);
      } catch (studentCreateError) {
        console.error("Error creating student record on intro session booking:", studentCreateError);
      }

      // Update enrollment current_step to intro_session_booked
      await supabase
        .from("parent_enrollments")
        .update({ current_step: sessionType === "handover" ? "handover_session_booked" : "intro_session_booked", updated_at: new Date().toISOString() })
        .eq("id", enrollmentData.id);

      const insertedSession = Array.isArray(sessionInsert) ? sessionInsert[0] : sessionInsert;

      res.json({
        id: insertedSession?.id || null,
        student_id: assignedStudent?.id || null,
        status: "pending_tutor_confirmation",
        operationalMode,
        type: sessionType,
        scheduled_time: `${proposedDate}T${proposedTime}`,
        parent_confirmed: true,
        tutor_confirmed: false,
        success: true,
      });
    } catch (error) {
      console.error("Error in propose intro session:", error);
      res.status(500).json({
        message: "Failed to propose session",
        debug: {
          stage: "route_catch",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

    // Parent intro session confirmation status
    app.get("/api/parent/intro-session-confirmation", isAuthenticated, async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const operationalMode = await getParentAssignedTutorOperationalMode(userId);

        const { data: enrollmentData, error: enrollmentError } = await selectLatestParentEnrollment({
          parentId: userId,
          primarySelect: "id, user_id, assigned_tutor_id, assigned_student_id, status, current_step, student_full_name, parent_email, student_grade",
          fallbackSelect: "id, user_id, assigned_tutor_id, status, current_step, student_full_name, parent_email, student_grade",
        });

        if (enrollmentError || !enrollmentData || !enrollmentData.assigned_tutor_id) {
          if (enrollmentError) {
            console.error("[intro-session-confirmation] enrollment lookup failed", {
              userId,
              code: enrollmentError.code,
              message: enrollmentError.message,
              details: enrollmentError.details,
            });
          }
          return res.json({ status: "not_scheduled", operationalMode });
        }

        let assignedStudent = null;
        try {
          assignedStudent = await resolveCanonicalStudentForEnrollment(enrollmentData);
        } catch (studentResolutionError) {
          console.error("[intro-session-confirmation] canonical student resolution failed", {
            userId,
            enrollmentId: enrollmentData.id,
            tutorId: enrollmentData.assigned_tutor_id,
            error: studentResolutionError,
          });
        }

        const sessionType = getEnrollmentSessionType(enrollmentData);
        const sessionLabel = getSessionDisplayLabel(sessionType);


        // Find all intro sessions for this parent/tutor
        const allSessionsResult: any = await supabase
          .from("scheduled_sessions")
          .select(SCHEDULED_SESSION_SELECT)
          .eq("parent_id", userId)
          .eq("tutor_id", enrollmentData.assigned_tutor_id)
          .eq("type", sessionType)
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false });
        let { data: allSessions, error: allSessionsError } = allSessionsResult;

        // Fallback for rows linked by student_id if parent_id linkage is absent or inconsistent.
        if ((!allSessions || allSessions.length === 0) && assignedStudent?.id) {
          const fallback = await supabase
            .from("scheduled_sessions")
            .select(SCHEDULED_SESSION_SELECT)
            .eq("student_id", assignedStudent.id)
            .eq("tutor_id", enrollmentData.assigned_tutor_id)
            .eq("type", sessionType)
            .order("updated_at", { ascending: false })
            .order("created_at", { ascending: false });

          if (fallback.data && fallback.data.length > 0) {
            allSessions = fallback.data as any;
            allSessionsError = fallback.error as any;
          }
        }
        // Use the most recent session if any
        const session = allSessions && allSessions.length > 0 ? allSessions[0] : null;
        const sessionError = allSessionsError;
        if (sessionError) {
          console.error("[intro-session-confirmation] session lookup failed", {
            userId,
            tutorId: enrollmentData.assigned_tutor_id,
            studentId: assignedStudent?.id || enrollmentData.assigned_student_id || null,
            code: sessionError.code,
            message: sessionError.message,
            details: sessionError.details,
          });
        }

        if (sessionError || !session) {
          // No intro session exists yet. If the parent is assigned, allow booking.
          if (enrollmentData.status === "assigned") {
            return res.json({
              status: "not_scheduled",
              operationalMode,
              introCompleted: false,
              type: sessionType,
              sessionLabel,
            });
          }
          return res.json({ status: "not_scheduled", operationalMode, type: sessionType, sessionLabel });
        }

        const assignedStudentWorkflow = assignedStudent
          ? (assignedStudent.personalProfile as any)?.workflow || {}
          : {};
        const introCompleted = !!assignedStudentWorkflow.introCompletedAt;

        const effectiveStatus = getEffectiveScheduledSessionStatus(session);

        const responseObj = {
          id: session.id,
          status: effectiveStatus,
          operationalMode,
          type: session.type,
          sessionLabel,
          scheduled_time: session.scheduled_time,
          scheduled_end: session.scheduled_end,
          timezone: session.timezone,
          parent_confirmed: session.parent_confirmed,
          tutor_confirmed: session.tutor_confirmed,
          introCompleted,
          debug: {
            parent_id: session.parent_id,
            tutor_id: session.tutor_id,
            type: session.type,
            session_status: session.status,
          },
        };
        return res.json(responseObj);
      } catch (error) {
        console.error("Error in intro-session-confirmation:", error);
        return res.json({
          status: "not_scheduled",
          operationalMode: "training",
          degraded: true,
        });
      }
    });

  app.post("/api/parent/intro-session-confirm", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser.id;
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "Missing sessionId" });
      }

      const parentSessionResult: any = await supabase
        .from("scheduled_sessions")
        .select(SCHEDULED_SESSION_SELECT)
        .eq("id", sessionId)
        .maybeSingle();
      const { data: session, error: sessionError } = parentSessionResult;

      if (sessionError || !session) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (session.parent_id !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const effectiveStatus = getEffectiveScheduledSessionStatus(session);
      if (effectiveStatus !== "pending_parent_confirmation") {
        return res.status(400).json({ message: "Session is not waiting for parent confirmation" });
      }

      const updatedParentSessionResult: any = await supabase
        .from("scheduled_sessions")
        .update({
          parent_confirmed: true,
          tutor_confirmed: true,
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .select(SCHEDULED_SESSION_SELECT)
        .single();
      const { data: updatedSession, error: updateError } = updatedParentSessionResult;

      if (updateError) {
        console.error("Failed to confirm intro session:", updateError);
        return res.status(500).json({ message: "Failed to confirm session" });
      }

      const introParent = updatedSession?.parent_id ? await storage.getUser(updatedSession.parent_id) : null;
      const introParentName = getDisplayNameForUser(introParent, "Parent");

      await safeSendPush(
        updatedSession?.tutor_id,
        {
          title: `Session confirmed by ${introParentName}`,
          body: `${introParentName} confirmed the ${getSessionDisplayLabel(updatedSession?.type)}. Open Response Integrity for the latest schedule.`,
          url: "/operational/tutor/pod",
          tag: `tutor-intro-session-confirmed-${sessionId}`,
        },
        "tutor intro session confirmed by parent",
      );

      try {
        const parent = updatedSession?.parent_id ? await storage.getUser(updatedSession.parent_id) : null;
        const parentName = getDisplayNameForUser(parent, "Parent");
        const notificationPayload: any = {
          recipientUserId: updatedSession?.tutor_id,
          actorUserId: userId,
          channel: "informational",
          title: `Session confirmed by ${parentName}`,
          message: `${parentName} confirmed the ${getSessionDisplayLabel(updatedSession?.type)}. Open Response Integrity for the latest schedule.`,
          link: "/operational/tutor/pod",
          entityType: "scheduled_session",
          entityId: sessionId,
        };

        await storage.createNotification(notificationPayload);
      } catch (error) {
        console.error("Failed to create tutor intro-session confirmation notification:", error);
      }

      if (String(updatedSession?.type || "").toLowerCase() === "handover") {
        await supabase
          .from("parent_enrollments")
          .update({ current_step: "handover_session_confirmed", updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("assigned_tutor_id", updatedSession?.tutor_id || null);
      }

      res.json({
        success: true,
        status: "confirmed",
      });
    } catch (error) {
      console.error("Error confirming intro session:", error);
      res.status(500).json({ message: "Failed to confirm session" });
    }
  });

  // Simple health check to verify JSON responses and CORS
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ========================================
  // AUTH ROUTES
  // ========================================

  // User endpoint is now handled by setupAuth in supabaseAuth.ts

  // Verify role authorization for email
  app.post("/api/auth/verify-role", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        role: z.enum(["tutor", "td", "coo", "od"]),
      });
      const { email, role } = schema.parse(req.body);
      
      const isAuthorized = await storage.checkRoleAuthorization(email, role);
      
      if (!isAuthorized) {
        return res.status(403).json({ 
          valid: false, 
          error: "Email not authorized for this role" 
        });
      }
      
      res.json({ valid: true, role });
    } catch (error) {
      console.error("Error verifying role:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Check if TD has pod assignment
  app.get("/api/auth/check-td-assignment", async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ message: "Email required" });
      }
      
      const podId = await storage.checkTDPodAssignment(email);
      res.json({ hasPod: !!podId, podId });
    } catch (error) {
      console.error("Error checking TD assignment:", error);
      res.status(500).json({ message: "Failed to check TD assignment" });
    }
  });

  // Assign role permission (dev-only for now)
  app.post("/api/auth/assign-role", async (req: Request, res: Response) => {
    try {
      const permission = roleAuthorizationSchema.parse(req.body);
      if (permission.role === "od" && !isAllowedOdEmail(permission.email)) {
        return res.status(403).json({
          message: `Only approved OD emails can be assigned the OD role: ${getAllowedOdEmailList()}`,
        });
      }
      await storage.addRolePermission(permission as any);
      res.json({ success: true, permission });
    } catch (error) {
      console.error("Error assigning role:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // ========================================
  // TUTOR ROUTES
  // ========================================
    const buildTutorOnboardingStatuses = (rawStatuses: any) => ({
      "1": "pending_upload",
      "2": "not_started",
      "3": "not_started",
      "4": "not_started",
      "5": "not_started",
      "6": "not_started",
      ...(rawStatuses && typeof rawStatuses === "object" ? rawStatuses : {}),
    });

    const deriveTutorGatewayApplicationStatus = (latestApp: any) => {
      const documentsStatus = buildTutorOnboardingStatuses(latestApp?.documentsStatus || latestApp?.documents_status);
      const allSequentialDocumentsApproved = ["1", "2", "3", "4", "5", "6"].every(
        (step) => String(documentsStatus[step] || "") === "approved"
      );
      const hasPendingReview = ["2", "6"].some(
        (step) => String(documentsStatus[step] || "") === "pending_review"
      );
      const hasRejectedUpload = ["2", "6"].some(
        (step) => String(documentsStatus[step] || "") === "rejected"
      );
      let status = latestApp.status;

      if (allSequentialDocumentsApproved) {
        status = "confirmed";
      } else if (status === "approved" && (hasPendingReview || hasRejectedUpload)) {
        status = "verification";
      }

      return {
        ...latestApp,
        status,
        applicationId: latestApp.id,
        isUnder18: latestApp.age < 18,
        documentSubmissionStep: latestApp.documentSubmissionStep || latestApp.document_submission_step || 1,
        documentsStatus,
        onboardingCompletedAt: latestApp.onboardingCompletedAt ?? latestApp.onboarding_completed_at ?? null,
      };
    };

    const INITIAL_EGP_DOCUMENT_STATUSES = {
      "1": "pending_upload",
      "2": "not_started",
      "3": "not_started",
      "4": "not_started",
      "5": "not_started",
    };

    const buildEgpOnboardingStatuses = (rawStatuses: any) => ({
      ...INITIAL_EGP_DOCUMENT_STATUSES,
      ...(rawStatuses && typeof rawStatuses === "object" ? rawStatuses : {}),
    });

    const deriveEgpGatewayApplicationStatus = (latestApp: any) => {
      const documentsStatus = buildEgpOnboardingStatuses(latestApp?.documentsStatus || latestApp?.documents_status);
      const allApproved = ["1", "2", "3", "4", "5"].every(
        (step) => String(documentsStatus[step] || "") === "approved"
      );

      return {
        ...latestApp,
        status: allApproved ? "confirmed" : latestApp.status,
        applicationId: latestApp.id,
        documentSubmissionStep: latestApp.documentSubmissionStep || latestApp.document_submission_step || 1,
        documentsStatus,
        onboardingCompletedAt: latestApp.onboardingCompletedAt ?? latestApp.onboarding_completed_at ?? null,
      };
    };

    const buildAffiliateAcceptanceMap = (acceptanceRows: any[]) =>
      acceptanceRows.reduce<Record<string, any>>((accumulator, row) => {
        const key = String(row.document_step || row.documentStep);
        if (!accumulator[key]) {
          accumulator[key] = row;
        }
        return accumulator;
      }, {});

    const hydrateAffiliateApplications = async (rows: any[]) => {
      if (!rows.length) return [];

      const applicationIds = rows.map((row) => row.id).filter(Boolean);
      const { data: acceptances, error: acceptanceError } = await supabase
        .from("affiliate_onboarding_acceptances")
        .select("*")
        .in("application_id", applicationIds)
        .order("accepted_at", { ascending: false });

      if (acceptanceError) {
        console.error("Error hydrating affiliate onboarding acceptances:", acceptanceError);
      }

      const acceptancesByApplication = new Map<string, any[]>();
      for (const row of acceptances || []) {
        const appId = String(row.application_id);
        const current = acceptancesByApplication.get(appId) || [];
        current.push(row);
        acceptancesByApplication.set(appId, current);
      }

      return rows.map((row) => {
        const acceptanceRows = acceptancesByApplication.get(String(row.id)) || [];
        return {
          ...row,
          onboardingAcceptances: acceptanceRows,
          onboardingAcceptanceMap: buildAffiliateAcceptanceMap(acceptanceRows),
        };
      });
    };

    const getAffiliateApplicationsByQuery = async (query: { userId?: string; status?: string } = {}) => {
      let builder = supabase.from("affiliate_applications").select("*").order("created_at", { ascending: false });

      if (query.userId) {
        builder = builder.eq("user_id", query.userId);
      }
      if (query.status) {
        builder = builder.eq("status", query.status);
      }

      const { data, error } = await builder;
      if (error) {
        throw new Error(`Failed to fetch affiliate applications: ${error.message}`);
      }

      return hydrateAffiliateApplications(data || []);
    };

    const selectCanonicalAffiliateApplication = (applications: any[]) => {
      if (!applications.length) return null;

      const priority = ["confirmed", "approved", "pending", "rejected"];
      for (const status of priority) {
        const match = applications.find((application) => String(application.status || "").toLowerCase() === status);
        if (match) return match;
      }

      return applications[0];
    };

    const getCurrentEgpStepFromStatuses = (statuses: Record<string, string>) => {
      for (let step = 1; step <= 5; step += 1) {
        if (String(statuses[String(step)] || "not_started") !== "approved") {
          return step;
        }
      }
      return 5;
    };

    const inferDeviceType = (userAgent: string | undefined) => {
      const normalized = String(userAgent || "").toLowerCase();
      if (!normalized) return "unknown";
      if (/mobile|iphone|android/.test(normalized)) return "mobile";
      if (/ipad|tablet/.test(normalized)) return "tablet";
      return "desktop";
    };

    const extractRequestIp = (req: Request) => {
      const forwarded = req.headers["x-forwarded-for"];
      if (Array.isArray(forwarded)) {
        return forwarded[0] || req.ip || null;
      }
      if (typeof forwarded === "string") {
        return forwarded.split(",")[0]?.trim() || req.ip || null;
      }
      return req.ip || null;
    };

    const INITIAL_TD_DOCUMENT_STATUSES = {
      "1": "pending_upload",
      "2": "not_started",
      "3": "not_started",
      "4": "not_started",
      "5": "not_started",
      "6": "not_started",
      "7": "not_started",
    };

    const buildTdOnboardingStatuses = (rawStatuses: any) => ({
      ...INITIAL_TD_DOCUMENT_STATUSES,
      ...(rawStatuses && typeof rawStatuses === "object" ? rawStatuses : {}),
    });

    const deriveTdGatewayApplicationStatus = (latestApp: any) => {
      const documentsStatus = buildTdOnboardingStatuses(latestApp?.documentsStatus || latestApp?.documents_status);
      const allApproved = ["1", "2", "3", "4", "5", "6", "7"].every(
        (step) => String(documentsStatus[step] || "") === "approved"
      );

      return {
        ...latestApp,
        status: allApproved ? "confirmed" : latestApp.status,
        applicationId: latestApp.id,
        documentSubmissionStep: latestApp.documentSubmissionStep || latestApp.document_submission_step || 1,
        documentsStatus,
        onboardingCompletedAt: latestApp.onboardingCompletedAt ?? latestApp.onboarding_completed_at ?? null,
      };
    };

    const selectCanonicalTdApplication = (applications: any[]) => {
      if (!applications.length) return null;

      const priority = ["confirmed", "approved", "pending", "rejected"];
      for (const status of priority) {
        const match = applications.find((application) => String(application.status || "").toLowerCase() === status);
        if (match) return match;
      }

      return applications[0];
    };

    const getCurrentTdStepFromStatuses = (statuses: Record<string, string>) => {
      for (let step = 1; step <= 7; step += 1) {
        if (String(statuses[String(step)] || "not_started") !== "approved") {
          return step;
        }
      }
      return 7;
    };

    const buildTdAcceptanceMap = (acceptanceRows: any[]) =>
      acceptanceRows.reduce<Record<string, any>>((accumulator, row) => {
        const key = String(row.document_step || row.documentStep);
        if (!accumulator[key]) {
          accumulator[key] = row;
        }
        return accumulator;
      }, {});

    const hydrateTdApplications = async (rows: any[]) => {
      if (!rows.length) return [];

      const applicationIds = rows.map((row) => row.id).filter(Boolean);
      const { data: acceptances, error: acceptanceError } = await supabase
        .from("td_onboarding_acceptances")
        .select("*")
        .in("application_id", applicationIds)
        .order("accepted_at", { ascending: false });

      if (acceptanceError) {
        console.error("Error hydrating TD onboarding acceptances:", acceptanceError);
      }

      const acceptancesByApplication = new Map<string, any[]>();
      for (const row of acceptances || []) {
        const appId = String(row.application_id);
        const current = acceptancesByApplication.get(appId) || [];
        current.push(row);
        acceptancesByApplication.set(appId, current);
      }

      return rows.map((row) => {
        const acceptanceRows = acceptancesByApplication.get(String(row.id)) || [];
        return {
          ...row,
          onboardingAcceptances: acceptanceRows,
          onboardingAcceptanceMap: buildTdAcceptanceMap(acceptanceRows),
        };
      });
    };

    const getTdApplicationsByQuery = async (query: { userId?: string; status?: string } = {}) => {
      let builder = supabase.from("td_applications").select("*").order("created_at", { ascending: false });

      if (query.userId) {
        builder = builder.eq("user_id", query.userId);
      }
      if (query.status) {
        builder = builder.eq("status", query.status);
      }

      const { data, error } = await builder;
      if (error) {
        throw new Error(`Failed to fetch TD applications: ${error.message}`);
      }

      return hydrateTdApplications(data || []);
    };

    // Aggregated gateway session endpoint
    app.get(
      "/api/tutor/gateway-session",
      isAuthenticated,
      requireRole(["tutor"]),
      async (req: Request, res: Response) => {
        try {
          const tutorId = (req as any).dbUser.id;
          const dbUser = (req as any).dbUser;
          // Fetch assignment
          const assignment = await storage.getTutorAssignment(tutorId);
          // Fetch students
          const students = await storage.getStudentsByTutor(tutorId);
          const sessions = await getTutorSessionFeed(tutorId);
          // Fetch academic profile (verification status)
          const profile = await storage.getAcademicProfile(tutorId);
          // Fetch province (assuming it's in dbUser or profile)
          const province = (dbUser as any)?.province || (profile as any)?.province || null;
          // Role
          const role = dbUser?.role || "tutor";
          // Enrollment status (from parent_enrollments)
          const { data: enrollments } = await supabase
            .from("parent_enrollments")
            .select("status")
            .eq("assigned_tutor_id", tutorId);
          const enrollmentStatus = enrollments && enrollments.length > 0 ? enrollments[0].status : null;
          // Verification status (from profile)
          const verificationStatus = (profile as any)?.verified || false;

          // Fetch tutor application status and onboarding progress
          const tutorApplications = await storage.getTutorApplicationsByUser(tutorId);
          const latestApp = tutorApplications && tutorApplications.length > 0 ? tutorApplications[0] : null;
          let applicationStatus = null;
          if (latestApp) {
            applicationStatus = deriveTutorGatewayApplicationStatus(latestApp);
          }
    // Add route for singular 'student' to match frontend
    app.get(
      "/api/tutor/student/:studentId/intro-session-details",
      isAuthenticated,
      requireRole(["tutor"]),
      async (req: Request, res: Response) => {
        try {
          const { studentId } = req.params;
          const dbUser = (req as any).dbUser;
          // Try to find student by ID
          let student = null;
          let parentId = null;
          try {
            student = await storage.getStudent(studentId);
          } catch {}
          if (student) {
            parentId = (student as any).parentId;
            // If student exists, check tutor ownership
            if (student.tutorId !== dbUser.id) {
              return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
            }
          } else {
            // If student does not exist, try to fetch parentId from DB
            const studentRow = await supabase
              .from("students")
              .select("parent_id")
              .eq("id", studentId)
              .maybeSingle();
            parentId = studentRow.data?.parent_id;
          }
          // Try to find intro session by student_id first (if student exists)
          let session = null;
          let sessionError = null;
          if (student) {
            const result = await supabase
              .from("scheduled_sessions")
              .select("id, scheduled_time, status, parent_confirmed, tutor_confirmed, created_at, updated_at, tutor_id, student_id, parent_id, type")
              .eq("tutor_id", dbUser.id)
              .eq("student_id", studentId)
              .eq("type", "intro")
              .order("created_at", { ascending: false })
              .maybeSingle();
            session = result.data;
            sessionError = result.error;
          }
          // Always try fallback: return intro session with student_id=null if the parentId matches
          if (!session && parentId) {
            const { data: introSession, error: introSessionError } = await supabase
              .from("scheduled_sessions")
              .select("id, scheduled_time, status, parent_confirmed, tutor_confirmed, created_at, updated_at, tutor_id, student_id, parent_id, type")
              .eq("tutor_id", dbUser.id)
              .eq("parent_id", parentId)
              .eq("type", "intro")
              .is("student_id", null)
              .order("created_at", { ascending: false })
              .maybeSingle();
            if (introSession) {
              session = introSession;
            }
          }
          console.log("[DEBUG] intro-session-details query result (with fallback):", { session, sessionError, tutorId: dbUser.id, studentId, parentId });
          if (sessionError) {
            console.error("[DEBUG] intro-session-details sessionError:", sessionError);
            return res.status(500).json({ message: "Failed to fetch intro session details", details: sessionError });
          }
          if (!session) {
            return res.json({ status: "not_scheduled" });
          }
          res.json({
            id: session.id,
            scheduled_time: session.scheduled_time,
            status: session.status,
            parent_confirmed: session.parent_confirmed,
            tutor_confirmed: session.tutor_confirmed,
            created_at: session.created_at,
            updated_at: session.updated_at,
            debug: {
              tutor_id: session.tutor_id,
              student_id: session.student_id,
              parent_id: session.parent_id,
              type: session.type
            }
          });
        } catch (error) {
          console.error("[DEBUG] Error fetching intro session details:", error);
          res.status(500).json({ message: "Failed to fetch intro session details", details: error });
        }
      }
    );

          // Compose unified session object
          const gatewaySession = {
            assignment,
            students,
            sessions,
            profile,
            province,
            role,
            enrollmentStatus,
            verificationStatus,
            applicationStatus,
          };
          res.json(gatewaySession);
        } catch (error) {
          console.error("Error fetching gateway session:", error);
          res.status(500).json({ message: "Failed to fetch gateway session" });
        }
      }
    );

  // Get tutor's pod assignment and students
  const TOPIC_LABELS: Record<string, string> = {
    word_problems: "Word problems",
    tests: "Tests",
    timed_work: "Timed work",
    new_topics: "New topics",
    careless_errors: "Careless errors",
  };
  const NON_TOPIC_CONTEXT_LABELS = new Set(
    Object.values(TOPIC_LABELS).map((value) => value.toLowerCase().trim())
  );

  const parseTopicText = (value: unknown): string[] => {
    if (!value || typeof value !== "string") return [];
    return value
      .split(/[\n,;|]+/)
      .map((part) => part.replace(/^[-*\u2022\s]+/, "").trim())
      .filter(Boolean);
  };

  const parseStructuredTopics = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((topic) => String(topic || "").trim())
      .filter(Boolean);
  };

  const buildReportedTopics = (
    topicResponseSymptomsOrIds: unknown,
    structuredTopics: unknown,
    topicRecommendations?: unknown
  ): string[] => {
    const structuredTopicKeys =
      topicResponseSymptomsOrIds && typeof topicResponseSymptomsOrIds === "object"
        ? Object.keys(topicResponseSymptomsOrIds as Record<string, unknown>)
            .map((topic) => String(topic || "").trim())
            .filter(Boolean)
        : [];
    const recommendationTopicKeys =
      topicRecommendations && typeof topicRecommendations === "object"
        ? Object.keys(topicRecommendations as Record<string, unknown>)
            .map((topic) => String(topic || "").trim())
            .filter(Boolean)
        : [];
    const directlyReportedTopics = parseStructuredTopics(structuredTopics);
    return Array.from(
      new Set(
        [...structuredTopicKeys, ...recommendationTopicKeys, ...directlyReportedTopics].filter(
          (topic) => !NON_TOPIC_CONTEXT_LABELS.has(topic.toLowerCase().trim())
        )
      )
    );
  };

  const buildIntakeSignals = (enrollment: any) => {
    const topicResponseSymptoms =
      enrollment?.topic_response_symptoms && typeof enrollment.topic_response_symptoms === "object"
        ? Object.fromEntries(
            Object.entries(enrollment.topic_response_symptoms as Record<string, unknown>)
              .map(([topic, symptomIds]) => [topic, normalizeResponseSymptoms(symptomIds)])
              .filter(([topic, symptomIds]) => String(topic || "").trim().length > 0 && (symptomIds as string[]).length > 0)
          )
        : {};
    const topicRecommendedStartingPhases =
      enrollment?.topic_recommended_starting_phases && typeof enrollment.topic_recommended_starting_phases === "object"
        ? enrollment.topic_recommended_starting_phases
        : {};
    const reportedTopics = buildReportedTopics(
      topicResponseSymptoms,
      enrollment?.reported_topics,
      topicRecommendedStartingPhases
    );
    const normalizedSymptoms = normalizeResponseSymptoms(enrollment?.response_symptoms);
    const topicDerivedSymptomIds = Array.from(
      new Set(Object.values(topicResponseSymptoms).flat())
    ) as string[];
    const effectiveSymptoms: string[] = topicDerivedSymptomIds.length > 0 ? topicDerivedSymptomIds : normalizedSymptoms;
    const recommendation = recommendStartingPhaseFromSymptoms(effectiveSymptoms);
    const recommendedStartingPhase =
      tryParsePhase(enrollment?.recommended_starting_phase) || recommendation.phase;
    return {
      reported_topics: reportedTopics,
      response_symptoms: getResponseSymptomLabels(effectiveSymptoms),
      response_symptom_ids: effectiveSymptoms,
      topic_response_symptoms: Object.fromEntries(
        Object.entries(topicResponseSymptoms).map(([topic, symptomIds]) => [topic, getResponseSymptomLabels(symptomIds as string[])])
      ),
      topic_response_symptom_ids: topicResponseSymptoms,
      response_signal_scores: enrollment?.response_signal_scores || recommendation.scores,
      topic_response_signal_scores:
        enrollment?.topic_response_signal_scores && typeof enrollment.topic_response_signal_scores === "object"
          ? enrollment.topic_response_signal_scores
          : {},
      recommended_starting_phase: recommendedStartingPhase,
      topic_recommended_starting_phases: topicRecommendedStartingPhases,
      recommended_starting_reason: buildStartingPhaseRationale(
        recommendedStartingPhase,
        recommendation.supportingSymptoms
      ),
      diagnostic_focus: {
        start_with: reportedTopics[0] || null,
        watch_for: getResponseSymptomLabels(effectiveSymptoms).slice(0, 2),
      },
    };
  };

  const buildTopicConditioningMap = (proposal: any) => {
    if (!proposal) return null;

    const normalizePhase = (raw: string | null | undefined) => {
      const value = String(raw || "").trim();
      const lower = value.toLowerCase();
      if (!value) return null;
      if (lower.includes("clarity")) return "Clarity";
      if (lower.includes("structured")) return "Structured Execution";
      if (lower.includes("discomfort")) return "Controlled Discomfort";
      if (lower.includes("time") || lower.includes("pressure")) return "Time Pressure Stability";
      return null;
    };

    const normalizeStability = (raw: string | null | undefined) => {
      const value = String(raw || "").trim().toLowerCase();
      if (!value) return null;
      if (value.includes("high maintenance")) return "High Maintenance";
      if (value.includes("high")) return "High";
      if (value.includes("medium")) return "Medium";
      if (value.includes("low")) return "Low";
      return null;
    };

    const sanitizeTopic = (raw: string | null | undefined) => {
      const value = String(raw || "").trim();
      if (!value) return null;
      if (value.toLowerCase() === "onboarding baseline diagnostic") return null;
      return value;
    };

    const topic = sanitizeTopic(proposal.topic_conditioning_topic || proposal.current_topics || "");
    const noteText = String(proposal.tutor_notes || "");
    const justificationText = String(proposal.justification || "");

    const phaseFromNotes =
      noteText.match(/Training Entry Phase:\s*([^\n\r]+)/i)?.[1]?.trim() ||
      noteText.match(/Entry Phase:\s*([^\n\r]+)/i)?.[1]?.trim();
    const phaseFromJustification = justificationText.match(/Entry phase\s*([^|\.]+)/i)?.[1]?.trim();
    const stabilityFromNotes = noteText.match(/Stability:\s*([^\n\r]+)/i)?.[1]?.trim();
    const stabilityFromJustification = justificationText.match(/Stability\s*([^|\.]+)/i)?.[1]?.trim();

    const phase =
      normalizePhase(proposal.topic_conditioning_entry_phase) ||
      normalizePhase(phaseFromNotes) ||
      normalizePhase(phaseFromJustification) ||
      null;
    const stability =
      normalizeStability(proposal.topic_conditioning_stability) ||
      normalizeStability(stabilityFromNotes) ||
      normalizeStability(stabilityFromJustification) ||
      null;

    if (!topic && !phase && !stability) return null;
    return {
      topic: topic || null,
      entry_phase: phase,
      stability,
    };
  };

  app.get(
    "/api/tutor/pod",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const assignment = await storage.getTutorAssignment(tutorId);
        if (!assignment) {
          return res.json({ assignment: null, students: [] });
        }

        const certificationMode = await getTutorCertificationMode(tutorId);
        const { data: assignedEnrollments, error: assignedEnrollmentsError } =
          await loadTutorAssignedEnrollments(tutorId, {
            sandboxOnly: certificationMode === "sandbox",
            ordered: true,
          });

        if (assignedEnrollmentsError) {
          console.error("Error loading assigned enrollments for pod:", assignedEnrollmentsError);
          return res.status(500).json({ message: "Failed to load assigned enrollments" });
        }

        let students = await hydrateStudentsWithSessionProgress(tutorId, await storage.getStudentsByTutor(tutorId));
        if (certificationMode === "sandbox") {
          const sandboxEnrollmentIds = new Set(
            (assignedEnrollments || []).map((enrollment: any) => String(enrollment?.id || "").trim()).filter(Boolean)
          );
          students = students.filter((student: any) => {
            const parentEnrollmentId = String(
              (student as any)?.parentEnrollmentId || (student as any)?.parent_enrollment_id || ""
            ).trim();
            const parentContact = String((student as any)?.parentContact || (student as any)?.parent_contact || "").trim().toLowerCase();
            const studentName = String(student?.name || "").trim().toLowerCase();

            if (parentEnrollmentId && sandboxEnrollmentIds.has(parentEnrollmentId)) {
              return true;
            }

            return (
              parentContact.startsWith(`sandbox-parent-${String(tutorId).trim().toLowerCase()}-`) ||
              studentName.startsWith("sandbox ")
            );
          });
        }
        const studentsById = new Map(
          students
            .filter((student: any) => !!student?.id)
            .map((student: any) => [String(student.id), student])
        );
        const studentsByEnrollmentId = new Map(
          students
            .filter((student: any) => !!((student as any)?.parentEnrollmentId || (student as any)?.parent_enrollment_id))
            .map((student: any) => [
              String((student as any).parentEnrollmentId || (student as any).parent_enrollment_id),
              student,
            ])
        );

        let canonicalStudents = (assignedEnrollments || [])
          .map((enrollment: any) => {
            const assignedStudentId = String(enrollment?.assigned_student_id || "").trim();
            const enrollmentId = String(enrollment?.id || "").trim();
            const studentFromAssignedId = assignedStudentId ? studentsById.get(assignedStudentId) : null;
            const assignedStudentEnrollmentId = String(
              (studentFromAssignedId as any)?.parentEnrollmentId ||
              (studentFromAssignedId as any)?.parent_enrollment_id ||
              ""
            ).trim();

            const canonicalStudentFromAssignedId =
              studentFromAssignedId &&
              (!enrollmentId || !assignedStudentEnrollmentId || assignedStudentEnrollmentId === enrollmentId)
                ? studentFromAssignedId
                : null;

            const canonicalStudent =
              canonicalStudentFromAssignedId ||
              (enrollmentId ? studentsByEnrollmentId.get(enrollmentId) : null) ||
              null;

            if (!canonicalStudent) return null;

            if (
              enrollmentId &&
              canonicalStudent?.id &&
              String(enrollment?.assigned_student_id || "").trim() !== String(canonicalStudent.id || "").trim()
            ) {
              void supabase
                .from("parent_enrollments")
                .update({ assigned_student_id: canonicalStudent.id, updated_at: new Date().toISOString() })
                .eq("id", enrollment.id);
            }

            return {
              student: canonicalStudent,
              enrollment,
            };
          })
          .filter((entry): entry is { student: any; enrollment: any } => !!entry)
          .filter((entry, index, arr) => {
            const studentId = String(entry.student.id || "");
            return arr.findIndex((candidate) => String(candidate.student.id || "") === studentId) === index;
          });

        if (certificationMode !== "sandbox" && canonicalStudents.length === 0 && students.length > 0) {
          const unmatchedEnrollments = [...(assignedEnrollments || [])];
          canonicalStudents = students.map((student: any) => {
            const explicitEnrollmentId = String(
              (student as any)?.parentEnrollmentId || (student as any)?.parent_enrollment_id || ""
            ).trim();
            const studentParentId = String((student as any)?.parentId || (student as any)?.parent_id || "").trim();
            const studentParentContact = String((student as any)?.parentContact || (student as any)?.parent_contact || "").trim().toLowerCase();
            const studentName = String(student?.name || "").trim().toLowerCase();

            let matchedEnrollment =
              (explicitEnrollmentId
                ? unmatchedEnrollments.find((enrollment: any) => String(enrollment?.id || "").trim() === explicitEnrollmentId)
                : null) ||
              unmatchedEnrollments.find((enrollment: any) => {
                const enrollmentUserId = String(enrollment?.user_id || "").trim();
                const enrollmentParentEmail = String(enrollment?.parent_email || "").trim().toLowerCase();
                const enrollmentStudentName = String(enrollment?.student_full_name || "").trim().toLowerCase();

                if (studentParentId && enrollmentUserId && studentParentId === enrollmentUserId) {
                  return !studentName || !enrollmentStudentName || studentName === enrollmentStudentName;
                }

                if (studentParentContact && enrollmentParentEmail && studentParentContact === enrollmentParentEmail) {
                  return !studentName || !enrollmentStudentName || studentName === enrollmentStudentName;
                }

                return false;
              }) ||
              unmatchedEnrollments[0] ||
              null;

            if (matchedEnrollment) {
              unmatchedEnrollments.splice(unmatchedEnrollments.indexOf(matchedEnrollment), 1);
            }

            return {
              student,
              enrollment: matchedEnrollment,
            };
          });
        }

        // Fetch parent enrollment info for each canonical student
        const studentsWithParentInfo = await Promise.all(
          canonicalStudents.map(async ({ student, enrollment }: { student: any; enrollment: any }, index) => {
            try {
              let parentEnrollment = enrollment;
              const sandboxDisplayOrdinal = certificationMode === "sandbox" ? index + 1 : null;
              const sandboxDisplayStudentName = sandboxDisplayOrdinal
                ? `Sandbox Student ${sandboxDisplayOrdinal}`
                : student.name;
              const sandboxDisplayParentName = sandboxDisplayOrdinal
                ? `Sandbox Parent ${sandboxDisplayOrdinal}`
                : parentEnrollment?.parent_full_name || null;

              const missingCanonicalResponseSignals = !!(
                parentEnrollment &&
                isSandboxLikeEnrollment(parentEnrollment, tutorId) &&
                (
                  normalizeResponseSymptoms(parentEnrollment.response_symptoms).length === 0 ||
                  !parentEnrollment.topic_response_symptoms ||
                  typeof parentEnrollment.topic_response_symptoms !== "object" ||
                  Object.keys(parentEnrollment.topic_response_symptoms || {}).length === 0
                )
              );

              if (missingCanonicalResponseSignals) {
                const sandboxCase = buildSandboxEnrollmentCase(index, parentEnrollment);
                const canonicalSignalUpdate = {
                  response_symptoms: sandboxCase.responseSymptoms,
                  topic_response_symptoms: sandboxCase.topicResponseSymptoms,
                  response_signal_scores: sandboxCase.responseSignalScores,
                  topic_response_signal_scores: sandboxCase.topicResponseSignalScores,
                  recommended_starting_phase: sandboxCase.recommendedStartingPhase,
                  topic_recommended_starting_phases: sandboxCase.topicRecommendedStartingPhases,
                  previous_tutoring: parentEnrollment?.previous_tutoring || sandboxCase.previousTutoring,
                  parent_motivation: parentEnrollment?.parent_motivation || sandboxCase.parentMotivation,
                  updated_at: new Date().toISOString(),
                };

                const { data: updatedEnrollment, error: canonicalSignalError } = await supabase
                  .from("parent_enrollments")
                  .update(canonicalSignalUpdate)
                  .eq("id", parentEnrollment.id)
                  .select("*")
                  .single();

                if (canonicalSignalError) {
                  console.error("Failed to backfill canonical sandbox response signals:", canonicalSignalError);
                } else if (updatedEnrollment) {
                  parentEnrollment = updatedEnrollment;
                } else {
                  parentEnrollment = {
                    ...parentEnrollment,
                    ...canonicalSignalUpdate,
                  };
                }
              }

              // Check if proposal was accepted by querying the proposal table
              let proposalAcceptedAt = null;
              let proposalSnapshot: any = null;
              if (parentEnrollment?.proposal_id) {
                const { data: proposal } = await supabase
                  .from("onboarding_proposals")
                  .select("accepted_at, current_topics, topic_conditioning_topic, topic_conditioning_entry_phase, topic_conditioning_stability, justification, tutor_notes")
                  .eq("id", parentEnrollment.proposal_id)
                  .single();
                proposalSnapshot = proposal || null;
                proposalAcceptedAt = proposal?.accepted_at || null;
              }

              // Alternative: check if enrollment status is beyond proposal_sent (session_booked or later)
              const isApproved = parentEnrollment &&
                (proposalAcceptedAt ||
                 ["session_booked", "report_received", "confirmed"].includes(parentEnrollment.status));

              // Check if assignment is pending: enrollment status is awaiting_tutor_acceptance AND workflow hasn't accepted yet
              const workflowState = (student as any)?.personalProfile?.workflow || {};
              const enrollmentPending = parentEnrollment?.status === "awaiting_tutor_acceptance";
              const workflowAccepted = !!workflowState.assignmentAcceptedAt;
              const isPending = enrollmentPending && !workflowAccepted;

              return {
                ...student,
                name: sandboxDisplayStudentName,
                enrollmentId: parentEnrollment?.id || null,
                parentInfo: parentEnrollment
                  ? {
                      ...parentEnrollment,
                      parent_full_name: sandboxDisplayParentName,
                      student_full_name: sandboxDisplayStudentName,
                      ...buildIntakeSignals(parentEnrollment),
                    }
                  : null,
                topicConditioning: buildTopicConditioningMap(proposalSnapshot),
                proposalSentAt: parentEnrollment?.proposal_sent_at || null,
                parentApprovedAt: isApproved ? (proposalAcceptedAt || parentEnrollment?.updated_at) : null,
                pendingTutorAcceptance: isPending,
              };
            } catch (err) {
              const workflowState = (student as any)?.personalProfile?.workflow || {};
              return {
                ...student,
                parentInfo: null,
                topicConditioning: null,
                proposalSentAt: null,
                parentApprovedAt: null,
                pendingTutorAcceptance: !workflowState.assignmentAcceptedAt,
              };
            }
          })
        );
        
        res.json({ assignment, students: studentsWithParentInfo });

        void (async () => {
          try {
            const cleanupResult = await cleanupLegacyLiveEnrollmentsForNonLiveTutor(tutorId, certificationMode);

            if (certificationMode === "sandbox") {
              try {
                await ensureVisibleSandboxStudentsForTutor(
                  tutorId,
                  Math.max(3, cleanupResult.detachedCount || 0)
                );
              } catch (error) {
                console.error("Sandbox provisioning/backfill failed after tutor pod response:", error);
              }
            }

            const { data: maintenanceEnrollments } = await loadTutorAssignedEnrollments(tutorId, {
              sandboxOnly: certificationMode === "sandbox",
              ordered: false,
            });

            for (const enrollment of maintenanceEnrollments || []) {
              try {
                const ensuredStudent = await ensureStudentForEnrollment(enrollment, tutorId);
                if (ensuredStudent) {
                  console.log("Ensured student exists after pod response:", enrollment.student_full_name);
                }
              } catch (err) {
                console.error("Error creating student from enrollment after pod response:", err);
              }
            }
          } catch (error) {
            console.error("Deferred tutor pod maintenance failed:", error);
          }
        })();
      } catch (error) {
        console.error("Error fetching pod:", error);
        res.status(500).json({ message: "Failed to fetch pod" });
      }
    }
  );

  app.get(
    "/api/tutor/pod-team",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const assignment = await storage.getTutorAssignment(tutorId);

        if (!assignment) {
          return res.json({
            pod: null,
            territoryDirector: null,
            members: [],
            memberCount: 0,
            capacity: 12,
          });
        }

        const assignments = await storage.getTutorAssignmentsByPod(assignment.podId);
        const members = await Promise.all(
          assignments.map(async (podAssignment: any) => {
            const tutor = await storage.getUser(podAssignment.tutorId);
            return {
              id: podAssignment.tutorId,
              assignmentId: podAssignment.id,
              name: tutor?.name || "Unknown Tutor",
              email: tutor?.email || "",
              phone: tutor?.phone || "",
              role: tutor?.role || "tutor",
              grade: tutor?.grade || null,
              school: tutor?.school || null,
              bio: tutor?.bio || null,
              profileImageUrl: tutor?.profileImageUrl || null,
              certificationStatus: podAssignment.certificationStatus || "pending",
            };
          })
        );

        const tdUser = assignment.pod.tdId
          ? await storage.getUser(assignment.pod.tdId)
          : null;

        return res.json({
          pod: {
            id: assignment.pod.id,
            podName: assignment.pod.podName,
          },
          territoryDirector: tdUser
            ? {
                id: tdUser.id,
                name: tdUser.name,
                email: tdUser.email,
                phone: tdUser.phone || "",
                bio: tdUser.bio || null,
                profileImageUrl: tdUser.profileImageUrl || null,
                role: tdUser.role || "td",
              }
            : null,
          members,
          memberCount: members.length,
          capacity: 12,
        });
      } catch (error) {
        console.error("Error fetching pod team:", error);
        return res.status(500).json({ message: "Failed to fetch pod team" });
      }
    }
  );

  // Provision sandbox accounts for tutor training (COO-controlled)
  app.post(
    "/api/coo/tutors/:tutorId/provision-sandbox-accounts",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { tutorId } = req.params;
        const { count = 3 } = req.body;
        const result = await autoProvisionSandboxAccountsForTutor(tutorId, Number(count) || 3);
        if (result.certificationMode !== "sandbox") {
          return res.status(400).json({
            message: `Tutor must be in sandbox mode to provision fake accounts. Current status: ${result.certificationMode}`,
          });
        }

        const reusedCount = result.createdAccounts.filter((account: any) => account.provisionAction === "reused").length;
        const createdCount = result.createdAccounts.length - reusedCount;

        res.json({
          message:
            reusedCount > 0
              ? `Prepared ${result.createdAccounts.length} sandbox accounts for tutor training (${createdCount} new, ${reusedCount} reused)`
              : `Created ${createdCount} sandbox accounts for tutor training`,
          accounts: result.createdAccounts,
        });
      } catch (error) {
        console.error("Error provisioning sandbox accounts:", error);
        res.status(500).json({ message: "Failed to provision sandbox accounts" });
      }
    }
  );

  // Backfill students from assigned parent_enrollments for the authenticated tutor
  // Useful in split deployments if automatic creation didn't run
  app.post(
    "/api/tutor/backfill-students",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const created: string[] = [];

        const { data: assignedEnrollments, error: enrollErr } = await supabase
          .from("parent_enrollments")
          .select("*")
          .eq("assigned_tutor_id", tutorId)
          .eq("status", "assigned");

        if (enrollErr) {
          return res.status(500).json({ message: "Failed to fetch enrollments" });
        }

        if (assignedEnrollments && assignedEnrollments.length > 0) {
          for (const enrollment of assignedEnrollments) {
            const { data: existingStudent } = await supabase
              .from("students")
              .select("id")
              .eq("name", enrollment.student_full_name)
              .eq("tutor_id", tutorId)
              .maybeSingle();

            if (!existingStudent) {
              const { error: insertErr } = await supabase
                .from("students")
                .insert({
                  name: enrollment.student_full_name,
                  grade: enrollment.student_grade,
                  tutor_id: tutorId,
                  session_progress: 0,
                  parent_contact: enrollment.parent_email,
                });
              if (!insertErr) {
                created.push(enrollment.student_full_name);
              }
            }
          }
        }

        res.json({ success: true, created });
      } catch (error) {
        console.error("Error backfilling students:", error);
        res.status(500).json({ message: "Failed to backfill students" });
      }
    }
  );

  // Get tutor's students
  app.get(
    "/api/tutor/students",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const students = await hydrateStudentsWithSessionProgress(tutorId, await storage.getStudentsByTutor(tutorId));
        res.json(students);
      } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ message: "Failed to fetch students" });
      }
    }
  );

  // Get tutor's sessions
  app.get(
    "/api/tutor/weekly-schedule",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const operationalMode = await getTutorOperationalMode(tutorId);
        const weekStartParam = String(req.query.weekStart || "").trim();

        const baseDate = weekStartParam ? new Date(`${weekStartParam}T00:00:00`) : new Date();
        if (Number.isNaN(baseDate.getTime())) {
          return res.status(400).json({ message: "Invalid weekStart" });
        }

        const weekStart = new Date(baseDate);
        const mondayOffset = (weekStart.getDay() + 6) % 7;
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - mondayOffset);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const { data: sessions, error } = await supabase
          .from("scheduled_sessions")
          .select("id, scheduled_time, scheduled_end, timezone, status, type, workflow_stage, parent_confirmed, tutor_confirmed, student_id, parent_id, google_meet_url, created_at, updated_at")
          .eq("tutor_id", tutorId)
          .gte("scheduled_time", weekStart.toISOString())
          .lte("scheduled_time", weekEnd.toISOString())
          .not("status", "in", '("cancelled","flagged")')
          .order("scheduled_time", { ascending: true });

        if (error) {
          console.error("Error fetching tutor weekly schedule:", error);
          return res.status(500).json({ message: "Failed to fetch tutor weekly schedule" });
        }

        const studentIds = Array.from(
          new Set((sessions || []).map((session: any) => String(session.student_id || "")).filter(Boolean))
        );

        const studentsById = new Map<string, { id: string; name: string; grade?: string | null }>();
        if (studentIds.length > 0) {
          const { data: students } = await supabase
            .from("students")
            .select("id, name, grade")
            .in("id", studentIds);

          (students || []).forEach((student: any) => {
            studentsById.set(String(student.id), {
              id: String(student.id),
              name: String(student.name || "Student"),
              grade: student.grade || null,
            });
          });
        }

        res.json({
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          operationalMode,
          sessionSchedulingEnabled: operationalMode === "certified_live",
          sessions: (sessions || []).map((session: any) => ({
            ...session,
            student: studentsById.get(String(session.student_id || "")) || null,
          })),
        });
      } catch (error) {
        console.error("Error fetching tutor weekly schedule:", error);
        res.status(500).json({ message: "Failed to fetch tutor weekly schedule" });
      }
    }
  );

  app.get(
    "/api/tutor/scheduled-sessions/:sessionId/log",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const { sessionId } = req.params;

        const { data: session, error: sessionError } = await supabase
          .from("scheduled_sessions")
          .select("id, scheduled_time, status, type, student_id, tutor_id")
          .eq("id", sessionId)
          .eq("tutor_id", tutorId)
          .single();

        if (sessionError || !session) {
          return res.status(404).json({ message: "Scheduled session not found" });
        }

        const { data: drillRows, error: drillError } = await supabase
          .from("intro_session_drills")
          .select("id, drill, submitted_at, training_session_run_id")
          .eq("scheduled_session_id", sessionId)
          .order("submitted_at", { ascending: true });

        if (drillError) {
          console.error("Error fetching scheduled session drill log:", drillError);
          return res.status(500).json({ message: "Failed to fetch scheduled session log" });
        }

        const { data: trainingRuns, error: runError } = await supabase
          .from("training_session_runs")
          .select("id, topic_count, started_at, submitted_at, status")
          .eq("scheduled_session_id", sessionId)
          .order("submitted_at", { ascending: false });

        if (runError) {
          console.error("Error fetching training session run log:", runError);
          return res.status(500).json({ message: "Failed to fetch scheduled session log" });
        }

        const sessionLogs = aggregateDeterministicSessions(drillRows || []);

        res.json({
          session,
          trainingRuns: trainingRuns || [],
          sessionLogs,
        });
      } catch (error) {
        console.error("Error fetching scheduled session log:", error);
        res.status(500).json({ message: "Failed to fetch scheduled session log" });
      }
    }
  );

  app.get(
    "/api/tutor/sessions",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const sessions = await getTutorSessionFeed(tutorId);
        res.json(sessions);
      } catch (error) {
        console.error("Error fetching sessions:", error);
        res.status(500).json({ message: "Failed to fetch sessions" });
      }
    }
  );

  // Get intro session details for a student (for tutors)
  app.get(
    "/api/tutor/students/:studentId/intro-session-details",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        console.log('TEST LOG: intro-session-details route hit');
        const { studentId } = req.params;
        const dbUser = (req as any).dbUser;
        // Verify student exists and belongs to this tutor
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        if (student.tutorId !== dbUser.id) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }
        // DEBUG: Print all scheduled_sessions for this tutor and student
        const { data: debugSessions, error: debugSessionsError } = await supabase
          .from("scheduled_sessions")
          .select("id, tutor_id, student_id, type, status, scheduled_time, parent_confirmed, tutor_confirmed, created_at, updated_at")
          .eq("tutor_id", dbUser.id)
          .eq("student_id", studentId);
        console.log("[DEBUG] All scheduled_sessions for tutor and student:", { debugSessions, debugSessionsError, tutorId: dbUser.id, studentId });
        // Find latest intro session for this student/tutor
        const { data: session, error: sessionError } = await supabase
          .from("scheduled_sessions")
          .select("id, scheduled_time, status, parent_confirmed, tutor_confirmed, created_at, updated_at, tutor_id, student_id, type")
          .eq("tutor_id", dbUser.id)
          .eq("student_id", studentId)
          .eq("type", "intro")
          .order("created_at", { ascending: false })
          .maybeSingle();

        let resolvedSession = session;
        let resolvedSessionError = sessionError;

        if (!resolvedSession) {
          const parentId = (student as any).parentId || null;
          if (parentId) {
            const { data: fallbackSession, error: fallbackError } = await supabase
              .from("scheduled_sessions")
              .select("id, scheduled_time, status, parent_confirmed, tutor_confirmed, created_at, updated_at, tutor_id, student_id, parent_id, type")
              .eq("tutor_id", dbUser.id)
              .eq("parent_id", parentId)
              .eq("type", "intro")
              .order("created_at", { ascending: false })
              .maybeSingle();

            if (fallbackSession) {
              resolvedSession = fallbackSession;
              resolvedSessionError = fallbackError;
            }
          }
        }

        console.log("[DEBUG] intro-session-details query result:", { session: resolvedSession, sessionError: resolvedSessionError, tutorId: dbUser.id, studentId });
        if (resolvedSessionError) {
          console.error("[DEBUG] intro-session-details sessionError:", resolvedSessionError);
          return res.status(500).json({ message: "Failed to fetch intro session details", details: resolvedSessionError });
        }
        if (!resolvedSession) {
          return res.json({ status: "not_scheduled" });
        }
        res.json({
          id: resolvedSession.id,
          scheduled_time: resolvedSession.scheduled_time,
          status: getEffectiveScheduledSessionStatus(resolvedSession),
          parent_confirmed: resolvedSession.parent_confirmed,
          tutor_confirmed: resolvedSession.tutor_confirmed,
          created_at: resolvedSession.created_at,
          updated_at: resolvedSession.updated_at,
          debug: {
            tutor_id: resolvedSession.tutor_id,
            student_id: resolvedSession.student_id,
            parent_id: (resolvedSession as any).parent_id,
            type: resolvedSession.type
          }
        });
      } catch (error) {
        console.error("[DEBUG] Error fetching intro session details:", error);
        res.status(500).json({ message: "Failed to fetch intro session details", details: error });
      }
    }
  );

  // Tutor responds to intro session (accept/adjust) - singular route
  app.post("/api/tutor/student/:studentId/intro-session-response", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const dbUser = (req as any).dbUser;
      const { action, newDate, newTime } = req.body;
      const student = await storage.getStudent(studentId);
      const studentWorkflow = ((student?.personalProfile as any) || {}).workflow || {};
      const sessionType = studentWorkflow.handoverRequiredAt && !studentWorkflow.handoverCompletedAt ? "handover" : "intro";
      // Try to find the intro session for this tutor/student
      const tutorSessionLookupResult: any = await supabase
        .from("scheduled_sessions")
        .select(SCHEDULED_SESSION_SELECT)
        .eq("tutor_id", dbUser.id)
        .eq("student_id", studentId)
        .eq("type", sessionType)
        .order("created_at", { ascending: false })
        .maybeSingle();
      let { data: session, error: sessionError } = tutorSessionLookupResult;
      // If not found, try fallback: find by parent_id where student_id is null
      if (!session) {
        // Get parentId for this student
        const { data: studentRow } = await supabase
          .from("students")
          .select("parent_id")
          .eq("id", studentId)
          .maybeSingle();
        const parentId = studentRow?.parent_id;
        if (parentId) {
          const fallbackTutorSessionResult: any = await supabase
            .from("scheduled_sessions")
            .select(SCHEDULED_SESSION_SELECT)
            .eq("tutor_id", dbUser.id)
            .eq("parent_id", parentId)
            .is("student_id", null)
            .eq("type", sessionType)
            .order("created_at", { ascending: false })
            .maybeSingle();
          const { data: fallbackSession } = fallbackTutorSessionResult;
          if (fallbackSession) {
            session = fallbackSession;
          }
        }
      }
      if (!session) {
        return res.status(404).json({ message: "Intro session not found" });
      }
      let updateFields = {};
      if (action === "accept") {
        updateFields = {
          tutor_confirmed: true,
          parent_confirmed: true,
          status: "confirmed",
          updated_at: new Date().toISOString(),
        };
      } else if (action === "propose_adjustment") {
        if (!newDate || !newTime) {
          return res.status(400).json({ message: "Missing new date or time" });
        }
        // Tutor is proposing an adjustment, so tutor has confirmed, parent must confirm next
        updateFields = {
          scheduled_time: `${newDate}T${newTime}`,
          tutor_confirmed: true,
          parent_confirmed: false,
          status: "pending_parent_confirmation",
          updated_at: new Date().toISOString(),
        };
      } else {
        return res.status(400).json({ message: "Invalid action" });
      }
      console.log('[DEBUG] Updating scheduled_sessions', { sessionId: session.id, updateFields });
      const tutorSessionUpdateResult: any = await supabase
        .from("scheduled_sessions")
        .update(updateFields)
        .eq("id", session.id)
        .select(SCHEDULED_SESSION_SELECT);
      const { error: updateError, data: updateData } = tutorSessionUpdateResult;
      console.log('[DEBUG] Update result', { updateError, updateData });
      if (updateError) {
        return res.status(500).json({ message: "Failed to update session", details: updateError });
      }
      if (action === "propose_adjustment") {
        await safeSendPush(
          session.parent_id,
          {
            title: "Session needs confirmation",
            body: `Your tutor proposed a new ${getSessionDisplayLabel(sessionType)} time. Open Response Integrity to confirm or respond.`,
            url: "/client/parent/gateway",
            tag: `parent-intro-session-confirmation-${session.id}`,
          },
          "parent intro session confirmation needed",
        );
      }
      res.json({
        success: true,
      });
    } catch (error) {
      console.error("Error in tutor intro session response:", error);
      res.status(500).json({ message: "Failed to process tutor response" });
    }
  });

  // Alias for plural students route (for consistency)
  app.post("/api/tutor/students/:studentId/intro-session-response", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const dbUser = (req as any).dbUser;
      const { action, newDate, newTime } = req.body;
      const student = await storage.getStudent(studentId);
      const studentWorkflow = ((student?.personalProfile as any) || {}).workflow || {};
      const sessionType = studentWorkflow.handoverRequiredAt && !studentWorkflow.handoverCompletedAt ? "handover" : "intro";
      // Try to find the intro session for this tutor/student
      const introSessionPluralLookupResult: any = await supabase
        .from("scheduled_sessions")
        .select(SCHEDULED_SESSION_SELECT)
        .eq("tutor_id", dbUser.id)
        .eq("student_id", studentId)
        .eq("type", sessionType)
        .order("created_at", { ascending: false })
        .maybeSingle();
      let { data: session, error: sessionError } = introSessionPluralLookupResult;
      // If not found, try fallback: find by parent_id where student_id is null
      if (!session) {
        // Get parentId for this student
        const { data: studentRow } = await supabase
          .from("students")
          .select("parent_id")
          .eq("id", studentId)
          .maybeSingle();
        const parentId = studentRow?.parent_id;
        if (parentId) {
          const { data: fallbackSession } = await supabase
            .from("scheduled_sessions")
            .select(SCHEDULED_SESSION_SELECT)
            .eq("tutor_id", dbUser.id)
            .eq("parent_id", parentId)
            .is("student_id", null)
            .eq("type", sessionType)
            .order("created_at", { ascending: false })
            .maybeSingle();
          if (fallbackSession) {
            session = fallbackSession;
          }
        }
      }
      if (!session) {
        return res.status(404).json({ message: "Intro session not found" });
      }
      let updateFields = {};
      if (action === "accept") {
        updateFields = {
          tutor_confirmed: true,
          parent_confirmed: true,
          status: "confirmed",
          updated_at: new Date().toISOString(),
        };
      } else if (action === "propose_adjustment") {
        if (!newDate || !newTime) {
          return res.status(400).json({ message: "Missing new date or time" });
        }
        // Tutor is proposing an adjustment, so tutor has confirmed, parent must confirm next
        updateFields = {
          scheduled_time: `${newDate}T${newTime}`,
          tutor_confirmed: true,
          parent_confirmed: false,
          status: "pending_parent_confirmation",
          updated_at: new Date().toISOString(),
        };
      } else {
        return res.status(400).json({ message: "Invalid action" });
      }
      console.log('[DEBUG] Updating scheduled_sessions', { sessionId: session.id, updateFields });
      const introSessionUpdateResult: any = await supabase
        .from("scheduled_sessions")
        .update(updateFields)
        .eq("id", session.id)
        .select(SCHEDULED_SESSION_SELECT);
      const { error: updateError, data: updateData } = introSessionUpdateResult;
      console.log('[DEBUG] Update result', { updateError, updateData });
      if (updateError) {
        return res.status(500).json({ message: "Failed to update session", details: updateError });
      }
      if (action === "propose_adjustment") {
        await safeSendPush(
          session.parent_id,
          {
            title: "Session needs confirmation",
            body: `Your tutor proposed a new ${getSessionDisplayLabel(sessionType)} time. Open Response Integrity to confirm or respond.`,
            url: "/client/parent/gateway",
            tag: `parent-intro-session-confirmation-${session.id}`,
          },
          "parent intro session confirmation needed plural route",
        );
      }
      res.json({
        success: true,
      });
    } catch (error) {
      console.error("Error in tutor intro session response:", error);
      res.status(500).json({ message: "Failed to process tutor response" });
    }
  });

  app.get(
    "/api/tutor/students/:studentId/training-sessions",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const tutorId = (req as any).dbUser.id;
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
                console.error("Failed to backfill canonical tutor link for drill access:", error);
              }
            }
          }
        }

        if (!normalizedStudent || !tutorOwnsStudent) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        const premiumAccess = await ensurePremiumAccessForStudent(student);
        if (!premiumAccess.allowed) {
          return res.status(premiumAccess.status).json({ message: premiumAccess.message, sessions: [] });
        }

        const { data, error } = await supabase
          .from("scheduled_sessions")
          .select(SCHEDULED_SESSION_SELECT)
          .eq("tutor_id", tutorId)
          .eq("student_id", studentId)
          .eq("type", "training")
          .order("scheduled_time", { ascending: true })
          .limit(12);

        if (error) {
          return res.status(500).json({ message: "Failed to fetch training sessions" });
        }

        const sessionsWithArtifacts = await Promise.all(
          (data || []).map(async (session: any) => {
            if (shouldReconcileSessionArtifacts(session)) {
              await reconcileArtifactsForScheduledSession(session);
              const { data: refreshedSession } = await supabase
                .from("scheduled_sessions")
                .select(SCHEDULED_SESSION_SELECT)
                .eq("id", session.id)
                .maybeSingle();
              return refreshedSession || session;
            }
            return session;
          })
        );

        res.json({
          sessions: sessionsWithArtifacts.map((session: any) => ({
            ...session,
            launch: getSessionLaunchState(session, "training"),
          })),
          googleMeetConfigured: isGoogleMeetIntegrationAvailable(),
        });
      } catch (error) {
        console.error("Error fetching training sessions:", error);
        res.status(500).json({ message: "Failed to fetch training sessions" });
      }
    }
  );

  app.post(
    "/api/tutor/students/:studentId/training-sessions",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const tutorId = (req as any).dbUser.id;
        const student = await storage.getStudent(studentId);
        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        const premiumAccess = await ensurePremiumAccessForStudent(student);
        if (!premiumAccess.allowed) {
          return res.status(premiumAccess.status).json({ message: premiumAccess.message });
        }

        const assignmentAccepted = await isTutorAssignmentAcceptedForStudent(student, tutorId);
        if (!assignmentAccepted) {
          return res.status(403).json({ message: "Accept this assignment before scheduling training sessions." });
        }
        const parentId = (student as any).parentId || null;
        if (!parentId) {
          return res.status(400).json({ message: "Student must be linked to a parent before a Response Integrity training lesson can be scheduled." });
        }

        const scheduledStart = String(req.body?.scheduledStart || new Date().toISOString());
        const timezone = String(req.body?.timezone || "Africa/Johannesburg");
        const scheduledEnd = String(
          req.body?.scheduledEnd || addMinutesToIso(scheduledStart, TRAINING_SESSION_DURATION_MINUTES)
        );

        const trainingSessionInsertResult: any = await supabase
          .from("scheduled_sessions")
          .insert({
            parent_id: parentId,
            tutor_id: tutorId,
            student_id: studentId,
            scheduled_time: scheduledStart,
            scheduled_end: scheduledEnd,
            timezone,
            type: "training",
            workflow_stage: "active_training",
            status: "pending_parent_confirmation",
            parent_confirmed: false,
            tutor_confirmed: true,
            attendance_status: "not_started",
            recording_status: "not_expected_yet",
            transcript_status: "not_expected_yet",
            cohost_sync_status: "not_configured",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select(SCHEDULED_SESSION_SELECT)
          .single();
        const { data: inserted, error } = trainingSessionInsertResult;

        if (error || !inserted) {
          console.error("Error creating training session:", error);
          return res.status(500).json({ message: "Failed to create training session" });
        }

        await safeSendPush(
          parentId,
          {
            title: "Session needs confirmation",
            body: "Your tutor proposed a training session. Open Response Integrity to confirm or reschedule.",
            url: "/client/parent/gateway",
            tag: `parent-training-session-confirmation-${inserted.id}`,
          },
          "parent training session confirmation needed",
        );

        const { session } = await resolveTutorScheduledSession(tutorId, studentId, "training", inserted.id);

        res.json({
          success: true,
          session: session || inserted,
          googleMeetConfigured: isGoogleMeetIntegrationAvailable(),
          googleMeetSync: null,
          googleMeetError: null,
        });
      } catch (error) {
        console.error("Error creating training session:", error);
        res.status(500).json({ message: "Failed to create training session" });
      }
    }
  );

  app.post(
    "/api/tutor/students/:studentId/training-sessions/:sessionId/confirm",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId, sessionId } = req.params;
        const tutorId = (req as any).dbUser.id;
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
              .select("id, assigned_tutor_id, user_id, student_full_name, student_grade, parent_email, is_sandbox_account, current_step")
              .eq("id", parentEnrollmentId)
              .maybeSingle();

            tutorOwnsStudent = String(linkedEnrollment?.assigned_tutor_id || "") === String(tutorId);

            if (tutorOwnsStudent && linkedEnrollment) {
              try {
                await ensureStudentForEnrollment(linkedEnrollment, tutorId);
              } catch (error) {
                console.error("Failed to backfill canonical tutor link for training session confirm:", error);
              }
            }
          }
        }

        if (!normalizedStudent || !tutorOwnsStudent) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        const premiumAccess = await ensurePremiumAccessForStudent(normalizedStudent);
        if (!premiumAccess.allowed) {
          return res.status(premiumAccess.status).json({ message: premiumAccess.message });
        }

        const tutorTrainingSessionLookupResult: any = await supabase
          .from("scheduled_sessions")
          .select(SCHEDULED_SESSION_SELECT)
          .eq("id", sessionId)
          .eq("student_id", studentId)
          .eq("tutor_id", tutorId)
          .eq("type", "training")
          .maybeSingle();
        const { data: session, error: sessionError } = tutorTrainingSessionLookupResult;

        if (sessionError || !session) {
          return res.status(404).json({ message: "Training session not found" });
        }

        if (session.status !== "pending_tutor_confirmation") {
          return res.status(400).json({ message: "Training session is not waiting for tutor confirmation" });
        }

        const tutorTrainingSessionConfirmResult: any = await supabase
          .from("scheduled_sessions")
          .update({
            parent_confirmed: true,
            tutor_confirmed: true,
            status: "confirmed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .select(SCHEDULED_SESSION_SELECT)
          .single();

        const { data: updatedSession, error: updateError } = tutorTrainingSessionConfirmResult;
        if (updateError || !updatedSession) {
          return res.status(500).json({ message: "Failed to confirm training session" });
        }

        const operationalMode = await getTutorOperationalMode(tutorId);
        const meetSync =
          operationalMode === "training"
            ? null
            : await syncMeetForScheduledSession(updatedSession, { studentName: normalizedStudent.name });

        res.json({
          success: true,
          session: updatedSession,
          googleMeetConfigured: operationalMode === "training" ? false : isGoogleMeetIntegrationAvailable(),
          ...getMeetSyncResponsePayload(meetSync),
        });
      } catch (error) {
        console.error("Error confirming tutor training session:", error);
        res.status(500).json({ message: "Failed to confirm training session" });
      }
    }
  );

  app.post(
    "/api/tutor/students/:studentId/training-sessions/:sessionId/respond",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId, sessionId } = req.params;
        const tutorId = (req as any).dbUser.id;
        const { action, scheduledStart, reasonCodes, reasonNote } = req.body as {
          action?: "confirm" | "reschedule" | "cancel";
          scheduledStart?: string;
          reasonCodes?: string[];
          reasonNote?: string;
        };
        const timezone = String(req.body?.timezone || "Africa/Johannesburg");
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
              .select("id, assigned_tutor_id, user_id, student_full_name, student_grade, parent_email, is_sandbox_account, current_step")
              .eq("id", parentEnrollmentId)
              .maybeSingle();

            tutorOwnsStudent = String(linkedEnrollment?.assigned_tutor_id || "") === String(tutorId);

            if (tutorOwnsStudent && linkedEnrollment) {
              try {
                await ensureStudentForEnrollment(linkedEnrollment, tutorId);
              } catch (error) {
                console.error("Failed to backfill canonical tutor link for training session response:", error);
              }
            }
          }
        }

        if (!normalizedStudent || !tutorOwnsStudent) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        const premiumAccess = await ensurePremiumAccessForStudent(normalizedStudent);
        if (!premiumAccess.allowed) {
          return res.status(premiumAccess.status).json({ message: premiumAccess.message });
        }

        const tutorTrainingSessionActionLookupResult: any = await supabase
          .from("scheduled_sessions")
          .select(SCHEDULED_SESSION_SELECT)
          .eq("id", sessionId)
          .eq("student_id", studentId)
          .eq("tutor_id", tutorId)
          .eq("type", "training")
          .maybeSingle();
        const { data: session, error: sessionError } = tutorTrainingSessionActionLookupResult;

        if (sessionError || !session) {
          return res.status(404).json({ message: "Training session not found" });
        }

        if (action === "cancel") {
          const normalizedReasonCodes = Array.isArray(reasonCodes)
            ? reasonCodes.map((item) => String(item || "").trim()).filter(Boolean)
            : [];
          if (normalizedReasonCodes.length === 0) {
            return res.status(400).json({ message: "At least one cancellation reason is required." });
          }

          if (["completed", "live", "cancelled", "flagged"].includes(String(session.status || ""))) {
            return res.status(400).json({ message: "This training session can no longer be cancelled" });
          }

          const tutorTrainingCancelResult: any = await supabase
            .from("scheduled_sessions")
            .update({
              status: "cancelled",
              parent_confirmed: false,
              tutor_confirmed: false,
              google_calendar_id: null,
              google_event_id: null,
              google_meet_url: null,
              google_conference_id: null,
              google_meet_space_name: null,
              google_meet_code: null,
              host_account_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessionId)
            .select(SCHEDULED_SESSION_SELECT)
            .single();
          const { data: cancelledSession, error: cancelError } = tutorTrainingCancelResult;

          if (cancelError || !cancelledSession) {
            return res.status(500).json({ message: "Failed to cancel training session" });
          }

          const enrollmentId = await resolveEnrollmentIdForSession(session);
          const cancellationImpact = classifyCancellationBillingImpact({
            actorRole: "tutor",
            scheduledTimeIso: session.scheduled_time,
          });
          const monthlyQuota = await recordSessionBillingEvent({
            sessionId: String(sessionId),
            parentId: String(session.parent_id || ""),
            studentId: String(session.student_id || studentId),
            enrollmentId,
            eventType: cancellationImpact.eventType,
            actorRole: "tutor",
            actorId: String(tutorId),
            billingImpact: cancellationImpact.impact,
            creditsDelta: cancellationImpact.creditsDelta,
            reasonCodes: normalizedReasonCodes,
            reasonNote: String(reasonNote || "").trim() || null,
            metadata: {
              action: "cancel",
              policy_cutoff_hours: CANCELLATION_CUTOFF_HOURS,
              scheduled_time: session.scheduled_time,
            },
          });

          await safeSendPush(
            session.parent_id,
            {
              title: "Session cancelled",
              body: "Your tutor cancelled a training session. Open Response Integrity to review the updated week.",
              url: "/client/parent/sessions",
              tag: `parent-training-session-cancelled-${sessionId}`,
            },
            "parent training session cancelled by tutor",
          );

          return res.json({
            success: true,
            session: cancelledSession,
            status: "cancelled",
            monthlyQuota,
            googleMeetConfigured: false,
            googleMeetSync: null,
            googleMeetError: null,
          });
        }

        if (session.status !== "pending_tutor_confirmation") {
          return res.status(400).json({ message: "Training session is not waiting for tutor confirmation" });
        }

        if (action !== "confirm" && action !== "reschedule") {
          return res.status(400).json({ message: "Action must be 'confirm', 'reschedule', or 'cancel'" });
        }

        if (action === "reschedule") {
          const nextStart = String(scheduledStart || "").trim();
          if (!nextStart) {
            return res.status(400).json({ message: "New scheduled time is required" });
          }

          const parsedStart = new Date(nextStart);
          if (Number.isNaN(parsedStart.getTime())) {
            return res.status(400).json({ message: "New scheduled time is invalid" });
          }

          if (parsedStart.getTime() <= Date.now()) {
            return res.status(400).json({ message: "Rescheduled sessions must be in the future." });
          }

          const monthStartIso = getMonthStartIso(session.scheduled_time || new Date().toISOString());
          if (!monthStartIso) {
            return res.status(400).json({ message: "Session month could not be resolved for reschedule policy." });
          }
          const monthStart = monthStartIso.slice(0, 10);
          const nextMonthDate = new Date(monthStartIso);
          nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
          const nextMonth = nextMonthDate.toISOString().slice(0, 10);
          const enrollmentIdForReschedule = await resolveEnrollmentIdForSession(session);
          let isSandboxReschedule = false;
          try {
            if (enrollmentIdForReschedule) {
              const { data: linkedEnrollment } = await supabase
                .from("parent_enrollments")
                .select("id, is_sandbox_account, parent_email, current_step")
                .eq("id", enrollmentIdForReschedule)
                .maybeSingle();
              isSandboxReschedule = isSandboxPaymentEnrollment(linkedEnrollment);
            }
          } catch (err) {
            console.error("Failed to resolve enrollment for reschedule sandbox check:", err);
          }

          const { data: rescheduleEvents } = await supabase
            .from("session_billing_events")
            .select("id")
            .eq("session_id", String(sessionId))
            .eq("event_type", "reschedule_tutor")
            .gte("effective_at", `${monthStart}T00:00:00.000Z`)
            .lt("effective_at", `${nextMonth}T00:00:00.000Z`)
            .eq("is_sandbox", isSandboxReschedule);
          if ((rescheduleEvents || []).length >= RESCHEDULE_LIMIT_PER_SESSION_PER_MONTH) {
            return res.status(409).json({
              message: `This session has reached the ${RESCHEDULE_LIMIT_PER_SESSION_PER_MONTH} reschedule limit for the month. COO override is required.`,
            });
          }

          const tutorTrainingRescheduleResult: any = await supabase
            .from("scheduled_sessions")
            .update({
              scheduled_time: nextStart,
              scheduled_end: addMinutesToIso(nextStart, TRAINING_SESSION_DURATION_MINUTES),
              timezone,
              parent_confirmed: false,
              tutor_confirmed: true,
              status: "pending_parent_confirmation",
              google_calendar_id: null,
              google_event_id: null,
              google_meet_url: null,
              google_conference_id: null,
              google_meet_space_name: null,
              google_meet_code: null,
              host_account_id: null,
              recording_file_id: null,
              recording_detected_at: null,
              recording_status: "not_expected_yet",
              transcript_file_id: null,
              transcript_detected_at: null,
              transcript_status: "not_expected_yet",
              attendance_report_file_id: null,
              cohost_sync_status: "not_configured",
              cohost_sync_error: null,
              last_artifact_sync_at: null,
              last_meet_sync_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessionId)
            .select(SCHEDULED_SESSION_SELECT)
            .single();
          const { data: updatedSession, error: updateError } = tutorTrainingRescheduleResult;

          if (updateError || !updatedSession) {
            return res.status(500).json({ message: "Failed to reschedule training session" });
          }

          const enrollmentId = await resolveEnrollmentIdForSession(session);
          const monthlyQuota = await recordSessionBillingEvent({
            sessionId: String(sessionId),
            parentId: String(session.parent_id || ""),
            studentId: String(session.student_id || studentId),
            enrollmentId,
            eventType: "reschedule_tutor",
            actorRole: "tutor",
            actorId: String(tutorId),
            billingImpact: "none",
            creditsDelta: 0,
            reasonCodes: Array.isArray(reasonCodes)
              ? reasonCodes.map((item) => String(item || "").trim()).filter(Boolean)
              : [],
            reasonNote: String(reasonNote || "").trim() || null,
            metadata: {
              action: "reschedule",
              from: session.scheduled_time,
              to: nextStart,
            },
          });

          await safeSendPush(
            session.parent_id,
            {
              title: "Session needs confirmation",
              body: "Your tutor proposed a new training-session time. Open Response Integrity to confirm or respond.",
              url: "/client/parent/gateway",
              tag: `parent-training-session-confirmation-${sessionId}`,
            },
            "parent training session reschedule confirmation needed",
          );

          return res.json({
            success: true,
            session: updatedSession,
            status: "pending_parent_confirmation",
            monthlyQuota,
            googleMeetConfigured: isGoogleMeetIntegrationAvailable(),
            googleMeetSync: null,
            googleMeetError: null,
          });
        }

        const tutorTrainingConfirmAfterAdjustmentResult: any = await supabase
          .from("scheduled_sessions")
          .update({
            parent_confirmed: true,
            tutor_confirmed: true,
            status: "confirmed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .select(SCHEDULED_SESSION_SELECT)
          .single();

        const { data: updatedSession, error: updateError } = tutorTrainingConfirmAfterAdjustmentResult;
        if (updateError || !updatedSession) {
          return res.status(500).json({ message: "Failed to confirm training session" });
        }

        const meetSync = await syncMeetForScheduledSession(updatedSession, { studentName: student.name });
        const monthlyQuota =
          updatedSession.parent_id && updatedSession.student_id
            ? await getMonthlySessionQuotaSnapshot({
                parentId: String(updatedSession.parent_id),
                studentId: String(updatedSession.student_id),
              })
            : null;

        res.json({
          success: true,
          session: updatedSession,
          monthlyQuota,
          googleMeetConfigured: isGoogleMeetIntegrationAvailable(),
          ...getMeetSyncResponsePayload(meetSync),
        });
      } catch (error) {
        console.error("Error responding to tutor training session:", error);
        res.status(500).json({ message: "Failed to respond to training session" });
      }
    }
  );

  app.get(
    "/api/tutor/students/:studentId/drill-session-access",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const tutorId = (req as any).dbUser.id;
        const kind =
          req.query.kind === "training"
            ? "training"
            : req.query.kind === "handover"
              ? "handover"
              : "intro";
        const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
        const operationalMode = await getTutorOperationalMode(tutorId);

        const student = await storage.getStudent(studentId);
        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        if (operationalMode === "training" && kind === "training") {
          const { session, error } = await resolveTutorScheduledSession(tutorId, studentId, kind, sessionId);
          if (error) {
            return res.status(500).json({ message: "Failed to resolve scheduled session" });
          }

          if (!session) {
            return res.status(404).json({
              canLaunch: false,
              message: "Create and confirm a weekly Response Integrity lesson before opening the training runner.",
            });
          }

          const hasConfirmedSchedule =
            ["confirmed", "ready", "live"].includes(String(session?.status || "").trim()) &&
            !!session?.parent_confirmed &&
            !!session?.tutor_confirmed;

          if (!hasConfirmedSchedule) {
            return res.status(400).json({
              canLaunch: false,
              message: "Training mode still requires a tutor-confirmed weekly Response Integrity lesson before launch.",
              session: {
                ...session,
                launch: {
                  canLaunch: false,
                  isLive: false,
                  isImminent: false,
                },
              },
            });
          }

          return res.json({
            canLaunch: true,
            operationalMode,
            session: {
              ...session,
              launch: {
                canLaunch: true,
                isLive: false,
                isImminent: false,
              },
            },
            googleMeetConfigured: false,
          });
        }

        if (operationalMode === "training") {
          return res.json({
            canLaunch: true,
            operationalMode,
            session: null,
            googleMeetConfigured: false,
          });
        }

        if (kind === "training") {
          const { session: pendingTrainingConfirmation, error: pendingTrainingConfirmationError } =
            await getPendingTrainingConfirmationSession(tutorId, studentId);
          if (pendingTrainingConfirmationError) {
            return res.status(500).json({ message: "Failed to validate training confirmation state" });
          }

          if (pendingTrainingConfirmation && (!sessionId || sessionId !== String(pendingTrainingConfirmation.id))) {
            return res.status(400).json({
              canLaunch: false,
              message: "A Response Integrity training lesson is waiting for parent confirmation before drills can launch.",
              session: {
                ...pendingTrainingConfirmation,
                launch: {
                  canLaunch: false,
                  isLive: false,
                  isImminent: false,
                },
              },
            });
          }
        }

        const studentOperationalMode = await getStudentOperationalMode(studentId);
        const { session, error } = await resolveTutorScheduledSession(tutorId, studentId, kind, sessionId);
        if (error) {
          return res.status(500).json({ message: "Failed to resolve scheduled session" });
        }
        if (studentOperationalMode === "training" && (kind === "intro" || kind === "handover")) {
          return res.json({
            canLaunch: true,
            session: session
              ? {
                  ...session,
                  launch: {
                    canLaunch: true,
                    isLive: false,
                    isImminent: false,
                  },
                }
              : null,
            operationalMode: studentOperationalMode,
            googleMeetConfigured: false,
          });
        }
        if (!session) {
          return res.status(404).json({
            canLaunch: false,
            message:
              kind === "training"
                ? "Create or attach a Response Integrity training lesson before opening the drill runner."
                : kind === "handover"
                  ? "A confirmed continuity check session is required before opening handover verification."
                  : "A confirmed intro session is required before opening the intro drill.",
          });
        }

        const launch = getSessionLaunchState(session, kind);
        if (!launch.canLaunch) {
          return res.status(400).json({
            canLaunch: false,
            message:
              kind === "training"
                ? "Training drills must launch from an active or imminently scheduled Response Integrity lesson."
                : kind === "handover"
                  ? "Handover verification must launch from a confirmed continuity check session."
                  : "Intro drills must launch from a confirmed Response Integrity intro session.",
            session: {
              ...session,
              launch,
            },
          });
        }

        res.json({
          canLaunch: true,
          session: {
            ...session,
            launch,
          },
          operationalMode: studentOperationalMode,
          googleMeetConfigured: isGoogleMeetIntegrationAvailable(),
        });
      } catch (error) {
        console.error("Error validating drill session access:", error);
        res.status(500).json({ message: "Failed to validate drill session access" });
      }
    }
  );

  app.post(
    "/api/tutor/students/:studentId/scheduled-sessions/:sessionId/retry-meet-sync",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId, sessionId } = req.params;
        const tutorId = (req as any).dbUser.id;
        const operationalMode = await getTutorOperationalMode(tutorId);

        if (operationalMode === "training") {
          return res.status(400).json({
            message: "Meet sync is disabled while this tutor is in training mode.",
          });
        }

        const student = await storage.getStudent(studentId);

        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        const recordingSessionLookupResult: any = await supabase
          .from("scheduled_sessions")
          .select(SCHEDULED_SESSION_SELECT)
          .eq("id", sessionId)
          .eq("student_id", studentId)
          .eq("tutor_id", tutorId)
          .maybeSingle();
        const { data: session, error } = recordingSessionLookupResult;

        if (error) {
          return res.status(500).json({ message: "Failed to load scheduled session" });
        }

        if (!session) {
          return res.status(404).json({ message: "Scheduled session not found" });
        }

        const meetSync = await syncMeetForScheduledSession(session, { studentName: student.name });

        const { data: refreshedSession } = await supabase
          .from("scheduled_sessions")
          .select(SCHEDULED_SESSION_SELECT)
          .eq("id", sessionId)
          .maybeSingle();

        res.json({
          success: meetSync?.provider === "google_calendar",
          session: refreshedSession || session,
          googleMeetConfigured: isGoogleMeetIntegrationAvailable(),
          ...getMeetSyncResponsePayload(meetSync),
        });
      } catch (error) {
        console.error("Error retrying Meet sync:", error);
        res.status(500).json({ message: "Failed to retry Meet sync" });
      }
    }
  );

  app.post(
    "/api/tutor/students/:studentId/scheduled-sessions/:sessionId/submit-recording",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId, sessionId } = req.params;
        const tutorId = (req as any).dbUser.id;
        const recordingUrl = String(req.body?.recordingUrl || "").trim();
        const fileData = String(req.body?.fileData || "").trim();
        const fileName = String(req.body?.fileName || "").trim();
        const contentType = String(req.body?.contentType || "").trim() || "video/webm";
        const student = await storage.getStudent(studentId);

        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        if (!recordingUrl && !fileData) {
          return res.status(400).json({ message: "Recording link or uploaded file is required" });
        }

        const recordingSessionLookupResult: any = await supabase
          .from("scheduled_sessions")
          .select(SCHEDULED_SESSION_SELECT)
          .eq("id", sessionId)
          .eq("student_id", studentId)
          .eq("tutor_id", tutorId)
          .maybeSingle();
        const { data: session, error } = recordingSessionLookupResult;

        if (error || !session) {
          return res.status(404).json({ message: "Scheduled session not found" });
        }

        let persistedRecordingUrl = recordingUrl;
        if (fileData) {
          if (!fileName) {
            return res.status(400).json({ message: "Uploaded recording file must include a file name" });
          }

          if (!contentType.startsWith("video/") && !contentType.startsWith("audio/")) {
            return res.status(400).json({ message: "Uploaded recording must be an audio or video file" });
          }

          const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
          const extension = safeFileName.includes(".") ? safeFileName.split(".").pop() : "webm";
          const storagePath = `session-recordings/${studentId}/${sessionId}-${Date.now()}.${extension}`;
          const normalizedBase64 = fileData.includes(",") ? fileData.split(",").pop() || "" : fileData;
          const buffer = Buffer.from(normalizedBase64, "base64");

          if (buffer.byteLength > 30 * 1024 * 1024) {
            return res.status(400).json({ message: "Uploaded recording must be 30 MB or smaller for now" });
          }

          const { error: uploadError } = await supabase.storage
            .from("session-recordings")
            .upload(storagePath, buffer, {
              contentType,
              upsert: true,
            });

          if (uploadError) {
            return res.status(500).json({ message: `Failed to upload recording: ${uploadError.message}` });
          }

          const { data: urlData } = supabase.storage
            .from("session-recordings")
            .getPublicUrl(storagePath);

          if (!urlData?.publicUrl) {
            return res.status(500).json({ message: "Recording upload succeeded but file URL could not be generated" });
          }

          persistedRecordingUrl = urlData.publicUrl;
        } else {
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(recordingUrl);
          } catch {
            return res.status(400).json({ message: "Recording link must be a valid URL" });
          }

          if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            return res.status(400).json({ message: "Recording link must use http or https" });
          }
        }

        const recordingUpdateResult: any = await supabase
          .from("scheduled_sessions")
          .update({
            recording_file_id: persistedRecordingUrl,
            recording_detected_at: new Date().toISOString(),
            recording_status: "recording_uploaded",
            transcript_status:
              String(session?.transcript_status || "").trim() || "manual_not_tracked",
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .select(SCHEDULED_SESSION_SELECT)
          .single();
        const { data: updatedSession, error: updateError } = recordingUpdateResult;

        if (updateError || !updatedSession) {
          return res.status(500).json({ message: "Failed to save recording" });
        }

        res.json({
          success: true,
          session: updatedSession,
        });
      } catch (error) {
        console.error("Error submitting manual session recording:", error);
        res.status(500).json({ message: "Failed to save recording" });
      }
    }
  );

  app.get("/api/parent/training-sessions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser.id;
      const operationalMode = await getParentAssignedTutorOperationalMode(userId);

      const { data: enrollment, error: enrollmentError } = await selectLatestParentEnrollment({
        parentId: userId,
        primarySelect: "id, user_id, assigned_tutor_id, assigned_student_id, student_full_name, student_grade, parent_email",
        fallbackSelect: "id, user_id, assigned_tutor_id, student_full_name, student_grade, parent_email",
      });

      if (enrollmentError) {
        return res.status(500).json({ message: "Failed to fetch enrollment" });
      }

      if (!enrollment?.assigned_tutor_id) {
        return res.json({ sessions: [] });
      }

      let studentRecord = null;
      try {
        studentRecord = await resolveCanonicalStudentForEnrollment(enrollment);
      } catch (error) {
        console.error("Failed to resolve canonical parent training student:", error);
      }
      const studentId = studentRecord?.id || enrollment.assigned_student_id || null;
      const isSandboxContext = isSandboxPaymentEnrollment(enrollment);
      const premiumAccess = await ensurePremiumAccessForParent(userId, studentId ? String(studentId) : null);
      if (!premiumAccess.allowed) {
        return res.json({
          operationalMode,
          sessionSchedulingEnabled: false,
          paymentRequired: true,
          paymentStatus: "UNPAID",
          sessions: [],
        });
      }

      let monthlyQuota = null;
      if (studentId) {
        try {
          monthlyQuota = await getMonthlySessionQuotaSnapshot({
            parentId: userId,
            studentId: String(studentId),
            isSandboxContext,
          });
        } catch (error) {
          console.error("Failed to load parent training quota snapshot:", error);
        }
      }

      let query = supabase
        .from("scheduled_sessions")
        .select(SCHEDULED_SESSION_SELECT)
        .eq("parent_id", userId)
        .eq("type", "training")
        .order("scheduled_time", { ascending: true })
        .limit(12);

      if (studentId) {
        query = query.eq("student_id", studentId);
      } else {
        query = query.eq("tutor_id", enrollment.assigned_tutor_id);
      }

      const { data, error } = await query;
      if (error) {
        return res.status(500).json({ message: "Failed to fetch training sessions" });
      }

      const sessionsWithArtifacts = await Promise.all(
        (data || []).map(async (session: any) => {
          if (shouldReconcileSessionArtifacts(session)) {
            try {
              await reconcileArtifactsForScheduledSession(session);
              const { data: refreshedSession } = await supabase
                .from("scheduled_sessions")
                .select(SCHEDULED_SESSION_SELECT)
                .eq("id", session.id)
                .maybeSingle();
              return refreshedSession || session;
            } catch (error) {
              console.error("Failed to reconcile parent training session artifacts:", error);
              return session;
            }
          }
          return session;
        })
      );

      res.json({
        operationalMode,
        sessionSchedulingEnabled: true,
        monthlyQuota,
        sessions: sessionsWithArtifacts.map((session: any) => ({
          ...session,
          launch: getSessionLaunchState(session, "training"),
        })),
      });
    } catch (error) {
      console.error("Error fetching parent training sessions:", error);
      res.status(500).json({ message: "Failed to fetch training sessions" });
    }
  });

  app.post("/api/parent/training-sessions/schedule-week", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser.id;
      const operationalMode = await getParentAssignedTutorOperationalMode(userId);
      const rawSlots = Array.isArray(req.body?.slots) ? req.body.slots : [];
      const timezone = String(req.body?.timezone || "Africa/Johannesburg");
      const weekdayLookup: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      const getLocalWeekInfo = (isoString: string) => {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) {
          return null;
        }
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          weekday: "short",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(date);
        const weekday = parts.find((part) => part.type === "weekday")?.value || "";
        const year = Number(parts.find((part) => part.type === "year")?.value || NaN);
        const month = Number(parts.find((part) => part.type === "month")?.value || NaN);
        const day = Number(parts.find((part) => part.type === "day")?.value || NaN);
        const weekdayIndex = weekdayLookup[weekday];
        if (!weekday || Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day) || typeof weekdayIndex !== "number") {
          return null;
        }
        const localDateUtc = Date.UTC(year, month - 1, day);
        const mondayOffset = (weekdayIndex + 6) % 7;
        return {
          weekdayIndex,
          weekStartUtc: localDateUtc - mondayOffset * 24 * 60 * 60 * 1000,
        };
      };

      if (rawSlots.length !== 2) {
        return res.status(400).json({ message: "Exactly two weekly session slots are required." });
      }

      const { data: enrollment, error: enrollmentError } = await selectLatestParentEnrollment({
        parentId: userId,
        primarySelect: "id, user_id, assigned_tutor_id, assigned_student_id, student_full_name, student_grade, parent_email",
        fallbackSelect: "id, user_id, assigned_tutor_id, student_full_name, student_grade, parent_email",
      });

      if (enrollmentError || !enrollment?.assigned_tutor_id) {
        return res.status(400).json({ message: "Assigned tutor is required before weekly scheduling." });
      }

      const studentRecord = await resolveCanonicalStudentForEnrollment(enrollment);
      const studentId = studentRecord?.id || enrollment.assigned_student_id || null;
      const isSandboxContext = isSandboxPaymentEnrollment(enrollment);

      const premiumAccess = await ensurePremiumAccessForParent(userId, studentId);
      if (!premiumAccess.allowed) {
        return res.status(premiumAccess.status).json({ message: premiumAccess.message });
      }

      if (!studentId) {
        return res.status(400).json({ message: "Student must be linked before weekly sessions can be scheduled." });
      }

      const monthlyQuota = await getMonthlySessionQuotaSnapshot({
        parentId: userId,
        studentId: String(studentId),
        isSandboxContext,
      });
      if (monthlyQuota && Number(monthlyQuota.sessions_remaining || 0) <= 0) {
        const currentMonthKey = toMonthKey(getMonthStartIso(new Date().toISOString())!);
        const { data: latestPayment } = await getLatestPaidPaymentForParent(userId, String(studentId));
        const paymentMonthKey = latestPayment?.paid_at ? toMonthKey(getMonthStartIso(latestPayment.paid_at)!) : null;
        if (!latestPayment || paymentMonthKey !== currentMonthKey) {
          return res.status(402).json({
            message: "This month's sessions require a new monthly payment. Please renew your subscription to schedule more sessions.",
            monthlyQuota,
          });
        }
        return res.status(409).json({
          message: "This month's 8-session quota is exhausted. New scheduling opens next month or by COO adjustment.",
          monthlyQuota,
        });
      }

      const parsedSlots = rawSlots
        .map((slot: any) => String(slot?.scheduledStart || "").trim())
        .filter(Boolean)
        .map((scheduledStart) => ({
          scheduledStart,
          scheduledEnd: addMinutesToIso(scheduledStart, TRAINING_SESSION_DURATION_MINUTES),
        }))
        .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

      if (parsedSlots.length !== 2) {
        return res.status(400).json({ message: "Both weekly session times are required." });
      }

      const weekInfos = parsedSlots.map((slot) => getLocalWeekInfo(slot.scheduledStart));
      if (weekInfos.some((info) => !info)) {
        return res.status(400).json({ message: "Weekly session dates must be valid." });
      }

      if (weekInfos.some((info) => (info?.weekdayIndex || 0) < 1 || (info?.weekdayIndex || 0) > 6)) {
        return res.status(400).json({ message: "Weekly session dates must fall between Monday and Saturday." });
      }

      const targetWeekStartUtc = weekInfos[0]?.weekStartUtc;
      if (weekInfos.some((info) => info?.weekStartUtc !== targetWeekStartUtc)) {
        return res.status(400).json({ message: "Both weekly session dates must be within the same Monday-to-Saturday week." });
      }

      const nowMs = Date.now();
      if (parsedSlots.some((slot) => new Date(slot.scheduledStart).getTime() <= nowMs)) {
        return res.status(400).json({ message: "Weekly sessions must be scheduled in the future." });
      }

      const slotTimes = parsedSlots.map((slot) => slot.scheduledStart);
      const uniqueSlotTimes = new Set(slotTimes);
      if (uniqueSlotTimes.size !== slotTimes.length) {
        return res.status(400).json({ message: "Weekly session times must be different." });
      }

      const { data: existingSessions, error: existingSessionsError } = await supabase
        .from("scheduled_sessions")
        .select(SCHEDULED_SESSION_SELECT)
        .eq("parent_id", userId)
        .eq("student_id", studentId)
        .eq("tutor_id", enrollment.assigned_tutor_id)
        .eq("type", "training")
        .in("status", ["pending_tutor_confirmation", "pending_parent_confirmation", "confirmed", "ready", "live"])
        .gte("scheduled_time", new Date().toISOString())
        .order("scheduled_time", { ascending: true });

      if (existingSessionsError) {
        return res.status(500).json({ message: "Failed to inspect existing training sessions." });
      }

      const existingTimes = new Set((existingSessions || []).map((session: any) => String(session.scheduled_time)));
      const slotsToInsert = parsedSlots.filter((slot) => !existingTimes.has(slot.scheduledStart));

      if (slotsToInsert.length === 0) {
        return res.json({
          success: true,
          sessions: existingSessions || [],
          createdCount: 0,
        });
      }

      const { data: insertedSessions, error: insertError } = await supabase
        .from("scheduled_sessions")
        .insert(
          slotsToInsert.map((slot) => ({
            parent_id: userId,
            tutor_id: enrollment.assigned_tutor_id,
            student_id: studentId,
            scheduled_time: slot.scheduledStart,
            scheduled_end: slot.scheduledEnd,
            timezone,
            type: "training",
            workflow_stage: "active_training",
            status: "pending_tutor_confirmation",
            parent_confirmed: true,
            tutor_confirmed: false,
            attendance_status: "not_started",
            recording_status: "not_expected_yet",
            transcript_status: "not_expected_yet",
            cohost_sync_status: "not_configured",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))
        )
        .select(SCHEDULED_SESSION_SELECT);

      if (insertError) {
        return res.status(500).json({ message: "Failed to schedule weekly sessions." });
      }

      res.json({
        success: true,
        sessions: insertedSessions || [],
        createdCount: (insertedSessions || []).length,
      });
    } catch (error) {
      console.error("Error scheduling weekly training sessions:", error);
      res.status(500).json({ message: "Failed to schedule weekly sessions" });
    }
  });

  app.post("/api/parent/training-sessions/respond", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser.id;
      const operationalMode = await getParentAssignedTutorOperationalMode(userId);
      const { sessionId, action, scheduledStart, reasonCodes, reasonNote } = req.body as {
        sessionId?: string;
        action?: "confirm" | "reschedule" | "cancel";
        scheduledStart?: string;
        reasonCodes?: string[];
        reasonNote?: string;
      };
      const timezone = String(req.body?.timezone || "Africa/Johannesburg");

      const premiumAccess = await ensurePremiumAccessForParent(userId);
      if (!premiumAccess.allowed) {
        return res.status(premiumAccess.status).json({ message: premiumAccess.message });
      }

      if (!sessionId) {
        return res.status(400).json({ message: "Missing sessionId" });
      }

      if (action !== "confirm" && action !== "reschedule" && action !== "cancel") {
        return res.status(400).json({ message: "Action must be 'confirm', 'reschedule', or 'cancel'" });
      }

      const parentTrainingSessionLookupResult: any = await supabase
        .from("scheduled_sessions")
        .select(SCHEDULED_SESSION_SELECT)
        .eq("id", sessionId)
        .eq("type", "training")
        .maybeSingle();
      const { data: session, error: sessionError } = parentTrainingSessionLookupResult;

      if (sessionError || !session) {
        return res.status(404).json({ message: "Training session not found" });
      }

      if (session.parent_id !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      if (action === "cancel") {
        const normalizedReasonCodes = Array.isArray(reasonCodes)
          ? reasonCodes.map((item) => String(item || "").trim()).filter(Boolean)
          : [];
        if (normalizedReasonCodes.length === 0) {
          return res.status(400).json({ message: "At least one cancellation reason is required." });
        }

        if (["completed", "live", "cancelled", "flagged"].includes(String(session.status || ""))) {
          return res.status(400).json({ message: "This training session can no longer be cancelled" });
        }

        const parentTrainingCancelResult: any = await supabase
          .from("scheduled_sessions")
          .update({
            status: "cancelled",
            parent_confirmed: false,
            tutor_confirmed: false,
            google_calendar_id: null,
            google_event_id: null,
            google_meet_url: null,
            google_conference_id: null,
            google_meet_space_name: null,
            google_meet_code: null,
            host_account_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .select(SCHEDULED_SESSION_SELECT)
          .single();
        const { data: cancelledSession, error: cancelError } = parentTrainingCancelResult;

        if (cancelError || !cancelledSession) {
          return res.status(500).json({ message: "Failed to cancel session" });
        }

        const enrollmentId = await resolveEnrollmentIdForSession(session);
        const cancellationImpact = classifyCancellationBillingImpact({
          actorRole: "parent",
          scheduledTimeIso: session.scheduled_time,
        });
        const monthlyQuota = await recordSessionBillingEvent({
          sessionId: String(sessionId),
          parentId: String(session.parent_id || userId),
          studentId: String(session.student_id || ""),
          enrollmentId,
          eventType: cancellationImpact.eventType,
          actorRole: "parent",
          actorId: String(userId),
          billingImpact: cancellationImpact.impact,
          creditsDelta: cancellationImpact.creditsDelta,
          reasonCodes: normalizedReasonCodes,
          reasonNote: String(reasonNote || "").trim() || null,
          metadata: {
            action: "cancel",
            policy_cutoff_hours: CANCELLATION_CUTOFF_HOURS,
            scheduled_time: session.scheduled_time,
          },
        });

        await safeSendPush(
          cancelledSession.tutor_id,
          {
            title: "Session cancelled",
            body: "A parent cancelled a training session. Open Response Integrity to review the updated week.",
            url: "/operational/tutor/pod",
            tag: `tutor-training-session-cancelled-${sessionId}`,
          },
          "tutor training session cancelled by parent",
        );

        return res.json({
          success: true,
          status: "cancelled",
          session: cancelledSession,
          monthlyQuota,
        });
      }

      if (action === "confirm" && session.status !== "pending_parent_confirmation") {
        return res.status(400).json({ message: "This session is not waiting for parent confirmation" });
      }

      if (action === "reschedule") {
        if (!["pending_parent_confirmation", "pending_tutor_confirmation"].includes(String(session.status || ""))) {
          return res.status(400).json({ message: "This session cannot be rescheduled at this time" });
        }

        const nextStart = String(scheduledStart || "").trim();
        if (!nextStart) {
          return res.status(400).json({ message: "New scheduled time is required" });
        }

        const parsedStart = new Date(nextStart);
        if (Number.isNaN(parsedStart.getTime())) {
          return res.status(400).json({ message: "New scheduled time is invalid" });
        }

        if (parsedStart.getTime() <= Date.now()) {
          return res.status(400).json({ message: "Rescheduled sessions must be in the future." });
        }

        const monthStartIso = getMonthStartIso(session.scheduled_time || new Date().toISOString());
        if (!monthStartIso) {
          return res.status(400).json({ message: "Session month could not be resolved for reschedule policy." });
        }
        const monthStart = monthStartIso.slice(0, 10);
        const nextMonthDate = new Date(monthStartIso);
        nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
        const nextMonth = nextMonthDate.toISOString().slice(0, 10);
        const enrollmentIdForReschedule = await resolveEnrollmentIdForSession(session);
        let isSandboxReschedule = false;
        try {
          if (enrollmentIdForReschedule) {
            const { data: linkedEnrollment } = await supabase
              .from("parent_enrollments")
              .select("id, is_sandbox_account, parent_email, current_step")
              .eq("id", enrollmentIdForReschedule)
              .maybeSingle();
            isSandboxReschedule = isSandboxPaymentEnrollment(linkedEnrollment);
          }
        } catch (err) {
          console.error("Failed to resolve enrollment for reschedule sandbox check:", err);
        }

        const { data: rescheduleEvents } = await supabase
          .from("session_billing_events")
          .select("id")
          .eq("session_id", String(sessionId))
          .eq("event_type", "reschedule_parent")
          .gte("effective_at", `${monthStart}T00:00:00.000Z`)
          .lt("effective_at", `${nextMonth}T00:00:00.000Z`)
          .eq("is_sandbox", isSandboxReschedule);
        if ((rescheduleEvents || []).length >= RESCHEDULE_LIMIT_PER_SESSION_PER_MONTH) {
          return res.status(409).json({
            message: `This session has reached the ${RESCHEDULE_LIMIT_PER_SESSION_PER_MONTH} reschedule limit for the month. COO override is required.`,
          });
        }

        const parentTrainingRescheduleResult: any = await supabase
          .from("scheduled_sessions")
          .update({
            scheduled_time: nextStart,
            scheduled_end: addMinutesToIso(nextStart, TRAINING_SESSION_DURATION_MINUTES),
            timezone,
            parent_confirmed: true,
            tutor_confirmed: false,
            status: "pending_tutor_confirmation",
            google_calendar_id: null,
            google_event_id: null,
            google_meet_url: null,
            google_conference_id: null,
            google_meet_space_name: null,
            google_meet_code: null,
            host_account_id: null,
            recording_file_id: null,
            recording_detected_at: null,
            recording_status: "not_expected_yet",
            transcript_file_id: null,
            transcript_detected_at: null,
            transcript_status: "not_expected_yet",
            attendance_report_file_id: null,
            cohost_sync_status: "not_configured",
            cohost_sync_error: null,
            last_artifact_sync_at: null,
            last_meet_sync_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .select(SCHEDULED_SESSION_SELECT)
          .single();
        const { data: updatedSession, error: updateError } = parentTrainingRescheduleResult;

        if (updateError || !updatedSession) {
          return res.status(500).json({ message: "Failed to reschedule session" });
        }

        const enrollmentId = await resolveEnrollmentIdForSession(session);
        const monthlyQuota = await recordSessionBillingEvent({
          sessionId: String(sessionId),
          parentId: String(session.parent_id || userId),
          studentId: String(session.student_id || ""),
          enrollmentId,
          eventType: "reschedule_parent",
          actorRole: "parent",
          actorId: String(userId),
          billingImpact: "none",
          creditsDelta: 0,
          reasonCodes: Array.isArray(reasonCodes)
            ? reasonCodes.map((item) => String(item || "").trim()).filter(Boolean)
            : [],
          reasonNote: String(reasonNote || "").trim() || null,
          metadata: {
            action: "reschedule",
            from: session.scheduled_time,
            to: nextStart,
          },
        });

        await safeSendPush(
          updatedSession.tutor_id,
          {
            title: "Session rescheduled by parent",
            body: "A parent proposed a new training-session time. Open Response Integrity to review and confirm.",
            url: "/operational/tutor/pod",
            tag: `tutor-training-session-rescheduled-${sessionId}`,
          },
          "tutor training session rescheduled by parent",
        );

        return res.json({
          success: true,
          status: "pending_tutor_confirmation",
          session: updatedSession,
          monthlyQuota,
        });
      }

      const parentTrainingConfirmResult: any = await supabase
        .from("scheduled_sessions")
        .update({
          parent_confirmed: true,
          tutor_confirmed: true,
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .select(SCHEDULED_SESSION_SELECT)
        .single();
      const { data: updatedSession, error: updateError } = parentTrainingConfirmResult;

      if (updateError || !updatedSession) {
        return res.status(500).json({ message: "Failed to confirm session" });
      }

      const trainingParent = updatedSession.parent_id ? await storage.getUser(updatedSession.parent_id) : null;
      const trainingParentName = getDisplayNameForUser(trainingParent, "Parent");

      await safeSendPush(
        updatedSession.tutor_id,
        {
          title: `Session confirmed by ${trainingParentName}`,
          body: `${trainingParentName} confirmed the training session. Open Response Integrity for the latest schedule.`,
          url: "/operational/tutor/pod",
          tag: `tutor-training-session-confirmed-${sessionId}`,
        },
        "tutor training session confirmed by parent",
      );

      try {
        const parent = updatedSession.parent_id ? await storage.getUser(updatedSession.parent_id) : null;
        const parentName = getDisplayNameForUser(parent, "Parent");
        const notificationPayload: any = {
          recipientUserId: updatedSession.tutor_id,
          actorUserId: userId,
          channel: "informational",
          title: `Session confirmed by ${parentName}`,
          message: `${parentName} confirmed the training session. Open Response Integrity for the latest schedule.`,
          link: "/operational/tutor/pod",
          entityType: "scheduled_session",
          entityId: sessionId,
        };

        await storage.createNotification(notificationPayload);
      } catch (error) {
        console.error("Failed to create tutor training-session confirmation notification:", error);
      }

      const assignedStudent = updatedSession.student_id ? await storage.getStudent(updatedSession.student_id) : null;
      const meetSync =
        operationalMode === "training"
          ? null
          : await syncMeetForScheduledSession(updatedSession, {
              studentName: assignedStudent?.name || null,
            });
      const monthlyQuota =
        updatedSession.parent_id && updatedSession.student_id
          ? await getMonthlySessionQuotaSnapshot({
              parentId: String(updatedSession.parent_id),
              studentId: String(updatedSession.student_id),
            })
          : null;

      return res.json({
        success: true,
        status: "confirmed",
        session: updatedSession,
        monthlyQuota,
        googleMeetConfigured: operationalMode === "training" ? false : isGoogleMeetIntegrationAvailable(),
        ...getMeetSyncResponsePayload(meetSync),
      });
    } catch (error) {
      console.error("Error responding to training session:", error);
      res.status(500).json({ message: "Failed to respond to training session" });
    }
  });

  const PHASE_ORDER: TopicPhase[] = [...PHASES];

  const PARENT_MEANING_BY_PHASE: Record<TopicPhase, string> = {
    Clarity: "Your child is building core understanding before speed or pressure work.",
    "Structured Execution": "Your child is becoming more consistent and independent with method.",
    "Controlled Discomfort": "Your child is learning to stay composed when work becomes difficult.",
    "Time Pressure Stability": "Your child is strengthening performance under time pressure.",
  };
  const PARENT_DASHBOARD_COPY_BY_STATE: Record<TopicPhase, Record<TopicStability, { status: string; meaning: string; focus: string }>> = {
    Clarity: {
      Low: {
        status: "Your child is still building a clear understanding of this topic.",
        meaning: "They are not yet fully comfortable with the terms, steps, or logic involved.",
        focus: "We are rebuilding the foundation so they can clearly recognize and understand the problem.",
      },
      Medium: {
        status: "Your child is beginning to understand this topic more clearly.",
        meaning: "They can follow explanations, but still need reinforcement to apply it independently.",
        focus: "We are increasing practice and helping them apply the method more consistently.",
      },
      High: {
        status: "Your child now understands this topic clearly.",
        meaning: "They can recognize the problem and explain the steps with confidence.",
        focus: "We are moving into independent problem-solving to build execution.",
      },
      "High Maintenance": {
        status: "Your child has sustained strong clarity in this topic.",
        meaning: "They have held high performance consistently and are ready for progression decisions.",
        focus: "We are now transitioning into Structured Execution training.",
      },
    },
    "Structured Execution": {
      Low: {
        status: "Your child is learning to apply the steps correctly.",
        meaning: "They understand the topic but struggle to follow the method consistently on their own.",
        focus: "We are reinforcing a clear step-by-step approach so they can start and complete problems reliably.",
      },
      Medium: {
        status: "Your child is becoming more consistent in solving problems.",
        meaning: "They can follow the method in many cases, but still show occasional inconsistency.",
        focus: "We are increasing independent practice to strengthen consistency.",
      },
      High: {
        status: "Your child can now solve problems consistently in this topic.",
        meaning: "They are able to follow the correct steps independently with minimal support.",
        focus: "We are verifying sustained high execution through repeated, constrained practice before introducing more challenging questions to strengthen their response under difficulty.",
      },
      "High Maintenance": {
        status: "Your child has sustained strong execution consistency in this topic.",
        meaning: "They have held high execution quality across sessions and are ready for progression decisions.",
        focus: "We are now transitioning into Controlled Discomfort training.",
      },
    },
    "Controlled Discomfort": {
      Low: {
        status: "Your child is starting to face more challenging problems in this topic.",
        meaning: "They can solve basic problems, but struggle when questions become less familiar.",
        focus: "We are helping them stay calm and start correctly even when the problem feels difficult.",
      },
      Medium: {
        status: "Your child is improving in handling difficult questions.",
        meaning: "They can work through unfamiliar problems, but still show hesitation at times.",
        focus: "We are increasing exposure to harder questions to build stability under difficulty.",
      },
      High: {
        status: "Your child is handling difficult problems well.",
        meaning: "They are able to stay structured and solve unfamiliar questions with stability.",
        focus: "We are preparing them to perform under time pressure.",
      },
      "High Maintenance": {
        status: "Your child has sustained strong performance under challenge in this topic.",
        meaning: "They have held high stability in difficult work and are ready for progression decisions.",
        focus: "We are now transitioning into Time Pressure Stability training.",
      },
    },
    "Time Pressure Stability": {
      Low: {
        status: "Your child is learning to stay structured under time pressure.",
        meaning: "They can solve problems, but may lose structure when working against the clock.",
        focus: "We are helping them maintain their method while working within time limits.",
      },
      Medium: {
        status: "Your child is becoming more stable under time pressure.",
        meaning: "They are improving their ability to complete problems within time while staying structured.",
        focus: "We are increasing timed practice to strengthen consistency.",
      },
      High: {
        status: "Your child is performing consistently under time pressure.",
        meaning: "They can solve problems accurately and maintain structure even under time constraints.",
        focus: "We are maintaining performance and preparing them to transfer this skill to new topics.",
      },
      "High Maintenance": {
        status: "Your child has sustained top stability under time pressure.",
        meaning: "They consistently maintain structure and accuracy under timed conditions.",
        focus: "We are maintaining performance and expanding transfer across related topics.",
      },
    },
  };
  const getParentDashboardCopyForState = (phase?: unknown, stability?: unknown) => {
    const normalizedPhase = tryParsePhase(phase);
    const normalizedStability = normalizeStability(stability || "Low");
    if (!normalizedPhase) {
      return {
        status: "Your child's current training state is being verified.",
        meaning: "We are validating the latest conditioning data before showing a phase update.",
        focus: "The tutor system is reconciling the most recent drill record.",
      };
    }
    return PARENT_DASHBOARD_COPY_BY_STATE[normalizedPhase][normalizedStability];
  };

  const TUTOR_MEANING_BY_PHASE: Record<TopicPhase, string> = {
    Clarity: "Student still needs foundational clarity before independent execution.",
    "Structured Execution": "Student can begin but still needs consistency without tutor carry.",
    "Controlled Discomfort": "Student executes, but destabilizes when challenge spikes.",
    "Time Pressure Stability": "Student can solve, but urgency still tests structure retention.",
  };

  const PHASE_FIELD_WEIGHTS: Record<TopicPhase, Record<string, number>> = {
    Clarity: {
      vocabulary_precision: 30,
      method_recognition: 30,
      reason_clarity: 20,
      immediate_apply_response: 20,
    },
    "Structured Execution": {
      start_behavior: 25,
      step_execution: 30,
      repeatability: 25,
      independence_level: 20,
    },
    "Controlled Discomfort": {
      initial_boss_response: 30,
      first_step_control: 25,
      discomfort_tolerance: 25,
      rescue_dependence: 20,
    },
    "Time Pressure Stability": {
      start_under_time: 20,
      structure_under_time: 35,
      pace_control: 20,
      completion_integrity: 25,
    },
  };

  const normalizeObservationLevel = (value: unknown): "weak" | "partial" | "clear" => {
    return normalizeObservationLevelValue(value);
  };

  const weightedFieldContribution = (weight: number, level: "weak" | "partial" | "clear") => {
    if (level === "clear") return weight;
    if (level === "partial") return Math.round(weight * 0.6);
    return 0;
  };

  const deriveTrainingEntryPhase = (
    diagnosisPhase: TopicPhase,
    _stability: TopicStability,
  ): TopicPhase => {
    // Core model source of truth: diagnosis classifies entry phase/stability only.
    return diagnosisPhase;
  };

  const inferTopicStateFromObservation = (
    observedPhase: TopicPhase,
    previousStability: TopicStability,
    categories: Array<{ key?: string; label?: string; value?: string }>
  ) => {
    const byKey = new Map<string, string>();
    for (const entry of categories || []) {
      const key = String(entry?.key || "").trim();
      const value = String(entry?.value || "").trim();
      if (key && value) byKey.set(key, value);
    }

    const scoreMap = PHASE_FIELD_WEIGHTS[observedPhase] || {};
    let sessionScore = 0;
    Object.entries(scoreMap).forEach(([key, weight]) => {
      const selected = byKey.get(key) || "";
      const level = normalizeObservationLevel(selected);
      sessionScore += weightedFieldContribution(weight, level);
    });
    sessionScore = Math.max(0, Math.min(100, sessionScore));

    const transition = computeTransition(observedPhase, previousStability, sessionScore);
    const projectedPhase: TopicPhase = transition.next_phase;
    const projectedStability: TopicStability = transition.next_stability;
    const phaseDecision: "remain" | "advance" | "regress" =
      transition.transition_reason === "phase progress"
        ? "advance"
        : transition.transition_reason === "stability regress"
        ? "regress"
        : "remain";

    return {
      sessionScore,
      phase: projectedPhase,
      stability: projectedStability,
      phaseDecision,
      nextAction: NEXT_ACTION_ENGINE[projectedPhase][projectedStability].primaryAction,
      constraint: NEXT_ACTION_ENGINE[projectedPhase][projectedStability].rules[0] || null,
      tutorMeaning: TUTOR_MEANING_BY_PHASE[projectedPhase],
      parentMeaning: PARENT_MEANING_BY_PHASE[projectedPhase],
    };
  };

  // Create session
  app.post(
    "/api/tutor/sessions",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      return res.status(410).json({
        message:
          "Manual tutor session logging is deprecated. Record intro and training activity from the Training tab workflow.",
      });
    }
  );

  const parseStructuredReportSummary = (summary: string | null) => {
    if (!summary) return null;
    try {
      const parsed = JSON.parse(summary);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const getIsoWeekNumber = (date: Date) => {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    return Math.ceil((((utcDate as any) - (yearStart as any)) / 86400000 + 1) / 7);
  };

  const formatMonthName = (date: Date) => {
    return date.toLocaleString("en-US", { month: "long", year: "numeric" });
  };

  const parseBossBattleCount = (rawValue: unknown) => {
    const text = String(rawValue || "").trim();
    if (!text) return 0;

    const numericMatches = text.match(/\d+/g);
    if (numericMatches && numericMatches.length > 0) {
      return numericMatches.reduce((sum, value) => sum + Number(value || 0), 0);
    }

    return 1;
  };

  const selectLatestParentEnrollment = async ({
    parentId,
    primarySelect,
    fallbackSelect,
    preferPaidEnrollment = false,
  }: {
    parentId: string;
    primarySelect: string;
    fallbackSelect?: string;
    preferPaidEnrollment?: boolean;
  }) => {
    const resolveParentEmail = async () => {
      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("email")
        .eq("id", parentId)
        .maybeSingle();

      if (userError) {
        console.warn("[selectLatestParentEnrollment] Failed to resolve parent email:", userError.message);
        return null;
      }

      const email = normalizeEmail(userRow?.email);
      return email || null;
    };

    const selectEnrollmentById = async (enrollmentId: string) => {
      const result = await supabase
        .from("parent_enrollments")
        .select(primarySelect)
        .eq("id", enrollmentId)
        .order("updated_at", { ascending: false })
        .limit(1);

      let row: any = result.data?.[0] || null;
      let rowError: any = result.error || null;

      if (
        rowError &&
        fallbackSelect &&
        (
          String(rowError.message || "").includes("assigned_student_id") ||
          String(rowError.message || "").includes("student_gender")
        )
      ) {
        const fallbackResult = await supabase
          .from("parent_enrollments")
          .select(fallbackSelect)
          .eq("id", enrollmentId)
          .order("updated_at", { ascending: false })
          .limit(1);

        row = fallbackResult.data?.[0]
          ? { ...(fallbackResult.data[0] as any), assigned_student_id: null }
          : null;
        rowError = fallbackResult.error || null;
      }

      return { data: row, error: rowError };
    };

    const resolveEnrollmentFromStudent = async () => {
      const parentEmail = await resolveParentEmail();

      let studentQuery = supabase
        .from("students")
        .select("id, parent_enrollment_id, created_at")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false })
        .limit(1);

      let studentResult = await studentQuery;
      let student = studentResult.data?.[0] || null;

      if (!student && parentEmail) {
        studentResult = await supabase
          .from("students")
          .select("id, parent_enrollment_id, created_at")
          .eq("parent_contact", parentEmail)
          .order("created_at", { ascending: false })
          .limit(1);
        student = studentResult.data?.[0] || null;
      }

      if (studentResult.error) {
        return { data: null, error: studentResult.error };
      }

      const parentEnrollmentId = String(student?.parent_enrollment_id || "").trim();
      if (parentEnrollmentId) {
        return selectEnrollmentById(parentEnrollmentId);
      }

      const studentId = String(student?.id || "").trim();
      if (!studentId) {
        return { data: null, error: null };
      }

      const assignedStudentResult = await supabase
        .from("parent_enrollments")
        .select(primarySelect)
        .eq("assigned_student_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1);

      let row = assignedStudentResult.data?.[0] || null;
      let rowError: any = assignedStudentResult.error || null;

      if (
        rowError &&
        fallbackSelect &&
        (
          String(rowError.message || "").includes("assigned_student_id") ||
          String(rowError.message || "").includes("student_gender")
        )
      ) {
        rowError = null;
      }

      return { data: row, error: rowError };
    };

    const primaryResult = await supabase
      .from("parent_enrollments")
      .select(primarySelect)
      .eq("user_id", parentId)
      .order("updated_at", { ascending: false })
      .limit(1);

    let data: any = primaryResult.data?.[0] || null;
    let error: any = primaryResult.error || null;

    if (
      error &&
      fallbackSelect &&
      (
        String(error.message || "").includes("assigned_student_id") ||
        String(error.message || "").includes("student_gender")
      )
    ) {
      const fallbackResult = await supabase
        .from("parent_enrollments")
        .select(fallbackSelect)
        .eq("user_id", parentId)
        .order("updated_at", { ascending: false })
        .limit(1);

      data = fallbackResult.data?.[0]
        ? { ...(fallbackResult.data[0] as any), assigned_student_id: null }
        : null;
      error = fallbackResult.error || null;
    }

    if (!data && !error) {
      const parentEmail = await resolveParentEmail();

      if (parentEmail) {
        const emailResult = await supabase
          .from("parent_enrollments")
          .select(primarySelect)
          .eq("parent_email", parentEmail)
          .order("updated_at", { ascending: false })
          .limit(1);

        data = emailResult.data?.[0] || null;
        error = emailResult.error || null;

        if (
          error &&
          fallbackSelect &&
          (
            String(error.message || "").includes("assigned_student_id") ||
            String(error.message || "").includes("student_gender")
          )
        ) {
          const emailFallbackResult = await supabase
            .from("parent_enrollments")
            .select(fallbackSelect)
            .eq("parent_email", parentEmail)
            .order("updated_at", { ascending: false })
            .limit(1);

          data = emailFallbackResult.data?.[0]
            ? { ...(emailFallbackResult.data[0] as any), assigned_student_id: null }
            : null;
          error = emailFallbackResult.error || null;
        }
      }
    }

    if (!data && !error) {
      const studentLinkedResult = await resolveEnrollmentFromStudent();
      data = studentLinkedResult.data;
      error = studentLinkedResult.error;
    }

    const currentStatus = String((data as any)?.status || "").trim().toLowerCase();
    const currentEnrollmentId = String((data as any)?.id || "").trim();

    if (
      preferPaidEnrollment &&
      !error &&
      (!data || currentStatus === "proposal_sent")
    ) {
      const { data: latestPaidPayment, error: latestPaidPaymentError } = await getLatestPaidPaymentForParent(parentId);

      if (latestPaidPaymentError) {
        console.error("Failed to resolve paid enrollment preference for parent:", latestPaidPaymentError);
      } else {
        const paidEnrollmentId = String(latestPaidPayment?.enrollment_id || "").trim();
        if (paidEnrollmentId && paidEnrollmentId !== currentEnrollmentId) {
          const paidEnrollmentResult = await selectEnrollmentById(paidEnrollmentId);
          if (paidEnrollmentResult.data && !paidEnrollmentResult.error) {
            data = paidEnrollmentResult.data;
            error = null;
          }
        }
      }
    }

    return { data, error };
  };

  const normalizeStudentRecord = (student: any) => {
    if (!student) return null;

    return {
      ...student,
      conceptMastery:
        student.conceptMastery ??
        student.concept_mastery ??
        {},
      personalProfile:
        student.personalProfile ??
        student.personal_profile ??
        null,
      emotionalInsights:
        student.emotionalInsights ??
        student.emotional_insights ??
        null,
      academicDiagnosis:
        student.academicDiagnosis ??
        student.academic_diagnosis ??
        null,
      tutorId: student.tutorId || student.tutor_id || null,
      parentId: student.parentId || student.parent_id || null,
      parentEnrollmentId: student.parentEnrollmentId || student.parent_enrollment_id || null,
      parentContact: student.parentContact || student.parent_contact || null,
      sessionProgress:
        student.sessionProgress ??
        student.session_progress ??
        0,
      confidenceScore:
        student.confidenceScore ??
        student.confidence_score ??
        null,
      createdAt: student.createdAt || student.created_at || null,
      identitySheetCompletedAt:
        student.identitySheetCompletedAt || student.identity_sheet_completed_at || null,
    };
  };

  const resolveCanonicalStudentForEnrollment = async (enrollment: any) => {
    if (!enrollment) return null;
    const tutorId = enrollment?.assigned_tutor_id;

    if (enrollment.assigned_student_id) {
      const assignedStudent = await storage.getStudent(enrollment.assigned_student_id);
      if (assignedStudent) return normalizeStudentRecord(assignedStudent);
    }

    if (enrollment.id) {
      const { data: byEnrollmentId } = await supabase
        .from("students")
        .select("*")
        .eq("parent_enrollment_id", enrollment.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      const matchedByEnrollmentId = (byEnrollmentId || []).find((student: any) =>
        studentMatchesEnrollmentSandboxBoundary(enrollment, student, tutorId)
      );
      if (matchedByEnrollmentId) return normalizeStudentRecord(matchedByEnrollmentId);
    }

    if (
      enrollment.id &&
      enrollment.assigned_tutor_id &&
      enrollment.user_id &&
      enrollment.student_full_name &&
      enrollment.student_grade
    ) {
      try {
        const ensuredStudent = await ensureStudentForEnrollment(enrollment, enrollment.assigned_tutor_id);
        if (ensuredStudent) return normalizeStudentRecord(ensuredStudent);
      } catch (error) {
        console.error("Failed to ensure canonical student for enrollment:", error);
      }
    }

    if (enrollment.assigned_tutor_id && enrollment.user_id && enrollment.student_full_name) {
      const { data: byParentAndName } = await supabase
        .from("students")
        .select("*")
        .eq("parent_id", enrollment.user_id)
        .eq("tutor_id", enrollment.assigned_tutor_id)
        .eq("name", enrollment.student_full_name)
        .order("updated_at", { ascending: false })
        .limit(1);

      const matchedByParentAndName = (byParentAndName || []).find((student: any) =>
        studentMatchesEnrollmentSandboxBoundary(enrollment, student, tutorId)
      );
      if (matchedByParentAndName) return normalizeStudentRecord(matchedByParentAndName);
    }

    return null;
  };

  const resolveAcceptedStudentForEnrollment = async (enrollment: any) => {
    if (!enrollment) return null;

    const candidateMap = new Map<string, any>();
    const addCandidate = (student: any) => {
      const normalized = normalizeStudentRecord(student);
      const studentId = String(normalized?.id || "").trim();
      if (!studentId || candidateMap.has(studentId)) return;
      candidateMap.set(studentId, normalized);
    };

    if (enrollment.assigned_student_id) {
      const assignedStudent = await storage.getStudent(enrollment.assigned_student_id);
      if (assignedStudent) addCandidate(assignedStudent);
    }

    if (enrollment.id) {
      const { data: byEnrollmentId } = await supabase
        .from("students")
        .select("*")
        .eq("parent_enrollment_id", enrollment.id)
        .order("updated_at", { ascending: false })
        .limit(10);

      (byEnrollmentId || []).forEach(addCandidate);
    }

    if (enrollment.assigned_tutor_id && enrollment.user_id && enrollment.student_full_name) {
      const { data: byParentAndName } = await supabase
        .from("students")
        .select("*")
        .eq("parent_id", enrollment.user_id)
        .eq("tutor_id", enrollment.assigned_tutor_id)
        .eq("name", enrollment.student_full_name)
        .order("updated_at", { ascending: false })
        .limit(10);

      (byParentAndName || []).forEach(addCandidate);
    }

    if (enrollment.assigned_tutor_id && enrollment.parent_email && enrollment.student_full_name) {
      const { data: byParentContact } = await supabase
        .from("students")
        .select("*")
        .eq("parent_contact", enrollment.parent_email)
        .eq("tutor_id", enrollment.assigned_tutor_id)
        .eq("name", enrollment.student_full_name)
        .order("updated_at", { ascending: false })
        .limit(10);

      (byParentContact || []).forEach(addCandidate);
    }

    return (
      Array.from(candidateMap.values()).find((student: any) => {
        const workflow = ((student?.personalProfile as any) || {}).workflow || {};
        return !!workflow.assignmentAcceptedAt;
      }) || null
    );
  };

  const hasPostProvisionAssignmentUpdate = (enrollment: any) => {
    const createdAt = new Date(String(enrollment?.created_at || ""));
    const updatedAt = new Date(String(enrollment?.updated_at || ""));

    if (Number.isNaN(createdAt.getTime()) || Number.isNaN(updatedAt.getTime())) {
      return false;
    }

    return updatedAt.getTime() - createdAt.getTime() > 1000;
  };

  type CommunicationAudience = "parent" | "student";

  const COMMUNICATION_AUDIENCES: CommunicationAudience[] = ["parent", "student"];

  const getDisplayNameForUser = (user: any, fallback: string) => {
    if (!user) return fallback;
    return (
      String(
        user.name ||
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.email ||
        fallback
      ).trim() || fallback
    );
  };

  const getCommunicationSenderName = ({
    row,
    tutor,
    parent,
    student,
  }: {
    row: any;
    tutor: any;
    parent: any;
    student: any;
  }) => {
    if (row.sender_role === "tutor") return getDisplayNameForUser(tutor, "Tutor");
    if (row.sender_role === "parent") return getDisplayNameForUser(parent, "Parent");
    if (row.sender_role === "student") return String(student?.name || "Student").trim() || "Student";
    return String(row.sender_role || "User").toUpperCase();
  };

  const ensureStudentCommunicationThread = async ({
    studentId,
    tutorId,
    parentId,
    audience,
  }: {
    studentId: string;
    tutorId: string;
    parentId: string | null;
    audience: CommunicationAudience;
  }) => {
    const { data: existing, error: existingError } = await supabase
      .from("student_communication_threads")
      .select("*")
      .eq("student_id", studentId)
      .eq("audience", audience)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const needsUpdate =
        String(existing.tutor_id || "") !== String(tutorId || "") ||
        String(existing.parent_id || "") !== String(parentId || "");

      if (needsUpdate) {
        const { data: updated, error: updateError } = await supabase
          .from("student_communication_threads")
          .update({
            tutor_id: tutorId,
            parent_id: parentId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (updateError) throw updateError;
        return updated;
      }

      return existing;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("student_communication_threads")
      .insert({
        student_id: studentId,
        tutor_id: tutorId,
        parent_id: parentId,
        audience,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;
    return inserted;
  };

  const markCommunicationThreadRead = async ({
    studentId,
    audience,
    viewerRole,
  }: {
    studentId: string;
    audience: CommunicationAudience;
    viewerRole: "tutor" | "parent" | "student";
  }) => {
    const nowIso = new Date().toISOString();
    const field =
      viewerRole === "tutor"
        ? "read_by_tutor_at"
        : viewerRole === "parent"
          ? "read_by_parent_at"
          : "read_by_student_at";

    const { error } = await supabase
      .from("student_communication_messages")
      .update({ [field]: nowIso })
      .eq("student_id", studentId)
      .eq("audience", audience)
      .is(field, null);

    if (error) {
      console.error("Failed to mark communication thread read:", error);
    }
  };

  const buildStudentCommunicationBundle = async ({
    student,
    parentId,
  }: {
    student: any;
    parentId: string | null;
  }) => {
    const tutor = student?.tutorId ? await storage.getUser(student.tutorId) : null;
    const parent = parentId ? await storage.getUser(parentId) : null;

    const threads = await Promise.all(
      COMMUNICATION_AUDIENCES.map((audience) =>
        ensureStudentCommunicationThread({
          studentId: student.id,
          tutorId: student.tutorId,
          parentId,
          audience,
        })
      )
    );

    const threadsByAudience = Object.fromEntries(
      threads.map((thread) => [thread.audience, thread])
    ) as Record<CommunicationAudience, any>;

    const { data: messageRows, error: messageError } = await supabase
      .from("student_communication_messages")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: true });

    if (messageError) throw messageError;

    const messagesByAudience: Record<CommunicationAudience, any[]> = {
      parent: [],
      student: [],
    };

    const messageRowsById = new Map<string, any>(
      (messageRows || []).map((row: any) => [String(row.id), row])
    );

    for (const row of messageRows || []) {
      const audience = String(row.audience || "") as CommunicationAudience;
      if (!COMMUNICATION_AUDIENCES.includes(audience)) continue;

      const senderName = getCommunicationSenderName({ row, tutor, parent, student });
      const replyTarget = row.reply_to_message_id
        ? messageRowsById.get(String(row.reply_to_message_id))
        : null;

      messagesByAudience[audience].push({
        id: row.id,
        threadId: row.thread_id,
        studentId: row.student_id,
        tutorId: row.tutor_id,
        parentId: row.parent_id,
        audience,
        senderRole: row.sender_role,
        senderUserId: row.sender_user_id,
        senderStudentUserId: row.sender_student_user_id,
        senderName,
        replyToMessageId: row.reply_to_message_id || null,
        replyTo: replyTarget
          ? {
              id: replyTarget.id,
              senderName: getCommunicationSenderName({
                row: replyTarget,
                tutor,
                parent,
                student,
              }),
              message: replyTarget.message,
            }
          : null,
        message: row.message,
        createdAt: row.created_at,
        readByTutorAt: row.read_by_tutor_at,
        readByParentAt: row.read_by_parent_at,
        readByStudentAt: row.read_by_student_at,
      });
    }

    return {
      student: {
        id: student.id,
        name: student.name,
        grade: student.grade || null,
      },
      tutor: tutor
        ? {
            id: tutor.id,
            name: getDisplayNameForUser(tutor, "Tutor"),
          }
        : null,
      parent: parentId
        ? {
            id: parentId,
            name: getDisplayNameForUser(parent, "Parent"),
            available: !!parent,
          }
        : {
            id: null,
            name: "Parent unavailable",
            available: false,
          },
      threads: {
        parent: {
          threadId: threadsByAudience.parent.id,
          audience: "parent",
          messages: messagesByAudience.parent,
        },
        student: {
          threadId: threadsByAudience.student.id,
          audience: "student",
          messages: messagesByAudience.student,
        },
      },
    };
  };

  const createStudentCommunicationMessage = async ({
    student,
    parentId,
    audience,
    senderRole,
    senderUserId,
    senderStudentUserId,
    replyToMessageId,
    message,
  }: {
    student: any;
    parentId: string | null;
    audience: CommunicationAudience;
    senderRole: "tutor" | "parent" | "student";
    senderUserId?: string | null;
    senderStudentUserId?: string | null;
    replyToMessageId?: string | null;
    message: string;
  }) => {
    const thread = await ensureStudentCommunicationThread({
      studentId: student.id,
      tutorId: student.tutorId,
      parentId,
      audience,
    });

    let normalizedReplyToMessageId: string | null = null;
    if (replyToMessageId) {
      const { data: replyTarget, error: replyTargetError } = await supabase
        .from("student_communication_messages")
        .select("id")
        .eq("id", replyToMessageId)
        .eq("thread_id", thread.id)
        .eq("student_id", student.id)
        .eq("audience", audience)
        .maybeSingle();

      if (replyTargetError) throw replyTargetError;
      if (!replyTarget) {
        throw new Error("Reply target is no longer available");
      }

      normalizedReplyToMessageId = replyTarget.id;
    }

    const timestamp = new Date().toISOString();
    const payload: Record<string, any> = {
      thread_id: thread.id,
      student_id: student.id,
      tutor_id: student.tutorId,
      parent_id: parentId,
      audience,
      sender_role: senderRole,
      sender_user_id: senderUserId || null,
      sender_student_user_id: senderStudentUserId || null,
      reply_to_message_id: normalizedReplyToMessageId,
      message,
    };

    if (senderRole === "tutor") payload.read_by_tutor_at = timestamp;
    if (senderRole === "parent") payload.read_by_parent_at = timestamp;
    if (senderRole === "student") payload.read_by_student_at = timestamp;

    const { data: inserted, error: insertError } = await supabase
      .from("student_communication_messages")
      .insert(payload)
      .select("*")
      .single();

    if (insertError) throw insertError;

    await supabase
      .from("student_communication_threads")
      .update({ updated_at: timestamp, parent_id: parentId, tutor_id: student.tutorId })
      .eq("id", thread.id);

    const tutor = student?.tutorId ? await storage.getUser(student.tutorId) : null;
    const senderLabel =
      senderRole === "tutor"
        ? getDisplayNameForUser(tutor, "Tutor")
        : senderRole === "parent"
          ? "Parent"
          : String(student?.name || "Student").trim() || "Student";

    if ((senderRole === "parent" || senderRole === "student") && student?.tutorId) {
      await storage.createNotification({
        recipientUserId: student.tutorId,
        actorUserId: senderUserId || undefined,
        channel: "informational",
        title: `Message from ${senderLabel}`,
        message,
        link: "/operational/tutor/my-pod",
        entityType: "student_communication",
        entityId: inserted.id,
      } as any);
    }

    return inserted;
  };

  const getStudentDashboardStats = async (studentId: string) => {
    const student = await storage.getStudent(studentId);
    if (!student) {
      return {
        introDiagnosisCompleted: 0,
        bossBattlesCompleted: 0,
        solutionsUnlocked: 0,
        currentStreak: 0,
        totalSessions: 0,
        trainingSessionsCompleted: 0,
        confidenceLevel: 50,
      };
    }

    const parseDrillPayload = (value: unknown) => {
      if (typeof value !== "string") return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    const { data: drillRows } = await supabase
      .from("intro_session_drills")
      .select("id, scheduled_session_id, training_session_run_id, submitted_at, drill")
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false });

    const { data: trainingRuns } = await supabase
      .from("training_session_runs")
      .select("id, scheduled_session_id, topic_count, submitted_at, status")
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false });

    const normalizedTrainingRuns = (trainingRuns || []).filter((row: any) =>
      ["submitted", "completed"].includes(String(row?.status || "").toLowerCase())
    );

    const parsedDrills = (drillRows || []).map((row: any) => {
      const payload = parseDrillPayload(row?.drill);
      const inferredType =
        payload?.drillType ||
        (row?.training_session_run_id ? "training" : "diagnosis");

      return {
        id: String(row?.id || ""),
        scheduledSessionId: String(row?.scheduled_session_id || "").trim() || null,
        trainingSessionRunId: String(row?.training_session_run_id || "").trim() || null,
        submittedAt: String(row?.submitted_at || "").trim() || null,
        drillType: String(inferredType || "").trim().toLowerCase(),
      };
    });

    const introDrills = parsedDrills.filter((row) => row.drillType === "diagnosis");
    const trainingDrills = parsedDrills.filter((row) => row.drillType === "training");

    const completedSessionKeys = new Set<string>();
    introDrills.forEach((row) => {
      completedSessionKeys.add(row.scheduledSessionId ? `intro:${row.scheduledSessionId}` : `intro:${row.id}`);
    });
    normalizedTrainingRuns.forEach((row: any) => {
      const runId = String(row?.id || "").trim();
      const scheduledId = String(row?.scheduled_session_id || "").trim();
      if (scheduledId) {
        completedSessionKeys.add(`training:${scheduledId}`);
      } else if (runId) {
        completedSessionKeys.add(`training:${runId}`);
      }
    });

    if (normalizedTrainingRuns.length === 0) {
      const groupedTrainingRunIds = new Set(
        trainingDrills
          .map((row) => row.trainingSessionRunId)
          .filter((value): value is string => !!value)
      );
      groupedTrainingRunIds.forEach((runId) => completedSessionKeys.add(`training:${runId}`));
    }

    const derivedBossBattles =
      normalizedTrainingRuns.length > 0
        ? normalizedTrainingRuns.reduce((sum: number, row: any) => sum + Number(row?.topic_count || 0), 0)
        : trainingDrills.length;

    const derivedSolutionsUnlocked =
      normalizedTrainingRuns.length > 0 ? normalizedTrainingRuns.length : new Set(
        trainingDrills.map((row) => row.trainingSessionRunId || row.id).filter(Boolean)
      ).size;

    const { data: commitments } = await supabase
      .from("student_commitments")
      .select("streak_count")
      .eq("student_id", studentId)
      .eq("is_active", true)
      .order("streak_count", { ascending: false })
      .limit(1);

    const currentStreak = Number(commitments?.[0]?.streak_count || 0);

    return {
      introDiagnosisCompleted: introDrills.length,
      bossBattlesCompleted: derivedBossBattles,
      solutionsUnlocked: derivedSolutionsUnlocked,
      currentStreak,
      totalSessions: completedSessionKeys.size,
      trainingSessionsCompleted:
        normalizedTrainingRuns.length > 0
          ? normalizedTrainingRuns.length
          : new Set(
              trainingDrills.map((row) => row.trainingSessionRunId || row.id).filter(Boolean)
            ).size,
      confidenceLevel: 50,
    };
  };

  const getTTScheduledSessionsByStudent = async (studentId: string) => {
    const { data: sessions } = await supabase
      .from("scheduled_sessions")
      .select(SCHEDULED_SESSION_SELECT)
      .eq("student_id", studentId)
      .in("status", ["completed", "ready", "live", "confirmed"])
      .order("scheduled_time", { ascending: false });

    return sessions || [];
  };

  const getTTScheduledSessionsByTutor = async (tutorId: string) => {
    const { data: sessions } = await supabase
      .from("scheduled_sessions")
      .select(SCHEDULED_SESSION_SELECT)
      .eq("tutor_id", tutorId)
      .in("status", ["completed", "ready", "live", "confirmed"])
      .order("scheduled_time", { ascending: false });

    return sessions || [];
  };

  const getTTScheduledSessionsByTutors = async (tutorIds: string[]) => {
    if (!tutorIds.length) return [];

    const { data: sessions } = await supabase
      .from("scheduled_sessions")
      .select(SCHEDULED_SESSION_SELECT)
      .in("tutor_id", tutorIds)
      .in("status", ["completed", "ready", "live", "confirmed"])
      .order("scheduled_time", { ascending: false });

    return sessions || [];
  };

  const getTutorSessionFeed = async (tutorId: string, studentId?: string | null) => {
    let scheduledQuery = supabase
      .from("scheduled_sessions")
      .select(SCHEDULED_SESSION_SELECT)
      .eq("tutor_id", tutorId)
      .in("status", ["completed", "ready", "live", "confirmed"])
      .order("scheduled_time", { ascending: false });

    if (studentId) {
      scheduledQuery = scheduledQuery.eq("student_id", studentId);
    }

    const { data: scheduledSessions } = await scheduledQuery;
    const scheduledRows = scheduledSessions || [];
    const scheduledIds = scheduledRows.map((row: any) => String(row.id || "")).filter(Boolean);

    let trainingRunsQuery = supabase
      .from("training_session_runs")
      .select("id, scheduled_session_id, topic_count, submitted_at, status")
      .eq("tutor_id", tutorId);
    if (studentId) {
      trainingRunsQuery = trainingRunsQuery.eq("student_id", studentId);
    }
    const { data: trainingRuns } = await trainingRunsQuery;

    let drillRowsQuery = supabase
      .from("intro_session_drills")
      .select("id, student_id, scheduled_session_id, training_session_run_id, submitted_at, drill")
      .eq("tutor_id", tutorId);
    if (studentId) {
      drillRowsQuery = drillRowsQuery.eq("student_id", studentId);
    }
    const { data: drillRows } = await drillRowsQuery;

    const parseDrillPayload = (value: unknown) => {
      if (typeof value !== "string") return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    const runsByScheduledId = new Map<string, any>();
    (trainingRuns || []).forEach((row: any) => {
      const key = String(row?.scheduled_session_id || "").trim();
      if (key) runsByScheduledId.set(key, row);
    });

    const drillsByScheduledId = new Map<string, any[]>();
    (drillRows || []).forEach((row: any) => {
      const key = String(row?.scheduled_session_id || "").trim();
      if (!key) return;
      const bucket = drillsByScheduledId.get(key) || [];
      bucket.push({
        ...row,
        parsed: parseDrillPayload(row?.drill),
      });
      drillsByScheduledId.set(key, bucket);
    });

    const normalized = scheduledRows.map((session: any) => {
      const scheduledId = String(session?.id || "");
      const sessionDrills = drillsByScheduledId.get(scheduledId) || [];
      const trainingRun = runsByScheduledId.get(scheduledId) || null;
      const dateText = String(session?.scheduled_time || session?.created_at || new Date().toISOString());
      const startMs = new Date(dateText).getTime();
      const endMs = new Date(String(session?.scheduled_end || "")).getTime();
      const duration =
        Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
          ? Math.round((endMs - startMs) / 60000)
          : session?.type === "training"
          ? TRAINING_SESSION_DURATION_MINUTES
          : INTRO_SESSION_DURATION_MINUTES;

      const drillType = session?.type === "training" ? "training" : "diagnosis";
      const topicCount =
        session?.type === "training"
          ? Number(trainingRun?.topic_count || sessionDrills.length || 0)
          : sessionDrills.length > 0
          ? 1
          : 0;

      const primaryDrill = sessionDrills[sessionDrills.length - 1]?.parsed || null;
      const activeTopic =
        primaryDrill?.trainingTopic ||
        primaryDrill?.introTopic ||
        primaryDrill?.summary?.topic ||
        null;

      const sessionLabel = session?.type === "training" ? "Response Integrity Training Session" : "Response Integrity Intro Session";
      const status = String(session?.status || "").trim() || "completed";

      return {
        id: scheduledId,
        tutorId: String(session?.tutor_id || tutorId),
        studentId: String(session?.student_id || studentId || ""),
        date: dateText,
        duration,
        notes: `${sessionLabel}${activeTopic ? ` | Active Topic: ${activeTopic}` : ""} | Status: ${status}`,
        vocabularyNotes: session?.type === "training" ? "Response Integrity training execution recorded." : "Response Integrity intro diagnosis recorded.",
        methodNotes: activeTopic ? `Active Topic: ${activeTopic}` : null,
        reasonNotes: primaryDrill?.summary?.nextAction || null,
        studentResponse:
          primaryDrill?.summary?.phase && primaryDrill?.summary?.stability
            ? `Phase: ${primaryDrill.summary.phase} | Stability: ${primaryDrill.summary.stability}`
            : null,
        tutorGrowthReflection: null,
        bossBattlesDone: topicCount > 0 ? String(topicCount) : null,
        practiceProblems: null,
        createdAt: String(session?.created_at || dateText),
      };
    });

    return normalized.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const hydrateStudentsWithSessionProgress = async (tutorId: string, students: any[]) => {
    const studentIds = students.map((student) => student.id).filter(Boolean);
    const drillCounts: Record<string, number> = {};
    const countedSessionKeys = new Set<string>();

    if (studentIds.length > 0) {
      const { data: trainingRuns } = await supabase
        .from("training_session_runs")
        .select("id, student_id, scheduled_session_id, status")
        .eq("tutor_id", tutorId)
        .in("student_id", studentIds);

      const hasTrainingRunsByStudent = new Set<string>();
      (trainingRuns || []).forEach((row: any) => {
        const studentId = String(row?.student_id || "");
        if (!studentId) return;

        const normalizedStatus = String(row?.status || "").trim().toLowerCase();
        if (!["submitted", "completed"].includes(normalizedStatus)) return;

        const scheduledId = String(row?.scheduled_session_id || "").trim();
        const runId = String(row?.id || "").trim();
        if (!scheduledId && !runId) return;

        if (!drillCounts[studentId]) {
          drillCounts[studentId] = 0;
        }
        hasTrainingRunsByStudent.add(studentId);

        const key = scheduledId || runId;
        const seenKey = `${studentId}:${key}`;
        if (countedSessionKeys.has(seenKey)) return;
        countedSessionKeys.add(seenKey);
        drillCounts[studentId] += 1;
      });

      const { data: drills } = await supabase
        .from("intro_session_drills")
        .select("id, student_id, scheduled_session_id, training_session_run_id, drill")
        .eq("tutor_id", tutorId)
        .in("student_id", studentIds);

      (drills || []).forEach((row: any) => {
        const id = String(row.student_id || "");
        if (!id) return;
        if (hasTrainingRunsByStudent.has(id)) return;
        if (!isTrainingDrillRecord(row)) return;

        const scheduledId = String(row?.scheduled_session_id || "").trim();
        const runId = String(row?.training_session_run_id || "").trim();
        const drillId = String(row?.id || "").trim();
        const key = scheduledId || runId || drillId;
        if (!key) return;

        if (!drillCounts[id]) {
          drillCounts[id] = 0;
        }
        const seenKey = `${id}:${key}`;
        if (countedSessionKeys.has(seenKey)) return;
        countedSessionKeys.add(seenKey);
        drillCounts[id] += 1;
      });
    }

    return students.map((student) => ({
      ...student,
      sessionProgress: drillCounts[String(student.id)] || 0,
    }));
  };

  const mapParentFacingReport = (report: any, tutorName?: string | null) => {
    const structured = parseStructuredReportSummary(report.summary) || {};
    const parentList = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      }

      const text = String(value || "").trim();
      if (!text) return [];

      return text
        .split(/\s*\|\s*|;\s+|\n+/)
        .map((item) => item.trim())
        .filter(Boolean);
    };
    const normalizeCurrentPosition = (value: unknown) => {
      if (!Array.isArray(value)) return [];

      return value
        .map((row: any) => ({
          topic: String(row?.topic || "").trim(),
          state: String(row?.state || "").trim(),
          position: String(row?.position || "").trim(),
        }))
        .filter((row: any) => row.topic.length > 0);
    };

    const base = {
      id: report.id,
      reportType: report.report_type,
      sentAt: report.sent_at,
      tutor: {
        name: tutorName || "Tutor",
      },
      parentFeedback: report.parent_feedback || null,
      parentFeedbackAt: report.parent_feedback_at || null,
    };

    if (report.report_type === "weekly") {
      return {
        ...base,
        weekRange:
          structured.weekStartDate && structured.weekEndDate
            ? {
                start: structured.weekStartDate,
                end: structured.weekEndDate,
              }
            : null,
        sessionsCompleted: Number(structured.sessionsCompletedThisWeek || report.solutions_unlocked || 0),
        topicsWorkedOn: parentList(structured.topicsWorkedOn || report.topics_learned),
        whatChanged: parentList(structured.whatChanged || report.strengths),
        breakdownPattern: parentList(structured.breakdownPattern || report.areas_for_growth),
        whatThisMeans: parentList(structured.whatThisMeans || structured.interpretationThisWeek),
        nextMove: parentList(structured.nextMove || report.next_steps),
      };
    }

    return {
      ...base,
      monthRange:
        structured.monthStartDate && structured.monthEndDate
            ? {
                start: structured.monthStartDate,
                end: structured.monthEndDate,
              }
            : null,
      monthName: report.month_name || null,
      totalSessionsCompleted: Number(structured.totalSessionsCompletedThisMonth || report.solutions_unlocked || 0),
      topicsConditioned: parentList(structured.topicsConditioned || report.topics_learned),
      systemMovement: parentList(structured.systemMovement || report.strengths),
      whatBecameStronger: parentList(structured.whatBecameStronger || report.strengths),
      breakdownPattern: parentList(structured.breakdownPattern || report.areas_for_growth),
      currentPosition: normalizeCurrentPosition(structured.currentPosition),
      whatThisMeans: parentList(structured.whatThisMeans || structured.interpretationThisMonth),
      nextMonthMove: parentList(structured.nextMonthMove || report.next_steps),
    };
  };

  // Get all reports created by tutor (optional student filter)
  app.get(
    "/api/tutor/reports",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const studentId = typeof req.query.studentId === "string" ? req.query.studentId : null;

        let query = supabase
          .from("parent_reports")
          .select("*")
          .eq("tutor_id", tutorId)
          .order("sent_at", { ascending: false });

        if (studentId) {
          query = query.eq("student_id", studentId);
        }

        const { data, error } = await query;
        if (error) {
          throw error;
        }

        const reports = (data || []).map((report: any) => ({
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
          structuredData: parseStructuredReportSummary(report.summary),
        }));

        res.json(reports);
      } catch (error) {
        console.error("Error fetching tutor reports:", error);
        res.status(500).json({ message: "Failed to fetch tutor reports" });
      }
    }
  );

  // Reports center data per student (sessions + weekly/monthly reports)
  app.get(
    "/api/tutor/students/:studentId/reports-center",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const { studentId } = req.params;

        const student = await storage.getStudent(studentId);
        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const { data: drillRows, error: drillRowsError } = await supabase
          .from("intro_session_drills")
          .select("id, student_id, tutor_id, drill, submitted_at")
          .eq("student_id", studentId)
          .eq("tutor_id", tutorId)
          .order("submitted_at", { ascending: false });

        if (drillRowsError) {
          throw drillRowsError;
        }

        const sessions = aggregateDeterministicSessions(drillRows || []);

        const { data: reports, error: reportsError } = await supabase
          .from("parent_reports")
          .select("*")
          .eq("student_id", studentId)
          .eq("tutor_id", tutorId)
          .order("sent_at", { ascending: false });

        if (reportsError) {
          throw reportsError;
        }

        const enrichedReports = (reports || []).map((report: any) => ({
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
          structuredData: parseStructuredReportSummary(report.summary),
        }));

        res.json({
          sessions,
          reports: enrichedReports,
        });
      } catch (error) {
        console.error("Error fetching reports center data:", error);
        res.status(500).json({ message: "Failed to fetch reports center data" });
      }
    }
  );

  // Create weekly parent report
  app.post(
    "/api/tutor/reports/weekly",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const { studentId, weekStartDate, weekEndDate, internalWeeklyTutorNote } = req.body || {};

        if (!studentId) {
          return res.status(400).json({ message: "Missing required studentId" });
        }

        const student = await storage.getStudent(studentId);
        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const parentId = await resolveParentIdForStudent(student, tutorId);

        if (!parentId) {
          return res.status(400).json({ message: "Unable to resolve parent for this student" });
        }

        let drillQuery = supabase
          .from("intro_session_drills")
          .select("id, drill, submitted_at")
          .eq("student_id", studentId)
          .eq("tutor_id", tutorId)
          .order("submitted_at", { ascending: true });

        if (weekStartDate) {
          drillQuery = drillQuery.gte("submitted_at", `${weekStartDate}T00:00:00.000Z`);
        }
        if (weekEndDate) {
          drillQuery = drillQuery.lte("submitted_at", `${weekEndDate}T23:59:59.999Z`);
        }

        const { data: drillRows, error: drillRowsError } = await drillQuery;
        if (drillRowsError) throw drillRowsError;

        if (!drillRows || drillRows.length === 0) {
          return res.status(400).json({ message: "No drill sessions found for the selected week range" });
        }

        const structuredData = createWeeklyStructuredDataFromDrills(drillRows);
        if (!structuredData) {
          return res.status(400).json({ message: "Unable to generate weekly report from drill data" });
        }
        structuredData.internalWeeklyTutorNote = String(internalWeeklyTutorNote || "");

        const inserted = await insertWeeklyReport({
          tutorId,
          studentId,
          parentId,
          structuredData,
        });

        res.json({
          ...inserted,
          structuredData,
        });
      } catch (error) {
        console.error("Error creating weekly report:", error);
        res.status(500).json({ message: "Failed to create weekly report" });
      }
    }
  );

  // Create monthly parent report
  app.post(
    "/api/tutor/reports/monthly",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const { studentId, monthStartDate, monthEndDate, internalMonthlyTutorNote } = req.body || {};

        if (!studentId) {
          return res.status(400).json({ message: "Missing required studentId" });
        }

        const student = await storage.getStudent(studentId);
        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const parentId = await resolveParentIdForStudent(student, tutorId);

        if (!parentId) {
          return res.status(400).json({ message: "Unable to resolve parent for this student" });
        }

        let drillQuery = supabase
          .from("intro_session_drills")
          .select("id, drill, submitted_at")
          .eq("student_id", studentId)
          .eq("tutor_id", tutorId)
          .order("submitted_at", { ascending: true });

        if (monthStartDate) {
          drillQuery = drillQuery.gte("submitted_at", `${monthStartDate}T00:00:00.000Z`);
        }
        if (monthEndDate) {
          drillQuery = drillQuery.lte("submitted_at", `${monthEndDate}T23:59:59.999Z`);
        }

        const { data: drillRows, error: drillRowsError } = await drillQuery;
        if (drillRowsError) throw drillRowsError;

        if (!drillRows || drillRows.length === 0) {
          return res.status(400).json({ message: "No drill sessions found for the selected month range" });
        }

        const structuredData = createMonthlyStructuredDataFromDrills(drillRows);
        if (!structuredData) {
          return res.status(400).json({ message: "Unable to generate monthly report from drill data" });
        }
        (structuredData as any).internalMonthlyTutorNote = String(internalMonthlyTutorNote || "");

        const inserted = await insertMonthlyReport({
          tutorId,
          studentId,
          parentId,
          structuredData,
        });

        res.json({
          ...inserted,
          structuredData,
        });
      } catch (error) {
        console.error("Error creating monthly report:", error);
        res.status(500).json({ message: "Failed to create monthly report" });
      }
    }
  );

  // Get tutor's reflections
  app.get(
    "/api/tutor/reflections",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const reflections = await storage.getReflectionsByTutor(tutorId);
        res.json(reflections);
      } catch (error) {
        console.error("Error fetching reflections:", error);
        res.status(500).json({ message: "Failed to fetch reflections" });
      }
    }
  );

  // Create reflection
  app.post(
    "/api/tutor/reflections",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const reflection = await storage.createReflection({
          tutorId,
          date: new Date(),
          reflectionText: req.body.reflectionText,
        });
        res.json(reflection);
      } catch (error) {
        console.error("Error creating reflection:", error);
        res.status(400).json({ message: "Failed to create reflection" });
      }
    }
  );

  // ========================================
  // SCHOOL TRACKER ROUTES (Academic Profiles & Struggle Targets)
  // ========================================

  // Get tutor's own academic profile
  app.get(
    "/api/tutor/profile",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        const profile = await storage.getAcademicProfile(dbUser.id);
        res.json(profile);
      } catch (error) {
        console.error("Error fetching tutor's academic profile:", error);
        res.status(500).json({ message: "Failed to fetch academic profile" });
      }
    }
  );

  // Create or update tutor's own academic profile
  app.post(
    "/api/tutor/profile",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        console.log("Saving profile for user:", dbUser.id);
        console.log("Request body:", req.body);
        const data = insertAcademicProfileSchema.parse({
          ...req.body,
          studentId: dbUser.id,
        });
        console.log("Parsed data:", data);
        const profile = await storage.upsertAcademicProfile(data);
        console.log("Saved profile:", profile);
        res.json(profile);
      } catch (error) {
        console.error("Error saving tutor's academic profile:", error);
        res.status(400).json({ message: `Failed to save academic profile: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
  );

  // Get tutor's user profile (phone, bio, profile picture)
  app.get(
    "/api/tutor/user-profile",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        const user = await storage.getUser(dbUser.id);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
      } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Failed to fetch user profile" });
      }
    }
  );

  // Update tutor's user profile (phone, bio)
  app.put(
    "/api/tutor/profile",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        const { phone, bio } = req.body;
        
        const updated = await storage.updateUserProfile(dbUser.id, {
          phone: phone || null,
          bio: bio || null,
        });
        
        if (!updated) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json(updated);
      } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(400).json({ message: "Failed to update user profile" });
      }
    }
  );

  // Upload profile image
  app.post(
    "/api/tutor/profile/upload-image",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        const { imageBase64, imageMime } = req.body;

        if (!imageBase64) {
          return res.status(400).json({ message: "No image data provided" });
        }

        console.log(`Received profile image for tutor ${dbUser.id} - size: ${imageBase64.length} chars, mime: ${imageMime}`);

        // Store as data URL directly in database
        const dataUrl = `data:${imageMime || 'image/jpeg'};base64,${imageBase64}`;
        console.log(`Data URL length: ${dataUrl.length} chars`);

        // Update user profile with data URL
        console.log("Updating user profile with image...");
        const updated = await storage.updateUserProfile(dbUser.id, {
          profileImageUrl: dataUrl,
        });

        console.log("Update result:", updated ? "success" : "no result");

        if (!updated) {
          console.error("updateUserProfile returned undefined");
          return res.status(404).json({ message: "User not found" });
        }

        console.log(`Profile picture stored for user ${dbUser.id}`);
        res.json(updated);
      } catch (error) {
        console.error("Error uploading profile image:", error);
        res.status(500).json({ 
          message: "Failed to upload profile image",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  // Delete profile image
  app.delete(
    "/api/tutor/profile/image",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        
        const updated = await storage.updateUserProfile(dbUser.id, {
          profileImageUrl: null,
        });

        if (!updated) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(updated);
      } catch (error) {
        console.error("Error removing profile image:", error);
        res.status(500).json({ message: "Failed to remove profile image" });
      }
    }
  );

  // Get student's academic profile
  app.get(
    "/api/tutor/students/:studentId/profile",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const profile = await storage.getAcademicProfile(studentId);
        res.json(profile);
      } catch (error) {
        console.error("Error fetching academic profile:", error);
        res.status(500).json({ message: "Failed to fetch academic profile" });
      }
    }
  );

  // Create or update student's academic profile
  app.post(
    "/api/tutor/students/:studentId/profile",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const data = insertAcademicProfileSchema.parse({
          ...req.body,
          studentId,
        });
        const profile = await storage.upsertAcademicProfile(data);
        res.json(profile);
      } catch (error) {
        console.error("Error saving academic profile:", error);
        res.status(400).json({ message: "Failed to save academic profile" });
      }
    }
  );

  // Get tutor's own struggle targets
  app.get(
    "/api/tutor/targets",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        const targets = await storage.getStruggleTargets(dbUser.id);
        res.json(targets);
      } catch (error) {
        console.error("Error fetching tutor's struggle targets:", error);
        res.status(500).json({ message: "Failed to fetch struggle targets" });
      }
    }
  );

  // Get student's struggle targets
  app.get(
    "/api/tutor/students/:studentId/targets",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const targets = await storage.getStruggleTargets(studentId);
        res.json(targets);
      } catch (error) {
        console.error("Error fetching struggle targets:", error);
        res.status(500).json({ message: "Failed to fetch struggle targets" });
      }
    }
  );

  // Save student identity sheet
  app.post(
    "/api/tutor/students/:studentId/identity-sheet",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const dbUser = (req as any).dbUser;
        const formData = req.body;

        console.log("📥 Received formData.confidenceTriggers:", formData.confidenceTriggers);
        console.log("Type:", typeof formData.confidenceTriggers, "IsArray:", Array.isArray(formData.confidenceTriggers));
        console.log("📥 Received formData.confidenceKillers:", formData.confidenceKillers);
        console.log("Type:", typeof formData.confidenceKillers, "IsArray:", Array.isArray(formData.confidenceKillers));

        // Verify student exists and belongs to this tutor
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        if (student.tutorId !== dbUser.id) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        // Update student with identity sheet data
        console.log("Saving confidenceTriggers:", formData.confidenceTriggers, "Type:", typeof formData.confidenceTriggers, "IsArray:", Array.isArray(formData.confidenceTriggers));
        console.log("Saving confidenceKillers:", formData.confidenceKillers, "Type:", typeof formData.confidenceKillers, "IsArray:", Array.isArray(formData.confidenceKillers));
        
        const updatedStudent = await storage.updateStudent(studentId, {
          personalProfile: {
            name: formData.name,
            grade: formData.grade,
            school: formData.school,
            learningId: formData.learningId,
            personalityType: formData.personalityType,
            longTermGoals: formData.longTermGoals,
          },
          emotionalInsights: {
            relationshipWithMath: formData.relationshipWithMath,
            confidenceTriggers: formData.confidenceTriggers,
            confidenceKillers: formData.confidenceKillers,
            pressureResponse: formData.pressureResponse,
            growthDrivers: formData.growthDrivers,
          },
          academicDiagnosis: {
            currentClassTopics: formData.currentClassTopics,
            strugglesWith: formData.strugglesWith,
            gapsIdentified: formData.gapsIdentified,
            bossBattlesCompleted: formData.bossBattlesCompleted,
            lastBossBattleResult: formData.lastBossBattleResult,
            tutorNotes: formData.tutorNotes,
          },
          identitySheet: formData.identitySheetResponses,
          identitySheetCompletedAt: new Date(),
        } as any);

        res.json({
          success: true,
          message: "Identity sheet saved successfully",
          student: updatedStudent,
        });
      } catch (error) {
        console.error("Error saving identity sheet:", error);
        res.status(500).json({
          message: "Failed to save identity sheet",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Get student identity sheet
  app.get(
    "/api/tutor/students/:studentId/identity-sheet",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const dbUser = (req as any).dbUser;
        console.log("📋 Identity sheet request:", {
          studentId,
          tutorId: dbUser?.id,
          origin: req.headers.origin,
          authHeader: req.headers.authorization ? 'present' : 'missing',
        });
        
        console.log("📋 Identity sheet request - studentId:", studentId, "tutorId:", dbUser?.id);

        // Verify student exists and belongs to this tutor
        const student = await storage.getStudent(studentId);
        if (!student) {
          console.log("❌ Student not found:", studentId);
          return res.status(404).json({ message: "Student not found" });
        }

        console.log("✅ Student found:", student.id, "student.tutorId:", student.tutorId);

        if (student.tutorId !== dbUser.id) {
          console.log("❌ Tutor mismatch - student.tutorId:", student.tutorId, "dbUser.id:", dbUser.id);
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        // Return identity sheet data if it exists
        const identitySheetData = {
          personalProfile: student.personalProfile || null,
          emotionalInsights: student.emotionalInsights || null,
          academicDiagnosis: student.academicDiagnosis || null,
          identitySheet: student.identitySheet || null,
          completedAt: student.identitySheetCompletedAt || null,
        };

        console.log("✅ Returning identity sheet data for student:", studentId);
        res.json(identitySheetData);
      } catch (error) {
        console.error("Error fetching identity sheet:", error);
        res.status(500).json({ message: "Failed to fetch identity sheet" });
      }
    }
  );

  // Get student assignments (form submissions)
  app.get(
    "/api/tutor/students/:studentId/assignments",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const dbUser = (req as any).dbUser;

        // Verify student exists and belongs to this tutor
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        if (student.tutorId !== dbUser.id) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        // Get all assignments for this student
        const { data: assignments, error } = await supabase
          .from("assignments")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching assignments:", error);
          return res.status(500).json({ message: "Failed to fetch assignments" });
        }

        res.json(assignments || []);
      } catch (error) {
        console.error("Error fetching student assignments:", error);
        res.status(500).json({ message: "Failed to fetch assignments" });
      }
    }
  );

  // Get persisted student workflow state for tutor card actions
  app.get(
    "/api/tutor/students/:studentId/workflow-state",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const dbUser = (req as any).dbUser;

        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        if (student.tutorId !== dbUser.id) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        const { session: introSession } = await resolveTutorScheduledSession(
          dbUser.id,
          studentId,
          "intro"
        );


        const personalProfile = (student.personalProfile as any) || {};
        const workflow = personalProfile.workflow || {};
        await promoteAcceptedEnrollmentIfNeeded(student, dbUser.id);

        let { data: latestProposal } = await supabase
          .from("onboarding_proposals")
          .select("sent_at, accepted_at, enrollment_id")
          .eq("student_id", studentId)
          .eq("tutor_id", dbUser.id)
          .order("created_at", { ascending: false })
          .maybeSingle();

        let enrollmentForStudent: { status: string } | null = null;
        const explicitEnrollmentId = String(
          (student as any).parentEnrollmentId || (student as any).parent_enrollment_id || ""
        ).trim();
        if (explicitEnrollmentId) {
          const { data: enrollmentById } = await supabase
            .from("parent_enrollments")
            .select("status")
            .eq("assigned_tutor_id", dbUser.id)
            .eq("id", explicitEnrollmentId)
            .maybeSingle();
          enrollmentForStudent = enrollmentById;
        }

        if (!enrollmentForStudent) {
          const parentId = (student as any).parentId || null;
          if (parentId) {
            const { data: enrollmentByParent } = await supabase
              .from("parent_enrollments")
              .select("status")
              .eq("assigned_tutor_id", dbUser.id)
              .eq("user_id", parentId)
              .eq("status", "awaiting_tutor_acceptance")
              .maybeSingle();
            enrollmentForStudent = enrollmentByParent;
          }
        }

        const isPendingTutorAcceptance = enrollmentForStudent?.status === "awaiting_tutor_acceptance";

        // Fallback: if not found, try by tutor_id + enrollment_id (pre-acceptance)
        if (!latestProposal) {
          // Find enrollment for this student
          let enrollmentId = null;
          // Prefer parent_enrollment_id if present (new field)
          if ((student as any).parentEnrollmentId || (student as any).parent_enrollment_id) {
            enrollmentId = (student as any).parentEnrollmentId || (student as any).parent_enrollment_id;
          } else if ((student as any).parentId) {
            // Try to find enrollment by parentId and tutorId
            const { data: enroll } = await supabase
              .from("parent_enrollments")
              .select("id")
              .eq("user_id", (student as any).parentId)
              .eq("assigned_tutor_id", dbUser.id)
              .maybeSingle();
            enrollmentId = enroll?.id || null;
          }
          if (enrollmentId) {
            const { data: fallbackProposal } = await supabase
              .from("onboarding_proposals")
              .select("sent_at, accepted_at, enrollment_id")
              .eq("enrollment_id", enrollmentId)
              .eq("tutor_id", dbUser.id)
              .order("created_at", { ascending: false })
              .maybeSingle();
            if (fallbackProposal) latestProposal = fallbackProposal;
          } else if (student.parentContact) {
            // As a last resort, try to find a proposal by parent email + tutor id
            const { data: enroll } = await supabase
              .from("parent_enrollments")
              .select("id")
              .eq("parent_email", student.parentContact)
              .eq("assigned_tutor_id", dbUser.id)
              .maybeSingle();
            if (enroll && enroll.id) {
              const { data: fallbackProposal } = await supabase
                .from("onboarding_proposals")
                .select("sent_at, accepted_at, enrollment_id")
                .eq("enrollment_id", enroll.id)
                .eq("tutor_id", dbUser.id)
                .order("created_at", { ascending: false })
                .maybeSingle();
              if (fallbackProposal) latestProposal = fallbackProposal;
            }
          }
        }

        console.log("[DEBUG] /api/tutor/students/:studentId/workflow-state", {
          studentId,
          tutorId: dbUser.id,
          latestProposal
        });
        const conceptMastery = student.conceptMastery && typeof student.conceptMastery === "object"
          ? (student.conceptMastery as any)
          : {};
        const topicConditioningStore =
          conceptMastery.topicConditioning && typeof conceptMastery.topicConditioning === "object"
            ? conceptMastery.topicConditioning
            : {};
        const topicConditioningTopics =
          topicConditioningStore.topics && typeof topicConditioningStore.topics === "object"
            ? topicConditioningStore.topics
            : {};
        const hasTopicConditioningEvidence =
          Object.keys(topicConditioningTopics).length > 0 ||
          !!String(topicConditioningStore.topic || "").trim() ||
          !!String(topicConditioningStore.entry_phase || "").trim();
        const handoverVerificationRequired = !!workflow.handoverRequiredAt && !workflow.handoverCompletedAt;

        let handoverSession: any = null;
        if (handoverVerificationRequired) {
          const { session: resolvedHandoverSession } = await resolveTutorScheduledSession(
            dbUser.id,
            studentId,
            "handover"
          );
          handoverSession = resolvedHandoverSession;
        }

        const { data: recentDrillRows } = await supabase
          .from("intro_session_drills")
          .select("id, drill, submitted_at")
          .eq("student_id", studentId)
          .eq("tutor_id", dbUser.id)
          .order("submitted_at", { ascending: false })
          .limit(8);

        let hasDiagnosisEvidence = false;
        let hasTrainingEvidence = false;
        for (const row of recentDrillRows || []) {
          try {
            const parsed = row?.drill && typeof row.drill === "object"
              ? row.drill
              : JSON.parse(typeof row?.drill === "string" ? row.drill : "{}");
            const drillType = String(parsed?.drillType || "").trim().toLowerCase();
            if (drillType === "diagnosis") {
              hasDiagnosisEvidence = true;
            }
            if (drillType === "training") {
              hasTrainingEvidence = true;
            }
            if (hasDiagnosisEvidence && hasTrainingEvidence) {
              break;
            }
          } catch {
            // Ignore malformed historical drill rows and fall back to other evidence.
          }
        }

        const inferredIntroCompleted =
          !!workflow.introCompletedAt ||
          hasTopicConditioningEvidence ||
          hasDiagnosisEvidence ||
          hasTrainingEvidence;

        const assignmentAccepted = isPendingTutorAcceptance
          ? false
          : !!(
              workflow.assignmentAcceptedAt ||
              (enrollmentForStudent && enrollmentForStudent.status !== "awaiting_tutor_acceptance")
            );
        const enrollmentStatus = String(enrollmentForStudent?.status || "").trim().toLowerCase();
        const inferredProposalSent =
          !!latestProposal?.sent_at ||
          ["proposal_sent", "session_booked", "report_received", "confirmed"].includes(enrollmentStatus) ||
          hasTrainingEvidence;
        const inferredProposalAccepted =
          !!latestProposal?.accepted_at ||
          ["session_booked", "report_received", "confirmed"].includes(enrollmentStatus) ||
          hasTrainingEvidence;

        const effectiveIntroStatus = getEffectiveScheduledSessionStatus(introSession);
        const effectiveHandoverStatus = handoverSession
          ? getEffectiveScheduledSessionStatus(handoverSession)
          : "not_scheduled";

        res.json({
          assignmentAccepted,
          introConfirmed: ["confirmed", "ready", "live", "completed"].includes(String(effectiveIntroStatus || "")),
          introCompleted: inferredIntroCompleted,
          handoverVerificationRequired,
          handoverSessionConfirmed: ["confirmed", "ready", "live", "completed"].includes(String(effectiveHandoverStatus || "")),
          handoverCompleted: !!workflow.handoverCompletedAt,
          identitySaved: !!student.identitySheetCompletedAt,
          proposalSent: inferredProposalSent,
          proposalAccepted: inferredProposalAccepted,
        });
      } catch (error) {
        console.error("Error fetching workflow state:", error);
        res.status(500).json({ message: "Failed to fetch workflow state" });
      }
    }
  );

  // Mark intro session completed (persisted)
  app.post(
    "/api/tutor/students/:studentId/workflow/assignment-decision",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const { decision, enrollmentId } = req.body as { decision?: "accept" | "decline"; enrollmentId?: string | null };
        const dbUser = (req as any).dbUser;

        if (decision !== "accept" && decision !== "decline") {
          return res.status(400).json({ message: "Decision must be 'accept' or 'decline'" });
        }

        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        if (student.tutorId !== dbUser.id) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        const existingProfile = (student.personalProfile as any) || {};
        const workflow = existingProfile.workflow || {};

        if (decision === "accept") {
          // Resolve the exact parent enrollment for this student assignment before accepting.
          let parentEnrollment: any = null;
          const requestedEnrollmentId = String(enrollmentId || "").trim();
          const explicitEnrollmentId = String(
            (student as any)?.parentEnrollmentId || (student as any)?.parent_enrollment_id || ""
          ).trim();
          const normalizedStudentName = String(student?.name || req.body.studentName || "").trim();
          const normalizedParentId = String((student as any)?.parentId || (student as any)?.parent_id || "").trim();
          const normalizedParentEmail = String((student as any)?.parentContact || (student as any)?.parent_contact || "").trim().toLowerCase();

          if (requestedEnrollmentId) {
            const { data } = await supabase
              .from("parent_enrollments")
              .select("id, user_id, status, current_step, proposal_id, assigned_tutor_id, parent_email, student_full_name, is_sandbox_account")
              .eq("id", requestedEnrollmentId)
              .maybeSingle();
            const matchesStudentContext =
              !!data &&
              (
                Boolean((data as any).is_sandbox_account) ||
                String(data.assigned_tutor_id || "").trim() === String(dbUser.id || "").trim() ||
                String(data.user_id || "").trim() === normalizedParentId ||
                String(data.parent_email || "").trim().toLowerCase() === normalizedParentEmail ||
                String(data.student_full_name || "").trim().toLowerCase() === normalizedStudentName.toLowerCase()
              );
            parentEnrollment = matchesStudentContext ? data : null;
          }

          if (!parentEnrollment && explicitEnrollmentId) {
            const { data } = await supabase
              .from("parent_enrollments")
              .select("id, user_id, status, current_step, proposal_id, assigned_tutor_id")
              .eq("id", explicitEnrollmentId)
              .maybeSingle();
            parentEnrollment =
              data && (
                String(data.assigned_tutor_id || "").trim() === String(dbUser.id || "").trim() ||
                !String(data.assigned_tutor_id || "").trim()
              )
                ? data
                : null;
          }

          if (!parentEnrollment && explicitEnrollmentId) {
            const { data } = await supabase
              .from("parent_enrollments")
              .select("id, user_id, status, current_step, proposal_id, parent_email, student_full_name")
              .eq("assigned_tutor_id", dbUser.id)
              .eq("id", explicitEnrollmentId)
              .maybeSingle();
            parentEnrollment = data;
          }

          if (!parentEnrollment) {
            let compositeLookup = supabase
              .from("parent_enrollments")
              .select("id, user_id, status, current_step, proposal_id, parent_email, student_full_name")
              .eq("assigned_tutor_id", dbUser.id)
              .order("updated_at", { ascending: false })
              .limit(10);

            if (normalizedParentId) {
              compositeLookup = compositeLookup.eq("user_id", normalizedParentId);
            }

            const { data } = await compositeLookup;
            const candidateEnrollments = data || [];

            parentEnrollment =
              candidateEnrollments.find((entry: any) => {
                const entryStudentName = String(entry?.student_full_name || "").trim().toLowerCase();
                const entryParentEmail = String(entry?.parent_email || "").trim().toLowerCase();
                const sameStudent = normalizedStudentName
                  ? entryStudentName === normalizedStudentName.toLowerCase()
                  : true;
                const sameEmail = normalizedParentEmail
                  ? entryParentEmail === normalizedParentEmail
                  : true;
                return sameStudent && sameEmail;
              }) ||
              candidateEnrollments.find((entry: any) => {
                const entryStudentName = String(entry?.student_full_name || "").trim().toLowerCase();
                return normalizedStudentName
                  ? entryStudentName === normalizedStudentName.toLowerCase()
                  : false;
              }) ||
              null;
          }

          if (!parentEnrollment && normalizedParentEmail) {
            const { data } = await supabase
                .from("parent_enrollments")
                .select("id, user_id, status, current_step, proposal_id, parent_email, student_full_name")
                .eq("assigned_tutor_id", dbUser.id)
                .eq("parent_email", normalizedParentEmail)
                .order("updated_at", { ascending: false })
                .limit(10);
            parentEnrollment =
              (data || []).find((entry: any) => {
                const entryStudentName = String(entry?.student_full_name || "").trim().toLowerCase();
                return normalizedStudentName
                  ? entryStudentName === normalizedStudentName.toLowerCase()
                  : true;
              }) || null;
          }

          if (!parentEnrollment && normalizedStudentName) {
            const { data } = await supabase
              .from("parent_enrollments")
              .select("id, user_id, status, current_step, proposal_id, assigned_student_id")
              .eq("assigned_tutor_id", dbUser.id)
              .eq("student_full_name", normalizedStudentName)
              .order("updated_at", { ascending: false })
              .limit(10);
            parentEnrollment = (data || [])[0] || null;
          }

          const sandboxContextLikely =
            normalizedParentEmail.startsWith("sandbox-parent-") ||
            normalizedParentEmail.endsWith("@gmail.com") ||
            normalizedStudentName.startsWith("sandbox ");

          if (!parentEnrollment) {
            if (!sandboxContextLikely) {
              return res.status(409).json({
                message: "Could not resolve the parent enrollment for this assignment. Refresh the pod and try again.",
              });
            }

            parentEnrollment = {
              id: requestedEnrollmentId || explicitEnrollmentId || null,
              user_id: normalizedParentId || null,
              status: "awaiting_tutor_acceptance",
              current_step: "awaiting_tutor_acceptance",
              assigned_student_id: studentId,
              assigned_tutor_id: dbUser.id,
            };
          }

          if (parentEnrollment && String(parentEnrollment.status || "").trim() === "awaiting_assignment") {
            return res.status(409).json({
              message: "This assignment is no longer pending tutor acceptance.",
            });
          }

          const resumedStatus =
            extractReassignmentResumeStatus(parentEnrollment?.current_step) ||
            null;

          const updatedProfile = {
            ...existingProfile,
            workflow: {
              ...workflow,
              assignmentAcceptedAt: workflow.assignmentAcceptedAt || new Date().toISOString(),
              assignmentDeclinedAt: null,
              handoverRequiredAt:
                resumedStatus && resumedStatus !== "assigned"
                  ? new Date().toISOString()
                  : workflow.handoverRequiredAt || null,
              handoverCompletedAt:
                resumedStatus && resumedStatus !== "assigned"
                  ? null
                  : workflow.handoverCompletedAt || null,
            },
          };

          const updated = await storage.updateStudent(studentId, {
            personalProfile: updatedProfile,
          } as any);

          if (sandboxContextLikely && parentEnrollment?.id) {
            await supabase
              .from("students")
              .update({
                parent_enrollment_id: parentEnrollment.id,
                parent_id: normalizedParentId || null,
                parent_contact: normalizedParentEmail || null,
                tutor_id: dbUser.id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", studentId);
          }

          if (parentEnrollment && parentEnrollment.id) {
            const nextEnrollmentStatus = resumedStatus || "assigned";
            const nextCurrentStep =
              resumedStatus && resumedStatus !== "assigned"
                ? "handover_not_scheduled"
                : nextEnrollmentStatus;

            const { error: enrollmentUpdateError } = await supabase
              .from("parent_enrollments")
              .update({
                assigned_tutor_id: dbUser.id,
                status: nextEnrollmentStatus,
                current_step: nextCurrentStep,
                updated_at: new Date().toISOString(),
              })
              .eq("id", parentEnrollment.id);

            if (enrollmentUpdateError) {
              console.error("Failed to update accepted enrollment:", parentEnrollment.id, enrollmentUpdateError);
              return res.status(500).json({
                message: "Assignment acceptance saved on the student, but the enrollment state could not be advanced.",
              });
            }

            await safeSendPush(
              parentEnrollment.user_id,
              {
                title: "Tutor accepted",
                body:
                  resumedStatus && resumedStatus !== "assigned"
                    ? "Your new tutor accepted the reassignment. Book a continuity check so Response Integrity can resume from the student's existing training state."
                    : "Your tutor accepted the assignment. Response Integrity onboarding can now move forward.",
                url: "/client/parent/gateway",
                tag: `parent-tutor-accepted-${parentEnrollment.id}`,
              },
              "parent tutor accepted assignment",
            );
          }

          return res.json({
            success: true,
            assignmentAccepted: true,
            student: updated,
          });
        }

        const { data: existingIntroSession } = await supabase
          .from("scheduled_sessions")
          .select("id")
          .eq("tutor_id", dbUser.id)
          .eq("student_id", studentId)
          .eq("type", "intro")
          .maybeSingle();

        if (existingIntroSession || workflow.introCompletedAt || student.identitySheetCompletedAt) {
          return res.status(400).json({ message: "Assignment can only be declined before the intro workflow begins" });
        }

        const { data: enrollmentByStudent } = await supabase
          .from("parent_enrollments")
          .select("id")
          .eq("assigned_tutor_id", dbUser.id)
          .eq("assigned_student_id", studentId)
          .maybeSingle();

        if (enrollmentByStudent?.id) {
          const { error: enrollmentUpdateError } = await supabase
            .from("parent_enrollments")
            .update({
              status: "awaiting_assignment",
              assigned_tutor_id: null,
              assigned_student_id: null,
              proposal_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", enrollmentByStudent.id);

          if (enrollmentUpdateError) {
            return res.status(500).json({ message: "Failed to re-open parent assignment" });
          }
        }

        const { error: deleteStudentError } = await supabase
          .from("students")
          .delete()
          .eq("id", studentId)
          .eq("tutor_id", dbUser.id);

        if (deleteStudentError) {
          return res.status(500).json({ message: "Failed to decline assignment" });
        }

        return res.json({
          success: true,
          assignmentAccepted: false,
          declined: true,
        });
      } catch (error) {
        console.error("Error responding to assignment:", error);
        res.status(500).json({ message: "Failed to respond to assignment" });
      }
    }
  );

  app.post(
    "/api/tutor/students/:studentId/workflow/intro-completed",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const dbUser = (req as any).dbUser;

        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        if (student.tutorId !== dbUser.id) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        const { data: introSession } = await supabase
          .from("scheduled_sessions")
          .select("status")
          .eq("tutor_id", dbUser.id)
          .eq("student_id", studentId)
          .eq("type", "intro")
          .order("created_at", { ascending: false })
          .maybeSingle();

        // Fallback: session may be stored with parent_id only (student_id null)
        let resolvedSession = introSession;
        if (!resolvedSession) {
          const parentId = (student as any).parentId || null;
          if (parentId) {
            const { data: introByParent } = await supabase
              .from("scheduled_sessions")
              .select("status")
              .eq("tutor_id", dbUser.id)
              .eq("parent_id", parentId)
              .eq("type", "intro")
              .is("student_id", null)
              .order("created_at", { ascending: false })
              .maybeSingle();
            resolvedSession = introByParent;
          }
        }

        if (!["confirmed", "ready", "live", "completed"].includes(String(resolvedSession?.status || ""))) {
          return res.status(400).json({ message: "Intro session must be confirmed before completing" });
        }

        const existingProfile = (student.personalProfile as any) || {};
        const updatedProfile = {
          ...existingProfile,
          workflow: {
            ...(existingProfile.workflow || {}),
            introCompletedAt: new Date().toISOString(),
          },
        };

        const updated = await storage.updateStudent(studentId, {
          personalProfile: updatedProfile,
        } as any);

        res.json({
          success: true,
          introCompleted: true,
          student: updated,
        });
      } catch (error) {
        console.error("Error marking intro completed:", error);
        res.status(500).json({ message: "Failed to mark intro completed" });
      }
    }
  );

  app.post(
    "/api/tutor/students/:studentId/workflow/handover-completed",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const dbUser = (req as any).dbUser;

        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        if (student.tutorId !== dbUser.id) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        const existingProfile = (student.personalProfile as any) || {};
        const workflow = existingProfile.workflow || {};
        if (!workflow.handoverRequiredAt) {
          return res.status(400).json({ message: "This student does not require handover verification." });
        }

        const { data: handoverSession } = await supabase
          .from("scheduled_sessions")
          .select("id, status")
          .eq("tutor_id", dbUser.id)
          .eq("student_id", studentId)
          .eq("type", "handover")
          .order("created_at", { ascending: false })
          .maybeSingle();

        if (!["confirmed", "ready", "live", "completed"].includes(String(handoverSession?.status || ""))) {
          return res.status(400).json({ message: "Handover session must be confirmed before completing verification." });
        }

        const { data: handoverDrillRows, error: handoverDrillError } = await supabase
          .from("intro_session_drills")
          .select("id, drill, scheduled_session_id, submitted_at")
          .eq("student_id", studentId)
          .eq("tutor_id", dbUser.id)
          .eq("scheduled_session_id", handoverSession.id)
          .order("submitted_at", { ascending: false });

        if (handoverDrillError) {
          return res.status(500).json({ message: "Failed to validate handover verification evidence." });
        }

        const latestHandoverVerification = (handoverDrillRows || [])
          .map((row: any) => {
            try {
              const parsed = row?.drill && typeof row.drill === "object"
                ? row.drill
                : JSON.parse(typeof row?.drill === "string" ? row.drill : "{}");
              if (String(parsed?.drillType || "").trim().toLowerCase() !== "handover_verification") {
                return null;
              }
              return {
                id: row.id,
                submitted_at: row.submitted_at,
                handoverMode: parsed?.handoverMode || "verification",
                summary: parsed?.summary || null,
              };
            } catch {
              return null;
            }
          })
          .filter(Boolean)[0] || null;

        if (!latestHandoverVerification) {
          return res.status(400).json({ message: "Run and submit handover verification before marking continuity check complete." });
        }

        if (latestHandoverVerification.summary?.reDiagnosisRequired) {
          return res.status(400).json({ message: "Targeted re-diagnosis is required before continuity check can be completed." });
        }

        const updatedProfile = {
          ...existingProfile,
          workflow: {
            ...workflow,
            handoverCompletedAt: new Date().toISOString(),
          },
        };

        const updated = await storage.updateStudent(studentId, {
          personalProfile: updatedProfile,
        } as any);

        const parentId = (student as any).parentId || null;
        if (parentId) {
          await safeSendPush(
            parentId,
            {
              title: "Continuity check complete",
              body: "Your child's new tutor completed the continuity check and training can continue.",
              url: "/client/parent/gateway",
              tag: `parent-handover-complete-${studentId}`,
            },
            "parent handover verification completed",
          );
        }

        res.json({
          success: true,
          handoverCompleted: true,
          student: updated,
        });
      } catch (error) {
        console.error("Error marking handover completed:", error);
        res.status(500).json({ message: "Failed to mark handover verification completed" });
      }
    }
  );

  app.get(
    "/api/tutor/pod-alignment-summary",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const assignment = await storage.getTutorAssignment(tutorId);

        if (!assignment) {
          return res.json({
            podId: null,
            podName: null,
            assignmentId: null,
            operationalMode: "training",
            alignmentSummary: null,
          });
        }

        const assignments = await storage.getTutorAssignmentsByPod(assignment.podId);
        const tutorMeta = await Promise.all(
          assignments.map(async (podAssignment) => {
            const tutor = await storage.getUser(podAssignment.tutorId);
            const students = await storage.getStudentsByTutor(podAssignment.tutorId);
            return {
              assignmentId: podAssignment.id,
              tutorId: podAssignment.tutorId,
              tutorName: tutor?.name || tutor?.firstName || "Unknown Tutor",
              tutorEmail: tutor?.email || "",
              studentCount: students.length,
            };
          })
        );

        const tdUser = assignment.pod.tdId ? await storage.getUser(assignment.pod.tdId) : null;
        const summary = await buildPodBattleTestingSummary(
          assignment.podId,
          tutorMeta,
          tdUser
            ? {
                tdId: tdUser.id,
                tdName: tdUser.name || tdUser.firstName || "Assigned TD",
              }
            : null
        );

        const alignmentSummary =
          summary.tutorSummaries.find((entry) => entry.assignmentId === assignment.id) ||
          summary.tutorSummaries.find((entry) => entry.tutorId === tutorId) ||
          null;

        if ((alignmentSummary?.mode || assignment.operationalMode) === "sandbox") {
          try {
            await ensureVisibleSandboxStudentsForTutor(tutorId, 3);
          } catch (error) {
            console.error("Sandbox provisioning/backfill failed while loading tutor alignment summary:", error);
          }
        }

        res.json({
          podId: assignment.podId,
          podName: assignment.pod.podName,
          assignmentId: assignment.id,
          operationalMode: alignmentSummary?.mode || assignment.operationalMode || "training",
          alignmentSummary,
        });
      } catch (error) {
        console.error("Error fetching tutor pod alignment summary:", error);
        res.status(500).json({ message: "Failed to fetch tutor alignment summary" });
      }
    }
  );

  // Get student tracking systems (sessions, reports, TD feedback)
  app.get(
    "/api/tutor/students/:studentId/tracking",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const dbUser = (req as any).dbUser;

        // Verify student exists and belongs to this tutor
        const student = await storage.getStudent(studentId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        if (student.tutorId !== dbUser.id) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
        }

        // Get tutoring sessions
        const tutorId = dbUser.id;
        const { data: sessions, error: sessionError } = await supabase
          .from("scheduled_sessions")
          .select("id, scheduled_time, status, parent_confirmed, tutor_confirmed, created_at, updated_at")
          .eq("tutor_id", tutorId)
          .eq("parent_id", (student as any).parentId)
          .eq("type", "intro")
          .order("created_at", { ascending: false });

        // Get parent reports
        const { data: parentReports, error: reportsError } = await supabase
          .from("parent_reports")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        if (reportsError) {
          console.error("Error fetching parent reports:", reportsError);
        }

        // Get TD weekly check-ins (feedback)
        const { data: tdFeedback, error: feedbackError } = await supabase
          .from("weekly_check_ins")
          .select("*")
          .eq("tutor_id", dbUser.id)
          .order("created_at", { ascending: false });

        if (feedbackError) {
          console.error("Error fetching TD feedback:", feedbackError);
        }

        res.json({
          sessions: sessions || [],
          parentReports: parentReports || [],
          tdFeedback: tdFeedback || [],
        });
      } catch (error) {
        console.error("Error fetching tracking data:", error);
        res.status(500).json({ message: "Failed to fetch tracking data" });
      }
    }
  );

  // Create struggle target
  app.post(
    "/api/tutor/students/:studentId/targets",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        
        // Convert consolidationDate string to Date if provided
        const body = {
          ...req.body,
          studentId,
          consolidationDate: req.body.consolidationDate ? new Date(req.body.consolidationDate) : null,
        };
        
        const data = insertStruggleTargetSchema.parse(body);
        const target = await storage.createStruggleTarget(data);
        res.json(target);
      } catch (error) {
        console.error("Error creating struggle target:", error);
        res.status(400).json({ message: "Failed to create struggle target" });
      }
    }
  );

  // Create tutor's own struggle target
  app.post(
    "/api/tutor/targets",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        console.log("Creating target for user:", dbUser.id);
        console.log("Request body:", req.body);
        
        // Convert consolidationDate string to Date if provided
        const body = {
          ...req.body,
          studentId: dbUser.id,
          consolidationDate: req.body.consolidationDate ? new Date(req.body.consolidationDate) : null,
        };
        
        const data = insertStruggleTargetSchema.parse(body);
        console.log("Parsed data:", data);
        const target = await storage.createStruggleTarget(data);
        console.log("Created target:", target);
        res.json(target);
      } catch (error) {
        console.error("Error creating tutor's struggle target:", error);
        res.status(400).json({ message: `Failed to create struggle target: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
  );

  // Update struggle target
  app.put(
    "/api/tutor/targets/:id",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const target = await storage.updateStruggleTarget(id, req.body);
        if (!target) {
          return res.status(404).json({ message: "Target not found" });
        }
        res.json(target);
      } catch (error) {
        console.error("Error updating struggle target:", error);
        res.status(400).json({ message: "Failed to update struggle target" });
      }
    }
  );

  // Delete struggle target
  app.delete(
    "/api/tutor/targets/:id",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await storage.deleteStruggleTarget(id);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting struggle target:", error);
        res.status(500).json({ message: "Failed to delete struggle target" });
      }
    }
  );

  // ========================================
  // WEEKLY CHECK-IN ROUTES (Tutor)
  // ========================================

  // Submit weekly check-in
  app.post(
    "/api/tutor/weekly-check-in",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const schema = z.object({
          podId: z.string(),
          weekStartDate: z.string(),
          sessionsSummary: z.string().min(1),
          wins: z.string().min(1),
          challenges: z.string().min(1),
          emotions: z.string().min(1),
          skillImprovement: z.string().min(1),
          helpNeeded: z.string().optional(),
          nextWeekGoals: z.string().min(1),
        });

        const data = schema.parse(req.body);
        const weekStartDate = new Date(data.weekStartDate);

        // Use Drizzle ORM insert for weeklyCheckIns
        await (storage.db as any).insert(storage.weeklyCheckIns).values({
          tutorId,
          podId: data.podId,
          weekStartDate,
          sessionsSummary: data.sessionsSummary,
          wins: data.wins,
          challenges: data.challenges,
          emotions: data.emotions,
          skillImprovement: data.skillImprovement,
          helpNeeded: data.helpNeeded || null,
          nextWeekGoals: data.nextWeekGoals,
        });
        res.json({ success: true, message: "Weekly check-in submitted" });
      } catch (error) {
        console.error("Error submitting weekly check-in:", error);
        res.status(400).json({ message: "Failed to submit check-in" });
      }
    }
  );

  // Get tutor's check-ins for a pod
  app.get(
    "/api/tutor/weekly-check-ins",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const podId = req.query.podId as string;

        if (!podId) {
          return res.status(400).json({ message: "Pod ID required" });
        }

        // Use Drizzle ORM select for weeklyCheckIns
        const checkIns = await (storage.db as any)
          .select()
          .from(storage.weeklyCheckIns)
          .where((wci) => wci.tutorId === tutorId && wci.podId === podId)
          .orderBy((wci) => wci.weekStartDate, "desc");
        res.json(checkIns);
      } catch (error) {
        console.error("Error fetching weekly check-ins:", error);
        res.status(500).json({ message: "Failed to fetch check-ins" });
      }
    }
  );

  // ========================================
  // TD ROUTES
  // ========================================

  // Get TD's pod overview
  app.get(
    "/api/td/pod-overview",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const tdId = (req as any).dbUser.id;
        console.log(`🔍 [TD Pod Overview] Fetching pods for TD: ${tdId}`);
        const pods = await storage.getPodsByTD(tdId);
        console.log(`📦 [TD Pod Overview] Found ${pods?.length || 0} pods`);
        if (!pods || pods.length === 0) {
          console.log(`⚠️  [TD Pod Overview] No pods found, returning empty array`);
          return res.json([]);
        }

        const podOverviews = await Promise.all(
          pods.map(async (pod) => {
            const assignments = await storage.getTutorAssignmentsByPod(pod.id);
            const tutors = await Promise.all(
              assignments.map(async (assignment) => {
                const tutor = await storage.getUser(assignment.tutorId);
                return tutor ? { ...tutor, assignment } : null;
              })
            );

            const validTutors = tutors.filter(Boolean);
            let totalStudents = 0;
            let totalSessions = 0;
            const tutorMeta: Array<{
              assignmentId: string;
              tutorId: string;
              tutorName: string;
              tutorEmail: string;
              studentCount: number;
            }> = [];

            for (const tutor of validTutors) {
              const students = await storage.getStudentsByTutor(tutor!.id);
              totalStudents += students.length;
              tutorMeta.push({
                assignmentId: tutor!.assignment.id,
                tutorId: tutor!.id,
                tutorName: tutor!.name || tutor!.firstName || "Unknown Tutor",
                tutorEmail: tutor!.email || "",
                studentCount: students.length,
              });
              for (const student of students) {
                totalSessions += student.sessionProgress;
              }
            }

            const tdUser = pod.tdId ? await storage.getUser(pod.tdId) : null;
            const battleTestingSummary = await buildPodBattleTestingSummary(
              pod.id,
              tutorMeta,
              tdUser
                ? {
                    tdId: tdUser.id,
                    tdName: tdUser.name || tdUser.firstName || "Assigned TD",
                  }
                : null
            );

            return {
              pod,
              tutors: validTutors,
              totalStudents,
              totalSessions,
              battleTestingSummary,
            };
          })
        );

        res.json(podOverviews);
      } catch (error) {
        console.error("Error fetching pod overview:", error);
        res.status(500).json({ message: "Failed to fetch pod overview" });
      }
    }
  );

  // Get TD's tutors with profiles
  app.get(
    "/api/td/tutors",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const tdId = (req as any).dbUser.id;
        const pod = await storage.getPodByTD(tdId);
        if (!pod) {
          return res.json([]);
        }

        const assignments = await storage.getTutorAssignmentsByPod(pod.id);
        const profiles = await Promise.all(
          assignments.map(async (assignment) => {
            const tutor = await storage.getUser(assignment.tutorId);
            if (!tutor) return null;

            const students = await storage.getStudentsByTutor(tutor.id);
            const sessions = await getTutorSessionFeed(tutor.id);
            const reflections = await storage.getReflectionsByTutor(tutor.id);

            return {
              tutor,
              assignment,
              students,
              sessions,
              reflectionCount: reflections.length,
            };
          })
        );

        res.json(profiles.filter(Boolean));
      } catch (error) {
        console.error("Error fetching tutors:", error);
        res.status(500).json({ message: "Failed to fetch tutors" });
      }
    }
  );

  const getTDAccessibleTutorIds = async (tdId: string) => {
    const pods = await storage.getPodsByTD(tdId);
    const tutorIds = new Set<string>();

    for (const pod of pods || []) {
      const assignments = await storage.getTutorAssignmentsByPod(pod.id);
      for (const assignment of assignments) {
        if (assignment?.tutorId) {
          tutorIds.add(String(assignment.tutorId));
        }
      }
    }

    return tutorIds;
  };

  const getTDAuthorizedStudent = async (tdId: string, studentId: string) => {
    const student = await storage.getStudent(studentId);
    if (!student) {
      return { student: null, status: 404 as const };
    }

    if (!student.tutorId) {
      return { student, status: 403 as const };
    }

    const tutorIds = await getTDAccessibleTutorIds(tdId);
    if (!tutorIds.has(String(student.tutorId))) {
      return { student, status: 403 as const };
    }

    return { student, status: 200 as const };
  };

  // Get students for a specific tutor (TD read-only view)
  app.get(
    "/api/td/tutors/:tutorId/students",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const tdId = (req as any).dbUser.id;
        const { tutorId } = req.params;
        const tutorIds = await getTDAccessibleTutorIds(tdId);

        if (!tutorIds.has(String(tutorId))) {
          return res.status(403).json({ message: "Unauthorized tutor access" });
        }

        const certificationMode = await getTutorCertificationMode(tutorId);
        await cleanupLegacyLiveEnrollmentsForNonLiveTutor(tutorId, certificationMode);
        let assignedEnrollmentsQuery = supabase
          .from("parent_enrollments")
          .select("id, user_id, student_full_name, assigned_student_id, status, current_step, parent_full_name, parent_email, is_sandbox_account")
          .eq("assigned_tutor_id", tutorId)
          .in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES, "awaiting_tutor_acceptance"]);

        if (certificationMode === "sandbox") {
          assignedEnrollmentsQuery = assignedEnrollmentsQuery.eq("is_sandbox_account", true);
        }

        let { data: assignedEnrollments } = await assignedEnrollmentsQuery;

        if (!assignedEnrollments) {
          let fallbackQuery = supabase
            .from("parent_enrollments")
            .select("id, user_id, student_full_name, status, current_step, parent_full_name, parent_email")
            .eq("assigned_tutor_id", tutorId)
            .in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES, "awaiting_tutor_acceptance"]);
          if (certificationMode === "sandbox") {
            fallbackQuery = fallbackQuery.eq("is_sandbox_account", true);
          }
          const fallback = await fallbackQuery;
          assignedEnrollments = fallback.data as any;
        }

        if (assignedEnrollments && assignedEnrollments.length > 0) {
          for (const enrollment of assignedEnrollments) {
            try {
              await ensureStudentForEnrollment(enrollment, tutorId);
            } catch (studentResolutionError) {
              console.error("Error ensuring TD tutor student exists:", {
                tutorId,
                enrollmentId: enrollment?.id,
                error: studentResolutionError,
              });
            }
          }
        }

        const students = await hydrateStudentsWithSessionProgress(
          tutorId,
          await storage.getStudentsByTutor(tutorId)
        );

        const assignedEnrollmentById = new Set(
          (assignedEnrollments || [])
            .map((e: any) => e.id)
            .filter((v: any) => !!v)
            .map((v: any) => String(v))
        );
        const assignedEnrollmentByStudentId = new Set(
          (assignedEnrollments || [])
            .map((e: any) => e.assigned_student_id)
            .filter((v: any) => !!v)
            .map((v: any) => String(v))
        );
        const assignedEnrollmentByParentId = new Set(
          (assignedEnrollments || [])
            .map((e: any) => e.user_id)
            .filter((v: any) => !!v)
            .map((v: any) => String(v))
        );
        const assignedEnrollmentByStudentName = new Set(
          (assignedEnrollments || [])
            .map((e: any) => e.student_full_name)
            .filter((v: any) => !!v)
            .map((v: any) => String(v).trim().toLowerCase())
        );

        const activeStudents = students.filter((student: any) => {
          const studentId = String(student.id || "");
          const parentId = String((student as any).parentId || "");
          const parentEnrollmentId = String((student as any).parentEnrollmentId || (student as any).parent_enrollment_id || "");
          const studentName = String(student.name || "").trim().toLowerCase();

          if (parentEnrollmentId && assignedEnrollmentById.has(parentEnrollmentId)) {
            return true;
          }

          if (certificationMode === "sandbox") {
            return assignedEnrollmentByStudentId.has(studentId);
          }

          return (
            assignedEnrollmentByStudentId.has(studentId) ||
            (!!parentId && assignedEnrollmentByParentId.has(parentId)) ||
            (!!studentName && assignedEnrollmentByStudentName.has(studentName))
          );
        });

        res.json(activeStudents);
      } catch (error) {
        console.error("Error fetching TD tutor students:", error);
        res.status(500).json({ message: "Failed to fetch tutor students" });
      }
    }
  );

  // Get student identity sheet (TD read-only view)
  app.get(
    "/api/td/students/:studentId/identity-sheet",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const tdId = (req as any).dbUser.id;
        const { studentId } = req.params;
        const authorized = await getTDAuthorizedStudent(tdId, studentId);

        if (authorized.status === 404) {
          return res.status(404).json({ message: "Student not found" });
        }
        if (authorized.status !== 200 || !authorized.student) {
          return res.status(403).json({ message: "Unauthorized student access" });
        }

        const student = authorized.student;
        res.json({
          personalProfile: student.personalProfile || null,
          emotionalInsights: student.emotionalInsights || null,
          academicDiagnosis: student.academicDiagnosis || null,
          identitySheet: student.identitySheet || null,
          completedAt: student.identitySheetCompletedAt || null,
        });
      } catch (error) {
        console.error("Error fetching identity sheet for TD:", error);
        res.status(500).json({ message: "Failed to fetch identity sheet" });
      }
    }
  );

  // Get student assignments (TD read-only view)
  app.get(
    "/api/td/students/:studentId/assignments",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const tdId = (req as any).dbUser.id;
        const { studentId } = req.params;
        const authorized = await getTDAuthorizedStudent(tdId, studentId);

        if (authorized.status === 404) {
          return res.status(404).json({ message: "Student not found" });
        }
        if (authorized.status !== 200) {
          return res.status(403).json({ message: "Unauthorized student access" });
        }

        const { data: assignments, error } = await supabase
          .from("assignments")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching TD assignments:", error);
          return res.status(500).json({ message: "Failed to fetch assignments" });
        }

        res.json(assignments || []);
      } catch (error) {
        console.error("Error fetching student assignments for TD:", error);
        res.status(500).json({ message: "Failed to fetch assignments" });
      }
    }
  );

  // Reports center data per student (TD read-only view)
  app.get(
    "/api/td/students/:studentId/reports-center",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const tdId = (req as any).dbUser.id;
        const { studentId } = req.params;
        const authorized = await getTDAuthorizedStudent(tdId, studentId);

        if (authorized.status === 404) {
          return res.status(404).json({ message: "Student not found" });
        }
        if (authorized.status !== 200) {
          return res.status(403).json({ message: "Unauthorized student access" });
        }

        const { data: drillRows, error: drillRowsError } = await supabase
          .from("intro_session_drills")
          .select("id, student_id, tutor_id, drill, submitted_at")
          .eq("student_id", studentId)
          .order("submitted_at", { ascending: false });

        if (drillRowsError) {
          throw drillRowsError;
        }

        const sessions = aggregateDeterministicSessions(drillRows || []);

        const { data: reports, error: reportsError } = await supabase
          .from("parent_reports")
          .select("*")
          .eq("student_id", studentId)
          .order("sent_at", { ascending: false });

        if (reportsError) {
          throw reportsError;
        }

        const enrichedReports = (reports || []).map((report: any) => ({
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
          structuredData: parseStructuredReportSummary(report.summary),
        }));

        res.json({
          sessions,
          reports: enrichedReports,
        });
      } catch (error) {
        console.error("Error fetching TD reports center data:", error);
        res.status(500).json({ message: "Failed to fetch reports center data" });
      }
    }
  );

  // Get student tracking data (TD read-only view)
  app.get(
    "/api/td/students/:studentId/tracking",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const tdId = (req as any).dbUser.id;
        const { studentId } = req.params;
        const authorized = await getTDAuthorizedStudent(tdId, studentId);

        if (authorized.status === 404) {
          return res.status(404).json({ message: "Student not found" });
        }
        if (authorized.status !== 200) {
          return res.status(403).json({ message: "Unauthorized student access" });
        }

        const sessions = await getTTScheduledSessionsByStudent(studentId);

        const { data: parentReports, error: reportsError } = await supabase
          .from("parent_reports")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        const { data: tdFeedback, error: feedbackError } = await supabase
          .from("td_feedback")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        if (reportsError || feedbackError) {
          console.error("Error fetching TD tracking data:", { reportsError, feedbackError });
          return res.status(500).json({ message: "Failed to fetch tracking data" });
        }

        res.json({
          sessions: sessions || [],
          parentReports: parentReports || [],
          tdFeedback: tdFeedback || [],
        });
      } catch (error) {
        console.error("Error fetching student tracking for TD:", error);
        res.status(500).json({ message: "Failed to fetch tracking data" });
      }
    }
  );

  app.get(
    "/api/td/students/:studentId/communications",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const tdId = (req as any).dbUser.id;
        const { studentId } = req.params;
        const authorized = await getTDAuthorizedStudent(tdId, studentId);

        if (authorized.status === 404) {
          return res.status(404).json({ message: "Student not found" });
        }
        if (authorized.status !== 200 || !authorized.student) {
          return res.status(403).json({ message: "Unauthorized student access" });
        }

        const student = authorized.student;
        const parentId =
          (student as any)?.parentId ||
          (student as any)?.parent_id ||
          (await resolveParentIdForStudent(student, student.tutorId));

        res.json(await buildStudentCommunicationBundle({ student, parentId: parentId || null }));
      } catch (error) {
        console.error("Error fetching TD communications:", error);
        res.status(500).json({ message: "Failed to fetch communications" });
      }
    }
  );

  // Get all tutor weekly check-ins for a TD's pod
  app.get(
    "/api/td/tutor-check-ins",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const tdId = (req as any).dbUser.id;
        const pods = await storage.getPodsByTD(tdId);
        
        if (!pods || pods.length === 0) {
          return res.json([]);
        }

        const allCheckIns = [];
        for (const pod of pods) {
          const { data: rawCheckIns, error: checkInError } = await supabase
            .from("weekly_check_ins")
            .select("*")
            .eq("pod_id", pod.id)
            .order("week_start_date", { ascending: false });

          if (checkInError) {
            throw checkInError;
          }

          const checkIns = (rawCheckIns || []).map((checkIn: any) => ({
            id: checkIn.id,
            tutorId: checkIn.tutor_id,
            podId: checkIn.pod_id,
            weekStartDate: checkIn.week_start_date,
            wins: checkIn.wins,
            challenges: checkIn.challenges,
            helpNeeded: checkIn.help_needed,
            submittedAt: checkIn.submitted_at,
            createdAt: checkIn.created_at,
          }));

          // Enrich with tutor information
          const enrichedCheckIns = await Promise.all(
            checkIns.map(async (checkIn) => {
              const tutor = await storage.getUser(checkIn.tutorId);
              return {
                ...checkIn,
                podName: pod.podName,
                tutor: tutor ? { id: tutor.id, name: tutor.name || tutor.firstName, email: tutor.email } : null,
              };
            })
          );
          allCheckIns.push(...enrichedCheckIns);
        }

        res.json(allCheckIns);
      } catch (error) {
        console.error("Error fetching tutor check-ins:", error);
        res.status(500).json({ message: "Failed to fetch check-ins" });
      }
    }
  );

  // Get TD insights dashboard data
  app.get(
    "/api/td/insights",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const tdId = (req as any).dbUser.id;
        const pods = await storage.getPodsByTD(tdId);
        
        if (!pods || pods.length === 0) {
          return res.json({
            tutorsNeedingHelp: [],
            studentsAtRisk: [],
            podsBehindSchedule: [],
            recentCheckIns: [],
          });
        }

        const tutorsNeedingHelp = [];
        const studentsAtRisk = [];
        const podsBehindSchedule = [];
        const recentCheckIns = [];

        for (const pod of pods) {
          // Get recent check-ins for this pod
          const { data: rawCheckIns, error: checkInError } = await supabase
            .from("weekly_check_ins")
            .select("*")
            .eq("pod_id", pod.id)
            .order("week_start_date", { ascending: false })
            .limit(10);

          if (checkInError) {
            throw checkInError;
          }

          const checkIns = (rawCheckIns || []).map((checkIn: any) => ({
            id: checkIn.id,
            tutorId: checkIn.tutor_id,
            podId: checkIn.pod_id,
            weekStartDate: checkIn.week_start_date,
            wins: checkIn.wins,
            challenges: checkIn.challenges,
            helpNeeded: checkIn.help_needed,
            submittedAt: checkIn.submitted_at,
            createdAt: checkIn.created_at,
          }));

          for (const checkIn of checkIns) {
            const tutor = await storage.getUser(checkIn.tutorId);
            
            // Add to recent check-ins
            recentCheckIns.push({
              ...checkIn,
              tutorName: tutor?.name || tutor?.firstName,
              podName: pod.podName,
            });

            // Check if tutor needs help
            if (checkIn.helpNeeded && checkIn.helpNeeded.trim().length > 0) {
              tutorsNeedingHelp.push({
                tutorId: checkIn.tutorId,
                tutorName: tutor?.name || tutor?.firstName,
                tutorEmail: tutor?.email,
                podName: pod.podName,
                helpNeeded: checkIn.helpNeeded,
                challenges: checkIn.challenges,
                weekStartDate: checkIn.weekStartDate,
                submittedAt: checkIn.submittedAt,
              });
            }
          }

          // Get students in this pod
          const assignments = await storage.getTutorAssignmentsByPod(pod.id);
          let totalStudents = 0;
          let totalSessions = 0;

          for (const assignment of assignments) {
            const students = await storage.getStudentsByTutor(assignment.tutorId);
            totalStudents += students.length;
            
            for (const student of students) {
              totalSessions += student.sessionProgress || 0;

              // Check if student is at risk (low confidence or behind schedule)
              const expectedSessions = 3; // Minimum expected sessions
              if (student.sessionProgress < expectedSessions || (student.confidenceScore || 0) < 5) {
                const tutor = await storage.getUser(assignment.tutorId);
                studentsAtRisk.push({
                  studentId: student.id,
                  studentName: student.name,
                  tutorId: assignment.tutorId,
                  tutorName: tutor?.name || tutor?.firstName,
                  podName: pod.podName,
                  sessionProgress: student.sessionProgress,
                  confidenceScore: student.confidenceScore,
                  reason: student.sessionProgress < expectedSessions ? 'Behind on sessions' : 'Low confidence',
                });
              }
            }
          }

          // Check if pod is behind schedule
          const maxSessions = totalStudents * 9;
          const expectedProgress = 0.3; // At least 30% complete
          const actualProgress = maxSessions > 0 ? totalSessions / maxSessions : 0;
          
          if (actualProgress < expectedProgress && totalStudents > 0) {
            podsBehindSchedule.push({
              podId: pod.id,
              podName: pod.podName,
              totalStudents,
              totalSessions,
              maxSessions,
              progress: Math.round(actualProgress * 100),
              tutorCount: assignments.length,
            });
          }
        }

        res.json({
          tutorsNeedingHelp: tutorsNeedingHelp.slice(0, 10), // Top 10
          studentsAtRisk: studentsAtRisk.slice(0, 15), // Top 15
          podsBehindSchedule,
          recentCheckIns: recentCheckIns.slice(0, 5), // Most recent 5
        });
      } catch (error) {
        console.error("Error fetching TD insights:", error);
        res.status(500).json({ message: "Failed to fetch insights" });
      }
    }
  );

  // ========================================
  // COO ROUTES
    // Get COO leads for UI
    app.get(
      "/api/coo/leads",
      isAuthenticated,
      requireRole(["coo"]),
      async (req: Request, res: Response) => {
        try {
          // Fetch all leads (include affiliate_type, affiliate_name, lead_type, onboarding_type, full_name)
          const { data: leads, error } = await supabase
            .from("leads")
            .select("id, user_id, affiliate_id, tracking_source, created_at, affiliate_type, affiliate_name, lead_type, onboarding_type, full_name")
            .order("created_at", { ascending: false });
          if (error) {
            console.error("[COO LEADS] Supabase error:", error);
            return res.status(500).json({ message: "Failed to fetch leads", details: error });
          }
          // Gather all user_ids and affiliate_ids
          const userIds = Array.from(new Set((leads || []).map((l: any) => l.user_id).filter(Boolean)));
          const affiliateIds = Array.from(new Set((leads || []).map((l: any) => l.affiliate_id).filter((id: string | null) => id && id !== null)));

          // Fetch all parent users
          const { data: users, error: usersError } = await supabase
            .from("users")
            .select("id, first_name, last_name, email").in("id", userIds);
          if (usersError) {
            console.error("[COO LEADS] Supabase error (users):", usersError);
            return res.status(500).json({ message: "Failed to fetch parent users", details: usersError });
          }

          // Build lookup map
          const userMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]));

          // Fetch affiliate_codes for real affiliates only
          let codeMap: Record<string, any> = {};
          if (affiliateIds.length > 0) {
            const { data: codes } = await supabase
              .from("affiliate_codes")
              .select("affiliate_id, code, type, person_name, entity_name, school_type")
              .in("affiliate_id", affiliateIds);
            if (codes) {
              codes.forEach((c: any) => { if (!codeMap[c.affiliate_id]) codeMap[c.affiliate_id] = c; });
            }
          }

          // Transform for UI
          const result = (leads || []).map((lead: any) => {
            const parent = userMap[lead.user_id] || {};
            // If organic (affiliate_id is null), show as organic
            const isOrganic = lead.affiliate_id === null;
            let affiliateType = lead.affiliate_type || '';
            let affiliateName = lead.affiliate_name || '';
            if (!isOrganic && codeMap[lead.affiliate_id]) {
              affiliateType = codeMap[lead.affiliate_id].type || affiliateType;
              affiliateName = codeMap[lead.affiliate_id].person_name || codeMap[lead.affiliate_id].entity_name || affiliateName;
            }
            return {
              id: lead.id,
              parentName: `${parent.first_name || ''} ${parent.last_name || ''}`.trim(),
              userEmail: parent.email || '',
              status: lead.tracking_source || (isOrganic ? 'organic' : ''),
              createdAt: lead.created_at,
              affiliateType: isOrganic ? 'organic' : (affiliateType || ''),
              affiliateName: isOrganic ? '' : (affiliateName || ''),
              leadType: lead.lead_type || '',
              onboardingType: lead.onboarding_type || '',
              fullName: lead.full_name || '',
            };
          });
          res.json(result);
        } catch (err) {
          console.error("[COO LEADS] Exception:", err);
          res.status(500).json({ message: "Failed to fetch leads", error: String(err) });
        }
      }
    );
  // ========================================

  // Get COO dashboard stats
  app.get(
    "/api/coo/stats",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const allUsers = await storage.getUsersByRole("tutor");
        const verifiedTutors = allUsers.filter((u) => u.verified);
        const pendingApplications = allUsers.filter((u) => !u.verified);
        const pods = await storage.getPods();
        const activePods = pods.filter((p) => p.status === "active");

        let totalStudents = 0;
        let totalSessions = 0;

        for (const tutor of allUsers) {
          const students = await storage.getStudentsByTutor(tutor.id);
          totalStudents += students.length;
          for (const student of students) {
            totalSessions += student.sessionProgress;
          }
        }

        const completionRate =
          totalStudents > 0 ? (totalSessions / (totalStudents * 9)) * 100 : 0;

        res.json({
          totalTutors: allUsers.length,
          verifiedTutors: verifiedTutors.length,
          pendingApplications: pendingApplications.length,
          activePods: activePods.length,
          totalStudents,
          totalSessions,
          completionRate,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ message: "Failed to fetch stats" });
      }
    }
  );

  // Get COO sales & affiliate overview stats
  app.get(
    "/api/coo/sales-stats",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        // Get all affiliates
        const affiliates = await storage.getUsersByRole("affiliate");
        
        // Import supabase from storage
        const supabase = (storage as any).supabase;
        
        // Get all leads and closes - only count actual affiliate relationships
        const { data: leads = [] } = await supabase
          .from("leads")
          .select("*");
        
        const { data: closes = [] } = await supabase
          .from("closes")
          .select("*");
        
        // Affiliate details - only count their own leads/closes
        const affiliateDetails = affiliates.map(aff => {
          const affLeads = leads.filter((l: any) => l.affiliate_id === aff.id);
          const affCloses = closes.filter((c: any) => 
            affLeads.some((l: any) => l.user_id === c.parent_id)
          );
          
          return {
            id: aff.id,
            name: aff.name || aff.email,
            email: aff.email,
            totalLeads: affLeads.length,
            totalCloses: affCloses.length,
            conversionRate: affLeads.length > 0 
              ? Math.round((affCloses.length / affLeads.length) * 100) 
              : 0,
          };
        });
        
        // Organic leads (affiliate_id is null)
        const organicLeads = leads.filter((l: any) => l.affiliate_id === null);
        const organicCloses = closes.filter((c: any) => 
          organicLeads.some((l: any) => l.user_id === c.parent_id)
        );
        
        const organicStats = {
          id: "organic",
          name: "Organic Traffic",
          email: "Direct signups",
          totalLeads: organicLeads.length,
          totalCloses: organicCloses.length,
          conversionRate: organicLeads.length > 0 
            ? Math.round((organicCloses.length / organicLeads.length) * 100) 
            : 0,
          isOrganic: true,
        };
        
        // Combine affiliate and organic details, sort by leads
        const allDetails = [
          ...affiliateDetails,
          ...(organicLeads.length > 0 ? [organicStats] : [])
        ].sort((a, b) => b.totalLeads - a.totalLeads);
        
        // Only return affiliate data + organic
        res.json({
          affiliateDetails: allDetails,
        });
      } catch (error) {
        console.error("Error fetching sales stats:", error);
        res.status(500).json({ message: "Failed to fetch sales stats" });
      }
    }
  );

  // Get OD tracking summary for EGP performance
  app.get(
    "/api/od/tracking",
    isAuthenticated,
    requireRole(["od"]),
    async (req: Request, res: Response) => {
      try {
        const affiliates = await storage.getUsersByRole("affiliate");
        const supabase = (storage as any).supabase;

        const { data: leads = [] } = await supabase
          .from("leads")
          .select("*");

        const { data: closes = [] } = await supabase
          .from("closes")
          .select("*");

        const affiliateDetails = affiliates
          .map((affiliate: any) => {
            const affiliateLeads = leads.filter((lead: any) => lead.affiliate_id === affiliate.id);
            const affiliateLeadParentIds = new Set(affiliateLeads.map((lead: any) => lead.user_id).filter(Boolean));
            const affiliateCloses = closes.filter((close: any) =>
              close.affiliate_id === affiliate.id ||
              affiliateLeadParentIds.has(close.parent_id)
            );

            const totalPayments = affiliateCloses.reduce((sum: number, close: any) => {
              const amount = Number(close.commission_amount || 0);
              return sum + (Number.isFinite(amount) ? amount : 0);
            }, 0);

            const paidPayments = affiliateCloses
              .filter((close: any) => String(close.commission_status || "").toLowerCase() === "paid")
              .reduce((sum: number, close: any) => {
                const amount = Number(close.commission_amount || 0);
                return sum + (Number.isFinite(amount) ? amount : 0);
              }, 0);

            return {
              id: affiliate.id,
              name: affiliate.name || affiliate.email || "Unnamed EGP",
              email: affiliate.email,
              totalLeads: affiliateLeads.length,
              totalCloses: affiliateCloses.length,
              totalPayments,
              paidPayments,
              pendingPayments: Math.max(totalPayments - paidPayments, 0),
              conversionRate: affiliateLeads.length > 0
                ? Math.round((affiliateCloses.length / affiliateLeads.length) * 100)
                : 0,
            };
          })
          .sort((a: any, b: any) => b.totalLeads - a.totalLeads);

        res.json({
          totalLeads: leads.filter((lead: any) => lead.affiliate_id).length,
          totalCloses: affiliateDetails.reduce((sum: number, affiliate: any) => sum + affiliate.totalCloses, 0),
          totalPayments: affiliateDetails.reduce((sum: number, affiliate: any) => sum + affiliate.totalPayments, 0),
          pendingPayments: affiliateDetails.reduce((sum: number, affiliate: any) => sum + affiliate.pendingPayments, 0),
          affiliateDetails,
        });
      } catch (error) {
        console.error("Error fetching OD tracking:", error);
        res.status(500).json({ message: "Failed to fetch OD tracking" });
      }
    }
  );

  app.get(
    "/api/battle-tests/banks/tutor",
    isAuthenticated,
    requireRole(["td", "coo"]),
    async (_req: Request, res: Response) => {
      res.json(TUTOR_BATTLE_TEST_PHASES_SAFE);
    }
  );

  app.get(
    "/api/battle-tests/banks/td",
    isAuthenticated,
    requireRole(["coo", "td"]),
    async (_req: Request, res: Response) => {
      res.json([TD_BATTLE_TEST_PHASE_EXACT]);
    }
  );

  app.get(
    "/api/battle-tests/pods/:podId/summary",
    isAuthenticated,
    requireRole(["td", "coo"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        const { podId } = req.params;
        const pod = await storage.getPod(podId);

        if (!pod) {
          return res.status(404).json({ message: "Pod not found" });
        }

        if (dbUser.role === "td" && String(pod.tdId || "") !== String(dbUser.id)) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const assignments = await storage.getTutorAssignmentsByPod(podId);
        const tutorMeta = await Promise.all(
          assignments.map(async (assignment) => {
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
          podId,
          tutorMeta,
          tdUser
            ? {
                tdId: tdUser.id,
                tdName: tdUser.name || tdUser.firstName || "Assigned TD",
              }
            : null
        );

        res.json(summary);
      } catch (error) {
        console.error("Error fetching pod battle-testing summary:", error);
        res.status(500).json({ message: "Failed to fetch battle-testing summary" });
      }
    }
  );

  app.get(
    "/api/battle-tests/pods/:podId/runs",
    isAuthenticated,
    requireRole(["td", "coo"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        const { podId } = req.params;
        const pod = await storage.getPod(podId);

        if (!pod) {
          return res.status(404).json({ message: "Pod not found" });
        }
        if (dbUser.role === "td" && String(pod.tdId || "") !== String(dbUser.id)) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const assignments = await storage.getTutorAssignmentsByPod(podId);
        const nameByUserId: Record<string, string> = {};
        for (const assignment of assignments) {
          const tutor = await storage.getUser(assignment.tutorId);
          if (tutor) {
            nameByUserId[tutor.id] = tutor.name || tutor.firstName || "Assigned Tutor";
          }
        }
        if (pod.tdId) {
          const tdUser = await storage.getUser(pod.tdId);
          if (tdUser) {
            nameByUserId[tdUser.id] = tdUser.name || tdUser.firstName || "Assigned TD";
          }
        }

        const runs = await getBattleTestRunHistoryForPod(podId, nameByUserId, {
          currentTutorIds: assignments.map((assignment) => assignment.tutorId),
        });
        res.json(runs);
      } catch (error) {
        console.error("Error fetching battle-testing runs:", error);
        res.status(500).json({ message: "Failed to fetch battle-testing runs" });
      }
    }
  );

  app.get(
    "/api/battle-tests/runs/:runId",
    isAuthenticated,
    requireRole(["td", "coo"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        const { runId } = req.params;
        const { data: runLookup, error: lookupError } = await supabase
          .from("battle_test_runs")
          .select("pod_id, subject_type, subject_user_id")
          .eq("id", runId)
          .single();

        if (lookupError || !runLookup) {
          return res.status(404).json({ message: "Battle-testing run not found" });
        }

        const pod = await storage.getPod(String(runLookup.pod_id));
        if (!pod) {
          return res.status(404).json({ message: "Pod not found" });
        }

        if (dbUser.role === "td" && String(pod.tdId || "") !== String(dbUser.id)) {
          let portableTutorAccess = false;

          if (String(runLookup.subject_type || "") === "tutor") {
            const currentTutorAssignment = await storage.getTutorAssignment(String(runLookup.subject_user_id || ""));
            portableTutorAccess = String(currentTutorAssignment?.pod?.tdId || "") === String(dbUser.id);
          }

          if (!portableTutorAccess) {
            return res.status(403).json({ message: "Forbidden" });
          }
        }

        const assignments = await storage.getTutorAssignmentsByPod(String(runLookup.pod_id));
        const nameByUserId: Record<string, string> = {};
        for (const assignment of assignments) {
          const tutor = await storage.getUser(assignment.tutorId);
          if (tutor) {
            nameByUserId[tutor.id] = tutor.name || tutor.firstName || "Assigned Tutor";
          }
        }
        if (String(runLookup.subject_type || "") === "tutor" && !nameByUserId[String(runLookup.subject_user_id || "")]) {
          const tutor = await storage.getUser(String(runLookup.subject_user_id || ""));
          if (tutor) {
            nameByUserId[tutor.id] = tutor.name || tutor.firstName || "Assigned Tutor";
          }
        }
        if (pod.tdId) {
          const tdUser = await storage.getUser(pod.tdId);
          if (tdUser) {
            nameByUserId[tdUser.id] = tdUser.name || tdUser.firstName || "Assigned TD";
          }
        }

        const runDetail = await getBattleTestRunDetail(runId, nameByUserId);
        res.json(runDetail);
      } catch (error) {
        console.error("Error fetching battle-testing run detail:", error);
        res.status(500).json({ message: "Failed to fetch battle-testing run detail" });
      }
    }
  );

  app.post(
    "/api/td/pods/:podId/tutor-battle-tests",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        const { podId } = req.params;
        const pod = await storage.getPod(podId);

        if (!pod || String(pod.tdId || "") !== String(dbUser.id)) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const payload = tutorBattleTestSubmissionSchema.parse(req.body || {});
        const assignments = await storage.getTutorAssignmentsByPod(podId);
        const assignment = assignments.find((entry) => String(entry.id) === String(payload.tutorAssignmentId));
        if (!assignment || String(assignment.tutorId) !== String(payload.tutorId)) {
          return res.status(400).json({ message: "Tutor assignment mismatch" });
        }

        const phases = getTutorBattleTestPhaseDefinitionsExact(payload.phaseKeys);
        if (phases.length !== payload.phaseKeys.length) {
          return res.status(400).json({ message: "Invalid tutor battle-testing phase selection" });
        }

        const result = await persistBattleTestRun({
          podId,
          subjectType: "tutor",
          subjectUserId: payload.tutorId,
          tutorAssignmentId: payload.tutorAssignmentId,
          createdByUserId: dbUser.id,
          templateKey: "tt_tutor_alignment_engine",
          phases,
          responses: payload.responses as BattleTestResponseInput[],
        });

        res.json(buildBattleTestSuccessPayload(result.runId, result.outcome));
      } catch (error) {
        console.error("Error saving tutor battle test:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to save tutor battle test" });
      }
    }
  );

  const getEligibleOdEgps = async () => {
    const affiliates = await storage.getUsersByRole("affiliate");
    const applications = await getAffiliateApplicationsByQuery();

    const appsByUser = new Map<string, any[]>();
    for (const application of applications) {
      const userId = String(application.user_id || application.userId || "");
      if (!userId) continue;
      const current = appsByUser.get(userId) || [];
      current.push(application);
      appsByUser.set(userId, current);
    }

    const { data: activeCrewMembers = [], error: activeCrewMembersError } = await supabase
      .from("egp_crew_members")
      .select("crew_id, egp_id")
      .is("removed_at", null);

    if (activeCrewMembersError) {
      throw new Error(`Failed to fetch active crew memberships: ${activeCrewMembersError.message}`);
    }

    const crewByEgpId = new Map<string, string>();
    for (const membership of activeCrewMembers || []) {
      crewByEgpId.set(String(membership.egp_id), String(membership.crew_id));
    }

    return affiliates
      .map((affiliate) => {
        const userApps = appsByUser.get(String(affiliate.id)) || [];
        const application = selectCanonicalAffiliateApplication(userApps);
        if (!application) return null;

        const status = String(application.status || "").toLowerCase();
        const documentsStatus = buildEgpOnboardingStatuses(application.documentsStatus || application.documents_status);
        const allApproved = ["1", "2", "3", "4", "5"].every(
          (step) => String(documentsStatus[step] || "") === "approved"
        );
        const onboardingCompletedAt = application.onboardingCompletedAt ?? application.onboarding_completed_at ?? null;

        if (!["approved", "confirmed"].includes(status)) return null;
        if (!onboardingCompletedAt) return null;
        if (!allApproved) return null;

        return {
          id: affiliate.id,
          name: affiliate.name || affiliate.email || "Unnamed EGP",
          email: affiliate.email,
          onboardingCompletedAt,
          applicationStatus: status,
          currentCrewId: crewByEgpId.get(String(affiliate.id)) || null,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")));
  };

  const buildOdCrewSummaries = async () => {
    const { data: crews = [], error: crewsError } = await supabase
      .from("egp_crews")
      .select("*")
      .order("created_at", { ascending: false });

    if (crewsError) {
      throw new Error(`Failed to fetch crews: ${crewsError.message}`);
    }

    const { data: crewMembers = [], error: crewMembersError } = await supabase
      .from("egp_crew_members")
      .select("*")
      .is("removed_at", null)
      .order("joined_at", { ascending: true });

    if (crewMembersError) {
      throw new Error(`Failed to fetch crew members: ${crewMembersError.message}`);
    }

    const egpIds = Array.from(new Set((crewMembers || []).map((member: any) => String(member.egp_id)).filter(Boolean)));

    const [usersResult, leadsResult, closesResult] = await Promise.all([
      egpIds.length
        ? supabase.from("users").select("id, email, first_name, last_name, name").in("id", egpIds)
        : Promise.resolve({ data: [], error: null } as any),
      egpIds.length
        ? supabase.from("leads").select("affiliate_id").in("affiliate_id", egpIds)
        : Promise.resolve({ data: [], error: null } as any),
      egpIds.length
        ? supabase.from("closes").select("affiliate_id, commission_amount, commission_status").in("affiliate_id", egpIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (usersResult.error) throw new Error(`Failed to fetch crew EGP users: ${usersResult.error.message}`);
    if (leadsResult.error) throw new Error(`Failed to fetch crew lead totals: ${leadsResult.error.message}`);
    if (closesResult.error) throw new Error(`Failed to fetch crew close totals: ${closesResult.error.message}`);

    const userById = new Map<string, any>();
    for (const user of usersResult.data || []) {
      userById.set(String(user.id), user);
    }

    const leadCountByEgp = new Map<string, number>();
    for (const lead of leadsResult.data || []) {
      const egpId = String(lead.affiliate_id || "");
      if (!egpId) continue;
      leadCountByEgp.set(egpId, (leadCountByEgp.get(egpId) || 0) + 1);
    }

    const closeStatsByEgp = new Map<string, { totalCloses: number; totalPayments: number; pendingPayments: number }>();
    for (const close of closesResult.data || []) {
      const egpId = String(close.affiliate_id || "");
      if (!egpId) continue;

      const current = closeStatsByEgp.get(egpId) || { totalCloses: 0, totalPayments: 0, pendingPayments: 0 };
      const amount = Number(close.commission_amount || 0);
      const safeAmount = Number.isFinite(amount) ? amount : 0;
      const isPaid = String(close.commission_status || "").toLowerCase() === "paid";

      current.totalCloses += 1;
      current.totalPayments += safeAmount;
      if (!isPaid) current.pendingPayments += safeAmount;
      closeStatsByEgp.set(egpId, current);
    }

    const membersByCrewId = new Map<string, any[]>();
    for (const member of crewMembers || []) {
      const crewId = String(member.crew_id);
      const egpId = String(member.egp_id);
      const user = userById.get(egpId);
      const closeStats = closeStatsByEgp.get(egpId) || { totalCloses: 0, totalPayments: 0, pendingPayments: 0 };

      const current = membersByCrewId.get(crewId) || [];
      current.push({
        egpId,
        membershipId: member.id,
        role: member.role,
        joinedAt: member.joined_at,
        name:
          user?.name ||
          [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
          user?.email ||
          "Unnamed EGP",
        email: user?.email || null,
        totalLeads: leadCountByEgp.get(egpId) || 0,
        totalCloses: closeStats.totalCloses,
        totalPayments: closeStats.totalPayments,
        pendingPayments: closeStats.pendingPayments,
      });
      membersByCrewId.set(crewId, current);
    }

    return (crews || []).map((crew: any) => {
      const members = membersByCrewId.get(String(crew.id)) || [];
      return {
        id: crew.id,
        crewName: crew.crew_name,
        territory: crew.territory,
        status: crew.status,
        createdAt: crew.created_at,
        updatedAt: crew.updated_at,
        memberCount: members.length,
        totalLeads: members.reduce((sum, member) => sum + Number(member.totalLeads || 0), 0),
        totalCloses: members.reduce((sum, member) => sum + Number(member.totalCloses || 0), 0),
        totalPayments: members.reduce((sum, member) => sum + Number(member.totalPayments || 0), 0),
        pendingPayments: members.reduce((sum, member) => sum + Number(member.pendingPayments || 0), 0),
        members,
      };
    });
  };

  app.get(
    "/api/od/crew-eligible-egps",
    isAuthenticated,
    requireRole(["od"]),
    async (_req: Request, res: Response) => {
      try {
        const eligibleEgps = await getEligibleOdEgps();
        res.json(eligibleEgps);
      } catch (error) {
        console.error("Error fetching OD eligible EGPs:", error);
        res.status(500).json({ message: "Failed to fetch eligible EGPs" });
      }
    }
  );

  app.get(
    "/api/od/crews",
    isAuthenticated,
    requireRole(["od"]),
    async (_req: Request, res: Response) => {
      try {
        const crews = await buildOdCrewSummaries();
        res.json(crews);
      } catch (error) {
        console.error("Error fetching OD crews:", error);
        res.status(500).json({ message: "Failed to fetch crews" });
      }
    }
  );

  app.post(
    "/api/od/crews",
    isAuthenticated,
    requireRole(["od"]),
    async (req: Request, res: Response) => {
      try {
        const creatorId = (req as any).dbUser.id;
        const schema = z.object({
          crewName: z.string().min(1),
          territory: z.string().trim().optional().nullable(),
        });
        const payload = schema.parse(req.body || {});

        const { data, error } = await supabase
          .from("egp_crews")
          .insert({
            crew_name: payload.crewName.trim(),
            territory: payload.territory?.trim() || null,
            created_by: creatorId,
          })
          .select("*")
          .single();

        if (error || !data) {
          throw new Error(error?.message || "Failed to create crew");
        }

        res.json({
          id: data.id,
          crewName: data.crew_name,
          territory: data.territory,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      } catch (error) {
        console.error("Error creating OD crew:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create crew" });
      }
    }
  );

  app.post(
    "/api/od/crews/:crewId/members",
    isAuthenticated,
    requireRole(["od"]),
    async (req: Request, res: Response) => {
      try {
        const { crewId } = req.params;
        const schema = z.object({
          egpId: z.string().min(1),
          role: z.enum(["member", "crew_lead"]).optional(),
        });
        const payload = schema.parse(req.body || {});

        const { data: crew, error: crewError } = await supabase
          .from("egp_crews")
          .select("id, status")
          .eq("id", crewId)
          .maybeSingle();

        if (crewError) throw new Error(crewError.message);
        if (!crew) return res.status(404).json({ message: "Crew not found" });
        if (String(crew.status || "") !== "active") {
          return res.status(400).json({ message: "Only active crews can accept members" });
        }

        const eligibleEgps = await getEligibleOdEgps();
        const egp = eligibleEgps.find((entry: any) => String(entry.id) === String(payload.egpId));
        if (!egp) {
          return res.status(400).json({ message: "This EGP is not eligible for crew assignment" });
        }
        if (egp.currentCrewId && String(egp.currentCrewId) !== String(crewId)) {
          return res.status(400).json({ message: "This EGP is already assigned to another crew" });
        }
        if (egp.currentCrewId && String(egp.currentCrewId) === String(crewId)) {
          return res.status(400).json({ message: "This EGP is already in this crew" });
        }

        const { error: insertError } = await supabase
          .from("egp_crew_members")
          .insert({
            crew_id: crewId,
            egp_id: payload.egpId,
            role: payload.role || "member",
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        res.json({ success: true });
      } catch (error) {
        console.error("Error adding EGP to crew:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to add EGP to crew" });
      }
    }
  );

  app.delete(
    "/api/od/crews/:crewId/members/:egpId",
    isAuthenticated,
    requireRole(["od"]),
    async (req: Request, res: Response) => {
      try {
        const { crewId, egpId } = req.params;
        const { error } = await supabase
          .from("egp_crew_members")
          .update({ removed_at: new Date() })
          .eq("crew_id", crewId)
          .eq("egp_id", egpId)
          .is("removed_at", null);

        if (error) throw new Error(error.message);
        res.json({ success: true });
      } catch (error) {
        console.error("Error removing EGP from crew:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to remove EGP from crew" });
      }
    }
  );

  // Get affiliate encounters
  app.get(
    "/api/affiliate/:affiliateId/encounters",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { affiliateId } = req.params;
        const supabase = (storage as any).supabase;
        
        const { data: encounters } = await supabase
          .from("encounters")
          .select("*")
          .eq("affiliate_id", affiliateId)
          .order("created_at", { ascending: false });
        
        res.json(encounters || []);
      } catch (error) {
        console.error("Error fetching encounters:", error);
        res.status(500).json({ message: "Failed to fetch encounters" });
      }
    }
  );

  // Get affiliate leads
  app.get(
    "/api/affiliate/:affiliateId/leads",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { affiliateId } = req.params;
        const supabase = (storage as any).supabase;
        
        const { data: leads } = await supabase
          .from("leads")
          .select("*")
          .eq("affiliate_id", affiliateId)
          .order("created_at", { ascending: false });
        
        res.json(leads || []);
      } catch (error) {
        console.error("Error fetching leads:", error);
        res.status(500).json({ message: "Failed to fetch leads" });
      }
    }
  );

  // Get affiliate closes
  app.get(
    "/api/affiliate/:affiliateId/closes",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { affiliateId } = req.params;
        const supabase = (storage as any).supabase;
        
        // Get leads for this affiliate first
        const { data: affLeads = [] } = await supabase
          .from("leads")
          .select("*")
          .eq("affiliate_id", affiliateId);
        
        // Get closes where parent_id matches any of this affiliate's leads
        const parentIds = affLeads.map((l: any) => l.user_id);
        let query = supabase.from("closes").select("*");
        
        if (parentIds.length > 0) {
          query = query.in("parent_id", parentIds);
        } else {
          // Return empty array if no leads
          return res.json([]);
        }
        
        const { data: closes } = await query.order("created_at", { ascending: false });
        
        res.json(closes || []);
      } catch (error) {
        console.error("Error fetching closes:", error);
        res.status(500).json({ message: "Failed to fetch closes" });
      }
    }
  );

  // Get organic leads (affiliate_id = null)
  app.get(
    "/api/organic/leads",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const supabase = (storage as any).supabase;
        
        const { data: leads } = await supabase
          .from("leads")
          .select("*")
          .is("affiliate_id", null)
          .order("created_at", { ascending: false });
        
        res.json(leads || []);
      } catch (error) {
        console.error("Error fetching organic leads:", error);
        res.status(500).json({ message: "Failed to fetch organic leads" });
      }
    }
  );

  // Get organic closes (from organic leads only)
  app.get(
    "/api/organic/closes",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const supabase = (storage as any).supabase;
        
        // Get organic leads (affiliate_id = null)
        const { data: organicLeads = [] } = await supabase
          .from("leads")
          .select("*")
          .is("affiliate_id", null);
        
        // Get closes where parent_id matches any organic lead
        const parentIds = organicLeads.map((l: any) => l.user_id);
        let query = supabase.from("closes").select("*");
        
        if (parentIds.length > 0) {
          query = query.in("parent_id", parentIds);
        } else {
          return res.json([]);
        }
        
        const { data: closes } = await query.order("created_at", { ascending: false });
        
        res.json(closes || []);
      } catch (error) {
        console.error("Error fetching organic closes:", error);
        res.status(500).json({ message: "Failed to fetch organic closes" });
      }
    }
  );

  // Get applications (verified and unverified tutors)
  app.get(
    "/api/coo/applications",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const tutors = await storage.getUsersByRole("tutor");
        const applications = await Promise.all(
          tutors.map(async (tutor) => {
            const verificationDoc = await storage.getVerificationDocByTutor(tutor.id);
            return { user: tutor, verificationDoc };
          })
        );
        res.json(applications);
      } catch (error) {
        console.error("Error fetching applications:", error);
        res.status(500).json({ message: "Failed to fetch applications" });
      }
    }
  );

  // Verify tutor
  app.post(
    "/api/coo/verify-tutor/:userId",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        await storage.updateUserVerification(userId, true);
        await storage.updateVerificationStatus(userId, "verified");
        res.json({ success: true });
      } catch (error) {
        console.error("Error verifying tutor:", error);
        res.status(500).json({ message: "Failed to verify tutor" });
      }
    }
  );

  // Reject tutor
  app.post(
    "/api/coo/reject-tutor/:userId",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        await storage.updateVerificationStatus(userId, "rejected");
        res.json({ success: true });
      } catch (error) {
        console.error("Error rejecting tutor:", error);
        res.status(500).json({ message: "Failed to reject tutor" });
      }
    }
  );

  // Get all pods
  app.get(
    "/api/coo/pods",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const pods = await storage.getPods();
        res.json(pods);
      } catch (error) {
        console.error("Error fetching pods:", error);
        res.status(500).json({ message: "Failed to fetch pods" });
      }
    }
  );

  app.get(
    "/api/coo/pods/operating-overview",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const pods = await storage.getPods();
        const overview = await Promise.all(pods.map((pod) => buildPodOperatingOverview(pod)));
        res.json(overview);
      } catch (error) {
        console.error("Error fetching pod operating overview:", error);
        res.status(500).json({ message: "Failed to fetch pod operating overview" });
      }
    }
  );

  app.get(
    "/api/tutor/students/:studentId/communications",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const { studentId } = req.params;
        const student = await storage.getStudent(studentId);

        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const parentId = await resolveParentIdForStudent(student, tutorId);
        const bundle = await buildStudentCommunicationBundle({ student, parentId });
        await Promise.all(
          COMMUNICATION_AUDIENCES.map((audience) =>
            markCommunicationThreadRead({ studentId, audience, viewerRole: "tutor" })
          )
        );

        res.json(bundle);
      } catch (error) {
        console.error("Error fetching tutor communications:", error);
        res.status(500).json({ message: "Failed to fetch communications" });
      }
    }
  );

  app.post(
    "/api/coo/pods/:podId/td-battle-tests",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const dbUser = (req as any).dbUser;
        const { podId } = req.params;
        const payload = tdBattleTestSubmissionSchema.parse(req.body || {});
        const pod = await storage.getPod(podId);

        if (!pod || String(pod.tdId || "") !== String(payload.tdId)) {
          return res.status(400).json({ message: "TD is not assigned to this pod" });
        }

        const result = await persistBattleTestRun({
          podId,
          subjectType: "td",
          subjectUserId: payload.tdId,
          createdByUserId: dbUser.id,
          templateKey: TD_BATTLE_TEST_PHASE_EXACT.key,
          phases: [TD_BATTLE_TEST_PHASE_EXACT],
          responses: payload.responses as BattleTestResponseInput[],
        });

        res.json(buildBattleTestSuccessPayload(result.runId, result.outcome));
      } catch (error) {
        console.error("Error saving TD battle test:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to save TD battle test" });
      }
    }
  );

  app.get(
    "/api/tutor/students/:studentId/communications/unread-count",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const { studentId } = req.params;
        const student = await storage.getStudent(studentId);

        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const { data, error } = await supabase
          .from("student_communication_messages")
          .select("id")
          .eq("student_id", studentId)
          .is("read_by_tutor_at", null)
          .neq("sender_role", "tutor");

        if (error) throw error;

        res.json({ unreadCount: (data || []).length });
      } catch (error) {
        console.error("Error fetching communication unread count:", error);
        res.status(500).json({ message: "Failed to fetch unread count" });
      }
    }
  );

  app.post(
    "/api/tutor/students/:studentId/communications",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const tutorId = (req as any).dbUser.id;
        const { studentId } = req.params;
        const parsed = insertStudentCommunicationMessageSchema.parse(req.body || {});
        const student = await storage.getStudent(studentId);

        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const parentId = await resolveParentIdForStudent(student, tutorId);
        if (parsed.audience === "parent" && !parentId) {
          return res.status(400).json({ message: "Parent is not available for this student" });
        }

        const inserted = await createStudentCommunicationMessage({
          student,
          parentId,
          audience: parsed.audience,
          senderRole: "tutor",
          senderUserId: tutorId,
          replyToMessageId: parsed.replyToMessageId,
          message: parsed.message,
        });

        res.json({
          id: inserted.id,
          audience: inserted.audience,
          createdAt: inserted.created_at,
        });
      } catch (error) {
        console.error("Error sending tutor communication:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to send message" });
      }
    }
  );

  const MAX_TUTORS_PER_POD = 12;
  const getMaxStudentsPerTutorForVehicle = (vehicle?: string | null) => {
    switch (vehicle) {
      case "6_seater":
        return 6;
      case "5_seater":
        return 5;
      case "4_seater":
      default:
        return 4;
    }
  };

  // Get deleted pods
  app.get(
    "/api/coo/deleted-pods",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const pods = await storage.getDeletedPods();
        res.json(pods);
      } catch (error) {
        console.error("Error fetching deleted pods:", error);
        res.status(500).json({ message: "Failed to fetch deleted pods" });
      }
    }
  );

  // Delete pod (soft delete)
  app.delete(
    "/api/coo/pods/:podId",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { podId } = req.params;
        await storage.deletePod(podId);
        res.json({ message: "Pod deleted successfully" });
      } catch (error) {
        console.error("Error deleting pod:", error);
        res.status(500).json({ message: "Failed to delete pod" });
      }
    }
  );

  // Create pod
  app.post(
    "/api/coo/pods",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      let pod: any = null;
      const createdAssignments: Array<{ id: string }> = [];

      try {
        console.log("📦 Creating pod with data:", req.body);
        const { tutorIds, ...podData } = req.body;
        
        // Validate pod data first
        const data = insertPodSchema.parse({
          ...podData,
          startDate: podData.startDate ? new Date(podData.startDate) : null,
        });
        console.log("✅ Validated pod data:", data);

        // Validate tutors BEFORE creating pod
        if (tutorIds && Array.isArray(tutorIds) && tutorIds.length > 0) {
          const uniqueTutorIds = [...new Set(tutorIds)];
          if (uniqueTutorIds.length !== tutorIds.length) {
            return res.status(400).json({
              message: "Tutor selection contains duplicates",
            });
          }

          // Validate tutor count
          if (tutorIds.length > MAX_TUTORS_PER_POD) {
            return res.status(400).json({ 
              message: `Pods can have a maximum of ${MAX_TUTORS_PER_POD} tutors`
            });
          }

          // Get pod-eligible tutors to validate assignments
          const approvedTutors = await storage.getApprovedTutors();
          const approvedTutorIds = new Set(approvedTutors.map(t => t.id));

          // Validate all tutorIds are pod-eligible
          const invalidTutors = tutorIds.filter(id => !approvedTutorIds.has(id));
          if (invalidTutors.length > 0) {
            console.error("❌ Attempted to assign tutors who are not pod-eligible:", invalidTutors);
            return res.status(400).json({ 
              message: "All assigned tutors must have completed onboarding and verified documents",
              invalidTutors
            });
          }

          const { data: existingAssignments, error: assignmentsError } = await supabase
            .from("tutor_assignments")
            .select("tutor_id, pod_id")
            .in("tutor_id", tutorIds);

          if (assignmentsError) {
            throw new Error(`Failed to validate tutor assignments: ${assignmentsError.message}`);
          }

          const alreadyAssignedTutorIds = (existingAssignments || []).map((assignment: any) => assignment.tutor_id);
          if (alreadyAssignedTutorIds.length > 0) {
            return res.status(400).json({
              message: "Some tutors are already assigned to a pod",
              duplicates: alreadyAssignedTutorIds,
            });
          }

          console.log(`✅ Validated ${tutorIds.length} pod-eligible tutors`);
        }

        // Create pod only after all validations pass
        pod = await storage.createPod(data);
        console.log("✅ Pod created successfully:", pod);

        // Assign validated tutors to pod
        if (tutorIds && Array.isArray(tutorIds) && tutorIds.length > 0) {
          console.log(`📝 Assigning ${tutorIds.length} pod-eligible tutors to pod ${pod.id}`);
          for (const tutorId of tutorIds) {
            const assignment = await createPortableTutorAssignment(tutorId, pod.id);
            createdAssignments.push({ id: assignment.id });
          }
          console.log("✅ Tutors assigned successfully");
        }
        
        res.json(pod);
      } catch (error: any) {
        console.error("❌ Error creating pod:", error);
        console.error("❌ Error details:", error.message);
        console.error("❌ Stack trace:", error.stack);

        if (createdAssignments.length > 0) {
          await rollbackPortableTutorAssignments(createdAssignments);
        }

        if (pod?.id) {
          try {
            await storage.deletePod(pod.id);
          } catch (rollbackError) {
            console.error("Failed to soft-delete pod after assignment creation error:", rollbackError);
          }
        }

        res.status(400).json({ 
          message: "Failed to create pod",
          error: error.message || "Unknown error"
        });
      }
    }
  );

  // Get tutors assigned to a pod
  app.get(
    "/api/coo/pods/:podId/tutors",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { podId } = req.params;
        const assignments = await storage.getTutorAssignmentsByPod(podId);
        const pod = await storage.getPod(podId);
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
        const tdUser = pod?.tdId ? await storage.getUser(pod.tdId) : null;
        const podSummary = await buildPodBattleTestingSummary(
          podId,
          tutorMeta,
          tdUser
            ? {
                tdId: tdUser.id,
                tdName: tdUser.name || tdUser.firstName || "Assigned TD",
              }
            : null
        );
        
        // Fetch tutor details for each assignment
        const tutorsData = await Promise.all(
          assignments.map(async (assignment: any) => {
            const tutor = await storage.getUser(assignment.tutorId);
            const tutorSummary =
              podSummary.tutorSummaries.find((entry) => entry.assignmentId === assignment.id) ||
              podSummary.tutorSummaries.find((entry) => entry.tutorId === assignment.tutorId) ||
              null;
            const loadStats = await loadTutorAssignmentLoadStats(assignment.tutorId);

            return {
              ...assignment,
              tutorName: tutor?.name || "Unknown",
              tutorEmail: tutor?.email || "",
              student_count: loadStats.activeAssignmentCount,
              studentCount: loadStats.activeAssignmentCount,
              operational_mode:
                (assignment.operational_mode && String(assignment.operational_mode).toLowerCase() !== "watchlist"
                  ? assignment.operational_mode
                  : assignment.operationalMode && String(assignment.operationalMode).toLowerCase() !== "watchlist"
                  ? assignment.operationalMode
                  : tutorSummary?.mode) ||
                "training",
              sandbox_parent_count: loadStats.sandboxParentCount,
              live_parent_count: loadStats.liveParentCount,
              awaiting_tutor_acceptance_count: loadStats.awaitingTutorAcceptanceCount,
              module_progress: tutorSummary?.moduleProgress || [],
              next_battle_tests: tutorSummary?.nextBattleTests || [],
              certification_recovery_note: tutorSummary?.certificationRecoveryNote || null,
              recovery_required_until: tutorSummary?.recoveryRequiredUntil || null,
            };
          })
        );
        
        res.json(tutorsData);
      } catch (error) {
        console.error("Error fetching pod tutors:", error);
        res.status(500).json({ message: "Failed to fetch pod tutors" });
      }
    }
  );

  // Get all tutor assignments across all pods (to prevent duplicate assignments)
  app.get(
    "/api/coo/all-tutor-assignments",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { data: assignments } = await supabase
          .from("tutor_assignments")
          .select("tutor_id");
        
        console.log("📋 Raw assignments from DB:", assignments);
        
        if (!assignments) {
          console.log("📋 No assignments found, returning empty array");
          return res.json([]);
        }
        
        // Transform snake_case to camelCase (tutor_id -> tutorId)
        // Return just the tutor IDs to check against
        const tutorIds = assignments.map((a: any) => a.tutor_id);
        console.log("📋 All assigned tutor IDs:", tutorIds);
        res.json(tutorIds);
      } catch (error) {
        console.error("Error fetching all tutor assignments:", error);
        res.status(500).json({ message: "Failed to fetch tutor assignments" });
      }
    }
  );

  // Get pod statistics
  app.get(
    "/api/coo/pods/:podId/stats",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { podId } = req.params;
        const assignments = await storage.getTutorAssignmentsByPod(podId);
        const tutorIds = assignments.map((a: any) => a.tutorId).filter(Boolean);
        const activeEnrollmentStatuses = ["assigned", "proposal_sent", "session_booked", "report_received", "confirmed"];
        
        // Calculate statistics
        const totalTutors = assignments.length;
        let totalStudents = 0;

        if (tutorIds.length > 0) {
          const { count } = await supabase
            .from("parent_enrollments")
            .select("id", { count: "exact", head: true })
            .in("assigned_tutor_id", tutorIds)
            .in("status", activeEnrollmentStatuses);
          totalStudents = count || 0;
        }

        let sessionsCompleted = 0;
        if (tutorIds.length > 0) {
          const { count } = await supabase
            .from("scheduled_sessions")
            .select("id", { count: "exact", head: true })
            .in("tutor_id", tutorIds)
            .eq("status", "completed");
          sessionsCompleted = count || 0;
        }
        
        res.json({
          totalTutors,
          totalStudents,
          sessionsCompleted
        });
      } catch (error) {
        console.error("Error fetching pod statistics:", error);
        res.status(500).json({ message: "Failed to fetch pod statistics" });
      }
    }
  );

  // Get students for a specific tutor (COO view)
  app.get(
    "/api/coo/tutors/:tutorId/students",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { tutorId } = req.params;
        console.log("📚 COO requesting students for tutor:", tutorId);

        const certificationMode = await getTutorCertificationMode(tutorId);
        await cleanupLegacyLiveEnrollmentsForNonLiveTutor(tutorId, certificationMode);
        let assignedEnrollmentsQuery = supabase
          .from("parent_enrollments")
          .select("id, user_id, student_full_name, assigned_student_id, status, current_step, parent_full_name, parent_email, is_sandbox_account")
          .eq("assigned_tutor_id", tutorId)
          .in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES, "awaiting_tutor_acceptance"]);

        if (certificationMode === "sandbox") {
          assignedEnrollmentsQuery = assignedEnrollmentsQuery.eq("is_sandbox_account", true);
        }

        let { data: assignedEnrollments } = await assignedEnrollmentsQuery;

        // Backward-compatible fallback if assigned_student_id is missing in older DB variants
        if (!assignedEnrollments) {
          let fallbackQuery = supabase
            .from("parent_enrollments")
            .select("id, user_id, student_full_name, status, current_step, parent_full_name, parent_email")
            .eq("assigned_tutor_id", tutorId)
            .in("status", [...ACTIVE_PARENT_ENROLLMENT_STATUSES, "awaiting_tutor_acceptance"]);
          if (certificationMode === "sandbox") {
            fallbackQuery = fallbackQuery.eq("is_sandbox_account", true);
          }
          const fallback = await fallbackQuery;
          assignedEnrollments = fallback.data as any;
        }

        const students = await hydrateStudentsWithSessionProgress(
          tutorId,
          await storage.getStudentsByTutor(tutorId)
        );

        const assignedEnrollmentByStudentId = new Set(
          (assignedEnrollments || [])
            .map((e: any) => e.assigned_student_id)
            .filter((v: any) => !!v)
            .map((v: any) => String(v))
        );
        const assignedEnrollmentByParentId = new Set(
          (assignedEnrollments || [])
            .map((e: any) => e.user_id)
            .filter((v: any) => !!v)
            .map((v: any) => String(v))
        );
        const assignedEnrollmentByStudentName = new Set(
          (assignedEnrollments || [])
            .map((e: any) => e.student_full_name)
            .filter((v: any) => !!v)
            .map((v: any) => String(v).trim().toLowerCase())
        );

        const activeStudents = students.filter((student: any) => {
          const studentId = String(student.id || "");
          const parentId = String((student as any).parentId || "");
          const studentName = String(student.name || "").trim().toLowerCase();

          return (
            assignedEnrollmentByStudentId.has(studentId) ||
            (!!parentId && assignedEnrollmentByParentId.has(parentId)) ||
            (!!studentName && assignedEnrollmentByStudentName.has(studentName))
          );
        });

        const studentsWithEnrollment = activeStudents.map((student: any) => {
          const studentId = String(student.id || "");
          const parentId = String((student as any).parentId || "");
          const parentEnrollmentId = String((student as any).parentEnrollmentId || (student as any).parent_enrollment_id || "");
          const studentName = String(student.name || "").trim().toLowerCase();

          const linkedEnrollment =
            (parentEnrollmentId
              ? (assignedEnrollments || []).find((e: any) => String(e.id || "") === parentEnrollmentId)
              : null) ||
            (assignedEnrollments || []).find((e: any) => {
            const enrollmentStudentId = String(e.assigned_student_id || "");
            const enrollmentParentId = String(e.user_id || "");
            const enrollmentStudentName = String(e.student_full_name || "").trim().toLowerCase();

            return (
              (!!enrollmentStudentId && enrollmentStudentId === studentId) ||
              (!!parentId && !!enrollmentParentId && enrollmentParentId === parentId) ||
              (!!studentName && !!enrollmentStudentName && enrollmentStudentName === studentName)
            );
          });

          return {
            ...student,
            assignedEnrollmentId: linkedEnrollment?.id || null,
            parentName: linkedEnrollment?.parent_full_name || null,
            parentEmail: linkedEnrollment?.parent_email || null,
            enrollmentStatus: linkedEnrollment?.status || null,
            enrollmentCurrentStep: linkedEnrollment?.current_step || null,
            isSandboxAssignment: linkedEnrollment ? isSandboxEnrollmentForTutor(linkedEnrollment, tutorId) : false,
            isReassignmentPreserved: Boolean(
              linkedEnrollment?.current_step &&
                String(linkedEnrollment.current_step).trim().toLowerCase().startsWith(REASSIGNMENT_RESUME_PREFIX)
            ),
          };
        });

        console.log(
          "📚 Found students:",
          studentsWithEnrollment.map((s) => ({
            id: s.id,
            name: s.name,
            sessionProgress: s.sessionProgress,
            assignedEnrollmentId: s.assignedEnrollmentId,
            isSandboxAssignment: s.isSandboxAssignment,
          }))
        );
        const dedupedStudentsWithEnrollment = Array.from(
          new Map(
            studentsWithEnrollment.map((student: any) => {
              const key =
                String(student.assignedEnrollmentId || "").trim() ||
                String(student.parentEnrollmentId || student.parent_enrollment_id || "").trim() ||
                String(student.id || "").trim();
              return [key, student];
            })
          ).values()
        );
        res.json(dedupedStudentsWithEnrollment);
      } catch (error) {
        console.error("Error fetching tutor students:", error);
        res.status(500).json({ message: "Failed to fetch tutor students" });
      }
    }
  );

  // Get student identity sheet (COO read-only view)
  app.get(
    "/api/coo/students/:studentId/identity-sheet",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        console.log("📋 COO requesting identity sheet for student:", studentId);
        
        // Direct query to check what's in DB
        const { data: directData, error: directError } = await supabase
          .from("students")
          .select("*")
          .eq("id", studentId);
        console.log("📋 Direct query result:", JSON.stringify(directData, null, 2));
        console.log("📋 Direct query error:", directError);
        
        const student = await storage.getStudent(studentId);
        
        if (!student) {
          console.log("❌ Student not found via storage:", studentId);
          return res.status(404).json({ message: "Student not found" });
        }

        console.log("✅ Student found:", student.id);
        console.log("📋 Student personalProfile:", student.personalProfile);
        console.log("📋 Student emotionalInsights:", student.emotionalInsights);
        console.log("📋 Student academicDiagnosis:", student.academicDiagnosis);
        console.log("📋 Student identitySheet:", student.identitySheet);

        const identitySheetData = {
          personalProfile: student.personalProfile || null,
          emotionalInsights: student.emotionalInsights || null,
          academicDiagnosis: student.academicDiagnosis || null,
          identitySheet: student.identitySheet || null,
          completedAt: student.identitySheetCompletedAt || null,
        };

        console.log("📋 Returning identity sheet data:", identitySheetData);
        res.json(identitySheetData);
      } catch (error) {
        console.error("Error fetching identity sheet for COO:", error);
        res.status(500).json({ message: "Failed to fetch identity sheet" });
      }
    }
  );

  // Get student assignments (COO read-only view)
  app.get(
    "/api/coo/students/:studentId/assignments",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const student = await storage.getStudent(studentId);
        
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        const { data: assignments, error } = await supabase
          .from("assignments")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching assignments:", error);
          return res.status(500).json({ message: "Failed to fetch assignments" });
        }

        res.json(assignments || []);
      } catch (error) {
        console.error("Error fetching student assignments for COO:", error);
        res.status(500).json({ message: "Failed to fetch assignments" });
      }
    }
  );

  // Reports center data per student (COO read-only view)
  app.get(
    "/api/coo/students/:studentId/reports-center",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const student = await storage.getStudent(studentId);

        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        const { data: drillRows, error: drillRowsError } = await supabase
          .from("intro_session_drills")
          .select("id, student_id, tutor_id, drill, submitted_at")
          .eq("student_id", studentId)
          .order("submitted_at", { ascending: false });

        if (drillRowsError) {
          throw drillRowsError;
        }

        const sessions = aggregateDeterministicSessions(drillRows || []);

        const { data: reports, error: reportsError } = await supabase
          .from("parent_reports")
          .select("*")
          .eq("student_id", studentId)
          .order("sent_at", { ascending: false });

        if (reportsError) {
          throw reportsError;
        }

        const enrichedReports = (reports || []).map((report: any) => ({
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
          structuredData: parseStructuredReportSummary(report.summary),
        }));

        res.json({
          sessions,
          reports: enrichedReports,
        });
      } catch (error) {
        console.error("Error fetching COO reports center data:", error);
        res.status(500).json({ message: "Failed to fetch reports center data" });
      }
    }
  );

  // Get student tracking data (COO read-only view)
  app.get(
    "/api/coo/students/:studentId/tracking",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const student = await storage.getStudent(studentId);
        
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        const sessions = await getTTScheduledSessionsByStudent(studentId);

        // Get parent reports
        const { data: parentReports, error: reportsError } = await supabase
          .from("parent_reports")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        // Get TD feedback
        const { data: tdFeedback, error: feedbackError } = await supabase
          .from("td_feedback")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        if (reportsError || feedbackError) {
          console.error("Error fetching tracking data:", { reportsError, feedbackError });
          return res.status(500).json({ message: "Failed to fetch tracking data" });
        }

        res.json({
          sessions: sessions || [],
          parentReports: parentReports || [],
          tdFeedback: tdFeedback || [],
        });
      } catch (error) {
        console.error("Error fetching student tracking for COO:", error);
        res.status(500).json({ message: "Failed to fetch tracking data" });
      }
    }
  );

  app.get(
    "/api/coo/students/:studentId/communications",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const student = await storage.getStudent(studentId);

        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }

        const parentId =
          (student as any)?.parentId ||
          (student as any)?.parent_id ||
          (await resolveParentIdForStudent(student, student.tutorId));

        res.json(await buildStudentCommunicationBundle({ student, parentId: parentId || null }));
      } catch (error) {
        console.error("Error fetching COO communications:", error);
        res.status(500).json({ message: "Failed to fetch communications" });
      }
    }
  );

  // Remove tutor from pod
  app.delete(
    "/api/coo/pods/:podId/tutors/:assignmentId",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      let assignmentId = String(req.params.assignmentId || "").trim();
      let tutorId = "";
      let certificationCleared = false;
      let assignmentDeleted = false;
      const detachedEnrollments: any[] = [];

      try {
        const { podId } = req.params;

        const { data: assignmentRow, error: assignmentError } = await supabase
          .from("tutor_assignments")
          .select("id, tutor_id, pod_id")
          .eq("id", assignmentId)
          .eq("pod_id", podId)
          .maybeSingle();

        if (assignmentError) {
          throw new Error(`Failed to load tutor assignment: ${assignmentError.message}`);
        }

        if (!assignmentRow) {
          return res.status(404).json({ message: "Tutor assignment not found" });
        }

        tutorId = String(assignmentRow.tutor_id || "").trim();
        if (!tutorId) {
          return res.status(400).json({ message: "Tutor assignment is missing a tutor reference" });
        }

        await upsertTutorPortableCertificationSnapshot(assignmentId, tutorId);

        const { data: assignedEnrollments, error: assignedEnrollmentsError } = await loadTutorAssignedEnrollments(
          tutorId,
          { ordered: true, includeAnyAssignedState: true }
        );

        if (assignedEnrollmentsError) {
          throw new Error(`Failed to load tutor enrollments for pod removal: ${assignedEnrollmentsError.message}`);
        }

        for (const enrollment of assignedEnrollments || []) {
          await safelyUnassignEnrollmentFromTutor(enrollment, tutorId, {
            notificationMessage: `${String(enrollment?.student_full_name || "Student").trim() || "Student"} from ${String(enrollment?.parent_full_name || "Parent").trim() || "Parent"} has been removed from your pod assignment. The enrollment has been preserved for reassignment.`,
            cleanupArtifacts: false,
          });
          detachedEnrollments.push(enrollment);
        }

        await clearTutorAssignmentCertificationState(assignmentId);
        certificationCleared = true;
        await storage.deleteTutorAssignment(assignmentId);
        assignmentDeleted = true;

        const cleanupWarnings: string[] = [];
        for (const enrollment of detachedEnrollments) {
          try {
            await cleanupDetachedEnrollmentArtifacts(enrollment, tutorId);
          } catch (cleanupError: any) {
            console.error("Failed to clean detached enrollment artifacts after pod removal:", cleanupError);
            cleanupWarnings.push(String(enrollment?.id || "unknown"));
          }
        }

        res.json({
          message: "Tutor removed from pod successfully",
          cleanupWarnings,
        });
      } catch (error) {
        console.error("Error removing tutor from pod:", error);

        if (!assignmentDeleted && tutorId) {
          for (const enrollment of [...detachedEnrollments].reverse()) {
            try {
              await restoreDetachedEnrollmentToTutor(enrollment, tutorId);
            } catch (rollbackError) {
              console.error("Failed to restore detached enrollment during pod removal rollback:", rollbackError);
            }
          }

          if (certificationCleared) {
            try {
              await hydrateTutorAssignmentFromPortableSnapshot(assignmentId, tutorId);
            } catch (rollbackError) {
              console.error("Failed to restore tutor certification during pod removal rollback:", rollbackError);
            }
          }
        }

        res.status(500).json({ message: "Failed to remove tutor from pod" });
      }
    }
  );

  // Add tutor to existing pod
  app.post(
    "/api/coo/pods/:podId/tutors",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      const createdAssignments: Array<{ id: string }> = [];

      try {
        const { podId } = req.params;
        const { tutorIds } = req.body;
        
        if (!Array.isArray(tutorIds) || tutorIds.length === 0) {
          return res.status(400).json({ message: "tutorIds must be a non-empty array" });
        }

        const uniqueTutorIds = [...new Set(tutorIds)];
        if (uniqueTutorIds.length !== tutorIds.length) {
          return res.status(400).json({ message: "Tutor selection contains duplicates" });
        }

        // Get current assignments
        const currentAssignments = await storage.getTutorAssignmentsByPod(podId);
        const totalTutors = currentAssignments.length + tutorIds.length;

        // Validate tutor count
        if (totalTutors > MAX_TUTORS_PER_POD) {
          return res.status(400).json({ 
            message: `Pod would exceed maximum of ${MAX_TUTORS_PER_POD} tutors (current: ${currentAssignments.length}, adding: ${tutorIds.length})`
          });
        }

        // Validate all tutors are pod-eligible
        const approvedTutors = await storage.getApprovedTutors();
        const approvedTutorIds = new Set(approvedTutors.map(t => t.id));

        const invalidTutors = tutorIds.filter((id: string) => !approvedTutorIds.has(id));
        if (invalidTutors.length > 0) {
          return res.status(400).json({ 
            message: "All assigned tutors must have completed onboarding and verified documents",
            invalidTutors
          });
        }

        // Check for existing assignments in this pod
        const existingIds = new Set(currentAssignments.map((a: any) => a.tutorId));
        const duplicates = tutorIds.filter((id: string) => existingIds.has(id));
        if (duplicates.length > 0) {
          return res.status(400).json({ 
            message: "Some tutors are already assigned to this pod",
            duplicates
          });
        }

        // Check for assignments in other pods
        const { data: existingAssignments, error: assignmentsError } = await supabase
          .from("tutor_assignments")
          .select("tutor_id, pod_id")
          .in("tutor_id", tutorIds);

        if (assignmentsError) {
          throw new Error(`Failed to validate tutor assignments: ${assignmentsError.message}`);
        }

        const assignedElsewhere = (existingAssignments || [])
          .filter((assignment: any) => assignment.pod_id !== podId)
          .map((assignment: any) => assignment.tutor_id);

        if (assignedElsewhere.length > 0) {
          return res.status(400).json({
            message: "Some tutors are already assigned to another pod",
            duplicates: assignedElsewhere,
          });
        }

        // Create new assignments
        const newAssignments = [];
        for (const tutorId of tutorIds) {
          const assignment = await createPortableTutorAssignment(tutorId, podId);
          createdAssignments.push({ id: assignment.id });
          newAssignments.push(assignment);
        }

        res.json(newAssignments);
      } catch (error: any) {
        console.error("Error adding tutors to pod:", error);

        if (
          error?.message === "Tutor is already assigned to this pod" ||
          error?.message === "Tutor is already assigned to another pod"
        ) {
          return res.status(400).json({ message: error.message });
        }

        if (createdAssignments.length > 0) {
          await rollbackPortableTutorAssignments(createdAssignments);
        }

        res.status(400).json({ message: "Failed to add tutors to pod" });
      }
    }
  );

  // Get TDs with pod assignments
  app.get(
    "/api/coo/tds",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const tds = await storage.getUsersByRole("td");
        const pods = await storage.getPods();
        
        // Add pod assignment to each TD
        const tdsWithPods = tds.map(td => {
          const assignedPod = pods.find(p => p.tdId === td.id);
          return {
            ...td,
            assignedPodId: assignedPod?.id || null,
          };
        });
        
        res.json(tdsWithPods);
      } catch (error) {
        console.error("Error fetching TDs:", error);
        res.status(500).json({ message: "Failed to fetch TDs" });
      }
    }
  );

  // Get tutors eligible for pod assignment (confirmed onboarding and verified docs)
  app.get(
    "/api/coo/approved-tutors",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const approvedTutors = await storage.getApprovedTutors();
        console.log("👥 Pod-eligible tutors:", approvedTutors.map((t: any) => ({ id: t.id, name: t.name })));
        res.json(approvedTutors);
      } catch (error) {
        console.error("Error fetching approved tutors:", error);
        res.status(500).json({ message: "Failed to fetch approved tutors" });
      }
    }
  );

  // Get role permissions
  app.get(
    "/api/coo/role-permissions",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const permissions = await storage.getRolePermissions();
        res.json(permissions);
      } catch (error) {
        console.error("Error fetching role permissions:", error);
        res.status(500).json({ message: "Failed to fetch role permissions" });
      }
    }
  );

  // Assign TD to pod
  app.post(
    "/api/coo/assign-td",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const schema = z.object({
          tdId: z.string(),
          podId: z.string(),
        });
        const { tdId, podId } = schema.parse(req.body);
        
        // Update the pod to have this TD
        await storage.updatePodTD(podId, tdId);
        
        // Update the role permission to include the pod assignment
        const user = await storage.getUser(tdId);
        if (user && user.email) {
          await storage.addRolePermission({
            email: user.email,
            role: "td",
            assignedPodId: podId,
          });
        }
        
        res.json({ success: true });
      } catch (error) {
        console.error("Error assigning TD:", error);
        res.status(400).json({ message: "Failed to assign TD" });
      }
    }
  );

  // Send broadcast
  app.post(
    "/api/coo/broadcast",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        console.log("📤 Broadcast request body:", JSON.stringify(req.body, null, 2));
        const data = insertBroadcastSchema.parse(req.body);
        console.log("✅ Broadcast validated:", JSON.stringify(data, null, 2));
        const broadcast = await storage.createBroadcast(data);
        res.json(broadcast);
      } catch (error: any) {
        console.error("❌ Error creating broadcast:", error);
        if (error.errors) {
          console.error("Validation errors:", error.errors);
          return res.status(400).json({ message: "Validation failed", errors: error.errors });
        }
        res.status(400).json({ message: "Failed to create broadcast" });
      }
    }
  );

  app.get(
    "/api/coo/brain/library",
    isAuthenticated,
    requireRole(["coo"]),
    async (_req: Request, res: Response) => {
      try {
        const items = await storage.getCooBrainLibraryItems();
        res.json(items);
      } catch (error) {
        console.error("Error fetching COO brain library items:", error);
        res.status(500).json({ message: "Failed to fetch COO brain library items" });
      }
    }
  );

  app.post(
    "/api/coo/brain/library",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const parsed = insertCooBrainRichTextSchema.parse(req.body);
        const item = await storage.createCooBrainLibraryItem({
          name: parsed.name.trim(),
          kind: "rich_text",
          content: parsed.content,
          createdBy: userId,
        } as any);
        res.json(item);
      } catch (error: any) {
        console.error("Error creating COO brain rich text item:", error);
        if (error.errors) {
          return res.status(400).json({ message: "Validation failed", errors: error.errors });
        }
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create library item" });
      }
    }
  );

  app.post(
    "/api/coo/brain/library/upload-pdf",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const parsed = uploadCooBrainPdfSchema.parse(req.body);
        const normalizedFileName = parsed.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const lowerFileName = normalizedFileName.toLowerCase();
        const normalizedFileType = String(parsed.fileType || "").trim().toLowerCase();

        if (!lowerFileName.endsWith(".pdf") && normalizedFileType !== "application/pdf") {
          return res.status(400).json({ message: "Only PDF uploads are supported in the COO Library." });
        }

        const normalizedBase64 = parsed.fileData.includes(",")
          ? parsed.fileData.split(",").pop() || ""
          : parsed.fileData;
        const buffer = Buffer.from(normalizedBase64, "base64");

        if (!buffer.byteLength) {
          return res.status(400).json({ message: "Uploaded PDF file was empty." });
        }

        if (buffer.byteLength > 25 * 1024 * 1024) {
          return res.status(400).json({ message: "Uploaded PDF must be 25 MB or smaller." });
        }

        const bucketName = "coo-brain-library";
        const { error: bucketError } = await supabase.storage.createBucket(bucketName, { public: true });
        if (bucketError && !/already exists|duplicate/i.test(String(bucketError.message || ""))) {
          console.warn("Could not pre-create COO brain library bucket:", bucketError);
        }

        const storagePath = `coo/${userId}/${Date.now()}-${normalizedFileName}`;
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, buffer, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          console.error("Supabase storage upload error (COO brain PDF):", uploadError);
          return res.status(500).json({ message: "Storage upload failed", error: uploadError.message });
        }

        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
        if (!urlData?.publicUrl) {
          return res.status(500).json({ message: "Upload succeeded but file URL could not be generated" });
        }

        const item = await storage.createCooBrainLibraryItem({
          name: parsed.name.trim(),
          kind: "pdf",
          pdfUrl: urlData.publicUrl,
          pdfFileName: parsed.fileName,
          createdBy: userId,
        } as any);

        res.json(item);
      } catch (error: any) {
        console.error("Error uploading COO brain PDF:", error);
        if (error.errors) {
          return res.status(400).json({ message: "Validation failed", errors: error.errors });
        }
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to upload PDF" });
      }
    }
  );

  // ========================================
  // SHARED ROUTES (Tutors, TDs, COO)
  // ========================================

  // Get broadcasts
  app.get(
    "/api/broadcasts",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userCreatedAt = (req as any).dbUser?.createdAt;
        const broadcasts = await storage.getBroadcasts(userCreatedAt);
        res.json(broadcasts);
      } catch (error) {
        console.error("Error fetching broadcasts:", error);
        res.status(500).json({ message: "Failed to fetch broadcasts" });
      }
    }
  );

  // Get unread broadcast count
  app.get(
    "/api/broadcasts/unread-count",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const userCreatedAt = (req as any).dbUser?.createdAt;
        const unreadCount = await storage.getUnreadBroadcastCount(userId, userCreatedAt);
        res.json({ unreadCount });
      } catch (error) {
        console.error("Error fetching unread count:", error);
        res.status(500).json({ message: "Failed to fetch unread count" });
      }
    }
  );

  // Get user's read broadcasts
  app.get(
    "/api/broadcasts/read-list",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const readBroadcasts = await storage.getUserBroadcastReads(userId);
        res.json({ readBroadcasts });
      } catch (error) {
        console.error("Error fetching read broadcasts:", error);
        res.status(500).json({ message: "Failed to fetch read broadcasts" });
      }
    }
  );

  // Check broadcast_reads table status
  app.get("/api/broadcasts/table-status", async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from("broadcast_reads")
        .select("id")
        .limit(1);
      
      if (error && error.code === 'PGRST205') {
        return res.json({ 
          tableExists: false, 
          message: "broadcast_reads table not found. Please run BROADCAST_READS_TABLE.sql in Supabase SQL Editor"
        });
      }
      
      res.json({ 
        tableExists: true, 
        message: "broadcast_reads table exists"
      });
    } catch (error) {
      res.json({ 
        tableExists: false, 
        error: "Unable to check table status"
      });
    }
  });

  // Mark broadcast as read
  app.post(
    "/api/broadcasts/:broadcastId/read",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const { broadcastId } = req.params;
        
        // Validate broadcastId is not empty
        if (!broadcastId || broadcastId.trim() === "") {
          return res.status(400).json({ message: "Invalid broadcast ID" });
        }
        
        await storage.markBroadcastAsRead(userId, broadcastId);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error marking broadcast as read:", error);
        if (error.message === "Broadcast not found") {
          return res.status(404).json({ message: "Broadcast not found" });
        }
        if (error.message === "User not found") {
          return res.status(401).json({ message: "User not found" });
        }
        // Check if table doesn't exist
        if (error?.code === 'PGRST205' || error?.message?.includes('broadcast_reads')) {
          return res.status(503).json({ 
            message: "Broadcast read tracking not available. Please run BROADCAST_READS_TABLE.sql in Supabase SQL Editor",
            tableIssue: true
          });
        }
        res.status(500).json({ message: "Failed to mark broadcast as read" });
      }
    }
  );

  // Notifications
  app.get("/api/notifications", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser.id;
      const userCreatedAt = (req as any).dbUser?.createdAt;
      const notifications = await storage.getNotifications(userId, userCreatedAt);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser.id;
      const userCreatedAt = (req as any).dbUser?.createdAt;
      const unreadCount = await storage.getUnreadNotificationCount(userId, userCreatedAt);
      res.json({ unreadCount });
    } catch (error) {
      console.error("Error fetching notification unread count:", error);
      res.status(500).json({ message: "Failed to fetch notification unread count" });
    }
  });

  app.post("/api/notifications/:notificationId/read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser.id;
      const { notificationId } = req.params;
      await storage.markNotificationAsRead(userId, notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.get("/api/push/vapid-public-key", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      res.json({ publicKey: getWebPushPublicKey() });
    } catch (error: any) {
      res.status(503).json({ message: error?.message || "Web push is not configured" });
    }
  });

  app.post("/api/push/subscribe", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser.id;
      const subscription = req.body?.subscription;

      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ message: "Valid push subscription is required" });
      }

      await storage.upsertPushSubscription({
        userId,
        endpoint: subscription.endpoint,
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
        expirationTime: subscription.expirationTime ?? null,
        userAgent: req.get("user-agent") || null,
      } as any);

      res.status(204).send();
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Failed to save push subscription" });
    }
  });

  app.post("/api/push/unsubscribe", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const endpoint = req.body?.endpoint;
      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint is required" });
      }

      await storage.deletePushSubscriptionByEndpoint(endpoint);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting push subscription:", error);
      res.status(500).json({ message: "Failed to delete push subscription" });
    }
  });

  // ========================================
  // TUTOR APPLICATION ROUTES
  // ========================================

  // Submit tutor application
  app.post(
    "/api/tutor/application",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const data = insertTutorApplicationSchema.parse({
          ...req.body,
          userId,
        });
        const application = await storage.createTutorApplication(data);
        res.json(application);
      } catch (error) {
        console.error("Error submitting tutor application:", error);
        res.status(400).json({ message: "Failed to submit application" });
      }
    }
  );

  // Get tutor's application status (for gateway)
  app.get(
    "/api/tutor/application-status",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        console.log("📋 Fetching tutor application status for user:", userId);
        
        // Add a timeout so this doesn't hang forever (increased to 15s for high-latency networks)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database query timeout after 15s")), 15000)
        );
        
        const applicationsPromise = storage.getTutorApplicationsByUser(userId);
        const applications = await Promise.race([applicationsPromise, timeoutPromise]) as any[];
        
        console.log("✅ Got applications:", applications?.length || 0, "for user:", userId);
        
        if (!applications || applications.length === 0) {
          console.log("📝 User has no applications, returning not_applied");
          return res.json({ status: "not_applied" });
        }

        const applicationStatus = deriveTutorGatewayApplicationStatus(applications[0]);
        console.log("✅ Returning status:", applicationStatus.status, "for user:", userId);
        return res.json(applicationStatus);
        
        // Get the most recent application
        const latestApp = applications[0];
        console.log("📝 Latest app status:", latestApp.status, "for user:", userId);
        
        // Check if under 18 based on age in application
        const isUnder18 = latestApp.age < 18;
        
        const fallbackDocumentsStatus = {
          "1": "pending_upload",
          "2": "not_started",
          "3": "not_started",
          "4": "not_started",
          "5": "not_started",
          "6": "not_started",
        };
        const documentsStatus = latestApp.documentsStatus && typeof latestApp.documentsStatus === "object"
          ? { ...fallbackDocumentsStatus, ...latestApp.documentsStatus }
          : fallbackDocumentsStatus;
        const sequentialDocSteps = ["1", "2", "3", "4", "5", "6"];
        const sequentialReviewStarted = sequentialDocSteps.some((step) => {
          const docStatus = String((documentsStatus as any)?.[step] || "");
          return docStatus === "pending_review" || docStatus === "approved" || docStatus === "rejected";
        });
        const allSequentialDocumentsApproved = sequentialDocSteps.every(
          (step) => String((documentsStatus as any)?.[step] || "") === "approved"
        );

        // Map application status to gateway status
        let status: string;
        switch (latestApp.status) {
          case "pending":
            status = "pending";
            break;
          case "approved":
            if (allSequentialDocumentsApproved) {
              status = "confirmed";
            } else if (sequentialReviewStarted) {
              status = "verification"; // Docs uploaded, awaiting verification
            } else {
              status = "approved"; // Still needs to upload docs
            }
            break;
          case "rejected":
            status = "rejected";
            break;
          default:
            status = "pending";
        }
        
        console.log("✅ Returning status:", status, "for user:", userId);
        res.json({
          status,
          applicationId: latestApp.id,
          isUnder18,
          documentSubmissionStep: latestApp.documentSubmissionStep || (latestApp.status === "approved" ? 1 : 0),
          documentsStatus,
          onboardingCompletedAt: latestApp.onboardingCompletedAt ?? null,
        });
      } catch (error) {
        console.error("❌ Error fetching tutor application status:", error);
        res.status(500).json({ message: "Failed to fetch application status" });
      }
    }
  );

  app.patch(
    "/api/coo/pods/:podId/tutors/:assignmentId/operational-mode",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        return res.status(409).json({
          message: "Tutor mode is certification-driven and can no longer be switched manually.",
        });
      } catch (error) {
        console.error("Error updating tutor operational mode:", error);
        res.status(500).json({ message: "Failed to update tutor operational mode" });
      }
    }
  );

  app.get(
    "/api/tutor/onboarding-documents",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const applications = await storage.getTutorApplicationsByUser(userId);
        const latestApp = applications[0];

        if (!latestApp) {
          return res.status(404).json({ message: "Tutor application not found" });
        }

        const documents = await Promise.all(
          TUTOR_ONBOARDING_DOCUMENTS.map(async (document) => {
            if (!document.requiresAcceptance) {
              return document;
            }

            const loaded = await loadTutorOnboardingDocument(document.step);
            return {
              step: loaded.step,
              code: loaded.code,
              title: loaded.title,
              version: loaded.version,
              effectiveDate: loaded.effectiveDate ?? null,
              lastUpdatedAt: loaded.lastUpdatedAt ?? null,
              requiresAcceptance: loaded.requiresAcceptance,
              requiresUpload: loaded.requiresUpload,
              mandatoryClauses: loaded.mandatoryClauses,
              content: loaded.content,
              contentHash: loaded.contentHash,
            };
          })
        );

        res.json({
          applicationId: latestApp.id,
          documents,
        });
      } catch (error) {
        console.error("Error fetching tutor onboarding documents:", error);
        res.status(500).json({ message: "Failed to fetch onboarding documents" });
      }
    }
  );

  app.post(
    "/api/tutor/onboarding-documents/:docStep/accept",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const docStep = Number(req.params.docStep);
        const {
          applicationId,
          documentVersion,
          documentHash,
          typedFullName,
          acceptedTimezone,
          locale,
          platform,
          sourceFlow,
          formData,
          acceptedClauseKeys,
          scrollCompletionPercent,
          viewStartedAt,
          viewCompletedAt,
          acceptClickedAt,
        } = req.body ?? {};

        if (!applicationId || !Number.isInteger(docStep) || docStep < 1 || docStep > 5) {
          return res.status(400).json({ message: "Invalid onboarding acceptance request" });
        }

        if (!typedFullName || !String(typedFullName).trim()) {
          return res.status(400).json({ message: "Typed full name is required" });
        }

        const applications = await storage.getTutorApplicationsByUser(userId);
        const application = applications.find((entry) => entry.id === applicationId);
        if (!application) {
          return res.status(403).json({ message: "Application not found or access denied" });
        }

        const definition = getTutorOnboardingDocumentDefinition(docStep);
        if (!definition.requiresAcceptance) {
          return res.status(400).json({ message: "This onboarding step does not use in-app acceptance." });
        }

        const loaded = await loadTutorOnboardingDocument(docStep);
        if (documentVersion && documentVersion !== loaded.version) {
          return res.status(409).json({ message: "Document version mismatch" });
        }
        if (documentHash && documentHash !== loaded.contentHash) {
          return res.status(409).json({ message: "Document content hash mismatch" });
        }

        const acceptedClauseKeySet = new Set(
          Array.isArray(acceptedClauseKeys) ? acceptedClauseKeys.map((value) => String(value)) : []
        );
        const missingClause = definition.mandatoryClauses.find((clause) => !acceptedClauseKeySet.has(clause.key));
        if (missingClause) {
          return res.status(400).json({ message: `Mandatory clause not acknowledged: ${missingClause.label}` });
        }

        const parsedViewStartedAt = viewStartedAt ? new Date(viewStartedAt) : null;
        const parsedViewCompletedAt = viewCompletedAt ? new Date(viewCompletedAt) : null;
        const parsedAcceptClickedAt = acceptClickedAt ? new Date(acceptClickedAt) : new Date();

        const result = await storage.createTutorOnboardingAcceptance({
          applicationId,
          userId,
          documentStep: docStep,
          documentCode: loaded.code,
          documentTitle: loaded.title,
          documentVersion: loaded.version,
          documentEffectiveDate: loaded.effectiveDate ?? null,
          documentLastUpdatedAt: loaded.lastUpdatedAt ? new Date(loaded.lastUpdatedAt) : null,
          documentSnapshot: loaded.content,
          documentChecksum: loaded.contentHash,
          typedFullName: String(typedFullName).trim(),
          accountEmail: application.email,
          phoneNumberSnapshot: application.phone ?? null,
          acceptedTimezone: acceptedTimezone ? String(acceptedTimezone) : null,
          ipAddress: extractRequestIp(req),
          userAgent: req.headers["user-agent"] || null,
          deviceType: inferDeviceType(req.headers["user-agent"]),
          platform: platform ? String(platform) : "web",
          sessionId: req.sessionID || null,
          locale: locale ? String(locale) : null,
          sourceFlow: sourceFlow ? String(sourceFlow) : "tutor_onboarding_step",
          formSnapshotJson:
            formData && typeof formData === "object"
              ? Object.fromEntries(
                  Object.entries(formData).map(([key, value]) => [String(key), String(value ?? "").trim()])
                )
              : null,
          acceptedClauses: definition.mandatoryClauses.filter((clause) => acceptedClauseKeySet.has(clause.key)),
          scrollCompletionPercent:
            typeof scrollCompletionPercent === "number"
              ? Math.max(0, Math.min(100, Math.round(scrollCompletionPercent)))
              : null,
          viewStartedAt: parsedViewStartedAt && !Number.isNaN(parsedViewStartedAt.getTime()) ? parsedViewStartedAt : null,
          viewCompletedAt:
            parsedViewCompletedAt && !Number.isNaN(parsedViewCompletedAt.getTime()) ? parsedViewCompletedAt : null,
          acceptClickedAt:
            parsedAcceptClickedAt && !Number.isNaN(parsedAcceptClickedAt.getTime()) ? parsedAcceptClickedAt : new Date(),
        });

        if (!result.application || !result.acceptance) {
          return res.status(500).json({ message: "Failed to create onboarding acceptance" });
        }

        res.json({
          success: true,
          application: result.application,
          acceptance: result.acceptance,
          receipt: {
            acceptedAt: result.acceptance.acceptedAt,
            documentCode: result.acceptance.documentCode,
            documentVersion: result.acceptance.documentVersion,
            documentChecksum: result.acceptance.documentChecksum,
          },
        });
      } catch (error) {
        console.error("Error accepting tutor onboarding document:", error);
        if (
          error instanceof Error &&
          /(step order violation|already been accepted|required|mandatory clause)/i.test(error.message)
        ) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to accept onboarding document" });
      }
    }
  );

  // Upload tutor onboarding document
  app.post(
    "/api/tutor/onboarding-documents/upload",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const { applicationId, docStep, fileName, fileData, fileType } = req.body;
        const parsedDocStep = typeof docStep === "number" ? docStep : Number(docStep);
        const isSequentialUpload = parsedDocStep === 2 || parsedDocStep === 6;

        if (!applicationId || !fileName || !fileData || !isSequentialUpload) {
          return res.status(400).json({ message: "Only doc step 2 (Matric certificate) and doc step 6 (certified ID) accept file uploads." });
        }

        // Verify the application belongs to this user
        const applications = await storage.getTutorApplicationsByUser(userId);
        const app = applications.find(a => a.id === applicationId) as any;
        if (!app) {
          return res.status(403).json({ message: "Application not found or access denied" });
        }
        if (parsedDocStep === 2 && !app?.onboardingAcceptanceMap?.["2"]) {
          return res.status(400).json({ message: "You must accept Response Integrity-EQV-002 in app before uploading your certified Matric certificate." });
        }

        // Decode base64 file data
        const buffer = Buffer.from(fileData, 'base64');

        // Ensure file path begins with userId folder
        const safeFileName = fileName.startsWith(`${userId}/`) ? fileName : `${userId}/${fileName}`;

        // Upload using server (service role) supabase client to avoid RLS issues
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('tutor-documents')
          .upload(safeFileName, buffer, {
            contentType: fileType || undefined,
            upsert: true,
          });

        if (uploadError) {
          console.error('Supabase storage upload error:', uploadError);
          return res.status(500).json({ message: 'Storage upload failed', error: uploadError.message });
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from('tutor-documents').getPublicUrl(safeFileName);
        if (!urlData?.publicUrl) {
          console.error('Could not resolve public URL for uploaded onboarding document', {
            applicationId,
            docStep: parsedDocStep,
            safeFileName,
          });
          return res.status(500).json({ message: 'Upload succeeded but file URL could not be generated' });
        }

        // Save to database
        const updated = await storage.updateTutorSequentialDocument(applicationId, parsedDocStep, urlData.publicUrl);

        if (!updated) {
          return res.status(500).json({ message: 'Failed to update document record' });
        }

        res.json({ success: true, application: updated, publicUrl: urlData.publicUrl });
      } catch (error) {
        if (
          error instanceof Error &&
          /(sequential step order violation|blocked until|already approved|required|pending review)/i.test(
            error.message
          )
        ) {
          return res.status(400).json({ message: error.message });
        }
        console.error('Error uploading onboarding document (server handler):', error);
        res.status(500).json({ message: 'Failed to upload document' });
      }
    }
  );

  app.get(
    "/api/tutor/onboarding-documents/:docStep/download",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const docStep = Number(req.params.docStep);
        const templateFiles: Record<number, { assetFileName: string; downloadFileName: string }> = {
          1: { assetFileName: "TT-TCF-001.pdf", downloadFileName: "Response Integrity-TCF-001.pdf" },
          2: { assetFileName: "TT-EQV-002.pdf", downloadFileName: "Response Integrity-EQV-002.pdf" },
          3: { assetFileName: "TT-ICA-003.pdf", downloadFileName: "Response Integrity-ICA-003.pdf" },
          4: { assetFileName: "TT-SCP-004.pdf", downloadFileName: "Response Integrity-SCP-004.pdf" },
          5: { assetFileName: "TT-DPC-005.pdf", downloadFileName: "Response Integrity-DPC-005.pdf" },
        };

        const templateFile = templateFiles[docStep];
        if (!templateFile) {
          if (docStep === 6) {
            return res.status(400).json({ message: "Step 6 is a certified ID copy and has no downloadable template." });
          }
          return res.status(400).json({ message: "Invalid document step" });
        }

        const { assetFileName, downloadFileName } = templateFile;

        const templatePathCandidates = [
          // Source execution (tsx server/index.ts)
          fileURLToPath(new URL(`../assets/tutor-onboarding/${assetFileName}`, import.meta.url)),
          // Dist execution (node dist/index.js)
          fileURLToPath(new URL(`../../assets/tutor-onboarding/${assetFileName}`, import.meta.url)),
          // Runtime cwd fallback
          resolve(process.cwd(), "assets", "tutor-onboarding", assetFileName),
          // Runtime cwd fallback when started from server folder
          resolve(process.cwd(), "..", "assets", "tutor-onboarding", assetFileName),
        ];

        const templatePath = templatePathCandidates.find((candidate) => existsSync(candidate));

        if (!templatePath) {
          console.error("Onboarding template not found", {
            docStep,
            assetFileName,
            downloadFileName,
            triedPaths: templatePathCandidates,
          });
          return res.status(404).json({
            message: "Template file not found on API server for this step",
            assetFileName,
            downloadFileName,
          });
        }

        res.download(templatePath, downloadFileName);
      } catch (error) {
        console.error("Error downloading onboarding template:", error);
        res.status(500).json({ message: "Failed to download document template" });
      }
    }
  );

  // Tutor marks onboarding complete (after assignment) - allows leaving gateway permanently
  app.post(
    "/api/tutor/complete-onboarding",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const { applicationId } = req.body;

        if (!applicationId) {
          return res.status(400).json({ message: "Missing applicationId" });
        }

        // Verify ownership
        const applications = await storage.getTutorApplicationsByUser(userId);
        const app = applications.find(a => a.id === applicationId);
        if (!app) {
          return res.status(403).json({ message: "Application not found or access denied" });
        }

        const updated = await storage.completeTutorOnboarding(applicationId);
        if (!updated) {
          return res.status(500).json({ message: "Failed to complete onboarding" });
        }

        res.json({ success: true, application: updated });
      } catch (error) {
        console.error('Error completing onboarding:', error);
        res.status(500).json({ message: 'Failed to complete onboarding' });
      }
    }
  );

  // COO: Verify tutor onboarding document
  app.post(
    "/api/coo/tutor/:id/document/:docStep/completed-upload",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const docStep = Number(req.params.docStep);
        const reviewerId = (req.session as any).userId;
        const { fileName, fileData, fileType } = req.body;

        if (!Number.isInteger(docStep) || docStep < 1 || docStep > 5) {
          return res.status(400).json({ message: "Completed template upload is only valid for legacy steps 1 to 5." });
        }

        return res.status(410).json({ message: "Response Integrity internal copy uploads are no longer used. Agreement steps now use in-app acceptance." });
        if (!fileName || !fileData) {
          return res.status(400).json({ message: "Missing required file payload for completed template upload." });
        }

        const applications = await storage.getTutorApplications();
        const app = applications.find((a) => a.id === id);
        if (!app) {
          return res.status(404).json({ message: "Application not found" });
        }

        const buffer = Buffer.from(fileData, "base64");
        const safeFileName = `coo-completed/${id}/doc_${docStep}_completed_${Date.now()}_${String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_")}`;

        const { error: uploadError } = await supabase.storage
          .from("tutor-documents")
          .upload(safeFileName, buffer, {
            contentType: fileType || undefined,
            upsert: true,
          });

        if (uploadError) {
          console.error("Supabase storage upload error (completed template):", uploadError);
          return res.status(500).json({ message: "Storage upload failed", error: uploadError.message });
        }

        const { data: urlData } = supabase.storage.from("tutor-documents").getPublicUrl(safeFileName);
        if (!urlData?.publicUrl) {
          return res.status(500).json({ message: "Upload succeeded but completed template URL could not be generated" });
        }

        const updated = await storage.uploadCompletedTutorSequentialDocument(
          id,
          docStep,
          urlData.publicUrl,
          reviewerId
        );

        if (!updated) {
          return res.status(500).json({ message: "Failed to save completed template URL" });
        }

        res.json({
          success: true,
          application: updated,
          completedDocumentUrl: urlData.publicUrl,
        });
      } catch (error) {
        console.error("Error uploading COO completed template:", error);
        if (
          error instanceof Error &&
          /(required|pending review|blocked|already approved|step order)/i.test(error.message)
        ) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to upload completed template" });
      }
    }
  );

  app.post(
    "/api/coo/tutor/:id/document/:docStep/review",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const docStep = Number(req.params.docStep);
        const { approved, rejectionReason, completedDocumentUrl } = req.body;
        const reviewerId = (req.session as any).userId;

        if (docStep !== 2 && docStep !== 6) {
          return res.status(400).json({ message: "Only step 2 Matric certificate uploads and step 6 certified ID uploads require COO review." });
        }

        if (typeof approved !== "boolean") {
          return res.status(400).json({ message: "Missing approval decision" });
        }

        const updated = await storage.reviewTutorSequentialDocument(
          id,
          docStep,
          approved,
          reviewerId,
          completedDocumentUrl,
          rejectionReason
        );

        if (!updated) {
          return res.status(404).json({ message: "Application not found" });
        }

        await safeSendPush(
          updated.userId,
          {
            title: approved ? "Document approved" : "Document rejected",
            body: approved
              ? `Your onboarding document ${docStep} was approved.`
              : `Your onboarding document ${docStep} was rejected and needs resubmission.`,
            url: "/operational/tutor/gateway",
            tag: `tutor-document-review-${updated.id}-${docStep}-${approved ? "approved" : "rejected"}`,
          },
          "tutor document review result",
        );

        res.json({
          success: true,
          application: updated,
          message: approved
            ? docStep === 6 && Object.values(updated.documentsStatus || {}).every((status) => status === "approved")
              ? "Document approved. Tutor onboarding is complete."
              : docStep === 2
                ? "Matric certificate approved. Tutor can move to the next agreement."
                : `Document ${docStep} approved. Tutor can move to the next document.`
            : `Document ${docStep} rejected. Tutor must resubmit this step.`,
        });
      } catch (error) {
        console.error("Error reviewing sequential tutor document:", error);
        if (
          error instanceof Error &&
          /(required|pending review|blocked|already approved|step order)/i.test(error.message)
        ) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to review document" });
      }
    }
  );

  // Get tutor's own applications
  app.get(
    "/api/tutor/applications",
    isAuthenticated,
    requireRole(["tutor"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const applications = await storage.getTutorApplicationsByUser(userId);
        res.json(applications);
      } catch (error) {
        console.error("Error fetching tutor applications:", error);
        res.status(500).json({ message: "Failed to fetch applications" });
      }
    }
  );

  // Get all tutor applications (COO and HR)
  app.get(
    "/api/coo/tutor-applications",
    isAuthenticated,
    requireRole(["coo", "hr"]),
    async (req: Request, res: Response) => {
      try {
        const { status } = req.query;
        let applications;
        
        if (status && (status === "pending" || status === "approved" || status === "rejected")) {
          applications = await storage.getTutorApplicationsByStatus(status);
        } else {
          applications = await storage.getTutorApplications();
        }
        
        res.json(applications);
      } catch (error) {
        console.error("Error fetching tutor applications:", error);
        res.status(500).json({ message: "Failed to fetch applications" });
      }
    }
  );

  // Approve tutor application (COO)
  app.post(
    "/api/coo/tutor-applications/:id/approve",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const reviewerId = (req.session as any).userId;
        const application = await storage.approveTutorApplication(id, reviewerId);
        
        if (!application) {
          return res.status(404).json({ message: "Application not found" });
        }
        await safeSendPush(
          application.userId,
          {
            title: "Tutor application approved",
            body: "Your application was approved. Open Response Integrity to continue onboarding and upload your documents.",
            url: "/operational/tutor/gateway",
            tag: `tutor-application-approved-${application.id}`,
          },
          "tutor application approved",
        );
        
        res.json(application);
      } catch (error) {
        console.error("Error approving tutor application:", error);
        res.status(500).json({ message: "Failed to approve application" });
      }
    }
  );

  // Reject tutor application (COO)
  app.post(
    "/api/coo/tutor-applications/:id/reject",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { reason } = req.body;
        const reviewerId = (req.session as any).userId;
        const application = await storage.rejectTutorApplication(id, reviewerId, reason || "");
        
        if (!application) {
          return res.status(404).json({ message: "Application not found" });
        }
        const trimmedReason = typeof reason === "string" ? reason.trim() : "";
        const message = trimmedReason
          ? `Your application was not accepted. Reason: ${trimmedReason}`
          : "Your application was reviewed and was not accepted.";

        await safeSendPush(
          application.userId,
          {
            title: "Tutor application update",
            body: message,
            url: "/operational/tutor/gateway",
            tag: `tutor-application-rejected-${application.id}`,
          },
          "tutor application rejected",
        );
        
        res.json(application);
      } catch (error) {
        console.error("Error rejecting tutor application:", error);
        res.status(500).json({ message: "Failed to reject application" });
      }
    }
  );

  // ========================================
  // EGP / AFFILIATE GATEWAY ROUTES
  // ========================================

  app.post(
    "/api/td/application",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const payload = req.body ?? {};
        const requiredFields = [
          "fullName",
          "age",
          "city",
          "phone",
          "idType",
          "idNumber",
          "dateOfBirth",
          "taughtOrMentoredBefore",
          "ledOrSupervisedOthers",
          "hoursAvailablePerWeek",
          "systemUnderstandingDifference",
          "studentFreezesBreak",
          "explainingBetterNotEnough",
          "supervisingTutorAction",
          "frustrationResponse",
          "adjustSystemAnswer",
          "highToMediumCauses",
          "highScoresNoImprovement",
          "sharedTutorMistakeMeaning",
          "correctOlderTutor",
          "pushbackResponse",
          "unpopularEnforcementCase",
          "noRescueExplanation",
          "moreDangerousTutor",
          "systemDestructionFactors",
          "commitmentToStandard",
          "trustReason",
        ];

        const missingField = requiredFields.find((field) => {
          const value = (payload as any)[field];
          if (typeof value === "number") return Number.isNaN(value);
          return !String(value ?? "").trim();
        });
        if (missingField) {
          return res.status(400).json({ message: "All Territory Director application fields are required." });
        }

        const taughtOrMentoredBefore = String(payload.taughtOrMentoredBefore || "").trim().toLowerCase();
        const ledOrSupervisedOthers = String(payload.ledOrSupervisedOthers || "").trim().toLowerCase();
        const hoursAvailablePerWeek = Number(payload.hoursAvailablePerWeek);
        const commitmentToStandard = String(payload.commitmentToStandard || "").trim().toLowerCase();
        const idType = String(payload.idType || "").trim().toLowerCase();
        const idNumber = String(payload.idNumber || "").trim();
        const dateOfBirth = String(payload.dateOfBirth || "").trim();
        const accountEmail = String((req as any).dbUser?.email || "").trim().toLowerCase();

        if (taughtOrMentoredBefore !== "yes") {
          return res.status(400).json({ message: "Territory Director applicants must have taught or mentored before." });
        }
        if (ledOrSupervisedOthers !== "yes") {
          return res.status(400).json({ message: "Territory Director applicants must have led or supervised others before." });
        }
        if (!Number.isFinite(hoursAvailablePerWeek) || hoursAvailablePerWeek < 6) {
          return res.status(400).json({ message: "Territory Director applicants must have at least 6 hours available per week." });
        }
        if (commitmentToStandard !== "yes") {
          return res.status(400).json({ message: "This role requires explicit commitment to direct enforcement and standard protection." });
        }
        if (idType !== "sa_id" && idType !== "passport") {
          return res.status(400).json({ message: "TD applicants must choose South African ID or passport." });
        }
        if (idNumber.length < 6) {
          return res.status(400).json({ message: "A valid identification number is required." });
        }
        if (!dateOfBirth) {
          return res.status(400).json({ message: "Date of birth is required." });
        }
        if (Number.isNaN(new Date(dateOfBirth).getTime())) {
          return res.status(400).json({ message: "A valid date of birth is required." });
        }
        if (!accountEmail) {
          return res.status(400).json({ message: "A signed-in account email is required for TD application submission." });
        }

        const existingApplications = await getTdApplicationsByQuery({ userId });
        const reusableApplication = existingApplications.find((application: any) =>
          ["pending", "rejected"].includes(String(application.status || "").toLowerCase())
        );

        const record = {
          user_id: userId,
          full_name: String(payload.fullName).trim(),
          age: Number(payload.age),
          city: String(payload.city).trim(),
          email: accountEmail,
          phone: String(payload.phone).trim(),
          id_type: idType,
          id_number: idNumber,
          date_of_birth: dateOfBirth,
          taught_or_mentored_before: taughtOrMentoredBefore,
          led_or_supervised_others: ledOrSupervisedOthers,
          hours_available_per_week: hoursAvailablePerWeek,
          application_responses: {
            systemUnderstandingDifference: String(payload.systemUnderstandingDifference).trim(),
            studentFreezesBreak: String(payload.studentFreezesBreak).trim(),
            explainingBetterNotEnough: String(payload.explainingBetterNotEnough).trim(),
            supervisingTutorAction: String(payload.supervisingTutorAction).trim(),
            frustrationResponse: String(payload.frustrationResponse).trim(),
            adjustSystemAnswer: String(payload.adjustSystemAnswer).trim(),
            highToMediumCauses: String(payload.highToMediumCauses).trim(),
            highScoresNoImprovement: String(payload.highScoresNoImprovement).trim(),
            sharedTutorMistakeMeaning: String(payload.sharedTutorMistakeMeaning).trim(),
            correctOlderTutor: String(payload.correctOlderTutor).trim(),
            pushbackResponse: String(payload.pushbackResponse).trim(),
            unpopularEnforcementCase: String(payload.unpopularEnforcementCase).trim(),
            noRescueExplanation: String(payload.noRescueExplanation).trim(),
            moreDangerousTutor: String(payload.moreDangerousTutor).trim(),
            systemDestructionFactors: String(payload.systemDestructionFactors).trim(),
            commitmentToStandard,
            trustReason: String(payload.trustReason).trim(),
          },
        };

        let data: any = null;
        let error: any = null;

        if (reusableApplication) {
          const result = await supabase
            .from("td_applications")
            .update({
              ...record,
              status: "pending",
              reviewed_by: null,
              reviewed_at: null,
              rejection_reason: null,
              onboarding_completed_at: null,
              doc_7_submission_url: null,
              doc_7_submission_uploaded_at: null,
              doc_7_submission_reviewed_at: null,
              doc_7_submission_reviewed_by: null,
              doc_7_submission_rejection_reason: null,
              document_submission_step: 0,
              documents_status: { ...INITIAL_TD_DOCUMENT_STATUSES, "1": "not_started" },
              updated_at: new Date(),
            })
            .eq("id", reusableApplication.id)
            .select("*")
            .single();

          data = result.data;
          error = result.error;
        } else {
          const result = await supabase
            .from("td_applications")
            .insert(record)
            .select("*")
            .single();

          data = result.data;
          error = result.error;
        }

        if (error || !data) {
          throw new Error(error?.message || "Failed to submit TD application");
        }

        res.json(data);
      } catch (error) {
        console.error("Error submitting TD application:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to submit TD application" });
      }
    }
  );

  app.get(
    "/api/td/application-status",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const applications = await getTdApplicationsByQuery({ userId });
        const canonicalApplication = selectCanonicalTdApplication(applications);
        if (!canonicalApplication) {
          return res.json({ status: "not_applied" });
        }

        res.json(deriveTdGatewayApplicationStatus(canonicalApplication));
      } catch (error) {
        console.error("Error fetching TD application status:", error);
        res.status(500).json({ message: "Failed to fetch TD application status" });
      }
    }
  );

  app.get(
    "/api/td/gateway-session",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const applications = await getTdApplicationsByQuery({ userId });
        const latestApp = selectCanonicalTdApplication(applications);
        const assignedPods = await storage.getPodsByTD(userId);

        res.json({
          role: (req as any).dbUser?.role || "td",
          applicationStatus: latestApp ? deriveTdGatewayApplicationStatus(latestApp) : null,
          assignedPods,
          hasAssignedPods: assignedPods.length > 0,
        });
      } catch (error) {
        console.error("Error fetching TD gateway session:", error);
        res.status(500).json({ message: "Failed to fetch TD gateway session" });
      }
    }
  );

  app.get(
    "/api/td/onboarding-documents",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const applications = await getTdApplicationsByQuery({ userId });
        const latestApp = selectCanonicalTdApplication(applications);

        if (!latestApp) {
          return res.status(404).json({ message: "TD application not found" });
        }

        const documents = await Promise.all(
          TD_ONBOARDING_DOCUMENTS.map(async (document) => {
            const loaded = await loadTdOnboardingDocument(document.step);
            return {
              step: loaded.step,
              code: loaded.code,
              title: loaded.title,
              version: loaded.version,
              requiresAcceptance: loaded.requiresAcceptance,
              requiresUpload: loaded.requiresUpload,
              uploadTitle: loaded.uploadTitle,
              uploadDescription: loaded.uploadDescription,
              mandatoryClauses: loaded.mandatoryClauses,
              content: loaded.content,
              contentHash: loaded.contentHash,
            };
          })
        );

        res.json({
          applicationId: latestApp.id,
          documents,
        });
      } catch (error) {
        console.error("Error fetching TD onboarding documents:", error);
        res.status(500).json({ message: "Failed to fetch TD onboarding documents" });
      }
    }
  );

  app.post(
    "/api/td/onboarding-documents/:docStep/accept",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const docStep = Number(req.params.docStep);
        const {
          applicationId,
          documentVersion,
          documentHash,
          typedFullName,
          acceptedTimezone,
          locale,
          platform,
          sourceFlow,
          formData,
          acceptedClauseKeys,
          scrollCompletionPercent,
          viewStartedAt,
          viewCompletedAt,
          acceptClickedAt,
        } = req.body ?? {};

        if (!applicationId || !Number.isInteger(docStep) || docStep < 1 || docStep > 7) {
          return res.status(400).json({ message: "Invalid TD onboarding acceptance request" });
        }
        if (!String(typedFullName || "").trim()) {
          return res.status(400).json({ message: "Typed full name is required" });
        }

        const applications = await getTdApplicationsByQuery({ userId });
        const application =
          applications.find((entry: any) => entry.id === applicationId) || selectCanonicalTdApplication(applications);
        if (!application) {
          return res.status(403).json({ message: "Application not found or access denied" });
        }

        const definition = getTdOnboardingDocumentDefinition(docStep);
        if (!definition.requiresAcceptance) {
          return res.status(400).json({ message: "This TD onboarding step requires file upload, not agreement acceptance." });
        }
        const loaded = await loadTdOnboardingDocument(docStep);
        if (documentVersion && documentVersion !== loaded.version) {
          return res.status(409).json({ message: "Document version mismatch" });
        }
        if (documentHash && documentHash !== loaded.contentHash) {
          return res.status(409).json({ message: "Document content hash mismatch" });
        }

        const documentsStatus = buildTdOnboardingStatuses(application.documentsStatus || application.documents_status);
        const currentStep = getCurrentTdStepFromStatuses(documentsStatus);
        if (docStep !== currentStep) {
          return res.status(400).json({ message: `Sequential step order violation: current acceptance step is ${currentStep}.` });
        }

        const acceptedClauseKeySet = new Set(
          Array.isArray(acceptedClauseKeys) ? acceptedClauseKeys.map((value: unknown) => String(value)) : []
        );
        const missingClause = definition.mandatoryClauses.find((clause) => !acceptedClauseKeySet.has(clause.key));
        if (missingClause) {
          return res.status(400).json({ message: `Mandatory clause not acknowledged: ${missingClause.label}` });
        }

        const { data: acceptanceRow, error: acceptanceError } = await supabase
          .from("td_onboarding_acceptances")
          .insert({
            application_id: applicationId,
            user_id: userId,
            document_step: docStep,
            document_code: loaded.code,
            document_title: loaded.title,
            document_version: loaded.version,
            document_snapshot: loaded.content,
            document_checksum: loaded.contentHash,
            typed_full_name: String(typedFullName).trim(),
            account_email: application.email,
            phone_number_snapshot: application.phone || null,
            accepted_timezone: acceptedTimezone ? String(acceptedTimezone) : null,
            acceptance_method: "checkbox_typed_name",
            ip_address: extractRequestIp(req),
            user_agent: req.headers["user-agent"] || null,
            device_type: inferDeviceType(req.headers["user-agent"]),
            platform: platform ? String(platform) : "web",
            session_id: req.sessionID || null,
            locale: locale ? String(locale) : null,
            source_flow: sourceFlow ? String(sourceFlow) : `td_onboarding_step_${docStep}`,
            form_snapshot_json:
              formData && typeof formData === "object"
                ? Object.fromEntries(Object.entries(formData).map(([key, value]) => [String(key), String(value ?? "").trim()]))
                : null,
            accepted_clauses_json: definition.mandatoryClauses
              .filter((clause) => acceptedClauseKeySet.has(clause.key))
              .map((clause) => clause.key),
            scroll_completion_percent:
              typeof scrollCompletionPercent === "number"
                ? Math.max(0, Math.min(100, Math.round(scrollCompletionPercent)))
                : null,
            view_started_at: viewStartedAt ? new Date(viewStartedAt) : null,
            view_completed_at: viewCompletedAt ? new Date(viewCompletedAt) : null,
            accept_clicked_at: acceptClickedAt ? new Date(acceptClickedAt) : new Date(),
          })
          .select("*")
          .single();

        if (acceptanceError || !acceptanceRow) {
          throw new Error(acceptanceError?.message || "Failed to create TD onboarding acceptance");
        }

        if (definition.mandatoryClauses.length) {
          const { error: clauseError } = await supabase
            .from("td_onboarding_clause_acknowledgements")
            .insert(
              definition.mandatoryClauses
                .filter((clause) => acceptedClauseKeySet.has(clause.key))
                .map((clause) => ({
                  acceptance_id: acceptanceRow.id,
                  clause_key: clause.key,
                  clause_label: clause.label,
                }))
            );

          if (clauseError) {
            throw new Error(clauseError.message);
          }
        }

        const { error: eventError } = await supabase
          .from("td_onboarding_acceptance_events")
          .insert([
            {
              acceptance_id: acceptanceRow.id,
              application_id: applicationId,
              user_id: userId,
              document_step: docStep,
              event_type: "accepted",
              payload: {
                clauses: definition.mandatoryClauses.filter((clause) => acceptedClauseKeySet.has(clause.key)).map((clause) => clause.key),
                acceptedAt: new Date().toISOString(),
              },
            },
          ]);

        if (eventError) {
          throw new Error(eventError.message);
        }

        documentsStatus[String(docStep)] = "approved";
        if (docStep < 7 && documentsStatus[String(docStep + 1)] !== "approved") {
          documentsStatus[String(docStep + 1)] = "pending_upload";
        }

        const allApproved = ["1", "2", "3", "4", "5", "6", "7"].every((step) => String(documentsStatus[step] || "") === "approved");
        const { error: updateError } = await supabase
          .from("td_applications")
          .update({
            documents_status: documentsStatus,
            document_submission_step: docStep < 7 ? docStep + 1 : 7,
            onboarding_completed_at: allApproved ? new Date() : null,
            updated_at: new Date(),
          })
          .eq("id", applicationId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        const updatedApplications = await getTdApplicationsByQuery({ userId });
        const updatedApplication =
          updatedApplications.find((entry: any) => entry.id === applicationId) ||
          selectCanonicalTdApplication(updatedApplications);

        res.json({
          success: true,
          application: updatedApplication,
          acceptance: acceptanceRow,
          receipt: {
            acceptedAt: acceptanceRow.accepted_at,
            documentCode: acceptanceRow.document_code,
            documentVersion: acceptanceRow.document_version,
            documentChecksum: acceptanceRow.document_checksum,
          },
        });
      } catch (error) {
        console.error("Error accepting TD onboarding document:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to accept TD onboarding document" });
      }
    }
  );

  app.post(
    "/api/td/onboarding-documents/upload",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const { applicationId, docStep, fileName, fileData, fileType } = req.body ?? {};
        const parsedDocStep = typeof docStep === "number" ? docStep : Number(docStep);

        if (!applicationId || parsedDocStep !== 7 || !fileName || !fileData) {
          return res.status(400).json({ message: "Only TD step 7 accepts identification uploads." });
        }

        const applications = await getTdApplicationsByQuery({ userId });
        const application =
          applications.find((entry: any) => entry.id === applicationId) || selectCanonicalTdApplication(applications);

        if (!application) {
          return res.status(403).json({ message: "Application not found or access denied" });
        }

        const documentsStatus = buildTdOnboardingStatuses(application.documentsStatus || application.documents_status);
        const currentStep = getCurrentTdStepFromStatuses(documentsStatus);
        if (currentStep !== 7) {
          return res.status(400).json({ message: "Identification upload is blocked until the first six TD agreements are approved." });
        }

        const stepStatus = String(documentsStatus["7"] || "not_started");
        if (stepStatus === "pending_review") {
          return res.status(400).json({ message: "Your identification copy is already with COO for review." });
        }
        if (stepStatus === "approved") {
          return res.status(400).json({ message: "Your identification copy has already been approved." });
        }

        const buffer = Buffer.from(fileData, "base64");
        const sanitizedName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
        const safeFileName = `td-documents/${userId}/td-certified-id-${applicationId}-${Date.now()}-${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from("tutor-documents")
          .upload(safeFileName, buffer, {
            contentType: fileType || undefined,
            upsert: true,
          });

        if (uploadError) {
          return res.status(500).json({ message: uploadError.message });
        }

        const { data: urlData } = supabase.storage.from("tutor-documents").getPublicUrl(safeFileName);
        if (!urlData?.publicUrl) {
          return res.status(500).json({ message: "Upload succeeded but file URL could not be generated." });
        }

        documentsStatus["7"] = "pending_review";

        const { error: updateError } = await supabase
          .from("td_applications")
          .update({
            doc_7_submission_url: urlData.publicUrl,
            doc_7_submission_uploaded_at: new Date(),
            doc_7_submission_reviewed_at: null,
            doc_7_submission_reviewed_by: null,
            doc_7_submission_rejection_reason: null,
            document_submission_step: 7,
            documents_status: documentsStatus,
            onboarding_completed_at: null,
            updated_at: new Date(),
          })
          .eq("id", applicationId)
          .eq("user_id", userId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        const refreshedApplications = await getTdApplicationsByQuery({ userId });
        const refreshedApplication =
          refreshedApplications.find((entry: any) => entry.id === applicationId) ||
          selectCanonicalTdApplication(refreshedApplications);

        res.json({ success: true, application: refreshedApplication, publicUrl: urlData.publicUrl });
      } catch (error) {
        console.error("Error uploading TD onboarding identification:", error);
        if (
          error instanceof Error &&
          /(blocked until|already|required|pending review)/i.test(error.message)
        ) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to upload certified identification copy" });
      }
    }
  );

  app.post(
    "/api/td/complete-onboarding",
    isAuthenticated,
    requireRole(["td"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const { applicationId } = req.body ?? {};
        const applications = await getTdApplicationsByQuery({ userId });
        const application =
          applications.find((entry: any) => entry.id === applicationId) || selectCanonicalTdApplication(applications);

        if (!application) {
          return res.status(403).json({ message: "Application not found or access denied" });
        }

        const documentsStatus = buildTdOnboardingStatuses(application.documentsStatus || application.documents_status);
        const allApproved = ["1", "2", "3", "4", "5", "6", "7"].every((step) => String(documentsStatus[step] || "") === "approved");
        if (!allApproved) {
          return res.status(400).json({ message: "All TD onboarding steps must be approved before onboarding can be completed." });
        }

        const { error } = await supabase
          .from("td_applications")
          .update({ onboarding_completed_at: new Date(), updated_at: new Date() })
          .eq("id", applicationId)
          .eq("user_id", userId);

        if (error) {
          throw new Error(error.message);
        }

        const assignedPods = await storage.getPodsByTD(userId);
        res.json({ success: true, redirectTo: assignedPods.length > 0 ? "/operational/td/dashboard" : "/operational/td/no-pod" });
      } catch (error) {
        console.error("Error completing TD onboarding:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to complete TD onboarding" });
      }
    }
  );

  app.get(
    "/api/coo/td-applications",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const status = typeof req.query?.status === "string" ? req.query.status : undefined;
        const applications = await getTdApplicationsByQuery({ status });
        res.json(applications);
      } catch (error) {
        console.error("Error fetching TD applications:", error);
        res.status(500).json({ message: "Failed to fetch TD applications" });
      }
    }
  );

  app.post(
    "/api/coo/td-applications/:id/approve",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const reviewerId = (req.session as any).userId;
        const { id } = req.params;
        const { data, error } = await supabase
          .from("td_applications")
          .update({
            status: "approved",
            reviewed_by: reviewerId,
            reviewed_at: new Date(),
            document_submission_step: 1,
            documents_status: INITIAL_TD_DOCUMENT_STATUSES,
            updated_at: new Date(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error || !data) {
          return res.status(404).json({ message: "TD application not found" });
        }

        await safeSendPush(
          data.user_id,
          {
            title: "TD application approved",
            body: "Your Territory Director application was approved. Open Response Integrity to complete onboarding.",
            url: "/operational/td/gateway",
            tag: `td-application-approved-${data.id}`,
          },
          "td application approved",
        );

        res.json(data);
      } catch (error) {
        console.error("Error approving TD application:", error);
        res.status(500).json({ message: "Failed to approve TD application" });
      }
    }
  );

  app.post(
    "/api/coo/td-applications/:id/reject",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const reviewerId = (req.session as any).userId;
        const { id } = req.params;
        const reason = String(req.body?.reason || "").trim() || "Application not accepted";
        const { data, error } = await supabase
          .from("td_applications")
          .update({
            status: "rejected",
            reviewed_by: reviewerId,
            reviewed_at: new Date(),
            rejection_reason: reason,
            updated_at: new Date(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error || !data) {
          return res.status(404).json({ message: "TD application not found" });
        }

        await safeSendPush(
          data.user_id,
          {
            title: "TD application update",
            body: "Your Territory Director application was not accepted. Open Response Integrity to review the update.",
            url: "/operational/td/gateway",
            tag: `td-application-rejected-${data.id}`,
          },
          "td application rejected",
        );

        res.json(data);
      } catch (error) {
        console.error("Error rejecting TD application:", error);
        res.status(500).json({ message: "Failed to reject TD application" });
      }
    }
  );

  app.post(
    "/api/coo/td-applications/:id/document/7/review",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const reviewerId = (req.session as any).userId;
        const { id } = req.params;
        if (typeof req.body?.approved !== "boolean") {
          return res.status(400).json({ message: "Missing approval decision" });
        }
        const approved = req.body.approved as boolean;
        const rejectionReason = String(req.body?.rejectionReason || "").trim();

        const applications = await getTdApplicationsByQuery({});
        const application = applications.find((entry: any) => entry.id === id);
        if (!application) {
          return res.status(404).json({ message: "TD application not found" });
        }

        const documentsStatus = buildTdOnboardingStatuses(application.documentsStatus || application.documents_status);
        if (String(documentsStatus["7"] || "") !== "pending_review") {
          return res.status(400).json({ message: "TD identification is not awaiting COO review." });
        }

        documentsStatus["7"] = approved ? "approved" : "rejected";
        const allApproved = ["1", "2", "3", "4", "5", "6", "7"].every((step) => String(documentsStatus[step] || "") === "approved");

        const { data, error } = await supabase
          .from("td_applications")
          .update({
            documents_status: documentsStatus,
            document_submission_step: 7,
            doc_7_submission_reviewed_at: new Date(),
            doc_7_submission_reviewed_by: reviewerId,
            doc_7_submission_rejection_reason: approved ? null : (rejectionReason || "Identification copy rejected"),
            onboarding_completed_at: allApproved ? new Date() : null,
            updated_at: new Date(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error || !data) {
          throw new Error(error?.message || "Failed to review TD identification");
        }

        await safeSendPush(
          data.user_id,
          {
            title: approved ? "TD identification approved" : "TD identification rejected",
            body: approved
              ? "Your certified identification copy was approved."
              : "Your certified identification copy was rejected and needs resubmission.",
            url: "/operational/td/gateway",
            tag: `td-document-review-${data.id}-7-${approved ? "approved" : "rejected"}`,
          },
          "td document review result",
        );

        res.json({
          success: true,
          application: data,
          message: approved ? "TD identification approved." : "TD identification rejected.",
        });
      } catch (error) {
        console.error("Error reviewing TD identification document:", error);
        if (error instanceof Error && /(awaiting COO review|required)/i.test(error.message)) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to review TD identification" });
      }
    }
  );

  app.post(
    "/api/affiliate/application",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const payload = {
          user_id: userId,
          full_name: String(req.body?.fullName || "").trim(),
          id_number: String(req.body?.idNumber || "").trim(),
          phone: String(req.body?.phone || "").trim(),
          email: String(req.body?.email || "").trim(),
          reach_in_7_days: String(req.body?.reachIn7Days || "").trim(),
          first_parents: String(req.body?.firstParents || "").trim(),
          student_breakdown_case: String(req.body?.studentBreakdownCase || "").trim(),
          marks_signal: String(req.body?.marksSignal || "").trim(),
          extra_lessons_response: String(req.body?.extraLessonsResponse || "").trim(),
          not_recommend_cases: String(req.body?.notRecommendCases || "").trim(),
          unclear_problem_response: String(req.body?.unclearProblemResponse || "").trim(),
          ten_parents_filter: String(req.body?.tenParentsFilter || "").trim(),
          first_academic_question: String(req.body?.firstAcademicQuestion || "").trim(),
          no_earnings_response: String(req.body?.noEarningsResponse || "").trim(),
          next_five_days_plan: String(req.body?.nextFiveDaysPlan || "").trim(),
          proceed_reason: String(req.body?.proceedReason || "").trim(),
          trust_reason: String(req.body?.trustReason || "").trim(),
        };

        const requiredFields = [
          "full_name",
          "id_number",
          "phone",
          "email",
          "reach_in_7_days",
          "first_parents",
          "student_breakdown_case",
          "marks_signal",
          "extra_lessons_response",
          "not_recommend_cases",
          "unclear_problem_response",
          "ten_parents_filter",
          "first_academic_question",
          "no_earnings_response",
          "next_five_days_plan",
          "proceed_reason",
          "trust_reason",
        ];

        const missingField = requiredFields.find((field) => !String((payload as any)[field] || "").trim());
        if (missingField) {
          return res.status(400).json({ message: "All EGP application fields are required." });
        }

        const existingApplications = await getAffiliateApplicationsByQuery({ userId });
        const reusableApplication = existingApplications.find((application: any) =>
          ["pending", "rejected"].includes(String(application.status || "").toLowerCase())
        );

        let data: any = null;
        let error: any = null;

        if (reusableApplication) {
          const result = await supabase
            .from("affiliate_applications")
            .update({
              ...payload,
              status: "pending",
              reviewed_by: null,
              reviewed_at: null,
              rejection_reason: null,
              onboarding_completed_at: null,
              document_submission_step: 0,
              doc_5_submission_url: null,
              doc_5_submission_uploaded_at: null,
              doc_5_submission_reviewed_at: null,
              doc_5_submission_reviewed_by: null,
              doc_5_submission_rejection_reason: null,
              documents_status: { ...INITIAL_EGP_DOCUMENT_STATUSES, "1": "not_started" },
              updated_at: new Date(),
            })
            .eq("id", reusableApplication.id)
            .select("*")
            .single();

          data = result.data;
          error = result.error;
        } else {
          const result = await supabase
            .from("affiliate_applications")
            .insert(payload)
            .select("*")
            .single();

          data = result.data;
          error = result.error;
        }

        if (error || !data) {
          throw new Error(error?.message || "Failed to submit affiliate application");
        }

        res.json(data);
      } catch (error) {
        console.error("Error submitting affiliate application:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to submit affiliate application" });
      }
    }
  );

  app.get(
    "/api/affiliate/application-status",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const applications = await getAffiliateApplicationsByQuery({ userId });
        const canonicalApplication = selectCanonicalAffiliateApplication(applications);
        if (!canonicalApplication) {
          return res.json({ status: "not_applied" });
        }

        res.json(deriveEgpGatewayApplicationStatus(canonicalApplication));
      } catch (error) {
        console.error("Error fetching affiliate application status:", error);
        res.status(500).json({ message: "Failed to fetch affiliate application status" });
      }
    }
  );

  app.get(
    "/api/affiliate/gateway-session",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser.id;
        const applications = await getAffiliateApplicationsByQuery({ userId });
        const latestApp = selectCanonicalAffiliateApplication(applications);

        res.json({
          role: (req as any).dbUser?.role || "affiliate",
          applicationStatus: latestApp ? deriveEgpGatewayApplicationStatus(latestApp) : null,
        });
      } catch (error) {
        console.error("Error fetching affiliate gateway session:", error);
        res.status(500).json({ message: "Failed to fetch affiliate gateway session" });
      }
    }
  );

  app.get(
    "/api/affiliate/onboarding-documents",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const applications = await getAffiliateApplicationsByQuery({ userId });
        const latestApp = selectCanonicalAffiliateApplication(applications);

        if (!latestApp) {
          return res.status(404).json({ message: "Affiliate application not found" });
        }

        const documents = await Promise.all(
          EGP_ONBOARDING_DOCUMENTS.map(async (document) => {
            const loaded = await loadEgpOnboardingDocument(document.step);
            return {
              step: loaded.step,
              code: loaded.code,
              title: loaded.title,
              version: loaded.version,
              requiresAcceptance: loaded.requiresAcceptance,
              requiresUpload: loaded.requiresUpload,
              uploadTitle: loaded.uploadTitle,
              uploadDescription: loaded.uploadDescription,
              mandatoryClauses: loaded.mandatoryClauses,
              content: loaded.content,
              contentHash: loaded.contentHash,
            };
          })
        );

        res.json({
          applicationId: latestApp.id,
          documents,
        });
      } catch (error) {
        console.error("Error fetching affiliate onboarding documents:", error);
        res.status(500).json({ message: "Failed to fetch affiliate onboarding documents" });
      }
    }
  );

  app.post(
    "/api/affiliate/onboarding-documents/:docStep/accept",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const docStep = Number(req.params.docStep);
        const {
          applicationId,
          documentVersion,
          documentHash,
          typedFullName,
          acceptedTimezone,
          locale,
          platform,
          sourceFlow,
          formData,
          acceptedClauseKeys,
          scrollCompletionPercent,
          viewStartedAt,
          viewCompletedAt,
          acceptClickedAt,
        } = req.body ?? {};

        if (!applicationId || !Number.isInteger(docStep) || docStep < 1 || docStep > 4) {
          return res.status(400).json({ message: "Invalid EGP onboarding acceptance request" });
        }
        if (!String(typedFullName || "").trim()) {
          return res.status(400).json({ message: "Typed full name is required" });
        }

        const applications = await getAffiliateApplicationsByQuery({ userId });
        const application = applications.find((entry: any) => entry.id === applicationId) || selectCanonicalAffiliateApplication(applications);
        if (!application) {
          return res.status(403).json({ message: "Application not found or access denied" });
        }

        const definition = getEgpOnboardingDocumentDefinition(docStep);
        const loaded = await loadEgpOnboardingDocument(docStep);
        if (documentVersion && documentVersion !== loaded.version) {
          return res.status(409).json({ message: "Document version mismatch" });
        }
        if (documentHash && documentHash !== loaded.contentHash) {
          return res.status(409).json({ message: "Document content hash mismatch" });
        }

        const documentsStatus = buildEgpOnboardingStatuses(application.documentsStatus || application.documents_status);
        const currentStep = getCurrentEgpStepFromStatuses(documentsStatus);
        if (docStep !== currentStep) {
          return res.status(400).json({ message: `Sequential step order violation: current acceptance step is ${currentStep}.` });
        }

        const acceptedClauseKeySet = new Set(
          Array.isArray(acceptedClauseKeys) ? acceptedClauseKeys.map((value: unknown) => String(value)) : []
        );
        const missingClause = definition.mandatoryClauses.find((clause) => !acceptedClauseKeySet.has(clause.key));
        if (missingClause) {
          return res.status(400).json({ message: `Mandatory clause not acknowledged: ${missingClause.label}` });
        }

        const { data: acceptanceRow, error: acceptanceError } = await supabase
          .from("affiliate_onboarding_acceptances")
          .insert({
            application_id: applicationId,
            user_id: userId,
            document_step: docStep,
            document_code: loaded.code,
            document_title: loaded.title,
            document_version: loaded.version,
            document_snapshot: loaded.content,
            document_checksum: loaded.contentHash,
            typed_full_name: String(typedFullName).trim(),
            account_email: application.email,
            phone_number_snapshot: application.phone || null,
            accepted_timezone: acceptedTimezone ? String(acceptedTimezone) : null,
            acceptance_method: "checkbox_typed_name",
            ip_address: extractRequestIp(req),
            user_agent: req.headers["user-agent"] || null,
            device_type: inferDeviceType(req.headers["user-agent"]),
            platform: platform ? String(platform) : "web",
            session_id: req.sessionID || null,
            locale: locale ? String(locale) : null,
            source_flow: sourceFlow ? String(sourceFlow) : `affiliate_onboarding_step_${docStep}`,
            form_snapshot_json:
              formData && typeof formData === "object"
                ? Object.fromEntries(Object.entries(formData).map(([key, value]) => [String(key), String(value ?? "").trim()]))
                : null,
            accepted_clauses_json: definition.mandatoryClauses
              .filter((clause) => acceptedClauseKeySet.has(clause.key))
              .map((clause) => clause.key),
            scroll_completion_percent:
              typeof scrollCompletionPercent === "number"
                ? Math.max(0, Math.min(100, Math.round(scrollCompletionPercent)))
                : null,
            view_started_at: viewStartedAt ? new Date(viewStartedAt) : null,
            view_completed_at: viewCompletedAt ? new Date(viewCompletedAt) : null,
            accept_clicked_at: acceptClickedAt ? new Date(acceptClickedAt) : new Date(),
          })
          .select("*")
          .single();

        if (acceptanceError || !acceptanceRow) {
          throw new Error(acceptanceError?.message || "Failed to create affiliate onboarding acceptance");
        }

        if (definition.mandatoryClauses.length) {
          const { error: clauseError } = await supabase
            .from("affiliate_onboarding_clause_acknowledgements")
            .insert(
              definition.mandatoryClauses
                .filter((clause) => acceptedClauseKeySet.has(clause.key))
                .map((clause) => ({
                  acceptance_id: acceptanceRow.id,
                  clause_key: clause.key,
                  clause_label: clause.label,
                }))
            );

          if (clauseError) {
            throw new Error(clauseError.message);
          }
        }

        const { error: eventError } = await supabase
          .from("affiliate_onboarding_acceptance_events")
          .insert([
            {
              acceptance_id: acceptanceRow.id,
              application_id: applicationId,
              user_id: userId,
              document_step: docStep,
              event_type: "accepted",
              payload: {
                clauses: definition.mandatoryClauses.filter((clause) => acceptedClauseKeySet.has(clause.key)).map((clause) => clause.key),
                acceptedAt: new Date().toISOString(),
              },
            },
          ]);

        if (eventError) {
          throw new Error(eventError.message);
        }

        documentsStatus[String(docStep)] = "approved";
        if (docStep < 5 && documentsStatus[String(docStep + 1)] !== "approved") {
          documentsStatus[String(docStep + 1)] = "pending_upload";
        }

        const allApproved = ["1", "2", "3", "4", "5"].every((step) => String(documentsStatus[step] || "") === "approved");
        const { error: updateError } = await supabase
          .from("affiliate_applications")
          .update({
            documents_status: documentsStatus,
            document_submission_step: docStep < 5 ? docStep + 1 : 5,
            onboarding_completed_at: allApproved ? new Date() : null,
            updated_at: new Date(),
          })
          .eq("id", applicationId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        const updatedApplications = await getAffiliateApplicationsByQuery({ userId });
        const updatedApplication =
          updatedApplications.find((entry: any) => entry.id === applicationId) ||
          selectCanonicalAffiliateApplication(updatedApplications);

        res.json({
          success: true,
          application: updatedApplication,
          acceptance: acceptanceRow,
          receipt: {
            acceptedAt: acceptanceRow.accepted_at,
            documentCode: acceptanceRow.document_code,
            documentVersion: acceptanceRow.document_version,
            documentChecksum: acceptanceRow.document_checksum,
          },
        });
      } catch (error) {
        console.error("Error accepting affiliate onboarding document:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to accept onboarding document" });
      }
    }
  );

  app.post(
    "/api/affiliate/onboarding-documents/upload",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const { applicationId, docStep, fileName, fileData, fileType } = req.body ?? {};
        const parsedDocStep = typeof docStep === "number" ? docStep : Number(docStep);

        if (!applicationId || parsedDocStep !== 5 || !fileName || !fileData) {
          return res.status(400).json({ message: "Only Response Integrity-EGP-005 accepts a certified ID upload." });
        }

        const applications = await getAffiliateApplicationsByQuery({ userId });
        const application =
          applications.find((entry: any) => entry.id === applicationId) || selectCanonicalAffiliateApplication(applications);

        if (!application) {
          return res.status(403).json({ message: "Application not found or access denied" });
        }

        const documentsStatus = buildEgpOnboardingStatuses(application.documentsStatus || application.documents_status);
        const currentStep = getCurrentEgpStepFromStatuses(documentsStatus);
        if (currentStep !== 5) {
          return res.status(400).json({ message: "Certified ID upload is blocked until the first four EGP agreements are approved." });
        }

        const stepStatus = String(documentsStatus["5"] || "not_started");
        if (stepStatus === "pending_review") {
          return res.status(400).json({ message: "Your certified ID copy is already with COO for review." });
        }
        if (stepStatus === "approved") {
          return res.status(400).json({ message: "Your certified ID copy has already been approved." });
        }

        const buffer = Buffer.from(fileData, "base64");
        const sanitizedName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
        const safeFileName = `affiliate-documents/${userId}/egp-certified-id-${applicationId}-${Date.now()}-${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from("tutor-documents")
          .upload(safeFileName, buffer, {
            contentType: fileType || undefined,
            upsert: true,
          });

        if (uploadError) {
          return res.status(500).json({ message: uploadError.message });
        }

        const { data: urlData } = supabase.storage.from("tutor-documents").getPublicUrl(safeFileName);
        if (!urlData?.publicUrl) {
          return res.status(500).json({ message: "Upload succeeded but file URL could not be generated." });
        }

        documentsStatus["5"] = "pending_review";

        const { error: updateError } = await supabase
          .from("affiliate_applications")
          .update({
            doc_5_submission_url: urlData.publicUrl,
            doc_5_submission_uploaded_at: new Date(),
            doc_5_submission_reviewed_at: null,
            doc_5_submission_reviewed_by: null,
            doc_5_submission_rejection_reason: null,
            document_submission_step: 5,
            documents_status: documentsStatus,
            onboarding_completed_at: null,
            updated_at: new Date(),
          })
          .eq("id", applicationId)
          .eq("user_id", userId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        const refreshedApplications = await getAffiliateApplicationsByQuery({ userId });
        const refreshedApplication =
          refreshedApplications.find((entry: any) => entry.id === applicationId) ||
          selectCanonicalAffiliateApplication(refreshedApplications);

        res.json({ success: true, application: refreshedApplication, publicUrl: urlData.publicUrl });
      } catch (error) {
        console.error("Error uploading affiliate onboarding document:", error);
        if (
          error instanceof Error &&
          /(blocked until|already|required|pending review)/i.test(error.message)
        ) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to upload certified ID copy" });
      }
    }
  );

  app.post(
    "/api/affiliate/complete-onboarding",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const { applicationId } = req.body ?? {};
        const applications = await getAffiliateApplicationsByQuery({ userId });
        const application = applications.find((entry: any) => entry.id === applicationId) || selectCanonicalAffiliateApplication(applications);

        if (!application) {
          return res.status(403).json({ message: "Application not found or access denied" });
        }

        const documentsStatus = buildEgpOnboardingStatuses(application.documentsStatus || application.documents_status);
        const allApproved = ["1", "2", "3", "4", "5"].every((step) => String(documentsStatus[step] || "") === "approved");
        if (!allApproved) {
          return res.status(400).json({ message: "All EGP onboarding steps must be approved before onboarding can be completed." });
        }

        const { error } = await supabase
          .from("affiliate_applications")
          .update({ onboarding_completed_at: new Date(), updated_at: new Date() })
          .eq("id", applicationId)
          .eq("user_id", userId);

        if (error) {
          throw new Error(error.message);
        }

        res.json({ success: true });
      } catch (error) {
        console.error("Error completing affiliate onboarding:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to complete onboarding" });
      }
    }
  );

  app.get(
    "/api/coo/affiliate-applications",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const status = typeof req.query?.status === "string" ? req.query.status : undefined;
        const applications = await getAffiliateApplicationsByQuery({ status });
        res.json(applications);
      } catch (error) {
        console.error("Error fetching affiliate applications:", error);
        res.status(500).json({ message: "Failed to fetch affiliate applications" });
      }
    }
  );

  app.post(
    "/api/coo/affiliate-applications/:id/approve",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const reviewerId = (req.session as any).userId;
        const { id } = req.params;
        const { data, error } = await supabase
          .from("affiliate_applications")
          .update({
            status: "approved",
            reviewed_by: reviewerId,
            reviewed_at: new Date(),
            document_submission_step: 1,
            doc_5_submission_reviewed_at: null,
            doc_5_submission_reviewed_by: null,
            doc_5_submission_rejection_reason: null,
            documents_status: INITIAL_EGP_DOCUMENT_STATUSES,
            updated_at: new Date(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error || !data) {
          return res.status(404).json({ message: "Affiliate application not found" });
        }

        await safeSendPush(
          data.user_id,
          {
            title: "EGP application approved",
            body: "Your application was approved. Open Response Integrity to complete the EGP agreements.",
            url: "/affiliate/gateway",
            tag: `affiliate-application-approved-${data.id}`,
          },
          "affiliate application approved",
        );

        res.json(data);
      } catch (error) {
        console.error("Error approving affiliate application:", error);
        res.status(500).json({ message: "Failed to approve affiliate application" });
      }
    }
  );

  app.post(
    "/api/coo/affiliate-applications/:id/reject",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const reviewerId = (req.session as any).userId;
        const { id } = req.params;
        const reason = String(req.body?.reason || "").trim();

        const { data, error } = await supabase
          .from("affiliate_applications")
          .update({
            status: "rejected",
            reviewed_by: reviewerId,
            reviewed_at: new Date(),
            rejection_reason: reason,
            updated_at: new Date(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error || !data) {
          return res.status(404).json({ message: "Affiliate application not found" });
        }

        await safeSendPush(
          data.user_id,
          {
            title: "EGP application update",
            body: reason || "Your EGP application was reviewed and was not accepted.",
            url: "/affiliate/gateway",
            tag: `affiliate-application-rejected-${data.id}`,
          },
          "affiliate application rejected",
        );

        res.json(data);
      } catch (error) {
        console.error("Error rejecting affiliate application:", error);
        res.status(500).json({ message: "Failed to reject affiliate application" });
      }
    }
  );

  app.post(
    "/api/coo/affiliate-applications/:id/document/:docStep/review",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const docStep = Number(req.params.docStep);
        const reviewerId = (req.session as any).userId;
        const approved = Boolean(req.body?.approved);
        const rejectionReason = String(req.body?.rejectionReason || "").trim();

        if (docStep !== 5) {
          return res.status(400).json({ message: "Only Response Integrity-EGP-005 requires COO upload review." });
        }
        if (typeof req.body?.approved !== "boolean") {
          return res.status(400).json({ message: "Missing approval decision" });
        }

        const applications = await getAffiliateApplicationsByQuery();
        const application = applications.find((entry: any) => entry.id === id);
        if (!application) {
          return res.status(404).json({ message: "Affiliate application not found" });
        }

        const documentsStatus = buildEgpOnboardingStatuses(application.documentsStatus || application.documents_status);
        if (String(documentsStatus["5"] || "not_started") !== "pending_review") {
          return res.status(400).json({ message: "Response Integrity-EGP-005 is not currently pending COO review." });
        }

        documentsStatus["5"] = approved ? "approved" : "rejected";
        const allApproved = ["1", "2", "3", "4", "5"].every((step) => String(documentsStatus[step] || "") === "approved");

        const { data, error } = await supabase
          .from("affiliate_applications")
          .update({
            documents_status: documentsStatus,
            document_submission_step: approved ? 5 : 5,
            doc_5_submission_reviewed_at: new Date(),
            doc_5_submission_reviewed_by: reviewerId,
            doc_5_submission_rejection_reason: approved ? null : rejectionReason || "Certified ID copy rejected. Please upload a corrected certified copy.",
            onboarding_completed_at: approved && allApproved ? new Date() : null,
            updated_at: new Date(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error || !data) {
          throw new Error(error?.message || "Failed to review EGP certified ID copy");
        }

        await safeSendPush(
          data.user_id,
          {
            title: approved ? "Certified ID copy approved" : "Certified ID copy rejected",
            body: approved
              ? "Your certified ID copy was approved. Your EGP onboarding is now complete."
              : "Your certified ID copy was rejected. Open the gateway to review the reason and upload again.",
            url: "/affiliate/gateway",
            tag: `affiliate-document-review-${id}-5-${approved ? "approved" : "rejected"}`,
          },
          "affiliate document review result",
        );

        const refreshedApplications = await getAffiliateApplicationsByQuery();
        const refreshedApplication = refreshedApplications.find((entry: any) => entry.id === id) || data;

        res.json({
          success: true,
          application: refreshedApplication,
          message: approved
            ? "Certified ID copy approved. The EGP onboarding flow is complete."
            : "Certified ID copy rejected. The EGP must upload a corrected certified copy.",
        });
      } catch (error) {
        console.error("Error reviewing affiliate onboarding document:", error);
        if (
          error instanceof Error &&
          /(pending review|required|approval decision)/i.test(error.message)
        ) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to review certified ID copy" });
      }
    }
  );

  // ========================================
  // HR ROUTES
  // ========================================

  // Get HR dashboard stats
  app.get(
    "/api/hr/stats",
    isAuthenticated,
    requireRole(["hr", "coo"]),
    async (req: Request, res: Response) => {
      try {
        // Get all tutor applications
        const allApplications = await storage.getTutorApplications();
        
        // Get pending tutor applications from tutor_applications table
        const pendingApplications = await storage.getTutorApplicationsByStatus("pending");
        
        // Get approved tutors (from tutor_applications table)
        const approvedApplications = await storage.getTutorApplicationsByStatus("approved");

        // Get tutors who are approved but not yet assigned to a pod
        let availableForPods = 0;
        try {
          // Get all tutor assignments
          const { data: assignments } = await supabase
            .from("tutor_assignments")
            .select("tutor_id");
          
          const assignedTutorIds = new Set(assignments?.map(a => a.tutor_id) || []);
          
          // Count approved tutors who are not in the assignments list
          availableForPods = approvedApplications.filter(
            app => !assignedTutorIds.has(app.userId)
          ).length;
        } catch (e) {
          console.warn("Could not fetch tutor assignments:", e);
          availableForPods = approvedApplications.length; // Fallback to all approved
        }

        // Get student enrollments - total and this month
        let totalEnrollments = 0;
        let studentEnrollments = 0;
        try {
          const currentMonth = new Date();
          const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

          let { data: trafficEnrollments, error: enrollError } = await supabase
            .from("parent_enrollments")
            .select("id, created_at, assigned_tutor_id, parent_email, parent_full_name, student_full_name, is_sandbox_account, current_step")
            .order("created_at", { ascending: false });

          if (enrollError) {
            const message = String((enrollError as any)?.message || "").toLowerCase();
            const missingOptionalColumn =
              message.includes("is_sandbox_account") || message.includes("current_step");

            if (missingOptionalColumn) {
              const fallback = await supabase
                .from("parent_enrollments")
                .select("id, created_at, assigned_tutor_id, parent_email, parent_full_name, student_full_name")
                .order("created_at", { ascending: false });

              trafficEnrollments = fallback.data as any;
              enrollError = fallback.error as any;
            }
          }

          if (enrollError) {
            console.warn("Error fetching traffic enrollments:", enrollError);
          } else {
            const liveTrafficEnrollments = (trafficEnrollments || []).filter((enrollment: any) =>
              isTrafficVisibleEnrollment(enrollment)
            );

            totalEnrollments = liveTrafficEnrollments.length;
            studentEnrollments = liveTrafficEnrollments.filter((enrollment: any) => {
              const createdAt = enrollment?.created_at ? new Date(enrollment.created_at) : null;
              return createdAt instanceof Date && !Number.isNaN(createdAt.getTime()) && createdAt >= firstDay;
            }).length;
          }
        } catch (e) {
          console.warn("Could not fetch parent enrollments:", e);
          // Continue with 0 enrollments if table doesn't exist
        }

        // Get people count from registry
        let peopleCount = 0;
        try {
          const { count: pCount } = await supabase
            .from("people_registry")
            .select("*", { count: "exact", head: true })
            .eq("status", "active");
          peopleCount = pCount || 0;
        } catch (e) {
          console.warn("Could not fetch people count:", e);
        }

        // Get open disputes count
        let openDisputes = 0;
        try {
          const { count: dCount } = await supabase
            .from("disputes")
            .select("*", { count: "exact", head: true })
            .in("status", ["open", "under_review", "escalated"]);
          openDisputes = dCount || 0;
        } catch (e) {
          console.warn("Could not fetch disputes count:", e);
        }

        res.json({
          totalApplications: allApplications.length,
          pendingApplications: pendingApplications.length,
          approvedTutors: approvedApplications.length,
          availableForPods,
          totalEnrollments,
          studentEnrollments,
          peopleCount,
          openDisputes,
        });
      } catch (error) {
        console.error("Error fetching HR stats:", error);
        res.status(500).json({ 
          totalApplications: 0,
          pendingApplications: 0,
          approvedTutors: 0,
          availableForPods: 0,
          totalEnrollments: 0,
          studentEnrollments: 0,
          peopleCount: 0,
          openDisputes: 0,
          error: "Failed to fetch stats" 
        });
      }
    }
  );

  // Get all parent enrollments for COO traffic page
  app.get(
    "/api/hr/enrollments",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        // Try full projection first; fall back if some optional columns are not present in older DBs.
        let { data, error } = await supabase
          .from("parent_enrollments")
          .select("id, user_id, parent_full_name, parent_phone, parent_email, parent_city, student_full_name, student_grade, school_name, response_symptoms, topic_response_symptoms, response_signal_scores, topic_response_signal_scores, recommended_starting_phase, topic_recommended_starting_phases, previous_tutoring, internet_access, parent_motivation, status, current_step, assigned_tutor_id, assigned_student_id, created_at, updated_at")
          .order("created_at", { ascending: false });

        if (error) {
          const message = String((error as any)?.message || "").toLowerCase();
          const missingOptionalColumn =
            message.includes("assigned_student_id") ||
            message.includes("current_step") ||
            message.includes("response_symptoms") ||
            message.includes("topic_response_symptoms") ||
            message.includes("response_signal_scores") ||
            message.includes("topic_response_signal_scores") ||
            message.includes("recommended_starting_phase") ||
            message.includes("topic_recommended_starting_phases");

          if (missingOptionalColumn) {
            const fallback = await supabase
              .from("parent_enrollments")
              .select("id, user_id, parent_full_name, parent_phone, parent_email, parent_city, student_full_name, student_grade, school_name, previous_tutoring, internet_access, parent_motivation, status, assigned_tutor_id, created_at, updated_at")
              .order("created_at", { ascending: false });

            data = fallback.data as any;
            error = fallback.error as any;
          }
        }

        if (error) {
          console.error("Error selecting parent_enrollments:", error.message);
          return res.status(500).json([]);
        }

        data = (data || []).filter((enrollment: any) => isTrafficVisibleEnrollment(enrollment));

        const tutorIds = Array.from(
          new Set(
            (data || [])
              .map((e: any) => e.assigned_tutor_id)
              .filter((id: any) => !!id)
          )
        );

        let tutorMap = new Map<string, { name: string | null; email: string | null }>();
        let assignmentMap = new Map<string, { podId: string | null }>();
        let podMap = new Map<string, { podName: string | null; status: string | null }>();

        if (tutorIds.length > 0) {
          const { data: tutorsData } = await supabase
            .from("users")
            .select("id, name, email")
            .in("id", tutorIds);

          tutorMap = new Map(
            (tutorsData || []).map((t: any) => [
              t.id,
              {
                name: t.name || null,
                email: t.email || null,
              },
            ])
          );

          const { data: tutorAssignmentsData } = await supabase
            .from("tutor_assignments")
            .select("tutor_id, pod_id")
            .in("tutor_id", tutorIds);

          assignmentMap = new Map(
            (tutorAssignmentsData || []).map((a: any) => [
              a.tutor_id,
              {
                podId: a.pod_id || null,
              },
            ])
          );

          const podIds = Array.from(
            new Set(
              (tutorAssignmentsData || [])
                .map((a: any) => a.pod_id)
                .filter((id: any) => !!id)
            )
          );

          if (podIds.length > 0) {
            const { data: podsData } = await supabase
              .from("pods")
              .select("id, pod_name, status")
              .in("id", podIds);

            podMap = new Map(
              (podsData || []).map((p: any) => [
                p.id,
                {
                  podName: p.pod_name || null,
                  status: p.status || null,
                },
              ])
            );
          }
        }

        // Normalize and return
        const transformed = (data || []).map((e: any) => {
          const tutor = e.assigned_tutor_id ? tutorMap.get(e.assigned_tutor_id) : null;
          const assignment = e.assigned_tutor_id ? assignmentMap.get(e.assigned_tutor_id) : null;
          const pod = assignment?.podId ? podMap.get(assignment.podId) : null;

          return {
          ...e,
          parentInfo: buildIntakeSignals(e),
          assigned_tutor_name: tutor?.name || null,
          assigned_tutor_email: tutor?.email || null,
          assigned_pod_id: assignment?.podId || null,
          assigned_pod_name: pod?.podName || null,
          active_in_pod: !!(e.assigned_tutor_id && assignment?.podId && pod?.status === "active"),
          statusLabel: e.status === "awaiting_assignment" ? "Awaiting Assignment" : 
                      e.status === "assigned" ? "Assigned" :
                      e.status === "awaiting_tutor_acceptance" ? "Awaiting Tutor Acceptance" :
                      e.status === "confirmed" ? "Confirmed" :
                      e.status
          };
        });

        console.log(`/api/hr/enrollments returned ${transformed.length} live rows`);
        res.json(transformed);
      } catch (error) {
        console.error("Error in /api/hr/enrollments:", error);
        res.status(500).json([]);
      }
    }
  );

  // Assign tutor to parent enrollment (COO-controlled)
  app.post(
    "/api/hr/enrollments/:enrollmentId/assign-tutor",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { enrollmentId } = req.params;
        const { tutorId, podId } = req.body;

        if (!tutorId) {
          return res.status(400).json({ message: "Tutor ID is required" });
        }

        const tutorAssignment = await storage.getTutorAssignment(tutorId);
        if (!tutorAssignment) {
          return res.status(400).json({ message: "Tutor must be assigned to a pod before receiving students" });
        }

        if (podId && tutorAssignment.podId !== podId) {
          return res.status(400).json({ message: "Tutor is not assigned to the selected pod" });
        }

        // Check tutor certification status - only certified_live tutors can receive real assignments
        const { data: tutorStatus, error: statusError } = await supabase
          .from("tutor_battle_test_statuses")
          .select("mode")
          .eq("tutor_id", tutorId)
          .single();

        if (statusError || !tutorStatus) {
          return res.status(400).json({ message: "Tutor certification status not found. Complete battle testing first." });
        }

        if (tutorStatus.mode !== "certified_live") {
          return res.status(400).json({
            message: `Tutor is not certified for live assignments. Current status: ${tutorStatus.mode}. Must complete all modules and pass battle tests.`
          });
        }

        const maxStudentsPerTutor = getMaxStudentsPerTutorForVehicle(tutorAssignment.pod.vehicle);
        const activeEnrollmentStatuses = [
          "awaiting_tutor_acceptance",
          "assigned",
          "proposal_sent",
          "session_booked",
          "report_received",
          "confirmed",
        ];

        const { count: currentAssignedStudentCount, error: assignmentCountError } = await supabase
          .from("parent_enrollments")
          .select("id", { count: "exact", head: true })
          .eq("assigned_tutor_id", tutorId)
          .in("status", activeEnrollmentStatuses);

        if (assignmentCountError) {
          console.error("Error checking tutor student capacity:", assignmentCountError);
          return res.status(500).json({ message: "Failed to validate tutor capacity" });
        }

        if ((currentAssignedStudentCount || 0) >= maxStudentsPerTutor) {
          return res.status(400).json({
            message: `Tutor is already at capacity for this pod vehicle (${maxStudentsPerTutor} students max)`,
          });
        }

        // Update the parent enrollment with the assigned tutor, but do not set to 'assigned' until tutor accepts
        const { data, error } = await supabase
          .from("parent_enrollments")
          .update({
            assigned_tutor_id: tutorId,
            status: "awaiting_tutor_acceptance",
            updated_at: new Date().toISOString(),
          })
          .eq("id", enrollmentId)
          .select();

        if (error) {
          console.error("Error updating enrollment:", error);
          return res.status(500).json({ message: "Failed to assign tutor" });
        }

        if (!data || data.length === 0) {
          return res.status(404).json({ message: "Enrollment not found" });
        }

        const enrollment = data[0];

        await safeSendPush(
          enrollment.user_id,
          {
            title: "Tutor assigned",
            body: "A tutor has been assigned to your child. Response Integrity will notify you when they accept and onboarding moves forward.",
            url: "/client/parent/gateway",
            tag: `parent-tutor-assigned-${enrollment.id}`,
          },
          "parent tutor assigned",
        );

        await safeSendPush(
          tutorId,
          {
            title: "New parent assignment",
            body: `You have a new parent assignment waiting for your acceptance.`,
            url: "/operational/tutor/pod",
            tag: `tutor-new-assignment-${enrollment.id}`,
          },
          "tutor new assignment",
        );

        // Create or repair a student record for the assigned tutor
        try {
          const student = await ensureStudentForEnrollment(enrollment, tutorId);

          if (student) {
            console.log("Student ensured successfully for:", enrollment.student_full_name);
          }
        } catch (studentErr) {
          console.error("Error in student creation flow:", studentErr);
          // Don't fail the tutor assignment
        }

        res.json({
          message: "Tutor assigned successfully",
          enrollment: data[0],
        });
      } catch (error) {
        console.error("Error assigning tutor:", error);
        res.status(500).json({ message: "Failed to assign tutor" });
      }
    }
  );

  // Safely unassign tutor from parent enrollment while preserving student data for reassignment
  app.post(
    "/api/hr/enrollments/:enrollmentId/unassign-tutor",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { enrollmentId } = req.params;

        let { data: enrollment, error: enrollmentError } = await supabase
          .from("parent_enrollments")
          .select("id, user_id, student_full_name, assigned_tutor_id, assigned_student_id, status, proposal_id, current_step")
          .eq("id", enrollmentId)
          .maybeSingle();

        if (enrollmentError) {
          const message = String((enrollmentError as any)?.message || "").toLowerCase();
          if (message.includes("assigned_student_id")) {
            const fallback = await supabase
              .from("parent_enrollments")
              .select("id, user_id, student_full_name, assigned_tutor_id, status, proposal_id, current_step")
              .eq("id", enrollmentId)
              .maybeSingle();
            enrollment = fallback.data as any;
            enrollmentError = fallback.error as any;
          }
        }

        if (enrollmentError) {
          return res.status(500).json({ message: "Failed to fetch enrollment" });
        }

        if (!enrollment) {
          return res.status(404).json({ message: "Enrollment not found" });
        }

        if (!enrollment.assigned_tutor_id) {
          return res.status(400).json({ message: "Enrollment is not currently assigned to a tutor" });
        }

        const previousTutorId = enrollment.assigned_tutor_id;
        await safelyUnassignEnrollmentFromTutor(enrollment, previousTutorId);

        res.json({
          message: "Tutor unassigned safely. Student data has been preserved for reassignment.",
          enrollmentId: enrollment.id,
        });
      } catch (error) {
        console.error("Error unassigning tutor:", error);
        res.status(500).json({ message: "Failed to unassign tutor" });
      }
    }
  );

  // Get active pods for COO to assign tutors
  app.get(
    "/api/hr/active-pods",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const pods = await storage.getPods();
        const activePods = pods.filter((p) => p.status === "active");
        res.json(activePods);
      } catch (error) {
        console.error("Error fetching active pods:", error);
        res.status(500).json({ message: "Failed to fetch active pods" });
      }
    }
  );

  // Get tutors in a pod for COO assignment flow
  app.get(
    "/api/hr/pods/:podId/tutors",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { podId } = req.params;
        const assignments = await storage.getTutorAssignmentsByPod(podId);
        
        // Fetch tutor details for each assignment
        const tutorsData = await Promise.all(
          assignments.map(async (assignment: any) => {
            const tutor = await storage.getUser(assignment.tutorId);
            return {
              ...assignment,
              tutorName: tutor?.name || "Unknown",
              tutorEmail: tutor?.email || "",
            };
          })
        );
        
        res.json(tutorsData);
      } catch (error) {
        console.error("Error fetching pod tutors:", error);
        res.status(500).json({ message: "Failed to fetch pod tutors" });
      }
    }
  );

  // Get tutor profile by ID (public endpoint for HR)
  app.get(
    "/api/tutors/:tutorId",
    isAuthenticated,
    requireRole(["hr"]),
    async (req: Request, res: Response) => {
      try {
        const { tutorId } = req.params;

        const tutor = await storage.getUser(tutorId);
        if (!tutor) {
          return res.status(404).json({ message: "Tutor not found" });
        }

        res.json(tutor);
      } catch (error) {
        console.error("Error fetching tutor profile:", error);
        res.status(500).json({ message: "Failed to fetch tutor profile" });
      }
    }
  );

  // ========================================
  // BRAIN MODULE ROUTES (HR)
  // ========================================

  // Get all people in registry
  app.get(
    "/api/hr/brain/people",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("people_registry")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching people registry:", error);
          return res.json([]);
        }

        res.json(data || []);
      } catch (error) {
        console.error("Error in people registry:", error);
        res.json([]);
      }
    }
  );

  // Add person to registry
  app.post(
    "/api/hr/brain/people",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("people_registry")
          .insert({
            full_name: req.body.fullName,
            role_title: req.body.roleTitle,
            role_description: req.body.roleDescription,
            short_bio: req.body.shortBio,
            team_name: req.body.teamName,
            email: req.body.email,
            phone: req.body.phone,
            status: req.body.status || "active",
            start_date: req.body.startDate ? new Date(req.body.startDate) : new Date(),
          })
          .select()
          .single();

        if (error) {
          console.error("Error adding person:", error);
          return res.status(500).json({ message: "Failed to add person" });
        }

        res.json(data);
      } catch (error) {
        console.error("Error in add person:", error);
        res.status(500).json({ message: "Failed to add person" });
      }
    }
  );

  // Get all details (weekly deliverables)
  app.get(
    "/api/hr/brain/details",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("details")
          .select(`
            *,
            person:people_registry(*)
          `)
          .order("due_date", { ascending: true });

        if (error) {
          console.error("Error fetching details:", error);
          return res.json([]);
        }

        res.json(data || []);
      } catch (error) {
        console.error("Error in details:", error);
        res.json([]);
      }
    }
  );

  // Create detail
  app.post(
    "/api/hr/brain/details",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const { data, error } = await supabase
          .from("details")
          .insert({
            person_id: req.body.personId,
            description: req.body.description,
            due_date: new Date(req.body.dueDate),
            status: "pending",
            created_by: userId,
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating detail:", error);
          return res.status(500).json({ message: "Failed to create detail" });
        }

        res.json(data);
      } catch (error) {
        console.error("Error in create detail:", error);
        res.status(500).json({ message: "Failed to create detail" });
      }
    }
  );

  // Mark detail as done
  app.patch(
    "/api/hr/brain/details/:id/done",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { data, error } = await supabase
          .from("details")
          .update({
            status: "done",
            fulfilled_at: new Date(),
          })
          .eq("id", id)
          .select()
          .single();

        if (error) {
          console.error("Error marking detail done:", error);
          return res.status(500).json({ message: "Failed to mark detail done" });
        }

        res.json(data);
      } catch (error) {
        console.error("Error in mark detail done:", error);
        res.status(500).json({ message: "Failed to mark detail done" });
      }
    }
  );

  // Get all projects
  app.get(
    "/api/hr/brain/projects",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select(`
            *,
            owner:people_registry(*)
          `)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching projects:", error);
          return res.json([]);
        }

        res.json(data || []);
      } catch (error) {
        console.error("Error in projects:", error);
        res.json([]);
      }
    }
  );

  // Create project
  app.post(
    "/api/hr/brain/projects",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
        const { data, error } = await supabase
          .from("projects")
          .insert({
            name: req.body.name,
            owner_id: req.body.ownerId,
            horizon: req.body.horizon,
            objective: req.body.objective,
            status: "active",
            start_date: new Date(),
            created_by: userId,
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating project:", error);
          return res.status(500).json({ message: "Failed to create project" });
        }

        res.json(data);
      } catch (error) {
        console.error("Error in create project:", error);
        res.status(500).json({ message: "Failed to create project" });
      }
    }
  );

  // Get all ideas
  app.get(
    "/api/hr/brain/ideas",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("ideas")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching ideas:", error);
          return res.json([]);
        }

        res.json(data || []);
      } catch (error) {
        console.error("Error in ideas:", error);
        res.json([]);
      }
    }
  );

  // Update idea status
  app.patch(
    "/api/hr/brain/ideas/:id/status",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const userId = (req.session as any).userId;
        const { data, error } = await supabase
          .from("ideas")
          .update({
            status: req.body.status,
            review_notes: req.body.notes,
            reviewed_by: userId,
            reviewed_at: new Date(),
          })
          .eq("id", id)
          .select()
          .single();

        if (error) {
          console.error("Error updating idea status:", error);
          return res.status(500).json({ message: "Failed to update idea status" });
        }

        res.json(data);
      } catch (error) {
        console.error("Error in update idea status:", error);
        res.status(500).json({ message: "Failed to update idea status" });
      }
    }
  );

  // Convert idea to project
  app.post(
    "/api/hr/brain/ideas/:id/convert",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const userId = (req.session as any).userId;

        // Get the idea
        const { data: idea, error: ideaError } = await supabase
          .from("ideas")
          .select("*")
          .eq("id", id)
          .single();

        if (ideaError || !idea) {
          return res.status(404).json({ message: "Idea not found" });
        }

        // Create project from idea (owner needs to be set manually after)
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .insert({
            name: idea.title,
            objective: idea.description,
            horizon: "30",
            status: "active",
            start_date: new Date(),
            created_by: userId,
          })
          .select()
          .single();

        if (projectError) {
          console.error("Error creating project from idea:", projectError);
          return res.status(500).json({ message: "Failed to create project" });
        }

        // Update idea with project reference
        await supabase
          .from("ideas")
          .update({
            status: "approved",
            converted_to_project_id: project.id,
          })
          .eq("id", id);

        res.json({ project, idea });
      } catch (error) {
        console.error("Error converting idea to project:", error);
        res.status(500).json({ message: "Failed to convert idea" });
      }
    }
  );

  // Submit High School Leadership Pilot request (allow public submissions)
  app.post(
    "/api/pilots/highschool/submit",
    async (req: Request, res: Response) => {
      try {
        const userId = (req.session as any)?.userId || null;
        const insertObj: any = {
          school_name: req.body.schoolName,
          contact_person_name: req.body.contactPersonName || null,
          contact_person_phone: req.body.phone || null,
          contact_person_role: req.body.contactPersonRole,
          email: req.body.email,
          submitter_name: req.body.submitterName || null,
          submitter_role: req.body.submitterRole || null,
        };
        if (userId) insertObj.submitted_by = userId;

        const { data, error } = await supabase
          .from("leadership_pilot_requests")
          .insert(insertObj)
          .select()
          .single();

        if (error) {
          console.error("Error submitting leadership pilot request:", error);
          return res.status(500).json({ message: "Failed to submit request" });
        }

        res.json(data);
      } catch (error) {
        console.error("Error in submit leadership pilot request:", error);
        res.status(500).json({ message: "Failed to submit request" });
      }
    }
  );

  // Submit Early Intervention Pilot request (allow public submissions)
  app.post(
    "/api/pilots/earlyintervention/submit",
    async (req: Request, res: Response) => {
      try {
        const userId = (req.session as any)?.userId || null;
        const insertObj: any = {
          school_name: req.body.schoolName,
          contact_person_name: req.body.contactPersonName || null,
          contact_person_phone: req.body.phone || null,
          contact_person_role: req.body.contactPersonRole,
          email: req.body.email,
          submitter_name: req.body.submitterName || null,
          submitter_role: req.body.submitterRole || null,
        };
        if (userId) insertObj.submitted_by = userId;

        const { data, error } = await supabase
          .from("early_intervention_requests")
          .insert(insertObj)
          .select()
          .single();

        if (error) {
          console.error("Error submitting early intervention pilot request:", error);
          return res.status(500).json({ message: "Failed to submit request" });
        }

        res.json(data);
      } catch (error) {
        console.error("Error in submit early intervention pilot request:", error);
        res.status(500).json({ message: "Failed to submit request" });
      }
    }
  );

  // COO: fetch leadership pilot requests
    // COO: delete leadership pilot request
    app.delete(
      "/api/coo/leadership-pilot-requests/:id",
      isAuthenticated,
      requireRole(["coo"]),
      async (req: Request, res: Response) => {
        try {
          const { id } = req.params;
          const { error } = await supabase
            .from("leadership_pilot_requests")
            .delete()
            .eq("id", id);
          if (error) {
            console.error("Error deleting leadership pilot request:", error);
            return res.status(500).json({ message: "Failed to delete pilot request" });
          }
          res.json({ message: "Pilot request deleted" });
        } catch (error) {
          console.error("Error in deleting leadership pilot request:", error);
          res.status(500).json({ message: "Failed to delete pilot request" });
        }
      }
    );
  app.get(
    "/api/coo/leadership-pilot-requests",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("leadership_pilot_requests")
          .select("*")
          .order("submitted_at", { ascending: false });

        if (error) {
          console.error("Error fetching leadership pilot requests:", error);
          return res.status(500).json({ message: "Failed to fetch requests" });
        }

        res.json(data || []);
      } catch (error) {
        console.error("Error in fetching leadership pilot requests:", error);
        res.status(500).json({ message: "Failed to fetch requests" });
      }
    }
  );

  // HR: fetch leadership pilot requests
  app.get(
    "/api/hr/leadership-pilot-requests",
    isAuthenticated,
    requireRole(["hr"]),
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("leadership_pilot_requests")
          .select("*")
          .order("submitted_at", { ascending: false });

        if (error) {
          console.error("Error fetching leadership pilot requests:", error);
          return res.status(500).json({ message: "Failed to fetch requests" });
        }

        res.json(data || []);
      } catch (error) {
        console.error("Error in fetching leadership pilot requests:", error);
        res.status(500).json({ message: "Failed to fetch requests" });
      }
    }
  );

  // COO: fetch early intervention pilot requests
    // COO: delete early intervention pilot request
    app.delete(
      "/api/coo/earlyintervention-requests/:id",
      isAuthenticated,
      requireRole(["coo"]),
      async (req: Request, res: Response) => {
        try {
          const { id } = req.params;
          const { error } = await supabase
            .from("early_intervention_requests")
            .delete()
            .eq("id", id);
          if (error) {
            console.error("Error deleting early intervention pilot request:", error);
            return res.status(500).json({ message: "Failed to delete pilot request" });
          }
          res.json({ message: "Pilot request deleted" });
        } catch (error) {
          console.error("Error in deleting early intervention pilot request:", error);
          res.status(500).json({ message: "Failed to delete pilot request" });
        }
      }
    );
  app.get(
    "/api/coo/earlyintervention-requests",
    isAuthenticated,
    requireRole(["coo"]),
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("early_intervention_requests")
          .select("*")
          .order("submitted_at", { ascending: false });

        if (error) {
          console.error("Error fetching early intervention requests:", error);
          return res.status(500).json({ message: "Failed to fetch requests" });
        }

        res.json(data || []);
      } catch (error) {
        console.error("Error in fetching early intervention requests:", error);
        res.status(500).json({ message: "Failed to fetch requests" });
      }
    }
  );

  // HR: fetch early intervention pilot requests
  app.get(
    "/api/hr/earlyintervention-requests",
    isAuthenticated,
    requireRole(["hr"]),
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("early_intervention_requests")
          .select("*")
          .order("submitted_at", { ascending: false });

        if (error) {
          console.error("Error fetching early intervention requests:", error);
          return res.status(500).json({ message: "Failed to fetch requests" });
        }

        res.json(data || []);
      } catch (error) {
        console.error("Error in fetching early intervention requests:", error);
        res.status(500).json({ message: "Failed to fetch requests" });
      }
    }
  );

  // Get people registry list (for any logged in user - for dispute logging)
  app.get(
    "/api/people-registry/list",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("people_registry")
          .select("id, full_name, role_title, status")
          .eq("status", "active")
          .order("full_name", { ascending: true });

        if (error) {
          console.error("Error fetching people list:", error);
          return res.json([]);
        }

        // Transform to camelCase for frontend
        const transformed = (data || []).map((p: any) => ({
          id: p.id,
          fullName: p.full_name,
          roleTitle: p.role_title,
          status: p.status,
        }));

        res.json(transformed);
      } catch (error) {
        console.error("Error in people list:", error);
        res.json([]);
      }
    }
  );

  // ========================================
  // DISPUTES MODULE ROUTES (HR)
  // ========================================

  // Get all disputes
  app.get(
    "/api/hr/disputes",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { data: disputes, error } = await supabase
          .from("disputes")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching disputes:", error);
          return res.json([]);
        }

        // Fetch resolutions for each dispute
        const disputesWithResolutions = await Promise.all(
          (disputes || []).map(async (dispute: any) => {
            const { data: resolutions } = await supabase
              .from("dispute_resolutions")
              .select("*")
              .eq("dispute_id", dispute.id)
              .order("created_at", { ascending: true });

            return {
              ...dispute,
              resolutions: resolutions || [],
            };
          })
        );

        res.json(disputesWithResolutions);
      } catch (error) {
        console.error("Error in disputes:", error);
        res.json([]);
      }
    }
  );

  // Log a dispute (any logged in user)
  app.post(
    "/api/disputes/log",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req.session as any).userId;
        const { data, error } = await supabase
          .from("disputes")
          .insert({
            logged_by: userId,
            logged_by_name: req.body.loggedByName,
            involved_parties: req.body.involvedParties,
            involved_party_names: req.body.involvedPartyNames,
            dispute_type: req.body.disputeType,
            description: req.body.description,
            desired_outcome: req.body.desiredOutcome,
            status: "open",
            visible_to: ["hr", "ceo"],
          })
          .select()
          .single();

        if (error) {
          console.error("Error logging dispute:", error);
          return res.status(500).json({ message: "Failed to log dispute" });
        }

        res.json(data);
      } catch (error) {
        console.error("Error in log dispute:", error);
        res.status(500).json({ message: "Failed to log dispute" });
      }
    }
  );

  // Update dispute status
  app.patch(
    "/api/hr/disputes/:id/status",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { data, error } = await supabase
          .from("disputes")
          .update({
            status: req.body.status,
          })
          .eq("id", id)
          .select()
          .single();

        if (error) {
          console.error("Error updating dispute status:", error);
          return res.status(500).json({ message: "Failed to update dispute status" });
        }

        res.json(data);
      } catch (error) {
        console.error("Error in update dispute status:", error);
        res.status(500).json({ message: "Failed to update dispute status" });
      }
    }
  );

  // Resolve dispute
  app.post(
    "/api/hr/disputes/:disputeId/resolve",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { disputeId } = req.params;
        const userId = (req.session as any).userId;

        // Create resolution record
        const { data: resolution, error: resError } = await supabase
          .from("dispute_resolutions")
          .insert({
            dispute_id: disputeId,
            action: req.body.action,
            summary: req.body.summary,
            decision: req.body.decision,
            follow_up_date: req.body.followUpDate ? new Date(req.body.followUpDate) : null,
            resolved_by: userId,
          })
          .select()
          .single();

        if (resError) {
          console.error("Error creating resolution:", resError);
          return res.status(500).json({ message: "Failed to create resolution" });
        }

        // Update dispute status to resolved
        await supabase
          .from("disputes")
          .update({ status: "resolved" })
          .eq("id", disputeId);

        res.json(resolution);
      } catch (error) {
        console.error("Error in resolve dispute:", error);
        res.status(500).json({ message: "Failed to resolve dispute" });
      }
    }
  );

  // Get dispute patterns
  app.get(
    "/api/hr/disputes/patterns",
    isAuthenticated,
    requireRole(["hr", "ceo"]),
    async (req: Request, res: Response) => {
      try {
        const { data: disputes, error } = await supabase
          .from("disputes")
          .select("involved_party_names, dispute_type");

        if (error) {
          console.error("Error fetching disputes for patterns:", error);
          return res.json([]);
        }

        // Return raw data, let frontend process patterns
        res.json(disputes || []);
      } catch (error) {
        console.error("Error in disputes patterns:", error);
        res.json([]);
      }
    }
  );

  // ========================================
  // AFFILIATE PROSPECTING ROUTES
  // ========================================

  // Get or create affiliate code
  app.get(
    "/api/affiliate/code",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const affiliateId = (req.session as any).userId;
        console.log("📋 Getting affiliate code for:", affiliateId);
        
        const codeRecord = await storage.getOrCreateAffiliateCode(affiliateId);
        console.log("✅ Got code record:", codeRecord);
        
        // Return just the code field to match frontend expectations
        res.json({ code: codeRecord.code });
      } catch (error) {
        console.error("Error getting affiliate code:", error);
        res.status(500).json({ message: "Failed to get affiliate code" });
      }
    }
  );

  // Log encounter
  app.post(
    "/api/affiliate/encounters",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const affiliateId = (req.session as any).userId;
        console.log("📝 Logging encounter for affiliate:", affiliateId);
        console.log("📋 Encounter data received:", JSON.stringify(req.body, null, 2));
        
        const encounter = insertEncounterSchema.parse(req.body);
        console.log("✅ Encounter validated:", JSON.stringify(encounter, null, 2));
        
        const result = await storage.logEncounter(affiliateId, encounter);
        console.log("✅ Encounter logged successfully:", result);
        
        res.json(result);
      } catch (error: any) {
        console.error("❌ Error logging encounter:", error.message);
        console.error("   Full error:", error);
        res.status(400).json({ message: error.message || "Failed to log encounter" });
      }
    }
  );

  // Get all encounters for affiliate
  app.get(
    "/api/affiliate/encounters",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const affiliateId = (req.session as any).userId;
        const encounters = await storage.getEncounters(affiliateId);
        res.json(encounters);
      } catch (error) {
        console.error("Error getting encounters:", error);
        res.status(500).json({ message: "Failed to get encounters" });
      }
    }
  );

  // Mark encounter as objected
  app.patch(
    "/api/affiliate/encounters/:id/object",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await storage.updateEncounterStatus(id, "objected");
        res.json({ success: true });
      } catch (error) {
        console.error("Error updating encounter:", error);
        res.status(500).json({ message: "Failed to update encounter" });
      }
    }
  );

  // Get affiliate leads
  app.get(
    "/api/affiliate/leads",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const affiliateId = (req.session as any).userId;
        const leads = await storage.getLeads(affiliateId);
        res.json(leads);
      } catch (error) {
        console.error("Error getting leads:", error);
        res.status(500).json({ message: "Failed to get leads" });
      }
    }
  );

  // Get affiliate closes
  app.get(
    "/api/affiliate/closes",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const affiliateId = (req.session as any).userId;
        const closes = await storage.getCloses(affiliateId);
        res.json(closes);
      } catch (error) {
        console.error("Error getting closes:", error);
        res.status(500).json({ message: "Failed to get closes" });
      }
    }
  );

  // Get affiliate stats
  app.get(
    "/api/affiliate/stats",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const affiliateId = (req.session as any).userId;
        const stats = await storage.getAffiliateStats(affiliateId);
        res.json(stats);
      } catch (error) {
        console.error("Error getting stats:", error);
        res.status(500).json({ message: "Failed to get stats" });
      }
    }
  );

  // Get affiliate lead/close/objected breakdown
  app.get(
    "/api/affiliate/breakdown",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const affiliateId = (req.session as any).userId;
        const breakdown = await storage.getAffiliateLeadsByStatus(affiliateId);
        res.json(breakdown);
      } catch (error) {
        console.error("Error getting breakdown:", error);
        res.status(500).json({ message: "Failed to get breakdown" });
      }
    }
  );

  // Save affiliate reflection (from discover-deliver blueprint)
  app.post(
    "/api/affiliate/reflection",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const affiliateId = (req.session as any).userId;
        const parsed = insertAffiliateReflectionSchema.parse(req.body) as any;
        const reflectionText = parsed.reflectionText || parsed.reflection_text;
        const result = await storage.saveAffiliateReflection(affiliateId, reflectionText);
        res.json(result);
      } catch (error) {
        console.error("Error saving reflection:", error);
        res.status(400).json({ message: "Failed to save reflection" });
      }
    }
  );

  // Get affiliate reflection
  app.get(
    "/api/affiliate/reflection",
    isAuthenticated,
    requireRole(["affiliate"]),
    async (req: Request, res: Response) => {
      try {
        const affiliateId = (req.session as any).userId;
        const reflection = await storage.getAffiliateReflection(affiliateId);
        res.json(reflection);
      } catch (error) {
        console.error("Error getting reflection:", error);
        res.status(500).json({ message: "Failed to get reflection" });
      }
    }
  );

  // Record close (parent committed to tutoring journey)
  app.post(
    "/api/parent/record-close",
    isAuthenticated,
    requireRole(["parent"]),
    async (req: Request, res: Response) => {
      try {
        const parentId = (req.session as any).userId;
        const { studentId, podId } = req.body;

        if (!studentId) {
          return res.status(400).json({ message: "studentId is required" });
        }

        // Get parent's lead to find their affiliate
        const { data: lead } = await supabase
          .from("leads")
          .select("affiliate_id")
          .eq("parent_id", parentId)
          .maybeSingle();

        if (!lead) {
          return res.status(400).json({ message: "No affiliate found for this parent" });
        }

        // Record the close
        const close = await storage.recordClose(lead.affiliate_id, parentId, studentId, podId);
        res.json(close);
      } catch (error) {
        console.error("Error recording close:", error);
        res.status(500).json({ message: "Failed to record close" });
      }
    }
  );

  // ========================================
  // PARENT ENROLLMENT ROUTES
  // ========================================

  // Get parent enrollment status
  app.get("/api/parent/enrollment-status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
      const dbUser = (req as any).dbUser;
      const enrollmentDebug: Record<string, any> = {
        userId,
        dbUserEmail: dbUser?.email || null,
      };

      console.log("📍 Enrollment status check for user:", userId, "role:", dbUser?.role);

      // Allow all authenticated users to check their enrollment status
      // (mainly parents, but be lenient)
      
      // Check if parent has completed enrollment using canonical latest-enrollment lookup.
      const { data: enrollmentData, error } = await selectLatestParentEnrollment({
        parentId: userId,
        primarySelect: "*",
        preferPaidEnrollment: true,
      });
      enrollmentDebug.lookupError = error ? String(error.message || error) : null;
      enrollmentDebug.enrollmentId = enrollmentData?.id || null;
      enrollmentDebug.enrollmentStatus = enrollmentData?.status || null;
      enrollmentDebug.enrollmentStep = enrollmentData?.current_step || null;

      if (error) {
        console.warn("⚠️  Error fetching enrollment status (table may not exist yet):", error.message);
        // If table doesn't exist or there's an error, just return not_enrolled
        // This allows the gateway to load and user can submit their enrollment
        return res.json({ status: "not_enrolled", debug: enrollmentDebug });
      }

      if (!enrollmentData) {
        return res.json({ status: "not_enrolled", debug: enrollmentDebug });
      }

      let status = enrollmentData.status || "not_enrolled";
      let effectiveStep = enrollmentData.current_step;
      const operationalMode = await getParentAssignedTutorOperationalMode(userId);
      enrollmentDebug.operationalMode = operationalMode;
      const sessionType = getEnrollmentSessionType(enrollmentData);
      enrollmentDebug.sessionType = sessionType;
      const billingModel = await getParentBillingModel(userId);
      enrollmentDebug.billingModelError = billingModel.error ? String(billingModel.error.message || billingModel.error) : null;
      enrollmentDebug.onboardingType = billingModel.data.onboardingType;
      let canonicalEnrollmentStudent: any = null;
      if (enrollmentData.assigned_tutor_id) {
        try {
          canonicalEnrollmentStudent = await resolveCanonicalStudentForEnrollment(enrollmentData);
        } catch (canonicalStudentError) {
          console.error("Failed to resolve canonical enrollment student for parent status:", canonicalStudentError);
        }
      }

      const sessionProgress = canonicalEnrollmentStudent?.id
        ? await getCompletedSessionCountForStudent(String(canonicalEnrollmentStudent.id))
        : enrollmentData.assigned_student_id
          ? await getCompletedSessionCountForStudent(String(enrollmentData.assigned_student_id))
          : { count: 0, error: null as any };
      enrollmentDebug.sessionProgressError = sessionProgress.error ? String(sessionProgress.error.message || sessionProgress.error) : null;
      enrollmentDebug.sessionProgressCount = sessionProgress.count || 0;

      let assignmentAccepted = false;
      const sandboxEnrollmentLikely =
        Boolean((enrollmentData as any).is_sandbox_account) ||
        isHeuristicSandboxEnrollment(enrollmentData, enrollmentData?.assigned_tutor_id) ||
        String(effectiveStep || "").startsWith("sandbox-");

      // Auto-correct: if status is 'awaiting_tutor_acceptance', check if tutor has accepted
      if (
        enrollmentData.assigned_tutor_id &&
        (status === "awaiting_tutor_acceptance" ||
          (sandboxEnrollmentLikely && status === "assigned"))
      ) {
        let acceptedEnrollmentStudent = canonicalEnrollmentStudent;
        let assignedWorkflow = ((acceptedEnrollmentStudent?.personalProfile as any) || {}).workflow || {};

        if (!assignedWorkflow.assignmentAcceptedAt) {
          try {
            const reconciledAcceptedStudent = await resolveAcceptedStudentForEnrollment(enrollmentData);
            if (reconciledAcceptedStudent) {
              acceptedEnrollmentStudent = reconciledAcceptedStudent;
              canonicalEnrollmentStudent = reconciledAcceptedStudent;
              assignedWorkflow = ((reconciledAcceptedStudent?.personalProfile as any) || {}).workflow || {};

              if (
                enrollmentData.id &&
                (String(enrollmentData.assigned_student_id || "").trim() !== String(reconciledAcceptedStudent.id || "").trim() ||
                  status !== "assigned" ||
                  effectiveStep !== "assigned")
              ) {
                await supabase
                  .from("parent_enrollments")
                  .update({
                    assigned_student_id: reconciledAcceptedStudent.id,
                    status: "assigned",
                    current_step: "assigned",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", enrollmentData.id);
              }
            }
          } catch (acceptedStudentResolutionError) {
            console.error("Failed to resolve accepted student for enrollment:", acceptedStudentResolutionError);
          }
        }

        assignmentAccepted = !!assignedWorkflow.assignmentAcceptedAt;
        const sandboxAssignedAcceptanceLikely =
          sandboxEnrollmentLikely &&
          status === "assigned" &&
          (
            hasPostProvisionAssignmentUpdate(enrollmentData) ||
            String(effectiveStep || "").trim().toLowerCase() === "sandbox-assigned"
          );

        // Legacy sandbox rows were provisioned as assigned before acceptance. Normalize them back
        // to the live-equivalent acceptance state until the tutor actually accepts.
        if (
          sandboxEnrollmentLikely &&
          status === "assigned" &&
          !assignmentAccepted &&
          !sandboxAssignedAcceptanceLikely
        ) {
          status = "awaiting_tutor_acceptance";
          effectiveStep = "awaiting_tutor_acceptance";
        } else if (assignmentAccepted || sandboxAssignedAcceptanceLikely) {
          status = "assigned";
          effectiveStep = "assigned";
        }
      }

      if (
        operationalMode === "certified_live" &&
        enrollmentData.assigned_tutor_id &&
        ["proposal_sent", "session_booked", "report_received", "confirmed"].includes(String(status))
      ) {
        let latestSession: any = null;

        const directSessionLookup = await supabase
          .from("scheduled_sessions")
          .select("id, status, parent_confirmed, tutor_confirmed, created_at, updated_at, type")
          .eq("parent_id", userId)
          .eq("tutor_id", enrollmentData.assigned_tutor_id)
          .eq("type", sessionType)
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1);

        latestSession = directSessionLookup.data?.[0] || null;

        if (!latestSession && enrollmentData.assigned_student_id) {
          const fallbackSessionLookup = await supabase
            .from("scheduled_sessions")
            .select("id, status, parent_confirmed, tutor_confirmed, created_at, updated_at, type")
            .eq("student_id", enrollmentData.assigned_student_id)
            .eq("tutor_id", enrollmentData.assigned_tutor_id)
            .eq("type", sessionType)
            .order("updated_at", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1);

          latestSession = fallbackSessionLookup.data?.[0] || null;
        }

        const bookingPrerequisiteSatisfied = latestSession
          ? ["confirmed", "ready", "live", "completed"].includes(getEffectiveScheduledSessionStatus(latestSession))
          : false;

        if (!bookingPrerequisiteSatisfied) {
          status = "assigned";
        }
      }

      let { data: latestPayment } = await getLatestPaymentForEnrollment(String(enrollmentData.id));
      enrollmentDebug.latestPaymentId = latestPayment?.id || null;
      enrollmentDebug.latestPaymentStatus = latestPayment?.payment_status || null;

      if (String(status) === "proposal_sent") {
        const { data: latestPaidPayment, error: latestPaidPaymentError } = await getLatestPaidPaymentForEnrollment(
          String(enrollmentData.id),
        );

        if (latestPaidPaymentError) {
          console.error("Failed to resolve paid payment for proposal finalization:", latestPaidPaymentError);
          enrollmentDebug.latestPaidPaymentError = String(latestPaidPaymentError.message || latestPaidPaymentError);
        } else if (latestPaidPayment) {
          try {
            const finalized = await finalizeAcceptedProposalFromPayment(latestPaidPayment);
            latestPayment = latestPaidPayment;
            status = finalized.status;
            effectiveStep = finalized.status;
            enrollmentDebug.autoFinalizedFromPaidPayment = true;
            enrollmentDebug.latestPaymentId = latestPaidPayment.id || enrollmentDebug.latestPaymentId;
            enrollmentDebug.latestPaymentStatus = latestPaidPayment.payment_status || enrollmentDebug.latestPaymentStatus;
          } catch (finalizationError) {
            console.error("Failed to auto-finalize paid proposal from enrollment status:", finalizationError);
            enrollmentDebug.autoFinalizationError =
              finalizationError instanceof Error ? finalizationError.message : String(finalizationError);
          }
        }
      }

      res.json({
        status,
        step: effectiveStep,
        onboardingType: billingModel.data.onboardingType,
        freeSessionsRemaining:
          billingModel.data.onboardingType === "pilot"
            ? Math.max(0, 9 - (sessionProgress.count || 0))
            : 0,
        plan: latestPayment?.plan || PREMIUM_PLAN_NAME,
        paymentStatus: latestPayment
          ? String(latestPayment.payment_status || "").toUpperCase()
          : billingModel.data.onboardingType === "pilot" && (sessionProgress.count || 0) < 9
            ? "FREE_ACCESS"
            : "UNPAID",
        paymentDate: latestPayment?.payment_date || latestPayment?.paid_at || null,
        debug: enrollmentDebug,
      });
    } catch (error) {
      console.error("Error in enrollment-status:", error);
      // On error, assume not_enrolled so gateway can proceed
      res.json({
        status: "not_enrolled",
        debug: {
          routeError: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  // Get tutor profile for parent
  app.get("/api/parent/assigned-tutor", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser.id;
      console.log("📋 Fetching assigned tutor for parent:", userId);

      const { data: enrollmentData, error } = await selectLatestParentEnrollment({
        parentId: userId,
        primarySelect: "assigned_tutor_id",
      });

      console.log("📋 Enrollment data:", enrollmentData, "Error:", error);

      if (error || !enrollmentData || !enrollmentData.assigned_tutor_id) {
        return res.status(404).json({ message: "No tutor assigned" });
      }

      // Fetch tutor info from public.users
      const tutor = await storage.getUser(enrollmentData.assigned_tutor_id);
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      const tutorProfile = {
        id: tutor.id,
        name: tutor.name,
        email: tutor.email,
        bio: tutor.bio || undefined,
        phone: tutor.phone || undefined,
        profile_image_url: tutor.profileImageUrl || undefined,
      };
      console.log("📋 Returning tutor profile (public.users):", tutorProfile);
      res.json(tutorProfile);
    } catch (error) {
      console.error("Error fetching assigned tutor (admin API):", error);
      res.status(500).json({ message: "Failed to fetch tutor profile" });
    }
  });

  // Submit parent enrollment form
  app.post("/api/parent/enroll", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).dbUser?.id || (req.session as any)?.userId;
      const dbUser = (req as any).dbUser;

      console.log("📍 Enrollment submission for user:", userId, "role:", dbUser?.role);

      // Allow all authenticated users to submit enrollment
      // (mainly parents, but be lenient during development)
      
      const {
        parentFullName,
        parentPhone,
        parentEmail,
        parentCity,
        studentFullName,
        studentGrade,
        studentGender,
        schoolName,
        stuckAreas,
        reportedTopics: rawReportedTopics,
        previousTutoring,
        internetAccess,
        responseSymptoms: rawResponseSymptoms,
        topicResponseSymptoms: rawTopicResponseSymptoms,
        parentMotivation,
        processAlignment,
        agreedToTerms,
        onboardingType,
        cohortCode,
        affiliateCode: bodyAffiliateCode
      } = req.body;

      const reportedTopics = buildReportedTopics(
        rawTopicResponseSymptoms,
        rawReportedTopics
      );
      const normalizedTopicResponseSymptoms = reportedTopics.reduce<Record<string, string[]>>((acc, topic) => {
        const rawTopicSymptoms =
          rawTopicResponseSymptoms && typeof rawTopicResponseSymptoms === "object"
            ? (rawTopicResponseSymptoms as Record<string, unknown>)[topic]
            : [];
        acc[topic] = normalizeResponseSymptoms(rawTopicSymptoms);
        return acc;
      }, {});
      const normalizedResponseSymptoms = normalizeResponseSymptoms(rawResponseSymptoms);
      const flattenedTopicResponseSymptoms = Array.from(
        new Set(Object.values(normalizedTopicResponseSymptoms).flat())
      );
      const effectiveResponseSymptoms =
        flattenedTopicResponseSymptoms.length > 0 ? flattenedTopicResponseSymptoms : normalizedResponseSymptoms;
      const topicResponseRecommendations = Object.fromEntries(
        Object.entries(normalizedTopicResponseSymptoms).map(([topic, symptomIds]) => {
          const recommendation = recommendStartingPhaseFromSymptoms(symptomIds);
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
      const responseRecommendation = recommendStartingPhaseFromSymptoms(effectiveResponseSymptoms);
      const responseSymptoms = getResponseSymptomLabels(effectiveResponseSymptoms);

      const normalizedParentMotivation = [
        parentMotivation,
        processAlignment ? `Process alignment: ${processAlignment}` : "",
        responseSymptoms.length > 0
          ? `Observed response symptoms: ${responseSymptoms.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      // Use affiliate code from session if not present in body
      let affiliateCode = bodyAffiliateCode || req.session.affiliateCode || null;
      if (affiliateCode) {
        // Remove from session after use
        req.session.affiliateCode = undefined;
      }

      // Validate required fields
      if (
        !parentFullName ||
        !parentPhone ||
        !studentFullName ||
        !studentGrade ||
        !studentGender ||
        !schoolName ||
        reportedTopics.length === 0 ||
        reportedTopics.some((topic) => (normalizedTopicResponseSymptoms[topic] || []).length === 0) ||
        !previousTutoring ||
        !internetAccess ||
        !agreedToTerms
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }


      // Check if enrollment already exists
      const { data: existing } = await supabase
        .from("parent_enrollments")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({ message: "Enrollment already submitted" });
      }



      // Determine onboarding_type from affiliate code if present
      // Determine onboarding_type and affiliate_type from affiliate code if present
      // Only allow 'pilot' or 'commercial' as onboarding_type
        // --- ONBOARDING LOGIC ---
        // onboarding_type: 'pilot' or 'commercial' ONLY
        // affiliate_type: 'person' or 'entity' ONLY
        let resolvedOnboardingType = (onboardingType === 'pilot' || onboardingType === 'commercial') ? onboardingType : 'commercial';
        let resolvedAffiliateType = null;
        if (affiliateCode) {
          // Always set onboarding_type to 'pilot' if code is provided
          resolvedOnboardingType = 'pilot';
          const { data: codeData, error: codeError } = await supabase
            .from("affiliate_codes")
            .select("type, affiliate_type")
            .eq("code", affiliateCode)
            .maybeSingle();
          if (codeError) {
            console.error('Error looking up affiliate code for onboarding_type/affiliate_type:', codeError);
          }
          if (codeData) {
            // affiliate_type is for analytics/tracking, not onboarding flow
            resolvedAffiliateType = codeData.affiliate_type || codeData.type || null;
          }
        }
        // Ensure onboarding_type is never set to affiliate_type
        if (resolvedOnboardingType !== 'pilot' && resolvedOnboardingType !== 'commercial') {
          resolvedOnboardingType = 'commercial';
        }
        // --- END ONBOARDING LOGIC ---
      // Insert or update onboarding type, affiliate type, and affiliate code in parents table
      // Fetch full_name from public.users
      let fullName = null;
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();
      if (userError) {
        console.error("Error fetching first_name/last_name from users:", userError);
      }
      if (userData) {
        const first = userData.first_name || '';
        const last = userData.last_name || '';
        fullName = (first + ' ' + last).trim();
      }
      // --- DEBUG LOGGING ---
      console.log("[ENROLL] Preparing to upsert parent record:", {
        user_id: userId,
        onboarding_type: resolvedOnboardingType,
        affiliate_type: resolvedAffiliateType,
        affiliate_code: affiliateCode,
        cohort_code: cohortCode,
        full_name: fullName,
      });
      try {
        const { data: parentUpserted, error: parentUpsertError } = await supabase
          .from("parents")
          .upsert({
            user_id: userId,
            onboarding_type: resolvedOnboardingType,
            affiliate_type: resolvedAffiliateType,
            affiliate_code: affiliateCode || cohortCode || null,
            full_name: fullName,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
          .select()
          .single();
        if (parentUpsertError) {
          console.error("[ENROLL] Error upserting parent onboarding/affiliate type:", parentUpsertError);
        } else {
          console.log("[ENROLL] Parent upsert successful. Upserted row:", parentUpserted);
        }
      } catch (err) {
        console.error("[ENROLL] Exception during parent upsert:", err);
      }
      // --- END DEBUG LOGGING ---

      // Lead creation is now handled after signup, not enrollment.

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
          current_step: "awaiting-assignment",
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
      } = req.body;

      // Validate required fields
      if (!studentId || !recommendedPlan || !justification) {
        return res.status(400).json({ message: "Missing required fields" });
      }

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
          current_topics: resolvedCurrentTopics,
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
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating proposal:", error);
        return res.status(500).json({ message: "Failed to create proposal" });
      }

      // Update enrollment status to proposal_sent if enrollment exists
      if (actualEnrollmentId) {
        const { data: updatedEnrollment } = await supabase
          .from("parent_enrollments")
          .update({
            status: "proposal_sent",
            proposal_id: proposalData.id,
            proposal_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", actualEnrollmentId)
          .select("id, user_id")
          .maybeSingle();

        await safeSendPush(
          updatedEnrollment?.user_id,
          {
            title: "Proposal ready",
            body: "Your tutor has sent a proposal. Open Response Integrity to review and respond.",
            url: "/client/parent/gateway",
            tag: `parent-proposal-sent-${proposalData.id}`,
          },
          "parent proposal sent",
        );
      }

      res.json({
        message: "Proposal sent successfully",
        proposal: proposalData,
      });
    } catch (error) {
      console.error("Error in create proposal:", error);
      res.status(500).json({ message: "Failed to create proposal" });
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

      console.log("📋 Fetching proposal for parent:", parentId);

      const { data: enrollment, error: enrollmentError } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, proposal_id, status, student_full_name, student_grade",
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
      const billingModel = await getParentBillingModel(parentId);
      if (billingModel.error) {
        return res.status(500).json({ message: "Failed to resolve onboarding type for billing." });
      }

      const { data: paymentEnrollment, error: paymentEnrollmentError } = await supabase
        .from("parent_enrollments")
        .select("id, status, proposal_id, student_full_name, current_step, assigned_tutor_id, parent_email, is_sandbox_account")
        .eq("user_id", parentId)
        .eq("status", "proposal_sent")
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
      if (billingModel.data.onboardingType === "commercial" && !isPremiumPlanPaymentReady(payfastSandboxForEnrollment)) {
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
          message: "Premium payment already confirmed.",
          paymentStatus: "PAID",
          status: finalized.status,
          parentCode: finalized.parentCode,
        });
      }

      const { data: paymentProposal } = await supabase
        .from("onboarding_proposals")
        .select("id, student_id, tutor_id")
        .eq("id", paymentEnrollment.proposal_id)
        .maybeSingle();

      if (!paymentProposal?.student_id || !paymentProposal?.tutor_id) {
        return res.status(400).json({ message: "Proposal is missing student or tutor linkage." });
      }

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

      const merchantReference = String(existingPayment?.merchant_reference || `response-integrity-premium-${uuidv4()}`);
      const payfastConfig = getPayfastConfig(payfastSandboxForEnrollment);
      const nowIso = new Date().toISOString();
      const paymentRawPayload = {
        ...(existingPayment?.raw_payload && typeof existingPayment.raw_payload === "object" ? existingPayment.raw_payload : {}),
        payfast_mode: payfastSandboxForEnrollment ? "sandbox" : "live",
        sandbox_checkout: payfastSandboxForEnrollment,
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
            plan: PREMIUM_PLAN_NAME,
            amount: PREMIUM_PLAN_AMOUNT,
            currency: "ZAR",
            tutor_share: PREMIUM_TUTOR_SHARE,
            platform_share: PREMIUM_PLATFORM_SHARE,
            merchant_reference: merchantReference,
            item_name: `${PREMIUM_PLAN_NAME} Plan`,
            item_description: buildPremiumPaymentDescription(paymentEnrollment.student_full_name),
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
            plan: PREMIUM_PLAN_NAME,
            amount: PREMIUM_PLAN_AMOUNT,
            currency: "ZAR",
            tutor_share: PREMIUM_TUTOR_SHARE,
            platform_share: PREMIUM_PLATFORM_SHARE,
            merchant_reference: merchantReference,
            item_name: `${PREMIUM_PLAN_NAME} Plan`,
            item_description: buildPremiumPaymentDescription(paymentEnrollment.student_full_name),
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

      const payfastFields = withPayfastSignature(
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
            useSandbox: payfastSandboxForEnrollment,
          }),
          m_payment_id: merchantReference,
          amount: PREMIUM_PLAN_AMOUNT,
          item_name: `${PREMIUM_PLAN_NAME} Plan`,
          item_description: buildPremiumPaymentDescription(paymentEnrollment.student_full_name),
          custom_str1: String(paymentEnrollment.id),
          custom_str2: String(paymentProposal.id),
          custom_str3: String(paymentProposal.student_id),
          custom_str4: String(paymentProposal.tutor_id),
          custom_str5: PREMIUM_PLAN_NAME,
        },
        payfastConfig.passphrase,
      );

      return res.json({
        message: "PayFast payment prepared.",
        onboardingType: "commercial",
        paymentStatus: "UNPAID",
        paymentProvider: PAYMENT_PROVIDER_PAYFAST,
        plan: PREMIUM_PLAN_NAME,
        amount: Number(PREMIUM_PLAN_AMOUNT),
        tutorShare: Number(PREMIUM_TUTOR_SHARE),
        platformShare: Number(PREMIUM_PLATFORM_SHARE),
        ttShare: Number(PREMIUM_PLATFORM_SHARE),
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
        .select("student_id, tutor_id, topic_conditioning_topic, topic_conditioning_entry_phase, topic_conditioning_stability")
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
  app.post("/api/parent/payments/renew", isAuthenticated, requireRole(["parent"]), async (req: Request, res: Response) => {
    try {
      const parentId = (req as any).dbUser.id;

      const { data: enrollment, error: enrollmentError } = await selectLatestParentEnrollment({
        parentId,
        primarySelect: "id, status, student_full_name, assigned_tutor_id, parent_email, is_sandbox_account, assigned_student_id, current_step",
        fallbackSelect: "id, status, student_full_name, assigned_tutor_id, parent_email, is_sandbox_account, current_step",
      });

      const activeStatuses = ["confirmed", "session_booked", "report_received"];
      if (enrollmentError || !enrollment || !activeStatuses.includes(enrollment.status)) {
        return res.status(404).json({ message: "No active enrollment found for renewal." });
      }

      const useSandbox = isSandboxPaymentEnrollment(enrollment);
      if (!isPremiumPlanPaymentReady(useSandbox)) {
        return res.status(500).json({ message: "PayFast is not configured on this deployment." });
      }

      const monthKey = toMonthKey(getMonthStartIso(new Date().toISOString())!);
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
        return res.status(409).json({ message: "Your current monthly session quota is not exhausted yet. Renew only after all 8 sessions are used." });
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
          plan: PREMIUM_PLAN_NAME,
          amount: PREMIUM_PLAN_AMOUNT,
          currency: "ZAR",
          tutor_share: PREMIUM_TUTOR_SHARE,
          platform_share: PREMIUM_PLATFORM_SHARE,
          merchant_reference: merchantReference,
          item_name: `${PREMIUM_PLAN_NAME} Monthly Renewal`,
          item_description: buildPremiumPaymentDescription(enrollment.student_full_name),
          raw_payload: { payfast_mode: useSandbox ? "sandbox" : "live", renewal: true, month_key: monthKey },
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
          return_url: `${getAppBaseUrl()}/client/parent/gateway?payfast=return&merchantReference=${encodeURIComponent(merchantReference)}&renewal=true`,
          cancel_url: `${getAppBaseUrl()}/client/parent/gateway?payfast=cancelled&merchantReference=${encodeURIComponent(merchantReference)}&renewal=true`,
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
          amount: PREMIUM_PLAN_AMOUNT,
          item_name: `${PREMIUM_PLAN_NAME} Monthly Renewal`,
          item_description: buildPremiumPaymentDescription(enrollment.student_full_name),
          custom_str1: String(enrollment.id),
          custom_str5: PREMIUM_PLAN_NAME,
        },
        payfastConfig.passphrase,
      );

      return res.json({
        message: "Renewal payment prepared.",
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
      console.log("🎓 Student signup request:", { email, firstName, lastName, parentCode });

      if (!email || !password || !parentCode) {
        return res.status(400).json({ message: "Email, password, and parent code are required" });
      }

      // Validate parent code
      console.log("🔍 Validating parent code:", parentCode.toUpperCase());
      const { data: proposal, error: proposalError } = await supabase
        .from("onboarding_proposals")
        .select("id, student_id, accepted_at, parent_code")
        .eq("parent_code", parentCode.toUpperCase())
        .maybeSingle();

      console.log("📋 Proposal found:", proposal, "Error:", proposalError);

      if (proposalError || !proposal) {
        console.log("❌ Invalid parent code");
        return res.status(400).json({ message: "Invalid parent code" });
      }

      if (!proposal.accepted_at) {
        console.log("❌ Proposal not accepted yet");
        return res.status(400).json({ message: "Parent has not yet accepted the proposal for this code" });
      }

      // Check if code already used
      console.log("🔍 Checking if code already used...");
      const { data: existingStudent, error: checkError } = await supabase
        .from("student_users")
        .select("id")
        .eq("parent_code", parentCode.toUpperCase())
        .maybeSingle();

      console.log("👥 Existing student:", existingStudent, "Check error:", checkError);

      if (existingStudent) {
        console.log("❌ Code already used");
        return res.status(400).json({ message: "This parent code has already been used" });
      }

      // Hash password using bcrypt
      console.log("🔐 Hashing password...");
      const { hash } = await import("bcryptjs");
      const hashedPassword = await hash(password, 10);

      // Create student user
      console.log("💾 Creating student user in database...");
      const { data: studentUser, error: insertError } = await supabase
        .from("student_users")
        .insert({
          email,
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          student_id: proposal.student_id,
          parent_code: parentCode.toUpperCase(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error creating student user:", insertError);
        console.error("❌ Insert error details:", JSON.stringify(insertError, null, 2));
        return res.status(500).json({ message: "Failed to create student account", error: insertError.message });
      }

      console.log("✅ Student user created:", studentUser);

      // Patch: Link intro session(s) to student_id after signup
      if (proposal.student_id) {
        // Find all intro sessions for this parent/tutor with student_id null
        const { data: introSessions, error: sessionFetchError } = await supabase
          .from("scheduled_sessions")
          .select("id")
          .eq("parent_id", req.body.parentId || null)
          .eq("tutor_id", (proposal as any).tutor_id)
          .is("student_id", null)
          .eq("type", "intro");
        if (sessionFetchError) {
          console.error("❌ Error fetching intro sessions for student linkage:", sessionFetchError);
        } else if (introSessions && introSessions.length > 0) {
          const sessionIds = introSessions.map(s => s.id);
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

      // Create session for student
      (req.session as any).studentUserId = studentUser.id;
      (req.session as any).studentEmail = studentUser.email;
      req.session.touch();

      console.log("✅ Student signup successful!");
      res.json({
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
      res.status(500).json({ message: "Failed to create student account", error: error.message });
    }
  });

  // Student signin
  app.post("/api/student/signin", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find student user
      const { data: studentUser, error } = await supabase
        .from("student_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error || !studentUser) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const { compare } = await import("bcryptjs");
      const passwordMatch = await compare(password, studentUser.password);

      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Update last login
      await supabase
        .from("student_users")
        .update({ last_login: new Date().toISOString() })
        .eq("id", studentUser.id);

      // Create session
      (req.session as any).studentUserId = studentUser.id;
      (req.session as any).studentEmail = studentUser.email;
      req.session.touch();

      res.json({
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
      res.status(500).json({ message: "Failed to sign in" });
    }
  });

  // Get current student user
  app.get("/api/student/me", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;

      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: studentUser, error } = await supabase
        .from("student_users")
        .select("id, email, first_name, last_name, student_id, created_at, last_login")
        .eq("id", studentUserId)
        .single();

      if (error || !studentUser) {
        return res.status(404).json({ message: "Student user not found" });
      }

      // Get the student's tutor's pod if available
      let podName = null;
      if (studentUser.student_id) {
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

      res.json({
        id: studentUser.id,
        email: studentUser.email,
        firstName: studentUser.first_name,
        lastName: studentUser.last_name,
        studentId: studentUser.student_id,
        createdAt: studentUser.created_at,
        lastLogin: studentUser.last_login,
        podName: podName,
      });
    } catch (error) {
      console.error("Error fetching student user:", error);
      res.status(500).json({ message: "Failed to fetch student user" });
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
      if (operationalMode === "training") {
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
  app.get("/api/student/stats", async (req: Request, res: Response) => {
    try {
      const studentUserId = (req.session as any).studentUserId;
      if (!studentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get student_id from student_users table
      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const stats = await getStudentDashboardStats(studentUser.student_id);
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

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const student = await storage.getStudent(studentUser.student_id);

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
        const { data: activations } = await supabase
          .from("topic_conditioning_activations")
          .select("topic, created_at")
          .eq("student_id", student.id)
          .order("created_at", { ascending: true });

        const activation = (activations || [])
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

      const { data: studentUser } = await supabase
        .from("student_users")
        .select("student_id")
        .eq("id", studentUserId)
        .single();

      if (!studentUser?.student_id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const student = await storage.getStudent(studentUser.student_id);
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
        .filter((row) => row.bucket !== "older")
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
        .filter((row) => row.bucket !== "older")
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

      const now = Date.now();
      const topics = Object.entries(topicsStore)
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

          return {
            topic,
            phase: latest.phase,
            stability: latest.stability,
            lastUpdated: latest.date,
          };
        })
        .filter((row): row is NonNullable<typeof row> => !!row)
        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

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
