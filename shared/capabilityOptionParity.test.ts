import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeCapabilityOptionParity,
  assertCapabilityOptionParity,
} from "./capabilityOptionParity";

const item = (
  index: number,
  correctKey: string,
  labels: Record<string, string>,
) => ({
  key: `item-${index}`,
  kind: "single_choice" as const,
  options: ["A", "B", "C", "D"].map((key) => ({ key, label: labels[key] })),
  correctOptionKeys: [correctKey],
});

test("balanced option lengths do not create a release shortcut", () => {
  const items = Array.from({ length: 45 }, (_, index) => {
    const correctKey = ["A", "B", "C", "D"][index % 4];
    return item(index, correctKey, {
      A: "A plausible operational response of similar length.",
      B: "A different operational response of similar length.",
      C: "Another plausible operational response of similar length.",
      D: "A fourth plausible operational response of similar length.",
    });
  });

  const summary = assertCapabilityOptionParity("balanced", items);
  assert.equal(summary.eligibleSingleChoiceItems, 45);
  assert.equal(summary.correctUniquelyLongest, 0);
  assert.equal(summary.correctUniquelyShortest, 0);
});

test("systemic uniquely-longest correct answers fail closed", () => {
  const items = Array.from({ length: 45 }, (_, index) =>
    item(index, "D", {
      A: "Record the response.",
      B: "Repeat the opportunity.",
      C: "Change the condition.",
      D: "Record the concrete response that actually occurred while preserving the evidence condition and the system-owned decision boundary.",
    }),
  );

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.correctUniquelyLongest, 45);
  assert.throws(
    () => assertCapabilityOptionParity("length-leak", items),
    /leaks the answer by option length/i,
  );
});

test("isolated length variation does not fail a bank", () => {
  const items = Array.from({ length: 45 }, (_, index) => {
    if (index < 10) {
      return item(index, "A", {
        A: "This correct response is intentionally somewhat longer than the distractors.",
        B: "Short distractor one.",
        C: "Short distractor two.",
        D: "Short distractor three.",
      });
    }
    return item(index, "B", {
      A: "A plausible response with comparable wording.",
      B: "A correct response with comparable wording.",
      C: "A plausible response with comparable wording.",
      D: "A plausible response with comparable wording.",
    });
  });

  const summary = assertCapabilityOptionParity("isolated-variation", items);
  assert.equal(summary.correctUniquelyLongest, 10);
});
