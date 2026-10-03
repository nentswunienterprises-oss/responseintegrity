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
      a: `Item ${index} alpha: Preserve the observed behavior and let the evidence path determine what happens next.`,
      b: `Item ${index} bravo: Use the current condition to answer the specific uncertainty before changing the task.`,
      c: `Item ${index} charlie: Keep the support boundary intact so the response remains attributable to the student.`,
      d: `Item ${index} delta: Record only what the opportunity actually exposed instead of filling gaps by inference.`,
      e: `Item ${index} echo: Follow the assigned next action unless new qualifying evidence changes the state.`,
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
  assert.equal(summary.totalAcceptedKeyCount, 81);
  assert.ok(summary.maxAcceptedKeyRate < 0.3);
});

test("systemic accepted-answer position leakage fails closed", () => {
  const items = Array.from({ length: 45 }, (_, index) => {
    const second = KEYS[(index % 4) + 1];
    const correctKeys = (index + 1) % 5 === 0 ? ["a"] : ["a", second];
    return item(index, correctKeys, {
      a: `Position ${index} alpha: Preserve the current evidence state until the requested check resolves it.`,
      b: `Position ${index} bravo: Use a fresh comparable opportunity to answer the unresolved continuity question.`,
      c: `Position ${index} charlie: Keep the support boundary unchanged so the next response remains attributable.`,
      d: `Position ${index} delta: Record the observed behavior without inferring a cause that was never exposed.`,
      e: `Position ${index} echo: Follow the assigned state action unless later qualifying evidence changes it.`,
    });
  });

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.totalAcceptedKeyCount, 81);
  assert.equal(summary.maxAcceptedKeyCount, 45);
  assert.ok(summary.maxAcceptedKeyRate > 0.4);
  assert.throws(
    () => assertCapabilityOptionParity("position-leak", items),
    /leaks accepted answers by position/i,
  );
});

test("systemic accepted-answer length leakage fails closed", () => {
  const longAcceptedByKey: Record<string, string> = {
    a: "Preserve the complete observed response under the assigned condition while keeping every relevant evidence boundary explicit and attributable.",
    b: "Use the comparable evidence opportunity to resolve the open question while preserving the support rule and the original response history.",
    c: "Keep the active condition unchanged so the resulting behavior remains interpretable across the required evidence dimensions and later state logic.",
    d: "Record the concrete behavior and its condition precisely enough that no later interpretation needs to reconstruct or infer what happened.",
    e: "Follow the evidence-derived next action while preserving the qualifying history that explains why the current state and route remain justified.",
  };
  const items = balancedItems().map((entry) => ({
    ...entry,
    options: entry.options.map((option) => ({
      ...option,
      label: entry.correctOptionKeys.includes(option.key)
        ? `${entry.key} ${option.key}: ${longAcceptedByKey[option.key]}`
        : `${entry.key} ${option.key}: Short plausible distractor.`,
    })),
  }));

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.acceptedClusterLongerBy20Pct, 45);
  assert.equal(summary.nearDuplicateAcceptedPairs, 0);
  assert.throws(
    () => assertCapabilityOptionParity("length-leak", items),
    /leaks accepted answers by length/i,
  );
});

test("isolated length variation does not fail a bank", () => {
  const longAcceptedByKey: Record<string, string> = {
    a: "Preserve the observed response and its evidence condition while keeping the later decision attributable to what actually occurred.",
    b: "Use the active evidence question to resolve the uncertainty while preserving the original response and support boundary.",
    c: "Keep the assigned support condition intact so the resulting response remains interpretable without later reconstruction.",
    d: "Record the concrete behavior and context precisely enough that later state logic can use the evidence without inference.",
    e: "Follow the assigned next action while preserving the qualifying history that explains the current state and evidence route.",
  };
  const items = balancedItems().map((entry, index) => {
    if (index >= 10) return entry;
    return {
      ...entry,
      options: entry.options.map((option) => ({
        ...option,
        label: entry.correctOptionKeys.includes(option.key)
          ? `${entry.key} ${option.key}: ${longAcceptedByKey[option.key]}`
          : `${entry.key} ${option.key}: Short plausible distractor.`,
      })),
    };
  });

  const summary = assertCapabilityOptionParity("isolated-variation", items);
  assert.equal(summary.acceptedClusterLongerBy20Pct, 10);
  assert.ok(summary.acceptedClusterLongerBy20PctRate < 0.25);
});


test("duplicative silent accepted answers fail closed", () => {
  const items = balancedItems();
  items[0] = item(0, ["a", "c"], {
    a: "They provide context and may influence where to ask first, but direct RI evidence still determines placement.",
    b: "High marks prove the later phase immediately.",
    c: "Use reports and history only to choose where to check first; direct RI evidence still determines placement.",
    d: "The Specialist can place from the report alone.",
    e: "Recent marks outweigh one weak live response.",
  });

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.nearDuplicateAcceptedPairs, 1);
  assert.deepEqual(summary.nearDuplicateAcceptedPairKeys, ["item-0"]);
  assert.throws(
    () => assertCapabilityOptionParity("duplicate-accepted-pair", items),
    /genuinely distinct valid truth/i,
  );
});


test("reused doctrine as a silent accepted answer fails closed", () => {
  const items = balancedItems();
  const reusableTruth =
    "Strip away later pressures until RI-OS finds the earliest response layer that no longer holds cleanly.";

  for (const index of [0, 1, 2]) {
    items[index] = {
      ...items[index],
      correctOptionKeys: ["a", "e"],
      options: items[index].options.map((option) =>
        option.key === "e" ? { ...option, label: reusableTruth } : option,
      ),
    };
  }

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.reusedAcceptedTruths.length, 1);
  assert.deepEqual(summary.reusedAcceptedTruths[0].itemKeys, [
    "item-0",
    "item-1",
    "item-2",
  ]);
  assert.throws(
    () => assertCapabilityOptionParity("reused-doctrine", items),
    /specific prompt rather than act as reusable RI doctrine/i,
  );
});


test("meta commentary inside answer options fails closed", () => {
  const items = balancedItems();
  items[0] = item(0, ["a", "c"], {
    a: "The student should stay in the assigned condition.",
    b: "Move the topic backward. That can seem reasonable because an earlier layer was questioned.",
    c: "The current evidence still supports the assigned condition.",
    d: "What matters is that the Specialist prefers a safer route.",
    e: "The key is that the report looked strong.",
  });

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.indirectOptionCopy.length, 3);
  assert.throws(
    () => assertCapabilityOptionParity("indirect-answer-copy", items),
    /comments on the option instead of answering the prompt directly/i,
  );
});


test("answer grammatical shape must fit the prompt", () => {
  const items = balancedItems();
  items[0] = {
    ...items[0],
    prompt:
      "A difficult timed response breaks badly. What prevents the system from calling it a TPS problem immediately?",
    options: [
      {
        key: "a",
        label:
          "Earlier response layers have not yet been shown to hold under lower-pressure conditions.",
      },
      {
        key: "b",
        label:
          "Strip away later pressures until RI-OS finds the earliest response layer that no longer holds cleanly.",
      },
      {
        key: "c",
        label:
          "The timed failure could still be caused by an unresolved earlier execution layer.",
      },
      {
        key: "d",
        label:
          "The most dramatic visible failure is not enough to establish the earliest causal response layer.",
      },
      {
        key: "e",
        label:
          "Timing cannot own placement until the prerequisite response layers are sufficiently supported.",
      },
    ],
    correctOptionKeys: ["a", "c"],
  };

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.promptShapeMismatches.length, 1);
  assert.deepEqual(summary.promptShapeMismatches[0].optionKey, "b");
  assert.throws(
    () => assertCapabilityOptionParity("prompt-shape", items),
    /grammatical shape does not answer the prompt/i,
  );
});


test("prompt grammar uses the final question rather than quoted scenario language", () => {
  const items = balancedItems();
  items[0] = {
    ...items[0],
    prompt:
      'The student asks, "Why do I have to do this?" The Specialist gives no help. What should the Specialist record?',
    options: items[0].options.map((option) =>
      option.key === "a"
        ? {
            ...option,
            label:
              "Record the rescue-seeking statement and the fact that no support was given.",
          }
        : option,
    ),
  };

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.promptShapeMismatches.length, 0);
});

test("yes-no prompts require direct yes or no answer grammar", () => {
  const items = balancedItems();
  items[0] = {
    ...items[0],
    prompt:
      "Can that supported response prove clean Independent Execution?",
    options: items[0].options.map((option) =>
      option.key === "b"
        ? {
            ...option,
            label:
              "Material Specialist assistance prevents the response from proving the no-support condition.",
          }
        : {
            ...option,
            label:
              option.key === "a"
                ? "No. The response was materially supported."
                : option.label,
          },
    ),
  };

  const summary = analyzeCapabilityOptionParity(items);
  assert.equal(summary.promptShapeMismatches.length, 4);
  assert.ok(
    summary.promptShapeMismatches.some(
      (entry) => entry.itemKey === "item-0" && entry.optionKey === "b",
    ),
  );
  assert.throws(
    () => assertCapabilityOptionParity("yes-no-shape", items),
    /grammatical shape does not answer the prompt/i,
  );
});
