import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import pg from "pg";
const url=process.env.QUALIFICATION_TEST_DATABASE_URL;
assert.ok(url,"Isolated PostgreSQL URL required");
const db=new pg.Client({connectionString:url,connectionTimeoutMillis:10000});
await db.connect();
try {
 await db.query([
 "CREATE SCHEMA private;",
 "CREATE ROLE anon NOLOGIN;",
 "CREATE ROLE authenticated NOLOGIN;",
 "CREATE TABLE public.users(id varchar PRIMARY KEY);",
 "CREATE TABLE public.tutor_assignments(id varchar PRIMARY KEY);",
 "CREATE TABLE public.specialist_sandbox_trajectories(id varchar PRIMARY KEY);",
 ].join("\n"));
 const sql=readFileSync(new URL("../docs/migration-proposals/20261015_sandbox_coverage_crossmode_evidence.sql",import.meta.url),"utf8");
 await db.query(sql);
 const protections=await db.query([
 "SELECT c.relname,c.relrowsecurity,",
 "has_table_privilege('anon',c.oid,'SELECT') AS anonymous_read,",
 "has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_read,",
 "has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_write",
 "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace",
 "WHERE c.relname IN ('specialist_sandbox_preparation_events',",
 "'specialist_sandbox_live_evidence_turns','specialist_sandbox_live_evidence_truth')",
 ].join(" "));
 assert.equal(protections.rows.length,3,"All protected tables must exist");
 for(const row of protections.rows){
   assert.equal(row.relrowsecurity,true,row.relname+" must use RLS");
   assert.equal(row.anonymous_read,false,row.relname+" anonymous read");
   assert.equal(row.authenticated_read,false,row.relname+" authenticated read");
   assert.equal(row.authenticated_write,false,row.relname+" authenticated write");
 }
 await db.query([
 "INSERT INTO public.users VALUES('ci-tutor');",
 "INSERT INTO public.tutor_assignments VALUES('ci-assignment');",
 "INSERT INTO public.specialist_sandbox_trajectories VALUES('ci-trajectory');"
 ].join("\n"));
 const prepared=await db.query([
 "INSERT INTO public.specialist_sandbox_preparation_events",
 "(tutor_assignment_id,tutor_id,trajectory_id,student_id,session_number,",
 "topic_key,bank_version,phase,set_id,event_form_id,condition_contract_sha256,",
 "problem_prepared,conditions_reviewed,evidence_plan_reviewed)",
 "VALUES('ci-assignment','ci-tutor','ci-trajectory','ci-student',1,",
 "'fractions',1,'Clarity','identification','form-one',repeat('a',64),true,true,true)",
 "RETURNING id"
 ].join(" "));
 assert.ok(prepared.rows[0]?.id,"Preparation receipt missing");
 await assert.rejects(()=>db.query([
 "INSERT INTO public.specialist_sandbox_preparation_events",
 "(tutor_assignment_id,tutor_id,trajectory_id,student_id,session_number,",
 "topic_key,bank_version,phase,set_id,event_form_id,condition_contract_sha256,",
 "problem_prepared,conditions_reviewed,evidence_plan_reviewed)",
 "VALUES('ci-assignment','ci-tutor','ci-trajectory','ci-student',1,",
 "'fractions',1,'Clarity','identification','different-form',repeat('b',64),true,true,true)"
 ].join(" ")),e=>e.code==="23505","Conflicting second preparation receipt must fail");
 const event=await db.query([
 "INSERT INTO public.specialist_sandbox_live_evidence_turns",
 "(tutor_assignment_id,tutor_id,trajectory_id,student_id,scope,source_context_id,",
 "form_id,sequence_number,phase,probe_id,bank_version,behavior_model_version,",
 "student_behavior,specialist_submission,condition_conformed,observation_exact,",
 "matching_observations,total_observations)",
 "VALUES('ci-assignment','ci-tutor','ci-trajectory','ci-student','diagnosis',",
 "'ci-context','ci-form',1,'Clarity','clarity.recognition',1,2,",
 "'Synthetic student behavior','{}'::jsonb,true,true,1,1) RETURNING id"
 ].join(" "));
 assert.ok(event.rows[0]?.id);
 await db.query([
 "INSERT INTO private.specialist_sandbox_live_evidence_truth",
 "(event_id,outcome_ref,outcome_key,outcome_version,canonical_observations,",
 "trajectory_class,actual_support_event)",
 "VALUES($1,'ci-ref','ci-pattern',1,'[]'::jsonb,'conditional','none')"
 ].join(" "),[event.rows[0].id]);
 await assert.rejects(()=>db.query(
 "UPDATE public.specialist_sandbox_live_evidence_turns SET student_state_authoritative=true WHERE id=$1",
 [event.rows[0].id]),e=>e.code==="23514","Sandbox may never gain real-student state authority");
 console.log("SANDBOX_QUALIFICATION_DB_CONTRACT=PASS");
} finally {await db.end();}
