/**
 * Read-only presentation of a three-level stability and a separate progression gate.
 * Legacy High Maintenance can still be read from historical records; new state
 * stores High plus an explicit progression authority field.
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
  progressionAuthority?: unknown,
): string | null {
  if (progressionAuthority === "transfer_maintenance") return "Transfer maintenance active";
  if (progressionAuthority === "building") return null;
  if (progressionAuthority !== "exit_confirmation_eligible" && !hasPhaseConfirmationCheckpoint(stability)) return null;
  return phase === "Time Pressure Stability"
    ? "Transfer evidence must be confirmed"
    : "Phase-exit confirmation required";
}

export function topicStabilityConfirmationExplanation(
  stability: unknown,
  phase?: unknown,
  progressionAuthority?: unknown,
): string | null {
  if (progressionAuthority === "transfer_maintenance") return "Final-phase exit confirmation was recorded. Maintain capability and continue testing transfer under separate evidence.";
  if (progressionAuthority === "building") return null;
  if (progressionAuthority !== "exit_confirmation_eligible" && !hasPhaseConfirmationCheckpoint(stability)) return null;
  return phase === "Time Pressure Stability"
    ? "A high-stability checkpoint is recorded. Maintain timed performance and verify transfer separately; the checkpoint alone does not authorize a transfer claim."
    : "A high-stability checkpoint is recorded. The current phase remains in place until a separate, later qualifying exit confirmation is supported by evidence.";
}
