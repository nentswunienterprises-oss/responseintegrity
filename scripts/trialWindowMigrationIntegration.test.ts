import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const databaseUrl = process.env.TRIAL_WINDOW_CI_DATABASE_URL;

test("The Hub Trial window starts on first completed session and lasts 35 days", {
  skip: !databaseUrl && "Requires isolated PostgreSQL 17 CI service",
}, async () => {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    // Disposable database only, no The Hub traffic or real family evidence.
    await db.query([
      "CREATE ROLE anon NOLOGIN;",
      "CREATE ROLE authenticated NOLOGIN;",
      "CREATE ROLE service_role NOLOGIN;",
      "CREATE TABLE public.users(id varchar PRIMARY KEY);",
      "CREATE TABLE public.tutor_trial_cases(id varchar PRIMARY KEY, tutor_id varchar NOT NULL, status varchar NOT NULL DEFAULT 'active', updated_at timestamptz NOT NULL DEFAULT now());",
      "CREATE TABLE public.tutor_trial_placements(id varchar PRIMARY KEY, case_id varchar NOT NULL, student_id varchar NOT NULL, status varchar NOT NULL DEFAULT 'active', started_at timestamptz NOT NULL DEFAULT now());",
      "CREATE TABLE public.scheduled_sessions(id uuid PRIMARY KEY, tutor_id varchar, student_id uuid, scheduled_time timestamp without time zone, status varchar);",
    ].join("\n"));
    const sql = readFileSync("migrations/20261010_trial_35_day_first_session.sql", "utf8");
    await db.query(sql);

    for (const column of [
      "window_started_at","window_ends_at","extension_ends_at",
      "extension_reason","extension_approved_at","extension_approved_by_user_id",
    ]) {
      const { rows } = await db.query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tutor_trial_cases' AND column_name=$1",
        [column],
      );
      assert.equal(rows.length, 1, "Missing Trial window column " + column);
    }
    const {rows:triggers}=await db.query(
      "SELECT 1 FROM pg_trigger WHERE tgname='trg_capture_tutor_trial_first_session_v2' AND NOT tgisinternal"
    );
    assert.equal(triggers.length,1);

    const tutor = randomUUID(), familyA = randomUUID(), familyB = randomUUID();
    const reviewer = randomUUID(), caseId = randomUUID();
    await db.query("INSERT INTO public.users(id) VALUES($1)",[reviewer]);
    await db.query("INSERT INTO public.tutor_trial_cases(id,tutor_id) VALUES($1,$2)",[caseId,tutor]);

    const row=async()=>{
      const {rows}=await db.query(
        "SELECT window_started_at,window_ends_at,extension_ends_at FROM public.tutor_trial_cases WHERE id=$1",
        [caseId],
      );
      return rows[0];
    };
    const session=async(input:{date:string; student:string; tutor?:string; status?:string})=>{
      const id=randomUUID();
      await db.query(
        "INSERT INTO public.scheduled_sessions(id,tutor_id,student_id,scheduled_time,status) VALUES ($1,$2,$3,$4,$5)",
        [id,input.tutor||tutor,input.student,input.date,input.status||"scheduled"],
      );
      return id;
    };

    await db.query(
      "INSERT INTO public.tutor_trial_placements(id,case_id,student_id,started_at) VALUES($1,$2,$3,$4)",
      [randomUUID(),caseId,familyA,"2026-08-01T00:00:00.000Z"],
    );
    assert.equal((await row()).window_started_at,null,
      "Placing first Trial family must not start Trial clock");

    // First delivered session can legitimately start before second family is placed.
    const first=await session({student:familyA,date:"2026-08-03T10:00:00.000Z"});
    assert.equal((await row()).window_started_at,null,
      "A merely scheduled session cannot start the Trial clock");
    await db.query("UPDATE public.scheduled_sessions SET status='completed' WHERE id=$1",[first]);
    assert.equal(new Date((await row()).window_started_at).toISOString(),"2026-08-03T10:00:00.000Z");
    assert.equal(new Date((await row()).window_ends_at).toISOString(),"2026-09-07T10:00:00.000Z");

    await db.query(
      "INSERT INTO public.tutor_trial_placements(id,case_id,student_id,started_at) VALUES($1,$2,$3,$4)",
      [randomUUID(),caseId,familyB,"2026-08-05T00:00:00.000Z"],
    );
    assert.equal(new Date((await row()).window_started_at).toISOString(),"2026-08-03T10:00:00.000Z",
      "Second family placement must not reset or defer the clock");
    await session({student:familyB,date:"2026-08-06T10:00:00.000Z",status:"completed"});
    assert.equal(new Date((await row()).window_ends_at).toISOString(),"2026-09-07T10:00:00.000Z");

    // Later completions must not move expiry later.
    await session({student:familyA,date:"2026-08-08T10:00:00.000Z",status:"completed"});
    assert.equal(new Date((await row()).window_started_at).toISOString(),"2026-08-03T10:00:00.000Z");

    // Reconciliation of a genuinely earlier completed Trial delivery can only
    // shorten the window. Never invent data or reset an expired deadline.
    await session({student:familyA,date:"2026-08-02T10:00:00.000Z",status:"completed"});
    assert.equal(new Date((await row()).window_started_at).toISOString(),"2026-08-02T10:00:00.000Z");
    assert.equal(new Date((await row()).window_ends_at).toISOString(),"2026-09-06T10:00:00.000Z");

    await session({student:randomUUID(),date:"2026-08-01T10:00:00.000Z",status:"completed"});
    await session({student:familyA,tutor:randomUUID(),date:"2026-08-01T10:00:00.000Z",status:"completed"});
    assert.equal(new Date((await row()).window_started_at).toISOString(),"2026-08-02T10:00:00.000Z");

    await assert.rejects(
      db.query("UPDATE public.tutor_trial_cases SET window_ends_at='2026-08-16T10:00:00.000Z' WHERE id=$1",[caseId]),
      /tutor_trial_window_35_day_contract/,
    );
    await assert.rejects(
      db.query("UPDATE public.tutor_trial_cases SET extension_ends_at='2026-09-15T10:00:00.000Z' WHERE id=$1",[caseId]),
      /tutor_trial_extension_approval_contract/,
    );
    await db.query(
      "UPDATE public.tutor_trial_cases SET extension_ends_at=$2, extension_reason=$3, extension_approved_at=$4, extension_approved_by_user_id=$5 WHERE id=$1",
      [caseId,"2026-09-15T10:00:00.000Z",
       "Explicit synthetic COO extension fixture, not a live approval.",
       "2026-09-05T10:00:00.000Z",reviewer],
    );
    assert.equal(new Date((await row()).extension_ends_at).toISOString(),"2026-09-15T10:00:00.000Z");
  }finally{
    await db.end();
  }
});
