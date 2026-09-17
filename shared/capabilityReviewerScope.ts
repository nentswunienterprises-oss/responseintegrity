export type CapabilityReviewerRole = "td" | "coo" | "hr";

export function isCapabilityReviewerRole(value: string): value is CapabilityReviewerRole {
  return value === "td" || value === "coo" || value === "hr";
}

export function canCapabilityReviewerAccessAssignment(input: {
  reviewerId: string;
  reviewerRole: CapabilityReviewerRole;
  assignmentTdId?: string | null;
}) {
  if (input.reviewerRole === "td") {
    return Boolean(input.assignmentTdId && String(input.assignmentTdId) === String(input.reviewerId));
  }
  return true;
}
