/**
 * A separate, fail-closed Sandbox graduation qualification gate.
 * No numeric clean-window threshold is assumed or silently inferred from
 * the older capability breadth policy. The policy must be explicitly approved.
 */
export type SandboxCleanWindowPolicy = {
  version: number;
  status: "candidate" | "approved";
  requiredConsecutiveSessions: number;
  requiredPhases: string[];
  requiredSituationTags: string[];
};

export type SandboxSessionEvidence = {
  id: string;
  sessionNumber: number;
  phase: string;
  situationTags: string[];
  authorityAligned: boolean | null;
  stateTrackAligned: boolean | null;
  observationExact: boolean | null;
  evidenceExact: boolean | null;
  complete: boolean;
  truthPresent: boolean;
};

export type SandboxCleanWindowResult = {
  qualified: boolean;
  completeCleanSessions: number;
  requiredCleanSessions: number | null;
  cleanSessionIds: string[];
  missingPhases: string[];
  missingSituations: string[];
  reason: string;
};

export function evaluateSandboxCleanWindow(
  policy: SandboxCleanWindowPolicy | null,
  chronological: SandboxSessionEvidence[],
): SandboxCleanWindowResult {
  const blocked = (reason: string): SandboxCleanWindowResult => ({
    qualified: false, completeCleanSessions: 0, requiredCleanSessions: policy?.requiredConsecutiveSessions ?? null,
    cleanSessionIds: [], missingPhases: policy?.requiredPhases || [],
    missingSituations: policy?.requiredSituationTags || [], reason,
  });
  if (!policy || policy.status !== "approved") return blocked("Founder-approved Sandbox clean-window policy is not available.");
  if (!Number.isInteger(policy.version) || policy.version < 1 ||
      !Number.isInteger(policy.requiredConsecutiveSessions) || policy.requiredConsecutiveSessions < 2 ||
      !Array.isArray(policy.requiredPhases) || policy.requiredPhases.length === 0 ||
      !Array.isArray(policy.requiredSituationTags) || policy.requiredSituationTags.length === 0) {
    return blocked("Approved clean-window policy is invalid or incomplete.");
  }
  const rows = [...chronological].sort((a,b) => a.sessionNumber - b.sessionNumber);
  const seen = new Set<number>();
  for (const row of rows) {
    if (!Number.isInteger(row.sessionNumber) || seen.has(row.sessionNumber)) return blocked("Duplicate or invalid session-number evidence.");
    seen.add(row.sessionNumber);
  }
  // Only the terminal contiguous clean streak qualifies; earlier successes
  // cannot be cherry-picked around a later material error.
  const tail: SandboxSessionEvidence[] = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!row.complete || !row.truthPresent ||
        row.authorityAligned !== true || row.stateTrackAligned !== true ||
        row.observationExact !== true || row.evidenceExact !== true) break;
    if (tail.length && tail[0].sessionNumber !== row.sessionNumber + 1) break;
    tail.unshift(row);
  }
  const selected = tail.slice(-policy.requiredConsecutiveSessions);
  const phases = new Set(selected.map(row => row.phase));
  const situations = new Set(selected.flatMap(row => row.situationTags));
  const missingPhases = policy.requiredPhases.filter(v => !phases.has(v));
  const missingSituations = policy.requiredSituationTags.filter(v => !situations.has(v));
  const qualified = selected.length >= policy.requiredConsecutiveSessions &&
    missingPhases.length === 0 && missingSituations.length === 0;
  return {
    qualified, completeCleanSessions: tail.length,
    requiredCleanSessions: policy.requiredConsecutiveSessions,
    cleanSessionIds: selected.map(v => v.id), missingPhases, missingSituations,
    reason: qualified
      ? "Final consecutive Sandbox evidence has zero decision-relevant divergence and required coverage."
      : "Sandbox graduation blocked: clean consecutive evidence or mandatory situation coverage is incomplete.",
  };
}
