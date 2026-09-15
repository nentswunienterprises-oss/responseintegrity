import assert from "node:assert/strict";
import test from "node:test";
import { buildCapabilityMockDossierSnapshot } from "./capabilityMockDossier";

const assessmentPlan = [
  {
    assessmentKey: "clarity_mastery_v1",
    title: "Clarity Mastery Check",
    evidenceKind: "mastery" as const,
    coveredDeepDiveKeys: ["clarity"],
  },
  {
    assessmentKey: "transformation_retrieval_v1",
    title: "Transformation Retrieval",
    evidenceKind: "retrieval" as const,
    coveredDeepDiveKeys: ["clarity", "structured_execution"],
  },
];

const requiredCells = [
  "deep_dive.clarity.mastery",
  "deep_dive.clarity.retrieval",
  "deep_dive.structured_execution.retrieval",
];

const baseInput = {
  requiredEvidenceCellCodes: requiredCells,
  satisfiedEvidenceCellCodes: [...requiredCells],
  assessmentPlan,
  activeAssessmentVersions: [
    { key: "clarity_mastery_v1", version: 2 },
    { key: "transformation_retrieval_v1", version: 1 },
  ],
  assessmentAttempts: [
    {
      evidenceId: "a1",
      assessmentKey: "clarity_mastery_v1",
      bankVersion: 1,
      attemptNumber: 3,
      evidenceKind: "mastery",
      coveredDeepDiveKeys: ["clarity"],
      totalQuestions: 15,
      correctQuestions: 15,
      percent: 100,
      hasCriticalFail: false,
      passed: true,
      completedAt: "2026-09-10T10:00:00Z",
    },
    {
      evidenceId: "a2",
      assessmentKey: "clarity_mastery_v1",
      bankVersion: 2,
      attemptNumber: 1,
      evidenceKind: "mastery",
      coveredDeepDiveKeys: ["clarity"],
      totalQuestions: 15,
      correctQuestions: 15,
      percent: 100,
      hasCriticalFail: false,
      passed: true,
      completedAt: "2026-09-12T10:00:00Z",
    },
    {
      evidenceId: "a3",
      assessmentKey: "transformation_retrieval_v1",
      bankVersion: 1,
      attemptNumber: 1,
      evidenceKind: "retrieval",
      coveredDeepDiveKeys: ["clarity", "structured_execution"],
      totalQuestions: 20,
      correctQuestions: 20,
      percent: 100,
      hasCriticalFail: false,
      passed: true,
      completedAt: "2026-09-12T11:00:00Z",
    },
  ],
  practicalDefinitions: [
    { proofKey: "prepare", title: "Practical 1 - Prepare", proofVersion: 1 },
  ],
  practicalAttempts: [
    {
      evidenceId: "p1",
      proofKey: "prepare",
      proofVersion: 1,
      rubricVersion: 1,
      attemptNumber: 1,
      outcome: "approved",
      reasonCode: "rubric_clear",
      feedback: null,
      counts: { clear: 6, partial: 0, fail: 0, criticalFail: 0 },
      submittedAt: "2026-09-12T12:00:00Z",
      reviewedAt: "2026-09-12T13:00:00Z",
    },
  ],
  currentOralDefenseVersion: 2,
  oralAttempts: [
    {
      evidenceId: "o1",
      defenseVersion: 1,
      attemptNumber: 4,
      outcome: "approved",
      counts: { clear: 3, partial: 0, fail: 0, criticalFail: 0 },
      feedback: null,
      completedAt: "2026-09-11T14:00:00Z",
    },
    {
      evidenceId: "o2",
      defenseVersion: 2,
      attemptNumber: 1,
      outcome: "approved",
      counts: { clear: 3, partial: 0, fail: 0, criticalFail: 0 },
      feedback: null,
      completedAt: "2026-09-12T14:00:00Z",
    },
  ],
  simulationBankKey: "sandbox_simulation_v1",
  activeSimulationBankVersions: [2],
  simulationAttempts: [
    {
      evidenceId: "s1",
      bankKey: "sandbox_simulation_v1",
      bankVersion: 1,
      attemptNumber: 2,
      scenarioKey: "old",
      scenarioVersion: 1,
      totalDecisions: 5,
      correctDecisions: 5,
      percent: 100,
      passed: true,
      hasCriticalFail: false,
      evidenceContaminationCount: 0,
      authorityViolationCount: 0,
      escalationFailureCount: 0,
      authoritative: false as const,
      completedAt: "2026-09-11T15:00:00Z",
    },
    {
      evidenceId: "s2",
      bankKey: "sandbox_simulation_v1",
      bankVersion: 2,
      attemptNumber: 1,
      scenarioKey: "current",
      scenarioVersion: 1,
      totalDecisions: 5,
      correctDecisions: 5,
      percent: 100,
      passed: true,
      hasCriticalFail: false,
      evidenceContaminationCount: 0,
      authorityViolationCount: 0,
      escalationFailureCount: 0,
      authoritative: false as const,
      completedAt: "2026-09-12T15:00:00Z",
    },
  ],
};

test("dossier selects evidence inside active/current versions before attempt number", () => {
  const result = buildCapabilityMockDossierSnapshot(baseInput);
  const mastery = result.assessments.find((row) => row.assessmentKey === "clarity_mastery_v1");
  assert.equal(mastery?.latestCurrentAttempt?.evidenceId, "a2");
  assert.equal(mastery?.latestCurrentAttempt?.attemptNumber, 1);
  assert.equal(mastery?.staleAttemptCount, 1);
  assert.equal(result.oralDefense.latestCurrentAttempt?.evidenceId, "o2");
  assert.equal(result.oralDefense.latestCurrentAttempt?.attemptNumber, 1);
  assert.equal(result.oralDefense.staleAttemptCount, 1);
  assert.deepEqual(result.sandboxSimulation.currentVersionAttempts.map((row) => row.evidenceId), ["s2"]);
  assert.equal(result.sandboxSimulation.staleAttemptCount, 1);
});

test("dossier reports factual 33-cell-style coverage without a Mock recommendation", () => {
  const result = buildCapabilityMockDossierSnapshot(baseInput);
  assert.equal(result.evidenceCellSummary.satisfied, 3);
  assert.equal(result.evidenceCellSummary.required, 3);
  assert.ok(result.evidenceCellSummary.cells.every((cell) => cell.satisfied));
  assert.equal("mockRecommendation" in result, false);
});

test("missing current evidence and retired history are classified separately", () => {
  const result = buildCapabilityMockDossierSnapshot({
    ...baseInput,
    activeAssessmentVersions: [{ key: "clarity_mastery_v1", version: 2 }],
    practicalAttempts: [],
    oralAttempts: baseInput.oralAttempts.filter((row) => row.defenseVersion === 1),
    activeSimulationBankVersions: [],
  });

  assert.ok(result.flags.some((flag) => flag.code === "assessment_bank_missing.transformation_retrieval_v1" && flag.kind === "missing"));
  assert.ok(result.flags.some((flag) => flag.code === "assessment_stale_history.clarity_mastery_v1" && flag.kind === "stale"));
  assert.ok(result.flags.some((flag) => flag.code === "practical_current_evidence_missing.prepare" && flag.kind === "missing"));
  assert.ok(result.flags.some((flag) => flag.code === "oral_defense_current_evidence_missing" && flag.kind === "missing"));
  assert.ok(result.flags.some((flag) => flag.code === "sandbox_simulation_bank_missing" && flag.kind === "missing"));
});

test("dossier flags duplicate active bank versions as a lineage conflict", () => {
  const result = buildCapabilityMockDossierSnapshot({
    ...baseInput,
    activeAssessmentVersions: [
      ...baseInput.activeAssessmentVersions,
      { key: "clarity_mastery_v1", version: 3 },
    ],
    activeSimulationBankVersions: [2, 3],
  });

  assert.ok(result.flags.some((flag) => flag.code === "assessment_active_bank_conflict.clarity_mastery_v1" && flag.kind === "conflict"));
  assert.ok(result.flags.some((flag) => flag.code === "sandbox_simulation_active_bank_conflict" && flag.kind === "conflict"));
});

test("dossier detects impossible assessment and evidence-cell consistency conflicts", () => {
  const inconsistentAttempts = baseInput.assessmentAttempts.map((row) => row.evidenceId === "a2"
    ? { ...row, hasCriticalFail: true, passed: true }
    : row);
  const result = buildCapabilityMockDossierSnapshot({
    ...baseInput,
    assessmentAttempts: inconsistentAttempts,
    satisfiedEvidenceCellCodes: [
      "deep_dive.clarity.mastery",
      "deep_dive.structured_execution.retrieval",
    ],
  });

  assert.ok(result.flags.some((flag) => flag.code === "assessment_internal_conflict.clarity_mastery_v1"));
  assert.ok(result.flags.some((flag) => flag.code === "evidence_cell_selection_conflict.deep_dive.clarity.retrieval"));
});

test("dossier never upgrades simulation rehearsal into authoritative evidence", () => {
  const result = buildCapabilityMockDossierSnapshot(baseInput);
  assert.equal(result.sandboxSimulation.authoritative, false);
  assert.ok(result.sandboxSimulation.currentVersionAttempts.every((row) => row.authoritative === false));
});
