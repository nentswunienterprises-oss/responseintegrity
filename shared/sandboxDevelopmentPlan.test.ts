import assert from 'node:assert/strict';
import test from 'node:test';
import { SANDBOX_DEVELOPMENT_PLAN_V1 as marker, advanceSandboxDevelopment, hasSandboxDevelopmentPlan, sandboxDevelopmentLessons } from './sandboxDevelopmentPlan';
import { resolveSandboxBehaviorProfile, SANDBOX_BEHAVIOR_PROFILE_IDS_V1, selectSandboxBehaviorProfileSeed } from './sandboxBehaviorProfiles';
import { selectSandboxOutcome, evaluateSandboxCompletedSession, nextSandboxContinuityState, compareSandboxTurn, type SandboxOutcomeDefinition, type SandboxCompletedTurn } from './sandboxEnvironment';
import { getDrillSchemaDefinition, getFieldDefinitionsForRep, getEvidenceSelectionIdentity, resolveEvidenceSelection } from './responseIntegrityDrillRegistry';
import { type TopicPhase } from './topicConditioningEngine';
import { DIAGNOSIS_PROBES, evaluateEvidenceCompleteDiagnosis, type DiagnosisProbeId } from './evidenceCompleteDiagnosis';
import { DIAGNOSIS_OBSERVATION_MATRIX } from './diagnosisObservationMatrix';
import { buildSandboxDiagnosisProbeResult, rebuildSandboxDiagnosisState, selectSandboxDiagnosisOutcome, type SandboxDiagnosisOutcomeDefinition } from './sandboxDiagnosisEnvironment';

// Public observation-contract fixtures only: no private bank content or seeds.
const phases: TopicPhase[] = ['Clarity','Structured Execution','Controlled Discomfort','Time Pressure Stability'];
const classes = ['supported','near_stable','conditional','breakdown'] as const;
const seedFor = (profile: string) => {
 for(let i=0;i<10000;i++) if(resolveSandboxBehaviorProfile(`development-test-${i}`)===profile) return `development-test-${i}`;
 throw new Error('Missing generic profile seed');
};
function outcomesFor(phase: TopicPhase, setId: string, rep: number): SandboxOutcomeDefinition[] {
 const schema=getDrillSchemaDefinition('training',phase),set=schema.sets.find(s=>s.setId===setId)!;
 return classes.map((cls,i)=>({key:`${setId}.rep_${rep}.pattern_${[1,2,3,5][i]}`,version:1,phase,setId,repNumber:rep,
  studentBehavior:'Generic public-contract test response.',trajectoryClass:cls,weight:1,
  canonicalPrerequisiteSentinel:'held',
  canonicalObservations:Object.fromEntries(getFieldDefinitionsForRep(set,rep-1).map(field=>{
   const index=field.optionLabels!.findIndex((_,index)=>{
    const identity=getEvidenceSelectionIdentity({mode:'training',phase,setName:set.setName,repIndex:rep-1,fieldKey:field.fieldKey,optionIndex:index})!;
    return resolveEvidenceSelection({mode:'training',phase,setId,repIndex:rep-1,fieldKey:field.fieldKey,optionId:identity.optionId,schemaVersion:schema.schemaVersion})?.evidenceClass===cls;
   });
   assert.ok(index>=0,`${phase} ${field.fieldKey} ${cls}`);
   const id=getEvidenceSelectionIdentity({mode:'training',phase,setName:set.setName,repIndex:rep-1,fieldKey:field.fieldKey,optionIndex:index})!;
   return [field.fieldKey,{optionId:id.optionId,evidenceStatus:'observed' as const}];
  })),
 }));
}
function runLesson(input:{seed:string; phase:TopicPhase; state:any; tags:string[]; previous:any; session:number; sequence:number}) {
 let {tags,previous,sequence}=input; const turns:SandboxCompletedTurn[]=[];
 const sets=getDrillSchemaDefinition('training',input.phase).sets.filter(s=>!s.modelingOnly);
 const count=sets.reduce((n,s)=>n+s.reps,0);
 for(const set of sets) for(let rep=1;rep<=set.reps;rep++) {
  const outcome=selectSandboxOutcome({seed:input.seed,outcomes:outcomesFor(input.phase,set.setId,rep),context:{
   behaviorModelVersion:2,canonicalPhase:input.phase,canonicalStability:input.state.stability,prescribedPhase:input.phase,
   setId:set.setId,repNumber:rep,sequenceNumber:++sequence,previousTrajectoryClass:previous,continuityTags:tags,
   developmentTopicKey:'test topic',developmentRepIndex:turns.length,earliestUnsupportedCapability:'observation_integrity',
  }});
  const turn:SandboxCompletedTurn={sequenceNumber:sequence,sessionNumber:input.session,phase:input.phase,setId:set.setId,repNumber:rep,
   outcome,actualInterventionEvent:'none',recordedInterventionEvent:'none',conditionConformed:true,
   specialistObservations:structuredClone(outcome.canonicalObservations),specialistPrerequisiteSentinel:'held'};
  turns.push(turn); previous=outcome.trajectoryClass;
  tags=nextSandboxContinuityState({currentTags:tags,outcome}).continuityTags;
  tags=advanceSandboxDevelopment({tags,topic:'test topic',phase:input.phase,conditionKept:true,lessonCompleted:turns.length===count});
 }
 const result=evaluateSandboxCompletedSession({phase:input.phase,canonicalPreviousStability:input.state.stability,
  specialistPreviousStability:input.state.stability,canonicalPreviousProgressionAuthority:input.state.progressionAuthority,
  specialistPreviousProgressionAuthority:input.state.progressionAuthority,turns,priorCompletedSessions:input.session-1,priorTracksDiverged:false});
 return {tags,previous,sequence,result,turns};
}

test('all six profiles reach each subsequent phase through the unchanged evaluator',()=>{
 for(const profile of SANDBOX_BEHAVIOR_PROFILE_IDS_V1) {
  let tags=[marker],previous:any=null,sequence=0,session=0;
  for(const phase of phases) {
   let state:any={phase,stability:'Low',progressionAuthority:'building'}; let reached=false;
   for(let lesson=0;lesson<6;lesson++) {
    const run=runLesson({seed:seedFor(profile),phase,state,tags,previous,sequence,session:++session});
    ({tags,previous,sequence}=run);state=run.result.canonicalNext;
    assert.equal(run.result.systemOutcomeMatched,true);
    assert.equal(run.result.canonicalRoute.route,'normal_training');
    if(state.phase!==phase || state.progressionAuthority==='transfer_maintenance'){reached=true;break;}
   }
   assert.ok(reached,`${profile} must develop through ${phase}, got ${JSON.stringify(state)}`);
  }
 }
});

test('weakness is phase-specific, recoverable and independent of seed luck or key names',()=>{
 for(const profile of ['pressure_fragile','reassurance_seeker']) for(let seedIndex=0;seedIndex<25;seedIndex++) {
  const seed=selectSandboxBehaviorProfileSeed({baseSeed:`case-${seedIndex}`,existingSeeds:[],preferredProfiles:[profile as any]});
  const phase:TopicPhase=profile==='pressure_fragile'?'Time Pressure Stability':'Structured Execution';
  const set=getDrillSchemaDefinition('training',phase).sets.find(s=>!s.modelingOnly)!;
  const matrix=outcomesFor(phase,set.setId,1);
  for(const renamed of [false,true]) {
   const outcome=selectSandboxOutcome({seed,outcomes:matrix.map((o,i)=>({...o,key:renamed?`unrelated-name-${i}`:o.key})),context:{
    canonicalPhase:phase,canonicalStability:'Low',prescribedPhase:phase,setId:set.setId,repNumber:1,sequenceNumber:1,
    behaviorModelVersion:2,continuityTags:[marker],developmentTopicKey:'test topic',developmentRepIndex:0,
   }});
   assert.equal(outcome.trajectoryClass,'conditional');
  }
 }
});

test('incomplete or contaminated delivery cannot accumulate learning; topics remain isolated',()=>{
 let tags=[marker];
 tags=advanceSandboxDevelopment({tags,topic:'A',phase:'Clarity',conditionKept:false,lessonCompleted:false});
 assert.equal(sandboxDevelopmentLessons(tags,'A','Clarity'),0);
 tags=advanceSandboxDevelopment({tags,topic:'A',phase:'Clarity',conditionKept:true,lessonCompleted:true});
 assert.equal(sandboxDevelopmentLessons(tags,'A','Clarity'),0);
 tags=advanceSandboxDevelopment({tags,topic:'A',phase:'Clarity',conditionKept:true,lessonCompleted:true});
 assert.equal(sandboxDevelopmentLessons(tags,'A','Clarity'),1);
 assert.equal(sandboxDevelopmentLessons(tags,'B','Clarity'),0);
 assert.equal(sandboxDevelopmentLessons(tags,'A','Structured Execution'),0);
 assert.deepEqual(advanceSandboxDevelopment({tags:[],topic:'A',phase:'Clarity',conditionKept:true,lessonCompleted:true}),[]);
 assert.throws(()=>hasSandboxDevelopmentPlan(['sandbox-development-plan:v999']),/Unsupported/);
});

test('planned conduct does not award accurate observations or conceal an error',()=>{
 const run=runLesson({seed:seedFor('quietly_strong'),phase:'Clarity',state:{stability:'Low',progressionAuthority:'building'},tags:[marker],previous:null,session:1,sequence:0});
 const turn=structuredClone(run.turns[0]);const key=Object.keys(turn.specialistObservations)[0];
 turn.specialistObservations[key].optionId='wrong-option';
 assert.equal(compareSandboxTurn(turn).observationExact,false);
});

test('missing compatible scenes fail explicitly rather than fabricate stronger evidence',()=>{
 const phase='Clarity',set=getDrillSchemaDefinition('training',phase).sets.find(s=>!s.modelingOnly)!;
 assert.throws(()=>selectSandboxOutcome({seed:seedFor('quietly_strong'),outcomes:outcomesFor(phase,set.setId,1).filter(o=>o.trajectoryClass!=='supported'),context:{
  canonicalPhase:phase,canonicalStability:'Low',prescribedPhase:phase,setId:set.setId,repNumber:1,sequenceNumber:1,behaviorModelVersion:2,
  continuityTags:[marker],developmentTopicKey:'test topic',developmentRepIndex:0,
 }}),/no compatible supported/);
});

test('Diagnosis shares profile strengths and weakness without overriding its placement evaluator',()=>{
 const seed=seedFor('pressure_fragile');
 for(const probeId of ['clarity.recognition','execution.repeatability','time.consistency'] as DiagnosisProbeId[]) {
  const probe=DIAGNOSIS_PROBES[probeId];
  const outcomes:SandboxDiagnosisOutcomeDefinition[]=classes.map((cls,i)=>({
   key:`generic-${probeId}-${i}`,version:1,probeId,studentBehavior:'Generic public-contract diagnosis.',trajectoryClass:cls,weight:1,simulatedElapsedSeconds:48,
   canonicalObservations:probe.dimensions.map(d=>({dimensionId:d,behaviorId:DIAGNOSIS_OBSERVATION_MATRIX[d].options.find(o=>o.behaviorClass===cls)!.id})),
  }));
  const selected=selectSandboxDiagnosisOutcome({seed,profileSeed:seed,outcomes,context:{startingPhase:'Clarity',probeId,sequenceNumber:1,behaviorModelVersion:2,continuityTags:[marker],developmentTopicKey:'test topic'}});
  assert.equal(selected.trajectoryClass,probe.primaryPhase==='Time Pressure Stability'?'conditional':'supported');
 }
});


test('native Diagnosis establishes the missing profile phases through observed probes',()=>{
 for(const profile of ['reassurance_seeker','pressure_fragile']) {
  const seed=seedFor(profile),history:any[]=[];
  let decision=evaluateEvidenceCompleteDiagnosis(rebuildSandboxDiagnosisState({startingPhase:'Clarity',history}));
  for(let i=0;i<20 && !decision.complete;i++) {
   assert.ok(decision.nextProbeId,JSON.stringify(decision));
   const probeId=decision.nextProbeId!,probe=DIAGNOSIS_PROBES[probeId];
   const outcomes:SandboxDiagnosisOutcomeDefinition[]=classes.map((cls,index)=>({
    key:`public-contract-${probeId}-${index}`,version:1,probeId,studentBehavior:'Generic public-contract diagnosis.',trajectoryClass:cls,weight:1,simulatedElapsedSeconds:48,
    canonicalObservations:probe.dimensions.map(d=>({dimensionId:d,behaviorId:DIAGNOSIS_OBSERVATION_MATRIX[d].options.find(o=>o.behaviorClass===cls)!.id})),
   }));
   let outcome=selectSandboxDiagnosisOutcome({seed,profileSeed:seed,outcomes,context:{startingPhase:'Clarity',probeId,sequenceNumber:i+1,behaviorModelVersion:2,continuityTags:[marker],developmentTopicKey:'test topic'}});
   // Match the native independent-only protocol: it cannot establish an
   // unelicited explanation, even when the student solves independently.
   if(probeId==='stack.normal_independent')outcome={...outcome,canonicalObservations:outcome.canonicalObservations.map(o=>['clarity.vocabulary','clarity.reason'].includes(o.dimensionId)?{...o,behaviorId:'not_observed'}:o)};
   history.push(buildSandboxDiagnosisProbeResult({outcome,observations:outcome.canonicalObservations,supportEvent:'none',sequenceNumber:i+1,timingBaselineSeconds:decision.timingBaseline.baselineSeconds}));
   decision=evaluateEvidenceCompleteDiagnosis(rebuildSandboxDiagnosisState({startingPhase:'Clarity',history}));
  }
  assert.equal(decision.complete,true,profile);
  assert.equal(decision.placementPhase,profile==='pressure_fragile'?'Time Pressure Stability':'Structured Execution',JSON.stringify(decision));
 }
});
