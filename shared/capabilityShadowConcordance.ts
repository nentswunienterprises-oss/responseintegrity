import {
  getRequiredCapabilityEvidenceCells,
  type CapabilityBlueprintEvidenceCell,
} from "./capabilityBlueprint";
import type { TutorBattleTestPhaseKey } from "./battleTesting";

export type ShadowPathwaySignalState = "ready" | "not_ready" | "missing" | "integrity_block";

export type ShadowConcordanceClassification =
  | "agree_ready"
  | "agree_not_ready"
  | "agree_integrity_block"
  | "battle_test_only_ready"
  | "capability_only_ready"
  | "missing_comparison_evidence"
  | "integrity_disagreement"
  | "other_disagreement";

export interface ShadowBattleTestDeepDiveEvidence {
  evidenceId: string;
  deepDiveKey: TutorBattleTestPhaseKey;
  historicalState: "in_progress" | "completed";
  currentHealthState: "locked" | "watchlist" | "drift";
  currentStreak: number;
  latestScore: number | null;
  attemptsCount: number;
  criticalFlag: boolean;
  completedAt: string | null;
  lastTestedAt: string | null;
}

export interface ShadowCapabilityCellEvidence {
  code: string;
  deepDiveKey: TutorBattleTestPhaseKey;
  evidenceKind: "mastery" | "retrieval" | "transfer";
  evidenceId: string;
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  passed: boolean;
  hasCriticalFail: boolean;
  observedAt: string;
}

export interface ShadowCapabilityEvidenceInput {
  satisfiedEvidenceCellCodes: string[];
  observedEvidenceCellCodes: string[];
  criticalDeepDiveKeys: TutorBattleTestPhaseKey[];
  evidenceCellLineage: ShadowCapabilityCellEvidence[];
  practicalOutcomes: Array<{
    proofKey: "prepare" | "execute" | "evidence";
    outcome: "approved" | "repeat_required" | "integrity_review" | "submitted" | null;
    evidenceId: string | null;
    version: number | null;
    rubricVersion: number | null;
    attemptNumber: number | null;
    observedAt: string | null;
  }>;
  oralDefense: {
    outcome: "approved" | "repeat_required" | "integrity_review" | null;
    evidenceId: string | null;
    version: number | null;
    attemptNumber: number | null;
    observedAt: string | null;
  };
}

export interface ShadowOutcomeTarget {
  mock: {
    decision: "passed" | "remediation_required" | null;
    evidenceId: string | null;
    observedAt: string | null;
  };
  trial: {
    caseStatus: "active" | "reviewable" | "certified" | "remediation_required" | "unsuccessful" | null;
    certificationDecision: "certified" | "remediation_required" | "unsuccessful" | null;
    evidenceId: string | null;
    observedAt: string | null;
  };
}

export interface ShadowDeepDiveComparison {
  deepDiveKey: TutorBattleTestPhaseKey;
  battleTestState: ShadowPathwaySignalState;
  capabilityState: ShadowPathwaySignalState;
  classification: ShadowConcordanceClassification;
  battleTestEvidence: ShadowBattleTestDeepDiveEvidence | null;
  capabilityEvidence: {
    requiredCellCodes: string[];
    satisfiedCellCodes: string[];
    observedCellCodes: string[];
    criticalSignal: boolean;
    lineage: ShadowCapabilityCellEvidence[];
  };
}

export interface ShadowSpecialistConcordance {
  authoritative: false;
  cutoverDecision: null;
  deepDives: ShadowDeepDiveComparison[];
  battleTestOverallState: ShadowPathwaySignalState;
  capabilityOverallState: ShadowPathwaySignalState;
  overallClassification: ShadowConcordanceClassification;
  capabilityHumanEvidence: {
    practicals: ShadowCapabilityEvidenceInput["practicalOutcomes"];
    oralDefense: ShadowCapabilityEvidenceInput["oralDefense"];
  };
  outcomeTarget: ShadowOutcomeTarget;
  summary: {
    comparableDeepDives: number;
    agreeingDeepDives: number;
    disagreementDeepDives: number;
    missingDeepDives: number;
    integrityDisagreementDeepDives: number;
  };
}

export const SHADOW_CONCORDANCE_MIN_DIRECTIONAL_SAMPLE = 10;
export const SHADOW_CONCORDANCE_MIN_FORMAL_EQUIVALENCE_SAMPLE = 30;

function cellsByDeepDive() {
  const byDeepDive = new Map<TutorBattleTestPhaseKey, CapabilityBlueprintEvidenceCell[]>();
  for (const cell of getRequiredCapabilityEvidenceCells()) {
    const rows = byDeepDive.get(cell.deepDiveKey) || [];
    rows.push(cell);
    byDeepDive.set(cell.deepDiveKey, rows);
  }
  return byDeepDive;
}

export function normalizeBattleTestDeepDiveSignal(
  evidence: ShadowBattleTestDeepDiveEvidence | null | undefined,
): ShadowPathwaySignalState {
  if (!evidence || evidence.attemptsCount <= 0) return "missing";
  if (evidence.criticalFlag) return "integrity_block";
  if (
    evidence.historicalState === "completed" &&
    evidence.currentHealthState === "locked" &&
    evidence.currentStreak >= 3 &&
    (evidence.latestScore ?? 0) >= 96
  ) {
    return "ready";
  }
  return "not_ready";
}

export function normalizeCapabilityDeepDiveSignal(input: {
  deepDiveKey: TutorBattleTestPhaseKey;
  satisfiedEvidenceCellCodes: string[];
  observedEvidenceCellCodes: string[];
  criticalDeepDiveKeys: TutorBattleTestPhaseKey[];
}): ShadowPathwaySignalState {
  if (input.criticalDeepDiveKeys.includes(input.deepDiveKey)) return "integrity_block";

  const required = (cellsByDeepDive().get(input.deepDiveKey) || []).map((cell) => cell.code);
  const satisfied = new Set(input.satisfiedEvidenceCellCodes);
  const observed = new Set(input.observedEvidenceCellCodes);
  const observedRequired = required.filter((code) => observed.has(code));
  if (observedRequired.length === 0) return "missing";
  if (required.every((code) => satisfied.has(code))) return "ready";
  return "not_ready";
}

export function classifyShadowConcordance(
  battleTestState: ShadowPathwaySignalState,
  capabilityState: ShadowPathwaySignalState,
): ShadowConcordanceClassification {
  if (battleTestState === "missing" || capabilityState === "missing") {
    return "missing_comparison_evidence";
  }
  if (battleTestState === "integrity_block" || capabilityState === "integrity_block") {
    return battleTestState === "integrity_block" && capabilityState === "integrity_block"
      ? "agree_integrity_block"
      : "integrity_disagreement";
  }
  if (battleTestState === "ready" && capabilityState === "ready") return "agree_ready";
  if (battleTestState === "not_ready" && capabilityState === "not_ready") return "agree_not_ready";
  if (battleTestState === "ready" && capabilityState === "not_ready") return "battle_test_only_ready";
  if (battleTestState === "not_ready" && capabilityState === "ready") return "capability_only_ready";
  return "other_disagreement";
}

function aggregateOverallState(states: ShadowPathwaySignalState[]): ShadowPathwaySignalState {
  if (states.length === 0 || states.some((state) => state === "missing")) return "missing";
  if (states.some((state) => state === "integrity_block")) return "integrity_block";
  if (states.every((state) => state === "ready")) return "ready";
  return "not_ready";
}

function normalizeCapabilityOverallState(input: {
  deepDiveStates: ShadowPathwaySignalState[];
  capabilityEvidence: ShadowCapabilityEvidenceInput;
}) {
  const deepDiveState = aggregateOverallState(input.deepDiveStates);
  if (deepDiveState === "missing" || deepDiveState === "integrity_block") return deepDiveState;

  const practicals = input.capabilityEvidence.practicalOutcomes;
  if (practicals.some((proof) => proof.outcome === "integrity_review")) return "integrity_block" as const;
  if (input.capabilityEvidence.oralDefense.outcome === "integrity_review") return "integrity_block" as const;

  const requiredProofKeys = new Set(["prepare", "execute", "evidence"]);
  const observedProofKeys = new Set(
    practicals.filter((proof) => proof.outcome !== null).map((proof) => proof.proofKey),
  );
  if ([...requiredProofKeys].some((proofKey) => !observedProofKeys.has(proofKey))) return "missing" as const;
  if (input.capabilityEvidence.oralDefense.outcome === null) return "missing" as const;

  const practicalsApproved = practicals.every((proof) => proof.outcome === "approved");
  const oralApproved = input.capabilityEvidence.oralDefense.outcome === "approved";
  if (deepDiveState === "ready" && practicalsApproved && oralApproved) return "ready" as const;
  return "not_ready" as const;
}

export function buildShadowSpecialistConcordance(input: {
  battleTestDeepDives: ShadowBattleTestDeepDiveEvidence[];
  capabilityEvidence: ShadowCapabilityEvidenceInput;
  outcomeTarget: ShadowOutcomeTarget;
}): ShadowSpecialistConcordance {
  const battleByDeepDive = new Map(
    input.battleTestDeepDives.map((entry) => [entry.deepDiveKey, entry] as const),
  );
  const evidenceCells = cellsByDeepDive();
  const satisfied = new Set(input.capabilityEvidence.satisfiedEvidenceCellCodes);
  const observed = new Set(input.capabilityEvidence.observedEvidenceCellCodes);

  const deepDives: ShadowDeepDiveComparison[] = Array.from(evidenceCells.keys()).map((deepDiveKey) => {
    const battleTestEvidence = battleByDeepDive.get(deepDiveKey) || null;
    const battleTestState = normalizeBattleTestDeepDiveSignal(battleTestEvidence);
    const capabilityState = normalizeCapabilityDeepDiveSignal({
      deepDiveKey,
      satisfiedEvidenceCellCodes: input.capabilityEvidence.satisfiedEvidenceCellCodes,
      observedEvidenceCellCodes: input.capabilityEvidence.observedEvidenceCellCodes,
      criticalDeepDiveKeys: input.capabilityEvidence.criticalDeepDiveKeys,
    });
    const requiredCellCodes = (evidenceCells.get(deepDiveKey) || []).map((cell) => cell.code);

    return {
      deepDiveKey,
      battleTestState,
      capabilityState,
      classification: classifyShadowConcordance(battleTestState, capabilityState),
      battleTestEvidence,
      capabilityEvidence: {
        requiredCellCodes,
        satisfiedCellCodes: requiredCellCodes.filter((code) => satisfied.has(code)),
        observedCellCodes: requiredCellCodes.filter((code) => observed.has(code)),
        criticalSignal: input.capabilityEvidence.criticalDeepDiveKeys.includes(deepDiveKey),
        lineage: input.capabilityEvidence.evidenceCellLineage.filter(
          (entry) => entry.deepDiveKey === deepDiveKey && requiredCellCodes.includes(entry.code),
        ),
      },
    };
  });

  const battleTestOverallState = aggregateOverallState(deepDives.map((row) => row.battleTestState));
  const capabilityOverallState = normalizeCapabilityOverallState({
    deepDiveStates: deepDives.map((row) => row.capabilityState),
    capabilityEvidence: input.capabilityEvidence,
  });
  const comparableDeepDives = deepDives.filter(
    (row) => row.classification !== "missing_comparison_evidence",
  );
  const agreeingDeepDives = comparableDeepDives.filter((row) =>
    row.classification === "agree_ready" ||
    row.classification === "agree_not_ready" ||
    row.classification === "agree_integrity_block",
  );

  return {
    authoritative: false,
    cutoverDecision: null,
    deepDives,
    battleTestOverallState,
    capabilityOverallState,
    overallClassification: classifyShadowConcordance(
      battleTestOverallState,
      capabilityOverallState,
    ),
    capabilityHumanEvidence: {
      practicals: input.capabilityEvidence.practicalOutcomes,
      oralDefense: input.capabilityEvidence.oralDefense,
    },
    outcomeTarget: input.outcomeTarget,
    summary: {
      comparableDeepDives: comparableDeepDives.length,
      agreeingDeepDives: agreeingDeepDives.length,
      disagreementDeepDives: comparableDeepDives.length - agreeingDeepDives.length,
      missingDeepDives: deepDives.length - comparableDeepDives.length,
      integrityDisagreementDeepDives: deepDives.filter(
        (row) => row.classification === "integrity_disagreement",
      ).length,
    },
  };
}

export interface ShadowCohortMember {
  tutorId: string;
  comparison: ShadowSpecialistConcordance;
}

export function summarizeShadowConcordanceCohort(members: ShadowCohortMember[]) {
  const sampleSize = members.length;
  const comparable = members.filter(
    (member) => member.comparison.overallClassification !== "missing_comparison_evidence",
  );
  const agreements = comparable.filter((member) =>
    member.comparison.overallClassification === "agree_ready" ||
    member.comparison.overallClassification === "agree_not_ready" ||
    member.comparison.overallClassification === "agree_integrity_block",
  );
  const withMockOutcome = members.filter((member) => member.comparison.outcomeTarget.mock.decision !== null);
  const withTrialDecision = members.filter(
    (member) => member.comparison.outcomeTarget.trial.certificationDecision !== null,
  );

  return {
    authoritative: false as const,
    cutoverDecision: null,
    sampleSize,
    comparableSampleSize: comparable.length,
    overallAgreementRate: comparable.length > 0 ? agreements.length / comparable.length : null,
    mockOutcomeObservedCount: withMockOutcome.length,
    trialOutcomeObservedCount: withTrialDecision.length,
    evidenceStrength:
      sampleSize < SHADOW_CONCORDANCE_MIN_DIRECTIONAL_SAMPLE
        ? "insufficient"
        : sampleSize < SHADOW_CONCORDANCE_MIN_FORMAL_EQUIVALENCE_SAMPLE
          ? "descriptive"
          : "directional",
    formalEquivalenceAnalysisEligible:
      sampleSize >= SHADOW_CONCORDANCE_MIN_FORMAL_EQUIVALENCE_SAMPLE &&
      comparable.length >= SHADOW_CONCORDANCE_MIN_FORMAL_EQUIVALENCE_SAMPLE,
    equivalenceEstablished: false as const,
    strongCutoverClaimAllowed: false as const,
  };
}
