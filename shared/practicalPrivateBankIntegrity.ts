import type { PracticalBenchmarkProof } from "./practicalBenchmarkPolicy";

export type PracticalSecretStep=Readonly<{
  kind:string;phase?:string;setId?:string;repNumber?:number;
  studentBehavior?:string;observedSupport?:string;
}>;

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
 * Live Prepare/Execute reps begin through a separate timestamped operation.
 * Evidence reviews instead classify previously recorded fictional reps, never
 * fabricate a new rep start for historical work.
 */
export function assertPracticalCaseExecutable(steps:readonly PracticalSecretStep[],
  proof:PracticalBenchmarkProof,phase:string,sequence:number){
  const invalid=()=>{throw new Error("A private Practical case lacks a complete, comparable executable operating sequence.");};
  if(steps.length<4||steps.length>30||steps[steps.length-1].kind!=="decide")invalid();
  if(proof!=="evidence"&&steps[0].kind!=="configure")invalid();
  if(proof==="execute"&&!steps.some(s=>s.kind==="respond"||s.kind==="adaptive"))invalid();
  if(proof==="evidence" && steps.some(s=>s.kind==="configure"||s.kind==="adaptive"||s.kind==="begin_rep"))invalid();
  const observations=steps.filter(s=>s.kind==="rep");
  if(observations.length<(proof==="evidence"?3:1))invalid();
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
         ||(proof!=="evidence"&&(!previous||previous.kind!=="begin_rep"
           ||previous.repNumber!==item.repNumber
           ||previous.phase!==item.phase||previous.setId!==item.setId))
         ||unique.has(item.repNumber))invalid();
      unique.add(item.repNumber);
    }
    if(item.kind==="begin_rep"&&steps[i+1]?.kind!=="rep")invalid();
  }
  if(proof==="execute"&&sequence===2){
    if(steps.filter(s=>s.kind==="adaptive").length!==1)invalid();
  }else if(steps.some(s=>s.kind==="adaptive"))invalid();
}

