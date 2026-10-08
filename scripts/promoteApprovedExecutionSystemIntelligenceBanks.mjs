import assert from "node:assert/strict";
import pg from "pg";

const { Client } = pg;

const PROOF_REF = "jftlxeacphvbnhbsbpxc";
const PROD_REF = "yzcnavucvwgmulcxgxvw";
const mode = String(process.env.BANK_PROMOTION_MODE || "plan").trim().toLowerCase();

const proofUrl = [
  process.env.RI_PROOF_DATABASE_URL,
  process.env.RI_PROOF_DB_URL,
  process.env.PROOF_DATABASE_URL,
  process.env.SUPABASE_PROOF_DATABASE_URL,
].find((value) => String(value || "").trim());

const productionUrl = String(process.env.RI_PRODUCTION_DATABASE_URL || "").trim();

assert.ok(["plan", "apply"].includes(mode), "BANK_PROMOTION_MODE must be plan or apply");
assert.ok(proofUrl, "A Proof database URL secret is required");
assert.ok(productionUrl, "RI_PRODUCTION_DATABASE_URL is required");
assert.ok(proofUrl.includes(PROOF_REF), "Proof database URL does not identify the Proof project");
assert.ok(productionUrl.includes(PROD_REF), "Production database URL does not identify The Hub");

const approvedBanks = [
  { assessmentKey: "how_to_model_mastery_v1", version: 8, expectedHash: "4cc42d3af4661ff76110155a673e9c1e" },
  { assessmentKey: "how_to_intervene_mastery_v1", version: 9, expectedHash: "b2e4fbcf3f6589137f5c2f2d24cd76cf" },
  { assessmentKey: "how_to_use_boss_battles_mastery_v1", version: 10, expectedHash: "af93fe94fbd559c736fbb226bf53b148" },
  { assessmentKey: "what_not_to_do_mastery_v1", version: 10, expectedHash: "0a98ca8c5dd75197c39f09338b9f4e6c" },
  {
    assessmentKey: "emotional_discipline_under_discomfort_mastery_v1",
    version: 10,
    expectedHash: String(process.env.EXPECTED_EMOTIONAL_V10_HASH || "").trim() || null,
  },
  { assessmentKey: "how_to_diagnose_mastery_v1", version: 19, expectedHash: "f13f6e478baaaf8b78f8ef55b0a24cfa" },
  { assessmentKey: "how_to_interpret_prompts_mastery_v1", version: 15, expectedHash: "4bc15f2353d19a302798a45ac0c5d5ee" },
  { assessmentKey: "how_baselines_are_established_mastery_v1", version: 15, expectedHash: "aa9d2c8d8bc3e80dba490fb2a73d2661" },
  { assessmentKey: "how_the_system_resolves_uncertainty_mastery_v1", version: 14, expectedHash: "db97b29f4a9a3af8033c42c503aef545" },
];

const ssl = { rejectUnauthorized: true };
const proof = new Client({ connectionString: proofUrl, ssl });
const production = new Client({ connectionString: productionUrl, ssl });

const bankHashSql = `
  select
    count(*)::int as item_count,
    count(*) filter (where active)::int as active_item_count,
    md5(jsonb_agg(to_jsonb(i) - 'created_at' - 'bank_version' order by item_key)::text) as content_hash
  from private.specialist_capability_assessment_items i
  where assessment_key = $1 and bank_version = $2
`;

async function loadProofBank(bank) {
  const configResult = await proof.query(
    `select assessment_key, bank_version, title, assessment_deep_dive_key, evidence_kind,
            pass_threshold_percent, form_size, max_attempts, retry_cooldown_hours,
            competency_blueprint, active, created_at, retired_at, review_mode
       from private.specialist_capability_assessment_configs
      where assessment_key=$1 and bank_version=$2`,
    [bank.assessmentKey, bank.version],
  );
  assert.equal(configResult.rowCount, 1, `Proof config missing for ${bank.assessmentKey} v${bank.version}`);
  const config = configResult.rows[0];

  const itemResult = await proof.query(
    `select assessment_key, bank_version, item_key, competency_key, deep_dive_key,
            prompt, question_kind, options, correct_option_keys, critical_fail_option_keys,
            critical_boundary_keys, explanation, active, created_at, option_feedback
       from private.specialist_capability_assessment_items
      where assessment_key=$1 and bank_version=$2
      order by item_key`,
    [bank.assessmentKey, bank.version],
  );
  assert.equal(itemResult.rowCount, 45, `Proof item count is not 45 for ${bank.assessmentKey} v${bank.version}`);

  const hashResult = await proof.query(bankHashSql, [bank.assessmentKey, bank.version]);
  const hash = hashResult.rows[0];

  const evidenceResult = await proof.query(
    `select
       (select count(*)::int from public.specialist_capability_assessment_attempts
         where assessment_key=$1 and bank_version=$2) as attempts,
       (select count(*)::int from public.specialist_capability_question_confirmations
         where assessment_key=$1 and bank_version=$2) as confirmations`,
    [bank.assessmentKey, bank.version],
  );
  const evidence = evidenceResult.rows[0];

  assert.equal(config.active, true, `Proof config is not active for ${bank.assessmentKey}`);
  assert.equal(config.review_mode, false, `Proof Review Mode is still on for ${bank.assessmentKey}`);
  assert.equal(Number(config.form_size), 15, `Unexpected form size for ${bank.assessmentKey}`);
  assert.equal(Number(config.pass_threshold_percent), 100, `Unexpected pass threshold for ${bank.assessmentKey}`);
  assert.equal(Number(hash.item_count), 45, `Unexpected Proof item count for ${bank.assessmentKey}`);
  assert.equal(Number(hash.active_item_count), 45, `Unexpected Proof active item count for ${bank.assessmentKey}`);
  assert.equal(Number(evidence.attempts), 0, `Review attempts remain on approved Proof bank ${bank.assessmentKey}`);
  assert.equal(Number(evidence.confirmations), 0, `Review confirmations remain on approved Proof bank ${bank.assessmentKey}`);

  if (bank.expectedHash) {
    assert.equal(hash.content_hash, bank.expectedHash, `Founder-approved hash mismatch for ${bank.assessmentKey}`);
  }

  return { config, items: itemResult.rows, hash: hash.content_hash };
}

async function productionState(bank) {
  const cfg = await production.query(
    `select assessment_key, bank_version, active, review_mode
       from private.specialist_capability_assessment_configs
      where assessment_key=$1 and bank_version=$2`,
    [bank.assessmentKey, bank.version],
  );
  const hash = await production.query(bankHashSql, [bank.assessmentKey, bank.version]);
  return {
    exists: cfg.rowCount === 1,
    active: cfg.rowCount === 1 ? cfg.rows[0].active : false,
    reviewMode: cfg.rowCount === 1 ? cfg.rows[0].review_mode : null,
    itemCount: Number(hash.rows[0].item_count),
    activeItemCount: Number(hash.rows[0].active_item_count),
    hash: hash.rows[0].content_hash,
  };
}

async function insertConfig(config) {
  await production.query(
    `insert into private.specialist_capability_assessment_configs (
       assessment_key, bank_version, title, assessment_deep_dive_key, evidence_kind,
       pass_threshold_percent, form_size, max_attempts, retry_cooldown_hours,
       competency_blueprint, active, created_at, retired_at, review_mode
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,null,false)`,
    [
      config.assessment_key,
      config.bank_version,
      config.title,
      config.assessment_deep_dive_key,
      config.evidence_kind,
      config.pass_threshold_percent,
      config.form_size,
      config.max_attempts,
      config.retry_cooldown_hours,
      config.competency_blueprint,
      config.created_at,
    ],
  );
}

async function insertItems(items) {
  const sql = `insert into private.specialist_capability_assessment_items (
    assessment_key, bank_version, item_key, competency_key, deep_dive_key,
    prompt, question_kind, options, correct_option_keys, critical_fail_option_keys,
    critical_boundary_keys, explanation, active, created_at, option_feedback
  ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`;
  for (const item of items) {
    await production.query(sql, [
      item.assessment_key,
      item.bank_version,
      item.item_key,
      item.competency_key,
      item.deep_dive_key,
      item.prompt,
      item.question_kind,
      item.options,
      item.correct_option_keys,
      item.critical_fail_option_keys,
      item.critical_boundary_keys,
      item.explanation,
      item.active,
      item.created_at,
      item.option_feedback,
    ]);
  }
}

await proof.connect();
await production.connect();

try {
  await proof.query("begin read only");
  const proofBanks = [];
  for (const bank of approvedBanks) {
    proofBanks.push({ bank, ...(await loadProofBank(bank)) });
  }

  const before = [];
  for (const entry of proofBanks) {
    before.push({
      assessmentKey: entry.bank.assessmentKey,
      version: entry.bank.version,
      proofHash: entry.hash,
      expectedHash: entry.bank.expectedHash,
      production: await productionState(entry.bank),
    });
  }

  console.log("BANK_PROMOTION_PLAN=" + JSON.stringify({
    mode,
    proofProject: PROOF_REF,
    productionProject: PROD_REF,
    banks: before,
  }));

  if (mode === "plan") {
    await proof.query("rollback");
    await proof.end();
    await production.end();
    process.exit(0);
  }

  for (const entry of proofBanks) {
    assert.ok(entry.bank.expectedHash, `Pinned expected hash missing for ${entry.bank.assessmentKey}`);
  }

  await production.query("begin");
  try {
    for (const entry of proofBanks) {
      const existing = await productionState(entry.bank);
      if (existing.exists) {
        assert.equal(existing.itemCount, 45, `Existing Production item count mismatch for ${entry.bank.assessmentKey}`);
        assert.equal(existing.activeItemCount, 45, `Existing Production active item count mismatch for ${entry.bank.assessmentKey}`);
        assert.equal(existing.hash, entry.hash, `Existing Production content differs for ${entry.bank.assessmentKey}`);
        continue;
      }

      await insertConfig(entry.config);
      await insertItems(entry.items);

      const staged = await productionState(entry.bank);
      assert.equal(staged.itemCount, 45, `Staged Production item count mismatch for ${entry.bank.assessmentKey}`);
      assert.equal(staged.activeItemCount, 45, `Staged Production active item count mismatch for ${entry.bank.assessmentKey}`);
      assert.equal(staged.hash, entry.hash, `Staged Production hash mismatch for ${entry.bank.assessmentKey}`);
      assert.equal(staged.active, false, `New Production bank activated before all banks were verified: ${entry.bank.assessmentKey}`);
      assert.equal(staged.reviewMode, false, `Production Review Mode unexpectedly enabled for ${entry.bank.assessmentKey}`);
    }

    for (const entry of proofBanks) {
      await production.query(
        `update private.specialist_capability_assessment_configs
            set active=false,
                review_mode=false,
                retired_at=coalesce(retired_at, now())
          where assessment_key=$1
            and bank_version<>$2
            and active=true`,
        [entry.bank.assessmentKey, entry.bank.version],
      );
      await production.query(
        `update private.specialist_capability_assessment_configs
            set active=true,
                review_mode=false,
                retired_at=null
          where assessment_key=$1 and bank_version=$2`,
        [entry.bank.assessmentKey, entry.bank.version],
      );
    }

    for (const entry of proofBanks) {
      const finalState = await productionState(entry.bank);
      assert.equal(finalState.active, true, `Production bank did not activate: ${entry.bank.assessmentKey}`);
      assert.equal(finalState.reviewMode, false, `Production Review Mode is on: ${entry.bank.assessmentKey}`);
      assert.equal(finalState.itemCount, 45, `Production item count mismatch: ${entry.bank.assessmentKey}`);
      assert.equal(finalState.activeItemCount, 45, `Production active item count mismatch: ${entry.bank.assessmentKey}`);
      assert.equal(finalState.hash, entry.hash, `Proof/Production hash mismatch: ${entry.bank.assessmentKey}`);
    }

    await production.query("commit");
  } catch (error) {
    await production.query("rollback");
    throw error;
  }

  const after = [];
  for (const entry of proofBanks) {
    after.push({
      assessmentKey: entry.bank.assessmentKey,
      version: entry.bank.version,
      proofHash: entry.hash,
      production: await productionState(entry.bank),
    });
  }

  console.log("BANK_PROMOTION_APPLY_PASS=" + JSON.stringify({
    proofProject: PROOF_REF,
    productionProject: PROD_REF,
    banks: after,
    operationalDataCopied: false,
  }));

  await proof.query("rollback");
} finally {
  await proof.end().catch(() => {});
  await production.end().catch(() => {});
}
