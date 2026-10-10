import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePracticalEntryGate, type PracticalEntryGateInput } from "./practicalEntryGate";

const ready:PracticalEntryGateInput = {
 operationalMode:"sandbox",
 assignedTdId:"td-a",
 currentReadiness:{practicalsReady:true,policyStatus:"approved",policyVersion:2,bankKey:"sandbox_stateful_environment",bankVersion:3},
 latestAssignedTdSignoff:{decision:"passed",capabilitySnapshot:{practicalsReady:true,policyStatus:"approved",policyVersion:2,bankKey:"sandbox_stateful_environment",bankVersion:3}},
};
const gate=(change:Partial<PracticalEntryGateInput>)=>evaluatePracticalEntryGate({...ready,...change});

test("Only current approved policy + matching bank + current TD pass can open Practicals",()=>{
 assert.deepEqual(gate({}),{ready:true,blockers:[]});
 assert.equal(gate({operationalMode:"trial"}).ready,false);
 assert.equal(gate({assignedTdId:null}).ready,false);
 assert.equal(gate({latestAssignedTdSignoff:null}).ready,false);
 assert.equal(gate({latestAssignedTdSignoff:{decision:"remediation_required"}}).ready,false);
});
test("Candidate policy is a hard gate even with a positive copied readiness flag",()=>{
 const x=gate({currentReadiness:{...ready.currentReadiness,policyStatus:"candidate",practicalsReady:true}});
 assert.equal(x.ready,false);
 assert.match(x.blockers.join(" "),/policy has not been approved/i);
});
test("TD signoff is invalid after a Sandbox bank or policy version changes",()=>{
 const cases=[
   {...ready.currentReadiness,bankVersion:4},
   {...ready.currentReadiness,bankKey:"replacement_bank"},
   {...ready.currentReadiness,policyVersion:3},
 ];
 for(const currentReadiness of cases) {
   const x=gate({currentReadiness});
   assert.equal(x.ready,false);
   assert.match(x.blockers.join(" "),/mismatched/i);
 }
});
test("Old signoffs missing provenance never silently authorize Practicals",()=>{
 const legacy=gate({latestAssignedTdSignoff:{decision:"passed",capabilitySnapshot:{practicalsReady:true}}});
 assert.equal(legacy.ready,false);
 assert.match(legacy.blockers.join(" "),/missing or mismatched/i);
});
test("Missing provenance or non-positive readiness fails closed",()=>{
 const r=gate({currentReadiness:{...ready.currentReadiness,bankVersion:null}});
 assert.equal(r.ready,false);
 assert.equal(gate({currentReadiness:{...ready.currentReadiness,practicalsReady:false}}).ready,false);
 assert.equal(gate({latestAssignedTdSignoff:{decision:"passed",capabilitySnapshot:{...ready.latestAssignedTdSignoff!.capabilitySnapshot,practicalsReady:false}}}).ready,false);
});
