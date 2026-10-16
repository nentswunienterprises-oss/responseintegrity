import assert from "node:assert/strict";
// Read-only controlled Preview acceptance, never student mutation or TD signing.
export async function runProtectedAcceptance(e=process.env, fetchImpl=fetch, log=console.log) {
for(const k of ["PROOF_BASE_URL","PROOF_EXPECTED_SHA","RI_PROOF_SPECIALIST_EMAIL","RI_PROOF_SPECIALIST_PASSWORD","RI_PROOF_TD_EMAIL","RI_PROOF_TD_PASSWORD","RI_PROOF_TUTOR_ID","RI_PROOF_STUDENT_ID","RI_PROOF_SESSION_ID","RI_PROOF_TOPIC","VERCEL_AUTOMATION_BYPASS_SECRET"])
 assert.ok(String(e[k]||"").trim(),k+" is required from protected environment");
const base=new URL(e.PROOF_BASE_URL);
assert.equal(base.protocol,"https:");
assert.equal(base.pathname,"/");
assert.match(base.hostname,/^[a-z0-9-]+\.vercel\.app$/);
assert.equal(base.username,"");
assert.equal(base.password,"");
assert.equal(base.port,"");
assert.equal(base.search,"");
assert.equal(base.hash,"");
assert.notEqual(e.RI_PROOF_SPECIALIST_EMAIL.toLowerCase(),e.RI_PROOF_TD_EMAIL.toLowerCase(),"Distinct controlled identities required");
assert.match(e.PROOF_EXPECTED_SHA,/^[0-9a-f]{40}$/);
assert.ok(e.VERCEL_AUTOMATION_BYPASS_SECRET,
 "Protected Preview bypass credential is required. Never disable Vercel protection.");
async function request(path,options={}){
 assert.ok(path.startsWith("/api/"),"Only explicitly scoped API checks are allowed");
 const headers={
   "x-vercel-protection-bypass":e.VERCEL_AUTOMATION_BYPASS_SECRET,
   ...options.headers,
 };
 const response=await fetchImpl(new URL(path,base),{...options,redirect:"manual",signal:AbortSignal.timeout(30000),headers});
 return {response,json:async()=>{assert.match(response.headers.get("content-type")||"",/application\/json/,"Expected JSON API response");return response.json()}};
}
const provenance=await request("/api/proof-environment");
assert.equal(provenance.response.status,200);
const info=await provenance.json();
assert.equal(info.vercelEnv,"preview");
assert.equal(info.supabaseProjectRef,"jftlxeacphvbnhbsbpxc");
assert.equal(info.commitSha,e.PROOF_EXPECTED_SHA);
log("PREVIEW_PROVENANCE=PASS");
const privatePaths=["/api/tutor/sandbox-environment/preparation-plan","/api/td/tutors/"+encodeURIComponent(e.RI_PROOF_TUTOR_ID)+"/sandbox-qualification-review"];
for(const path of privatePaths){
 const result=await request(path);
 assert.ok([401,403].includes(result.response.status),"Anonymous access incorrectly allowed: "+path);
}
log("ANONYMOUS_DENIAL=PASS");
async function signIn(email,password,role){
 const result=await request("/api/auth/signin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password,expectedRole:role})});
 assert.equal(result.response.status,200,"Proof "+role+" sign-in failed");
 const body=await result.json();
 assert.ok(body.dbUser?.id,"Authenticated identity missing");
 assert.equal(body.dbUser.role,role,"Authenticated role mismatch");
 if(role==="tutor") assert.equal(String(body.dbUser.id),e.RI_PROOF_TUTOR_ID,"Controlled Specialist identity mismatch");
 const allCookies=result.response.headers.getSetCookie?.() ||
   [result.response.headers.get("set-cookie")||""];
 const cookie=allCookies.filter(Boolean).map(c=>c.split(";")[0]).join("; ");
 assert.ok(cookie,"No isolated session cookie");
 return cookie;
}
const specialist=await signIn(e.RI_PROOF_SPECIALIST_EMAIL,e.RI_PROOF_SPECIALIST_PASSWORD,"tutor");
const td=await signIn(e.RI_PROOF_TD_EMAIL,e.RI_PROOF_TD_PASSWORD,"td");
async function privateGet(path,cookie){return request(path,{headers:{cookie}})}
const denial=await privateGet(privatePaths[1],specialist);
assert.equal(denial.response.status,403,"Specialist must not see TD evidence");
const review=await privateGet(privatePaths[1],td);
assert.equal(review.response.status,200,"Assigned TD evidence review inaccessible");
const data=await review.json();
assert.equal(data.tutorId,e.RI_PROOF_TUTOR_ID);
assert.equal(data.qualification?.qualificationReady,false,"Unaccepted Proof must not grant qualification");
assert.ok(!JSON.stringify(data).includes("canonical_observations"),"Private answer leakage");
log("TD_SCOPE=PASS");
const mode=await privateGet("/api/tutor/runtime-mode",specialist);
assert.equal(mode.response.status,200);
const runtime=await mode.json();
assert.equal(runtime.operationalMode,"sandbox");
assert.ok(runtime.assignmentId,"Sandbox assignment required");
assert.equal(data.tutorAssignmentId,runtime.assignmentId,"TD dossier assignment mismatch");
log("SPECIALIST_SANDBOX_AUTHORITY=PASS");
{
 const params=new URLSearchParams({studentId:e.RI_PROOF_STUDENT_ID,scheduledSessionId:e.RI_PROOF_SESSION_ID,topic:e.RI_PROOF_TOPIC});
 const plan=await privateGet("/api/tutor/sandbox-environment/preparation-plan?"+params,specialist);
 assert.equal(plan.response.status,200);
 const payload=await plan.json();
 assert.equal(payload.captureActive,true,"Proof capture not enabled");
 assert.ok(!JSON.stringify(payload).includes("studentBehavior"));
 assert.ok(!JSON.stringify(payload).includes("canonicalObservations"));
 log("SINGLE_PREP_PRESCRIPTION=PASS");
}
log("BOUNDED_AUTHENTICATED_PROOF_ACCEPTANCE=PASS");

}
if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
 await runProtectedAcceptance();
}
