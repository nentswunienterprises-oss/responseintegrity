/**
 * Practicals is a protected operational stage, not an automatic Sandbox graduation.
 * An assigned TD's readiness decision is only authoritative for the exact
 * approved capability policy and private Sandbox bank they actually assessed.
 *
 * Do not infer permission from a prior "passed" record after the bank or policy
 * changes. Historical TD signoffs remain as evidence but are not entry authority.
 */
export type PracticalReadinessSnapshot = {
  practicalsReady?: boolean | null;
  policyStatus?: string | null;
  policyVersion?: number | null;
  bankKey?: string | null;
  bankVersion?: number | null;
};
export type PracticalTdSignoff = {
  decision?: string | null;
  capabilitySnapshot?: PracticalReadinessSnapshot | null;
};
export type PracticalEntryGateInput = {
  operationalMode: string | null | undefined;
  assignedTdId: string | null | undefined;
  latestAssignedTdSignoff: PracticalTdSignoff | null;
  currentReadiness: PracticalReadinessSnapshot;
};

function validVersion(input: unknown) {
  return typeof input === "number" && Number.isInteger(input) && input > 0;
}

export function evaluatePracticalEntryGate(input: PracticalEntryGateInput) {
  const blockers: string[] = [];
  const readiness = input.currentReadiness;
  const signoff = input.latestAssignedTdSignoff;
  const approvedSnapshot = signoff?.capabilitySnapshot;

  if (input.operationalMode !== "sandbox") {
    blockers.push("The Specialist is not in Sandbox.");
  }
  if (!input.assignedTdId) {
    blockers.push("The Specialist is missing an assigned TD.");
  }
  if (signoff?.decision !== "passed") {
    blockers.push("Latest version-2 assigned-TD Practicals-readiness approval is missing.");
  }
  if (readiness.policyStatus !== "approved") {
    blockers.push("Sandbox capability policy has not been approved for Practicals progression.");
  }
  if (readiness.practicalsReady !== true) {
    blockers.push("Current Sandbox capability evidence is not ready.");
  }
  if (approvedSnapshot?.practicalsReady !== true) {
    blockers.push("TD sign-off lacks positive Sandbox capability evidence.");
  }

  const authoritativeLineage = Boolean(
    readiness.bankKey &&
    validVersion(readiness.bankVersion) &&
    validVersion(readiness.policyVersion) &&
    approvedSnapshot?.bankKey === readiness.bankKey &&
    approvedSnapshot?.bankVersion === readiness.bankVersion &&
    approvedSnapshot?.policyVersion === readiness.policyVersion &&
    approvedSnapshot?.policyStatus === "approved",
  );
  if (signoff?.decision === "passed" && !authoritativeLineage) {
    blockers.push("TD readiness sign-off is missing or mismatched against the current Sandbox bank and approved policy version.");
  }

  return { ready: blockers.length === 0, blockers };
}
