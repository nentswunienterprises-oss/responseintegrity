import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvidenceCompleteDiagnosisLedgerRows,
  canonicalizeEvidenceJson,
  replayEvidenceCompleteDiagnosis,
} from "./evidenceCompleteDiagnosisSubmission";
import type {
  DiagnosisDimensionId,
  DiagnosisProbeId,
  DiagnosisProbeResult,
} from "./evidenceCompleteDiagnosis";

const observations = (values: Partial<Record<DiagnosisDimensionId, string>>) =>
  Object.entries(values).map(([dimensionId, behaviorId]) => ({
    dimensionId: dimensionId as DiagnosisDimensionId,
    behaviorId: String(behaviorId),
  }));

const claritySupported = {
  "clarity.vocabulary": "accurate_recognition",
  "clarity.method": "correct_method_cleanly",
  "clarity.reason": "clear_reason",
  "clarity.immediate_apply": "engages_cleanly",
} as const;

const executionImmediateSupported = {
  "execution.start": "valid_independent_start",
  "execution.step_discipline": "structure_maintained",
  "execution.independence": "independent_throughout",
} as const;

const full = (
  probeId: DiagnosisProbeId,
  values: Partial<Record<DiagnosisDimensionId, string>>,
  supportEvent: DiagnosisProbeResult["supportEvent"] = "none",
): DiagnosisProbeResult => ({
  probeId,
  supportEvent,
  observations: observations(values),
});

test("authoritative replay rejects a client-selected probe", () => {
  const replay = replayEvidenceCompleteDiagnosis("Structured Execution", [
    full("clarity.recognition", claritySupported),
  ]);

  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.match(replay.error, /must be stack\.normal_independent/);
  }
});

test("authoritative replay rejects unknown behavior IDs", () => {
  const replay = replayEvidenceCompleteDiagnosis("Clarity", [
    full("clarity.recognition", {
      ...claritySupported,
      "clarity.reason": "made_up_behavior",
    }),
  ]);

  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.match(replay.error, /invalid behavioral evidence payload/);
  }
});

test("server replay can finish a Low Clarity placement from behavior", () => {
  const replay = replayEvidenceCompleteDiagnosis("Clarity", [
    full("clarity.recognition", {
      "clarity.vocabulary": "no_recognition",
      "clarity.method": "no_method",
      "clarity.reason": "no_reason",
      "clarity.immediate_apply": "cannot_engage",
    }),
  ]);

  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.decision.complete, true);
  assert.equal(replay.decision.placementPhase, "Clarity");
  assert.equal(replay.decision.stability, "Low");
  assert.equal(replay.decision.decisionAuthority, "behavioral_evidence");
});

test("server replay requires a dedicated repeatability observation", () => {
  const replay = replayEvidenceCompleteDiagnosis("Structured Execution", [
    full("stack.normal_independent", {
      ...claritySupported,
      ...executionImmediateSupported,
    }),
  ]);

  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.decision.complete, false);
  assert.equal(replay.decision.nextProbeId, "execution.repeatability");
});

test("ledger stores behavior IDs and zeroes numeric decision fields", () => {
  const history: DiagnosisProbeResult[] = [
    full(
      "clarity.recognition",
      {
        "clarity.vocabulary": "no_recognition",
        "clarity.method": "no_method",
        "clarity.reason": "partial_reason",
        "clarity.immediate_apply": "cannot_engage",
      },
    ),
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

  const rows = buildEvidenceCompleteDiagnosisLedgerRows(input);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].option_id, "no_recognition");
  assert.equal(rows[0].normalized_level, "breakdown");
  assert.equal(rows[0].score_contribution, 0);
  assert.equal(rows[0].score_contribution_max, 0);
  assert.equal(rows[0].constraint_profile.decisionAuthority, "behavioral_evidence");
  assert.equal(new Set(rows.map((row) => row.evidence_id)).size, rows.length);
});

test("canonical evidence comparison ignores jsonb object-key reordering but preserves array order", () => {
  const submitted = {
    probeId: "stack.timed_challenge",
    supportEvent: "neutral_clarification",
    observations: [
      { dimensionId: "clarity.vocabulary", behaviorId: "accurate_recognition" },
      { dimensionId: "clarity.method", behaviorId: "correct_method_cleanly" },
    ],
  };
  const jsonbRoundTrip = {
    observations: [
      { behaviorId: "accurate_recognition", dimensionId: "clarity.vocabulary" },
      { behaviorId: "correct_method_cleanly", dimensionId: "clarity.method" },
    ],
    supportEvent: "neutral_clarification",
    probeId: "stack.timed_challenge",
  };

  assert.equal(
    canonicalizeEvidenceJson(submitted),
    canonicalizeEvidenceJson(jsonbRoundTrip),
  );

  assert.notEqual(
    canonicalizeEvidenceJson(submitted),
    canonicalizeEvidenceJson({
      ...jsonbRoundTrip,
      observations: [...jsonbRoundTrip.observations].reverse(),
    }),
  );
});
