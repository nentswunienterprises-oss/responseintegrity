import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { runNativeFirstClarityRep } from "./sandboxQualificationNativeFirstClarityRep.mjs";

const sha="c".repeat(40);
const behavior="The synthetic student identifies the correct method, explains why it applies, and begins working independently.";
const behaviorSha256=createHash("sha256").update(behavior).digest("hex");
function env(scope="CONTROLLED_PROOF_FIRST_CLARITY_REP_SUBMIT"){
  return {
    RI_PROOF_NATIVE_REP_SCOPE:scope,PROOF_BASE_URL:"https://protected-proof.vercel.app/",
    PROOF_EXPECTED_SHA:sha,RI_PROOF_SPECIALIST_EMAIL:"specialist@example.test",
    RI_PROOF_SPECIALIST_PASSWORD:"not-a-secret",RI_PROOF_TD_EMAIL:"td@example.test",
    RI_PROOF_TD_PASSWORD:"not-a-secret",RI_PROOF_TUTOR_ID:"specialist",
    RI_PROOF_STUDENT_ID:"synthetic-student",
    RI_PROOF_SESSION_ID:"00000000-0000-4000-8000-000000000001",
    RI_PROOF_TOPIC:"QA Clarity",VERCEL_AUTOMATION_BYPASS_SECRET:"test-only",
  };
}
function decision(changes={}){
  return {
    evidenceBasis:"visible_simulated_behavior_only",behaviorSha256,
    bankVersion:1,eventFormId:"current-form",eventSequence:1,
    trajectoryId:"trajectory-1",sessionNumber:1,repNumber:1,
    setId:"clarity.identification",interventionEvent:"none",
    observations:{
      "method_identification":{
        optionId:"method-affirmative",evidenceStatus:"observed",
        observationReason:"The visible response identifies a method without assistance.",
      },
      "method_explanation":{
        optionId:"explanation-affirmative",evidenceStatus:"observed",
        observationReason:"The visible response supplies an independent reason for the method.",
      },
    },
    ...changes,
  };
}
function harness({wrongSha=false,verified=true,wrongRole=false,prepRecorded=true,
  repStarted=false,oneRepSession=false,incorrect=false,deniedTd=false}={}){
  let event=null;
  let repWrites=0;
  const requests=[];
  const fields=[
    {fieldKey:"method_identification",options:[
      {optionId:"method-affirmative",label:"Identifies method"},
      {optionId:"method-negative",label:"Cannot identify method"}]},
    {fieldKey:"method_explanation",options:[
      {optionId:"explanation-affirmative",label:"Explains why"},
      {optionId:"explanation-negative",label:"Cannot explain why"}]},
  ];
  function json(value,status=200,cookie=null){
    return new Response(JSON.stringify(value),{status,headers:{
      "content-type":"application/json",
      ...(cookie?{"set-cookie":"session="+cookie+"; HttpOnly; Secure"}:{}),
    }});
  }
  async function fetchFake(url,options={}){
    const path=new URL(url).pathname;
    const cookie=String(options.headers?.cookie||"");
    const method=options.method||"GET";
    const data=options.body?JSON.parse(options.body):null;
    requests.push({path,method,cookie,data,options});
    if(path==="/api/proof-environment")return json({
      vercelEnv:"preview",supabaseProjectRef:"jftlxeacphvbnhbsbpxc",
      commitSha:wrongSha?"b".repeat(40):sha,
    });
    if(path==="/api/auth/signin"){
      const role=data.expectedRole;
      return json({dbUser:{role:wrongRole?"parent":role,
        id:role==="tutor"?"specialist":"td"}},200,role);
    }
    if(path==="/api/tutor/runtime-mode")
      return json({operationalMode:"sandbox",assignmentId:"assignment"});
    if(path==="/api/td/tutors/specialist/sandbox-qualification-review"){
      if(cookie.includes("tutor")||deniedTd)return json({},403);
      return json({tutorAssignmentId:"assignment",tutorId:"specialist",
        qualification:{qualificationReady:false}});
    }
    if(path==="/api/tutor/sandbox-environment/preparation-plan")
      return json({captureActive:true,preparationRecorded:prepRecorded,
        sessionNumber:1,prescribedPhase:"Clarity",completedReps:0});
    if(path==="/api/tutor/sandbox-environment/history")
      return json({trajectory:{id:"trajectory-1",sessionNumber:1,
          completedRepCount:repStarted?1:event?1:0},
        events:event?[event]:[],sessions:[]});
    if(path==="/api/tutor/sandbox-environment"&&method==="GET")
      return json({status:"rep_ready",prescribedPhase:"Clarity",
        sessionNumber:1,bankVersion:1,trajectoryId:"trajectory-1",
        eventSequence:1,eventFormId:"current-form",
        preparationCaptureEnabled:true,preparationRecorded:prepRecorded,
        sessionProgress:{completedReps:repStarted?1:0,totalReps:oneRepSession?1:8},
        rep:{setId:"clarity.identification",repNumber:1,
          studentBehavior:behavior,fields,
          interventionOptions:[{id:"none",label:"No intervention"}],
          inheritedRescueSignal:null,prerequisiteSentinel:null}});
    if(path==="/api/tutor/sandbox-environment/rep"&&method==="POST"){
      repWrites++;
      assert.equal(cookie.includes("tutor"),true);
      assert.deepEqual(Object.keys(data.submission.observations).sort(),
        fields.map(x=>x.fieldKey).sort());
      event={id:"persisted-native-rep",eventSequence:1,sessionNumber:1,
        phase:"Clarity",setId:"clarity.identification",
        observationExact:!incorrect,evidenceExact:!incorrect,conditionKept:true};
      return json({eventId:event.id,eventSequence:1,sessionNumber:1,
        repNumber:1,phase:"Clarity",setId:event.setId,
        sessionCompleted:false,studentStateAuthoritative:false,
        evidenceScope:"sandbox",observationExact:!incorrect,evidenceExact:!incorrect,
        conditionKept:true,totalObservations:2,matchingObservations:incorrect?1:2},201);
    }
    throw Error("Unexpected route/method: "+path+" "+method);
  }
  return {fetchFake,requests,get writes(){return repWrites}};
}

test("scope enforcement is before any network or write",async()=>{
  const s=harness();const e=env();e.RI_PROOF_NATIVE_REP_SCOPE="ANY_WRITE";
  await assert.rejects(runNativeFirstClarityRep(e,s.fetchFake,()=>{}),/narrowly scoped/);
  assert.equal(s.requests.length,0);
});
test("read-only inspect reports form metadata but does not reveal student behavior or options",async()=>{
  const s=harness();const logs=[];
  const result=await runNativeFirstClarityRep(
    env("CONTROLLED_PROOF_FIRST_CLARITY_REP_INSPECT"),s.fetchFake,s=>logs.push(s));
  assert.equal(result.mode,"inspect");assert.equal(s.writes,0);
  assert.match(logs.join(" "),/READ_ONLY_FIRST_REP_INTAKE=PASS/);
  assert.ok(!logs.join(" ").includes(behavior));
  assert.ok(!logs.join(" ").includes("method-affirmative"));
});
test("wrong Preview commit and wrong login role cannot submit",async()=>{
  for(const opts of [{wrongSha:true},{wrongRole:true},{deniedTd:true}]){
    const s=harness(opts);const e=env();
    e.RI_PROOF_FIRST_REP_DECISION_JSON=JSON.stringify(decision());
    await assert.rejects(runNativeFirstClarityRep(e,s.fetchFake,()=>{}));
    assert.equal(s.writes,0);
  }
});
test("stale form, wrong option, missing rationale and missing observations are rejected",async()=>{
  const variants=[
    decision({eventFormId:"stale"}),
    decision({behaviorSha256:"0".repeat(64)}),
    decision({observations:{...decision().observations,
      method_identification:{...decision().observations.method_identification,optionId:"wrong"}}}),
    decision({observations:{...decision().observations,
      method_identification:{...decision().observations.method_identification,observationReason:"guess"}}}),
    decision({observations:{method_identification:decision().observations.method_identification}}),
  ];
  for(const manifest of variants){
    const s=harness();const e=env();e.RI_PROOF_FIRST_REP_DECISION_JSON=JSON.stringify(manifest);
    await assert.rejects(runNativeFirstClarityRep(e,s.fetchFake,()=>{}));
    assert.equal(s.writes,0);
  }
});
test("existing rep, absent preparation and single-rep session never mutated",async()=>{
  for(const opts of [{repStarted:true},{prepRecorded:false},{oneRepSession:true}]){
    const s=harness(opts);const e=env();e.RI_PROOF_FIRST_REP_DECISION_JSON=JSON.stringify(decision());
    await assert.rejects(runNativeFirstClarityRep(e,s.fetchFake,()=>{}));
    assert.equal(s.writes,0);
  }
});
test("native first Clarity rep writes only one observation-based rep and reads it back",async()=>{
  const s=harness();const e=env();e.RI_PROOF_FIRST_REP_DECISION_JSON=JSON.stringify(decision());
  const logs=[];
  const r=await runNativeFirstClarityRep(e,s.fetchFake,v=>logs.push(v));
  assert.equal(r.mode,"submit");
  assert.equal(s.writes,1);
  assert.equal(s.requests.filter(r=>r.method==="POST"&&r.path==="/api/tutor/sandbox-environment/rep").length,1);
  assert.ok(!s.requests.some(r=>/\/rediagnosis$|\/sandbox-readiness-assessment$/.test(r.path)));
  assert.ok(!logs.join(" ").includes(behavior));
  assert.ok(!logs.join(" ").includes("method-affirmative"));
  assert.match(logs.join(" "),/PERSISTED_EXACT_AND_READ_BACK=PASS/);
});
test("a persisted but inaccurate rep MUST fail, and is never hidden or retried",async()=>{
  const s=harness({incorrect:true});const e=env();e.RI_PROOF_FIRST_REP_DECISION_JSON=JSON.stringify(decision());
  await assert.rejects(runNativeFirstClarityRep(e,s.fetchFake,()=>{}),/did not match canonical authority/);
  assert.equal(s.writes,1);
  assert.equal(s.requests.filter(r=>r.method==="POST"&&r.path==="/api/tutor/sandbox-environment/rep").length,1);
});
