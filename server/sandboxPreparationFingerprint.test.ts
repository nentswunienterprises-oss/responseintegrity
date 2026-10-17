import test from "node:test";
import assert from "node:assert/strict";
import {sandboxPreparationFingerprint} from "./sandboxPreparationFingerprint";

const correct = {
  trajectoryId:"synthetic-trajectory",
  sessionNumber:4,
  bankVersion:1,
  eventFormId:"opaque-current-form",
  prescribedPhase:"Structured Execution",
  setId:"independent-execution",
  constraints:{pressure:"none",support:"no_prompting",difficulty:"normal"},
};

test("same server-authored preparation contract yields a stable fingerprint",()=>{
 const a=sandboxPreparationFingerprint(correct);
 const b=sandboxPreparationFingerprint({...correct,constraints:{
   difficulty:"normal",support:"no_prompting",pressure:"none"}});
 assert.equal(a,b);
 assert.match(a,/^[0-9a-f]{64}$/);
});
test("a different first rep, phase, session, bank or operating condition invalidates Map confirmation",()=>{
 const baseline=sandboxPreparationFingerprint(correct);
 const variations=[
  {...correct,trajectoryId:"another-student"},
  {...correct,sessionNumber:5},
  {...correct,bankVersion:2},
  {...correct,eventFormId:"changed-first-rep"},
  {...correct,prescribedPhase:"Controlled Discomfort"},
  {...correct,setId:"different-set"},
  {...correct,constraints:{...correct.constraints,support:"first_step_only"}},
 ];
 for(const modified of variations)assert.notEqual(sandboxPreparationFingerprint(modified),baseline);
});
