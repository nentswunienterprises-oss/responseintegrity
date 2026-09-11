import assert from "node:assert/strict";
import test from "node:test";
import { buildCapabilityLedger, evaluateCapabilityAssessment, type CapabilityAssessmentDefinition } from "./capabilityEngine";
import { CLARITY_MASTERY_ASSESSMENT } from "./capabilityAssessments";
import { CLARITY_RETRIEVAL_ASSESSMENT } from "./capabilityAssessmentsRetrieval";
import { STRUCTURED_EXECUTION_MASTERY_ASSESSMENT } from "./capabilityAssessmentsStructuredExecution";
import { CLARITY_STRUCTURED_TRANSFER_ASSESSMENT } from "./capabilityAssessmentsTransfer";

function buildCorrectResponses(definition: CapabilityAssessmentDefinition) {
  return definition.questions.map((question) => ({
    questionKey: question.key,
    selectedOptionKeys: [...question.correctOptionKeys],
  }));
}

function evaluatePerfect(definition: CapabilityAssessmentDefinition) {
  return evaluateCapabilityAssessment(definition, buildCorrectResponses(definition));
}

test("clarity mastery passes at 100% and is typed as mastery evidence", () => {
  const result = evaluatePerfect(CLARITY_MASTERY_ASSESSMENT);
  assert.equal(result.totalQuestions, 15);
  assert.equal(result.correctQuestions, 15);
  assert.equal(result.percent, 100);
  assert.equal(result.evidenceKind, "mastery");
  assert.deepEqual(result.coveredDeepDiveKeys, ["clarity"]);
  assert.equal(result.hasCriticalFail, false);
  assert.equal(result.passed, true);
});

test("one incorrect answer misses the 96% threshold", () => {
  const responses = buildCorrectResponses(CLARITY_MASTERY_ASSESSMENT);
  const question = CLARITY_MASTERY_ASSESSMENT.questions[0];
  const wrongOption = question.options.find((option) => !question.correctOptionKeys.includes(option.key));
  assert.ok(wrongOption);
  responses[0] = { questionKey: question.key, selectedOptionKeys: [wrongOption.key] };

  const result = evaluateCapabilityAssessment(CLARITY_MASTERY_ASSESSMENT, responses);
  assert.equal(result.correctQuestions, 14);
  assert.equal(result.percent, 93.33);
  assert.equal(result.passed, false);
});

test("critical-fail endorsement overrides an otherwise strong attempt", () => {
  const responses = buildCorrectResponses(CLARITY_MASTERY_ASSESSMENT);
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
  assert.equal(result.passed, false);
});

test("retrieval evidence is distinct from mastery evidence", () => {
  const result = evaluatePerfect(CLARITY_RETRIEVAL_ASSESSMENT);
  assert.equal(result.evidenceKind, "retrieval");
  assert.equal(result.passed, true);
  assert.deepEqual(result.coveredDeepDiveKeys, ["clarity"]);
});

test("Structured Execution mastery is a deterministic 15-question proof", () => {
  const result = evaluatePerfect(STRUCTURED_EXECUTION_MASTERY_ASSESSMENT);
  assert.equal(result.totalQuestions, 15);
  assert.equal(result.evidenceKind, "mastery");
  assert.equal(result.passed, true);
  assert.deepEqual(result.coveredDeepDiveKeys, ["structured_execution"]);
});

test("interleaved transfer mixes Deep Dive lineage without naming the tested phases in prompts", () => {
  for (const question of CLARITY_STRUCTURED_TRANSFER_ASSESSMENT.questions) {
    assert.doesNotMatch(question.prompt, /Clarity|Structured Execution/i);
    assert.ok(question.deepDiveKey === "clarity" || question.deepDiveKey === "structured_execution");
  }

  const result = evaluatePerfect(CLARITY_STRUCTURED_TRANSFER_ASSESSMENT);
  assert.equal(result.evidenceKind, "transfer");
  assert.equal(result.passed, true);
  assert.deepEqual(result.coveredDeepDiveKeys, ["clarity", "structured_execution"]);
});

test("missing responses are rejected", () => {
  const responses = buildCorrectResponses(CLARITY_MASTERY_ASSESSMENT).slice(0, -1);
  assert.throws(
    () => evaluateCapabilityAssessment(CLARITY_MASTERY_ASSESSMENT, responses),
    /Expected 15 capability responses/
  );
});

test("duplicate responses are rejected", () => {
  const responses = buildCorrectResponses(CLARITY_MASTERY_ASSESSMENT);
  responses[14] = { ...responses[0] };
  assert.throws(
    () => evaluateCapabilityAssessment(CLARITY_MASTERY_ASSESSMENT, responses),
    /Duplicate capability response/
  );
});

test("capability ledger keeps mastery retrieval and transfer as independent evidence", () => {
  const clarityMastery = evaluatePerfect(CLARITY_MASTERY_ASSESSMENT);
  const clarityRetrieval = evaluatePerfect(CLARITY_RETRIEVAL_ASSESSMENT);
  const structuredMastery = evaluatePerfect(STRUCTURED_EXECUTION_MASTERY_ASSESSMENT);
  const transfer = evaluatePerfect(CLARITY_STRUCTURED_TRANSFER_ASSESSMENT);

  const ledger = buildCapabilityLedger([
    { attemptId: "m1", assessmentKey: clarityMastery.assessmentKey, evidenceKind: clarityMastery.evidenceKind, passed: clarityMastery.passed, completedAt: "2026-09-11T09:00:00Z", questionResults: clarityMastery.questionResults },
    { attemptId: "r1", assessmentKey: clarityRetrieval.assessmentKey, evidenceKind: clarityRetrieval.evidenceKind, passed: clarityRetrieval.passed, completedAt: "2026-09-12T09:00:00Z", questionResults: clarityRetrieval.questionResults },
    { attemptId: "m2", assessmentKey: structuredMastery.assessmentKey, evidenceKind: structuredMastery.evidenceKind, passed: structuredMastery.passed, completedAt: "2026-09-13T09:00:00Z", questionResults: structuredMastery.questionResults },
    { attemptId: "t1", assessmentKey: transfer.assessmentKey, evidenceKind: transfer.evidenceKind, passed: transfer.passed, completedAt: "2026-09-14T09:00:00Z", questionResults: transfer.questionResults },
  ]);

  const clarity = ledger.deepDives.find((entry) => entry.deepDiveKey === "clarity");
  const structured = ledger.deepDives.find((entry) => entry.deepDiveKey === "structured_execution");
  assert.ok(clarity);
  assert.ok(structured);

  assert.equal(clarity.evidence.mastery.passedAttempts, 1);
  assert.equal(clarity.evidence.retrieval.passedAttempts, 1);
  assert.equal(clarity.evidence.transfer.passedAttempts, 1);
  assert.equal(structured.evidence.mastery.passedAttempts, 1);
  assert.equal(structured.evidence.transfer.passedAttempts, 1);

  const structureCompetency = structured.competencies.find(
    (entry) => entry.competencyKey === "structured_execution.required_structure"
  );
  assert.ok(structureCompetency);
  assert.equal(structureCompetency.evidence.mastery.correctOnPassedAttempt, true);
  assert.equal(structureCompetency.evidence.transfer.correctOnPassedAttempt, true);
});

test("approved practical evidence supports linked competencies without becoming a quiz pass", () => {
  const ledger = buildCapabilityLedger([], [
    {
      evidenceId: "practical-1",
      proofKey: "prepare",
      proofVersion: 1,
      attemptNumber: 1,
      status: "approved",
      submittedAt: "2026-09-15T09:00:00Z",
      reviewedAt: "2026-09-15T11:00:00Z",
      competencyLinks: [
        { deepDiveKey: "clarity", competencyKey: "system.authority" },
        { deepDiveKey: "structured_execution", competencyKey: "structured_execution.phase_boundary" },
      ],
    },
  ]);

  const clarity = ledger.deepDives.find((entry) => entry.deepDiveKey === "clarity");
  const structured = ledger.deepDives.find((entry) => entry.deepDiveKey === "structured_execution");
  assert.ok(clarity);
  assert.ok(structured);
  assert.equal(clarity.practical.approvedSubmissions, 1);
  assert.equal(clarity.evidence.mastery.passedAttempts, 0);
  assert.equal(structured.practical.approvedSubmissions, 1);

  const authority = clarity.competencies.find((entry) => entry.competencyKey === "system.authority");
  assert.ok(authority);
  assert.equal(authority.practical.approvedEvidence, true);
  assert.deepEqual(authority.practical.proofKeys, ["prepare"]);
  assert.equal(ledger.practicalProofs[0].status, "approved");
});

test("repeat-required practical evidence stays visible but does not become approved capability", () => {
  const ledger = buildCapabilityLedger([], [
    {
      evidenceId: "practical-2",
      proofKey: "execute",
      proofVersion: 1,
      attemptNumber: 1,
      status: "repeat_required",
      submittedAt: "2026-09-16T09:00:00Z",
      reviewedAt: "2026-09-16T10:00:00Z",
      competencyLinks: [
        { deepDiveKey: "structured_execution", competencyKey: "structured_execution.independent_execution" },
      ],
    },
  ]);

  const structured = ledger.deepDives.find((entry) => entry.deepDiveKey === "structured_execution");
  assert.ok(structured);
  assert.equal(structured.practical.submissions, 1);
  assert.equal(structured.practical.approvedSubmissions, 0);
  const independence = structured.competencies.find((entry) => entry.competencyKey === "structured_execution.independent_execution");
  assert.ok(independence);
  assert.equal(independence.practical.approvedEvidence, false);
});
