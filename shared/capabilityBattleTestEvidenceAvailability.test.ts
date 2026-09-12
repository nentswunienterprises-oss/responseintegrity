import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImplementedBattleTestEvidenceAvailability,
  getBattleTestEvidenceAvailabilitySummary,
} from "./capabilityBattleTestEvidenceAvailability";
import { CAPABILITY_PRACTICAL_PROOFS } from "./capabilityPracticalEvidence";
import { SANDBOX_SIMULATION_DESIGN_FIXTURE_V1 } from "./capabilitySandboxSimulationFixtures";
import { SANDBOX_MOCK_CRITERIA } from "./sandboxReadiness";

function competencyId(deepDiveKey: string, competencyKey: string) {
  return `${deepDiveKey}:${competencyKey}`;
}

function boundaryId(deepDiveKey: string, boundaryKey: string) {
  return `${deepDiveKey}:${boundaryKey}`;
}

function entryCanonicalIds(row: ReturnType<typeof buildImplementedBattleTestEvidenceAvailability>[number]) {
  const source = row.semanticEvidenceKinds;
  return source;
}

const PRACTICAL_COMPETENCIES = new Set(
  CAPABILITY_PRACTICAL_PROOFS.flatMap((proof) =>
    proof.reviewRubric.criteria.flatMap((criterion) =>
      criterion.competencyLinks.map((link) =>
        competencyId(link.deepDiveKey, link.competencyKey),
      ),
    ),
  ),
);
const PRACTICAL_BOUNDARIES = new Set(
  CAPABILITY_PRACTICAL_PROOFS.flatMap((proof) =>
    proof.reviewRubric.criteria.flatMap((criterion) =>
      criterion.criticalBoundaryLinks.map((link) =>
        boundaryId(link.deepDiveKey, link.boundaryKey),
      ),
    ),
  ),
);
const FIXTURE_COMPETENCIES = new Set(
  SANDBOX_SIMULATION_DESIGN_FIXTURE_V1.decisions.map((decision) =>
    competencyId(decision.deepDiveKey, decision.competencyKey),
  ),
);
const FIXTURE_BOUNDARIES = new Set(
  SANDBOX_SIMULATION_DESIGN_FIXTURE_V1.decisions.flatMap((decision) =>
    (decision.criticalBoundaryKeys || []).map((key) =>
      boundaryId(decision.deepDiveKey, key),
    ),
  ),
);

// Keep this helper intentionally local to the test. It verifies the availability
// projection from the canonical Sprint 17 mapping rather than reusing its code.
function canonicalOverlap(
  row: ReturnType<typeof buildImplementedBattleTestEvidenceAvailability>[number],
  competencyIds: Set<string>,
  boundaryIds: Set<string>,
) {
  const { CAPABILITY_BATTLE_TEST_COVERAGE } = require("./capabilityBattleTestCoverage") as typeof import("./capabilityBattleTestCoverage");
  const entry = CAPABILITY_BATTLE_TEST_COVERAGE.find(
    (candidate) =>
      candidate.deepDiveKey === row.deepDiveKey &&
      candidate.questionKey === row.questionKey,
  );
  assert.ok(entry);
  return (
    entry.competencyKeys.some((key) =>
      competencyIds.has(competencyId(entry.deepDiveKey, key)),
    ) ||
    entry.criticalBoundaryKeys.some((key) =>
      boundaryIds.has(boundaryId(entry.deepDiveKey, key)),
    )
  );
}

test("implemented evidence availability leaves no Battle Test semantic requirement orphaned", () => {
  const summary = getBattleTestEvidenceAvailabilitySummary();
  assert.equal(summary.rows.length, 165);
  assert.deepEqual(summary.orphanedQuestionIds, []);
  assert.deepEqual(summary.humanRequiredWithoutHumanChannelIds, []);
});

test("direct question support counts only mastery and exact practical-rubric overlaps", () => {
  const summary = getBattleTestEvidenceAvailabilitySummary();
  assert.equal(summary.questionsByDirectImplementedChannel.mastery, 165);
  assert.ok(summary.questionsByDirectImplementedChannel.practical > 0);
  assert.deepEqual(Object.keys(summary.questionsByDirectImplementedChannel).sort(), [
    "mastery",
    "practical",
  ]);
  assert.deepEqual(summary.deepDiveReinforcementCells, {
    retrieval: 11,
    transfer: 11,
  });

  for (const row of summary.rows) {
    assert.equal(row.implementedDirectEvidenceKinds.includes("mastery"), true);
    assert.equal(row.implementedDirectEvidenceKinds.includes("retrieval"), false);
    assert.equal(row.implementedDirectEvidenceKinds.includes("transfer"), false);
    assert.equal(row.implementedDirectEvidenceKinds.includes("oral_defense"), false);
    assert.equal(row.implementedDirectEvidenceKinds.includes("simulation"), false);
    assert.equal(row.implementedDirectEvidenceKinds.includes("human_mock"), false);
  }
});

test("practical support is claimed exactly when current rubric lineage overlaps the mapped requirement", () => {
  const rows = buildImplementedBattleTestEvidenceAvailability();
  for (const row of rows) {
    const expected = canonicalOverlap(row, PRACTICAL_COMPETENCIES, PRACTICAL_BOUNDARIES);
    assert.equal(
      row.implementedDirectEvidenceKinds.includes("practical"),
      expected,
      `${row.deepDiveKey}:${row.questionKey} practical support drifted from rubric lineage`,
    );
  }
});

test("public simulation fixture is reported as fixture coverage only and never as live private-bank proof", () => {
  const summary = getBattleTestEvidenceAvailabilitySummary();
  assert.equal(summary.livePrivateSimulationCoverageAudited, false);
  assert.match(summary.livePrivateSimulationCoverageReason, /private server-side data/i);
  assert.ok(summary.sandboxSimulationDesignFixtureQuestionCount > 0);

  for (const row of summary.rows) {
    const expected = canonicalOverlap(row, FIXTURE_COMPETENCIES, FIXTURE_BOUNDARIES);
    assert.equal(
      row.sandboxSimulationDesignFixtureCovered,
      expected,
      `${row.deepDiveKey}:${row.questionKey} fixture support drifted from public scenario lineage`,
    );
    assert.equal(row.implementedDirectEvidenceKinds.includes("simulation"), false);
  }
});

test("Oral Defense remains a targeted integrity capability rather than 35 direct re-tests", () => {
  const summary = getBattleTestEvidenceAvailabilitySummary();
  assert.equal(summary.oralDefenseTargetableQuestionCount, 35);
  for (const row of summary.rows) {
    assert.equal(row.oralDefenseTargetable, row.proofClass === "integrity");
    assert.equal(row.implementedDirectEvidenceKinds.includes("oral_defense"), false);
  }
});

test("human Mock is a five-criterion backstop for human-required requirements, not 56 direct questions", () => {
  const summary = getBattleTestEvidenceAvailabilitySummary();
  const knownCriteria = new Set(SANDBOX_MOCK_CRITERIA.map((criterion) => criterion.key));
  assert.equal(summary.humanMockBackstopQuestionCount, 56);
  assert.deepEqual(summary.unknownMockCriterionRefs, []);

  for (const row of summary.rows) {
    if (row.humanVerificationRequired) {
      assert.ok(row.humanMockCriteria.length > 0);
      assert.ok(row.humanMockCriteria.every((criterion) => knownCriteria.has(criterion)));
    } else {
      assert.deepEqual(row.humanMockCriteria, []);
    }
    assert.equal(row.implementedDirectEvidenceKinds.includes("human_mock"), false);
  }
});

test("all 165 requirements retain mastery lineage while human verification stays compressed", () => {
  const rows = buildImplementedBattleTestEvidenceAvailability();
  assert.equal(rows.length, 165);
  assert.ok(rows.every((row) => row.implementedDirectEvidenceKinds.includes("mastery")));
  assert.equal(rows.filter((row) => row.humanVerificationRequired).length, 56);
  assert.equal(rows.filter((row) => row.proofClass === "integrity").length, 35);
});
