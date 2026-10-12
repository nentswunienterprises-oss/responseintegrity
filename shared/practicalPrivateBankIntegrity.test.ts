import test from "node:test";
import assert from "node:assert/strict";
import { assertPracticalCaseExecutable, PRACTICAL_PRIVATE_PHASE_MATRIX, type PracticalSecretStep } from "./practicalPrivateBankIntegrity";
import type { PracticalBenchmarkProof } from "./practicalBenchmarkPolicy";

const ops=(proof:PracticalBenchmarkProof,phase:string,sequence:number):PracticalSecretStep[]=>{
 const repPhase=proof==="prepare"&&sequence===3?"Structured Execution":phase;
 const setByPhase:Record<string,string>={
  "Clarity":"clarity.identification",
  "Structured Execution":"structured_execution.independent_execution",
  "Controlled Discomfort":"controlled_discomfort.no_rescue",
  "Time Pressure Stability":"time_pressure.structure_under_timer",
 };
 const setId=setByPhase[repPhase];
 const steps:PracticalSecretStep[]=proof==="evidence"?[]:[{kind:"configure",phase:repPhase,setId}];
 if(proof==="execute")steps.push(sequence===2?{kind:"adaptive",phase}:{kind:"respond",phase,studentBehavior:"An entirely fictional learner describes the changing prompt."});
 const pair=(repNumber:number):PracticalSecretStep[]=>([
  ...(proof==="evidence"?[]:[{kind:"begin_rep",phase:repPhase,setId,repNumber}]),
  {kind:"rep",phase:repPhase,setId,repNumber,
   studentBehavior:"The simulated learner completes a fully observable fictional response.",
   observedSupport:"none"},
 ]);
 steps.push(...pair(1));
 if(proof==="evidence"){steps.push(...pair(2));steps.push(...pair(3));}
 steps.push({kind:"decide"});
 return steps;
};
test("three consistent executable cases across every Practical phase",()=>{
 for(const proof of ["prepare","execute","evidence"] as const){
  const phases=PRACTICAL_PRIVATE_PHASE_MATRIX[proof];
  assert.equal(phases.length,3);
  for(let i=0;i<3;i++)
   assert.doesNotThrow(()=>assertPracticalCaseExecutable(ops(proof,phases[i],i+1),proof,phases[i],i+1));
 }
});
test("reject spoken-only, click-through, missing rep-start, wrong set, and duplicate rep steps",()=>{
 const valid=ops("execute","Clarity",1);
 for(const invalid of [
  valid.filter(s=>s.kind!=="begin_rep"),
  valid.filter(s=>s.kind!=="rep"),
  [{kind:"configure",phase:"Clarity",setId:"clarity.identification"},{kind:"decide"}],
  valid.map(s=>s.kind==="rep"?{...s,setId:"invented.set"}:s),
  valid.map(s=>s.kind==="rep"?{...s,observedSupport:"fabricated"}:s),
  [...valid.slice(0,-1),...valid.slice(-3,-1),{kind:"decide"}],
 ])assert.throws(()=>assertPracticalCaseExecutable(invalid,"execute","Clarity",1));
});
test("only the CD Execute case can carry the three-turn adaptive student workflow",()=>{
 assert.throws(()=>assertPracticalCaseExecutable(ops("execute","Clarity",1).map(s=>s.kind==="respond"?{kind:"adaptive"}:s),"execute","Clarity",1));
 assert.throws(()=>assertPracticalCaseExecutable(ops("execute","Controlled Discomfort",2).filter(s=>s.kind!=="adaptive"),"execute","Controlled Discomfort",2));
});

test("historical evidence review records inherited reps without fabricating new start timestamps",()=>{
 const correct=ops("evidence","Structured Execution",1);
 assert.equal(correct.filter(x=>x.kind==="begin_rep").length,0);
 assert.equal(correct.filter(x=>x.kind==="rep").length,3);
 assert.doesNotThrow(()=>assertPracticalCaseExecutable(correct,"evidence","Structured Execution",1));
 assert.throws(()=>assertPracticalCaseExecutable(
  [{kind:"begin_rep",phase:"Structured Execution",setId:"structured_execution.independent_execution",repNumber:1},...correct],
  "evidence","Structured Execution",1));
});
