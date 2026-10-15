import test from "node:test";
import assert from "node:assert/strict";
import {getDrillSchemaDefinitionByVersion} from "@shared/responseIntegrityDrillRegistry";
import {loadSandboxQualificationEvidence} from "./sandboxQualificationEvidence";
function fixture(){
 const schema=getDrillSchemaDefinitionByVersion("training","Clarity",1)!;
 const reps=schema.sets.filter(s=>!s.modelingOnly).flatMap(s=>Array.from({length:s.reps},(_,i)=>({
  id:s.setId+":"+i,trajectory_id:"traj-1",tutor_assignment_id:"assignment",tutor_id:"specialist",
  student_id:"student",session_number:1,phase:"Clarity",topic_key:"geometry",set_id:s.setId,
  rep_number:i+1,bank_key:"sandbox_stateful_environment",bank_version:1,
  truth_bank_version:1,outcome_ref:"ref",truth_outcome_ref:"ref",outcome_key:s.setId+"-"+i,
  outcome_version:1,trajectory_class:"conditional",canonical_observations:{evidence:"yes"},
  canonical_prerequisite_sentinel:null,trajectory_seed:"hidden-seed",
  student_behavior:"Simulated learner showed a conditional response.",
  condition_kept:true,observation_exact:true,evidence_exact:true,
  completed_at:new Date(Date.UTC(2026,9,15,11,0,i)).toISOString(),
 })));
 const sessions=[{id:"session-one",trajectory_id:"traj-1",tutor_assignment_id:"assignment",
   tutor_id:"specialist",student_id:"student",session_number:1,phase:"Clarity",
   topic_key:"geometry",bank_version:1,bank_key:"sandbox_stateful_environment",
   canonical_authority:{route:"normal_training"},trajectory_seed:"hidden-seed",
   authority_aligned:true,state_track_aligned:true,state_change_observed:false,
   student_breakdown_recovery_observed:false,completed_at:"2026-10-15T11:05:55Z"}];
 return {reps,sessions};
}
function db(f=fixture()){
 return {query:async(sql:string):Promise<{rows:any[]}>=>{
  if(sql.includes("FROM public.specialist_sandbox_rep_events r"))return {rows:f.reps};
  if(sql.includes("FROM public.specialist_sandbox_session_evaluations s"))return {rows:f.sessions};
  if(sql.includes("FROM public.specialist_sandbox_rediagnosis_turns r"))return {rows:[]};
  if(sql.includes("FROM public.session_billing_events e"))return {rows:[]};
  if(sql.includes("FROM public.specialist_sandbox_live_evidence_turns")){
   const error=Object.assign(new Error("relation does not exist"),{code:"42P01"});throw error;
  }
  throw new Error("Unexpected historical source query");
 }};
}
test("exact versioned set/rep identity and canonical truth qualify as complete session",async()=>{
 const r=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},db());
 assert.equal(r.events.filter(e=>e.kind==="session").length,1);
 assert.equal(r.events.find(e=>e.kind==="session")?.complete,true);
 assert.ok(r.sourceGaps.length);
});
test("missing rep cannot qualify a session even if remaining source truth is intact",async()=>{
 const f=fixture();f.reps.pop();
 const r=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},db(f));
 assert.equal(r.events.find(e=>e.kind==="session")?.complete,false);
});
test("rep mismatch is a consequential Specialist error, not repaired by aggregate session alignment",async()=>{
 const f=fixture();f.reps[0].observation_exact=false;
 const r=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},db(f));
 assert.equal(r.events.find(e=>e.id===f.reps[0].id)?.materialError,true);
 assert.equal(r.events.find(e=>e.kind==="session")?.materialError,true);
});
test("missing hidden truth is incomplete evidence, not fabricated Specialist divergence",async()=>{
 const f=fixture();f.reps[0].canonical_observations=null;
 const r=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},db(f));
 const rep=r.events.find(e=>e.id===f.reps[0].id)!;
 assert.equal(rep.technicallyValid,false);assert.equal(rep.materialError,false);
});
test("cross-mode absence is reported rather than silently accepted",async()=>{
 const r=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},db());
 assert.match(r.sourceGaps.join(" "),/schema not applied/);
});
