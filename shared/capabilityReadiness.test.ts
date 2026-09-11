import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateCapabilityReadiness,
  FOUNDATION_CAPABILITY_SHADOW_GATE_V1,
} from "./capabilityReadiness";

const completeEvidence = {
  passedAssessmentKeys: [
    "clarity_mastery_v1",
    "clarity_retrieval_v1",
    "structured_execution_mastery_v1",
    "clarity_structured_transfer_v1",
  ],
  approvedPracticalProofKeys: ["prepare", "execute", "evidence"],
  oralDefenseApproved: true,
};

test("foundation readiness remains explicitly non-authoritative", () => {
  const result = evaluateCapabilityReadiness(FOUNDATION_CAPABILITY_SHADOW_GATE_V1, completeEvidence);
  assert.equal(FOUNDATION_CAPABILITY_SHADOW_GATE_V1.authoritative, false);
  assert.equal(result.authoritative, false);
  assert.equal(result.status, "READY");
  assert.deepEqual(result.missingRequirementCodes, []);
});

test("readiness reports exact missing evidence instead of approximating capability", () => {
  const result = evaluateCapabilityReadiness(FOUNDATION_CAPABILITY_SHADOW_GATE_V1, {
    ...completeEvidence,
    passedAssessmentKeys: ["clarity_mastery_v1", "structured_execution_mastery_v1"],
    approvedPracticalProofKeys: ["prepare", "evidence"],
    oralDefenseApproved: false,
  });

  assert.equal(result.status, "NOT_READY");
  assert.deepEqual(result.missingRequirementCodes, [
    "assessment.clarity.retrieval",
    "assessment.foundation.transfer",
    "practical.execute.approved",
    "oral_defense.approved",
  ]);
});

test("oral approval alone can never make an incomplete evidence stack ready", () => {
  const result = evaluateCapabilityReadiness(FOUNDATION_CAPABILITY_SHADOW_GATE_V1, {
    passedAssessmentKeys: [],
    approvedPracticalProofKeys: [],
    oralDefenseApproved: true,
  });
  assert.equal(result.status, "NOT_READY");
  assert.ok(result.missingRequirementCodes.includes("assessment.clarity.mastery"));
  assert.ok(result.missingRequirementCodes.includes("practical.prepare.approved"));
  assert.equal(result.missingRequirementCodes.includes("oral_defense.approved"), false);
});

test("every requirement has a stable machine-readable code", () => {
  const codes = FOUNDATION_CAPABILITY_SHADOW_GATE_V1.requirements.map((requirement) => requirement.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.every((code) => code.includes(".")));
});
