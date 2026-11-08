import assert from "node:assert/strict";
import test from "node:test";
import {
  isCapabilityAssessmentBlocked,
  isDeepDiveModuleBlocked,
} from "./responseConditioningAccess";

test("Training-mode Transformation Retention and Application are not blocked by Sandbox coverage", () => {
  for (const assessmentKey of [
    "transformation_retrieval_v1",
    "transformation_transfer_v1",
  ]) {
    assert.equal(
      isCapabilityAssessmentBlocked({
        assessmentKey,
        mode: "training",
        developmentCoverageReady: null,
      }),
      false,
    );
  }
});

test("Sandbox Operating System gates remain locked until development coverage is complete", () => {
  assert.equal(
    isCapabilityAssessmentBlocked({
      assessmentKey: "operating_system_retrieval_v2",
      mode: "sandbox",
      developmentCoverageReady: false,
    }),
    true,
  );
  assert.equal(
    isCapabilityAssessmentBlocked({
      assessmentKey: "operating_system_transfer_v2",
      mode: "sandbox",
      developmentCoverageReady: null,
    }),
    true,
  );
  assert.equal(
    isCapabilityAssessmentBlocked({
      assessmentKey: "operating_system_retrieval_v2",
      mode: "sandbox",
      developmentCoverageReady: true,
    }),
    false,
  );
});

test("post-Sandbox Deep Dive modules remain locked outside a qualified Sandbox stage", () => {
  assert.equal(isDeepDiveModuleBlocked("training", null), true);
  assert.equal(isDeepDiveModuleBlocked("sandbox", false), true);
  assert.equal(isDeepDiveModuleBlocked("sandbox", true), false);
  assert.equal(isDeepDiveModuleBlocked("trial", true), true);
});
