import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_ASSESSMENT_FIXTURES } from "./capabilityAssessmentBank";
import type { CapabilityAssessmentDefinition } from "./capabilityEngine";
import {
  summarizeCapabilityBankCoverage,
  validateCapabilityAssessmentAgainstBlueprint,
  type CapabilityBankCoverageAssessment,
} from "./capabilityBankCoverage";

function fixtureToCoverage(definition: CapabilityAssessmentDefinition): CapabilityBankCoverageAssessment {
  const itemPairs = definition.questions.map((question) => ({
    competencyKey: question.competencyKey,
    deepDiveKey: question.deepDiveKey || definition.deepDiveKey,
  }));
  const uniquePairs = Array.from(
    new Map(itemPairs.map((item) => [`${item.deepDiveKey}:${item.competencyKey}`, item])).values(),
  );

  return {
    assessmentKey: definition.key,
    assessmentDeepDiveKey: definition.deepDiveKey,
    evidenceKind: definition.evidenceKind,
    competencyBlueprint: uniquePairs.map((item) => ({ ...item, count: 1 })),
    items: itemPairs,
  };
}

const currentFixtureCoverage = CAPABILITY_ASSESSMENT_FIXTURES.map(fixtureToCoverage);

test("existing Clarity and Structured Execution fixture banks conform to the full blueprint vocabulary", () => {
  for (const assessment of currentFixtureCoverage) {
    assert.doesNotThrow(() => validateCapabilityAssessmentAgainstBlueprint(assessment));
  }
});

test("the current Sprint 1-2 fixture slice covers 5 of 33 required capability evidence cells", () => {
  const summary = summarizeCapabilityBankCoverage(currentFixtureCoverage);
  assert.equal(summary.coveredEvidenceCells.length, 5);
  assert.equal(summary.missingEvidenceCells.length, 28);
  assert.deepEqual(summary.coveredEvidenceCells, [
    "deep_dive.clarity.mastery",
    "deep_dive.clarity.retrieval",
    "deep_dive.clarity.transfer",
    "deep_dive.structured_execution.mastery",
    "deep_dive.structured_execution.transfer",
  ]);
});

test("unknown Deep Dive or competency identities fail bank validation", () => {
  const valid = currentFixtureCoverage[0];
  assert.ok(valid);

  assert.throws(
    () => validateCapabilityAssessmentAgainstBlueprint({
      ...valid,
      items: [{ ...valid.items[0], deepDiveKey: "made_up_phase" }],
      competencyBlueprint: [{ ...valid.competencyBlueprint[0], deepDiveKey: "made_up_phase" }],
    }),
    /unknown Deep Dive/,
  );

  assert.throws(
    () => validateCapabilityAssessmentAgainstBlueprint({
      ...valid,
      items: [{ ...valid.items[0], competencyKey: "clarity.made_up_competency" }],
      competencyBlueprint: [{
        ...valid.competencyBlueprint[0],
        competencyKey: "clarity.made_up_competency",
      }],
    }),
    /unknown competency/,
  );
});

test("mastery cannot silently span multiple Deep Dives", () => {
  const clarityMastery = currentFixtureCoverage.find((assessment) => assessment.assessmentKey === "clarity_mastery_v1");
  assert.ok(clarityMastery);

  assert.throws(
    () => validateCapabilityAssessmentAgainstBlueprint({
      ...clarityMastery,
      items: [
        ...clarityMastery.items,
        { competencyKey: "structured_execution.phase_purpose", deepDiveKey: "structured_execution" },
      ],
      competencyBlueprint: [
        ...clarityMastery.competencyBlueprint,
        { competencyKey: "structured_execution.phase_purpose", deepDiveKey: "structured_execution", count: 1 },
      ],
    }),
    /must cover exactly/,
  );
});

test("transfer must genuinely interleave at least two declared Deep Dives", () => {
  const transfer = currentFixtureCoverage.find((assessment) => assessment.assessmentKey === "clarity_structured_transfer_v1");
  assert.ok(transfer);

  const clarityOnlyItems = transfer.items.filter((item) => item.deepDiveKey === "clarity");
  const clarityOnlyBlueprint = transfer.competencyBlueprint.filter((item) => item.deepDiveKey === "clarity");
  assert.throws(
    () => validateCapabilityAssessmentAgainstBlueprint({
      ...transfer,
      items: clarityOnlyItems,
      competencyBlueprint: clarityOnlyBlueprint,
    }),
    /interleave at least two Deep Dives/,
  );
});
