import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const planSource = fs.readFileSync(new URL("./capability-plan.tsx", import.meta.url), "utf8");
const deterrentSource = fs.readFileSync(
  new URL("../../../components/responseconditioning/DeepDiveDeterrent.tsx", import.meta.url),
  "utf8",
);
const standaloneSource = fs.readFileSync(new URL("../../../capabilityStandaloneApp.tsx", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../../../main.tsx", import.meta.url), "utf8");

const masteryKeys = [
  "topic_conditioning_mastery_v1",
  "clarity_mastery_v1",
  "structured_execution_mastery_v1",
  "controlled_discomfort_mastery_v1",
  "time_pressure_stability_mastery_v1",
  "intro_session_structure_mastery_v1",
  "logging_system_mastery_v1",
  "session_flow_control_mastery_v1",
  "drill_library_mastery_v1",
  "handover_verification_mastery_v1",
  "tools_required_mastery_v1",
];

test("Deep Dive integration maps all 11 implemented mastery checks", () => {
  for (const assessmentKey of masteryKeys) {
    assert.match(deterrentSource, new RegExp(assessmentKey));
  }
});

test("Deep Dive and plan surfaces launch assessments only from an available state", () => {
  assert.match(deterrentSource, /capabilityStatus\.status === "available"/);
  assert.match(planSource, /assessment\.status === "available"/);
  assert.doesNotMatch(planSource, /assessment\.status !== "unavailable"/);
});

test("missing banks remain visible but inert instead of becoming fake active assessments", () => {
  assert.match(planSource, /Bank not active/);
  assert.match(planSource, /bank_unavailable/);
  assert.match(deterrentSource, /Mastery bank not active yet/);
});

test("Specialist plan displays lock causes and unlock time without implying certification", () => {
  assert.match(planSource, /prerequisite_missing/);
  assert.match(planSource, /spacing_window/);
  assert.match(planSource, /retry_cooldown/);
  assert.match(planSource, /attempt_limit/);
  assert.match(planSource, /unlockAt/);
  assert.match(planSource, /cannot certify you/);
  assert.match(planSource, /cannot.*open Trial/);
});

test("capability plan is routed through the Specialist gateway and standalone entrypoint", () => {
  assert.match(standaloneSource, /operational\/specialist\/capability-plan/);
  assert.match(standaloneSource, /TutorGatewayGuard/);
  assert.match(mainSource, /operational\/specialist\/capability-plan/);
});
