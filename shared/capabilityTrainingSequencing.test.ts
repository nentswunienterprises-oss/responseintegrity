import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCapabilityTrainingAvailability,
  getCapabilityTrainingAssessmentPlan,
  isCapabilityTransformationSandboxReady,
  type CapabilityTrainingActiveBank,
  type CapabilityTrainingAttempt,
} from "./capabilityTrainingSequencing";
import {
  TRANSFORMATION_DEEP_DIVE_KEYS,
  TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY,
  TRANSFORMATION_TRANSFER_ASSESSMENT_KEY,
  SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
  SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS,
} from "./capabilityAssessmentPlan";

const transformationMasteryKeys = TRANSFORMATION_DEEP_DIVE_KEYS.map(
  (key) => `${key}_mastery_v1`,
);

function bank(
  assessmentKey: string,
  evidenceKind: "mastery" | "retrieval" | "transfer",
): CapabilityTrainingActiveBank {
  return {
    assessmentKey,
    bankVersion: 1,
    evidenceKind,
    maxAttempts: 3,
    retryCooldownHours: 0,
  };
}

const activeBanks: CapabilityTrainingActiveBank[] = [
  ...transformationMasteryKeys.map((key) => bank(key, "mastery")),
  bank(TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY, "retrieval"),
  bank(TRANSFORMATION_TRANSFER_ASSESSMENT_KEY, "transfer"),
  bank("intro_session_structure_mastery_v1", "mastery"),
  bank("logging_system_mastery_v1", "mastery"),
  bank("session_flow_control_mastery_v1", "mastery"),
];

function pass(
  assessmentKey: string,
  completedAt: string,
  evidenceKind: "mastery" | "retrieval" | "transfer" = "mastery",
): CapabilityTrainingAttempt {
  return {
    assessmentKey,
    bankVersion: 1,
    attemptNumber: 1,
    evidenceKind,
    passed: true,
    completedAt,
  };
}

test("active Training plan exposes all 20 Deep Dive Mastery checks across the four modules", () => {
  const plan = getCapabilityTrainingAssessmentPlan();
  const mastery = plan.filter((entry) => entry.evidenceKind === "mastery");
  assert.equal(mastery.length, 20);

  const availability = buildCapabilityTrainingAvailability({
    now: "2026-10-02T06:00:00Z",
    activeBanks: [],
    attempts: [],
  });

  assert.equal(
    availability.filter((entry) => entry.stage === "transformation_mastery").length,
    5,
  );
  assert.equal(
    availability.filter((entry) => entry.stage === "execution_standards_mastery").length,
    5,
  );
  assert.equal(
    availability.filter((entry) => entry.stage === "system_intelligence_mastery").length,
    4,
  );
  assert.equal(
    availability.filter((entry) => entry.stage === "session_infrastructure_mastery").length,
    6,
  );
});

const sessionMasteryKeys = SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS.map(key => `${key}_mastery_v1`);
const sessionPlan = getCapabilityTrainingAssessmentPlan({ includeSessionInfrastructureCumulative: true });
const sessionBanks = [
  ...sessionMasteryKeys.map(key => bank(key, "mastery")),
  ...SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS.map((key, index) => bank(key, index === 0 ? "retrieval" : "transfer")),
];
const sessionPasses = sessionMasteryKeys.map((key, index) => pass(key, `2026-10-05T${index === 5 ? "12" : "10"}:00:00Z`));

test("Session cumulative review plan is opt-in and preserves the Production plan", () => {
  const productionPlan = getCapabilityTrainingAssessmentPlan();
  assert.equal(productionPlan.length, 22);
  assert.equal(sessionPlan.length, 25);
  for (const key of SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS) {
    assert.equal(productionPlan.some(entry => entry.assessmentKey === key), false);
    assert.equal(sessionPlan.some(entry => entry.assessmentKey === key), true);
  }
});

test("Session Retrieval requires all six current Masteries and waits from the latest pass", () => {
  const status = (now: string, attempts: CapabilityTrainingAttempt[], banks = sessionBanks) =>
    buildCapabilityTrainingAvailability({ now, activeBanks: banks, attempts, plan: sessionPlan })
      .find(entry => entry.assessmentKey === SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS[0]);
  assert.equal(status("2026-10-07T12:00:00Z", sessionPasses.slice(0, 5))?.reason, "prerequisite_incomplete");
  assert.equal(status("2026-10-06T11:59:59Z", sessionPasses)?.reason, "spacing_interval");
  assert.equal(status("2026-10-06T11:59:59Z", sessionPasses)?.unlockAt, "2026-10-06T12:00:00.000Z");
  assert.equal(status("2026-10-06T12:00:00Z", sessionPasses)?.status, "available");
  assert.equal(status("2026-10-07T12:00:00Z", sessionPasses, sessionBanks.map(entry =>
    entry.assessmentKey === sessionMasteryKeys[5] ? { ...entry, bankVersion: 2 } : entry))?.reason, "prerequisite_incomplete");
});

test("both Session Transfers require Retrieval and its full spacing interval", () => {
  const retrieval = pass(SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS[0], "2026-10-06T13:00:00Z", "retrieval");
  for (const key of SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS.slice(1)) {
    const status = (now: string, attempts: CapabilityTrainingAttempt[]) =>
      buildCapabilityTrainingAvailability({ now, activeBanks: sessionBanks, attempts, plan: sessionPlan }).find(entry => entry.assessmentKey === key);
    assert.equal(status("2026-10-07T13:00:00Z", sessionPasses)?.reason, "prerequisite_incomplete");
    assert.equal(status("2026-10-07T12:59:59Z", [...sessionPasses, retrieval])?.reason, "spacing_interval");
    assert.equal(status("2026-10-07T13:00:00Z", [...sessionPasses, retrieval])?.status, "available");
    assert.equal(status("2026-10-07T13:00:00Z", [...sessionPasses.slice(0, 5), retrieval])?.reason, "prerequisite_incomplete");
  }
});

test("Session cumulative Review Mode opens review without completing gates or opening real Transfer", () => {
  const reviewBanks = sessionBanks.map(entry => SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS.some(key => key === entry.assessmentKey)
    ? { ...entry, reviewMode: true } : entry);
  const reviews = SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS.map((key, index) => pass(key, "2026-10-06T13:00:00Z", index === 0 ? "retrieval" : "transfer"));
  const availability = buildCapabilityTrainingAvailability({ now: "2026-10-08T13:00:00Z", activeBanks: reviewBanks, attempts: reviews, plan: sessionPlan });
  for (const key of SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS) {
    assert.equal(availability.find(entry => entry.assessmentKey === key)?.status, "available");
    assert.equal(availability.find(entry => entry.assessmentKey === key)?.reviewMode, true);
  }
  assert.equal(isCapabilityTransformationSandboxReady(availability), false);
  const mixed = buildCapabilityTrainingAvailability({ now: "2026-10-08T13:00:00Z", activeBanks: reviewBanks.map(entry =>
    entry.evidenceKind === "transfer" ? { ...entry, reviewMode: false } : entry), attempts: [...sessionPasses, ...reviews.slice(0, 1)], plan: sessionPlan });
  for (const key of SESSION_INFRASTRUCTURE_CUMULATIVE_ASSESSMENT_KEYS.slice(1)) {
    assert.equal(mixed.find(entry => entry.assessmentKey === key)?.reason, "prerequisite_incomplete");
  }
});

test("Transformation Retrieval waits for all five Mastery passes and the spacing interval", () => {
  const fourPasses = transformationMasteryKeys
    .slice(0, 4)
    .map((key) => pass(key, "2026-09-28T08:00:00Z"));

  let status = buildCapabilityTrainingAvailability({
    now: "2026-09-29T12:00:00Z",
    activeBanks,
    attempts: fourPasses,
  }).find((entry) => entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY);

  assert.equal(status?.status, "locked");
  assert.equal(status?.reason, "prerequisite_incomplete");

  const allPasses = [
    ...fourPasses,
    pass(transformationMasteryKeys[4], "2026-09-28T10:00:00Z"),
  ];
  status = buildCapabilityTrainingAvailability({
    now: "2026-09-29T09:59:00Z",
    activeBanks,
    attempts: allPasses,
  }).find((entry) => entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY);

  assert.equal(status?.status, "locked");
  assert.equal(status?.reason, "spacing_interval");
  assert.equal(status?.unlockAt, "2026-09-29T10:00:00.000Z");

  status = buildCapabilityTrainingAvailability({
    now: "2026-09-29T10:00:00Z",
    activeBanks,
    attempts: allPasses,
  }).find((entry) => entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY);

  assert.equal(status?.status, "available");
});

test("cumulative Review Mode opens Retrieval and Transfer without lifecycle prerequisites", () => {
  const reviewBanks = activeBanks.map((entry) =>
    entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY ||
    entry.assessmentKey === TRANSFORMATION_TRANSFER_ASSESSMENT_KEY
      ? { ...entry, reviewMode: true }
      : entry,
  );

  const assessments = buildCapabilityTrainingAvailability({
    now: "2026-09-28T06:00:00Z",
    activeBanks: reviewBanks,
    attempts: [],
  });

  const retrieval = assessments.find(
    (entry) => entry.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY,
  );
  const transfer = assessments.find(
    (entry) => entry.assessmentKey === TRANSFORMATION_TRANSFER_ASSESSMENT_KEY,
  );

  assert.equal(retrieval?.status, "available");
  assert.equal(retrieval?.reviewMode, true);
  assert.equal(transfer?.status, "available");
  assert.equal(transfer?.reviewMode, true);
  assert.equal(isCapabilityTransformationSandboxReady(assessments), false);
});

test("one current-version clean pass completes a Mastery gate", () => {
  const attempts = [pass(transformationMasteryKeys[0], "2026-09-28T08:00:00Z")];
  const status = buildCapabilityTrainingAvailability({
    now: "2026-09-28T09:00:00Z",
    activeBanks,
    attempts,
  }).find((entry) => entry.assessmentKey === transformationMasteryKeys[0]);

  assert.equal(status?.status, "complete");
  assert.equal(status?.attemptCount, 1);
});

test("Transfer opens after Retrieval and Sandbox opens only after the full Transformation gate", () => {
  const masteryPasses = transformationMasteryKeys.map((key) =>
    pass(key, "2026-09-27T08:00:00Z"),
  );
  const retrievalPass = pass(
    TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY,
    "2026-09-28T09:00:00Z",
    "retrieval",
  );

  let assessments = buildCapabilityTrainingAvailability({
    now: "2026-09-28T09:01:00Z",
    activeBanks,
    attempts: [...masteryPasses, retrievalPass],
  });

  const transfer = assessments.find(
    (entry) => entry.assessmentKey === TRANSFORMATION_TRANSFER_ASSESSMENT_KEY,
  );
  assert.equal(transfer?.status, "available");
  assert.equal(isCapabilityTransformationSandboxReady(assessments), false);

  const transferPass = pass(
    TRANSFORMATION_TRANSFER_ASSESSMENT_KEY,
    "2026-09-28T10:00:00Z",
    "transfer",
  );
  assessments = buildCapabilityTrainingAvailability({
    now: "2026-09-28T10:01:00Z",
    activeBanks,
    attempts: [...masteryPasses, retrievalPass, transferPass],
  });

  assert.equal(isCapabilityTransformationSandboxReady(assessments), true);
  for (const key of [
    "intro_session_structure_mastery_v1",
    "logging_system_mastery_v1",
    "session_flow_control_mastery_v1",
  ]) {
    const sessionGate = assessments.find((entry) => entry.assessmentKey === key);
    assert.equal(sessionGate?.status, "available");
  }
});

test("Session Infrastructure stays locked until Transformation Transfer is evidenced", () => {
  const masteryPasses = transformationMasteryKeys.map((key) =>
    pass(key, "2026-09-27T08:00:00Z"),
  );
  const assessments = buildCapabilityTrainingAvailability({
    now: "2026-09-28T10:00:00Z",
    activeBanks,
    attempts: masteryPasses,
  });

  const intro = assessments.find(
    (entry) => entry.assessmentKey === "intro_session_structure_mastery_v1",
  );
  assert.equal(intro?.status, "locked");
  assert.equal(intro?.reason, "prerequisite_incomplete");
});

test("three failed attempts exhaust the configured allowance", () => {
  const key = transformationMasteryKeys[0];
  const attempts: CapabilityTrainingAttempt[] = [1, 2, 3].map((attemptNumber) => ({
    assessmentKey: key,
    bankVersion: 1,
    attemptNumber,
    evidenceKind: "mastery",
    passed: false,
    completedAt: `2026-09-28T0${attemptNumber}:00:00Z`,
  }));
  const status = buildCapabilityTrainingAvailability({
    now: "2026-09-28T12:00:00Z",
    activeBanks,
    attempts,
  }).find((entry) => entry.assessmentKey === key);

  assert.equal(status?.status, "locked");
  assert.equal(status?.reason, "attempt_limit");
  assert.equal(status?.attemptCount, 3);
});

test("Session Infrastructure Founder review opens all six banks without completing real gates", () => {
  const keys = ["intro_session_structure", "logging_system", "session_flow_control", "drill_library", "handover_verification", "tools_required"].map(key => `${key}_mastery_v1`);
  const assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-04T12:00:00Z",
    activeBanks: [...activeBanks.filter(b => !keys.includes(b.assessmentKey)), ...keys.map(key => ({ ...bank(key, "mastery"), reviewMode: true }))],
    attempts: keys.flatMap(key => [1, 2, 3].map(attemptNumber => ({ ...pass(key, "2026-10-04T09:00:00Z"), attemptNumber }))),
  });
  for (const key of keys) {
    const gate = assessments.find(entry => entry.assessmentKey === key);
    assert.equal(gate?.status, "available");
    assert.equal(gate?.reviewMode, true);
  }
  assert.equal(isCapabilityTransformationSandboxReady(assessments), false);
});

test("a Review Mode Retrieval pass cannot open real Transfer", () => {
  const assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-04T12:00:00Z",
    activeBanks: activeBanks.map(b => b.assessmentKey === TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY ? { ...b, reviewMode: true } : b),
    attempts: [...transformationMasteryKeys.map(key => pass(key, "2026-10-03T09:00:00Z")), pass(TRANSFORMATION_RETRIEVAL_ASSESSMENT_KEY, "2026-10-04T09:00:00Z", "retrieval")],
  });
  const transfer = assessments.find(entry => entry.assessmentKey === TRANSFORMATION_TRANSFER_ASSESSMENT_KEY);
  assert.equal(transfer?.status, "locked");
  assert.equal(transfer?.reason, "prerequisite_incomplete");
  assert.equal(isCapabilityTransformationSandboxReady(assessments), false);
});
