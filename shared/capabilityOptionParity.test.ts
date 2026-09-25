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
      A: "Plausible response under matched condition A.",
      B: "Plausible response under matched condition B.",
      C: "Plausible response under matched condition C.",
      D: "Plausible response under matched condition D.",
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
      A: "Comparable response alpha with matched wording length.",
      B: "Comparable response bravo with matched wording length.",
      C: "Comparable response charlie with matched wording length.",
      D: "Comparable response delta with matched wording length.",
    });
  });

  const summary = assertCapabilityOptionParity("isolated-variation", items);
  assert.equal(summary.correctUniquelyLongest, 10);
});
