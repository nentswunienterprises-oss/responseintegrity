import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// This runner exercises ONE native synthetic Clarity rep on a protected Proof
// Preview, never human capability or a TD/graduation decision. It does NOT
// read private outcome-bank answers or infer correct selections from option order.
// An operator must assess the currently visible simulated behavior independently
// and provide a protected, form-bound decision manifest.
export async function runNativeFirstClarityRep(e=process.env, fetchImpl=fetch, log=console.log) {
  const inspect=e.RI_PROOF_NATIVE_REP_SCOPE==="CONTROLLED_PROOF_FIRST_CLARITY_REP_INSPECT";
  const submit=e.RI_PROOF_NATIVE_REP_SCOPE==="CONTROLLED_PROOF_FIRST_CLARITY_REP_SUBMIT";
  assert.ok(inspect||submit,"A narrowly scoped inspect or submit authority is required.");
  const required=["PROOF_BASE_URL","PROOF_EXPECTED_SHA","RI_PROOF_SPECIALIST_EMAIL",
    "RI_PROOF_SPECIALIST_PASSWORD","RI_PROOF_TD_EMAIL","RI_PROOF_TD_PASSWORD",
    "RI_PROOF_TUTOR_ID","RI_PROOF_STUDENT_ID","RI_PROOF_SESSION_ID",
    "RI_PROOF_TOPIC","VERCEL_AUTOMATION_BYPASS_SECRET"];
  for(const key of required)assert.ok(String(e[key]||"").trim(),key+" required");
  assert.match(e.PROOF_EXPECTED_SHA,/^[0-9a-f]{40}$/);
  assert.match(e.RI_PROOF_SESSION_ID,/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
  const base=new URL(e.PROOF_BASE_URL);
  assert.equal(base.protocol,"https:");
  assert.match(base.hostname,/^[a-z0-9-]+\.vercel\.app$/);
  assert.equal(base.pathname,"/");
  assert.equal(base.search,"");
  assert.equal(base.hash,"");
  assert.equal(base.port,"");
  assert.equal(base.username,"");
  assert.equal(base.password,"");
  assert.notEqual(e.RI_PROOF_SPECIALIST_EMAIL.toLowerCase(),e.RI_PROOF_TD_EMAIL.toLowerCase());

  async function api(path,opts={}) {
    assert.ok(path.startsWith("/api/"),"Only scoped API access");
    const response=await fetchImpl(new URL(path,base),{
      ...opts,redirect:"manual",signal:AbortSignal.timeout(30000),
      headers:{"x-vercel-protection-bypass":e.VERCEL_AUTOMATION_BYPASS_SECRET,
        ...(opts.headers||{})},
    });
    assert.match(response.headers.get("content-type")||"",/application\/json/,
      "Refuse protection redirects/HTML/non-JSON.");
    return {status:response.status,body:await response.json(),response};
  }
  const provenance=await api("/api/proof-environment");
  assert.equal(provenance.status,200);
  assert.equal(provenance.body.vercelEnv,"preview");
  assert.equal(provenance.body.commitSha,e.PROOF_EXPECTED_SHA);
  assert.equal(provenance.body.supabaseProjectRef,"jftlxeacphvbnhbsbpxc");

  async function signIn(email,password,role){
    const r=await api("/api/auth/signin",{method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({email,password,expectedRole:role})});
    assert.equal(r.status,200,role+" controlled sign-in failed");
    assert.equal(r.body.dbUser?.role,role);
    if(role==="tutor")assert.equal(String(r.body.dbUser?.id),e.RI_PROOF_TUTOR_ID);
    const cookies=r.response.headers.getSetCookie?.()||[r.response.headers.get("set-cookie")||""];
    const cookie=cookies.filter(Boolean).map(c=>c.split(";")[0]).join("; ");
    assert.ok(cookie,"Isolated "+role+" session cookie missing");
    return cookie;
  }
  const tutor=await signIn(e.RI_PROOF_SPECIALIST_EMAIL,e.RI_PROOF_SPECIALIST_PASSWORD,"tutor");
  const td=await signIn(e.RI_PROOF_TD_EMAIL,e.RI_PROOF_TD_PASSWORD,"td");
  const get=(path,cookie)=>api(path,{headers:{cookie}});
  const mode=await get("/api/tutor/runtime-mode",tutor);
  assert.equal(mode.status,200);
  assert.equal(mode.body.operationalMode,"sandbox");
  assert.ok(mode.body.assignmentId,"Specialist assignment absent");

  const reviewPath="/api/td/tutors/"+encodeURIComponent(e.RI_PROOF_TUTOR_ID)+
    "/sandbox-qualification-review";
  const denied=await get(reviewPath,tutor);
  assert.equal(denied.status,403,"Specialist must not access private TD dossier");
  const review=await get(reviewPath,td);
  assert.equal(review.status,200,"Assigned TD access required");
  assert.equal(review.body.tutorAssignmentId,mode.body.assignmentId);
  assert.equal(review.body.tutorId,e.RI_PROOF_TUTOR_ID);
  assert.equal(review.body.qualification?.qualificationReady,false,
    "Unaccepted Proof may not qualify automatically");

  const args=new URLSearchParams({
    tutorAssignmentId:mode.body.assignmentId,
    studentId:e.RI_PROOF_STUDENT_ID,
    scheduledSessionId:e.RI_PROOF_SESSION_ID,
    topic:e.RI_PROOF_TOPIC,
  });
  const formPath="/api/tutor/sandbox-environment?"+args;
  const historyPath="/api/tutor/sandbox-environment/history?"+
    new URLSearchParams({tutorAssignmentId:mode.body.assignmentId,
      studentId:e.RI_PROOF_STUDENT_ID});
  const planPath="/api/tutor/sandbox-environment/preparation-plan?"+
    new URLSearchParams({studentId:e.RI_PROOF_STUDENT_ID,
      scheduledSessionId:e.RI_PROOF_SESSION_ID,topic:e.RI_PROOF_TOPIC});
  const plan=await get(planPath,tutor);
  assert.equal(plan.status,200);
  assert.equal(plan.body.captureActive,true);
  assert.equal(plan.body.preparationRecorded,true,"Approved Map preparation missing");
  assert.equal(plan.body.prescribedPhase,"Clarity");
  assert.equal(plan.body.sessionNumber,1);
  assert.equal(plan.body.completedReps,0);
  const current=await get(formPath,tutor);
  assert.equal(current.status,200,"Native first-rep form inaccessible");
  const f=current.body;
  assert.equal(f.status,"rep_ready");
  assert.equal(f.prescribedPhase,"Clarity");
  assert.equal(f.sessionNumber,1);
  assert.equal(f.preparationCaptureEnabled,true);
  assert.equal(f.preparationRecorded,true);
  assert.equal(f.sessionProgress?.completedReps,0);
  assert.ok(f.sessionProgress?.totalReps>1,"Refuse one-rep session finalization");
  assert.equal(f.trajectoryId,String(e.RI_PROOF_EXPECTED_TRAJECTORY_ID||
    f.trajectoryId),"Unexpected controlled trajectory");
  assert.equal(f.rep?.setId,String(e.RI_PROOF_EXPECTED_SET_ID||"clarity.identification"));
  assert.equal(f.rep?.repNumber,1);
  assert.ok(typeof f.rep?.studentBehavior==="string"&&
    f.rep.studentBehavior.trim().length>=20,"Visible simulated behavior missing");
  assert.ok(Array.isArray(f.rep.fields)&&f.rep.fields.length>0);
  assert.ok(f.rep.fields.every(x=>x.fieldKey&&Array.isArray(x.options)&&x.options.length>1));
  assert.ok(Number.isInteger(f.eventSequence)&&f.eventSequence>0);
  assert.ok(typeof f.eventFormId==="string"&&f.eventFormId.length>0);
  assert.ok(Number.isInteger(f.bankVersion)&&f.bankVersion>0);
  assert.ok(f.rep.interventionOptions.some(o=>o.id==="none"));
  assert.equal(f.rep.inheritedRescueSignal,null,"Only Clarity is permitted");
  assert.equal(f.rep.prerequisiteSentinel,null,"No artificial prerequisite probe");

  const before=await get(historyPath,tutor);
  assert.equal(before.status,200);
  assert.equal(before.body.trajectory?.id,f.trajectoryId);
  assert.equal(before.body.trajectory?.sessionNumber,1);
  assert.equal(before.body.trajectory?.completedRepCount,0);
  assert.ok(!before.body.events?.some(x=>x.eventSequence===f.eventSequence&&
    x.sessionNumber===1),"Refuse duplicate first rep");
  const behaviorHash=createHash("sha256").update(f.rep.studentBehavior).digest("hex");

  if(inspect){
    // Safe in PUBLIC GitHub Actions: no studentBehavior, answer options,
    // credentials, private truth, or future scenario/outcome bank.
    log("NATIVE_FIRST_CLARITY_REP_READY="+JSON.stringify({
      eventFormId:f.eventFormId,eventSequence:f.eventSequence,
      bankVersion:f.bankVersion,sessionNumber:1,repNumber:1,
      setId:f.rep.setId,behaviorSha256:behaviorHash,
      requiredFieldKeys:f.rep.fields.map(x=>x.fieldKey),
      optionCounts:f.rep.fields.map(x=>x.options.length),
    }));
    log("READ_ONLY_FIRST_REP_INTAKE=PASS");
    return {mode:"inspect",formId:f.eventFormId,fields:f.rep.fields.length};
  }

  let manifest;
  try{manifest=JSON.parse(String(e.RI_PROOF_FIRST_REP_DECISION_JSON||""))}
  catch{throw new Error("Protected independent observation decision JSON is required");}
  assert.ok(manifest&&!Array.isArray(manifest)&&typeof manifest==="object");
  assert.deepEqual(Object.keys(manifest).sort(),[
    "behaviorSha256","bankVersion","eventFormId","eventSequence",
    "evidenceBasis","interventionEvent","observations","repNumber",
    "sessionNumber","setId","trajectoryId",
  ].sort(),"Unsupported manifest keys or missing form binding");
  assert.equal(manifest.evidenceBasis,"visible_simulated_behavior_only");
  assert.equal(manifest.behaviorSha256,behaviorHash,"Observed scenario changed");
  assert.equal(manifest.bankVersion,f.bankVersion);
  assert.equal(manifest.eventFormId,f.eventFormId,"Form changed");
  assert.equal(manifest.eventSequence,f.eventSequence,"Event changed");
  assert.equal(manifest.trajectoryId,f.trajectoryId,"Trajectory changed");
  assert.equal(manifest.sessionNumber,1);
  assert.equal(manifest.repNumber,1);
  assert.equal(manifest.setId,f.rep.setId);
  // The controlled simulator merely presents the task. Interventions must
  // be recorded truthfully; this bounded smoke refuses all rescue/support.
  assert.equal(manifest.interventionEvent,"none");
  assert.ok(manifest.observations&&typeof manifest.observations==="object"&&
    !Array.isArray(manifest.observations),"Explicit observations required");
  const keys=f.rep.fields.map(field=>field.fieldKey).sort();
  assert.deepEqual(Object.keys(manifest.observations).sort(),keys,
    "No missing/extra Specialist observations permitted");
  const observed={};
  for(const field of f.rep.fields) {
    const decision=manifest.observations[field.fieldKey];
    assert.ok(decision&&typeof decision==="object"&&!Array.isArray(decision));
    assert.deepEqual(Object.keys(decision).sort(),
      ["optionId","evidenceStatus","observationReason"].sort());
    assert.equal(decision.evidenceStatus,"observed",
      "Do not fabricate non-observation/confounds in first Clarity smoke");
    assert.ok(field.options.some(o=>o.optionId===decision.optionId),
      "Chosen observation ID must exist on the *current displayed* form");
    assert.ok(typeof decision.observationReason==="string"&&
      decision.observationReason.trim().length>=25,
      "Independent per-field behavior-based explanation required");
    observed[field.fieldKey]={optionId:decision.optionId,evidenceStatus:"observed"};
  }

  // One POST only. Never auto-retry it: errors after a network write need
  // manual evidence readback to avoid inventing or duplicating records.
  const submitted=await api("/api/tutor/sandbox-environment/rep",{
    method:"POST",headers:{cookie:tutor,"content-type":"application/json"},
    body:JSON.stringify({
      tutorAssignmentId:mode.body.assignmentId,
      studentId:e.RI_PROOF_STUDENT_ID,bankVersion:f.bankVersion,
      trajectoryId:f.trajectoryId,eventSequence:f.eventSequence,
      eventFormId:f.eventFormId,scheduledSessionId:e.RI_PROOF_SESSION_ID,
      topic:e.RI_PROOF_TOPIC,
      submission:{interventionEvent:"none",observations:observed},
    }),
  });
  assert.equal(submitted.status,201,
    "Native POST did not return 201; DO NOT retry without reading history");
  const body=submitted.body;
  assert.equal(body.eventSequence,f.eventSequence);
  assert.equal(body.sessionNumber,1);
  assert.equal(body.repNumber,1);
  assert.equal(body.phase,"Clarity");
  assert.equal(body.setId,f.rep.setId);
  assert.equal(body.sessionCompleted,false,"Unexpected session/billing closure");
  assert.equal(body.studentStateAuthoritative,false);
  assert.equal(body.evidenceScope,"sandbox");
  assert.ok(body.eventId,"Persisted event ID missing");

  const after=await get(historyPath,tutor);
  assert.equal(after.status,200,"Persisted native rep cannot be read");
  const persisted=after.body.events?.find(x=>x.id===body.eventId);
  assert.ok(persisted,"No matching durable native rep readback");
  assert.equal(persisted.eventSequence,f.eventSequence);
  assert.equal(persisted.phase,"Clarity");
  assert.equal(persisted.sessionNumber,1);
  assert.equal(persisted.setId,f.rep.setId);
  assert.equal(after.body.trajectory?.completedRepCount,1);
  assert.equal(after.body.sessions?.length,before.body.sessions?.length,
    "First rep must not complete a session");
  assert.equal(body.conditionKept,true,"First rep condition integrity failed");
  assert.equal(body.observationExact,true,"Observed decisions did not match canonical authority");
  assert.equal(body.evidenceExact,true,"Observed evidence status did not match canonical authority");
  assert.equal(persisted.observationExact,true);
  assert.equal(persisted.evidenceExact,true);
  assert.equal(persisted.conditionKept,true);
  assert.ok(Number(body.totalObservations)>0&&
    body.matchingObservations===body.totalObservations);
  log("NATIVE_FIRST_CLARITY_REP_PERSISTED_EXACT_AND_READ_BACK=PASS");
  log("ONE_REP_ONLY_NO_SESSION_TD_OR_STAGE_PROMOTION=PASS");
  return {mode:"submit",eventId:body.eventId,observationExact:true,evidenceExact:true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  await runNativeFirstClarityRep();
}
