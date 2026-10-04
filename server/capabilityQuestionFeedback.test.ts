import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityQuestionDefinition } from "@shared/capabilityEngine";

process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";

const { resolveQuestionFeedback } = await import("./capabilityEngine");

const question: CapabilityQuestionDefinition = {
  key: "authority_split",
  competencyKey: "transformation.authority_split",
  deepDiveKey: "transformation",
  prompt: "Which statements correctly describe the authority split?",
  kind: "multi_select",
  options: [
    { key: "a", label: "Wrong A" },
    { key: "b", label: "Correct B" },
    { key: "c", label: "Correct C" },
    { key: "d", label: "Wrong D" },
    { key: "e", label: "Correct E" },
  ],
  correctOptionKeys: ["b", "c", "e"],
  criticalFailOptionKeys: [],
  explanation: "Complete Truth.",
  optionFeedback: {
    a: "Software alone does not create authority.",
    b: "Supported. Context can inform service decisions without becoming state authority.",
    c: "Supported. RI-OS applies shared rules to qualifying evidence.",
    d: "A personal impression cannot override the recorded evidence.",
    e: "Supported. The Specialist owns accurate execution, observation, and recording.",
  },
};

test("incomplete multi-select feedback does not reveal missed correct-option teaching", () => {
  const feedback = resolveQuestionFeedback(question, ["c"], false);

  assert.equal(
    feedback,
    "You got one selection right, but there are 2 more options that also apply.",
  );
  assert.doesNotMatch(feedback, /Supported/i);
  assert.doesNotMatch(feedback, /Context can inform/i);
  assert.doesNotMatch(feedback, /Specialist owns/i);
});

test("incomplete multi-select feedback explains selected wrong options only", () => {
  const feedback = resolveQuestionFeedback(question, ["c", "d"], false);

  assert.match(feedback, /one of your selections does not apply/i);
  assert.match(feedback, /personal impression cannot override/i);
  assert.doesNotMatch(feedback, /Supported/i);
  assert.doesNotMatch(feedback, /Context can inform/i);
  assert.doesNotMatch(feedback, /Specialist owns/i);
});

test("fully correct multi-select still returns the approved Truth", () => {
  assert.equal(
    resolveQuestionFeedback(question, ["b", "c", "e"], true),
    "Complete Truth.",
  );
});
