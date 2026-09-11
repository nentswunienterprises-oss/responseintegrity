import { createHash, createHmac } from "node:crypto";
import {
  validateCapabilityAssessmentDefinition,
  type CapabilityAssessmentDefinition,
  type CapabilityEvidenceKind,
  type CapabilityQuestionDefinition,
} from "@shared/capabilityEngine";
import type { CapabilityCriticalBoundaryRequirement } from "@shared/capabilityCriticalCoverage";

export interface CapabilityCompetencyBlueprintEntry {
  competencyKey: string;
  deepDiveKey: string;
  count: number;
}

export type CapabilityBoundaryTaggedQuestion = CapabilityQuestionDefinition & {
  criticalBoundaryKeys?: string[];
};

export interface PrivateCapabilityAssessmentConfig {
  assessmentKey: string;
  bankVersion: number;
  title: string;
  assessmentDeepDiveKey: string;
  evidenceKind: CapabilityEvidenceKind;
  passThresholdPercent: number;
  formSize: number;
  maxAttempts: number;
  retryCooldownHours: number;
  competencyBlueprint: CapabilityCompetencyBlueprintEntry[];
  criticalBoundaryRequirements?: CapabilityCriticalBoundaryRequirement[];
}

export interface GeneratedCapabilityForm {
  formId: string;
  bankVersion: number;
  definition: CapabilityAssessmentDefinition;
  itemKeys: string[];
}

function stableRank(seed: string, value: string) {
  return createHash("sha256").update(`${seed}:${value}`).digest("hex");
}

function competencyIdentity(entry: { competencyKey: string; deepDiveKey: string }) {
  return `${entry.deepDiveKey}:${entry.competencyKey}`;
}

function validateConfig(config: PrivateCapabilityAssessmentConfig) {
  if (!Number.isInteger(config.bankVersion) || config.bankVersion < 1) {
    throw new Error("Capability bank version must be a positive integer.");
  }
  if (!Number.isInteger(config.formSize) || config.formSize < 1) {
    throw new Error("Capability form size must be a positive integer.");
  }
  if (!Number.isInteger(config.maxAttempts) || config.maxAttempts < 1) {
    throw new Error("Capability max attempts must be a positive integer.");
  }
  if (!Number.isFinite(config.retryCooldownHours) || config.retryCooldownHours < 0) {
    throw new Error("Capability retry cooldown cannot be negative.");
  }

  const requiredCount = config.competencyBlueprint.reduce((sum, entry) => sum + entry.count, 0);
  if (requiredCount !== config.formSize) {
    throw new Error(
      `Capability blueprint requires ${requiredCount} items but form size is ${config.formSize}.`,
    );
  }

  const competencyIds = config.competencyBlueprint.map(competencyIdentity);
  if (new Set(competencyIds).size !== competencyIds.length) {
    throw new Error("Capability competency blueprint contains duplicate Deep Dive/competency entries.");
  }

  for (const requirement of config.criticalBoundaryRequirements || []) {
    if (!requirement.deepDiveKey.trim() || requirement.boundaryKeys.length === 0) {
      throw new Error("Critical-boundary requirement must identify a Deep Dive and at least one boundary.");
    }
    if (
      !Number.isInteger(requirement.minimumDistinctBoundaries) ||
      requirement.minimumDistinctBoundaries < 1 ||
      requirement.minimumDistinctBoundaries > new Set(requirement.boundaryKeys).size
    ) {
      throw new Error(`Invalid critical-boundary quota for ${requirement.deepDiveKey}.`);
    }
  }
}

function validateItemPool(itemPool: CapabilityBoundaryTaggedQuestion[]) {
  const itemKeys = new Set<string>();
  for (const item of itemPool) {
    if (itemKeys.has(item.key)) {
      throw new Error(`Capability item pool contains duplicate item key ${item.key}.`);
    }
    itemKeys.add(item.key);

    const criticalFailOptionKeys = item.criticalFailOptionKeys || [];
    if (item.kind === "sequence" && criticalFailOptionKeys.length > 0) {
      throw new Error(
        `Capability sequence item ${item.key} cannot use option-based critical-fail semantics in V1.`,
      );
    }

    const correct = new Set(item.correctOptionKeys);
    const overlap = criticalFailOptionKeys.filter((optionKey) => correct.has(optionKey));
    if (overlap.length > 0) {
      throw new Error(
        `Capability item ${item.key} marks correct option(s) as critical fail: ${overlap.join(", ")}.`,
      );
    }

    if ((item.criticalBoundaryKeys || []).length > 0 && criticalFailOptionKeys.length === 0) {
      throw new Error(
        `Capability critical-boundary item ${item.key} must define a critical-fail option.`,
      );
    }
  }
}

export function createCapabilityFormSeed(input: {
  secret: string;
  tutorAssignmentId: string;
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
}) {
  if (!input.secret.trim()) {
    throw new Error("CAPABILITY_FORM_SECRET is required for capability form generation.");
  }

  return createHmac("sha256", input.secret)
    .update(
      [
        input.tutorAssignmentId,
        input.assessmentKey,
        String(input.bankVersion),
        String(input.attemptNumber),
      ].join(":"),
    )
    .digest("hex");
}

export function generateDeterministicCapabilityForm(
  config: PrivateCapabilityAssessmentConfig,
  itemPool: CapabilityBoundaryTaggedQuestion[],
  seed: string,
): GeneratedCapabilityForm {
  validateConfig(config);
  validateItemPool(itemPool);

  const selected: CapabilityBoundaryTaggedQuestion[] = [];
  const selectedKeys = new Set<string>();
  const selectedCompetencyCounts = new Map<string, number>();
  const competencyRequirements = new Map(
    config.competencyBlueprint.map((entry) => [competencyIdentity(entry), entry] as const),
  );

  const itemDeepDive = (item: CapabilityBoundaryTaggedQuestion) =>
    item.deepDiveKey || config.assessmentDeepDiveKey;

  const canSelectWithinCompetencyQuota = (item: CapabilityBoundaryTaggedQuestion) => {
    const identity = competencyIdentity({
      competencyKey: item.competencyKey,
      deepDiveKey: itemDeepDive(item),
    });
    const requirement = competencyRequirements.get(identity);
    if (!requirement) return false;
    return (selectedCompetencyCounts.get(identity) || 0) < requirement.count;
  };

  const selectItem = (item: CapabilityBoundaryTaggedQuestion) => {
    const identity = competencyIdentity({
      competencyKey: item.competencyKey,
      deepDiveKey: itemDeepDive(item),
    });
    selected.push(item);
    selectedKeys.add(item.key);
    selectedCompetencyCounts.set(identity, (selectedCompetencyCounts.get(identity) || 0) + 1);
  };

  for (const requirement of config.criticalBoundaryRequirements || []) {
    const boundaryKeys = Array.from(new Set(requirement.boundaryKeys)).sort((left, right) => {
      const leftRank = stableRank(`${seed}:critical-boundary:${requirement.deepDiveKey}`, left);
      const rightRank = stableRank(`${seed}:critical-boundary:${requirement.deepDiveKey}`, right);
      return leftRank.localeCompare(rightRank) || left.localeCompare(right);
    });

    const targetBoundaries = boundaryKeys.slice(0, requirement.minimumDistinctBoundaries);
    for (const boundaryKey of targetBoundaries) {
      const eligible = itemPool
        .filter(
          (item) =>
            itemDeepDive(item) === requirement.deepDiveKey &&
            (item.criticalBoundaryKeys || []).includes(boundaryKey) &&
            !selectedKeys.has(item.key) &&
            canSelectWithinCompetencyQuota(item),
        )
        .sort((left, right) => {
          const boundarySeed = `${seed}:critical-item:${requirement.deepDiveKey}:${boundaryKey}`;
          const leftRank = stableRank(boundarySeed, left.key);
          const rightRank = stableRank(boundarySeed, right.key);
          return leftRank.localeCompare(rightRank) || left.key.localeCompare(right.key);
        });

      if (!eligible.length) {
        throw new Error(
          `Capability bank cannot satisfy critical boundary ${boundaryKey} (${requirement.deepDiveKey}) inside the competency form quotas.`,
        );
      }

      selectItem(eligible[0]);
    }
  }

  for (const requirement of config.competencyBlueprint) {
    const identity = competencyIdentity(requirement);
    const alreadySelected = selectedCompetencyCounts.get(identity) || 0;
    const remainingRequired = requirement.count - alreadySelected;
    if (remainingRequired < 0) {
      throw new Error(`Critical-boundary selection exceeded competency quota for ${identity}.`);
    }
    if (remainingRequired === 0) continue;

    const eligible = itemPool
      .filter(
        (item) =>
          item.competencyKey === requirement.competencyKey &&
          itemDeepDive(item) === requirement.deepDiveKey &&
          !selectedKeys.has(item.key),
      )
      .sort((left, right) => {
        const leftRank = stableRank(seed, left.key);
        const rightRank = stableRank(seed, right.key);
        return leftRank.localeCompare(rightRank) || left.key.localeCompare(right.key);
      });

    if (eligible.length < remainingRequired) {
      throw new Error(
        `Capability bank does not contain enough items for ${requirement.competencyKey} (${requirement.deepDiveKey}).`,
      );
    }

    for (const item of eligible.slice(0, remainingRequired)) {
      selectItem(item);
    }
  }

  if (selected.length !== config.formSize) {
    throw new Error(
      `Capability form generation selected ${selected.length} items but expected ${config.formSize}.`,
    );
  }

  const ordered = [...selected]
    .sort((left, right) => {
      const leftRank = stableRank(`${seed}:order`, left.key);
      const rightRank = stableRank(`${seed}:order`, right.key);
      return leftRank.localeCompare(rightRank) || left.key.localeCompare(right.key);
    })
    .map((item) => ({
      ...item,
      options: [...item.options].sort((left, right) => {
        const optionSeed = `${seed}:options:${item.key}`;
        const leftRank = stableRank(optionSeed, left.key);
        const rightRank = stableRank(optionSeed, right.key);
        return leftRank.localeCompare(rightRank) || left.key.localeCompare(right.key);
      }),
    }));

  const itemKeys = ordered.map((item) => item.key);
  const presentationSignature = ordered
    .map((item) => `${item.key}[${item.options.map((option) => option.key).join(",")}]`)
    .join("|");
  const formId = createHash("sha256")
    .update(`${config.assessmentKey}:${config.bankVersion}:${presentationSignature}`)
    .digest("hex")
    .slice(0, 24);

  const definition: CapabilityAssessmentDefinition = {
    key: config.assessmentKey,
    deepDiveKey: config.assessmentDeepDiveKey,
    title: config.title,
    evidenceKind: config.evidenceKind,
    passThresholdPercent: config.passThresholdPercent,
    questions: ordered,
  };

  validateCapabilityAssessmentDefinition(definition);

  return {
    formId,
    bankVersion: config.bankVersion,
    itemKeys,
    definition,
  };
}
