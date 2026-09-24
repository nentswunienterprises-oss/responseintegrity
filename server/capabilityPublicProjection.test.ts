import assert from "node:assert/strict";
import test from "node:test";
import { CLARITY_MASTERY_ASSESSMENT } from "@shared/capabilityAssessments";
import { evaluateCapabilityAssessment } from "@shared/capabilityEngine";
import {
  projectCapabilityAssessmentForSpecialist,
  projectCapabilityAttemptResultForSpecialist,
} from "./capabilityPublicProjection";

function perfectResponses() {
  return CLARITY_MASTERY_ASSESSMENT.questions.map((question) => ({
    questionKey: question.key,
    selectedOptionKeys: [...question.correctOptionKeys],
  }));
}

test("Specialist assessment projection contains prompts and options but no scoring or boundary secrets", () => {
  const taggedDefinition = {
    ...CLARITY_MASTERY_ASSESSMENT,
    questions: CLARITY_MASTERY_ASSESSMENT.questions.map((question, index) =>
      index === 0
        ? { ...question, criticalBoundaryKeys: ["clarity.internal_boundary"] }
        : question,
    ),
  };
  const projected = projectCapabilityAssessmentForSpecialist({
    definition: taggedDefinition,
    formId: "form-proof-1",
    bankVersion: 1,
    attemptNumber: 1,
    maxAttempts: 3,
  });
  const serialized = JSON.stringify(projected);

  assert.equal(projected.questions.length, CLARITY_MASTERY_ASSESSMENT.questions.length);
  assert.match(serialized, /Clarity Mastery Check/);
  assert.doesNotMatch(serialized, /"correctOptionKeys"\s*:/);
  assert.doesNotMatch(serialized, /"criticalFailOptionKeys"\s*:/);
  assert.doesNotMatch(serialized, /"criticalBoundaryKeys"\s*:/);
  assert.doesNotMatch(serialized, /internal_boundary/);
  assert.doesNotMatch(serialized, /"explanation"\s*:/);
  assert.doesNotMatch(serialized, /"competencyKey"\s*:/);
});

test("Specialist result projection exposes outcome but not answer or question-level internals", () => {
  const result = evaluateCapabilityAssessment(CLARITY_MASTERY_ASSESSMENT, perfectResponses());
  const projected = projectCapabilityAttemptResultForSpecialist({
    attemptId: "attempt-proof-1",
    completedAt: "2026-09-11T15:00:00Z",
    bankVersion: 1,
    attemptNumber: 1,
    formId: "form-proof-1",
    result,
  });
  const serialized = JSON.stringify(projected);

  assert.equal(projected.passed, true);
  assert.equal(projected.percent, 100);
  assert.doesNotMatch(serialized, /"questionResults"\s*:/);
  assert.doesNotMatch(serialized, /"criticalFailQuestionKeys"\s*:/);
  assert.doesNotMatch(serialized, /"correctOptionKeys"\s*:/);
  assert.doesNotMatch(serialized, /"criticalBoundaryKeys"\s*:/);
  assert.doesNotMatch(serialized, /"explanation"\s*:/);
});
