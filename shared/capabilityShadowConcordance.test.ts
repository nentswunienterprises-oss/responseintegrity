import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShadowSpecialistConcordance,
  classifyShadowConcordance,
  normalizeBattleTestDeepDiveSignal,
  normalizeCapabilityDeepDiveSignal,
  summarizeShadowConcordanceCohort,
  validateShadowConcordanceInput,
  type ShadowBattleTestDeepDiveEvidence,
  type ShadowCapabilityEvidenceInput,
  type ShadowOutcomeTarget,
} from "./capabilityShadowConcordance";
import {
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  getRequiredCapabilityEvidenceCells,
} from "./capabilityBlueprint";
import { CAPABILITY_MVP_ASSESSMENT_PLAN_V1 } from "./capabilityAssessmentPlan";

function battleEvidence(
  deepDiveKey: ShadowBattleTestDeepDiveEvidence["deepDiveKey"],
  patch: Partial<ShadowBattleTestDeepDiveEvidence> = {},
): ShadowBattleTestDeepDiveEvidence {
  return {
    evidenceId: `battle-${deepDiveKey}`,
    deepDiveKey,
    historicalState: "completed",
    currentHealthState: "locked",
    currentStreak: 3,
    latestScore: 100,
    attemptsCount: 3,
    criticalFlag: false,
    completedAt: "2026-09-01T10:00:00Z",
    lastTestedAt: "2026-09-01T10:00:00Z",
    ...patch,
  };
}

const requiredCells = getRequiredCapabilityEvidenceCells();
const allCellCodes = requiredCells.map((cell) => cell.code);
const activeAssessmentVersions = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.map((plan) => ({
  assessmentKey: plan.assessmentKey,
  bankVersion: 1,
}));

function assessmentForCell(cell: (typeof requiredCells)[number]) {
  const plan = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.find(
    (entry) =>
      entry.evidenceKind === cell.evidenceKind &&
      entry.coveredDeepDiveKeys.includes(cell.deepDiveKey),
  );
  if (!plan) throw new Error(`No assessment plan found for ${cell.code}`);
  return plan;
}

function fullCapabilityEvidence(
  patch: Partial<ShadowCapabilityEvidenceInput> = {},
): ShadowCapabilityEvidenceInput {
  return {
    activeAssessmentVersions: structuredClone(activeAssessmentVersions),
    satisfiedEvidenceCellCodes: [...allCellCodes],
    observedEvidenceCellCodes: [...allCellCodes],
    criticalDeepDiveKeys: [],
    evidenceCellLineage: requiredCells.map((cell, index) => {
      const plan = assessmentForCell(cell);
      return {
        code: cell.code,
        deepDiveKey: cell.deepDiveKey,
        evidenceKind: cell.evidenceKind,
        evidenceId: `assessment-${plan.assessmentKey}`,
        assessmentKey: plan.assessmentKey,
        bankVersion: 1,
        attemptNumber: 1,
        passed: true,
        hasCriticalFail: false,
        observedAt: new Date(Date.UTC(2026, 8, 2, 10, index, 0)).toISOString(),
      };
    }),
    practicalOutcomes: [
      {
        proofKey: "prepare",
        outcome: "approved",
        evidenceId: "p1",
        version: 1,
        rubricVersion: 1,
        attemptNumber: 1,
        observedAt: "2026-09-02T10:00:00Z",
      },
      {
        proofKey: "execute",
        outcome: "approved",
        evidenceId: "p2",
        version: 1,
        rubricVersion: 1,
        attemptNumber: 1,
        observedAt: "2026-09-02T11:00:00Z",
      },
      {
        proofKey: "evidence",
        outcome: "approved",
        evidenceId: "p3",
        version: 1,
        rubricVersion: 1,
        attemptNumber: 1,
        observedAt: "2026-09-02T12:00:00Z",
      },
    ],
    oralDefense: {
      outcome: "approved",
      evidenceId: "oral-1",
      version: 2,
      attemptNumber: 1,
      observedAt: "2026-09-03T10:00:00Z",
    },
    sandboxSimulation: {
      bankKey: "sandbox_foundation",
      activeBankVersion: 1,
      latestCurrentAttempt: {
        evidenceId: "simulation-1",
        bankVersion: 1,
        attemptNumber: 1,
        passed: true,
        hasCriticalFail: false,
        observedAt: "2026-09-03T12:00:00Z",
      },
    },
    ...patch,
  };
}

const noOutcomeTarget: ShadowOutcomeTarget = {
  mock: { decision: null, evidenceId: null, observedAt: null },
  trial: {
    caseStatus: null,
    certificationDecision: null,
    evidenceId: null,
    observedAt: null,
  },
};

function allReadyBattleEvidence() {
  return CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive) => battleEvidence(deepDive.key));
}

test("Battle Test signal uses current completion health streak score and critical state", () => {
  assert.equal(normalizeBattleTestDeepDiveSignal(battleEvidence("clarity")), "ready");
  assert.equal(normalizeBattleTestDeepDiveSignal(null), "missing");
  assert.equal(
    normalizeBattleTestDeepDiveSignal(battleEvidence("clarity", { attemptsCount: 0 })),
    "missing",
  );
  assert.equal(
    normalizeBattleTestDeepDiveSignal(battleEvidence("clarity", { currentStreak: 2 })),
    "not_ready",
  );
  assert.equal(
    normalizeBattleTestDeepDiveSignal(
      battleEvidence("clarity", { currentHealthState: "watchlist" }),
    ),
    "not_ready",
  );
  assert.equal(
    normalizeBattleTestDeepDiveSignal(battleEvidence("clarity", { latestScore: 95 })),
    "not_ready",
  );
  assert.equal(
    normalizeBattleTestDeepDiveSignal(battleEvidence("clarity", { criticalFlag: true })),
    "integrity_block",
  );
});

test("Capability Deep Dive signal distinguishes missing partial ready and critical evidence", () => {
  const clarityCells = requiredCells
    .filter((cell) => cell.deepDiveKey === "clarity")
    .map((cell) => cell.code);
  assert.equal(clarityCells.length, 3);

  assert.equal(
    normalizeCapabilityDeepDiveSignal({
      deepDiveKey: "clarity",
      satisfiedEvidenceCellCodes: [],
      observedEvidenceCellCodes: [],
      criticalDeepDiveKeys: [],
    }),
    "missing",
  );
  assert.equal(
    normalizeCapabilityDeepDiveSignal({
      deepDiveKey: "clarity",
      satisfiedEvidenceCellCodes: [clarityCells[0]],
      observedEvidenceCellCodes: [clarityCells[0], clarityCells[1]],
      criticalDeepDiveKeys: [],
    }),
    "not_ready",
  );
  assert.equal(
    normalizeCapabilityDeepDiveSignal({
      deepDiveKey: "clarity",
      satisfiedEvidenceCellCodes: clarityCells,
      observedEvidenceCellCodes: clarityCells,
      criticalDeepDiveKeys: [],
    }),
    "ready",
  );
  assert.equal(
    normalizeCapabilityDeepDiveSignal({
      deepDiveKey: "clarity",
      satisfiedEvidenceCellCodes: clarityCells,
      observedEvidenceCellCodes: clarityCells,
      criticalDeepDiveKeys: ["clarity"],
    }),
    "integrity_block",
  );
});

test("concordance classifications separate readiness missingness and integrity asymmetry", () => {
  assert.equal(classifyShadowConcordance("ready", "ready"), "agree_ready");
  assert.equal(classifyShadowConcordance("not_ready", "not_ready"), "agree_not_ready");
  assert.equal(
    classifyShadowConcordance("integrity_block", "integrity_block"),
    "agree_integrity_block",
  );
  assert.equal(
    classifyShadowConcordance("ready", "not_ready"),
    "battle_test_only_ready",
  );
  assert.equal(
    classifyShadowConcordance("not_ready", "ready"),
    "capability_only_ready",
  );
  assert.equal(
    classifyShadowConcordance("missing", "ready"),
    "missing_comparison_evidence",
  );
  assert.equal(
    classifyShadowConcordance("integrity_block", "ready"),
    "integrity_disagreement",
  );
});

test("fully ready pathways agree without creating a cutover decision", () => {
  const result = buildShadowSpecialistConcordance({
    battleTestDeepDives: allReadyBattleEvidence(),
    capabilityEvidence: fullCapabilityEvidence(),
    outcomeTarget: noOutcomeTarget,
  });

  assert.equal(result.authoritative, false);
  assert.equal(result.cutoverDecision, null);
  assert.equal(result.analysisKind, "descriptive_shadow_concordance");
  assert.equal(result.deepDives.length, 11);
  assert.equal(result.summary.comparableDeepDives, 11);
  assert.equal(result.summary.agreeingDeepDives, 11);
  assert.equal(result.battleTestOverallState, "ready");
  assert.equal(result.capabilityOverallState, "ready");
  assert.equal(result.overallClassification, "agree_ready");
  assert.equal(result.capabilitySimulationEvidence.latestCurrentAttempt?.passed, true);
});

test("Capability overall state remains missing until practical and oral evidence is observed", () => {
  const capability = fullCapabilityEvidence();
  capability.oralDefense = {
    outcome: null,
    evidenceId: null,
    version: null,
    attemptNumber: null,
    observedAt: null,
  };
  const result = buildShadowSpecialistConcordance({
    battleTestDeepDives: allReadyBattleEvidence(),
    capabilityEvidence: capability,
    outcomeTarget: noOutcomeTarget,
  });
  assert.equal(result.battleTestOverallState, "ready");
  assert.equal(result.capabilityOverallState, "missing");
  assert.equal(result.overallClassification, "missing_comparison_evidence");
});

test("current integrity signal overrides apparently complete Capability cells", () => {
  const capability = fullCapabilityEvidence();
  capability.criticalDeepDiveKeys = ["clarity"];
  const clarityLineage = capability.evidenceCellLineage.find(
    (entry) => entry.deepDiveKey === "clarity",
  );
  assert.ok(clarityLineage);
  clarityLineage.hasCriticalFail = true;
  clarityLineage.passed = false;
  capability.satisfiedEvidenceCellCodes = capability.satisfiedEvidenceCellCodes.filter(
    (code) => code !== clarityLineage.code,
  );

  const result = buildShadowSpecialistConcordance({
    battleTestDeepDives: allReadyBattleEvidence(),
    capabilityEvidence: capability,
    outcomeTarget: noOutcomeTarget,
  });
  const clarity = result.deepDives.find((row) => row.deepDiveKey === "clarity");
  assert.equal(clarity?.battleTestState, "ready");
  assert.equal(clarity?.capabilityState, "integrity_block");
  assert.equal(clarity?.classification, "integrity_disagreement");
  assert.equal(result.capabilityOverallState, "integrity_block");
});

test("stale assessment practical oral and simulation evidence fail closed", () => {
  const staleAssessment = fullCapabilityEvidence();
  staleAssessment.evidenceCellLineage[0].bankVersion = 99;
  assert.throws(
    () =>
      validateShadowConcordanceInput({
        battleTestDeepDives: allReadyBattleEvidence(),
        capabilityEvidence: staleAssessment,
        outcomeTarget: noOutcomeTarget,
      }),
    /stale bank/i,
  );

  const stalePractical = fullCapabilityEvidence();
  stalePractical.practicalOutcomes[0].version = 99;
  assert.throws(
    () =>
      validateShadowConcordanceInput({
        battleTestDeepDives: allReadyBattleEvidence(),
        capabilityEvidence: stalePractical,
        outcomeTarget: noOutcomeTarget,
      }),
    /stale proof version/i,
  );

  const staleOral = fullCapabilityEvidence();
  staleOral.oralDefense.version = 1;
  assert.throws(
    () =>
      validateShadowConcordanceInput({
        battleTestDeepDives: allReadyBattleEvidence(),
        capabilityEvidence: staleOral,
        outcomeTarget: noOutcomeTarget,
      }),
    /stale defense version/i,
  );

  const staleSimulation = fullCapabilityEvidence();
  if (!staleSimulation.sandboxSimulation.latestCurrentAttempt) {
    throw new Error("Expected simulation fixture");
  }
  staleSimulation.sandboxSimulation.latestCurrentAttempt.bankVersion = 2;
  assert.throws(
    () =>
      validateShadowConcordanceInput({
        battleTestDeepDives: allReadyBattleEvidence(),
        capabilityEvidence: staleSimulation,
        outcomeTarget: noOutcomeTarget,
      }),
    /stale bank version/i,
  );
});

test("unknown duplicate and lineage-inconsistent evidence fails closed", () => {
  const duplicateBattle = allReadyBattleEvidence();
  duplicateBattle.push({ ...duplicateBattle[0], evidenceId: "duplicate" });
  assert.throws(
    () =>
      validateShadowConcordanceInput({
        battleTestDeepDives: duplicateBattle,
        capabilityEvidence: fullCapabilityEvidence(),
        outcomeTarget: noOutcomeTarget,
      }),
    /contains duplicates/i,
  );

  const missingLineage = fullCapabilityEvidence();
  missingLineage.evidenceCellLineage = missingLineage.evidenceCellLineage.slice(1);
  assert.throws(
    () =>
      validateShadowConcordanceInput({
        battleTestDeepDives: allReadyBattleEvidence(),
        capabilityEvidence: missingLineage,
        outcomeTarget: noOutcomeTarget,
      }),
    /has no current-version lineage/i,
  );
});

test("Sandbox Mock and Trial outcomes remain observational targets and do not alter concordance", () => {
  const withOutcomes = buildShadowSpecialistConcordance({
    battleTestDeepDives: allReadyBattleEvidence(),
    capabilityEvidence: fullCapabilityEvidence(),
    outcomeTarget: {
      mock: {
        decision: "remediation_required",
        evidenceId: "mock-1",
        observedAt: "2026-09-04T10:00:00Z",
      },
      trial: {
        caseStatus: "unsuccessful",
        certificationDecision: "unsuccessful",
        evidenceId: "trial-1",
        observedAt: "2026-09-10T10:00:00Z",
      },
    },
  });
  assert.equal(withOutcomes.overallClassification, "agree_ready");
  assert.equal(withOutcomes.outcomeTarget.mock.decision, "remediation_required");
  assert.equal(withOutcomes.outcomeTarget.trial.certificationDecision, "unsuccessful");
});

function cohortMember(index: number, outcomeTarget = noOutcomeTarget) {
  return {
    tutorId: `tutor-${index}`,
    comparison: buildShadowSpecialistConcordance({
      battleTestDeepDives: allReadyBattleEvidence(),
      capabilityEvidence: fullCapabilityEvidence(),
      outcomeTarget,
    }),
  };
}

test("cohort summary is descriptive only and reports denominators and downstream cross-tabs", () => {
  const members = [
    cohortMember(1, {
      mock: { decision: "passed", evidenceId: "m1", observedAt: "2026-09-04T10:00:00Z" },
      trial: { caseStatus: "certified", certificationDecision: "certified", evidenceId: "t1", observedAt: "2026-09-10T10:00:00Z" },
    }),
    cohortMember(2, {
      mock: { decision: "remediation_required", evidenceId: "m2", observedAt: "2026-09-05T10:00:00Z" },
      trial: { caseStatus: null, certificationDecision: null, evidenceId: null, observedAt: null },
    }),
    cohortMember(3),
  ];
  const summary = summarizeShadowConcordanceCohort(members);

  assert.equal(summary.analysisKind, "descriptive_shadow_concordance");
  assert.equal(summary.sampleSize, 3);
  assert.equal(summary.comparableSampleSize, 3);
  assert.equal(summary.missingComparisonSampleSize, 0);
  assert.equal(summary.overallAgreementRate, 1);
  assert.equal(summary.mockOutcomeObservedCount, 2);
  assert.equal(summary.trialOutcomeObservedCount, 1);
  assert.equal(summary.mockOutcomeByClassification.agree_ready.passed, 1);
  assert.equal(summary.mockOutcomeByClassification.agree_ready.remediationRequired, 1);
  assert.equal(summary.trialDecisionByClassification.agree_ready.certified, 1);
  assert.equal(summary.statisticalAnalysisPlanDefined, false);
  assert.equal(summary.equivalenceEstablished, false);
  assert.equal(summary.superiorityEstablished, false);
  assert.equal(summary.predictiveValidityEstablished, false);
  assert.equal(summary.strongCutoverClaimAllowed, false);
});

test("cohort summary rejects duplicate Specialist identities", () => {
  assert.throws(
    () => summarizeShadowConcordanceCohort([cohortMember(1), cohortMember(1)]),
    /tutor IDs contains duplicates/i,
  );
});
