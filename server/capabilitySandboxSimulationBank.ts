import { pool } from "./db";
import {
  generateDeterministicSandboxSimulation,
  type GeneratedSandboxSimulation,
  type SandboxSimulationBankConfig,
} from "./capabilitySandboxSimulationGeneration";
import {
  validateSandboxSimulationDefinition,
  type SandboxSimulationDefinition,
} from "@shared/capabilitySandboxSimulation";

export const DEFAULT_SANDBOX_SIMULATION_BANK_KEY = "sandbox_foundation";

export interface SandboxSimulationAttemptPlan {
  config: SandboxSimulationBankConfig;
  generated: GeneratedSandboxSimulation;
  attemptNumber: number;
}

function parseDefinition(value: unknown): SandboxSimulationDefinition {
  const definition =
    typeof value === "string" ? JSON.parse(value) : (value as SandboxSimulationDefinition);
  validateSandboxSimulationDefinition(definition);
  return definition;
}

async function loadActiveBank(bankKey: string): Promise<SandboxSimulationBankConfig | null> {
  const bankResult = await pool.query(
    `SELECT bank_key,
            bank_version,
            max_attempts,
            retry_cooldown_hours
       FROM private.specialist_capability_simulation_banks
      WHERE bank_key = $1
        AND active = true
      LIMIT 1`,
    [bankKey],
  );
  const bank = bankResult.rows[0];
  if (!bank) return null;

  const scenarioResult = await pool.query(
    `SELECT scenario_key,
            scenario_version,
            definition
       FROM private.specialist_capability_simulation_scenarios
      WHERE bank_key = $1
        AND bank_version = $2
        AND active = true
      ORDER BY scenario_key ASC`,
    [bankKey, Number(bank.bank_version)],
  );

  const scenarios = scenarioResult.rows.map((row) => {
    const definition = parseDefinition(row.definition);
    if (definition.key !== String(row.scenario_key)) {
      throw new Error(
        `Sandbox simulation scenario key mismatch for ${String(row.scenario_key)}.`,
      );
    }
    if (definition.version !== Number(row.scenario_version)) {
      throw new Error(
        `Sandbox simulation scenario version mismatch for ${String(row.scenario_key)}.`,
      );
    }
    return definition;
  });

  return {
    bankKey: String(bank.bank_key),
    bankVersion: Number(bank.bank_version),
    maxAttempts: Number(bank.max_attempts),
    retryCooldownHours: Number(bank.retry_cooldown_hours),
    scenarios,
  };
}

async function getAttemptState(input: {
  tutorAssignmentId: string;
  bankKey: string;
  bankVersion: number;
}) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS attempt_count,
            MAX(completed_at) AS latest_completed_at
       FROM specialist_capability_sandbox_simulation_attempts
      WHERE tutor_assignment_id = $1
        AND bank_key = $2
        AND bank_version = $3`,
    [input.tutorAssignmentId, input.bankKey, input.bankVersion],
  );

  return {
    attemptCount: Number(result.rows[0]?.attempt_count || 0),
    latestCompletedAt: result.rows[0]?.latest_completed_at
      ? new Date(result.rows[0].latest_completed_at)
      : null,
  };
}

function enforceRetryPolicy(
  config: SandboxSimulationBankConfig,
  state: { attemptCount: number; latestCompletedAt: Date | null },
) {
  if (state.attemptCount >= config.maxAttempts) {
    const error = new Error("Maximum Sandbox simulation attempts reached.") as Error & {
      status?: number;
    };
    error.status = 409;
    throw error;
  }

  if (config.retryCooldownHours > 0 && state.latestCompletedAt) {
    const eligibleAt = new Date(
      state.latestCompletedAt.getTime() + config.retryCooldownHours * 60 * 60 * 1000,
    );
    if (eligibleAt.getTime() > Date.now()) {
      const error = new Error(
        `Sandbox simulation retry is not available until ${eligibleAt.toISOString()}.`,
      ) as Error & { status?: number };
      error.status = 409;
      throw error;
    }
  }
}

export async function buildSandboxSimulationAttemptPlan(input: {
  tutorAssignmentId: string;
  bankKey?: string;
}): Promise<SandboxSimulationAttemptPlan> {
  const bankKey = input.bankKey || DEFAULT_SANDBOX_SIMULATION_BANK_KEY;
  const config = await loadActiveBank(bankKey);
  if (!config) {
    const error = new Error("Sandbox simulation bank is not active.") as Error & {
      status?: number;
    };
    error.status = 404;
    throw error;
  }

  const state = await getAttemptState({
    tutorAssignmentId: input.tutorAssignmentId,
    bankKey: config.bankKey,
    bankVersion: config.bankVersion,
  });
  enforceRetryPolicy(config, state);

  const attemptNumber = state.attemptCount + 1;
  const generated = generateDeterministicSandboxSimulation({
    config,
    tutorAssignmentId: input.tutorAssignmentId,
    attemptNumber,
    secret: process.env.CAPABILITY_SIMULATION_SECRET || "",
  });

  return { config, generated, attemptNumber };
}
