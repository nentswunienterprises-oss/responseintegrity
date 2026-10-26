import test from "node:test";
import assert from "node:assert/strict";
import {evaluateSandboxQualification,SANDBOX_QUALIFICATION_V1 as p,type SandboxQualificationEvidence as E} from "./sandboxQualificationPolicy";
const when=(n:number)=>new Date(Date.UTC(2026,9,15,0,0,n)).toISOString();
const event=(n:number,patch:Partial<E>={}):E=>({id:"event-"+n,occurredAt:when(n),kind:"opportunity",mode:"training",
 studentId:"student-"+n%3,trajectoryId:"trajectory-"+n%3,phase:"Clarity",profile:"quietly_strong",
 situationTags:["conditional"],opportunityKey:"unique-"+n,observed:true,complete:true,
 canonicalPresent:true,conditionKept:true,observationExact:true,evidenceExact:true,authorityAligned:true,
 stateAligned:true,materialError:false,technicallyValid:true,sourceId:"source-"+n,sourceType:"rep",
 bankVersion:1,outcomeVersion:1,...patch});
function coverage():E[]{let n=0;const a:E[]=[];
 for(const mode of p.modes){
  const count=mode==="diagnosis"?p.diagnosisPhases.length:1;
  for(let j=0;j<count;j++)a.push(event(++n,{mode,phase:mode==="diagnosis"?p.diagnosisPhases[j]:"Clarity",opportunityKey:"mode-"+mode+"-"+j}));
}
 for(const context of p.preparationContexts)a.push(event(++n,{mode:"preparation",preparationContext:context,opportunityKey:"prep-"+context}));
 for(const phase of p.diagnosisPhases)a.push(event(++n,{mode:"preparation",preparationContext:"diagnosis:"+phase,phase,opportunityKey:"prep-diagnosis-"+phase}));
 for(const profile of p.profiles)for(let j=0;j<2;j++)a.push(event(++n,{profile,opportunityKey:"profile-"+profile+"-"+j,situationTags:["profile_signature"]}));
 for(const [tag,min] of Object.entries(p.situationMinimums))for(let j=0;j<min;j++)a.push(event(++n,{situationTags:[tag],opportunityKey:"tag-"+tag+"-"+j}));
 return a;}
function final(n:number){const phases=Object.keys(p.phaseMinimums);return Array.from({length:8},(_,i)=>
 event(n+i,{kind:"session",phase:phases[Math.floor(i/2)]}));}
test("count alone never graduates",()=>assert.equal(evaluateSandboxQualification(final(1),{activated:true}).qualificationReady,false));
test("Diagnosis operating-mode coverage requires all four phases",()=>{const a=coverage();
 const diagnosis=evaluateSandboxQualification(a,{activated:true}).requirements.find(r=>r.key==="mode:diagnosis");
 assert.equal(diagnosis?.required,4); assert.equal(diagnosis?.distinctCorrect,4); assert.equal(diagnosis?.met,true);
});
test("coverage then eight clean sessions qualifies only when activated",()=>{const a=coverage(),data=[...a,...final(a.length+1)];
 assert.equal(evaluateSandboxQualification(data).qualificationReady,false);
 const x=evaluateSandboxQualification(data,{activated:true});assert.equal(x.developmentCoverageReady,true);
 assert.equal(x.qualifyingSessions,8);assert.equal(x.qualificationReady,true);});
test("cross-student Handover error interrupts clean run",()=>{const a=coverage(),f=final(a.length+1);
 const x=evaluateSandboxQualification([...a,...f.slice(0,7),event(a.length+8,{mode:"handover",studentId:"another",materialError:true,observationExact:false}),event(a.length+9,{kind:"session",phase:"Time Pressure Stability"})],{activated:true});
 assert.equal(x.qualifyingSessions,1);assert.equal(x.qualificationReady,false);});
test("missing truth is not attributed to Specialist but fails closed",()=>{const a=coverage(),f=final(a.length+1);f[3].canonicalPresent=false;
 const x=evaluateSandboxQualification([...a,...f],{activated:true});
 assert.equal(x.qualificationReady,false);assert.equal(x.materialErrorsSinceCoverage,0);assert.ok(x.technicalBlockers.length);});
test("unobserved or incorrectly handled profile does not count",()=>{const a=coverage();a.filter(x=>x.profile==="fast_recovery").forEach((e,i)=>{e.observed=i===0;e.observationExact=i!==0;});
 assert.equal(evaluateSandboxQualification([...a,...final(a.length+1)],{activated:true}).developmentCoverageReady,false);});
test("two clean sessions in each phase mandatory",()=>{const a=coverage(),f=final(a.length+1);f[0].phase="Structured Execution";
 assert.equal(evaluateSandboxQualification([...a,...f],{activated:true}).qualificationReady,false);});
test("duplicate immutable records cannot count",()=>{const a=coverage(),f=final(a.length+1);f[1].id=f[0].id;
 assert.equal(evaluateSandboxQualification([...a,...f],{activated:true}).qualificationReady,false);});
test("genuine student breakdown handled correctly remains clean",()=>{const a=coverage(),f=final(a.length+1);f[2].situationTags=["breakdown"];
 assert.equal(evaluateSandboxQualification([...a,...f],{activated:true}).qualificationReady,true);});

test("mere profile identity without actual observable signature is not coverage",()=>{
 const a=coverage();
 a.filter(e=>e.profile==="pressure_fragile").forEach(e=>e.situationTags=[]);
 const result=evaluateSandboxQualification([...a,...final(a.length+1)],{activated:true});
 assert.equal(result.developmentCoverageReady,false);
});

test("older incomplete evidence blocks qualification after full coverage and eight fresh clean sessions",()=>{
 const a=coverage(), f=final(a.length+1);
 const older=event(0,{mode:"targeted_rediagnosis",complete:false});
 const result=evaluateSandboxQualification([older,...a,...f],{activated:true});
 assert.equal(result.developmentCoverageReady,true);
 assert.equal(result.qualifyingSessions,8);
 assert.equal(result.qualificationReady,false);
 assert.ok(result.technicalBlockers.includes("Missing or invalid historical evidence"));
 assert.equal(older.complete,false);
});

test("later linked evidence cannot manufacture an older missing student identity",()=>{
 const a=coverage(), f=final(a.length+1);
 const older=event(0,{mode:"targeted_rediagnosis",studentId:""});
 const result=evaluateSandboxQualification([...a,...f,older],{activated:true});
 assert.equal(result.developmentCoverageReady,true);
 assert.equal(result.qualifyingSessions,8);
 assert.equal(result.qualificationReady,false);
 assert.ok(result.technicalBlockers.includes("Missing source identity or chronology"));
 assert.equal(older.studentId,"");
});

test("valid placement pending does not poison future qualification or establish coverage",()=>{
 const a=coverage(), f=final(a.length+1);
 const pending=event(0,{mode:"targeted_rediagnosis",complete:false,placementPending:true});
 const result=evaluateSandboxQualification([pending,...a,...f],{activated:true});
 assert.equal(result.qualificationReady,false);
 assert.deepEqual(result.technicalBlockers,[]);
 assert.equal(result.pendingPlacements,1);
 assert.equal(evaluateSandboxQualification([{...pending,complete:true,placementPending:false},...a,...f],{activated:true}).qualificationReady,true);
 assert.equal(evaluateSandboxQualification([pending],{activated:true}).developmentCoverageReady,false);
 assert.equal(evaluateSandboxQualification([{...pending,canonicalPresent:false},...a,...f],{activated:true}).qualificationReady,false);
 assert.equal(evaluateSandboxQualification([{...pending,studentId:""},...a,...f],{activated:true}).qualificationReady,false);
});
