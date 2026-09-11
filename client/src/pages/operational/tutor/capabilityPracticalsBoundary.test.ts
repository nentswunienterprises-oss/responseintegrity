import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const specialistSource = fs.readFileSync(new URL("./capability-practicals.tsx", import.meta.url), "utf8");
const reviewerSource = fs.readFileSync(new URL("../capability-practical-review.tsx", import.meta.url), "utf8");
const standaloneSource = fs.readFileSync(new URL("../../../capabilityStandaloneApp.tsx", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../../../main.tsx", import.meta.url), "utf8");

test("Specialist practical workspace is reference-first and never uploads video bytes", () => {
  assert.match(specialistSource, /artifactUrl/);
  assert.match(specialistSource, /HTTPS review link/);
  assert.doesNotMatch(specialistSource, /FileReader/);
  assert.doesNotMatch(specialistSource, /FormData/);
  assert.doesNotMatch(specialistSource, /type="file"/);
});

test("Specialist must explicitly confirm sandbox-only evidence", () => {
  assert.match(specialistSource, /noRealStudentDataConfirmed: true/);
  assert.match(specialistSource, /contains no real student, parent or family data/);
  assert.match(specialistSource, /!sandboxConfirmed \|\| !selectedRubric/);
});

test("Specialist UI blocks resubmission while evidence is pending, approved or under integrity review", () => {
  assert.match(specialistSource, /latest\?\.status === "submitted"/);
  assert.match(specialistSource, /latest\?\.status === "approved"/);
  assert.match(specialistSource, /latest\?\.status === "integrity_review"/);
  assert.match(specialistSource, /latest\.status === "repeat_required"/);
});

test("Specialist sees the same observable rubric anchors before recording", () => {
  assert.match(specialistSource, /getCapabilityPracticalProofDefinition/);
  assert.match(specialistSource, /How this will be judged/);
  assert.match(specialistSource, /Approved requires every criterion to be Clear/);
  assert.match(specialistSource, /criterion\.observableStandard/);
  assert.match(specialistSource, /criterion\.clearAnchor/);
  assert.match(specialistSource, /criterion\.partialAnchor/);
  assert.match(specialistSource, /criterion\.failAnchor/);
  assert.doesNotMatch(specialistSource, /criticalBoundaryLinks/);
  assert.doesNotMatch(specialistSource, /competencyLinks/);
});

test("reviewer UI starts every criterion unjudged and offers only Clear Partial Fail judgments", () => {
  assert.match(reviewerSource, /judgment: CapabilityPracticalCriterionJudgment \| ""/);
  assert.match(reviewerSource, /judgment: "", evidenceNote: ""/);
  assert.match(reviewerSource, /\["clear", "partial", "fail"\]/);
  assert.match(reviewerSource, /No criterion defaults to Clear/);
  assert.doesNotMatch(reviewerSource, />Approve</);
  assert.doesNotMatch(reviewerSource, /setOutcome/);
});

test("reviewer UI requires observation notes for every Partial or Fail judgment", () => {
  assert.match(reviewerSource, /draft\.evidenceNote\.trim\(\)\.length >= 20/);
  assert.match(reviewerSource, /Every Partial or Fail judgment needs at least 20 characters/);
  assert.match(reviewerSource, /Name the exact behavior in the recording that supports this judgment/);
});

test("reviewer UI derives an outcome preview but posts only rubric judgments to the server", () => {
  assert.match(reviewerSource, /deriveCapabilityPracticalReview\(selected\.reviewRubric, criterionJudgments\)/);
  assert.match(reviewerSource, /Derived outcome:/);
  assert.match(reviewerSource, /rubricVersion: selected\.rubricVersion/);
  assert.match(reviewerSource, /criterionJudgments,/);
  assert.doesNotMatch(reviewerSource, /outcome,/);
  assert.doesNotMatch(reviewerSource, /reasonCode:/);
  assert.match(reviewerSource, /Record immutable rubric review/);
});

test("integrity-critical criteria are visible to reviewers without making outcome selectable", () => {
  assert.match(reviewerSource, /criterion\.criticalOnFail/);
  assert.match(reviewerSource, /Integrity-critical if Fail/);
  assert.match(reviewerSource, /At least one integrity-critical criterion is explicitly Fail/);
});

test("practical Specialist and reviewer routes are isolated from the central router", () => {
  assert.match(standaloneSource, /\/operational\/specialist\/capability-practicals/);
  assert.match(standaloneSource, /\/operational\/capability-review\/practicals/);
  assert.match(mainSource, /currentPath === "\/operational\/specialist\/capability-practicals"/);
  assert.match(mainSource, /currentPath === "\/operational\/capability-review\/practicals"/);
});
