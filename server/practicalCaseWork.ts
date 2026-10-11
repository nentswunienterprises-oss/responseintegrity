import { pool } from "./db";
import { getDrillSchemaDefinition, getEvidenceSelectionIdentity, getFieldDefinitionsForRep } from "@shared/responseIntegrityDrillRegistry";
import type { TopicPhase } from "@shared/topicConditioningEngine";
import type { PracticalBenchmarkProof } from "@shared/practicalBenchmarkPolicy";
import { getCapabilityPracticalProofDefinition } from "@shared/capabilityPracticalEvidence";
import { getPracticalCasePlan, type PracticalWorkStep } from "./practicalCasePlans";

type Identity = {tutorAssignmentId:string;tutorId:string;proofKey:PracticalBenchmarkProof;runId:string};
type RecordedAction = {stepNumber:number;operationKey:string;recordedPayload:any;systemSnapshot:any;recordedAt:string;riskFlags:string[]};
type WorkRun = {id:string;active_case_index:number;status:string;attempt_number:number;proof_version:number;bank_version:number};
const interventionOptions=["none","neutral_clarification","first_step_confirmation","method_or_step_prompt","full_rescue_or_teaching","timer_changed"] as const;
const evidenceOptions=["observed","not_observed","confounded"] as const;
const independenceOptions=["independent","assisted","not_established"] as const;
const timingOptions=["not_applicable","valid","interrupted","unverified"] as const;
const nextActions=["continue","pause_for_evidence","evidence_recovery","escalate","system_confirmation"] as const;
function fail(status:number,message:string){return Object.assign(new Error(message),{status})}
function select(value:unknown, options:readonly string[], label:string){
 if(typeof value!=="string" || !options.includes(value))throw fail(400,"Invalid "+label+" for the issued workflow.");
 return value;
}
function prose(value:unknown,label:string,min=30,max=2000){
 if(typeof value!=="string" || value.trim().length<min || value.trim().length>max)
   throw fail(400,label+" needs "+min+"–"+max+" characters of what was actually said, done or observed.");
 return value.trim();
}
function truth(value:unknown,label:string){
 if(value!==true)throw fail(400,label+" must be demonstrated and confirmed.");
 return true;
}
function repRegistry(step:PracticalWorkStep){
 if(!step.phase||!step.setId||!step.repNumber)throw fail(500,"Issued rep lacks registry provenance.");
 const schema=getDrillSchemaDefinition("training",step.phase);
 const set=schema.sets.find(x=>x.setId===step.setId);
 if(!set)throw fail(500,"Assigned drill is absent from the current training registry.");
 const index=(step.repNumber-1)%set.reps;
 const fields=getFieldDefinitionsForRep(set,index).map(field=>{
  const options=(field.optionLabels||[]).map((label,optionIndex)=>{
   const identity=getEvidenceSelectionIdentity({
    mode:"training",phase:step.phase!,setName:set.setName,
    repIndex:index,fieldKey:field.fieldKey,optionIndex,
   });
   if(!identity)throw fail(500,"Training evidence contract cannot project an observed rep.");
   return {optionId:identity.optionId,label};
  });
  if(!options.length)throw fail(500,"Training rep has no observation choices.");
  return {fieldKey:field.fieldKey,dimensionId:field.dimensionId,options};
 });
 if(!fields.length)throw fail(500,"Training rep has no observable fields.");
 return {schemaId:schema.schemaId,schemaVersion:schema.schemaVersion,definitionHash:schema.definitionHash,
   phase:step.phase,setId:set.setId,setName:set.setName,repNumber:step.repNumber,fields};
}
function publicStep(step:PracticalWorkStep,number:number){
 if(step.kind==="configure"){
  const schema=getDrillSchemaDefinition("training",step.phase!);
  return {number,...step,registry:{schemaId:schema.schemaId,schemaVersion:schema.schemaVersion,
    phase:step.phase,setOptions:schema.sets.filter(x=>!x.modelingOnly).map(x=>({
      setId:x.setId,label:x.setName,supportLevel:x.constraints.supportLevel,
      pressureLevel:x.constraints.pressureLevel,
    }))}};
 }
 return {number,...step,...(step.kind==="rep"?{registry:repRegistry(step)}:{})};
}
function validateAction(step:PracticalWorkStep,payload:Record<string,unknown>,prior:RecordedAction[]){
 const risks:string[]=[];
 let result:Record<string,unknown>;
 if(step.kind==="begin_rep"){
  result={recordingActive:true};
 }else if(step.kind==="configure"){
  const schema=getDrillSchemaDefinition("training",step.phase!);
  const allowed=schema.sets.filter(x=>!x.modelingOnly);
  const choice=select(payload.selectedSetId,allowed.map(x=>x.setId),"training set");
  const set=allowed.find(x=>x.setId===choice)!;
  const support=select(payload.supportLevel,["none","minimal","first_step_only","modeled"],"support boundary");
  const pressure=select(payload.pressureLevel,["none","difficulty","light_timer","repeated_timer","full_constraint"],"pressure level");
  if(choice!==step.setId)risks.push("wrong_drill_selected");
  if(support!==set.constraints.supportLevel)risks.push("support_boundary_mismatch");
  if(pressure!==set.constraints.pressureLevel)risks.push("pressure_condition_mismatch");
  result={selectedSetId:choice,phase:step.phase,schemaId:schema.schemaId,schemaVersion:schema.schemaVersion,
    drillDefinitionHash:schema.definitionHash,selectedConstraints:set.constraints,
    supportLevel:support,pressureLevel:pressure,
    cameraReady:truth(payload.cameraReady,"Camera/work view"),
    microphoneReady:truth(payload.microphoneReady,"Microphone"),
    workSurfaceReady:truth(payload.workSurfaceReady,"Student work surface"),
    spokenOpening:prose(payload.spokenOpening,"Live opening"),
    decisionReason:prose(payload.decisionReason,"Setup reason")};
 }else if(step.kind==="respond"){
  const intervention=select(payload.intervention,interventionOptions,"intervention");
  const status=select(payload.evidenceStatus,evidenceOptions,"observation status");
  const independence=select(payload.independenceClaim,independenceOptions,"independence claim");
  const nextAction=select(payload.nextAction,nextActions,"next action");
  if(intervention==="full_rescue_or_teaching")risks.push("full_rescue");
  if(status!=="observed"&&independence==="independent")risks.push("unobserved_claimed_independent");
  if(["first_step_confirmation","method_or_step_prompt","full_rescue_or_teaching"].includes(intervention)&&independence==="independent")
    risks.push("assisted_claimed_independent");
  result={intervention,evidenceStatus:status,independenceClaim:independence,nextAction,
    studentFacingResponse:prose(payload.studentFacingResponse,"Spoken student-facing response"),
    observedBehavior:prose(payload.observedBehavior,"Observed student behavior"),
    decisionReason:prose(payload.decisionReason,"Intervention reason")};
 }else if(step.kind==="rep"){
  const registry=repRegistry(step);
  const selections=payload.observationSelections;
  if(!selections || typeof selections!=="object" || Array.isArray(selections))throw fail(400,"Complete the actual training rep observation fields.");
  const raw=selections as Record<string,unknown>;
  if(Object.keys(raw).length!==registry.fields.length)throw fail(400,"Every exact issued training observation field must be recorded.");
  for(const field of registry.fields){
    if(typeof raw[field.fieldKey]!=="string" || !field.options.some(o=>o.optionId===raw[field.fieldKey]))
      throw fail(400,"Observation does not match the issued training registry: "+field.fieldKey);
  }
  const intervention=select(payload.intervention,interventionOptions,"rep intervention");
  const status=select(payload.evidenceStatus,evidenceOptions,"rep evidence status");
  const claim=select(payload.independenceClaim,independenceOptions,"independence claim");
  const timing=select(payload.timingStatus,timingOptions,"timing status");
  if(step.observedSupport==="unobserved" && status==="observed")risks.push("unobserved_rep_claimed_observed");
  if(step.observedSupport==="timer_interrupted"&&timing==="valid")risks.push("interrupted_timer_claimed_valid");
  if(step.observedSupport==="none"&&intervention!=="none")risks.push("unassigned_support_added");
  if(["first_step_confirmation","method_or_step_prompt"].includes(step.observedSupport||"")&&intervention==="none")
    risks.push("observed_support_omitted");
  if((intervention!=="none"||status!=="observed")&&claim==="independent")
    risks.push("invalid_independence_claim");
  const began=[...prior].reverse().find(x=>x.operationKey==="begin_rep" && Number(x.systemSnapshot?.repNumber)===step.repNumber);
  const serverElapsedSeconds=began?Math.max(0,Math.ceil((Date.now()-new Date(began.recordedAt).getTime())/1000)):null;
  result={observationSelections:raw,intervention,evidenceStatus:status,independenceClaim:claim,
    timingStatus:timing,studentFacingResponse:prose(payload.studentFacingResponse,"Rep-facing conduct"),
    observedBehavior:prose(payload.observedBehavior,"Rep observation"),
    decisionReason:prose(payload.decisionReason,"Rep decision"),
    schemaId:registry.schemaId,schemaVersion:registry.schemaVersion,definitionHash:registry.definitionHash,
    selectedSetId:registry.setId,phase:registry.phase,repNumber:registry.repNumber,serverElapsedSeconds};
 }else if(step.kind==="adaptive"){
  throw fail(500,"Adaptive completion must be checked against server-side Execute history.");
 }else if(step.kind==="decide"){
  const action=select(payload.nextAction,nextActions,"next system action");
  const claim=select(payload.evidenceClaim,["not_established","assisted","observed_independent","system_decision_pending"],"evidence claim");
  if(step.prompt.includes("phase exit")&&claim==="observed_independent")risks.push("unsupported_phase_exit_claim");
  result={nextAction:action,evidenceClaim:claim,
    decisionReason:prose(payload.decisionReason,"Decision walkthrough"),
    evidenceBoundary:prose(payload.evidenceBoundary,"Evidence boundary")};
 }else throw fail(500,"Unknown governed Practicals operation.");
 return {result,risks};
}
async function fetchWork(input:Identity,client:{query:(sql:string,args?:unknown[])=>Promise<{rows:any[]}>},lock=false){
 const runResult=await client.query(
  `SELECT r.id,r.status,r.active_case_index,r.proof_version,r.attempt_number,r.bank_version
     FROM public.specialist_practical_benchmark_runs r
    WHERE r.id=$1 AND r.tutor_assignment_id=$2 AND r.tutor_id=$3 AND r.proof_key=$4
    ${lock?"FOR UPDATE":""}`,
  [input.runId,input.tutorAssignmentId,input.tutorId,input.proofKey],
 );
 const run=runResult.rows[0] as WorkRun|undefined;
 if(!run)throw fail(403,"This Practicals run is not owned by this Specialist assignment.");
 const current=getCapabilityPracticalProofDefinition(input.proofKey);
 if(!current||Number(run.proof_version)!==current.version||Number(run.bank_version)!==1)
   throw fail(409,"A current, issued assessment version is required.");
 if(run.status!=="active")throw fail(409,"This Practicals recording is already completed.");
 const reveals=await client.query(
  `SELECT case_key,case_sequence,case_version,case_snapshot FROM public.specialist_practical_benchmark_case_reveals
    WHERE run_id=$1 AND case_sequence=$2`,
  [run.id,Number(run.active_case_index)],
 );
 const reveal=reveals.rows[0];
 if(!reveal)throw fail(409,"Current case was not issued by the system.");
 const steps=getPracticalCasePlan(String(reveal.case_key));
 if(Number(reveal.case_version)!==1 ||
   JSON.stringify(steps)!==JSON.stringify(reveal.case_snapshot.workflowSteps))
   throw fail(409,"Current case workflow snapshot does not match the issued bank.");
 const records=await client.query(
  `SELECT step_number AS "stepNumber",operation_key AS "operationKey",recorded_payload AS "recordedPayload",
      system_snapshot AS "systemSnapshot",recorded_at AS "recordedAt",risk_flags AS "riskFlags"
    FROM public.specialist_practical_case_actions WHERE run_id=$1 AND case_sequence=$2 ORDER BY step_number`,
  [run.id,Number(run.active_case_index)],
 );
 const events=records.rows as RecordedAction[];
 if(events.length>steps.length)throw fail(409,"Unexpected case workflow event count.");
 return {run,reveal,steps,events};
}
function projectWork(w:Awaited<ReturnType<typeof fetchWork>>){
 const current=w.steps[w.events.length]||null;
 return {
  caseKey:w.reveal.case_key,caseSequence:Number(w.reveal.case_sequence),
  stepCount:w.steps.length,completed:w.events.length===w.steps.length,
  completedSteps:w.events.length,
  currentStep:current?publicStep(current,w.events.length+1):null,
  events:w.events,
 };
}
export async function getPracticalCaseWork(input:Identity){
 return projectWork(await fetchWork(input,pool));
}
export async function recordPracticalCaseAction(input:Identity&{stepNumber:number;payload:Record<string,unknown>}){
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const w=await fetchWork(input,client,true);
  const expected=w.events.length+1;
  if(input.stepNumber!==expected||!w.steps[expected-1])
    throw fail(409,"The case action is stale, missing, or out of sequence.");
  const step=w.steps[expected-1];
  let result:Record<string,unknown>,risks:string[];
  if(step.kind==="adaptive"){
    const c=await client.query(
      `SELECT c.id FROM public.specialist_practical_execute_challenges c
        WHERE c.tutor_assignment_id=$1 AND c.tutor_id=$2 AND c.attempt_number=$3
          AND c.status='complete' AND c.active_turn=4
          AND (SELECT COUNT(*) FROM public.specialist_practical_execute_turns t WHERE t.challenge_id=c.id)=3`,
      [input.tutorAssignmentId,input.tutorId,w.run.attempt_number],
    );
    if(!c.rows.length)throw fail(409,"Complete all three genuine adaptive Execute turns before saving the examination operation.");
    result={challengeId:String(c.rows[0].id),completedTurnCount:3};risks=[];
  }else ({result,risks}=validateAction(step,input.payload,w.events));
  await client.query(
    `INSERT INTO public.specialist_practical_case_actions
       (run_id,case_sequence,step_number,operation_key,recorded_payload,system_snapshot,risk_flags)
     VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
    [input.runId,w.reveal.case_sequence,expected,step.kind,
      JSON.stringify(result),JSON.stringify(step),JSON.stringify(risks)],
  );
  await client.query("COMMIT");
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
 return getPracticalCaseWork(input);
}
