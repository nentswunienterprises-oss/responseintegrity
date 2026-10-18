import test from "node:test";
import assert from "node:assert/strict";
import { proofTrainingBookingHandler } from "./proofTrainingBooking";
const tutor = "77977298-7ac9-41f9-a726-9d5fd634540f";
const student = "657994af-a9c4-a7ae-dd13-54cdd462f2ab";
const isolatedTutor = "b8448bbf-e01b-4f7b-bf6a-baf3ddb5d0bc";
const isolatedStudent = "b093523e-6227-4ebb-9894-b3be775dfcf3";
const env = { VERCEL_ENV: "preview", SUPABASE_URL: "https://jftlxeacphvbnhbsbpxc.supabase.co", DATABASE_URL: "postgres://postgres.jftlxeacphvbnhbsbpxc:synthetic@aws-1-eu-central-2.pooler.supabase.com:6543/postgres" };
async function invoke({environment=env, actor=tutor, studentId=student, owned=true, existing=false, fail=false}={}) {
  const queries: string[] = []; let released = false; let connected = false;
  const pool = { connect: async () => {
    connected = true;
    return { release: () => { released = true; }, query: async (sql: string) => {
      queries.push(sql);
      if (sql.includes("SELECT s.parent_id")) return {rows: owned ? [{parent_id:"synthetic-parent"}] : []};
      if (sql.includes("SELECT id FROM")) return {rows: existing ? [{id:"prior-booking"}] : []};
      if (sql.includes("INSERT INTO")) { if (fail) throw new Error("test insertion failed"); return {rows:[{id:"new-booking"}]}; }
      return {rows:[]};
    }};
  }};
  let status = 200; let body: any;
  const res = {status(code:number) {status=code;return this;},json(value:any) {body=value;return this;}};
  await proofTrainingBookingHandler(pool as any, environment as any)({dbUser:{id:actor},body:{studentId}} as any,res as any);
  return {status,body,queries,released,connected};
}
test("booking setup denies Production and other projects before connecting",async()=>{
  for (const environment of [{...env,VERCEL_ENV:"production"},{...env,SUPABASE_URL:"https://other.supabase.co"},{...env,DATABASE_URL:"postgres://postgres.other:synthetic@aws-1-eu-central-2.pooler.supabase.com:6543/postgres"}]) {
    const result=await invoke({environment});assert.equal(result.status,404);assert.equal(result.connected,false);
  }
});
test("booking setup rejects other actors and students before connecting",async()=>{
  for (const input of [{actor:"other"},{studentId:"other"}]) {const result=await invoke(input);assert.equal(result.status,403);assert.equal(result.connected,false);}
});
test("booking setup binds each controlled student allowlist to its exact Specialist",async()=>{
  const isolated=await invoke({actor:isolatedTutor,studentId:isolatedStudent});
  assert.equal(isolated.status,200);assert.equal(isolated.body.studentId,isolatedStudent);
  for (const input of [
    {actor:tutor,studentId:isolatedStudent},
    {actor:isolatedTutor,studentId:student},
  ]) {
    const result=await invoke(input);assert.equal(result.status,403);assert.equal(result.connected,false);
  }
});
test("booking setup requires actual owned Sandbox student",async()=>{
  const result=await invoke({owned:false});assert.equal(result.status,404);assert.ok(result.queries.includes("ROLLBACK"));assert.equal(result.released,true);
});
test("booking setup reuses unfinished confirmed booking without inserting",async()=>{
  const result=await invoke({existing:true});assert.equal(result.body.session.id,"prior-booking");assert.equal(result.body.reused,true);
  assert.ok(!result.queries.some(sql=>sql.includes("INSERT")));assert.ok(result.queries.includes("COMMIT"));
});
test("booking setup only inserts a booking and never modifies learning state",async()=>{
  const result=await invoke();assert.equal(result.status,200);assert.equal(result.body.restoredCanonicalState,false);
  assert.equal(result.queries.filter(sql=>sql.includes("INSERT INTO")).length,1);
  assert.ok(result.queries.some(sql=>sql.includes("pg_advisory_xact_lock")));
  assert.ok(!result.queries.some(sql=>/UPDATE public|DELETE|concept_mastery|personal_profile/.test(sql)));assert.equal(result.released,true);
});
test("failed booking rolls back and releases the transaction",async()=>{
  const result=await invoke({fail:true});assert.equal(result.status,500);assert.ok(result.queries.includes("ROLLBACK"));assert.equal(result.released,true);
});
