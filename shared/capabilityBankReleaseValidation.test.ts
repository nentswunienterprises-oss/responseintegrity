import assert from "node:assert/strict";
import test from "node:test";
import { getCapabilityDeepDiveBlueprint } from "./capabilityBlueprint";
import { validateCapabilityAssessmentAgainstBlueprint } from "./capabilityBankCoverage";

const clarity = getCapabilityDeepDiveBlueprint("clarity")!;

function releaseGradeClarityBank() {
  const items = clarity.competencyKeys.flatMap((competencyKey, competencyIndex) =>
    [1, 2].map((variant) => {
      const boundaryKey = variant === 1 ? clarity.criticalBoundaries[competencyIndex]?.key : undefined;
      return {
        competencyKey,
        deepDiveKey: "clarity",
        kind: "single_choice" as const,
        correctOptionKeys: ["a"],
        criticalFailOptionKeys: boundaryKey ? ["b"] : [],
        criticalBoundaryKeys: boundaryKey ? [boundaryKey] : [],
      };
    }),
  );

  return {
    assessmentKey: "clarity_mastery_v1",
    assessmentDeepDiveKey: "clarity",
    evidenceKind: "mastery" as const,
    formSize: 15,
    passThresholdPercent: 96,
    enforceMvpPlan: true,
    competencyBlueprint: clarity.competencyKeys.map((competencyKey) => ({
      competencyKey,
      deepDiveKey: "clarity",
      count: 1,
    })),
    items,
  };
}

test("release-grade Clarity mastery shape covers every competency and every critical boundary", () => {
  const bank = releaseGradeClarityBank();
  assert.equal(bank.items.length, 30);
  assert.equal(bank.competencyBlueprint.length, 15);
  assert.doesNotThrow(() => validateCapabilityAssessmentAgainstBlueprint(bank));
});

test("a 30-item mastery bank can still be rejected for shallow competency breadth", () => {
  const bank = releaseGradeClarityBank();
  bank.competencyBlueprint = [
    { competencyKey: "clarity.phase_purpose", deepDiveKey: "clarity", count: 15 },
  ];
  bank.items = Array.from({ length: 30 }, (_, index) => ({
    competencyKey: "clarity.phase_purpose",
    deepDiveKey: "clarity",
    kind: "single_choice" as const,
    correctOptionKeys: ["a"],
    criticalFailOptionKeys: index < clarity.criticalBoundaries.length ? ["b"] : [],
    criticalBoundaryKeys:
      index < clarity.criticalBoundaries.length ? [clarity.criticalBoundaries[index].key] : [],
  }));

  assert.throws(
    () => validateCapabilityAssessmentAgainstBlueprint(bank),
    /omits declared clarity competencies/,
  );
});

test("a tagged critical boundary without a corrupt critical-fail option is rejected", () => {
  const bank = releaseGradeClarityBank();
  const tagged = bank.items.find((item) => item.criticalBoundaryKeys.length > 0)!;
  tagged.criticalFailOptionKeys = [];

  assert.throws(
    () => validateCapabilityAssessmentAgainstBlueprint(bank),
    /must define at least one critical-fail option/,
  );
});

test("a correct answer can never also be the critical-fail answer", () => {
  const bank = releaseGradeClarityBank();
  const tagged = bank.items.find((item) => item.criticalBoundaryKeys.length > 0)!;
  tagged.criticalFailOptionKeys = ["a"];

  assert.throws(
    () => validateCapabilityAssessmentAgainstBlueprint(bank),
    /critical-fail option cannot also be a correct option/,
  );
});
