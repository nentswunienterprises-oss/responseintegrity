import assert from "node:assert/strict";
import pg from "pg";

const { Client } = pg;

const PROOF_REF = "jftlxeacphvbnhbsbpxc";
const PROD_REF = "yzcnavucvwgmulcxgxvw";
const mode = String(process.env.CURRICULUM_V2_PROMOTION_MODE || "plan").trim().toLowerCase();

const proofUrl = String(process.env.RI_PROOF_DATABASE_URL || "").trim();
const productionUrl = String(process.env.RI_PRODUCTION_DATABASE_URL || "").trim();
const asJson = (value) => JSON.stringify(value);

assert.ok(["plan", "stage"].includes(mode), "CURRICULUM_V2_PROMOTION_MODE must be plan or stage");
if (mode === "stage") {
  assert.equal(
    String(process.env.CURRICULUM_V2_PROMOTION_CONFIRM || "").trim(),
    "THE_HUB_STAGE_V2",
    "Stage requires CURRICULUM_V2_PROMOTION_CONFIRM=THE_HUB_STAGE_V2",
  );
}
assert.ok(proofUrl.includes(PROOF_REF), "Proof database URL does not identify the Proof project");
assert.ok(productionUrl.includes(PROD_REF), "Production database URL does not identify The Hub");

const approvedBanks = [
  {
    assessmentKey: "why_training_continues_beyond_clarity_mastery_v1",
    version: 1,
    itemCount: 45,
    formSize: 15,
    threshold: 100,
    itemHash: "7ad2d45ee308514ebff87818c906ff2f",
    configHash: "bdb34aeb0e29613bc3362c8777f6fd3c",
  },
  {
    assessmentKey: "operating_system_retrieval_v2",
    version: 1,
    itemCount: 64,
    formSize: 32,
    threshold: 96,
    itemHash: "f1f84b0df96c9063ccfb64ba5ec9e90b",
    configHash: "f3517a50b988021e2d2fa6ec6b9b28db",
  },
  {
    assessmentKey: "operating_system_transfer_v2",
    version: 1,
    itemCount: 64,
    formSize: 32,
    threshold: 96,
    itemHash: "ae7e03517c19e9f17e945d4913f55c56",
    configHash: "0896808ecee6543f480b8f31d2e7c883",
  },
];

const ssl = { rejectUnauthorized: true };
const proof = new Client({ connectionString: proofUrl, ssl });
const production = new Client({ connectionString: productionUrl, ssl });

const itemHashSql = `
  select count(*)::int as item_count,
         count(*) filter (where active)::int as active_item_count,
         md5(jsonb_agg(to_jsonb(i) - 'created_at' - 'bank_version' order by item_key)::text) as item_hash
    from private.specialist_capability_assessment_items i
   where assessment_key=$1 and bank_version=$2
`;

const configHashSql = `
  select md5((to_jsonb(c) - array['created_at','retired_at','active','review_mode']::text[])::text) as config_hash
    from private.specialist_capability_assessment_configs c
   where assessment_key=$1 and bank_version=$2
`;

async function loadBank(client, bank) {
  const configResult = await client.query(
    `select assessment_key,bank_version,title,assessment_deep_dive_key,evidence_kind,
            pass_threshold_percent,form_size,max_attempts,retry_cooldown_hours,
            competency_blueprint,active,created_at,retired_at,review_mode
       from private.specialist_capability_assessment_configs
      where assessment_key=$1 and bank_version=$2`,
    [bank.assessmentKey, bank.version],
  );
  const itemResult = await client.query(
    `select assessment_key,bank_version,item_key,competency_key,deep_dive_key,
            prompt,question_kind,options,correct_option_keys,critical_fail_option_keys,
            critical_boundary_keys,explanation,active,created_at,option_feedback
       from private.specialist_capability_assessment_items
      where assessment_key=$1 and bank_version=$2
      order by item_key`,
    [bank.assessmentKey, bank.version],
  );
  const itemHashResult = await client.query(itemHashSql, [bank.assessmentKey, bank.version]);
  const configHashResult = await client.query(configHashSql, [bank.assessmentKey, bank.version]);

  return {
    config: configResult.rows[0] || null,
    items: itemResult.rows,
    itemCount: Number(itemHashResult.rows[0].item_count),
    activeItemCount: Number(itemHashResult.rows[0].active_item_count),
    itemHash: itemHashResult.rows[0].item_hash,
    configHash: configHashResult.rows[0]?.config_hash || null,
  };
}

function assertApprovedProofBank(bank, state) {
  assert.ok(state.config, `Proof config missing for ${bank.assessmentKey}`);
  assert.equal(state.config.review_mode, false, `Proof Review Mode still on for ${bank.assessmentKey}`);
  assert.equal(Number(state.config.form_size), bank.formSize, `Unexpected form size for ${bank.assessmentKey}`);
  assert.equal(Number(state.config.pass_threshold_percent), bank.threshold, `Unexpected threshold for ${bank.assessmentKey}`);
  assert.equal(state.itemCount, bank.itemCount, `Unexpected item count for ${bank.assessmentKey}`);
  assert.equal(state.activeItemCount, bank.itemCount, `Unexpected active item count for ${bank.assessmentKey}`);
  assert.equal(state.itemHash, bank.itemHash, `Approved item fingerprint mismatch for ${bank.assessmentKey}`);
  assert.equal(state.configHash, bank.configHash, `Approved config fingerprint mismatch for ${bank.assessmentKey}`);
}

async function insertConfig(config) {
  await production.query(
    `insert into private.specialist_capability_assessment_configs (
       assessment_key,bank_version,title,assessment_deep_dive_key,evidence_kind,
       pass_threshold_percent,form_size,max_attempts,retry_cooldown_hours,
       competency_blueprint,active,created_at,retired_at,review_mode
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
    assessment_key,bank_version,item_key,competency_key,deep_dive_key,prompt,question_kind,
    options,correct_option_keys,critical_fail_option_keys,critical_boundary_keys,
    explanation,active,created_at,option_feedback
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
    const state = await loadBank(proof, bank);
    assertApprovedProofBank(bank, state);
    proofBanks.push({ bank, state });
  }

  const plan = [];
  for (const entry of proofBanks) {
    const productionState = await loadBank(production, entry.bank);
    plan.push({
      assessmentKey: entry.bank.assessmentKey,
      version: entry.bank.version,
      proof: {
        itemHash: entry.state.itemHash,
        configHash: entry.state.configHash,
        active: entry.state.config.active,
        reviewMode: entry.state.config.review_mode,
      },
      production: {
        exists: Boolean(productionState.config),
        itemCount: productionState.itemCount,
        itemHash: productionState.itemHash,
        configHash: productionState.configHash,
        active: productionState.config?.active ?? null,
        reviewMode: productionState.config?.review_mode ?? null,
      },
    });
  }

  console.log("CURRICULUM_V2_PROMOTION_PLAN=" + JSON.stringify({
    mode,
    proofProject: PROOF_REF,
    productionProject: PROD_REF,
    banks: plan,
  }));

  if (mode === "plan") {
    await proof.query("rollback");
    process.exitCode = 0;
  } else {
    await production.query("begin");
    try {
      for (const entry of proofBanks) {
        const existing = await loadBank(production, entry.bank);
        if (existing.config) {
          assert.equal(existing.itemCount, entry.bank.itemCount, `Production item count mismatch for ${entry.bank.assessmentKey}`);
          assert.equal(existing.itemHash, entry.bank.itemHash, `Production item fingerprint mismatch for ${entry.bank.assessmentKey}`);
          assert.equal(existing.configHash, entry.bank.configHash, `Production config fingerprint mismatch for ${entry.bank.assessmentKey}`);
          continue;
        }

        await insertConfig(entry.state.config);
        await insertItems(entry.state.items);

        const staged = await loadBank(production, entry.bank);
        assert.equal(staged.itemCount, entry.bank.itemCount, `Staged item count mismatch for ${entry.bank.assessmentKey}`);
        assert.equal(staged.activeItemCount, entry.bank.itemCount, `Staged active item count mismatch for ${entry.bank.assessmentKey}`);
        assert.equal(staged.itemHash, entry.bank.itemHash, `Staged item fingerprint mismatch for ${entry.bank.assessmentKey}`);
        assert.equal(staged.configHash, entry.bank.configHash, `Staged config fingerprint mismatch for ${entry.bank.assessmentKey}`);
        assert.equal(staged.config.active, false, `Staged bank activated early: ${entry.bank.assessmentKey}`);
        assert.equal(staged.config.review_mode, false, `Staged bank entered Review Mode: ${entry.bank.assessmentKey}`);
      }

      await production.query("commit");
    } catch (error) {
      await production.query("rollback");
      throw error;
    }

    const staged = [];
    for (const entry of proofBanks) {
      const state = await loadBank(production, entry.bank);
      staged.push({
        assessmentKey: entry.bank.assessmentKey,
        version: entry.bank.version,
        itemCount: state.itemCount,
        activeItemCount: state.activeItemCount,
        itemHash: state.itemHash,
        configHash: state.configHash,
        active: state.config?.active,
        reviewMode: state.config?.review_mode,
      });
    }

    console.log("CURRICULUM_V2_PROMOTION_STAGE_PASS=" + JSON.stringify({
      proofProject: PROOF_REF,
      productionProject: PROD_REF,
      banks: staged,
      operationalDataCopied: false,
    }));

    await proof.query("rollback");
  }
} finally {
  await proof.end().catch(() => {});
  await production.end().catch(() => {});
}
