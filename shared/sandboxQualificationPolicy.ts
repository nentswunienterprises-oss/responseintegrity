/** RI Sandbox qualification — founder-approved October 15, 2026.
 * Training hours and profile assignments alone cannot establish capability. */
export const SANDBOX_QUALIFICATION_V1 = {
  id:"ri-sandbox-qualification",version:1,status:"approved" as const,
  minConsecutiveSessions:8,
  phaseMinimums:{"Clarity":2,"Structured Execution":2,"Controlled Discomfort":2,"Time Pressure Stability":2},
  modes:["preparation","diagnosis","training","session_closure","continuity","handover","targeted_rediagnosis"],
  profiles:["clarity_fragile","reassurance_seeker","pressure_fragile","fast_recovery","uneven_performer","quietly_strong"],
  situationMinimums:{independent_execution:2,conditional:2,breakdown:2,recovery:2,prerequisite:2,routing:2,state_change:2,timed_pressure:2},
  preparationContexts:["training","handover","targeted_rediagnosis"],
  diagnosisPhases:["Clarity","Structured Execution","Controlled Discomfort","Time Pressure Stability"],
  profileOpportunityMinimum:2,
} as const;
export type SandboxQualificationMode=typeof SANDBOX_QUALIFICATION_V1.modes[number];
export type SandboxQualificationEvidence={
  id:string;occurredAt:string;kind:"opportunity"|"session";mode:SandboxQualificationMode;
  studentId:string;trajectoryId:string;phase:string|null;profile:string|null;
  situationTags:string[];opportunityKey:string;observed:boolean;complete:boolean;
  canonicalPresent:boolean;conditionKept:boolean;observationExact:boolean;
  evidenceExact:boolean;authorityAligned:boolean;stateAligned:boolean;
  materialError:boolean;technicallyValid:boolean;sourceId:string;sourceType:string;
  /** Valid captured evidence can await placement; it never establishes completion. */
  placementPending?:boolean;
  bankVersion:number|null;outcomeVersion:number|null;
  /** The governed session context this preparation receipt belongs to. */
  preparationContext?: string;
};
export type QualificationRequirement={key:string;required:number;encountered:number;correct:number;distinctCorrect:number;priorErrors:number;recoveredAfterError:boolean;met:boolean};
export type SandboxQualificationStatus={
  policyId:string;policyVersion:number;approved:boolean;activated:boolean;
  developmentCoverageReady:boolean;qualificationReady:boolean;
  qualifyingSessions:number;requiredSessions:number;cleanSessionIds:string[];
  phaseCounts:Record<string,number>;requirements:QualificationRequirement[];
  technicalBlockers:string[];materialErrorsSinceCoverage:number;pendingPlacements?:number;
  firstCoverageEventId:string|null;reason:string;
};
const phases=Object.keys(SANDBOX_QUALIFICATION_V1.phaseMinimums);
const exact=(e:SandboxQualificationEvidence)=>e.technicallyValid&&e.complete&&
  e.canonicalPresent&&e.conditionKept&&e.observationExact&&e.evidenceExact&&
  e.authorityAligned&&e.stateAligned&&!e.materialError;
const getCoverage=(events:SandboxQualificationEvidence[])=>{
 const result:QualificationRequirement[]=[];
 const add=(key:string,required:number,match:(e:SandboxQualificationEvidence)=>boolean)=>{
  const observed=events.filter(e=>e.kind==="opportunity"&&e.observed&&match(e));
  const clean=observed.filter(exact);
  const unique=new Set(clean.map(e=>e.opportunityKey)).size;
  const priorErrors=observed.filter(e=>e.materialError).length;
  const recoveredAfterError=observed.some((e,i)=>e.materialError&&observed.slice(i+1).some(next=>
    exact(next)&&next.opportunityKey!==e.opportunityKey));
  result.push({key,required,encountered:observed.length,correct:clean.length,
    distinctCorrect:unique,priorErrors,recoveredAfterError,met:unique>=required});
 };
 for(const mode of SANDBOX_QUALIFICATION_V1.modes)add("mode:"+mode,1,e=>e.mode===mode);
 for(const context of SANDBOX_QUALIFICATION_V1.preparationContexts)
  add("preparation:"+context,1,e=>e.mode==="preparation"&&e.preparationContext===context);
 for(const phase of SANDBOX_QUALIFICATION_V1.diagnosisPhases)
  add("preparation:diagnosis:"+phase,1,e=>e.mode==="preparation"&&e.preparationContext==="diagnosis:"+phase);
 for(const profile of SANDBOX_QUALIFICATION_V1.profiles)add("profile:"+profile,2,e=>e.profile===profile&&e.situationTags.includes("profile_signature"));
 for(const [tag,min] of Object.entries(SANDBOX_QUALIFICATION_V1.situationMinimums))add("situation:"+tag,min,e=>e.situationTags.includes(tag));
 return result;
};
export function evaluateSandboxQualification(events:SandboxQualificationEvidence[],options:{activated:boolean}={activated:false}):SandboxQualificationStatus{
 const policy=SANDBOX_QUALIFICATION_V1,blockers:string[]=[];const ids=new Set<string>();
 for(const e of events){
  if(!e.id||ids.has(e.id))blockers.push("Duplicate/missing immutable evidence ID");
  ids.add(e.id);
  if(!e.studentId||!e.trajectoryId||!e.sourceId||!e.opportunityKey||!e.occurredAt||!Number.isFinite(Date.parse(e.occurredAt)))
   blockers.push("Missing source identity or chronology");
  if(!e.technicallyValid||!e.canonicalPresent||(!e.complete&&!e.placementPending))blockers.push("Missing or invalid historical evidence");
 }
 const ordered=[...events].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||
  (a.kind===b.kind?a.id.localeCompare(b.id):a.kind==="opportunity"?-1:1));
 let boundary=-1;
 for(let i=0;i<ordered.length;i++){
  if(getCoverage(ordered.slice(0,i+1)).every(r=>r.met)){boundary=i;break;}
 }
 const requirements=getCoverage(ordered);
 let clean:SandboxQualificationEvidence[]=[];let materialErrors=0;
 if(boundary>=0)for(const e of ordered.slice(boundary+1)){
  if(e.materialError){materialErrors++;clean=[];continue;}
  if(e.kind!=="session")continue;
  if(e.mode!=="training"||!phases.includes(String(e.phase))||!exact(e)){clean=[];continue;}
  clean.push(e);
 }
 const phaseCounts=Object.fromEntries(phases.map(p=>[p,clean.filter(e=>e.phase===p).length]));
 const phaseReady=phases.every(p=>phaseCounts[p]>=policy.phaseMinimums[p as keyof typeof policy.phaseMinimums]);
 const pendingPlacements=events.filter(e=>e.placementPending&&!e.complete).length;
 const qualificationReady=options.activated&&boundary>=0&&blockers.length===0&&pendingPlacements===0&&clean.length>=policy.minConsecutiveSessions&&phaseReady;
 const reason=!options.activated?"Approved qualification policy awaits controlled acceptance and activation."
  :blockers.length?"Qualification blocked by incomplete or technically invalid evidence."
  :pendingPlacements>0?"Evidence gathering awaits the prescribed continuation; placement is not complete."
  :boundary<0?"Sandbox development coverage is incomplete."
  :!phaseReady||clean.length<policy.minConsecutiveSessions?"Clean final qualification run or phase repetition is incomplete."
  :"Approved coverage and clean-run evidence established; assigned TD approval still required.";
 return {policyId:policy.id,policyVersion:policy.version,approved:true,activated:options.activated,
  developmentCoverageReady:boundary>=0,qualificationReady,qualifyingSessions:clean.length,
  requiredSessions:policy.minConsecutiveSessions,cleanSessionIds:clean.map(e=>e.id),
  phaseCounts,requirements,pendingPlacements,technicalBlockers:[...new Set(blockers)],
  materialErrorsSinceCoverage:materialErrors,firstCoverageEventId:boundary<0?null:ordered[boundary].id,reason};
}
