import { v4 as uuidv4 } from "uuid";
import { supabase } from "./storage";
import {
  TRIAL_REQUIRED_SESSIONS_PER_FAMILY,
  deriveTrialPlacementProgress,
  evaluateTrialCertificationGate,
  type TrialCaseOverview,
  type TrialCaseStatus,
  type TrialCertificationDecision,
  type TrialFeedbackState,
  type TrialOutcomeClassification,
  type TrialPlacementOverview,
  type TrialReportEvidence,
  type TrialReviewDecision,
  type TrialRiskState,
  type TrialTestimonialPermission,
} from "@shared/trialCertification";

const OPEN_TRIAL_CASE_STATUSES: TrialCaseStatus[] = ["active", "reviewable", "remediation_required"];

function parseReportSummary(summary: unknown) {
  if (summary && typeof summary === "object") return summary as Record<string, unknown>;
  if (typeof summary !== "string") return {};
  try {
    const parsed = JSON.parse(summary);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function mapReportEvidence(row: any): TrialReportEvidence | null {
  const reportType = String(row?.report_type || "").trim().toLowerCase();
  if (reportType !== "weekly" && reportType !== "monthly") return null;
  const summary = parseReportSummary(row?.summary);
  const sourceSessionIds = Array.isArray(summary.sourceSessionIds)
    ? summary.sourceSessionIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  return {
    id: String(row.id),
    reportType,
    reportWindowKey: row.report_window_key || null,
    sourceSessionIds,
  };
}

async function loadTrialPlacementOverview(placement: any, review: any | null): Promise<TrialPlacementOverview> {
  const { data: enrollment } = await supabase
    .from("parent_enrollments")
    .select("parent_full_name, student_full_name")
    .eq("id", placement.enrollment_id)
    .maybeSingle();

  const { data: sessions, error: sessionsError } = await supabase
    .from("scheduled_sessions")
    .select("id, status, scheduled_time, updated_at")
    .eq("tutor_id", placement.tutor_id)
    .eq("student_id", placement.student_id)
    .eq("status", "completed")
    .gte("scheduled_time", placement.started_at)
    .order("scheduled_time", { ascending: true });

  if (sessionsError) {
    throw new Error(`Failed to load Trial sessions: ${sessionsError.message}`);
  }

  const sessionIds = (sessions || []).map((session: any) => String(session.id));
  let loggedSessionIds = new Set<string>();
  if (sessionIds.length > 0) {
    const { data: drillRows, error: drillError } = await supabase
      .from("intro_session_drills")
      .select("scheduled_session_id")
      .eq("tutor_id", placement.tutor_id)
      .eq("student_id", placement.student_id)
      .in("scheduled_session_id", sessionIds);

    if (drillError) {
      throw new Error(`Failed to load Trial session logs: ${drillError.message}`);
    }

    loggedSessionIds = new Set(
      (drillRows || []).map((row: any) => String(row.scheduled_session_id || "").trim()).filter(Boolean),
    );
  }

  const { data: reportRows, error: reportError } = await supabase
    .from("parent_reports")
    .select("id, report_type, report_window_key, summary, sent_at")
    .eq("tutor_id", placement.tutor_id)
    .eq("student_id", placement.student_id)
    .gte("sent_at", placement.started_at)
    .order("sent_at", { ascending: true });

  if (reportError) {
    throw new Error(`Failed to load Trial reports: ${reportError.message}`);
  }

  const progress = deriveTrialPlacementProgress({
    placementStartedAt: placement.started_at,
    requiredSessionCount: Number(placement.required_session_count || TRIAL_REQUIRED_SESSIONS_PER_FAMILY),
    sessions: (sessions || []).map((session: any) => ({
      id: String(session.id),
      status: session.status,
      scheduledAt: session.scheduled_time,
      completedAt: session.updated_at,
      hasRequiredLog: loggedSessionIds.has(String(session.id)),
    })),
    reports: (reportRows || []).map(mapReportEvidence).filter(Boolean) as TrialReportEvidence[],
  });

  return {
    id: String(placement.id),
    caseId: String(placement.case_id),
    enrollmentId: String(placement.enrollment_id),
    parentId: String(placement.parent_id),
    studentId: String(placement.student_id),
    familyKey: String(placement.family_key),
    familyName: String(enrollment?.parent_full_name || "Trial family"),
    studentName: String(enrollment?.student_full_name || "Student"),
    status: placement.status,
    feedbackState: placement.feedback_state as TrialFeedbackState,
    feedbackNote: placement.feedback_note || null,
    testimonialPermission: placement.testimonial_permission as TrialTestimonialPermission,
    startedAt: placement.started_at,
    progress,
    review: review
      ? {
          id: String(review.id),
          outcomeClassification: review.outcome_classification as TrialOutcomeClassification,
          decision: review.decision as TrialReviewDecision,
          evidenceNote: String(review.evidence_note),
          reviewedAt: review.reviewed_at,
        }
      : null,
  };
}

async function loadTrialCaseOverview(caseRow: any): Promise<TrialCaseOverview> {
  const { data: placementRows, error: placementsError } = await supabase
    .from("tutor_trial_placements")
    .select("*")
    .eq("case_id", caseRow.id)
    .in("status", ["active", "completed"])
    .order("started_at", { ascending: true });

  if (placementsError) {
    throw new Error(`Failed to load Trial placements: ${placementsError.message}`);
  }

  const placementIds = (placementRows || []).map((placement: any) => String(placement.id));
  let reviews: any[] = [];
  if (placementIds.length > 0) {
    const reviewResult = await supabase
      .from("tutor_trial_reviews")
      .select("*")
      .in("placement_id", placementIds);
    if (reviewResult.error) {
      throw new Error(`Failed to load Trial reviews: ${reviewResult.error.message}`);
    }
    reviews = reviewResult.data || [];
  }
  const reviewByPlacementId = new Map(reviews.map((review: any) => [String(review.placement_id), review]));

  const placements = await Promise.all(
    (placementRows || []).map((placement: any) =>
      loadTrialPlacementOverview(
        { ...placement, tutor_id: caseRow.tutor_id },
        reviewByPlacementId.get(String(placement.id)) || null,
      ),
    ),
  );

  const gate = evaluateTrialCertificationGate({
    placements: placements.map((placement) => ({
      id: placement.id,
      familyKey: placement.familyKey,
      progress: placement.progress,
      feedbackState: placement.feedbackState,
      reviewDecision: placement.review?.decision || null,
    })),
    riskState: caseRow.risk_state as TrialRiskState,
  });

  const { data: decisionRows, error: decisionError } = await supabase
    .from("tutor_certification_decisions")
    .select("id, decision, rationale, decided_at")
    .eq("case_id", caseRow.id)
    .order("decided_at", { ascending: false })
    .limit(1);

  if (decisionError) {
    throw new Error(`Failed to load Trial certification decision: ${decisionError.message}`);
  }

  const persistedStatus = caseRow.status as TrialCaseStatus;
  const effectiveStatus = persistedStatus === "active" && gate.reviewable ? "reviewable" : persistedStatus;
  const certificationDecision = decisionRows?.[0] || null;

  return {
    id: String(caseRow.id),
    tutorId: String(caseRow.tutor_id),
    tutorAssignmentId: String(caseRow.tutor_assignment_id),
    status: effectiveStatus,
    persistedStatus,
    riskState: caseRow.risk_state as TrialRiskState,
    riskNote: caseRow.risk_note || null,
    startedAt: caseRow.started_at,
    reviewableAt: caseRow.reviewable_at || null,
    closedAt: caseRow.closed_at || null,
    placements,
    familyPlacementCount: placements.length,
    gate,
    certificationDecision: certificationDecision
      ? {
          id: String(certificationDecision.id),
          decision: certificationDecision.decision as TrialCertificationDecision,
          rationale: String(certificationDecision.rationale),
          decidedAt: certificationDecision.decided_at,
        }
      : null,
  };
}

export async function getOpenTrialCaseForTutor(tutorId: string): Promise<TrialCaseOverview | null> {
  const { data, error } = await supabase
    .from("tutor_trial_cases")
    .select("*")
    .eq("tutor_id", tutorId)
    .in("status", OPEN_TRIAL_CASE_STATUSES)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load tutor Trial case: ${error.message}`);
  return data ? loadTrialCaseOverview(data) : null;
}

export async function getTrialCaseById(caseId: string): Promise<TrialCaseOverview | null> {
  const { data, error } = await supabase
    .from("tutor_trial_cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load Trial case: ${error.message}`);
  return data ? loadTrialCaseOverview(data) : null;
}

export async function createTrialCase(input: {
  tutorId: string;
  tutorAssignmentId: string;
  createdByUserId?: string | null;
}) {
  const existing = await getOpenTrialCaseForTutor(input.tutorId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("tutor_trial_cases")
    .insert({
      id: uuidv4(),
      tutor_id: input.tutorId,
      tutor_assignment_id: input.tutorAssignmentId,
      status: "active",
      risk_state: "clear",
      created_by_user_id: input.createdByUserId || null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (String(error.message || "").toLowerCase().includes("uq_tutor_trial_cases_open_tutor")) {
      const concurrentlyCreated = await getOpenTrialCaseForTutor(input.tutorId);
      if (concurrentlyCreated) return concurrentlyCreated;
    }
    throw new Error(`Failed to create tutor Trial case: ${error.message}`);
  }

  return loadTrialCaseOverview(data);
}

export async function createTrialPlacement(input: {
  caseId: string;
  enrollmentId: string;
  parentId: string;
  studentId: string;
  familyKey: string;
  createdByUserId: string;
}) {
  const { data: existing } = await supabase
    .from("tutor_trial_placements")
    .select("id")
    .eq("case_id", input.caseId)
    .eq("enrollment_id", input.enrollmentId)
    .in("status", ["active", "completed"])
    .maybeSingle();
  if (existing) return { case: await getTrialCaseById(input.caseId), created: false };

  const { error } = await supabase.from("tutor_trial_placements").insert({
    id: uuidv4(),
    case_id: input.caseId,
    enrollment_id: input.enrollmentId,
    parent_id: input.parentId,
    student_id: input.studentId,
    family_key: input.familyKey,
    status: "active",
    required_session_count: TRIAL_REQUIRED_SESSIONS_PER_FAMILY,
    created_by_user_id: input.createdByUserId,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Failed to create Trial family placement: ${error.message}`);
  return { case: await getTrialCaseById(input.caseId), created: true };
}

export async function removeTrialPlacementCreatedDuringFailedAssignment(caseId: string, enrollmentId: string) {
  await supabase
    .from("tutor_trial_placements")
    .delete()
    .eq("case_id", caseId)
    .eq("enrollment_id", enrollmentId)
    .eq("status", "active");
}

export async function recordTrialFeedback(input: {
  placementId: string;
  parentId: string;
  feedbackState: Extract<TrialFeedbackState, "received" | "declined">;
  feedbackNote?: string | null;
  testimonialPermission?: TrialTestimonialPermission;
}) {
  const { data: placement, error: placementError } = await supabase
    .from("tutor_trial_placements")
    .select("id, case_id, parent_id")
    .eq("id", input.placementId)
    .eq("parent_id", input.parentId)
    .maybeSingle();
  if (placementError || !placement) throw new Error("Trial placement not found for this parent");

  const { error } = await supabase
    .from("tutor_trial_placements")
    .update({
      feedback_state: input.feedbackState,
      feedback_note: input.feedbackNote?.trim() || null,
      feedback_recorded_at: new Date().toISOString(),
      testimonial_permission: input.testimonialPermission || "not_requested",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.placementId);
  if (error) throw new Error(`Failed to record Trial feedback: ${error.message}`);

  return getTrialCaseById(placement.case_id);
}

export async function recordTrialReview(input: {
  placementId: string;
  outcomeClassification: TrialOutcomeClassification;
  decision: TrialReviewDecision;
  evidenceNote: string;
  reviewedByUserId: string;
}) {
  const { data: placement, error: placementError } = await supabase
    .from("tutor_trial_placements")
    .select("id, case_id")
    .eq("id", input.placementId)
    .maybeSingle();
  if (placementError || !placement) throw new Error("Trial placement not found");

  const overview = await getTrialCaseById(placement.case_id);
  const placementOverview = overview?.placements.find((entry) => entry.id === input.placementId);
  if (!placementOverview) throw new Error("Trial placement evidence could not be loaded");
  if (!placementOverview.progress.evidenceComplete) {
    throw new Error("Nine qualifying sessions and all required deterministic reports are required before review");
  }
  if (placementOverview.feedbackState === "pending") {
    throw new Error("Family feedback must be received or formally declined before outcome review");
  }
  if (input.decision === "positive" && input.outcomeClassification !== "positive") {
    throw new Error("A positive decision requires a positive outcome classification");
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("tutor_trial_reviews").upsert({
    id: placementOverview.review?.id || uuidv4(),
    placement_id: input.placementId,
    outcome_classification: input.outcomeClassification,
    decision: input.decision,
    evidence_note: input.evidenceNote.trim(),
    reviewed_by_user_id: input.reviewedByUserId,
    reviewed_at: nowIso,
    updated_at: nowIso,
  }, { onConflict: "placement_id" });
  if (error) throw new Error(`Failed to record Trial outcome review: ${error.message}`);

  const refreshed = await getTrialCaseById(placement.case_id);
  if (refreshed?.gate.reviewable && refreshed.persistedStatus !== "reviewable") {
    await supabase
      .from("tutor_trial_cases")
      .update({ status: "reviewable", reviewable_at: nowIso, updated_at: nowIso })
      .eq("id", placement.case_id)
      .in("status", ["active", "remediation_required"]);
    return getTrialCaseById(placement.case_id);
  }
  return refreshed;
}

export async function getParentTrialCase(parentId: string) {
  const { data: placement, error } = await supabase
    .from("tutor_trial_placements")
    .select("id, case_id")
    .eq("parent_id", parentId)
    .in("status", ["active", "completed"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load family Trial placement: ${error.message}`);
  if (!placement) return null;

  const overview = await getTrialCaseById(placement.case_id);
  if (!overview) return null;
  return {
    ...overview,
    placements: overview.placements.filter((entry) => entry.id === String(placement.id)),
    familyPlacementCount: 1,
  };
}

export async function decideTrialCase(input: {
  caseId: string;
  decision: TrialCertificationDecision;
  rationale: string;
  idempotencyKey: string;
  decidedByUserId: string;
}) {
  const overview = await getTrialCaseById(input.caseId);
  if (!overview) throw new Error("Trial case not found");
  if (input.decision === "certified" && !overview.gate.reviewable) {
    throw new Error(`Certification gate is blocked: ${overview.gate.blockers.join(" ")}`);
  }

  const { data, error } = await supabase.rpc("decide_tutor_trial_case", {
    p_case_id: input.caseId,
    p_decision: input.decision,
    p_rationale: input.rationale.trim(),
    p_idempotency_key: input.idempotencyKey,
    p_decided_by_user_id: input.decidedByUserId,
  });
  if (error) throw new Error(`Failed to record Trial certification decision: ${error.message}`);

  return { decisionId: data, case: await getTrialCaseById(input.caseId) };
}
