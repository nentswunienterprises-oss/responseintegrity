import assert from "node:assert/strict";
import test from "node:test";
import {
  createCapabilityFormSeed,
  generateDeterministicCapabilityForm,
  type CapabilityBoundaryTaggedQuestion,
} from "./capabilityFormGeneration";

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

function item(
  key: string,
  competencyKey: string,
  deepDiveKey = "fixture",
  criticalBoundaryKeys: string[] = [],
): CapabilityBoundaryTaggedQuestion {
  return {
    key,
    competencyKey,
    deepDiveKey,
    prompt: `Prompt ${key}`,
    kind: "single_choice",
    options: [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ],
    correctOptionKeys: ["a"],
    criticalFailOptionKeys: criticalBoundaryKeys.length > 0 ? ["b"] : [],
    criticalBoundaryKeys,
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

test("mastery form reserves a distinct item for every required critical boundary", () => {
  const boundaryConfig = {
    ...config,
    criticalBoundaryRequirements: [
      {
        deepDiveKey: "fixture",
        boundaryKeys: ["fixture.boundary.one", "fixture.boundary.two"],
        minimumDistinctBoundaries: 2,
      },
    ],
  };
  const boundaryPool = [
    item("alpha_boundary_one", "fixture.alpha", "fixture", ["fixture.boundary.one"]),
    item("alpha_ordinary", "fixture.alpha"),
    item("alpha_extra", "fixture.alpha"),
    item("beta_boundary_two", "fixture.beta", "fixture", ["fixture.boundary.two"]),
    item("beta_ordinary", "fixture.beta"),
    item("beta_extra", "fixture.beta"),
  ];

  const form = generateDeterministicCapabilityForm(boundaryConfig, boundaryPool, "boundary-seed");
  const selectedBoundaries = new Set(
    form.definition.questions.flatMap((question) =>
      ((question as CapabilityBoundaryTaggedQuestion).criticalBoundaryKeys || []),
    ),
  );
  assert.ok(selectedBoundaries.has("fixture.boundary.one"));
  assert.ok(selectedBoundaries.has("fixture.boundary.two"));
  assert.equal(form.itemKeys.length, 4);
});

test("cumulative form reserves at least one critical scenario per covered Deep Dive", () => {
  const mixedConfig = {
    assessmentKey: "mixed_transfer_v1",
    bankVersion: 1,
    title: "Mixed Transfer",
    assessmentDeepDiveKey: "mixed",
    evidenceKind: "transfer" as const,
    passThresholdPercent: 96,
    formSize: 4,
    maxAttempts: 3,
    retryCooldownHours: 0,
    competencyBlueprint: [
      { competencyKey: "phase_a.alpha", deepDiveKey: "phase_a", count: 2 },
      { competencyKey: "phase_b.beta", deepDiveKey: "phase_b", count: 2 },
    ],
    criticalBoundaryRequirements: [
      {
        deepDiveKey: "phase_a",
        boundaryKeys: ["phase_a.boundary.one", "phase_a.boundary.two"],
        minimumDistinctBoundaries: 1,
      },
      {
        deepDiveKey: "phase_b",
        boundaryKeys: ["phase_b.boundary.one", "phase_b.boundary.two"],
        minimumDistinctBoundaries: 1,
      },
    ],
  };
  const mixedPool = [
    item("a_boundary_one", "phase_a.alpha", "phase_a", ["phase_a.boundary.one"]),
    item("a_boundary_two", "phase_a.alpha", "phase_a", ["phase_a.boundary.two"]),
    item("a_ordinary", "phase_a.alpha", "phase_a"),
    item("b_boundary_one", "phase_b.beta", "phase_b", ["phase_b.boundary.one"]),
    item("b_boundary_two", "phase_b.beta", "phase_b", ["phase_b.boundary.two"]),
    item("b_ordinary", "phase_b.beta", "phase_b"),
  ];

  const form = generateDeterministicCapabilityForm(mixedConfig, mixedPool, "mixed-boundary-seed");
  for (const deepDiveKey of ["phase_a", "phase_b"]) {
    const boundaryCount = form.definition.questions.filter(
      (question) =>
        question.deepDiveKey === deepDiveKey &&
        ((question as CapabilityBoundaryTaggedQuestion).criticalBoundaryKeys || []).length > 0,
    ).length;
    assert.ok(boundaryCount >= 1, `${deepDiveKey} must contribute a critical-boundary item`);
  }
});

test("generation fails closed when critical-boundary coverage conflicts with available competency quota", () => {
  const boundaryConfig = {
    ...config,
    criticalBoundaryRequirements: [
      {
        deepDiveKey: "fixture",
        boundaryKeys: ["fixture.boundary.one", "fixture.boundary.two"],
        minimumDistinctBoundaries: 2,
      },
    ],
  };
  const incompleteBoundaryPool = [
    item("alpha_boundary_one", "fixture.alpha", "fixture", ["fixture.boundary.one"]),
    item("alpha_ordinary", "fixture.alpha"),
    item("beta_ordinary_1", "fixture.beta"),
    item("beta_ordinary_2", "fixture.beta"),
    item("beta_ordinary_3", "fixture.beta"),
  ];

  assert.throws(
    () => generateDeterministicCapabilityForm(boundaryConfig, incompleteBoundaryPool, "boundary-seed"),
    /cannot satisfy critical boundary/,
  );
});

test("critical-boundary items must define a real corrupt option and cannot use sequence semantics", () => {
  const missingCriticalFail = {
    ...item("bad_boundary", "fixture.alpha", "fixture", ["fixture.boundary.one"]),
    criticalFailOptionKeys: [],
  };
  assert.throws(
    () => generateDeterministicCapabilityForm(config, [missingCriticalFail, ...pool], "seed"),
    /must define a critical-fail option/,
  );

  const ambiguousSequence = {
    ...item("sequence_boundary", "fixture.alpha", "fixture", ["fixture.boundary.one"]),
    kind: "sequence" as const,
  };
  assert.throws(
    () => generateDeterministicCapabilityForm(config, [ambiguousSequence, ...pool], "seed"),
    /sequence item .* cannot use option-based critical-fail semantics/,
  );
});

test("correct options can never simultaneously be critical-fail options", () => {
  const corrupt = {
    ...item("overlap", "fixture.alpha"),
    criticalFailOptionKeys: ["a"],
  };
  assert.throws(
    () => generateDeterministicCapabilityForm(config, [corrupt, ...pool], "seed"),
    /marks correct option\(s\) as critical fail/,
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
