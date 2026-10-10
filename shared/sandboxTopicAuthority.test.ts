import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSandboxCanonicalLane,
  normalizeSandboxTopicLane,
  persistedTopicLane,
  resolveSandboxTopicSeed,
  sandboxTopicKey,
} from "./sandboxTopicAuthority";

const oldMap = {
  topicConditioning: {
    topics: {
      "Linear Equatins": {
        topic: "Linear Equatins",
        phase: "Clarity",
        stability: "High Maintenance",
        history: [{ date: "2026-10-07", phase: "Clarity", stability: "High Maintenance" }],
      },
      Geometry: {
        topic: "Geometry",
        phase: "Time Pressure Stability",
        stability: "High",
        history: [{ date: "2026-09-24", phase: "Time Pressure Stability", stability: "High" }],
      },
      Unobserved: {
        topic: "Unobserved",
        phase: "Time Pressure Stability",
        stability: "High",
        history: [],
      },
      PrerequisiteHold: {
        topic: "PrerequisiteHold",
        phase: "Structured Execution",
        stability: "Medium",
        requiresTargetedRediagnosis: true,
        history: [{ date: "2026-09-24", phase: "Structured Execution", stability: "Medium" }],
      },
    },
  },
};
test("Geometry selection resolves TPS High rather than the Clarity state of another topic", () => {
  const seed = resolveSandboxTopicSeed(oldMap, " geometry ");
  assert.deepEqual(seed, {
    topicKey: "geometry",
    topic: "Geometry",
    state: {
      phase: "Time Pressure Stability",
      stability: "High",
      progression: "building",
      route: "normal_training",
      targetedRediagnosisPhase: null,
    },
  });
  assert.equal(sandboxTopicKey(" Linear   Equatins "), "linear equatins");
});

test("original Linear Equatins checkpoint survives as independent Clarity eligibility", () => {
  const seed = resolveSandboxTopicSeed(oldMap, "LINEAR EQUATINS");
  assert.equal(seed?.state.phase, "Clarity");
  assert.equal(seed?.state.stability, "High");
  assert.equal(seed?.state.progression, "exit_confirmation_eligible");
});

test("unobserved, prerequisite-contradicted, unknown and malformed states fail closed", () => {
  assert.equal(resolveSandboxTopicSeed(oldMap, "Unobserved"), null);
  assert.equal(resolveSandboxTopicSeed(oldMap, "PrerequisiteHold"), null);
  assert.equal(resolveSandboxTopicSeed(oldMap, "Not Known"), null);
  assert.equal(resolveSandboxTopicSeed({topicConditioning:{topics:{Geometry:{...oldMap.topicConditioning.topics.Geometry,phase:"Not Real"}}}}, "Geometry"), null);
});

test("topic lane roundtrips preserve separate specialist and private canonical authorities", () => {
  const specialist = {
    phase: "Clarity", stability: "High",
    progressionAuthority: "exit_confirmation_eligible",
    route: "normal_training", targetedRediagnosisPhase: null,
  };
  const canonical = {
    ...specialist,
    previousTrajectoryClass: "supported",
    continuityTags: ["recovered"],
    recentOutcomeKeys: ["private-ref-only"],
    priorTracksDiverged: false,
  };
  const lane = persistedTopicLane({ "linear equatins": specialist }, "linear equatins", false);
  const truth = persistedTopicLane({ "linear equatins": canonical }, "linear equatins", true);
  assert.equal(lane?.phase, "Clarity");
  assert.equal(lane?.progression, "exit_confirmation_eligible");
  assert.equal(truth?.recentOutcomeKeys[0], "private-ref-only");
  assert.equal(normalizeSandboxCanonicalLane({ ...canonical, recentOutcomeKeys: false }), null);
  assert.equal(normalizeSandboxTopicLane({ ...specialist, stability:"Low" }), null);
});

test("a returned new topic state must not inherit the preceding topic's hidden continuity", () => {
  const seed = resolveSandboxTopicSeed(oldMap, "Geometry");
  assert.ok(seed);
  const priorClarity = {
    phase: "Clarity", stability: "High",
    progressionAuthority: "exit_confirmation_eligible",
    route: "normal_training", targetedRediagnosisPhase: null,
    previousTrajectoryClass: "supported",
    continuityTags: ["old-topic"],
    recentOutcomeKeys: ["legacy-private"],
    priorTracksDiverged: true,
  };
  const bank = { "linear equatins": priorClarity };
  assert.equal(persistedTopicLane(bank, "geometry", true), null);
  assert.equal(seed.state.phase, "Time Pressure Stability");
  assert.equal(seed.state.progression, "building");
});
