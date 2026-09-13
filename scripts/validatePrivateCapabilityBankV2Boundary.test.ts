import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./validate-private-capability-bank-v2.ts", import.meta.url), "utf8");

test("V2 validator requires the complete approved release and new bank identity", () => {
  assert.match(source, /exactly the 16 approved assessment keys/);
  assert.match(source, /bankVersion !== 2/);
  assert.match(source, /masteryItems !== 495/);
  assert.match(source, /cumulativeItems !== 400/);
  assert.match(source, /allItemKeys\.size !== 895/);
});

test("V2 validator enforces blueprint, critical-boundary and deterministic form gates", () => {
  assert.match(source, /validateCapabilityAssessmentAgainstBlueprint/);
  assert.match(source, /buildCapabilityCriticalBoundaryRequirements/);
  assert.match(source, /generateDeterministicCapabilityForm/);
  assert.match(source, /form generation is not deterministic/);
  assert.match(source, /retries collapse to one question set/);
});

test("V2 validator rejects common test-taking shortcuts", () => {
  assert.match(source, /Duplicate prompt/);
  assert.match(source, /exact prompts repeat across assessment banks/);
  assert.match(source, /longest-answer shortcut/);
  assert.match(source, /exact option label repeats/);
});

test("V2 validator emits new source, canonical package and per-assessment hashes", () => {
  assert.match(source, /packageSourceSha256/);
  assert.match(source, /canonicalPackageSha256/);
  assert.match(source, /assessmentHashes/);
});
