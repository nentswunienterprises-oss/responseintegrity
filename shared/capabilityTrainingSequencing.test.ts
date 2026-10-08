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
  OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
  OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
  EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
  SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
  SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
  CURRICULUM_V2_SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
  OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
  OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2,
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

test("Execution Standards and System Intelligence Founder review stays repeatable and non-authoritative", () => {
  const keys = [
    ...EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
    ...SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
  ].map((key) => `${key}_mastery_v1`);

  const reviewBanks = [
    ...activeBanks.filter((entry) => !keys.includes(entry.assessmentKey)),
    ...keys.map((key) => ({ ...bank(key, "mastery"), reviewMode: true })),
  ];
  const reviewAttempts = keys.flatMap((key) =>
    [1, 2, 3].map((attemptNumber) => ({
      ...pass(key, "2026-10-07T09:00:00Z"),
      attemptNumber,
    })),
  );

  const assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-07T12:00:00Z",
    activeBanks: reviewBanks,
    attempts: reviewAttempts,
  });

  for (const key of keys) {
    const gate = assessments.find((entry) => entry.assessmentKey === key);
    assert.equal(gate?.status, "available");
    assert.equal(gate?.reviewMode, true);
    assert.equal(gate?.attemptCount, 3);
  }

  const osRetrieval = assessments.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
  );
  assert.notEqual(osRetrieval?.status, "complete");
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


test("final operating-system Retrieval waits for all 15 post-Sandbox Masteries and spacing", () => {
  const postSandboxKeys = [
    ...EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
    ...SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
    ...SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
  ].map((key) => `${key}_mastery_v1`);

  const banks: CapabilityTrainingActiveBank[] = [
    ...activeBanks,
    ...postSandboxKeys
      .filter((key) => !activeBanks.some((entry) => entry.assessmentKey === key))
      .map((key) => bank(key, "mastery")),
    bank(OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY, "retrieval"),
    bank(OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY, "transfer"),
  ];

  const incomplete = postSandboxKeys
    .slice(0, -1)
    .map((key) => pass(key, "2026-10-05T08:00:00Z"));
  let assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-06T10:00:00Z",
    activeBanks: banks,
    attempts: incomplete,
  });
  let retrieval = assessments.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
  );
  assert.equal(retrieval?.status, "locked");
  assert.equal(retrieval?.reason, "prerequisite_incomplete");

  const complete = [
    ...incomplete,
    pass(postSandboxKeys.at(-1)!, "2026-10-06T08:00:00Z"),
  ];
  assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-07T07:59:00Z",
    activeBanks: banks,
    attempts: complete,
  });
  retrieval = assessments.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
  );
  assert.equal(retrieval?.status, "locked");
  assert.equal(retrieval?.reason, "spacing_interval");
  assert.equal(retrieval?.unlockAt, "2026-10-07T08:00:00.000Z");

  assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-07T08:00:00Z",
    activeBanks: banks,
    attempts: complete,
  });
  retrieval = assessments.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
  );
  assert.equal(retrieval?.status, "available");
});

test("final operating-system Transfer requires real Retrieval evidence and Review Mode cannot satisfy it", () => {
  const postSandboxKeys = [
    ...EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
    ...SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
    ...SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
  ].map((key) => `${key}_mastery_v1`);

  const banks: CapabilityTrainingActiveBank[] = [
    ...activeBanks,
    ...postSandboxKeys
      .filter((key) => !activeBanks.some((entry) => entry.assessmentKey === key))
      .map((key) => bank(key, "mastery")),
    { ...bank(OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY, "retrieval"), reviewMode: true },
    bank(OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY, "transfer"),
  ];
  const attempts = [
    ...postSandboxKeys.map((key) => pass(key, "2026-10-05T08:00:00Z")),
    pass(OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY, "2026-10-07T08:00:00Z", "retrieval"),
  ];

  const assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-07T09:00:00Z",
    activeBanks: banks,
    attempts,
  });
  const transfer = assessments.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY,
  );
  assert.equal(transfer?.status, "locked");
  assert.equal(transfer?.reason, "prerequisite_incomplete");
});


test("Curriculum v2 plan adds one System Intelligence Mastery and replaces only the final cumulative gates", () => {
  const v1 = getCapabilityTrainingAssessmentPlan();
  const v2 = getCapabilityTrainingAssessmentPlan({ curriculumVersion: "v2" });

  assert.equal(v1.filter((entry) => entry.evidenceKind === "mastery").length, 20);
  assert.equal(v2.filter((entry) => entry.evidenceKind === "mastery").length, 21);

  const v2SystemIntelligence = v2.filter(
    (entry) => entry.evidenceKind === "mastery" &&
      entry.coveredDeepDiveKeys.some((key) =>
        CURRICULUM_V2_SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS.includes(key),
      ),
  );
  assert.equal(v2SystemIntelligence.length, 5);

  assert.equal(
    v2.some((entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY),
    false,
  );
  assert.equal(
    v2.some((entry) => entry.assessmentKey === OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY),
    false,
  );

  const retrieval = v2.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
  );
  const transfer = v2.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2,
  );

  assert.equal(retrieval?.coveredDeepDiveKeys.length, 16);
  assert.equal(retrieval?.formSize, 32);
  assert.equal(retrieval?.minimumItemPoolSize, 64);
  assert.equal(retrieval?.minimumDelayHours, 24);
  assert.equal(transfer?.coveredDeepDiveKeys.length, 16);
  assert.equal(transfer?.formSize, 32);
  assert.equal(transfer?.minimumItemPoolSize, 64);
});

test("Curriculum v2 Retrieval requires all 16 post-Sandbox Masteries and starts spacing from the latest pass", () => {
  const plan = getCapabilityTrainingAssessmentPlan({ curriculumVersion: "v2" });
  const masteryKeys = plan
    .filter(
      (entry) =>
        entry.evidenceKind === "mastery" &&
        !entry.coveredDeepDiveKeys.some((key) => TRANSFORMATION_DEEP_DIVE_KEYS.includes(key)),
    )
    .map((entry) => entry.assessmentKey);

  assert.equal(masteryKeys.length, 16);

  const banks: CapabilityTrainingActiveBank[] = [
    ...masteryKeys.map((key) => bank(key, "mastery")),
    bank(OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2, "retrieval"),
    bank(OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2, "transfer"),
  ];

  const incomplete = masteryKeys
    .slice(0, -1)
    .map((key) => pass(key, "2026-10-08T10:00:00Z"));

  let assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-09T12:00:00Z",
    activeBanks: banks,
    attempts: incomplete,
    plan,
  });

  let retrieval = assessments.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
  );
  assert.equal(retrieval?.status, "locked");
  assert.equal(retrieval?.reason, "prerequisite_incomplete");

  const complete = [
    ...incomplete,
    pass(masteryKeys.at(-1)!, "2026-10-08T15:00:00Z"),
  ];

  assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-09T14:59:00Z",
    activeBanks: banks,
    attempts: complete,
    plan,
  });
  retrieval = assessments.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
  );
  assert.equal(retrieval?.status, "locked");
  assert.equal(retrieval?.reason, "spacing_interval");
  assert.equal(retrieval?.unlockAt, "2026-10-09T15:00:00.000Z");

  assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-09T15:00:00Z",
    activeBanks: banks,
    attempts: complete,
    plan,
  });
  retrieval = assessments.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2,
  );
  assert.equal(retrieval?.status, "available");
});

test("Curriculum v2 Transfer requires real v2 Retrieval evidence and Review Mode cannot satisfy it", () => {
  const plan = getCapabilityTrainingAssessmentPlan({ curriculumVersion: "v2" });
  const masteryKeys = plan
    .filter(
      (entry) =>
        entry.evidenceKind === "mastery" &&
        !entry.coveredDeepDiveKeys.some((key) => TRANSFORMATION_DEEP_DIVE_KEYS.includes(key)),
    )
    .map((entry) => entry.assessmentKey);

  const banks: CapabilityTrainingActiveBank[] = [
    ...masteryKeys.map((key) => bank(key, "mastery")),
    { ...bank(OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2, "retrieval"), reviewMode: true },
    bank(OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2, "transfer"),
  ];
  const attempts = [
    ...masteryKeys.map((key) => pass(key, "2026-10-08T08:00:00Z")),
    pass(OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY_V2, "2026-10-09T09:00:00Z", "retrieval"),
  ];

  const assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-09T10:00:00Z",
    activeBanks: banks,
    attempts,
    plan,
  });
  const transfer = assessments.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_TRANSFER_ASSESSMENT_KEY_V2,
  );
  assert.equal(transfer?.status, "locked");
  assert.equal(transfer?.reason, "prerequisite_incomplete");
});

test("Curriculum v1 final gate does not silently require the new v2 Mastery", () => {
  const postSandboxV1Keys = [
    ...EXECUTION_STANDARDS_DEEP_DIVE_KEYS,
    ...SYSTEM_INTELLIGENCE_DEEP_DIVE_KEYS,
    ...SESSION_INFRASTRUCTURE_DEEP_DIVE_KEYS,
  ].map((key) => `${key}_mastery_v1`);

  const banks: CapabilityTrainingActiveBank[] = [
    ...postSandboxV1Keys.map((key) => bank(key, "mastery")),
    bank(OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY, "retrieval"),
  ];
  const attempts = postSandboxV1Keys.map((key) =>
    pass(key, "2026-10-07T08:00:00Z"),
  );

  const assessments = buildCapabilityTrainingAvailability({
    now: "2026-10-08T08:00:00Z",
    activeBanks: banks,
    attempts,
  });
  const retrieval = assessments.find(
    (entry) => entry.assessmentKey === OPERATING_SYSTEM_RETRIEVAL_ASSESSMENT_KEY,
  );
  assert.equal(retrieval?.status, "available");
});
