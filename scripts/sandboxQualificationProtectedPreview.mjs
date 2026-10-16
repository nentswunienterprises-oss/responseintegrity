import assert from "node:assert/strict";

const base = new URL(process.env.PROOF_BASE_URL);
assert.equal(base.protocol, "https:");
assert.equal(base.pathname, "/");
assert.match(base.hostname, /^[a-z0-9-]+\\.vercel\\.app$/);
const sha = process.env.PROOF_EXPECTED_SHA;
const proofProject = process.env.PROOF_EXPECTED_PROJECT;
assert.match(sha, /^[0-9a-f]{40}$/);
assert.equal(proofProject, "jftlxeacphvbnhbsbpxc");
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";
const bypassHeader = bypass ? {"x-vercel-protection-bypass":bypass} : {};
const fetchApi = async(path,options={}) => {
  assert.ok(path.startsWith("/api/"));
  return fetch(new URL(path,base),{redirect:"manual",...options,headers:{
    ...bypassHeader,...options.headers
  }});
};
const readJson = async (r,label) => {
  const type=r.headers.get("content-type")||"";
  assert.match(type,/application\\/json/,label+" was not a JSON API result");
  return r.json();
};
const provenanceResponse=await fetchApi("/api/proof-environment");
assert.equal(provenanceResponse.status,200,"Preview protected provenance failed");
const provenance=await readJson(provenanceResponse,"provenance");
assert.equal(provenance.vercelEnv,"preview","No Production calls permitted");
assert.equal(provenance.supabaseProjectRef,proofProject,"Wrong database environment");
assert.equal(provenance.commitSha,sha,"Preview is stale or did not deploy tested commit");
console.log("PREVIEW_PROVENANCE=PASS");

const roleSecrets={
  specialist:{email:process.env.RI_PROOF_EMAIL,password:process.env.RI_PROOF_PASSWORD},
  td:{email:process.env.RI_PROOF_TD_EMAIL,password:process.env.RI_PROOF_TD_PASSWORD}
};
for(const [role,creds] of Object.entries(roleSecrets))
  assert.ok(creds.email&&creds.password,
    "Protected Capability Proof "+role+" identity secrets required; no fallback login");

const login=async(role,creds)=>{
  let cookie="";
  const response=await fetchApi("/api/auth/signin",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({email:creds.email,password:creds.password,
      expectedRole:role==="specialist"?"tutor":"td"})
  });
  assert.equal(response.status,200,role+" login denied");
  const body=await readJson(response,role+" authentication");
  const identity=body.dbUser;
  assert.ok(identity?.id,role+" identity missing");
  assert.equal(String(identity.role).toLowerCase(),role==="specialist"?"tutor":"td");
  const setCookies=response.headers.getSetCookie?.()||[];
  cookie=setCookies.map(v=>v.split(";")[0]).join("; ");
  assert.ok(cookie,"Secure session cookie missing for "+role);
  return {cookie,id:String(identity.id)};
};
const specialist=await login("specialist",roleSecrets.specialist);
const td=await login("td",roleSecrets.td);
assert.notEqual(specialist.id,td.id,"Distinct Proof identities required");
console.log("PROOF_ROLE_AUTHENTICATION=PASS");
const authGet=(path,identity)=>fetchApi(path,{headers:{"cookie":identity.cookie}});
const runtimeResponse=await authGet("/api/tutor/runtime-mode",specialist);
assert.equal(runtimeResponse.status,200,"Specialist Sandbox runtime unavailable");
const runtime=await readJson(runtimeResponse,"Sandbox runtime");
assert.equal(runtime.operationalMode,"sandbox","Controlled Specialist is not in Sandbox");
assert.ok(runtime.assignmentId,"Controlled assigned Sandbox ID required");
const encoded=encodeURIComponent(specialist.id);
const tdReviewPath="/api/td/tutors/"+encoded+"/sandbox-qualification-review";
const specialistDenied=await authGet(tdReviewPath,specialist);
assert.equal(specialistDenied.status,403,"Specialist must not access TD-only history");
const anonymousDenied=await fetchApi(tdReviewPath);
assert.ok([401,403].includes(anonymousDenied.status),"Anonymous TD report must be denied");
const tdReview=await authGet(tdReviewPath,td);
assert.equal(tdReview.status,200,"Assigned TD's historical dossier unavailable");
const review=await readJson(tdReview,"TD review");
assert.equal(String(review.tutorId),specialist.id,"TD review scope mismatch");
assert.equal(String(review.tutorAssignmentId),String(runtime.assignmentId));
assert.equal(review.qualification?.qualificationReady,false,
  "Do not silently qualify a Specialist in unaccepted Proof");
const serialized=JSON.stringify(review);
for(const prohibited of ["canonical_observations","trajectory_seed","futureOutcome","canonicalAnswers"])
  assert.ok(!serialized.includes(prohibited),"Private canonical material leaked: "+prohibited);
console.log("TD_ROLE_AND_HISTORICAL_SCOPE=PASS");
console.log("PRACTICALS_NOT_PROMOTED=PASS");
console.log("READ_ONLY_AUTHENTICATED_SANDBOX_ACCEPTANCE=PASS");
