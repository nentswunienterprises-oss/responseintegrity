import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { evaluatePracticalEntryGate } from "../shared/practicalEntryGate";
import { derivePracticalCompletionGate } from "../shared/practicalCompletionGate";

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
      CREATE TABLE public.pods(
        id varchar PRIMARY KEY,
        td_id varchar REFERENCES public.users(id),
        pod_name varchar
      );
      CREATE TABLE public.tutor_assignments(
        id varchar PRIMARY KEY,
        tutor_id varchar NOT NULL REFERENCES public.users(id),
        pod_id varchar REFERENCES public.pods(id)
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

    const tutorId=randomUUID(), reviewerId=randomUUID(),assignmentId=randomUUID(),challengeId=randomUUID(),podId=randomUUID();
    await db.query("INSERT INTO public.users(id) VALUES ($1),($2)",[tutorId,reviewerId]);
    await db.query("INSERT INTO public.pods(id,td_id,pod_name) VALUES($1,$2,'CI assigned TD')",[podId,reviewerId]);
    await db.query("INSERT INTO public.tutor_assignments(id,tutor_id,pod_id) VALUES ($1,$2,$3)",[assignmentId,tutorId,podId]);
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
        SET active_turn=$2,status=$3::varchar,
        completed_at=CASE WHEN $3::varchar='complete' THEN now() ELSE NULL END WHERE id=$1`,
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
    // A completed qualification requires all THREE independently approved
    // current-version proofs. These are explicit synthetic CI fixtures only.
    const proofIds:Record<string,string>={execute:String(evidence.rows[0].id)};
    for(const key of ["prepare","evidence"] as const){
      const result=await db.query(`INSERT INTO public.specialist_capability_practical_evidence
        (tutor_assignment_id,tutor_id,proof_key,proof_version,attempt_number,
         artifact_url,artifact_type,declaration,competency_links,no_real_student_data_confirmed)
        VALUES($1,$2,$3,1,1,'https://example.org/synthetic-fixture','screen_voice',
          '{}'::jsonb,'[]'::jsonb,true) RETURNING id`,
        [assignmentId,tutorId,key]);
      proofIds[key]=String(result.rows[0].id);
      await db.query(`INSERT INTO public.specialist_capability_practical_reviews
        (evidence_id,reviewer_id,reviewer_role,outcome)
        VALUES($1,$2,'td','approved')`,[proofIds[key],reviewerId]);
    }

    const approvedSnapshot={
      practicalsReady:true, policyStatus:"approved", policyVersion:2,
      bankKey:"sandbox-ci-only", bankVersion:3,
    };
    await db.query(`INSERT INTO public.tutor_sandbox_mock_assessments
      (tutor_id,tutor_assignment_id,decision,checklist,evidence_note,assessed_by_user_id)
      VALUES($1,$2,'passed',$3::jsonb,$4,$5)`,[
        tutorId,assignmentId,JSON.stringify({
          assessment_version:2,assessment_owner:"td",next_stage:"practicals",
          capability_snapshot:approvedSnapshot,
        }),
        "A synthetic, isolated PostgreSQL fixture demonstrating TD signoff storage.",
        reviewerId,
      ]);
    assert.equal(evaluatePracticalEntryGate({
      operationalMode:"sandbox",assignedTdId:reviewerId,
      latestAssignedTdSignoff:{decision:"passed",capabilitySnapshot:approvedSnapshot},
      currentReadiness:approvedSnapshot,
    }).ready,true);

    const proofRows=await db.query(`SELECT e.id,e.proof_key,e.proof_version,r.outcome
       FROM public.specialist_capability_practical_evidence e
       JOIN public.specialist_capability_practical_reviews r ON r.evidence_id=e.id
       WHERE e.tutor_assignment_id=$1 ORDER BY e.proof_key`,[assignmentId]);
    assert.equal(proofRows.rowCount,3);
    const gateProofs=proofRows.rows.map(row=>({
       key:String(row.proof_key),version:Number(row.proof_version),
       evidenceId:String(row.id),status:String(row.outcome),
    }));
    const candidateDecision={decision:"approved",proof_evidence_ids:proofIds};
    assert.equal(derivePracticalCompletionGate({
      entryReady:true,
      proofs:gateProofs,
      tdDecision:candidateDecision,
    }).readyForTrial,true);
    assert.equal(derivePracticalCompletionGate({
      entryReady:true,
      proofs:gateProofs.slice(0,1),
      tdDecision:candidateDecision,
    }).readyForTrial,false);
    assert.equal(derivePracticalCompletionGate({
      entryReady:false,
      proofs:gateProofs,
      tdDecision:candidateDecision,
    }).readyForTrial,false);

    const decision=await db.query(`INSERT INTO public.specialist_practical_completion_decisions
      (tutor_assignment_id,tutor_id,td_user_id,decision,proof_evidence_ids,evidence_note)
      VALUES ($1,$2,$3,'approved',$4::jsonb,$5) RETURNING id`,
      [assignmentId,tutorId,reviewerId,JSON.stringify(proofIds),"Controlled isolated three-proof fixture; not a real Specialist qualification." ]);
    await assert.rejects(db.query(`DELETE FROM public.specialist_practical_completion_decisions
      WHERE id=$1`,[decision.rows[0].id]),/immutable/);
    const {rows:counts}=await db.query(`SELECT
      (SELECT count(*)::int FROM public.specialist_practical_execute_turns) AS turns,
      (SELECT count(*)::int FROM public.specialist_capability_practical_evidence) AS evidence,
      (SELECT count(*)::int FROM public.specialist_capability_practical_reviews) AS reviews,
      (SELECT count(*)::int FROM public.specialist_practical_completion_decisions) AS decisions`);
    assert.deepEqual(counts[0],{turns:3,evidence:3,reviews:3,decisions:1});

    // Second governed schema adds multi-situation video examinations only.
    // Historical proof data stays as evidence, but is no longer current-version
    // stage-completion authority. All fixtures remain in isolated CI PostgreSQL.
    const videoSql=readFileSync("migrations/20261011_practicals_shared_video_benchmarks_v1.sql","utf8");
    await db.query(videoSql);
    for(const relation of ["specialist_practical_benchmark_runs","specialist_practical_benchmark_case_reveals","specialist_practical_case_actions","specialist_practical_recording_recovery_requests","specialist_practical_recording_recovery_decisions"]){
      const {rows}=await db.query(
        `SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relname=$1`,[relation]);
      assert.equal(rows.length,1);
      assert.equal(rows[0].relrowsecurity,true);
      const permissions=await db.query(
        `SELECT has_table_privilege('anon',$1,'SELECT') AS anon_read,
                has_table_privilege('authenticated',$1,'INSERT') AS authenticated_insert`,
        ["public."+relation]);
      assert.deepEqual(permissions.rows[0],{anon_read:false,authenticated_insert:false});
    }
    // Recording failure is a distinct, immutable operating exception.
    // A new assessment is never self-issued merely because the old video broke.
    const incidentRunId=randomUUID();
    await db.query(`INSERT INTO public.specialist_practical_benchmark_runs
      (id,tutor_assignment_id,tutor_id,proof_key,proof_version,bank_version,
       attempt_number,preflight_attested,recording_started_before_reveal_attested,
       consent_to_recording_attested,privacy_scope_attested)
      VALUES($1,$2,$3,'evidence',2,1,1,true,true,true,true)`,
      [incidentRunId,assignmentId,tutorId]);
    const incidentCase={caseKey:"evidence.assistance",caseVersion:1,sequence:1,
      workflowSteps:[{kind:"rep",label:"Recorded synthetic rep",prompt:"CI only"}]};
    await db.query(`INSERT INTO public.specialist_practical_benchmark_case_reveals
      (run_id,case_sequence,case_key,case_version,case_snapshot)
      VALUES($1,1,'evidence.assistance',1,$2::jsonb)`,
      [incidentRunId,JSON.stringify(incidentCase)]);
    await assert.rejects(db.query(`
      UPDATE public.specialist_practical_benchmark_runs SET status='abandoned',
      completed_at=now() WHERE id=$1`,[incidentRunId]),/Benchmark must reveal/);
    const recovery=await db.query(`INSERT INTO public.specialist_practical_recording_recovery_requests
      (run_id,reason,incident_note)
      VALUES($1,'recording_interrupted',$2) RETURNING id`,
      [incidentRunId,"Original camera recording stopped before the issued assessment concluded."]);
    const recoveryId=recovery.rows[0].id;
    await assert.rejects(db.query(`INSERT INTO public.specialist_practical_case_actions
      (run_id,case_sequence,step_number,operation_key,recorded_payload,system_snapshot)
      VALUES($1,1,1,'rep','{}'::jsonb,$2::jsonb)`,
      [incidentRunId,JSON.stringify(incidentCase.workflowSteps[0])]),/held for the assigned TD/);
    await assert.rejects(db.query(`DELETE FROM public.specialist_practical_recording_recovery_requests
      WHERE id=$1`,[recoveryId]),/immutable/);
    await assert.rejects(db.query(`UPDATE public.specialist_practical_benchmark_runs
       SET active_case_index=2 WHERE id=$1`,[incidentRunId]),/incident must be resolved/);
    await db.query(`INSERT INTO public.specialist_practical_recording_recovery_decisions
      (request_id,reviewer_id,decision,rationale)
      VALUES($1,$2,'approve_repeat',$3)`,
      [recoveryId,reviewerId,
       "The assigned TD reviewed the documented interruption and authorizes a new full, uninterrupted attempt."]);
    await db.query(`UPDATE public.specialist_practical_benchmark_runs
      SET status='abandoned',completed_at=now() WHERE id=$1`,[incidentRunId]);
    await assert.rejects(db.query(`UPDATE public.specialist_practical_benchmark_runs
      SET status='active',completed_at=NULL WHERE id=$1`,[incidentRunId]),/Benchmark must reveal/);
    await assert.rejects(db.query(`DELETE FROM public.specialist_practical_recording_recovery_decisions
      WHERE request_id=$1`,[recoveryId]),/immutable/);
    const nextRun=await db.query(`INSERT INTO public.specialist_practical_benchmark_runs
      (tutor_assignment_id,tutor_id,proof_key,proof_version,bank_version,attempt_number,
       preflight_attested,recording_started_before_reveal_attested,
       consent_to_recording_attested,privacy_scope_attested)
      VALUES($1,$2,'evidence',2,1,2,true,true,true,true) RETURNING id`,[assignmentId,tutorId]);
    assert.ok(nextRun.rows[0].id,"One separately issued attempt follows the immutable TD recovery");

    const runId=randomUUID();
    await db.query(`INSERT INTO public.specialist_practical_benchmark_runs
      (id,tutor_assignment_id,tutor_id,proof_key,proof_version,bank_version,
       attempt_number,preflight_attested,recording_started_before_reveal_attested,
       consent_to_recording_attested,privacy_scope_attested)
      VALUES($1,$2,$3,'prepare',2,1,1,true,true,true,true)`,[runId,assignmentId,tutorId]);
    const fixtureSteps=(i:number)=>[
      {kind:"configure",label:"Synthetic setup "+i,prompt:"Only a controlled PostgreSQL fixture"},
      {kind:"rep",label:"Synthetic real rep "+i,prompt:"Only immutable fake evidence"},
    ];
    const reveal=async(i:number)=>db.query(`
      INSERT INTO public.specialist_practical_benchmark_case_reveals
        (run_id,case_sequence,case_key,case_version,case_snapshot)
      VALUES($1,$2,$3,1,$4::jsonb)`,
      [runId,i,"prepare.case"+i,
       JSON.stringify({sequence:i,title:"Synthetic fixed case "+i,workflowSteps:fixtureSteps(i)})]);
    const operation=(i:number,n:number)=>db.query(`
      INSERT INTO public.specialist_practical_case_actions
        (run_id,case_sequence,step_number,operation_key,recorded_payload,system_snapshot)
      VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [runId,i,n,fixtureSteps(i)[n-1].kind,JSON.stringify({fictionalOnly:true}),JSON.stringify(fixtureSteps(i)[n-1])]);
    await reveal(1);
    await assert.rejects(operation(1,2),/out of sequence/);
    await assert.rejects(db.query(
      "UPDATE public.specialist_practical_benchmark_runs SET active_case_index=3 WHERE id=$1",
      [runId]),/must reveal every case once/);
    await reveal(2);
    await assert.rejects(db.query(
      "UPDATE public.specialist_practical_benchmark_runs SET active_case_index=2 WHERE id=$1",
      [runId]),/must reveal every case once/);
    await operation(1,1);
    await assert.rejects(db.query(
      "UPDATE public.specialist_practical_benchmark_runs SET active_case_index=2 WHERE id=$1",
      [runId]),/must reveal every case once/);
    await operation(1,2);
    await assert.rejects(operation(1,2),/out of sequence|duplicate key/);
    await db.query("UPDATE public.specialist_practical_benchmark_runs SET active_case_index=2 WHERE id=$1",[runId]);
    await assert.rejects(operation(1,1),/out of sequence/);
    await reveal(3);
    await operation(2,1);
    await operation(2,2);
    await db.query("UPDATE public.specialist_practical_benchmark_runs SET active_case_index=3 WHERE id=$1",[runId]);
    await assert.rejects(db.query(
      "UPDATE public.specialist_practical_benchmark_runs SET active_case_index=4,status='complete',completed_at=now() WHERE id=$1",
      [runId]),/must reveal every case once/);
    await operation(3,1);
    await operation(3,2);
    await db.query("UPDATE public.specialist_practical_benchmark_runs SET active_case_index=4,status='complete',completed_at=now() WHERE id=$1",[runId]);
    await assert.rejects(db.query(
      "UPDATE public.specialist_practical_case_actions SET recorded_payload='{}'::jsonb WHERE run_id=$1",
      [runId]),/immutable/);
    await assert.rejects(db.query(
      "DELETE FROM public.specialist_practical_case_actions WHERE run_id=$1",
      [runId]),/immutable/);
    await assert.rejects(db.query("DELETE FROM public.specialist_practical_benchmark_case_reveals WHERE run_id=$1",[runId]),/immutable/);
    await assert.rejects(db.query("UPDATE public.specialist_practical_benchmark_runs SET active_case_index=1 WHERE id=$1",[runId]),/cannot be erased or restarted|must reveal/);

    const insertV2=(run:string|null,duration:number)=>db.query(`
      INSERT INTO public.specialist_capability_practical_evidence
        (tutor_assignment_id,tutor_id,proof_key,proof_version,attempt_number,
         artifact_url,artifact_type,declaration,competency_links,no_real_student_data_confirmed,
         benchmark_run_id,recording_duration_seconds,recording_started_before_reveal_attested,
         continuous_unedited_attested,setup_tools_demonstrated_attested)
      VALUES($1,$2,'prepare',2,1,'https://example.org/synthetic-uncut-video','screen_video',
        '{}'::jsonb,'[]'::jsonb,true,$3,$4,true,true,true) RETURNING id`,
      [assignmentId,tutorId,run,duration]);
    await assert.rejects(insertV2(null,900),/three executed benchmark cases/);
    await assert.rejects(insertV2(runId,0),/three executed benchmark cases/);
    // A complete longer-than-old-window recording is allowed, but integrity
    // and TD duration agreement are still mandatory.
    const newEvidence=await insertV2(runId,3600);
    const latestEvidenceId=newEvidence.rows[0].id;

    const caseReviews=[1,2,3].map(i=>({
      caseKey:"prepare.case"+i,judgment:"clear",
      observedEvidence:"The unedited synthetic test video shows directly observable Specialist setup and response to this case.",videoTraceMatched:true,
    }));
    const video={
      observedDurationSeconds:3600,recordingContinuous:true,
      recordingBeginsBeforeReveal:true,allThreeCasesVisible:true,
      environmentAndToolsVisible:true,specialistScreenFaceVoiceObservable:true,
      flaggedCutOrManipulation:false,flaggedTechnicalInterruption:false,
    };
    const insertReview=(cases:any,verification:any,outcome="approved")=>db.query(`
      INSERT INTO public.specialist_capability_practical_reviews
        (evidence_id,reviewer_id,reviewer_role,outcome,benchmark_case_reviews,recording_verification)
      VALUES($1,$2,'td',$3,$4::jsonb,$5::jsonb) RETURNING id`,
      [latestEvidenceId,reviewerId,outcome,JSON.stringify(cases),JSON.stringify(verification)]);
    await assert.rejects(insertReview(caseReviews.slice(0,2),video),/all three exact benchmark cases/);
    await assert.rejects(
      insertReview(caseReviews.map((c,i)=>i===1?{...c,videoTraceMatched:false}:c),video),
      /match each case to the original video/
    );
    await assert.rejects(insertReview(caseReviews,{...video,recordingContinuous:false}),/incomplete or interrupted/);
    await assert.rejects(insertReview(caseReviews,{...video,observedDurationSeconds:3575}),/duration/);
    await assert.rejects(insertReview(caseReviews,{...video,observedDurationSeconds:700}),/duration must be positive and agree/);
    await assert.rejects(insertReview(caseReviews,{...video,flaggedCutOrManipulation:true}),/integrity review/);
    const accepted=await insertReview(caseReviews,video);
    assert.ok(accepted.rows[0]?.id);
    await assert.rejects(db.query("UPDATE public.specialist_capability_practical_reviews SET outcome='repeat_required' WHERE id=$1",[accepted.rows[0].id]),/immutable/);
  }finally{
    await db.end();
  }
});
