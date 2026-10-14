import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { confidentialReference, createConfidentialDownloadHandler, ensurePrivateBucket, parseConfidentialReference } from "./confidentialStorage";
import { resolveStoredDocumentUrl } from "../shared/storedDocumentUrl";
const url="https://yzcnavucvwgmulcxgxvw.supabase.co";
test("HTTP confidential reads verify saved record ownership; reject anonymous, cross-account and cross-role access",async()=>{
  const db=new PGlite();
  const stored=confidentialReference("tutor-documents","fictional-owner/id.pdf");
  const historical=url+"/storage/v1/object/public/tutor-documents/fictional-owner/old.pdf";
  let downloads=0;
  await db.exec(`CREATE TABLE tutor_applications(id text,user_id text,doc_6_submission_url text);
    CREATE TABLE td_applications(id text,user_id text,doc_7_submission_url text);
    CREATE TABLE affiliate_applications(id text,user_id text,doc_5_submission_url text);
    CREATE TABLE coo_brain_library_items(id text,pdf_url text);`);
  await db.query("INSERT INTO tutor_applications VALUES ('synthetic','owner-a',$1),('old','owner-a',$2)",[stored,historical]);
  await db.query("INSERT INTO coo_brain_library_items VALUES ('synthetic',$1)",[confidentialReference("coo-brain-library","fictional.pdf")]);
  const app=express();
  app.use((req,_res,next)=>{
    // Test-only identity adapter. Production uses existing isAuthenticated.
    if (req.headers["x-fixture-id"]) (req as any).dbUser={id:req.headers["x-fixture-id"],role:req.headers["x-fixture-role"]};
    next();
  });
  app.get("/api/confidential-file",createConfidentialDownloadHandler({
    query:async(sql,values)=>({rows:(await db.query(sql,values)).rows}),
    supabaseUrl:url,
    client:{storage:{from:()=>({download:async()=>{downloads++;return {data:new Blob(["fictional-pdf"],{type:"application/pdf"}),error:null};}})}} as any,
  }));
  const server=app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.on("listening",resolve));
  const origin="http://127.0.0.1:"+(server.address() as any).port;
  const get=(ref:string,id?:string,role?:string)=>fetch(origin+"/api/confidential-file?reference="+encodeURIComponent(ref),{headers:id?{"x-fixture-id":id,"x-fixture-role":role||""}:{}});
  try {
    assert.equal((await get(stored)).status,401);
    assert.equal((await get(stored,"owner-b","tutor")).status,404);
    assert.equal((await get(stored,"owner-a","parent")).status,404);
    assert.equal((await get(stored,"owner-a","td")).status,404);
    assert.equal(downloads,0);
    for(const [id,role] of [["owner-a","tutor"],["reviewer","coo"],["reviewer","hr"]]){
      const response=await get(stored,id,role);
      assert.equal(response.status,200);
      assert.equal(response.headers.get("cache-control"),"private, no-store");
      assert.equal(await response.text(),"fictional-pdf");
    }
    assert.equal((await get(historical,"owner-a","tutor")).status,200);
    assert.equal((await get(confidentialReference("tutor-documents","unrecorded.pdf"),"reviewer","coo")).status,404);
    assert.equal((await get(confidentialReference("coo-brain-library","fictional.pdf"),"reviewer","hr")).status,404);
    assert.equal((await get(confidentialReference("coo-brain-library","fictional.pdf"),"reviewer","coo")).status,200);
    assert.equal((await get("https://attacker.invalid/storage/v1/object/public/tutor-documents/a.pdf","reviewer","coo")).status,404);
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});
test("bucket creation is private and errors/public historical buckets fail closed",async()=>{
  let created:any=null;
  await ensurePrivateBucket({storage:{
    getBucket:async()=>({error:{statusCode:"404"}}),
    createBucket:async(_bucket:string,options:any)=>{created=options;return {error:null};},
  }} as any,"executive-task-proofs");
  assert.deepEqual(created,{public:false});
  await assert.rejects(ensurePrivateBucket({storage:{getBucket:async()=>({data:{public:true}})}} as any,"tutor-documents"),/public/);
  await assert.rejects(ensurePrivateBucket({storage:{getBucket:async()=>({error:{status:403}})}} as any,"tutor-documents"));
});
test("historical references resolve to protected reads and malicious targets are rejected",()=>{
  const historical=url+"/storage/v1/object/public/coo-brain-library/fictional.pdf";
  assert.deepEqual(parseConfidentialReference(historical,url),{bucket:"coo-brain-library",key:"fictional.pdf"});
  assert.match(resolveStoredDocumentUrl(historical,"https://api.example.org"),/^https:\/\/api.example.org\/api\/confidential-file\?/);
  assert.equal(parseConfidentialReference("ri-storage://tutor-documents/%2e%2e/secret",url),null);
  assert.equal(parseConfidentialReference(historical+"?token=anything",url),null);
  assert.equal(parseConfidentialReference("ri-storage://profile-images/a.jpg",url),null);
});
