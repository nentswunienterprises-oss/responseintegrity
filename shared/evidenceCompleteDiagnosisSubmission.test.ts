import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvidenceCompleteDiagnosisLedgerRows,
  replayEvidenceCompleteDiagnosis,
} from "./evidenceCompleteDiagnosisSubmission";
import type {
  DiagnosisDimensionId,
  DiagnosisObservationLevel,
  DiagnosisProbeId,
  DiagnosisProbeResult,
} from "./evidenceCompleteDiagnosis";

const observations = (
  values: Partial<Record<DiagnosisDimensionId, DiagnosisObservationLevel>>,
) => Object.entries(values).map(([dimensionId, level]) => ({
  dimensionId: dimensionId as DiagnosisDimensionId,
  level: level as DiagnosisObservationLevel,
}));

const clarityClear = {
  "clarity.vocabulary": "clear",
  "clarity.method": "clear",
  "clarity.reason": "clear",
  "clarity.immediate_apply": "clear",
} as const;

const executionClear = {
  "execution.start": "clear",
  "execution.step_discipline": "clear",
  "execution.repeatability": "clear",
  "execution.independence": "clear",
} as const;

const full = (
  probeId: DiagnosisProbeId,
  values: Partial<Record<DiagnosisDimensionId, DiagnosisObservationLevel>>,
  supportEvent: DiagnosisProbeResult["supportEvent"] = "none",
): DiagnosisProbeResult => ({
  probeId,
  supportEvent,
  observations: observations(values),
});

test("authoritative replay rejects a client-selected probe", () => {
  const replay = replayEvidenceCompleteDiagnosis("Structured Execution", [
    full("clarity.recognition", clarityClear),
  ]);

  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.match(replay.error, /must be stack\.normal_independent/);
  }
});

test("authoritative replay rejects a probe with incomplete evidence dimensions", () => {
  const replay = replayEvidenceCompleteDiagnosis("Clarity", [
    full("clarity.recognition", {
      "clarity.vocabulary": "clear",
      "clarity.method": "clear",
    }),
  ]);

  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.match(replay.error, /must record exactly 4 evidence dimensions/);
  }
});

test("server replay can finish a Low Clarity placement after one valid opportunity", () => {
  const replay = replayEvidenceCompleteDiagnosis("Clarity", [
    full("clarity.recognition", {
      "clarity.vocabulary": "weak",
      "clarity.method": "weak",
      "clarity.reason": "partial",
      "clarity.immediate_apply": "weak",
    }),
  ]);

  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.decision.complete, true);
  assert.equal(replay.decision.placementPhase, "Clarity");
  assert.equal(replay.decision.stability, "Low");
  assert.equal(replay.nextProbe, null);
});

test("server replay requires repeatability before clearing Structured Execution", () => {
  const replay = replayEvidenceCompleteDiagnosis("Structured Execution", [
    full("stack.normal_independent", {
      ...clarityClear,
      ...executionClear,
    }),
  ]);

  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.decision.complete, false);
  assert.equal(replay.decision.nextProbeId, "execution.repeatability");
});

test("ledger projection is deterministic and preserves contamination metadata", () => {
  const history: DiagnosisProbeResult[] = [
    full("clarity.recognition", {
      "clarity.vocabulary": "weak",
      "clarity.method": "weak",
      "clarity.reason": "partial",
      "clarity.immediate_apply": "weak",
    }, "teaching"),
    full("clarity.recognition", {
      "clarity.vocabulary": "weak",
      "clarity.method": "weak",
      "clarity.reason": "partial",
      "clarity.immediate_apply": "weak",
    }),
  ];
  const replay = replayEvidenceCompleteDiagnosis("Clarity", history);

  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.decision.complete, true);

  const input = {
    sourceDrillId: "11111111-1111-4111-8111-111111111111",
    studentId: "student-1",
    tutorId: "tutor-1",
    topic: "Fractions",
    scheduledSessionId: "session-1",
    sessionContext: "intro" as const,
    observedAt: "2026-09-18T06:00:00.000Z",
    state: replay.state,
    decision: replay.decision,
  };

  const first = buildEvidenceCompleteDiagnosisLedgerRows(input);
  const second = buildEvidenceCompleteDiagnosisLedgerRows(input);

  assert.deepEqual(first, second);
  assert.equal(first.length, 8);
  assert.equal(first[0].constraint_profile.contaminated, true);
  assert.equal(first[4].constraint_profile.contaminated, false);
  assert.equal(new Set(first.map((row) => row.evidence_id)).size, first.length);
  assert.equal(first[0].state_phase_after, "Clarity");
  assert.equal(first[0].stability_after, "Low");
});
