import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createSandboxEvidenceDossierHandler } from "./sandboxEvidenceDossier";

let database: PGlite;
before(async () => {
  database = new PGlite();
  await database.exec(`
    CREATE SCHEMA private;
    CREATE TABLE public.pods (id text, td_id text);
    CREATE TABLE public.tutor_assignments (id text, pod_id text, tutor_id text, created_at timestamptz);
    CREATE TABLE public.specialist_sandbox_rep_events (
      id text, tutor_assignment_id text, tutor_id text, event_sequence int,
      session_number int, phase text, topic_key text, set_id text, rep_number int,
      student_behavior text, specialist_submission jsonb, condition_kept boolean,
      total_observations int, matching_observations int, observation_exact boolean,
      evidence_exact boolean, completed_at timestamptz DEFAULT now());
    CREATE TABLE private.specialist_sandbox_rep_event_truth (
      event_id text, bank_key text, bank_version int, outcome_version int,
      canonical_observations jsonb, canonical_prerequisite_sentinel text,
      canonical_inherited_rescue_signal text, actual_intervention_event text);
    CREATE TABLE public.specialist_sandbox_session_evaluations (
      id text, tutor_assignment_id text, tutor_id text, session_number int,
      phase text, topic_key text, authority_aligned boolean, state_track_aligned boolean,
      state_change_observed boolean, specialist_authority jsonb, completed_at timestamptz DEFAULT now());
    CREATE TABLE private.specialist_sandbox_session_truth (session_evaluation_id text, canonical_authority jsonb);
    INSERT INTO pods VALUES ('pod-a', 'td-a'), ('pod-b', 'td-b');
    INSERT INTO tutor_assignments VALUES
      ('a','pod-a','specialist','2026-10-01'), ('b','pod-b','other','2026-10-01'),
      ('old','pod-a','moved','2026-10-01'), ('new','pod-b','moved','2026-10-02');
    INSERT INTO specialist_sandbox_rep_events
      (id,tutor_assignment_id,tutor_id,event_sequence,session_number,phase,set_id,rep_number,
       student_behavior,specialist_submission,condition_kept,total_observations,matching_observations,observation_exact,evidence_exact)
    VALUES
      ('rep-a','a','specialist',1,1,'Clarity','set-1',1,'Independent response',
       '{"observations":{"step":{"optionId":"wrong"}}}',true,1,0,false,true),
      ('missing-truth','a','specialist',2,1,'Clarity','set-1',2,'Response recorded','{}',null,1,1,true,true),
      ('foreign-rep','b','other',1,1,'Clarity','set-1',1,'FOREIGN SECRET','{}',true,1,1,true,true);
    INSERT INTO private.specialist_sandbox_rep_event_truth (event_id,canonical_observations)
    VALUES ('rep-a','{"step":{"optionId":"correct","evidenceStatus":"observed"}}'),
      ('foreign-rep','{"secret":"FOREIGN SECRET"}'), ('future-event','{"secret":"FUTURE ANSWER"}');
    INSERT INTO specialist_sandbox_session_evaluations
      (id,tutor_assignment_id,tutor_id,session_number,phase,authority_aligned,state_track_aligned,specialist_authority)
    VALUES ('session-a','a','specialist',1,'Clarity',false,false,'{"phase":"SE"}');
    INSERT INTO private.specialist_sandbox_session_truth VALUES ('session-a','{"phase":"Clarity"}');
  `);
});
after(async () => { await database?.close(); });

async function invoke(user: unknown, tutorId = 'specialist', db = database) {
  let status = 200;
  let body: any;
  const headers: Record<string,string> = {};
  let queries = 0;
  const handler = createSandboxEvidenceDossierHandler({ query: async (sql, values) => {
    queries++;
    return db.query(sql, values);
  } });
  const req = { dbUser: user, params: { tutorId } };
  const res = {
    status(value: number) { status = value; return this; },
    json(value: unknown) { body = value; return this; },
    setHeader(key: string, value: string) { headers[key] = value; },
  };
  await handler(req as any, res as any);
  return { status, body, headers, queries };
}

test('anonymous and non-TD callers cannot query private evidence', async () => {
  const anon = await invoke(undefined);
  assert.equal(anon.status,401); assert.equal(anon.queries,0);
  for (const role of ['tutor','parent','coo']) {
    const result = await invoke({id:'td-a',role});
    assert.equal(result.status,403); assert.equal(result.queries,0);
  }
});
test('cross-Pod and former-Pod TD access is denied before evidence reads', async () => {
  for (const tutor of ['other','moved','nonexistent']) {
    const result = await invoke({id:'td-a',role:'td'},tutor);
    assert.equal(result.status,403); assert.equal(result.queries,1);
    assert.equal(result.body.reps,undefined);
  }
});
test('assigned TD sees committed mismatches and state consequences without foreign or future truth', async () => {
  const result = await invoke({id:'td-a',role:'td'});
  assert.equal(result.status,200);
  assert.match(result.headers['Cache-Control'],/private, no-store/);
  assert.equal(result.body.reps.length,2);
  const rep = result.body.reps.find((r: any) => r.id === 'rep-a');
  assert.equal(rep.comparisons[0].recorded.optionId,'wrong');
  assert.equal(rep.comparisons[0].expected.optionId,'correct');
  assert.equal(rep.comparisons[0].matched,false);
  assert.equal(result.body.sessions[0].stateTrackAligned,false);
  assert.deepEqual(result.body.sessions[0].canonicalAuthority,{phase:'Clarity'});
  assert.doesNotMatch(JSON.stringify(result.body),/FOREIGN SECRET|FUTURE ANSWER/);
});
test('legacy human-readable option IDs still resolve to canonical labels', async () => {
  await database.exec(`
    UPDATE specialist_sandbox_rep_events
    SET phase = 'Clarity', set_id = 'clarity.identification', rep_number = 1,
        specialist_submission = '{"observations":{"immediateApply":{"optionId":"Clarity Identification Opportunity 1 Clarity Immediate Apply Option 2","evidenceStatus":"observed"}}}'
    WHERE id = 'rep-a';
    UPDATE private.specialist_sandbox_rep_event_truth
    SET canonical_observations = '{"immediateApply":{"optionId":"Clarity Identification Opportunity 1 Clarity Immediate Apply Option 2","evidenceStatus":"observed"}}'
    WHERE event_id = 'rep-a';
  `);
  const result = await invoke({id:'td-a',role:'td'});
  const rep = result.body.reps.find((r: any) => r.id === 'rep-a');
  const comparison = rep.comparisons.find((entry: any) => entry.fieldKey === 'immediateApply');
  assert.equal(comparison.recorded.label, 'Engaged only after extended uncertainty');
  assert.equal(comparison.expected.label, 'Engaged only after extended uncertainty');
});
test('missing canonical and condition evidence remains explicitly unresolved', async () => {
  const result = await invoke({id:'td-a',role:'td'});
  const rep = result.body.reps.find((r: any) => r.id === 'missing-truth');
  assert.equal(rep.truthPresent,false); assert.equal(rep.conditionKept,null);
  assert.deepEqual(rep.comparisons,[]);
});
test('assigned Specialist without evidence returns empty history', async () => {
  const result = await invoke({id:'td-b',role:'td'},'moved');
  assert.equal(result.status,200); assert.deepEqual(result.body.reps,[]);
  assert.deepEqual(result.body.sessions,[]);
});
test('empty input is rejected and database errors return no private details', async () => {
  assert.equal((await invoke({id:'td-a',role:'td'},' ')).status,400);
  const failingDb = {query: async () => {throw new Error('private database details');}};
  const result = await invoke({id:'td-a',role:'td'},'specialist',failingDb as any);
  assert.equal(result.status,500);
  assert.doesNotMatch(JSON.stringify(result.body),/private database details/);
});
test('live route retains authentication middleware', () => {
  const source = readFileSync(new URL('./routes/specialistDevelopment.ts',import.meta.url),'utf8');
  assert.match(source,/app\.get\("\/api\/td\/tutors\/:tutorId\/sandbox-evidence-dossier", isAuthenticated,\s*createSandboxEvidenceDossierHandler\(pool\)/);
});
