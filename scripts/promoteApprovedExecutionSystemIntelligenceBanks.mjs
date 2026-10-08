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
if (mode === "apply") {
  assert.equal(String(process.env.BANK_PROMOTION_CONFIRM || "").trim(), "THE_HUB", "Apply requires BANK_PROMOTION_CONFIRM=THE_HUB");
}
assert.ok(proofUrl, "A Proof database URL secret is required");
assert.ok(productionUrl, "RI_PRODUCTION_DATABASE_URL is required");
assert.ok(proofUrl.includes(PROOF_REF), "Proof database URL does not identify the Proof project");
assert.ok(productionUrl.includes(PROD_REF), "Production database URL does not identify The Hub");

const approvedBanks = [
  { assessmentKey: "how_to_model_mastery_v1", version: 8, expectedHash: "a2aaa51823c3b8ce7b1035560fb62a90", expectedConfigHash: "2becb3ad969f1a326a59038fbfc5118b" },
  { assessmentKey: "how_to_intervene_mastery_v1", version: 9, expectedHash: "f55c2d2b00ea22614c86ba805a6e38b8", expectedConfigHash: "8dfacfb6b722506e673c05200fd13186" },
  { assessmentKey: "how_to_use_boss_battles_mastery_v1", version: 10, expectedHash: "561855180abd454229edb74b7fc5ce54", expectedConfigHash: "5bdd4ff297b1d7f09106f1204760a5bd" },
  { assessmentKey: "what_not_to_do_mastery_v1", version: 10, expectedHash: "da89e641d7d1e94f3a1d9d5d5e106c88", expectedConfigHash: "86ff187dd614b141bce02a4a3bdeb174" },
  { assessmentKey: "emotional_discipline_under_discomfort_mastery_v1", version: 10, expectedHash: "bc98158d8ffd13d3542ef8e83680ba19", expectedConfigHash: "e3d6c5c4e3f5542232085dbcd929f62a" },
  { assessmentKey: "how_to_diagnose_mastery_v1", version: 19, expectedHash: "b29ff3f49822f0f98797bd0eb0c882d0", expectedConfigHash: "63f3b4c0fa9805c82eb4b34aa6e86918" },
  { assessmentKey: "how_to_interpret_prompts_mastery_v1", version: 15, expectedHash: "106e6e26789a65c983622ca4647468d6", expectedConfigHash: "53918f4c94053ebce1d68402e246569b" },
  { assessmentKey: "how_baselines_are_established_mastery_v1", version: 15, expectedHash: "cd392108cb0fd2612d881a5743bc0052", expectedConfigHash: "9443f015d3d43e32370fafa8a4a72786" },
  { assessmentKey: "how_the_system_resolves_uncertainty_mastery_v1", version: 14, expectedHash: "f1ed5cf8c6a1bcc21c6a204490ed5bb0", expectedConfigHash: "54f92300126467063f681ff18f9877f4" },
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

const configHashSql = `
  select md5((to_jsonb(c) - array['created_at','retired_at','active','review_mode']::text[])::text) as config_hash
  from private.specialist_capability_assessment_configs c
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

  const configHashResult = await proof.query(configHashSql, [bank.assessmentKey, bank.version]);
  assert.equal(configHashResult.rowCount, 1, `Proof config fingerprint missing for ${bank.assessmentKey}`);
  const configHash = configHashResult.rows[0].config_hash;

  assert.equal(hash.content_hash, bank.expectedHash, `Canonical approved item hash mismatch for ${bank.assessmentKey}`);
  assert.equal(configHash, bank.expectedConfigHash, `Canonical approved config hash mismatch for ${bank.assessmentKey}`);

  return { config, items: itemResult.rows, hash: hash.content_hash, configHash };
}

async function productionState(bank) {
  const cfg = await production.query(
    `select assessment_key, bank_version, active, review_mode
       from private.specialist_capability_assessment_configs
      where assessment_key=$1 and bank_version=$2`,
    [bank.assessmentKey, bank.version],
  );
  const hash = await production.query(bankHashSql, [bank.assessmentKey, bank.version]);
  const configHash = await production.query(configHashSql, [bank.assessmentKey, bank.version]);
  return {
    exists: cfg.rowCount === 1,
    active: cfg.rowCount === 1 ? cfg.rows[0].active : false,
    reviewMode: cfg.rowCount === 1 ? cfg.rows[0].review_mode : null,
    itemCount: Number(hash.rows[0].item_count),
    activeItemCount: Number(hash.rows[0].active_item_count),
    hash: hash.rows[0].content_hash,
    configHash: configHash.rowCount === 1 ? configHash.rows[0].config_hash : null,
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
      expectedConfigHash: entry.bank.expectedConfigHash,
      proofConfigHash: entry.configHash,
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
    assert.ok(entry.bank.expectedHash, `Pinned expected item hash missing for ${entry.bank.assessmentKey}`);
    assert.ok(entry.bank.expectedConfigHash, `Pinned expected config hash missing for ${entry.bank.assessmentKey}`);
  }

  await production.query("begin");
  try {
    for (const entry of proofBanks) {
      const existing = await productionState(entry.bank);
      if (existing.exists) {
        assert.equal(existing.itemCount, 45, `Existing Production item count mismatch for ${entry.bank.assessmentKey}`);
        assert.equal(existing.activeItemCount, 45, `Existing Production active item count mismatch for ${entry.bank.assessmentKey}`);
        assert.equal(existing.hash, entry.hash, `Existing Production content differs for ${entry.bank.assessmentKey}`);
        assert.equal(existing.configHash, entry.configHash, `Existing Production config differs for ${entry.bank.assessmentKey}`);
        continue;
      }

      await insertConfig(entry.config);
      await insertItems(entry.items);

      const staged = await productionState(entry.bank);
      assert.equal(staged.itemCount, 45, `Staged Production item count mismatch for ${entry.bank.assessmentKey}`);
      assert.equal(staged.activeItemCount, 45, `Staged Production active item count mismatch for ${entry.bank.assessmentKey}`);
      assert.equal(staged.hash, entry.hash, `Staged Production hash mismatch for ${entry.bank.assessmentKey}`);
      assert.equal(staged.configHash, entry.configHash, `Staged Production config hash mismatch for ${entry.bank.assessmentKey}`);
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
      assert.equal(finalState.hash, entry.hash, `Proof/Production item hash mismatch: ${entry.bank.assessmentKey}`);
      assert.equal(finalState.configHash, entry.configHash, `Proof/Production config hash mismatch: ${entry.bank.assessmentKey}`);
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
      proofConfigHash: entry.configHash,
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
