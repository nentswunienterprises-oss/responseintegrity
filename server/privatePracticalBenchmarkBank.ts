import { pool } from "./db";
import { PRACTICAL_BENCHMARK_CASE_COUNT, PRACTICAL_BENCHMARK_VERSION, type PracticalBenchmarkProof } from "@shared/practicalBenchmarkPolicy";
import type { IssuedPracticalBenchmarkCase } from "./practicalBenchmarkBank";
import type { PracticalWorkStep } from "./practicalCasePlans";

const fail=(message:string)=>Object.assign(new Error(message),{status:409});
const allowedOperations=new Set(["configure","respond","begin_rep","rep","adaptive","decide"]);
const phases=new Set(["Clarity","Structured Execution","Controlled Discomfort","Time Pressure Stability"]);

/** Fixed cross-Specialist difficulty coverage. Case content remains private. */
export const PRACTICAL_PRIVATE_PHASE_MATRIX:Record<PracticalBenchmarkProof,readonly string[]>={
  prepare:["Clarity","Structured Execution","Time Pressure Stability"],
  execute:["Clarity","Controlled Discomfort","Time Pressure Stability"],
  evidence:["Structured Execution","Controlled Discomfort","Time Pressure Stability"],
};
const observedSupports=new Set(["none","first_step_confirmation","method_or_step_prompt","unobserved","timer_interrupted"]);
function isSuitableSet(id:string|undefined,phase:string|undefined){
  if(!id||!phase)return false;
  const known:Record<string,readonly string[]>={
    "Clarity":["clarity.identification"],
    "Structured Execution":["structured_execution.independent_execution"],
    "Controlled Discomfort":["controlled_discomfort.no_rescue"],
    "Time Pressure Stability":["time_pressure.structure_under_timer"],
  };
  return Boolean(known[phase]?.includes(id));
}
/**
 * Every sealed case must contain the minimum real operating cycle. No case can
 * be made artificially easier with 'configure+decide' or free-text narration.
 * Each rep is started in its own persisted timestamped operation before any
 * canonical synthetic student work is revealed.
 */
export function assertPracticalCaseExecutable(steps:readonly PracticalWorkStep[],
  proof:PracticalBenchmarkProof,phase:string,sequence:number){
  const invalid=()=>{throw fail("A private Practical case lacks a complete, comparable executable operating sequence.");};
  if(steps.length<4||steps.length>30||steps[steps.length-1].kind!=="decide")invalid();
  if(proof!=="evidence" && (steps[0].kind!=="configure"||
      !steps.some(s=>s.kind==="respond"||s.kind==="adaptive")))invalid();
  if(proof==="evidence" && steps.some(s=>s.kind==="configure"||s.kind==="adaptive"))invalid();
  const observations=steps.filter(s=>s.kind==="rep");
  if(observations.length<(proof==="evidence"?2:1))invalid();
  const unique=new Set<number>();
  for(let i=0;i<steps.length;i++){
    const item=steps[i];
    if(item.kind==="configure"){
      if(!isSuitableSet(item.setId,item.phase) || (item.phase!==phase &&
        !(proof==="prepare"&&sequence===3&&item.phase==="Structured Execution")))invalid();
    }
    if(item.kind==="respond"&&(!item.studentBehavior||item.studentBehavior.length<20))invalid();
    if(item.kind==="rep"){
      const previous=steps[i-1];
      if(!Number.isInteger(item.repNumber)||!item.repNumber||item.repNumber<1||item.repNumber>9
         ||!isSuitableSet(item.setId,item.phase)
         ||(item.phase!==phase && !(proof==="prepare"&&sequence===3&&item.phase==="Structured Execution"))
         ||!observedSupports.has(String(item.observedSupport))
         ||!item.studentBehavior||item.studentBehavior.trim().length<20
         ||!previous||previous.kind!=="begin_rep"
         ||previous.repNumber!==item.repNumber
         ||previous.phase!==item.phase||previous.setId!==item.setId
         ||unique.has(item.repNumber))invalid();
      unique.add(item.repNumber);
    }
    if(item.kind==="begin_rep"&&steps[i+1]?.kind!=="rep")invalid();
  }
  if(proof==="execute"&&sequence===2){
    if(steps.filter(s=>s.kind==="adaptive").length!==1)invalid();
  }else if(steps.some(s=>s.kind==="adaptive"))invalid();
}

/**
 * The actual qualification cases must NOT be stored in this public GitHub
 * repository. Every bank row is authored privately and remains immutable in
 * Postgres, including the scenario, canonical drill truth, and live steps.
 * Published TypeScript sample cases are development fixtures, never live.
 */
export function validatePrivatePracticalBankSnapshot(input:unknown,proof:PracticalBenchmarkProof,
  bankVersion:number,sequence:number):IssuedPracticalBenchmarkCase {
  if(!input||typeof input!=="object"||Array.isArray(input))
    throw fail("The sealed private Practicals case snapshot is missing.");
  const value=input as Record<string,any>;
  // The public prototype's exact nine case IDs may not be reused even if a
  // private author mistakenly copies its published prompts into Postgres.
  const publicPrototypeIds=new Set([
    "prepare.clarity_entry","prepare.structured_execution","prepare.tps_baseline",
    "execute.clarity_ambiguity","execute.controlled_discomfort","execute.tps_interruption",
    "evidence.assistance","evidence.not_observed","evidence.phase_exit",
  ]);
  if(publicPrototypeIds.has(String(value.caseKey)))
    throw fail("A public prototype case cannot qualify as an unseen private assessment.");
  if(typeof value.caseKey!=="string"||!value.caseKey.startsWith(proof+".")
      ||!Number.isInteger(value.caseVersion)||value.caseVersion!==bankVersion
      ||value.sequence!==sequence||!phases.has(String(value.phase))
      ||value.fictionalOnly!==true
      ||!["title","situation","systemDirection","liveDemonstration","assessedCapability"]
         .every(key=>typeof value[key]==="string"&&value[key].trim().length>=12))
    throw fail("Private Practicals case identity or content does not match the issued bank.");
  const steps=value.workflowSteps;
  if(!Array.isArray(steps)||steps.length<4||steps.length>30
    ||steps.some((s:unknown)=>!s||typeof s!=="object"||Array.isArray(s)
       ||!allowedOperations.has(String((s as any).kind))
       ||typeof (s as any).prompt!=="string"||(s as any).prompt.trim().length<12
       ||typeof (s as any).label!=="string"||(s as any).label.trim().length<8
       ||((s as any).phase!==undefined&&!phases.has(String((s as any).phase)))))
    throw fail("Sealed Practicals workflow is missing valid, executable server operations.");
  if(value.phase!==PRACTICAL_PRIVATE_PHASE_MATRIX[proof]?.[sequence-1])
    throw fail("Private case phase coverage does not match the fixed comparison standard.");
  assertPracticalCaseExecutable(steps as PracticalWorkStep[],proof,String(value.phase),sequence);
  return value as IssuedPracticalBenchmarkCase;
}

export async function loadPrivatePracticalBank(
  proof:PracticalBenchmarkProof,
  bankVersion=PRACTICAL_BENCHMARK_VERSION,
):Promise<IssuedPracticalBenchmarkCase[]>{
  // This is an intentionally fail-closed source. There is no fallback to the
  // published nine-case sample bank, including on preview or Production.
  const query=await pool.query(
    `SELECT case_sequence,case_key,case_version,case_snapshot
       FROM private.specialist_practical_benchmark_private_cases
      WHERE proof_key=$1 AND bank_version=$2 ORDER BY case_sequence`,
    [proof,bankVersion]);
  if(query.rows.length!==PRACTICAL_BENCHMARK_CASE_COUNT)
    throw fail("The confidential Practicals assessment bank is not provisioned; published sample cases cannot qualify Specialists.");
  const cases=query.rows.map((row,index)=>{
    if(Number(row.case_sequence)!==index+1||Number(row.case_version)!==bankVersion)
      throw fail("The private Practicals bank has a missing or inconsistent sequence.");
    const value=validatePrivatePracticalBankSnapshot(row.case_snapshot,proof,bankVersion,index+1);
    if(value.caseKey!==String(row.case_key))
      throw fail("The private Practicals case identity differs from its sealed manifest.");
    return value;
  });
  if(new Set(cases.map(x=>x.caseKey)).size!==PRACTICAL_BENCHMARK_CASE_COUNT)
    throw fail("The private Practicals bank includes repeated case identities.");
  return cases;
}
export async function assertPrivatePracticalCaseSnapshot(input:{
  proofKey:PracticalBenchmarkProof;bankVersion:number;
  caseSequence:number;caseKey:string;caseSnapshot:unknown;
}) {
 const bank=await loadPrivatePracticalBank(input.proofKey,input.bankVersion);
 const expected=bank[input.caseSequence-1];
 if(!expected||expected.caseKey!==input.caseKey
    ||JSON.stringify(expected)!==JSON.stringify(input.caseSnapshot))
    throw fail("The immutable issued case differs from its privately stored assessment source.");
 return expected.workflowSteps;
}
