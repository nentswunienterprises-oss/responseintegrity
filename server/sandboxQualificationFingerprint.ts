import { createHash } from "node:crypto";
import type { SandboxQualificationEvidence } from "../shared/sandboxQualificationPolicy";

// Bind approval to every qualification input, including coverage and lineage.
// Object key order, event query order and situation-tag order are not evidence changes.
export function sandboxQualificationEvidenceFingerprint(
  policyId: string,
  policyVersion: number,
  events: SandboxQualificationEvidence[],
) {
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]));
    }
    return value;
  }
  const evidence = events.map(event => ({
    ...event,
    situationTags: [...event.situationTags].sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify(canonical({
    fingerprintVersion: 2, policyId, policyVersion, evidence,
  }))).digest("hex");
}
