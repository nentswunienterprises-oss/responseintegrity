import assert from "node:assert/strict";
import test from "node:test";
import { createCapabilityFormSeed, generateDeterministicCapabilityForm } from "./capabilityFormGeneration";
import type { CapabilityQuestionDefinition } from "@shared/capabilityEngine";

const config = {
  assessmentKey: "fixture_mastery_v1",
  bankVersion: 3,
  title: "Fixture Mastery",
  assessmentDeepDiveKey: "fixture",
  evidenceKind: "mastery" as const,
  passThresholdPercent: 96,
  formSize: 4,
  maxAttempts: 3,
  retryCooldownHours: 1,
  competencyBlueprint: [
    { competencyKey: "fixture.alpha", deepDiveKey: "fixture", count: 2 },
    { competencyKey: "fixture.beta", deepDiveKey: "fixture", count: 2 },
  ],
};

function item(key: string, competencyKey: string): CapabilityQuestionDefinition {
  return {
    key,
    competencyKey,
    deepDiveKey: "fixture",
    prompt: `Prompt ${key}`,
    kind: "single_choice",
    options: [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ],
    correctOptionKeys: ["a"],
    explanation: "Fixture explanation",
  };
}

const pool = [
  item("alpha_1", "fixture.alpha"),
  item("alpha_2", "fixture.alpha"),
  item("alpha_3", "fixture.alpha"),
  item("alpha_4", "fixture.alpha"),
  item("beta_1", "fixture.beta"),
  item("beta_2", "fixture.beta"),
  item("beta_3", "fixture.beta"),
  item("beta_4", "fixture.beta"),
];

test("same opaque seed produces exactly the same form", () => {
  const first = generateDeterministicCapabilityForm(config, pool, "seed-a");
  const second = generateDeterministicCapabilityForm(config, pool, "seed-a");
  assert.deepEqual(first.itemKeys, second.itemKeys);
  assert.equal(first.formId, second.formId);
});

test("different attempt seeds rotate form selection while preserving blueprint coverage", () => {
  const firstSeed = createCapabilityFormSeed({
    secret: "test-secret",
    tutorAssignmentId: "assignment-1",
    assessmentKey: config.assessmentKey,
    bankVersion: config.bankVersion,
    attemptNumber: 1,
  });
  const secondSeed = createCapabilityFormSeed({
    secret: "test-secret",
    tutorAssignmentId: "assignment-1",
    assessmentKey: config.assessmentKey,
    bankVersion: config.bankVersion,
    attemptNumber: 2,
  });

  const first = generateDeterministicCapabilityForm(config, pool, firstSeed);
  const second = generateDeterministicCapabilityForm(config, pool, secondSeed);

  assert.notDeepEqual(first.itemKeys, second.itemKeys);
  for (const form of [first, second]) {
    assert.equal(form.itemKeys.length, 4);
    assert.equal(form.definition.questions.filter((question) => question.competencyKey === "fixture.alpha").length, 2);
    assert.equal(form.definition.questions.filter((question) => question.competencyKey === "fixture.beta").length, 2);
  }
});

test("generation fails closed when a competency pool cannot satisfy the blueprint", () => {
  assert.throws(
    () => generateDeterministicCapabilityForm(config, pool.filter((entry) => entry.key !== "alpha_2" && entry.key !== "alpha_3" && entry.key !== "alpha_4"), "seed"),
    /does not contain enough items/,
  );
});

test("seed creation requires a server secret", () => {
  assert.throws(
    () => createCapabilityFormSeed({
      secret: "",
      tutorAssignmentId: "assignment-1",
      assessmentKey: config.assessmentKey,
      bankVersion: config.bankVersion,
      attemptNumber: 1,
    }),
    /CAPABILITY_FORM_SECRET/,
  );
});
