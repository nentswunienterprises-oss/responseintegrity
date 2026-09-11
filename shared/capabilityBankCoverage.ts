import {
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  getCapabilityDeepDiveBlueprint,
  getRequiredCapabilityEvidenceCells,
  type CapabilityBlueprintEvidenceKind,
} from "./capabilityBlueprint";

export interface CapabilityBankCoverageItem {
  competencyKey: string;
  deepDiveKey: string;
}

export interface CapabilityBankCoverageAssessment {
  assessmentKey: string;
  assessmentDeepDiveKey: string;
  evidenceKind: CapabilityBlueprintEvidenceKind;
  competencyBlueprint: Array<{
    competencyKey: string;
    deepDiveKey: string;
    count: number;
  }>;
  items: CapabilityBankCoverageItem[];
}

export interface CapabilityBankCoverageSummary {
  coveredEvidenceCells: string[];
  missingEvidenceCells: string[];
  coverageByDeepDive: Array<{
    deepDiveKey: string;
    evidenceKinds: CapabilityBlueprintEvidenceKind[];
  }>;
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function evidenceCellCode(deepDiveKey: string, evidenceKind: CapabilityBlueprintEvidenceKind) {
  return `deep_dive.${deepDiveKey}.${evidenceKind}`;
}

export function validateCapabilityAssessmentAgainstBlueprint(
  assessment: CapabilityBankCoverageAssessment,
) {
  const assessmentDeepDive = getCapabilityDeepDiveBlueprint(assessment.assessmentDeepDiveKey);
  if (!assessmentDeepDive) {
    throw new Error(
      `Capability assessment ${assessment.assessmentKey} references unknown assessment Deep Dive ${assessment.assessmentDeepDiveKey}.`,
    );
  }

  const referencedDeepDiveKeys = unique([
    ...assessment.competencyBlueprint.map((entry) => entry.deepDiveKey),
    ...assessment.items.map((item) => item.deepDiveKey),
  ]);

  if (!referencedDeepDiveKeys.length) {
    throw new Error(`Capability assessment ${assessment.assessmentKey} has no Deep Dive coverage.`);
  }

  for (const entry of assessment.competencyBlueprint) {
    const deepDive = getCapabilityDeepDiveBlueprint(entry.deepDiveKey);
    if (!deepDive) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} blueprint references unknown Deep Dive ${entry.deepDiveKey}.`,
      );
    }
    if (!deepDive.competencyKeys.includes(entry.competencyKey)) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} blueprint uses unknown competency ${entry.deepDiveKey}:${entry.competencyKey}.`,
      );
    }

    const availableItems = assessment.items.filter(
      (item) => item.deepDiveKey === entry.deepDiveKey && item.competencyKey === entry.competencyKey,
    ).length;
    if (availableItems < entry.count) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} requires ${entry.count} item(s) for ${entry.deepDiveKey}:${entry.competencyKey} but only ${availableItems} exist.`,
      );
    }
  }

  for (const item of assessment.items) {
    const deepDive = getCapabilityDeepDiveBlueprint(item.deepDiveKey);
    if (!deepDive) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} item references unknown Deep Dive ${item.deepDiveKey}.`,
      );
    }
    if (!deepDive.competencyKeys.includes(item.competencyKey)) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} item uses unknown competency ${item.deepDiveKey}:${item.competencyKey}.`,
      );
    }
  }

  if (assessment.evidenceKind === "mastery") {
    if (referencedDeepDiveKeys.length !== 1 || referencedDeepDiveKeys[0] !== assessment.assessmentDeepDiveKey) {
      throw new Error(
        `Mastery assessment ${assessment.assessmentKey} must cover exactly its declared Deep Dive ${assessment.assessmentDeepDiveKey}.`,
      );
    }
  }

  if (assessment.evidenceKind === "transfer") {
    if (referencedDeepDiveKeys.length < 2) {
      throw new Error(`Transfer assessment ${assessment.assessmentKey} must interleave at least two Deep Dives.`);
    }

    const hasValidRelationship = referencedDeepDiveKeys.some((deepDiveKey) => {
      const deepDive = getCapabilityDeepDiveBlueprint(deepDiveKey);
      return deepDive?.transferPartners.some((partner) => referencedDeepDiveKeys.includes(partner)) || false;
    });
    if (!hasValidRelationship) {
      throw new Error(
        `Transfer assessment ${assessment.assessmentKey} does not cover a declared blueprint transfer relationship.`,
      );
    }
  }

  return {
    assessmentKey: assessment.assessmentKey,
    evidenceKind: assessment.evidenceKind,
    deepDiveKeys: referencedDeepDiveKeys,
    coveredEvidenceCells: referencedDeepDiveKeys.map((deepDiveKey) =>
      evidenceCellCode(deepDiveKey, assessment.evidenceKind),
    ),
  };
}

export function summarizeCapabilityBankCoverage(
  assessments: CapabilityBankCoverageAssessment[],
): CapabilityBankCoverageSummary {
  const coverage = assessments.map(validateCapabilityAssessmentAgainstBlueprint);
  const coveredEvidenceCells = unique(coverage.flatMap((assessment) => assessment.coveredEvidenceCells));
  const requiredEvidenceCells = getRequiredCapabilityEvidenceCells().map((cell) => cell.code);
  const covered = new Set(coveredEvidenceCells);
  const missingEvidenceCells = requiredEvidenceCells.filter((cell) => !covered.has(cell));

  const coverageByDeepDive = CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive) => ({
    deepDiveKey: deepDive.key,
    evidenceKinds: deepDive.requiredEvidenceKinds.filter((evidenceKind) =>
      covered.has(evidenceCellCode(deepDive.key, evidenceKind)),
    ),
  }));

  return {
    coveredEvidenceCells,
    missingEvidenceCells,
    coverageByDeepDive,
  };
}
