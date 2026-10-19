import assert from "node:assert/strict";
import pg from "pg";
import fs from "node:fs";

const { Client } = pg;

const PROOF_REF = "jftlxeacphvbnhbsbpxc";
const PROD_REF = "yzcnavucvwgmulcxgxvw";
const mode = String(process.env.EXCEPTION_BANK_PROMOTION_MODE || "plan").trim().toLowerCase();

const proofUrl = [
  process.env.RI_PROOF_DATABASE_URL,
  process.env.RI_PROOF_DB_URL,
  process.env.PROOF_DATABASE_URL,
  process.env.SUPABASE_PROOF_DATABASE_URL,
].find((value) => String(value || "").trim());

const productionUrl = String(process.env.RI_PRODUCTION_DATABASE_URL || "").trim();
const asJson = (value) => JSON.stringify(value);

assert.ok(["plan", "stage"].includes(mode), "EXCEPTION_BANK_PROMOTION_MODE must be plan or stage");
if (mode === "stage") {
  assert.equal(String(process.env.EXCEPTION_BANK_PROMOTION_CONFIRM || "").trim(), "THE_HUB_STAGE_EXCEPTIONS", "Stage requires EXCEPTION_BANK_PROMOTION_CONFIRM=THE_HUB_STAGE_EXCEPTIONS");
}
assert.ok(proofUrl, "A Proof database URL secret is required");
assert.ok(productionUrl, "RI_PRODUCTION_DATABASE_URL is required");
assert.ok(proofUrl.includes(PROOF_REF), "Proof database URL does not identify the Proof project");
assert.ok(productionUrl.includes(PROD_REF), "Production database URL does not identify The Hub");

const approvedBanks=JSON.parse(fs.readFileSync(new URL("../docs/qualification-content/20261014_evidence_exception_promotion_hashes.json",import.meta.url),"utf8"));

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
  assert.equal(itemResult.rowCount, bank.itemCount, `Proof item count is not 45 for ${bank.assessmentKey} v${bank.version}`);

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

  assert.equal(config.active, false, `Reviewed Proof successor must remain inactive for ${bank.assessmentKey}`);
  assert.equal(config.review_mode, false, `Proof Review Mode is still on for ${bank.assessmentKey}`);
  assert.equal(Number(config.form_size), bank.formSize, `Unexpected form size for ${bank.assessmentKey}`);
  assert.equal(Number(config.pass_threshold_percent), bank.threshold, `Unexpected pass threshold for ${bank.assessmentKey}`);
  assert.equal(Number(hash.item_count), bank.itemCount, `Unexpected Proof item count for ${bank.assessmentKey}`);
  assert.equal(Number(hash.active_item_count), bank.itemCount, `Unexpected Proof active item count for ${bank.assessmentKey}`);
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
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,false,$11,null,false)`,
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
      asJson(config.competency_blueprint),
      config.created_at,
    ],
  );
}

async function insertItems(items) {
  const sql = `insert into private.specialist_capability_assessment_items (
    assessment_key, bank_version, item_key, competency_key, deep_dive_key,
    prompt, question_kind, options, correct_option_keys, critical_fail_option_keys,
    critical_boundary_keys, explanation, active, created_at, option_feedback
  ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15::jsonb)`;
  for (const item of items) {
    await production.query(sql, [
      item.assessment_key,
      item.bank_version,
      item.item_key,
      item.competency_key,
      item.deep_dive_key,
      item.prompt,
      item.question_kind,
      asJson(item.options),
      asJson(item.correct_option_keys),
      asJson(item.critical_fail_option_keys),
      asJson(item.critical_boundary_keys),
      item.explanation,
      item.active,
      item.created_at,
      asJson(item.option_feedback),
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

  // Fail closed on any predecessor drift before a stage can insert content.
  for(const entry of proofBanks){
    const active=await production.query("select bank_version from private.specialist_capability_assessment_configs where assessment_key=$1 and active=true",[entry.bank.assessmentKey]);
    assert.equal(active.rowCount,1,"Exactly one active Production predecessor is required");
    assert.equal(Number(active.rows[0].bank_version),entry.bank.previousVersion,"Production predecessor version drift");
    const previous=await productionState({...entry.bank,version:entry.bank.previousVersion});
    assert.equal(previous.hash,entry.bank.predecessorHash,"Production predecessor content drift");
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

  console.log("EXCEPTION_BANK_PROMOTION_PLAN=" + JSON.stringify({
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
        assert.equal(existing.itemCount, entry.bank.itemCount, `Existing Production item count mismatch for ${entry.bank.assessmentKey}`);
        assert.equal(existing.activeItemCount, entry.bank.itemCount, `Existing Production active item count mismatch for ${entry.bank.assessmentKey}`);
        assert.equal(existing.hash, entry.hash, `Existing Production content differs for ${entry.bank.assessmentKey}`);
        assert.equal(existing.configHash, entry.configHash, `Existing Production config differs for ${entry.bank.assessmentKey}`);
        continue;
      }

      await insertConfig(entry.config);
      await insertItems(entry.items);

      const staged = await productionState(entry.bank);
      assert.equal(staged.itemCount, entry.bank.itemCount, `Staged Production item count mismatch for ${entry.bank.assessmentKey}`);
      assert.equal(staged.activeItemCount, entry.bank.itemCount, `Staged Production active item count mismatch for ${entry.bank.assessmentKey}`);
      assert.equal(staged.hash, entry.hash, `Staged Production hash mismatch for ${entry.bank.assessmentKey}`);
      assert.equal(staged.configHash, entry.configHash, `Staged Production config hash mismatch for ${entry.bank.assessmentKey}`);
      assert.equal(staged.active, false, `New Production bank activated before all banks were verified: ${entry.bank.assessmentKey}`);
      assert.equal(staged.reviewMode, false, `Production Review Mode unexpectedly enabled for ${entry.bank.assessmentKey}`);
    }

    // Staging is deliberately inactive. Activation requires matching deployed
    // continuity code and a separately protected activation/readback gate.
    for(const entry of proofBanks){
      const finalState=await productionState(entry.bank);
      assert.equal(finalState.active,false,"Staging must never activate a bank");
      assert.equal(finalState.reviewMode,false,"Staging must not grant Review Mode");
      assert.equal(finalState.itemCount,entry.bank.itemCount);
      assert.equal(finalState.activeItemCount,entry.bank.itemCount);
      assert.equal(finalState.hash,entry.hash);
      assert.equal(finalState.configHash,entry.configHash);
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

  console.log("EXCEPTION_BANK_STAGE_PASS=" + JSON.stringify({
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
