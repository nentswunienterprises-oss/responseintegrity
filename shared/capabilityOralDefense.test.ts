import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCapabilityOralRiskProbeRubric,
  evaluateOralDefenseProbes,
  ORAL_DEFENSE_ALWAYS_PROBE,
  ORAL_DEFENSE_VERSION,
  type CapabilityIssuedOralProbe,
  type CapabilityOralDefenseProbeObservation,
} from "./capabilityOralDefense";

const issuedBaseline: CapabilityIssuedOralProbe[] = ORAL_DEFENSE_ALWAYS_PROBE.map((probe) => ({
  focusKey: probe.focusKey,
  deepDiveKey: probe.deepDiveKey,
  rubric: {
    ...probe.rubric,
    criticalBoundaryLinks: [...probe.rubric.criticalBoundaryLinks],
  },
}));

function observation(
  issued: Pick<CapabilityIssuedOralProbe, "focusKey" | "deepDiveKey">,
  judgment: CapabilityOralDefenseProbeObservation["judgment"] = "clear",
): CapabilityOralDefenseProbeObservation {
  return {
    focusKey: issued.focusKey,
    deepDiveKey: issued.deepDiveKey,
    scenarioSummary:
      "A new fictional scenario was used to test the Specialist's operating judgment under an unfamiliar condition.",
    observedResponseSummary:
      "The Specialist reasoned aloud, stated the relevant boundary, and explained the operating action they would take.",
    judgment,
  };
}

function baselineObservations() {
  return issuedBaseline.map((probe) => observation(probe));
}

test("Oral Defense V2 requires all issued probes Clear for approval", () => {
  assert.equal(ORAL_DEFENSE_VERSION, 2);
  const result = evaluateOralDefenseProbes(issuedBaseline, baselineObservations());
  assert.equal(result.outcome, "approved");
  assert.equal(result.clearCount, 3);
  assert.equal(result.partialCount, 0);
  assert.equal(result.failCount, 0);
  assert.equal(result.criticalFailCount, 0);
});

test("any Partial or ordinary Fail requires repeat rather than discretionary approval", () => {
  const partialObservations = baselineObservations();
  partialObservations[0] = observation(issuedBaseline[0], "partial");
  assert.equal(evaluateOralDefenseProbes(issuedBaseline, partialObservations).outcome, "repeat_required");

  const ordinaryIssued: CapabilityIssuedOralProbe[] = [
    ...issuedBaseline.slice(0, 2),
    {
      focusKey: "structured_execution.variation_control",
      deepDiveKey: "structured_execution",
      rubric: buildCapabilityOralRiskProbeRubric({
        focusKey: "structured_execution.variation_control",
        deepDiveKey: "structured_execution",
        hasHistoricalCriticalSignal: false,
      }),
    },
  ];
  const ordinaryObservations = ordinaryIssued.map((probe) => observation(probe));
  ordinaryObservations[2] = observation(ordinaryIssued[2], "fail");
  const ordinaryResult = evaluateOralDefenseProbes(ordinaryIssued, ordinaryObservations);
  assert.equal(ordinaryResult.outcome, "repeat_required");
  assert.equal(ordinaryResult.criticalFailCount, 0);
});

test("Fail on an issued integrity-critical probe deterministically escalates", () => {
  const observations = baselineObservations();
  observations[1] = observation(issuedBaseline[1], "fail");
  const result = evaluateOralDefenseProbes(issuedBaseline, observations);
  assert.equal(result.outcome, "integrity_review");
  assert.equal(result.criticalFailCount, 1);
  assert.deepEqual(result.criticalFailProbeKeys, ["clarity:evidence.contamination"]);
});

test("historical critical signal makes a targeted risk probe critical on Fail", () => {
  const rubric = buildCapabilityOralRiskProbeRubric({
    focusKey: "structured_execution.variation_control",
    deepDiveKey: "structured_execution",
    hasHistoricalCriticalSignal: true,
  });
  assert.equal(rubric.criticalOnFail, true);
  assert.equal(rubric.criticalitySource, "historical_critical_signal");

  const ordinary = buildCapabilityOralRiskProbeRubric({
    focusKey: "structured_execution.variation_control",
    deepDiveKey: "structured_execution",
    hasHistoricalCriticalSignal: false,
  });
  assert.equal(ordinary.criticalOnFail, false);
  assert.equal(ordinary.criticalitySource, "ordinary_capability");
});

test("risk rubric rejects unknown capability identities", () => {
  assert.throws(
    () => buildCapabilityOralRiskProbeRubric({
      focusKey: "invented.capability",
      deepDiveKey: "structured_execution",
      hasHistoricalCriticalSignal: false,
    }),
    /unknown capability focus/,
  );
});

test("defense rejects fewer than three or more than five issued probes", () => {
  assert.throws(
    () => evaluateOralDefenseProbes(issuedBaseline.slice(0, 2), baselineObservations().slice(0, 2)),
    /requires 3-5 issued probes/,
  );

  const extraA: CapabilityIssuedOralProbe = {
    focusKey: "structured_execution.variation_control",
    deepDiveKey: "structured_execution",
    rubric: buildCapabilityOralRiskProbeRubric({
      focusKey: "structured_execution.variation_control",
      deepDiveKey: "structured_execution",
      hasHistoricalCriticalSignal: false,
    }),
  };
  const extraB: CapabilityIssuedOralProbe = {
    focusKey: "controlled_discomfort.accessible_difficulty",
    deepDiveKey: "controlled_discomfort",
    rubric: buildCapabilityOralRiskProbeRubric({
      focusKey: "controlled_discomfort.accessible_difficulty",
      deepDiveKey: "controlled_discomfort",
      hasHistoricalCriticalSignal: false,
    }),
  };
  const extraC: CapabilityIssuedOralProbe = {
    focusKey: "logging.evidence_purpose",
    deepDiveKey: "logging_system",
    rubric: buildCapabilityOralRiskProbeRubric({
      focusKey: "logging.evidence_purpose",
      deepDiveKey: "logging_system",
      hasHistoricalCriticalSignal: false,
    }),
  };
  const six = [...issuedBaseline, extraA, extraB, extraC];
  assert.throws(
    () => evaluateOralDefenseProbes(six, six.map((probe) => observation(probe))),
    /requires 3-5 issued probes/,
  );
});

test("defense rejects mismatched focus, duplicate focus, and weak evidence summaries", () => {
  const mismatched = baselineObservations();
  mismatched[0] = { ...mismatched[0], focusKey: "clarity.phase_purpose" };
  assert.throws(
    () => evaluateOralDefenseProbes(issuedBaseline, mismatched),
    /Unexpected oral defense focus/,
  );

  const duplicate = baselineObservations();
  duplicate[2] = { ...duplicate[0] };
  assert.throws(
    () => evaluateOralDefenseProbes(issuedBaseline, duplicate),
    /Duplicate oral defense focus/,
  );

  const weak = baselineObservations();
  weak[0] = { ...weak[0], scenarioSummary: "Too short" };
  assert.throws(
    () => evaluateOralDefenseProbes(issuedBaseline, weak),
    /scenario summary is too short/,
  );
});
