export const SPECIALIST_PATHWAY_STANDARD_DAYS = 75;
export const SPECIALIST_PATHWAY_MAXIMUM_DAYS = 90;

export type SpecialistPathwayStatus = "active" | "completed" | "expired" | "exited";
export type SpecialistPathwayTimelineState =
  | "standard_active"
  | "extension_required"
  | "extension_active"
  | "expired"
  | "completed"
  | "exited";

export interface SpecialistDevelopmentPathwayOverview {
  id: string;
  tutorId: string;
  applicationId: string | null;
  tutorAssignmentId: string | null;
  status: SpecialistPathwayStatus;
  startedAt: string;
  standardEndsAt: string;
  maximumEndsAt: string;
  extensionApprovedAt: string | null;
  extensionReason: string | null;
  completedAt: string | null;
  timeline: ReturnType<typeof deriveSpecialistPathwayTimeline>;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function addUtcDays(value: string | Date, days: number) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("A valid pathway date is required.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function deriveSpecialistPathwayTimeline({
  status,
  startedAt,
  standardEndsAt,
  maximumEndsAt,
  extensionApprovedAt,
  now = new Date().toISOString(),
}: {
  status: SpecialistPathwayStatus;
  startedAt: string;
  standardEndsAt?: string | null;
  maximumEndsAt?: string | null;
  extensionApprovedAt?: string | null;
  now?: string;
}) {
  const start = parseTime(startedAt);
  if (start == null) throw new Error("A valid pathway start date is required.");

  const standardEndIso = standardEndsAt || addUtcDays(startedAt, SPECIALIST_PATHWAY_STANDARD_DAYS);
  const maximumEndIso = maximumEndsAt || addUtcDays(startedAt, SPECIALIST_PATHWAY_MAXIMUM_DAYS);
  const standardEnd = parseTime(standardEndIso)!;
  const maximumEnd = parseTime(maximumEndIso)!;
  const nowTime = parseTime(now) ?? Date.now();
  const extensionApproved = parseTime(extensionApprovedAt) != null;
  const effectiveEnd = extensionApproved ? maximumEnd : standardEnd;

  let state: SpecialistPathwayTimelineState;
  if (status === "completed") state = "completed";
  else if (status === "exited") state = "exited";
  else if (nowTime >= maximumEnd) state = "expired";
  else if (nowTime >= standardEnd && !extensionApproved) state = "extension_required";
  else if (extensionApproved) state = "extension_active";
  else state = "standard_active";

  const elapsedDays = Math.max(0, Math.floor((nowTime - start) / (24 * 60 * 60 * 1000)));
  const remainingMs = Math.max(0, effectiveEnd - nowTime);

  return {
    state,
    standardEndsAt: standardEndIso,
    maximumEndsAt: maximumEndIso,
    effectiveEndsAt: extensionApproved ? maximumEndIso : standardEndIso,
    elapsedDays,
    daysRemaining: Math.ceil(remainingMs / (24 * 60 * 60 * 1000)),
    extensionApproved,
    canApproveExtension:
      status === "active" && !extensionApproved && nowTime < maximumEnd,
    canContinue:
      status === "active" && nowTime < effectiveEnd,
  };
}
