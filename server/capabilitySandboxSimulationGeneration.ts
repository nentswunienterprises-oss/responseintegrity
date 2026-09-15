import { createHash, createHmac } from "node:crypto";
import {
  validateSandboxSimulationDefinition,
  type SandboxSimulationDefinition,
} from "@shared/capabilitySandboxSimulation";

export interface SandboxSimulationBankConfig {
  bankKey: string;
  bankVersion: number;
  maxAttempts: number;
  retryCooldownHours: number;
  scenarios: SandboxSimulationDefinition[];
}

export interface GeneratedSandboxSimulation {
  bankKey: string;
  bankVersion: number;
  attemptNumber: number;
  simulationFormId: string;
  definition: SandboxSimulationDefinition;
}

function stableRank(seed: string, value: string) {
  return createHash("sha256").update(`${seed}:${value}`).digest("hex");
}

function validateBank(config: SandboxSimulationBankConfig) {
  if (!config.bankKey.trim()) throw new Error("Sandbox simulation bank key is required.");
  if (!Number.isInteger(config.bankVersion) || config.bankVersion < 1) {
    throw new Error("Sandbox simulation bank version must be a positive integer.");
  }
  if (!Number.isInteger(config.maxAttempts) || config.maxAttempts < 1) {
    throw new Error("Sandbox simulation max attempts must be a positive integer.");
  }
  if (!Number.isFinite(config.retryCooldownHours) || config.retryCooldownHours < 0) {
    throw new Error("Sandbox simulation retry cooldown cannot be negative.");
  }
  if (!config.scenarios.length) throw new Error("Sandbox simulation bank must contain scenarios.");

  const scenarioKeys = config.scenarios.map((scenario) => scenario.key);
  if (new Set(scenarioKeys).size !== scenarioKeys.length) {
    throw new Error("Sandbox simulation bank contains duplicate scenario keys.");
  }
  for (const scenario of config.scenarios) validateSandboxSimulationDefinition(scenario);
}

export function createSandboxSimulationRotationSeed(input: {
  secret: string;
  tutorAssignmentId: string;
  bankKey: string;
  bankVersion: number;
}) {
  if (!input.secret.trim()) {
    throw new Error("CAPABILITY_SIMULATION_SECRET is required for Sandbox simulation rotation.");
  }
  return createHmac("sha256", input.secret)
    .update(
      [input.tutorAssignmentId, input.bankKey, String(input.bankVersion)].join(":"),
    )
    .digest("hex");
}

function baseOffset(seed: string, scenarioCount: number) {
  const prefix = seed.slice(0, 12);
  const numeric = Number.parseInt(prefix, 16);
  if (!Number.isFinite(numeric)) throw new Error("Invalid Sandbox simulation rotation seed.");
  return numeric % scenarioCount;
}

function projectAttemptPresentation(
  definition: SandboxSimulationDefinition,
  seed: string,
  attemptNumber: number,
): SandboxSimulationDefinition {
  return {
    ...definition,
    decisions: definition.decisions.map((decision) => {
      const optionSeed = `${seed}:scenario:${definition.key}:attempt:${attemptNumber}:options:${decision.key}`;
      return {
        ...decision,
        options: [...decision.options].sort((left, right) => {
          const leftRank = stableRank(optionSeed, left.key);
          const rightRank = stableRank(optionSeed, right.key);
          return leftRank.localeCompare(rightRank) || left.key.localeCompare(right.key);
        }),
      };
    }),
  };
}

function presentationSignature(definition: SandboxSimulationDefinition) {
  return definition.decisions
    .map((decision) => `${decision.key}[${decision.options.map((option) => option.key).join(",")}]`)
    .join("|");
}

export function generateDeterministicSandboxSimulation(input: {
  config: SandboxSimulationBankConfig;
  tutorAssignmentId: string;
  attemptNumber: number;
  secret: string;
}): GeneratedSandboxSimulation {
  validateBank(input.config);
  if (!input.tutorAssignmentId.trim()) {
    throw new Error("Sandbox simulation assignment identity is required.");
  }
  if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1) {
    throw new Error("Sandbox simulation attempt number must be a positive integer.");
  }

  const seed = createSandboxSimulationRotationSeed({
    secret: input.secret,
    tutorAssignmentId: input.tutorAssignmentId,
    bankKey: input.config.bankKey,
    bankVersion: input.config.bankVersion,
  });
  const offset = baseOffset(seed, input.config.scenarios.length);
  const index = (offset + input.attemptNumber - 1) % input.config.scenarios.length;
  const sourceDefinition = input.config.scenarios[index];
  const definition = projectAttemptPresentation(sourceDefinition, seed, input.attemptNumber);
  const simulationFormId = createHash("sha256")
    .update(
      [
        input.config.bankKey,
        String(input.config.bankVersion),
        input.tutorAssignmentId,
        String(input.attemptNumber),
        definition.key,
        String(definition.version),
        presentationSignature(definition),
        seed,
      ].join(":"),
    )
    .digest("hex")
    .slice(0, 24);

  return {
    bankKey: input.config.bankKey,
    bankVersion: input.config.bankVersion,
    attemptNumber: input.attemptNumber,
    simulationFormId,
    definition,
  };
}
