import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  validateSandboxSimulationDefinition,
  type SandboxSimulationDefinition,
} from "../shared/capabilitySandboxSimulation";
import { validateSandboxSimulationAgainstCapabilityBlueprint } from "../shared/capabilitySandboxSimulationBlueprint";

type PrivateSimulationBankPayload = {
  bankKey: string;
  bankVersion: number;
  title: string;
  maxAttempts?: number;
  retryCooldownHours?: number;
  scenarios: SandboxSimulationDefinition[];
};

type DatabasePool = {
  query: (text: string, params?: unknown[]) => Promise<{ rowCount: number | null }>;
  connect: () => Promise<{
    query: (text: string, params?: unknown[]) => Promise<unknown>;
    release: () => void;
  }>;
  end: () => Promise<void>;
};

function readArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  if (!fileArg) {
    throw new Error(
      "Usage: tsx scripts/import-private-sandbox-simulation-bank.ts <private-bank.json> [--apply]",
    );
  }
  return { apply, filePath: path.resolve(fileArg) };
}

function parsePayload(filePath: string): PrivateSimulationBankPayload {
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<PrivateSimulationBankPayload>;
  const bankKey = String(payload.bankKey || "").trim();
  const title = String(payload.title || "").trim();
  const bankVersion = Number(payload.bankVersion);
  const maxAttempts = payload.maxAttempts === undefined ? 6 : Number(payload.maxAttempts);
  const retryCooldownHours =
    payload.retryCooldownHours === undefined ? 0 : Number(payload.retryCooldownHours);

  if (!bankKey) throw new Error("Sandbox simulation bankKey is required.");
  if (!title) throw new Error("Sandbox simulation bank title is required.");
  if (!Number.isInteger(bankVersion) || bankVersion < 1) {
    throw new Error("Sandbox simulation bankVersion must be a positive integer.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Sandbox simulation maxAttempts must be a positive integer.");
  }
  if (!Number.isFinite(retryCooldownHours) || retryCooldownHours < 0) {
    throw new Error("Sandbox simulation retryCooldownHours cannot be negative.");
  }
  if (!Array.isArray(payload.scenarios) || payload.scenarios.length < 2) {
    throw new Error("Private Sandbox simulation bank must contain at least two scenarios for rotation.");
  }

  const scenarioKeys = new Set<string>();
  for (const scenario of payload.scenarios) {
    validateSandboxSimulationDefinition(scenario);
    validateSandboxSimulationAgainstCapabilityBlueprint(scenario);
    if (scenarioKeys.has(scenario.key)) {
      throw new Error(`Duplicate Sandbox simulation scenario key: ${scenario.key}`);
    }
    scenarioKeys.add(scenario.key);
  }

  return {
    bankKey,
    bankVersion,
    title,
    maxAttempts,
    retryCooldownHours,
    scenarios: payload.scenarios,
  };
}

async function ensureVersionDoesNotExist(
  pool: DatabasePool,
  bankKey: string,
  bankVersion: number,
) {
  const result = await pool.query(
    `SELECT 1
       FROM private.specialist_capability_simulation_banks
      WHERE bank_key = $1
        AND bank_version = $2
      LIMIT 1`,
    [bankKey, bankVersion],
  );
  if (result.rowCount) {
    throw new Error(
      `Sandbox simulation bank ${bankKey} v${bankVersion} already exists. Bank versions are immutable.`,
    );
  }
}

async function importBank(pool: DatabasePool, payload: PrivateSimulationBankPayload) {
  await ensureVersionDoesNotExist(pool, payload.bankKey, payload.bankVersion);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO private.specialist_capability_simulation_banks (
         bank_key,
         bank_version,
         title,
         max_attempts,
         retry_cooldown_hours,
         active
       ) VALUES ($1, $2, $3, $4, $5, false)`,
      [
        payload.bankKey,
        payload.bankVersion,
        payload.title,
        payload.maxAttempts || 6,
        payload.retryCooldownHours || 0,
      ],
    );

    for (const scenario of payload.scenarios) {
      await client.query(
        `INSERT INTO private.specialist_capability_simulation_scenarios (
           bank_key,
           bank_version,
           scenario_key,
           scenario_version,
           definition,
           active
         ) VALUES ($1, $2, $3, $4, $5::jsonb, true)`,
        [
          payload.bankKey,
          payload.bankVersion,
          scenario.key,
          scenario.version,
          JSON.stringify(scenario),
        ],
      );
    }

    await client.query(
      `UPDATE private.specialist_capability_simulation_banks
          SET active = false,
              retired_at = COALESCE(retired_at, now())
        WHERE bank_key = $1
          AND active = true`,
      [payload.bankKey],
    );
    await client.query(
      `UPDATE private.specialist_capability_simulation_banks
          SET active = true,
              retired_at = NULL
        WHERE bank_key = $1
          AND bank_version = $2`,
      [payload.bankKey, payload.bankVersion],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const { apply, filePath } = readArgs();
  const payload = parsePayload(filePath);
  console.log(
    `[SANDBOX SIMULATION BANK] validated ${payload.bankKey} v${payload.bankVersion} (${payload.scenarios.length} private fictional scenarios)`,
  );

  if (!apply) {
    console.log(
      "[SANDBOX SIMULATION BANK] validation only. No database connection was opened. Re-run with --apply only against an explicitly approved non-production database.",
    );
    return;
  }

  const { pool } = await import("../server/db");
  const databasePool = pool as unknown as DatabasePool;
  try {
    await importBank(databasePool, payload);
    console.log(
      `[SANDBOX SIMULATION BANK] activated ${payload.bankKey} v${payload.bankVersion}`,
    );
  } finally {
    await databasePool.end();
  }
}

main().catch((error) => {
  console.error(
    "[SANDBOX SIMULATION BANK] import failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
