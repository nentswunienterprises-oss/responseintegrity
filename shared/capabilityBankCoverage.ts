import {
  CAPABILITY_CROSS_CUTTING_COMPETENCIES,
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  getCapabilityDeepDiveBlueprint,
  getRequiredCapabilityEvidenceCells,
  type CapabilityBlueprintEvidenceKind,
} from "./capabilityBlueprint";
import { getCapabilityMvpAssessmentPlanEntry } from "./capabilityAssessmentPlan";
import { buildCapabilityCriticalBoundaryRequirements } from "./capabilityCriticalCoverage";

export interface CapabilityBankCoverageItem {
  competencyKey: string;
  deepDiveKey: string;
  kind?: "single_choice" | "multi_select" | "sequence";
  correctOptionKeys?: string[];
  criticalFailOptionKeys?: string[];
  criticalBoundaryKeys?: string[];
}

export interface CapabilityBankCoverageAssessment {
  assessmentKey: string;
  assessmentDeepDiveKey: string;
  evidenceKind: CapabilityBlueprintEvidenceKind;
  formSize?: number;
  passThresholdPercent?: number;
  enforceMvpPlan?: boolean;
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

function sameStrings(left: string[], right: string[]) {
  const a = unique(left);
  const b = unique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function evidenceCellCode(deepDiveKey: string, evidenceKind: CapabilityBlueprintEvidenceKind) {
  return `deep_dive.${deepDiveKey}.${evidenceKind}`;
}

function isKnownCompetency(deepDiveKey: string, competencyKey: string) {
  const deepDive = getCapabilityDeepDiveBlueprint(deepDiveKey);
  if (!deepDive) return false;
  return (
    deepDive.competencyKeys.includes(competencyKey) ||
    CAPABILITY_CROSS_CUTTING_COMPETENCIES.includes(
      competencyKey as (typeof CAPABILITY_CROSS_CUTTING_COMPETENCIES)[number],
    )
  );
}

function validateCriticalBoundaryTags(assessment: CapabilityBankCoverageAssessment) {
  for (const item of assessment.items) {
    const blueprint = getCapabilityDeepDiveBlueprint(item.deepDiveKey);
    if (!blueprint) continue;
    const validBoundaryKeys = new Set(blueprint.criticalBoundaries.map((boundary) => boundary.key));
    const criticalBoundaryKeys = item.criticalBoundaryKeys || [];

    for (const boundaryKey of criticalBoundaryKeys) {
      if (!validBoundaryKeys.has(boundaryKey)) {
        throw new Error(
          `Capability assessment ${assessment.assessmentKey} item tags unknown critical boundary ${item.deepDiveKey}:${boundaryKey}.`,
        );
      }
    }

    if (assessment.enforceMvpPlan && criticalBoundaryKeys.length > 0) {
      if (item.kind === "sequence") {
        throw new Error(
          `Capability assessment ${assessment.assessmentKey} uses a sequence item for critical boundary ${criticalBoundaryKeys.join(", ")}; V1 critical-fail semantics require single-choice or multi-select items.`,
        );
      }
      if (!(item.criticalFailOptionKeys || []).length) {
        throw new Error(
          `Capability assessment ${assessment.assessmentKey} critical-boundary item must define at least one critical-fail option.`,
        );
      }
      const correct = new Set(item.correctOptionKeys || []);
      const overlap = (item.criticalFailOptionKeys || []).filter((optionKey) => correct.has(optionKey));
      if (overlap.length > 0) {
        throw new Error(
          `Capability assessment ${assessment.assessmentKey} critical-fail option cannot also be a correct option: ${overlap.join(", ")}.`,
        );
      }
    }
  }

  if (!assessment.enforceMvpPlan) return;

  for (const requirement of buildCapabilityCriticalBoundaryRequirements(assessment.assessmentKey)) {
    const representedBoundaryKeys = new Set(
      assessment.items
        .filter((item) => item.deepDiveKey === requirement.deepDiveKey)
        .flatMap((item) => item.criticalBoundaryKeys || [])
        .filter((boundaryKey) => requirement.boundaryKeys.includes(boundaryKey)),
    );

    if (representedBoundaryKeys.size < requirement.minimumDistinctBoundaries) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} has only ${representedBoundaryKeys.size} represented critical boundaries for ${requirement.deepDiveKey}; ${requirement.minimumDistinctBoundaries} are required.`,
      );
    }
  }
}

function validateReleasePoolBreadth(
  assessment: CapabilityBankCoverageAssessment,
  referencedDeepDiveKeys: string[],
) {
  if (!assessment.enforceMvpPlan) return;

  for (const deepDiveKey of referencedDeepDiveKeys) {
    const deepDive = getCapabilityDeepDiveBlueprint(deepDiveKey);
    if (!deepDive) continue;

    const representedBoundaries = new Set(
      assessment.items
        .filter((item) => item.deepDiveKey === deepDiveKey)
        .flatMap((item) => item.criticalBoundaryKeys || []),
    );
    const missingBoundaries = deepDive.criticalBoundaries
      .map((boundary) => boundary.key)
      .filter((boundaryKey) => !representedBoundaries.has(boundaryKey));

    if (missingBoundaries.length > 0) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} private pool omits canonical ${deepDiveKey} critical boundaries: ${missingBoundaries.join(", ")}.`,
      );
    }

    if (assessment.evidenceKind !== "mastery") {
      const distinctCompetencies = new Set(
        assessment.competencyBlueprint
          .filter((entry) => entry.deepDiveKey === deepDiveKey)
          .map((entry) => entry.competencyKey),
      );
      if (distinctCompetencies.size < 2) {
        throw new Error(
          `Capability assessment ${assessment.assessmentKey} must declare at least two distinct competencies for cumulative Deep Dive ${deepDiveKey}.`,
        );
      }
    }
  }
}

export function validateCapabilityAssessmentAgainstBlueprint(
  assessment: CapabilityBankCoverageAssessment,
) {
  const assessmentDeepDive = getCapabilityDeepDiveBlueprint(assessment.assessmentDeepDiveKey);
  if (assessment.assessmentDeepDiveKey !== "mixed" && !assessmentDeepDive) {
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

  const plan = getCapabilityMvpAssessmentPlanEntry(assessment.assessmentKey);
  if (plan && assessment.enforceMvpPlan) {
    if (assessment.evidenceKind !== plan.evidenceKind) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} must use ${plan.evidenceKind} evidence, not ${assessment.evidenceKind}.`,
      );
    }
    if (!sameStrings(referencedDeepDiveKeys, plan.coveredDeepDiveKeys)) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} does not match its planned Deep Dive coverage.`,
      );
    }
    if (assessment.formSize !== undefined && assessment.formSize !== plan.formSize) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} form size ${assessment.formSize} does not match planned size ${plan.formSize}.`,
      );
    }
    if (
      assessment.passThresholdPercent !== undefined &&
      assessment.passThresholdPercent !== plan.passThresholdPercent
    ) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} threshold ${assessment.passThresholdPercent} does not match planned threshold ${plan.passThresholdPercent}.`,
      );
    }
    if (assessment.items.length < plan.minimumItemPoolSize) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} requires at least ${plan.minimumItemPoolSize} private items; ${assessment.items.length} were supplied.`,
      );
    }
  }

  for (const entry of assessment.competencyBlueprint) {
    const deepDive = getCapabilityDeepDiveBlueprint(entry.deepDiveKey);
    if (!deepDive) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} blueprint references unknown Deep Dive ${entry.deepDiveKey}.`,
      );
    }
    if (!isKnownCompetency(entry.deepDiveKey, entry.competencyKey)) {
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
    if (!isKnownCompetency(item.deepDiveKey, item.competencyKey)) {
      throw new Error(
        `Capability assessment ${assessment.assessmentKey} item uses unknown competency ${item.deepDiveKey}:${item.competencyKey}.`,
      );
    }
  }

  if (assessment.evidenceKind === "mastery") {
    if (!assessmentDeepDive) {
      throw new Error(`Mastery assessment ${assessment.assessmentKey} must declare a real Deep Dive, not mixed.`);
    }
    if (referencedDeepDiveKeys.length !== 1 || referencedDeepDiveKeys[0] !== assessment.assessmentDeepDiveKey) {
      throw new Error(
        `Mastery assessment ${assessment.assessmentKey} must cover exactly its declared Deep Dive ${assessment.assessmentDeepDiveKey}.`,
      );
    }

    if (assessment.enforceMvpPlan) {
      const declaredCompetencies = new Set(
        assessment.competencyBlueprint
          .filter((entry) => entry.deepDiveKey === assessment.assessmentDeepDiveKey)
          .map((entry) => entry.competencyKey),
      );
      const missingCompetencies = assessmentDeepDive.competencyKeys.filter(
        (competencyKey) => !declaredCompetencies.has(competencyKey),
      );
      if (missingCompetencies.length > 0) {
        throw new Error(
          `Mastery assessment ${assessment.assessmentKey} omits declared ${assessment.assessmentDeepDiveKey} competencies: ${missingCompetencies.join(", ")}.`,
        );
      }
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

  validateReleasePoolBreadth(assessment, referencedDeepDiveKeys);
  validateCriticalBoundaryTags(assessment);

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
