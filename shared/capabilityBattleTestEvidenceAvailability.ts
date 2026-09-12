import {
  CAPABILITY_BATTLE_TEST_COVERAGE,
  type BattleTestReplacementEvidenceKind,
  type CapabilityBattleTestCoverageEntry,
} from "./capabilityBattleTestCoverage";
import type { TutorBattleTestPhaseKey } from "./battleTesting";

const CURRENT_PRACTICAL_DEEP_DIVES = new Set<TutorBattleTestPhaseKey>([
  "clarity",
  "structured_execution",
  "controlled_discomfort",
  "topic_conditioning",
  "logging_system",
  "session_flow_control",
  "tools_required",
]);

const CURRENT_SANDBOX_SIMULATION_DEEP_DIVES = new Set<TutorBattleTestPhaseKey>([
  "clarity",
  "structured_execution",
  "controlled_discomfort",
  "logging_system",
  "session_flow_control",
]);

function uniqueKinds(kinds: BattleTestReplacementEvidenceKind[]) {
  return Array.from(new Set(kinds));
}

/**
 * Question-level direct support is deliberately narrower than the architecture's
 * 33-cell reinforcement model.
 *
 * Every release-grade mastery bank must declare every canonical competency in
 * its Deep Dive and represent every canonical critical boundary. That makes
 * mastery the direct semantic replacement anchor for all 165 mapped legacy
 * requirements.
 *
 * Retrieval and transfer remain required 11+11 Deep-Dive evidence cells, but
 * their cumulative banks are not claimed as direct re-tests of every legacy
 * question. They therefore do not appear in this question-level direct list.
 */
export function getImplementedDirectBattleTestEvidenceKinds(entry: CapabilityBattleTestCoverageEntry) {
  const kinds: BattleTestReplacementEvidenceKind[] = ["mastery"];

  if (
    entry.humanVerificationRequired &&
    CURRENT_PRACTICAL_DEEP_DIVES.has(entry.deepDiveKey)
  ) {
    kinds.push("practical");
  }

  if (
    entry.proofClass !== "knowledge" &&
    CURRENT_SANDBOX_SIMULATION_DEEP_DIVES.has(entry.deepDiveKey)
  ) {
    kinds.push("simulation");
  }

  if (entry.proofClass === "integrity") {
    kinds.push("oral_defense");
  }

  if (entry.humanVerificationRequired) {
    kinds.push("human_mock");
  }

  return uniqueKinds(kinds);
}

export function buildImplementedBattleTestEvidenceAvailability() {
  return CAPABILITY_BATTLE_TEST_COVERAGE.map((entry) => ({
    deepDiveKey: entry.deepDiveKey,
    questionKey: entry.questionKey,
    proofClass: entry.proofClass,
    humanVerificationRequired: entry.humanVerificationRequired,
    semanticEvidenceKinds: [...entry.evidenceKinds],
    implementedDirectEvidenceKinds: getImplementedDirectBattleTestEvidenceKinds(entry),
  }));
}

export function getBattleTestEvidenceAvailabilitySummary() {
  const rows = buildImplementedBattleTestEvidenceAvailability();
  const orphaned = rows.filter((row) => row.implementedDirectEvidenceKinds.length === 0);
  const humanRequiredWithoutHumanChannel = rows.filter(
    (row) => row.humanVerificationRequired && !row.implementedDirectEvidenceKinds.some(
      (kind) => kind === "practical" || kind === "oral_defense" || kind === "human_mock",
    ),
  );

  const questionsByDirectImplementedChannel = Object.fromEntries(
    (["mastery", "practical", "oral_defense", "simulation", "human_mock"] as BattleTestReplacementEvidenceKind[])
      .map((kind) => [kind, rows.filter((row) => row.implementedDirectEvidenceKinds.includes(kind)).length]),
  );

  return {
    rows,
    orphanedQuestionIds: orphaned.map((row) => `${row.deepDiveKey}:${row.questionKey}`),
    humanRequiredWithoutHumanChannelIds: humanRequiredWithoutHumanChannel.map(
      (row) => `${row.deepDiveKey}:${row.questionKey}`,
    ),
    questionsByDirectImplementedChannel,
    deepDiveReinforcementCells: {
      retrieval: 11,
      transfer: 11,
    },
  };
}
