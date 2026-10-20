import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

test("actual executive file route denies unappointed/cross-task actors and never issues public URLs",async()=>{
  process.env.DATABASE_URL="postgres://fictional:fictional@127.0.0.1:1/fictional";
  process.env.SUPABASE_URL="https://jftlxeacphvbnhbsbpxc.supabase.co";
  process.env.SUPABASE_SECRET_KEY="sb_secret_fictional_only_no_network";
  process.env.EMERGENCY_DB_MODE="true";
  const {pool}=await import("./db");
  const {supabase}=await import("./storage");
  const {registerExecutiveCommandRhythmRoutes}=await import("./routes/executiveCommandRhythm");
  const originalQuery=pool.query, originalFrom=supabase.from,originalStorage=supabase.storage;
  let downloads=0,publicCalls=0;
  const users=[["owner","cto"],["other","cmo"],["supporter","hr"],["reviewer","coo"]].map(([id,role])=>({id,role,name:"Synthetic",email:id+"@example.invalid"}));
  (pool as any).query=async(sql:string)=>({rows:sql.includes("executive_role_appointments")
    ? users.map(u=>({id:u.id,role:u.role,appointed_user_id:u.id}))
    :users});
  (supabase as any).from=(table:string)=>{
    const filters:Record<string,string>={};
    const chain:any={
      select:()=>chain,eq:(key:string,value:string)=>{filters[key]=value;return chain;},
      maybeSingle:async()=>({error:null,data:table==="executive_command_tasks"
        ? (filters.id==="task-a"?{id:"task-a",owner_user_id:"owner",supporting_user_ids:["supporter"]}:null)
        : (filters.task_id==="task-a" && filters.id==="proof-a"?{proof_type:"doc",proof_url:"ri-storage://executive-task-proofs/task-proofs/task-a/fictional.pdf"}:null)}),
    };return chain;
  };
  (supabase as any).storage={from:()=>({
    download:async()=>{downloads++;return {data:new Blob(["fictional-proof"],{type:"application/pdf"}),error:null};},
    getPublicUrl:()=>{publicCalls++;throw new Error("Forbidden public URL");},
  })};
  const app=express();app.use(express.json());
  registerExecutiveCommandRhythmRoutes(app,(req,res,next)=>{
    if (!req.headers["x-fixture-id"]) {res.status(401).end();return;}
    (req as any).dbUser={id:req.headers["x-fixture-id"],role:req.headers["x-fixture-role"]};next();
  });
  const server=app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.on("listening",resolve));
  const origin="http://127.0.0.1:"+(server.address() as any).port;
  const get=(id?:string,role?:string,task="task-a",proof="proof-a")=>fetch(origin+`/api/executive/command-rhythm/tasks/${task}/proofs/${proof}/file`,{headers:id?{"x-fixture-id":id,"x-fixture-role":role||""}:{}});
  try {
    assert.equal((await get()).status,401);
    assert.equal((await get("other","cmo")).status,404);
    assert.equal((await get("unappointed","cto")).status,403);
    assert.equal((await get("owner","parent")).status,403);
    assert.equal((await get("owner","cto","task-b")).status,404);
    assert.equal((await get("owner","cto","task-a","foreign-proof")).status,404);
    assert.equal(downloads,0);
    for (const [id,role] of [["owner","cto"],["supporter","hr"],["reviewer","coo"]]) {
      const response=await get(id,role);
      assert.equal(response.status,200);
      assert.equal(response.headers.get("cache-control"),"private, no-store");
      assert.equal(await response.text(),"fictional-proof");
    }
    const deniedUpload=await fetch(origin+"/api/executive/command-rhythm/tasks/task-a/proofs",{method:"POST",headers:{"content-type":"application/json","x-fixture-id":"other","x-fixture-role":"cmo"},body:JSON.stringify({proofType:"doc",label:"Synthetic"})});
    assert.equal(deniedUpload.status,403);
    assert.equal(publicCalls,0);
  } finally {
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    (pool as any).query=originalQuery;(supabase as any).from=originalFrom;(supabase as any).storage=originalStorage;
    await pool.end();
  }
});
