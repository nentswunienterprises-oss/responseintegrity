import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { request } from "playwright";

// Exact pinned Preview. Never fall back to a branch alias or Production.
const base = "https://tt-confidence-eznyld6um-relief-works-technologies.vercel.app";
const expectedSha = "edb891c8e6629d4241702a37c2618b5771d470e0";
const expectedDb = "jftlxeacphvbnhbsbpxc";
const assignment = "836a839f-2f29-45c7-b8c2-aa501c95e1b0";
const email = String(process.env.RI_PROOF_EMAIL || "").trim();
const password = String(process.env.RI_PROOF_PASSWORD || "");
const bypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();
assert.ok(email && password, "Encrypted Proof credentials required; no fallback to real accounts.");

const uuid = (label) => {
  const hex = createHash("md5").update(label).digest("hex");
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-");
};
const qaStudent = (n) => uuid("ri-v2-longitudinal-proof-student-" + n);
const qaBooking = (n, ord) => uuid("ri-v2-longitudinal-booking-" + n + "-" + ord);
const q = (input) => new URLSearchParams(input).toString();
const api = await request.newContext({
  baseURL: base,
  timeout: 60000,
  ...(bypass ? { extraHTTPHeaders: {"x-vercel-protection-bypass":bypass} } : {}),
});
async function jsonResponse(method,path,data) {
  const response = method === "GET"
    ? await api.get(path, {timeout:60000})
    : await api.post(path, {data, timeout:60000});
  const body = await response.text();
  if (!response.ok()) {
    throw new Error(method+" "+path.split("?")[0]+" HTTP "+response.status()+" "+body.slice(0,450));
  }
  try { return JSON.parse(body); }
  catch { throw new Error("API returned non-JSON "+method+" "+path.split("?")[0]+" HTTP "+response.status()); }
}
const get = path => jsonResponse("GET",path);
const post = (path,data) => jsonResponse("POST",path,data);
const history = id => get("/api/tutor/sandbox-environment/history?"+q({
  tutorAssignmentId:assignment,studentId:id
}));
const form = (id,booking,topic,sessionNo) => get("/api/tutor/sandbox-environment?"+q({
  tutorAssignmentId:assignment,studentId:id,scheduledSessionId:booking,
  topic,sessionNumber:String(sessionNo),
}));
function assertNoPrivateTruth(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of ['"trajectory_seed"','"canonicalObservations"','"canonical_authority"','"behavior_model_version"']) {
    assert.ok(!serialized.includes(forbidden), "Private Sandbox truth leaked to Specialist: "+forbidden);
  }
}
const fixtures = [
  {i:4,profile:"clarity_fragile",topic:"QA Clarity"},
  {i:9,profile:"reassurance_seeker",topic:"QA Execution"},
  {i:2,profile:"pressure_fragile",topic:"QA Pressure"},
  {i:10,profile:"fast_recovery",topic:"QA Discomfort"},
  {i:1,profile:"uneven_performer",topic:"QA Execution"},
  {i:3,profile:"quietly_strong",topic:"QA Clarity"},
];

async function finishSession(fixture,bookingOrdinal,topic) {
  const id=qaStudent(fixture.i), booking=qaBooking(fixture.i,bookingOrdinal);
  const startHistory=await history(id);
  assert.equal(startHistory.evidenceScope,"sandbox");
  assert.equal(startHistory.studentStateAuthoritative,false);
  const initialTrajectory=startHistory.trajectory.id;
  assert.ok(initialTrajectory);
  const alreadyComplete=startHistory.sessions.some(s=>
    s.sessionNumber===bookingOrdinal && s.topicKey===topic.toLowerCase());
  if (alreadyComplete) {
    console.log("V2_QA_SESSION_ALREADY_COMPLETE",fixture.i,bookingOrdinal);
    return {status:"complete",trajectoryId:initialTrajectory,submitted:0,resumed:true};
  }
  assert.equal(startHistory.trajectory.sessionNumber,bookingOrdinal,
    "Unexpected session number. Never submit against a different QA session.");
  let submitted=0;
  for(let attempt=0;attempt<20;attempt++){
    const current=await form(id,booking,topic,bookingOrdinal);
    assertNoPrivateTruth(current);
    assert.equal(current.trajectoryId,initialTrajectory,"Student identity changed");
    if(current.status==="targeted_rediagnosis_required"){
      console.log("V2_QA_TARGETED_REDIAGNOSIS_REQUIRED",fixture.i,bookingOrdinal);
      return {status:"rediagnosis",trajectoryId:initialTrajectory,submitted};
    }
    assert.equal(current.status,"rep_ready",
      "Expected live rep, saw "+current.status+" on student "+fixture.i);
    assert.equal(current.sessionNumber,bookingOrdinal);
    assert.ok(current.eventFormId && current.rep?.fields?.length);
    const remaining=Number(current.sessionProgress?.totalReps ?? 0)-
       Number(current.sessionProgress?.completedReps ?? 0);
    assert.ok(remaining>0 && remaining<20, "Invalid session progress");

    // A bounded synthetic observer, not a certified Specialist.
    // Use public options only; never fetch a private answer key.
    const observations=Object.fromEntries(current.rep.fields.map(field=>{
      assert.ok(field.options?.length,"Missing observation options");
      return [field.fieldKey, {optionId:field.options[0].optionId,evidenceStatus:"observed"}];
    }));
    const res=await post("/api/tutor/sandbox-environment/rep",{
      tutorAssignmentId:assignment,studentId:id,bankVersion:current.bankVersion,
      trajectoryId:current.trajectoryId,eventSequence:current.eventSequence,
      eventFormId:current.eventFormId,scheduledSessionId:booking,topic,
      submission:{interventionEvent:"none",observations},
    });
    assertNoPrivateTruth(res);
    assert.equal(res.evidenceScope,"sandbox");
    assert.equal(res.studentStateAuthoritative,false);
    assert.ok(res.eventId && res.eventSequence===current.eventSequence);
    submitted++;
    if(res.sessionCompleted){
      assert.equal(res.completedScheduledSession?.status,"completed",
        "A real Sandbox session must retire the exact confirmed QA booking");
      const verified=await history(id);
      assert.equal(verified.trajectory.id,initialTrajectory);
      assert.equal(verified.trajectory.sessionNumber,bookingOrdinal+1);
      assert.ok(verified.sessions.some(s=>
        s.sessionNumber===bookingOrdinal && s.topicKey===topic.toLowerCase()),
        "Session evaluation missing after completed booking");
      console.log("V2_QA_COMPLETED_SESSION",JSON.stringify({
        fixture:fixture.i,profile:fixture.profile,session:bookingOrdinal,
        topic,submitted,totalReps:Number(current.sessionProgress?.totalReps),
        nextSession:verified.trajectory.sessionNumber,
        specialistRoute:res.sessionAuthority?.specialist?.route,
      }));
      return {status:"complete",trajectoryId:initialTrajectory,submitted};
    }
    assert.equal(res.nextEnvironment?.evidenceScope,"sandbox");
  }
  throw new Error("Session loop bounded out before completion "+fixture.i);
}

try {
  const provenance=await get("/api/proof-environment");
  assert.equal(provenance.vercelEnv,"preview");
  assert.equal(provenance.supabaseProjectRef,expectedDb);
  assert.equal(provenance.commitSha,expectedSha);
  console.log("V2_PROVENANCE=PASS");
  const auth=await post("/api/auth/signin",{email,password,expectedRole:"tutor"});
  assert.equal(String(auth?.dbUser?.role).toLowerCase(),"tutor");
  const runtime=await get("/api/tutor/runtime-mode");
  assert.equal(runtime.operationalMode,"sandbox");
  assert.equal(runtime.assignmentId,assignment);
  console.log("V2_AUTHORITY=PASS");
  
  const sessionResults=[];
  for(const fixture of fixtures) {
    const result=await finishSession(fixture,1,fixture.topic);
    sessionResults.push({profile:fixture.profile,...result});
  }
  assert.equal(sessionResults.filter(r=>r.status==="complete").length,6,
    "Not all six representative V2 profiles completed one whole session");
  console.log("V2_SIX_PROFILE_SESSIONS=PASS");

  // Same synthetic student, two truly completed sessions on different
  // observed topic states, then return to the first topic.
  const switcher={i:17,profile:"quietly_strong",topic:"QA Clarity"};
  const a=await finishSession(switcher,1,"QA Clarity");
  assert.equal(a.status,"complete");
  const beforeB=await history(qaStudent(switcher.i));
  const beforeBId=beforeB.trajectory.id;
  const b=await finishSession(switcher,2,"QA Pressure");
  assert.equal(b.status,"complete");
  const afterB=await history(qaStudent(switcher.i));
  assert.equal(afterB.trajectory.id,beforeBId);
  assert.equal(afterB.trajectory.sessionNumber,3);
  const back=await form(qaStudent(switcher.i),qaBooking(switcher.i,3),"QA Clarity",3);
  assertNoPrivateTruth(back);
  assert.equal(back.trajectoryId,beforeBId);
  assert.ok(["rep_ready","targeted_rediagnosis_required"].includes(back.status),
    "Returning to a prior topic must restore its saved authority or the legitimate re-diagnosis gate");
  assert.equal(back.prescribedPhase, beforeB.trajectory.prescribedPhase,
    "Topic A phase did not return to previously saved authority");
  console.log("V2_TOPIC_A_B_A=PASS "+JSON.stringify({
    fixture:switcher.i,topicA:"qa clarity",topicB:"qa pressure",
    aStatus:a.status,bStatus:b.status,returnStatus:back.status,session:3,
  }));

  console.log("V2_LONGITUDINAL_LIVE_ACCEPTANCE=PASS");
} finally {
  await api.dispose();
}
