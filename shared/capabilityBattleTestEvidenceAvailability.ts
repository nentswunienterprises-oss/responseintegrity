import {
  CAPABILITY_BATTLE_TEST_COVERAGE,
  type BattleTestReplacementEvidenceKind,
  type CapabilityBattleTestCoverageEntry,
} from "./capabilityBattleTestCoverage";
import { CAPABILITY_PRACTICAL_PROOFS } from "./capabilityPracticalEvidence";
import { SANDBOX_SIMULATION_DESIGN_FIXTURE_V1 } from "./capabilitySandboxSimulationFixtures";
import {
  SANDBOX_MOCK_CRITERIA,
  type SandboxMockCriterionKey,
} from "./sandboxReadiness";
import type { TutorBattleTestPhaseKey } from "./battleTesting";

function canonicalCompetencyId(deepDiveKey: string, competencyKey: string) {
  return `${deepDiveKey}:${competencyKey}`;
}

function canonicalBoundaryId(deepDiveKey: string, boundaryKey: string) {
  return `${deepDiveKey}:${boundaryKey}`;
}

const PRACTICAL_COMPETENCY_IDS = new Set(
  CAPABILITY_PRACTICAL_PROOFS.flatMap((proof) =>
    proof.reviewRubric.criteria.flatMap((criterion) =>
      criterion.competencyLinks.map((link) =>
        canonicalCompetencyId(link.deepDiveKey, link.competencyKey),
      ),
    ),
  ),
);

const PRACTICAL_BOUNDARY_IDS = new Set(
  CAPABILITY_PRACTICAL_PROOFS.flatMap((proof) =>
    proof.reviewRubric.criteria.flatMap((criterion) =>
      criterion.criticalBoundaryLinks.map((link) =>
        canonicalBoundaryId(link.deepDiveKey, link.boundaryKey),
      ),
    ),
  ),
);

// Public design fixture only. The active private Sandbox simulation bank is not
// committed to the repository, so Sprint 17 does not claim live private-bank
// question coverage from this fixture.
const SIMULATION_FIXTURE_COMPETENCY_IDS = new Set(
  SANDBOX_SIMULATION_DESIGN_FIXTURE_V1.decisions.map((decision) =>
    canonicalCompetencyId(decision.deepDiveKey, decision.competencyKey),
  ),
);

const SIMULATION_FIXTURE_BOUNDARY_IDS = new Set(
  SANDBOX_SIMULATION_DESIGN_FIXTURE_V1.decisions.flatMap((decision) =>
    (decision.criticalBoundaryKeys || []).map((boundaryKey) =>
      canonicalBoundaryId(decision.deepDiveKey, boundaryKey),
    ),
  ),
);

const HUMAN_MOCK_CRITERIA_BY_DEEP_DIVE: Record<
  TutorBattleTestPhaseKey,
  SandboxMockCriterionKey[]
> = {
  clarity: [
    "phase_constraints_preserved",
    "student_response_managed",
    "evidence_captured",
    "system_result_respected",
  ],
  structured_execution: [
    "phase_constraints_preserved",
    "student_response_managed",
    "evidence_captured",
    "system_result_respected",
  ],
  controlled_discomfort: [
    "phase_constraints_preserved",
    "student_response_managed",
    "evidence_captured",
  ],
  time_pressure_stability: [
    "phase_constraints_preserved",
    "student_response_managed",
    "evidence_captured",
  ],
  topic_conditioning: [
    "system_direction_followed",
    "evidence_captured",
    "system_result_respected",
  ],
  intro_session_structure: [
    "system_direction_followed",
    "phase_constraints_preserved",
    "evidence_captured",
    "system_result_respected",
  ],
  logging_system: ["evidence_captured", "system_result_respected"],
  session_flow_control: [
    "system_direction_followed",
    "phase_constraints_preserved",
    "system_result_respected",
  ],
  drill_library: [
    "system_direction_followed",
    "phase_constraints_preserved",
    "student_response_managed",
  ],
  handover_verification: [
    "system_direction_followed",
    "evidence_captured",
    "system_result_respected",
  ],
  tools_required: ["evidence_captured"],
};

function uniqueKinds(kinds: BattleTestReplacementEvidenceKind[]) {
  return Array.from(new Set(kinds));
}

function entryTouchesCanonicalIds(
  entry: CapabilityBattleTestCoverageEntry,
  competencyIds: Set<string>,
  boundaryIds: Set<string>,
) {
  return (
    entry.competencyKeys.some((competencyKey) =>
      competencyIds.has(canonicalCompetencyId(entry.deepDiveKey, competencyKey)),
    ) ||
    entry.criticalBoundaryKeys.some((boundaryKey) =>
      boundaryIds.has(canonicalBoundaryId(entry.deepDiveKey, boundaryKey)),
    )
  );
}

/**
 * Direct question-level support is intentionally narrow.
 *
 * Every release-grade mastery bank must retain every canonical Deep Dive
 * competency and critical boundary, so mastery remains the semantic anchor for
 * all 165 mapped legacy requirements.
 *
 * Practical is counted as direct only when the current observable rubric links
 * the same canonical competency or boundary. Retrieval and transfer remain
 * 11+11 Deep-Dive reinforcement cells rather than 165 direct question replicas.
 * Oral Defense, the Sandbox simulation design fixture, and the human Mock are
 * reported separately because they are targeted/sampled verification channels,
 * not one-for-one re-tests of every mapped legacy question.
 */
export function getImplementedDirectBattleTestEvidenceKinds(
  entry: CapabilityBattleTestCoverageEntry,
) {
  const kinds: BattleTestReplacementEvidenceKind[] = ["mastery"];

  if (
    entryTouchesCanonicalIds(
      entry,
      PRACTICAL_COMPETENCY_IDS,
      PRACTICAL_BOUNDARY_IDS,
    )
  ) {
    kinds.push("practical");
  }

  return uniqueKinds(kinds);
}

export function isCoveredBySandboxSimulationDesignFixture(
  entry: CapabilityBattleTestCoverageEntry,
) {
  return entryTouchesCanonicalIds(
    entry,
    SIMULATION_FIXTURE_COMPETENCY_IDS,
    SIMULATION_FIXTURE_BOUNDARY_IDS,
  );
}

export function isTargetableByOralDefense(entry: CapabilityBattleTestCoverageEntry) {
  return entry.proofClass === "integrity";
}

export function getHumanMockBackstopCriteria(
  entry: CapabilityBattleTestCoverageEntry,
): SandboxMockCriterionKey[] {
  if (!entry.humanVerificationRequired) return [];
  return [...HUMAN_MOCK_CRITERIA_BY_DEEP_DIVE[entry.deepDiveKey]];
}

export function buildImplementedBattleTestEvidenceAvailability() {
  return CAPABILITY_BATTLE_TEST_COVERAGE.map((entry) => ({
    deepDiveKey: entry.deepDiveKey,
    questionKey: entry.questionKey,
    proofClass: entry.proofClass,
    humanVerificationRequired: entry.humanVerificationRequired,
    semanticEvidenceKinds: [...entry.evidenceKinds],
    implementedDirectEvidenceKinds: getImplementedDirectBattleTestEvidenceKinds(entry),
    sandboxSimulationDesignFixtureCovered: isCoveredBySandboxSimulationDesignFixture(entry),
    oralDefenseTargetable: isTargetableByOralDefense(entry),
    humanMockCriteria: getHumanMockBackstopCriteria(entry),
  }));
}

export function getBattleTestEvidenceAvailabilitySummary() {
  const rows = buildImplementedBattleTestEvidenceAvailability();
  const orphaned = rows.filter(
    (row) => !row.implementedDirectEvidenceKinds.includes("mastery"),
  );
  const humanRequiredWithoutHumanChannel = rows.filter(
    (row) =>
      row.humanVerificationRequired &&
      !row.implementedDirectEvidenceKinds.includes("practical") &&
      !row.oralDefenseTargetable &&
      row.humanMockCriteria.length === 0,
  );

  const questionsByDirectImplementedChannel = Object.fromEntries(
    (["mastery", "practical"] as BattleTestReplacementEvidenceKind[]).map((kind) => [
      kind,
      rows.filter((row) => row.implementedDirectEvidenceKinds.includes(kind)).length,
    ]),
  );

  const knownMockCriteria = new Set(
    SANDBOX_MOCK_CRITERIA.map((criterion) => criterion.key),
  );
  const unknownMockCriterionRefs = rows.flatMap((row) =>
    row.humanMockCriteria
      .filter((criterion) => !knownMockCriteria.has(criterion))
      .map((criterion) => `${row.deepDiveKey}:${row.questionKey}:${criterion}`),
  );

  return {
    rows,
    orphanedQuestionIds: orphaned.map(
      (row) => `${row.deepDiveKey}:${row.questionKey}`,
    ),
    humanRequiredWithoutHumanChannelIds: humanRequiredWithoutHumanChannel.map(
      (row) => `${row.deepDiveKey}:${row.questionKey}`,
    ),
    questionsByDirectImplementedChannel,
    oralDefenseTargetableQuestionCount: rows.filter(
      (row) => row.oralDefenseTargetable,
    ).length,
    sandboxSimulationDesignFixtureQuestionCount: rows.filter(
      (row) => row.sandboxSimulationDesignFixtureCovered,
    ).length,
    humanMockBackstopQuestionCount: rows.filter(
      (row) => row.humanMockCriteria.length > 0,
    ).length,
    humanMockCriterionCoverage: Object.fromEntries(
      SANDBOX_MOCK_CRITERIA.map((criterion) => [
        criterion.key,
        rows.filter((row) => row.humanMockCriteria.includes(criterion.key)).length,
      ]),
    ),
    unknownMockCriterionRefs,
    livePrivateSimulationCoverageAudited: false as const,
    livePrivateSimulationCoverageReason:
      "The active simulation bank is private server-side data and is not committed to the repository. Sprint 17 audits the public design fixture only and makes no live-bank coverage claim.",
    deepDiveReinforcementCells: {
      retrieval: 11,
      transfer: 11,
    },
  };
}
