import test from "node:test";
import assert from "node:assert/strict";
import {
  fromLegacyTopicState,
  normalizeCapabilityProgressionState,
  toLegacyTopicStability,
  transitionCapabilityProgression,
  type CapabilityProgressionState,
} from "./capabilityProgressionAuthority";

const state=(stability: CapabilityProgressionState["stability"],progression: CapabilityProgressionState["progression"]="building",phase: CapabilityProgressionState["phase"]="Structured Execution"):CapabilityProgressionState=>({phase,stability,progression});
const advance=(previous:CapabilityProgressionState, repeatabilityQualified=true,exitQualified=true,observedStability:"Low"|"Medium"|"High"="High")=>
transitionCapabilityProgression({previous,repeatabilityQualified,exitQualified,observedStability});

test("high from Low is not sufficient to enter the repeatability gate, even with fully supported evidence",()=>{
 assert.deepEqual(advance(state("Low")).next,state("High"));
 assert.equal(advance(state("Low")).transitionReason,"stability advance");
});
test("separate later repeatability and exit-confirmation sessions remain mandatory",()=>{
 const high=state("High");
 assert.deepEqual(advance(high,false).next,high);
 const eligible=advance(high).next;
 assert.deepEqual(eligible,state("High","exit_confirmation_eligible"));
 assert.equal(advance(high).transitionReason,"high maintenance entry");
 assert.deepEqual(advance(eligible,true,false).next,eligible);
 assert.deepEqual(advance(eligible,true,true).next,state("Low","building","Controlled Discomfort"));
});
test("the checkpoint is cleared on weaker evidence without manufacturing the next phase",()=>{
 assert.deepEqual(advance(state("High","exit_confirmation_eligible"),false,false,"Low").next,state("High"));
 assert.deepEqual(advance(state("High"),false,false,"Medium").next,state("Medium"));
});
test("final phase has independent transfer maintenance without a fifth phase",()=>{
 const tps=state("High","exit_confirmation_eligible","Time Pressure Stability");
 const final=advance(tps).next;
 assert.deepEqual(final,state("High","transfer_maintenance","Time Pressure Stability"));
 assert.deepEqual(advance(final).next,final);
});
test("legacy checkpoint maps without losing eligibility and invalid combinations fail closed",()=>{
 const mapped=fromLegacyTopicState("Clarity","High Maintenance");
 assert.deepEqual(mapped,state("High","exit_confirmation_eligible","Clarity"));
 assert.equal(toLegacyTopicStability(mapped),"High Maintenance");
 assert.throws(()=>normalizeCapabilityProgressionState({phase:"Clarity",stability:"High Maintenance",progression:"building"}));
 assert.throws(()=>normalizeCapabilityProgressionState({phase:"Clarity",stability:"Low",progression:"exit_confirmation_eligible"}));
 assert.throws(()=>normalizeCapabilityProgressionState({phase:"Clarity",stability:"High",progression:"transfer_maintenance"}));
});
