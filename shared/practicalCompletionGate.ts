/**
 * Practicals completion is historical, immutable evidence.
 * Permission to OPEN Trial is a separate current-time readiness judgment.
 *
 * A legitimate operating-mode transition from Sandbox to Trial must never
 * erase a prior assigned-TD Practicals completion record.
 */
export type PracticalCompletionProof = {
  key: string;
  version: number;
  evidenceId: string | null;
  status: string;
};

export type PracticalCompletionDecision = {
  decision: string;
  proof_evidence_ids: Record<string, string | null> | null;
};

export function derivePracticalCompletionGate(input: {
  entryReady: boolean;
  proofs: readonly PracticalCompletionProof[];
  tdDecision?: PracticalCompletionDecision | null;
}) {
  const allApproved = input.proofs.length === 3 &&
    new Set(input.proofs.map(p => p.key)).size === 3 &&
    input.proofs.every(p => p.status === "approved" && !!p.evidenceId);
  const evidenceMatches = allApproved && input.proofs.every(p =>
    input.tdDecision?.proof_evidence_ids?.[p.key] === p.evidenceId,
  );
  const complete = !!(evidenceMatches && input.tdDecision?.decision === "approved");

  return {
    allApproved,
    complete,
    readyForTDCompletionReview: !!(input.entryReady && allApproved),
    readyForTrial: !!(input.entryReady && complete),
  };
}
