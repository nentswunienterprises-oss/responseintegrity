import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const runnerSource = fs.readFileSync(new URL("./capability-assessment.tsx", import.meta.url), "utf8");
const standaloneSource = fs.readFileSync(new URL("../../../capabilityStandaloneApp.tsx", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../../../main.tsx", import.meta.url), "utf8");
const deepDiveDeterrentSource = fs.readFileSync(
  new URL("../../../components/responseconditioning/DeepDiveDeterrent.tsx", import.meta.url),
  "utf8",
);

test("Specialist runner submits issued form identity with complete responses", () => {
  assert.match(runnerSource, /formId: form\.formId/);
  assert.match(runnerSource, /bankVersion: form\.bankVersion/);
  assert.match(runnerSource, /responses: form\.questions\.map/);
  assert.match(runnerSource, /if \(!form \|\| !allComplete\)/);
  assert.match(runnerSource, /disabled=\{!allComplete \|\| submitAttempt\.isPending\}/);
});

test("Specialist runner supports all deterministic question modes", () => {
  assert.match(runnerSource, /currentQuestion\.kind === "single_choice"/);
  assert.match(runnerSource, /currentQuestion\.kind === "multi_select"/);
  assert.match(runnerSource, /currentQuestion\.kind === "sequence"/);
  assert.match(runnerSource, /moveSequenceOption/);
  assert.match(runnerSource, /removeSequenceOption/);
});

test("Specialist result contract contains no answer-key or question-result fields", () => {
  const typeStart = runnerSource.indexOf("type CapabilityAttemptResult");
  const typeEnd = runnerSource.indexOf("type PodData", typeStart);
  assert.notEqual(typeStart, -1);
  assert.notEqual(typeEnd, -1);
  const resultType = runnerSource.slice(typeStart, typeEnd);
  assert.doesNotMatch(resultType, /questionResults/);
  assert.doesNotMatch(resultType, /correctOptionKeys/);
  assert.doesNotMatch(resultType, /explanation/);
});

test("Capability route is isolated and guarded without changing the central App router", () => {
  assert.match(standaloneSource, /TutorGatewayGuard/);
  assert.match(standaloneSource, /\/operational\/specialist\/capability\/:assessmentKey/);
  assert.match(mainSource, /startsWith\("\/operational\/specialist\/capability\/"\)/);
  assert.match(mainSource, /CapabilityStandaloneApp/);
});

test("Clarity and Structured Execution Deep Dives expose mastery entry only to Specialists", () => {
  assert.match(deepDiveDeterrentSource, /clarity_mastery_v1/);
  assert.match(deepDiveDeterrentSource, /structured_execution_mastery_v1/);
  assert.match(deepDiveDeterrentSource, /user\?\.role/);
  assert.match(deepDiveDeterrentSource, /Take mastery check/);
});
