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

test("balanced option lengths and answer positions do not create a release shortcut", () => {
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
  assert.equal(summary.correctOverLongestDistractorBy20Pct, 0);
  assert.ok(summary.maxCorrectKeyRate < 0.4);
});

test("systemic correct-answer position leakage fails closed", () => {
  const items = Array.from({ length: 45 }, (_, index) =>
    item(index, "A", {
      A: "Plausible response under matched condition A.",
      B: "Plausible response under matched condition B.",
      C: "Plausible response under matched condition C.",
      D: "Plausible response under matched condition D.",
    }),
  );

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.maxCorrectKeyCount, 45);
  assert.throws(
    () => assertCapabilityOptionParity("position-leak", items),
    /leaks the answer by position/i,
  );
});

test("systemic uniquely-longest correct answers fail closed", () => {
  const items = Array.from({ length: 45 }, (_, index) => {
    const correctKey = ["A", "B", "C", "D"][index % 4];
    const labels = {
      A: "Short but plausible response alpha.",
      B: "Short but plausible response bravo.",
      C: "Short but plausible response charlie.",
      D: "Short but plausible response delta.",
    };
    labels[correctKey as keyof typeof labels] =
      "This correct response is much longer and more qualified than every distractor, making it visibly answer-like without requiring mastery.";
    return item(index, correctKey, labels);
  });

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.correctUniquelyLongest, 45);
  assert.equal(summary.correctOverLongestDistractorBy20Pct, 45);
  assert.throws(
    () => assertCapabilityOptionParity("length-leak", items),
    /leaks the answer by option length/i,
  );
});

test("isolated length variation does not fail a bank", () => {
  const items = Array.from({ length: 45 }, (_, index) => {
    const correctKey = ["A", "B", "C", "D"][index % 4];
    if (index < 10) {
      const labels = {
        A: "Short distractor alpha with a plausible rationale.",
        B: "Short distractor bravo with a plausible rationale.",
        C: "Short distractor charlie with a plausible rationale.",
        D: "Short distractor delta with a plausible rationale.",
      };
      labels[correctKey as keyof typeof labels] =
        "This correct response is intentionally somewhat longer than the distractors while remaining an isolated variation.";
      return item(index, correctKey, labels);
    }
    return item(index, correctKey, {
      A: "Comparable response alpha with matched wording length.",
      B: "Comparable response bravo with matched wording length.",
      C: "Comparable response charlie with matched wording length.",
      D: "Comparable response delta with matched wording length.",
    });
  });

  const summary = assertCapabilityOptionParity("isolated-variation", items);
  assert.equal(summary.correctUniquelyLongest, 10);
  assert.ok(summary.correctUniquelyLongestRate < 0.25);
});
