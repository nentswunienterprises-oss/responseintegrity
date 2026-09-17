import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
  type ActualSupportUsedV2,
} from "./responseIntegrityEvidenceContractV2";
import { getDrillSchemaDefinition, type SubmittedEvidenceSet } from "./responseIntegrityDrillRegistry";
import {
  applySupportConditionValidityGate,
  evaluateTrainingSupportCondition,
  isActualSupportWithinCeiling,
} from "./responseIntegritySupportValidity";
import type { TopicPhase } from "./topicConditioningEngine";

const operational = (repId: string, repNumber: number, actualSupportUsed: ActualSupportUsedV2) =>
  encodeRepOperationalEvidenceV2({
    repId,
    repNumber,
    actualSupportUsed,
    timing: {
      mode: "passive_untimed",
      startedAt: "2026-09-17T08:00:00.000Z",
      endedAt: "2026-09-17T08:01:00.000Z",
      elapsedMs: 60000,
      timingValidity: "valid",
      pressureLevel: "none",
    },
    inheritedEvidence: [],
  });

const buildSet = (
  phase: TopicPhase,
  setName: string,
  actualSupportByRep: Array<ActualSupportUsedV2 | null>,
): SubmittedEvidenceSet => {
  const schema = getDrillSchemaDefinition("training", phase);
  const definition = schema.sets.find((candidate) => candidate.setName === setName);
  assert.ok(definition, `missing ${setName}`);
  return {
    setName: definition.setName,
    setId: definition.setId,
    setOrder: schema.sets.indexOf(definition) + 1,
    drillSchemaId: schema.schemaId,
    drillSchemaVersion: schema.schemaVersion,
    drillDefinitionHash: schema.definitionHash,
    constraintProfile: definition.constraints,
    observations: actualSupportByRep.map((actualSupportUsed, index) =>
      actualSupportUsed
        ? {
            [REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY]: operational(
              definition.repPurposeIds[index] || `${definition.setId}.opportunity_${index + 1}`,
              index + 1,
              actualSupportUsed,
            ),
          }
        : {},
    ),
  } as SubmittedEvidenceSet;
};

test("support ceilings allow only the approved support range", () => {
  assert.equal(isActualSupportWithinCeiling("none", "none"), true);
  assert.equal(isActualSupportWithinCeiling("none", "response_control_cue"), false);
  assert.equal(isActualSupportWithinCeiling("minimal", "response_control_cue"), true);
  assert.equal(isActualSupportWithinCeiling("minimal", "first_step_math_support"), false);
  assert.equal(isActualSupportWithinCeiling("first_step_only", "first_step_math_support"), true);
  assert.equal(isActualSupportWithinCeiling("first_step_only", "beyond_permitted_boundary"), false);
});

test("modeling is excluded and clean scored support remains valid", () => {
  const modeling = buildSet("Clarity", "Modeling", [null]);
  const identification = buildSet("Clarity", "Identification", ["none", "none", "none"]);
  const lightApply = buildSet("Clarity", "Light Apply", [
    "none",
    "response_control_cue",
    "none",
  ]);
  const result = evaluateTrainingSupportCondition("Clarity", [modeling, identification, lightApply]);
  assert.equal(result.status, "clean");
  assert.equal(result.checkedRepCount, 6);
  assert.deepEqual(result.issues, []);
});

test("support above a minimal ceiling contaminates evidence without changing student observations", () => {
  const set = buildSet("Clarity", "Light Apply", [
    "none",
    "first_step_math_support",
    "none",
  ]);
  const result = evaluateTrainingSupportCondition("Clarity", [set]);
  assert.equal(result.status, "contaminated");
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].reason, "support_exceeded_ceiling");
  assert.equal(result.issues[0].permittedSupport, "minimal");
  assert.equal(result.issues[0].actualSupportUsed, "first_step_math_support");
});

test("explicit beyond-boundary support is always contaminated", () => {
  const set = buildSet("Controlled Discomfort", "No Rescue", [
    "none",
    "beyond_permitted_boundary",
    "none",
  ]);
  const result = evaluateTrainingSupportCondition("Controlled Discomfort", [set]);
  assert.equal(result.status, "contaminated");
  assert.equal(result.issues[0].reason, "support_marked_beyond_boundary");
});

test("missing rep-level support evidence cannot silently count as clean proof", () => {
  const set = buildSet("Structured Execution", "Independent Execution", ["none", null, "none"]);
  const result = evaluateTrainingSupportCondition("Structured Execution", [set]);
  assert.equal(result.status, "missing_operational_evidence");
  assert.equal(result.issues[0].reason, "missing_operational_evidence");
});

test("invalid support condition freezes state movement while preserving projected outcome and score", () => {
  const validity = evaluateTrainingSupportCondition("Clarity", [
    buildSet("Clarity", "Light Apply", ["none", "first_step_math_support", "none"]),
  ]);
  const result = applySupportConditionValidityGate(
    {
      observedPhase: "Clarity",
      previousStability: "High",
      phase: "Clarity",
      stability: "High Maintenance",
      transitionReason: "stability advance",
      phaseDecision: "remain",
      sessionScore: 92,
      nextAction: "Run High Maintenance.",
      constraint: null,
    },
    validity,
  );

  assert.equal(result.phase, "Clarity");
  assert.equal(result.stability, "High");
  assert.equal(result.transitionReason, "remain");
  assert.equal(result.phaseDecision, "remain");
  assert.equal(result.sessionScore, 92);
  assert.equal(result.transitionWithheld?.reason, "support_condition_invalid");
  assert.equal(result.transitionWithheld?.projectedStability, "High Maintenance");
});

test("invalid support condition also prevents evidence-driven regression", () => {
  const validity = evaluateTrainingSupportCondition("Structured Execution", [
    buildSet("Structured Execution", "Independent Execution", [
      "none",
      "response_control_cue",
      "none",
    ]),
  ]);
  const result = applySupportConditionValidityGate(
    {
      observedPhase: "Structured Execution",
      previousStability: "Medium",
      phase: "Structured Execution",
      stability: "Low",
      transitionReason: "stability regress",
      phaseDecision: "regress",
      sessionScore: 20,
    },
    validity,
  );

  assert.equal(result.phase, "Structured Execution");
  assert.equal(result.stability, "Medium");
  assert.equal(result.sessionScore, 20);
  assert.equal(result.evidenceConditionValidity.status, "contaminated");
});
