import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateOralDefenseProbes,
  ORAL_DEFENSE_ALWAYS_PROBE,
  type CapabilityOralDefenseProbe,
} from "./capabilityOralDefense";

function probe(
  focusKey: string,
  deepDiveKey: string,
  judgment: CapabilityOralDefenseProbe["judgment"] = "clear",
  integrityConcern = false,
): CapabilityOralDefenseProbe {
  return {
    focusKey,
    deepDiveKey,
    scenarioSummary: "A new fictional scenario was used to test the Specialist's operating judgment under an unfamiliar condition.",
    observedResponseSummary: "The Specialist reasoned aloud, stated the relevant boundary, and explained the operating action they would take.",
    judgment,
    integrityConcern,
  };
}

const baseline = ORAL_DEFENSE_ALWAYS_PROBE.map((item) => probe(item.focusKey, item.deepDiveKey));

test("three clear probes approve the Oral Integrity Defense", () => {
  const result = evaluateOralDefenseProbes(baseline);
  assert.equal(result.outcome, "approved");
  assert.equal(result.clearCount, 3);
  assert.equal(result.partialCount, 0);
  assert.equal(result.failCount, 0);
});

test("any partial or fail requires repeat rather than discretionary approval", () => {
  const partial = [...baseline];
  partial[0] = probe(partial[0].focusKey, partial[0].deepDiveKey, "partial");
  assert.equal(evaluateOralDefenseProbes(partial).outcome, "repeat_required");

  const failed = [...baseline];
  failed[1] = probe(failed[1].focusKey, failed[1].deepDiveKey, "fail");
  assert.equal(evaluateOralDefenseProbes(failed).outcome, "repeat_required");
});

test("any integrity concern overrides ordinary scoring and escalates", () => {
  const probes = [...baseline];
  probes[2] = probe(probes[2].focusKey, probes[2].deepDiveKey, "clear", true);
  const result = evaluateOralDefenseProbes(probes);
  assert.equal(result.outcome, "integrity_review");
  assert.equal(result.integrityConcernCount, 1);
});

test("defense rejects fewer than three or more than five probes", () => {
  assert.throws(() => evaluateOralDefenseProbes(baseline.slice(0, 2)), /requires 3-5 probes/);
  const six = [
    ...baseline,
    probe("extra.one", "clarity"),
    probe("extra.two", "structured_execution"),
    probe("extra.three", "clarity"),
  ];
  assert.throws(() => evaluateOralDefenseProbes(six), /requires 3-5 probes/);
});

test("defense rejects duplicate focus and weak evidence summaries", () => {
  const duplicate = [...baseline, { ...baseline[0] }];
  assert.throws(() => evaluateOralDefenseProbes(duplicate), /Duplicate oral defense focus/);

  const weak = [...baseline];
  weak[0] = { ...weak[0], scenarioSummary: "Too short" };
  assert.throws(() => evaluateOralDefenseProbes(weak), /scenario summary is too short/);
});
