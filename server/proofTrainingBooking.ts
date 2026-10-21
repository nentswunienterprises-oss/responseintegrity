import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool, PoolClient } from "pg";

const SPECIALIST_STUDENTS = new Map<string, ReadonlySet<string>>([
  ["77977298-7ac9-41f9-a726-9d5fd634540f", new Set([
    "657994af-a9c4-a7ae-dd13-54cdd462f2ab",
    "f94d1bbe-76ae-11d5-34ee-2990fe4d0aa5",
    "a8ce613e-7f91-48d1-5097-2e34923dbacf",
  ])],
  ["b8448bbf-e01b-4f7b-bf6a-baf3ddb5d0bc", new Set([
    "b093523e-6227-4ebb-9894-b3be775dfcf3",
    "38118d0f-a812-4936-b069-91c3d2eec209",
    "0ed81956-c61c-42af-a9a5-09ebda094935",
    "263c1256-2131-4a76-a0ad-5404dd25ed99",
    "e86d6442-44dc-4fcf-8d38-e327d54ea8c0",
    "483bf620-251b-4db3-a2eb-88ee85d2c858",
  ])],
]);
const ISOLATED_ACCEPTANCE_SPECIALIST = "b8448bbf-e01b-4f7b-bf6a-baf3ddb5d0bc";
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function isCapabilityProofPreview(env: NodeJS.ProcessEnv | Record<string,string|undefined>) {
  let project = "";
  let databaseMatches = false;
  try { project = new URL(env.SUPABASE_URL || "").hostname; } catch { /* fail closed */ }
  try {
    const database = new URL(env.DATABASE_URL || "");
    databaseMatches = database.hostname === "db.jftlxeacphvbnhbsbpxc.supabase.co" ||
      (database.hostname.endsWith(".pooler.supabase.com") &&
       decodeURIComponent(database.username) === "postgres.jftlxeacphvbnhbsbpxc");
  } catch { /* fail closed */ }
  return databaseMatches && env.VERCEL_ENV === "preview" &&
    project === "jftlxeacphvbnhbsbpxc.supabase.co";
}

export function proofTrainingBookingHandler(pool: Pick<Pool, "connect">, env = process.env) {
  return async (req: Request, res: Response) => {
    if (!isCapabilityProofPreview(env)) {
      return res.status(404).json({ message: "Not found" });
    }
    const tutorId = String((req as any).dbUser?.id || "");
    const studentId = String(req.body?.studentId || "");
    const publishedFixture = SPECIALIST_STUDENTS.get(tutorId)?.has(studentId);
    const isolatedOwnedFixture = tutorId === ISOLATED_ACCEPTANCE_SPECIALIST && UUID.test(studentId);
    if (!publishedFixture && !isolatedOwnedFixture) {
      return res.status(403).json({ message: "This controlled booking is unavailable." });
    }
    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      // Serialize repeated setup clicks without altering any learning evidence.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`proof-training:${studentId}`]);
      const owned = await client.query(
        `SELECT s.parent_id FROM public.students s
         JOIN public.parent_enrollments e ON e.id = s.parent_enrollment_id
         WHERE s.id = $1 AND s.tutor_id = $2 AND e.is_sandbox_account = TRUE
         FOR UPDATE OF s`, [studentId, tutorId]);
      if (!owned.rows[0]?.parent_id) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Owned Sandbox student not found." });
      }
      const existing = await client.query(
        `SELECT id FROM public.scheduled_sessions
         WHERE student_id = $1::uuid AND tutor_id = $2 AND type = 'training'
           AND status = 'confirmed' AND parent_confirmed = TRUE AND tutor_confirmed = TRUE
         ORDER BY scheduled_time ASC LIMIT 1`, [studentId, tutorId]);
      let session = existing.rows[0];
      if (!session) {
        const created = await client.query(
          `INSERT INTO public.scheduled_sessions
           (parent_id,tutor_id,student_id,scheduled_time,scheduled_end,timezone,type,status,
            parent_confirmed,tutor_confirmed,created_at,updated_at)
           VALUES ($1,$2,$3::uuid,NOW(),NOW()+INTERVAL '60 minutes','Africa/Johannesburg',
                   'training','confirmed',TRUE,TRUE,NOW(),NOW()) RETURNING id`,
          [String(owned.rows[0].parent_id), tutorId, studentId]);
        session = created.rows[0];
      }

      // Long-running Preview qualification journeys can legitimately consume
      // more than one package.  When the synthetic fixture has exhausted its
      // current package, record an explicit Sandbox renewal boundary before
      // returning the next confirmed booking.  This is commercial-state
      // lineage only: learning state, evidence, history and enrollment stage
      // remain untouched.
      const membershipResult = await client.query(
        `SELECT id, session_quota, sessions_remaining
           FROM public.membership_months
          WHERE parent_id::text = $1::text
            AND student_id::text = $2::text
            AND is_sandbox = TRUE
            AND status = 'active'
          ORDER BY month_start DESC, updated_at DESC
          LIMIT 1
          FOR UPDATE`,
        [String(owned.rows[0].parent_id), studentId],
      );
      const membership = membershipResult.rows[0];
      let renewedPackage = false;
      if (membership && Number(membership.sessions_remaining || 0) <= 0) {
        const renewalSessionId = `proof-renewal:${String(session.id)}`;
        const renewal = await client.query(
          `INSERT INTO public.session_billing_events (
             session_id, parent_id, student_id, enrollment_id, event_type,
             actor_role, actor_id, billing_impact, credits_delta,
             reason_codes, reason_note, metadata, is_sandbox, effective_at, created_at
           )
           SELECT
             $1, $2, $3, s.parent_enrollment_id::text, 'renewal_payment',
             'system', $4, 'restore', 0,
             '["proof_sandbox_package_renewal"]'::jsonb,
             'Preview-only synthetic package renewal for controlled native acceptance',
             jsonb_build_object(
               'proof_fixture', true,
               'processor_charge_occurred', false,
               'scheduled_session_id', $5::text
             ),
             TRUE, NOW(), NOW()
           FROM public.students s
          WHERE s.id::text = $3::text
            AND NOT EXISTS (
              SELECT 1
                FROM public.session_billing_events e
               WHERE e.session_id = $1
                 AND e.event_type = 'renewal_payment'
            )
           RETURNING id`,
          [renewalSessionId, String(owned.rows[0].parent_id), studentId, tutorId, String(session.id)],
        );
        renewedPackage = Number(renewal.rowCount || 0) > 0;
        if (renewedPackage) {
          await client.query(
            `UPDATE public.membership_months
                SET sessions_used = 0,
                    sessions_remaining = session_quota,
                    updated_at = NOW()
              WHERE id = $1`,
            [membership.id],
          );
        }
      }
      await client.query("COMMIT");
      return res.json({
        studentId,
        session,
        reused: existing.rows.length > 0,
        renewedPackage,
        restoredCanonicalState: false,
      });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => undefined);
      console.error("[PROOF] Training booking failed", error);
      return res.status(500).json({ message: "Could not prepare the controlled booking." });
    } finally { client?.release(); }
  };
}

/** Once the fixture roster exists, booking setup must remain a read-only load. */
export async function proofSandboxCoverageReceipt(dependencies: {
  loadStudents: () => Promise<Array<{id:string;label:string}>>;
  provision: () => Promise<{createdAccounts: unknown[]}>;
  requiredStudents?: 8 | 10;
}) {
  const requiredStudents = dependencies.requiredStudents ?? 8;
  if (![8, 10].includes(requiredStudents)) throw new Error("Unapproved controlled roster size");
  let students = await dependencies.loadStudents();
  let createdAccounts = 0;
  if (students.length < requiredStudents) {
    createdAccounts = (await dependencies.provision()).createdAccounts.length;
    students = await dependencies.loadStudents();
  }
  if (students.length < requiredStudents) throw new Error("Controlled profile roster is incomplete");
  return {createdAccounts, studentCount: students.length, students};
}

export function proofSandboxProfileCoverageHandler(
  provision: (tutorId:string)=>Promise<unknown>,
  env = process.env,
) {
  return async (req:Request,res:Response) => {
    if (!isCapabilityProofPreview(env)) return res.status(404).json({message:"Not found"});
    const tutorId=String((req as any).dbUser?.id||"");
    if (tutorId!==ISOLATED_ACCEPTANCE_SPECIALIST)
      return res.status(403).json({message:"This controlled coverage setup is unavailable."});
    try {
      return res.json(await provision(tutorId));
    } catch(error) {
      console.error("[PROOF] Sandbox profile coverage provisioning failed",error);
      return res.status(500).json({message:"Could not prepare controlled profile coverage."});
    }
  };
}

export function registerProofTrainingBooking(app: Express, dependencies: {
  pool: Pick<Pool, "connect">; isAuthenticated: RequestHandler; requireTutor: RequestHandler;
  provisionProfileCoverage: (tutorId:string)=>Promise<unknown>;
}) {
  app.post("/api/proof/training-booking", dependencies.isAuthenticated,
    dependencies.requireTutor, proofTrainingBookingHandler(dependencies.pool));
  app.post("/api/proof/sandbox-profile-coverage", dependencies.isAuthenticated,
    dependencies.requireTutor,
    proofSandboxProfileCoverageHandler(dependencies.provisionProfileCoverage));
}
