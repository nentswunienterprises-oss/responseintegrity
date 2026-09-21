export const QUALIFICATION_STATUSES = ["pending", "contact_required", "contacted", "follow_up", "qualified", "not_qualified"] as const;
export type QualificationStatus = typeof QUALIFICATION_STATUSES[number];
export type EntryType = "pending" | "pilot" | "commercial";

export function demandAssignmentBlock(enrollment: any): string | null {
  if (!enrollment) return "Enrollment not found";
  // Only migration-marked legacy records and explicitly synthetic Sandbox accounts are exempt.
  if (enrollment.demand_flow_version === 0 || enrollment.is_sandbox_account === true) return null;
  if (enrollment.demand_flow_version !== 1) return "Demand Production evidence is unavailable";
  if (enrollment.qualification_status !== "qualified" || !enrollment.qualification_completed_at || !enrollment.qualification_decided_by) {
    return "Qualification must be completed before assignment";
  }
  if (!enrollment.entry_selected_at || !enrollment.entry_selected_by) return "Select Pilot or Commercial before assignment";
  if (!enrollment.handover_completed_at || !enrollment.handover_from_user_id || !enrollment.handover_to_user_id) {
    return "Complete the transfer of responsibility before assignment";
  }
  return null;
}

export function handoverSla(enrollment: any, now = new Date()) {
  if (enrollment?.qualification_status !== "qualified" || !enrollment.qualification_completed_at) return { status: "not_measurable", hours: null };
  const start = Date.parse(enrollment.qualification_completed_at);
  const end = enrollment.handover_completed_at ? Date.parse(enrollment.handover_completed_at) : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return { status: "not_measurable", hours: null };
  const hours = (end - start) / 3_600_000;
  return { status: hours > 24 ? "breached" : enrollment.handover_completed_at ? "within_standard" : "pending", hours };
}

export function resolveEntryType(parent: any): EntryType | null {
  const value = parent?.onboarding_type;
  return value === "pilot" || value === "commercial" || value === "pending" ? value : null;
}
