import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeCapabilityOptionParity,
  assertCapabilityOptionParity,
} from "./capabilityOptionParity";

const KEYS = ["a", "b", "c", "d", "e"];

const item = (
  index: number,
  correctKeys: string[],
  labels: Record<string, string>,
) => ({
  key: `item-${index}`,
  kind: "single_choice" as const,
  options: KEYS.map((key) => ({ key, label: labels[key] })),
  correctOptionKeys: correctKeys,
});

function balancedItems() {
  return Array.from({ length: 45 }, (_, index) => {
    const first = KEYS[index % KEYS.length];
    const second = KEYS[(index + 2) % KEYS.length];
    const correctKeys = (index + 1) % 5 === 0 ? [first] : [first, second];
    return item(index, correctKeys, {
      a: "Plausible response under matched condition alpha.",
      b: "Plausible response under matched condition bravo.",
      c: "Plausible response under matched condition charlie.",
      d: "Plausible response under matched condition delta.",
      e: "Plausible response under matched condition echo.",
    });
  });
}

test("five-option banks with about eighty percent silent alternate-valid items pass parity", () => {
  const summary = assertCapabilityOptionParity("balanced", balancedItems());
  assert.equal(summary.eligibleSingleChoiceItems, 45);
  assert.equal(summary.alternateValidItems, 36);
  assert.equal(summary.alternateValidRate, 0.8);
  assert.equal(summary.acceptedClusterLongerBy20Pct, 0);
  assert.equal(summary.acceptedClusterShorterBy20Pct, 0);
  assert.ok(summary.maxAcceptedKeyRate < 0.55);
});

test("systemic accepted-answer position leakage fails closed", () => {
  const items = Array.from({ length: 45 }, (_, index) => {
    const second = KEYS[(index % 4) + 1];
    const correctKeys = (index + 1) % 5 === 0 ? ["a"] : ["a", second];
    return item(index, correctKeys, {
      a: "Plausible response under matched condition alpha.",
      b: "Plausible response under matched condition bravo.",
      c: "Plausible response under matched condition charlie.",
      d: "Plausible response under matched condition delta.",
      e: "Plausible response under matched condition echo.",
    });
  });

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.maxAcceptedKeyCount, 45);
  assert.throws(
    () => assertCapabilityOptionParity("position-leak", items),
    /leaks accepted answers by position/i,
  );
});

test("systemic accepted-answer length leakage fails closed", () => {
  const items = balancedItems().map((entry) => ({
    ...entry,
    options: entry.options.map((option) => ({
      ...option,
      label: entry.correctOptionKeys.includes(option.key)
        ? "This accepted response is much longer and more qualified than every distractor, making the accepted cluster visible without requiring mastery."
        : "Short but plausible distractor response.",
    })),
  }));

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.acceptedClusterLongerBy20Pct, 45);
  assert.throws(
    () => assertCapabilityOptionParity("length-leak", items),
    /leaks accepted answers by length/i,
  );
});

test("isolated length variation does not fail a bank", () => {
  const items = balancedItems().map((entry, index) => {
    if (index >= 10) return entry;
    return {
      ...entry,
      options: entry.options.map((option) => ({
        ...option,
        label: entry.correctOptionKeys.includes(option.key)
          ? "This accepted response is intentionally longer than the distractors while remaining an isolated variation."
          : "Short plausible distractor response.",
      })),
    };
  });

  const summary = assertCapabilityOptionParity("isolated-variation", items);
  assert.equal(summary.acceptedClusterLongerBy20Pct, 10);
  assert.ok(summary.acceptedClusterLongerBy20PctRate < 0.25);
});
