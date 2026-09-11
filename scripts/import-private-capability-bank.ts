import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { generateDeterministicCapabilityForm } from "../server/capabilityFormGeneration";
import {
  summarizeCapabilityBankCoverage,
  validateCapabilityAssessmentAgainstBlueprint,
} from "../shared/capabilityBankCoverage";
import { buildCapabilityCriticalBoundaryRequirements } from "../shared/capabilityCriticalCoverage";

const optionSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
});

const itemSchema = z.object({
  key: z.string().trim().min(1),
  competencyKey: z.string().trim().min(1),
  deepDiveKey: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  kind: z.enum(["single_choice", "multi_select", "sequence"]),
  options: z.array(optionSchema).min(2),
  correctOptionKeys: z.array(z.string().trim().min(1)).min(1),
  criticalFailOptionKeys: z.array(z.string().trim().min(1)).default([]),
  criticalBoundaryKeys: z.array(z.string().trim().min(1)).default([]),
  explanation: z.string().trim().min(1),
});

const assessmentSchema = z.object({
  assessmentKey: z.string().trim().min(1),
  bankVersion: z.number().int().positive(),
  title: z.string().trim().min(1),
  assessmentDeepDiveKey: z.string().trim().min(1),
  evidenceKind: z.enum(["mastery", "retrieval", "transfer"]),
  passThresholdPercent: z.number().positive().max(100),
  formSize: z.number().int().positive(),
  maxAttempts: z.number().int().positive().default(3),
  retryCooldownHours: z.number().min(0).default(0),
  competencyBlueprint: z.array(z.object({
    competencyKey: z.string().trim().min(1),
    deepDiveKey: z.string().trim().min(1),
    count: z.number().int().positive(),
  })).min(1),
  items: z.array(itemSchema).min(1),
});

const bankSchema = z.object({
  assessments: z.array(assessmentSchema).min(1),
});

type ParsedAssessment = z.infer<typeof assessmentSchema>;
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
  const requireMvpCoverage = args.includes("--require-mvp-coverage");
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  if (!fileArg) {
    throw new Error(
      "Usage: tsx scripts/import-private-capability-bank.ts <private-bank.json> [--require-mvp-coverage] [--apply]",
    );
  }
  return { apply, requireMvpCoverage, filePath: path.resolve(fileArg) };
}

async function ensureVersionDoesNotExist(
  pool: DatabasePool,
  assessmentKey: string,
  bankVersion: number,
) {
  const result = await pool.query(
    `SELECT 1
       FROM private.specialist_capability_assessment_configs
      WHERE assessment_key = $1
        AND bank_version = $2
      LIMIT 1`,
    [assessmentKey, bankVersion],
  );
  if (result.rowCount) {
    throw new Error(`Capability bank ${assessmentKey} v${bankVersion} already exists. Bank versions are immutable.`);
  }
}

async function importAssessment(pool: DatabasePool, assessment: ParsedAssessment) {
  await ensureVersionDoesNotExist(pool, assessment.assessmentKey, assessment.bankVersion);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO private.specialist_capability_assessment_configs (
         assessment_key,
         bank_version,
         title,
         assessment_deep_dive_key,
         evidence_kind,
         pass_threshold_percent,
         form_size,
         max_attempts,
         retry_cooldown_hours,
         competency_blueprint,
         active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, false)`,
      [
        assessment.assessmentKey,
        assessment.bankVersion,
        assessment.title,
        assessment.assessmentDeepDiveKey,
        assessment.evidenceKind,
        assessment.passThresholdPercent,
        assessment.formSize,
        assessment.maxAttempts,
        assessment.retryCooldownHours,
        JSON.stringify(assessment.competencyBlueprint),
      ],
    );

    for (const item of assessment.items) {
      await client.query(
        `INSERT INTO private.specialist_capability_assessment_items (
           assessment_key,
           bank_version,
           item_key,
           competency_key,
           deep_dive_key,
           prompt,
           question_kind,
           options,
           correct_option_keys,
           critical_fail_option_keys,
           critical_boundary_keys,
           explanation,
           active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, true)`,
        [
          assessment.assessmentKey,
          assessment.bankVersion,
          item.key,
          item.competencyKey,
          item.deepDiveKey,
          item.prompt,
          item.kind,
          JSON.stringify(item.options),
          JSON.stringify(item.correctOptionKeys),
          JSON.stringify(item.criticalFailOptionKeys),
          JSON.stringify(item.criticalBoundaryKeys),
          item.explanation,
        ],
      );
    }

    await client.query(
      `UPDATE private.specialist_capability_assessment_configs
          SET active = false,
              retired_at = COALESCE(retired_at, now())
        WHERE assessment_key = $1
          AND active = true`,
      [assessment.assessmentKey],
    );

    await client.query(
      `UPDATE private.specialist_capability_assessment_configs
          SET active = true,
              retired_at = NULL
        WHERE assessment_key = $1
          AND bank_version = $2`,
      [assessment.assessmentKey, assessment.bankVersion],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function validationShape(assessment: ParsedAssessment) {
  return {
    assessmentKey: assessment.assessmentKey,
    assessmentDeepDiveKey: assessment.assessmentDeepDiveKey,
    evidenceKind: assessment.evidenceKind,
    formSize: assessment.formSize,
    passThresholdPercent: assessment.passThresholdPercent,
    enforceMvpPlan: true,
    competencyBlueprint: assessment.competencyBlueprint,
    items: assessment.items.map((item) => ({
      competencyKey: item.competencyKey,
      deepDiveKey: item.deepDiveKey,
      kind: item.kind,
      correctOptionKeys: item.correctOptionKeys,
      criticalFailOptionKeys: item.criticalFailOptionKeys,
      criticalBoundaryKeys: item.criticalBoundaryKeys,
    })),
  };
}

function validateAssessment(assessment: ParsedAssessment) {
  const blueprintCoverage = validateCapabilityAssessmentAgainstBlueprint(validationShape(assessment));
  const criticalBoundaryRequirements = buildCapabilityCriticalBoundaryRequirements(assessment.assessmentKey);

  generateDeterministicCapabilityForm(
    {
      assessmentKey: assessment.assessmentKey,
      bankVersion: assessment.bankVersion,
      title: assessment.title,
      assessmentDeepDiveKey: assessment.assessmentDeepDiveKey,
      evidenceKind: assessment.evidenceKind,
      passThresholdPercent: assessment.passThresholdPercent,
      formSize: assessment.formSize,
      maxAttempts: assessment.maxAttempts,
      retryCooldownHours: assessment.retryCooldownHours,
      competencyBlueprint: assessment.competencyBlueprint,
      criticalBoundaryRequirements,
    },
    assessment.items,
    "private-bank-import-validation",
  );

  console.log(
    `[CAPABILITY BANK] validated ${assessment.assessmentKey} v${assessment.bankVersion} (${assessment.items.length} private items; ${blueprintCoverage.coveredEvidenceCells.join(", ")}; ${criticalBoundaryRequirements.length} critical-boundary group(s))`,
  );

  return blueprintCoverage;
}

async function main() {
  const { apply, requireMvpCoverage, filePath } = readArgs();
  const payload = bankSchema.parse(JSON.parse(fs.readFileSync(filePath, "utf8")));

  for (const assessment of payload.assessments) {
    validateAssessment(assessment);
  }

  const coverage = summarizeCapabilityBankCoverage(
    payload.assessments.map(validationShape),
  );

  console.log(
    `[CAPABILITY BANK] blueprint coverage ${coverage.coveredEvidenceCells.length}/33 evidence cells`,
  );
  if (coverage.missingEvidenceCells.length > 0) {
    console.log(`[CAPABILITY BANK] missing: ${coverage.missingEvidenceCells.join(", ")}`);
  }

  if (requireMvpCoverage && coverage.missingEvidenceCells.length > 0) {
    throw new Error(
      `Capability bank is not MVP-complete. Missing ${coverage.missingEvidenceCells.length} of 33 required evidence cells.`,
    );
  }

  if (!apply) {
    console.log(
      "[CAPABILITY BANK] validation only. No database connection was opened. Re-run with --apply only against an explicitly approved non-production database.",
    );
    return;
  }

  const { pool } = await import("../server/db");
  const databasePool = pool as unknown as DatabasePool;
  try {
    for (const assessment of payload.assessments) {
      await importAssessment(databasePool, assessment);
      console.log(
        `[CAPABILITY BANK] activated ${assessment.assessmentKey} v${assessment.bankVersion} (${assessment.items.length} items)`,
      );
    }
  } finally {
    await databasePool.end();
  }
}

main().catch((error) => {
  console.error("[CAPABILITY BANK] import failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
