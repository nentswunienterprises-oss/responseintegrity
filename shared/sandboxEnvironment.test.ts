import assert from "node:assert/strict";
import test from "node:test";
import {
  SANDBOX_SPECIALIST_CAPABILITY_ORDER,
  advanceSandboxRep,
  applySandboxSessionAuthority,
  createSandboxEnvironmentState,
  deriveSandboxCapabilityOccurrences,
  evaluateSandboxCapabilityReadiness,
  sandboxCapabilityNeeds,
  selectSandboxOutcome,
  type SandboxCapabilityOccurrence,
  type SandboxCapabilityPolicy,
  type SandboxOutcomeDefinition,
} from "./sandboxEnvironment";

const policy = (status: "candidate" | "approved" = "candidate"): SandboxCapabilityPolicy => ({
  policyVersion: 1,
  status,
  minimumValidOpportunities: {
    condition_integrity: 2,
    observation_integrity: 2,
    evidence_integrity: 2,
    authority_integrity: 2,
    continuity_integrity: 2,
  },
  requireAllPhasesRepresented: true,
  requireLongitudinalTrajectory: true,
  nextStage: "practicals",
});

const outcome = (
  key: string,
  stability: "Low" | "Medium" | "High" | "High Maintenance",
  baseWeight = 1,
): SandboxOutcomeDefinition => ({
  outcomeKey: key,
  outcomeVersion: 1,
  phase: "Clarity",
  setId: "clarity.identification",
  repNumber: 1,
  studentBehavior: "The simulated student gives a coherent observable response.",
  canonicalObservations: {
    vocabulary: {
      optionId: "clarity.identification.cold_name.clarity.vocabulary.option_5",
      evidenceStatus: "observed",
    },
  },
  canonicalInterventionEvent: "none",
  plausiblePreviousStabilities: [stability],
  capabilityExposure: ["observation_integrity"],
  baseWeight,
});

test("stateful outcome selection is deterministic, plausible and avoids immediate repetition", () => {
  const outcomes = [outcome("a", "Low"), outcome("b", "Low"), outcome("c", "High")];
  const context = {
    trajectoryId: "trajectory-1",
    seed: "proof-seed",
    canonicalPhase: "Clarity" as const,
    canonicalStability: "Low" as const,
    prescribedPhase: "Clarity" as const,
    setId: "clarity.identification",
    repNumber: 1,
    recentOutcomeKeys: ["a"],
    capabilityNeeds: ["observation_integrity" as const],
  };

  const first = selectSandboxOutcome(outcomes, context);
  const second = selectSandboxOutcome(outcomes, context);
  assert.equal(first.outcomeKey, second.outcomeKey);
  assert.equal(first.outcomeKey, "b");
  assert.ok(first.plausiblePreviousStabilities.includes("Low"));
});

test("rep integrity signals become evidence about distinct Specialist capabilities", () => {
  const events = deriveSandboxCapabilityOccurrences({
    trajectoryId: "trajectory-1",
    phase: "Structured Execution",
    setId: "structured_execution.required_structure",
    repNumber: 1,
    sessionNumber: 2,
    eventId: "event-1",
    conditionKept: true,
    exactObservationCount: 3,
    comparableObservationCount: 4,
    evidenceStatusExact: false,
    interventionEventExact: true,
    systemOutcomeMatched: false,
    stateTrackAligned: false,
  });

  assert.equal(events.length, SANDBOX_SPECIALIST_CAPABILITY_ORDER.length);
  assert.equal(events.find((item) => item.capabilityId === "condition_integrity")?.evidenceClass, "supported");
  assert.equal(events.find((item) => item.capabilityId === "observation_integrity")?.evidenceClass, "conditional");
  assert.equal(events.find((item) => item.capabilityId === "evidence_integrity")?.evidenceClass, "breakdown");
  assert.equal(events.find((item) => item.capabilityId === "authority_integrity")?.evidenceClass, "breakdown");
  assert.equal(events.find((item) => item.capabilityId === "continuity_integrity")?.evidenceClass, "breakdown");
});

const supportedOccurrence = (
  capabilityId: SandboxCapabilityOccurrence["capabilityId"],
  phase: SandboxCapabilityOccurrence["phase"],
  sessionNumber: number,
  suffix: string,
): SandboxCapabilityOccurrence => ({
  capabilityId,
  evidenceClass: "supported",
  phase,
  setId: phase + "-set",
  repNumber: sessionNumber,
  trajectoryId: "trajectory-long",
  sessionNumber,
  eventId: capabilityId + "-" + suffix,
  reason: "clean",
});

test("candidate readiness can become evidence-ready without authorizing Practicals", () => {
  const phases = [
    "Clarity",
    "Structured Execution",
    "Controlled Discomfort",
    "Time Pressure Stability",
  ] as const;
  const occurrences: SandboxCapabilityOccurrence[] = [];

  for (const [capabilityIndex, capabilityId] of SANDBOX_SPECIALIST_CAPABILITY_ORDER.entries()) {
    occurrences.push(
      supportedOccurrence(capabilityId, phases[capabilityIndex % phases.length], 1, "a"),
      supportedOccurrence(capabilityId, phases[(capabilityIndex + 1) % phases.length], 2, "b"),
    );
  }

  const result = evaluateSandboxCapabilityReadiness(policy("candidate"), occurrences);
  assert.equal(result.earliestUnsupportedCapability, null);
  assert.equal(result.evidenceReady, true);
  assert.equal(result.practicalsReady, false);
  assert.equal(result.automaticTransition, false);
  assert.equal(result.longitudinalTrajectoryEstablished, true);
  assert.equal(result.phasesRepresented.length, 4);

  const approved = evaluateSandboxCapabilityReadiness(policy("approved"), occurrences);
  assert.equal(approved.practicalsReady, true);
});

test("an earlier unsupported capability blocks later layers even when later raw evidence is clean", () => {
  const occurrences: SandboxCapabilityOccurrence[] = [
    {
      ...supportedOccurrence("condition_integrity", "Clarity", 1, "a"),
      evidenceClass: "breakdown",
    },
    supportedOccurrence("condition_integrity", "Clarity", 2, "b"),
    supportedOccurrence("observation_integrity", "Structured Execution", 1, "a"),
    supportedOccurrence("observation_integrity", "Structured Execution", 2, "b"),
    supportedOccurrence("evidence_integrity", "Controlled Discomfort", 1, "a"),
    supportedOccurrence("evidence_integrity", "Controlled Discomfort", 2, "b"),
    supportedOccurrence("authority_integrity", "Time Pressure Stability", 1, "a"),
    supportedOccurrence("authority_integrity", "Time Pressure Stability", 2, "b"),
    supportedOccurrence("continuity_integrity", "Time Pressure Stability", 1, "a"),
    supportedOccurrence("continuity_integrity", "Time Pressure Stability", 2, "b"),
  ];

  const result = evaluateSandboxCapabilityReadiness(policy(), occurrences);
  assert.equal(result.earliestUnsupportedCapability, "condition_integrity");
  assert.equal(result.layers[0].effectiveState, "CONDITIONAL");
  assert.equal(result.layers[1].rawState, "SUPPORTED");
  assert.equal(result.layers[1].effectiveState, "BLOCKED_BY_PREREQUISITE");
  assert.deepEqual(sandboxCapabilityNeeds(result), ["condition_integrity"]);
});

test("a genuine capability breakdown needs an extra clean recovery suffix", () => {
  const occurrences: SandboxCapabilityOccurrence[] = [
    {
      ...supportedOccurrence("condition_integrity", "Clarity", 1, "break"),
      evidenceClass: "breakdown",
    },
    supportedOccurrence("condition_integrity", "Clarity", 1, "recover-1"),
    supportedOccurrence("condition_integrity", "Clarity", 2, "recover-2"),
  ];

  let result = evaluateSandboxCapabilityReadiness(policy(), occurrences);
  assert.notEqual(result.layers[0].rawState, "SUPPORTED");

  occurrences.push(
    supportedOccurrence("condition_integrity", "Structured Execution", 2, "recover-3"),
  );
  result = evaluateSandboxCapabilityReadiness(policy(), occurrences);
  assert.equal(result.layers[0].rawState, "SUPPORTED");
  assert.equal(result.layers[0].recoveredAfterBreakdown, true);
});

test("canonical student truth and Specialist-recorded RI state persist separately", () => {
  const initial = createSandboxEnvironmentState({
    trajectoryId: "trajectory-1",
    phase: "Clarity",
    stability: "Medium",
  });
  const next = applySandboxSessionAuthority({
    state: advanceSandboxRep(initial, 6),
    canonicalAuthority: {
      route: "normal_training",
      nextPhase: "Clarity",
      nextStability: "High",
      targetPhase: null,
      reason: "canonical evidence",
    },
    specialistAuthority: {
      route: "normal_training",
      nextPhase: "Clarity",
      nextStability: "Medium",
      targetPhase: null,
      reason: "misrecorded evidence",
    },
  });

  assert.equal(next.canonicalStudent.stability, "High");
  assert.equal(next.specialistRecorded.stability, "Medium");
  assert.equal(next.divergenceActive, true);
  assert.equal(next.sessionNumber, 2);
  assert.equal(next.completedRepCount, 6);
});
