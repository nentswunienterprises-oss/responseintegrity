import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  ORAL_DEFENSE_ALWAYS_PROBE,
  validateCapabilityOralProbeRubric,
} from "./capabilityOralDefense";

const oralSource = fs.readFileSync(new URL("./capabilityOralDefense.ts", import.meta.url), "utf8");

const inferredIntentPattern = /\b(knowingly|dishonest|dishonestly|intentional|intentionally|motive|malicious|deceptive|deceive)\b/i;

test("baseline Oral Defense rubrics are valid canonical integrity probes", () => {
  assert.equal(ORAL_DEFENSE_ALWAYS_PROBE.length, 3);
  for (const probe of ORAL_DEFENSE_ALWAYS_PROBE) {
    const rubric = validateCapabilityOralProbeRubric({
      ...probe.rubric,
      criticalBoundaryLinks: [...probe.rubric.criticalBoundaryLinks],
    });
    assert.equal(rubric.criticalOnFail, true);
    assert.equal(rubric.criticalitySource, "integrity_baseline");
    assert.ok(rubric.criticalBoundaryLinks.length > 0);
  }
});

test("Oral Defense anchors judge observable behavior rather than inferred intent", () => {
  for (const probe of ORAL_DEFENSE_ALWAYS_PROBE) {
    const text = [
      probe.rubric.observableStandard,
      probe.rubric.clearAnchor,
      probe.rubric.partialAnchor,
      probe.rubric.failAnchor,
    ].join(" ");
    assert.doesNotMatch(text, inferredIntentPattern, `${probe.deepDiveKey}:${probe.focusKey} infers motive or intent`);
  }
});

test("criticality is encoded by issued rubric rules rather than reviewer input", () => {
  assert.match(oralSource, /criticalOnFail/);
  assert.match(oralSource, /historical_critical_signal/);
  assert.match(oralSource, /integrity_baseline/);
  assert.doesNotMatch(oralSource, /integrityConcern/);
});
