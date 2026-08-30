export const TRIAL_REQUIRED_FAMILIES = 2;
export const TRIAL_REQUIRED_SESSIONS_PER_FAMILY = 9;

export type TrialCaseStatus =
  | "active"
  | "reviewable"
  | "certified"
  | "remediation_required"
  | "unsuccessful";

export type TrialRiskState = "clear" | "watchlist" | "remediation" | "suspended";
export type TrialFeedbackState = "pending" | "received" | "declined";
export type TrialTestimonialPermission = "not_requested" | "granted" | "declined";
export type TrialOutcomeClassification = "positive" | "mixed" | "negative";
export type TrialReviewDecision = "positive" | "remediation_required" | "unsuccessful";
export type TrialCertificationDecision = "certified" | "remediation_required" | "unsuccessful";

export interface TrialSessionEvidence {
  id: string;
  status: string | null | undefined;
  scheduledAt: string | null | undefined;
  completedAt?: string | null;
  hasRequiredLog: boolean;
}

export interface TrialReportEvidence {
  id: string;
  reportType: "weekly" | "monthly";
  reportWindowKey?: string | null;
  sourceSessionIds: string[];
}

export interface TrialPlacementProgress {
  requiredSessionCount: number;
  completedSessionCount: number;
  loggedSessionCount: number;
  qualifyingSessionCount: number;
  qualifyingSessionIds: string[];
  missingLogCount: number;
  weeklyReportsRequired: number;
  weeklyReportsComplete: number;
  monthlyReportsRequired: number;
  monthlyReportsComplete: number;
  reportsComplete: boolean;
  evidenceComplete: boolean;
}

export interface TrialPlacementGateInput {
  id: string;
  familyKey: string;
  progress: TrialPlacementProgress;
  feedbackState: TrialFeedbackState;
  reviewDecision: TrialReviewDecision | null;
}

export interface TrialCertificationGateResult {
  reviewable: boolean;
  blockers: string[];
}

export interface TrialPlacementOverview {
  id: string;
  caseId: string;
  enrollmentId: string;
  parentId: string;
  studentId: string;
  familyKey: string;
  familyName: string;
  studentName: string;
  status: "active" | "completed" | "ended";
  feedbackState: TrialFeedbackState;
  feedbackNote: string | null;
  testimonialPermission: TrialTestimonialPermission;
  startedAt: string;
  progress: TrialPlacementProgress;
  review: {
    id: string;
    outcomeClassification: TrialOutcomeClassification;
    decision: TrialReviewDecision;
    evidenceNote: string;
    reviewedAt: string;
  } | null;
}

export interface TrialCaseOverview {
  id: string;
  tutorId: string;
  tutorAssignmentId: string;
  status: TrialCaseStatus;
  persistedStatus: TrialCaseStatus;
  riskState: TrialRiskState;
  riskNote: string | null;
  startedAt: string;
  reviewableAt: string | null;
  closedAt: string | null;
  placements: TrialPlacementOverview[];
  familyPlacementCount: number;
  gate: TrialCertificationGateResult;
  certificationDecision: {
    id: string;
    decision: TrialCertificationDecision;
    rationale: string;
    decidedAt: string;
  } | null;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function countCoveringReports(
  reports: TrialReportEvidence[],
  reportType: TrialReportEvidence["reportType"],
  qualifyingSessionIds: Set<string>,
) {
  const keys = new Set<string>();

  for (const report of reports) {
    if (report.reportType !== reportType) continue;
    if (!report.sourceSessionIds.some((sessionId) => qualifyingSessionIds.has(sessionId))) continue;
    keys.add(report.reportWindowKey || report.id);
  }

  return keys.size;
}

export function deriveTrialPlacementProgress({
  placementStartedAt,
  requiredSessionCount = TRIAL_REQUIRED_SESSIONS_PER_FAMILY,
  sessions,
  reports,
}: {
  placementStartedAt: string;
  requiredSessionCount?: number;
  sessions: TrialSessionEvidence[];
  reports: TrialReportEvidence[];
}): TrialPlacementProgress {
  const placementStart = parseTime(placementStartedAt);
  const uniqueCompletedSessions = new Map<string, TrialSessionEvidence>();

  for (const session of sessions) {
    const scheduledAt = parseTime(session.scheduledAt);
    const completedAt = parseTime(session.completedAt) ?? scheduledAt;
    if (String(session.status || "").trim().toLowerCase() !== "completed") continue;
    if (placementStart != null && (scheduledAt == null || scheduledAt < placementStart)) continue;

    const existing = uniqueCompletedSessions.get(session.id);
    const existingTime = existing ? (parseTime(existing.completedAt) ?? parseTime(existing.scheduledAt) ?? 0) : null;
    if (existingTime == null || (completedAt ?? 0) < existingTime) {
      uniqueCompletedSessions.set(session.id, session);
    }
  }

  const orderedCompletedSessions = [...uniqueCompletedSessions.values()].sort((left, right) => {
    const leftTime = parseTime(left.completedAt) ?? parseTime(left.scheduledAt) ?? 0;
    const rightTime = parseTime(right.completedAt) ?? parseTime(right.scheduledAt) ?? 0;
    return leftTime - rightTime || left.id.localeCompare(right.id);
  });
  const sessionsInsideBoundary = orderedCompletedSessions.slice(0, requiredSessionCount);
  const loggedSessions = sessionsInsideBoundary.filter((session) => session.hasRequiredLog);
  const qualifyingSessions = loggedSessions.slice(0, requiredSessionCount);
  const qualifyingSessionIds = new Set(qualifyingSessions.map((session) => session.id));
  const qualifyingSessionCount = qualifyingSessions.length;
  const weeklyReportsRequired = Math.floor(requiredSessionCount / 2);
  const monthlyReportsRequired = Math.floor(requiredSessionCount / 8);
  const weeklyReportsComplete = countCoveringReports(reports, "weekly", qualifyingSessionIds);
  const monthlyReportsComplete = countCoveringReports(reports, "monthly", qualifyingSessionIds);
  const reportsComplete =
    weeklyReportsComplete >= weeklyReportsRequired && monthlyReportsComplete >= monthlyReportsRequired;

  return {
    requiredSessionCount,
    completedSessionCount: sessionsInsideBoundary.length,
    loggedSessionCount: loggedSessions.length,
    qualifyingSessionCount,
    qualifyingSessionIds: [...qualifyingSessionIds],
    missingLogCount: sessionsInsideBoundary.length - loggedSessions.length,
    weeklyReportsRequired,
    weeklyReportsComplete,
    monthlyReportsRequired,
    monthlyReportsComplete,
    reportsComplete,
    evidenceComplete: qualifyingSessionCount >= requiredSessionCount && reportsComplete,
  };
}

export function evaluateTrialCertificationGate({
  placements,
  riskState,
}: {
  placements: TrialPlacementGateInput[];
  riskState: TrialRiskState;
}): TrialCertificationGateResult {
  const blockers: string[] = [];
  const distinctFamilies = new Set(placements.map((placement) => placement.familyKey));

  if (placements.length !== TRIAL_REQUIRED_FAMILIES || distinctFamilies.size !== TRIAL_REQUIRED_FAMILIES) {
    blockers.push("Exactly two distinct trial families must be placed.");
  }

  placements.forEach((placement, index) => {
    const label = `Family ${index + 1}`;
    if (placement.progress.qualifyingSessionCount < placement.progress.requiredSessionCount) {
      blockers.push(
        `${label} has ${placement.progress.qualifyingSessionCount}/${placement.progress.requiredSessionCount} qualifying sessions.`,
      );
    }
    if (!placement.progress.reportsComplete) {
      blockers.push(`${label} is missing required deterministic reports.`);
    }
    if (placement.feedbackState === "pending") {
      blockers.push(`${label} feedback must be received or formally declined.`);
    }
    if (placement.reviewDecision !== "positive") {
      blockers.push(`${label} does not have a positive COO outcome review.`);
    }
  });

  if (riskState !== "clear") {
    blockers.push(`The trial case has an unresolved ${riskState} condition.`);
  }

  return { reviewable: blockers.length === 0, blockers };
}
