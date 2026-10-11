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

async function eligibleAttempt(input:RunInput) {
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
  return {allowed:true,reason:null,attemptNumber:Number(latest?.attempt_number||0)+1,version:definition.version};
}

async function findRun(input:RunInput,attemptNumber:number) {
  const r=await pool.query(
    `${sqlRun} WHERE tutor_assignment_id=$1 AND tutor_id=$2 AND proof_key=$3
      AND proof_version=$4 AND attempt_number=$5 LIMIT 1`,
    [input.tutorAssignmentId,input.tutorId,input.proofKey,
     getCapabilityPracticalProofDefinition(input.proofKey)!.version,attemptNumber]);
  return (r.rows[0]||null) as RunRow|null;
}
async function view(run:RunRow) {
  const result=await pool.query(
    `SELECT case_sequence,case_key,case_version,case_snapshot,revealed_at
     FROM public.specialist_practical_benchmark_case_reveals
     WHERE run_id=$1 ORDER BY case_sequence`,[run.id],
  );
  const cases=result.rows.map(row=>({
    ...row.case_snapshot,
    caseKey:String(row.case_key),
    sequence:Number(row.case_sequence),
    caseVersion:Number(row.case_version),
    revealedAt:row.revealed_at,
  }));
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

  const startedMs=new Date(run.started_at).getTime();
  const completedMs=new Date(run.completed_at||"").getTime();
  const elapsedSeconds=Math.ceil((completedMs-startedMs)/1000);
  // The externally recorded video must include the entire issued-assessment
  // interval. 180 seconds is the maximum preflight/outro overhead; it cannot
  // disguise lengthy unobserved gaps or convert edited footage into a pass.
  if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<=0
     || input.recordingDurationSeconds<elapsedSeconds
     || input.recordingDurationSeconds>elapsedSeconds+180)
    throw fail(409,"The declared continuous recording duration does not cover the system-issued assessment interval.");
  return {runId:run.id,caseKeys:canonical,elapsedSeconds};
}

export async function getBenchmarkRunForTd(runId:string,tutorAssignmentId:string,tutorId:string) {
  const r=await pool.query(
    `${sqlRun} WHERE id=$1 AND tutor_assignment_id=$2 AND tutor_id=$3 LIMIT 1`,
    [runId,tutorAssignmentId,tutorId],
  );
  if(!r.rows.length)throw fail(404,"This system-issued benchmark does not exist.");
  return view(r.rows[0] as RunRow);
}
