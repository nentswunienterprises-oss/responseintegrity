/**
 * Evidence-native Sandbox V1 to V2 transition gate.
 * The current rep is never fabricated to unlock the next model.
 * Last V1 rep may be an ordinary supported or breakdown observation,
 * but it cannot be one of the retired fictional exception patterns.
 */
export type SandboxBoundaryEvidence = {
  expectedTotalReps: number;
  recordedTotalReps: number;
  pairedPrivateTruthRows: number;
  boundaryReps: number;
  requiredBoundaryReps: number;
  followingSessionReps: number;
  evaluatedSessions: number;
  boundarySessionNumber: number;
  bookedSessionCompletions: number;
  lastEventSequence: number;
  lastOutcomeKey: string;
};

export function sandboxV1ToV2BoundaryReached(input: {
  currentVersion: number;
  planStatus: "pending" | "activated";
  currentSession: number;
  completingSession: number;
}): "not_yet" | "eligible" | "already_active" | "invalid" {
  if (input.currentVersion === 2 && input.planStatus === "activated")
    return "already_active";
  if (input.currentVersion !== 1 || input.planStatus !== "pending")
    return "invalid";
  if (input.currentSession <= input.completingSession)
    return "not_yet";
  return input.currentSession === input.completingSession + 1
    ? "eligible" : "invalid";
}

export function sandboxV1ToV2EvidenceAccepted(input: SandboxBoundaryEvidence): boolean {
  return (
    Number.isInteger(input.expectedTotalReps) &&
    input.recordedTotalReps === input.expectedTotalReps &&
    input.pairedPrivateTruthRows === input.recordedTotalReps &&
    input.boundaryReps === input.requiredBoundaryReps &&
    input.requiredBoundaryReps > 0 &&
    input.followingSessionReps === 0 &&
    input.evaluatedSessions === input.boundarySessionNumber &&
    input.bookedSessionCompletions === 1 &&
    input.lastEventSequence === input.expectedTotalReps &&
    /\.pattern_[1-6]$/.test(input.lastOutcomeKey)
  );
}
