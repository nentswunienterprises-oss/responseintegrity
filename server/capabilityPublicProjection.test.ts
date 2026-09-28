import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityAssessmentDefinition } from "@shared/capabilityEngine";
import { evaluateCapabilityAssessment } from "@shared/capabilityEngine";
import {
  projectCapabilityAssessmentForSpecialist,
  projectCapabilityAttemptResultForSpecialist,
} from "./capabilityPublicProjection";

const definition: CapabilityAssessmentDefinition = {
  key: "synthetic_mastery",
  deepDiveKey: "clarity",
  title: "**Synthetic Mastery** Check",
  evidenceKind: "mastery",
  passThresholdPercent: 96,
  questions: Array.from({ length: 15 }, (_, index) => ({
    key: `synthetic_q${index + 1}`,
    competencyKey: "clarity.phase_purpose",
    deepDiveKey: "clarity",
    prompt: `**Synthetic prompt** ${index + 1}`,
    kind: "single_choice" as const,
    options: [
      { key: "a", label: "**Option A**" },
      { key: "b", label: "Option B" },
      { key: "c", label: "Option C" },
      { key: "d", label: "Option D" },
    ],
    correctOptionKeys: ["b"],
    criticalFailOptionKeys: index === 0 ? ["a"] : [],
    explanation: "Private-style explanation fixture.",
    optionFeedback: {
      a: "Private wrong-option feedback fixture.",
      b: "Private correct-option feedback fixture.",
    },
    criticalBoundaryKeys: index === 0 ? ["clarity.synthetic_internal_boundary"] : [],
  })),
};

function perfectResponses() {
  return definition.questions.map((question) => ({
    questionKey: question.key,
    selectedOptionKeys: [...question.correctOptionKeys],
  }));
}

test("Specialist assessment projection exposes prompts/options but no scoring or boundary secrets", () => {
  const projected = projectCapabilityAssessmentForSpecialist({
    definition,
    formId: "form-proof-1",
    bankVersion: 8,
    attemptNumber: 1,
    maxAttempts: 3,
  });
  const serialized = JSON.stringify(projected);

  assert.equal(projected.questions.length, definition.questions.length);
  assert.equal(projected.title, "Synthetic Mastery Check");
  assert.equal(projected.questions[0]?.prompt, "Synthetic prompt 1");
  assert.equal(projected.questions[0]?.options[0]?.label, "Option A");
  assert.doesNotMatch(serialized, /\*\*/);
  assert.match(serialized, /Synthetic Mastery Check/);
  assert.doesNotMatch(serialized, /"correctOptionKeys"\s*:/);
  assert.doesNotMatch(serialized, /"criticalFailOptionKeys"\s*:/);
  assert.doesNotMatch(serialized, /"criticalBoundaryKeys"\s*:/);
  assert.doesNotMatch(serialized, /synthetic_internal_boundary/);
  assert.doesNotMatch(serialized, /"explanation"\s*:/);
  assert.doesNotMatch(serialized, /"optionFeedback"\s*:/);
  assert.doesNotMatch(serialized, /Private wrong-option feedback fixture/);
  assert.doesNotMatch(serialized, /Private correct-option feedback fixture/);
  assert.doesNotMatch(serialized, /"competencyKey"\s*:/);
});

test("Specialist result projection exposes outcome but not answer or question-level internals", () => {
  const result = evaluateCapabilityAssessment(definition, perfectResponses());
  const projected = projectCapabilityAttemptResultForSpecialist({
    attemptId: "attempt-proof-1",
    completedAt: "2026-09-24T15:00:00Z",
    bankVersion: 8,
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
