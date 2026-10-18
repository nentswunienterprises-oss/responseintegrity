import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import pg from "pg";
import {loadSandboxQualificationEvidence} from "../server/sandboxQualificationEvidence";
import {evaluateSandboxQualification,SANDBOX_QUALIFICATION_V1} from "../shared/sandboxQualificationPolicy";
import {getDrillSchemaDefinitionByVersion} from "../shared/responseIntegrityDrillRegistry";
import {resolveSandboxBehaviorProfile} from "../shared/sandboxBehaviorProfiles";
import {DIAGNOSIS_OBSERVATION_MATRIX} from "../shared/diagnosisObservationMatrix";
import {loadPracticalEntryStatus} from "../server/practicalEntryStatus";
import {sandboxQualificationEvidenceFingerprint} from "../server/sandboxQualificationFingerprint";
import {createTdSandboxQualificationReview} from "../server/sandboxQualificationReview";
import {diagnosisScheduledSessionQuery} from "../server/diagnosisScheduledSessionQuery";
import {authorizeDiagnosisContinuation} from "../server/diagnosisContinuation";
import {createEvidenceCompleteDiagnosisState,evaluateEvidenceCompleteDiagnosis} from "../shared/evidenceCompleteDiagnosis";

// Synthetic storage-contract integration only. Never connect to Proof or Production.
// Native source fixtures below are explicitly authored test records, not user qualification.
const initial=new URL(String(process.env.QUALIFICATION_TEST_DATABASE_URL||""));
assert.ok(["127.0.0.1","localhost","[::1]"].includes(initial.hostname));
assert.equal(initial.pathname,"/sandbox_qualification_ci");
const admin=new pg.Client({connectionString:initial.href});
await admin.connect();
try {await admin.query("CREATE DATABASE sandbox_qualification_journey_ci");}
finally {await admin.end();}
initial.pathname="/sandbox_qualification_journey_ci";
const db=new pg.Client({connectionString:initial.href,connectionTimeoutMillis:10000});
await db.connect();
let seq=0;
const stamp=()=>new Date(Date.UTC(2026,9,15,0,0,++seq)).toISOString();
const tutor="ci-specialist",assignment="ci-assignment",td="ci-td";
async function put(table:string,record:Record<string,unknown>){
 const keys=Object.keys(record);
 const values=keys.map(k=>record[k]!==null&&typeof record[k]==="object"?JSON.stringify(record[k]):record[k]);
 await db.query("INSERT INTO "+table+" ("+keys.join(",")+") VALUES ("+keys.map((_,i)=>"$"+(i+1)).join(",")+")",values);
}
const ddl=`
CREATE SCHEMA private;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
`;
const tables=[
 ["public.tutor_sandbox_mock_assessments","id varchar PRIMARY KEY,tutor_id varchar,tutor_assignment_id varchar,assessed_by_user_id varchar,decision varchar,checklist jsonb,assessed_at timestamptz"],
 ["public.users","id varchar PRIMARY KEY"],
 ["public.pods","id varchar PRIMARY KEY,td_id varchar"],
 ["public.tutor_assignments","id varchar PRIMARY KEY,tutor_id varchar,pod_id varchar,operational_mode varchar,created_at timestamptz"],
 ["public.specialist_sandbox_trajectories","id varchar PRIMARY KEY,tutor_assignment_id varchar,tutor_id varchar,student_id varchar,bank_version int,bank_key varchar"],
 ["private.specialist_sandbox_trajectory_truth","trajectory_id varchar PRIMARY KEY,trajectory_seed varchar"],
 ["public.specialist_sandbox_rep_events","id varchar PRIMARY KEY,tutor_assignment_id varchar,tutor_id varchar,trajectory_id varchar,student_id varchar,session_number int,phase varchar,topic_key varchar,set_id varchar,rep_number int,outcome_ref varchar,student_behavior text,condition_kept boolean,observation_exact boolean,evidence_exact boolean,completed_at timestamptz"],
 ["private.specialist_sandbox_rep_event_truth","event_id varchar PRIMARY KEY,outcome_ref varchar,outcome_key varchar,outcome_version int,trajectory_class varchar,canonical_observations jsonb,canonical_prerequisite_sentinel varchar,canonical_inherited_rescue_signal varchar,bank_version int"],
 ["public.specialist_sandbox_session_evaluations","id varchar PRIMARY KEY,tutor_assignment_id varchar,tutor_id varchar,trajectory_id varchar,student_id varchar,session_number int,phase varchar,topic_key varchar,authority_aligned boolean,state_track_aligned boolean,student_breakdown_recovery_observed boolean,state_change_observed boolean,specialist_authority jsonb,completed_at timestamptz"],
 ["private.specialist_sandbox_session_truth","session_evaluation_id varchar PRIMARY KEY,canonical_authority jsonb"],
 ["public.specialist_sandbox_rediagnosis_runs","id varchar PRIMARY KEY,status varchar,specialist_decision jsonb"],
 ["private.specialist_sandbox_rediagnosis_truth","rediagnosis_run_id varchar PRIMARY KEY,canonical_decision jsonb"],
 ["public.specialist_sandbox_rediagnosis_turns","id varchar PRIMARY KEY,tutor_assignment_id varchar,tutor_id varchar,trajectory_id varchar,student_id varchar,rediagnosis_run_id varchar,phase varchar,probe_id varchar,student_behavior text,condition_conformed boolean,observation_exact boolean,authority_aligned boolean,completed_at timestamptz"],
 ["private.specialist_sandbox_rediagnosis_turn_truth","rediagnosis_turn_id varchar PRIMARY KEY,outcome_key varchar,outcome_version int,trajectory_class varchar,canonical_observations jsonb"],
 ["public.session_billing_events","session_id varchar,metadata jsonb,actor_id varchar,is_sandbox boolean,event_type varchar,created_at timestamptz"],
 ["public.response_integrity_diagnosis_runs","id varchar PRIMARY KEY,tutor_id varchar,student_id varchar,status varchar,session_context varchar,probe_history jsonb,decision jsonb"],
 ["public.scheduled_sessions","id varchar PRIMARY KEY,tutor_id varchar,student_id varchar,type varchar,status varchar"],
 ["public.intro_session_drills","id varchar PRIMARY KEY,tutor_id varchar,student_id varchar,scheduled_session_id varchar,drill jsonb,submitted_at timestamptz"],
];
const phases=Object.keys(SANDBOX_QUALIFICATION_V1.phaseMinimums);
const fixtureProfiles=SANDBOX_QUALIFICATION_V1.profiles;
type Traj={id:string;student:string;profile:string};
const trajectories:Traj[]=[];
async function session(tr:Traj,phase:string,n:number,development=false){
 const schema=getDrillSchemaDefinitionByVersion("training",phase as any,1)!;
 assert.ok(schema);
 const sets=schema.sets.filter(s=>!s.modelingOnly);
 const topic="synthetic "+phase.toLowerCase();
 if(development&&tr===trajectories[0]){
  await put("public.specialist_sandbox_preparation_events",{
   tutor_assignment_id:assignment,tutor_id:tutor,trajectory_id:tr.id,student_id:tr.student,
   session_number:n,topic_key:topic,bank_version:1,phase,set_id:sets[0].setId,
   event_form_id:"ci-prepared-form",condition_contract_sha256:createHash("sha256").update(JSON.stringify(sets[0].constraints)).digest("hex"),
   problem_prepared:true,conditions_reviewed:true,evidence_plan_reviewed:true,recorded_at:stamp(),
  });
 }
 let repIndex=0;
 for(const set of sets)for(let rep=1;rep<=set.reps;rep++){
  repIndex++;
  const id=tr.id+"-s"+n+"-"+set.setId+"-"+rep;
  let klass="conditional",pattern=3;
  if(tr.profile==="quietly_strong"){klass="supported";pattern=1;}
  if(tr.profile==="fast_recovery"){klass=repIndex%2?"breakdown":"recovery";pattern=repIndex%2?3:2;}
  if(tr.profile==="uneven_performer"){klass=repIndex%2?"supported":"conditional";pattern=repIndex%2?1:3;}
  await put("public.specialist_sandbox_rep_events",{
   id,tutor_assignment_id:assignment,tutor_id:tutor,trajectory_id:tr.id,student_id:tr.student,
   session_number:n,phase,topic_key:topic,set_id:set.setId,rep_number:rep,outcome_ref:"ref-"+id,
   student_behavior:"Explicit synthetic integration observation",condition_kept:true,observation_exact:true,evidence_exact:true,completed_at:stamp(),
  });
  await put("private.specialist_sandbox_rep_event_truth",{
   event_id:id,outcome_ref:"ref-"+id,outcome_key:phase+"."+set.setId+".pattern_"+pattern,
   outcome_version:1,trajectory_class:klass,canonical_observations:{synthetic:"observed"},
   canonical_prerequisite_sentinel:"held",canonical_inherited_rescue_signal:"none",bank_version:1,
  });
 }
 const id=tr.id+"-evaluation-"+n;
 await put("public.specialist_sandbox_session_evaluations",{
  id,tutor_assignment_id:assignment,tutor_id:tutor,trajectory_id:tr.id,student_id:tr.student,
  session_number:n,phase,topic_key:topic,authority_aligned:true,state_track_aligned:true,
  student_breakdown_recovery_observed:development,state_change_observed:development,
  specialist_authority:{route:"normal_training"},completed_at:stamp(),
 });
 await put("private.specialist_sandbox_session_truth",{session_evaluation_id:id,canonical_authority:{route:"normal_training"}});
 await put("public.session_billing_events",{
  session_id:"booking-"+id,metadata:{trajectory_id:tr.id,sandbox_session_number:n},
  actor_id:tutor,is_sandbox:true,event_type:"sandbox_training_completed",created_at:stamp(),
 });
}
async function project(){
 const loaded=await loadSandboxQualificationEvidence({tutorAssignmentId:assignment,tutorId:tutor},db);
 assert.deepEqual(loaded.sourceGaps,[]);
 return {loaded,status:evaluateSandboxQualification(loaded.events,{activated:true})};
}
async function negative(label:string,sql:string,check:(v:Awaited<ReturnType<typeof project>>)=>void){
 await db.query("SAVEPOINT negative_case");
 try {await db.query(sql);check(await project());console.log("JOURNEY_NEGATIVE_"+label+"=PASS");}
 finally {await db.query("ROLLBACK TO SAVEPOINT negative_case");await db.query("RELEASE SAVEPOINT negative_case");}
}
try{
 // Roles already exist from the earlier isolated schema-contract step.
 await db.query(ddl.replace("CREATE ROLE anon NOLOGIN;","").replace("CREATE ROLE authenticated NOLOGIN;",""));
 for(const [table,columns]of tables)await db.query("CREATE TABLE "+table+" ("+columns+")");
 await db.query(readFileSync(new URL("../docs/migration-proposals/20261015_sandbox_coverage_crossmode_evidence.sql",import.meta.url),"utf8"));
 await put("public.users",{id:tutor});await put("public.users",{id:td});
 await put("public.pods",{id:"ci-pod",td_id:td});
 await put("public.tutor_assignments",{id:assignment,tutor_id:tutor,pod_id:"ci-pod",operational_mode:"sandbox",created_at:stamp()});
 for(let index=0;index<fixtureProfiles.length;index++){
  const profile=fixtureProfiles[index];
  let seed="";
  for(let i=0;i<1000;i++)if(resolveSandboxBehaviorProfile("ci-seed-"+i)===profile){seed="ci-seed-"+i;break;}
  assert.ok(seed);
  const tr={id:"ci-trajectory-"+index,student:"ci-student-"+index,profile};trajectories.push(tr);
  await put("public.specialist_sandbox_trajectories",{id:tr.id,tutor_assignment_id:assignment,tutor_id:tutor,student_id:tr.student,bank_version:1,bank_key:"sandbox_stateful_environment"});
  await put("private.specialist_sandbox_trajectory_truth",{trajectory_id:tr.id,trajectory_seed:seed});
 }
 const developmentPhases=["Clarity","Structured Execution","Time Pressure Stability","Controlled Discomfort","Structured Execution","Clarity"];
 for(let i=0;i<trajectories.length;i++)await session(trajectories[i],developmentPhases[i],1,true);
 // A second clean linked development lesson supplies actual temporal continuity.
 await session(trajectories[0],"Clarity",2,true);
 const native=trajectories[0];
 const dimension=Object.keys(DIAGNOSIS_OBSERVATION_MATRIX).find(k=>DIAGNOSIS_OBSERVATION_MATRIX[k as keyof typeof DIAGNOSIS_OBSERVATION_MATRIX].phase==="Clarity")!;
 const def=DIAGNOSIS_OBSERVATION_MATRIX[dimension as keyof typeof DIAGNOSIS_OBSERVATION_MATRIX];
 const choice=def.options[0];
 const observations=[{dimensionId:dimension,behaviorId:choice.id}];
 for(const scope of ["diagnosis","handover"]){
  const source="ci-native-"+scope;
  if(scope==="diagnosis")await put("public.response_integrity_diagnosis_runs",{
   id:source,tutor_id:tutor,student_id:native.student,status:"completed",session_context:"intro",
   probe_history:[{probeId:"clarity.recognition",observations,supportEvent:"none"}],
  });
  else await put("public.scheduled_sessions",{id:source,tutor_id:tutor,student_id:native.student,type:"handover",status:"completed"});
  const id="ci-cross-"+scope;
  await put("public.specialist_sandbox_live_evidence_turns",{
   id,tutor_assignment_id:assignment,tutor_id:tutor,trajectory_id:native.id,student_id:native.student,
   scope,source_context_id:source,form_id:"form-"+scope,sequence_number:1,phase:"Clarity",
   probe_id:"clarity.recognition",bank_version:1,behavior_model_version:2,
   student_behavior:"Explicit synthetic native-source fixture",specialist_submission:{supportEvent:"none",observations},
   condition_conformed:true,observation_exact:true,matching_observations:1,total_observations:1,completed_at:stamp(),
  });
  await put("private.specialist_sandbox_live_evidence_truth",{
   event_id:id,outcome_ref:"ci-ref-"+scope,outcome_key:"ci."+scope+".pattern_3",outcome_version:1,
   canonical_observations:observations,trajectory_class:"conditional",actual_support_event:"none",
  });
  if(scope==="handover")await put("public.intro_session_drills",{
   id:"ci-native-handover-drill",tutor_id:tutor,student_id:native.student,scheduled_session_id:source,
   drill:{drillType:"handover_verification",handoverMode:"verification",phase:"Clarity",
    sets:[{observations:[{observation_dimension_id:dimension,observation_option_id:choice.id,observation:choice.label}]}]},
   submitted_at:stamp(),
  });
 }
 for(let i=1;i<=2;i++){
  const id="ci-rediagnosis-"+i;
  const decision={complete:true,placementPhase:"Clarity",stability:"Low"};
  await put("public.specialist_sandbox_rediagnosis_runs",{id,status:"completed",specialist_decision:decision});
  await put("private.specialist_sandbox_rediagnosis_truth",{rediagnosis_run_id:id,canonical_decision:decision});
  await put("public.specialist_sandbox_rediagnosis_turns",{
   id,tutor_assignment_id:assignment,tutor_id:tutor,trajectory_id:native.id,student_id:native.student,
   rediagnosis_run_id:id,phase:"Clarity",probe_id:"clarity.recognition",
   student_behavior:"Explicit synthetic targeted re-diagnosis fixture",condition_conformed:true,observation_exact:true,authority_aligned:true,completed_at:stamp(),
  });
  await put("private.specialist_sandbox_rediagnosis_turn_truth",{
   rediagnosis_turn_id:id,outcome_key:"ci.rediagnosis.pattern_"+i,outcome_version:1,
   trajectory_class:"conditional",canonical_observations:observations,
  });
 }
 const development=await project();
 assert.equal(development.status.developmentCoverageReady,true,JSON.stringify(development.status.requirements.filter(r=>!r.met)));
 assert.equal(development.status.qualificationReady,false);
 console.log("JOURNEY_PERSISTED_DEVELOPMENT_COVERAGE=PASS");
 const finalTrajectories=[trajectories[0],trajectories[1],trajectories[3],trajectories[2]];
 for(let p=0;p<phases.length;p++)for(let n=0;n<2;n++)await session(finalTrajectories[p],phases[p],(p===0?3:2)+n);
 const qualified=await project();
 assert.equal(qualified.status.qualificationReady,true,JSON.stringify(qualified.status));
 assert.equal(qualified.status.qualifyingSessions,8);
 for(const phase of phases)assert.equal(qualified.status.phaseCounts[phase],2);
 assert.equal(evaluateSandboxQualification(qualified.loaded.events,{activated:false}).qualificationReady,false);
 console.log("JOURNEY_PERSISTED_EIGHT_CLEAN_PHASE_BALANCED=PASS");
 await db.query("BEGIN");
 try {
  await db.query("UPDATE public.specialist_sandbox_rediagnosis_runs SET status='blocked',specialist_decision='{\"complete\":false}'::jsonb WHERE id='ci-rediagnosis-1'");
  await db.query("UPDATE private.specialist_sandbox_rediagnosis_truth SET canonical_decision='{\"complete\":false}'::jsonb WHERE rediagnosis_run_id='ci-rediagnosis-1'");
  const pending=await project();
  assert.equal(pending.status.qualificationReady,false);
  assert.equal(pending.status.pendingPlacements,1);
  assert.deepEqual(pending.status.technicalBlockers,[]);
 } finally { await db.query("ROLLBACK"); }
 assert.equal((await project()).status.qualificationReady,true);
 console.log("JOURNEY_PENDING_PLACEMENT_SEPARATE_FROM_INVALID_EVIDENCE=PASS");

 // Live native storage also JSON-encodes the drill inside its JSONB column.
 // The completed source join must accept it without changing stored history.
 await db.query("BEGIN");
 await db.query("UPDATE public.intro_session_drills SET drill=to_jsonb(drill::text)");
 const nativeString = await project();
 assert.equal(nativeString.status.qualificationReady,true);
 console.log("JOURNEY_NATIVE_JSON_STRING_HANDOVER_SOURCE=PASS");
 await db.query("ROLLBACK");

 await db.query("BEGIN");
 await negative("MISSING_CANONICAL_TRUTH","DELETE FROM private.specialist_sandbox_rep_event_truth WHERE event_id=(SELECT id FROM public.specialist_sandbox_rep_events ORDER BY completed_at DESC LIMIT 1)",r=>{
  assert.equal(r.status.qualificationReady,false);assert.ok(r.status.technicalBlockers.length);
 });
 await negative("CROSS_STUDENT_ERROR_RESET","UPDATE public.specialist_sandbox_rep_events SET observation_exact=false WHERE id=(SELECT id FROM public.specialist_sandbox_rep_events WHERE trajectory_id='ci-trajectory-1' ORDER BY completed_at DESC LIMIT 1)",r=>{
  assert.equal(r.status.qualificationReady,false);assert.ok(r.status.materialErrorsSinceCoverage>0);assert.ok(r.status.qualifyingSessions<8);
 });
 await negative("INCOMPLETE_NATIVE_DIAGNOSIS","UPDATE public.response_integrity_diagnosis_runs SET status='active'",r=>{
  assert.equal(r.status.developmentCoverageReady,false);assert.equal(r.status.qualificationReady,false);
 });
 await negative("MISMATCHED_NATIVE_HANDOVER","UPDATE public.intro_session_drills SET drill=jsonb_set(drill,'{sets,0,observations,0,observation}',to_jsonb('wrong'::text))",r=>{
  assert.equal(r.status.developmentCoverageReady,false);assert.equal(r.status.qualificationReady,false);
 });
 await negative("PREPARATION_LINEAGE","UPDATE public.specialist_sandbox_preparation_events SET condition_contract_sha256=repeat('0',64)",r=>{
  assert.equal(r.status.qualificationReady,false);assert.ok(r.status.technicalBlockers.length);
 });
 await negative("MISSING_OBSERVED_PROFILE","UPDATE private.specialist_sandbox_trajectory_truth SET trajectory_seed=(SELECT trajectory_seed FROM private.specialist_sandbox_trajectory_truth WHERE trajectory_id='ci-trajectory-5') WHERE trajectory_id='ci-trajectory-1'",r=>{
  assert.equal(r.status.developmentCoverageReady,false);assert.equal(r.status.qualificationReady,false);
 });
 await db.query("ROLLBACK");
 // Execute the real TD route against PostgreSQL, with only request/response transport faked.
 for(const [role,userId,expected]of [["td",td,200],["td","ci-former-td",403],["tutor",tutor,403],["",null,401]] as const){
  let code=200,payload:any;
  const res:any={status(n:number){code=n;return this},json(value:any){payload=value;return this},setHeader(){}};
  await createTdSandboxQualificationReview(db)({dbUser:userId?{id:userId,role}:null,params:{tutorId:tutor}} as any,res);
  assert.equal(code,expected);
  if(expected===200){
   assert.equal(payload.tutorAssignmentId,assignment);
   assert.ok(payload.evidence.length);
   assert.equal(payload.qualification.qualificationReady,false,"Runtime activation remains default-off");
   assert.ok(!JSON.stringify(payload).includes("canonical_observations"));
  }
 }
 console.log("JOURNEY_POSTGRES_TD_SCOPE_AND_DEFAULT_OFF=PASS");
 // Persisted TD approval consumption: no real TD decisions or stage changes.
 const readiness=async()=>{
  const {loaded,status}=await project();
  return {
   practicalsReady:status.qualificationReady,policyStatus:"approved",policyVersion:1,
   bankKey:"sandbox_stateful_environment",bankVersion:1,
   qualification:{policyId:status.policyId,policyVersion:status.policyVersion,
    qualificationReady:status.qualificationReady,
    evidenceFingerprint:sandboxQualificationEvidenceFingerprint(status.policyId,status.policyVersion,loaded.events)},
  };
 };
 const entry=()=>loadPracticalEntryStatus(db,readiness,assignment,tutor);
 const approve=async(id:string,assessor=td,decision="passed",snapshot:any=null)=>{
  await put("public.tutor_sandbox_mock_assessments",{
   id,tutor_id:tutor,tutor_assignment_id:assignment,assessed_by_user_id:assessor,decision,
   checklist:{assessment_version:2,assessment_owner:"td",next_stage:"practicals",
    capability_snapshot:snapshot||await readiness()},assessed_at:stamp(),
  });
 };
 assert.equal((await entry()).ready,false,"No approval never grants entry");
 await approve("ci-former-only","ci-former-td");
 assert.equal((await entry()).ready,false,"Former TD cannot authorize entry");
 await approve("ci-assigned");
 assert.equal((await entry()).ready,true,"Assigned TD may approve current qualified synthetic evidence");
 await approve("ci-former-newer","ci-former-td","remediation");
 assert.equal((await entry()).signoffId,"ci-assigned","Newer former-TD row is not assigned authority");
 assert.equal((await entry()).ready,true);
 await assert.rejects(loadPracticalEntryStatus(db,readiness,assignment,"ci-other-specialist"),{status:403});
 await db.query("UPDATE pods SET td_id='ci-replacement-td' WHERE id='ci-pod'");
 assert.equal((await entry()).ready,false,"TD reassignment invalidates prior authority");
 await db.query("UPDATE pods SET td_id=$1 WHERE id='ci-pod'",[td]);
 const signedFingerprint=(await readiness()).qualification.evidenceFingerprint;
 await session(trajectories[0],"Clarity",9);
 const extended=await readiness();
 assert.equal(extended.practicalsReady,true,"The new clean evidence itself still qualifies");
 assert.notEqual(extended.qualification.evidenceFingerprint,signedFingerprint);
 const stale=await entry();
 assert.equal(stale.ready,false,"Changed persisted evidence invalidates approval even while qualified");
 assert.ok(stale.blockers.some(b=>b.includes("fingerprint")));
 await approve("ci-refreshed");
 assert.equal((await entry()).ready,true);
 await approve("ci-remediation",td,"remediation");
 assert.equal((await entry()).ready,false,"Latest assigned TD remediation supersedes a pass");
 await approve("ci-wrong-bank",td,"passed",{...await readiness(),bankVersion:2});
 assert.equal((await entry()).ready,false,"Approval for another bank cannot grant entry");
 await approve("ci-last-current");
 assert.equal((await entry()).ready,true);
 await db.query("UPDATE public.specialist_sandbox_rep_events SET observation_exact=false WHERE id=(SELECT id FROM public.specialist_sandbox_rep_events ORDER BY completed_at DESC LIMIT 1)");
 assert.equal((await entry()).ready,false,"A later material error invalidates prior approval");
 assert.equal((await db.query("SELECT count(*)::int AS n FROM tutor_sandbox_mock_assessments")).rows[0].n,7,"History is preserved");
 assert.equal((await db.query("SELECT operational_mode FROM tutor_assignments WHERE id=$1",[assignment])).rows[0].operational_mode,"sandbox","The test never promotes an assignment");
 console.log("JOURNEY_POSTGRES_EVIDENCE_BOUND_TD_APPROVAL=PASS");
 console.log("JOURNEY_POSTGRES_STALE_APPROVAL_AND_REASSIGNMENT_DENIAL=PASS");

 // Real PostgreSQL UUID/text binding regression for both native launch paths.
 // Roll back the temporary contract table; all synthetic journey history stays intact.
 await db.query("BEGIN");
 try {
  await db.query("ALTER TABLE public.scheduled_sessions RENAME TO scheduled_sessions_journey_fixture");
  await db.query("CREATE TABLE public.scheduled_sessions (id uuid PRIMARY KEY,tutor_id uuid,student_id uuid,type text,status text,scheduled_time timestamp,created_at timestamp)");
  const identities={tutorId:"11111111-1111-4111-8111-111111111111",studentId:"22222222-2222-4222-8222-222222222222",scheduledSessionId:"33333333-3333-4333-8333-333333333333",requestedKind:"training" as const};
  await db.query("INSERT INTO public.scheduled_sessions VALUES ($1,$2,$3,'training','confirmed',now(),now())",[identities.scheduledSessionId,identities.tutorId,identities.studentId]);
  for(const scheduledSessionId of [identities.scheduledSessionId,null]) {
   const query=diagnosisScheduledSessionQuery({...identities,scheduledSessionId});
   const rows=await db.query(query.text,query.values);
   assert.equal(rows.rows[0]?.id,identities.scheduledSessionId);
   const denied=diagnosisScheduledSessionQuery({...identities,scheduledSessionId,tutorId:"44444444-4444-4444-8444-444444444444"});
   assert.equal((await db.query(denied.text,denied.values)).rows.length,0);
  }
  const nextId="55555555-5555-4555-8555-555555555555";
  await db.query("INSERT INTO public.scheduled_sessions VALUES ($1,$2,$3,'training','confirmed',now()+interval '1 day',now())",[nextId,identities.tutorId,identities.studentId]);
  const paused={...evaluateEvidenceCompleteDiagnosis(createEvidenceCompleteDiagnosisState("Clarity")),nextProbeId:null,
    continuation:{nextProbeId:"clarity.recognition" as const,parentMessage:"Next session checks recognition."}};
  const continuation={tutorId:identities.tutorId,studentId:identities.studentId,scheduledSessionId:nextId,
    context:{legacyPrefixLength:0,sessions:[{scheduledSessionId:identities.scheduledSessionId,startProbeIndex:0}]},historyLength:2,decision:paused};
  const continued=await authorizeDiagnosisContinuation(continuation,db);
  assert.equal(continued.sessions[1].scheduledSessionId,nextId);
  assert.equal(continued.sessions[1].startProbeIndex,2);
  await assert.rejects(authorizeDiagnosisContinuation({...continuation,scheduledSessionId:identities.scheduledSessionId},db),/cannot be reset/);
  await assert.rejects(authorizeDiagnosisContinuation({...continuation,tutorId:"44444444-4444-4444-8444-444444444444"},db),/later confirmed lesson/);
  await db.query("UPDATE public.scheduled_sessions SET status='cancelled' WHERE id=$1",[nextId]);
  await assert.rejects(authorizeDiagnosisContinuation(continuation,db),/later confirmed lesson/);
 } finally { await db.query("ROLLBACK"); }
 console.log("NATIVE_DIAGNOSIS_SCHEDULED_UUID_BINDINGS_AND_OWNERSHIP=PASS");
 console.log("DIAGNOSIS_CONTINUATION_UUID_BINDING_AND_OWNERSHIP=PASS");
 console.log("SYNTHETIC_POSTGRES_QUALIFICATION_PIPELINE=PASS");
 console.log("LIVE_NATIVE_JOURNEY_ACCEPTANCE=NOT_RUN");
}finally{await db.end();}
