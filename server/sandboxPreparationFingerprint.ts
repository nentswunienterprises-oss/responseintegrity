import { createHash } from "node:crypto";

/** A fingerprint of the exact server-prescribed first Sandbox Training rep.
 * It is a stale-plan guard, never a replacement for Specialist assignment or
 * scheduled-session authorization, which the server checks independently. */
export function sandboxPreparationFingerprint(input: {
  trajectoryId: string;
  sessionNumber: number;
  bankVersion: number;
  eventFormId: string;
  prescribedPhase: string;
  setId: string;
  constraints: Record<string, unknown>;
}): string {
  const sortedConstraints = Object.fromEntries(
    Object.entries(input.constraints).sort(([a], [b]) => a.localeCompare(b)),
  );
  return createHash("sha256").update(JSON.stringify([
    input.trajectoryId,
    input.sessionNumber,
    input.bankVersion,
    input.eventFormId,
    input.prescribedPhase,
    input.setId,
    sortedConstraints,
  ])).digest("hex");
}
