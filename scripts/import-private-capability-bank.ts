import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { pool } from "../server/db";
import { generateDeterministicCapabilityForm } from "../server/capabilityFormGeneration";

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

function readArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  if (!fileArg) {
    throw new Error("Usage: tsx scripts/import-private-capability-bank.ts <private-bank.json> [--apply]");
  }
  return { apply, filePath: path.resolve(fileArg) };
}

async function ensureVersionDoesNotExist(assessmentKey: string, bankVersion: number) {
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

async function importAssessment(assessment: z.infer<typeof assessmentSchema>) {
  await ensureVersionDoesNotExist(assessment.assessmentKey, assessment.bankVersion);

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
           explanation,
           active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, true)`,
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

async function main() {
  const { apply, filePath } = readArgs();
  const payload = bankSchema.parse(JSON.parse(fs.readFileSync(filePath, "utf8")));

  for (const assessment of payload.assessments) {
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
      },
      assessment.items,
      "private-bank-import-validation",
    );

    console.log(
      `[CAPABILITY BANK] validated ${assessment.assessmentKey} v${assessment.bankVersion} (${assessment.items.length} private items)`,
    );
  }

  if (!apply) {
    console.log("[CAPABILITY BANK] validation only. Re-run with --apply against the intended non-production database when ready.");
    return;
  }

  for (const assessment of payload.assessments) {
    await importAssessment(assessment);
    console.log(
      `[CAPABILITY BANK] activated ${assessment.assessmentKey} v${assessment.bankVersion} (${assessment.items.length} items)`,
    );
  }
}

main()
  .catch((error) => {
    console.error("[CAPABILITY BANK] import failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
