import { pool } from "./db";
import { PRACTICAL_BENCHMARK_CASE_COUNT, PRACTICAL_BENCHMARK_VERSION, type PracticalBenchmarkProof } from "@shared/practicalBenchmarkPolicy";
import type { IssuedPracticalBenchmarkCase } from "./practicalBenchmarkBank";
import type { PracticalWorkStep } from "./practicalCasePlans";

const fail=(message:string)=>Object.assign(new Error(message),{status:409});
const allowedOperations=new Set(["configure","respond","begin_rep","rep","adaptive","decide"]);
const phases=new Set(["Clarity","Structured Execution","Controlled Discomfort","Time Pressure Stability"]);

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
  if(typeof value.caseKey!=="string"||!value.caseKey.startsWith(proof+".")
      ||!Number.isInteger(value.caseVersion)||value.caseVersion!==bankVersion
      ||value.sequence!==sequence||!phases.has(String(value.phase))
      ||value.fictionalOnly!==true
      ||!["title","situation","systemDirection","liveDemonstration","assessedCapability"]
         .every(key=>typeof value[key]==="string"&&value[key].trim().length>=12))
    throw fail("Private Practicals case identity or content does not match the issued bank.");
  const steps=value.workflowSteps;
  if(!Array.isArray(steps)||steps.length<2||steps.length>30
    ||steps.some((s:unknown)=>!s||typeof s!=="object"||Array.isArray(s)
       ||!allowedOperations.has(String((s as any).kind))
       ||typeof (s as any).prompt!=="string"||(s as any).prompt.trim().length<12
       ||typeof (s as any).label!=="string"||(s as any).label.trim().length<8
       ||((s as any).phase!==undefined&&!phases.has(String((s as any).phase)))))
    throw fail("Sealed Practicals workflow is missing valid, executable server operations.");
  if(!steps.some((s:PracticalWorkStep)=>["configure","respond","rep","adaptive"].includes(s.kind)))
    throw fail("A narrative-only case is not an executable Practical.");
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
