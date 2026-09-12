import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const reviewSource = fs.readFileSync(new URL("./capability-oral-defense-review.tsx", import.meta.url), "utf8");
const practicalSource = fs.readFileSync(new URL("./tutor/capability-practicals.tsx", import.meta.url), "utf8");
const standaloneSource = fs.readFileSync(new URL("../../capabilityStandaloneApp.tsx", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../../main.tsx", import.meta.url), "utf8");

test("reviewer UI receives targeted frozen rubrics without assessment answer keys", () => {
  assert.match(reviewSource, /oral-defense\/candidates/);
  assert.match(reviewSource, /oral-defense\/\$\{encodeURIComponent/);
  assert.match(reviewSource, /reviewerInstruction/);
  assert.match(reviewSource, /probe\.rubric\.observableStandard/);
  assert.match(reviewSource, /probe\.rubric\.clearAnchor/);
  assert.match(reviewSource, /probe\.rubric\.partialAnchor/);
  assert.match(reviewSource, /probe\.rubric\.failAnchor/);
  assert.doesNotMatch(reviewSource, /correctOptionKeys/);
  assert.doesNotMatch(reviewSource, /selectedOptionKeys/);
  assert.doesNotMatch(reviewSource, /explanation/);
});

test("oral defense submission is bound to issued brief and sandbox confirmation", () => {
  assert.match(reviewSource, /briefId: brief\.briefId/);
  assert.match(reviewSource, /defenseVersion: brief\.defenseVersion/);
  assert.match(reviewSource, /attemptNumber: brief\.attemptNumber/);
  assert.match(reviewSource, /sandboxScenarioConfirmed: true/);
  assert.match(reviewSource, /Minimum 30 characters/);
});

test("review outcome is derived by shared evaluator with no reviewer integrity or outcome control", () => {
  assert.match(reviewSource, /evaluateOralDefenseProbes\(brief\.probes, observations\)/);
  assert.match(reviewSource, /judgment: CapabilityOralProbeJudgment \| ""/);
  assert.match(reviewSource, /judgment: ""/);
  assert.match(reviewSource, /No probe defaults to Clear/);
  assert.doesNotMatch(reviewSource, /integrityConcern/);
  assert.doesNotMatch(reviewSource, /setOutcome/);

  const mutationStart = reviewSource.indexOf("const completeMutation = useMutation");
  const mutationEnd = reviewSource.indexOf("if (authLoading)", mutationStart);
  assert.ok(mutationStart >= 0 && mutationEnd > mutationStart);
  const mutationSource = reviewSource.slice(mutationStart, mutationEnd);
  assert.doesNotMatch(mutationSource, /\bintegrityConcern\s*:/);
  assert.doesNotMatch(mutationSource, /\boutcome\s*:/);
});

test("reviewer sees whether an issued probe is integrity-critical but cannot change that property", () => {
  assert.match(reviewSource, /probe\.rubric\.criticalOnFail/);
  assert.match(reviewSource, /Integrity-critical if Fail/);
  assert.match(reviewSource, /At least one issued integrity-critical probe is explicitly Fail/);
  assert.doesNotMatch(reviewSource, /setCritical/);
});

test("reviewer records observable response rather than inferred motive", () => {
  assert.match(reviewSource, /Record what the Specialist actually reasoned, preserved, changed, or proposed/);
  assert.match(reviewSource, /Do not infer motive/);
  assert.match(reviewSource, /Record observable reasoning, not inferred intent/);
});

test("non-approved defense requires actionable feedback before submit", () => {
  assert.match(reviewSource, /derivedPreview\.outcome !== "approved"/);
  assert.match(reviewSource, /feedback\.trim\(\)\.length < 20/);
  assert.match(reviewSource, /Write at least 20 characters of actionable feedback/);
  assert.match(reviewSource, /!feedbackComplete/);
});

test("Specialist can see readiness and oral feedback without certification claims", () => {
  assert.match(practicalSource, /\/api\/tutor\/capability-readiness/);
  assert.match(practicalSource, /\/api\/tutor\/capability-oral-defense/);
  assert.match(practicalSource, /Reviewer feedback:/);
  assert.match(practicalSource, /cannot certify you/);
  assert.match(practicalSource, /cannot.*open Trial/);
});

test("standalone Capability Engine routes include oral defense review", () => {
  assert.match(standaloneSource, /capability-review\/oral-defense/);
  assert.match(mainSource, /capability-review\/oral-defense/);
});
