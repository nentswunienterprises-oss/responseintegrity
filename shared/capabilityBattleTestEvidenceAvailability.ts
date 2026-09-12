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

function isCurrentEvidenceChannelAvailable(
  entry: CapabilityBattleTestCoverageEntry,
  kind: BattleTestReplacementEvidenceKind,
) {
  if (kind === "mastery" || kind === "retrieval" || kind === "transfer") return true;
  if (kind === "practical") return CURRENT_PRACTICAL_DEEP_DIVES.has(entry.deepDiveKey);
  if (kind === "simulation") return CURRENT_SANDBOX_SIMULATION_DEEP_DIVES.has(entry.deepDiveKey);
  if (kind === "oral_defense") {
    return entry.proofClass === "integrity";
  }
  if (kind === "human_mock") {
    return entry.humanVerificationRequired;
  }
  return false;
}

export function getImplementedBattleTestEvidenceKinds(entry: CapabilityBattleTestCoverageEntry) {
  return entry.evidenceKinds.filter((kind) => isCurrentEvidenceChannelAvailable(entry, kind));
}

export function buildImplementedBattleTestEvidenceAvailability() {
  return CAPABILITY_BATTLE_TEST_COVERAGE.map((entry) => ({
    deepDiveKey: entry.deepDiveKey,
    questionKey: entry.questionKey,
    proofClass: entry.proofClass,
    humanVerificationRequired: entry.humanVerificationRequired,
    semanticEvidenceKinds: [...entry.evidenceKinds],
    implementedEvidenceKinds: getImplementedBattleTestEvidenceKinds(entry),
  }));
}

export function getBattleTestEvidenceAvailabilitySummary() {
  const rows = buildImplementedBattleTestEvidenceAvailability();
  const orphaned = rows.filter((row) => row.implementedEvidenceKinds.length === 0);
  const humanRequiredWithoutHumanChannel = rows.filter(
    (row) => row.humanVerificationRequired && !row.implementedEvidenceKinds.some(
      (kind) => kind === "practical" || kind === "oral_defense" || kind === "human_mock",
    ),
  );

  const questionsByImplementedChannel = Object.fromEntries(
    (["mastery", "retrieval", "transfer", "practical", "oral_defense", "simulation", "human_mock"] as BattleTestReplacementEvidenceKind[])
      .map((kind) => [kind, rows.filter((row) => row.implementedEvidenceKinds.includes(kind)).length]),
  );

  return {
    rows,
    orphanedQuestionIds: orphaned.map((row) => `${row.deepDiveKey}:${row.questionKey}`),
    humanRequiredWithoutHumanChannelIds: humanRequiredWithoutHumanChannel.map(
      (row) => `${row.deepDiveKey}:${row.questionKey}`,
    ),
    questionsByImplementedChannel,
  };
}
