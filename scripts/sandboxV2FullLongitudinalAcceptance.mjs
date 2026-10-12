import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { request } from "playwright";
import { DIAGNOSIS_PROBES } from "../shared/evidenceCompleteDiagnosis.ts";
import { DIAGNOSIS_OBSERVATION_MATRIX } from "../shared/diagnosisObservationMatrix.ts";

// This script runs only against an exact immutable Capability Proof Preview.
// All exercise identities are explicitly marked synthetic in the Proof database.
const base = String(process.env.V2_PREVIEW_URL || "").trim();
const expectedSha = String(process.env.V2_PREVIEW_SHA || "").trim();
const email = String(process.env.RI_PROOF_EMAIL || "").trim();
const password = String(process.env.RI_PROOF_PASSWORD || "");
const bypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();
const assignment = "836a839f-2f29-45c7-b8c2-aa501c95e1b0";
const proofProject = "jftlxeacphvbnhbsbpxc";
assert.match(base, /^https:\/\/[a-z0-9-]+\.vercel\.app$/);
assert.equal(expectedSha.length, 40);
assert.ok(email && password, "Only protected controlled Proof Specialist credentials may authenticate.");

const uuid = (label) => {
  const h = createHash("md5").update(label).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join("-");
};
const student = i => uuid("ri-v2-longitudinal-proof-student-" + i);
const booking = (i, n) => uuid("ri-v2-longitudinal-booking-" + i + "-" + n);
const q = obj => new URLSearchParams(obj).toString();
const client = await request.newContext({
  baseURL:base, timeout:60000,
  ...(bypass ? {extraHTTPHeaders:{"x-vercel-protection-bypass":bypass}} : {}),
});
async function call(method, path, data) {
  const response = method === "GET"
    ? await client.get(path, {timeout:60000})
    : await client.post(path, {data,timeout:60000});
  const body = await response.text();
  let parsed;
  try { parsed=JSON.parse(body); } catch { parsed=null; }
  if(!response.ok()){
    const error = new Error(method+" "+path.split("?")[0]+" HTTP "+response.status()+" "+body.slice(0,280));
    error.httpStatus=response.status();
    error.parsedBody=parsed;
    throw error;
  }
  assert.ok(parsed && typeof parsed==="object", "Expected application JSON, not a protection or login page.");
  return parsed;
}
const get = path => call("GET",path);
const post = (path, body) => call("POST",path,body);
const endpoint = (i,n,topic) => "/api/tutor/sandbox-environment?"+q({
  tutorAssignmentId:assignment,studentId:student(i),scheduledSessionId:booking(i,n),
  topic,sessionNumber:String(n),
});
const history = i => get("/api/tutor/sandbox-environment/history?"+q({
  tutorAssignmentId:assignment,studentId:student(i),
}));
const fixtures = [
  {i:4, profile:"clarity_fragile", topic:"QA Clarity", phase:"Clarity"},
  {i:9, profile:"reassurance_seeker", topic:"QA Execution", phase:"Structured Execution"},
  {i:2, profile:"pressure_fragile", topic:"QA Pressure", phase:"Time Pressure Stability"},
  {i:10,profile:"fast_recovery", topic:"QA Discomfort", phase:"Controlled Discomfort"},
  {i:1, profile:"uneven_performer", topic:"QA Execution", phase:"Structured Execution"},
  {i:3, profile:"quietly_strong", topic:"QA Clarity", phase:"Clarity"},
];
assert.equal(new Set(fixtures.map(x=>x.profile)).size, 6);
const statuses=[];
const modeResults=[];
const phaseProbe={
  "Clarity":"clarity.recognition",
  "Structured Execution":"stack.normal_independent",
  "Controlled Discomfort":"stack.challenge_no_timer",
  "Time Pressure Stability":"stack.normal_independent",
};
function noPrivateTruth(value) {
  const valueString=JSON.stringify(value);
  for(const forbidden of [
    '"trajectory_seed"', '"behavior_model_version"', '"canonicalObservations"',
    '"canonical_authority"','"canonical_phase"','"outcome_key"',
  ])assert.ok(!valueString.includes(forbidden),"Specialist API exposed private model truth: "+forbidden);
}
function checkScope(value) {
  assert.equal(value.evidenceScope,"sandbox");
  assert.equal(value.studentStateAuthoritative,false);
  noPrivateTruth(value);
}
function observationsForProbe(probe,scope,phase) {
  const dimensions=DIAGNOSIS_PROBES[probe].dimensions.filter(dim =>
    scope === "diagnosis" || DIAGNOSIS_OBSERVATION_MATRIX[dim].phase===phase
  );
  assert.ok(dimensions.length>0,"A simulated opportunity must have observable dimensions.");
  return dimensions.map(d=>({
    dimensionId:d,
    // Explicitly exercises a bounded, uncalibrated observer. This is a
    // public form option, NEVER a lookup into the private answer key.
    behaviorId:DIAGNOSIS_OBSERVATION_MATRIX[d].options[0].id,
  }));
}
async function crossMode(fixt) {
  const before=await history(fixt.i);
  checkScope(before);
  const traj=before.trajectory.id;
  let accepted=0, readinessHolds=0;
  for(const scope of ["diagnosis","handover"]){
    const sourceContextId="qa-v2-crossmode-20261012-"+fixt.i+"-"+scope;
    const options={
      tutorAssignmentId:assignment,studentId:student(fixt.i),scope,
      sourceContextId,topic:fixt.topic,startingPhase:fixt.phase,
      sequenceNumber:"1",
      ...(scope==="diagnosis"?{probeId:phaseProbe[fixt.phase]}:{}),
    };
    const url="/api/tutor/sandbox-live-evidence?"+q(options);
    let first;
    try { first=await get(url); }
    catch(e) {
      // TPS Handover must fail closed if a clean established timer baseline
      // has not been supplied by native evidence. It must NOT calibrate itself.
      if(scope==="handover" && fixt.phase==="Time Pressure Stability" &&
          (e.httpStatus===409||e.httpStatus===422)){
        console.log("V2_TPS_HANDOVER_BASELINE_READINESS_HELD=PASS",fixt.i);
        readinessHolds++;
        continue;
      }
      throw e;
    }
    checkScope(first);
    assert.equal(first.scope,scope);
    assert.equal(first.trajectoryId,traj);
    assert.equal(first.sequenceNumber,1);
    assert.ok(first.formId && first.studentBehavior?.length>=15);
    const replay=await get(url);
    assert.equal(replay.formId,first.formId);
    assert.equal(replay.studentBehavior,first.studentBehavior);
    checkScope(replay);
    console.log("V2_CROSS_MODE_FORM_REPLAY=PASS",fixt.profile,scope,first.probeId);
    const observations=observationsForProbe(first.probeId,scope,fixt.phase);
    const submit=await post("/api/tutor/sandbox-live-evidence",{
      ...options,sequenceNumber:1,probeId:first.probeId,formId:first.formId,
      supportEvent:"none",observations,
    });
    checkScope(submit);
    assert.equal(submit.success,true);
    assert.equal(submit.conditionConformed,true);
    assert.equal(submit.totalObservations,observations.length);
    assert.ok(submit.matchingObservations>=0&&submit.matchingObservations<=observations.length);
    assert.equal(typeof submit.observationExact,"boolean");
    accepted++;
    modeResults.push({profile:fixt.profile,scope,matched:submit.matchingObservations,
      total:submit.totalObservations,observationExact:submit.observationExact});
    console.log("V2_CROSS_MODE_SUBMISSION=PASS",fixt.profile,scope,
      "observed="+submit.matchingObservations+"/"+submit.totalObservations);
    const again=await get(url);
    assert.equal(again.formId,first.formId,"Cross-mode evidence must not mutate the active profile.");
    assert.equal(again.studentBehavior,first.studentBehavior);
  }
  assert.ok(accepted>=1 && accepted+readinessHolds===2);
  const after=await history(fixt.i);
  assert.equal(after.trajectory.id,traj);
  assert.equal(after.trajectory.sessionNumber,before.trajectory.sessionNumber,
    "Diagnosis/Handover must not silently consume a Training session.");
  console.log("V2_CROSS_MODE_IDENTITY_PRESERVED=PASS",fixt.profile);
}
async function processTargetedProbe(fixt, current) {
  assert.equal(current.status,"rediagnosis_probe_ready");
  assert.ok(current.probe?.fields?.length);
  assert.equal(current.studentStateAuthoritative,false);
  const observations=current.probe.fields.map(f=>({
    dimensionId:f.dimensionId,
    behaviorId:f.options[0].behaviorId,
  }));
  const recorded=await post("/api/tutor/sandbox-environment/rediagnosis",{
    tutorAssignmentId:assignment,studentId:student(fixt.i),
    trajectoryId:current.trajectoryId,rediagnosisRunId:current.rediagnosisRunId,
    bankVersion:current.bankVersion,sequenceNumber:current.sequenceNumber,
    turnFormId:current.turnFormId,submission:{
      probeId:current.probe.probeId,supportEvent:"none",observations,
    },
  });
  checkScope(recorded);
  assert.ok(recorded.turnId);
  assert.equal(recorded.conditionConformed,true);
  console.log("V2_TARGETED_REDIAGNOSIS_PROBE=PASS",fixt.profile,
    current.probe.probeId, "placementResolved="+Boolean(recorded.diagnosisComplete),
    "blocked="+Boolean(recorded.blocked));
  return recorded;
}
async function completeSession(fixt,n) {
  const start=await history(fixt.i);
  assert.equal(typeof start.trajectory.id,"string");
  const existing=start.sessions.find(s=>Number(s.sessionNumber)===n &&
    String(s.topicKey||"")===fixt.topic.toLowerCase());
  if(existing){
    console.log("V2_SESSION_PREVIOUSLY_COMPLETED=PASS",fixt.profile,n);
    return {state:"completed",repsSubmitted:0,resumed:true};
  }
  assert.equal(start.trajectory.sessionNumber,n,
    "Never submit evidence against the wrong synthetic session.");
  let changes=0,redia=0,observed=0,encountered=0;
  const observedNarratives=[];
  for(let step=0;step<32;step++){
    const current=await get(endpoint(fixt.i,n,fixt.topic));
    checkScope(current);
    assert.equal(current.trajectoryId,start.trajectory.id);
    if(current.status==="rediagnosis_probe_ready"){
      if(redia>=10)throw new Error("Targeted diagnosis exceeded a bounded 10-probe limit.");
      const outcome=await processTargetedProbe(fixt,current);
      redia++;
      if(outcome.blocked) {
        console.log("V2_TARGETED_REDIAGNOSIS_EVIDENCE_HOLD=PASS",fixt.profile);
        return {state:"correctly_blocked",redia,observed};
      }
      continue;
    }
    if(current.status==="rediagnosis_blocked"){
      console.log("V2_TARGETED_REDIAGNOSIS_BLOCKED=PASS",fixt.profile);
      return {state:"correctly_blocked",redia,observed};
    }
    if(current.status==="session_complete" && current.completedSession){
      console.log("V2_ALREADY_COMPLETED_AFTER_RECOVERY=PASS",fixt.profile,n);
      return {state:"completed",observed,redia};
    }
    assert.equal(current.status,"rep_ready","Cannot fake progression past a readiness hold.");
    assert.equal(current.sessionNumber,n);
    assert.ok(current.eventFormId && current.rep?.fields?.length);
    assert.ok(current.rep.studentBehavior?.length>=75);
    const repeated=await get(endpoint(fixt.i,n,fixt.topic));
    assert.equal(repeated.eventFormId,current.eventFormId);
    assert.equal(repeated.rep.studentBehavior,current.rep.studentBehavior);
    const behavior=current.rep.studentBehavior;
    if(observedNarratives.length && observedNarratives.at(-1)!==behavior) changes++;
    observedNarratives.push(behavior);
    const options=Object.fromEntries(current.rep.fields.map(f=>[
      f.fieldKey,{optionId:f.options[0].optionId,evidenceStatus:"observed"},
    ]));
    const res=await post("/api/tutor/sandbox-environment/rep",{
      tutorAssignmentId:assignment,studentId:student(fixt.i),
      bankVersion:current.bankVersion,trajectoryId:current.trajectoryId,
      eventSequence:current.eventSequence,eventFormId:current.eventFormId,
      scheduledSessionId:booking(fixt.i,n),topic:fixt.topic,
      submission:{interventionEvent:"none",observations:options},
    });
    checkScope(res);
    assert.ok(res.eventId && res.eventSequence===current.eventSequence);
    observed++;
    if(res.sessionCompleted){
      assert.equal(res.completedScheduledSession?.status,"completed");
      const verified=await history(fixt.i);
      assert.equal(verified.trajectory.id,start.trajectory.id);
      assert.equal(verified.trajectory.sessionNumber,n+1);
      assert.ok(verified.sessions.some(s=>Number(s.sessionNumber)===n &&
        String(s.topicKey||"")===fixt.topic.toLowerCase()));
      console.log("V2_LONGITUDINAL_SESSION_COMPLETE=PASS",fixt.profile,
        "session="+n,"reps="+observed,"changedResponses="+changes,"rediagnosis="+redia);
      return {state:"completed",observed,changes,redia};
    }
    assert.equal(res.nextEnvironment?.evidenceScope,"sandbox");
  }
  throw new Error("Exceeded 32 bounded real rep/rediagnosis interactions");
}
async function checkLegacyAccess(){
  const rejected="/api/tutor/sandbox-environment?"+q({
    tutorAssignmentId:assignment,
    studentId:"00000000-0000-0000-0000-000000000001",
    topic:"QA Clarity",sessionNumber:"1",
  });
  try {await get(rejected);}
  catch(error){
    assert.ok([403,404,409].includes(error.httpStatus),
      "Unassigned learner must fail access, not yield a simulated form.");
    console.log("V2_NEGATIVE_STUDENT_ACCESS=PASS");
    return;
  }
  throw new Error("An unassigned Sandbox student was readable.");
}
async function checkTopicSwitch(){
  // The earlier A -> B -> A acceptance established the exact two historical
  // lessons for QA 17. Now exercise a real V2 narrative on the returned A lane
  // without clearing either topic's persisted state.
  const i=17;
  const before=await history(i);
  checkScope(before);
  assert.ok(before.sessions.some(x=>x.topicKey==="qa clarity" && x.sessionNumber===1));
  assert.ok(before.sessions.some(x=>x.topicKey==="qa pressure" && x.sessionNumber===2));
  const id=before.trajectory.id;
  const a=await get(endpoint(i,3,"QA Clarity"));
  checkScope(a);
  assert.equal(a.trajectoryId,id);
  assert.equal(a.sessionNumber,3);
  assert.ok(["rep_ready","rediagnosis_probe_ready"].includes(a.status));
  const encore=await get(endpoint(i,3,"QA Clarity"));
  assert.equal(encore.trajectoryId,id);
  assert.equal(encore.status,a.status);
  if(a.eventFormId)assert.equal(encore.eventFormId,a.eventFormId);
  if(a.status==="rep_ready") {
    assert.ok(a.rep.studentBehavior.length>75);
    console.log("V2_TOPIC_A_B_A_V2_NARRATIVE_RESTORED=PASS",a.prescribedPhase);
  } else {
    console.log("V2_TOPIC_A_B_A_LEGITIMATE_REDIAGNOSIS_BOUNDARY=PASS");
  }
  // No passage through another topic can silently overwrite the earlier
  // completed-session evaluations.
  const afterward=await history(i);
  assert.equal(afterward.sessions.length,before.sessions.length);
  console.log("V2_TOPIC_A_B_A_PERSISTED_EVIDENCE=PASS");
}
try {
  const p=await get("/api/proof-environment");
  assert.equal(p.vercelEnv,"preview");
  assert.equal(p.supabaseProjectRef,proofProject);
  assert.equal(p.commitSha,expectedSha);
  console.log("V2_LONGITUDINAL_PROVENANCE=PASS");
  const auth=await post("/api/auth/signin",{email,password,expectedRole:"tutor"});
  assert.equal(String(auth?.dbUser?.role).toLowerCase(),"tutor");
  const runtime=await get("/api/tutor/runtime-mode");
  assert.equal(runtime.operationalMode,"sandbox");
  assert.equal(runtime.assignmentId,assignment);
  console.log("V2_LONGITUDINAL_SPECIALIST_AUTHORITY=PASS");
  await checkLegacyAccess();
  for(const fixture of fixtures){
    await crossMode(fixture);
  }
  assert.equal(modeResults.length>=11,true,
    "All six profiles need Diagnosis and eligible Handover evidence; TPS baseline can withhold Handover.");
  console.log("V2_ALL_SIX_CROSS_MODE=PASS",JSON.stringify(modeResults));
  for(const fixture of fixtures){
    const result=await completeSession(fixture,2);
    statuses.push({profile:fixture.profile,...result});
  }
  assert.equal(statuses.length,6);
  assert.ok(statuses.every(x=>x.state==="completed"||x.state==="correctly_blocked"));
  assert.ok(statuses.some(x=>x.state==="completed"),
    "At least one new V2 session must genuinely complete.");
  console.log("V2_ALL_SIX_LONGITUDINAL_DISPOSITION=PASS",JSON.stringify(statuses));
  await checkTopicSwitch();
  console.log("V2_FULL_LONGITUDINAL_LIVE_PROOF=PASS");
} finally {
  await client.dispose();
}