import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPABILITY_PRACTICAL_PROOFS,
  deriveCapabilityPracticalReview,
  snapshotCapabilityPracticalRubric,
  validateCapabilityPracticalRubric,
  type CapabilityPracticalCriterionReviewInput,
  type CapabilityPracticalReviewRubric,
} from "./capabilityPracticalEvidence";
import { SANDBOX_MOCK_CRITERIA } from "./sandboxReadiness";

test("V1 defines exactly the three approved practical proofs", () => {
  assert.deepEqual(
    CAPABILITY_PRACTICAL_PROOFS.map((proof) => proof.key),
    ["prepare", "execute", "evidence"],
  );
});

test("every practical proof is versioned, sandbox-only and carries an anchored review rubric", () => {
  for (const proof of CAPABILITY_PRACTICAL_PROOFS) {
    assert.equal(proof.version, 1);
    assert.equal(proof.realStudentDataAllowed, false);
    assert.ok(proof.mustShow.length >= 5);
    assert.ok(proof.declarationPrompts.length >= 3);
    assert.ok(proof.competencyLinks.length >= 3);
    assert.ok(proof.declarationPrompts.every((prompt) => prompt.minLength >= 30));
    assert.doesNotThrow(() => validateCapabilityPracticalRubric(proof.reviewRubric));
    assert.equal(proof.reviewRubric.version, 1);
    assert.equal(proof.reviewRubric.outcomeRuleVersion, 1);
    assert.ok(proof.reviewRubric.criteria.length >= 5);
    assert.ok(proof.reviewRubric.criteria.every((criterion) => criterion.sandboxMockCriteria.length >= 1));
    assert.ok(
      proof.reviewRubric.criteria
        .filter((criterion) => criterion.criticalOnFail)
        .every((criterion) => criterion.criticalBoundaryLinks.length >= 1),
    );
  }
});

test("three practical rubrics collectively prepare all five authoritative Sandbox Mock criteria", () => {
  const covered = new Set(
    CAPABILITY_PRACTICAL_PROOFS.flatMap((proof) =>
      proof.reviewRubric.criteria.flatMap((criterion) => criterion.sandboxMockCriteria),
    ),
  );
  assert.deepEqual(
    Array.from(covered).sort(),
    SANDBOX_MOCK_CRITERIA.map((criterion) => criterion.key).sort(),
  );
});

test("Prepare and Evidence require a screen-based artifact rather than talking-head video alone", () => {
  const prepare = CAPABILITY_PRACTICAL_PROOFS.find((proof) => proof.key === "prepare");
  const evidence = CAPABILITY_PRACTICAL_PROOFS.find((proof) => proof.key === "evidence");
  assert.ok(prepare);
  assert.ok(evidence);
  assert.equal(prepare.requiredArtifactTypes.includes("video"), false);
  assert.equal(evidence.requiredArtifactTypes.includes("video"), false);
  assert.ok(prepare.requiredArtifactTypes.includes("screen_voice"));
  assert.ok(evidence.requiredArtifactTypes.includes("screen_voice"));
});

test("Execute requires visible demonstration and does not accept audio-over-screen alone", () => {
  const execute = CAPABILITY_PRACTICAL_PROOFS.find((proof) => proof.key === "execute");
  assert.ok(execute);
  assert.equal(execute.requiredArtifactTypes.includes("screen_voice"), false);
  assert.ok(execute.requiredArtifactTypes.includes("screen_video"));
  assert.ok(execute.requiredArtifactTypes.includes("video"));
});

function judgments(
  rubric: CapabilityPracticalReviewRubric,
  judgment: CapabilityPracticalCriterionReviewInput["judgment"] = "clear",
): CapabilityPracticalCriterionReviewInput[] {
  return rubric.criteria.map((criterion) => ({
    criterionKey: criterion.key,
    judgment,
    evidenceNote: judgment === "clear" ? null : `Observed evidence for ${criterion.key} needs correction before responsibility is released.`,
  }));
}

test("all explicit Clear judgments deterministically approve practical evidence", () => {
  const proof = CAPABILITY_PRACTICAL_PROOFS[0];
  const result = deriveCapabilityPracticalReview(proof.reviewRubric, judgments(proof.reviewRubric));
  assert.equal(result.outcome, "approved");
  assert.equal(result.reasonCode, "rubric_clear");
  assert.equal(result.clearCount, proof.reviewRubric.criteria.length);
  assert.equal(result.partialCount, 0);
  assert.equal(result.failCount, 0);
  assert.equal(result.criticalFailCount, 0);
});

test("any Partial judgment requires a repeat even when every other criterion is Clear", () => {
  const proof = CAPABILITY_PRACTICAL_PROOFS[0];
  const review = judgments(proof.reviewRubric);
  review[0] = {
    criterionKey: proof.reviewRubric.criteria[0].key,
    judgment: "partial",
    evidenceNote: "The case state was mostly correct, but one material session-context detail was not resolved.",
  };
  const result = deriveCapabilityPracticalReview(proof.reviewRubric, review);
  assert.equal(result.outcome, "repeat_required");
  assert.equal(result.reasonCode, "rubric_repeat_required");
  assert.equal(result.partialCount, 1);
});

test("ordinary Fail requires repeat while critical Fail escalates integrity review", () => {
  const proof = CAPABILITY_PRACTICAL_PROOFS[0];
  const ordinaryCriterion = proof.reviewRubric.criteria.find((criterion) => !criterion.criticalOnFail);
  const criticalCriterion = proof.reviewRubric.criteria.find((criterion) => criterion.criticalOnFail);
  assert.ok(ordinaryCriterion);
  assert.ok(criticalCriterion);

  const ordinary = judgments(proof.reviewRubric);
  ordinary[proof.reviewRubric.criteria.indexOf(ordinaryCriterion)] = {
    criterionKey: ordinaryCriterion.key,
    judgment: "fail",
    evidenceNote: "The demonstrated preparation materially missed the observable standard and must be repeated.",
  };
  assert.equal(deriveCapabilityPracticalReview(proof.reviewRubric, ordinary).outcome, "repeat_required");

  const critical = judgments(proof.reviewRubric);
  critical[proof.reviewRubric.criteria.indexOf(criticalCriterion)] = {
    criterionKey: criticalCriterion.key,
    judgment: "fail",
    evidenceNote: "The Specialist explicitly crossed the stated integrity boundary in the recorded demonstration.",
  };
  const result = deriveCapabilityPracticalReview(proof.reviewRubric, critical);
  assert.equal(result.outcome, "integrity_review");
  assert.equal(result.reasonCode, "rubric_critical_fail");
  assert.deepEqual(result.criticalFailCriterionKeys, [criticalCriterion.key]);
});

test("rubric review fails closed on missing judgments, duplicate judgments and undocumented Partial/Fail", () => {
  const proof = CAPABILITY_PRACTICAL_PROOFS[0];
  const complete = judgments(proof.reviewRubric);

  assert.throws(
    () => deriveCapabilityPracticalReview(proof.reviewRubric, complete.slice(1)),
    /Expected .* practical rubric judgments/,
  );
  assert.throws(
    () => deriveCapabilityPracticalReview(proof.reviewRubric, [...complete.slice(0, -1), complete[0]]),
    /Duplicate practical rubric judgment/,
  );

  const undocumented = [...complete];
  undocumented[0] = {
    criterionKey: proof.reviewRubric.criteria[0].key,
    judgment: "partial",
    evidenceNote: "too short",
  };
  assert.throws(
    () => deriveCapabilityPracticalReview(proof.reviewRubric, undocumented),
    /requires at least 20 characters of evidence/,
  );
});

test("rubric snapshots are detached from the live definition", () => {
  const proof = CAPABILITY_PRACTICAL_PROOFS[0];
  const snapshot = snapshotCapabilityPracticalRubric(proof.reviewRubric);
  assert.deepEqual(snapshot, proof.reviewRubric);
  assert.notEqual(snapshot, proof.reviewRubric);
  assert.notEqual(snapshot.criteria, proof.reviewRubric.criteria);
});
