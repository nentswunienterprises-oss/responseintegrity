import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { CAPABILITY_BATTLE_TEST_COVERAGE } from "@shared/capabilityBattleTestCoverage";
import { TUTOR_BATTLE_TEST_PHASES_EXACT } from "./battleTestingBanks";
import { buildCapabilityBattleTestCoverageAudit } from "./capabilityBattleTestCoverageAudit";

const mappingSource = fs.readFileSync(
  new URL("../shared/capabilityBattleTestCoverage.ts", import.meta.url),
  "utf8",
);
const availabilitySource = fs.readFileSync(
  new URL("../shared/capabilityBattleTestEvidenceAvailability.ts", import.meta.url),
  "utf8",
);
const auditSource = fs.readFileSync(
  new URL("./capabilityBattleTestCoverageAudit.ts", import.meta.url),
  "utf8",
);

test("exact runtime tutor Battle Test bank is 11 Deep Dives x 15 questions", () => {
  const audit = buildCapabilityBattleTestCoverageAudit();
  assert.equal(audit.exactDeepDiveCount, 11);
  assert.equal(audit.exactQuestionCount, 165);
  assert.deepEqual(audit.phasesWithoutFifteenQuestions, []);
  assert.ok(Object.values(audit.exactPhaseCounts).every((count) => count === 15));
});

test("every exact runtime Battle Test question is mapped exactly once", () => {
  const audit = buildCapabilityBattleTestCoverageAudit();
  assert.equal(audit.mappedEntries, 165);
  assert.equal(audit.coverage.liveQuestionCount, 165);
  assert.equal(audit.coverage.mappedQuestionCount, 165);
  assert.deepEqual(audit.coverage.duplicateLiveQuestionIds, []);
  assert.deepEqual(audit.coverage.duplicateCoverageIds, []);
  assert.deepEqual(audit.coverage.missingCoverageIds, []);
  assert.deepEqual(audit.coverage.staleCoverageIds, []);
  assert.equal(audit.coverage.valid, true);
});

test("replacement proof classes distinguish automated knowledge from human-observable evidence", () => {
  const audit = buildCapabilityBattleTestCoverageAudit();
  assert.deepEqual(audit.coverage.countsByProofClass, {
    knowledge: 76,
    discernment: 33,
    observable_execution: 21,
    integrity: 35,
  });
  assert.equal(audit.coverage.humanVerificationQuestionCount, 56);
  assert.equal(audit.coverage.criticalBoundaryQuestionCount, 35);
});

test("all current auto-critical Battle Test questions have canonical critical-boundary lineage", () => {
  const audit = buildCapabilityBattleTestCoverageAudit();
  const autoCriticalIds = TUTOR_BATTLE_TEST_PHASES_EXACT.flatMap((phase) =>
    phase.questions
      .filter((question) => question.autoCriticalOnFail)
      .map((question) => `${phase.key}:${question.key}`),
  );
  assert.equal(autoCriticalIds.length, 35);
  assert.deepEqual(audit.coverage.criticalWithoutBoundary, []);

  const mappingById = new Map(
    CAPABILITY_BATTLE_TEST_COVERAGE.map((entry) => [`${entry.deepDiveKey}:${entry.questionKey}`, entry]),
  );
  for (const id of autoCriticalIds) {
    const entry = mappingById.get(id);
    assert.ok(entry, `Missing coverage mapping for ${id}`);
    assert.equal(entry.proofClass, "integrity", `${id} must remain an integrity proof`);
    assert.ok(entry.criticalBoundaryKeys.length > 0, `${id} needs canonical boundary lineage`);
    assert.equal(entry.humanVerificationRequired, true, `${id} cannot be claimed as automated-only replacement evidence`);
  }
});

test("audit distinguishes direct semantic evidence from compressed human verification", () => {
  const audit = buildCapabilityBattleTestCoverageAudit();
  assert.equal(audit.directEvidenceChannelCounts.mastery, 165);
  assert.ok(audit.directEvidenceChannelCounts.practical > 0);
  assert.equal(audit.oralDefenseTargetableQuestionCount, 35);
  assert.equal(audit.humanMockBackstopQuestionCount, 56);
  assert.deepEqual(audit.humanRequiredWithoutHumanChannelIds, []);
  assert.deepEqual(audit.unknownMockCriterionRefs, []);
});

test("public simulation fixture is not promoted into an unverified live private-bank coverage claim", () => {
  const audit = buildCapabilityBattleTestCoverageAudit();
  assert.ok(audit.sandboxSimulationDesignFixtureQuestionCount > 0);
  assert.equal(audit.livePrivateSimulationCoverageAudited, false);
  assert.equal(audit.evidenceAvailability.livePrivateSimulationCoverageAudited, false);
});

test("coverage metadata does not copy Battle Test answer keys or private evaluator content", () => {
  assert.doesNotMatch(mappingSource, /expectedAnswer/);
  assert.doesNotMatch(mappingSource, /failIndicators/);
  assert.doesNotMatch(mappingSource, /correctOptionKeys/);
  assert.doesNotMatch(mappingSource, /criticalFailOptionKeys/);
  assert.doesNotMatch(mappingSource, /scenarioSummary:/);
  assert.doesNotMatch(mappingSource, /reviewerInstruction:/);
});

test("audit exposes the 93-question shared fallback mismatch instead of silently treating it as the runtime bank", () => {
  const audit = buildCapabilityBattleTestCoverageAudit();
  assert.equal(audit.exactQuestionCount, 165);
  assert.equal(audit.fallbackQuestionCount, 93);
  assert.equal(audit.fallbackDiffersFromExact, true);
  assert.equal(audit.source, "exact_runtime_battle_test_banks");
});

test("coverage audit is advisory only and contains no authority mutation path", () => {
  const audit = buildCapabilityBattleTestCoverageAudit();
  assert.equal(audit.authoritative, false);
  assert.equal(audit.cutoverDecision, null);
  for (const source of [mappingSource, availabilitySource, auditSource]) {
    assert.doesNotMatch(source, /INSERT\s+INTO/i);
    assert.doesNotMatch(source, /UPDATE\s+/i);
    assert.doesNotMatch(source, /DELETE\s+FROM/i);
    assert.doesNotMatch(source, /recordSandboxMockAssessment/);
    assert.doesNotMatch(source, /operational_mode\s*=/i);
    assert.doesNotMatch(source, /certification_status\s*=/i);
  }
});
