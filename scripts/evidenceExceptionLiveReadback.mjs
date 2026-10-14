import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

// Controlled Proof identity only. No rep, assessment or qualification submissions.
const base="https://tt-confidence-o2ple3jpn-relief-works-technologies.vercel.app";
const sha="59a5875514941fb228e51e79fce24b41ae962c8a";

const witnesses=[{"scope":"diagnosis","sourceContextId":"qa-exception-readonly-20261014","topic":"QA Clarity","startingPhase":"Clarity","probeId":"clarity.recognition","sequenceNumber":9,"expectedBehavior":"The student identifies the important information, but a worked example beside the page names the appropriate method before they choose it. They close the example, explain the method in their own words, and make a sound written start."},{"scope":"handover","sourceContextId":"qa-exception-readonly-20261014","topic":"QA Clarity","startingPhase":"Clarity","probeId":"clarity.recognition","sequenceNumber":2606,"expectedBehavior":"The student identifies the important information, but a worked example beside the page names the appropriate method before they choose it. They close the example, explain the method in their own words, and make a sound written start."}];
const uuid=(text)=>{const h=createHash("md5").update(text).digest("hex");return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join("-");};
const bypass=String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET||"").trim();
assert.ok(bypass,"Protected Preview automation credential is unavailable in the approved environment");
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},extraHTTPHeaders:{"x-vercel-protection-bypass":String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET||"")}});
 const page=await context.newPage();
 async function get(path){const response=await context.request.get(base+path,{timeout:60000});assert.ok(response.ok(),"GET "+path.split("?")[0]+" HTTP "+response.status());assert.match(response.headers()["content-type"]||"",/application\/json/,"Preview returned a protection page, not application JSON");return response.json();}
 const provenance=await get("/api/proof-environment");
 assert.equal(provenance.vercelEnv,"preview");assert.equal(provenance.supabaseProjectRef,"jftlxeacphvbnhbsbpxc");assert.equal(provenance.commitSha,sha);
 const login=await context.request.post(base+"/api/auth/signin",{data:{email:process.env.RI_PROOF_EMAIL,password:process.env.RI_PROOF_PASSWORD,expectedRole:"tutor"}});
 assert.ok(login.ok(),"Controlled Specialist authentication failed");
 const runtime=await get("/api/tutor/runtime-mode");assert.equal(runtime.operationalMode,"sandbox");assert.ok(runtime.assignmentId);
 const assignment=runtime.assignmentId;
 // Reuse the published synthetic QA namespace, never export a database identifier.
 for(const witness of witnesses)witness.studentId=uuid("ri-v2-longitudinal-proof-student-3");
 const qs=values=>new URLSearchParams(values).toString();
 const hist=studentId=>get("/api/tutor/sandbox-environment/history?"+qs({tutorAssignmentId:assignment,studentId}));
 const firstHistory=await hist(witnesses[0].studentId);
 for(const witness of witnesses){
  const {expectedBehavior,...params}=witness;
  const endpoint="/api/tutor/sandbox-live-evidence?"+qs({...params,tutorAssignmentId:assignment});
  const response=await get(endpoint);const replay=await get(endpoint);
  assert.equal(response.evidenceScope,"sandbox");assert.equal(response.studentStateAuthoritative,false);
  assert.equal(response.studentBehavior,expectedBehavior);assert.equal(replay.formId,response.formId);
  assert.equal(replay.studentBehavior,response.studentBehavior);
  assert.doesNotMatch(JSON.stringify(response),/"(?:trajectory_seed|canonicalObservations|outcome_key)"/);
  console.log("AUTHENTICATED_WORKED_EXAMPLE_WITNESS=PASS "+witness.scope);
 }
 const afterHistory=await hist(witnesses[0].studentId);
 assert.deepEqual(afterHistory.events,firstHistory.events);assert.deepEqual(afterHistory.sessions,firstHistory.sessions);
 assert.equal(afterHistory.trajectory.completedRepCount,firstHistory.trajectory.completedRepCount);
 for(const [index,topic] of [[5,"QA Clarity"],[6,"QA Execution"],[7,"QA Discomfort"],[8,"QA Pressure"]]){
  const studentId=uuid("ri-v2-longitudinal-proof-student-"+index);
  const scheduledSessionId=uuid("ri-v2-longitudinal-booking-"+index+"-1");
  const endpoint="/api/tutor/sandbox-environment?"+qs({tutorAssignmentId:assignment,studentId,scheduledSessionId,topic,sessionNumber:"1"});
  const response=await get(endpoint);const replay=await get(endpoint);
  assert.equal(response.status,"rep_ready");assert.equal(response.evidenceScope,"sandbox");assert.equal(response.studentStateAuthoritative,false);
  assert.equal(replay.eventFormId,response.eventFormId);assert.equal(replay.rep.studentBehavior,response.rep.studentBehavior);
  assert.doesNotMatch(response.rep.studentBehavior,/camera freezes|audio drops out|display refreshes|screen glitch|working surface leaves/i);
  if(index===5){
   const before=await hist(studentId);
   await page.goto(base+"/specialist/intro-session/"+studentId+"?"+qs({mode:"training",scheduledSessionId,topic,sandboxSession:"1"}),{waitUntil:"domcontentloaded",timeout:90000});
   await page.getByRole("button",{name:/^Begin Rep \d+$/}).click({timeout:60000});
   await page.getByText(response.rep.studentBehavior.slice(0,80),{exact:false}).first().waitFor({timeout:45000});
   const after=await hist(studentId);assert.equal(after.trajectory.completedRepCount,before.trajectory.completedRepCount);assert.deepEqual(after.events,before.events);
   console.log("AUTHENTICATED_NATIVE_TRAINING_RENDER=PASS");
  }
  console.log("AUTHENTICATED_TRAINING_FORM=PASS "+response.prescribedPhase);
 }
 const sourceRoot="client/src/pages/responseconditioningsystem";
 const files=fs.readdirSync(sourceRoot,{recursive:true}).filter(p=>p.endsWith(".tsx")&&p!=="introduction.tsx");
 assert.equal(files.length,21);
 let slides=0;
 for(const file of files){
  const route="/responseconditioningsystem/"+file.replace(/\.tsx$/,"");
  await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:90000});
  await page.getByRole("button",{name:/^(?:Continue|Finish Deep Dive)$/}).first().waitFor({timeout:45000});
  let finished=false;
  for(let step=0;step<90;step++){
   const text=await page.locator("body").innerText();
   assert.doesNotMatch(text,/camera freezes|audio drops out|display refreshes|screen glitch|failed to elicit|working surface leaves/i,route);
   slides++;
   if(await page.getByRole("button",{name:"Finish Deep Dive",exact:true}).count()){finished=true;break;}
   const next=page.getByRole("button",{name:"Continue",exact:true}).last();
   if(!(await next.isEnabled())){
    await page.locator(".ri-teaching-interaction button").first().click();
    const confirm=page.getByRole("button",{name:"Confirm selections",exact:true});
    if(await confirm.count())await confirm.click();
   }
   await next.click();
  }
  assert.ok(finished,"Lesson did not reach its final slide: "+route);
  console.log("AUTHENTICATED_LESSON_RENDER=PASS "+file);
 }
 console.log("EXCEPTION_AUTHENTICATED_READBACK=PASS "+JSON.stringify({runtimeSha:sha,lessons:files.length,slides,qualificationSubmissions:0,repSubmissions:0}));
}finally{await browser.close();}
