import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCapabilityAssessment } from "./capabilityEngine";
import { CLARITY_MASTERY_ASSESSMENT } from "./capabilityAssessments";

function buildCorrectResponses() {
  return CLARITY_MASTERY_ASSESSMENT.questions.map((question) => ({
    questionKey: question.key,
    selectedOptionKeys: [...question.correctOptionKeys],
  }));
}

test("clarity mastery passes at 100% with no critical fail", () => {
  const result = evaluateCapabilityAssessment(CLARITY_MASTERY_ASSESSMENT, buildCorrectResponses());
  assert.equal(result.totalQuestions, 15);
  assert.equal(result.correctQuestions, 15);
  assert.equal(result.percent, 100);
  assert.equal(result.hasCriticalFail, false);
  assert.equal(result.mastered, true);
});

test("one incorrect answer misses the 96% mastery threshold", () => {
  const responses = buildCorrectResponses();
  const question = CLARITY_MASTERY_ASSESSMENT.questions[0];
  const wrongOption = question.options.find((option) => !question.correctOptionKeys.includes(option.key));
  assert.ok(wrongOption);
  responses[0] = { questionKey: question.key, selectedOptionKeys: [wrongOption.key] };

  const result = evaluateCapabilityAssessment(CLARITY_MASTERY_ASSESSMENT, responses);
  assert.equal(result.correctQuestions, 14);
  assert.equal(result.percent, 93.33);
  assert.equal(result.mastered, false);
});

test("critical-fail endorsement overrides an otherwise strong attempt", () => {
  const responses = buildCorrectResponses();
  const questionIndex = CLARITY_MASTERY_ASSESSMENT.questions.findIndex(
    (question) => question.key === "clarity_contamination_05"
  );
  assert.notEqual(questionIndex, -1);
  responses[questionIndex] = {
    questionKey: "clarity_contamination_05",
    selectedOptionKeys: ["a"],
  };

  const result = evaluateCapabilityAssessment(CLARITY_MASTERY_ASSESSMENT, responses);
  assert.equal(result.hasCriticalFail, true);
  assert.deepEqual(result.criticalFailQuestionKeys, ["clarity_contamination_05"]);
  assert.equal(result.mastered, false);
});

test("missing responses are rejected", () => {
  const responses = buildCorrectResponses().slice(0, -1);
  assert.throws(
    () => evaluateCapabilityAssessment(CLARITY_MASTERY_ASSESSMENT, responses),
    /Expected 15 capability responses/
  );
});

test("duplicate responses are rejected", () => {
  const responses = buildCorrectResponses();
  responses[14] = { ...responses[0] };
  assert.throws(
    () => evaluateCapabilityAssessment(CLARITY_MASTERY_ASSESSMENT, responses),
    /Duplicate capability response/
  );
});
