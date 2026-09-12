import "dotenv/config";
import crypto from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const PROOF_PROJECT_REF = "jftlxeacphvbnhbsbpxc";
const PRODUCTION_PROJECT_REF = "yzcnavucvwgmulcxgxvw";

const supabaseUrl = String(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
).trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const databaseUrl = String(process.env.DATABASE_URL || "").trim();

function fail(message) {
  console.error(`\n[proof-seed] ${message}`);
  process.exit(1);
}

if (!supabaseUrl) fail("SUPABASE_URL (or VITE_SUPABASE_URL) is required.");
if (!serviceRoleKey) {
  fail(
    "SUPABASE_SERVICE_ROLE_KEY is required. Use the RI Proof service-role key locally; never paste it into chat or commit it.",
  );
}
if (!databaseUrl) fail("DATABASE_URL is required.");

if (supabaseUrl.includes(PRODUCTION_PROJECT_REF) || databaseUrl.includes(PRODUCTION_PROJECT_REF)) {
  fail("Refusing to seed because a production project reference was detected.");
}
if (!supabaseUrl.includes(PROOF_PROJECT_REF)) {
  fail(`SUPABASE_URL must target RI Proof (${PROOF_PROJECT_REF}).`);
}
if (!databaseUrl.includes(PROOF_PROJECT_REF)) {
  fail(`DATABASE_URL must target RI Proof (${PROOF_PROJECT_REF}).`);
}

const generatedPassword = `RI-Proof-${crypto.randomBytes(12).toString("base64url")}!`;
const password = String(process.env.PROOF_TEST_PASSWORD || generatedPassword);
if (password.length < 12) fail("PROOF_TEST_PASSWORD must be at least 12 characters.");

const actors = [
  {
    key: "coo",
    email: "ri.proof.coo@example.com",
    role: "coo",
    firstName: "Proof",
    lastName: "COO",
    purpose: "Full Sprint 19 reviewer scope",
  },
  {
    key: "hr",
    email: "ri.proof.hr@example.com",
    role: "hr",
    firstName: "Proof",
    lastName: "HR",
    purpose: "Full Sprint 19 reviewer scope",
  },
  {
    key: "td-inscope",
    email: "ri.proof.td.inscope@example.com",
    role: "td",
    firstName: "Proof",
    lastName: "TD In Scope",
    purpose: "Owns the four-person proof cohort pod",
  },
  {
    key: "td-outscope",
    email: "ri.proof.td.outscope@example.com",
    role: "td",
    firstName: "Proof",
    lastName: "TD Out Scope",
    purpose: "Cross-pod denial control",
  },
  {
    key: "specialist",
    email: "ri.proof.specialist@example.com",
    role: "tutor",
    firstName: "Proof",
    lastName: "Specialist",
    purpose: "Non-reviewer / Specialist-facing payload control",
  },
  {
    key: "ceo-control",
    email: "ri.proof.ceo@example.com",
    role: "ceo",
    firstName: "Proof",
    lastName: "CEO Control",
    purpose: "Privileged-but-not-authorized reviewer control",
  },
];

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listAllAuthUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 1000) break;
    page += 1;
  }
  return users;
}

async function ensureAuthUsers() {
  const existing = await listAllAuthUsers();
  const byEmail = new Map(existing.map((user) => [String(user.email || "").toLowerCase(), user]));
  const ids = new Map();

  for (const actor of actors) {
    const metadata = {
      name: `${actor.firstName} ${actor.lastName}`,
      first_name: actor.firstName,
      last_name: actor.lastName,
      proof_fixture: "sprint19-shadow-validation",
    };
    const appMetadata = {
      proof_fixture: "sprint19-shadow-validation",
    };

    const existingUser = byEmail.get(actor.email.toLowerCase());
    if (existingUser) {
      const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: metadata,
        app_metadata: appMetadata,
      });
      if (error) throw error;
      ids.set(actor.key, data.user.id);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: actor.email,
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: appMetadata,
    });
    if (error) throw error;
    ids.set(actor.key, data.user.id);
  }

  return ids;
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

async function seedRiProfiles(ids) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const actor of actors) {
      const id = ids.get(actor.key);
      if (!id) throw new Error(`Missing Auth user ID for ${actor.key}`);
      await client.query(
        `INSERT INTO public.users (
           id, email, first_name, last_name, role, name, verified
         )
         VALUES ($1, $2, $3, $4, $5::public.role, $6, true)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           role = EXCLUDED.role,
           name = EXCLUDED.name,
           verified = true,
           updated_at = now()`,
        [
          id,
          actor.email,
          actor.firstName,
          actor.lastName,
          actor.role,
          `${actor.firstName} ${actor.lastName}`,
        ],
      );
    }

    const inScopeTdId = ids.get("td-inscope");
    const outScopeTdId = ids.get("td-outscope");
    const specialistId = ids.get("specialist");

    await client.query(
      `UPDATE public.pods
          SET td_id = $1
        WHERE id = 'proof-shadow-pod'`,
      [inScopeTdId],
    );

    await client.query(
      `INSERT INTO public.pods (
         id, pod_name, pod_type, phase, td_id, status, vehicle
       )
       VALUES (
         'proof-shadow-outscope-pod',
         'Proof Out-of-Scope Control Pod',
         'training',
         'foundation',
         $1,
         'active',
         '4_seater'
       )
       ON CONFLICT (id) DO UPDATE SET
         pod_name = EXCLUDED.pod_name,
         td_id = EXCLUDED.td_id,
         status = EXCLUDED.status,
         deleted_at = null`,
      [outScopeTdId],
    );

    await client.query(
      `INSERT INTO public.tutor_assignments (
         id, tutor_id, pod_id, student_count, certification_status, operational_mode
       )
       VALUES (
         'proof-login-specialist-assignment',
         $1,
         'proof-shadow-outscope-pod',
         0,
         'pending',
         'training'
       )
       ON CONFLICT (id) DO UPDATE SET
         tutor_id = EXCLUDED.tutor_id,
         pod_id = EXCLUDED.pod_id,
         certification_status = EXCLUDED.certification_status,
         operational_mode = EXCLUDED.operational_mode`,
      [specialistId],
    );

    const cohort = await client.query(
      `SELECT ta.id, ta.tutor_id, ta.pod_id
         FROM public.tutor_assignments ta
         JOIN public.users u ON u.id = ta.tutor_id
        WHERE ta.id LIKE 'proof-shadow-assignment-%'
          AND (
            EXISTS (
              SELECT 1
                FROM public.battle_test_runs b
               WHERE b.tutor_assignment_id = ta.id
                 AND b.subject_type = 'tutor'
            )
            OR EXISTS (
              SELECT 1
                FROM public.specialist_capability_assessment_attempts a
               WHERE a.tutor_assignment_id = ta.id
            )
          )
        ORDER BY ta.id`,
    );

    if (cohort.rowCount !== 4) {
      throw new Error(
        `Expected the Sprint 19 synthetic cohort to remain 4 assignments, found ${cohort.rowCount}.`,
      );
    }

    const loginAssignmentEvidence = await client.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM public.battle_test_runs
            WHERE tutor_assignment_id = 'proof-login-specialist-assignment'
         ) AS has_battle,
         EXISTS (
           SELECT 1 FROM public.specialist_capability_assessment_attempts
            WHERE tutor_assignment_id = 'proof-login-specialist-assignment'
         ) AS has_capability`,
    );
    const evidence = loginAssignmentEvidence.rows[0];
    if (evidence?.has_battle || evidence?.has_capability) {
      throw new Error("The login-only Specialist assignment unexpectedly contains cohort evidence.");
    }

    await client.query("COMMIT");

    return {
      cohortIds: cohort.rows.map((row) => row.id),
      inScopeTdId,
      outScopeTdId,
      specialistId,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

try {
  console.log(`[proof-seed] Target confirmed: ${PROOF_PROJECT_REF}`);
  const ids = await ensureAuthUsers();
  const verification = await seedRiProfiles(ids);

  console.log("\n[proof-seed] Sprint 19 Proof actors are ready.\n");
  console.table(
    actors.map((actor) => ({
      role: actor.role,
      email: actor.email,
      purpose: actor.purpose,
      userId: ids.get(actor.key),
    })),
  );
  console.log(`Shared Proof password: ${password}`);
  console.log("Synthetic cohort IDs:", verification.cohortIds.join(", "));
  console.log("Main proof pod TD:", verification.inScopeTdId);
  console.log("Out-of-scope control TD:", verification.outScopeTdId);
  console.log("\nProduction was not targeted by this script.");
} catch (error) {
  console.error("\n[proof-seed] Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
