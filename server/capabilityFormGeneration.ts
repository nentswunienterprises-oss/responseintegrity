import { createHash, createHmac } from "node:crypto";
import {
  validateCapabilityAssessmentDefinition,
  type CapabilityAssessmentDefinition,
  type CapabilityEvidenceKind,
  type CapabilityQuestionDefinition,
} from "@shared/capabilityEngine";

export interface CapabilityCompetencyBlueprintEntry {
  competencyKey: string;
  deepDiveKey: string;
  count: number;
}

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
      `Capability blueprint requires ${requiredCount} items but form size is ${config.formSize}.`
    );
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
  itemPool: CapabilityQuestionDefinition[],
  seed: string,
): GeneratedCapabilityForm {
  validateConfig(config);

  const selected: CapabilityQuestionDefinition[] = [];
  const selectedKeys = new Set<string>();

  for (const requirement of config.competencyBlueprint) {
    const eligible = itemPool
      .filter(
        (item) =>
          item.competencyKey === requirement.competencyKey &&
          (item.deepDiveKey || config.assessmentDeepDiveKey) === requirement.deepDiveKey &&
          !selectedKeys.has(item.key),
      )
      .sort((left, right) => {
        const leftRank = stableRank(seed, left.key);
        const rightRank = stableRank(seed, right.key);
        return leftRank.localeCompare(rightRank) || left.key.localeCompare(right.key);
      });

    if (eligible.length < requirement.count) {
      throw new Error(
        `Capability bank does not contain enough items for ${requirement.competencyKey} (${requirement.deepDiveKey}).`
      );
    }

    for (const item of eligible.slice(0, requirement.count)) {
      selected.push(item);
      selectedKeys.add(item.key);
    }
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
