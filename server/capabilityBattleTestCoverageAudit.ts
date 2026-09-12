import {
  CAPABILITY_BATTLE_TEST_COVERAGE,
  validateCapabilityBattleTestCoverage,
} from "@shared/capabilityBattleTestCoverage";
import { TUTOR_BATTLE_TEST_PHASES } from "@shared/battleTesting";
import { TUTOR_BATTLE_TEST_PHASES_EXACT } from "./battleTestingBanks";

export function buildCapabilityBattleTestCoverageAudit() {
  const exactPhaseCounts = Object.fromEntries(
    TUTOR_BATTLE_TEST_PHASES_EXACT.map((phase) => [phase.key, phase.questions.length]),
  );
  const fallbackPhaseCounts = Object.fromEntries(
    TUTOR_BATTLE_TEST_PHASES.map((phase) => [phase.key, phase.questions.length]),
  );
  const exactQuestionCount = TUTOR_BATTLE_TEST_PHASES_EXACT.reduce(
    (total, phase) => total + phase.questions.length,
    0,
  );
  const fallbackQuestionCount = TUTOR_BATTLE_TEST_PHASES.reduce(
    (total, phase) => total + phase.questions.length,
    0,
  );
  const coverage = validateCapabilityBattleTestCoverage(TUTOR_BATTLE_TEST_PHASES_EXACT);
  const phasesWithoutFifteenQuestions = TUTOR_BATTLE_TEST_PHASES_EXACT
    .filter((phase) => phase.questions.length !== 15)
    .map((phase) => ({ key: phase.key, questionCount: phase.questions.length }));

  return {
    authoritative: false as const,
    source: "exact_runtime_battle_test_banks" as const,
    exactDeepDiveCount: TUTOR_BATTLE_TEST_PHASES_EXACT.length,
    exactQuestionCount,
    exactPhaseCounts,
    fallbackQuestionCount,
    fallbackPhaseCounts,
    fallbackDiffersFromExact: fallbackQuestionCount !== exactQuestionCount,
    phasesWithoutFifteenQuestions,
    coverage,
    mappedEntries: CAPABILITY_BATTLE_TEST_COVERAGE.length,
    cutoverDecision: null,
  };
}
