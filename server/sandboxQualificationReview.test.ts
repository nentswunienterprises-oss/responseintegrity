import test from "node:test";
import assert from "node:assert/strict";
import {createTdSandboxQualificationReview} from "./sandboxQualificationReview";
function response(){
 const state:{statusCode:number;headers:Record<string,string>;body:any}={statusCode:200,headers:{},body:null};
 const res:any={
  status(n:number){state.statusCode=n;return res;},
  setHeader(k:string,v:string){state.headers[k]=v;return res;},
  json(value:any){state.body=value;return res;},
 };
 return {res,state};
}
const req=(role:string|null,id="td",tutorId="specialist"):any=>({
 params:{tutorId},dbUser:role?{role,id}:null,
});
test("anonymous and non-TD callers never read private qualification evidence",async()=>{
 let queries=0;const db={query:async()=>{queries++;return {rows:[]};}};
 const handler=createTdSandboxQualificationReview(db);
 let x=response();await handler(req(null),x.res);assert.equal(x.state.statusCode,401);
 x=response();await handler(req("tutor"),x.res);assert.equal(x.state.statusCode,403);
 assert.equal(queries,0);
});
test("former-Pod or cross-Pod TD cannot read assigned history",async()=>{
 const queries:string[]=[];
 const db={query:async(sql:string)=>{queries.push(sql);return {rows:[]};}};
 const x=response();await createTdSandboxQualificationReview(db)(req("td"),x.res);
 assert.equal(x.state.statusCode,403);
 assert.equal(queries.length,1);
 assert.doesNotMatch(queries[0],/private\./);
});
test("authorized TD sees historical requirements but never future answer options",async()=>{
 const queries:string[]=[];
 const db={query:async(sql:string)=>{
  queries.push(sql);
  if(sql.includes("FROM (SELECT id,pod_id"))return {rows:[{id:"assigned"}]};
  if(sql.includes("FROM public.specialist_sandbox_live_evidence_turns"))
   throw Object.assign(new Error("relation missing"),{code:"42P01"});
  return {rows:[]};
 }};
 const x=response();await createTdSandboxQualificationReview(db)(req("td"),x.res);
 assert.equal(x.state.statusCode,200);
 assert.equal(x.state.headers["Cache-Control"],"private,no-store,max-age=0");
 assert.equal(x.state.body.qualification.qualificationReady,false);
 assert.ok(x.state.body.qualification.requirements.length>10);
 assert.ok(x.state.body.sourceGaps.length);
 assert.ok(!JSON.stringify(x.state.body).includes("canonical_observations"));
});
