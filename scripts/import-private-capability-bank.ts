import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { generateDeterministicCapabilityForm } from "../server/capabilityFormGeneration";
import {
  summarizeCapabilityBankCoverage,
  validateCapabilityAssessmentAgainstBlueprint,
} from "../shared/capabilityBankCoverage";
import { getRequiredCapabilityEvidenceCells } from "../shared/capabilityBlueprint";
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
  optionFeedback: z.record(z.string().trim().min(1)).default({}),
});

const AUTHORING_LEAK_PATTERNS = [
  {
    label: "completion-status counter",
    pattern: /\b\d{1,2}\/45\s+(?:authored|approved|locked)\b/i,
  },
  {
    label: "authoring workflow language",
    pattern: /\b(?:authoring|authored pass|awaiting (?:your )?sign-?off|final pass closes the bank)\b/i,
  },
  {
    label: "review-state language",
    pattern: /\b(?:approved\.?\s+locked\.?|item\s+\d+\s+is\s+locked|pass\s+\d+\s+locked)\b/i,
  },
  {
    label: "reviewer voice",
    pattern: /\b(?:I would replace the original|I agree that wording|I['’]m also carrying your authoring standard|we just approved)\b/i,
  },
  {
    label: "authoring heading",
    pattern: /##\s+[^.]{0,120}\b(?:Mastery|Pass)\b/i,
  },
] as const;

function assertNoAuthoringLeak(context: string, value: string) {
  const hit = AUTHORING_LEAK_PATTERNS.find(({ pattern }) => pattern.test(value));
  if (!hit) return;
  throw new Error(
    `Capability bank ${context} contains authoring-only review text (${hit.label}). Keep approval notes, pass counters, sign-off language, and bank-authoring commentary out of learner-facing copy.`,
  );
}

const LEARNER_COPY_JARGON_PATTERNS = [
  {
    label: "implementation field name",
    pattern: /\b(?:decision-eligible|modelingOnly|supportLevel|same_form|changed_form)\b/i,
  },
  {
    label: "implementation authority name",
    pattern: /\b(?:Capability Blueprint|Capability Engine|state engine|transition engine)\b/i,
  },
  {
    label: "implementation vocabulary",
    pattern: /\b(?:schema|registry|contract|canonical|lineage|runtime|implementation|payload|specification|platform|architecture)\b/i,
  },
  {
    label: "runner vocabulary",
    pattern: /\b(?:drill runner|runner\/preparation direction|runner-owned)\b/i,
  },
] as const;

function assertNoLearnerCopyJargon(context: string, value: string) {
  const hit = LEARNER_COPY_JARGON_PATTERNS.find(({ pattern }) => pattern.test(value));
  if (!hit) return;
  throw new Error(
    `Capability bank ${context} contains implementation language (${hit.label}). Learner-facing checks must teach RI operating truth in plain Specialist language, not product or engineering internals.`,
  );
}

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
type DatabaseClient = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
};
type DatabasePool = {
  query: (text: string, params?: unknown[]) => Promise<{ rowCount: number | null }>;
  connect: () => Promise<DatabaseClient & { release: () => void }>;
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

async function importAssessment(client: DatabaseClient, assessment: ParsedAssessment) {
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
           option_feedback,
           active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13::jsonb, true)`,
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
          JSON.stringify(item.optionFeedback || {}),
        ],
    );
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
      prompt: item.prompt,
      kind: item.kind,
      correctOptionKeys: item.correctOptionKeys,
      criticalFailOptionKeys: item.criticalFailOptionKeys,
      criticalBoundaryKeys: item.criticalBoundaryKeys,
    })),
  };
}

function validateAssessment(assessment: ParsedAssessment) {
  for (const item of assessment.items) {
    if (item.kind === "single_choice") {
      const correctKeys = new Set(item.correctOptionKeys);
      const optionKeys = new Set(item.options.map((option) => option.key));
      const wrongKeys = item.options
        .map((option) => option.key)
        .filter((key) => !correctKeys.has(key));
      const missingFeedback = wrongKeys.filter(
        (key) => !item.optionFeedback[key]?.trim(),
      );
      const unknownFeedback = Object.keys(item.optionFeedback).filter(
        (key) => !optionKeys.has(key),
      );
      const correctFeedback = Object.keys(item.optionFeedback).filter(
        (key) => correctKeys.has(key),
      );

      if (missingFeedback.length) {
        throw new Error(
          `Capability bank ${assessment.assessmentKey}/${item.key} is missing option-specific feedback for wrong option(s): ${missingFeedback.join(", ")}. Wrong-answer feedback must be distinct from the approved Truth.`,
        );
      }
      if (unknownFeedback.length) {
        throw new Error(
          `Capability bank ${assessment.assessmentKey}/${item.key} has feedback for unknown option(s): ${unknownFeedback.join(", ")}.`,
        );
      }
      if (correctFeedback.length) {
        throw new Error(
          `Capability bank ${assessment.assessmentKey}/${item.key} stores option-specific feedback for correct option(s): ${correctFeedback.join(", ")}. Correct answers use the approved Truth instead.`,
        );
      }
    }

    const promptContext = `${assessment.assessmentKey}/${item.key}/prompt`;
    assertNoAuthoringLeak(promptContext, item.prompt);
    assertNoLearnerCopyJargon(promptContext, item.prompt);

    for (const option of item.options) {
      const optionContext = `${assessment.assessmentKey}/${item.key}/option:${option.key}`;
      assertNoAuthoringLeak(optionContext, option.label);
      assertNoLearnerCopyJargon(optionContext, option.label);
    }

    const explanationContext = `${assessment.assessmentKey}/${item.key}/explanation`;
    assertNoAuthoringLeak(explanationContext, item.explanation);
    assertNoLearnerCopyJargon(explanationContext, item.explanation);

    for (const [optionKey, feedback] of Object.entries(item.optionFeedback || {})) {
      const feedbackContext = `${assessment.assessmentKey}/${item.key}/option-feedback:${optionKey}`;
      assertNoAuthoringLeak(feedbackContext, feedback);
      assertNoLearnerCopyJargon(feedbackContext, feedback);
    }
  }

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

  const requiredEvidenceCellCount = getRequiredCapabilityEvidenceCells().length;
  console.log(
    `[CAPABILITY BANK] blueprint coverage ${coverage.coveredEvidenceCells.length}/${requiredEvidenceCellCount} evidence cells`,
  );
  if (coverage.missingEvidenceCells.length > 0) {
    console.log(`[CAPABILITY BANK] missing: ${coverage.missingEvidenceCells.join(", ")}`);
  }

  if (requireMvpCoverage && coverage.missingEvidenceCells.length > 0) {
    throw new Error(
      `Capability bank is not MVP-complete. Missing ${coverage.missingEvidenceCells.length} of ${requiredEvidenceCellCount} required evidence cells.`,
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
      await ensureVersionDoesNotExist(
        databasePool,
        assessment.assessmentKey,
        assessment.bankVersion,
      );
    }

    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      for (const assessment of payload.assessments) {
        await importAssessment(client, assessment);
        console.log(
          `[CAPABILITY BANK] staged inactive ${assessment.assessmentKey} v${assessment.bankVersion} (${assessment.items.length} items)`,
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    console.log(
      "[CAPABILITY BANK] atomic import complete. No bank was activated or retired; verify the complete persisted package before a separate activation step.",
    );
  } finally {
    await databasePool.end();
  }
}

main().catch((error) => {
  console.error("[CAPABILITY BANK] import failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
