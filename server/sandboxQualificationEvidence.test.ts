import test from "node:test";
import assert from "node:assert/strict";
import {getDrillSchemaDefinitionByVersion} from "@shared/responseIntegrityDrillRegistry";
import {createHash} from "node:crypto";
import {loadSandboxQualificationEvidence,nativeHandoverRepMatches} from "./sandboxQualificationEvidence";
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
  if(sql.includes("FROM public.specialist_sandbox_preparation_events")){
   const error=Object.assign(new Error("relation does not exist"),{code:"42P01"});throw error;
  }
  if(sql.includes("FROM public.specialist_sandbox_context_preparation_events"))return {rows:[]};
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
 const f=fixture();(f.reps[0] as any).canonical_observations=null;
 const r=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},db(f));
 const rep=r.events.find(e=>e.id===f.reps[0].id)!;
 assert.equal(rep.technicallyValid,false);assert.equal(rep.materialError,false);
});
test("cross-mode absence is reported rather than silently accepted",async()=>{
 const r=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},db());
 assert.match(r.sourceGaps.join(" "),/schema not applied/);
});

test("only completed native Diagnosis matching the exact recorded probe may establish Diagnosis",async()=>{
 const fixtureDb=db();
 const native={id:"native-diagnosis",trajectory_id:"traj-1",student_id:"student",
  scope:"diagnosis",phase:"Clarity",bank_version:1,outcome_version:1,
  source_context_id:"native-run",probe_id:"clarity.recognition",
  outcome_key:"diagnosis-pattern",trajectory_class:"conditional",
  trajectory_seed:"hidden-seed",canonical_observations:[{dimensionId:"clarity.recognition",behaviorId:"recognizes"}],
  student_behavior:"Synthetic response presented",condition_conformed:true,
  observation_exact:true,native_proof_verified:true,
  completed_at:"2026-10-15T11:05:58Z"};
 const historical={query:async(sql:string,params?:any[])=>{
  if(sql.includes("FROM public.specialist_sandbox_live_evidence_turns"))return {rows:[
    native,{...native,id:"handover-simulation",scope:"handover",native_proof_verified:true},
    {...native,id:"unmatched-diagnosis",native_proof_verified:false},
  ]};
  return fixtureDb.query(sql);
 }};
 const result=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},historical);
 assert.equal(result.events.find(e=>e.id==="native-diagnosis")?.complete,true);
 assert.equal(result.events.find(e=>e.id==="handover-simulation")?.complete,false);
 assert.equal(result.events.find(e=>e.id==="unmatched-diagnosis")?.complete,false);
});

test("native Diagnosis SQL projection has one legal column terminator before FROM",async()=>{
 let projection:string|undefined;
 const normal=db();
 const spy={query:async(sql:string,params?:any[])=>{
   if(sql.includes("FROM public.specialist_sandbox_live_evidence_turns")) {
     projection=sql;
     return {rows:[]};
   }
   return normal.query(sql);
 }};
 await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},spy);
 assert.ok(projection);
 assert.match(projection!,/AS native_placement_pending\s+FROM public\.specialist_sandbox_live_evidence_turns/);
 assert.doesNotMatch(projection!,/native_placement_pending,\s+FROM/);
});

test("targeted re-diagnosis cannot count a clean probe as completed mode before final canonical placement",async()=>{
 const baseDb=db();
 const rediagnosis={id:"rediagnosis-1",trajectory_id:"traj-1",student_id:"student",
  probe_id:"clarity.recognition",bank_key:"sandbox_stateful_environment",bank_version:1,
  outcome_key:"probe-1",outcome_version:1,trajectory_seed:"hidden-seed",
  canonical_observations:[{dimensionId:"recognition",behaviorId:"observed"}],
  student_behavior:"Student response observed",condition_conformed:true,
  observation_exact:true,authority_aligned:true,rediagnosis_status:"active",
  specialist_decision:{complete:false},rediagnosis_canonical_decision:null,
  completed_at:"2026-10-15T11:04:00Z"};
 let nativeRows=[rediagnosis];
 const sourceDb={query:async(sql:string)=>{
  if(sql.includes("FROM public.specialist_sandbox_rediagnosis_turns r"))
   return {rows:nativeRows};
  return baseDb.query(sql);
 }};
 let result=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},sourceDb);
 let recorded=result.events.find(e=>e.id==="rediagnosis-1")!;
 assert.equal(recorded.complete,false);
 assert.equal(recorded.materialError,false);
 nativeRows=[{...rediagnosis,rediagnosis_status:"completed",
  specialist_decision:{complete:true,placementPhase:"Clarity",stability:"Medium"},
  rediagnosis_canonical_decision:{complete:true,placementPhase:"Clarity",stability:"Medium"}}];
 result=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},sourceDb);
 recorded=result.events.find(e=>e.id==="rediagnosis-1")!;
 assert.equal(recorded.complete,true);
 nativeRows=[{...nativeRows[0],rediagnosis_canonical_decision:{
  complete:true,placementPhase:"Structured Execution",stability:"Medium"}}];
 result=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},sourceDb);
 recorded=result.events.find(e=>e.id==="rediagnosis-1")!;
 assert.equal(recorded.complete,false);
 assert.equal(recorded.materialError,true);
});

test("completed Handover authority matches the actual dimension and response label, never attendance alone",()=>{
 const sets=[{setName:"Clarity verification",observations:[
  {vocabulary_dimension_id:"clarity.vocabulary",vocabulary_option_id:"verified-schema-option",
   vocabulary:"Identified the important terms accurately"},
 ]}];
 const recorded={supportEvent:"none",observations:[
  {dimensionId:"clarity.vocabulary",behaviorId:"accurate_recognition"}]};
 assert.equal(nativeHandoverRepMatches(sets,recorded,1),true);
 assert.equal(nativeHandoverRepMatches(sets,{...recorded,observations:[
  {dimensionId:"clarity.vocabulary",behaviorId:"no_recognition"}]},1),false);
 assert.equal(nativeHandoverRepMatches(sets,recorded,2),false);
 assert.equal(nativeHandoverRepMatches(sets,{...recorded,supportEvent:"first_step_confirmation"},1),false);
 assert.equal(nativeHandoverRepMatches([{...sets[0],observations:[
  {vocabulary_dimension_id:"clarity.vocabulary",
   vocabulary:"Identified the important terms accurately"}]}],recorded,1),false);
});
test("Handover only gets mode credit after an independently completed matching native drill",async()=>{
 const source=db();
 const native={id:"handover-evidence",trajectory_id:"traj-1",student_id:"student",
  scope:"handover",phase:"Clarity",bank_version:1,outcome_version:1,
  sequence_number:1,source_context_id:"scheduled-handover-1",probe_id:"clarity.recognition",
  outcome_key:"observed-response",trajectory_class:"conditional",
  trajectory_seed:"hidden-seed",canonical_observations:[{dimensionId:"clarity.vocabulary",behaviorId:"accurate_recognition"}],
  student_behavior:"Synthetic student response",condition_conformed:true,observation_exact:true,
  completed_at:"2026-10-15T11:05:58Z",specialist_submission:{supportEvent:"none",observations:[
   {dimensionId:"clarity.vocabulary",behaviorId:"accurate_recognition"}]},
  native_handover_drill_id:"native-drill-1",
  native_handover_sets:[{observations:[{vocabulary_dimension_id:"clarity.vocabulary",
   vocabulary_option_id:"versioned.vocabulary.option_4",
   vocabulary:"Identified the important terms accurately"}]}],
 };
 const dbWith={query:async(sql:string,params?:any[])=>{
  if(sql.includes("FROM public.specialist_sandbox_live_evidence_turns"))return {rows:[native]};
  return source.query(sql);
 }};
 const result=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},dbWith);
 const row=result.events.find(e=>e.id==="handover-evidence")!;
 assert.equal(row.complete,true);
 assert.equal(row.sourceId,"handover-evidence:native-drill-1");
 const bad={...native,native_handover_sets:[{observations:[{vocabulary_dimension_id:"clarity.vocabulary",
  vocabulary_option_id:"versioned.vocabulary.option_1",
  vocabulary:"Could not identify the important terms or symbols"}]}]};
 const dbBad={query:async(sql:string,params?:any[])=>{
  if(sql.includes("FROM public.specialist_sandbox_live_evidence_turns"))return {rows:[bad]};
  return source.query(sql);
 }};
 const rejected=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},dbBad);
 assert.equal(rejected.events.find(e=>e.id==="handover-evidence")?.complete,false);
});

test("1000-row completed-session cap is never accepted as a complete qualification history",async()=>{
 const records=fixture();
 records.sessions=Array.from({length:1000},(_,i)=>({
   ...records.sessions[0],id:"session-"+i,session_number:i+1,
 }));
 const result=await loadSandboxQualificationEvidence(
   {tutorAssignmentId:"assignment",tutorId:"specialist"},db(records));
 assert.match(result.sourceGaps.join(" "),/projection limit/);
});
test("5000-row Diagnosis/Handover cap also blocks qualification readback",async()=>{
 const original=db();
 const template={id:"cross",completed_at:"2026-10-15T11:02:00Z",
  trajectory_id:"traj-1",student_id:"student",scope:"diagnosis",phase:"Clarity",
  bank_version:1,outcome_version:1,probe_id:"clarity.recognition",
  outcome_key:"case",source_context_id:"run",sequence_number:1,
  trajectory_seed:"hidden-seed",canonical_observations:[{dimensionId:"clarity.vocabulary"}],
  student_behavior:"Simulated response",condition_conformed:true,
  observation_exact:true,native_proof_verified:false};
 const mocked={query:async(sql:string,params?:any[])=>{
   if(sql.includes("FROM public.specialist_sandbox_live_evidence_turns"))
     return {rows:Array.from({length:5000},(_,i)=>({...template,id:"cross-"+i}))};
   return original.query(sql);
 }};
 const result=await loadSandboxQualificationEvidence(
   {tutorAssignmentId:"assignment",tutorId:"specialist"},mocked);
 assert.match(result.sourceGaps.join(" "),/Diagnosis\/Handover evidence reached/);
});

test("continuity requires aligned sequential evidence on the same student topic",async()=>{
 const f=fixture();
 const second=f.sessions[0];
 f.sessions.push({...second,id:"session-two",session_number:2,
   completed_at:"2026-10-15T11:15:55Z"});
 f.reps.push(...f.reps.map((rep,i)=>({...rep,id:rep.id+"-second",
   session_number:2,completed_at:new Date(Date.UTC(2026,9,15,11,7,i)).toISOString()})));
 let r=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},db(f));
 assert.equal(r.events.filter(e=>e.mode==="continuity").length,1);
 f.sessions[0].authority_aligned=false;
 r=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},db(f));
 assert.equal(r.events.filter(e=>e.mode==="continuity").length,0);
 f.sessions[0].authority_aligned=true;
 f.sessions[1].topic_key="different-topic";
 f.reps.filter(x=>x.session_number===2).forEach(rep=>rep.topic_key="different-topic");
 r=await loadSandboxQualificationEvidence({tutorAssignmentId:"assignment",tutorId:"specialist"},db(f));
 assert.equal(r.events.filter(e=>e.mode==="continuity").length,0);
});

test("preparation counts only after a matching canonical first rep preserves the contract",async()=>{
 const records=fixture();
 const first=records.reps[0];
 const schema=getDrillSchemaDefinitionByVersion("training","Clarity",1)!;
 const firstSet=schema.sets.find(set=>set.setId===first.set_id)!;
 const sha=createHash("sha256").update(JSON.stringify(firstSet.constraints)).digest("hex");
 const prepared={id:"preparation-1",trajectory_id:"traj-1",student_id:"student",
  bank_version:1,trajectory_bank_version:1,phase:"Clarity",
  set_id:first.set_id,topic_key:"geometry",session_number:1,
  condition_contract_sha256:sha,trajectory_seed:"hidden-seed",
  problem_prepared:true,conditions_reviewed:true,evidence_plan_reviewed:true,
  recorded_at:"2026-10-15T10:58:00Z",
  first_rep_id:first.id,first_rep_truth_id:first.id,
  first_rep_truth_ref:"ref",first_rep_outcome_ref:"ref",
  first_rep_canonical_observations:{evidence:"yes"},
  first_rep_completed_at:first.completed_at,first_rep_condition_kept:true,
  first_rep_observation_exact:true,first_rep_evidence_exact:true};
 const backing=db(records);
 let rows=[prepared];
 const service={query:async(sql:string,params?:any[])=>{
   if(sql.includes("FROM public.specialist_sandbox_preparation_events"))return {rows};
   return backing.query(sql);
 }};
 let result=await loadSandboxQualificationEvidence(
   {tutorAssignmentId:"assignment",tutorId:"specialist"},service);
 assert.equal(result.events.find(e=>e.id==="preparation-1")?.complete,true);
 assert.equal(result.events.find(e=>e.id==="preparation-1")?.conditionKept,true);
 rows=[{...prepared,first_rep_id:null,first_rep_truth_id:null}];
 result=await loadSandboxQualificationEvidence(
   {tutorAssignmentId:"assignment",tutorId:"specialist"},service);
 assert.equal(result.events.find(e=>e.id==="preparation-1"),undefined,
   "Unattempted preparation remains on the audit ledger but is not qualification evidence.");
 rows=[{...prepared,condition_contract_sha256:"tampered"}];
 result=await loadSandboxQualificationEvidence(
   {tutorAssignmentId:"assignment",tutorId:"specialist"},service);
 assert.equal(result.events.find(e=>e.id==="preparation-1")?.technicallyValid,false);
 rows=[{...prepared,first_rep_truth_ref:"wrong-outcome"}];
 result=await loadSandboxQualificationEvidence(
   {tutorAssignmentId:"assignment",tutorId:"specialist"},service);
 assert.equal(result.events.find(e=>e.id==="preparation-1")?.complete,false);
 rows=[{...prepared,first_rep_condition_kept:false}];
 result=await loadSandboxQualificationEvidence(
   {tutorAssignmentId:"assignment",tutorId:"specialist"},service);
 const failed=result.events.find(e=>e.id==="preparation-1")!;
 assert.equal(failed.materialError,true);
 assert.equal(failed.conditionKept,false);
 rows=[{...prepared,recorded_at:"2026-10-15T11:59:00Z"}];
 result=await loadSandboxQualificationEvidence(
   {tutorAssignmentId:"assignment",tutorId:"specialist"},service);
 assert.equal(result.events.find(e=>e.id==="preparation-1")?.complete,false);
});
