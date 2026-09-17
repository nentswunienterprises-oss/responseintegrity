import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_PRACTICAL_PROOFS } from "./capabilityPracticalEvidence";

test("practical rubric anchors remain observation-led and do not require motive inference", () => {
  const rubricText = CAPABILITY_PRACTICAL_PROOFS.flatMap((proof) =>
    proof.reviewRubric.criteria.flatMap((criterion) => [
      criterion.observableStandard,
      criterion.clearAnchor,
      criterion.partialAnchor,
      criterion.failAnchor,
    ]),
  ).join(" ");

  assert.doesNotMatch(rubricText, /\bknowingly\b/i);
  assert.doesNotMatch(rubricText, /\bintent(?:ion|ional|ionally)?\b/i);
  assert.doesNotMatch(rubricText, /\bmotivation\b/i);
});

test("critical practical criteria always expose observable canonical boundary lineage", () => {
  for (const proof of CAPABILITY_PRACTICAL_PROOFS) {
    for (const criterion of proof.reviewRubric.criteria.filter((entry) => entry.criticalOnFail)) {
      assert.ok(
        criterion.criticalBoundaryLinks.length > 0,
        `${proof.key}:${criterion.key} must retain canonical critical-boundary lineage`,
      );
    }
  }
});
