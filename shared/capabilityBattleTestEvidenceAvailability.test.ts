import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImplementedBattleTestEvidenceAvailability,
  getBattleTestEvidenceAvailabilitySummary,
} from "./capabilityBattleTestEvidenceAvailability";

test("implemented direct evidence availability leaves no Battle Test semantic requirement orphaned", () => {
  const summary = getBattleTestEvidenceAvailabilitySummary();
  assert.equal(summary.rows.length, 165);
  assert.deepEqual(summary.orphanedQuestionIds, []);
  assert.deepEqual(summary.humanRequiredWithoutHumanChannelIds, []);
});

test("question-level direct evidence counts do not inflate retrieval or transfer cells into 165 re-tests", () => {
  const summary = getBattleTestEvidenceAvailabilitySummary();
  assert.deepEqual(summary.questionsByDirectImplementedChannel, {
    mastery: 165,
    practical: 33,
    oral_defense: 35,
    simulation: 45,
    human_mock: 56,
  });
  assert.deepEqual(summary.deepDiveReinforcementCells, {
    retrieval: 11,
    transfer: 11,
  });
});

test("Sandbox simulation is not claimed for Deep Dives outside the current simulation bank", () => {
  const rows = buildImplementedBattleTestEvidenceAvailability();
  for (const deepDiveKey of [
    "time_pressure_stability",
    "topic_conditioning",
    "intro_session_structure",
    "drill_library",
    "handover_verification",
    "tools_required",
  ]) {
    assert.ok(
      rows.filter((row) => row.deepDiveKey === deepDiveKey)
        .every((row) => !row.implementedDirectEvidenceKinds.includes("simulation")),
      `${deepDiveKey} must not claim current Sandbox simulation coverage`,
    );
  }
});

test("practical evidence is claimed only for Deep Dives represented by current practical rubrics", () => {
  const rows = buildImplementedBattleTestEvidenceAvailability();
  for (const deepDiveKey of [
    "time_pressure_stability",
    "intro_session_structure",
    "drill_library",
    "handover_verification",
  ]) {
    assert.ok(
      rows.filter((row) => row.deepDiveKey === deepDiveKey)
        .every((row) => !row.implementedDirectEvidenceKinds.includes("practical")),
      `${deepDiveKey} must not claim current practical-rubric coverage`,
    );
  }
});

test("all human-required requirements retain human Mock and integrity requirements retain targeted oral verification", () => {
  const rows = buildImplementedBattleTestEvidenceAvailability();
  for (const row of rows) {
    if (row.humanVerificationRequired) {
      assert.ok(row.implementedDirectEvidenceKinds.includes("human_mock"));
    }
    if (row.proofClass === "integrity") {
      assert.ok(row.implementedDirectEvidenceKinds.includes("oral_defense"));
    }
  }
});

test("all 165 requirements retain direct mastery lineage while retrieval and transfer remain Deep-Dive reinforcement cells", () => {
  const rows = buildImplementedBattleTestEvidenceAvailability();
  assert.ok(rows.every((row) => row.implementedDirectEvidenceKinds.includes("mastery")));
  assert.ok(rows.every((row) => !row.implementedDirectEvidenceKinds.includes("retrieval")));
  assert.ok(rows.every((row) => !row.implementedDirectEvidenceKinds.includes("transfer")));
});
