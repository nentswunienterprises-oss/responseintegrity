import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShadowSpecialistConcordance,
  classifyShadowConcordance,
  normalizeBattleTestDeepDiveSignal,
  normalizeCapabilityDeepDiveSignal,
  SHADOW_CONCORDANCE_MIN_DIRECTIONAL_SAMPLE,
  SHADOW_CONCORDANCE_MIN_FORMAL_EQUIVALENCE_SAMPLE,
  summarizeShadowConcordanceCohort,
  type ShadowBattleTestDeepDiveEvidence,
  type ShadowCapabilityEvidenceInput,
  type ShadowOutcomeTarget,
} from "./capabilityShadowConcordance";
import {
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  getRequiredCapabilityEvidenceCells,
} from "./capabilityBlueprint";

function battleEvidence(
  deepDiveKey: ShadowBattleTestDeepDiveEvidence["deepDiveKey"],
  patch: Partial<ShadowBattleTestDeepDiveEvidence> = {},
): ShadowBattleTestDeepDiveEvidence {
  return {
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

const allCellCodes = getRequiredCapabilityEvidenceCells().map((cell) => cell.code);

function fullCapabilityEvidence(patch: Partial<ShadowCapabilityEvidenceInput> = {}): ShadowCapabilityEvidenceInput {
  return {
    satisfiedEvidenceCellCodes: [...allCellCodes],
    observedEvidenceCellCodes: [...allCellCodes],
    criticalDeepDiveKeys: [],
    practicalOutcomes: [
      { proofKey: "prepare", outcome: "approved", evidenceId: "p1", version: 1, attemptNumber: 1, observedAt: "2026-09-02T10:00:00Z" },
      { proofKey: "execute", outcome: "approved", evidenceId: "p2", version: 1, attemptNumber: 1, observedAt: "2026-09-02T11:00:00Z" },
      { proofKey: "evidence", outcome: "approved", evidenceId: "p3", version: 1, attemptNumber: 1, observedAt: "2026-09-02T12:00:00Z" },
    ],
    oralDefense: {
      outcome: "approved",
      evidenceId: "oral-1",
      version: 2,
      attemptNumber: 1,
      observedAt: "2026-09-03T10:00:00Z",
    },
    ...patch,
  };
}

const noOutcomeTarget: ShadowOutcomeTarget = {
  mock: { decision: null, evidenceId: null, observedAt: null },
  trial: { caseStatus: null, certificationDecision: null, evidenceId: null, observedAt: null },
};

function allReadyBattleEvidence() {
  return CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive) => battleEvidence(deepDive.key));
}

test("Battle Test current readiness requires completed history, current locked health, streak 3, 96+ and no critical flag", () => {
  assert.equal(normalizeBattleTestDeepDiveSignal(battleEvidence("clarity")), "ready");
  assert.equal(normalizeBattleTestDeepDiveSignal(null), "missing");
  assert.equal(normalizeBattleTestDeepDiveSignal(battleEvidence("clarity", { attemptsCount: 0 })), "missing");
  assert.equal(normalizeBattleTestDeepDiveSignal(battleEvidence("clarity", { currentStreak: 2 })), "not_ready");
  assert.equal(normalizeBattleTestDeepDiveSignal(battleEvidence("clarity", { currentHealthState: "watchlist" })), "not_ready");
  assert.equal(normalizeBattleTestDeepDiveSignal(battleEvidence("clarity", { latestScore: 95 })), "not_ready");
  assert.equal(normalizeBattleTestDeepDiveSignal(battleEvidence("clarity", { criticalFlag: true })), "integrity_block");
});

test("Capability Deep Dive signal distinguishes missing, partial, ready and critical evidence", () => {
  const clarityCells = getRequiredCapabilityEvidenceCells()
    .filter((cell) => cell.deepDiveKey === "clarity")
    .map((cell) => cell.code);
  assert.equal(clarityCells.length, 3);

  assert.equal(normalizeCapabilityDeepDiveSignal({
    deepDiveKey: "clarity",
    satisfiedEvidenceCellCodes: [],
    observedEvidenceCellCodes: [],
    criticalDeepDiveKeys: [],
  }), "missing");
  assert.equal(normalizeCapabilityDeepDiveSignal({
    deepDiveKey: "clarity",
    satisfiedEvidenceCellCodes: [clarityCells[0]],
    observedEvidenceCellCodes: [clarityCells[0], clarityCells[1]],
    criticalDeepDiveKeys: [],
  }), "not_ready");
  assert.equal(normalizeCapabilityDeepDiveSignal({
    deepDiveKey: "clarity",
    satisfiedEvidenceCellCodes: clarityCells,
    observedEvidenceCellCodes: clarityCells,
    criticalDeepDiveKeys: [],
  }), "ready");
  assert.equal(normalizeCapabilityDeepDiveSignal({
    deepDiveKey: "clarity",
    satisfiedEvidenceCellCodes: clarityCells,
    observedEvidenceCellCodes: clarityCells,
    criticalDeepDiveKeys: ["clarity"],
  }), "integrity_block");
});

test("concordance classifications distinguish agreement, one-sided readiness, missing evidence and integrity disagreement", () => {
  assert.equal(classifyShadowConcordance("ready", "ready"), "agree_ready");
  assert.equal(classifyShadowConcordance("not_ready", "not_ready"), "agree_not_ready");
  assert.equal(classifyShadowConcordance("integrity_block", "integrity_block"), "agree_integrity_block");
  assert.equal(classifyShadowConcordance("ready", "not_ready"), "battle_test_only_ready");
  assert.equal(classifyShadowConcordance("not_ready", "ready"), "capability_only_ready");
  assert.equal(classifyShadowConcordance("missing", "ready"), "missing_comparison_evidence");
  assert.equal(classifyShadowConcordance("integrity_block", "ready"), "integrity_disagreement");
  assert.equal(classifyShadowConcordance("ready", "integrity_block"), "integrity_disagreement");
});

test("fully ready pathways agree without creating a cutover decision", () => {
  const result = buildShadowSpecialistConcordance({
    battleTestDeepDives: allReadyBattleEvidence(),
    capabilityEvidence: fullCapabilityEvidence(),
    outcomeTarget: noOutcomeTarget,
  });

  assert.equal(result.authoritative, false);
  assert.equal(result.cutoverDecision, null);
  assert.equal(result.deepDives.length, 11);
  assert.equal(result.summary.comparableDeepDives, 11);
  assert.equal(result.summary.agreeingDeepDives, 11);
  assert.equal(result.battleTestOverallState, "ready");
  assert.equal(result.capabilityOverallState, "ready");
  assert.equal(result.overallClassification, "agree_ready");
});

test("Capability overall readiness still requires the three practicals and Oral Defense after 33 cells are satisfied", () => {
  const withoutOral = fullCapabilityEvidence({
    oralDefense: { outcome: null, evidenceId: null, version: null, attemptNumber: null, observedAt: null },
  });
  const result = buildShadowSpecialistConcordance({
    battleTestDeepDives: allReadyBattleEvidence(),
    capabilityEvidence: withoutOral,
    outcomeTarget: noOutcomeTarget,
  });
  assert.equal(result.battleTestOverallState, "ready");
  assert.equal(result.capabilityOverallState, "missing");
  assert.equal(result.overallClassification, "missing_comparison_evidence");
});

test("current integrity signal overrides apparently complete Capability cells", () => {
  const result = buildShadowSpecialistConcordance({
    battleTestDeepDives: allReadyBattleEvidence(),
    capabilityEvidence: fullCapabilityEvidence({ criticalDeepDiveKeys: ["clarity"] }),
    outcomeTarget: noOutcomeTarget,
  });
  const clarity = result.deepDives.find((row) => row.deepDiveKey === "clarity");
  assert.equal(clarity?.battleTestState, "ready");
  assert.equal(clarity?.capabilityState, "integrity_block");
  assert.equal(clarity?.classification, "integrity_disagreement");
  assert.equal(result.capabilityOverallState, "integrity_block");
});

test("Sandbox Mock and Trial outcomes remain separate observational targets and do not alter concordance", () => {
  const withOutcomes = buildShadowSpecialistConcordance({
    battleTestDeepDives: allReadyBattleEvidence(),
    capabilityEvidence: fullCapabilityEvidence(),
    outcomeTarget: {
      mock: { decision: "remediation_required", evidenceId: "mock-1", observedAt: "2026-09-04T10:00:00Z" },
      trial: { caseStatus: "unsuccessful", certificationDecision: "unsuccessful", evidenceId: "trial-1", observedAt: "2026-09-10T10:00:00Z" },
    },
  });
  assert.equal(withOutcomes.overallClassification, "agree_ready");
  assert.equal(withOutcomes.outcomeTarget.mock.decision, "remediation_required");
  assert.equal(withOutcomes.outcomeTarget.trial.certificationDecision, "unsuccessful");
});

function cohortMember(index: number) {
  return {
    tutorId: `tutor-${index}`,
    comparison: buildShadowSpecialistConcordance({
      battleTestDeepDives: allReadyBattleEvidence(),
      capabilityEvidence: fullCapabilityEvidence(),
      outcomeTarget: noOutcomeTarget,
    }),
  };
}

test("cohort summary refuses directional or equivalence claims below explicit sample thresholds", () => {
  const small = summarizeShadowConcordanceCohort(
    Array.from({ length: SHADOW_CONCORDANCE_MIN_DIRECTIONAL_SAMPLE - 1 }, (_, index) => cohortMember(index)),
  );
  assert.equal(small.evidenceStrength, "insufficient");
  assert.equal(small.formalEquivalenceAnalysisEligible, false);
  assert.equal(small.equivalenceEstablished, false);
  assert.equal(small.strongCutoverClaimAllowed, false);

  const descriptive = summarizeShadowConcordanceCohort(
    Array.from({ length: SHADOW_CONCORDANCE_MIN_DIRECTIONAL_SAMPLE }, (_, index) => cohortMember(index)),
  );
  assert.equal(descriptive.evidenceStrength, "descriptive");
  assert.equal(descriptive.formalEquivalenceAnalysisEligible, false);
  assert.equal(descriptive.strongCutoverClaimAllowed, false);

  const formal = summarizeShadowConcordanceCohort(
    Array.from({ length: SHADOW_CONCORDANCE_MIN_FORMAL_EQUIVALENCE_SAMPLE }, (_, index) => cohortMember(index)),
  );
  assert.equal(formal.evidenceStrength, "directional");
  assert.equal(formal.formalEquivalenceAnalysisEligible, true);
  assert.equal(formal.equivalenceEstablished, false);
  assert.equal(formal.strongCutoverClaimAllowed, false);
});
