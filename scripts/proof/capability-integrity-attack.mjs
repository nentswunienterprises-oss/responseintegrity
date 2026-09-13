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
if (!new Set(["legacy-key-apply", "legacy-key-restore"]).has(mode)) {
  fail("Usage: node scripts/proof/capability-integrity-attack.mjs <legacy-key-apply|legacy-key-restore>");
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const ATTEMPT_ID = "proof-cap-c-structured_execution_mastery_v1";
const LEGACY_KEY = "clarity_retrieval_v1";

async function applyLegacyKeyAttack(client) {
  const row = await client.query(
    `SELECT id, assessment_key, assessment_deep_dive_key, evidence_kind, covered_deep_dive_keys, passed
       FROM public.specialist_capability_assessment_attempts
      WHERE id = $1
      FOR UPDATE`,
    [ATTEMPT_ID],
  );
  if (row.rowCount !== 1) fail(`Expected Charlie fixture attempt ${ATTEMPT_ID}.`);
  const attempt = row.rows[0];
  if (
    attempt.assessment_key !== "structured_execution_mastery_v1" ||
    attempt.assessment_deep_dive_key !== "structured_execution" ||
    attempt.evidence_kind !== "mastery" ||
    attempt.passed !== true
  ) {
    fail("Charlie fixture is not at the expected clean baseline; restore it before applying this attack.");
  }

  const existing = await client.query(
    `SELECT 1
       FROM private.specialist_capability_assessment_configs
      WHERE assessment_key = $1 AND bank_version = 1`,
    [LEGACY_KEY],
  );
  if (existing.rowCount) fail(`${LEGACY_KEY} bank v1 already exists; refusing to overwrite it.`);

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
    [LEGACY_KEY, ATTEMPT_ID],
  );
}

async function restoreLegacyKeyAttack(client) {
  const row = await client.query(
    `SELECT id, assessment_key
       FROM public.specialist_capability_assessment_attempts
      WHERE id = $1
      FOR UPDATE`,
    [ATTEMPT_ID],
  );
  if (row.rowCount !== 1) fail(`Expected Charlie fixture attempt ${ATTEMPT_ID}.`);

  if (row.rows[0].assessment_key === LEGACY_KEY) {
    await client.query(
      `UPDATE public.specialist_capability_assessment_attempts
          SET assessment_key = 'structured_execution_mastery_v1',
              assessment_deep_dive_key = 'structured_execution',
              evidence_kind = 'mastery',
              covered_deep_dive_keys = '["structured_execution"]'::jsonb
        WHERE id = $1`,
      [ATTEMPT_ID],
    );
  } else if (row.rows[0].assessment_key !== "structured_execution_mastery_v1") {
    fail(`Unexpected Charlie fixture key: ${row.rows[0].assessment_key}`);
  }

  await client.query(
    `DELETE FROM private.specialist_capability_assessment_configs
      WHERE assessment_key = $1
        AND bank_version = 1
        AND competency_blueprint->>'proofAttack' = 'legacy_key_v2_exclusion'`,
    [LEGACY_KEY],
  );
}

const client = await pool.connect();
try {
  console.log(`[proof-attack] Target confirmed: ${PROOF_PROJECT_REF}`);
  await client.query("BEGIN");
  if (mode === "legacy-key-apply") await applyLegacyKeyAttack(client);
  if (mode === "legacy-key-restore") await restoreLegacyKeyAttack(client);
  await client.query("COMMIT");

  const verification = await client.query(
    `SELECT id, assessment_key, bank_version, attempt_number, evidence_kind, covered_deep_dive_keys, passed
       FROM public.specialist_capability_assessment_attempts
      WHERE id = $1`,
    [ATTEMPT_ID],
  );
  console.table(verification.rows);
  console.log(`\n[proof-attack] ${mode} complete. Production was not targeted.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("\n[proof-attack] Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
