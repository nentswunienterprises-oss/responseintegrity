import assert from "node:assert/strict";
import test from "node:test";
import { validateCapabilityAssessmentAgainstBlueprint } from "./capabilityBankCoverage";

const criticalItem = (boundaryKey: string, competencyKey = "clarity.recognition_boundary") => ({
  competencyKey,
  deepDiveKey: "clarity",
  kind: "single_choice" as const,
  correctOptionKeys: ["preserve"],
  criticalFailOptionKeys: ["violate"],
  criticalBoundaryKeys: [boundaryKey],
});

const baseItems = [
  criticalItem("clarity.modeling_not_independent_evidence", "clarity.modeling_set"),
  criticalItem("clarity.identification_no_solving", "clarity.recognition_boundary"),
  criticalItem("clarity.no_manual_progression", "system.authority"),
];

test("release-grade cumulative evidence requires at least two distinct competencies per Deep Dive", () => {
  assert.throws(
    () =>
      validateCapabilityAssessmentAgainstBlueprint({
        assessmentKey: "test_clarity_retrieval",
        assessmentDeepDiveKey: "mixed",
        evidenceKind: "retrieval",
        enforceMvpPlan: true,
        competencyBlueprint: [
          { competencyKey: "clarity.recognition_boundary", deepDiveKey: "clarity", count: 3 },
        ],
        items: baseItems.map((item) => ({ ...item, competencyKey: "clarity.recognition_boundary" })),
      }),
    /at least two distinct competencies for cumulative Deep Dive clarity/,
  );
});

test("release-grade cumulative private pool must represent every canonical critical boundary", () => {
  assert.throws(
    () =>
      validateCapabilityAssessmentAgainstBlueprint({
        assessmentKey: "test_clarity_transfer",
        assessmentDeepDiveKey: "mixed",
        evidenceKind: "retrieval",
        enforceMvpPlan: true,
        competencyBlueprint: [
          { competencyKey: "clarity.recognition_boundary", deepDiveKey: "clarity", count: 1 },
          { competencyKey: "system.authority", deepDiveKey: "clarity", count: 1 },
        ],
        items: baseItems.slice(0, 2),
      }),
    /private pool omits canonical clarity critical boundaries: clarity.no_manual_progression/,
  );
});
