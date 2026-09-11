import assert from "node:assert/strict";
import test from "node:test";
import { validateCapabilityAssessmentAgainstBlueprint } from "./capabilityBankCoverage";

function item(index: number) {
  return {
    competencyKey: "tools.compulsory_kit",
    deepDiveKey: "tools_required",
    kind: "single_choice" as const,
    correctOptionKeys: ["correct"],
    criticalFailOptionKeys: [],
    criticalBoundaryKeys: [],
  };
}

test("release-grade mastery cannot omit a declared Deep Dive competency", () => {
  const items = Array.from({ length: 30 }, (_, index) => item(index));

  assert.throws(
    () =>
      validateCapabilityAssessmentAgainstBlueprint({
        assessmentKey: "tools_required_mastery_v1",
        assessmentDeepDiveKey: "tools_required",
        evidenceKind: "mastery",
        formSize: 15,
        passThresholdPercent: 96,
        enforceMvpPlan: true,
        competencyBlueprint: [
          { competencyKey: "tools.compulsory_kit", deepDiveKey: "tools_required", count: 15 },
        ],
        items,
      }),
    /omits declared tools_required competencies/,
  );
});
