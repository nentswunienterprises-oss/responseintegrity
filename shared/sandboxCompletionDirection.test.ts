import test from "node:test";
import assert from "node:assert/strict";
import { sandboxTargetedRediagnosisCopy } from "./sandboxCompletionDirection";

test("targeted re-diagnosis overrides ordinary Training completion guidance", () => {
  const copy = sandboxTargetedRediagnosisCopy({
    topic: "QA Discomfort",
    authority: {
      route: "targeted_rediagnosis",
      transitionReason: "targeted re-diagnosis required",
      targetPhase: "Clarity",
    },
  });

  assert.deepEqual(copy, {
    sessionResult: "QA Discomfort: targeted re-diagnosis required beginning at Clarity",
    currentStateLabel: "Recorded checkpoint",
    nextFocusLabel: "Required Next Route",
    nextFocus: "Run targeted evidence-native re-diagnosis beginning at Clarity.",
    nextConstraint:
      "Do not continue ordinary Training until targeted re-diagnosis establishes a trustworthy entry state.",
    footer:
      "The next confirmed weekly lesson must open targeted re-diagnosis before ordinary Training can resume.",
  });
});

test("ordinary completion guidance remains owned by the normal state engine", () => {
  assert.equal(
    sandboxTargetedRediagnosisCopy({
      topic: "Geometry",
      authority: {
        route: "normal_training",
        transitionReason: "remain",
        targetPhase: null,
      },
    }),
    null,
  );
});
