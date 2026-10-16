import test from "node:test";
import assert from "node:assert/strict";
import {runProtectedAcceptance} from "./sandboxQualificationProtectedAcceptance.mjs";

const config={
 PROOF_BASE_URL:"https://controlled-preview.vercel.app",
 PROOF_EXPECTED_SHA:"a".repeat(40),
 RI_PROOF_SPECIALIST_EMAIL:"specialist@example.invalid",
 RI_PROOF_SPECIALIST_PASSWORD:"synthetic-specialist",
 RI_PROOF_TD_EMAIL:"td@example.invalid",RI_PROOF_TD_PASSWORD:"synthetic-td",
 RI_PROOF_TUTOR_ID:"specialist",RI_PROOF_STUDENT_ID:"student",
 RI_PROOF_SESSION_ID:"session",RI_PROOF_TOPIC:"topic",
 VERCEL_AUTOMATION_BYPASS_SECRET:"synthetic-bypass"
};
function fixture(override=()=>null){
 const calls=[],logs=[];
 const fetchImpl=async(url,options)=>{
  const path=url.pathname,cookie=options.headers.cookie;
  calls.push({url,options});
  assert.equal(url.origin,new URL(config.PROOF_BASE_URL).origin);
  assert.equal(options.redirect,"manual");
  assert.equal(options.headers["x-vercel-protection-bypass"],config.VERCEL_AUTOMATION_BYPASS_SECRET);
  assert.ok(options.signal);
  assert.ok(!options.method || options.method==="POST"&&path==="/api/auth/signin","No evidence or stage writes permitted");
  let status=200,body={};
  if(path==="/api/proof-environment")body={vercelEnv:"preview",supabaseProjectRef:"jftlxeacphvbnhbsbpxc",commitSha:config.PROOF_EXPECTED_SHA};
  else if(path==="/api/auth/signin"){
   const role=JSON.parse(options.body).expectedRole;
   return override(path,{role,calls})||Response.json({dbUser:{id:role==="tutor"?"specialist":"td",role}},{headers:{"set-cookie":"session="+role+"; Secure; HttpOnly"}});
  }else if(!cookie)status=401;
  else if(path.includes("sandbox-qualification-review")){
   if(cookie==="session=tutor")status=403;
   else body={tutorId:"specialist",tutorAssignmentId:"assignment",qualification:{qualificationReady:false},evidence:[]};
  }else if(path.endsWith("runtime-mode"))body={operationalMode:"sandbox",assignmentId:"assignment"};
  else body={captureActive:true,phase:"Clarity",sets:[]};
  return override(path,{cookie,body,status,calls})||Response.json(body,{status});
 };
 return {calls,logs,run:(env={})=>runProtectedAcceptance({...config,...env},fetchImpl,m=>logs.push(m))};
}
test("successful scoped smoke checks preparation and keeps isolated roles without state writes",async()=>{
 const f=fixture();await f.run();
 assert.ok(f.logs.includes("SINGLE_PREP_PRESCRIPTION=PASS"));
 assert.ok(f.logs.includes("BOUNDED_AUTHENTICATED_PROOF_ACCEPTANCE=PASS"));
 assert.equal(f.calls.filter(x=>x.options.method==="POST").length,2);
});
for(const key of Object.keys(config))test("missing "+key+" fails before network",async()=>{
 const f=fixture();await assert.rejects(f.run({[key]:""}));assert.equal(f.calls.length,0);
});
for(const url of ["http://controlled-preview.vercel.app","https://user:password@controlled-preview.vercel.app","https://controlled-preview.vercel.app?other=1","https://controlled-preview.vercel.app#fragment","https://other.example","https://controlled-preview.vercel.app:8443"])
 test("reject unsafe target "+url,async()=>{const f=fixture();await assert.rejects(f.run({PROOF_BASE_URL:url}));assert.equal(f.calls.length,0)});
for(const [field,value] of [["vercelEnv","production"],["supabaseProjectRef","wrong"],["commitSha","b".repeat(40)]])
 test("reject provenance "+field,async()=>{
 const f=fixture((path,{body})=>path==="/api/proof-environment"?Response.json({...body,[field]:value}):null);
 await assert.rejects(f.run());assert.equal(f.calls.length,1);
});
test("redirect fails before credentials are sent",async()=>{
 const f=fixture(path=>path==="/api/proof-environment"?new Response(null,{status:302,headers:{location:"https://other.example"}}):null);
 await assert.rejects(f.run());assert.equal(f.calls.length,1);
});
test("HTML success is not accepted as API proof",async()=>{
 const f=fixture(path=>path==="/api/proof-environment"?new Response("<html/>",{headers:{"content-type":"text/html"}}):null);
 await assert.rejects(f.run());assert.equal(f.calls.length,1);
});
for(const [name,override] of [
 ["wrong login role",(path,{role})=>path==="/api/auth/signin"?Response.json({dbUser:{id:"specialist",role:"coo"}}):null],
 ["specialist can read TD dossier",(path,{cookie})=>path.includes("qualification-review")&&cookie==="session=tutor"?Response.json({}):null],
 ["wrong assignment",(path,{body,cookie})=>path.includes("qualification-review")&&cookie==="session=td"?Response.json({...body,tutorAssignmentId:"other"}):null],
 ["unaccepted qualification",(path,{body,cookie})=>path.includes("qualification-review")&&cookie==="session=td"?Response.json({...body,qualification:{qualificationReady:true}}):null],
 ["preparation capture disabled",(path,{body,cookie})=>path.endsWith("preparation-plan")&&cookie?Response.json({...body,captureActive:false}):null],
 ["future behavior leak",(path,{body,cookie})=>path.endsWith("preparation-plan")&&cookie?Response.json({...body,studentBehavior:"future"}):null]
])test("fail closed: "+name,async()=>{const f=fixture(override);await assert.rejects(f.run());assert.ok(!f.logs.includes("BOUNDED_AUTHENTICATED_PROOF_ACCEPTANCE=PASS"));});
