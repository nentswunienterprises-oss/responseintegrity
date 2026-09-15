export type CapabilityDossierAssessmentPlan = {
  assessmentKey: string;
  title: string;
  evidenceKind: "mastery" | "retrieval" | "transfer";
  coveredDeepDiveKeys: string[];
};

export type CapabilityDossierAssessmentAttempt = {
  evidenceId: string;
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  evidenceKind: string;
  coveredDeepDiveKeys: string[];
  totalQuestions: number;
  correctQuestions: number;
  percent: number;
  hasCriticalFail: boolean;
  passed: boolean;
  completedAt: string | Date;
};

export type CapabilityDossierPracticalDefinition = {
  proofKey: string;
  title: string;
  proofVersion: number;
};

export type CapabilityDossierPracticalAttempt = {
  evidenceId: string;
  proofKey: string;
  proofVersion: number;
  rubricVersion: number | null;
  attemptNumber: number;
  outcome: string;
  reasonCode: string | null;
  feedback: string | null;
  counts: { clear: number; partial: number; fail: number; criticalFail: number } | null;
  submittedAt: string | Date;
  reviewedAt: string | Date | null;
};

export type CapabilityDossierOralAttempt = {
  evidenceId: string;
  defenseVersion: number;
  attemptNumber: number;
  outcome: string;
  counts: { clear: number; partial: number; fail: number; criticalFail: number };
  feedback: string | null;
  completedAt: string | Date;
};

export type CapabilityDossierSimulationAttempt = {
  evidenceId: string;
  bankKey: string;
  bankVersion: number;
  attemptNumber: number;
  scenarioKey: string;
  scenarioVersion: number;
  totalDecisions: number;
  correctDecisions: number;
  percent: number;
  passed: boolean;
  hasCriticalFail: boolean;
  evidenceContaminationCount: number;
  authorityViolationCount: number;
  escalationFailureCount: number;
  authoritative: false;
  completedAt: string | Date;
};

export type CapabilityDossierFlag = {
  code: string;
  detail: string;
  kind: "missing" | "stale" | "conflict";
};

function latestByAttempt<T extends { attemptNumber: number }>(rows: T[]) {
  return rows.reduce<T | null>((latest, row) => {
    if (!latest || row.attemptNumber > latest.attemptNumber) return row;
    return latest;
  }, null);
}

function duplicateKeys(rows: Array<{ key: string; version: number }>) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.key, (counts.get(row.key) || 0) + 1);
  return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key);
}

export function buildCapabilityMockDossierSnapshot(input: {
  requiredEvidenceCellCodes: string[];
  satisfiedEvidenceCellCodes: string[];
  assessmentPlan: CapabilityDossierAssessmentPlan[];
  activeAssessmentVersions: Array<{ key: string; version: number }>;
  assessmentAttempts: CapabilityDossierAssessmentAttempt[];
  practicalDefinitions: CapabilityDossierPracticalDefinition[];
  practicalAttempts: CapabilityDossierPracticalAttempt[];
  currentOralDefenseVersion: number;
  oralAttempts: CapabilityDossierOralAttempt[];
  simulationBankKey: string;
  activeSimulationBankVersions: number[];
  simulationAttempts: CapabilityDossierSimulationAttempt[];
}) {
  const flags: CapabilityDossierFlag[] = [];
  const activeAssessmentVersions = new Map<string, number>();

  for (const key of duplicateKeys(input.activeAssessmentVersions.map((row) => ({ key: row.key, version: row.version })))) {
    flags.push({
      code: `assessment_active_bank_conflict.${key}`,
      detail: `More than one active private bank version is visible for ${key}.`,
      kind: "conflict",
    });
  }
  for (const row of input.activeAssessmentVersions) {
    if (!activeAssessmentVersions.has(row.key)) activeAssessmentVersions.set(row.key, row.version);
  }

  const assessments = input.assessmentPlan.map((plan) => {
    const activeBankVersion = activeAssessmentVersions.get(plan.assessmentKey) ?? null;
    const rowsForKey = input.assessmentAttempts.filter((row) => row.assessmentKey === plan.assessmentKey);
    const currentRows = activeBankVersion === null
      ? []
      : rowsForKey.filter((row) => row.bankVersion === activeBankVersion);
    const latestCurrentAttempt = latestByAttempt(currentRows);
    const staleAttemptCount = rowsForKey.filter((row) => row.bankVersion !== activeBankVersion).length;

    const status = activeBankVersion === null
      ? "bank_unavailable"
      : !latestCurrentAttempt
        ? "not_attempted_current_bank"
        : latestCurrentAttempt.passed
          ? "passed"
          : "failed";

    if (activeBankVersion === null) {
      flags.push({
        code: `assessment_bank_missing.${plan.assessmentKey}`,
        detail: `${plan.title} has no active private bank.`,
        kind: "missing",
      });
    } else if (!latestCurrentAttempt) {
      flags.push({
        code: `assessment_current_evidence_missing.${plan.assessmentKey}`,
        detail: `${plan.title} has no attempt on the active bank version.`,
        kind: "missing",
      });
    }
    if (staleAttemptCount > 0) {
      flags.push({
        code: `assessment_stale_history.${plan.assessmentKey}`,
        detail: `${staleAttemptCount} historical attempt(s) use a retired bank version.`,
        kind: "stale",
      });
    }
    if (latestCurrentAttempt?.passed && latestCurrentAttempt.hasCriticalFail) {
      flags.push({
        code: `assessment_internal_conflict.${plan.assessmentKey}`,
        detail: `${plan.title} is marked passed while its latest current attempt also records a critical fail.`,
        kind: "conflict",
      });
    }

    return {
      ...plan,
      activeBankVersion,
      latestCurrentAttempt,
      staleAttemptCount,
      status,
    } as const;
  });

  const practicals = input.practicalDefinitions.map((definition) => {
    const rowsForProof = input.practicalAttempts.filter((row) => row.proofKey === definition.proofKey);
    const currentRows = rowsForProof.filter((row) => row.proofVersion === definition.proofVersion);
    const latestCurrentAttempt = latestByAttempt(currentRows);
    const staleAttemptCount = rowsForProof.filter((row) => row.proofVersion !== definition.proofVersion).length;

    if (!latestCurrentAttempt) {
      flags.push({
        code: `practical_current_evidence_missing.${definition.proofKey}`,
        detail: `${definition.title} has no current-version submission.`,
        kind: "missing",
      });
    }
    if (staleAttemptCount > 0) {
      flags.push({
        code: `practical_stale_history.${definition.proofKey}`,
        detail: `${staleAttemptCount} historical practical attempt(s) use an older proof version.`,
        kind: "stale",
      });
    }

    return {
      ...definition,
      currentProofVersion: definition.proofVersion,
      latestCurrentAttempt,
      staleAttemptCount,
      status: latestCurrentAttempt?.outcome || "missing_current",
    };
  });

  const currentOralRows = input.oralAttempts.filter(
    (row) => row.defenseVersion === input.currentOralDefenseVersion,
  );
  const latestOralDefense = latestByAttempt(currentOralRows);
  const staleOralDefenseCount = input.oralAttempts.length - currentOralRows.length;
  if (!latestOralDefense) {
    flags.push({
      code: "oral_defense_current_evidence_missing",
      detail: `No Oral Integrity Defense V${input.currentOralDefenseVersion} evidence exists.`,
      kind: "missing",
    });
  }
  if (staleOralDefenseCount > 0) {
    flags.push({
      code: "oral_defense_stale_history",
      detail: `${staleOralDefenseCount} historical Oral Defense attempt(s) use an older defense version.`,
      kind: "stale",
    });
  }

  if (input.activeSimulationBankVersions.length > 1) {
    flags.push({
      code: "sandbox_simulation_active_bank_conflict",
      detail: "More than one active Sandbox simulation bank version is visible.",
      kind: "conflict",
    });
  }
  const activeSimulationBankVersion = input.activeSimulationBankVersions[0] ?? null;
  const simulationRowsForBank = input.simulationAttempts.filter(
    (row) => row.bankKey === input.simulationBankKey,
  );
  const currentSimulationAttempts = activeSimulationBankVersion === null
    ? []
    : simulationRowsForBank.filter((row) => row.bankVersion === activeSimulationBankVersion);
  const staleSimulationAttemptCount = activeSimulationBankVersion === null
    ? simulationRowsForBank.length
    : simulationRowsForBank.filter((row) => row.bankVersion !== activeSimulationBankVersion).length;

  if (activeSimulationBankVersion === null) {
    flags.push({
      code: "sandbox_simulation_bank_missing",
      detail: "No active Sandbox simulation bank exists.",
      kind: "missing",
    });
  }
  if (staleSimulationAttemptCount > 0) {
    flags.push({
      code: "sandbox_simulation_stale_history",
      detail: `${staleSimulationAttemptCount} Sandbox simulation attempt(s) use a retired bank version.`,
      kind: "stale",
    });
  }

  const requiredCells = Array.from(new Set(input.requiredEvidenceCellCodes));
  const satisfiedCellSet = new Set(input.satisfiedEvidenceCellCodes);
  const evidenceCells = requiredCells.map((code) => ({ code, satisfied: satisfiedCellSet.has(code) }));

  const supportByCell = new Map<string, string[]>();
  for (const plan of input.assessmentPlan) {
    for (const deepDiveKey of plan.coveredDeepDiveKeys) {
      const code = `deep_dive.${deepDiveKey}.${plan.evidenceKind}`;
      supportByCell.set(code, [...(supportByCell.get(code) || []), plan.assessmentKey]);
    }
  }
  for (const cell of evidenceCells) {
    const supportingKeys = supportByCell.get(cell.code) || [];
    const hasCurrentPassedSupport = assessments.some(
      (assessment) => supportingKeys.includes(assessment.assessmentKey) && assessment.status === "passed",
    );
    if (cell.satisfied && supportingKeys.length > 0 && !hasCurrentPassedSupport) {
      flags.push({
        code: `evidence_cell_conflict.${cell.code}`,
        detail: `${cell.code} is marked satisfied but no supporting planned assessment currently passes on its active bank.`,
        kind: "conflict",
      });
    }
    if (!cell.satisfied && hasCurrentPassedSupport) {
      flags.push({
        code: `evidence_cell_selection_conflict.${cell.code}`,
        detail: `${cell.code} is unsatisfied even though a supporting planned assessment currently passes.`,
        kind: "conflict",
      });
    }
  }

  return {
    evidenceCellSummary: {
      satisfied: evidenceCells.filter((cell) => cell.satisfied).length,
      required: evidenceCells.length,
      cells: evidenceCells,
    },
    assessments,
    practicals,
    oralDefense: {
      currentDefenseVersion: input.currentOralDefenseVersion,
      latestCurrentAttempt: latestOralDefense,
      staleAttemptCount: staleOralDefenseCount,
    },
    sandboxSimulation: {
      bankKey: input.simulationBankKey,
      activeBankVersion: activeSimulationBankVersion,
      currentVersionAttempts: currentSimulationAttempts,
      staleAttemptCount: staleSimulationAttemptCount,
      authoritative: false as const,
    },
    flags,
  };
}
