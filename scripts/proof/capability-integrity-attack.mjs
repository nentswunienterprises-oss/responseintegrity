import "dotenv/config";
import pg from "pg";

const PROOF_PROJECT_REF = "tzgkiaiwnhmnzznvmbfg";
const PRODUCTION_PROJECT_REF = "yzcnavucvwgmulcxgxvw";
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const mode = String(process.argv[2] || "").trim();

function fail(message) {
  console.error(`\n[proof-attack] ${message}`);
  process.exit(1);
}

if (!databaseUrl) fail("DATABASE_URL is required.");
if (databaseUrl.includes(PRODUCTION_PROJECT_REF)) {
  fail("Refusing to run because the Production project reference was detected.");
}
if (!databaseUrl.includes(PROOF_PROJECT_REF)) {
  fail(`DATABASE_URL must target RI Proof (${PROOF_PROJECT_REF}).`);
}

const MODES = new Set([
  "legacy-key-apply",
  "legacy-key-restore",
  "newer-fail-apply",
  "newer-fail-restore",
]);
if (!MODES.has(mode)) {
  fail(
    "Usage: node scripts/proof/capability-integrity-attack.mjs <legacy-key-apply|legacy-key-restore|newer-fail-apply|newer-fail-restore>",
  );
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const LEGACY_ATTACK_ATTEMPT_ID = "proof-cap-c-structured_execution_mastery_v1";
const LEGACY_KEY = "clarity_retrieval_v1";

const NEWER_FAIL_BASE_ATTEMPT_ID = "proof-cap-a-clarity_mastery_v1";
const NEWER_FAIL_ATTACK_ID = "proof-attack-a-clarity-newer-fail";
const NEWER_FAIL_ASSIGNMENT_ID = "proof-shadow-assignment-a";
const NEWER_FAIL_ASSESSMENT_KEY = "clarity_mastery_v1";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function applyLegacyKeyAttack(client) {
  const row = await client.query(
    `SELECT id, assessment_key, assessment_deep_dive_key, evidence_kind, covered_deep_dive_keys, passed
       FROM public.specialist_capability_assessment_attempts
      WHERE id = $1
      FOR UPDATE`,
    [LEGACY_ATTACK_ATTEMPT_ID],
  );
  invariant(row.rowCount === 1, `Expected Charlie fixture attempt ${LEGACY_ATTACK_ATTEMPT_ID}.`);
  const attempt = row.rows[0];
  invariant(
    attempt.assessment_key === "structured_execution_mastery_v1" &&
      attempt.assessment_deep_dive_key === "structured_execution" &&
      attempt.evidence_kind === "mastery" &&
      attempt.passed === true,
    "Charlie fixture is not at the expected clean baseline; restore it before applying this attack.",
  );

  const existing = await client.query(
    `SELECT 1
       FROM private.specialist_capability_assessment_configs
      WHERE assessment_key = $1 AND bank_version = 1`,
    [LEGACY_KEY],
  );
  invariant(existing.rowCount === 0, `${LEGACY_KEY} bank v1 already exists; refusing to overwrite it.`);

  await client.query(
    `INSERT INTO private.specialist_capability_assessment_configs (
       assessment_key, bank_version, title, assessment_deep_dive_key, evidence_kind,
       pass_threshold_percent, form_size, max_attempts, retry_cooldown_hours,
       competency_blueprint, active
     ) VALUES (
       $1, 1, 'Legacy Clarity Retrieval Proof Attack', 'clarity', 'retrieval',
       96.00, 15, 3, 0,
       $2::jsonb,
       true
     )`,
    [
      LEGACY_KEY,
      JSON.stringify({
        coveredDeepDiveKeys: ["clarity"],
        syntheticProofConfig: true,
        proofAttack: "legacy_key_v2_exclusion",
      }),
    ],
  );

  await client.query(
    `UPDATE public.specialist_capability_assessment_attempts
        SET assessment_key = $1,
            assessment_deep_dive_key = 'clarity',
            evidence_kind = 'retrieval',
            covered_deep_dive_keys = '["clarity"]'::jsonb
      WHERE id = $2`,
    [LEGACY_KEY, LEGACY_ATTACK_ATTEMPT_ID],
  );
}

async function restoreLegacyKeyAttack(client) {
  const row = await client.query(
    `SELECT id, assessment_key
       FROM public.specialist_capability_assessment_attempts
      WHERE id = $1
      FOR UPDATE`,
    [LEGACY_ATTACK_ATTEMPT_ID],
  );
  invariant(row.rowCount === 1, `Expected Charlie fixture attempt ${LEGACY_ATTACK_ATTEMPT_ID}.`);

  if (row.rows[0].assessment_key === LEGACY_KEY) {
    await client.query(
      `UPDATE public.specialist_capability_assessment_attempts
          SET assessment_key = 'structured_execution_mastery_v1',
              assessment_deep_dive_key = 'structured_execution',
              evidence_kind = 'mastery',
              covered_deep_dive_keys = '["structured_execution"]'::jsonb
        WHERE id = $1`,
      [LEGACY_ATTACK_ATTEMPT_ID],
    );
  } else {
    invariant(
      row.rows[0].assessment_key === "structured_execution_mastery_v1",
      `Unexpected Charlie fixture key: ${row.rows[0].assessment_key}`,
    );
  }

  await client.query(
    `DELETE FROM private.specialist_capability_assessment_configs
      WHERE assessment_key = $1
        AND bank_version = 1
        AND competency_blueprint->>'proofAttack' = 'legacy_key_v2_exclusion'`,
    [LEGACY_KEY],
  );
}

async function applyNewerFailedAttemptAttack(client) {
  const baseline = await client.query(
    `SELECT *
       FROM public.specialist_capability_assessment_attempts
      WHERE id = $1
      FOR UPDATE`,
    [NEWER_FAIL_BASE_ATTEMPT_ID],
  );
  invariant(baseline.rowCount === 1, `Expected Alpha baseline attempt ${NEWER_FAIL_BASE_ATTEMPT_ID}.`);
  const attempt = baseline.rows[0];
  invariant(
    attempt.tutor_assignment_id === NEWER_FAIL_ASSIGNMENT_ID &&
      attempt.assessment_key === NEWER_FAIL_ASSESSMENT_KEY &&
      Number(attempt.bank_version) === 1 &&
      Number(attempt.attempt_number) === 1 &&
      attempt.passed === true &&
      attempt.has_critical_fail === false,
    "Alpha clarity baseline is not the expected clean passing attempt.",
  );

  const existing = await client.query(
    `SELECT id
       FROM public.specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND assessment_key = $2
        AND attempt_number = 2`,
    [NEWER_FAIL_ASSIGNMENT_ID, NEWER_FAIL_ASSESSMENT_KEY],
  );
  invariant(existing.rowCount === 0, "Alpha clarity already has attempt 2; restore the newer-fail attack first.");

  await client.query(
    `INSERT INTO public.specialist_capability_assessment_attempts (
       id, tutor_assignment_id, tutor_id, assessment_key, bank_version, attempt_number,
       form_id, form_item_keys, assessment_deep_dive_key, evidence_kind,
       covered_deep_dive_keys, pass_threshold_percent, total_questions, correct_questions,
       percent, has_critical_fail, critical_fail_question_keys, passed,
       responses, question_results, completed_at, created_at
     ) VALUES (
       $1, $2, $3, $4, $5, 2,
       'proof-attack-a-clarity-newer-fail-form', $6::jsonb, $7, $8,
       $9::jsonb, $10, $11, GREATEST($11 - 1, 0),
       93.33, false, '[]'::jsonb, false,
       '[]'::jsonb, '[]'::jsonb, now(), now()
     )`,
    [
      NEWER_FAIL_ATTACK_ID,
      attempt.tutor_assignment_id,
      attempt.tutor_id,
      attempt.assessment_key,
      attempt.bank_version,
      JSON.stringify(attempt.form_item_keys || []),
      attempt.assessment_deep_dive_key,
      attempt.evidence_kind,
      JSON.stringify(attempt.covered_deep_dive_keys || []),
      attempt.pass_threshold_percent,
      attempt.total_questions,
    ],
  );
}

async function restoreNewerFailedAttemptAttack(client) {
  const row = await client.query(
    `SELECT id, tutor_assignment_id, assessment_key, attempt_number
       FROM public.specialist_capability_assessment_attempts
      WHERE id = $1
      FOR UPDATE`,
    [NEWER_FAIL_ATTACK_ID],
  );
  if (row.rowCount === 0) return;
  invariant(
    row.rowCount === 1 &&
      row.rows[0].tutor_assignment_id === NEWER_FAIL_ASSIGNMENT_ID &&
      row.rows[0].assessment_key === NEWER_FAIL_ASSESSMENT_KEY &&
      Number(row.rows[0].attempt_number) === 2,
    "Newer-fail attack row does not match the expected synthetic fixture.",
  );
  await client.query(
    `DELETE FROM public.specialist_capability_assessment_attempts WHERE id = $1`,
    [NEWER_FAIL_ATTACK_ID],
  );
}

async function printVerification(client) {
  if (mode.startsWith("legacy-key")) {
    const result = await client.query(
      `SELECT id, assessment_key, bank_version, attempt_number, evidence_kind, covered_deep_dive_keys, passed
         FROM public.specialist_capability_assessment_attempts
        WHERE id = $1`,
      [LEGACY_ATTACK_ATTEMPT_ID],
    );
    console.table(result.rows);
    return;
  }

  const result = await client.query(
    `SELECT id, tutor_assignment_id, assessment_key, bank_version, attempt_number,
            percent, has_critical_fail, passed, completed_at
       FROM public.specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND assessment_key = $2
      ORDER BY attempt_number`,
    [NEWER_FAIL_ASSIGNMENT_ID, NEWER_FAIL_ASSESSMENT_KEY],
  );
  console.table(result.rows);
}

const client = await pool.connect();
try {
  console.log(`[proof-attack] Target confirmed: ${PROOF_PROJECT_REF}`);
  await client.query("BEGIN");
  if (mode === "legacy-key-apply") await applyLegacyKeyAttack(client);
  if (mode === "legacy-key-restore") await restoreLegacyKeyAttack(client);
  if (mode === "newer-fail-apply") await applyNewerFailedAttemptAttack(client);
  if (mode === "newer-fail-restore") await restoreNewerFailedAttemptAttack(client);
  await client.query("COMMIT");

  await printVerification(client);
  console.log(`\n[proof-attack] ${mode} complete. Production was not targeted.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("\n[proof-attack] Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
