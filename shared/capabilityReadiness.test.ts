import assert from "node:assert/strict";
import test from "node:test";
import { getRequiredCapabilityEvidenceCells } from "./capabilityBlueprint";
import {
  CAPABILITY_MVP_SHADOW_GATE_V2,
  evaluateCapabilityReadiness,
  FOUNDATION_CAPABILITY_SHADOW_GATE_V1,
} from "./capabilityReadiness";

const completeFoundationEvidence = {
  passedAssessmentKeys: [
    "clarity_mastery_v1",
    "clarity_retrieval_v1",
    "structured_execution_mastery_v1",
    "clarity_structured_transfer_v1",
  ],
  satisfiedEvidenceCells: [],
  approvedPracticalProofKeys: ["prepare", "execute", "evidence"],
  oralDefenseApproved: true,
};

const allMvpEvidenceCells = getRequiredCapabilityEvidenceCells().map((cell) => cell.code);

const completeMvpEvidence = {
  passedAssessmentKeys: [],
  satisfiedEvidenceCells: allMvpEvidenceCells,
  approvedPracticalProofKeys: ["prepare", "execute", "evidence"],
  oralDefenseApproved: true,
};

test("foundation readiness remains explicitly non-authoritative for Sprint 1-7 proof compatibility", () => {
  const result = evaluateCapabilityReadiness(FOUNDATION_CAPABILITY_SHADOW_GATE_V1, completeFoundationEvidence);
  assert.equal(FOUNDATION_CAPABILITY_SHADOW_GATE_V1.authoritative, false);
  assert.equal(result.authoritative, false);
  assert.equal(result.status, "READY");
  assert.deepEqual(result.missingRequirementCodes, []);
});

test("foundation readiness still reports exact missing evidence", () => {
  const result = evaluateCapabilityReadiness(FOUNDATION_CAPABILITY_SHADOW_GATE_V1, {
    ...completeFoundationEvidence,
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

test("Capability MVP V2 requires all 33 Deep Dive evidence cells plus practicals and oral defense", () => {
  assert.equal(CAPABILITY_MVP_SHADOW_GATE_V2.requirements.length, 37);
  assert.equal(
    CAPABILITY_MVP_SHADOW_GATE_V2.requirements.filter((requirement) => requirement.kind === "deep_dive_evidence").length,
    33,
  );
  assert.equal(
    CAPABILITY_MVP_SHADOW_GATE_V2.requirements.filter((requirement) => requirement.kind === "practical").length,
    3,
  );
  assert.equal(
    CAPABILITY_MVP_SHADOW_GATE_V2.requirements.filter((requirement) => requirement.kind === "oral_defense").length,
    1,
  );
});

test("full current capability evidence reaches READY only on the non-authoritative V2 shadow gate", () => {
  const result = evaluateCapabilityReadiness(CAPABILITY_MVP_SHADOW_GATE_V2, completeMvpEvidence);
  assert.equal(CAPABILITY_MVP_SHADOW_GATE_V2.authoritative, false);
  assert.equal(result.authoritative, false);
  assert.equal(result.status, "READY");
  assert.deepEqual(result.missingRequirementCodes, []);
});

test("the original Clarity + Structured slice cannot make the full Capability MVP gate READY", () => {
  const result = evaluateCapabilityReadiness(CAPABILITY_MVP_SHADOW_GATE_V2, {
    passedAssessmentKeys: completeFoundationEvidence.passedAssessmentKeys,
    satisfiedEvidenceCells: [
      "deep_dive.clarity.mastery",
      "deep_dive.clarity.retrieval",
      "deep_dive.clarity.transfer",
      "deep_dive.structured_execution.mastery",
      "deep_dive.structured_execution.transfer",
    ],
    approvedPracticalProofKeys: ["prepare", "execute", "evidence"],
    oralDefenseApproved: true,
  });

  assert.equal(result.status, "NOT_READY");
  assert.equal(result.missingRequirementCodes.length, 28);
  assert.ok(result.missingRequirementCodes.includes("deep_dive.controlled_discomfort.mastery"));
  assert.ok(result.missingRequirementCodes.includes("deep_dive.structured_execution.retrieval"));
  assert.ok(result.missingRequirementCodes.includes("deep_dive.tools_required.transfer"));
});

test("oral approval alone can never compensate for missing capability evidence", () => {
  const result = evaluateCapabilityReadiness(CAPABILITY_MVP_SHADOW_GATE_V2, {
    passedAssessmentKeys: [],
    satisfiedEvidenceCells: [],
    approvedPracticalProofKeys: [],
    oralDefenseApproved: true,
  });
  assert.equal(result.status, "NOT_READY");
  assert.ok(result.missingRequirementCodes.includes("deep_dive.clarity.mastery"));
  assert.ok(result.missingRequirementCodes.includes("practical.prepare.approved"));
  assert.equal(result.missingRequirementCodes.includes("oral_defense.approved"), false);
});

test("every V2 readiness requirement has a stable unique machine-readable code", () => {
  const codes = CAPABILITY_MVP_SHADOW_GATE_V2.requirements.map((requirement) => requirement.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.every((code) => code.includes(".")));
});
