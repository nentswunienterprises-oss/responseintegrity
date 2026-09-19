import test from "node:test";
import assert from "node:assert/strict";

import {
  TRAINING_PHASE_EVIDENCE_CONTRACT,
  isTrainingEvidenceDecisionEligible,
  transitionTrainingStateFromEvidence,
} from "./trainingEvidenceContract";

test("all four phases have four phase-critical dimensions and explicit exit contexts", () => {
  for (const contract of Object.values(TRAINING_PHASE_EVIDENCE_CONTRACT)) {
    assert.equal(contract.dimensions.length, 4);
    assert.ok(contract.requiredTrainingSetIds.length >= 2);
    assert.ok(contract.highMaintenanceEntrySetIds.length >= 1);
    assert.ok(contract.exitConfirmationSetIds.length >= 1);
    for (const dimensionId of contract.dimensions) {
      assert.equal(contract.minimumValidOpportunitiesForHigh[dimensionId], 2);
    }
  }
});

test("not-observed and confounded evidence never become decision-eligible", () => {
  assert.equal(isTrainingEvidenceDecisionEligible("not_observed"), false);
  assert.equal(isTrainingEvidenceDecisionEligible("confounded"), false);
  assert.equal(isTrainingEvidenceDecisionEligible("breakdown"), true);
  assert.equal(isTrainingEvidenceDecisionEligible("conditional"), true);
  assert.equal(isTrainingEvidenceDecisionEligible("near_stable"), true);
  assert.equal(isTrainingEvidenceDecisionEligible("supported"), true);
});

test("a strong session from Low can establish High but cannot mint High Maintenance", () => {
  const result = transitionTrainingStateFromEvidence({
    previousPhase: "Structured Execution",
    previousStability: "Low",
    observedStability: "High",
    highMaintenanceEntryQualified: true,
    exitQualified: true,
  });

  assert.deepEqual(result, {
    nextPhase: "Structured Execution",
    nextStability: "High",
    transitionReason: "stability advance",
  });
});

test("High only enters High Maintenance when the evidence contract qualifies", () => {
  const hold = transitionTrainingStateFromEvidence({
    previousPhase: "Structured Execution",
    previousStability: "High",
    observedStability: "High",
    highMaintenanceEntryQualified: false,
    exitQualified: false,
  });
  assert.equal(hold.nextStability, "High");
  assert.equal(hold.transitionReason, "remain");

  const enter = transitionTrainingStateFromEvidence({
    previousPhase: "Structured Execution",
    previousStability: "High",
    observedStability: "High",
    highMaintenanceEntryQualified: true,
    exitQualified: false,
  });
  assert.equal(enter.nextStability, "High Maintenance");
  assert.equal(enter.transitionReason, "high maintenance entry");
});

test("High Maintenance cannot progress without a later qualifying exit confirmation", () => {
  const hold = transitionTrainingStateFromEvidence({
    previousPhase: "Controlled Discomfort",
    previousStability: "High Maintenance",
    observedStability: "High",
    highMaintenanceEntryQualified: true,
    exitQualified: false,
  });
  assert.deepEqual(hold, {
    nextPhase: "Controlled Discomfort",
    nextStability: "High Maintenance",
    transitionReason: "remain",
  });

  const progress = transitionTrainingStateFromEvidence({
    previousPhase: "Controlled Discomfort",
    previousStability: "High Maintenance",
    observedStability: "High",
    highMaintenanceEntryQualified: true,
    exitQualified: true,
  });
  assert.deepEqual(progress, {
    nextPhase: "Time Pressure Stability",
    nextStability: "Low",
    transitionReason: "phase progress",
  });
});

test("High and High Maintenance regress cautiously from a weaker evidence session", () => {
  const fromHigh = transitionTrainingStateFromEvidence({
    previousPhase: "Clarity",
    previousStability: "High",
    observedStability: "Low",
    highMaintenanceEntryQualified: false,
    exitQualified: false,
  });
  assert.equal(fromHigh.nextStability, "Medium");
  assert.equal(fromHigh.transitionReason, "stability regress");

  const fromMaintenance = transitionTrainingStateFromEvidence({
    previousPhase: "Clarity",
    previousStability: "High Maintenance",
    observedStability: "Medium",
    highMaintenanceEntryQualified: false,
    exitQualified: false,
  });
  assert.equal(fromMaintenance.nextStability, "High");
  assert.equal(fromMaintenance.transitionReason, "stability regress");
});

test("final-phase confirmation never creates a fifth phase", () => {
  const result = transitionTrainingStateFromEvidence({
    previousPhase: "Time Pressure Stability",
    previousStability: "High Maintenance",
    observedStability: "High",
    highMaintenanceEntryQualified: true,
    exitQualified: true,
  });

  assert.deepEqual(result, {
    nextPhase: "Time Pressure Stability",
    nextStability: "High Maintenance",
    transitionReason: "final maintenance hold",
  });
});

test("phase progression targets are explicit and stop at Time Pressure Stability", () => {
  assert.equal(TRAINING_PHASE_EVIDENCE_CONTRACT.Clarity.progressionTarget, "Structured Execution");
  assert.equal(
    TRAINING_PHASE_EVIDENCE_CONTRACT["Structured Execution"].progressionTarget,
    "Controlled Discomfort",
  );
  assert.equal(
    TRAINING_PHASE_EVIDENCE_CONTRACT["Controlled Discomfort"].progressionTarget,
    "Time Pressure Stability",
  );
  assert.equal(TRAINING_PHASE_EVIDENCE_CONTRACT["Time Pressure Stability"].progressionTarget, null);
});
