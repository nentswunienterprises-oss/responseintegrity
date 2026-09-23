import test from "node:test";
import assert from "node:assert/strict";
import { resolveResponseEvidenceDimension } from "./responseEvidenceModel";

test("one clean observation cannot erase an earlier breakdown", () => {
  const result = resolveResponseEvidenceDimension({
    minimumValidOpportunities: 2,
    evidence: [
      { evidenceClass: "breakdown" as const },
      { evidenceClass: "supported" as const },
      { evidenceClass: "supported" as const },
    ],
  });
  assert.equal(result.state, "CONDITIONAL");
  assert.equal(result.recoverySupportedRequirement, 3);
});

test("breakdown recovery requires one extra clean confirmation", () => {
  const result = resolveResponseEvidenceDimension({
    minimumValidOpportunities: 2,
    evidence: [
      { evidenceClass: "breakdown" as const },
      { evidenceClass: "supported" as const },
      { evidenceClass: "supported" as const },
      { evidenceClass: "supported" as const },
    ],
  });
  assert.equal(result.state, "SUPPORTED");
  assert.equal(result.recoveredAfterBreakdown, true);
});

test("unobserved and confounded evidence cannot create authority", () => {
  const result = resolveResponseEvidenceDimension({
    minimumValidOpportunities: 2,
    evidence: [
      { evidenceClass: "not_observed" as const },
      { evidenceClass: "confounded" as const },
    ],
  });
  assert.equal(result.state, "UNRESOLVED");
  assert.equal(result.validOpportunityCount, 0);
});
