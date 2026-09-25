import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSandboxGraduation,
  parseSandboxGraduationPolicy,
  type SandboxGraduationAttempt,
  type SandboxGraduationPolicy,
} from "./sandboxGraduation";
import type { TopicPhase } from "./topicConditioningEngine";

const phases: TopicPhase[] = [
  "Clarity",
  "Structured Execution",
  "Controlled Discomfort",
  "Time Pressure Stability",
];

const policy = (status: "candidate" | "approved" = "candidate"): SandboxGraduationPolicy => ({
  policyVersion: 1,
  status,
  minimumObservationFidelityPercent: 90,
  requireSystemOutcomeMatch: true,
  requiredDistinctPassesByPhase: {
    Clarity: 2,
    "Structured Execution": 2,
    "Controlled Discomfort": 2,
    "Time Pressure Stability": 2,
  },
  nextStage: "practicals",
});

const pass = (phase: TopicPhase, key: string): SandboxGraduationAttempt => ({
  scenarioKey: key,
  phase,
  observationFidelityPercent: 95,
  systemOutcomeMatched: true,
  passed: true,
  completedAt: "2026-09-25T07:00:00.000Z",
});

test("candidate policy can establish evidence readiness without authorizing Practicals", () => {
  const attempts = phases.flatMap((phase, index) => [
    pass(phase, `phase-${index}-a`),
    pass(phase, `phase-${index}-b`),
  ]);
  const result = evaluateSandboxGraduation(policy("candidate"), attempts);
  assert.equal(result.evidenceReady, true);
  assert.equal(result.practicalsReady, false);
  assert.equal(result.automaticTransition, false);
  assert.equal(result.qualifyingDistinctScenarios, 8);
});

test("approved policy opens Practicals readiness only after every RI phase is covered", () => {
  const attempts = phases.flatMap((phase, index) => [
    pass(phase, `phase-${index}-a`),
    pass(phase, `phase-${index}-b`),
  ]);
  const result = evaluateSandboxGraduation(policy("approved"), attempts);
  assert.equal(result.evidenceReady, true);
  assert.equal(result.practicalsReady, true);
  assert.equal(result.phases.every((phase) => phase.complete), true);
});

test("duplicate scenario passes do not inflate distinct coverage", () => {
  const attempts = [
    pass("Clarity", "clarity-a"),
    pass("Clarity", "clarity-a"),
    pass("Clarity", "clarity-a"),
  ];
  const result = evaluateSandboxGraduation(policy(), attempts);
  const clarity = result.phases.find((item) => item.phase === "Clarity");
  assert.equal(clarity?.qualifyingDistinctScenarios, 1);
  assert.equal(result.evidenceReady, false);
});

test("low-fidelity and system-divergent attempts do not qualify", () => {
  const low = { ...pass("Clarity", "clarity-low"), observationFidelityPercent: 89.99 };
  const divergent = { ...pass("Clarity", "clarity-divergent"), systemOutcomeMatched: false };
  const result = evaluateSandboxGraduation(policy(), [low, divergent]);
  const clarity = result.phases.find((item) => item.phase === "Clarity");
  assert.equal(clarity?.qualifyingDistinctScenarios, 0);
});

test("policy parser rejects omission of a phase", () => {
  assert.throws(() => parseSandboxGraduationPolicy({
    ...policy(),
    requiredDistinctPassesByPhase: {
      Clarity: 2,
      "Structured Execution": 2,
      "Controlled Discomfort": 2,
    },
  }), /Time Pressure Stability/);
});
