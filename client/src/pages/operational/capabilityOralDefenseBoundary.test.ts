import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const reviewSource = fs.readFileSync(new URL("./capability-oral-defense-review.tsx", import.meta.url), "utf8");
const practicalSource = fs.readFileSync(new URL("./tutor/capability-practicals.tsx", import.meta.url), "utf8");
const standaloneSource = fs.readFileSync(new URL("../../capabilityStandaloneApp.tsx", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../../main.tsx", import.meta.url), "utf8");

test("reviewer UI receives targeted briefs without assessment answer keys", () => {
  assert.match(reviewSource, /oral-defense\/candidates/);
  assert.match(reviewSource, /oral-defense\/\$\{encodeURIComponent/);
  assert.match(reviewSource, /reviewerInstruction/);
  assert.doesNotMatch(reviewSource, /correctOptionKeys/);
  assert.doesNotMatch(reviewSource, /selectedOptionKeys/);
  assert.doesNotMatch(reviewSource, /explanation/);
});

test("oral defense submission is bound to the issued brief and sandbox confirmation", () => {
  assert.match(reviewSource, /briefId: brief\.briefId/);
  assert.match(reviewSource, /defenseVersion: brief\.defenseVersion/);
  assert.match(reviewSource, /attemptNumber: brief\.attemptNumber/);
  assert.match(reviewSource, /sandboxScenarioConfirmed: true/);
  assert.match(reviewSource, /Minimum 30 characters/);
});

test("review outcome is derived from probe evidence rather than manually selected", () => {
  assert.match(reviewSource, /function predictedOutcome/);
  assert.match(reviewSource, /observations\.some\(\(probe\) => probe\.integrityConcern\)/);
  assert.match(reviewSource, /observations\.every\(\(probe\) => probe\.judgment === "clear"\)/);
  assert.doesNotMatch(reviewSource, /setOutcome/);
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
