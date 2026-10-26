/** Read-only, privileged historical Sandbox evidence projection.
 * This module never updates a simulated or real student's state and must not
 * be called from public/Specialist endpoints with raw canonical answers. */
import { createHash } from "crypto";
import { getDrillSchemaDefinitionByVersion } from "@shared/responseIntegrityDrillRegistry";
import { resolveSandboxBehaviorProfile, sandboxBehaviorObservableSignatureMultiplier } from "@shared/sandboxBehaviorProfiles";
import type { SandboxTrajectoryClass } from "@shared/sandboxEnvironment";
import type { TopicPhase } from "@shared/topicConditioningEngine";
import type { SandboxQualificationEvidence as Event } from "@shared/sandboxQualificationPolicy";
import { DIAGNOSIS_OBSERVATION_MATRIX, type DiagnosisDimensionId } from "@shared/diagnosisObservationMatrix";
import { SANDBOX_NATIVE_DRILL_PAYLOAD_SQL } from "./sandboxNativeDrillPayload";

type Queryable={query:(sql:string,values?:any[])=>Promise<{rows:any[]}>};

export function nativeHandoverRepMatches(sets: unknown, submitted: unknown, repNumber: number): boolean {
  if (!Array.isArray(sets) || sets.length !== 1 || !Number.isInteger(repNumber) ||
      repNumber < 1 || !submitted || typeof submitted !== "object") return false;
  const reps = sets[0]?.observations;
  const native = Array.isArray(reps) ? reps[repNumber - 1] : null;
  if (!native || typeof native !== "object" || Array.isArray(native)) return false;
  const observations = (submitted as any).observations;
  if (!Array.isArray(observations) || !observations.length ||
      (submitted as any).supportEvent !== "none") return false;
  const dimensions = Object.keys(native).filter(key => key.endsWith("_dimension_id"));
  if (dimensions.length !== observations.length) return false;
  const used = new Set<string>();
  for (const observed of observations) {
    const dimensionId = String(observed?.dimensionId || "");
    const definition = DIAGNOSIS_OBSERVATION_MATRIX[dimensionId as DiagnosisDimensionId];
    const option = definition?.options.find(o => o.id === observed?.behaviorId);
    if (!option || used.has(dimensionId)) return false;
    const matchingKeys = dimensions.filter(key => native[key] === dimensionId);
    if (matchingKeys.length !== 1) return false;
    const base = matchingKeys[0].slice(0, -"_dimension_id".length);
    if (!String(native[base + "_option_id"] || "").trim() ||
        native[base] !== option.label) return false;
    used.add(dimensionId);
  }
  return used.size === dimensions.length;
}

const PREPARATION=[
 "SELECT p.*, tr.bank_version AS trajectory_bank_version, hidden.trajectory_seed,",
 "r.id AS first_rep_id, r.completed_at AS first_rep_completed_at,",
 "r.condition_kept AS first_rep_condition_kept,",
 "r.observation_exact AS first_rep_observation_exact,",
 "r.evidence_exact AS first_rep_evidence_exact,",
 "truth.event_id AS first_rep_truth_id,",
 "truth.outcome_ref AS first_rep_truth_ref, r.outcome_ref AS first_rep_outcome_ref,",
 "truth.canonical_observations AS first_rep_canonical_observations",
 "FROM public.specialist_sandbox_preparation_events p",
 "JOIN public.specialist_sandbox_trajectories tr ON tr.id=p.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_trajectory_truth hidden ON hidden.trajectory_id=p.trajectory_id",
 "LEFT JOIN public.specialist_sandbox_rep_events r",
 "  ON r.trajectory_id=p.trajectory_id AND r.session_number=p.session_number",
 "  AND r.topic_key=p.topic_key AND r.set_id=p.set_id AND r.rep_number=1",
 "LEFT JOIN private.specialist_sandbox_rep_event_truth truth ON truth.event_id=r.id",
 "WHERE p.tutor_assignment_id=$1 AND p.tutor_id=$2",
 // A changed, unstarted plan is reviewed again in Map. Preserve every receipt,
 // but only the latest confirmation before delivery represents that first rep.
 "AND NOT EXISTS (SELECT 1 FROM public.specialist_sandbox_preparation_events newer",
 " WHERE newer.trajectory_id=p.trajectory_id AND newer.session_number=p.session_number",
 " AND newer.topic_key=p.topic_key AND newer.tutor_assignment_id=p.tutor_assignment_id",
 " AND newer.tutor_id=p.tutor_id AND newer.student_id=p.student_id",
 " AND (newer.recorded_at,newer.id)>(p.recorded_at,p.id)",
 " AND newer.recorded_at<r.completed_at)",
 "ORDER BY p.recorded_at ASC,p.id ASC LIMIT 5000",
].join(" ");
const CONTEXT_PREPARATION=[
 "SELECT p.* FROM public.specialist_sandbox_context_preparation_events p",
 "WHERE p.tutor_assignment_id=$1 AND p.tutor_id=$2",
 "ORDER BY p.recorded_at ASC,p.id ASC LIMIT 5000",
].join(" ");
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
 "tr.bank_version,tr.bank_key,hidden.trajectory_seed,",
 "run.status AS rediagnosis_status, run.specialist_decision,",
 "completed_truth.canonical_decision AS rediagnosis_canonical_decision",
 "FROM public.specialist_sandbox_rediagnosis_turns r",
 "JOIN public.specialist_sandbox_rediagnosis_runs run ON run.id=r.rediagnosis_run_id",
 "LEFT JOIN private.specialist_sandbox_rediagnosis_truth completed_truth",
 "ON completed_truth.rediagnosis_run_id=run.id",
 "JOIN public.specialist_sandbox_trajectories tr ON tr.id=r.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_trajectory_truth hidden ON hidden.trajectory_id=r.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_rediagnosis_turn_truth t ON t.rediagnosis_turn_id=r.id",
 "WHERE r.tutor_assignment_id=$1 AND r.tutor_id=$2",
 "ORDER BY r.completed_at ASC,r.id ASC LIMIT 5000",
].join(" ");
const CROSS_MODE=[
 "SELECT r.*,t.outcome_key,t.outcome_version,t.trajectory_class,t.canonical_observations,",
 "tr.bank_key,hidden.trajectory_seed,",
 "native_handover.drill->'sets' AS native_handover_sets,",
 "native_handover.id AS native_handover_drill_id,",
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
 "EXISTS (SELECT 1 FROM public.response_integrity_diagnosis_runs pending",
 " WHERE r.scope='diagnosis' AND pending.id::text=r.source_context_id",
 " AND pending.tutor_id::text=r.tutor_id::text AND pending.student_id::text=r.student_id::text",
 " AND pending.status IN ('in_progress','blocked') AND pending.decision->>'complete'='false'",
 " AND EXISTS (SELECT 1 FROM jsonb_array_elements(pending.probe_history) p",
 " WHERE p->>'probeId'=r.probe_id AND p->'observations'=r.specialist_submission->'observations'",
 " AND COALESCE(p->>'supportEvent','none')=r.specialist_submission->>'supportEvent')) AS native_placement_pending",
 "FROM public.specialist_sandbox_live_evidence_turns r",
 "JOIN public.specialist_sandbox_trajectories tr ON tr.id=r.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_trajectory_truth hidden ON hidden.trajectory_id=r.trajectory_id",
 "LEFT JOIN private.specialist_sandbox_live_evidence_truth t ON t.event_id=r.id",
 "LEFT JOIN LATERAL (",
 "  SELECT h.id,native_payload.drill FROM public.intro_session_drills h",
 `  CROSS JOIN LATERAL (SELECT ${SANDBOX_NATIVE_DRILL_PAYLOAD_SQL} AS drill) native_payload`,
 "  JOIN public.scheduled_sessions native_session ON native_session.id=h.scheduled_session_id",
 "  WHERE h.tutor_id::text=r.tutor_id::text AND h.student_id::text=r.student_id::text",
 "    AND h.scheduled_session_id::text=r.source_context_id",
 "    AND native_session.tutor_id::text=r.tutor_id::text",
 "    AND native_session.student_id::text=r.student_id::text",
 "    AND native_session.type='handover' AND native_session.status='completed'",
 "    AND native_payload.drill->>'drillType'='handover_verification'",
 "    AND native_payload.drill->>'handoverMode'='verification'",
 "    AND native_payload.drill->>'phase'=r.phase AND h.submitted_at>=r.completed_at",
 "  ORDER BY h.submitted_at DESC,h.id DESC LIMIT 1",
 ") native_handover ON r.scope='handover'",
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
 // Never infer clean chronology from a truncated source. Sessions have a
 // separate 1000-row limit; all other streams cap at 5000 rows.
 if(repResult.rows.length>=5000 || sessionResult.rows.length>=1000 ||
    rediagnosisResult.rows.length>=5000 || billingResult.rows.length>=5000)
  sourceGaps.push("Historical qualification evidence reached a projection limit; full review is required.");
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
  item.technicallyValid=truth&&item.observed;
  // A probe may be observed accurately without establishing a completed native
  // targeted re-diagnosis. Both authority tracks must finish at the same
  // placement and stability; partial/blocked runs never prove the mode.
  const specialistDecision=r.specialist_decision;
  const canonicalDecision=r.rediagnosis_canonical_decision;
  const runAligned=r.rediagnosis_status==="completed" &&
    specialistDecision?.complete===true && canonicalDecision?.complete===true &&
    !!specialistDecision.placementPhase &&
    specialistDecision.placementPhase===canonicalDecision.placementPhase &&
    specialistDecision.stability===canonicalDecision.stability;
  item.complete=item.technicallyValid&&runAligned;
  item.placementPending=item.technicallyValid && ["active","blocked"].includes(r.rediagnosis_status) &&
    specialistDecision?.complete===false && canonicalDecision?.complete===false;
  item.conditionKept=r.condition_conformed===true;item.observationExact=r.observation_exact===true;
  item.evidenceExact=item.observationExact;item.authorityAligned=r.authority_aligned===true&&runAligned;
  item.stateAligned=item.authorityAligned;
  item.materialError=item.technicallyValid&&!(item.conditionKept&&item.observationExact&&r.authority_aligned===true) ||
    (item.technicallyValid&&r.rediagnosis_status==="completed"&&!runAligned);
  item.opportunityKey=[r.bank_key,r.bank_version,r.probe_id,r.outcome_key,r.outcome_version].join(":");
  item.situationTags=[...tags(r),"routing"];return item;
 });
 let cross:any[]=[];
 try {
   cross=(await sourceDb.query(CROSS_MODE,params)).rows;
   if(cross.length>=5000)
     sourceGaps.push("Completed Diagnosis/Handover evidence reached the safe projection limit.");
 }
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
  // Cross-mode simulation is not completion authority. Check the actual
  // native Diagnosis run or the exact completed Handover rep evidence.
  const nativeVerified=r.scope==="diagnosis"
    ? r.native_proof_verified===true
    : r.scope==="handover" && !!r.native_handover_drill_id &&
      nativeHandoverRepMatches(r.native_handover_sets,r.specialist_submission,Number(r.sequence_number));
  if (nativeVerified) item.sourceId=[r.id,r.scope==="diagnosis"?r.source_context_id:r.native_handover_drill_id].join(":");
  item.complete=item.technicallyValid&&nativeVerified;
  item.placementPending=item.technicallyValid&&r.scope==="diagnosis"&&r.native_placement_pending===true;
  item.conditionKept=r.condition_conformed===true;item.observationExact=r.observation_exact===true;
  item.evidenceExact=item.observationExact;item.authorityAligned=nativeVerified;
  item.stateAligned=item.authorityAligned;
  item.materialError=item.technicallyValid&&(!item.conditionKept||!item.observationExact);
  item.opportunityKey=[r.scope,r.bank_version,r.probe_id,r.outcome_key,r.outcome_version].join(":");
  item.situationTags=tags(r);return item;
 });
 let savedPreparations:any[]=[];
 try {
   savedPreparations=(await sourceDb.query(PREPARATION,params)).rows;
   if(savedPreparations.length>=5000)
     sourceGaps.push("Session preparation evidence reached the safe historical projection limit.");
 } catch(error:any) {
   if(error?.code==="42P01" ||
      String(error?.message||"").includes("specialist_sandbox_preparation_events"))
     sourceGaps.push("Protected pre-session preparation evidence schema not applied.");
   else throw error;
 }
 const preparations=savedPreparations.map(row=>{
   const item=base({
     ...row,completed_at:row.first_rep_completed_at||row.recorded_at,
   },"preparation","opportunity");
   const schema=Number(row.bank_version)===1 ?
     getDrillSchemaDefinitionByVersion("training",String(row.phase) as TopicPhase,1) : null;
   const set=schema?.sets.find(candidate=>candidate.setId===row.set_id && !candidate.modelingOnly);
   const expectedHash=set?
     createHash("sha256").update(JSON.stringify(set.constraints)).digest("hex") : null;
   const lineageMatches=!!row.first_rep_id&&!!row.first_rep_truth_id &&
     !!row.first_rep_canonical_observations &&
     row.first_rep_truth_ref===row.first_rep_outcome_ref &&
     Number(row.trajectory_bank_version)===Number(row.bank_version) &&
     expectedHash===row.condition_contract_sha256 &&
     Date.parse(String(row.recorded_at))<Date.parse(String(row.first_rep_completed_at));
   item.observed=!!row.first_rep_id;
   item.canonicalPresent=!!row.first_rep_truth_id&&!!row.trajectory_seed;
   item.technicallyValid=!!lineageMatches&&item.canonicalPresent &&
     row.problem_prepared===true && row.conditions_reviewed===true &&
     row.evidence_plan_reviewed===true;
   item.conditionKept=row.first_rep_condition_kept===true;
   item.observationExact=row.first_rep_observation_exact===true;
   item.evidenceExact=row.first_rep_evidence_exact===true;
   item.authorityAligned=item.technicallyValid;
   item.stateAligned=item.technicallyValid;
   item.complete=item.technicallyValid;
   item.materialError=item.technicallyValid && !(
     item.conditionKept&&item.observationExact&&item.evidenceExact);
   item.opportunityKey=["prepared",row.phase,row.set_id,row.condition_contract_sha256].join(":");
   item.situationTags=["prepared_conditions"];
   item.preparationContext="training";
   return item;
 });
 let savedContextPreparations:any[]=[];
 try {
   savedContextPreparations=(await sourceDb.query(CONTEXT_PREPARATION,params)).rows;
 } catch(error:any) {
   if(error?.code==="42P01" || String(error?.message||"").includes("specialist_sandbox_context_preparation_events"))
     sourceGaps.push("Context-specific Sandbox preparation evidence schema not applied.");
   else throw error;
 }
 const contextPreparations=savedContextPreparations.map(row=>{
   const item=base({...row,completed_at:row.recorded_at},"preparation","opportunity");
   item.observed=true;
   item.canonicalPresent=true;
   item.technicallyValid=true;
   item.conditionKept=true;
   item.observationExact=true;
   item.evidenceExact=true;
   item.authorityAligned=true;
   item.stateAligned=true;
   item.complete=true;
   item.materialError=false;
   item.preparationContext=row.preparation_context;
   item.opportunityKey=["context-prepared",row.preparation_context,row.source_context_id,row.sequence_number].join(":");
   item.situationTags=["prepared_conditions",row.preparation_context];
   return item;
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
  // Continuity must be earned across a correctly tracked prior session
  // on the same topic, in strict chronological order. Mere adjacency of
  // session numbers never proves preservation of state or judgment.
  const priorAligned=previous?.authority_aligned===true &&
    previous?.state_track_aligned===true && !!previous?.canonical_authority;
  const nextAligned=raw.authority_aligned===true &&
    raw.state_track_aligned===true && !!raw.canonical_authority;
  const sameTopic=String(previous?.topic_key||"")===String(raw.topic_key||"") &&
    !!String(raw.topic_key||"").trim();
  const chronological=previous &&
    Number.isFinite(Date.parse(String(previous.completed_at))) &&
    Number.isFinite(Date.parse(String(raw.completed_at))) &&
    Date.parse(String(previous.completed_at))<Date.parse(String(raw.completed_at));
  if(priorAligned && nextAligned && sameTopic && chronological && session.complete){
   continuity.push({...session,id:"continuity:"+session.id,kind:"opportunity",mode:"continuity",
      opportunityKey:"continuity:"+session.id,sourceType:"session_transition",observed:true,
      sourceId:session.id});
  }
 }
 // An unstarted, abandoned preparation is not an observed opportunity.
 // Preserve its audit receipt in the protected table, but do not permanently
 // poison the Specialist's future clean evidence with an unattempted rep.
 return {events:[...preparations.filter(e=>e.observed),...contextPreparations,...reps,...sessions,...rediagnoses,...crossEvents,...closure,...continuity],sourceGaps};
}
