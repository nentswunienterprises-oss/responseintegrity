import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvidenceCompleteDiagnosisLedgerRows,
  canonicalizeEvidenceJson,
  replayEvidenceCompleteDiagnosis,
  diagnosisReplayInheritedBaselineSeconds,
} from "./evidenceCompleteDiagnosisSubmission";
import type {
  DiagnosisDimensionId,
  DiagnosisProbeId,
  DiagnosisProbeResult,
} from "./evidenceCompleteDiagnosis";
import { DIAGNOSIS_PROBES, isDiagnosisBaselineTimingOpportunity } from "./evidenceCompleteDiagnosis";
import { DIAGNOSIS_OBSERVATION_MATRIX } from "./diagnosisObservationMatrix";
import {
  buildPassiveExecutionTimingEvidence,
  buildTimedExecutionEvidence,
} from "./tpsTimingContract";

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

const executionSupported = {
  ...executionImmediateSupported,
  "execution.repeatability": "repeat_clean",
} as const;

const difficultySupported = {
  "difficulty.initial_response": "controlled_attempt",
  "difficulty.first_step_control": "controlled_independent_step",
  "difficulty.tolerance": "holds_and_recovers",
  "difficulty.rescue_dependence": "no_rescue",
} as const;

const timeBreakdown = {
  "time.start": "timed_freeze",
  "time.structure": "timed_structure_collapse",
  "time.pace": "panic_pace",
  "time.completion_integrity": "timed_non_completion",
} as const;

const passiveTiming = (seconds = 60) => {
  const startedAt = "2026-09-23T10:00:00.000Z";
  const endedAt = new Date(Date.parse(startedAt) + seconds * 1000).toISOString();
  const timing = buildPassiveExecutionTimingEvidence({ startedAt, endedAt });
  assert.ok(timing);
  return timing;
};

const timedTiming = (prescribedSeconds = 60, elapsedSeconds = 50) => {
  const startedAt = "2026-09-23T11:00:00.000Z";
  const endedAt = new Date(Date.parse(startedAt) + elapsedSeconds * 1000).toISOString();
  const timing = buildTimedExecutionEvidence({
    startedAt,
    endedAt,
    prescribedSeconds,
  });
  assert.ok(timing);
  return timing;
};

const full = (
  probeId: DiagnosisProbeId,
  values: Partial<Record<DiagnosisDimensionId, string>>,
  supportEvent: DiagnosisProbeResult["supportEvent"] = "none",
  timing?: {
    passiveSeconds?: number;
    timed?: { prescribedSeconds: number; elapsedSeconds: number };
  },
): DiagnosisProbeResult => ({
  probeId,
  supportEvent,
  observations: observations(values),
  ...(timing?.passiveSeconds
    ? { passiveTiming: passiveTiming(timing.passiveSeconds) }
    : {}),
  ...(timing?.timed
    ? {
        timedTiming: timedTiming(
          timing.timed.prescribedSeconds,
          timing.timed.elapsedSeconds,
        ),
      }
    : {}),
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

test("authoritative replay permits TPS-first probing when a valid inherited Timer Contract is bound", () => {
  const replay = replayEvidenceCompleteDiagnosis(
    "Time Pressure Stability",
    [],
    54,
  );
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.decision.nextProbeId, "stack.timed_challenge");
  assert.equal(replay.decision.timingBaseline.source, "inherited_contract");
  assert.equal(replay.decision.timingBaseline.baselineSeconds, 54);
});

test("a newly earned timer contract cannot reroute earlier baseline probes on reload or submit", () => {
  const runId = "synthetic-diagnosis";
  const history: DiagnosisProbeResult[] = [];
  let replay = replayEvidenceCompleteDiagnosis("Clarity", history);
  for (let i = 0; i < 12; i++) {
    assert.ok(replay.ok);
    if (!replay.ok || replay.decision.timingBaseline.ready) break;
    const probeId = replay.decision.nextProbeId!;
    const values = Object.fromEntries(DIAGNOSIS_PROBES[probeId].dimensions.map(d => [d,
      probeId === "stack.normal_independent" && ["clarity.vocabulary", "clarity.reason"].includes(d)
        ? "not_observed"
        : DIAGNOSIS_OBSERVATION_MATRIX[d].options.find(o => o.behaviorClass === "supported")!.id,
    ]));
    history.push(full(probeId, values, "none", isDiagnosisBaselineTimingOpportunity(probeId)
      ? { passiveSeconds: 60 } : undefined));
    replay = replayEvidenceCompleteDiagnosis("Clarity", history);
  }
  assert.ok(replay.ok);
  if (!replay.ok) return;
  assert.equal(replay.decision.timingBaseline.ready, true);
  assert.equal(replay.decision.nextProbeId, "stack.timed_challenge");
  const snapshot = JSON.stringify(history);
  // Reproduces the old bug: newly persisted authority invalidates the very
  // sequence that earned it by pretending the baseline existed at run start.
  assert.equal(replayEvidenceCompleteDiagnosis("Clarity", history, 60).ok, false);
  const inherited = diagnosisReplayInheritedBaselineSeconds(runId, `diagnosis-v1:${runId}`, 60);
  const restored = replayEvidenceCompleteDiagnosis("Clarity", history, inherited);
  assert.ok(restored.ok);
  if (!restored.ok) return;
  assert.equal(restored.decision.timingBaseline.source, "diagnosis_run");
  assert.equal(restored.decision.timingBaseline.baselineSeconds, 60);
  assert.equal(JSON.stringify(history), snapshot);
  history.push(full("stack.timed_challenge", {
    ...claritySupported, ...executionImmediateSupported, ...difficultySupported, ...timeBreakdown,
  }, "none", { timed: { prescribedSeconds: 60, elapsedSeconds: 50 } }));
  const submitted = replayEvidenceCompleteDiagnosis("Clarity", history, inherited);
  assert.ok(submitted.ok);
  if (!submitted.ok) return;
  assert.equal(submitted.decision.complete, true);
  assert.equal(submitted.decision.placementPhase, "Time Pressure Stability");
  // A contract earned by a different run or Training remains legitimate
  // inherited authority, including legacy seconds without an epoch marker.
  for (const epoch of ["diagnosis-v1:other-run", "training:other", null]) {
    const baseline = diagnosisReplayInheritedBaselineSeconds(runId, epoch, 54);
    const prior = replayEvidenceCompleteDiagnosis("Time Pressure Stability", [], baseline);
    assert.ok(prior.ok);
    if (prior.ok) assert.equal(prior.decision.nextProbeId, "stack.timed_challenge");
  }
});

test("TPS starting signal cannot jump directly to an arbitrary timed challenge", () => {
  const replay = replayEvidenceCompleteDiagnosis("Time Pressure Stability", [
    full("stack.timed_challenge", {
      ...claritySupported,
      ...executionImmediateSupported,
      ...difficultySupported,
      ...timeBreakdown,
    }, "none", {
      timed: { prescribedSeconds: 60, elapsedSeconds: 50 },
    }),
  ]);

  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.match(replay.error, /must be stack\.normal_independent/);
  }
});

test("authoritative replay unlocks the timed probe only after three clean comparable passive samples", () => {
  const history: DiagnosisProbeResult[] = [
    full("stack.normal_independent", {
      ...claritySupported,
      ...executionImmediateSupported,
    }, "none", { passiveSeconds: 58 }),
    full("execution.repeatability", executionSupported, "none", {
      passiveSeconds: 60,
    }),
    full("stack.challenge_no_timer", {
      ...claritySupported,
      ...executionImmediateSupported,
      ...difficultySupported,
    }),
    full("difficulty.recovery", difficultySupported),
    full("execution.repeatability", executionSupported, "none", {
      passiveSeconds: 62,
    }),
  ];

  const replay = replayEvidenceCompleteDiagnosis(
    "Time Pressure Stability",
    history,
  );

  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.decision.timingBaseline.ready, true);
  assert.equal(replay.decision.timingBaseline.baselineSeconds, 60);
  assert.equal(replay.decision.nextProbeId, "stack.timed_challenge");
});

test("timed diagnosis evidence must use the individualized baseline seconds", () => {
  const baselineHistory: DiagnosisProbeResult[] = [
    full("stack.normal_independent", {
      ...claritySupported,
      ...executionImmediateSupported,
    }, "none", { passiveSeconds: 58 }),
    full("execution.repeatability", executionSupported, "none", {
      passiveSeconds: 60,
    }),
    full("stack.challenge_no_timer", {
      ...claritySupported,
      ...executionImmediateSupported,
      ...difficultySupported,
    }),
    full("difficulty.recovery", difficultySupported),
    full("execution.repeatability", executionSupported, "none", {
      passiveSeconds: 62,
    }),
  ];

  const wrongTimer = replayEvidenceCompleteDiagnosis(
    "Time Pressure Stability",
    [
      ...baselineHistory,
      full("stack.timed_challenge", {
        ...claritySupported,
        ...executionImmediateSupported,
        ...difficultySupported,
        ...timeBreakdown,
      }, "none", {
        timed: { prescribedSeconds: 45, elapsedSeconds: 40 },
      }),
    ],
  );

  assert.equal(wrongTimer.ok, false);
  if (!wrongTimer.ok) {
    assert.match(wrongTimer.error, /individualized diagnosis timer is 60s/);
  }

  const correctTimer = replayEvidenceCompleteDiagnosis(
    "Time Pressure Stability",
    [
      ...baselineHistory,
      full("stack.timed_challenge", {
        ...claritySupported,
        ...executionImmediateSupported,
        ...difficultySupported,
        ...timeBreakdown,
      }, "none", {
        timed: { prescribedSeconds: 60, elapsedSeconds: 50 },
      }),
    ],
  );

  assert.equal(correctTimer.ok, true);
  if (!correctTimer.ok) return;
  assert.equal(correctTimer.decision.complete, true);
  assert.equal(correctTimer.decision.placementPhase, "Time Pressure Stability");
  assert.equal(correctTimer.decision.stability, "Low");
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

test("persisted pre-fix mixed episode can resolve without discarding later historical observations",()=>{
 const history=[
  full("clarity.recognition",claritySupported),
  full("stack.normal_independent",{...claritySupported,...executionImmediateSupported}),
  full("execution.repeatability",{...executionSupported,"execution.start":"guessing_or_disordered_start"}),
  full("execution.repeatability",executionSupported),
  full("execution.repeatability",{...executionSupported,"execution.start":"valid_start_after_hesitation","execution.repeatability":"repeat_with_minor_drift"}),
 ];
 const snapshot=JSON.stringify(history);
 const restored=replayEvidenceCompleteDiagnosis("Clarity",history,null,{legacyPrefixLength:history.length});
 assert.equal(restored.ok,true);
 if(!restored.ok)return;
 assert.equal(restored.decision.complete,true);
 assert.equal(restored.decision.placementPhase,"Structured Execution");
 assert.equal(restored.decision.stability,"Medium");
 assert.equal(restored.state.probeHistory.length,5);
 assert.equal(JSON.stringify(history),snapshot);
 // A new client cannot submit extra responses after placement is already known.
 assert.equal(replayEvidenceCompleteDiagnosis("Clarity",history).ok,false);
});

test("server session boundaries resume the precise missing question while retaining prior observations",()=>{
 const missing=full("clarity.recognition",{...claritySupported,"clarity.reason":"not_observed"});
 const history=[missing,missing,full("clarity.recognition",{...claritySupported,"clarity.reason":"partial_reason"})];
 assert.equal(replayEvidenceCompleteDiagnosis("Clarity",history).ok,false);
 const resumed=replayEvidenceCompleteDiagnosis("Clarity",history,null,{sessionStarts:[0,2]});
 assert.equal(resumed.ok,true);
 if(!resumed.ok)return;
 assert.equal(resumed.decision.complete,true);
 assert.equal(resumed.decision.stability,"Medium");
 assert.equal(resumed.state.probeHistory.length,3);
 assert.equal(replayEvidenceCompleteDiagnosis("Clarity",history,null,{sessionStarts:[0,0]}).ok,false);
});
