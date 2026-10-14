import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { PGlite } from '@electric-sql/pglite';

test('Sandbox prerequisites preserve historical evidence, earned checkpoints, topic attribution and access', async () => {
  // CI uses isolated PostgreSQL 17. Local verification uses a fresh embedded Postgres.
  // Neither connection may target Proof or The Hub.
  const url = process.env.EXCEPTION_CI_DATABASE_URL;
  if (url) assert.match(new URL(url).hostname, /^(localhost|127\.0\.0\.1|postgres)$/);
  const db = url ? new Client({ connectionString: url }) : new PGlite();
  if (db instanceof Client) await db.connect();
  const sql = async (text: string) => {
    if (db instanceof Client) return db.query(text);
    return { rows: (await db.exec(text)).at(-1)?.rows || [] };
  };
  try {
    await sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA private;
      CREATE TABLE public.students(id varchar PRIMARY KEY, concept_mastery jsonb);
      CREATE TABLE public.specialist_sandbox_trajectories(
        id varchar PRIMARY KEY, student_id varchar, status varchar,
        specialist_phase varchar, specialist_stability varchar);
      CREATE TABLE private.specialist_sandbox_trajectory_truth(
        trajectory_id varchar PRIMARY KEY, canonical_phase varchar, canonical_stability varchar);
      CREATE TABLE public.specialist_sandbox_session_evaluations(
        id varchar PRIMARY KEY, trajectory_id varchar, session_number int, evidence jsonb);
      CREATE TABLE public.specialist_sandbox_rep_events(
        id varchar PRIMARY KEY, trajectory_id varchar, session_number int, evidence jsonb);
      ALTER TABLE public.specialist_sandbox_trajectories ENABLE ROW LEVEL SECURITY;
      ALTER TABLE private.specialist_sandbox_trajectory_truth ENABLE ROW LEVEL SECURITY;
      INSERT INTO public.students VALUES ('synthetic', '{"topicConditioning":{"topics":{
        " Algebra ":{"history":[{"drillId":"exact"},{"drillId":"ambiguous"}]},
        "Geometry":{"history":[{"drillId":"ambiguous"}]}}}}');
      INSERT INTO public.specialist_sandbox_trajectories VALUES
        ('earned','synthetic','active','Clarity','High Maintenance'),
        ('building','synthetic','active','Clarity','Medium');
      INSERT INTO private.specialist_sandbox_trajectory_truth VALUES
        ('earned','Clarity','High Maintenance'),('building','Clarity','Medium');
      INSERT INTO public.specialist_sandbox_session_evaluations VALUES
        ('exact','earned',1,'{"status":"confounded","historical":true}'),
        ('ambiguous','earned',2,'{"status":"not_observed","historical":true}'),
        ('unlinked','building',1,'{"status":"observed"}');
      INSERT INTO public.specialist_sandbox_rep_events VALUES
        ('rep1','earned',1,'{"historical":true}'),('rep2','earned',2,'{"historical":true}');`);
    const evidence = async () => (await sql(`SELECT 'session' AS kind,id,evidence FROM public.specialist_sandbox_session_evaluations
      UNION ALL SELECT 'rep',id,evidence FROM public.specialist_sandbox_rep_events ORDER BY kind,id`)).rows;
    const rights = async () => (await sql(`SELECT c.relname,c.relrowsecurity,c.relacl,
      has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
      has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relname IN ('specialist_sandbox_trajectories','specialist_sandbox_trajectory_truth')
      ORDER BY c.relname`)).rows;
    const beforeEvidence = await evidence(), beforeRights = await rights();
    const files = ['20261014013817_sandbox_topic_state_lanes.sql',
      '20261014013826_sandbox_progression_authority.sql','20261014013834_sandbox_behavior_model_v2.sql'];
    for (const file of files) await sql(readFileSync(`migrations/${file}`, 'utf8'));
    assert.deepEqual(await evidence(), beforeEvidence);
    assert.deepEqual(await rights(), beforeRights);
    assert.deepEqual((await sql(`SELECT id,topic_key FROM public.specialist_sandbox_session_evaluations ORDER BY id`)).rows,
      [{id:'ambiguous',topic_key:null},{id:'exact',topic_key:'algebra'},{id:'unlinked',topic_key:null}]);
    assert.deepEqual((await sql(`SELECT id,topic_key FROM public.specialist_sandbox_rep_events ORDER BY id`)).rows,
      [{id:'rep1',topic_key:'algebra'},{id:'rep2',topic_key:null}]);
    assert.deepEqual((await sql(`SELECT specialist_stability,specialist_progression_authority,active_topic_key
      FROM public.specialist_sandbox_trajectories WHERE id='earned'`)).rows,
      [{specialist_stability:'High',specialist_progression_authority:'exit_confirmation_eligible',active_topic_key:null}]);
    assert.deepEqual((await sql(`SELECT canonical_stability,canonical_progression_authority,behavior_model_version
      FROM private.specialist_sandbox_trajectory_truth WHERE trajectory_id='earned'`)).rows,
      [{canonical_stability:'High',canonical_progression_authority:'exit_confirmation_eligible',behavior_model_version:1}]);
    for (const file of files) await sql(readFileSync(`migrations/${file}`, 'utf8'));
    assert.deepEqual(await evidence(), beforeEvidence);
    await assert.rejects(sql(`UPDATE private.specialist_sandbox_trajectory_truth SET behavior_model_version=3`), /check constraint/);
    await assert.rejects(sql(`UPDATE public.specialist_sandbox_trajectories SET specialist_topic_states='[]'`), /check constraint/);
    await assert.rejects(sql(`UPDATE public.specialist_sandbox_trajectories SET specialist_progression_authority='transfer_maintenance' WHERE id='earned'`), /check constraint/);
    await sql(`INSERT INTO private.specialist_sandbox_trajectory_truth(trajectory_id,canonical_phase,canonical_stability)
      VALUES('new','Clarity','Low')`);
    assert.deepEqual((await sql(`SELECT canonical_progression_authority,behavior_model_version
      FROM private.specialist_sandbox_trajectory_truth WHERE trajectory_id='new'`)).rows,
      [{canonical_progression_authority:'building',behavior_model_version:1}]);
  } finally {
    if (db instanceof Client) await db.end(); else await db.close();
  }
});
