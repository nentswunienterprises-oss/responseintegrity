export type TrainingSessionCancellationDisposition =
  | "replacement_required"
  | "closed_consumed"
  | "manual_review";

export type TrainingSessionCancellationActor = "parent" | "tutor";

export function deriveTrainingSessionCancellationDisposition(options: {
  actorRole: TrainingSessionCancellationActor;
  reasonCodes?: string[] | null;
  eventType?: string | null;
  billingImpact?: string | null;
}): TrainingSessionCancellationDisposition {
  const reasonCodes = new Set(
    (options.reasonCodes || [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
  const eventType = String(options.eventType || "").trim();
  const billingImpact = String(options.billingImpact || "").trim();

  // A consumed family credit closes the delivery obligation. Creating a
  // replacement automatically would silently reverse the cancellation policy.
  if (
    billingImpact === "consume" ||
    eventType === "cancelled_late_parent" ||
    eventType === "no_show_parent"
  ) {
    return "closed_consumed";
  }

  // Schedule conflict is a reschedule concern, not a terminal cancellation.
  // This branch exists for already-recorded legacy cancellations only; current
  // clients/server reject schedule_conflict as a cancellation reason.
  if (reasonCodes.has("schedule_conflict")) {
    return "replacement_required";
  }

  // Early family cancellations preserve the package obligation.
  if (eventType === "cancelled_early_parent") {
    return "replacement_required";
  }

  // Response Integrity-side cancellations ordinarily preserve delivery. A
  // Specialist cancelling on behalf of a parent is different, so old records
  // that lack parent-timing classification are held for manual review.
  if (
    eventType === "cancelled_early_tutor" ||
    eventType === "cancelled_late_tutor" ||
    eventType === "no_show_tutor" ||
    billingImpact === "restore"
  ) {
    return reasonCodes.has("parent_requested_cancellation")
      ? "manual_review"
      : "replacement_required";
  }

  return "manual_review";
}

export function cancellationNeedsReplacement(
  disposition: TrainingSessionCancellationDisposition | null | undefined,
) {
  return disposition === "replacement_required";
}
