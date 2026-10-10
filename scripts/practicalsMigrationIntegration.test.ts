import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const databaseUrl=process.env.PRACTICALS_CI_DATABASE_URL;

test("Managed Practicals migration executes on PostgreSQL and enforces immutable test evidence",{
  skip:!databaseUrl && "Run against an isolated Postgres service via Practicals Acceptance CI",
},async()=>{
  const db=new Client({connectionString:databaseUrl});
  await db.connect();
  try {
    // Ephemeral database only: synthetic identities never touch The Hub.
    await db.query(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN;
      CREATE SCHEMA private;
      CREATE TABLE public.users(id varchar PRIMARY KEY);
      CREATE TABLE public.tutor_assignments(
        id varchar PRIMARY KEY,
        tutor_id varchar NOT NULL REFERENCES public.users(id)
      );`);
    const sql=readFileSync("migrations/20261009_practicals_evidence_stage_v1.sql","utf8");
    await db.query(sql);

    const expected=[
      ["public","specialist_capability_practical_evidence"],
      ["public","specialist_capability_practical_reviews"],
      ["public","tutor_sandbox_mock_assessments"],
      ["public","specialist_practical_completion_decisions"],
      ["public","specialist_practical_execute_challenges"],
      ["private","specialist_practical_execute_challenge_truth"],
      ["public","specialist_practical_execute_turns"],
    ];
    for(const [schema,table] of expected){
      const {rows}=await db.query(
        `SELECT c.relrowsecurity, c.relkind FROM pg_class c
         JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname=$1 AND c.relname=$2`,[schema,table]);
      assert.equal(rows.length,1,`Missing ${schema}.${table}`);
      assert.equal(rows[0].relrowsecurity,true,`RLS disabled on ${schema}.${table}`);
    }
    const rights=await db.query(`SELECT
      has_table_privilege('anon','public.tutor_sandbox_mock_assessments','SELECT') AS anon_select,
      has_table_privilege('authenticated','public.specialist_capability_practical_evidence','INSERT') AS authenticated_insert,
      has_table_privilege('service_role','public.tutor_sandbox_mock_assessments','INSERT') AS server_insert,
      has_table_privilege('anon','private.specialist_practical_execute_challenge_truth','SELECT') AS anon_private_truth`);
    assert.deepEqual(rights.rows[0],{
      anon_select:false,authenticated_insert:false,server_insert:true,anon_private_truth:false,
    });

    const tutorId=randomUUID(), reviewerId=randomUUID(),assignmentId=randomUUID(),challengeId=randomUUID();
    await db.query("INSERT INTO public.users(id) VALUES ($1),($2)",[tutorId,reviewerId]);
    await db.query("INSERT INTO public.tutor_assignments(id,tutor_id) VALUES ($1,$2)",[assignmentId,tutorId]);
    await db.query(`INSERT INTO public.specialist_practical_execute_challenges
      (id,tutor_assignment_id,tutor_id,challenge_version,attempt_number,status,active_turn)
      VALUES ($1,$2,$3,1,1,'active',1)`,[challengeId,assignmentId,tutorId]);
    await db.query(`INSERT INTO private.specialist_practical_execute_challenge_truth(challenge_id,plan)
      VALUES ($1,$2::jsonb)`,[challengeId,JSON.stringify({version:1,seed:"test only",privateBank:{bankVersion:1}})]);

    const insertExecute=()=>db.query(`INSERT INTO public.specialist_capability_practical_evidence
      (tutor_assignment_id,tutor_id,proof_key,proof_version,attempt_number,artifact_url,artifact_type,
       declaration,competency_links,execute_challenge_id,no_real_student_data_confirmed)
      VALUES ($1,$2,'execute',2,1,'https://example.org/recording','video','{}'::jsonb,'[]'::jsonb,$3,true)
      RETURNING id`,[assignmentId,tutorId,challengeId]);

    await assert.rejects(insertExecute(),/requires exactly three persisted/);
    await assert.rejects(db.query(`UPDATE public.specialist_practical_execute_challenges
      SET active_turn=4,status='complete',completed_at=now() WHERE id=$1`,[challengeId]),
      /advance one recorded turn/);
    await assert.rejects(db.query(`UPDATE private.specialist_practical_execute_challenge_truth
      SET plan='{}'::jsonb WHERE challenge_id=$1`,[challengeId]),/immutable/);

    for(let n=1;n<=3;n++){
      const event={number:n,kind:n===3?"observability_interruption":"difficulty",studentBehavior:"Synthetic student behavior only"};
      const response={intervention:"none",observedBehavior:"Only synthetic work observed",evidenceStatus:n===3?"not_observed":"observed"};
      await db.query(`INSERT INTO public.specialist_practical_execute_turns
        (challenge_id,turn_number,event_snapshot,specialist_response,risk_flags)
        VALUES ($1,$2,$3::jsonb,$4::jsonb,'[]'::jsonb)`,
        [challengeId,n,JSON.stringify(event),JSON.stringify(response)]);
      await db.query(`UPDATE public.specialist_practical_execute_challenges
        SET active_turn=$2,status=$3,
        completed_at=CASE WHEN $3='complete' THEN now() ELSE NULL END WHERE id=$1`,
        [challengeId,n+1,n===3?"complete":"active"]);
    }
    await assert.rejects(db.query(`UPDATE public.specialist_practical_execute_turns
      SET specialist_response='{}'::jsonb WHERE challenge_id=$1`,[challengeId]),/immutable/);
    await assert.rejects(db.query(`UPDATE public.specialist_practical_execute_challenges
      SET active_turn=1,status='active',completed_at=NULL WHERE id=$1`,[challengeId]),
      /cannot be deleted or reset|must advance one recorded turn/);

    const evidence=await insertExecute();
    assert.ok(evidence.rows[0]?.id,"A completed, matched three-turn Execute must link to one evidence row");
    await assert.rejects(insertExecute(),/duplicate key|unique constraint/);
    await assert.rejects(db.query(`UPDATE public.specialist_capability_practical_evidence
      SET declaration='{}'::jsonb WHERE id=$1`,[evidence.rows[0].id]),/immutable/);
    const review=await db.query(`INSERT INTO public.specialist_capability_practical_reviews
      (evidence_id,reviewer_id,reviewer_role,outcome,execute_trace_video_verified)
      VALUES($1,$2,'td','approved',true) RETURNING id`,[evidence.rows[0].id,reviewerId]);
    await assert.rejects(db.query(`UPDATE public.specialist_capability_practical_reviews
      SET outcome='repeat_required' WHERE id=$1`,[review.rows[0].id]),/immutable/);
    const decision=await db.query(`INSERT INTO public.specialist_practical_completion_decisions
      (tutor_assignment_id,tutor_id,td_user_id,decision,proof_evidence_ids,evidence_note)
      VALUES ($1,$2,$3,'approved',$4::jsonb,$5) RETURNING id`,
      [assignmentId,tutorId,reviewerId,JSON.stringify({execute:evidence.rows[0].id}),"Controlled database-only CI fixture, not a qualification." ]);
    await assert.rejects(db.query(`DELETE FROM public.specialist_practical_completion_decisions
      WHERE id=$1`,[decision.rows[0].id]),/immutable/);
    const {rows:counts}=await db.query(`SELECT
      (SELECT count(*)::int FROM public.specialist_practical_execute_turns) AS turns,
      (SELECT count(*)::int FROM public.specialist_capability_practical_evidence) AS evidence,
      (SELECT count(*)::int FROM public.specialist_capability_practical_reviews) AS reviews,
      (SELECT count(*)::int FROM public.specialist_practical_completion_decisions) AS decisions`);
    assert.deepEqual(counts[0],{turns:3,evidence:1,reviews:1,decisions:1});
  }finally{
    await db.end();
  }
});
