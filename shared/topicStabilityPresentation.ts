/**
 * Presentation-only projection of the legacy, evidence-bearing topic stability.
 *
 * High Maintenance remains a distinct persisted progression checkpoint.
 * Do not use this label for grading, phase transitions or writes.
 */
export function hasPhaseConfirmationCheckpoint(value: unknown): boolean {
  return typeof value === "string" &&
    /^\s*high[\s_-]+maintenance\s*$/i.test(value);
}

export function displayTopicStability(value: unknown): string {
  if (hasPhaseConfirmationCheckpoint(value)) return "High";
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || "Unknown";
}

/**
 * Explicitly distinguish the progression checkpoint from ordinary High.
 * A displayed checkpoint is not authorization to advance or transfer.
 */
export function topicStabilityConfirmationLabel(
  stability: unknown,
  phase?: unknown,
): string | null {
  if (!hasPhaseConfirmationCheckpoint(stability)) return null;
  return phase === "Time Pressure Stability"
    ? "Transfer evidence must be confirmed"
    : "Phase-exit confirmation required";
}

export function topicStabilityConfirmationExplanation(
  stability: unknown,
  phase?: unknown,
): string | null {
  if (!hasPhaseConfirmationCheckpoint(stability)) return null;
  return phase === "Time Pressure Stability"
    ? "A high-stability checkpoint is recorded. Maintain timed performance and verify transfer separately; the checkpoint alone does not authorize a transfer claim."
    : "A high-stability checkpoint is recorded. The current phase remains in place until a separate, later qualifying exit confirmation is supported by evidence.";
}
