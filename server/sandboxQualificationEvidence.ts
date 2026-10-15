/** Read-only, privileged historical Sandbox evidence projection.
 * This module never updates a simulated or real student's state and must not
 * be called from public/Specialist endpoints with raw canonical answers. */
import { getDrillSchemaDefinitionByVersion } from "@shared/responseIntegrityDrillRegistry";
import { resolveSandboxBehaviorProfile, sandboxBehaviorObservableSignatureMultiplier } from "@shared/sandboxBehaviorProfiles";
import type { SandboxTrajectoryClass } from "@shared/sandboxEnvironment";
import type { TopicPhase } from "@shared/topicConditioningEngine";
import type { SandboxQualificationEvidence as Event } from "@shared/sandboxQualificationPolicy";

type Queryable={query:(sql:string,values?:any[])=>Promise<{rows:any[]}>};
const TRAINING_REPS=[
 "SELECT r.*, t.outcome_key,t.outcome_version,t.outcome_ref AS truth_outcome_ref,",
 "t.trajectory_class,t.canonical_observations,t.canonical_prerequisite_sentinel,",
 "t.canonical_inherited_rescue_signal,t.bank_version AS truth_bank_version,",
 "trajectory.bank_version, trajectory.bank_key, hidden.trajectory_seed",
 "FROM public.specialist_sandbox_rep_events r",
 "JOIN public.specialist_sandbox_trajectories trajectory ON trajectory.id=r.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_trajectory_truth hidden ON hidden.trajectory_id=r.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_rep_event_truth t ON t.event_id=r.id",
 "WHERE r.tutor_assignment_id=$1 AND r.tutor_id=$2",
 "ORDER BY r.completed_at ASC,r.id ASC LIMIT 5000",
].join(" ");
const SESSIONS=[
 "SELECT s.*, t.canonical_authority, tr.bank_version,tr.bank_key,",
 "hidden.trajectory_seed FROM public.specialist_sandbox_session_evaluations s",
 "JOIN public.specialist_sandbox_trajectories tr ON tr.id=s.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_session_truth t ON t.session_evaluation_id=s.id",
 "LEFT JOIN private.specialist_sandbox_trajectory_truth hidden ON hidden.trajectory_id=s.trajectory_id",
 "WHERE s.tutor_assignment_id=$1 AND s.tutor_id=$2",
 "ORDER BY s.completed_at ASC,s.id ASC LIMIT 1000",
].join(" ");
const REDIAGNOSIS=[
 "SELECT r.*,t.outcome_key,t.outcome_version,t.trajectory_class,t.canonical_observations,",
 "tr.bank_version,tr.bank_key,hidden.trajectory_seed",
 "FROM public.specialist_sandbox_rediagnosis_turns r",
 "JOIN public.specialist_sandbox_trajectories tr ON tr.id=r.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_trajectory_truth hidden ON hidden.trajectory_id=r.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_rediagnosis_turn_truth t ON t.rediagnosis_turn_id=r.id",
 "WHERE r.tutor_assignment_id=$1 AND r.tutor_id=$2",
 "ORDER BY r.completed_at ASC,r.id ASC LIMIT 5000",
].join(" ");
const CROSS_MODE=[
 "SELECT r.*,t.outcome_key,t.outcome_version,t.trajectory_class,t.canonical_observations,",
 "tr.bank_key,hidden.trajectory_seed,",
 "CASE WHEN r.scope='diagnosis' AND EXISTS (",
 "  SELECT 1 FROM public.response_integrity_diagnosis_runs native_run",
 "  WHERE native_run.id::text=r.source_context_id",
 "    AND native_run.tutor_id::text=r.tutor_id::text",
 "    AND native_run.student_id::text=r.student_id::text",
 "    AND native_run.status='completed'",
 "    AND native_run.session_context IN ('intro','active_training')",
 "    AND EXISTS (SELECT 1 FROM jsonb_array_elements(native_run.probe_history) native_probe",
 "      WHERE native_probe->>'probeId'=r.probe_id",
 "      AND native_probe->'observations'=r.specialist_submission->'observations'",
 "      AND COALESCE(native_probe->>'supportEvent','none')=r.specialist_submission->>'supportEvent')",
 ") THEN true ELSE false END AS native_proof_verified,",
 "FROM public.specialist_sandbox_live_evidence_turns r",
 "JOIN public.specialist_sandbox_trajectories tr ON tr.id=r.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_trajectory_truth hidden ON hidden.trajectory_id=r.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_live_evidence_truth t ON t.event_id=r.id",
 "WHERE r.tutor_assignment_id=$1 AND r.tutor_id=$2",
 "ORDER BY r.completed_at ASC,r.id ASC LIMIT 5000",
].join(" ");
const BILLING=[
 "SELECT e.metadata->>'trajectory_id' AS trajectory_id,",
 "(e.metadata->>'sandbox_session_number') AS session_number,",
 "e.session_id,e.created_at",
 "FROM public.session_billing_events e",
 "WHERE e.is_sandbox=true AND e.event_type='sandbox_training_completed' AND e.actor_id=$1",
 "AND e.metadata->>'trajectory_id' IS NOT NULL ORDER BY e.created_at ASC LIMIT 5000",
].join(" ");

const profile=(seed:any)=>seed?resolveSandboxBehaviorProfile(String(seed)):null;
const base=(r:any,mode:Event["mode"],kind:Event["kind"]):Event=>({
 id:String(r.id),occurredAt:new Date(r.completed_at).toISOString(),kind,mode,
 studentId:String(r.student_id||""),trajectoryId:String(r.trajectory_id||""),
 phase:String(r.phase||""),profile:profile(r.trajectory_seed),
 situationTags:[],opportunityKey:String(r.id),observed:false,
 complete:false,canonicalPresent:false,conditionKept:false,
 observationExact:false,evidenceExact:false,authorityAligned:false,stateAligned:false,
 materialError:false,technicallyValid:false,sourceId:String(r.id),
 sourceType:kind,bankVersion:Number(r.bank_version)||null,
 outcomeVersion:Number(r.outcome_version)||null,
});
const tags=(r:any)=>{
 const out:string[]=[];
 const outcome=String(r.trajectory_class||"");
 if(["conditional","breakdown","recovery"].includes(outcome))out.push(outcome);
 if(String(r.set_id||"").includes("independent_execution"))out.push("independent_execution");
 if(String(r.phase||"")==="Time Pressure Stability")out.push("timed_pressure");
 if(r.canonical_prerequisite_sentinel!=null)out.push("prerequisite");
 return out;
};
const planKeys=(phase:string,bankVersion:number)=>{
 if(bankVersion!==1)return null; // No implicit historical contract for other bank versions.
 const schema=getDrillSchemaDefinitionByVersion("training",phase as TopicPhase,1);
 if(!schema)return null;
 return schema.sets.filter(set=>!set.modelingOnly).flatMap(set=>
  Array.from({length:set.reps},(_,i)=>set.setId+"::"+(i+1)));
};
export async function loadSandboxQualificationEvidence(
 input:{tutorAssignmentId:string;tutorId:string},db?:Queryable,
):Promise<{events:Event[];sourceGaps:string[]}>{
 const sourceDb=db ?? (await import("./db")).pool;
 const params=[input.tutorAssignmentId,input.tutorId];
 const [repResult,sessionResult,rediagnosisResult,billingResult]=await Promise.all([
  sourceDb.query(TRAINING_REPS,params),sourceDb.query(SESSIONS,params),
  sourceDb.query(REDIAGNOSIS,params),sourceDb.query(BILLING,[input.tutorId]),
 ]);
 const sourceGaps:string[]=[];
 if([repResult,sessionResult,rediagnosisResult,billingResult].some(x=>x.rows.length>=5000))
  sourceGaps.push("Historical evidence result exceeded safe projection limit.");
 const lastOutcomeByTrajectory=new Map<string,SandboxTrajectoryClass>();
 const reps=repResult.rows.map(r=>{
  const item=base(r,"training","opportunity");
  const truth=!!r.canonical_observations&&!!r.trajectory_seed&&
   r.truth_outcome_ref===r.outcome_ref&&Number(r.truth_bank_version)===Number(r.bank_version);
  const observed=!!String(r.student_behavior||"").trim();
  const valid=truth&&observed&&!!planKeys(String(r.phase),Number(r.bank_version))?.includes(String(r.set_id)+"::"+String(r.rep_number));
  item.opportunityKey=[r.bank_key,r.bank_version,r.phase,r.set_id,r.rep_number,r.outcome_key,r.outcome_version].join(":");
  item.observed=observed;item.canonicalPresent=truth;item.technicallyValid=valid;item.complete=valid;
  item.conditionKept=r.condition_kept===true;item.observationExact=r.observation_exact===true;
  item.evidenceExact=r.evidence_exact===true;item.authorityAligned=true;item.stateAligned=true;
  item.materialError=valid&&!(item.conditionKept&&item.observationExact&&item.evidenceExact);
  item.situationTags=tags(r);
  const previousClass=lastOutcomeByTrajectory.get(String(r.trajectory_id))||null;
  const trajectoryClass=String(r.trajectory_class||"") as SandboxTrajectoryClass;
  if (item.technicallyValid && r.trajectory_seed && trajectoryClass) {
    const observableBias=sandboxBehaviorObservableSignatureMultiplier({
      seed:String(r.trajectory_seed),phase:String(r.phase) as TopicPhase,
      trajectoryClass,previousTrajectoryClass:previousClass,outcomeKey:String(r.outcome_key||""),
    });
    const uneven=profile(r.trajectory_seed)==="uneven_performer" &&
      ((previousClass==="supported" && ["near_stable","conditional"].includes(trajectoryClass)) ||
       (previousClass==="conditional" && trajectoryClass==="supported"));
    const strong=profile(r.trajectory_seed)!=="quietly_strong" ||
      trajectoryClass==="supported" || trajectoryClass==="near_stable";
    if ((observableBias>1 || uneven) && strong)
      item.situationTags.push("profile_signature");
    lastOutcomeByTrajectory.set(String(r.trajectory_id),trajectoryClass);
  }
  return item;
 });
 const bySession=new Map<string,Event[]>();
 for(const r of reps){
  // Rep source ID -> original persisted record to disambiguate topic and student.
  const raw=repResult.rows.find(x=>String(x.id)===r.id);
  const key=[r.trajectoryId,raw.session_number,String(raw.topic_key||"")].join(":");
  bySession.set(key,[...(bySession.get(key)||[]),r]);
 }
 const sessions=sessionResult.rows.map(r=>{
  const item=base(r,"training","session");
  const rows=bySession.get([r.trajectory_id,r.session_number,String(r.topic_key||"")].join(":"))||[];
  const expected=planKeys(String(r.phase),Number(r.bank_version));
  const actual=rows.map(row=>{
   const raw=repResult.rows.find(x=>String(x.id)===row.id);
   return String(raw?.set_id)+"::"+String(raw?.rep_number);
  });
  const exactPlan=!!expected&&actual.length===expected.length&&
   new Set(actual).size===expected.length&&expected.every(key=>actual.includes(key));
  const truth=!!r.canonical_authority&&!!r.trajectory_seed;
  item.observed=true;item.canonicalPresent=truth;item.technicallyValid=!!exactPlan&&truth;
  item.complete=!!exactPlan&&truth&&rows.every(x=>x.complete);
  item.conditionKept=rows.length>0&&rows.every(x=>x.conditionKept);
  item.observationExact=rows.length>0&&rows.every(x=>x.observationExact);
  item.evidenceExact=rows.length>0&&rows.every(x=>x.evidenceExact);
  item.authorityAligned=r.authority_aligned===true;item.stateAligned=r.state_track_aligned===true;
  item.materialError=item.technicallyValid&&!(item.conditionKept&&item.observationExact&&
    item.evidenceExact&&item.authorityAligned&&item.stateAligned);
  item.situationTags=[
    ...(r.student_breakdown_recovery_observed?["recovery"]:[]),
    ...(r.state_change_observed?["state_change"]:[]),
    ...((r.specialist_authority?.route&&r.specialist_authority.route!=="normal_training")?["routing"]:[]),
  ];
  item.opportunityKey=[r.trajectory_id,r.session_number,r.topic_key||""].join(":");
  return item;
 });
 const rediagnoses=rediagnosisResult.rows.map(r=>{
  const item=base(r,"targeted_rediagnosis","opportunity");
  const truth=!!r.canonical_observations&&!!r.trajectory_seed;
  item.observed=!!String(r.student_behavior||"").trim();item.canonicalPresent=truth;
  item.technicallyValid=truth&&item.observed;item.complete=item.technicallyValid;
  item.conditionKept=r.condition_conformed===true;item.observationExact=r.observation_exact===true;
  item.evidenceExact=item.observationExact;item.authorityAligned=r.authority_aligned===true;
  item.stateAligned=item.authorityAligned;
  item.materialError=item.technicallyValid&&!(item.conditionKept&&item.observationExact&&item.authorityAligned);
  item.opportunityKey=[r.bank_key,r.bank_version,r.probe_id,r.outcome_key,r.outcome_version].join(":");
  item.situationTags=[...tags(r),"routing"];return item;
 });
 let cross:any[]=[];
 try { cross=(await sourceDb.query(CROSS_MODE,params)).rows; }
 catch(error:any){
  if(error?.code==="42P01"||String(error?.message||"").includes("specialist_sandbox_live_evidence_turns"))
    sourceGaps.push("Protected Diagnosis/Handover evidence schema not applied.");
  else throw error;
 }
 const crossEvents=cross.map(r=>{
  const item=base(r,r.scope==="handover"?"handover":"diagnosis","opportunity");
  const truth=!!r.canonical_observations&&!!r.trajectory_seed;
  item.observed=!!String(r.student_behavior||"").trim();item.canonicalPresent=truth;
  item.technicallyValid=truth&&item.observed;
  // Cross-mode simulated selection is NOT proof of native-mode authority.
  // Only an independently persisted native completed Diagnosis run may verify
  // Diagnosis. A Handover simulation is not Handover completion authority.
  const nativeVerified=r.scope==="diagnosis"&&r.native_proof_verified===true;
  item.complete=item.technicallyValid&&nativeVerified;
  item.conditionKept=r.condition_conformed===true;item.observationExact=r.observation_exact===true;
  item.evidenceExact=item.observationExact;item.authorityAligned=nativeVerified;
  item.stateAligned=item.authorityAligned;
  item.materialError=item.technicallyValid&&(!item.conditionKept||!item.observationExact);
  item.opportunityKey=[r.scope,r.bank_version,r.probe_id,r.outcome_key,r.outcome_version].join(":");
  item.situationTags=tags(r);return item;
 });
 const billing=billingResult.rows;
 const closure:Event[]=[];const continuity:Event[]=[];
 for(const session of sessions){
  const raw=sessionResult.rows.find(r=>String(r.id)===session.id);
  const linked=billing.find(r=>String(r.trajectory_id)===session.trajectoryId&&
     Number(r.session_number)===Number(raw.session_number));
  if(linked){
   closure.push({...session,id:"closure:"+session.id,kind:"opportunity",mode:"session_closure",
      opportunityKey:"closure:"+String(linked.session_id),sourceType:"scheduled_session",
      sourceId:String(linked.session_id),observed:true});
  }
  const previous=sessionResult.rows.find(r=>r.trajectory_id===raw.trajectory_id&&
      Number(r.session_number)===Number(raw.session_number)-1);
  if(previous){
   continuity.push({...session,id:"continuity:"+session.id,kind:"opportunity",mode:"continuity",
      opportunityKey:"continuity:"+session.id,sourceType:"session_transition",observed:true,
      sourceId:session.id});
  }
 }
 return {events:[...reps,...sessions,...rediagnoses,...crossEvents,...closure,...continuity],sourceGaps};
}
