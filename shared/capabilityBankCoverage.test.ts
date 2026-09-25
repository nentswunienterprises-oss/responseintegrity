import assert from "node:assert/strict";
import test from "node:test";
import { getCapabilityDeepDiveBlueprint } from "./capabilityBlueprint";
import {
  summarizeCapabilityBankCoverage,
  validateCapabilityAssessmentAgainstBlueprint,
  type CapabilityBankCoverageAssessment,
} from "./capabilityBankCoverage";

function singleDeepDiveAssessment(
  assessmentKey: string,
  deepDiveKey: string,
  evidenceKind: "mastery" | "retrieval",
): CapabilityBankCoverageAssessment {
  const blueprint = getCapabilityDeepDiveBlueprint(deepDiveKey);
  assert.ok(blueprint);
  const competencyKey = blueprint.competencyKeys[0];
  return {
    assessmentKey,
    assessmentDeepDiveKey: deepDiveKey,
    evidenceKind,
    competencyBlueprint: [{ competencyKey, deepDiveKey, count: 1 }],
    items: [{ competencyKey, deepDiveKey }],
  };
}

function transferAssessment(): CapabilityBankCoverageAssessment {
  return {
    assessmentKey: "synthetic_transfer",
    assessmentDeepDiveKey: "mixed",
    evidenceKind: "transfer",
    competencyBlueprint: [
      { competencyKey: "clarity.phase_purpose", deepDiveKey: "clarity", count: 1 },
      { competencyKey: "structured_execution.phase_purpose", deepDiveKey: "structured_execution", count: 1 },
    ],
    items: [
      { competencyKey: "clarity.phase_purpose", deepDiveKey: "clarity" },
      { competencyKey: "structured_execution.phase_purpose", deepDiveKey: "structured_execution" },
    ],
  };
}

const coverage = [
  singleDeepDiveAssessment("synthetic_clarity_mastery", "clarity", "mastery"),
  singleDeepDiveAssessment("synthetic_clarity_retrieval", "clarity", "retrieval"),
  singleDeepDiveAssessment("synthetic_structured_mastery", "structured_execution", "mastery"),
  transferAssessment(),
];

test("synthetic banks can validate without publishing answer-bearing assessment fixtures", () => {
  for (const assessment of coverage) {
    assert.doesNotThrow(() => validateCapabilityAssessmentAgainstBlueprint(assessment));
  }
});

test("synthetic coverage records five evidence cells without requiring public private-bank content", () => {
  const summary = summarizeCapabilityBankCoverage(coverage);
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

test("unknown Deep Dive or competency identities fail validation", () => {
  const valid = coverage[0];
  assert.throws(
    () => validateCapabilityAssessmentAgainstBlueprint({
      ...valid,
      items: [{ competencyKey: valid.items[0].competencyKey, deepDiveKey: "made_up_phase" }],
      competencyBlueprint: [{ competencyKey: valid.items[0].competencyKey, deepDiveKey: "made_up_phase", count: 1 }],
    }),
    /unknown Deep Dive/,
  );

  assert.throws(
    () => validateCapabilityAssessmentAgainstBlueprint({
      ...valid,
      items: [{ competencyKey: "clarity.made_up_competency", deepDiveKey: "clarity" }],
      competencyBlueprint: [{ competencyKey: "clarity.made_up_competency", deepDiveKey: "clarity", count: 1 }],
    }),
    /unknown competency/,
  );
});

test("mastery cannot silently span multiple Deep Dives", () => {
  const clarityMastery = coverage[0];
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

test("transfer must genuinely interleave at least two Deep Dives", () => {
  const transfer = transferAssessment();
  assert.throws(
    () => validateCapabilityAssessmentAgainstBlueprint({
      ...transfer,
      items: transfer.items.filter((item) => item.deepDiveKey === "clarity"),
      competencyBlueprint: transfer.competencyBlueprint.filter((item) => item.deepDiveKey === "clarity"),
    }),
    /interleave at least two Deep Dives/,
  );
});
