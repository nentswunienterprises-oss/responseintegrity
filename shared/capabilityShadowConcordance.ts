import {
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  getRequiredCapabilityEvidenceCells,
  type CapabilityBlueprintEvidenceCell,
  type CapabilityBlueprintEvidenceKind,
} from "./capabilityBlueprint";
import {
  CAPABILITY_MVP_SHADOW_GATE_V2,
  evaluateCapabilityReadiness,
} from "./capabilityReadiness";
import { CAPABILITY_PRACTICAL_PROOFS } from "./capabilityPracticalEvidence";
import { ORAL_DEFENSE_VERSION } from "./capabilityOralDefense";
import type { TutorBattleTestPhaseKey } from "./battleTesting";

export type ShadowPathwaySignalState =
  | "ready"
  | "not_ready"
  | "missing"
  | "integrity_block";

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

export interface ShadowCapabilityActiveAssessmentVersion {
  assessmentKey: string;
  bankVersion: number;
}

export interface ShadowCapabilityCellEvidence {
  code: string;
  deepDiveKey: TutorBattleTestPhaseKey;
  evidenceKind: CapabilityBlueprintEvidenceKind;
  evidenceId: string;
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  passed: boolean;
  hasCriticalFail: boolean;
  observedAt: string;
}

export interface ShadowCapabilityPracticalOutcome {
  proofKey: "prepare" | "execute" | "evidence";
  outcome: "approved" | "repeat_required" | "integrity_review" | "submitted" | null;
  evidenceId: string | null;
  version: number | null;
  rubricVersion: number | null;
  attemptNumber: number | null;
  observedAt: string | null;
}

export interface ShadowCapabilityOralDefenseOutcome {
  outcome: "approved" | "repeat_required" | "integrity_review" | null;
  evidenceId: string | null;
  version: number | null;
  attemptNumber: number | null;
  observedAt: string | null;
}

export interface ShadowCapabilitySandboxSimulationEvidence {
  bankKey: string;
  activeBankVersion: number | null;
  latestCurrentAttempt: {
    evidenceId: string;
    bankVersion: number;
    attemptNumber: number;
    passed: boolean;
    hasCriticalFail: boolean;
    observedAt: string;
  } | null;
}

export interface ShadowCapabilityEvidenceInput {
  activeAssessmentVersions: ShadowCapabilityActiveAssessmentVersion[];
  satisfiedEvidenceCellCodes: string[];
  observedEvidenceCellCodes: string[];
  criticalDeepDiveKeys: TutorBattleTestPhaseKey[];
  evidenceCellLineage: ShadowCapabilityCellEvidence[];
  practicalOutcomes: ShadowCapabilityPracticalOutcome[];
  oralDefense: ShadowCapabilityOralDefenseOutcome;
  sandboxSimulation: ShadowCapabilitySandboxSimulationEvidence;
}

export interface ShadowOutcomeTarget {
  mock: {
    decision: "passed" | "remediation_required" | null;
    evidenceId: string | null;
    observedAt: string | null;
  };
  trial: {
    caseStatus:
      | "active"
      | "reviewable"
      | "certified"
      | "remediation_required"
      | "unsuccessful"
      | null;
    certificationDecision:
      | "certified"
      | "remediation_required"
      | "unsuccessful"
      | null;
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
  analysisKind: "descriptive_shadow_concordance";
  deepDives: ShadowDeepDiveComparison[];
  battleTestOverallState: ShadowPathwaySignalState;
  capabilityOverallState: ShadowPathwaySignalState;
  overallClassification: ShadowConcordanceClassification;
  capabilityHumanEvidence: {
    practicals: ShadowCapabilityPracticalOutcome[];
    oralDefense: ShadowCapabilityOralDefenseOutcome;
  };
  capabilitySimulationEvidence: ShadowCapabilitySandboxSimulationEvidence;
  outcomeTarget: ShadowOutcomeTarget;
  summary: {
    comparableDeepDives: number;
    agreeingDeepDives: number;
    disagreementDeepDives: number;
    missingDeepDives: number;
    integrityDisagreementDeepDives: number;
  };
}

const REQUIRED_CELLS = getRequiredCapabilityEvidenceCells();
const REQUIRED_CELL_BY_CODE = new Map(REQUIRED_CELLS.map((cell) => [cell.code, cell] as const));
const KNOWN_DEEP_DIVES = new Set(CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive) => deepDive.key));
const CURRENT_PRACTICAL_BY_KEY = new Map(
  CAPABILITY_PRACTICAL_PROOFS.map((proof) => [proof.key, proof] as const),
);

function cellsByDeepDive() {
  const byDeepDive = new Map<TutorBattleTestPhaseKey, CapabilityBlueprintEvidenceCell[]>();
  for (const cell of REQUIRED_CELLS) {
    const rows = byDeepDive.get(cell.deepDiveKey) || [];
    rows.push(cell);
    byDeepDive.set(cell.deepDiveKey, rows);
  }
  return byDeepDive;
}

function assertIso(value: string | null, label: string) {
  if (value === null) return;
  if (!value.trim() || Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${label} must be a valid timestamp.`);
  }
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicates.`);
  }
}

export function validateShadowConcordanceInput(input: {
  battleTestDeepDives: ShadowBattleTestDeepDiveEvidence[];
  capabilityEvidence: ShadowCapabilityEvidenceInput;
  outcomeTarget: ShadowOutcomeTarget;
}) {
  const battleIds = input.battleTestDeepDives.map((entry) => entry.deepDiveKey);
  assertUnique(battleIds, "Battle Test Deep Dive evidence");
  for (const entry of input.battleTestDeepDives) {
    if (!KNOWN_DEEP_DIVES.has(entry.deepDiveKey)) {
      throw new Error(`Unknown Battle Test Deep Dive: ${entry.deepDiveKey}.`);
    }
    if (!entry.evidenceId.trim()) throw new Error(`Battle Test ${entry.deepDiveKey} requires evidenceId.`);
    if (!Number.isInteger(entry.currentStreak) || entry.currentStreak < 0) {
      throw new Error(`Battle Test ${entry.deepDiveKey} has invalid current streak.`);
    }
    if (!Number.isInteger(entry.attemptsCount) || entry.attemptsCount < 0) {
      throw new Error(`Battle Test ${entry.deepDiveKey} has invalid attempt count.`);
    }
    if (entry.latestScore !== null && (entry.latestScore < 0 || entry.latestScore > 100)) {
      throw new Error(`Battle Test ${entry.deepDiveKey} has invalid latest score.`);
    }
    assertIso(entry.completedAt, `Battle Test ${entry.deepDiveKey} completedAt`);
    assertIso(entry.lastTestedAt, `Battle Test ${entry.deepDiveKey} lastTestedAt`);
  }

  const activeVersionIds = input.capabilityEvidence.activeAssessmentVersions.map(
    (entry) => entry.assessmentKey,
  );
  assertUnique(activeVersionIds, "Capability active assessment versions");
  const activeVersions = new Map(
    input.capabilityEvidence.activeAssessmentVersions.map((entry) => {
      if (!entry.assessmentKey.trim()) throw new Error("Capability active assessment key is required.");
      assertPositiveInteger(entry.bankVersion, `Capability bank version ${entry.assessmentKey}`);
      return [entry.assessmentKey, entry.bankVersion] as const;
    }),
  );

  assertUnique(input.capabilityEvidence.satisfiedEvidenceCellCodes, "Satisfied Capability evidence cells");
  assertUnique(input.capabilityEvidence.observedEvidenceCellCodes, "Observed Capability evidence cells");
  const satisfied = new Set(input.capabilityEvidence.satisfiedEvidenceCellCodes);
  const observed = new Set(input.capabilityEvidence.observedEvidenceCellCodes);
  for (const code of [...satisfied, ...observed]) {
    if (!REQUIRED_CELL_BY_CODE.has(code)) throw new Error(`Unknown Capability evidence cell: ${code}.`);
  }
  for (const code of satisfied) {
    if (!observed.has(code)) {
      throw new Error(`Satisfied Capability evidence cell ${code} is not present in observed evidence.`);
    }
  }

  assertUnique(input.capabilityEvidence.criticalDeepDiveKeys, "Capability critical Deep Dive keys");
  for (const deepDiveKey of input.capabilityEvidence.criticalDeepDiveKeys) {
    if (!KNOWN_DEEP_DIVES.has(deepDiveKey)) {
      throw new Error(`Unknown Capability critical Deep Dive: ${deepDiveKey}.`);
    }
  }
  const criticalDeepDives = new Set(input.capabilityEvidence.criticalDeepDiveKeys);

  const lineageCodes = input.capabilityEvidence.evidenceCellLineage.map((entry) => entry.code);
  assertUnique(lineageCodes, "Capability evidence-cell lineage");
  const lineageByCode = new Map(
    input.capabilityEvidence.evidenceCellLineage.map((entry) => [entry.code, entry] as const),
  );
  for (const entry of input.capabilityEvidence.evidenceCellLineage) {
    const expectedCell = REQUIRED_CELL_BY_CODE.get(entry.code);
    if (!expectedCell) throw new Error(`Capability lineage references unknown evidence cell: ${entry.code}.`);
    if (entry.deepDiveKey !== expectedCell.deepDiveKey || entry.evidenceKind !== expectedCell.evidenceKind) {
      throw new Error(`Capability lineage identity mismatch for ${entry.code}.`);
    }
    if (!observed.has(entry.code)) {
      throw new Error(`Capability lineage ${entry.code} is not declared observed.`);
    }
    if (!entry.evidenceId.trim() || !entry.assessmentKey.trim()) {
      throw new Error(`Capability lineage ${entry.code} requires evidence and assessment IDs.`);
    }
    assertPositiveInteger(entry.bankVersion, `Capability lineage ${entry.code} bank version`);
    assertPositiveInteger(entry.attemptNumber, `Capability lineage ${entry.code} attempt number`);
    assertIso(entry.observedAt, `Capability lineage ${entry.code} observedAt`);
    const activeBankVersion = activeVersions.get(entry.assessmentKey);
    if (activeBankVersion === undefined) {
      throw new Error(`Capability lineage ${entry.code} has no active bank declaration for ${entry.assessmentKey}.`);
    }
    if (activeBankVersion !== entry.bankVersion) {
      throw new Error(
        `Capability lineage ${entry.code} uses stale bank v${entry.bankVersion}; active ${entry.assessmentKey} is v${activeBankVersion}.`,
      );
    }
    if (satisfied.has(entry.code) && (!entry.passed || entry.hasCriticalFail)) {
      throw new Error(`Satisfied Capability evidence cell ${entry.code} is inconsistent with its latest evidence.`);
    }
    if (entry.hasCriticalFail && !criticalDeepDives.has(entry.deepDiveKey)) {
      throw new Error(`Capability critical evidence for ${entry.deepDiveKey} is missing from criticalDeepDiveKeys.`);
    }
  }
  for (const code of observed) {
    if (!lineageByCode.has(code)) {
      throw new Error(`Observed Capability evidence cell ${code} has no current-version lineage.`);
    }
  }

  const practicalKeys = input.capabilityEvidence.practicalOutcomes.map((proof) => proof.proofKey);
  assertUnique(practicalKeys, "Capability practical outcomes");
  if (practicalKeys.length !== CURRENT_PRACTICAL_BY_KEY.size) {
    throw new Error("Capability concordance requires one current-state row for each practical proof.");
  }
  for (const proof of input.capabilityEvidence.practicalOutcomes) {
    const current = CURRENT_PRACTICAL_BY_KEY.get(proof.proofKey);
    if (!current) throw new Error(`Unknown Capability practical proof: ${proof.proofKey}.`);
    if (proof.outcome === null) {
      if (
        proof.evidenceId !== null ||
        proof.version !== null ||
        proof.rubricVersion !== null ||
        proof.attemptNumber !== null ||
        proof.observedAt !== null
      ) {
        throw new Error(`Missing Capability practical ${proof.proofKey} cannot carry evidence metadata.`);
      }
      continue;
    }
    if (!proof.evidenceId?.trim()) throw new Error(`Capability practical ${proof.proofKey} requires evidenceId.`);
    if (proof.version !== current.version) {
      throw new Error(`Capability practical ${proof.proofKey} uses stale proof version.`);
    }
    if (proof.outcome !== "submitted" && proof.rubricVersion !== current.reviewRubric.version) {
      throw new Error(`Capability practical ${proof.proofKey} uses stale rubric version.`);
    }
    assertPositiveInteger(proof.attemptNumber || 0, `Capability practical ${proof.proofKey} attempt number`);
    assertIso(proof.observedAt, `Capability practical ${proof.proofKey} observedAt`);
  }

  const oral = input.capabilityEvidence.oralDefense;
  if (oral.outcome === null) {
    if (
      oral.evidenceId !== null ||
      oral.version !== null ||
      oral.attemptNumber !== null ||
      oral.observedAt !== null
    ) {
      throw new Error("Missing Oral Defense cannot carry evidence metadata.");
    }
  } else {
    if (!oral.evidenceId?.trim()) throw new Error("Oral Defense requires evidenceId.");
    if (oral.version !== ORAL_DEFENSE_VERSION) throw new Error("Oral Defense evidence uses a stale defense version.");
    assertPositiveInteger(oral.attemptNumber || 0, "Oral Defense attempt number");
    assertIso(oral.observedAt, "Oral Defense observedAt");
  }

  const simulation = input.capabilityEvidence.sandboxSimulation;
  if (!simulation.bankKey.trim()) throw new Error("Sandbox simulation bank key is required.");
  if (simulation.activeBankVersion !== null) {
    assertPositiveInteger(simulation.activeBankVersion, "Sandbox simulation active bank version");
  }
  if (simulation.latestCurrentAttempt) {
    const attempt = simulation.latestCurrentAttempt;
    if (simulation.activeBankVersion === null) {
      throw new Error("Sandbox simulation attempt cannot exist without an active bank version.");
    }
    if (attempt.bankVersion !== simulation.activeBankVersion) {
      throw new Error("Sandbox simulation evidence uses a stale bank version.");
    }
    if (!attempt.evidenceId.trim()) throw new Error("Sandbox simulation attempt requires evidenceId.");
    assertPositiveInteger(attempt.attemptNumber, "Sandbox simulation attempt number");
    assertIso(attempt.observedAt, "Sandbox simulation observedAt");
  }

  assertIso(input.outcomeTarget.mock.observedAt, "Sandbox Mock observedAt");
  assertIso(input.outcomeTarget.trial.observedAt, "Trial observedAt");
  if (input.outcomeTarget.mock.decision === null && input.outcomeTarget.mock.evidenceId !== null) {
    throw new Error("Missing Sandbox Mock outcome cannot carry evidenceId.");
  }
  if (
    input.outcomeTarget.trial.certificationDecision === null &&
    input.outcomeTarget.trial.evidenceId !== null &&
    input.outcomeTarget.trial.caseStatus === null
  ) {
    throw new Error("Missing Trial outcome cannot carry an orphan evidenceId.");
  }

  return input;
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

  if (input.capabilityEvidence.practicalOutcomes.some((proof) => proof.outcome === "integrity_review")) {
    return "integrity_block" as const;
  }
  if (input.capabilityEvidence.oralDefense.outcome === "integrity_review") {
    return "integrity_block" as const;
  }

  const observedPracticalProofs = input.capabilityEvidence.practicalOutcomes.filter(
    (proof) => proof.outcome !== null,
  );
  if (observedPracticalProofs.length !== CAPABILITY_PRACTICAL_PROOFS.length) return "missing" as const;
  if (input.capabilityEvidence.oralDefense.outcome === null) return "missing" as const;

  const readiness = evaluateCapabilityReadiness(CAPABILITY_MVP_SHADOW_GATE_V2, {
    passedAssessmentKeys: [],
    satisfiedEvidenceCells: input.capabilityEvidence.satisfiedEvidenceCellCodes,
    approvedPracticalProofKeys: observedPracticalProofs
      .filter((proof) => proof.outcome === "approved")
      .map((proof) => proof.proofKey),
    oralDefenseApproved: input.capabilityEvidence.oralDefense.outcome === "approved",
  });
  return readiness.status === "READY" ? ("ready" as const) : ("not_ready" as const);
}

export function buildShadowSpecialistConcordance(input: {
  battleTestDeepDives: ShadowBattleTestDeepDiveEvidence[];
  capabilityEvidence: ShadowCapabilityEvidenceInput;
  outcomeTarget: ShadowOutcomeTarget;
}): ShadowSpecialistConcordance {
  validateShadowConcordanceInput(input);

  const battleByDeepDive = new Map(
    input.battleTestDeepDives.map((entry) => [entry.deepDiveKey, entry] as const),
  );
  const evidenceCells = cellsByDeepDive();
  const satisfied = new Set(input.capabilityEvidence.satisfiedEvidenceCellCodes);
  const observed = new Set(input.capabilityEvidence.observedEvidenceCellCodes);

  const deepDives: ShadowDeepDiveComparison[] = CAPABILITY_DEEP_DIVE_BLUEPRINTS.map(({ key: deepDiveKey }) => {
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
    analysisKind: "descriptive_shadow_concordance",
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
    capabilitySimulationEvidence: input.capabilityEvidence.sandboxSimulation,
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

function emptyClassificationCounts(): Record<ShadowConcordanceClassification, number> {
  return {
    agree_ready: 0,
    agree_not_ready: 0,
    agree_integrity_block: 0,
    battle_test_only_ready: 0,
    capability_only_ready: 0,
    missing_comparison_evidence: 0,
    integrity_disagreement: 0,
    other_disagreement: 0,
  };
}

export function summarizeShadowConcordanceCohort(members: ShadowCohortMember[]) {
  const tutorIds = members.map((member) => member.tutorId);
  assertUnique(tutorIds, "Shadow concordance cohort tutor IDs");

  const classificationCounts = emptyClassificationCounts();
  for (const member of members) {
    if (member.comparison.authoritative !== false || member.comparison.cutoverDecision !== null) {
      throw new Error(`Shadow concordance member ${member.tutorId} is not advisory-only.`);
    }
    classificationCounts[member.comparison.overallClassification] += 1;
  }

  const comparable = members.filter(
    (member) => member.comparison.overallClassification !== "missing_comparison_evidence",
  );
  const agreements = comparable.filter((member) =>
    member.comparison.overallClassification === "agree_ready" ||
    member.comparison.overallClassification === "agree_not_ready" ||
    member.comparison.overallClassification === "agree_integrity_block",
  );
  const withMockOutcome = members.filter(
    (member) => member.comparison.outcomeTarget.mock.decision !== null,
  );
  const withTrialDecision = members.filter(
    (member) => member.comparison.outcomeTarget.trial.certificationDecision !== null,
  );

  const mockOutcomeByClassification = Object.fromEntries(
    Object.keys(classificationCounts).map((classification) => [
      classification,
      {
        passed: members.filter(
          (member) =>
            member.comparison.overallClassification === classification &&
            member.comparison.outcomeTarget.mock.decision === "passed",
        ).length,
        remediationRequired: members.filter(
          (member) =>
            member.comparison.overallClassification === classification &&
            member.comparison.outcomeTarget.mock.decision === "remediation_required",
        ).length,
      },
    ]),
  );

  const trialDecisionByClassification = Object.fromEntries(
    Object.keys(classificationCounts).map((classification) => [
      classification,
      {
        certified: members.filter(
          (member) =>
            member.comparison.overallClassification === classification &&
            member.comparison.outcomeTarget.trial.certificationDecision === "certified",
        ).length,
        remediationRequired: members.filter(
          (member) =>
            member.comparison.overallClassification === classification &&
            member.comparison.outcomeTarget.trial.certificationDecision === "remediation_required",
        ).length,
        unsuccessful: members.filter(
          (member) =>
            member.comparison.overallClassification === classification &&
            member.comparison.outcomeTarget.trial.certificationDecision === "unsuccessful",
        ).length,
      },
    ]),
  );

  return {
    authoritative: false as const,
    cutoverDecision: null,
    analysisKind: "descriptive_shadow_concordance" as const,
    sampleSize: members.length,
    comparableSampleSize: comparable.length,
    missingComparisonSampleSize: members.length - comparable.length,
    overallAgreementRate: comparable.length > 0 ? agreements.length / comparable.length : null,
    classificationCounts,
    mockOutcomeObservedCount: withMockOutcome.length,
    trialOutcomeObservedCount: withTrialDecision.length,
    mockOutcomeByClassification,
    trialDecisionByClassification,
    statisticalAnalysisPlanDefined: false as const,
    equivalenceEstablished: false as const,
    superiorityEstablished: false as const,
    predictiveValidityEstablished: false as const,
    strongCutoverClaimAllowed: false as const,
  };
}
