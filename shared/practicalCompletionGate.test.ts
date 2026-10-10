import test from "node:test";
import assert from "node:assert/strict";
import { derivePracticalCompletionGate } from "./practicalCompletionGate";

const proofs = [
  {key:"prepare",version:1,evidenceId:"prepare-e1",status:"approved"},
  {key:"execute",version:2,evidenceId:"execute-e2",status:"approved"},
  {key:"evidence",version:1,evidenceId:"evidence-e1",status:"approved"},
];
const tdDecision = {
  decision:"approved",
  proof_evidence_ids: {prepare:"prepare-e1",execute:"execute-e2",evidence:"evidence-e1"},
};

test("Signed off Practicals is durable across Sandbox to Trial transition",()=>{
  const before=derivePracticalCompletionGate({entryReady:true,proofs,tdDecision});
  assert.deepEqual(before,{
    allApproved:true,complete:true,readyForTDCompletionReview:true,readyForTrial:true,
  });
  const after=derivePracticalCompletionGate({entryReady:false,proofs,tdDecision});
  assert.deepEqual(after,{
    allApproved:true,complete:true,readyForTDCompletionReview:false,readyForTrial:false,
  });
});

test("TD completion never becomes real from a missing, stale or mismatched proof",()=>{
  assert.equal(derivePracticalCompletionGate({entryReady:true,proofs,tdDecision:null}).complete,false);
  const replacement=proofs.map(p=>p.key==="execute"?{...p,evidenceId:"execute-different"}:p);
  assert.equal(derivePracticalCompletionGate({entryReady:true,proofs:replacement,tdDecision}).complete,false);
  assert.equal(derivePracticalCompletionGate({entryReady:true,proofs,tdDecision:{...tdDecision,decision:"remediation_required"}}).complete,false);
  assert.equal(derivePracticalCompletionGate({entryReady:true,proofs:proofs.slice(0,2),tdDecision}).complete,false);
  assert.equal(derivePracticalCompletionGate({entryReady:true,proofs:proofs.map(p=>({...p,status:"submitted"})),tdDecision}).complete,false);
  assert.equal(derivePracticalCompletionGate({entryReady:true,proofs:proofs.map(p=>({...p,evidenceId:null})),tdDecision}).complete,false);
});

test("Three approved proofs alone cannot open Trial: current entry and TD sign-off both remain mandatory",()=>{
  const missingTD=derivePracticalCompletionGate({entryReady:true,proofs,tdDecision:null});
  assert.equal(missingTD.readyForTrial,false);
  const missingReadiness=derivePracticalCompletionGate({entryReady:false,proofs,tdDecision});
  assert.equal(missingReadiness.readyForTrial,false);
  const valid=derivePracticalCompletionGate({entryReady:true,proofs,tdDecision});
  assert.equal(valid.readyForTrial,true);
});
