import { createHmac } from "crypto";
import { pool } from "./db";
import {
  projectSandboxScenarioToCurrentTrainingContract,
  validateSandboxScenarioDefinition,
  type SandboxScenarioDefinition,
} from "@shared/sandboxSimulation";
import {
  parseSandboxGraduationPolicy,
  type SandboxGraduationPolicy,
} from "@shared/sandboxGraduation";

export const DEFAULT_SANDBOX_BANK_KEY = "sandbox_observation_foundation";

const SANDBOX_SCENARIO_BANK_TRAINING_SCHEMA_VERSION: Record<number, number> = {
  1: 1,
  2: 1,
  3: 1,
};

const trainingSchemaVersionForScenarioBank = (bankVersion: number) => {
  const version = SANDBOX_SCENARIO_BANK_TRAINING_SCHEMA_VERSION[bankVersion];
  if (!version) {
    throw httpError(
      503,
      `Sandbox scenario bank v${bankVersion} has no declared Training observation schema authority.`,
    );
  }
  return version;
};


export type SandboxBankConfig = {
  bankKey: string;
  bankVersion: number;
  title: string;
  maxAttempts: number;
  graduationPolicy: SandboxGraduationPolicy | null;
  scenarios: SandboxScenarioDefinition[];
};

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function parseScenario(value: unknown): SandboxScenarioDefinition {
  return (
    typeof value === "string" ? JSON.parse(value) : value
  ) as SandboxScenarioDefinition;
}

export async function loadActiveSandboxBank(bankKey: string): Promise<SandboxBankConfig | null> {
  const bankResult = await pool.query(
    `SELECT bank_key, bank_version, title, max_attempts, graduation_policy
       FROM private.specialist_sandbox_scenario_banks
      WHERE bank_key = $1
        AND active = true
      LIMIT 1`,
    [bankKey],
  );
  const bank = bankResult.rows[0];
  if (!bank) return null;

  const scenarioResult = await pool.query(
    `SELECT scenario_key, scenario_version, definition
       FROM private.specialist_sandbox_scenarios
      WHERE bank_key = $1
        AND bank_version = $2
        AND active = true
      ORDER BY scenario_key ASC`,
    [bankKey, Number(bank.bank_version)],
  );

  const sourceTrainingSchemaVersion =
    trainingSchemaVersionForScenarioBank(Number(bank.bank_version));
  const scenarios = scenarioResult.rows.map((row) => {
    const storedScenario = parseScenario(row.definition);
    const scenario = projectSandboxScenarioToCurrentTrainingContract(
      storedScenario,
      sourceTrainingSchemaVersion,
    );
    validateSandboxScenarioDefinition(scenario);
    if (scenario.key !== String(row.scenario_key) || scenario.version !== Number(row.scenario_version)) {
      throw new Error(`Sandbox scenario metadata mismatch for ${String(row.scenario_key)}.`);
    }
    return scenario;
  });

  if (!scenarios.length) {
    throw httpError(503, "The active Sandbox bank contains no scenarios.");
  }

  return {
    bankKey: String(bank.bank_key),
    bankVersion: Number(bank.bank_version),
    title: String(bank.title),
    maxAttempts: Number(bank.max_attempts),
    graduationPolicy: bank.graduation_policy
      ? parseSandboxGraduationPolicy(bank.graduation_policy)
      : null,
    scenarios,
  };
}

async function attemptCount(input: {
  tutorAssignmentId: string;
  bankKey: string;
  bankVersion: number;
}) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS attempt_count
       FROM specialist_sandbox_simulation_attempts
      WHERE tutor_assignment_id = $1
        AND bank_key = $2
        AND bank_version = $3`,
    [input.tutorAssignmentId, input.bankKey, input.bankVersion],
  );
  return Number(result.rows[0]?.attempt_count || 0);
}

function getSandboxFormSecret() {
  const configured = String(
    process.env.SANDBOX_FORM_SECRET ||
    process.env.CAPABILITY_FORM_SECRET ||
    "",
  ).trim();
  if (configured) return configured;

  if (process.env.VERCEL_ENV === "preview") {
    const previewSessionSecret = String(process.env.SESSION_SECRET || "").trim();
    if (previewSessionSecret) {
      return createHmac("sha256", previewSessionSecret)
        .update("ri-sandbox-preview-form-secret-v1")
        .digest("hex");
    }
  }

  throw httpError(503, "Sandbox deterministic-form secret is not configured.");
}

function stableRotationSeed(input: {
  tutorAssignmentId: string;
  bankKey: string;
  bankVersion: number;
}) {
  const secret = getSandboxFormSecret();
  return createHmac("sha256", secret)
    .update(
      [
        "sandbox-v1",
        input.tutorAssignmentId,
        input.bankKey,
        input.bankVersion,
      ].join(":"),
    )
    .digest("hex");
}

export async function buildSandboxAttemptPlan(input: {
  tutorAssignmentId: string;
  bankKey?: string;
}) {
  const bankKey = input.bankKey || DEFAULT_SANDBOX_BANK_KEY;
  const bank = await loadActiveSandboxBank(bankKey);
  if (!bank) throw httpError(404, "Sandbox simulation bank is not active.");

  const completedAttempts = await attemptCount({
    tutorAssignmentId: input.tutorAssignmentId,
    bankKey: bank.bankKey,
    bankVersion: bank.bankVersion,
  });
  if (completedAttempts >= bank.maxAttempts) {
    throw httpError(409, "Maximum Sandbox simulation attempts reached for the active bank.");
  }

  const attemptNumber = completedAttempts + 1;
  const seed = stableRotationSeed({
    tutorAssignmentId: input.tutorAssignmentId,
    bankKey: bank.bankKey,
    bankVersion: bank.bankVersion,
  });
  const startIndex = Number.parseInt(seed.slice(0, 12), 16) % bank.scenarios.length;
  const scenarioIndex = (startIndex + attemptNumber - 1) % bank.scenarios.length;
  const scenario = bank.scenarios[scenarioIndex];

  const secret = getSandboxFormSecret();
  const scenarioFormId = createHmac("sha256", secret)
    .update(
      [
        "sandbox-form-v1",
        input.tutorAssignmentId,
        bank.bankKey,
        bank.bankVersion,
        attemptNumber,
        scenario.key,
        scenario.version,
      ].join(":"),
    )
    .digest("hex")
    .slice(0, 24);

  return {
    bank,
    scenario,
    attemptNumber,
    scenarioFormId,
  };
}
