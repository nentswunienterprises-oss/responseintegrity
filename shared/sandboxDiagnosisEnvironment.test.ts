import assert from "node:assert/strict";
import test from "node:test";
import {
  DIAGNOSIS_PROBES,
  evaluateEvidenceCompleteDiagnosis,
  type DiagnosisBehaviorClass,
  type DiagnosisProbeId,
} from "./evidenceCompleteDiagnosis";
import { DIAGNOSIS_OBSERVATION_MATRIX } from "./diagnosisObservationMatrix";
import { renderSandboxDiagnosisExceptionNarrativeV2, SANDBOX_DIAGNOSIS_EXCEPTION_NARRATIVE_VERSION } from "./sandboxDiagnosisExceptionNarrativesV2";
import {
  buildSandboxDiagnosisProbeResult,
  compareSandboxDiagnosisDecisions,
  compareSandboxDiagnosisProbe,
  deduplicateSandboxDiagnosisOutcomes,
  rebuildSandboxDiagnosisState,
  selectSandboxDiagnosisOutcome,
  validateSandboxDiagnosisOutcomeDefinition,
  type SandboxDiagnosisOutcomeDefinition,
} from "./sandboxDiagnosisEnvironment";

const outcomeFor = (
  probeId: DiagnosisProbeId,
  key: string,
  behaviorClass: DiagnosisBehaviorClass = "supported",
  challenge: SandboxDiagnosisOutcomeDefinition["challengeCapabilities"] = [],
): SandboxDiagnosisOutcomeDefinition => {
  const probe = DIAGNOSIS_PROBES[probeId];
  return {
    key,
    version: 1,
    probeId,
    studentBehavior: "The simulated student gives a coherent observable diagnosis response.",
    canonicalObservations: probe.dimensions.map((dimensionId) => {
      const option =
        DIAGNOSIS_OBSERVATION_MATRIX[dimensionId].options.find(
          (candidate) => candidate.behaviorClass === behaviorClass,
        ) ||
        DIAGNOSIS_OBSERVATION_MATRIX[dimensionId].options.find(
          (candidate) => candidate.behaviorClass === "supported",
        )!;
      return { dimensionId, behaviorId: option.id };
    }),
    trajectoryClass: behaviorClass,
    weight: 1,
    simulatedElapsedSeconds: 48,
    challengeCapabilities: challenge,
    allowedStartingPhases: ["Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability"],
  };
};

test("Sandbox diagnosis outcomes record only dimensions exposed by the concrete response", () => {
  const outcome = outcomeFor("clarity.recognition", "clarity-clean");
  assert.doesNotThrow(() => validateSandboxDiagnosisOutcomeDefinition(outcome));
  const sparse = {
    ...outcome,
    canonicalObservations: outcome.canonicalObservations.slice(0, 2),
  };
  assert.doesNotThrow(() => validateSandboxDiagnosisOutcomeDefinition(sparse));
  const empty = { ...outcome, canonicalObservations: [] };
  assert.throws(() => validateSandboxDiagnosisOutcomeDefinition(empty), /at least one observable behavior/);
});

test("Sandbox diagnosis selector prioritizes the earliest unsupported capability when plausible", () => {
  const plain = outcomeFor("clarity.recognition", "plain");
  const target = outcomeFor(
    "clarity.recognition",
    "target",
    "conditional",
    ["observation_integrity"],
  );
  const context = {
    startingPhase: "Clarity" as const,
    probeId: "clarity.recognition" as const,
    sequenceNumber: 2,
    earliestUnsupportedCapability: "observation_integrity" as const,
    recentOutcomeKeys: [] as string[],
  };
  const a = selectSandboxDiagnosisOutcome({
    seed: "fixed-seed",
    outcomes: [plain, target],
    context,
  });
  const b = selectSandboxDiagnosisOutcome({
    seed: "fixed-seed",
    outcomes: [plain, target],
    context,
  });
  assert.equal(a.key, "target");
  assert.equal(b.key, "target");
});

test("Sandbox diagnosis comparison separates condition and observation truth", () => {
  const outcome = outcomeFor("clarity.recognition", "clarity-clean");
  const correct = compareSandboxDiagnosisProbe({
    sequenceNumber: 1,
    sessionNumber: 2,
    phase: "Clarity",
    outcome,
    submitted: {
      probeId: outcome.probeId,
      observations: outcome.canonicalObservations,
      supportEvent: "none",
    },
  });
  assert.equal(correct.observationExact, true);
  assert.equal(correct.conditionConformed, true);

  const contaminated = compareSandboxDiagnosisProbe({
    sequenceNumber: 1,
    sessionNumber: 2,
    phase: "Clarity",
    outcome,
    submitted: {
      probeId: outcome.probeId,
      observations: outcome.canonicalObservations,
      supportEvent: "teaching",
    },
  });
  assert.equal(contaminated.conditionConformed, false);
  assert.equal(
    contaminated.capabilityEvidence.find((item) => item.layer === "condition_integrity")
      ?.evidenceClass,
    "breakdown",
  );
});

test("Sandbox diagnosis baseline timing is system-owned and can drive evidence-complete diagnosis", () => {
  const first = outcomeFor("stack.normal_independent", "normal-1", "supported");
  const second = outcomeFor("execution.repeatability", "repeat-1", "supported");

  const firstResult = buildSandboxDiagnosisProbeResult({
    outcome: first,
    observations: first.canonicalObservations,
    supportEvent: "none",
    sequenceNumber: 1,
    timingBaselineSeconds: null,
  });
  assert.ok(firstResult.passiveTiming);
  assert.equal(firstResult.passiveTiming?.elapsedMs, 48000);

  let state = rebuildSandboxDiagnosisState({
    startingPhase: "Structured Execution",
    history: [firstResult],
  });
  let decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.equal(decision.complete, false);
  assert.equal(decision.nextProbeId, "execution.repeatability");

  const secondResult = buildSandboxDiagnosisProbeResult({
    outcome: second,
    observations: second.canonicalObservations,
    supportEvent: "none",
    sequenceNumber: 2,
    timingBaselineSeconds: decision.timingBaseline.baselineSeconds,
  });
  state = rebuildSandboxDiagnosisState({
    startingPhase: "Structured Execution",
    history: [firstResult, secondResult],
  });
  decision = evaluateEvidenceCompleteDiagnosis(state);
  assert.ok(decision.timingBaseline.sampleCount >= 1);
});

test("Sandbox targeted diagnosis authority detects Specialist placement divergence", () => {
  const canonicalOutcome = outcomeFor("clarity.recognition", "clarity-break", "breakdown");
  const specialistOutcome = outcomeFor("clarity.recognition", "clarity-clean", "supported");

  const canonicalResult = buildSandboxDiagnosisProbeResult({
    outcome: canonicalOutcome,
    observations: canonicalOutcome.canonicalObservations,
    supportEvent: "none",
    sequenceNumber: 1,
    timingBaselineSeconds: null,
  });
  const specialistResult = buildSandboxDiagnosisProbeResult({
    outcome: canonicalOutcome,
    observations: specialistOutcome.canonicalObservations,
    supportEvent: "none",
    sequenceNumber: 1,
    timingBaselineSeconds: null,
  });

  const canonicalState = rebuildSandboxDiagnosisState({
    startingPhase: "Clarity",
    history: [canonicalResult],
  });
  const specialistState = rebuildSandboxDiagnosisState({
    startingPhase: "Clarity",
    history: [specialistResult],
  });
  const comparison = compareSandboxDiagnosisDecisions({
    canonicalState,
    specialistState,
    sequenceNumber: 1,
    sessionNumber: 3,
    phase: "Clarity",
    probeId: "clarity.recognition",
  });
  assert.equal(comparison.canonicalDecision.complete, true);
  assert.equal(comparison.canonicalDecision.placementPhase, "Clarity");
  assert.equal(comparison.authorityAligned, false);
  assert.equal(
    comparison.capabilityEvidence.find((item) => item.layer === "authority_integrity")
      ?.evidenceClass,
    "breakdown",
  );
});

test("Sandbox Diagnosis and Handover replay the same trajectory profile without changing evidence validity", () => {
  const seed = "cross-mode-student-seed";
  const outcomes = [
    outcomeFor("clarity.recognition", "strong", "supported"),
    outcomeFor("clarity.recognition", "uncertain", "conditional"),
    outcomeFor("clarity.recognition", "unseen", "not_observed"),
    outcomeFor("clarity.recognition", "confounded", "confounded"),
  ];
  const context = {
    startingPhase: "Clarity" as const,
    probeId: "clarity.recognition" as const,
    sequenceNumber: 2,
  };
  for (const scope of ["diagnosis", "handover"]) {
    const key = [seed, scope, "fixed-context"].join(":");
    const first = selectSandboxDiagnosisOutcome({ seed: key, outcomes, context });
    const second = selectSandboxDiagnosisOutcome({ seed: key, outcomes, context });
    assert.equal(first.key, second.key);
    assert.ok(outcomes.some((candidate) => candidate.key === first.key));
  }
});


test("Sandbox Diagnosis/Handover preserve legacy V1 outcome selection and use one V2 profile identity", () => {
  const outcomes = [
    outcomeFor("stack.timed_challenge", "timer-composed", "supported"),
    outcomeFor("stack.timed_challenge", "timer-unstable", "conditional"),
    outcomeFor("stack.timed_challenge", "timer-collapse", "breakdown"),
    outcomeFor("stack.timed_challenge", "timer-unseen", "not_observed"),
  ];
  // Entry phase Clarity, actual tested probe Time Pressure Stability.
  const context = {
    startingPhase: "Clarity" as const,
    probeId: "stack.timed_challenge" as const,
    sequenceNumber: 4,
  };
  const seed = "identity-v1-4:handover:constant-session";
  const legacy = selectSandboxDiagnosisOutcome({
    seed, profileSeed: "identity-v1-4", outcomes, context,
  });
  assert.equal(legacy.key, selectSandboxDiagnosisOutcome({
    seed, profileSeed: "identity-v1-3", outcomes,
    context: { ...context, behaviorModelVersion: 1 },
  }).key, "legacy V1 outcome selection must ignore a newly added profile identity");
  const versioned = { ...context, behaviorModelVersion: 2 as const };
  const first = selectSandboxDiagnosisOutcome({
    seed, profileSeed: "identity-v1-4", outcomes, context: versioned,
  });
  const replay = selectSandboxDiagnosisOutcome({
    seed, profileSeed: "identity-v1-4", outcomes, context: versioned,
  });
  assert.equal(first.key, replay.key);
  assert.ok(outcomes.some((outcome) => outcome.key === first.key));
});


test("V2 Diagnosis/Handover scripts only seven credible visible worked-example confounds", () => {
  assert.equal(SANDBOX_DIAGNOSIS_EXCEPTION_NARRATIVE_VERSION,3);
  const observed=new Set<string>();
  const probes=Object.keys(DIAGNOSIS_PROBES) as DiagnosisProbeId[];
  assert.equal(probes.length,7);
  for(const probe of probes){
    for(const pattern of [8]){
      const key=probe+".pattern_"+pattern;
      const body=renderSandboxDiagnosisExceptionNarrativeV2(key);
      assert.ok(body && body.length>=100,key+" lacks a concrete observability condition");
      assert.doesNotMatch(body,/glitch|screen refresh|new displayed order|changes the required step order|fictional video freeze/i);
      assert.match(body,/worked example|worked solution|reference sheet|revision sheet|open notebook|revision page/i,
        "Only a visible worked reference may confound a V2 Diagnosis/Handover rep");
      assert.ok(!observed.has(body),key+" repeats another exceptional story");
      observed.add(body);
    }
    assert.equal(renderSandboxDiagnosisExceptionNarrativeV2(probe+".pattern_7"),null,
      "V2 cannot script a missing observation in "+probe);
  }
  assert.equal(observed.size,7);
  assert.equal(renderSandboxDiagnosisExceptionNarrativeV2("clarity.recognition.pattern_1"),null,
    "Normal student patterns cannot be silently reauthored");
});

test("V2 Diagnosis/Handover rare incident selection is deterministic and keeps normal student evidence primary", () => {
  const probeId="clarity.recognition" as const;
  const candidates=[
    outcomeFor(probeId,"clarity.recognition.pattern_1","supported"),
    outcomeFor(probeId,"clarity.recognition.pattern_2","near_stable"),
    outcomeFor(probeId,"clarity.recognition.pattern_7","not_observed"),
    outcomeFor(probeId,"clarity.recognition.pattern_8","confounded"),
  ];
  const N=4000;
  let exceptional=0;
  let inventedUnseen=0;
  for(let i=0;i<N;i++){
    const input={
      seed:"v2-diagnosis-rare-fix-"+i+":handover:fixture",
      profileSeed:"v2-diagnosis-rare-fix-"+i,
      outcomes:candidates,
      context:{
        startingPhase:"Clarity" as const,
        probeId,sequenceNumber:i+1,behaviorModelVersion:2 as const,
      },
    };
    const selected=selectSandboxDiagnosisOutcome(input);
    const replay=selectSandboxDiagnosisOutcome(input);
    assert.deepEqual(selected,replay,"Protected cross-mode result must replay identically");
    if(["not_observed","confounded"].includes(selected.trajectoryClass)){
      exceptional++;
      if(selected.trajectoryClass==="not_observed")inventedUnseen++;
      assert.equal(selected.studentBehavior,
        renderSandboxDiagnosisExceptionNarrativeV2(selected.key),
        "Rare V2 diagnostics must render the calibrated narrative");
    }else{
      assert.equal(selected.studentBehavior,
        candidates.find(x=>x.key===selected.key)?.studentBehavior,
        "The six normal diagnostic stories must remain unmodified");
    }
  }
  assert.equal(inventedUnseen,0,"V2 Diagnosis/Handover must not invent missing observations");
  assert.ok(exceptional<N*0.025,
    "Rare V2 diagnostic integrity situations must not dominate normal placement.");
  assert.throws(() => selectSandboxDiagnosisOutcome({
    seed:"no-scripted-unseen-diagnosis",
    outcomes:[candidates[2]],
    context:{startingPhase:"Clarity",probeId,sequenceNumber:10,behaviorModelVersion:2},
  }),/no observable, eligible V2 outcomes/,
    "V2 must refuse a bank containing only staged not-observed scenarios");
  const historical=selectSandboxDiagnosisOutcome({
    seed:"historical-v1-unseen",
    outcomes:[candidates[2]],
    context:{startingPhase:"Clarity",probeId,sequenceNumber:10,behaviorModelVersion:1},
  });
  assert.equal(historical.trajectoryClass,"not_observed",
    "Previously recorded V1 missing-evidence scenarios remain available for replay");
});

test("V2 Diagnosis evidence projections invalidate only contaminated adjacent fields", () => {
  for(const [probeId,invalidDims] of [
    ["execution.repeatability",["execution.repeatability","execution.independence"]],
    ["time.consistency",["time.completion_integrity"]],
  ] as Array<[DiagnosisProbeId,string[]]>){
    const ordinary=outcomeFor(probeId,probeId+".pattern_1","supported");
    const disrupted:SandboxDiagnosisOutcomeDefinition={
      ...outcomeFor(probeId,probeId+".pattern_8","supported"),
      trajectoryClass:"confounded",
      canonicalObservations:outcomeFor(probeId,probeId+".pattern_8","supported")
        .canonicalObservations.map(item=>({
          ...item,
          behaviorId:item.dimensionId===(probeId==="execution.repeatability"
            ? "execution.step_discipline" : "time.structure")
            ? "confounded" : item.behaviorId,
        })),
    };
    let witnessed=false;
    for(let i=0;i<7000;i++){
      const result=selectSandboxDiagnosisOutcome({
        seed:"diagnosis-contamination-proof-"+probeId+"-"+i,
        profileSeed:"identity-v1-1",
        outcomes:[ordinary,disrupted],
        context:{startingPhase:"Clarity",probeId,sequenceNumber:i+1,
          behaviorModelVersion:2},
      });
      if(result.key!==disrupted.key)continue;
      witnessed=true;
      for(const dim of invalidDims){
        assert.equal(result.canonicalObservations.find(x=>x.dimensionId===dim)?.behaviorId,
          "confounded",probeId+" must not award "+dim+" after a reference cue");
      }
      assert.equal(result.canonicalObservations.find(x=>x.dimensionId==="execution.start" ||
        x.dimensionId==="time.start")?.behaviorId,
        ordinary.canonicalObservations.find(x=>x.dimensionId==="execution.start" ||
        x.dimensionId==="time.start")?.behaviorId,
        "Unrelated independent timing/start evidence must not be altered");
      break;
    }
    assert.ok(witnessed,"Expected at least one deliberately seeded rare exception for "+probeId);
  }
});


test("duplicate canonical outcome sets do not masquerade as distinct scenarios", () => {
  const first = outcomeFor("difficulty.recovery", "difficulty.recovery.pattern_4", "breakdown");
  const duplicate = { ...first, key: "difficulty.recovery.pattern_5", studentBehavior: "A differently worded but behaviourally identical scene." };
  const distinct = outcomeFor("difficulty.recovery", "difficulty.recovery.pattern_6", "conditional");
  assert.deepEqual(
    deduplicateSandboxDiagnosisOutcomes([first, duplicate, distinct]).map((item) => item.key),
    ["difficulty.recovery.pattern_4", "difficulty.recovery.pattern_6"],
  );
});

test("a breakdown narrative cannot claim recurrence without a prior breakdown on that probe", () => {
  const breakdown = outcomeFor("difficulty.recovery", "difficulty.recovery.pattern_4", "breakdown");
  breakdown.studentBehavior = "The difficult moment breaks the response again; the student cannot recover independently.";
  const priorConfounded = [{
    probeId: "difficulty.recovery" as const,
    trajectoryClass: "confounded" as const,
    observations: [],
  }];
  const selected = selectSandboxDiagnosisOutcome({
    seed: "recurrence-guard",
    outcomes: [breakdown],
    context: {
      startingPhase: "Controlled Discomfort",
      probeId: "difficulty.recovery",
      sequenceNumber: 2,
      priorOutcomes: priorConfounded,
    },
  });
  assert.match(selected.studentBehavior, /breaks the response; the student/);
  assert.doesNotMatch(selected.studentBehavior, /\bagain\b/i);
});

test("a breakdown narrative may describe recurrence when prior canonical evidence records breakdown", () => {
  const breakdown = outcomeFor("difficulty.recovery", "difficulty.recovery.pattern_4", "breakdown");
  breakdown.studentBehavior = "The difficult moment breaks the response again; the student cannot recover independently.";
  const selected = selectSandboxDiagnosisOutcome({
    seed: "recurrence-guard",
    outcomes: [breakdown],
    context: {
      startingPhase: "Controlled Discomfort",
      probeId: "difficulty.recovery",
      sequenceNumber: 2,
      priorOutcomes: [{
        probeId: "difficulty.recovery",
        trajectoryClass: "breakdown",
        observations: breakdown.canonicalObservations,
      }],
    },
  });
  assert.match(selected.studentBehavior, /breaks the response again/);
});


test("recurrence wording follows the latest same-probe evidence, not an older failure", () => {
  const breakdown = outcomeFor("difficulty.recovery", "difficulty.recovery.pattern_4", "breakdown");
  breakdown.studentBehavior = "The difficult moment breaks the response again; the student cannot recover independently.";
  const selected = selectSandboxDiagnosisOutcome({
    seed: "latest-evidence-guard",
    outcomes: [breakdown],
    context: {
      startingPhase: "Controlled Discomfort",
      probeId: "difficulty.recovery",
      sequenceNumber: 3,
      priorOutcomes: [
        { probeId: "difficulty.recovery", trajectoryClass: "breakdown", observations: breakdown.canonicalObservations },
        { probeId: "difficulty.recovery", trajectoryClass: "confounded", observations: [] },
      ],
    },
  });
  assert.doesNotMatch(selected.studentBehavior, /\bagain\b/i);
});


test("repeat-opportunity wording is preserved when the current response is successful", () => {
  const repeated = outcomeFor("execution.repeatability", "execution.repeatability.pattern_1", "supported");
  repeated.studentBehavior = "The student applies the method again and preserves the same structure independently.";
  const selected = selectSandboxDiagnosisOutcome({
    seed: "successful-repeat-wording",
    outcomes: [repeated],
    context: {
      startingPhase: "Structured Execution",
      probeId: "execution.repeatability",
      sequenceNumber: 2,
      priorOutcomes: [{
        probeId: "execution.repeatability",
        trajectoryClass: "breakdown",
        observations: [],
      }],
    },
  });
  assert.match(selected.studentBehavior, /again/);
});

test("a prior breakdown on a different dimension does not establish the same failure recurring", () => {
  const breakdown = outcomeFor("difficulty.recovery", "difficulty.recovery.pattern_4", "breakdown");
  breakdown.studentBehavior = "The difficult moment breaks the response again; the student cannot recover independently.";
  const currentFailures = breakdown.canonicalObservations.filter((observation) =>
    DIAGNOSIS_OBSERVATION_MATRIX[observation.dimensionId].options.find(
      (option) => option.id === observation.behaviorId,
    )?.behaviorClass === "breakdown"
  );
  assert.ok(currentFailures.length > 1);
  const selected = selectSandboxDiagnosisOutcome({
    seed: "different-dimension-does-not-repeat",
    outcomes: [breakdown],
    context: {
      startingPhase: "Controlled Discomfort",
      probeId: "difficulty.recovery",
      sequenceNumber: 2,
      priorOutcomes: [{
        probeId: "difficulty.recovery",
        trajectoryClass: "breakdown",
        observations: [currentFailures[0]],
      }],
    },
  });
  assert.doesNotMatch(selected.studentBehavior, /\\bagain\\b/i);
});
