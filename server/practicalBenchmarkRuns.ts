import { randomUUID } from "node:crypto";
import { pool } from "./db";
import { getPracticalBenchmarkCase, getPracticalBenchmarkCaseKeys } from "./practicalBenchmarkBank";
import {
  PRACTICAL_BENCHMARK_VERSION,
  PRACTICAL_BENCHMARK_CASE_COUNT,
  type PracticalBenchmarkProof,
} from "@shared/practicalBenchmarkPolicy";
import { getCapabilityPracticalProofDefinition } from "@shared/capabilityPracticalEvidence";

function fail(status:number,message:string) {
  return Object.assign(new Error(message),{status});
}
type RunInput = {tutorAssignmentId:string;tutorId:string;proofKey:PracticalBenchmarkProof};
type RunRow = {
  id:string;tutor_assignment_id:string;tutor_id:string;proof_key:string;
  proof_version:number;attempt_number:number;bank_version:number;
  status:"active"|"complete";active_case_index:number;
  started_at:Date|string;completed_at:Date|string|null;
};
const sqlRun=`SELECT id,tutor_assignment_id,tutor_id,proof_key,proof_version,
  attempt_number,bank_version,status,active_case_index,started_at,completed_at
  FROM public.specialist_practical_benchmark_runs`;

export async function eligibleAttempt(input:RunInput) {
  const definition=getCapabilityPracticalProofDefinition(input.proofKey);
  if(!definition) throw fail(404,"Unknown Practicals benchmark.");
  const evidence=await pool.query(
    `SELECT e.attempt_number,r.outcome
     FROM public.specialist_capability_practical_evidence e
     LEFT JOIN public.specialist_capability_practical_reviews r ON r.evidence_id=e.id
     WHERE e.tutor_assignment_id=$1 AND e.tutor_id=$2
       AND e.proof_key=$3 AND e.proof_version=$4
     ORDER BY e.attempt_number DESC LIMIT 1`,
    [input.tutorAssignmentId,input.tutorId,input.proofKey,definition.version],
  );
  const latest=evidence.rows[0];
  if(latest && latest.outcome!=="repeat_required"){
    const reason=latest.outcome==="approved"
      ? "This Practical was already approved."
      : latest.outcome==="integrity_review"
      ? "Integrity review must be resolved by its authorised reviewer."
      : "This Practical is already awaiting its TD review.";
    return {allowed:false,reason,attemptNumber:0,version:definition.version};
  }
  const minAttempt=Number(latest?.attempt_number||0)+1;
  const runs=await pool.query(
    `SELECT r.attempt_number,r.status,req.id AS recovery_request_id,
       dec.decision AS recovery_decision
     FROM public.specialist_practical_benchmark_runs r
     LEFT JOIN public.specialist_practical_recording_recovery_requests req ON req.run_id=r.id
     LEFT JOIN public.specialist_practical_recording_recovery_decisions dec ON dec.request_id=req.id
     WHERE r.tutor_assignment_id=$1 AND r.tutor_id=$2
       AND r.proof_key=$3 AND r.proof_version=$4
     ORDER BY r.attempt_number DESC LIMIT 1`,
     [input.tutorAssignmentId,input.tutorId,input.proofKey,definition.version]);
  const run=runs.rows[0];
  if(!run||Number(run.attempt_number)<minAttempt)
    return {allowed:true,reason:null,attemptNumber:minAttempt,version:definition.version};
  if(run.status==="abandoned"){
    if(run.recovery_decision!=="approve_repeat")
      return {allowed:false,reason:"An abandoned recording has no authorised TD recovery.",attemptNumber:0,version:definition.version};
    return {allowed:true,reason:null,attemptNumber:Number(run.attempt_number)+1,version:definition.version};
  }
  if(run.recovery_request_id&&run.recovery_decision==="integrity_review")
    return {allowed:false,reason:"The recording incident is under integrity review.",attemptNumber:0,version:definition.version};
  return {allowed:true,reason:null,attemptNumber:Number(run.attempt_number),version:definition.version};
}

async function findRun(input:RunInput,attemptNumber:number) {
  const r=await pool.query(
    `${sqlRun} WHERE tutor_assignment_id=$1 AND tutor_id=$2 AND proof_key=$3
      AND proof_version=$4 AND attempt_number=$5 LIMIT 1`,
    [input.tutorAssignmentId,input.tutorId,input.proofKey,
     getCapabilityPracticalProofDefinition(input.proofKey)!.version,attemptNumber]);
  return (r.rows[0]||null) as RunRow|null;
}
async function view(run:RunRow,includeTdFlags=false) {
  const result=await pool.query(
    `SELECT case_sequence,case_key,case_version,case_snapshot,revealed_at
     FROM public.specialist_practical_benchmark_case_reveals
     WHERE run_id=$1 ORDER BY case_sequence`,[run.id],
  );
  const actions=await pool.query(
    `SELECT case_sequence,step_number,operation_key,recorded_payload,system_snapshot,
            risk_flags,recorded_at
       FROM public.specialist_practical_case_actions
      WHERE run_id=$1 ORDER BY case_sequence,step_number`,[run.id]);
  const cases=result.rows.map(row=>{
    // A revealed case may contain future within-case scripted responses. Never
    // send the private workflow plan to a Specialist ahead of each live step.
    const {workflowSteps:_privateSteps,...publicSnapshot}=row.case_snapshot;
    const trace=actions.rows.filter(a=>Number(a.case_sequence)===Number(row.case_sequence));
    return {
      ...publicSnapshot,
      caseKey:String(row.case_key),
      sequence:Number(row.case_sequence),
      caseVersion:Number(row.case_version),
      revealedAt:row.revealed_at,
      completedOperations:trace.length,
      requiredOperations:Array.isArray(_privateSteps)?_privateSteps.length:0,
      operationHistory:trace.map(a=>({
        stepNumber:Number(a.step_number),operationKey:a.operation_key,
        recordedPayload:a.recorded_payload,systemSnapshot:a.system_snapshot,
        ...(includeTdFlags?{riskFlags:a.risk_flags}:{}),recordedAt:a.recorded_at,
      })),
    };
  });
  return {
    started:true as const,runId:run.id,proofKey:run.proof_key,
    proofVersion:Number(run.proof_version),bankVersion:Number(run.bank_version),
    attemptNumber:Number(run.attempt_number),
    reference:run.id.slice(0,8).toUpperCase(),
    completed:run.status==="complete",
    currentCase:run.status==="active"?cases[cases.length-1]||null:null,
    history:cases, // previously REVEALED cases only; never future truth
    completedCount:run.status==="complete"?PRACTICAL_BENCHMARK_CASE_COUNT:cases.length,
    requiredCases:PRACTICAL_BENCHMARK_CASE_COUNT,
    startedAt:run.started_at,completedAt:run.completed_at,
  };
}

export async function getBenchmarkRunStatus(input:RunInput) {
  const eligibility=await eligibleAttempt(input);
  if(!eligibility.allowed)return {
    started:false as const,allowed:false,reason:eligibility.reason,completed:false,
    requiredCases:PRACTICAL_BENCHMARK_CASE_COUNT,
  };
  const run=await findRun(input,eligibility.attemptNumber);
  if(!run)return {started:false as const,allowed:true,reason:null,completed:false,
    requiredCases:PRACTICAL_BENCHMARK_CASE_COUNT,attemptNumber:eligibility.attemptNumber};
  return view(run);
}

export async function startBenchmarkRun(input:RunInput & {preflightConfirmed:boolean;recordingStartedBeforeReveal:boolean}) {
  if(input.preflightConfirmed!==true || input.recordingStartedBeforeReveal!==true)
    throw fail(400,"A visible tools/environment preflight and a recording started before case reveal are required.");
  const eligibility=await eligibleAttempt(input);
  if(!eligibility.allowed)throw fail(409,eligibility.reason||"No Practical attempt available.");
  const existing=await findRun(input,eligibility.attemptNumber);
  if(existing)return view(existing);

  const first=getPracticalBenchmarkCase(input.proofKey,1);
  if(!first)throw fail(500,"The shared case bank is unavailable.");
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const insert=await client.query(
      `INSERT INTO public.specialist_practical_benchmark_runs
        (id,tutor_assignment_id,tutor_id,proof_key,proof_version,bank_version,
         attempt_number,preflight_attested,recording_started_before_reveal_attested)
       VALUES($1,$2,$3,$4,$5,$6,$7,true,true)
       ON CONFLICT (tutor_assignment_id,proof_key,proof_version,attempt_number)
       DO NOTHING RETURNING id`,
      [randomUUID(),input.tutorAssignmentId,input.tutorId,input.proofKey,
       eligibility.version,PRACTICAL_BENCHMARK_VERSION,eligibility.attemptNumber],
    );
    if(insert.rows.length){
      await client.query(
        `INSERT INTO public.specialist_practical_benchmark_case_reveals
         (run_id,case_sequence,case_key,case_version,case_snapshot)
         VALUES ($1,1,$2,$3,$4::jsonb)`,
        [insert.rows[0].id,first.caseKey,first.caseVersion,JSON.stringify(first)],
      );
    }
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error}
  finally{client.release()}
  const row=await findRun(input,eligibility.attemptNumber);
  if(!row)throw fail(500,"Could not persist the assigned Practicals cases.");
  return view(row);
}

export async function advanceBenchmarkRun(input:RunInput & {
  runId:string;action:"next"|"finish";
}) {
  const eligibility=await eligibleAttempt(input);
  if(!eligibility.allowed)throw fail(409,eligibility.reason||"No Practical attempt available.");
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const record=await client.query(
      `${sqlRun} WHERE id=$1 AND tutor_assignment_id=$2 AND tutor_id=$3
         AND proof_key=$4 AND proof_version=$5 AND attempt_number=$6 FOR UPDATE`,
      [input.runId,input.tutorAssignmentId,input.tutorId,input.proofKey,
       eligibility.version,eligibility.attemptNumber],
    );
    const run=record.rows[0] as RunRow|undefined;
    if(!run || run.status!=="active")throw fail(409,"This assigned Practical is unavailable or already completed.");
    const current=Number(run.active_case_index);
    if(input.action==="next"){
      if(current>=PRACTICAL_BENCHMARK_CASE_COUNT)throw fail(409,"Every case is already revealed. Finish the current recording.");
      const next=getPracticalBenchmarkCase(input.proofKey,current+1);
      if(!next)throw fail(409,"The expected shared case is unavailable.");
      // For Execute, its existing adaptive challenge must be completed during
      // case 2 before the Specialist can reveal case 3.
      if(input.proofKey==="execute" && current===2) {
        const c=await client.query(
          `SELECT 1 FROM public.specialist_practical_execute_challenges
           WHERE tutor_assignment_id=$1 AND tutor_id=$2 AND attempt_number=$3
             AND status='complete' AND active_turn=4 LIMIT 1`,
          [input.tutorAssignmentId,input.tutorId,eligibility.attemptNumber],
        );
        if(!c.rows.length)throw fail(409,"Finish the live three-turn no-rescue Execute challenge before revealing the next benchmark.");
      }
      await client.query(
        `INSERT INTO public.specialist_practical_benchmark_case_reveals
         (run_id,case_sequence,case_key,case_version,case_snapshot)
         VALUES($1,$2,$3,$4,$5::jsonb)`,
        [run.id,next.sequence,next.caseKey,next.caseVersion,JSON.stringify(next)],
      );
      await client.query(`UPDATE public.specialist_practical_benchmark_runs
        SET active_case_index=$2 WHERE id=$1`,[run.id,current+1]);
    }else{
      if(current!==PRACTICAL_BENCHMARK_CASE_COUNT)
        throw fail(409,"All three fixed cases must be revealed before ending the recording.");
      await client.query(
        `UPDATE public.specialist_practical_benchmark_runs
          SET active_case_index=4,status='complete',completed_at=now()
          WHERE id=$1`,[run.id],
      );
    }
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error}
  finally{client.release()}
  const result=await findRun(input,eligibility.attemptNumber);
  if(!result)throw fail(500,"Benchmark advancement could not be read back.");
  return view(result);
}

export async function requireCompletedBenchmark(input:RunInput & {
  attemptNumber:number;runId:string;recordingDurationSeconds:number;
}) {
  const run=await findRun(input,input.attemptNumber);
  if(!run || run.id!==input.runId || run.status!=="complete"
     || Number(run.bank_version)!==PRACTICAL_BENCHMARK_VERSION)
    throw fail(409,"A completed, matching, current-bank Practical is required.");
  const recorded=await pool.query(
    `SELECT case_key,case_version FROM public.specialist_practical_benchmark_case_reveals
     WHERE run_id=$1 ORDER BY case_sequence`,[run.id],
  );
  const canonical=getPracticalBenchmarkCaseKeys(input.proofKey);
  if(recorded.rows.length!==PRACTICAL_BENCHMARK_CASE_COUNT ||
      recorded.rows.some((r,index)=>r.case_key!==canonical[index] || Number(r.case_version)!==PRACTICAL_BENCHMARK_VERSION))
    throw fail(409,"The full shared three-case benchmark record is missing or mismatched.");

  const actions=await pool.query(
    `SELECT e.case_sequence,
       jsonb_array_length(e.case_snapshot->'workflowSteps') AS required,
       (SELECT COUNT(*)::int FROM public.specialist_practical_case_actions a
        WHERE a.run_id=e.run_id AND a.case_sequence=e.case_sequence) AS recorded
      FROM public.specialist_practical_benchmark_case_reveals e
      WHERE e.run_id=$1 ORDER BY e.case_sequence`,[run.id]);
  if(actions.rows.length!==3||actions.rows.some(a=>!Number(a.required)||Number(a.recorded)!==Number(a.required)))
    throw fail(409,"Every assigned Practical must contain a complete, durable RI-OS execution trail before video submission.");
  const startedMs=new Date(run.started_at).getTime();
  const completedMs=new Date(run.completed_at||"").getTime();
  const elapsedSeconds=Math.ceil((completedMs-startedMs)/1000);
  // The original recording must cover the full server-issued sequence.
  // Additional setup or justified explanation time is not itself a failure.
  if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<=0
     || !Number.isSafeInteger(input.recordingDurationSeconds)
     || input.recordingDurationSeconds<elapsedSeconds)
    throw fail(409,"The declared continuous recording duration does not cover the system-issued assessment interval.");
  return {runId:run.id,caseKeys:canonical,elapsedSeconds};
}

export async function getBenchmarkRunForTd(runId:string,tutorAssignmentId:string,tutorId:string) {
  const r=await pool.query(
    `${sqlRun} WHERE id=$1 AND tutor_assignment_id=$2 AND tutor_id=$3 LIMIT 1`,
    [runId,tutorAssignmentId,tutorId],
  );
  if(!r.rows.length)throw fail(404,"This system-issued benchmark does not exist.");
  return view(r.rows[0] as RunRow,true);
}
