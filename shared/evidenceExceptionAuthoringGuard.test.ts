import test from "node:test";
import assert from "node:assert/strict";
import {
  assertNoSupersededEvidenceScenario,
  supersededEvidenceScenarioReason,
} from "./evidenceExceptionAuthoringGuard";

const question=(text:string, overrides:Partial<Parameters<typeof supersededEvidenceScenarioReason>[0]>={})=>({
  assessmentKey:"how_the_system_resolves_uncertainty_mastery_v1",
  itemKey:"uncertainty_extra_02",
  competencyKey:"uncertainty.confounded",
  text,
  ...overrides,
});

test("future Specialist banks reject fictional missing-observation incidents",()=>{
  for(const scenario of [
    "The camera freezes while the student writes their mathematical step during the rep.",
    "Audio drops out as the student attempts the reason and the teacher guesses it.",
    "The camera angle hides the student's written method step during a rep.",
    "The student moves off-camera while the Specialist evaluates independent execution.",
    "A device interruption means the student's mathematical response cannot be scored.",
    "The Specialist forgot to watch the student write their first step.",
    "The display refreshes and changes the required step order during the timed task.",
  ]) {
    assert.ok(supersededEvidenceScenarioReason(question(scenario)),scenario);
    assert.throws(()=>assertNoSupersededEvidenceScenario(question(scenario)),
      /superseded evidence-exception scenario/,
      scenario);
  }
});

test("worked mathematical reference is the defensible rare learner confound",()=>{
  const text="The student consults a visible worked example that names the correct method before choosing their own method. Record the affected independence as confounded.";
  assert.equal(supersededEvidenceScenarioReason(question(text)),null);
  assert.doesNotThrow(()=>assertNoSupersededEvidenceScenario(question(text)));
});

test("genuinely absent evidence is a record status, not a fabricated student experience",()=>{
  const text="No qualifying observation establishes independent first-step control. The status stays not observed; RI-OS requests a clean opportunity only when needed.";
  assert.equal(supersededEvidenceScenarioReason(question(text)),null);
});

test("equipment preparation and authentic technical incident response remain teachable",()=>{
  const text="Check that the camera view and audio are functional before student work begins.";
  assert.equal(supersededEvidenceScenarioReason(question(text,{
    itemKey:"ost_tools_02",competencyKey:"tools.observability_gate",
    assessmentKey:"operating_system_transfer_v2",
  })),null);
  assert.equal(supersededEvidenceScenarioReason(question(
    "A session flow technical interruption stops the lesson. Preserve completed evidence and follow the booked-session recovery rule.",
    {assessmentKey:"session_flow_control_mastery_v1",competencyKey:"session_flow.condition_integrity"},
  )),null);
});

test("normal student hesitation or observed collapse is never reclassified as an exception",()=>{
  assert.equal(supersededEvidenceScenarioReason(question(
    "The student visibly hesitates at the first step, then writes unrelated operations and requests rescue."
  )),null);
});
