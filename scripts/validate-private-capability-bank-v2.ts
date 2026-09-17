import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { generateDeterministicCapabilityForm } from "../server/capabilityFormGeneration";
import { CAPABILITY_MVP_ASSESSMENT_PLAN_V1 } from "../shared/capabilityAssessmentPlan";
import {
  summarizeCapabilityBankCoverage,
  validateCapabilityAssessmentAgainstBlueprint,
} from "../shared/capabilityBankCoverage";
import { buildCapabilityCriticalBoundaryRequirements } from "../shared/capabilityCriticalCoverage";

const optionSchema = z.object({ key: z.string().min(1), label: z.string().min(1) });
const itemSchema = z.object({
  key: z.string().min(1),
  competencyKey: z.string().min(1),
  deepDiveKey: z.string().min(1),
  prompt: z.string().min(1),
  kind: z.enum(["single_choice", "multi_select", "sequence"]),
  options: z.array(optionSchema).min(2),
  correctOptionKeys: z.array(z.string().min(1)).min(1),
  criticalFailOptionKeys: z.array(z.string().min(1)).default([]),
  criticalBoundaryKeys: z.array(z.string().min(1)).default([]),
  explanation: z.string().min(1),
});
const assessmentSchema = z.object({
  assessmentKey: z.string().min(1),
  bankVersion: z.number().int().positive(),
  title: z.string().min(1),
  assessmentDeepDiveKey: z.string().min(1),
  evidenceKind: z.enum(["mastery", "retrieval", "transfer"]),
  passThresholdPercent: z.number().positive().max(100),
  formSize: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  retryCooldownHours: z.number().min(0),
  competencyBlueprint: z.array(z.object({
    competencyKey: z.string().min(1),
    deepDiveKey: z.string().min(1),
    count: z.number().int().positive(),
  })).min(1),
  items: z.array(itemSchema).min(1),
});
const packageSchema = z.object({ assessments: z.array(assessmentSchema) });

function fail(message: string): never {
  throw new Error(message);
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

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function longestCorrectRate(items: z.infer<typeof itemSchema>[]) {
  let uniquelyLongest = 0;
  for (const item of items) {
    const lengths = item.options.map((option) => normalized(option.label).length);
    const max = Math.max(...lengths);
    const longest = item.options.filter((_, index) => lengths[index] === max);
    if (longest.length === 1 && item.correctOptionKeys.includes(longest[0].key)) uniquelyLongest += 1;
  }
  return items.length ? uniquelyLongest / items.length : 0;
}

function main() {
  const fileArg = process.argv[2];
  if (!fileArg) fail("Usage: tsx scripts/validate-private-capability-bank-v2.ts <private-bank.json>");
  const filePath = path.resolve(fileArg);
  const source = fs.readFileSync(filePath, "utf8");
  const payload = packageSchema.parse(JSON.parse(source));
  const expectedKeys = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.map((entry) => entry.assessmentKey).sort();
  const actualKeys = payload.assessments.map((entry) => entry.assessmentKey).sort();
  if (new Set(actualKeys).size !== actualKeys.length) fail("Duplicate assessment keys detected.");
  if (canonical(actualKeys) !== canonical(expectedKeys)) fail("Package must contain exactly the 16 approved assessment keys.");

  const allItemKeys = new Set<string>();
  const allPrompts = new Map<string, string[]>();
  const optionFrequency = new Map<string, number>();
  let masteryItems = 0;
  let cumulativeItems = 0;

  for (const assessment of payload.assessments) {
    const plan = CAPABILITY_MVP_ASSESSMENT_PLAN_V1.find((entry) => entry.assessmentKey === assessment.assessmentKey)!;
    if (assessment.bankVersion !== 2) fail(`${assessment.assessmentKey} must use bankVersion 2.`);
    const requiredItems = assessment.evidenceKind === "mastery" ? 45 : 80;
    if (assessment.items.length !== requiredItems) {
      fail(`${assessment.assessmentKey} requires exactly ${requiredItems} items; found ${assessment.items.length}.`);
    }
    if (assessment.formSize !== plan.formSize || assessment.passThresholdPercent !== plan.passThresholdPercent) {
      fail(`${assessment.assessmentKey} diverges from the approved form or threshold contract.`);
    }
    if (assessment.maxAttempts !== 3 || assessment.retryCooldownHours !== 0) {
      fail(`${assessment.assessmentKey} must retain three attempts and zero bank cooldown.`);
    }

    const shape = { ...assessment, enforceMvpPlan: true };
    validateCapabilityAssessmentAgainstBlueprint(shape);
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

    for (const assignment of Array.from({ length: 100 }, (_, index) => `v2-qa-${index + 1}`)) {
      const signatures = [1, 2, 3].map((attemptNumber) => {
        const first = generateDeterministicCapabilityForm(config, assessment.items, `${assignment}:${attemptNumber}`);
        const second = generateDeterministicCapabilityForm(config, assessment.items, `${assignment}:${attemptNumber}`);
        if (canonical(first) !== canonical(second)) fail(`${assessment.assessmentKey} form generation is not deterministic.`);
        return first.definition.questions.map((question) => question.key).sort().join("|");
      });
      if (new Set(signatures).size < 2) fail(`${assessment.assessmentKey} retries collapse to one question set.`);
    }

    const localPrompts = new Set<string>();
    for (const item of assessment.items) {
      if (allItemKeys.has(item.key)) fail(`Duplicate item key across package: ${item.key}`);
      allItemKeys.add(item.key);
      const prompt = normalized(item.prompt);
      if (localPrompts.has(prompt)) fail(`Duplicate prompt in ${assessment.assessmentKey}: ${item.prompt}`);
      localPrompts.add(prompt);
      allPrompts.set(prompt, [...(allPrompts.get(prompt) || []), assessment.assessmentKey]);
      for (const option of item.options) {
        const label = normalized(option.label);
        optionFrequency.set(label, (optionFrequency.get(label) || 0) + 1);
      }
    }

    const rate = longestCorrectRate(assessment.items);
    if (rate > 0.4) fail(`${assessment.assessmentKey} exposes a longest-answer shortcut (${(rate * 100).toFixed(1)}%).`);
    if (assessment.evidenceKind === "mastery") masteryItems += assessment.items.length;
    else cumulativeItems += assessment.items.length;
  }

  if (masteryItems !== 495 || cumulativeItems !== 400 || allItemKeys.size !== 895) {
    fail(`Release totals are invalid: mastery=${masteryItems}, cumulative=${cumulativeItems}, unique=${allItemKeys.size}.`);
  }
  const duplicateAcrossBanks = [...allPrompts.values()].filter((banks) => new Set(banks).size > 1);
  if (duplicateAcrossBanks.length) fail(`${duplicateAcrossBanks.length} exact prompts repeat across assessment banks.`);
  const maxOptionFrequency = Math.max(...optionFrequency.values());
  if (maxOptionFrequency > 16) fail(`An exact option label repeats ${maxOptionFrequency} times; maximum allowed is 16.`);

  const coverage = summarizeCapabilityBankCoverage(
    payload.assessments.map((assessment) => ({ ...assessment, enforceMvpPlan: true })),
  );
  if (coverage.coveredEvidenceCells.length !== 33 || coverage.missingEvidenceCells.length) {
    fail(`MVP evidence coverage is incomplete: ${coverage.coveredEvidenceCells.length}/33.`);
  }

  const assessmentHashes = Object.fromEntries(
    payload.assessments.map((assessment) => [assessment.assessmentKey, sha256(canonical(assessment))]),
  );
  console.log(JSON.stringify({
    release: "capability_private_assessment_bank_v2_candidate",
    assessmentCount: payload.assessments.length,
    itemCount: allItemKeys.size,
    masteryItems,
    cumulativeItems,
    evidenceCells: coverage.coveredEvidenceCells.length,
    maxOptionFrequency,
    packageSourceSha256: sha256(source),
    canonicalPackageSha256: sha256(canonical(payload)),
    assessmentHashes,
  }, null, 2));
}

main();
