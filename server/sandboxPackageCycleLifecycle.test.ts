import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createDemandDatabase, serveDemandDatabase } from "./testing/demandDatabase";

test("Sandbox assignment, proposal, booking, cancellation, exhaustion, renewal, and next-cycle training persist correctly", async (t) => {
  const { db } = await createDemandDatabase();
  await db.exec(await readFile("migrations/2026-05-24_add_session_billing_architecture.sql", "utf8"));
  await db.exec(await readFile("migrations/2026-05-25_add_sandbox_billing_flags.sql", "utf8"));
  await db.exec(`
    ALTER TABLE parent_enrollments ADD COLUMN next_package_key varchar(24);
    ALTER TABLE membership_months
      ADD COLUMN package_key varchar(24) NOT NULL DEFAULT 'monthly_8',
      ADD COLUMN planned_sessions_per_week integer NOT NULL DEFAULT 2,
      ADD COLUMN session_price numeric(10,2) NOT NULL DEFAULT 200,
      ADD COLUMN specialist_per_session_amount numeric(10,2) NOT NULL DEFAULT 130,
      ADD COLUMN platform_per_session_amount numeric(10,2) NOT NULL DEFAULT 70,
      ADD COLUMN specialist_earned_amount numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN specialist_payable_amount numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN payout_status varchar(24) NOT NULL DEFAULT 'accruing';
    ALTER TABLE scheduled_sessions
      ADD COLUMN scheduled_end timestamptz,
      ADD COLUMN timezone text,
      ADD COLUMN workflow_stage text,
      ADD COLUMN parent_confirmed boolean NOT NULL DEFAULT false,
      ADD COLUMN tutor_confirmed boolean NOT NULL DEFAULT false,
      ADD COLUMN attendance_status text,
      ADD COLUMN recording_status text,
      ADD COLUMN transcript_status text,
      ADD COLUMN cohost_sync_status text,
      ADD COLUMN google_calendar_id text,
      ADD COLUMN google_event_id text,
      ADD COLUMN google_meet_url text,
      ADD COLUMN google_conference_id text,
      ADD COLUMN google_meet_space_name text,
      ADD COLUMN google_meet_code text,
      ADD COLUMN host_account_id text,
      ADD COLUMN recording_file_id text,
      ADD COLUMN recording_detected_at timestamptz,
      ADD COLUMN transcript_file_id text,
      ADD COLUMN transcript_detected_at timestamptz,
      ADD COLUMN attendance_report_file_id text,
      ADD COLUMN cohost_sync_error text,
      ADD COLUMN last_artifact_sync_at timestamptz,
      ADD COLUMN last_meet_sync_error text;
    ALTER TABLE training_session_runs
      ADD COLUMN tutor_id text,
      ADD COLUMN started_at timestamptz,
      ADD COLUMN submitted_at timestamptz,
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE intro_session_drills ALTER COLUMN drill TYPE jsonb USING drill::jsonb;
    ALTER TABLE response_integrity_diagnosis_runs
      ADD COLUMN session_container text,
      ADD COLUMN activity_kind text,
      ADD COLUMN timing_policy_version integer NOT NULL DEFAULT 0,
      ADD COLUMN timing_authority_contract_id text,
      ADD COLUMN timing_authority_baseline_seconds integer;
    CREATE TABLE response_integrity_evidence_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_drill_id text NOT NULL,
      student_id text NOT NULL,
      scheduled_session_id text NOT NULL,
      activity_kind text NOT NULL
    );
    CREATE TABLE notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_user_id text NOT NULL,
      actor_user_id text,
      channel text NOT NULL DEFAULT 'informational',
      title text NOT NULL,
      message text NOT NULL,
      link text,
      entity_type text,
      entity_id text,
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const transport = await serveDemandDatabase(db);
  Object.assign(process.env, {
    SUPABASE_URL: transport.url,
    SUPABASE_ANON_KEY: "isolated-test",
    SUPABASE_SERVICE_ROLE_KEY: "isolated-test",
    DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test",
    SESSION_SECRET: "sandbox-cycle-proof-session",
    EMERGENCY_DB_MODE: "false",
    VERCEL_ENV: "preview",
    PAYFAST_MERCHANT_ID: "12345678",
    PAYFAST_MERCHANT_KEY: "abc123def4567",
    PAYFAST_SANDBOX_MERCHANT_ID: "sandbox-test",
    PAYFAST_SANDBOX_MERCHANT_KEY: "sandbox-test",
    PAYFAST_PASSPHRASE: "",
    PAYFAST_SANDBOX_PASSPHRASE: "",
    VAPID_PUBLIC_KEY: "",
    VAPID_PRIVATE_KEY: "",
  });

  const { registerRoutes } = await import("./routes.ts");
  const { registerEvidenceCompleteDiagnosisRoutes } = await import("./evidenceCompleteDiagnosisRoutes.ts");
  const { setupAuth } = await import("./supabaseAuth.ts");
  const { pool } = await import("./db.ts");
  const originalQuery = pool.query.bind(pool);
  const originalConnect = pool.connect.bind(pool);
  const query = async (sql: string, params?: unknown[]) => {
    const result = await db.query(sql, params);
    return { ...result, rowCount: result.rowCount ?? result.affectedRows };
  };
  (pool as any).query = query;
  (pool as any).connect = async () => ({
    query,
    release() {},
  });

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { userId: req.headers["x-proof-user"], touch() {}, save(done: (error?: unknown) => void) { done(); } };
    next();
  });
  const use = app.use;
  app.use = (() => app) as any;
  await setupAuth(app);
  app.use = use;
  await registerRoutes(app);
  registerEvidenceCompleteDiagnosisRoutes(app);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await transport.close();
    (pool as any).query = originalQuery as any;
    (pool as any).connect = originalConnect as any;
    await pool.end();
    await db.close();
  });

  const request = async (method: string, path: string, user?: string, body?: unknown) => {
    const response = await fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json", ...(user ? { "x-proof-user": user } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() as any };
  };
  const ok = async (method: string, path: string, user?: string, body?: unknown) => {
    const response = await request(method, path, user, body);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body;
  };

  await db.query("UPDATE tutor_assignments SET operational_mode='sandbox' WHERE tutor_id='specialist'");
  const seedFamily = async (suffix: string) => {
    const parentId = `sandbox-parent-${suffix}`;
    const studentId = `sandbox-student-${suffix}`;
    await db.query("INSERT INTO users(id,role,name,email) VALUES ($1,'parent',$2,$3)", [parentId, `Sandbox Parent ${suffix}`, `${parentId}@example.test`]);
    await db.query("INSERT INTO parents(user_id,onboarding_type) VALUES ($1,'commercial')", [parentId]);
    const enrollment = (await db.query(
      `INSERT INTO parent_enrollments(user_id,parent_full_name,parent_email,student_full_name,status,current_step,
        is_sandbox_account,assignment_lane,assigned_tutor_id,assigned_student_id,package_key,package_sessions,
        planned_sessions_per_week,topic_response_symptoms,topic_recommended_starting_phases)
       VALUES ($1,$2,$3,$4,'awaiting_tutor_acceptance','sandbox-assigned',true,'sandbox','specialist',$5,'monthly_8',8,2,
         '{"Algebra":["question_confusion"]}'::jsonb,'{"Algebra":"Clarity"}'::jsonb)
       RETURNING id`,
      [parentId, `Sandbox Parent ${suffix}`, `${parentId}@example.test`, `Synthetic Student ${suffix}`, studentId],
    )).rows[0];
    await db.query(
      `INSERT INTO students(id,parent_id,tutor_id,parent_enrollment_id,full_name,name,personal_profile)
       VALUES ($1,$2,'specialist',$3,$4,$4,'{}'::jsonb)`,
      [studentId, parentId, enrollment.id, `Synthetic Student ${suffix}`],
    );
    const acceptedAssignment = await ok("POST", `/api/tutor/students/${studentId}/workflow/assignment-decision`, "specialist", {
      decision: "accept",
      enrollmentId: enrollment.id,
    });
    assert.equal(acceptedAssignment.assignmentAccepted, true);
    const persistedAssignment = (await db.query("SELECT status FROM parent_enrollments WHERE id=$1", [enrollment.id])).rows[0];
    assert.equal(persistedAssignment.status, "assigned");

    // Keep a second proposal row for the same assignment. The enrollment pointer
    // is the authority for which proposal its parent is accepting.
    await db.query(
      `INSERT INTO onboarding_proposals(enrollment_id,student_id,tutor_id,parent_id,package_key,package_sessions,
        planned_sessions_per_week,package_amount,created_at)
       VALUES ($1,$2,'specialist',$3,'monthly_8',8,2,1600,'2026-01-01T00:00:00Z')`,
      [enrollment.id, studentId, parentId],
    );
    const proposal = (await db.query(
      `INSERT INTO onboarding_proposals(enrollment_id,student_id,tutor_id,parent_id,package_key,package_sessions,
        planned_sessions_per_week,package_amount,topic_conditioning_topic,topic_conditioning_entry_phase,
        topic_conditioning_stability,created_at)
       VALUES ($1,$2,'specialist',$3,'monthly_8',8,2,1600,'Algebra','Clarity','Low','2026-02-01T00:00:00Z')
       RETURNING id`,
      [enrollment.id, studentId, parentId],
    )).rows[0];
    await db.query(
      "UPDATE parent_enrollments SET status='proposal_sent',current_step='proposal_sent',proposal_id=$1 WHERE id=$2",
      [proposal.id, enrollment.id],
    );
    return { parentId, studentId, enrollmentId: String(enrollment.id), proposalId: String(proposal.id) };
  };

  const familyA = await seedFamily("a");
  const familyB = await seedFamily("b");

  // Proposal acceptance is an explicit checkout and confirmation; repeating
  // either step must preserve the original proposal/payment lineage.
  const checkoutA = await ok("POST", "/api/parent/proposal/accept", familyA.parentId, {});
  assert.equal(checkoutA.paymentStatus, "UNPAID");
  const checkoutRowA = (await db.query(
    "SELECT proposal_id,payment_status,raw_payload FROM payment_transactions WHERE enrollment_id=$1 ORDER BY created_at DESC LIMIT 1",
    [familyA.enrollmentId],
  )).rows[0];
  assert.equal(String(checkoutRowA.proposal_id), familyA.proposalId);
  assert.equal(checkoutRowA.payment_status, "pending");
  const acceptedA = await ok("POST", "/api/parent/proposal/accept", familyA.parentId, { completeSandboxPayment: true });
  assert.equal(acceptedA.paymentStatus, "PAID");
  await ok("POST", "/api/parent/proposal/accept", familyA.parentId, { completeSandboxPayment: true });
  const lineageA = await db.query(
    `SELECT e.status,e.current_step,p.accepted_at,p.parent_code,m.month_key,m.session_quota,m.sessions_used,m.sessions_remaining,
            m.is_sandbox,m.student_id,m.enrollment_id
       FROM parent_enrollments e JOIN onboarding_proposals p ON p.id=e.proposal_id
       JOIN membership_months m ON m.enrollment_id::text=e.id::text
      WHERE e.id=$1`,
    [familyA.enrollmentId],
  );
  assert.equal(lineageA.rows.length, 1, "acceptance retry must not duplicate package cycles");
  assert.equal(lineageA.rows[0].status, "session_booked");
  assert.equal(lineageA.rows[0].current_step, "active_training");
  assert.ok(lineageA.rows[0].accepted_at);
  assert.ok(lineageA.rows[0].parent_code);
  assert.equal(lineageA.rows[0].session_quota, 8);
  assert.equal(lineageA.rows[0].sessions_remaining, 8);
  assert.equal(lineageA.rows[0].is_sandbox, true);
  assert.equal(String(lineageA.rows[0].student_id), familyA.studentId);
  assert.equal(String(lineageA.rows[0].enrollment_id), familyA.enrollmentId);

  const returningParent = await ok("GET", "/api/parent/enrollment-status", familyA.parentId);
  assert.ok(["confirmed", "session_booked", "assigned"].includes(returningParent.status));
  const secondCheckout = await ok("POST", "/api/parent/proposal/accept", familyB.parentId, {});
  assert.equal(secondCheckout.paymentStatus, "UNPAID");
  await ok("POST", "/api/parent/proposal/accept", familyB.parentId, { completeSandboxPayment: true });

  const weekA = ["2027-01-04T09:00:00.000Z", "2027-01-06T09:00:00.000Z"];
  const bookingA = await ok("POST", "/api/parent/training-sessions/schedule-week", familyA.parentId, {
    timezone: "Africa/Johannesburg",
    slots: weekA.map((scheduledStart) => ({ scheduledStart })),
  });
  assert.equal(bookingA.createdCount, 2);
  const repeatedBookingA = await ok("POST", "/api/parent/training-sessions/schedule-week", familyA.parentId, {
    timezone: "Africa/Johannesburg",
    slots: weekA.map((scheduledStart) => ({ scheduledStart })),
  });
  assert.equal(repeatedBookingA.createdCount, 0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM scheduled_sessions WHERE student_id=$1 AND type='training'", [familyA.studentId])).rows[0].n, 2);

  const sessionToCancel = String(bookingA.sessions[0].id);
  const cancellation = await ok("POST", "/api/parent/training-sessions/respond", familyA.parentId, {
    sessionId: sessionToCancel,
    action: "cancel",
    reasonCodes: ["family_schedule_change"],
    reasonNote: "Synthetic test cancellation",
  });
  assert.equal(cancellation.status, "cancelled");
  const repeatCancellation = await request("POST", "/api/parent/training-sessions/respond", familyA.parentId, {
    sessionId: sessionToCancel,
    action: "cancel",
    reasonCodes: ["family_schedule_change"],
  });
  assert.notEqual(repeatCancellation.status, 200);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM session_billing_events WHERE session_id=$1", [sessionToCancel])).rows[0].n, 1);
  assert.equal((await db.query("SELECT sessions_remaining FROM membership_months WHERE enrollment_id=$1", [familyA.enrollmentId])).rows[0].sessions_remaining, 8);

  const cycleA = lineageA.rows[0].month_key;
  const beforeExhaustion = await request("POST", "/api/parent/payments/renew", familyA.parentId, {});
  assert.equal(beforeExhaustion.status, 409, "renewal stays blocked while authoritative package balance remains");

  // Deliver eight synthetic, evidence-backed targeted re-diagnoses through
  // the real completion route. Each completion must atomically retire the
  // booked lesson, record one consume event and update this student's cycle.
  const bookedForConsumption = await db.query(
    "SELECT id FROM scheduled_sessions WHERE student_id=$1 AND type='training' AND status <> 'cancelled' ORDER BY scheduled_time",
    [familyA.studentId],
  );
  const qualifyingSessionIds = bookedForConsumption.rows.slice(0, 1).map((row: any) => String(row.id));
  const consumptionAt = `${cycleA.slice(0, 7)}-05T12:00:00.000Z`;
  if (qualifyingSessionIds.length === 0) throw new Error("Expected one uncancelled scheduled Sandbox lesson");
  await db.query("UPDATE scheduled_sessions SET status='confirmed',parent_confirmed=true,tutor_confirmed=true WHERE id=$1", [qualifyingSessionIds[0]]);
  for (let i = 0; i < 8; i++) {
    if (i > 0) {
      const inserted = await db.query(
        `INSERT INTO scheduled_sessions(parent_id,student_id,tutor_id,type,status,scheduled_time,timezone,parent_confirmed,tutor_confirmed)
         VALUES ($1,$2,'specialist','training','confirmed',now(),'Africa/Johannesburg',true,true) RETURNING id`,
        [familyA.parentId, familyA.studentId],
      );
      qualifyingSessionIds.push(String(inserted.rows[0].id));
    }
    const runId = randomUUID();
    const drillId = randomUUID();
    await db.query(
      `INSERT INTO intro_session_drills(id,student_id,tutor_id,scheduled_session_id,drill,submitted_at)
       VALUES ($1,$2,'specialist',$3,'{"drillType":"training"}'::jsonb,$4)`,
      [drillId, familyA.studentId, qualifyingSessionIds[i], consumptionAt],
    );
    await db.query(
      `INSERT INTO response_integrity_diagnosis_runs(id,student_id,tutor_id,topic,starting_phase,scheduled_session_id,
        session_context,session_container,activity_kind,status,probe_history,decision,source_drill_id,completed_at)
       VALUES ($1,$2,'specialist','Algebra','Clarity',$3,'active_training','scheduled_training_session',
        'targeted_rediagnosis','completed','[]'::jsonb,'{}'::jsonb,$4,$5)`,
      [runId, familyA.studentId, qualifyingSessionIds[i], drillId, consumptionAt],
    );
    await db.query(
      `INSERT INTO response_integrity_evidence_ledger(source_drill_id,student_id,scheduled_session_id,activity_kind)
       VALUES ($1,$2,$3,'targeted_rediagnosis')`,
      [drillId, familyA.studentId, qualifyingSessionIds[i]],
    );
    await ok("POST", "/api/tutor/evidence-complete-diagnosis", "specialist", {
      diagnosisRunId: runId,
      studentId: familyA.studentId,
      topic: "Algebra",
      startingPhase: "Clarity",
    });
    const cycleBalance = (await db.query(
      "SELECT sessions_used,sessions_remaining FROM membership_months WHERE parent_id=$1 AND student_id=$2 AND is_sandbox=true ORDER BY month_key DESC LIMIT 1",
      [familyA.parentId, familyA.studentId],
    )).rows[0];
    assert.equal(cycleBalance.sessions_used, i + 1);
    assert.equal(cycleBalance.sessions_remaining, 7 - i);
    if (i === 0) {
      // Retrying the same completed diagnosis must be idempotent.
      await ok("POST", "/api/tutor/evidence-complete-diagnosis", "specialist", {
        diagnosisRunId: runId,
        studentId: familyA.studentId,
        topic: "Algebra",
        startingPhase: "Clarity",
      });
      assert.equal((await db.query(
        "SELECT count(*)::int AS n FROM session_billing_events WHERE session_id=$1 AND is_sandbox=true AND billing_impact='consume'",
        [qualifyingSessionIds[i]],
      )).rows[0].n, 1);
      assert.equal((await db.query(
        "SELECT sessions_used FROM membership_months WHERE parent_id=$1 AND student_id=$2 AND is_sandbox=true ORDER BY month_key DESC LIMIT 1",
        [familyA.parentId, familyA.studentId],
      )).rows[0].sessions_used, 1);
    }
  }
  const exhaustedSubscription = await ok("GET", "/api/parent/subscription", familyA.parentId);
  assert.equal(exhaustedSubscription.sessionsRemaining, 0);
  assert.equal(exhaustedSubscription.packageExhausted, true);
  assert.equal(exhaustedSubscription.sandbox, true);
  const exhaustedGateSession = (await db.query(
    `INSERT INTO scheduled_sessions(parent_id,student_id,tutor_id,type,status,scheduled_time,timezone,parent_confirmed,tutor_confirmed)
     VALUES ($1,$2,'specialist','training','confirmed',now(),'Africa/Johannesburg',true,true) RETURNING id`,
    [familyA.parentId, familyA.studentId],
  )).rows[0];
  const exhaustedLaunch = await request(
    "GET",
    `/api/tutor/students/${familyA.studentId}/drill-session-access?kind=training&sessionId=${exhaustedGateSession.id}`,
    "specialist",
  );
  assert.equal(exhaustedLaunch.status, 409, JSON.stringify(exhaustedLaunch.body));
  assert.equal(exhaustedLaunch.body.code, "PACKAGE_QUOTA_EXHAUSTED");
  const oldCyclePaidAt = "2026-03-01T00:00:00Z";
  await db.query(
    `INSERT INTO payment_transactions(parent_id,enrollment_id,proposal_id,student_id,tutor_id,provider,payment_status,
      package_key,package_sessions,planned_sessions_per_week,merchant_reference,raw_payload,paid_at,created_at)
     VALUES ($1,$2,$3,$4,'specialist','payfast','paid','monthly_8',8,2,$5,
      '{"renewal":true,"month_key":"2026-02-01","payfast_mode":"sandbox"}'::jsonb,$6,$6)`,
    [familyA.parentId, familyA.enrollmentId, familyA.proposalId, familyA.studentId, `old-cycle-${familyA.parentId}`, oldCyclePaidAt],
  );
  const renewalCheckout = await ok("POST", "/api/parent/payments/renew", familyA.parentId, { packageKey: "monthly_8" });
  assert.equal(renewalCheckout.sandboxCheckout, true);
  const preparedRenewal = (await db.query(
    "SELECT payment_status,student_id,raw_payload FROM payment_transactions WHERE merchant_reference=$1",
    [renewalCheckout.merchantReference],
  )).rows[0];
  assert.equal(preparedRenewal.payment_status, "pending");
  assert.equal(String(preparedRenewal.student_id), familyA.studentId);
  assert.equal(preparedRenewal.raw_payload.month_key, "2026-12-01");
  await ok("POST", "/api/parent/payments/renew", familyA.parentId, {
    packageKey: "monthly_8",
    completeSandboxPayment: true,
  });
  const renewalRows = await db.query(
    "SELECT month_key,session_quota,sessions_used,sessions_remaining,is_sandbox,student_id FROM membership_months WHERE parent_id=$1 AND student_id=$2 ORDER BY month_key",
    [familyA.parentId, familyA.studentId],
  );
  assert.equal(renewalRows.rows.length, 2);
  assert.equal(renewalRows.rows[0].month_key, cycleA);
  assert.equal(renewalRows.rows[0].sessions_used, 8);
  assert.equal(renewalRows.rows[0].sessions_remaining, 0);
  assert.equal(renewalRows.rows[1].month_key, "2026-12-01");
  assert.equal(renewalRows.rows[1].sessions_used, 0);
  assert.equal(renewalRows.rows[1].sessions_remaining, 8);
  assert.equal(renewalRows.rows[1].is_sandbox, true);
  const renewedSubscription = await ok("GET", "/api/parent/subscription", familyA.parentId);
  assert.equal(renewedSubscription.sessionsRemaining, 8, JSON.stringify(renewedSubscription));

  const nextWeek = ["2027-02-01T09:00:00.000Z", "2027-02-03T09:00:00.000Z"];
  const afterRenewalBooking = await ok("POST", "/api/parent/training-sessions/schedule-week", familyA.parentId, {
    timezone: "Africa/Johannesburg",
    slots: nextWeek.map((scheduledStart) => ({ scheduledStart })),
  });
  assert.equal(afterRenewalBooking.createdCount, 2);
  const afterRenewalIds = afterRenewalBooking.sessions.map((session: any) => String(session.id));
  await db.query(
    `UPDATE scheduled_sessions SET status='confirmed',parent_confirmed=true,tutor_confirmed=true
      WHERE id = ANY($1::uuid[])`,
    [afterRenewalIds],
  );
  const trainingAfterRenewal = await ok(
    "GET",
    `/api/tutor/students/${familyA.studentId}/drill-session-access?kind=training&sessionId=${afterRenewalIds[0]}`,
    "specialist",
  );
  assert.equal(trainingAfterRenewal.canLaunch, true);
  assert.equal(trainingAfterRenewal.monthlyQuota.month_key, "2026-12-01");
  assert.equal(trainingAfterRenewal.monthlyQuota.sessions_remaining, 8);

  const studentBCycle = await db.query(
    "SELECT month_key,session_quota,sessions_used,sessions_remaining FROM membership_months WHERE parent_id=$1 AND student_id=$2 AND is_sandbox=true",
    [familyB.parentId, familyB.studentId],
  );
  assert.equal(studentBCycle.rows.length, 1);
  assert.equal(studentBCycle.rows[0].sessions_remaining, 8);
  assert.equal(studentBCycle.rows[0].sessions_used, 0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM scheduled_sessions WHERE student_id=$1 AND type='training'", [familyB.studentId])).rows[0].n, 0);
});
