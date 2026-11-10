import { pool } from "./db";
import type { PracticalBenchmarkProof } from "@shared/practicalBenchmarkPolicy";
import { getCapabilityPracticalProofDefinition } from "@shared/capabilityPracticalEvidence";

const fail=(status:number,message:string)=>Object.assign(new Error(message),{status});
type AssignedRun={tutorAssignmentId:string;tutorId:string;proofKey:PracticalBenchmarkProof;runId:string};
type RecoveryReason="recording_interrupted"|"recording_unusable"|"accessibility_failure";
type RecoveryDecision="approve_repeat"|"deny"|"integrity_review";

export async function getSpecialistRecordingRecovery(input:{tutorAssignmentId:string;tutorId:string;proofKey:PracticalBenchmarkProof}) {
 const version=getCapabilityPracticalProofDefinition(input.proofKey)?.version;
 if(!version)throw fail(400,"Unknown Practicals proof.");
 const result=await pool.query(`
  SELECT r.id AS run_id,r.status,r.attempt_number,req.id AS request_id,
         req.reason,req.incident_note,req.requested_at,
         dec.decision,dec.rationale,dec.decided_at
  FROM public.specialist_practical_benchmark_runs r
  LEFT JOIN public.specialist_practical_recording_recovery_requests req ON req.run_id=r.id
  LEFT JOIN public.specialist_practical_recording_recovery_decisions dec ON dec.request_id=req.id
  WHERE r.tutor_assignment_id=$1 AND r.tutor_id=$2 AND r.proof_key=$3 AND r.proof_version=$4
  ORDER BY r.attempt_number DESC LIMIT 1`,
  [input.tutorAssignmentId,input.tutorId,input.proofKey,version]);
 const row=result.rows[0];
 if(!row)return {runId:null,status:null,attemptNumber:0,recovery:null};
 return {
   runId:row.run_id,status:row.status,attemptNumber:Number(row.attempt_number),
   recovery:row.request_id?{
     requestId:row.request_id,reason:row.reason,incidentNote:row.incident_note,
     requestedAt:row.requested_at,decision:row.decision||null,
     rationale:row.rationale||null,decidedAt:row.decided_at||null,
   }:null,
 };
}

export async function requestPracticalRecordingRecovery(input:AssignedRun & {
 reason:RecoveryReason;incidentNote:string;
}) {
 if(input.incidentNote.trim().length<30||input.incidentNote.trim().length>3000)
   throw fail(400,"Describe the recording interruption and what was lost (30–3000 characters).");
 const client=await pool.connect();
 try {
   await client.query("BEGIN");
   const run=await client.query(`
     SELECT r.id,r.status,r.proof_version,r.attempt_number
     FROM public.specialist_practical_benchmark_runs r
     JOIN public.tutor_assignments ta ON ta.id=r.tutor_assignment_id AND ta.tutor_id=r.tutor_id
     JOIN public.pods p ON p.id=ta.pod_id
     WHERE r.id=$1 AND r.tutor_assignment_id=$2 AND r.tutor_id=$3 AND r.proof_key=$4
       AND p.td_id IS NOT NULL FOR UPDATE OF r`,
     [input.runId,input.tutorAssignmentId,input.tutorId,input.proofKey]);
   const row=run.rows[0];
   if(!row)throw fail(403,"Only the owning Specialist with an assigned TD may request recovery.");
   const version=getCapabilityPracticalProofDefinition(input.proofKey)?.version;
   if(row.status!=="active"||Number(row.proof_version)!==version)
     throw fail(409,"Only the active current-version assessment can request recovery.");
   const evidence=await client.query(
     "SELECT 1 FROM public.specialist_capability_practical_evidence WHERE benchmark_run_id=$1 LIMIT 1",
     [input.runId]);
   if(evidence.rows.length)throw fail(409,"Submitted assessment evidence must follow TD review, not recording recovery.");
   const existing=await client.query(
     "SELECT 1 FROM public.specialist_practical_recording_recovery_requests WHERE run_id=$1",
     [input.runId]);
   if(existing.rows.length)throw fail(409,"A recording recovery request already exists for this attempt.");
   const inserted=await client.query(`
     INSERT INTO public.specialist_practical_recording_recovery_requests
       (run_id,reason,incident_note) VALUES($1,$2,$3)
       RETURNING id,requested_at`,[input.runId,input.reason,input.incidentNote.trim()]);
   await client.query("COMMIT");
   return {requestId:String(inserted.rows[0].id),runId:input.runId,
     requestedAt:inserted.rows[0].requested_at,status:"awaiting_td" as const};
 }catch(error){await client.query("ROLLBACK");throw error}
 finally{client.release()}
}

export async function getAssignedTdRecordingRecoveryQueue(input:{reviewerId:string;reviewerRole:string}){
 if(input.reviewerRole!=="td")throw fail(403,"Assigned TD review role is required.");
 const data=await pool.query(`
   SELECT req.id AS request_id,req.run_id,req.reason,req.incident_note,req.requested_at,
       r.tutor_assignment_id,r.tutor_id,r.proof_key,r.proof_version,r.bank_version,
       r.attempt_number,r.active_case_index,r.started_at,
       u.first_name,u.last_name,p.pod_name
   FROM public.specialist_practical_recording_recovery_requests req
   JOIN public.specialist_practical_benchmark_runs r ON r.id=req.run_id
   JOIN public.tutor_assignments ta ON ta.id=r.tutor_assignment_id AND ta.tutor_id=r.tutor_id
   JOIN public.pods p ON p.id=ta.pod_id
   JOIN public.users u ON u.id=r.tutor_id
   LEFT JOIN public.specialist_practical_recording_recovery_decisions dec ON dec.request_id=req.id
   WHERE p.td_id=$1 AND dec.id IS NULL AND r.status='active'
   ORDER BY req.requested_at ASC`,[input.reviewerId]);
 return data.rows.map(row=>({
   requestId:row.request_id,runId:row.run_id,reason:row.reason,
   incidentNote:row.incident_note,requestedAt:row.requested_at,
   tutorAssignmentId:row.tutor_assignment_id,tutorId:row.tutor_id,
   specialistName:[row.first_name,row.last_name].filter(Boolean).join(" "),
   podName:row.pod_name||null,proofKey:row.proof_key,proofVersion:Number(row.proof_version),
   bankVersion:Number(row.bank_version),attemptNumber:Number(row.attempt_number),
   activeCaseIndex:Number(row.active_case_index),startedAt:row.started_at,
 }));
}
export async function decidePracticalRecordingRecovery(input:{
 requestId:string;reviewerId:string;reviewerRole:string;
 decision:RecoveryDecision;rationale:string;
}) {
 if(input.reviewerRole!=="td")throw fail(403,"Assigned TD review role is required.");
 if(input.rationale.trim().length<30||input.rationale.trim().length>3000)
   throw fail(400,"Record the TD's observed recovery basis (30–3000 characters).");
 const client=await pool.connect();
 try {
   await client.query("BEGIN");
   const record=await client.query(`
     SELECT req.id,req.run_id,r.status,r.tutor_id,r.tutor_assignment_id,r.proof_key,
       r.proof_version,p.td_id,dec.id AS decided_id
     FROM public.specialist_practical_recording_recovery_requests req
     JOIN public.specialist_practical_benchmark_runs r ON r.id=req.run_id
     JOIN public.tutor_assignments ta ON ta.id=r.tutor_assignment_id AND ta.tutor_id=r.tutor_id
     JOIN public.pods p ON p.id=ta.pod_id
     LEFT JOIN public.specialist_practical_recording_recovery_decisions dec ON dec.request_id=req.id
     WHERE req.id=$1 FOR UPDATE OF r`,[input.requestId]);
   const row=record.rows[0];
   if(!row)throw fail(404,"Recording recovery request not found.");
   if(String(row.td_id||"")!==input.reviewerId)
     throw fail(403,"This attempt belongs to a different TD's Pod.");
   if(row.decided_id||row.status!=="active")
     throw fail(409,"This request was already decided or its attempt is no longer active.");
   if(Number(row.proof_version)!==getCapabilityPracticalProofDefinition(row.proof_key)?.version)
     throw fail(409,"The request is not from the active approved assessment version.");
   const previousEvidence=await client.query(
     "SELECT 1 FROM public.specialist_capability_practical_evidence WHERE benchmark_run_id=$1 LIMIT 1",
     [row.run_id]);
   if(previousEvidence.rows.length)throw fail(409,"A submitted recording cannot be retired through an unsubmitted recovery request.");
   const decision=await client.query(`
     INSERT INTO public.specialist_practical_recording_recovery_decisions
       (request_id,reviewer_id,decision,rationale)
     VALUES($1,$2,$3,$4) RETURNING id,decided_at`,
     [input.requestId,input.reviewerId,input.decision,input.rationale.trim()]);
   if(input.decision==="approve_repeat"){
     await client.query(`
       UPDATE public.specialist_practical_benchmark_runs
       SET status='abandoned',completed_at=now() WHERE id=$1`,[row.run_id]);
   }
   await client.query("COMMIT");
   return {decisionId:String(decision.rows[0].id),runId:row.run_id,
     outcome:input.decision,decidedAt:decision.rows[0].decided_at,
     newAttemptAuthorized:input.decision==="approve_repeat"};
 }catch(error){await client.query("ROLLBACK");throw error}
 finally{client.release()}
}
