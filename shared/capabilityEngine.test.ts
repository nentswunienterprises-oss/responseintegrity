import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCapabilityLedger,
  evaluateCapabilityAssessment,
  type CapabilityAssessmentDefinition,
} from "./capabilityEngine";

const OPTIONS = [
  { key: "a", label: "Synthetic distractor A" },
  { key: "b", label: "Synthetic correct option" },
  { key: "c", label: "Synthetic distractor C" },
  { key: "d", label: "Synthetic distractor D" },
];

function assessment(input: {
  key: string;
  deepDiveKey: string;
  evidenceKind?: "mastery" | "retrieval" | "transfer";
  secondDeepDiveKey?: string;
}): CapabilityAssessmentDefinition {
  const kind = input.evidenceKind || "mastery";
  const clarityCompetencies = [
    "clarity.phase_purpose",
    "clarity.recognition_boundary",
    "clarity.light_apply_support",
    "clarity.vmr_sequence",
    "clarity.identification_set",
  ];
  const structuredCompetencies = [
    "structured_execution.phase_purpose",
    "structured_execution.required_structure",
    "structured_execution.independent_execution",
    "structured_execution.variation_control",
    "structured_execution.constraints",
  ];

  return {
    key: input.key,
    deepDiveKey: input.secondDeepDiveKey ? "mixed" : input.deepDiveKey,
    title: "Synthetic Capability Fixture",
    evidenceKind: kind,
    passThresholdPercent: 96,
    questions: Array.from({ length: 15 }, (_, index) => {
      const useSecond = Boolean(input.secondDeepDiveKey && index % 2 === 1);
      const deepDiveKey = useSecond ? input.secondDeepDiveKey! : input.deepDiveKey;
      const competencyPool =
        deepDiveKey === "structured_execution" ? structuredCompetencies : clarityCompetencies;
      return {
        key: `${input.key}_q${index + 1}`,
        competencyKey: competencyPool[index % competencyPool.length],
        deepDiveKey,
        prompt: `Synthetic operating scenario ${index + 1}`,
        kind: "single_choice" as const,
        options: OPTIONS,
        correctOptionKeys: ["b"],
        criticalFailOptionKeys: index === 0 ? ["a"] : [],
        explanation: "Synthetic explanation used only for engine tests.",
      };
    }),
  };
}

const clarityMastery = assessment({
  key: "clarity_mastery_fixture",
  deepDiveKey: "clarity",
});
const clarityRetrieval = assessment({
  key: "clarity_retrieval_fixture",
  deepDiveKey: "clarity",
  evidenceKind: "retrieval",
});
const structuredMastery = assessment({
  key: "structured_mastery_fixture",
  deepDiveKey: "structured_execution",
});
const transfer = assessment({
  key: "transfer_fixture",
  deepDiveKey: "clarity",
  secondDeepDiveKey: "structured_execution",
  evidenceKind: "transfer",
});

function correctResponses(definition: CapabilityAssessmentDefinition) {
  return definition.questions.map((question) => ({
    questionKey: question.key,
    selectedOptionKeys: [...question.correctOptionKeys],
  }));
}

function perfect(definition: CapabilityAssessmentDefinition) {
  return evaluateCapabilityAssessment(definition, correctResponses(definition));
}

test("mastery passes at 100% and preserves evidence identity", () => {
  const result = perfect(clarityMastery);
  assert.equal(result.totalQuestions, 15);
  assert.equal(result.correctQuestions, 15);
  assert.equal(result.percent, 100);
  assert.equal(result.evidenceKind, "mastery");
  assert.deepEqual(result.coveredDeepDiveKeys, ["clarity"]);
  assert.equal(result.passed, true);
});

test("one incorrect answer misses the 96% threshold", () => {
  const responses = correctResponses(clarityMastery);
  responses[0] = { questionKey: clarityMastery.questions[0].key, selectedOptionKeys: ["c"] };
  const result = evaluateCapabilityAssessment(clarityMastery, responses);
  assert.equal(result.correctQuestions, 14);
  assert.equal(result.percent, 93.33);
  assert.equal(result.passed, false);
});

test("critical-fail endorsement overrides an otherwise strong attempt", () => {
  const responses = correctResponses(clarityMastery);
  responses[0] = { questionKey: clarityMastery.questions[0].key, selectedOptionKeys: ["a"] };
  const result = evaluateCapabilityAssessment(clarityMastery, responses);
  assert.equal(result.hasCriticalFail, true);
  assert.deepEqual(result.criticalFailQuestionKeys, [clarityMastery.questions[0].key]);
  assert.equal(result.passed, false);
});

test("retrieval and transfer stay distinct from mastery evidence", () => {
  assert.equal(perfect(clarityRetrieval).evidenceKind, "retrieval");
  const transferResult = perfect(transfer);
  assert.equal(transferResult.evidenceKind, "transfer");
  assert.deepEqual(transferResult.coveredDeepDiveKeys, ["clarity", "structured_execution"]);
});

test("missing and duplicate responses are rejected", () => {
  assert.throws(
    () => evaluateCapabilityAssessment(clarityMastery, correctResponses(clarityMastery).slice(0, -1)),
    /Expected 15 capability responses/,
  );
  const duplicate = correctResponses(clarityMastery);
  duplicate[14] = { ...duplicate[0] };
  assert.throws(
    () => evaluateCapabilityAssessment(clarityMastery, duplicate),
    /Duplicate capability response/,
  );
});

test("ledger keeps mastery retrieval and transfer evidence independent", () => {
  const m1 = perfect(clarityMastery);
  const r1 = perfect(clarityRetrieval);
  const m2 = perfect(structuredMastery);
  const t1 = perfect(transfer);

  const ledger = buildCapabilityLedger([
    { attemptId: "m1", assessmentKey: m1.assessmentKey, evidenceKind: m1.evidenceKind, passed: true, completedAt: "2026-09-24T09:00:00Z", questionResults: m1.questionResults },
    { attemptId: "r1", assessmentKey: r1.assessmentKey, evidenceKind: r1.evidenceKind, passed: true, completedAt: "2026-09-24T10:00:00Z", questionResults: r1.questionResults },
    { attemptId: "m2", assessmentKey: m2.assessmentKey, evidenceKind: m2.evidenceKind, passed: true, completedAt: "2026-09-24T11:00:00Z", questionResults: m2.questionResults },
    { attemptId: "t1", assessmentKey: t1.assessmentKey, evidenceKind: t1.evidenceKind, passed: true, completedAt: "2026-09-24T12:00:00Z", questionResults: t1.questionResults },
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
});
