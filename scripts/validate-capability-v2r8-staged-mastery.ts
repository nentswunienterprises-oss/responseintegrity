import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { generateDeterministicCapabilityForm } from "../server/capabilityFormGeneration";
import { CAPABILITY_MASTERY_PLAN } from "../shared/capabilityMasterySequencing";
import { validateCapabilityAssessmentAgainstBlueprint } from "../shared/capabilityBankCoverage";
import { buildCapabilityCriticalBoundaryRequirements } from "../shared/capabilityCriticalCoverage";
import { assertCapabilityOptionParity } from "../shared/capabilityOptionParity";

const APPROVED_BANK_VERSION = 8;
const REQUIRED_ITEM_COUNT = 45;
const REQUIRED_FORM_SIZE = 15;
const REQUIRED_PASS_THRESHOLD = 96;
const REQUIRED_MAX_ATTEMPTS = 3;

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
  options: z.array(optionSchema).length(4),
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
  evidenceKind: z.literal("mastery"),
  passThresholdPercent: z.number().positive().max(100),
  formSize: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  retryCooldownHours: z.number().min(0),
  competencyBlueprint: z.array(z.object({
    competencyKey: z.string().trim().min(1),
    deepDiveKey: z.string().trim().min(1),
    count: z.number().int().positive(),
  })).min(1),
  items: z.array(itemSchema),
});

const packageSchema = z.object({
  packageKind: z.literal("capability_v2r8_staged_mastery"),
  founderApprovedAssessmentKeys: z.array(z.string().trim().min(1)).min(1),
  assessments: z.array(assessmentSchema).min(1),
});

function fail(message: string): never {
  throw new Error(message);
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    fail("Usage: tsx scripts/validate-capability-v2r8-staged-mastery.ts <private-bank.json>");
  }

  const source = fs.readFileSync(path.resolve(fileArg), "utf8");
  const payload = packageSchema.parse(JSON.parse(source));
  const planByKey = new Map(CAPABILITY_MASTERY_PLAN.map((entry) => [entry.assessmentKey, entry]));
  const declared = new Set(payload.founderApprovedAssessmentKeys);
  const assessmentKeys = payload.assessments.map((entry) => entry.assessmentKey);

  if (declared.size !== payload.founderApprovedAssessmentKeys.length) {
    fail("Founder-approved assessment keys contain duplicates.");
  }
  if (new Set(assessmentKeys).size !== assessmentKeys.length) {
    fail("Staged mastery package contains duplicate assessment keys.");
  }
  if (assessmentKeys.length !== declared.size || assessmentKeys.some((key) => !declared.has(key))) {
    fail("The staged package must contain exactly the declared Founder-approved assessment keys.");
  }

  const globalItemKeys = new Set<string>();
  const globalPrompts = new Set<string>();
  const optionParityByAssessment: Array<ReturnType<typeof assertCapabilityOptionParity> & { assessmentKey: string }> = [];

  for (const assessment of payload.assessments) {
    const plan = planByKey.get(assessment.assessmentKey);
    if (!plan) fail(`${assessment.assessmentKey} is not an approved mastery-plan bank.`);
    if (assessment.bankVersion !== APPROVED_BANK_VERSION) {
      fail(`${assessment.assessmentKey} must use V2R8 bankVersion ${APPROVED_BANK_VERSION}.`);
    }
    if (assessment.assessmentDeepDiveKey !== plan.coveredDeepDiveKeys[0]) {
      fail(`${assessment.assessmentKey} does not match its planned Deep Dive.`);
    }
    if (assessment.items.length !== REQUIRED_ITEM_COUNT) {
      fail(`${assessment.assessmentKey} requires exactly ${REQUIRED_ITEM_COUNT} manually approved items.`);
    }
    if (
      assessment.formSize !== REQUIRED_FORM_SIZE ||
      assessment.formSize !== plan.formSize ||
      assessment.passThresholdPercent !== REQUIRED_PASS_THRESHOLD ||
      assessment.passThresholdPercent !== plan.passThresholdPercent ||
      assessment.maxAttempts !== REQUIRED_MAX_ATTEMPTS ||
      assessment.retryCooldownHours !== 0
    ) {
      fail(`${assessment.assessmentKey} diverges from the V2R8 mastery runtime contract.`);
    }

    validateCapabilityAssessmentAgainstBlueprint({
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
    });

    const requirements = buildCapabilityCriticalBoundaryRequirements(assessment.assessmentKey);
    const config = {
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
      criticalBoundaryRequirements: requirements,
    };

    const localPrompts = new Set<string>();
    for (const item of assessment.items) {
      if (globalItemKeys.has(item.key)) fail(`Duplicate item key: ${item.key}`);
      globalItemKeys.add(item.key);

      const prompt = normalized(item.prompt);
      if (localPrompts.has(prompt)) fail(`Duplicate prompt in ${assessment.assessmentKey}: ${item.prompt}`);
      if (globalPrompts.has(prompt)) fail(`Prompt repeats across staged banks: ${item.prompt}`);
      localPrompts.add(prompt);
      globalPrompts.add(prompt);

      const optionKeys = new Set(item.options.map((option) => option.key));
      if (optionKeys.size !== 4) fail(`${item.key} must have four unique option keys.`);
      if (item.kind === "single_choice" && item.correctOptionKeys.length !== 1) {
        fail(`${item.key} single-choice question must have exactly one correct answer.`);
      }
      for (const key of [...item.correctOptionKeys, ...item.criticalFailOptionKeys]) {
        if (!optionKeys.has(key)) fail(`${item.key} references unknown option ${key}.`);
      }
    }

    const optionParity = assertCapabilityOptionParity(assessment.assessmentKey, assessment.items);
    optionParityByAssessment.push({ assessmentKey: assessment.assessmentKey, ...optionParity });

    const signatures = new Set<string>();
    for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber += 1) {
      const first = generateDeterministicCapabilityForm(
        config,
        assessment.items,
        `v2r8-staged-validator:${assessment.assessmentKey}:${attemptNumber}`,
      );
      const second = generateDeterministicCapabilityForm(
        config,
        assessment.items,
        `v2r8-staged-validator:${assessment.assessmentKey}:${attemptNumber}`,
      );
      if (canonical(first) !== canonical(second)) {
        fail(`${assessment.assessmentKey} form generation is not deterministic.`);
      }
      signatures.add(first.itemKeys.slice().sort().join("|"));
    }
    if (signatures.size < 2) {
      fail(`${assessment.assessmentKey} retries collapse to one question set.`);
    }
  }

  console.log(JSON.stringify({
    packageKind: payload.packageKind,
    assessmentCount: payload.assessments.length,
    itemCount: globalItemKeys.size,
    founderApprovedAssessmentKeys: [...declared].sort(),
    optionParityByAssessment,
    omittedMasteryBanks: CAPABILITY_MASTERY_PLAN
      .map((entry) => entry.assessmentKey)
      .filter((key) => !declared.has(key)),
    sourceSha256: sha256(source),
    canonicalSha256: sha256(canonical(payload)),
    status: "valid_staged_v2r8_mastery_package",
  }, null, 2));
}

main();
