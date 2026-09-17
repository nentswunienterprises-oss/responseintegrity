import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInheritedVerificationGate,
  collectMaterialInheritedBreaks,
  resolveInheritedVerification,
  type InheritedVerificationHold,
} from "./inheritedLayerVerification";
import {
  encodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
  type SupplementalInheritedEvidenceV2,
} from "./responseIntegrityEvidenceContractV2";

const rep = (inheritedEvidence: SupplementalInheritedEvidenceV2[]) => ({
  [REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY]: encodeRepOperationalEvidenceV2({
    repId: "rep-1",
    repNumber: 1,
    actualSupportUsed: "none",
    timing: {
      mode: "tps_prescribed",
      startedAt: "2026-09-17T08:00:00.000Z",
      endedAt: "2026-09-17T08:01:00.000Z",
      elapsedMs: 60000,
      timingValidity: "valid",
      attemptId: "attempt-1",
      timerContractId: "contract-1",
      conditioningEpochKey: "tps-v1-epoch-1",
      timerContractVersion: 1,
      baselineSeconds: 60,
      prescribedSeconds: 60,
      completedBeforeExpiry: true,
      pressureLevel: "light_timer",
      baselineSource: "historical_eligible",
    },
    inheritedEvidence,
  }),
});

const sets = (inheritedEvidence: SupplementalInheritedEvidenceV2[]) => [
  { setName: "Structure Under Timer", observations: [rep(inheritedEvidence)] },
];

test("material TPS independence break withholds positive movement without changing score", () => {
  const summary = {
    observedPhase: "Time Pressure Stability" as const,
    previousStability: "High" as const,
    phase: "Time Pressure Stability" as const,
    stability: "High Maintenance" as const,
    transitionReason: "stability advance",
    phaseDecision: "remain" as const,
    sessionScore: 91,
    nextAction: "Run maintenance check",
    constraint: null,
  };

  const gated = applyInheritedVerificationGate(summary, sets([{
    dimensionId: "execution.independence",
    rawObservation: "Repeatedly sought rescue while Specialist preserved no-support.",
    normalizedLevel: "weak",
    materiality: "material",
  }]));

  assert.equal(gated.sessionScore, 91);
  assert.equal(gated.phase, "Time Pressure Stability");
  assert.equal(gated.stability, "High");
  assert.equal(gated.transitionReason, "remain");
  assert.equal(gated.inheritedVerificationHold?.targetPhase, "Structured Execution");
  assert.equal(gated.transitionWithheld?.stability, "High Maintenance");
});

test("earliest visibly broken inherited layer wins verification target", () => {
  const breaks = collectMaterialInheritedBreaks(sets([
    {
      dimensionId: "difficulty.rescue_dependence",
      rawObservation: "Rescue seeking returned.",
      normalizedLevel: "weak",
      materiality: "material",
    },
    {
      dimensionId: "clarity.method",
      rawObservation: "The method map itself was no longer available.",
      normalizedLevel: "weak",
      materiality: "material",
    },
    {
      dimensionId: "execution.step_discipline",
      rawObservation: "Known step order broke.",
      normalizedLevel: "weak",
      materiality: "material",
    },
  ]), "Time Pressure Stability");

  assert.equal(breaks[0].sourcePhase, "Clarity");
  assert.equal(breaks[0].dimensionId, "clarity.method");
});

test("informational or non-weak inherited observations do not create a hold", () => {
  const summary = {
    observedPhase: "Time Pressure Stability" as const,
    previousStability: "Medium" as const,
    phase: "Time Pressure Stability" as const,
    stability: "High" as const,
    transitionReason: "stability advance",
    phaseDecision: "remain" as const,
  };

  const gated = applyInheritedVerificationGate(summary, sets([
    {
      dimensionId: "execution.independence",
      rawObservation: "One brief hesitation, not material.",
      normalizedLevel: "partial",
      materiality: "informational",
    },
  ]));

  assert.equal(gated.stability, "High");
  assert.equal(gated.inheritedVerificationHold, undefined);
});

test("downward current-phase movement survives an inherited verification hold", () => {
  const summary = {
    observedPhase: "Time Pressure Stability" as const,
    previousStability: "High" as const,
    phase: "Time Pressure Stability" as const,
    stability: "Medium" as const,
    transitionReason: "stability regress",
    phaseDecision: "regress" as const,
  };

  const gated = applyInheritedVerificationGate(summary, sets([{
    dimensionId: "execution.step_discipline",
    rawObservation: "Step order broke under time.",
    normalizedLevel: "weak",
    materiality: "material",
  }]));

  assert.equal(gated.stability, "Medium");
  assert.equal(gated.transitionReason, "stability regress");
  assert.equal(gated.inheritedVerificationHold?.resumeStability, "Medium");
});

const hold: InheritedVerificationHold = {
  kind: "inherited_verification_required",
  targetPhase: "Structured Execution",
  triggeredFromPhase: "Controlled Discomfort",
  resumePhase: "Controlled Discomfort",
  resumeStability: "High Maintenance",
  sourceBreaks: [],
  freshCurrentPhaseEvidenceRequired: true,
  status: "verification_required",
};

test("verification 60-100 clears hold without regression and requires fresh later-phase evidence", () => {
  const resolution = resolveInheritedVerification(hold, 82);
  assert.equal(resolution.outcome, "verification_cleared");
  assert.equal(resolution.resultingPhase, "Controlled Discomfort");
  assert.equal(resolution.resultingStability, "High Maintenance");
  assert.equal(resolution.holdCleared, true);
  assert.equal(resolution.freshCurrentPhaseEvidenceRequired, true);
});

test("verification 40-59 regresses to earlier phase at High", () => {
  const resolution = resolveInheritedVerification(hold, 52);
  assert.equal(resolution.outcome, "regress_to_earlier_phase");
  assert.equal(resolution.resultingPhase, "Structured Execution");
  assert.equal(resolution.resultingStability, "High");
  assert.equal(resolution.holdCleared, true);
});

test("verification 0-39 routes targeted adaptive re-diagnosis from earlier phase", () => {
  const resolution = resolveInheritedVerification(hold, 28);
  assert.equal(resolution.outcome, "targeted_re_diagnosis_required");
  assert.equal(resolution.resultingPhase, "Controlled Discomfort");
  assert.equal(resolution.resultingStability, "High Maintenance");
  assert.equal(resolution.holdCleared, false);
  assert.equal(resolution.targetedRediagnosisStartingPhase, "Structured Execution");
});
